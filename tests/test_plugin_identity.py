"""The package and dashboard advertise the same public plugin ID."""
import json
from pathlib import Path

from ruamel.yaml import YAML

ROOT = Path(__file__).resolve().parents[1]


def test_package_and_dashboard_identity():
    manifest = YAML(typ='safe').load((ROOT / 'plugin.yaml').read_text())
    dashboard = json.loads((ROOT / 'dashboard/manifest.json').read_text())
    assert manifest['name'] == 'sessioncrew'
    assert dashboard['name'] == manifest['name']
