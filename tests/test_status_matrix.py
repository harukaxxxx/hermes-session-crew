"""Bounded Office-derived status branches; synthetic metadata only.

Reference: Office 3D dashboard/plugin_api.py and Rail's licensed adaptation.
Legacy goal-prefix inference is intentionally excluded, not equivalent parity.
"""
import importlib.util
import json
import sqlite3
from pathlib import Path
from types import SimpleNamespace
import pytest

ROOT = Path(__file__).resolve().parents[1]

@pytest.fixture
def collector(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location('rail_matrix_status', ROOT / 'dashboard/status.py')
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    monkeypatch.setattr(module, 'HERMES_HOME', str(tmp_path))
    monkeypatch.setattr(module, 'read_profile_meta', lambda _: {})
    yield module
    module._close_all_ro_conns()

@pytest.mark.parametrize('running,source,raw,expected', [
    (False, 'standalone', '{"gateway_state":"stopped"}', (False, 'stopped')),
    (True, 'multiplexer', '{"gateway_state":"stopped"}', (True, 'unknown')),
    (True, 'standalone', '{"gateway_state":"running"}', (True, 'running')),
    (True, 'standalone', 'invalid', (True, 'unknown')),
    (True, 'standalone', None, (True, 'unknown')),
])
def test_liveness_and_gateway_record_matrix(collector, tmp_path, monkeypatch, running, source, raw, expected):
    monkeypatch.setattr(collector, 'resolve_gateway_liveness', lambda **_: SimpleNamespace(running=running, source=source))
    if raw is not None: (tmp_path / 'gateway_state.json').write_text(raw)
    row = collector._read_profile_base('default', {}, 0)
    assert (row['online'], row['state']) == expected


def test_unreadable_state_remains_unknown(collector, tmp_path, monkeypatch):
    (tmp_path / 'gateway_state.json').write_text('{}')
    monkeypatch.setattr(collector, 'resolve_gateway_liveness', lambda **_: SimpleNamespace(running=True, source='standalone'))
    import builtins
    real_open = builtins.open
    def guarded(path, *args, **kwargs):
        if str(path) == str(tmp_path / 'gateway_state.json'): raise PermissionError('fixture denied')
        return real_open(path, *args, **kwargs)
    monkeypatch.setattr(builtins, 'open', guarded)
    row=collector._read_profile_base('default', {}, 0)
    assert row['online'] is True and row['state'] == 'unknown'


def test_structured_owner_attribution_and_default_named_roots(collector, tmp_path, monkeypatch):
    named = tmp_path / 'profiles' / 'alpha'
    named.mkdir(parents=True)
    with sqlite3.connect(tmp_path / 'state.db') as db:
        db.execute('CREATE TABLE async_delegations(state TEXT, task_json TEXT)')
        db.executemany('INSERT INTO async_delegations VALUES (?,?)', [('running', json.dumps({'profile':'alpha','goal':'fixture'})), ('running', json.dumps({'goal':'[beta] fixture'}))])
    assert collector._db_path('default') == str(tmp_path / 'state.db')
    assert collector._db_path('alpha') == str(named / 'state.db')
    assert collector._read_delegation_routes() == {'alpha':1}
    monkeypatch.setattr(collector, 'resolve_gateway_liveness', lambda **_: SimpleNamespace(running=True, source='multiplexer'))
    alpha=collector._read_profile_base('alpha', collector._read_delegation_routes(), 1)
    beta=collector._read_profile_base('beta', collector._read_delegation_routes(), 1)
    assert alpha['state']=='working' and alpha['delegated_sessions']==1
    assert beta['state']=='unknown' and beta['delegated_sessions']==0
