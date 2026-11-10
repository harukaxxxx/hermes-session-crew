import {createPopoverFixture} from './popover-fixture.mjs'
import {readFile} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {createInterface} from 'node:readline'
import {createRequire} from 'node:module'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
const home=(process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())
const require=createRequire(home+'/package.json'),React=require('react'),{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom'),jsx=require('react/jsx-runtime'),{useQuery,QueryClient,QueryClientProvider}=require('@tanstack/react-query')
const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
const child=spawn(home+'/.venv/bin/python',['-I','-B',new URL('./native_snapshot_fixture.py',import.meta.url).pathname],{env:{PATH:'/usr/bin:/bin',HOME:process.env.HOME,PYTHONNOUSERSITE:'1',TMPDIR:process.env.TMPDIR},stdio:['pipe','pipe','inherit']})
const pending=[];const lines=createInterface({input:child.stdout});lines.on('line',line=>{const next=pending.shift();if(next)next.resolve(JSON.parse(line))});child.on('exit',()=>{while(pending.length)pending.shift().reject(Error('fixture exited'))})
function receive(){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('fixture timeout')),5000);pending.push({resolve:v=>{clearTimeout(timer);resolve(v)},reject})})}
function request(command){const result=receive();child.stdin.write(JSON.stringify(command)+'\n');return result}
let profile='default';const atom=v=>({get:()=>v}),route={connectionId:'conn',mode:'remote',profile:'alpha',targetProfile:'alpha'};let saved={},calls=0
const host={state:{connectionId:atom('conn'),profile:{get:()=>profile}},profiles:{list:async()=>({profiles:[{name:'alpha'}]})},profileRoutes:async()=>[route],request:async()=>({}),requestProfile:async()=>({sessions:[]})}
const storage={get:async k=>saved[k],set:async(k,v)=>{saved[k]=structuredClone(v)}}
const sdk={host,useValue:a=>a.get(),useQuery,...createPopoverFixture(React)}
async function until(fn){const end=Date.now()+5000;while(Date.now()<end){await React.act(async()=>{await new Promise(r=>setTimeout(r,5))});if(fn())return}throw Error('timeout '+document.body.textContent)}
let root,client
try{
 assert.equal((await receive()).ready,true)
 const {transform}=require('esbuild'),clientSource=await readFile(home+'/apps/desktop/src/api/client.ts','utf8')
 const part=(a,b)=>{assert.ok(clientSource.includes(a)&&clientSource.includes(b));return clientSource.slice(clientSource.indexOf(a),clientSource.indexOf(b,clientSource.indexOf(a)))}
 const helperText=[part('export function profileScoped(', '\n/** A session\'s OWNER'),part('export function connectionScoped()', '\n// Whether the window'),part('export function hermesApi<T>(', '\n// ── Capability scope')].join('\n')
 globalThis.__nativeRailScope={get:()=>({profile,connectionId:'conn'})}
 const helpers=new SourceTextModule((await transform('const $apiRequestScope=globalThis.__nativeRailScope;\n'+helperText,{loader:'ts',format:'esm'})).code);await helpers.link(()=>{throw Error('unexpected import')});await helpers.evaluate()
 const imports={'@hermes/shared':{isStableOpen:()=>true,reconnectBackoffDelayMs:()=>0},'@/lib/host-capabilities':{hostHas:()=>false},'@/lib/with-timeout':{RECONNECT_ATTEMPT_TIMEOUT_MS:30000,withTimeout:x=>x},'./client':{$apiRequestScope:globalThis.__nativeRailScope,getApiRequestConnection:()=> 'conn',getApiRequestProfile:()=>profile,profileScoped:helpers.namespace.profileScoped,hermesApi:helpers.namespace.hermesApi}}
 const actualSdk=new SourceTextModule((await transform(await readFile(home+'/apps/desktop/src/api/plugins.ts','utf8'),{loader:'ts',format:'esm'})).code);await actualSdk.link(async name=>{const o=imports[name];assert.ok(o);return new SyntheticModule(Object.keys(o),function(){for(const [k,v] of Object.entries(o))this.setExport(k,v)})});await actualSdk.evaluate()
 const seen=[];window.hermesDesktop={api:async req=>{assert.equal(req.path,'/api/plugins/profile-rail/completion-snapshot');assert.equal(req.method,'GET');calls++;seen.push(req.profile);const response=await request({snapshot:req.profile});assert.equal(response.status,200);return response.body}}
 const rest=(path,opts)=>actualSdk.namespace.pluginRest('profile-rail',path,opts)
 const mod=new SourceTextModule(await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8'));await mod.link(async spec=>{const obj=spec==='@hermes/plugin-sdk'?sdk:spec==='react/jsx-runtime'?jsx:React;return new SyntheticModule(Object.keys(obj),function(){for(const [k,v] of Object.entries(obj))this.setExport(k,v)})});await mod.evaluate();let contribution;mod.namespace.default.register({storage,rest,register:c=>contribution=c});client=new QueryClient();root=createRoot(document.getElementById('root'))
 await React.act(async()=>root.render(React.createElement(QueryClientProvider,{client},contribution.render())));await until(()=>saved['completion-snapshot-v2']?.coverage);assert.equal(Boolean(document.querySelector('[data-completion-badge]')),false,'real started row is baseline, not completion')
 assert.equal((await request('settle')).settled,true)
 await React.act(async()=>{await client.refetchQueries({queryKey:['profile-rail','completion-snapshot']})});await until(()=>Boolean(document.querySelector('[data-completion-badge]')));assert.equal(document.querySelector('[data-completion-badge]').textContent,'✋');assert.ok(calls>=2)
 for(const next of ['alpha','beta','default']){const n=calls;profile=next;await React.act(async()=>root.render(React.createElement(QueryClientProvider,{client},contribution.render())));await until(()=>calls>n&&seen.at(-1)===next);await until(()=>document.querySelector('[data-completion-badge]'))}
 assert.deepEqual([...new Set(seen)],['default','alpha','beta'])
 console.log('PASS native admission/settlement → FastAPI → real pluginRest → real React Query, default/named/default')
}finally{
 if(root)await React.act(async()=>root.unmount());client?.clear();child.stdin.write(JSON.stringify('quit')+'\n');child.stdin.end();await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill();resolve()},3000);child.once('exit',()=>{clearTimeout(timer);resolve()})});lines.close()
}
