"""Synthetic contracts: private Hermes helpers must not be needed by Rail."""
import builtins
import importlib.util
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_backend_loads_without_private_helpers(monkeypatch):
    original = builtins.__import__

    def guarded(name, *args, **kwargs):
        if name in {'hermes_state_pidns', 'hermes_cli.profiles'}:
            raise ImportError('private helper unavailable')
        return original(name, *args, **kwargs)

    monkeypatch.setattr(builtins, '__import__', guarded)
    load('rail_private_api_test', 'dashboard/plugin_api.py')
    load('rail_private_status_test', 'dashboard/status.py')


@pytest.mark.parametrize('platform,recorded,link,expected', [
    ('darwin', None, None, True),
    ('darwin', '9', None, True),
    ('linux', '42', 'pid:[42]', True),
    ('linux', '9', 'pid:[42]', False),
    ('linux', None, 'pid:[42]', False),
    ('linux', '42', 'bad', False),
    ('linux', '42', None, False),
])
def test_namespace_checkability(monkeypatch, platform, recorded, link, expected):
    api = load('rail_namespace_test', 'dashboard/plugin_api.py')
    monkeypatch.setattr(api.sys, 'platform', platform)
    def readlink(path):
        assert path == '/proc/self/ns/pid'
        if link is None:
            raise OSError('unavailable')
        return link
    monkeypatch.setattr(api.os, 'readlink', readlink)
    holder = 'pid=42' + (f':pidns={recorded}' if recorded else '') + ':turn=x:platform=desktop'
    assert api.holder_pid_checkable(holder) is expected


def test_profile_metadata_synthetic(monkeypatch, tmp_path):
    status = load('rail_metadata_test', 'dashboard/status.py')
    path = tmp_path / 'profile.yaml'
    def read(text):
        path.write_text(text, encoding='utf-8')
        return status.read_profile_meta(tmp_path)
    assert status.read_profile_meta(tmp_path) == {}
    assert read('display_name: " Display  Name "\nui_meta:\n  hermes-bots:\n    title: " Bot  Title "\n') == {'display_name': 'Display  Name', 'bot_title': 'Bot  Title'}
    assert read('display_name: "  Name  "\nui_meta: []\n') == {'display_name': 'Name', 'bot_title': ''}
    assert read('display_name: [broken\n') == {}
    assert read('- not\n- mapping\n') == {}
    assert read('display_name: one\ndisplay_name: two\n') == {}
    monkeypatch.setattr(status.Path, 'read_text', lambda *a, **kw: (_ for _ in ()).throw(PermissionError()))
    assert status.read_profile_meta(tmp_path) == {}


def test_profile_base_uses_bot_title_then_display_name(monkeypatch, tmp_path):
    from types import SimpleNamespace
    import gateway.status
    status = load('rail_metadata_precedence_test', 'dashboard/status.py')
    monkeypatch.setattr(status, '_state_path', lambda _: str(tmp_path / 'gateway_state.json'))
    monkeypatch.setattr(status, '_read_session_stats', lambda _: {})
    monkeypatch.setattr(status, 'resolve_gateway_liveness', lambda **kw: SimpleNamespace(running=False, source='standalone'))
    monkeypatch.setattr(gateway.status, 'multiplexer_liveness_for_profile', lambda _: None)
    path = tmp_path / 'profile.yaml'
    path.write_text('display_name: Display\nui_meta:\n  hermes-bots:\n    title: Bot\n', encoding='utf-8')
    assert status._read_profile_base('default')['display_name'] == 'Bot'
    path.write_text('display_name: Display\n', encoding='utf-8')
    assert status._read_profile_base('default')['display_name'] == 'Display'
    path.write_text('not: [valid\n', encoding='utf-8')
    assert status._read_profile_base('default')['display_name'] == ''
