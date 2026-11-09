import importlib.util
import os
import sys
import time
import threading
import sqlite3
import pytest
from types import SimpleNamespace
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
from hermes_state import SessionDB
from hermes_state_pidns import holder_namespace_token


@pytest.fixture(autouse=True)
def synthetic_process(monkeypatch):
    import psutil
    monkeypatch.setattr(psutil, 'pid_exists', lambda pid: True)
    monkeypatch.setattr(psutil, 'Process', lambda pid: SimpleNamespace(
        is_running=lambda: True, status=lambda: psutil.STATUS_RUNNING,
        create_time=lambda: 0.0))


def load():
    spec = importlib.util.spec_from_file_location('activity_api_test', ROOT / 'dashboard/plugin_api.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_native_lease_is_bounded_observation_and_release_clears(tmp_path):
    api = load()
    db = SessionDB(db_path=tmp_path / 'state.db')
    try:
        db.create_session('one', 'desktop')
        db.create_session('two', 'desktop')
        db.create_session('queued', 'desktop')
        holder = f'pid={os.getpid()}{holder_namespace_token()}:turn=session:task:fixture:platform=desktop'
        assert db.try_acquire_session_turn_lease('one', holder)
        assert db.try_acquire_session_turn_lease('two', holder)
        activity = api.collect_snapshot(tmp_path)['profiles'][0]['activity']
        assert activity['coverage'] == 'observed'
        assert activity['observed_active_count'] == 2
        assert activity['definition'] == 'native active-turn lease'
        db.release_session_turn_lease('one', holder)
        assert api.collect_snapshot(tmp_path)['profiles'][0]['activity']['observed_active_count'] == 1
        db.release_session_turn_lease('two', holder)
        assert api.collect_snapshot(tmp_path)['profiles'][0]['activity']['observed_active_count'] == 0
    finally:
        db.close()


def test_cross_profile_child_owner_and_ambiguous_parent(tmp_path):
    api = load()
    alpha = tmp_path / 'profiles' / 'alpha'; alpha.mkdir(parents=True)
    beta = tmp_path / 'profiles' / 'beta'; beta.mkdir(parents=True)
    rootdb = SessionDB(db_path=tmp_path / 'state.db')
    parentdb = SessionDB(db_path=alpha / 'state.db')
    childdb = SessionDB(db_path=beta / 'state.db')
    try:
        parentdb.create_session('parent', 'desktop')
        childdb.create_session('child', 'subagent')
        # Cross-profile parent metadata may arrive without a local parent row.
        with sqlite3.connect(beta / 'state.db') as conn:
            conn.execute("UPDATE sessions SET parent_session_id='parent' WHERE id='child'")
        holder = f'pid={os.getpid()}{holder_namespace_token()}:turn=a:b:c:platform=subagent'
        assert childdb.try_acquire_session_turn_lease('child', holder)
        result = {p['profile']: p['activity'] for p in api.collect_snapshot(tmp_path)['profiles']}
        assert result['alpha']['observed_child_active'] is True
        assert result['beta']['observed_child_active'] is False
        assert result['beta']['observed_active_count'] == 0
        rootdb.create_session('parent', 'desktop')
        result = {p['profile']: p['activity'] for p in api.collect_snapshot(tmp_path)['profiles']}
        assert result['alpha']['observed_child_active'] is False
        assert 'child_owner_unknown' in result['beta']['unknown_reasons']
    finally:
        rootdb.close(); parentdb.close(); childdb.close()


def test_lease_validation_conservatively_rejects_unverifiable(monkeypatch):
    api = load(); now = time.time()
    holder = f'pid={os.getpid()}{holder_namespace_token()}:turn=a:b:c:platform=desktop'
    assert api._lease_reason('unexpected', now-2, now+100, now) == 'unsupported_holder'
    assert api._lease_reason(holder, now-10, now-1, now) == 'expired_lease'
    class FakeProcess:
        def __init__(self, pid): pass
        def is_running(self): return True
        def status(self): return 'running'
        def create_time(self): return now-1
    monkeypatch.setattr(api.psutil, 'Process', FakeProcess)
    assert api._lease_reason(holder, now-2, now+100, now) == 'pid_reused'
    monkeypatch.setattr(FakeProcess, 'create_time', lambda self: None)
    assert api._lease_reason(holder, now-2, now+100, now) == 'process_start_unknown'
    def dead(pid): raise api.psutil.NoSuchProcess(pid)
    monkeypatch.setattr(api.psutil, 'Process', dead)
    assert api._lease_reason(holder, now-2, now+100, now) == 'dead_pid'


def test_missing_row_and_compression_lineage_and_broken_database(tmp_path):
    api = load(); db = SessionDB(db_path=tmp_path / 'state.db')
    try:
        db.create_session('root', 'desktop')
        db.end_session('root', 'compression')
        db.create_session('continuation', 'desktop', parent_session_id='root')
        holder = f'pid={os.getpid()}{holder_namespace_token()}:turn=a:b:c:platform=desktop'
        assert db.try_acquire_session_turn_lease('continuation', holder)
        assert db.try_acquire_session_turn_lease('unwritten', holder)
        result = api.collect_snapshot(tmp_path)['profiles'][0]['activity']
        assert result['observed_active_count'] == 1
        assert 'session_row_missing' in result['unknown_reasons']
        assert api._lineage_root('continuation', api._activity_rows(tmp_path, tmp_path)[1]) == 'root'
        broken = tmp_path / 'profiles' / 'broken'; broken.mkdir(parents=True)
        (broken / 'state.db').write_bytes(b'not sqlite')
        result = {p['profile']: p['activity'] for p in api.collect_snapshot(tmp_path)['profiles']}
        assert result['broken']['coverage'] == 'unavailable'
        assert result['broken']['observed_active_count'] is None
    finally:
        db.close()


def test_actual_facade_two_turns_are_observed_until_release(tmp_path, monkeypatch):
    from agent.turn_facade import TurnFacadeMixin
    from agent import turn_liveness, background_review
    import types
    conversation_loop = types.ModuleType('agent.conversation_loop')
    monkeypatch.setitem(sys.modules, 'agent.conversation_loop', conversation_loop)
    api = load()
    db = SessionDB(db_path=tmp_path / 'state.db')
    for sid in ('first', 'second'):
        db.create_session(sid, 'desktop')
    gates = {sid: threading.Event() for sid in ('first', 'second')}
    entered = {sid: threading.Event() for sid in gates}
    errors = []
    monkeypatch.setattr(background_review, 'cancel_background_review_for_live_turn', lambda agent: None)
    monkeypatch.setattr(turn_liveness, 'resolve_turn_liveness_settings', lambda cfg: (None, 1))
    def body(agent, *args, **kwargs):
        entered[agent.session_id].set()
        assert gates[agent.session_id].wait(10)
        return {'final_response': 'fixture'}
    monkeypatch.setattr(conversation_loop, 'run_conversation', body, raising=False)
    class Dummy(TurnFacadeMixin):
        def __init__(self, sid):
            self.session_id, self._session_db, self.platform = sid, db, 'desktop'
        def _conversation_root_id(self): return self.session_id
        def _touch_activity(self, *args): pass
        def _liveness_activity_lock(self): return threading.Lock()
    def run(sid):
        try: Dummy(sid).run_conversation('fixture')
        except BaseException as exc: errors.append(exc); entered[sid].set()
    threads = [threading.Thread(target=run, args=(sid,)) for sid in gates]
    try:
        for thread in threads: thread.start()
        assert all(event.wait(10) for event in entered.values())
        assert not errors, errors
        assert api.collect_snapshot(tmp_path)['profiles'][0]['activity']['observed_active_count'] == 2
        gates['first'].set(); threads[0].join(10)
        assert not threads[0].is_alive() and not errors
        assert api.collect_snapshot(tmp_path)['profiles'][0]['activity']['observed_active_count'] == 1
        gates['second'].set(); threads[1].join(10)
        assert not threads[1].is_alive() and not errors
        assert api.collect_snapshot(tmp_path)['profiles'][0]['activity']['observed_active_count'] == 0
    finally:
        for gate in gates.values(): gate.set()
        for thread in threads: thread.join(10)
        db.close()


def test_two_observed_children_and_release(tmp_path):
    api = load(); db = SessionDB(db_path=tmp_path / 'state.db')
    try:
        db.create_session('parent', 'desktop')
        for sid in ('child1', 'child2'):
            db.create_session(sid, 'subagent', parent_session_id='parent')
        holder = f'pid={os.getpid()}{holder_namespace_token()}:turn=a:b:c:platform=subagent'
        for sid in ('child1', 'child2'):
            assert db.try_acquire_session_turn_lease(sid, holder)
        def count(): return api.collect_snapshot(tmp_path)['profiles'][0]['activity']['observed_child_count']
        assert count() == 2
        db.release_session_turn_lease('child1', holder)
        assert count() == 1
        db.release_session_turn_lease('child2', holder)
        assert count() == 0
    finally:
        db.close()
