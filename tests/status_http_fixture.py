"""Isolated synthetic metadata -> actual collector -> FastAPI TestClient (no listener)."""
import importlib.util, json, os, sqlite3, sys, tempfile, time
from pathlib import Path
from types import SimpleNamespace

# A synthetic fixture must never signal real processes, including probe signal 0.
def forbid_real_kill(*args):
    raise AssertionError('unexpected real os.kill in status fixture')
os.kill = forbid_real_kill
import psutil
psutil.pid_exists = lambda pid: pid == os.getpid()
psutil.Process = lambda pid: SimpleNamespace(status=lambda: psutil.STATUS_RUNNING)
from fastapi import FastAPI
from fastapi.testclient import TestClient
spec = importlib.util.find_spec('hermes_state')
assert spec and spec.origin
sys.path.insert(0, str(Path(spec.origin).parent))
import gateway.status as gateway

with tempfile.TemporaryDirectory(prefix='rail-status-fixture-') as d:
    root = Path(d)
    now = time.time()
    for name in ('default', 'alpha', 'beta', 'gamma'):
        home = root if name == 'default' else root / 'profiles' / name
        home.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(home / 'state.db') as db:
            db.executescript('''CREATE TABLE sessions(id TEXT, source TEXT, last_activity_at REAL, ended_at REAL, input_tokens INT, output_tokens INT, actual_cost_usd REAL, estimated_cost_usd REAL);
                CREATE TABLE async_delegations(state TEXT, delivery_state TEXT, updated_at REAL, owner_pid INT, owner_started_at TEXT, parent_session_id TEXT, task_json TEXT);
                CREATE TABLE session_turn_leases(conversation_id TEXT, expires_at REAL);''')
            if name == 'alpha': db.execute('INSERT INTO sessions VALUES(?,?,?,?,?,?,?,?)', ('a','desktop',now,None,0,0,0,0))
            if name == 'beta':
                db.execute('INSERT INTO sessions VALUES(?,?,?,?,?,?,?,?)', ('b','desktop',now-500,None,0,0,0,0))
                db.execute('INSERT INTO async_delegations VALUES(?,?,?,?,?,?,?)', ('running','pending',now,os.getpid(),'fixture','b','{}'))
            if name == 'gamma': db.execute('INSERT INTO sessions VALUES(?,?,?,?,?,?,?,?)', ('c','desktop',now-600,None,0,0,0,0))
        if name != 'default': (home / 'gateway_state.json').write_text(json.dumps({'gateway_state':'running'}))
    gateway.get_process_start_time = lambda pid: 'fixture'
    gateway.start_time_fingerprints_match = lambda a,b: a == b
    spec=importlib.util.spec_from_file_location('rail_fixture_api',Path(__file__).resolve().parents[1]/'dashboard/plugin_api.py')
    api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
    api.get_default_hermes_root=lambda:root
    api.get_hermes_home=lambda:root
    collector=api._status_collector();collector.HERMES_HOME=str(root);collector.read_profile_meta=lambda _: {}
    collector.resolve_gateway_liveness=lambda profile_dir,**_: SimpleNamespace(running=profile_dir != root,source='standalone')
    app=FastAPI();app.include_router(api.router,prefix='/api/plugins/profile-rail');client=TestClient(app)
    print(json.dumps({'ready':True}),flush=True)
    for line in sys.stdin:
        command=json.loads(line)
        if command=='quit':break
        if command=='status':
            r=client.get('/api/plugins/profile-rail/status');out={'status':r.status_code,'body':r.json()}
        elif command=='foreground':
            with sqlite3.connect(root/'profiles/beta/state.db') as db: db.execute('INSERT INTO session_turn_leases VALUES (?,?)',('b',time.time()+60))
            out={'ok':True}
        else:out={'error':'unknown command'}
        print(json.dumps(out),flush=True)
