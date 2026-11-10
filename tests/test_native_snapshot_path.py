import importlib.util
from pathlib import Path
from fastapi import FastAPI
from fastapi.testclient import TestClient
import sys
state_spec = importlib.util.find_spec('hermes_state')
assert state_spec and state_spec.origin
sys.path.insert(0, str(Path(state_spec.origin).parent))
from hermes_state import SessionDB
import hermes_state_runtime as runtime

ROOT = Path(__file__).resolve().parents[1]

def test_native_writer_to_root_http_snapshot(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location('sessioncrew_native_api', ROOT / 'dashboard/plugin_api.py')
    assert spec and spec.loader
    api = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(api)
    monkeypatch.setattr(api, 'get_default_hermes_root', lambda: tmp_path)
    monkeypatch.setattr(api, 'get_hermes_home', lambda: tmp_path)
    db = SessionDB(db_path=tmp_path / 'state.db')
    try:
        db.create_session('parent', source='desktop')
        db.create_session('child', source='subagent')
        epoch = runtime.begin_runtime_epoch(db, instance_id='fixture')
        admission = runtime.admit_session_input(db, epoch=epoch, principal_id='human', session_id='parent', request_id='r1', payload={'text':'private fixture'})
        claim = runtime.claim_session_input(db, epoch=epoch, session_id='parent')
        app = FastAPI()
        app.include_router(api.router, prefix='/api/plugins/sessioncrew')
        client = TestClient(app)
        url = '/api/plugins/sessioncrew/completion-snapshot'
        before = client.get(url)
        assert before.status_code == 200
        p = before.json()['profiles'][0]
        assert p['rows'][0]['admission_id'] == admission['admission_id']
        assert p['rows'][0]['status'] == 'started'
        runtime.settle_session_input(db, epoch=epoch, admission_id=admission['admission_id'], generation=claim['generation'], outcome='completed')
        after = client.get(url)
        assert after.status_code == 200
        row = after.json()['profiles'][0]['rows'][0]
        assert row['seq'] == p['rows'][0]['seq']
        assert row['status'] == 'terminal' and row['outcome'] == 'completed'
        assert 'private fixture' not in after.text
        assert after.json()['version'] == 2
    finally:
        db.close()
