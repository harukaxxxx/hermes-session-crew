"""Exercise Rail's actual FastAPI route with isolated metadata fixtures."""
import importlib.util
import os
import sqlite3
import time
from pathlib import Path
from types import SimpleNamespace
from fastapi import FastAPI
from fastapi.testclient import TestClient
from hermes_state import SessionDB
from hermes_state_pidns import holder_namespace_token

ROOT = Path(__file__).resolve().parents[1]


def test_status_endpoint_runs_collector_without_office(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location('rail_api_fixture', ROOT / 'dashboard' / 'plugin_api.py')
    api = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(api)
    monkeypatch.setattr(api, 'get_default_hermes_root', lambda: tmp_path)
    monkeypatch.setattr(api, 'get_hermes_home', lambda: tmp_path)
    collector = api._status_collector()
    monkeypatch.setattr(collector, 'HERMES_HOME', str(tmp_path))
    monkeypatch.setattr(collector, 'read_profile_meta', lambda _: {})
    monkeypatch.setattr(collector, 'resolve_gateway_liveness', lambda **_: SimpleNamespace(running=True, source='multiplexer'))
    with sqlite3.connect(tmp_path / 'state.db') as db:
        db.execute('create table sessions (last_activity_at real, ended_at real, input_tokens int, output_tokens int, actual_cost_usd real, estimated_cost_usd real)')
    app = FastAPI()
    app.include_router(api.router)
    response = TestClient(app).get('/status')
    assert response.status_code == 200
    assert response.json()[0]['profile'] == 'default'
    assert response.json()[0]['state'] == 'unknown'
    assert response.json()[0]['online'] is True


def test_status_oneshot_requires_open_session_live_pid_and_matching_owner(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location('rail_oneshot_api_fixture', ROOT / 'dashboard' / 'plugin_api.py')
    assert spec is not None and spec.loader is not None
    api = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(api)
    alpha = tmp_path / 'profiles' / 'alpha'; alpha.mkdir(parents=True)
    beta = tmp_path / 'profiles' / 'beta'; beta.mkdir()
    monkeypatch.setattr(api, 'get_default_hermes_root', lambda: tmp_path)
    monkeypatch.setattr(api, 'get_hermes_home', lambda: tmp_path)
    monkeypatch.setattr(api._status_collector(), 'collect_status', lambda: [
        dict(profile=p, state='online_unobserved', online=True, active_turn=True) for p in ('alpha', 'beta')])
    app = FastAPI(); app.include_router(api.router)
    client = TestClient(app)
    def sample():
        r = client.get('/status'); assert r.status_code == 200
        return {x['profile']: x.get('oneshot_activity') for x in r.json()}
    db = SessionDB(db_path=alpha / 'state.db')
    now = time.time()
    def process(pid):
        if pid == 701: raise api.psutil.NoSuchProcess(pid)
        return SimpleNamespace(is_running=lambda: True, status=lambda: api.psutil.STATUS_RUNNING,
                               create_time=lambda: now + 3600 if pid == 702 else now - 30)
    monkeypatch.setattr(api.psutil, 'Process', process)
    try:
        for source in ('oneshot', 'subagent', 'desktop'):
            db.create_session(source, source, parent_session_id='oneshot' if source == 'subagent' else None)
        def acquire(sid, pid):
            holder = f'pid={pid}{holder_namespace_token()}:turn=fixture:platform=cli'
            assert db.try_acquire_session_turn_lease(sid, holder)
            return holder
        acquire('subagent', 700); acquire('desktop', 700)
        assert sample() == {'alpha': None, 'beta': None}
        for pid in (701, 702):
            holder = acquire('oneshot', pid)
            assert sample() == {'alpha': None, 'beta': None}
            db.release_session_turn_lease('oneshot', holder)
        holder = acquire('oneshot', 700)
        proof = sample()['alpha']
        assert now <= proof['observed_at'] < proof['expires_at']
        (beta / 'state.db').symlink_to(alpha / 'state.db')
        assert sample()['beta'] is None
        (beta / 'state.db').unlink()
        os.link(alpha / 'state.db', beta / 'state.db')
        assert sample() == {'alpha': None, 'beta': None}
        (beta / 'state.db').unlink()
        db.end_session('oneshot', 'agent_close')
        assert sample() == {'alpha': None, 'beta': None}
        db.release_session_turn_lease('oneshot', holder)
    finally:
        db.close()
