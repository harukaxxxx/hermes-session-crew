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
const atom=v=>({get:()=>v}),route={connectionId:'conn',mode:'remote',profile:'alpha',targetProfile:'alpha'};let saved={},calls=0
const host={state:{connectionId:atom('conn'),profile:atom('default')},profiles:{list:async()=>({profiles:[{name:'alpha'}]})},profileRoutes:async()=>[route],request:async()=>({}),requestProfile:async()=>({sessions:[]})}
const storage={get:async k=>saved[k],set:async(k,v)=>{saved[k]=structuredClone(v)}}
const sdk={host,useValue:a=>a.get(),useQuery,...createPopoverFixture(React)}
async function until(fn){const end=Date.now()+5000;while(Date.now()<end){await React.act(async()=>{await new Promise(r=>setTimeout(r,5))});if(fn())return}throw Error('timeout '+document.body.textContent)}
let root,client
try{
 assert.equal((await receive()).ready,true)
 const rest=async(path,opts)=>{assert.equal(path,'/completion-snapshot');assert.equal(opts.method,'GET');calls++;const response=await request('snapshot');assert.equal(response.status,200);return response.body}
 const mod=new SourceTextModule(await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8'));await mod.link(async spec=>{const obj=spec==='@hermes/plugin-sdk'?sdk:spec==='react/jsx-runtime'?jsx:React;return new SyntheticModule(Object.keys(obj),function(){for(const [k,v] of Object.entries(obj))this.setExport(k,v)})});await mod.evaluate();let contribution;mod.namespace.default.register({storage,rest,register:c=>contribution=c});client=new QueryClient();root=createRoot(document.getElementById('root'))
 await React.act(async()=>root.render(React.createElement(QueryClientProvider,{client},contribution.render())));await until(()=>saved['completion-snapshot-v2']?.coverage);assert.equal(Boolean(document.querySelector('[data-completion-badge]')),false,'real started row is baseline, not completion')
 assert.equal((await request('activity')).active,true)
 await React.act(async()=>{await client.refetchQueries({queryKey:['profile-rail','completion-snapshot']})});await until(()=>Boolean(document.querySelector('[data-running-count]')))
 assert.equal(document.querySelector('[data-running-count]').textContent,'x2');assert.equal(document.querySelectorAll('[data-child-shadow]').length,3)
 for(const [release,end,shadows] of [['release-child','end-child',2],['release-child2','end-child2',1]]){assert.equal((await request(release)).released,true);await React.act(async()=>{await client.refetchQueries({queryKey:['profile-rail','completion-snapshot']})});assert.equal(document.querySelectorAll('[data-child-shadow]').length,shadows+1,'unleased recent child remains metadata, not running proof');assert.equal((await request(end)).ended,true);await React.act(async()=>{await client.refetchQueries({queryKey:['profile-rail','completion-snapshot']})});await until(()=>document.querySelectorAll('[data-child-shadow]').length===shadows);assert.equal(document.querySelector('[data-running-count]').textContent,'x2')}
 assert.match(document.querySelector('[data-running-count]').getAttribute('title'),/Observed/)
 console.log('PASS native lease → FastAPI → React Query xN and child')
}finally{
 if(root)await React.act(async()=>root.unmount());client?.clear();child.stdin.write(JSON.stringify('quit')+'\n');child.stdin.end();await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill();resolve()},3000);child.once('exit',()=>{clearTimeout(timer);resolve()})});lines.close()
}
