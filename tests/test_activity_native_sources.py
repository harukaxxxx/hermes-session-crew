"""Read-only source-contract probes; native writers operate on temporary fixture DBs only.

These are negative evidence, not an activity producer or a live fleet test.
"""
import importlib.util
import os
from pathlib import Path
import sys
import time

spec = importlib.util.find_spec('hermes_state')
assert spec and spec.origin
sys.path.insert(0, str(Path(spec.origin).parent))
from hermes_state import SessionDB
import hermes_state_runtime as runtime


def _facts(db):
    with db._read_ctx() as conn:
        return [tuple(r) for r in conn.execute(
            'SELECT l.conversation_id,s.source,s.parent_session_id,l.holder,l.expires_at '
            'FROM session_turn_leases l LEFT JOIN sessions s ON s.id=l.conversation_id')]


def test_native_admission_claim_is_not_a_turn_lease(tmp_path):
    db = SessionDB(db_path=tmp_path / 'state.db')
    try:
        db.create_session('parent', source='desktop')
        epoch = runtime.begin_runtime_epoch(db, instance_id='fixture')
        runtime.admit_session_input(db, epoch=epoch, principal_id='human', session_id='parent', request_id='r1', payload={'text': 'fixture'})
        claim = runtime.claim_session_input(db, epoch=epoch, session_id='parent')
        assert isinstance(claim, dict)
        assert claim['status'] == 'started'
        assert _facts(db) == []
    finally:
        db.close()


def test_native_child_reservation_and_lease_do_not_prove_execution(tmp_path):
    db = SessionDB(db_path=tmp_path / 'state.db')
    try:
        db.create_session('parent', source='desktop')
        db.create_session('child', source='subagent', parent_session_id='parent')
        # This is the native turn lease writer, called without any agent or turn.
        # It proves that even a fresh lease + live pid + parent relation is not
        # by itself an execution-start event.
        assert _facts(db) == []
        holder = f'pid={os.getpid()}:turn=fixture:platform=subagent'
        assert db.try_acquire_session_turn_lease('child', holder, ttl_seconds=300)
        rows = _facts(db)
        assert len(rows) == 1
        assert rows[0][:4] == ('child', 'subagent', 'parent', holder)
        assert rows[0][4] > time.time()
        assert db.release_session_turn_lease('child', holder) is None
        assert _facts(db) == []
    finally:
        db.close()


def test_native_unreleased_lease_survives_dead_owner_until_reclaim(tmp_path, monkeypatch):
    import psutil
    monkeypatch.setattr(psutil, 'pid_exists', lambda pid: False)
    def absent(pid):
        raise psutil.NoSuchProcess(pid)
    monkeypatch.setattr(psutil, 'Process', absent)
    db = SessionDB(db_path=tmp_path / 'state.db')
    try:
        db.create_session('parent', source='desktop')
        # No process with this synthetic impossible PID is started by this test.
        holder = 'pid=999999999:turn=fixture:platform=desktop'
        assert db.try_acquire_session_turn_lease('parent', holder, ttl_seconds=300)
        row = _facts(db)[0]
        assert row[4] > time.time()
        from gateway.status import _pid_exists
        assert not _pid_exists(999999999)
        # Reading does not delete or reinterpret a stale unexpired row as idle.
        assert _facts(db)[0] == row
    finally:
        db.close()
