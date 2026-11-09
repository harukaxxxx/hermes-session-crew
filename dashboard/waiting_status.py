"""Read bounded, profile-owned waiting evidence without reading task payloads."""
import sqlite3
import time
import json
import os
import subprocess


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


def read_waiting(db_path, now=None):
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
        entries = json.loads((db_path.parent / 'processes.json').read_text(encoding='utf-8-sig'))
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


def has_active_turn(db_path, now=None):
    now = time.time() if now is None else now
    try:
        with sqlite3.connect(db_path.as_uri() + '?mode=ro', uri=True, timeout=2) as db:
            return bool(db.execute('''SELECT 1 FROM session_turn_leases l
                JOIN sessions s ON s.id=l.conversation_id
                WHERE l.expires_at > ? AND (s.source IS NULL OR s.source != 'subagent') LIMIT 1''',
                (now,)).fetchone())
    except (OSError, sqlite3.Error):
        return False
