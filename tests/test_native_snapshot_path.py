import importlib.util
from pathlib import Path
from fastapi import FastAPI
from fastapi.testclient import TestClient
from hermes_fixture_store import FixtureStore

ROOT = Path(__file__).resolve().parents[1]

def test_native_writer_to_root_http_snapshot(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location('sessioncrew_native_api', ROOT / 'dashboard/plugin_api.py')
    assert spec and spec.loader
    api = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(api)
    monkeypatch.setattr(api, 'get_default_hermes_root', lambda: tmp_path)
    monkeypatch.setattr(api, 'get_hermes_home', lambda: tmp_path)
    db = FixtureStore(db_path=tmp_path / 'state.db')
    try:
        db.create_session('parent', source='desktop')
        db.create_session('child', source='subagent')
        admission = db.start_admission('parent', 'private fixture')
        app = FastAPI()
        app.include_router(api.router, prefix='/api/plugins/sessioncrew')
        client = TestClient(app)
        url = '/api/plugins/sessioncrew/completion-snapshot'
        before = client.get(url)
        assert before.status_code == 200
        p = before.json()['profiles'][0]
        assert p['rows'][0]['admission_id'] == admission.admission_id
        assert p['rows'][0]['status'] == 'started'
        db.complete_admission(admission)
        after = client.get(url)
        assert after.status_code == 200
        row = after.json()['profiles'][0]['rows'][0]
        assert row['seq'] == p['rows'][0]['seq']
        assert row['status'] == 'terminal' and row['outcome'] == 'completed'
        assert 'private fixture' not in after.text
        assert after.json()['version'] == 2
    finally:
        db.close()
