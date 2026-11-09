import importlib.util
from pathlib import Path
from fastapi import FastAPI
from fastapi.testclient import TestClient
ROOT=Path(__file__).resolve().parents[1]

def test_profile_inventory_read_error_is_not_empty_success(tmp_path,monkeypatch):
    spec=importlib.util.spec_from_file_location('profile_rail_inventory_api',ROOT/'dashboard/plugin_api.py')
    assert spec and spec.loader
    api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
    monkeypatch.setattr(api,'get_default_hermes_root',lambda:tmp_path)
    monkeypatch.setattr(api,'get_hermes_home',lambda:tmp_path)
    original=Path.iterdir
    def read(path):
        if path==tmp_path/'profiles':raise PermissionError('fixture denied')
        return original(path)
    monkeypatch.setattr(Path,'iterdir',read)
    app=FastAPI();app.include_router(api.router,prefix='/api/plugins/profile-rail')
    assert TestClient(app).get('/api/plugins/profile-rail/completion-snapshot').status_code==503
