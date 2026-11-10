"""The public /status endpoint must read the current DB without creating files."""
import importlib.util
import sqlite3
import time
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]


def create_database(path, *, active=True, tokens=10):
    with sqlite3.connect(path) as db:
        db.execute('CREATE TABLE sessions (last_activity_at REAL, ended_at REAL, input_tokens INT, output_tokens INT, actual_cost_usd REAL, estimated_cost_usd REAL)')
        db.execute('INSERT INTO sessions VALUES (?, NULL, ?, 0, 0, 0)',
                   (time.time() if active else time.time()-1000, tokens))


@pytest.fixture
def status_client(monkeypatch):
    spec = importlib.util.spec_from_file_location('status_database_api', ROOT/'dashboard/plugin_api.py')
    assert spec is not None and spec.loader is not None
    api = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(api)
    collector = api._status_collector()
    # Only synthetic homes and liveness; no real account or process inspection.
    monkeypatch.setattr(collector, 'read_profile_meta', lambda _: {})
    monkeypatch.setattr(collector, 'resolve_gateway_liveness', lambda **_: SimpleNamespace(running=True, source='multiplexer'))
    import gateway.status as native
    monkeypatch.setattr(native, 'multiplexer_liveness_for_profile', lambda _: None)
    app = FastAPI()
    app.include_router(api.router)
    with TestClient(app) as client:
        def at(home):
            monkeypatch.setattr(api, 'get_default_hermes_root', lambda: home)
            monkeypatch.setattr(api, 'get_hermes_home', lambda: home)
            monkeypatch.setattr(collector, 'HERMES_HOME', str(home))
            return client
        yield at
    collector._close_all_ro_conns()


def row(client, profile='default'):
    response = client.get('/status')
    assert response.status_code == 200
    return next(item for item in response.json() if item['profile'] == profile)


@pytest.mark.parametrize('name', ['custom?home', 'custom#home', 'custom%3Fhome', '空 間?#%home'])
def test_status_reads_literal_path_without_creating_files(tmp_path, status_client, name):
    home = tmp_path/name
    home.mkdir()
    create_database(home/'state.db')
    before = {str(p.relative_to(tmp_path)): p.read_bytes() for p in tmp_path.rglob('*') if p.is_file()}
    result = row(status_client(home))
    after = {str(p.relative_to(tmp_path)): p.read_bytes() for p in tmp_path.rglob('*') if p.is_file()}
    assert after == before, 'read-only status must not create or change files'
    assert result['stats_available'] is True
    assert result['tokens_total'] == 10
    assert result['active_sessions'] == 1


@pytest.mark.parametrize('replacement', ['rename', 'remove', 'corrupt'])
def test_status_tracks_replaced_and_missing_database(tmp_path, status_client, replacement):
    database = tmp_path/'state.db'
    create_database(database, active=False, tokens=10)
    healthy = tmp_path/'profiles/healthy'
    healthy.mkdir(parents=True)
    (healthy/'profile.yaml').write_text('{}')
    create_database(healthy/'state.db', tokens=77)
    client = status_client(tmp_path)
    assert row(client)['tokens_total'] == 10
    assert row(client)['active_sessions'] == 0
    if replacement == 'rename':
        database.rename(tmp_path/'retired.db')
    else:
        database.unlink()
    if replacement == 'corrupt':
        database.write_bytes(b'not a database')
    missing = row(client)
    assert missing['stats_available'] is False
    assert missing['tokens_total'] == 0
    assert row(client, 'healthy')['tokens_total'] == 77
    if database.exists():
        database.unlink()
    create_database(database, active=True, tokens=42)
    fresh = row(client)
    assert fresh['stats_available'] is True
    assert fresh['active_sessions'] == 1
    assert fresh['tokens_total'] == 42
    assert fresh['state'] == 'working'
    assert row(client, 'healthy')['tokens_total'] == 77


def test_status_reads_atomic_database_replacement_on_next_poll(tmp_path, status_client):
    database = tmp_path/'state.db'
    create_database(database, active=False)
    client = status_client(tmp_path)
    assert row(client)['active_sessions'] == 0
    create_database(tmp_path/'replacement.db', active=True, tokens=42)
    (tmp_path/'replacement.db').replace(database)
    fresh = row(client)
    assert fresh['stats_available'] is True
    assert fresh['active_sessions'] == 1
    assert fresh['tokens_total'] == 42
    assert fresh['state'] == 'working'
