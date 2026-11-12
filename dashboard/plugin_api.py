"""Profile Rail's optional profile-authorized metadata and folder API.

No transcript, title, prompt, tool arguments, or raw result data is selected.
This is a bounded *snapshot*, not an ordered completion-time event log.
"""
from pathlib import Path
import hashlib
from functools import lru_cache
from itertools import islice
import re
import sqlite3
import uuid
import time
import math
import json
import os
import sys
import stat
try:
    import fcntl
except ImportError:
    fcntl = None
from collections import defaultdict

try:
    import psutil
except ImportError:
    psutil = None

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

from fastapi import APIRouter, HTTPException, Request
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, Field, StrictStr
from hermes_constants import get_default_hermes_root, get_hermes_home

router = APIRouter()
_PROFILE = re.compile(r'^[a-z0-9][a-z0-9_-]{0,63}$')
MAX_ROWS = 2000
MAX_PROFILES = 128
SERVER_EPOCH = uuid.uuid4().hex


class FolderRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    parts: list[StrictStr] = Field(default_factory=list, max_length=64)
    path: StrictStr | None = Field(default=None, max_length=4096)
    after: StrictStr | None = Field(default=None, max_length=255)
    limit: int = Field(default=50, ge=1, le=100, strict=True)


class FolderCreateRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    parts: list[StrictStr] = Field(default_factory=list, max_length=64)
    path: StrictStr | None = Field(default=None, max_length=4096)
    name: StrictStr
    root_id: StrictStr
    parent_id: StrictStr


class IdeaRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    path: StrictStr = Field(max_length=4096)
    root_id: StrictStr = Field(max_length=128)
    directory_id: StrictStr = Field(max_length=128)
    runtime_id: StrictStr = Field(max_length=128)
    project_id: StrictStr = Field(min_length=1, max_length=255)
    owner: StrictStr = Field(min_length=1, max_length=255)
    content: StrictStr = Field(max_length=65536)
    parts: list[StrictStr] = Field(default_factory=list, max_length=0)


_SCRIPTED_STAGES = ('off', 'idle', 'reminder', 'working', 'overlap', 'settled',
                    'awakening-0', 'awakening-1', 'awakening-2', 'awakening-3',
                    'awakening-4', 'awakening-overlap')


class ScriptedControl(BaseModel):
    model_config = ConfigDict(extra='forbid')
    stage: StrictStr = Field(json_schema_extra={'enum': list(_SCRIPTED_STAGES)})


# This deliberately targets one authorized external demo root, not any
# arbitrary HERMES_HOME. State is bounded and process-local, never persisted.
_SCRIPTED_ROOT = Path('/Users/haruka/SessionCrew-Demo')
_SCRIPTED_PROFILES = ('default', 'heimdall', 'loki', 'thor', 'tyr', 'freyja', 'frigg', 'baldr')
_scripted_stage = 'off'


def _scripted_allowed():
    try:
        return (os.environ.get('SESSIONCREW_SCRIPTED_DEMO') == '1' and
                get_default_hermes_root().resolve() == _SCRIPTED_ROOT and
                get_hermes_home().resolve() == _SCRIPTED_ROOT)
    except (OSError, ValueError):
        return False


@router.post('/scripted/control')
def scripted_control(request: ScriptedControl):
    global _scripted_stage
    if not _scripted_allowed():
        raise HTTPException(status_code=403, detail='scripted adapter unavailable')
    if request.stage not in _SCRIPTED_STAGES:
        raise HTTPException(status_code=422, detail='invalid stage')
    _scripted_stage = request.stage
    return {'source': 'synthetic', 'stage': _scripted_stage}


def _scripted_status(stage):
    workers = ('thor', 'tyr', 'freyja', 'frigg')
    awakening = stage.startswith('awakening-')
    if awakening:
        count = 4 if stage == 'awakening-overlap' else int(stage[-1])
        working = set(workers[:count])
        offline = {'loki', 'baldr'} | (set(workers) - working)
    else:
        working = set(workers) if stage in ('working', 'overlap') else set()
        offline = {'baldr'}
    rows = []
    for name in _SCRIPTED_PROFILES:
        state = ('offline' if name in offline else
                 'waiting' if name == 'heimdall' and stage == 'reminder' else
                 'working' if name in working else 'idle')
        rows.append({'profile': name, 'source': 'synthetic', 'stage': stage,
                     'online': state != 'offline', 'state': state,
                     'busy': state == 'working', 'idle_since': None,
                     'scripted_unread': name == 'heimdall' and stage == 'reminder'})
    return rows


def _scripted_snapshot(stage):
    profiles = []
    for name in _SCRIPTED_PROFILES:
        count = 3 if name == 'default' and stage in ('overlap', 'awakening-overlap') else 0
        children = [{'id': f'scripted-child-{i}', 'kind': 'recent', 'leased': False}
                    for i in range(count)]
        activity = {'version': 1, 'coverage': 'observed', 'definition': 'synthetic scripted',
                    'observed_active_count': 0, 'observed_child_active': False,
                    'observed_child_count': count, 'observed_at': time.time(),
                    'unknown_reasons': ['synthetic'],
                    'child_metadata': {'availability': 'available', 'presentation_count': count,
                                       'children': children, 'truncated': False}}
        profiles.append({'profile': name, 'status': 'ok', 'database_id': 'synthetic-' + name,
                         'high_water': 0, 'truncated': False, 'rows': [], 'activity': activity})
    return {'version': 2, 'source_root': 'default', 'source_id': 'synthetic-scripted',
            'server_epoch': SERVER_EPOCH, 'source': 'synthetic', 'stage': stage,
            'scripted_unread_profiles': ['heimdall'] if stage == 'reminder' else [], 'profiles': profiles}


def folder_root():
    """Resolve the process's fleet root without importing private host helpers."""
    suffix = os.environ.get('HERMES_DATA_DIR_SUFFIX', '')
    if sys.platform == 'win32':
        base = Path(os.environ.get('LOCALAPPDATA', '').strip() or Path.home() / 'AppData' / 'Local')
        native = base / ('hermes' + suffix)
    else:
        native = Path.home() / ('.hermes' + suffix)
    raw = os.environ.get('HERMES_HOME', '').strip()
    if not raw:
        return native
    home = Path(os.path.expandvars(os.path.expanduser(raw)))
    if not home.is_absolute():
        raise ValueError('HERMES_HOME must be absolute')
    try:
        home.resolve().relative_to(native.resolve())
        return native
    except ValueError:
        return home.parent.parent if home.parent.name == 'profiles' else home


def _folder_component(name):
    return (isinstance(name, str) and name not in ('', '.', '..') and
            '/' not in name and '\\' not in name and '\x00' not in name and
            len(name) <= 255 and not any(0xD800 <= ord(c) <= 0xDFFF for c in name))


@router.post('/folders')
def browse_folders(request: FolderRequest):
    """Folder names only on the backend filesystem; Hermes is the start."""
    return _folder_operation(request)


@router.post('/folders/mkdir')
def create_folder(request: FolderCreateRequest):
    return _folder_operation(request)


@router.post('/folders/idea')
async def save_idea(request: Request):
    # Bound the raw request before parsing, including malformed UTF-8 and JSON.
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > 262144:
            raise HTTPException(status_code=413, detail='idea request too large')
    try:
        body = IdeaRequest.model_validate_json(bytes(raw))
        content = body.content.encode('utf-8', 'strict')
        if len(content) > 65536 or not body.content.strip():
            raise ValueError('invalid content')
    except (ValueError, UnicodeError):
        raise HTTPException(status_code=400, detail='invalid idea request') from None
    return await run_in_threadpool(_folder_operation, body)


def _save_idea_at(directory_fd, target, directory_info, content):
    if fcntl is None:
        raise HTTPException(status_code=503, detail='safe idea saving unavailable')
    # Serialize writers and idempotence checks made by this backend, including
    # separate workers. Never truncate or replace a pre-existing file.
    try:
        fcntl.flock(directory_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        raise HTTPException(status_code=409, detail='directory busy; retry idea save') from None
    try:
        try:
            file_fd = os.open('IDEA.md', os.O_RDWR | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=directory_fd)
            created = True
        except FileExistsError:
            file_fd = os.open('IDEA.md', os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory_fd)
            created = False
        try:
            info = os.fstat(file_fd)
            if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
                raise HTTPException(status_code=409, detail='existing IDEA.md is unsafe; not overwritten')
            if created:
                view = memoryview(content)
                while view:
                    n = os.write(file_fd, view)
                    if not n:
                        raise OSError('short write')
                    view = view[n:]
                os.fsync(file_fd)
                os.lseek(file_fd, 0, os.SEEK_SET)
            actual = os.read(file_fd, 65537)
            if actual != content:
                if created:
                    raise OSError('idea readback mismatch')
                raise HTTPException(status_code=409, detail='IDEA.md exists with different content; not overwritten')
            # Re-open the complete directory path without following symlinks.
            flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
            check = os.open(target.anchor, flags)
            try:
                for part in target.parts[1:]:
                    next_fd = os.open(part, flags, dir_fd=check)
                    os.close(check)
                    check = next_fd
                checked = os.fstat(check)
                current = os.stat('IDEA.md', dir_fd=check, follow_symlinks=False)
                if ((checked.st_dev, checked.st_ino) != (directory_info.st_dev, directory_info.st_ino) or
                    (current.st_dev, current.st_ino, current.st_nlink) != (info.st_dev, info.st_ino, 1)):
                    raise OSError('directory or file changed')
            finally:
                os.close(check)
            return {'status': 'saved', 'path': str(target / 'IDEA.md')}
        finally:
            os.close(file_fd)
    except HTTPException:
        raise
    except OSError:
        raise HTTPException(status_code=409, detail='IDEA.md save outcome unknown; inspect before retry') from None
    finally:
        fcntl.flock(directory_fd, fcntl.LOCK_UN)


def _folder_operation(request):
    creating = isinstance(request, FolderCreateRequest)
    saving = isinstance(request, IdeaRequest)

    if creating and not _folder_component(request.name):
        raise HTTPException(status_code=400, detail='invalid folder component')
    if any(not _folder_component(part) for part in request.parts) or (not creating and not saving and request.after is not None and not _folder_component(request.after)):
        raise HTTPException(status_code=400, detail='invalid folder component')
    requested_path = request.path
    if requested_path is not None:
        if (request.parts or not requested_path.startswith('/') or
                '\\' in requested_path or '\x00' in requested_path or
                (requested_path != '/' and any(not _folder_component(part) for part in requested_path[1:].split('/')))):
            raise HTTPException(status_code=400, detail='invalid folder path')
    if not hasattr(os, 'O_NOFOLLOW') or not hasattr(os, 'O_DIRECTORY'):
        raise HTTPException(status_code=503, detail='safe folder browsing unavailable')
    try:
        root = Path(os.path.abspath(folder_root()))
        if root == Path(root.anchor) or root == Path.home().absolute():
            raise HTTPException(status_code=403, detail='unsafe Hermes root')
        flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
        # Open each ancestor relative to an already-open directory, never by a
        # checked-then-reopened pathname. Reject symlinks even in ancestors.
        fd = os.open(root.anchor, flags)
        try:
            for component in root.parts[1:]:
                new_fd = os.open(component, flags, dir_fd=fd)
                os.close(fd)
                fd = new_fd
            info = os.fstat(fd)
            # Also reject an alias or renamed directory with the identity of
            # home or filesystem root, not just their lexical pathnames.
            protected = (os.stat(Path.home()), os.stat(root.anchor))
            if any((info.st_dev, info.st_ino) == (s.st_dev, s.st_ino) for s in protected):
                raise HTTPException(status_code=403, detail='unsafe Hermes root')
            # Match the pre-existing endpoints' per-profile runtime boundary.
            home = get_hermes_home().resolve()
            if home not in {path.resolve() for _, path in _profile_homes(root)}:
                raise HTTPException(status_code=403, detail='Profile Rail runtime outside profile inventory')
            root_id = _identity(f'{root.absolute()}:{info.st_dev}:{info.st_ino}')
            runtime_id = _identity(f'{SERVER_EPOCH}:{home}')
            if requested_path is not None:
                next_fd = os.open(root.anchor, flags)
                os.close(fd)
                fd = next_fd
                components = [] if requested_path == '/' else requested_path[1:].split('/')
            else:
                components = request.parts
            for component in components:
                new_fd = os.open(component, flags, dir_fd=fd)
                os.close(fd)
                fd = new_fd
            parent_info = os.fstat(fd)
            directory_id = _identity(f'{parent_info.st_dev}:{parent_info.st_ino}')
            if saving:
                if (request.root_id != root_id or request.directory_id != directory_id or
                        request.runtime_id != runtime_id):
                    raise HTTPException(status_code=409, detail='runtime or directory identity changed')
                target = Path(requested_path)
                # Never write into Hermes management or common credential trees.
                protected_names = {'.ssh', '.gnupg', '.aws', '.azure', '.config', '.kube', '.docker', 'credentials'}
                if (any(part.lower() in protected_names for part in target.parts) or
                    any(target == Path.home() / name or Path.home() / name in target.parents
                        for name in ('.hermes', '.hermes-dev'))):
                    raise HTTPException(status_code=403, detail='protected directory')
                if target == root or root in target.parents:
                    raise HTTPException(status_code=403, detail='Hermes management directory')
                result = _save_idea_at(fd, target, parent_info, request.content.encode('utf-8'))
                return {**result, 'project_id': request.project_id, 'owner': request.owner}
            if creating:
                if request.root_id != root_id or request.parent_id != directory_id:
                    raise HTTPException(status_code=409, detail='directory identity changed')
                try:
                    os.mkdir(request.name, dir_fd=fd)
                except FileExistsError as exc:
                    raise HTTPException(status_code=409, detail='folder already exists') from exc
                # From this point any error is an unknown outcome to the caller:
                # mkdir may have succeeded and MUST NOT be silently retried.
                child_fd = os.open(request.name, flags, dir_fd=fd)
                try:
                    child_info = os.fstat(child_fd)
                    with os.scandir(fd) as entries:
                        names = [entry.name for entry in entries if entry.inode() == child_info.st_ino and entry.is_dir(follow_symlinks=False)]
                    if len(names) != 1 or not _folder_component(names[0]):
                        raise OSError('created folder identity unavailable')
                    # A concurrent rename may invalidate the selected pathname.
                    # Do not report success unless both parent and child still
                    # resolve to the objects we operated on. This is a check,
                    # not an atomic containment or future-stability guarantee.
                    verify_fd = os.open(root.anchor, flags)
                    try:
                        target = (Path(requested_path) if requested_path is not None else root.joinpath(*request.parts))
                        for component in target.parts[1:]:
                            next_fd = os.open(component, flags, dir_fd=verify_fd)
                            os.close(verify_fd)
                            verify_fd = next_fd
                        verified = os.fstat(verify_fd)
                        if (verified.st_dev, verified.st_ino) != (parent_info.st_dev, parent_info.st_ino):
                            raise OSError('parent moved; creation result unknown')
                        checked_fd = os.open(names[0], flags, dir_fd=verify_fd)
                        try:
                            checked = os.fstat(checked_fd)
                            if (checked.st_dev, checked.st_ino) != (child_info.st_dev, child_info.st_ino):
                                raise OSError('child changed; creation result unknown')
                        finally:
                            os.close(checked_fd)
                    finally:
                        os.close(verify_fd)
                    return {'root_id': root_id, 'parent_id': directory_id, 'name': names[0],
                            'path': str(target / names[0]),
                            'directory_id': _identity(f'{child_info.st_dev}:{child_info.st_ino}')}
                finally:
                    os.close(child_fd)
            names = []
            with os.scandir(fd) as entries:
                for entry in entries:
                    if entry.is_dir(follow_symlinks=False):
                        if not _folder_component(entry.name):
                            raise HTTPException(status_code=422, detail='unsupported directory name')
                        names.append(entry.name)
            names.sort()
            page = [name for name in names if request.after is None or name > request.after][:request.limit + 1]
            more = len(page) > request.limit
            page = page[:request.limit]
            return {'root': str(root.absolute()), 'root_id': root_id, 'runtime_id': runtime_id, 'parts': request.parts,
                    'path': requested_path if requested_path is not None else str(root.joinpath(*request.parts)),
                    'directories': page, 'next_after': page[-1] if more else None,
                    'directory_id': directory_id,
                    'scope': 'gateway-filesystem' if requested_path is not None else 'gateway-hermes-root'}
        finally:
            os.close(fd)
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail='folder missing') from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail='folder access denied') from exc
    except OSError as exc:
        raise HTTPException(status_code=403, detail='folder unavailable or symlink refused') from exc


def _identity(value):
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def _profile_homes(root: Path):
    yield 'default', root
    profiles = root / 'profiles'
    try:
        entries = sorted(profiles.iterdir(), key=lambda p: p.name)
    except FileNotFoundError:
        return
    for entry in entries:
        if entry.name != 'default' and _PROFILE.fullmatch(entry.name) and entry.is_dir():
            try:
                if entry.resolve().is_relative_to(profiles.resolve()):
                    yield entry.name, entry
            except OSError:
                continue


def _read_profile(root: Path, name: str, home: Path, limit: int):
    db = home / 'state.db'
    try:
        resolved = db.resolve(strict=True)
        if not resolved.is_relative_to(root.resolve()):
            raise OSError('database outside root')
        stat = resolved.stat()
        database_id = _identity(f'{resolved}:{stat.st_dev}:{stat.st_ino}')
        conn = sqlite3.connect(resolved.as_uri() + '?mode=ro', uri=True, timeout=1)
        try:
            conn.execute('PRAGMA query_only=ON')
            conn.execute('BEGIN')
            # A subagent's completion is not the owning profile's turn.
            where = " FROM session_admissions a JOIN sessions s ON s.id=a.target_session_id WHERE s.source != 'subagent'"
            count, high = conn.execute('SELECT count(*), coalesce(max(a.seq),0)' + where).fetchone()
            rows = conn.execute('SELECT a.seq,a.admission_id,a.target_session_id,a.status,a.outcome,a.generation' + where + ' ORDER BY a.seq DESC LIMIT ?', (limit,)).fetchall()
        finally:
            conn.close()
        fields = ('seq', 'admission_id', 'session_id', 'status', 'outcome', 'generation')
        return {'profile': name, 'status': 'ok', 'database_id': database_id, 'high_water': high, 'truncated': count > limit,
                'rows': [dict(zip(fields, row)) for row in reversed(rows)]}
    except (OSError, sqlite3.Error):
        return {'profile': name, 'status': 'unavailable', 'high_water': None, 'truncated': None, 'rows': []}


_HOLDER = re.compile(r'^pid=([1-9][0-9]*)(?::pidns=[0-9]+)?:turn=(.+):platform=([^:]+)$')
_ACTIVITY_LIMIT = 20000


def _activity_rows(root, home):
    try:
        db = (home / 'state.db').resolve(strict=True)
        if not db.is_relative_to(root.resolve()):
            raise OSError('database outside root')
        stat = db.stat()
        identity = (stat.st_dev, stat.st_ino)
        conn = sqlite3.connect(db.as_uri() + '?mode=ro', uri=True, timeout=1)
        try:
            conn.execute('PRAGMA query_only=ON')
            conn.execute('BEGIN')
            sessions = conn.execute('SELECT id,source,parent_session_id,end_reason,model_config FROM sessions LIMIT ?', (_ACTIVITY_LIMIT + 1,)).fetchall()
            leases = conn.execute('SELECT conversation_id,holder,acquired_at,expires_at FROM session_turn_leases LIMIT ?', (_ACTIVITY_LIMIT + 1,)).fetchall()
        finally:
            conn.close()
        if len(sessions) > _ACTIVITY_LIMIT or len(leases) > _ACTIVITY_LIMIT:
            return None
        return identity, {r[0]: r for r in sessions}, leases
    except (OSError, sqlite3.Error):
        return None


def _lease_reason(holder, acquired, expires, now):
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


def _lineage_root(session_id, sessions):
    seen = set()
    while True:
        if session_id in seen or session_id not in sessions:
            return None
        seen.add(session_id)
        _, source, parent, _, config = sessions[session_id]
        if not parent or source == 'tool':
            return session_id
        try:
            cfg = json.loads(config) if isinstance(config, str) else config
        except (ValueError, TypeError):
            return None
        if isinstance(cfg, dict) and parent in (cfg.get('_branched_from'), cfg.get('_delegate_from'), cfg.get('_reset_from')):
            return session_id
        previous = sessions.get(parent)
        if previous is None:
            return None
        if previous[3] != 'compression':
            return session_id
        session_id = parent


def _collect_activity(root, homes):
    now = time.time()
    inventories = {name: _activity_rows(root, home) for name, home in homes}
    identity_owners = defaultdict(list)
    global_sessions = defaultdict(list)
    for name, inventory in inventories.items():
        if inventory:
            identity_owners[inventory[0]].append(name)
            for sid in inventory[1]:
                global_sessions[sid].append(name)
    results = {}
    for name, inventory in inventories.items():
        reasons = {'bounded_observation', 'host_identity_not_in_lease', 'persistence_disabled_turns_not_observed'}
        results[name] = {'version': 1, 'coverage': 'observed' if inventory else 'unavailable',
                         'observed_active_count': 0 if inventory else None,
                         'observed_child_active': False if inventory else None,
                         'observed_child_count': 0 if inventory else None,
                         'observed_at': now, 'unknown_reasons': [], 'definition': 'native active-turn lease'}
        if not inventory:
            reasons.add('database_or_schema_unavailable')
        elif len(identity_owners[inventory[0]]) != 1:
            results[name].update(coverage='unavailable', observed_active_count=None, observed_child_active=None, observed_child_count=None)
            reasons.add('database_owner_ambiguous')
        results[name]['unknown_reasons'] = sorted(reasons)
    roots = defaultdict(set)
    children = defaultdict(set)
    for name, inventory in inventories.items():
        if not inventory or results[name]['coverage'] != 'observed':
            continue
        _, sessions, leases = inventory
        for sid, holder, acquired, expires in leases:
            reason = _lease_reason(holder, acquired, expires, now)
            row = sessions.get(sid)
            if reason:
                results[name]['unknown_reasons'].append(reason)
            elif not row:
                results[name]['unknown_reasons'].append('session_row_missing')
            elif row[1] == 'subagent':
                parent = row[2]
                owners = global_sessions.get(parent, []) if parent else []
                if any(v is None for v in inventories.values()) or len(owners) != 1 or results[owners[0]]['coverage'] != 'observed':
                    results[name]['unknown_reasons'].append('child_owner_unknown')
                elif inventories[owners[0]][1][parent][1] == 'subagent':
                    results[name]['unknown_reasons'].append('child_parent_not_foreground')
                else:
                    results[owners[0]]['observed_child_active'] = True
                    children[owners[0]].add(sid)
            else:
                lineage = _lineage_root(sid, sessions)
                if lineage is None:
                    results[name]['unknown_reasons'].append('lineage_unknown')
                else:
                    roots[name].add(lineage)
    for name, result in results.items():
        if result['coverage'] == 'observed':
            result['observed_active_count'] = len(roots[name])
            result['observed_child_count'] = len(children[name])
            if any(v is None for v in inventories.values()):
                result['unknown_reasons'].append('other_profile_inventory_unavailable')
        result['unknown_reasons'] = sorted(set(result['unknown_reasons']))
    return results, children


def _collect_child_metadata(root, homes, leased):
    """Bounded native identity observations; recency is not execution evidence."""
    now = time.time()
    inventories = {}
    identities = defaultdict(list)
    for name, home in homes:
        try:
            db = (home / 'state.db').resolve(strict=True)
            if not db.is_relative_to(root.resolve()):
                raise OSError('database outside root')
            stat = db.stat()
            identity = (stat.st_dev, stat.st_ino)
            con = sqlite3.connect(db.as_uri() + '?mode=ro', uri=True, timeout=1)
            try:
                con.execute('PRAGMA query_only=ON')
                con.execute('BEGIN')
                parents = con.execute('SELECT id,source FROM sessions LIMIT ?', (_ACTIVITY_LIMIT + 1,)).fetchall()
                if len(parents) > _ACTIVITY_LIMIT:
                    raise ValueError('session inventory exceeds limit')
                worker = con.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='worker_executions'").fetchone()
                worker_sql = "(SELECT CASE WHEN count(*)=1 THEN max(w.status) END FROM worker_executions w WHERE w.session_id=s.id AND w.kind='child')" if worker else 'NULL'
                rows = con.execute("SELECT s.id,s.parent_session_id,s.started_at,s.ended_at,s.end_reason,s.last_activity_at," + worker_sql + " FROM sessions s WHERE s.source='subagent' AND s.parent_session_id IS NOT NULL ORDER BY max(coalesce(s.ended_at,0),coalesce(s.started_at,0),coalesce(s.last_activity_at,0)) DESC, s.id LIMIT 51").fetchall()
            finally:
                con.close()
            inventories[name] = (identity, dict(parents), rows)
            identities[identity].append(name)
        except (OSError, sqlite3.Error, ValueError):
            inventories[name] = None
    owners = defaultdict(list)
    for name, inv in inventories.items():
        if inv:
            for sid, source in inv[1].items():
                owners[sid].append((name, source))
    result = {name: {'availability': 'available' if inv and len(identities[inv[0]]) == 1 else 'unknown', 'children': [], 'truncated': bool(inv and len(inv[2]) > 50)} for name, inv in inventories.items()}
    for name, inv in inventories.items():
        if not inv or result[name]['availability'] != 'available':
            continue
        for sid, parent, started, ended, reason, last, worker in inv[2][:50]:
            matches = owners.get(parent, [])
            if len(matches) != 1 or matches[0][1] == 'subagent' or result[matches[0][0]]['availability'] != 'available':
                result[name]['availability'] = 'unknown'
                for owner, _ in matches:
                    result[owner]['availability'] = 'unknown'
                continue
            owner = matches[0][0]
            if owner != name and any(v is None for v in inventories.values()):
                result[owner]['availability'] = 'unknown'
                continue
            last_seen = max(v for v in (started, last, 0) if isinstance(v, (int, float)) and math.isfinite(v))
            if ended is not None or worker == 'terminal' or reason in ('completed', 'failed', 'interrupted'):
                kind = reason if reason in ('completed', 'failed', 'interrupted') else 'ended'
                terminal_at = ended if isinstance(ended, (int, float)) and math.isfinite(ended) else last_seen
                if terminal_at < now - 30:
                    continue
            elif last_seen < now - 1200:
                kind = 'stale'
            elif worker == 'registered':
                kind = 'queued'
            else:
                kind = 'recent'
            result[owner]['children'].append({'id': sid, 'kind': kind, 'leased': sid in leased[owner]})
    for name, item in result.items():
        # Shared IDs avoid counting a lease and metadata row twice. Only rows
        # positively classified as queued/recent are eligible; a lease whose
        # metadata was omitted by the bound must not resurrect an ended row.
        if len(item['children']) > 50:
            item['children'] = item['children'][:50]
            item['truncated'] = True
        eligible = {row['id'] for row in item['children'] if row['kind'] in ('queued', 'recent')}
        item['presentation_count'] = len(eligible)
    return result


def collect_snapshot(root: Path, limit: int = MAX_ROWS):
    if not isinstance(limit, int) or isinstance(limit, bool) or not 1 <= limit <= MAX_ROWS:
        raise ValueError('invalid limit')
    root = Path(root)
    homes = list(islice(_profile_homes(root), MAX_PROFILES + 1))
    if len(homes) > MAX_PROFILES:
        raise ValueError('profile inventory exceeds snapshot limit')
    activity, leased = _collect_activity(root, homes)
    metadata = _collect_child_metadata(root, homes, leased)
    profiles = [_read_profile(root, name, home, limit) for name, home in homes]
    for p in profiles:
        p['activity'] = activity[p['profile']]
        p['activity']['child_metadata'] = metadata[p['profile']]
    return {'version': 2, 'source_root': 'default', 'source_id': _identity(str(root.resolve())),
            'server_epoch': SERVER_EPOCH, 'profiles': profiles}


@lru_cache(maxsize=1)
def _status_collector():
    import importlib.util
    spec = importlib.util.spec_from_file_location('profile_rail_status', Path(__file__).resolve().parent / 'status.py')
    collector = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(collector)
    return collector


@router.get('/status')
def status():
    root = get_default_hermes_root()
    try:
        home = get_hermes_home().resolve()
        if home not in {path.resolve() for _, path in _profile_homes(root)}:
            raise HTTPException(status_code=403, detail='Profile Rail runtime outside profile inventory')
        stage = _scripted_stage
        if stage != 'off' and _scripted_allowed():
            return _scripted_status(stage)
        return _status_collector().collect_status()
    except OSError as exc:
        raise HTTPException(status_code=503, detail='profile inventory unavailable') from exc


@router.get('/completion-snapshot')
def snapshot():
    root = get_default_hermes_root()
    # Native plugin routing enforces the requesting profile's explicit consent.
    # Independently restrict the runtime home to this root's real inventory.
    try:
        home = get_hermes_home().resolve()
        if home not in {path.resolve() for _, path in _profile_homes(root)}:
            raise HTTPException(status_code=403, detail='Profile Rail runtime outside profile inventory')
        stage = _scripted_stage
        if stage != 'off' and _scripted_allowed():
            return _scripted_snapshot(stage)
        return collect_snapshot(root)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=503, detail='profile inventory unavailable') from exc
