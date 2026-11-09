import hashlib
import json
import os
from pathlib import Path
import shlex
import subprocess

root = Path(__file__).resolve().parents[1]
os.chdir(root)
prior = json.loads(Path('evidence/avatar-stack-result.json').read_text())
commands = [r['command'] for r in prior['results']]
commands += ['node tests/popover-fixture-contract.mjs', 'node tests/browser-primary-anchor.mjs']
results = []
def digest(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()
loader = Path.home()/'.hermes/desktop-plugins/profile-rail/plugin.js'
report = {'scope':'controlled test fixtures; not live Desktop or authenticated endpoint','source_sha256':digest('desktop/plugin.js'),'backend_sha256':digest('dashboard/plugin_api.py'),'loader_path':str(loader),'loader_resolved':str(loader.resolve()),'loader_sha256':digest(loader),'results':results,'limitations':['native renderer, authenticated endpoint and actual routing pending','running Python module must reload to expose observed_child_count; no restart performed','active-turn leases are bounded observations, not complete fleet counts']}
for command in commands:
    try:
        proc=subprocess.run(shlex.split(command),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=60,env=os.environ.copy())
        result={'command':command,'exit_code':proc.returncode,'output':proc.stdout}
    except subprocess.TimeoutExpired as e:
        result={'command':command,'exit_code':None,'timeout_seconds':60,'output':(e.stdout or b'').decode(errors='replace') if isinstance(e.stdout,bytes) else e.stdout or ''}
    results.append(result)
    report['passed']=sum(x['exit_code']==0 for x in results)
    report['total']=len(commands)
    report['completed']=len(results)
    print(f"{len(results)}/{len(commands)} {result['exit_code']} {command}",flush=True)
    Path('evidence/avatar-stack-final-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
for p in ['evidence/avatar-stack-normal.png','evidence/avatar-stack-max.png','evidence/avatar-stack-selected-primary-anchor.png','evidence/activity-controlled-selected.png']:
    if Path(p).exists(): report.setdefault('screenshots',{})[p]=digest(p)
report['geometry']=json.loads(Path('evidence/avatar-stack-geometry.json').read_text())
Path('evidence/avatar-stack-final-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
raise SystemExit(0 if report['passed']==report['total'] else 1)
