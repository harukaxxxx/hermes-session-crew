import importlib.util
from pathlib import Path
from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]

def load():
    spec = importlib.util.spec_from_file_location('scripted_api_test', ROOT / 'dashboard/plugin_api.py')
    api = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(api)
    return api

def test_scripted_control_requires_opt_in_and_exact_root(monkeypatch):
    api = load()
    monkeypatch.setattr(api, 'get_default_hermes_root', lambda: Path('/tmp/not-demo'))
    monkeypatch.setattr(api, 'get_hermes_home', lambda: Path('/tmp/not-demo'))
    monkeypatch.setenv('SESSIONCREW_SCRIPTED_DEMO', '1')
    app = FastAPI(); app.include_router(api.router)
    client = TestClient(app)
    assert client.post('/scripted/control', json={'stage':'idle'}).status_code == 403


def test_scripted_status_stages_and_return_to_live(monkeypatch, tmp_path):
    api = load()
    monkeypatch.setattr(api, '_SCRIPTED_ROOT', tmp_path)
    monkeypatch.setattr(api, 'get_default_hermes_root', lambda: tmp_path)
    monkeypatch.setattr(api, 'get_hermes_home', lambda: tmp_path)
    monkeypatch.setenv('SESSIONCREW_SCRIPTED_DEMO', '1')
    monkeypatch.setattr(api, '_status_collector', lambda: type('C', (), {'collect_status': lambda self: [{'profile':'live'}]})())
    app = FastAPI(); app.include_router(api.router); client = TestClient(app)
    assert client.get('/status').json() == [{'profile':'live'}]
    assert client.post('/scripted/control', json={'stage':'working'}).status_code == 200
    rows = client.get('/status').json()
    assert len(rows) == 8 and all(r['source'] == 'synthetic' for r in rows)
    assert {r['profile'] for r in rows if r['state'] == 'working'} == {'thor', 'tyr', 'freyja', 'frigg'}
    assert next(r for r in rows if r['profile'] == 'baldr')['online'] is False
    assert client.post('/scripted/control', json={'stage':'bogus'}).status_code == 422
    assert client.post('/scripted/control', json={'stage':'off'}).status_code == 200
    assert client.get('/status').json() == [{'profile':'live'}]


def test_scripted_snapshot_is_bounded_and_does_not_call_live(monkeypatch, tmp_path):
    api = load()
    monkeypatch.setattr(api, '_SCRIPTED_ROOT', tmp_path)
    monkeypatch.setattr(api, 'get_default_hermes_root', lambda: tmp_path)
    monkeypatch.setattr(api, 'get_hermes_home', lambda: tmp_path)
    monkeypatch.setenv('SESSIONCREW_SCRIPTED_DEMO', '1')
    monkeypatch.setattr(api, 'collect_snapshot', lambda root: {'live': True})
    app = FastAPI(); app.include_router(api.router); client = TestClient(app)
    assert client.get('/completion-snapshot').json() == {'live': True}
    client.post('/scripted/control', json={'stage':'overlap'})
    snap = client.get('/completion-snapshot').json()
    assert snap['source'] == 'synthetic' and len(snap['profiles']) == 8
    odin = next(p for p in snap['profiles'] if p['profile'] == 'default')
    assert odin['activity']['child_metadata']['presentation_count'] >= 2
    client.post('/scripted/control', json={'stage':'off'})
    assert client.get('/completion-snapshot').json() == {'live': True}


def test_opt_in_named_profile_and_payload_rejected(monkeypatch, tmp_path):
    api = load()
    monkeypatch.setattr(api, '_SCRIPTED_ROOT', tmp_path)
    monkeypatch.setattr(api, 'get_default_hermes_root', lambda: tmp_path)
    monkeypatch.setattr(api, 'get_hermes_home', lambda: tmp_path)
    app = FastAPI(); app.include_router(api.router); client = TestClient(app)
    monkeypatch.delenv('SESSIONCREW_SCRIPTED_DEMO', raising=False)
    assert client.post('/scripted/control', json={'stage':'idle'}).status_code == 403
    monkeypatch.setenv('SESSIONCREW_SCRIPTED_DEMO', '1')
    monkeypatch.setattr(api, 'get_hermes_home', lambda: tmp_path/'profiles'/'odin')
    assert client.post('/scripted/control', json={'stage':'idle'}).status_code == 403
    monkeypatch.setattr(api, 'get_hermes_home', lambda: tmp_path)
    assert client.post('/scripted/control', json={'stage':'idle','path':'/etc'}).status_code == 422
    assert client.post('/scripted/control', json={'stage':1}).status_code == 422


def test_stage_sequence_replay_and_baldr_offline(monkeypatch, tmp_path):
    api = load()
    monkeypatch.setattr(api, '_SCRIPTED_ROOT', tmp_path)
    monkeypatch.setattr(api, 'get_default_hermes_root', lambda: tmp_path)
    monkeypatch.setattr(api, 'get_hermes_home', lambda: tmp_path)
    monkeypatch.setenv('SESSIONCREW_SCRIPTED_DEMO', '1')
    app = FastAPI(); app.include_router(api.router); client = TestClient(app)
    recorded = []
    for stage in ('idle','reminder','working','overlap','settled','idle','reminder'):
        assert client.post('/scripted/control', json={'stage': stage}).json() == {'source':'synthetic','stage':stage}
        status = client.get('/status').json()
        snapshot = client.get('/completion-snapshot').json()
        assert all(r['source'] == 'synthetic' and r['stage'] == stage for r in status)
        assert snapshot['source'] == 'synthetic' and snapshot['stage'] == stage
        assert next(r for r in status if r['profile'] == 'baldr')['state'] == 'offline'
        recorded.append(status)
    assert recorded[0] == recorded[5] and recorded[1] == recorded[6]


def test_original_stage_states_remain_unchanged(monkeypatch, tmp_path):
    api = load()
    monkeypatch.setattr(api, '_SCRIPTED_ROOT', tmp_path)
    monkeypatch.setattr(api, 'get_default_hermes_root', lambda: tmp_path)
    monkeypatch.setattr(api, 'get_hermes_home', lambda: tmp_path)
    monkeypatch.setenv('SESSIONCREW_SCRIPTED_DEMO', '1')
    app = FastAPI(); app.include_router(api.router); client = TestClient(app)
    for stage in ('idle', 'reminder', 'working', 'overlap', 'settled'):
        assert client.post('/scripted/control', json={'stage': stage}).status_code == 200
        rows = {r['profile']: r for r in client.get('/status').json()}
        for name, row in rows.items():
            expected = ('offline' if name == 'baldr' else
                        'waiting' if name == 'heimdall' and stage == 'reminder' else
                        'working' if name in ('thor', 'tyr', 'freyja', 'frigg') and stage in ('working', 'overlap') else 'idle')
            assert row['state'] == expected
            assert row['online'] is (expected != 'offline')
            assert row['busy'] is (expected == 'working')
            assert row['scripted_unread'] is (name == 'heimdall' and stage == 'reminder')
        snap = client.get('/completion-snapshot').json()
        odin = next(p for p in snap['profiles'] if p['profile'] == 'default')
        assert odin['activity']['child_metadata']['presentation_count'] == (3 if stage == 'overlap' else 0)


def test_awakening_sequence_and_public_schema(monkeypatch, tmp_path):
    api = load()
    monkeypatch.setattr(api, '_SCRIPTED_ROOT', tmp_path)
    monkeypatch.setattr(api, 'get_default_hermes_root', lambda: tmp_path)
    monkeypatch.setattr(api, 'get_hermes_home', lambda: tmp_path)
    monkeypatch.setenv('SESSIONCREW_SCRIPTED_DEMO', '1')
    app = FastAPI(); app.include_router(api.router); client = TestClient(app)
    workers = ('thor', 'tyr', 'freyja', 'frigg')
    stages = [f'awakening-{i}' for i in range(5)] + ['awakening-overlap']
    enum = app.openapi()['components']['schemas']['ScriptedControl']['properties']['stage']['enum']
    assert set(stages) <= set(enum)
    for i, stage in enumerate(stages):
        response = client.post('/scripted/control', json={'stage': stage})
        assert response.status_code == 200
        assert response.json() == {'source': 'synthetic', 'stage': stage}
        rows = client.get('/status').json()
        assert len(rows) == 8 and all(r['source'] == 'synthetic' and r['stage'] == stage for r in rows)
        by_name = {r['profile']: r for r in rows}
        active = min(i, 4)
        for n, name in enumerate(workers):
            row = by_name[name]
            assert row['state'] == ('working' if n < active else 'offline')
            assert row['online'] is (n < active) and row['busy'] is (n < active)
        for name in ('loki', 'baldr'):
            assert by_name[name]['state'] == 'offline' and by_name[name]['online'] is False
        for name in ('default', 'heimdall'):
            assert by_name[name]['state'] == 'idle' and by_name[name]['online'] is True
        snapshot = client.get('/completion-snapshot').json()
        assert snapshot['source'] == 'synthetic' and snapshot['stage'] == stage
        assert snapshot['scripted_unread_profiles'] == []
        odin = next(p for p in snapshot['profiles'] if p['profile'] == 'default')
        assert odin['activity']['child_metadata']['presentation_count'] == (3 if stage == 'awakening-overlap' else 0)


def test_control_through_hermes_loopback_auth_middleware(monkeypatch, tmp_path):
    # Import the real gateway middleware with an isolated HOME; the token below
    # is a fixture value, never a deployed credential.
    monkeypatch.setenv('HOME', str(tmp_path))
    monkeypatch.setenv('HERMES_HOME', str(tmp_path))
    from hermes_cli import web_server
    monkeypatch.setattr(web_server, '_SESSION_TOKEN', 'fixture-token')
    api = load()
    monkeypatch.setattr(api, '_SCRIPTED_ROOT', tmp_path)
    monkeypatch.setattr(api, 'get_default_hermes_root', lambda: tmp_path)
    monkeypatch.setattr(api, 'get_hermes_home', lambda: tmp_path)
    monkeypatch.setenv('SESSIONCREW_SCRIPTED_DEMO', '1')
    app = FastAPI(); app.middleware('http')(web_server.auth_middleware)
    app.include_router(api.router, prefix='/api/plugins/profile-rail')
    client = TestClient(app)
    path = '/api/plugins/profile-rail/scripted/control'
    assert client.post(path, json={'stage':'idle'}).status_code == 401
    assert client.post(path, json={'stage':'idle'}, headers={'Authorization':'Bearer fixture-token'}).status_code == 200
