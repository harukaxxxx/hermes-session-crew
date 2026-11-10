import importlib.util
import sqlite3
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]

def load():
    assert (ROOT / 'dashboard/plugin_api.py').is_file(), 'completion snapshot backend not implemented'
    spec = importlib.util.spec_from_file_location('sessioncrew_api', ROOT / 'dashboard/plugin_api.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def db(home):
    home.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(home / 'state.db')
    conn.executescript('''CREATE TABLE sessions(id TEXT PRIMARY KEY, source TEXT NOT NULL);
      CREATE TABLE session_admissions(seq INTEGER PRIMARY KEY, admission_id TEXT, target_session_id TEXT, status TEXT, outcome TEXT, generation INTEGER);
      INSERT INTO sessions VALUES ('same','desktop'), ('child','subagent');
      INSERT INTO session_admissions VALUES (1,'old','same','terminal','completed',1),
        (2,'pending','same','started',NULL,2), (3,'nope','same','terminal','interrupted',3),
        (4,'child-turn','child','terminal','completed',1);''')
    conn.commit()
    conn.close()

def test_root_snapshot_only_metadata_and_known_session_ownership(tmp_path):
    api = load()
    db(tmp_path)
    db(tmp_path / 'profiles' / 'alpha')
    (tmp_path / 'profiles' / 'broken').mkdir(parents=True)
    (tmp_path / 'profiles' / 'broken' / 'state.db').write_text('bad database')
    result = api.collect_snapshot(tmp_path, limit=20)
    assert {p['profile'] for p in result['profiles']} == {'default','alpha','broken'}
    for p in result['profiles']:
        if p['profile'] == 'broken':
            assert p['status'] == 'unavailable'
            continue
        assert p['status'] == 'ok' and not p['truncated']
        assert [row['admission_id'] for row in p['rows']] == ['old','pending','nope']
        assert p['rows'][1] == {'seq':2,'admission_id':'pending','session_id':'same','status':'started','outcome':None,'generation':2}
        assert p['high_water'] == 3
        assert all(set(row)=={'seq','admission_id','session_id','status','outcome','generation'} for row in p['rows'])

def test_snapshot_caps_and_preserves_unknown_not_fake_empty(tmp_path):
    api=load();db(tmp_path)
    result=api.collect_snapshot(tmp_path,limit=2)['profiles'][0]
    assert result['truncated'] is True and result['high_water']==3
    assert [x['seq'] for x in result['rows']]==[2,3]

def test_snapshot_exposes_preexisting_started_to_completed_transition(tmp_path):
    api=load();db(tmp_path)
    before=api.collect_snapshot(tmp_path,limit=20)['profiles'][0]
    conn=sqlite3.connect(tmp_path/'state.db');conn.execute("UPDATE session_admissions SET status='terminal',outcome='completed' WHERE admission_id='pending'");conn.commit();conn.close()
    after=api.collect_snapshot(tmp_path,limit=20)['profiles'][0]
    b=next(x for x in before['rows'] if x['admission_id']=='pending');a=next(x for x in after['rows'] if x['admission_id']=='pending')
    assert b['seq']==a['seq']==2 and b['status']=='started' and a['status']=='terminal' and a['outcome']=='completed'


def test_http_route_root_and_named_gate(monkeypatch,tmp_path):
    api=load();db(tmp_path);db(tmp_path/'profiles'/'alpha');db(tmp_path/'profiles'/'beta')
    monkeypatch.setattr(api,'get_default_hermes_root',lambda:tmp_path)
    app=FastAPI();app.include_router(api.router,prefix='/api/plugins/sessioncrew');client=TestClient(app)
    for home in (tmp_path, tmp_path/'profiles'/'alpha', tmp_path/'profiles'/'beta'):
        monkeypatch.setattr(api,'get_hermes_home',lambda:home)
        response=client.get('/api/plugins/sessioncrew/completion-snapshot')
        assert response.status_code==200
        assert response.json()['profiles'][0]['rows'][0]['admission_id']=='old'
        assert response.json()['source_root']=='default'


def test_unrecognized_runtime_forbidden(monkeypatch,tmp_path):
    api=load();monkeypatch.setattr(api,'get_default_hermes_root',lambda:tmp_path);monkeypatch.setattr(api,'get_hermes_home',lambda:tmp_path/'arbitrary')
    try:api.snapshot()
    except HTTPException as exc:assert exc.status_code==403
    else:raise AssertionError('unknown runtime must not execute fleet scan')
