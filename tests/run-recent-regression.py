"""Run controlled recent-list and existing non-browser regressions; no live writes."""
import hashlib, json, os, subprocess, sys
from pathlib import Path
root = Path(__file__).resolve().parents[1]
os.chdir(root)
names = ['recent-live-stored','recent-order-refresh','roster','recent-name-red','owner-recent','loading-regression','sdk-route-contract','status-quote','actions','actions-switch','office-cache','completion','native-snapshot-integration','native-activity-integration','root-transport-contract','snapshot-switch','snapshot-owner','snapshot-gap','snapshot-errors','snapshot-malformed','snapshot-missing-owner','snapshot-integration','catchup-quarantine','status-own','status-http-integration','status-late-response','status-quotes-state','native-children-integration','focused-completion-regression']
commands = [['node','--check','desktop/plugin.js'],['node','tests/live-contract.mjs'],['node','tests/popover-fixture-contract.mjs']] + [['node','--experimental-vm-modules','tests/'+n+'.mjs'] for n in names]
python = Path(os.environ['HERMES_CHECKOUT'])/'.venv/bin/python'
commands += [[str(python),'-m','pytest','tests','-q']]
results=[]
for command in commands:
    try:
        p=subprocess.run(command,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=90,env=os.environ.copy())
        row={'command':command,'exit_code':p.returncode,'output':p.stdout}
    except subprocess.TimeoutExpired as e:
        row={'command':command,'exit_code':None,'output':str(e)}
    results.append(row)
    print(row['exit_code'], ' '.join(command),flush=True)
report={'scope':'controlled fixtures, not authenticated Desktop','source_sha256':hashlib.sha256(Path('desktop/plugin.js').read_bytes()).hexdigest(),'results':results}
Path('evidence/recent-regression-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
sys.exit(0 if all(r['exit_code']==0 for r in results) else 1)
