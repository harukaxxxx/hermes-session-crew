"""Standalone status endpoint must not require Office or read task text."""
import importlib.util
from pathlib import Path
import sqlite3
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]


def load_status():
    spec = importlib.util.spec_from_file_location('rail_standalone_status', ROOT / 'dashboard' / 'status.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_explicit_delegation_only_and_malformed_json(tmp_path, monkeypatch):
    status = load_status()
    monkeypatch.setattr(status, 'HERMES_HOME', str(tmp_path))
    with sqlite3.connect(tmp_path / 'state.db') as db:
        db.execute('create table async_delegations (state text, task_json text)')
        db.executemany('insert into async_delegations values (?,?)', [
            ('running', '{"profile":"alpha", "goal":"secret"}'),
            ('running', '{"tasks":[{"profile":"beta"},{"goal":"[alpha] secret"}]}'),
            ('running', 'not-json'),
        ])
    assert status._read_delegation_routes() == {'alpha': 1, 'beta': 1}


def test_own_status_route_is_registered():
    spec = importlib.util.spec_from_file_location('rail_api_status_test', ROOT / 'dashboard' / 'plugin_api.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert '/status' in {r.path for r in module.router.routes}


def test_multiplexer_ignores_stale_gateway_record(tmp_path, monkeypatch):
    status = load_status()
    monkeypatch.setattr(status, 'HERMES_HOME', str(tmp_path))
    monkeypatch.setattr(status, 'read_profile_meta', lambda _: {})
    monkeypatch.setattr(status, '_read_session_stats', lambda _: {'active_sessions': 0, 'last_session_activity': 123})
    monkeypatch.setattr(status, 'resolve_gateway_liveness', lambda **_: SimpleNamespace(running=True, source='multiplexer'))
    (tmp_path / 'gateway_state.json').write_text('{"gateway_state":"stopped"}')
    row = status._read_profile_base('default', {}, 0)
    assert row['online'] is True and row['state'] == 'unknown'
    assert row['idle_since'] == 123
