import importlib.util
from pathlib import Path
import sys
import sqlite3
import time
import os

from hermes_state import SessionDB
from hermes_state_pidns import holder_namespace_token


def load():
    spec = importlib.util.spec_from_file_location('children_test_api', Path(__file__).resolve().parents[1] / 'dashboard/plugin_api.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_native_unleased_child_is_visible_as_metadata_not_running(tmp_path):
    db = SessionDB(db_path=tmp_path / 'state.db')
    try:
        db.create_session('parent', 'desktop')
        db.create_session('child', 'subagent', parent_session_id='parent')
        activity = load().collect_snapshot(tmp_path)['profiles'][0]['activity']
        assert activity['observed_child_count'] == 0
        assert activity['child_metadata']['availability'] == 'available'
        assert [row['kind'] for row in activity['child_metadata']['children']] == ['recent']
    finally:
        db.close()


def test_classification_leases_and_optional_worker_table(tmp_path, monkeypatch):
    import psutil
    from types import SimpleNamespace
    monkeypatch.setattr(psutil, 'Process', lambda pid: SimpleNamespace(
        is_running=lambda: True, status=lambda: psutil.STATUS_RUNNING, create_time=lambda: 0.0))
    db = SessionDB(db_path=tmp_path / 'state.db')
    try:
        db.create_session('parent', 'desktop')
        for sid in ('queued', 'recent', 'stale', 'ended', 'failed'):
            db.create_session(sid, 'subagent', parent_session_id='parent')
        db.end_session('ended', 'agent_close')
        db.end_session('failed', 'failed')
        with sqlite3.connect(tmp_path / 'state.db') as con:
            con.execute('UPDATE sessions SET started_at=?,last_activity_at=? WHERE id=?', (time.time()-1300, time.time()-1300, 'stale'))
            con.execute("INSERT INTO worker_executions(execution_id,session_id,kind,owner_epoch,generation,status,adoption_digest) VALUES ('e','queued','child',1,1,'registered','x')")
        holder = f'pid={os.getpid()}{holder_namespace_token()}:turn=fixture:platform=desktop'
        assert db.try_acquire_session_turn_lease('recent', holder)
        activity = load().collect_snapshot(tmp_path)['profiles'][0]['activity']
        metadata = activity['child_metadata']
        assert {r['id']: r['kind'] for r in metadata['children']} == {'queued':'queued','recent':'recent','stale':'stale','ended':'ended','failed':'failed'}
        assert activity['observed_child_count'] == 1
        assert metadata['presentation_count'] == 2
        with sqlite3.connect(tmp_path / 'state.db') as con:
            con.execute('DROP TABLE worker_executions')
        metadata = load().collect_snapshot(tmp_path)['profiles'][0]['activity']['child_metadata']
        assert metadata['availability'] == 'available'
        assert next(r['kind'] for r in metadata['children'] if r['id'] == 'queued') == 'recent'
    finally:
        db.close()


def test_cross_profile_and_ambiguous_parent(tmp_path):
    homes = [tmp_path, tmp_path/'profiles'/'alpha', tmp_path/'profiles'/'beta']
    for home in homes: home.mkdir(parents=True, exist_ok=True)
    root, alpha, beta = [SessionDB(db_path=home/'state.db') for home in homes]
    try:
        alpha.create_session('parent', 'desktop')
        beta.create_session('child', 'subagent')
        with sqlite3.connect(homes[2]/'state.db') as con:
            con.execute("UPDATE sessions SET parent_session_id='parent' WHERE id='child'")
        get = lambda: {p['profile']:p['activity']['child_metadata'] for p in load().collect_snapshot(tmp_path)['profiles']}
        assert get()['alpha']['presentation_count'] == 1
        root.create_session('parent', 'desktop')
        result = get()
        assert result['alpha']['availability'] == 'unknown'
        assert result['beta']['availability'] == 'unknown'
    finally:
        for db in (root, alpha, beta): db.close()


def test_missing_db_schema_nested_and_unavailable_lease(tmp_path):
    db = SessionDB(db_path=tmp_path/'state.db')
    try:
        db.create_session('parent', 'desktop')
        db.create_session('child', 'subagent', parent_session_id='parent')
        with sqlite3.connect(tmp_path/'state.db') as con:
            con.execute('DROP TABLE session_turn_leases')
        activity = load().collect_snapshot(tmp_path)['profiles'][0]['activity']
        assert activity['coverage'] == 'unavailable'
        assert activity['child_metadata']['availability'] == 'available'
        assert activity['child_metadata']['presentation_count'] == 1
        db.create_session('nested', 'subagent', parent_session_id='child')
        assert load().collect_snapshot(tmp_path)['profiles'][0]['activity']['child_metadata']['availability'] == 'unknown'
    finally:
        db.close()
    missing = tmp_path/'profiles'/'missing'; missing.mkdir(parents=True)
    profiles = {p['profile']:p['activity']['child_metadata'] for p in load().collect_snapshot(tmp_path)['profiles']}
    assert profiles['missing']['availability'] == 'unknown'


def test_bounded_rows_and_expired_terminal(tmp_path):
    db = SessionDB(db_path=tmp_path/'state.db')
    try:
        db.create_session('parent', 'desktop')
        for i in range(51):
            db.create_session(f'child-{i}', 'subagent', parent_session_id='parent')
        meta = load().collect_snapshot(tmp_path)['profiles'][0]['activity']['child_metadata']
        assert meta['truncated'] is True
        assert len(meta['children']) == meta['presentation_count'] == 50
        db.end_session('child-50', 'agent_close')
        with sqlite3.connect(tmp_path/'state.db') as con:
            con.execute("UPDATE sessions SET ended_at=? WHERE id='child-50'", (time.time()-31,))
        meta = load().collect_snapshot(tmp_path)['profiles'][0]['activity']['child_metadata']
        assert all(r['id'] != 'child-50' for r in meta['children'])
    finally:
        db.close()
