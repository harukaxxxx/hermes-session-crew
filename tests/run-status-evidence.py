import hashlib, json, subprocess
from pathlib import Path

root = Path(__file__).resolve().parent.parent
commands = [['node','--check','desktop/plugin.js'], ['node','tests/build-sdk.mjs']]
commands += [['node','--experimental-vm-modules',f'tests/{name}.mjs'] for name in ['live-contract','roster','recent-name-red','owner-recent','loading-regression','sdk-route-contract','status-quote','actions','actions-switch','office-cache']]
commands += [['node',f'tests/{name}.mjs'] for name in ['browser-recent','browser-rail-visual','browser-actions','browser-working','browser-quote-ascii']]
results=[]
for command in commands:
    p=subprocess.run(command,cwd=root,text=True,capture_output=True,timeout=90)
    results.append({'command':' '.join(command),'exit':p.returncode,'stdout':p.stdout.strip(),'stderr':p.stderr.strip()})
    print(('PASS ' if p.returncode==0 else 'FAIL ')+' '.join(command), flush=True)
source=root/'desktop/plugin.js'
loader=Path.home()/'.hermes/desktop-plugins/sessioncrew/plugin.js'
hash_file=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
result={'source_sha256':hash_file(source),'loader_sha256':hash_file(loader),'loader_same':hash_file(source)==hash_file(loader),'results':results,'screenshots':['evidence/status-working.png','evidence/status-quote-long.png'],'limitations':['controlled fixture, not live Office or Desktop','no session-qualified completion/unread source','full archived A visual geometry, corner-safe arrow and full short-screen matrix not verified','gradient alpha sampling and full animation/reduced-motion timing not verified','Home canonical classification and real session actions remain unverified']}
(root/'evidence/status-visual-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
if not result['loader_same'] or any(r['exit'] for r in results):raise SystemExit(1)
