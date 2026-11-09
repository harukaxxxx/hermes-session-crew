import importlib.util
from pathlib import Path
from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]

def test_oversized_fleet_fails_visibly_instead_of_returning_partial_snapshot(tmp_path, monkeypatch):
    spec=importlib.util.spec_from_file_location('profile_rail_limit_api', ROOT / 'dashboard/plugin_api.py')
    assert spec and spec.loader
    api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
    monkeypatch.setattr(api,'MAX_PROFILES',1,raising=False)
    monkeypatch.setattr(api,'get_default_hermes_root',lambda:tmp_path)
    monkeypatch.setattr(api,'get_hermes_home',lambda:tmp_path)
    (tmp_path/'profiles'/'alpha').mkdir(parents=True)
    app=FastAPI();app.include_router(api.router,prefix='/api/plugins/profile-rail')
    response=TestClient(app).get('/api/plugins/profile-rail/completion-snapshot')
    assert response.status_code==503
    assert 'limit' in response.json()['detail']
