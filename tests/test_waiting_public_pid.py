"""Waiting evidence remains usable when Hermes private symbols are unavailable."""
import builtins
import importlib.util
import json
import os
import sqlite3
from types import SimpleNamespace
from pathlib import Path

import psutil
import pytest


def test_waiting_survives_unavailable_private_gateway_pid_symbol(tmp_path, monkeypatch):
    import gateway.status as gateway
    spec = importlib.util.spec_from_file_location('rail_waiting_regression', Path(__file__).resolve().parents[1] / 'dashboard/waiting_status.py')
    waiting = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(waiting)
    db_path = tmp_path / 'state.db'
    with sqlite3.connect(db_path) as db:
        db.executescript('CREATE TABLE sessions(id TEXT, source TEXT); CREATE TABLE async_delegations(state TEXT, delivery_state TEXT, updated_at REAL, owner_pid INT, owner_started_at TEXT, parent_session_id TEXT);')
        db.execute('INSERT INTO sessions VALUES (?, ?)', ('parent', 'desktop'))
        db.execute('INSERT INTO async_delegations VALUES (?, ?, ?, ?, ?, ?)', ('running', 'pending', 1000, 123, '123456', 'parent'))
    monkeypatch.setattr(gateway, 'get_process_start_time', lambda pid: 123456)
    monkeypatch.setattr(psutil, 'Process', lambda pid: SimpleNamespace(status=lambda: psutil.STATUS_RUNNING))
    monkeypatch.setattr(psutil, 'pid_exists', lambda pid: pid == 123)
    real_import = builtins.__import__
    def no_private_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name == 'gateway.status' and '_pid_exists' in fromlist:
            raise ImportError('private PID symbol is not a public plugin contract')
        return real_import(name, globals, locals, fromlist, level)
    monkeypatch.setattr(builtins, '__import__', no_private_import)
    assert waiting.read_waiting(db_path, now=1000) == {'waiting': True, 'waiting_count': 1, 'waiting_sources': ['delegation']}


@pytest.mark.parametrize('source', ['delegation', 'process'])
@pytest.mark.parametrize('probe,expected', [
    ('alive', True), ('dead', False), ('zombie', False), ('denied', True),
    ('os_error', True), ('mismatch', False), ('no_start', False),
])
def test_waiting_requires_live_matching_process_evidence(tmp_path, monkeypatch, source, probe, expected):
    import gateway.status as gateway
    spec = importlib.util.spec_from_file_location('rail_waiting_probe', Path(__file__).resolve().parents[1] / 'dashboard/waiting_status.py')
    waiting = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(waiting)
    db_path = tmp_path / 'state.db'
    with sqlite3.connect(db_path) as db:
        db.executescript('CREATE TABLE sessions(id TEXT, source TEXT); CREATE TABLE async_delegations(state TEXT, delivery_state TEXT, updated_at REAL, owner_pid INT, owner_started_at TEXT, parent_session_id TEXT);')
        db.execute('INSERT INTO sessions VALUES (?, ?)', ('parent', 'desktop'))
        if source == 'delegation':
            db.execute('INSERT INTO async_delegations VALUES (?, ?, ?, ?, ?, ?)', ('running', 'pending', 1000, 123, '1000', 'parent'))
    if source == 'process':
        (tmp_path / 'processes.json').write_text(json.dumps([{'session_id': 'worker', 'parent_session_id': 'parent', 'pid': 123, 'started_at': 1000, 'host_start_time': '1000', 'pid_scope': 'host', 'notify_on_complete': True}]))
    monkeypatch.setattr(gateway, 'get_process_start_time', lambda pid: None if probe == 'no_start' else (9000 if probe == 'mismatch' else 1000))
    class Process:
        def status(self):
            if probe == 'denied':
                raise psutil.AccessDenied(123)
            if probe == 'os_error':
                raise OSError('unavailable')
            return psutil.STATUS_ZOMBIE if probe == 'zombie' else psutil.STATUS_RUNNING
        def is_running(self):
            if probe == 'denied':
                raise psutil.AccessDenied(123)
            if probe == 'os_error':
                raise OSError('unavailable')
            return probe != 'dead'
    monkeypatch.setattr(psutil, 'Process', lambda pid: Process())
    monkeypatch.setattr(psutil, 'pid_exists', lambda pid: probe != 'dead')
    result = waiting.read_waiting(db_path, now=1000)
    assert result == {'waiting': expected, 'waiting_count': int(expected), 'waiting_sources': [source] if expected else []}


def test_pid_probe_uses_public_psutil_on_current_platform_without_signals(monkeypatch):
    spec = importlib.util.spec_from_file_location('rail_waiting_platform', Path(__file__).resolve().parents[1] / 'dashboard/waiting_status.py')
    waiting = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(waiting)
    monkeypatch.setattr(psutil, 'Process', lambda pid: SimpleNamespace(status=lambda: psutil.STATUS_RUNNING))
    monkeypatch.setattr(psutil, 'pid_exists', lambda pid: pid == 123)
    monkeypatch.setattr(os, 'kill', lambda *args: pytest.fail('must not signal any process'))
    assert waiting._observably_alive(123) is True


def test_missing_psutil_uses_posix_existence_fallback(monkeypatch):
    spec = importlib.util.spec_from_file_location('rail_waiting_no_psutil', Path(__file__).resolve().parents[1] / 'dashboard/waiting_status.py')
    waiting = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(waiting)
    real_import = builtins.__import__
    def no_psutil(name, globals=None, locals=None, fromlist=(), level=0):
        if name == 'psutil':
            raise ImportError('not installed')
        return real_import(name, globals, locals, fromlist, level)
    monkeypatch.setattr(builtins, '__import__', no_psutil)
    monkeypatch.setattr(os, 'kill', lambda pid, signal: None)
    monkeypatch.setattr(waiting.subprocess, 'run', lambda *a, **kw: SimpleNamespace(returncode=1, stdout=''))
    assert waiting._observably_alive(123) is True


@pytest.mark.parametrize('pid', [0, -1, True, False, '123', None])
def test_invalid_pid_never_probes(monkeypatch, pid):
    spec = importlib.util.spec_from_file_location('rail_waiting_invalid', Path(__file__).resolve().parents[1] / 'dashboard/waiting_status.py')
    waiting = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(waiting)
    monkeypatch.setattr(psutil, 'Process', lambda pid: pytest.fail('invalid PID inspected'))
    monkeypatch.setattr(os, 'kill', lambda *a: pytest.fail('invalid PID signaled'))
    assert waiting._observably_alive(pid) is False


def test_windows_missing_psutil_is_unknown_and_never_signals(monkeypatch):
    spec = importlib.util.spec_from_file_location('rail_waiting_windows', Path(__file__).resolve().parents[1] / 'dashboard/waiting_status.py')
    waiting = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(waiting)
    waiting.os = SimpleNamespace(name='nt', kill=lambda *a: pytest.fail('Windows signal'))
    real_import = builtins.__import__
    def no_psutil(name, *args, **kwargs):
        if name == 'psutil':
            raise ImportError('not installed')
        return real_import(name, *args, **kwargs)
    monkeypatch.setattr(builtins, '__import__', no_psutil)
    assert waiting._observably_alive(123) is None


@pytest.mark.parametrize('exists', [True, False])
def test_windows_psutil_uses_existence_without_signal(monkeypatch, exists):
    spec = importlib.util.spec_from_file_location('rail_waiting_windows_psutil', Path(__file__).resolve().parents[1] / 'dashboard/waiting_status.py')
    waiting = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(waiting)
    waiting.os = SimpleNamespace(name='nt', kill=lambda *a: pytest.fail('Windows signal'))
    monkeypatch.setattr(psutil, 'pid_exists', lambda pid: exists)
    assert waiting._observably_alive(123) is exists


@pytest.mark.parametrize('outcome,expected', [('exists', True), ('denied', True), ('missing', False), ('overflow', False), ('zombie', False)])
def test_psutil_missing_posix_fallback_contract(monkeypatch, outcome, expected):
    spec = importlib.util.spec_from_file_location('rail_waiting_fallback', Path(__file__).resolve().parents[1] / 'dashboard/waiting_status.py')
    waiting = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(waiting)
    real_import = builtins.__import__
    def no_psutil(name, *args, **kwargs):
        if name == 'psutil':
            raise ImportError('not installed')
        return real_import(name, *args, **kwargs)
    monkeypatch.setattr(builtins, '__import__', no_psutil)
    monkeypatch.setattr(builtins, 'open', lambda *a, **kw: (_ for _ in ()).throw(FileNotFoundError()))
    monkeypatch.setattr(waiting.subprocess, 'run', lambda *a, **kw: SimpleNamespace(returncode=0, stdout='Z' if outcome == 'zombie' else 'S'))
    def kill(pid, sig):
        assert (pid, sig) == (123, 0)
        if outcome == 'zombie':
            pytest.fail('zombie must not reach kill')
        if outcome == 'denied':
            raise PermissionError()
        if outcome == 'missing':
            raise ProcessLookupError()
        if outcome == 'overflow':
            raise OverflowError()
    monkeypatch.setattr(os, 'kill', kill)
    assert waiting._observably_alive(123) is expected
