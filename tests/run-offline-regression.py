"""Run offline-order and UI regressions in a scratch copy, preserving evidence."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
scratch = Path(tempfile.mkdtemp(prefix='rail-offline-', dir=os.environ['TMPDIR']))
repo = scratch / 'repo'
repo.mkdir()
for name in ('desktop', 'tests', 'dashboard'):
    shutil.copytree(root / name, repo / name, ignore=shutil.ignore_patterns('__pycache__'))
(repo / 'evidence').mkdir()
commands = [
    ['node', '--check', 'desktop/plugin.js'],
    ['node', 'tests/build-sdk.mjs'],
]
commands += [['node', '--experimental-vm-modules', f'tests/{name}.mjs'] for name in (
    'status-own', 'status-http-integration', 'status-late-response', 'live-contract',
    'roster', 'owner-recent', 'loading-regression', 'sdk-route-contract', 'actions',
    'actions-switch', 'office-cache', 'completion', 'owner-project-dialog',
)]
commands += [['node', f'tests/{name}.mjs'] for name in (
    'browser-offline-avatar', 'browser-activity', 'browser-completion',
    'browser-working', 'browser-floating-geometry', 'browser-primary-anchor',
    'browser-stack-centering', 'browser-actions', 'browser-recent',
    'browser-project-layout', 'browser-status-token', 'browser-children-metadata',
    'browser-standalone-screenshot',
)]
results = []
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
before = digest(root / 'desktop/plugin.js')
for command in commands:
    try:
        p = subprocess.run(command, cwd=repo, capture_output=True, text=True, timeout=100)
        row = {'command': ' '.join(command), 'exit_code': p.returncode, 'output': p.stdout + p.stderr}
    except subprocess.TimeoutExpired as exc:
        row = {'command': ' '.join(command), 'exit_code': None, 'output': str(exc)}
    results.append(row)
    print(f"{row['exit_code']} {row['command']}", flush=True)
after = digest(root / 'desktop/plugin.js')
report = {'scope': 'controlled isolated fixtures; not live Desktop acceptance',
          'source_sha256_before': before, 'source_sha256_after': after,
          'fixture_source_sha256': digest(repo / 'desktop/plugin.js'),
          'results': results, 'passed': sum(r['exit_code'] == 0 for r in results),
          'total': len(results), 'scratch': str(scratch)}
path = scratch / 'offline-regression-report.json'
path.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'report': str(path), 'passed': report['passed'], 'total': report['total'], 'sha256': after}))
raise SystemExit(0 if report['passed'] == report['total'] and before == after == report['fixture_source_sha256'] else 1)
