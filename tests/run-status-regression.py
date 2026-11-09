"""Run approved controlled regressions without overwriting prior evidence."""
import hashlib
import json
import os
import shlex
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
loader_path = Path(os.environ['RAIL_LOADER_PATH'])
if not loader_path.is_absolute():
    raise ValueError('RAIL_LOADER_PATH must be absolute')
manifest = json.loads((root / 'evidence/avatar-stack-final-result.json').read_text())
commands = list(dict.fromkeys([row['command'] for row in manifest['results']] + ['node tests/browser-status-token.mjs']))
results = []
for command in commands:
    try:
        result = subprocess.run(shlex.split(command), cwd=root, text=True,
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=100)
        row = {'command': command, 'exit_code': result.returncode, 'output': result.stdout}
    except subprocess.TimeoutExpired as error:
        row = {'command': command, 'exit_code': None, 'output': str(error)}
    results.append(row)
    print(row['exit_code'], command, flush=True)

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

source = digest(root / 'desktop/plugin.js')
loader = digest(loader_path)
report = {
    'scope': 'controlled regression; not native Desktop or authenticated endpoint acceptance',
    'source_sha256': source,
    'backend_sha256': digest(root / 'dashboard/plugin_api.py'),
    'loader_sha256': loader,
    'loader_matches': source == loader,
    'results': results,
    'passed': sum(row['exit_code'] == 0 for row in results),
    'total': len(results),
    'limitations': [
        'Native renderer and live Office-cache delivery not verified.',
        'Office cache requires fresh data from its mounted consumer.',
        'No service restart, profile configuration changes or real session operations performed.',
        'Subagent live shadow issue remains deferred.'
    ]
}
path = root / 'evidence/status-order-final-result.json'
path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'passed': report['passed'], 'total': report['total'], 'loader_matches': source == loader, 'report': str(path)}))
raise SystemExit(0 if report['passed'] == report['total'] and source == loader else 1)
