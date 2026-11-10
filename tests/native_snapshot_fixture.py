"""Private subprocess fixture: real SQLite writer and FastAPI TestClient, no listener."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import os
import sqlite3
from types import SimpleNamespace

def forbid_real_kill(*args):
    raise AssertionError('unexpected real os.kill in native snapshot fixture')
os.kill = forbid_real_kill
import psutil
psutil.pid_exists = lambda pid: True
psutil.Process = lambda pid: SimpleNamespace(is_running=lambda: True, status=lambda: psutil.STATUS_RUNNING, create_time=lambda: 0.0)

spec = importlib.util.find_spec('hermes_state')
assert spec and spec.origin
sys.path.insert(0, str(Path(spec.origin).parent))
from hermes_state import SessionDB
from hermes_state_pidns import holder_namespace_token
import hermes_state_runtime as rt
from fastapi import FastAPI
from fastapi.testclient import TestClient

with tempfile.TemporaryDirectory(prefix='sessioncrew-test-') as directory:
    root = Path(directory)
    home = root / 'profiles' / 'alpha'
    home.mkdir(parents=True)
    (root / 'profiles' / 'beta').mkdir(parents=True)
    root_db = SessionDB(db_path=root / 'state.db')
    db = SessionDB(db_path=home / 'state.db')
    beta_db = SessionDB(db_path=root / 'profiles' / 'beta' / 'state.db')
    try:
        db.create_session('s-one', source='desktop')
        epoch = rt.begin_runtime_epoch(db, instance_id='fixture')
        admission = rt.admit_session_input(db, epoch=epoch, principal_id='human', session_id='s-one', request_id='r1', payload={'text': 'fixture'})
        claim = rt.claim_session_input(db, epoch=epoch, session_id='s-one')
        source = Path(__file__).resolve().parents[1] / 'dashboard' / 'plugin_api.py'
        spec = importlib.util.spec_from_file_location('sessioncrew_fixture_api', source)
        assert spec and spec.loader
        api = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(api)
        api.get_default_hermes_root = lambda: root
        api.get_hermes_home = lambda: root
        app = FastAPI()
        app.include_router(api.router, prefix='/api/plugins/sessioncrew')
        client = TestClient(app)
        print(json.dumps({'ready': True}), flush=True)
        holder = None
        for line in sys.stdin:
            command = json.loads(line)
            if command == 'quit':
                break
            if command == 'activity':
                db.create_session('s-two', source='desktop')
                db.create_session('child', source='subagent', parent_session_id='s-one')
                db.create_session('child2', source='subagent', parent_session_id='s-one')
                holder = f'pid={os.getpid()}{holder_namespace_token()}:turn=fixture:platform=desktop'
                for sid in ('s-one', 's-two', 'child', 'child2'):
                    assert db.try_acquire_session_turn_lease(sid, holder)
                response = {'active': True}
            elif command == 'metadata-children':
                db.create_session('meta-child', source='subagent', parent_session_id='s-one')
                db.create_session('meta-child2', source='subagent', parent_session_id='s-one')
                with sqlite3.connect(home / 'state.db') as conn:
                    conn.execute("DROP TABLE session_turn_leases")
                    conn.execute("INSERT INTO worker_executions(execution_id,session_id,kind,owner_epoch,generation,status,adoption_digest) VALUES ('meta','meta-child','child',1,1,'registered','x')")
                response = {'created': True}
            elif command == 'end-metadata-children':
                db.end_session('meta-child', 'agent_close')
                db.end_session('meta-child2', 'agent_close')
                response = {'ended': True}
            elif command in ('release-child', 'release-child2'):
                assert holder is not None
                db.release_session_turn_lease('child' if command == 'release-child' else 'child2', holder)
                response = {'released': True}
            elif command in ('end-child', 'end-child2'):
                db.end_session('child' if command == 'end-child' else 'child2', 'agent_close')
                response = {'ended': True}
            elif command == 'settle':
                rt.settle_session_input(db, epoch=epoch, admission_id=admission['admission_id'], generation=claim['generation'], outcome='completed')
                response = {'settled': True}
            elif command == 'snapshot' or isinstance(command, dict) and command.get('snapshot') in ('default', 'alpha', 'beta'):
                selected = command.get('snapshot', 'default') if isinstance(command, dict) else 'default'
                api.get_hermes_home = lambda: root if selected == 'default' else root / 'profiles' / selected
                result = client.get('/api/plugins/sessioncrew/completion-snapshot')
                response = {'status': result.status_code, 'body': result.json()}
            else:
                response = {'error': 'unknown fixture command'}
            print(json.dumps(response), flush=True)
    finally:
        db.close()
        beta_db.close()
        root_db.close()
