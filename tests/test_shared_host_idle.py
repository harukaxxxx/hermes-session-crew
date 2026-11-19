"""Full endpoint regression for bounded shared-gateway idle observations."""
import importlib.util
import json
import os
import sqlite3
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from hermes_state_pidns import holder_namespace_token

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def fleet(tmp_path, monkeypatch):
    import gateway.status as native
    import psutil
    def process(pid):
        if pid == 701:
            raise psutil.NoSuchProcess(pid)
        if pid == 702:
            raise psutil.AccessDenied(pid)
        return SimpleNamespace(status=lambda: psutil.STATUS_RUNNING, is_running=lambda: True,
                               create_time=lambda: time.time() - 600)
    monkeypatch.setattr(psutil, 'Process', process)
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
              CREATE TABLE session_turn_leases(conversation_id TEXT, holder TEXT, acquired_at REAL, expires_at REAL);
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


def insert_turn(db, sid, pid, now, *, expires=None):
    holder = f'pid={pid}{holder_namespace_token()}:turn=fixture:platform=desktop'
    db.execute('INSERT INTO session_turn_leases VALUES (?,?,?,?)',
               (sid, holder, now - 30, now + 60 if expires is None else expires))


@pytest.mark.parametrize('pid', [701, 702], ids=['dead', 'unverifiable'])
def test_unproven_lease_preserves_verified_waiting(fleet, pid):
    _, _, client, root = fleet
    now = time.time()
    with sqlite3.connect(root / 'profiles/alpha/state.db') as db:
        db.execute('INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?)', ('a', 'desktop', now, None, 0, 0, 0, 0))
        db.execute('INSERT INTO async_delegations VALUES (?,?,?,?,?,?,?)', ('running', 'pending', now, os.getpid(), '123456', 'a', '{}'))
        insert_turn(db, 'a', pid, now)
    row = rows(client)['alpha']
    assert (row['state'], row['busy'], row['idle_since']) == ('waiting', False, None)
    assert (row['waiting'], row['waiting_count'], row['waiting_sources']) == (True, 1, ['delegation'])


def test_unreadable_lease_schema_does_not_confirm_shared_idle(fleet):
    _, _, client, root = fleet
    with sqlite3.connect(root / 'profiles/alpha/state.db') as db:
        db.execute('DROP TABLE session_turn_leases')
    result = rows(client)
    row = result['alpha']
    assert (row['state'], row['busy'], row['idle_since']) == ('unknown', None, None)
    assert 'shared_gateway_observation' not in row
    assert result['beta']['state'] == 'idle'


@pytest.mark.parametrize('pid,expected', [
    (701, ('idle', False, False, 'zero')),
    (702, ('unknown', None, None, None)),
], ids=['dead', 'unverifiable'])
def test_shared_zero_distinguishes_dead_from_unverifiable_holder(fleet, pid, expected):
    _, _, client, root = fleet
    now = time.time()
    with sqlite3.connect(root / 'profiles/alpha/state.db') as db:
        db.execute('INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?)', ('a', 'desktop', now - 600, None, 0, 0, 0, 0))
        insert_turn(db, 'a', pid, now)
    row = rows(client)['alpha']
    assert (row['state'], row['busy'], row['active_turn'], row.get('shared_gateway_observation')) == expected
    if pid == 702:
        assert row['idle_since'] is None


@pytest.mark.parametrize('pid,expired,expected', [
    (700, False, ('unknown', None, None, None)),
    (702, False, ('unknown', None, None, None)),
    (701, False, ('idle', False, False, 'zero')),
    (700, True, ('idle', False, False, 'zero')),
], ids=['live', 'unverifiable', 'dead', 'expired'])
def test_lease_before_session_creation(fleet, pid, expired, expected):
    _, _, client, root = fleet
    now = time.time()
    path = root / 'profiles/alpha/state.db'
    with sqlite3.connect(path) as db:
        insert_turn(db, 'not-yet-created', pid, now, expires=now - 1 if expired else None)
    row = rows(client)['alpha']
    assert (row['state'], row['busy'], row['active_turn'], row.get('shared_gateway_observation')) == expected
    if pid == 700 and not expired:
        assert row['idle_since'] is None
        with sqlite3.connect(path) as db:
            db.execute('INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?)',
                       ('not-yet-created', 'desktop', now - 600, None, 0, 0, 0, 0))
        assert rows(client)['alpha']['active_turn'] is True


@pytest.mark.parametrize('alias', ['symlink', 'hardlink'])
def test_aliased_db_cannot_supply_waiting(fleet, alias):
    _, _, client, root = fleet
    now = time.time()
    alpha = root / 'profiles/alpha/state.db'
    beta = root / 'profiles/beta/state.db'
    with sqlite3.connect(alpha) as db:
        db.execute('INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?)', ('a', 'desktop', now - 600, None, 0, 0, 0, 0))
        db.execute('INSERT INTO async_delegations VALUES (?,?,?,?,?,?,?)', ('running', 'pending', now, os.getpid(), '123456', 'a', '{}'))
    assert rows(client)['alpha']['waiting_sources'] == ['delegation']
    beta.unlink()
    if alias == 'symlink':
        beta.symlink_to(alpha)
    else:
        beta.hardlink_to(alpha)
    row = rows(client)['beta']
    assert (row['waiting'], row['waiting_count'], row['waiting_sources']) == (False, 0, [])
    assert (row['state'], row['busy'], row['active_turn'], row['idle_since']) == ('unknown', None, None, None)


def test_gateway_state_cannot_supply_waiting(fleet, monkeypatch):
    _, _, client, root = fleet
    monkeypatch.setattr('gateway.status.multiplexer_liveness_for_profile', lambda _: None)
    (root / 'profiles/alpha/gateway_state.json').write_text('{"gateway_state":"waiting"}')
    row = rows(client)['alpha']
    assert (row['state'], row['waiting'], row['busy'], row['idle_since']) == ('unknown', False, None, None)


def test_aliased_process_registry_cannot_supply_waiting(fleet):
    _, _, client, root = fleet
    now = time.time()
    for name in ('alpha', 'beta'):
        with sqlite3.connect(root / 'profiles' / name / 'state.db') as db:
            db.execute('INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?)', ('a', 'desktop', now - 600, None, 0, 0, 0, 0))
    registry = root / 'profiles/alpha/processes.json'
    registry.write_text(json.dumps([dict(session_id='process', parent_session_id='a', pid=os.getpid(),
                                         started_at=now - 10, host_start_time='123456',
                                         notify_on_complete=True, pid_scope='host')]))
    (root / 'profiles/beta/processes.json').symlink_to(registry)
    result = rows(client)
    assert result['alpha']['waiting_sources'] == ['process']
    assert (result['beta']['waiting'], result['beta']['waiting_count'], result['beta']['waiting_sources']) == (False, 0, [])


@pytest.mark.parametrize('with_waiting', [False, True], ids=['alone', 'with-waiting'])
@pytest.mark.parametrize('complete_scan', [True, False], ids=['general', 'separate'])
def test_status_keeps_separate_oneshot_proof_with_the_real_collector(fleet, monkeypatch, complete_scan, with_waiting):
    collector, runtime, client, root = fleet
    runtime['active_agents'] = 1
    if not complete_scan:
        monkeypatch.setattr(collector._evidence, 'read_active_turn', lambda _: None)
    now = time.time()
    with sqlite3.connect(root / 'profiles/alpha/state.db') as db:
        db.execute('INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?)', ('a', 'oneshot', now - 600, None, 0, 0, 0, 0))
        insert_turn(db, 'a', 700, now)
        if with_waiting:
            db.execute('INSERT INTO async_delegations VALUES (?,?,?,?,?,?,?)', ('running', 'pending', now, os.getpid(), '123456', 'a', '{}'))
    result = rows(client)
    row = result['alpha']
    assert (row['state'], row['busy'], row['waiting'], row['idle_since']) == (
        ('working', True, True, None) if with_waiting else ('online_unobserved', None, False, None))
    assert row['active_turn'] is True
    assert now <= row['oneshot_activity']['observed_at'] < row['oneshot_activity']['expires_at']
    assert 'oneshot_activity' not in result['beta']


def test_fresh_zero_shared_host_yields_bounded_idle_for_all_served_including_default(fleet):
    _, _, client, _ = fleet
    result = rows(client)
    assert set(result) == {'default', 'alpha', 'beta'}
    assert {p: (r['online'], r['state'], r['busy'], r['active_agents']) for p, r in result.items()} == {
        p: (True, 'idle', False, 0) for p in result}
    assert all(r['status_observation'] == 'fresh_shared_gateway_zero_observed_work' for r in result.values())


@pytest.mark.parametrize('change', [
    {'active_agents': None}, {'active_agents': False},
    {'pid': 1111}, {'start_time': 1}, {'gateway_state': 'starting'},
    {'updated_at': (datetime.now(timezone.utc)-timedelta(minutes=5)).isoformat()},
    {'updated_at': (datetime.now(timezone.utc)+timedelta(minutes=5)).isoformat()},
    {'served_profiles': ['default', 'alpha']},
])
@pytest.mark.parametrize('host_count', [0, 1])
def test_unavailable_or_ambiguous_host_never_invents_owner_idle(fleet, change, host_count):
    _, runtime, client, _ = fleet
    runtime['active_agents'] = host_count
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


def test_busy_shared_host_reports_unobserved_owner_without_claiming_idle(fleet):
    import time
    _, runtime, client, root = fleet
    runtime['active_agents'] = 1
    with sqlite3.connect(root / 'profiles/alpha/state.db') as db:
        db.execute('INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?)', ('a', 'desktop', time.time(), None, 0, 0, 0, 0))
    result = rows(client)
    assert result['alpha']['state'] == 'working'
    assert result['beta']['state'] == 'online_unobserved'
    assert result['beta']['busy'] is None
    assert result['beta']['status_observation'] == 'fresh_shared_gateway_no_observed_owner_work'


@pytest.mark.parametrize('host_count', [0, 1])
def test_working_and_waiting_turn_override_idle(fleet, host_count):
    import time
    _, runtime, client, root = fleet
    runtime['active_agents'] = host_count
    with sqlite3.connect(root / 'profiles/alpha/state.db') as db:
        db.execute('INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?)', ('a', 'desktop', time.time(), None, 0, 0, 0, 0))
        db.execute('INSERT INTO async_delegations VALUES (?,?,?,?,?,?,?)', ('running', 'pending', time.time(), os.getpid(), '123456', 'a', '{}'))
        insert_turn(db, 'a', 700, time.time())
    result = rows(client)
    assert (result['alpha']['state'], result['alpha']['busy'], result['alpha']['waiting']) == ('working', True, True)
    assert 'status_observation' not in result['alpha']


@pytest.mark.parametrize('host_count', [0, 1])
def test_missing_stats_or_conflicting_pid_do_not_become_idle(fleet, monkeypatch, host_count):
    collector, runtime, client, root = fleet
    runtime['active_agents'] = host_count
    (root / 'profiles/beta/state.db').unlink()
    assert rows(client)['beta']['state'] == 'unknown'
    monkeypatch.setattr(collector, 'resolve_gateway_liveness', lambda **_: SimpleNamespace(running=True, source='pid', pid=1111, probe_error=False))
    result = rows(client)
    assert all(row['state'] == 'unknown' for row in result.values())
