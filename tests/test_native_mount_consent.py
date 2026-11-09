"""Exercise Hermes' real plugin mount gate against disposable local fixture homes."""
from pathlib import Path
from fastapi import FastAPI
from fastapi.testclient import TestClient

PACKAGE = Path(__file__).resolve().parents[1]


def test_native_mount_requires_explicit_enable(monkeypatch, tmp_path):
    from hermes_cli import web_server_dashboard as native
    from hermes_cli import plugin_isolation
    monkeypatch.setattr(plugin_isolation, 'isolation_mode', lambda: 'inprocess')
    # Fixture tests mount authorization, not HTTP authentication middleware.
    async def scope():
        yield
    monkeypatch.setattr(native, '_plugin_route_secret_scope', scope)
    entry = {'name': 'profile-rail', 'source': 'user', '_dir': str(PACKAGE / 'dashboard'), '_api_file': 'plugin_api.py'}
    denied = FastAPI()
    assert not native._mount_one_plugin_api(denied, entry, set(), set())
    assert TestClient(denied).get('/api/plugins/profile-rail/completion-snapshot').status_code == 404
    disabled = FastAPI()
    assert not native._mount_one_plugin_api(disabled, entry, {'profile-rail'}, {'profile-rail'})
    assert TestClient(disabled).get('/api/plugins/profile-rail/completion-snapshot').status_code == 404
    allowed = FastAPI()
    assert native._mount_one_plugin_api(allowed, entry, {'profile-rail'}, set())
    # Exercise the module mounted by native code with fixture root and home.
    import sys
    api = sys.modules['hermes_dashboard_plugin_profile-rail']
    monkeypatch.setattr(api, 'get_default_hermes_root', lambda: tmp_path)
    monkeypatch.setattr(api, 'get_hermes_home', lambda: tmp_path)
    assert TestClient(allowed).get('/api/plugins/profile-rail/completion-snapshot').status_code == 200
