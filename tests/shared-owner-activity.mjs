import {createPopoverFixture} from './popover-fixture.mjs'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
const require=createRequire(process.env.HERMES_CHECKOUT+'/package.json'),React=require('react'),{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom'),jsx=require('react/jsx-runtime'),{useQuery,QueryClient,QueryClientProvider}=require('@tanstack/react-query')
const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
const atom=v=>{const listeners=new Set();return {get:()=>v,subscribe:f=>(listeners.add(f),()=>listeners.delete(f)),set:x=>{v=x;for(const f of listeners)f()}}}
const gateway=atom('open'),epoch=atom(1),route={connectionId:'conn',mode:'remote',profile:'alpha',targetProfile:'alpha'},active=[],calls=[]
let office={profile:'alpha',online:true,state:'working',status_observation:'recent_session_activity'},owners={one:'alpha',four:'alpha'},sources={one:'cli',four:'cli'},roster=[]
const host={state:{gateway,connectionId:atom('conn'),profile:atom('default')},profiles:{list:async()=>({profiles:[{name:'alpha'}]})},profileRoutes:async()=>[route],request:async()=>({found:false}),requestProfile:async(r,m)=>{calls.push(m);return m==='session.active_list'?{sessions:structuredClone(active)}:m==='subagent.roster'?{sessions:structuredClone(roster)}:m==='session.list'?{sessions:['one','two','three','four'].map(id=>({id,title:id,source:'cli'}))}:{projects:[]}}}
const rest=async(p,opts)=>p==='/status'?[office]:p==='/recent-activity'?{profile:'alpha',activity:{one:40,two:30,three:20,four:10}}:p==='/row-owners'?{owners:Object.fromEntries(opts.body.ids.map(id=>[id,owners[id]])),sources:Object.fromEntries(opts.body.ids.map(id=>[id,sources[id]]))}:{version:2,source_root:'default',source_id:'source',server_epoch:'epoch',profiles:[]}
const useValue=a=>React.useSyncExternalStore(a.subscribe,a.get,a.get)
const sdk={host,useValue,useGatewayActivationEpoch:()=>useValue(epoch),gatewayActivationEpoch:epoch.get,useQuery,...createPopoverFixture(React)}
const mod=new SourceTextModule(await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8'));await mod.link(async spec=>{const o=spec==='@hermes/plugin-sdk'?sdk:spec==='react/jsx-runtime'?jsx:React;return new SyntheticModule(Object.keys(o),function(){for(const [k,v] of Object.entries(o))this.setExport(k,v)})});await mod.evaluate()
let contribution;mod.namespace.default.register({storage:{get:async key=>key==='display-settings-v1'?{hideOffline:false,showCron:false,developerMode:true,hiddenProfiles:[]}:null,set:async()=>{}},rest,register:x=>contribution=x});const client=new QueryClient({defaultOptions:{queries:{retry:false}}}),root=createRoot(document.getElementById('root'))
async function until(fn){const end=Date.now()+3000;while(Date.now()<end){await React.act(async()=>{await new Promise(r=>setTimeout(r,10))});if(fn())return}throw Error('timeout: '+document.body.innerHTML.slice(0,1000))}
const button=()=>document.querySelector('.profile-rail-hit'),timer=()=>document.querySelector('[data-idle-minutes]')?.textContent??null,refresh=(key='profile-input-waiting')=>React.act(async()=>client.refetchQueries({queryKey:['sessioncrew',key],type:'active'})),record=(id,status)=>({id,session_key:id,source:'cli',status})
const setStatus=async(state,reason)=>{office={...office,state,status_observation:reason};await refresh('status')}
const apply=async (...sessions)=>{active.splice(0,active.length,...sessions);await refresh()}
try{
 active.push(record('one','idle'))
 await React.act(async()=>root.render(React.createElement(QueryClientProvider,{client},contribution.render())))
 await until(()=>button()&&calls.includes('session.active_list'))
 await until(()=>button().getAttribute('data-state-name')==='online_unobserved')
 await React.act(async()=>button().click());await until(()=>document.querySelectorAll('[data-recent-row]').length===3)
 assert.equal(document.querySelectorAll('[data-session-arc]').length,0,'idle does not animate')
 const before=calls.filter(x=>x==='session.active_list').length;await new Promise(r=>setTimeout(r,100));assert.equal(calls.filter(x=>x==='session.active_list').length,before,'dialog does not start a second activity poller')
 active.splice(0,active.length,record('one','working'));office={...office,state:'online_unobserved',status_observation:'fresh_shared_gateway_no_observed_owner_work'};await React.act(async()=>client.refetchQueries({queryKey:['sessioncrew','status']}));await refresh()
 await until(()=>button().getAttribute('data-state-name')==='working'&&document.querySelector('[data-session-arc]'))
 const realNow=Date.now;try{Date.now=()=>realNow()+95000;await refresh();await until(()=>button().getAttribute('data-state-name')==='working'&&document.querySelector('[data-session-arc]'));assert.equal(button().getAttribute('data-state-name'),'working','fresh positive work remains visible beyond 90 seconds')}finally{Date.now=realNow}
 // Reobserve work after rewinding the test clock; a future-dated sample is not a valid predecessor.
 await React.act(async()=>client.refetchQueries({queryKey:['sessioncrew','status']}));await refresh();await until(()=>button().getAttribute('data-state-name')==='working'&&document.querySelector('[data-session-arc]'))
 active.splice(0,active.length,record('one','idle'));office={...office,state:'working',status_observation:'recent_session_activity'};await React.act(async()=>client.refetchQueries({queryKey:['sessioncrew','status']}));await refresh();await until(()=>button().getAttribute('data-state-name')==='online_unobserved'&&!document.querySelector('[data-session-arc]'));assert.equal(button().getAttribute('data-state-name'),'online_unobserved','completed open session drops both working presentations without waiting for recency expiry')
 assert.equal(document.querySelector('[data-idle-minutes]')?.textContent,'0h0m','verified completion supplies an observed idle start despite backend recency')
 active.splice(0,active.length,record('four','working'));await refresh();await until(()=>button().getAttribute('data-state-name')==='working'&&!document.querySelector('[data-session-arc]'));assert.equal(button().getAttribute('data-state-name'),'working','unloaded fourth session drives profile')
 owners.four='other';await refresh();await until(()=>button().getAttribute('data-state-name')==='online_unobserved')
 owners.four='alpha';sources.four='different';await refresh();assert.equal(button().getAttribute('data-state-name'),'online_unobserved','source mismatch fails closed')
 sources.four='cli';active.splice(0,active.length,record('one','idle'));roster=[{session_id:'one',background:1}];office={...office,state:'waiting',status_observation:null};await React.act(async()=>client.refetchQueries({queryKey:['sessioncrew','status']}));await refresh();await until(()=>button().getAttribute('data-state-name')==='waiting'&&document.querySelector('[data-session-arc]'))
 active.splice(0,active.length,record('one','working'));await refresh();await until(()=>button().getAttribute('data-state-name')==='working')
 active.splice(0,active.length);roster=[];office={...office,state:'working',status_observation:'recent_delegated_activity'};await React.act(async()=>client.refetchQueries({queryKey:['sessioncrew','status']}));await refresh();await until(()=>button().getAttribute('data-state-name')==='online_unobserved')
 office={...office,status_observation:null};await React.act(async()=>client.refetchQueries({queryKey:['sessioncrew','status']}));await until(()=>button().getAttribute('data-state-name')==='working')

 await setStatus('working','recent_session_activity');await until(()=>button().getAttribute('data-state-name')==='online_unobserved')
 const start=async()=>{await apply(record('one','working'));await until(()=>button().getAttribute('data-state-name')==='working')}
 const finish=()=>apply(record('one','idle'))
 const establish=async()=>{await start();await finish();await until(()=>timer()==='0h0m')}
 for(const [scope,change,restore] of [
  ['connection',()=>host.state.connectionId.set('elsewhere'),()=>host.state.connectionId.set('conn')],
  ['profile',()=>host.state.profile.set('elsewhere'),()=>host.state.profile.set('default')],
  ['epoch',()=>epoch.set(2),()=>{}],
  ['gateway generation',()=>gateway.set('closed'),()=>gateway.set('open')],
 ]){
  await establish();await React.act(async()=>change());await React.act(async()=>restore());await refresh('status');await finish();await until(()=>button()?.getAttribute('data-state-name')==='online_unobserved');assert.equal(timer(),null,`${scope} fences an established observed start`)
 }
 // An elapsed observation gap cannot be bridged by the first idle snapshot.
 await start();const now=Date.now;try{Date.now=()=>now()+21000;await refresh('status');await finish();await until(()=>button().getAttribute('data-state-name')==='online_unobserved');assert.equal(timer(),null,'stale work is not completed by a later idle poll')}finally{Date.now=now}
 await refresh('status');await finish()
 await start();sources.one='different';await finish();await until(()=>button().getAttribute('data-state-name')==='online_unobserved');assert.equal(timer(),null,'ownership/source error is not completion');sources.one='cli';await finish();assert.equal(timer(),null,'an error breaks the observation chain')
 await start();roster=[{session_id:'four',subagents:1,background:0}];await finish();await until(()=>button().getAttribute('data-state-name')==='online_unobserved');assert.equal(timer(),null,'unmatched roster work blocks idle without promoting unrelated indicators');roster=[];await finish();await until(()=>timer()==='0h0m')
 await setStatus('waiting',null);await until(()=>button().getAttribute('data-state-name')==='waiting');assert.equal(timer(),null,'backend waiting hides observed timer');await setStatus('working','recent_session_activity');await finish();assert.equal(timer(),null,'backend wait cannot revive old start')
 console.log('PASS shared activity, provenance, unloaded session, ownership, observed idle and scope/expiry fences')
}finally{await React.act(async()=>root.unmount());client.clear()}
