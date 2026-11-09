"""Exercise Rail's actual FastAPI route with isolated metadata fixtures."""
import importlib.util
import sqlite3
from pathlib import Path
from types import SimpleNamespace
from fastapi import FastAPI
from fastapi.testclient import TestClient

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
