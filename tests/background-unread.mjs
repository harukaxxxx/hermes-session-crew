import {createPopoverFixture} from './popover-fixture.mjs'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
const require=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT)+'/package.json'),React=require('react'),{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom'),jsx=require('react/jsx-runtime'),{useQuery,QueryClient,QueryClientProvider}=require('@tanstack/react-query')
const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
const atom=v=>{const ls=new Set();return {get:()=>v,subscribe:f=>(ls.add(f),()=>ls.delete(f)),set:x=>{v=x;for(const f of ls)f()}}},gateway=atom('open'),connection=atom('conn'),profile=atom('default'),route={connectionId:'conn',mode:'remote',profile:'alpha',targetProfile:'alpha'}
let active=[{id:'one',session_key:'one',source:'desktop',status:'idle'}],roster=[{session_id:'one',background:1,subagents:0}],owners={one:'alpha',two:'alpha'},saved={}
const host={onEvent:()=>()=>{},state:{gateway,connectionId:connection,profile},profiles:{list:async()=>({profiles:[{name:'alpha'}]})},profileRoutes:async()=>[route],request:async()=>({}),openSession:async()=>{},requestProfile:async(r,m)=>m==='session.active_list'?{sessions:structuredClone(active)}:m==='subagent.roster'?{sessions:structuredClone(roster)}:m==='session.list'?{sessions:[{id:'one',title:'One',source:'desktop'},{id:'two',title:'Two',source:'desktop'}]}:{projects:[]}}
const snapshot={version:2,source_root:'default',source_id:'source',server_epoch:'epoch',profiles:[{profile:'alpha',status:'ok',database_id:'db',high_water:0,truncated:false,rows:[]}]},storage={get:async k=>saved[k],set:async(k,v)=>{saved[k]=structuredClone(v)}}
const rest=async(p,o)=>p==='/status'?[]:p==='/recent-activity'?{profile:'alpha',activity:{one:2,two:1}}:p==='/row-owners'?{owners:Object.fromEntries(o.body.ids.map(id=>[id,owners[id]])),sources:Object.fromEntries(o.body.ids.map(id=>[id,'desktop']))}:structuredClone(snapshot)
const sdk={host,useValue:a=>a.get(),useQuery,...createPopoverFixture(React)},mod=new SourceTextModule(await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8'));await mod.link(async spec=>{const o=spec==='@hermes/plugin-sdk'?sdk:spec==='react/jsx-runtime'?jsx:React;return new SyntheticModule(Object.keys(o),function(){for(const [k,v] of Object.entries(o))this.setExport(k,v)})});await mod.evaluate()
let contribution;mod.namespace.default.register({storage,rest,register:x=>contribution=x});const client=new QueryClient({defaultOptions:{queries:{retry:false}}}),root=createRoot(document.getElementById('root'))
async function until(fn){const end=Date.now()+4000;while(Date.now()<end){await React.act(async()=>{await new Promise(r=>setTimeout(r,5))});if(fn())return}throw Error('fixture timeout '+document.body.textContent)}
const dot=()=>!!document.querySelector('[data-completion-badge]'),rows=()=>[...document.querySelectorAll('[data-recent-row]')],mark=i=>!!rows()[i]?.querySelector('[data-session-completion-badge]'),refetch=async key=>React.act(async()=>client.refetchQueries({queryKey:['sessioncrew',key]}))
try{
 await React.act(async()=>root.render(React.createElement(QueryClientProvider,{client},contribution.render())));await until(()=>saved['completion-snapshot-v2']?.coverage)
 const p=snapshot.profiles[0];p.high_water=1;p.rows=[{seq:1,admission_id:'a',session_id:'one',session_source:'desktop',status:'terminal',outcome:'completed',generation:1}];await refetch('completion-snapshot');await until(()=>saved['completion-snapshot-v2'].rows.length===1)
 await React.act(async()=>document.querySelector('.profile-rail-hit').click());await until(()=>rows().length===2&&rows()[0].querySelector('[data-session-arc]'))
 assert.equal(dot(),false,'background work suppresses same-session avatar unread');assert.equal(mark(0),false,'background work suppresses same-session row unread');assert.equal(saved['completion-snapshot-v2'].rows[0].read,false)
 p.high_water=2;p.rows.push({seq:2,admission_id:'b',session_id:'two',session_source:'desktop',status:'terminal',outcome:'completed',generation:1});await refetch('completion-snapshot');await until(()=>saved['completion-snapshot-v2'].rows.length===2);assert.equal(dot(),true,'other session unread remains visible');assert.equal(mark(0),false);assert.equal(mark(1),true)
 owners.one='other';await refetch('profile-input-waiting');await refetch('row-activity');await until(()=>mark(0));assert.equal(dot(),true,'owner mismatch never suppresses');owners.one='alpha'
 await refetch('profile-input-waiting');await refetch('row-activity');await until(()=>!mark(0))
 await React.act(async()=>gateway.set('closed'));await until(()=>mark(0));assert.equal(dot(),true,'disconnected observation is not trusted')
 await React.act(async()=>gateway.set('open'));await until(()=>!mark(0))
 active=[{id:'one',session_key:'one',source:'desktop',status:'waiting'}];await refetch('profile-input-waiting');await refetch('row-activity');await until(()=>document.querySelector('[data-avatar-waiting]')&&rows()[0].querySelector('[data-session-waiting]'));assert.equal(mark(0),false,'waiting hand keeps priority')
 active=[{id:'one',session_key:'one',source:'desktop',status:'idle'}];roster=[{session_id:'one',background:0,subagents:1}];await refetch('profile-input-waiting');await refetch('row-activity');await until(()=>!document.querySelector('[data-avatar-waiting]')&&!mark(0));assert.equal(mark(1),true,'subagent activity remains per session')
 roster=[];await refetch('profile-input-waiting');await refetch('row-activity');await until(()=>mark(0));assert.equal(dot(),true);assert.ok(saved['completion-snapshot-v2'].rows.every(x=>!x.read),'restoration does not acknowledge')
 console.log('PASS per-session background unread suppression, other session, restoration and ledger')
}finally{await React.act(async()=>root.unmount());client.clear()}
