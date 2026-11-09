"""Synthetic in-process FastAPI folder service over test-only JSON lines."""
import os
import sys
import json
import tempfile
from pathlib import Path
import importlib.util
_fixture_home = tempfile.TemporaryDirectory(dir=os.environ['RAIL_TEST_SCRATCH'])
os.environ['HOME'] = _fixture_home.name
os.environ['HERMES_HOME'] = str(Path(_fixture_home.name) / '.hermes')
Path(os.environ['HERMES_HOME']).mkdir()
def forbidden(*args, **kwargs):
    raise AssertionError('real process probe forbidden')
os.kill = forbidden
import psutil
psutil.Process = forbidden
psutil.pid_exists = forbidden

from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.environ['HERMES_CHECKOUT'])
spec = importlib.util.spec_from_file_location('rail_api_browser_fixture', Path(__file__).resolve().parents[1] / 'dashboard' / 'plugin_api.py')
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)
with tempfile.TemporaryDirectory(dir=os.environ['RAIL_TEST_SCRATCH']) as tmp:
    root = Path(tmp) / '.hermes'
    root.mkdir()
    (Path(tmp) / 'outside').mkdir()
    (root / 'first').mkdir()
    (root / 'first' / 'child').mkdir()
    (root / 'denied').mkdir()
    for n in range(60): (root / f'item{n:02}').mkdir()
    (root / 'secret.txt').write_text('fixture only')
    os.environ['HERMES_HOME'] = str(root)
    api.get_hermes_home = lambda: root
    app = FastAPI()
    app.include_router(api.router)
    with TestClient(app) as client:
        for line in sys.stdin:
            try:
                req = json.loads(line)
                if req.get('path') == str(root / 'denied'):
                    print(json.dumps({'status': 403, 'data': {'detail': 'synthetic access denied'}}), flush=True)
                    continue
                endpoint = req.pop('_endpoint', '/folders')
                res = client.post(endpoint, json=req)
                print(json.dumps({'status': res.status_code, 'data': res.json()}), flush=True)
            except Exception as exc:
                print(json.dumps({'status': 500, 'data': {'detail': str(exc)}}), flush=True)
