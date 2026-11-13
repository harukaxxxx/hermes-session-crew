// Isolated controlled frontend suite. Does not install, deploy, or contact a gateway.
import {cp,mkdir,mkdtemp,readFile,writeFile,realpath,access} from 'node:fs/promises'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import {createHash} from 'node:crypto'
const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const {HERMES_CHECKOUT,CHROME_PATH,RAIL_TEST_SCRATCH}=process.env
if(![HERMES_CHECKOUT,CHROME_PATH,RAIL_TEST_SCRATCH].every(x=>x&&path.isAbsolute(x)&&!/[\n\r'"\\]/.test(x)))throw Error('Set absolute HERMES_CHECKOUT, CHROME_PATH and RAIL_TEST_SCRATCH paths (without quotes/backslashes)')
const scratch=await realpath(RAIL_TEST_SCRATCH),canonical=await realpath(source)
if(scratch===canonical||scratch.startsWith(canonical+path.sep))throw Error('RAIL_TEST_SCRATCH must be outside the source checkout')
const run=await mkdtemp(path.join(scratch,'sessioncrew-suite-'))
for(const name of ['desktop','dashboard','tests'])await cp(path.join(source,name),path.join(run,name),{recursive:true,filter:p=>!p.includes('__pycache__')&&!['sdk-bundle.js','original-folder-bundle.js','sdk-css'].includes(path.basename(p))})
// Regression: every run starts without a reference bundle, even if the source
// tree contains a stale generated one; build-sdk must create it from source.
try{await access(path.join(run,'tests/original-folder-bundle.js'));throw Error('original picker bundle unexpectedly copied')}catch(error){if(error.code!=='ENOENT')throw error}
await mkdir(path.join(run,'evidence'));await mkdir(path.join(run,'home'));await mkdir(path.join(run,'hermes'))

const mock='recent-live-stored recent-order-refresh roster recent-name-red owner-recent loading-regression sdk-route-contract status-quote actions actions-switch office-cache completion native-snapshot-integration native-activity-integration root-transport-contract snapshot-switch snapshot-owner snapshot-gap snapshot-errors snapshot-malformed snapshot-missing-owner snapshot-integration catchup-quarantine status-own status-http-integration status-late-response status-quotes-state native-children-integration owner-project-dialog project-dialog-create focused-completion-regression'.split(' ')
const browser='browser-project-list browser-stack-centering browser-children-metadata browser-quotes-persistence browser-standalone-screenshot browser-actions browser-working browser-working-pixels browser-status-token browser-completion browser-quote-ascii browser-primary-anchor browser-recent browser-floating-geometry browser-offline-avatar browser-activity browser-project-layout browser-owner-project-dialog browser-rail-visual review-owner-dialog browser-dialog-visual browser-folder-ui browser-folder-integration browser-original-folder folder-comparison'.split(' ')
mock.push('session-hand-regression')
mock.push('cron-unread')
mock.push('mark-all-source-switch')
mock.push('display-settings')
mock.push('localization')
mock.push('request-priority')
browser.push('browser-session-hand')
browser.push('browser-recent-footer')
browser.push('browser-project-stability')
browser.push('browser-project-narrow-probe')
browser.push('browser-floating-text')
browser.push('browser-spinner-profiles')
browser.push('browser-settings')
browser.push('browser-completion-warning')
browser.push('browser-idea-integration')
browser.push('browser-recent-reserve')
browser.push('browser-row-activity')
const commands=[['node','--check','desktop/plugin.js'],[path.join(HERMES_CHECKOUT,'.venv/bin/python'),'-I','-B','tests/folder_backend_fixture.py'],['node','tests/live-contract.mjs'],['node','tests/popover-fixture-contract.mjs'],['node','tests/popover-owned-ref.mjs'],...mock.map(x=>['node','--experimental-vm-modules',`tests/${x}.mjs`]),['node','tests/build-sdk.mjs'],...browser.map(x=>['node',`tests/${x}.mjs`])]
const inherited=Object.fromEntries(['PATH','CHROME_PATH','RAIL_TEST_SCRATCH','HERMES_CHECKOUT'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]))
const env={...inherited,HOME:path.join(run,'home'),HERMES_HOME:path.join(run,'hermes'),HERMES_AGENT_ROOT:HERMES_CHECKOUT,TMPDIR:run,PYTHONDONTWRITEBYTECODE:'1',PYTHONNOUSERSITE:'1'}
const git=(...args)=>{const p=spawnSync('git',['-C',HERMES_CHECKOUT,...args],{env,encoding:'utf8'});if(p.status!==0)throw Error('Cannot attest Hermes source: '+p.stderr);return p.stdout.trim()}
const hostSource={checkout:HERMES_CHECKOUT,revision:git('rev-parse','HEAD'),worktreeStatus:git('status','--porcelain'),scope:'Existing dependencies and native fixtures; NOT a clean official compatibility certification. Run sdk-upstream-baseline.mjs separately.'}
console.log('Hermes source:',JSON.stringify(hostSource))
const sha256=createHash('sha256').update(await readFile(path.join(run,'desktop/plugin.js'))).digest('hex'),backend_sha256=createHash('sha256').update(await readFile(path.join(run,'dashboard/plugin_api.py'))).digest('hex'),results=[]
for(const [bin,...args] of commands){const p=spawnSync(bin,args,{cwd:run,env,encoding:'utf8',timeout:75000,maxBuffer:10*1024*1024});const r={command:[bin,...args],exit_code:p.status,signal:p.signal,error:p.error?.message||null,output:(p.stdout||'')+(p.stderr||'')};results.push(r);console.log(r.exit_code,bin,...args);await writeFile(path.join(run,'results.json'),JSON.stringify({scope:'controlled mock and Chromium; not live',source,sha256,backend_sha256,hostSource,results},null,2)+'\n')}
console.log('Artifacts:',run,'passed:',results.filter(r=>r.exit_code===0).length,'/',results.length)
if(results.some(r=>r.exit_code!==0))process.exitCode=1
