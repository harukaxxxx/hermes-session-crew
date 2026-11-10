import json,subprocess,hashlib,os,datetime,shlex
from pathlib import Path
manifest=json.loads(Path('evidence/multi-profile-routing-result.json').read_text())
commands=[r['command'] for r in manifest['results']]+['node tests/browser-stack-centering.mjs']
results=[]
for command in commands:
 try:
  p=subprocess.run(shlex.split(command),text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=100)
  result={'command':command,'exit_code':p.returncode,'output':p.stdout}
 except subprocess.TimeoutExpired as e: result={'command':command,'exit_code':None,'output':str(e)}
 results.append(result);print(result['exit_code'],command,flush=True)
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
report={'scope':'controlled Chromium and mocked integration, not native client acceptance','source_sha256':sha('desktop/plugin.js'),'backend_sha256':sha('dashboard/plugin_api.py'),'loader_sha256':sha(Path.home()/'.hermes/desktop-plugins/sessioncrew/plugin.js'),'screenshots':{p:sha(p) for p in ['evidence/avatar-stack-normal.png','evidence/avatar-stack-max.png']},'results':results,'passed':sum(x['exit_code']==0 for x in results),'total':len(results),'geometry':json.loads(Path('evidence/avatar-stack-geometry.json').read_text()),'limitations':['child presence boolean gives at most one child layer, no exact child count','Popover trigger remains the full row, not the primary-avatar ref; vertical alignment tested','native renderer and authenticated endpoint unverified','backend unchanged, no restart']}
Path('evidence/avatar-stack-result.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
