"""Full endpoint regression for bounded shared-gateway idle observations."""
import importlib.util
import json
import os
import sqlite3
from datetime import datetime, timezone, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def fleet(tmp_path, monkeypatch):
    import gateway.status as native
    import psutil
    monkeypatch.setattr(psutil, 'Process', lambda pid: SimpleNamespace(status=lambda: psutil.STATUS_RUNNING))
    monkeypatch.setattr(psutil, 'pid_exists', lambda pid: True)
    spec = importlib.util.spec_from_file_location('rail_idle_api', ROOT / 'dashboard/plugin_api.py')
    api = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(api)
    collector = api._status_collector()
    monkeypatch.setattr(api, 'get_default_hermes_root', lambda: tmp_path)
    monkeypatch.setattr(api, 'get_hermes_home', lambda: tmp_path)
    monkeypatch.setattr(collector, 'HERMES_HOME', str(tmp_path))
    monkeypatch.setattr(collector, 'read_profile_meta', lambda _: {})
    monkeypatch.setattr(collector, 'resolve_gateway_liveness', lambda **_: SimpleNamespace(running=True, source='pid', pid=4242, probe_error=False))
    monkeypatch.setattr(native, 'get_process_start_time', lambda pid: 123456)
    for home in (tmp_path, tmp_path / 'profiles/alpha', tmp_path / 'profiles/beta'):
        home.mkdir(parents=True, exist_ok=True)
        (home / 'profile.yaml').write_text('{}')
        with sqlite3.connect(home / 'state.db') as db:
            db.executescript('''
              CREATE TABLE sessions(id TEXT, source TEXT, last_activity_at REAL, ended_at REAL, input_tokens INT, output_tokens INT, actual_cost_usd REAL, estimated_cost_usd REAL);
              CREATE TABLE async_delegations(state TEXT, delivery_state TEXT, updated_at REAL, owner_pid INT, owner_started_at TEXT, parent_session_id TEXT, task_json TEXT);
              CREATE TABLE session_turn_leases(conversation_id TEXT, expires_at REAL);
            ''')
        (home / 'gateway_state.json').write_text('{"gateway_state":"stopped","active_agents":99}')
    runtime = {'pid': 4242, 'start_time': 123456, 'gateway_state': 'running', 'active_agents': 0,
               'updated_at': datetime.now(timezone.utc).isoformat(), 'served_profiles': ['default', 'alpha', 'beta']}
    monkeypatch.setattr(native, 'multiplexer_liveness_for_profile', lambda _: (4242, runtime))
    app = FastAPI()
    app.include_router(api.router)
    yield collector, runtime, TestClient(app), tmp_path
    collector._close_all_ro_conns()


def rows(client):
    response = client.get('/status')
    assert response.status_code == 200
    return {r['profile']: r for r in response.json()}


def test_fresh_zero_shared_host_yields_bounded_idle_for_all_served_including_default(fleet):
    _, _, client, _ = fleet
    result = rows(client)
    assert set(result) == {'default', 'alpha', 'beta'}
    assert {p: (r['online'], r['state'], r['busy'], r['active_agents']) for p, r in result.items()} == {
        p: (True, 'idle', False, 0) for p in result}
    assert all(r['status_observation'] == 'fresh_shared_gateway_zero_observed_work' for r in result.values())


@pytest.mark.parametrize('change', [
    {'active_agents': 1}, {'active_agents': None}, {'active_agents': False},
    {'pid': 1111}, {'start_time': 1}, {'gateway_state': 'starting'},
    {'updated_at': (datetime.now(timezone.utc)-timedelta(minutes=5)).isoformat()},
    {'updated_at': (datetime.now(timezone.utc)+timedelta(minutes=5)).isoformat()},
    {'served_profiles': ['default', 'alpha']},
])
def test_unavailable_or_ambiguous_host_never_invents_owner_idle(fleet, change):
    _, runtime, client, _ = fleet
    runtime.update(change)
    result = rows(client)
    targets = ['beta'] if 'served_profiles' in change else result
    assert all(result[p]['state'] == 'unknown' for p in targets)


def test_waiting_and_recent_work_precede_shared_zero(fleet):
    import time
    _, _, client, root = fleet
    with sqlite3.connect(root / 'profiles/alpha/state.db') as db:
        db.execute('INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?)', ('a', 'desktop', time.time(), None, 0, 0, 0, 0))
        db.execute('INSERT INTO async_delegations VALUES (?,?,?,?,?,?,?)', ('running', 'pending', time.time(), os.getpid(), '123456', 'a', '{}'))
    result = rows(client)
    assert result['alpha']['state'] == 'waiting'
    assert result['beta']['state'] == 'idle'


def test_working_and_waiting_turn_override_idle(fleet):
    import time
    _, _, client, root = fleet
    with sqlite3.connect(root / 'profiles/alpha/state.db') as db:
        db.execute('INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?)', ('a', 'desktop', time.time(), None, 0, 0, 0, 0))
        db.execute('INSERT INTO async_delegations VALUES (?,?,?,?,?,?,?)', ('running', 'pending', time.time(), os.getpid(), '123456', 'a', '{}'))
        db.execute('INSERT INTO session_turn_leases VALUES (?,?)', ('a', time.time() + 60))
    result = rows(client)
    assert (result['alpha']['state'], result['alpha']['busy'], result['alpha']['waiting']) == ('working', True, True)
    assert 'status_observation' not in result['alpha']


def test_missing_stats_or_conflicting_pid_do_not_become_idle(fleet, monkeypatch):
    collector, _, client, root = fleet
    (root / 'profiles/beta/state.db').unlink()
    assert rows(client)['beta']['state'] == 'unknown'
    monkeypatch.setattr(collector, 'resolve_gateway_liveness', lambda **_: SimpleNamespace(running=True, source='pid', pid=1111, probe_error=False))
    result = rows(client)
    assert all(row['state'] == 'unknown' for row in result.values())
