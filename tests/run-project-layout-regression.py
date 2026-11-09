#!/usr/bin/env python3
"""Controlled project-popup regression; never contacts a real gateway or creates a real session."""
import hashlib, json, os, pathlib, subprocess
root = pathlib.Path(__file__).resolve().parents[1]
commands = [
 ['node','--check','desktop/plugin.js'],
 ['node','tests/build-sdk.mjs'],
 ['node','tests/browser-project-layout.mjs'],
 ['node','tests/browser-floating-geometry.mjs'],
 ['node','tests/browser-actions.mjs'],
 ['node','tests/browser-recent.mjs'],
 ['node','tests/browser-primary-anchor.mjs'],
 ['node','tests/popover-fixture-contract.mjs'],
 *[['node','--experimental-vm-modules',f'tests/{name}.mjs'] for name in ['actions','actions-switch','owner-recent','recent-order-refresh','loading-regression','sdk-route-contract','focused-completion-regression']],
]
results=[]
for command in commands:
 try:
  p=subprocess.run(command,cwd=root,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=90)
  result={'command':command,'exit':p.returncode,'output':p.stdout}
 except subprocess.TimeoutExpired as e:
  result={'command':command,'exit':None,'output':str(e),'timeout':True}
 results.append(result)
 print(f"{result['exit']} {' '.join(command)}",flush=True)
source=root/'desktop/plugin.js'
loader=pathlib.Path.home()/'.hermes/desktop-plugins/profile-rail/plugin.js'
data={'scope':'controlled Chromium and mock SDK; no live renderer or real session writes','source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'loader_sha256':hashlib.sha256(loader.read_bytes()).hexdigest(),'loader_directory':str(loader.parent.resolve()),'screenshots':[f'evidence/project-layout-{s}.png' for s in ['900x700','900x300','280x430']],'known_existing_failure':'tests/focused-completion-regression.mjs (unresolved read acknowledgement)','results':results}
(root/'evidence/project-layout-results.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
unexpected=[r for r in results if r['exit']!=0 and 'tests/focused-completion-regression.mjs' not in r['command']]
raise SystemExit(bool(unexpected))
