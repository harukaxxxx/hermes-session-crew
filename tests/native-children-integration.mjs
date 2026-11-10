import {createPopoverFixture} from './popover-fixture.mjs'
import {readFile} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {createInterface} from 'node:readline'
import {createRequire} from 'node:module'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
const home=(process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())
const require=createRequire(home+'/package.json'),React=require('react'),{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom'),jsx=require('react/jsx-runtime'),{useQuery,QueryClient,QueryClientProvider}=require('@tanstack/react-query')
const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'});globalThis.window=dom.window;globalThis.document=dom.window.document;Object.defineProperty(dom.window.HTMLElement.prototype,'clientWidth',{configurable:true,get(){return 80}});globalThis.IS_REACT_ACT_ENVIRONMENT=true
const child=spawn(home+'/.venv/bin/python',['-I','-B',new URL('./native_snapshot_fixture.py',import.meta.url).pathname],{env:{PATH:'/usr/bin:/bin',HOME:process.env.HOME,PYTHONNOUSERSITE:'1',TMPDIR:process.env.TMPDIR},stdio:['pipe','pipe','inherit']})
const pending=[];const lines=createInterface({input:child.stdout});lines.on('line',line=>{const next=pending.shift();if(next)next.resolve(JSON.parse(line))});child.on('exit',()=>{while(pending.length)pending.shift().reject(Error('fixture exited'))})
function receive(){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('fixture timeout')),5000);pending.push({resolve:v=>{clearTimeout(timer);resolve(v)},reject})})}
function request(command){const result=receive();child.stdin.write(JSON.stringify(command)+'\n');return result}
const atom=v=>({get:()=>v}),route={connectionId:'conn',mode:'remote',profile:'alpha',targetProfile:'alpha'};let saved={}
const host={state:{connectionId:atom('conn'),profile:atom('default')},profiles:{list:async()=>({profiles:[{name:'alpha'}]})},profileRoutes:async()=>[route],request:async()=>({}),requestProfile:async()=>({sessions:[]})}
const storage={get:async k=>saved[k],set:async(k,v)=>{saved[k]=structuredClone(v)}}
const sdk={host,useValue:a=>a.get(),useQuery,...createPopoverFixture(React)}
async function until(fn){const end=Date.now()+5000;while(Date.now()<end){await React.act(async()=>{await new Promise(r=>setTimeout(r,5))});if(fn())return}throw Error('timeout '+document.body.textContent)}
let root,client
try{
 assert.equal((await receive()).ready,true)
 let payload
 const rest=async(path,opts)=>{assert.equal(path,'/completion-snapshot');assert.equal(opts.method,'GET');const response=await request('snapshot');assert.equal(response.status,200);payload=response.body;return payload}
 const mod=new SourceTextModule(await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8'));await mod.link(async spec=>{const obj=spec==='@hermes/plugin-sdk'?sdk:spec==='react/jsx-runtime'?jsx:React;return new SyntheticModule(Object.keys(obj),function(){for(const [k,v] of Object.entries(obj))this.setExport(k,v)})});await mod.evaluate();let contribution;mod.namespace.default.register({storage,rest,register:c=>contribution=c});client=new QueryClient();root=createRoot(document.getElementById('root'))
 await React.act(async()=>root.render(React.createElement(QueryClientProvider,{client},contribution.render())));await until(()=>saved['completion-snapshot-v2']?.coverage)
 assert.equal((await request('metadata-children')).created,true)
 await React.act(async()=>{await client.refetchQueries({queryKey:['sessioncrew','completion-snapshot']})});await until(()=>document.querySelectorAll('[data-child-shadow]').length===2)
 const a=payload.profiles.find(p=>p.profile==='alpha').activity;assert.equal(a.coverage,'unavailable');assert.deepEqual(new Set(a.child_metadata.children.map(c=>c.kind)),new Set(['queued','recent']));assert.equal(a.child_metadata.presentation_count,2);assert.equal(document.querySelector('[data-running-count]'),null);assert.match(document.querySelector('.profile-rail-hit').getAttribute('aria-label'),/not proof of execution/)
 assert.equal((await request('end-metadata-children')).ended,true)
 await React.act(async()=>{await client.refetchQueries({queryKey:['sessioncrew','completion-snapshot']})});await until(()=>document.querySelectorAll('[data-child-shadow]').length===0)
 assert.equal(payload.profiles.find(p=>p.profile==='alpha').activity.child_metadata.presentation_count,0)
 console.log('PASS native unleased queued/recent → FastAPI → React Query shadows; ended clears')
}finally{if(root)await React.act(async()=>root.unmount());client?.clear();child.stdin.write(JSON.stringify('quit')+'\n');child.stdin.end();await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill();resolve()},3000);child.once('exit',()=>{clearTimeout(timer);resolve()})});lines.close()}
