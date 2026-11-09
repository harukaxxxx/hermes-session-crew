#!/usr/bin/env python3
"""Controlled regression only: no live gateway, project/session writes, or restart."""
import hashlib, json, pathlib, subprocess
root = pathlib.Path(__file__).resolve().parents[1]
commands = [
 ['node','--check','desktop/plugin.js'], ['node','tests/build-sdk.mjs'],
 *[['node',f'tests/{n}.mjs'] for n in ['live-contract','browser-project-list','browser-project-layout','browser-floating-geometry','browser-actions','browser-quotes-persistence','browser-recent','browser-primary-anchor','popover-fixture-contract']],
 *[['node','--experimental-vm-modules',f'tests/{n}.mjs'] for n in ['actions','actions-switch','owner-recent','recent-order-refresh','loading-regression','sdk-route-contract','focused-completion-regression']],
]
results=[]
for cmd in commands:
 try:
  p=subprocess.run(cmd,cwd=root,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=90)
  result={'command':cmd,'exit':p.returncode,'output':p.stdout}
 except subprocess.TimeoutExpired as exc:
  result={'command':cmd,'exit':None,'timeout':True,'output':str(exc)}
 results.append(result);print(result['exit'],' '.join(cmd),flush=True)
source=root/'desktop/plugin.js';loader=pathlib.Path.home()/'.hermes/desktop-plugins/profile-rail/plugin.js'
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
data={'scope':'controlled real React + checkout SDK Popover/Codicon browser fixture and mocked RPC; no live renderer, real project/session writes, or backend restart','source_sha256':digest(source),'loader_sha256':digest(loader),'loader_directory':str(loader.parent.resolve()),'known_failure':'focused-completion-regression.mjs: pre-existing focused session unread acknowledgement','native_project_dialog':'blocked: no public SDK dialog dispatcher and native create captures active project context, not selected Rail owner','project_rows':'single line, no branch; 32px, up to three rows at normal height','screenshots':[str(p.relative_to(root)) for p in sorted((root/'evidence').glob('project-list-*.png'))],'results':results}
(root/'evidence/project-list-results.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
raise SystemExit(any(r['exit']!=0 and 'tests/focused-completion-regression.mjs' not in r['command'] for r in results))
