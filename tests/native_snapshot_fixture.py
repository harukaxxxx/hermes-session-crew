"""Subprocess fixture: real Hermes storage writer and FastAPI TestClient, no listener."""
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

# The JS harness uses python -I, which omits the script directory.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from hermes_fixture_store import FixtureStore, holder_namespace_token, use_hermes_checkout
use_hermes_checkout()
from fastapi import FastAPI
from fastapi.testclient import TestClient

with tempfile.TemporaryDirectory(prefix='sessioncrew-test-') as directory:
    root = Path(directory)
    home = root / 'profiles' / 'alpha'
    home.mkdir(parents=True)
    (root / 'profiles' / 'beta').mkdir(parents=True)
    root_db = FixtureStore(db_path=root / 'state.db')
    db = FixtureStore(db_path=home / 'state.db')
    beta_db = FixtureStore(db_path=root / 'profiles' / 'beta' / 'state.db')
    try:
        db.create_session('s-one', source='desktop')
        admission = db.start_admission('s-one', 'fixture')
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
            if command == 'oneshot':
                db.create_session('s-oneshot', source='oneshot')
                db.create_session('oneshot-child', source='subagent', parent_session_id='s-oneshot')
                holder = f'pid={os.getpid()}{holder_namespace_token()}:turn=fixture:platform=cli'
                for sid in ('s-oneshot', 'oneshot-child'):
                    assert db.try_acquire_session_turn_lease(sid, holder)
                # Exercise the real route and lease reader. This is a controlled
                # shared-host classification, not a captured /status payload.
                api._status_collector().collect_status = lambda: [dict(profile='alpha', online=True,
                    state='working', status_observation='recent_session_activity', active_turn=True)]
                response = {'active': True}
            elif command == 'oneshot-status':
                result = client.get('/api/plugins/sessioncrew/status')
                response = {'status': result.status_code, 'body': result.json()}
            elif command == 'oneshot-end-child':
                assert holder is not None
                db.release_session_turn_lease('oneshot-child', holder)
                db.end_session('oneshot-child', 'agent_close')
                response = {'released': True}
            elif command == 'oneshot-release':
                assert holder is not None
                db.release_session_turn_lease('s-oneshot', holder)
                response = {'released': True}
            elif command == 'activity':
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
                db.complete_admission(admission)
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
