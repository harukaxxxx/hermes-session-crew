"""Multiplexer liveness must not be hidden by native PID priority."""
import importlib.util
import os
import sqlite3
import time
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def status(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location('rail_mux_status', ROOT / 'dashboard/status.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    monkeypatch.setattr(mod, 'HERMES_HOME', str(tmp_path))
    monkeypatch.setattr(mod, 'read_profile_meta', lambda _: {})
    (tmp_path / 'profiles' / 'alpha').mkdir(parents=True)
    yield mod
    mod._close_all_ro_conns()


def test_live_shared_lock_pid_does_not_apply_stale_standalone_state(status, tmp_path, monkeypatch):
    import gateway.status as native
    monkeypatch.setattr(status, 'get_running_pid_cached', lambda *a, **k: 4242)
    monkeypatch.setattr(native, 'multiplexer_liveness_for_profile', lambda _: (4242, {'active_agents': 99}))
    monkeypatch.setattr(status, '_read_session_stats', lambda _: {'stats_available': True, 'active_sessions': 0, 'last_session_activity': 123})
    (tmp_path / 'profiles/alpha/gateway_state.json').write_text('{"gateway_state":"stopped","active_agents":55}')
    row = status._read_profile_base('alpha', {}, 0)
    # Session recency and observed leases are not complete turn coverage.
    assert (row['online'], row['state'], row['active_agents']) == (True, 'unknown', 0)
    assert row['idle_since'] == 123


@pytest.mark.parametrize('record', [None, '{"gateway_state":"running","active_agents":8}', 'malformed'])
def test_served_unknown_without_complete_activity(status, tmp_path, monkeypatch, record):
    import gateway.status as native
    monkeypatch.setattr(status, 'get_running_pid_cached', lambda *a, **k: 1234)
    monkeypatch.setattr(native, 'multiplexer_liveness_for_profile', lambda _: (1234, {}))
    monkeypatch.setattr(status, '_read_session_stats', lambda _: {'stats_available': False, 'active_sessions': 0})
    if record is not None:
        (tmp_path / 'profiles/alpha/gateway_state.json').write_text(record)
    row = status._read_profile('alpha', {}, 0)
    assert (row['online'], row['state'], row['busy'], row['active_agents']) == (True, 'unknown', None, 0)


def test_different_generic_pid_does_not_project_stale_record(status, tmp_path, monkeypatch):
    import gateway.status as native
    monkeypatch.setattr(status, 'get_running_pid_cached', lambda *a, **k: 4321)
    monkeypatch.setattr(native, 'multiplexer_liveness_for_profile', lambda _: (1234, {}))
    (tmp_path / 'profiles/alpha/gateway_state.json').write_text('{"gateway_state":"running","active_agents":22}')
    row = status._read_profile_base('alpha', {}, 0)
    assert (row['online'], row['state'], row['active_agents']) == (True, 'unknown', 0)


@pytest.mark.parametrize('result', [(True, {}), (123, []), ('123', {}), (0, {}), 'bad'])
def test_malformed_ownership_does_not_project_stale_status(status, tmp_path, monkeypatch, result):
    import gateway.status as native
    monkeypatch.setattr(status, 'get_running_pid_cached', lambda *a, **k: 123)
    monkeypatch.setattr(native, 'multiplexer_liveness_for_profile', lambda _: result)
    (tmp_path / 'profiles/alpha/gateway_state.json').write_text('{"gateway_state":"running"}')
    row = status._read_profile_base('alpha', {}, 0)
    assert (row['online'], row['state'], row['busy']) == (True, 'unknown', None)


def test_unavailable_ownership_is_unknown_even_without_pid(status, monkeypatch):
    import gateway.status as native
    monkeypatch.setattr(status, 'resolve_gateway_liveness', lambda **_: SimpleNamespace(running=False, source='none'))
    def unavailable(_):
        raise OSError('unavailable')
    monkeypatch.setattr(native, 'multiplexer_liveness_for_profile', unavailable)
    row = status._read_profile_base('alpha', {}, 0)
    assert (row['online'], row['state'], row['busy']) == (True, 'unknown', None)


def test_served_busy_and_waiting_precedence_are_owner_scoped(status, tmp_path, monkeypatch):
    import gateway.status as native
    import psutil
    from types import SimpleNamespace
    monkeypatch.setattr(psutil, 'Process', lambda pid: SimpleNamespace(status=lambda: psutil.STATUS_RUNNING))
    monkeypatch.setattr(psutil, 'pid_exists', lambda pid: True)
    monkeypatch.setattr(status, 'get_running_pid_cached', lambda *a, **k: 123)
    monkeypatch.setattr(native, 'multiplexer_liveness_for_profile', lambda _: (123, {}))
    monkeypatch.setattr(native, 'get_process_start_time', lambda _: 'fingerprint')
    monkeypatch.setattr(native, 'start_time_fingerprints_match', lambda a, b: a == b)
    home = tmp_path / 'profiles/alpha'
    with sqlite3.connect(home / 'state.db') as db:
        db.executescript('''CREATE TABLE sessions(id TEXT, source TEXT, last_activity_at REAL, ended_at REAL, input_tokens INT, output_tokens INT, actual_cost_usd REAL, estimated_cost_usd REAL);
        CREATE TABLE async_delegations(state TEXT, delivery_state TEXT, updated_at REAL, owner_pid INT, owner_started_at TEXT, parent_session_id TEXT);
        CREATE TABLE session_turn_leases(conversation_id TEXT, expires_at REAL);''')
        db.execute('INSERT INTO sessions VALUES(?,?,?,?,?,?,?,?)', ('a', 'desktop', time.time(), None, 0, 0, 0, 0))
        db.execute('INSERT INTO async_delegations VALUES(?,?,?,?,?,?)', ('running', 'pending', time.time(), os.getpid(), 'fingerprint', 'a'))
    row = status._read_profile('alpha', {}, 0)
    assert (row['state'], row['waiting'], row['busy']) == ('waiting', True, False)
    with sqlite3.connect(home / 'state.db') as db:
        db.execute('INSERT INTO session_turn_leases VALUES(?,?)', ('a', time.time() + 60))
    row = status._read_profile('alpha', {}, 0)
    assert (row['state'], row['waiting'], row['busy']) == ('working', True, True)
    other = status._read_profile('beta', {}, 0)
    assert (other['state'], other['waiting']) == ('unknown', False)


def test_unserved_standalone_and_stopped_host(status, tmp_path, monkeypatch):
    import gateway.status as native
    monkeypatch.setattr(native, 'multiplexer_liveness_for_profile', lambda _: None)
    state = tmp_path / 'profiles/alpha/gateway_state.json'
    state.write_text('{"gateway_state":"running","active_agents":2}')
    monkeypatch.setattr(status, 'resolve_gateway_liveness', lambda **_: SimpleNamespace(running=True, source='pid'))
    row = status._read_profile_base('alpha', {}, 0)
    assert (row['online'], row['state'], row['active_agents']) == (True, 'running', 2)
    state.write_text('{"gateway_state":"stopped"}')
    monkeypatch.setattr(status, 'resolve_gateway_liveness', lambda **_: SimpleNamespace(running=False, source='none'))
    row = status._read_profile_base('alpha', {}, 0)
    assert (row['online'], row['state']) == (False, 'stopped')
