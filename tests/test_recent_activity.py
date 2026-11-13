import importlib.util
import sqlite3
from pathlib import Path
from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
def load():
    spec=importlib.util.spec_from_file_location('activity_api',ROOT/'dashboard/plugin_api.py')
    assert spec is not None and spec.loader is not None
    api=importlib.util.module_from_spec(spec); spec.loader.exec_module(api); return api

def make_db(path, rows):
    path.mkdir(parents=True,exist_ok=True)
    db=sqlite3.connect(path/'state.db')
    db.execute('CREATE TABLE sessions (id TEXT PRIMARY KEY, source TEXT, parent_session_id TEXT, end_reason TEXT, model_config TEXT, last_activity_at REAL)')
    db.executemany('INSERT INTO sessions VALUES (?,?,?,?,?,?)',rows); db.commit(); db.close()

def test_owner_activity_includes_compression_not_branches(monkeypatch,tmp_path):
    api=load()
    make_db(tmp_path, [('same','desktop',None,None,None,900)])
    make_db(tmp_path/'profiles'/'alpha', [('same','desktop',None,'compression',None,100),('child','desktop','same','compression',None,200),('leaf','desktop','child',None,None,400),('branch','desktop','same',None,'{"_branched_from":"same"}',800),('untimed','desktop',None,None,None,None)])
    monkeypatch.setattr(api,'get_default_hermes_root',lambda:tmp_path)
    monkeypatch.setattr(api,'get_hermes_home',lambda:tmp_path)
    app=FastAPI(); app.include_router(api.router); client=TestClient(app)
    response=client.post('/recent-activity',json={'profile':'alpha','ids':['same','untimed','missing']})
    assert response.status_code==200
    assert response.json()=={'profile':'alpha','activity':{'same':400,'untimed':None,'missing':None}}
    assert client.post('/recent-activity',json={'profile':'../outside','ids':['same']}).status_code==422
    default=client.post('/recent-activity',json={'profile':'default','ids':['same']})
    assert default.json()['activity']['same']==900
    assert client.post('/recent-activity',json={'profile':'other','ids':['same']}).status_code==404
    assert client.post('/recent-activity',json={'profile':'alpha','ids':['x']*401}).status_code==422
    monkeypatch.setattr(api,'get_hermes_home',lambda:tmp_path/'outside')
    assert client.post('/recent-activity',json={'profile':'alpha','ids':['same']}).status_code==403

def test_unknown_and_cyclic_compression_are_unknown(monkeypatch,tmp_path):
    api=load()
    make_db(tmp_path,[('orphan','desktop','absent',None,None,100),('a','desktop','b','compression',None,200),('b','desktop','a','compression',None,300)])
    monkeypatch.setattr(api,'get_default_hermes_root',lambda:tmp_path)
    monkeypatch.setattr(api,'get_hermes_home',lambda:tmp_path)
    app=FastAPI();app.include_router(api.router)
    response=TestClient(app).post('/recent-activity',json={'profile':'default','ids':['orphan','a','b']})
    assert response.status_code==200
    assert response.json()['activity']=={'orphan':None,'a':None,'b':None}

def test_database_symlink_must_remain_in_selected_home(monkeypatch,tmp_path):
    api=load(); alpha=tmp_path/'profiles'/'alpha'; beta=tmp_path/'profiles'/'beta'
    make_db(alpha,[('same','desktop',None,None,None,100)])
    make_db(beta,[('same','desktop',None,None,None,900)])
    monkeypatch.setattr(api,'get_default_hermes_root',lambda:tmp_path)
    monkeypatch.setattr(api,'get_hermes_home',lambda:tmp_path)
    app=FastAPI(); app.include_router(api.router); client=TestClient(app)
    (alpha/'state.db').unlink(); (alpha/'state.db').symlink_to(beta/'state.db')
    assert client.post('/recent-activity',json={'profile':'alpha','ids':['same']}).status_code==503
    (alpha/'state.db').unlink(); (alpha/'data').mkdir(); (alpha/'state.db').symlink_to('data/actual.db')
    (alpha/'data'/'actual.db').write_bytes((beta/'state.db').read_bytes())
    assert client.post('/recent-activity',json={'profile':'alpha','ids':['same']}).status_code==200
