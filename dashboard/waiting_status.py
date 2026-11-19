"""Read bounded, profile-owned execution evidence without reading task payloads."""
import sqlite3
import time
import json
import math
import os
import re
import subprocess
import sys
from contextlib import closing

try:
    import psutil
except ImportError:
    psutil = None

_HOLDER = re.compile(r'^pid=([1-9][0-9]*)(?::pidns=[0-9]+)?:turn=(.+):platform=([^:]+)$')


def holder_pid_checkable(holder):
    """A lease PID is usable only in its own known Linux PID namespace."""
    if sys.platform != 'linux':
        return True
    token = re.search(r'(?:^|:)pidns=(\d+)(?::|$)', holder or '')
    if token is None:
        return False
    try:
        local = re.search(r'\[(\d+)\]', os.readlink('/proc/self/ns/pid'))
    except OSError:
        return False
    return local is not None and token.group(1) == local.group(1)


def lease_reason(holder, acquired, expires, now):
    """Return why a lease is not positive execution evidence, or None if verified."""
    if not isinstance(holder, str) or not (m := _HOLDER.fullmatch(holder)):
        return 'unsupported_holder'
    if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in (acquired, expires)) or acquired > now or expires <= acquired:
        return 'invalid_lease_time'
    if expires <= now:
        return 'expired_lease'
    if not holder_pid_checkable(holder):
        return 'foreign_or_unknown_pid_namespace'
    if psutil is None:
        return 'process_start_unknown'
    try:
        process = psutil.Process(int(m.group(1)))
        if not process.is_running() or process.status() == psutil.STATUS_ZOMBIE:
            return 'dead_pid'
        started = process.create_time()
        if not isinstance(started, (int, float)) or not math.isfinite(started):
            return 'process_start_unknown'
        if started > acquired:
            return 'pid_reused'
    except psutil.NoSuchProcess:
        return 'dead_pid'
    except (psutil.Error, OSError, ValueError, OverflowError):
        return 'process_start_unknown'
    return None


def _observably_alive(pid):
    """Return True/False when probed, or None when the probe is unavailable."""
    if not isinstance(pid, int) or isinstance(pid, bool) or pid <= 0:
        return False
    try:
        import psutil
    except ImportError:
        psutil = None
    if os.name == 'nt':
        # Never use os.kill on Windows; no psutil means unknown, not dead.
        if psutil is None:
            return None
        try:
            return bool(psutil.pid_exists(pid))
        except (psutil.Error, OSError, ValueError, OverflowError):
            return None
    if psutil is not None:
        try:
            if psutil.Process(pid).status() == psutil.STATUS_ZOMBIE:
                return False
        except psutil.NoSuchProcess:
            return False
        except Exception:
            pass
        try:
            return bool(psutil.pid_exists(pid))
        except (psutil.Error, OSError, ValueError, OverflowError):
            return None
    # Match the POSIX fallback's best-effort zombie check before kill(pid, 0).
    try:
        with open(f'/proc/{pid}/stat', encoding='utf-8') as stat:
            fields = stat.read().split()
        if len(fields) > 2 and fields[2] == 'Z':
            return False
    except FileNotFoundError:
        try:
            result = subprocess.run(['ps', '-o', 'state=', '-p', str(pid)],
                                    capture_output=True, text=True, encoding='utf-8',
                                    errors='replace', timeout=5, check=False)
            if result.returncode == 0 and result.stdout.strip().startswith('Z'):
                return False
        except Exception:
            pass
    except OSError:
        pass
    try:
        os.kill(pid, 0)
        return True
    except PermissionError:
        return True
    except (OSError, OverflowError, ValueError):
        return False


def is_owner_file(path):
    try:
        return path.resolve(strict=True) == path and path.stat().st_nlink == 1
    except (OSError, RuntimeError):
        return False


def read_waiting(db_path, now=None):
    if not is_owner_file(db_path):
        return {'waiting': False, 'waiting_count': 0, 'waiting_sources': []}
    now = time.time() if now is None else now
    count = 0
    try:
        with sqlite3.connect(db_path.as_uri() + '?mode=ro', uri=True, timeout=2) as db:
            rows = db.execute("""SELECT d.state, d.delivery_state, d.updated_at,
                d.owner_pid, d.owner_started_at FROM async_delegations d
                WHERE EXISTS (SELECT 1 FROM sessions s WHERE s.id=d.parent_session_id
                              AND s.source IS NOT NULL AND trim(s.source) != '' AND s.source != 'subagent')
                  AND d.parent_session_id IS NOT NULL AND d.parent_session_id != ''
                  AND d.delivery_state='pending' AND d.updated_at BETWEEN ? AND ?""",
                (now - 48 * 3600, now)).fetchall()
        from gateway.status import get_process_start_time, start_time_fingerprints_match
        for state, delivery, updated, pid, started in rows:
            # A pending terminal result alone does not prove an active delivery.
            if state in ('running', 'stalling', 'finalizing') and isinstance(pid, int) and pid > 0 and started:
                actual = get_process_start_time(pid)
                if actual and _observably_alive(pid) and start_time_fingerprints_match(started, actual):
                    count += 1
    except (OSError, sqlite3.Error, ImportError, TypeError, ValueError):
        pass
    sources = ['delegation'] if count else []
    processes = 0
    try:
        from gateway.status import get_process_start_time, start_time_fingerprints_match
        registry = db_path.parent / 'processes.json'
        entries = json.loads(registry.read_text(encoding='utf-8-sig')) if is_owner_file(registry) else []
        seen = set()
        with sqlite3.connect(db_path.as_uri() + '?mode=ro', uri=True, timeout=2) as db:
            for item in entries if isinstance(entries, list) else []:
                if not isinstance(item, dict):
                    continue
                sid, parent, pid = item.get('session_id'), item.get('parent_session_id'), item.get('pid')
                started, fingerprint = item.get('started_at'), item.get('host_start_time')
                if (not isinstance(sid, str) or not sid or sid in seen or not isinstance(parent, str) or not parent
                        or item.get('notify_on_complete') is not True or item.get('pid_scope') != 'host'
                        or not isinstance(pid, int) or isinstance(pid, bool) or pid <= 0 or not fingerprint
                        or not isinstance(started, (int, float)) or not now - 48 * 3600 <= started <= now):
                    continue
                if not db.execute("SELECT 1 FROM sessions WHERE id=? AND source IS NOT NULL AND source != 'subagent'", (parent,)).fetchone():
                    continue
                actual = get_process_start_time(pid)
                if actual and _observably_alive(pid) and start_time_fingerprints_match(fingerprint, actual):
                    seen.add(sid)
                    processes += 1
    except (OSError, sqlite3.Error, ImportError, TypeError, ValueError):
        pass
    if processes:
        sources.append('process')
    count += processes
    return {'waiting': count > 0, 'waiting_count': count, 'waiting_sources': sources}


def read_active_turn(db_path) -> bool | None:
    """True for verified work, False for no candidate, None for incomplete evidence."""
    if not is_owner_file(db_path):
        return None
    cutoff = time.time()
    try:
        with closing(sqlite3.connect(db_path.as_uri() + '?mode=ro', uri=True, timeout=0.2)) as db:
            rows = db.execute('''SELECT l.holder, l.acquired_at, l.expires_at, s.id IS NOT NULL
                FROM session_turn_leases l LEFT JOIN sessions s ON s.id=l.conversation_id
                WHERE (l.expires_at > ? OR l.expires_at IS NULL)
                  AND (s.source IS NULL OR s.source != 'subagent') LIMIT 65''',
                (cutoff,)).fetchall()
    except (OSError, RuntimeError, sqlite3.Error):
        return None
    unknown = len(rows) > 64
    for holder, acquired, expires, matched in rows[:64]:
        reason = lease_reason(holder, acquired, expires, time.time())
        if matched and reason is None:
            return True
        if reason not in ('dead_pid', 'pid_reused', 'expired_lease'):
            unknown = True
    return None if unknown else False
