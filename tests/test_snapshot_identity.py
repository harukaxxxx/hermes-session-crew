import importlib.util
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def load():
    spec = importlib.util.spec_from_file_location('profile_rail_identity_api', ROOT / 'dashboard/plugin_api.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def test_source_epoch_and_database_identity_are_stable_and_replace_fenced(tmp_path):
    api = load()
    def make():
        conn = sqlite3.connect(tmp_path / 'state.db')
        conn.executescript("CREATE TABLE sessions(id TEXT PRIMARY KEY, source TEXT NOT NULL); CREATE TABLE session_admissions(seq INTEGER PRIMARY KEY, admission_id TEXT, target_session_id TEXT, status TEXT, outcome TEXT, generation INTEGER);")
        conn.close()
    make()
    a = api.collect_snapshot(tmp_path)
    b = api.collect_snapshot(tmp_path)
    assert a['version'] == 2
    assert a['source_id'] == b['source_id'] and a['server_epoch'] == b['server_epoch']
    assert a['source_root'] == 'default'
    assert a['profiles'][0]['database_id'] == b['profiles'][0]['database_id']
    (tmp_path / 'state.db').rename(tmp_path / 'retired.db')
    make()
    c = api.collect_snapshot(tmp_path)
    assert c['profiles'][0]['database_id'] != a['profiles'][0]['database_id']
    assert api.collect_snapshot(tmp_path / 'different')['source_id'] != a['source_id']
    assert load().collect_snapshot(tmp_path)['server_epoch'] != a['server_epoch']
