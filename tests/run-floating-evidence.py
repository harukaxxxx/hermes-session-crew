import hashlib, json, subprocess
from pathlib import Path
root=Path(__file__).resolve().parent.parent
commands=[['node','--check','desktop/plugin.js'],['node','tests/build-sdk.mjs']]
commands += [['node','--experimental-vm-modules',f'tests/{name}.mjs'] for name in ['live-contract','roster','recent-name-red','owner-recent','loading-regression','sdk-route-contract','status-quote','actions','actions-switch','office-cache']]
commands += [['node',f'tests/{name}.mjs'] for name in ['browser-recent','browser-rail-visual','browser-actions','browser-working','browser-quote-ascii','browser-floating-geometry','browser-working-pixels']]
results=[]
for command in commands:
    try:
        p=subprocess.run(command,cwd=root,text=True,capture_output=True,timeout=60)
        result={'command':' '.join(command),'exit':p.returncode,'stdout':p.stdout.strip(),'stderr':p.stderr.strip()}
    except subprocess.TimeoutExpired as e:
        result={'command':' '.join(command),'exit':None,'stdout':str(e.stdout or ''),'stderr':'timeout after 60 seconds'}
    results.append(result)
    print(('PASS ' if result['exit']==0 else 'FAIL ')+result['command'],flush=True)
hash_file=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
source=root/'desktop/plugin.js';loader=Path.home()/'.hermes/desktop-plugins/sessioncrew/plugin.js'
names=['floating-normal.png','floating-short.png','floating-scroll-before.png','floating-scroll-after.png','floating-corner-before.png','floating-corner-after.png']
screenshots=[{'path':'evidence/'+n,'sha256':hash_file(root/'evidence'/n)} for n in names if (root/'evidence'/n).exists()]
result={'source_sha256':hash_file(source),'loader_sha256':hash_file(loader),'loader_same':hash_file(source)==hash_file(loader),'baseline_sha256':hash_file(root/'history/floating-before-20261107/plugin.js'),'tests_total':len(results),'tests_passed':sum(r['exit']==0 for r in results),'results':results,'screenshots':screenshots,'coverage':['Synthetic 12-profile fixture; 310px main, 37px avatar, 50px rail; actual Popover arrow alignment and upper/lower-corner dismissal while anchor remains in rail','Wheel in both directions; status reorder; resize; 300, 350, 400 and 430px top-expanded and bottom-selected secondary project hit tests and mock Home/project create/open; Escape, owner switch and outside dismissal','Actual PNG pixel comparisons at x=20,72,115,160,175; two timed faces, fixed background bounds, reduced motion, hit test and offscreen hiding','ASCII preview and full-text reveal; existing routing, action, cache and list regressions'], 'limitations':['Controlled browser fixture uses checkout Popover source and a small reproduction of host arrow CSS; not native Desktop renderer acceptance','The public SDK exports Popover, PopoverContent and PopoverTrigger, not PopoverAnchor; the secondary uses a plugin-owned, non-interactive public trigger as its main-bubble anchor','80px host dock pane versus 50px plugin rail: 30px structural difference from original chat overlay','All possible viewport sizes/themes not exhaustively verified; upper-corner test uses fixture with header removed','No trustworthy session-qualified completion/unread feed or acknowledgement verified; no invented hand badge','Canonical Home classification and cwd, real navigation/create, Office cache freshness and delivered frontend activation are not live verified']}
(root/'evidence/floating-adaptation-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
if not result['loader_same'] or len(screenshots)!=len(names) or any(r['exit']!=0 for r in results):raise SystemExit(1)
print(f"PASS {result['tests_passed']}/{result['tests_total']} checks; {len(screenshots)} screenshots; source/loader {result['source_sha256']}")
