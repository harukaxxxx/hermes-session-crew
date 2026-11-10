"""Bind controlled quote acceptance and the full regression to current bytes."""
import hashlib, json, os, shlex, subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
source=root/'desktop/plugin.js'
loader=Path.home()/'.hermes/desktop-plugins/sessioncrew/plugin.js'
suite=json.loads((root/'evidence/standalone-status-result.json').read_text())
start=digest(source)
assert suite['source_sha256']==start and suite['passed']==suite['total']==36
commands=['node --experimental-vm-modules tests/status-quotes-state.mjs','node --experimental-vm-modules tests/status-quote.mjs','node tests/build-sdk.mjs','node tests/browser-quotes-persistence.mjs','node tests/browser-quote-ascii.mjs']
results=[]
for command in commands:
    p=subprocess.run(shlex.split(command),cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=100,env=os.environ.copy())
    results.append({'command':command,'exit_code':p.returncode,'output':p.stdout})
    print(p.returncode,command,flush=True)
end=digest(source);loader_hash=digest(loader)
report={'scope':'controlled React and Chromium fixture; mock plugin storage; no real session writes or live Desktop acceptance','source_sha256':end,'loader_path':str(loader),'loader_sha256':loader_hash,'source_unchanged':start==end,'loader_matches':end==loader_hash,'full_regression':suite,'new_results':results,'screenshots':['evidence/remaining-quotes-short.png'],'limitations':['Fixture persistence across popup unmount/remount is not an actual browser reload or device sync.','Live authenticated renderer, storage and canonical Home creation are unverified.','Concurrent writes are serialized only within one renderer; cross-client writes are not coordinated.','Old source is preserved in history/remaining-quotes-before-20261108/plugin.js.']}
(root/'evidence/remaining-quotes-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
assert start==end==loader_hash and all(r['exit_code']==0 for r in results)
