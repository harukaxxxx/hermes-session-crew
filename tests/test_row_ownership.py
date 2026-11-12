import importlib.util
import sqlite3
import pytest
from pathlib import Path
from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]

def load():
    spec = importlib.util.spec_from_file_location('sessioncrew_row_api', ROOT / 'dashboard/plugin_api.py')
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def db(path, ids):
    path.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path / 'state.db') as con:
        con.execute('CREATE TABLE sessions(id TEXT PRIMARY KEY, source TEXT)')
        con.executemany('INSERT INTO sessions VALUES (?, ?)', [(i, 'desktop') for i in ids])

def test_unique_owner_and_collision_and_incomplete_inventory(tmp_path):
    api = load()
    db(tmp_path, ['same', 'root'])
    db(tmp_path / 'profiles' / 'alpha', ['same', 'only-alpha'])
    assert api.row_owners(tmp_path, ['same', 'root', 'only-alpha', 'missing']) == {'root': 'default', 'only-alpha': 'alpha'}
    (tmp_path / 'profiles' / 'broken').mkdir()
    assert api.row_owners(tmp_path, ['root', 'only-alpha']) == {}

def test_unknown_source_is_not_exported(tmp_path):
    api = load()
    db(tmp_path, ['unknown'])
    with sqlite3.connect(tmp_path / 'state.db') as con:
        con.execute('UPDATE sessions SET source=NULL WHERE id=?', ('unknown',))
    assert api._row_owner_details(tmp_path, ['unknown']) == ({'unknown': 'default'}, {})

def test_http_membership_consent_scope_and_limits(tmp_path, monkeypatch):
    api=load();db(tmp_path, ['root']);db(tmp_path/'profiles'/'alpha', ['x'])
    monkeypatch.setattr(api, 'get_default_hermes_root', lambda: tmp_path)
    monkeypatch.setattr(api, 'get_hermes_home', lambda: tmp_path/'profiles'/'alpha')
    app=FastAPI();app.include_router(api.router);client=TestClient(app)
    response=client.post('/row-owners', json={'ids':['x','root','missing']})
    assert response.status_code==200 and response.json()=={'owners':{'x':'alpha','root':'default'},'sources':{'x':'desktop','root':'desktop'}}
    assert client.post('/row-owners',json={'ids':['x']*201}).status_code==422
    monkeypatch.setattr(api, 'get_hermes_home', lambda: tmp_path/'outside')
    assert client.post('/row-owners',json={'ids':['x']}).status_code==403

def test_regular_finder_metadata_does_not_invalidate_inventory(tmp_path):
    api = load()
    db(tmp_path, ['root'])
    db(tmp_path / 'profiles' / 'alpha', ['alpha-session'])
    metadata = tmp_path / 'profiles' / '.DS_Store'
    metadata.write_bytes(b'Finder metadata')
    assert api._row_owner_details(tmp_path, ['alpha-session']) == ({'alpha-session': 'alpha'}, {'alpha-session': 'desktop'})


@pytest.mark.parametrize('kind', ['invalid', 'outside', 'broken', 'metadata-directory', 'metadata-symlink', 'unknown-file'])
def test_inventory_never_skips_possible_profile(tmp_path, kind):
    api = load()
    root = tmp_path / 'root'
    db(root, ['collision'])
    profiles = root / 'profiles'
    profiles.mkdir()
    if kind == 'invalid':
        db(profiles / 'Invalid', ['collision'])
    elif kind == 'outside':
        outside = tmp_path / 'outside'
        db(outside, ['collision'])
        (profiles / 'outside').symlink_to(outside, target_is_directory=True)
    elif kind == 'broken':
        (profiles / 'broken').symlink_to(tmp_path / 'missing', target_is_directory=True)
    elif kind == 'metadata-directory':
        db(profiles / '.DS_Store', ['collision'])
    elif kind == 'metadata-symlink':
        (profiles / '.DS_Store').symlink_to(root, target_is_directory=True)
    else:
        (profiles / 'unknown').write_bytes(b'unknown')
    assert api.row_owners(root, ['collision']) == {}
