"""Run fixed historical suite against an isolated copy, preserving old evidence."""
import hashlib, json, os, re, shlex, shutil, subprocess, tempfile
from pathlib import Path
root = Path(__file__).resolve().parents[1]
checkout = Path(os.environ['HERMES_CHECKOUT'])
scratch_root = Path(os.environ['TMPDIR'])
loader = Path(os.environ['RAIL_LOADER_PATH'])
if not checkout.is_absolute() or not scratch_root.is_absolute() or not loader.is_absolute():
    raise ValueError('HERMES_CHECKOUT, TMPDIR and RAIL_LOADER_PATH must be absolute')
manifest = json.loads((root/'evidence/status-order-final-result.json').read_text())
commands = list(dict.fromkeys([row['command'] for row in manifest['results']] + [
    'node --experimental-vm-modules tests/status-own.mjs',
    'node --experimental-vm-modules tests/status-http-integration.mjs',
    'node --experimental-vm-modules tests/status-late-response.mjs',
    'node tests/browser-status-token.mjs',
    'node tests/browser-standalone-screenshot.mjs',
    shlex.join([str(checkout/'.venv/bin/python'), '-m', 'pytest', 'tests/test_standalone_status.py', 'tests/test_status_endpoint.py', 'tests/test_status_matrix.py', '-q']),
]))
# Historical manifests may embed another machine's paths or environment overrides.
# Refuse them before launching anything rather than silently accessing live data.
for command in commands[:-1]:
    if any(token.startswith('/') or token.split('=', 1)[-1].startswith('/') for token in shlex.split(command)):
        raise ValueError('historical command contains an absolute path; regenerate the manifest')
scratch = Path(tempfile.mkdtemp(prefix='sessioncrew-regression-',dir=scratch_root))
shutil.copytree(root,scratch/'repo',ignore=shutil.ignore_patterns('history','archive','__pycache__','.pytest_cache'),dirs_exist_ok=True)
repo=scratch/'repo'
results=[]
for command in commands:
    try:
        p=subprocess.run(shlex.split(command),cwd=repo,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=100,env={**os.environ,'TMPDIR':str(scratch_root)})
        result={'command':command,'exit_code':p.returncode,'output':p.stdout}
    except subprocess.TimeoutExpired as exc:
        result={'command':command,'exit_code':None,'output':str(exc)}
    match = re.search(r'(\d+) passed', result['output']) if 'pytest' in command else None
    if match: result['pytest_passed_cases'] = int(match.group(1))
    results.append(result)
    print(result['exit_code'],command,flush=True)
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()

for name in ('standalone-fixture-rail.png','standalone-fixture-popup.png'):
    if any(r['command']=='node tests/browser-standalone-screenshot.mjs' and r['exit_code']==0 for r in results): shutil.copy2(repo/'evidence'/name,root/'evidence'/name)
report={'scope':'isolated fixture regression; not live Desktop or authenticated routing', 'source_sha256':digest(root/'desktop/plugin.js'),'backend_sha256':digest(root/'dashboard/plugin_api.py'),'collector_sha256':digest(root/'dashboard/status.py'),'waiting_sha256':digest(root/'dashboard/waiting_status.py'),'loader_path':str(loader),'loader_sha256':digest(loader),'results':results,'passed':sum(r['exit_code']==0 for r in results),'total':len(results),'scratch':str(scratch),'screenshots':['evidence/standalone-fixture-rail.png','evidence/standalone-fixture-popup.png'], 'fixture_pipeline':'synthetic SQLite sessions/delegation/lease and gateway state -> own collector -> FastAPI TestClient -> actual pluginRest with fixture bridge -> real React Query', 'limitations':['Goal/task-prefix attribution intentionally disabled; only structured profile fields are used.','Native backend module reload, authenticated route, live renderer and root routing unverified; no restart.','Full Office parity matrix remains incomplete: lease expiry/PID reuse, owner identity collisions, root/server cache concurrency, and actual computed borders along the HTTP pipeline remain unverified.','Screenshots use a controlled fixture, not live Desktop.']}
report['parity_matrix']={'covered':['foreground lease overrides owned waiting in fixture HTTP pipeline','waiting from owned delegation metadata','standalone running and idle mapping','offline stopped','multiplexer ignores stale standalone state','structured profile delegation and unassigned goal prefix','missing, malformed and permission-denied state metadata','default and named profile database paths','client epoch/profile/connection late responses'], 'excluded':['legacy goal/task prefix attribution'], 'pending':['lease PID reuse and expiry safety','owner identity collisions','root/server cache concurrency','computed borders along HTTP integration path']}
report['pytest_passed_cases'] = sum(r.get('pytest_passed_cases', 0) for r in results)
(root/'evidence/standalone-status-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'passed':report['passed'],'total':report['total'],'scratch':str(scratch)}))
raise SystemExit(0 if report['passed']==report['total'] else 1)
