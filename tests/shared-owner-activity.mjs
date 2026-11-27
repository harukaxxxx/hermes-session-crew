import {createPopoverFixture} from './popover-fixture.mjs'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
const require=createRequire(process.env.HERMES_CHECKOUT+'/package.json'),React=require('react'),{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom'),jsx=require('react/jsx-runtime'),{useQuery,QueryClient,QueryClientProvider}=require('@tanstack/react-query')
const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
const atom=v=>{const listeners=new Set();return {get:()=>v,subscribe:f=>(listeners.add(f),()=>listeners.delete(f)),set:x=>{v=x;for(const f of listeners)f()}}}
const gateway=atom('open'),epoch=atom(1),route={connectionId:'conn',mode:'remote',profile:'alpha',targetProfile:'alpha'},active=[],calls=[]
const outsideId='off-page',recentIds=['one','two','three','filler-1','filler-2','filler-3','filler-4','filler-5','filler-6',outsideId]
let office={profile:'alpha',online:true,state:'working',status_observation:'recent_session_activity'},owners={one:'alpha',[outsideId]:'alpha'},sources={one:'cli',[outsideId]:'cli'},roster=[]
const names=['alpha','beta']
const host={state:{gateway,connectionId:atom('conn'),profile:atom('default')},profiles:{list:async()=>({profiles:names.map(name=>({name}))})},profileRoutes:async()=>names.map(name=>({...route,profile:name,targetProfile:name})),request:async()=>({found:false}),requestProfile:async(r,m)=>{calls.push(m);if(r.profile!=='alpha')return {sessions:[]};return m==='session.active_list'?{sessions:structuredClone(active)}:m==='subagent.roster'?{sessions:structuredClone(roster)}:m==='session.list'?{sessions:recentIds.map(id=>({id,title:id,source:'cli'}))}:{projects:[]}}}
let statusReads=0,holdStatus
let betaOffice
const snapshot={version:2,source_root:'default',source_id:'source',server_epoch:'epoch',profiles:names.map(profile=>({profile,status:'ok',database_id:'db-'+profile,high_water:0,truncated:false,rows:[]}))}
const rest=async(p,opts)=>p==='/status'?(++statusReads,holdStatus?holdStatus(office):[office,...(betaOffice?[betaOffice]:[])]):p==='/recent-activity'?{profile:'alpha',activity:Object.fromEntries(recentIds.map((id,i)=>[id,recentIds.length-i]))}:p==='/row-owners'?{owners:Object.fromEntries(opts.body.ids.map(id=>[id,owners[id]])),sources:Object.fromEntries(opts.body.ids.map(id=>[id,sources[id]]))}:structuredClone(snapshot)
const useValue=a=>React.useSyncExternalStore(a.subscribe,a.get,a.get)
const sdk={host,useValue,useGatewayActivationEpoch:()=>useValue(epoch),gatewayActivationEpoch:epoch.get,useQuery,...createPopoverFixture(React)}
const mod=new SourceTextModule(await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8'));await mod.link(async spec=>{const o=spec==='@hermes/plugin-sdk'?sdk:spec==='react/jsx-runtime'?jsx:React;return new SyntheticModule(Object.keys(o),function(){for(const [k,v] of Object.entries(o))this.setExport(k,v)})});await mod.evaluate()
const saved={'display-settings-v1':{hideOffline:false,showCron:false,developerMode:true,hiddenProfiles:[],recentSessionCount:3}}
let contribution,settingsPage;mod.namespace.default.register({storage:{get:async key=>saved[key],set:async(key,value)=>{saved[key]=structuredClone(value)}},rest,register:x=>contribution=x,registerSettingsPage:x=>settingsPage=x});const client=new QueryClient({defaultOptions:{queries:{retry:false}}}),root=createRoot(document.getElementById('root'))
async function until(fn){const end=performance.now()+3000;while(performance.now()<end){await React.act(async()=>{await new Promise(r=>setTimeout(r,10))});if(fn())return}throw Error('timeout: '+document.body.innerHTML.slice(0,1000))}
const buttons=()=>[...document.querySelectorAll('.profile-rail-hit')],label=x=>x.getAttribute('aria-label').split(' · ')[0].toLowerCase(),button=(name='alpha')=>buttons().find(x=>label(x)===name)
const badge=(name,selector)=>button(name)?.closest('[data-avatar-stack]').querySelector(selector),timer=(name='alpha')=>badge(name,'[data-idle-minutes]')?.textContent??null
const refresh=(key='profile-input-waiting')=>React.act(async()=>client.refetchQueries({queryKey:['sessioncrew',key],type:'active'})),record=(id,status)=>({id,session_key:id,source:'cli',status})
const setStatus=async(state,reason)=>{office={...office,state,status_observation:reason};await refresh('status')}
const apply=async (...sessions)=>{active.splice(0,active.length,...sessions);await refresh()}
try{
 const coldActivity=Date.now()/1000-125
 office={profile:'alpha',online:true,state:'online_unobserved',busy:null,idle_since:null,status_observation:'fresh_shared_gateway_no_observed_owner_work',last_session_activity:coldActivity}
 await React.act(async()=>root.render(React.createElement(QueryClientProvider,{client},contribution.render(),settingsPage.render())))
 await until(()=>button()&&calls.includes('session.active_list'))
 await until(()=>button().getAttribute('data-state-name')==='online_unobserved')
 assert.equal(timer(),'0h2m','cold legacy shared-positive status uses the owner timestamp without asserting idle')
 assert.match(button().title,/last recorded session activity.*idle not confirmed/i)
 sources.one='mismatch';await apply(record('one','working'))
 await until(()=>timer()===null) // Conflicting ownership/source is not an empty live list.
 sources.one='cli';await apply();await until(()=>timer()==='0h2m')

 // RPC waiting alone must fence confirmed idle, even though /status has not changed.
 const idleOffice={profile:'alpha',online:true,state:'idle',idle_since:Date.now()/1000-85}
 office=idleOffice;await refresh('status');await until(()=>timer()==='0h1m')
 const hand=()=>document.querySelector('[data-avatar-waiting]')
 const waitForInput=async()=>{await apply(record('one','waiting'));await until(()=>hand()&&timer()===null)}
 const clearInput=async()=>{await apply(record('one','idle'));await until(()=>!hand())}
 const beforeWait=statusReads
 await waitForInput();await clearInput()
 assert.equal(statusReads,beforeWait,'/status stays fixed through RPC waiting and clear')
 assert.equal(timer(),null,'RPC waiting clear cannot revive cached /status idle')
 await refresh('status');await until(()=>timer()==='0h1m')
 console.log('PASS RPC waiting fences cached idle until a newer /status poll')

 // A pre-wait request must not revive idle just because it returns after clear.
 await setStatus('unknown',null);await until(()=>button().getAttribute('data-state-name')==='unknown')
 office=idleOffice
 let releaseStatus,pendingStatus
 holdStatus=row=>new Promise(resolve=>{releaseStatus=()=>resolve([row])})
 await React.act(async()=>{pendingStatus=client.refetchQueries({queryKey:['sessioncrew','status'],type:'active'})})
 await until(()=>releaseStatus)
 await waitForInput();await clearInput()
 holdStatus=null
 await React.act(async()=>{releaseStatus();await pendingStatus})
 await until(()=>button().getAttribute('data-state-name')==='idle')
 assert.equal(timer(),null,'a late pre-wait /status response cannot revive idle')
 await refresh('status');await until(()=>timer()==='0h1m')
 console.log('PASS RPC waiting fences in-flight idle until a newer /status poll')

 office={profile:'alpha',online:true,state:'working',status_observation:'recent_session_activity'}
 await refresh('status');await apply(record('one','idle'))
 await until(()=>timer()===null) // Recency without fresh shared-positive evidence is not enough.
 const mountedTitles=()=>[...document.querySelectorAll('[data-recent-row] strong')].map(row=>row.textContent)
 await React.act(async()=>button().click());await until(()=>mountedTitles().length>0)
 assert.deepEqual(mountedTitles(),recentIds.slice(0,9),'N=3 mounts nine rows in recency order')
 assert.equal(document.querySelectorAll('[data-session-arc]').length,0,'idle does not animate')
 const before=calls.filter(x=>x==='session.active_list').length;await new Promise(r=>setTimeout(r,100));assert.equal(calls.filter(x=>x==='session.active_list').length,before,'dialog does not start a second activity poller')
 active.splice(0,active.length,record('one','working'));office={...office,state:'online_unobserved',status_observation:'fresh_shared_gateway_no_observed_owner_work'};await React.act(async()=>client.refetchQueries({queryKey:['sessioncrew','status']}));await refresh()
 await until(()=>button().getAttribute('data-state-name')==='working'&&document.querySelector('[data-session-arc]'))
 const realNow=Date.now;try{Date.now=()=>realNow()+95000;await refresh();await until(()=>button().getAttribute('data-state-name')==='working'&&document.querySelector('[data-session-arc]'));assert.equal(button().getAttribute('data-state-name'),'working','fresh positive work remains visible beyond 90 seconds')}finally{Date.now=realNow}
 // Reobserve work after rewinding the test clock; a future-dated sample is not a valid predecessor.
 await React.act(async()=>client.refetchQueries({queryKey:['sessioncrew','status']}));await refresh();await until(()=>button().getAttribute('data-state-name')==='working'&&document.querySelector('[data-session-arc]'))
 active.splice(0,active.length,record('one','idle'));office={...office,state:'working',status_observation:'recent_session_activity'};await React.act(async()=>client.refetchQueries({queryKey:['sessioncrew','status']}));await refresh();await until(()=>button().getAttribute('data-state-name')==='online_unobserved'&&!document.querySelector('[data-session-arc]'));assert.equal(button().getAttribute('data-state-name'),'online_unobserved','completed open session drops both working presentations without waiting for recency expiry')
 assert.equal(document.querySelector('[data-idle-minutes]')?.textContent,'0h0m','verified completion supplies an observed idle start despite backend recency')
 active.splice(0,active.length,record(outsideId,'working'));await refresh();await until(()=>button().getAttribute('data-state-name')==='working'&&!document.querySelector('[data-session-arc]'));assert.deepEqual(mountedTitles(),recentIds.slice(0,9),'working session drives the profile without mounting a row')
 owners[outsideId]='other';await refresh();await until(()=>button().getAttribute('data-state-name')==='online_unobserved')
 owners[outsideId]='alpha';await refresh();await until(()=>button().getAttribute('data-state-name')==='working')
 sources[outsideId]='different';await refresh();await until(()=>button().getAttribute('data-state-name')==='online_unobserved')
 sources[outsideId]='cli';active.splice(0,active.length,record('one','idle'));roster=[{session_id:'one',background:1}];office={...office,state:'waiting',status_observation:null};await React.act(async()=>client.refetchQueries({queryKey:['sessioncrew','status']}));await refresh();await until(()=>button().getAttribute('data-state-name')==='waiting'&&document.querySelector('[data-session-arc]'))
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
 await start();roster=[{session_id:outsideId,subagents:1,background:0}];await finish();await until(()=>button().getAttribute('data-state-name')==='online_unobserved');assert.equal(timer(),null,'unmatched roster work blocks idle without promoting unrelated indicators');roster=[];await finish();await until(()=>timer()==='0h0m')
 await setStatus('waiting',null);await until(()=>button().getAttribute('data-state-name')==='waiting');assert.equal(timer(),null,'backend waiting hides observed timer');await setStatus('working','recent_session_activity');await finish();assert.equal(timer(),null,'backend wait cannot revive old start')

 // Reproduce the shared host fallback using the public response shapes: a
 // session may leave active_list; neither that nor a positive counter is idle.
 const publish=async fields=>{office={profile:'alpha',online:true,...fields};await refresh('status');await React.act(async()=>{await new Promise(r=>setTimeout(r,10))})}
 const last=Date.now()/1000-85
 const recent=observation=>publish({state:'working',busy:true,status_observation:'recent_session_activity',last_session_activity:last,shared_gateway_observation:observation})
 await start();await apply();await recent('positive');await until(()=>button().getAttribute('data-state-name')==='online_unobserved');assert.equal(timer(),null,'a first positive shared sample cannot time a missing worker')
 await recent('zero');assert.equal(timer(),'0h1m','fresh zero recovers idle before recency expires, with an empty public live list')
 await recent('positive');assert.equal(button().getAttribute('data-state-name'),'online_unobserved');assert.equal(timer(),'0h1m','recency must not erase a historical start when the host becomes busy');assert.match(button().title,/last confirmed idle.*unknown/i)
 await publish({state:'online_unobserved',busy:null,idle_since:null,status_observation:'fresh_shared_gateway_no_observed_owner_work'});assert.equal(timer(),'0h1m','crossing the recency cutoff does not drop the start')
 await publish({state:'unknown',busy:null,idle_since:last});await recent('positive');assert.equal(timer(),null,'unavailable backend evidence breaks historical continuity')
 await start();await recent('zero');assert.equal(button().getAttribute('data-state-name'),'working','positive owner RPC still wins over a shared zero');assert.equal(timer(),null)
 await recent('positive');await start();await apply();await recent('positive');assert.equal(timer(),null,'a new poll alone cannot revive the pre-work timestamp as an estimate')
 await React.act(async()=>{await new Promise(r=>setTimeout(r,20))})
 const newer=Date.now()/1000
 const estimate=(fields={})=>publish({state:'online_unobserved',busy:null,idle_since:null,status_observation:'fresh_shared_gateway_no_observed_owner_work',last_session_activity:newer,...fields})
 await estimate();await until(()=>timer()==='0h0m');assert.match(button().title,/last recorded session activity.*idle not confirmed/i)
 await estimate({active_turn:true});await until(()=>timer()===null)
 await estimate();assert.equal(timer(),null,'an owner lease in /status also fences an estimate after it clears')
 await publish({state:'idle',idle_since:last});await until(()=>timer()==='0h1m')
 await estimate();assert.match(button().title,/last confirmed idle.*unknown/i)
 await estimate({active_turn:true});await until(()=>timer()===null)
 await estimate();assert.equal(timer(),null,'an owner lease invalidates retained shared-host history too')
 console.log('PASS shared activity, provenance, unloaded session, ownership, observed idle and scope/expiry fences')

 // Both owners have unread dots, so only the idle timestamp can swap their rank.
 await until(()=>saved['completion-snapshot-v2']?.coverage)
 for(const p of snapshot.profiles){p.high_water=1;p.rows=[{seq:1,admission_id:p.profile,session_id:p.profile,status:'terminal',outcome:'completed',generation:1}]}
 await refresh('completion-snapshot')
 const at=Date.now(),alphaIdle={profile:'alpha',online:true,state:'idle',idle_since:at/1000-90}
 betaOffice={profile:'beta',online:true,state:'idle',idle_since:at/1000-150}
 const rail=()=>({order:buttons().map(label),timers:names.map(timer),unread:names.map(name=>!!badge(name,'[data-completion-badge]'))})
 const confirmed={order:['alpha','beta'],timers:['0h1m','0h2m'],unread:[true,true]}
 const fenced={...confirmed,order:['beta','alpha'],timers:[null,'0h2m']}
 office=alphaIdle;await refresh('status');await until(()=>rail().unread.every(Boolean)&&timer()==='0h1m'&&timer('beta')==='0h2m')
 assert.deepEqual(rail(),confirmed,'confirmed idle sets the initial rank')
 const toggleAlpha=()=>[...document.querySelectorAll('button[aria-pressed]')].find(x=>x.textContent==='alpha')
 const setVisible=async visible=>{await until(()=>!toggleAlpha()?.disabled&&!!toggleAlpha());await React.act(async()=>toggleAlpha().click());await until(()=>!!button()===visible)}
 const reads=statusReads
 await waitForInput();await clearInput();assert.deepEqual(rail(),fenced,'waiting clear reveals unread without restoring stale idle rank')
 await setVisible(false);await setVisible(true)
 assert.equal(statusReads,reads,'hide and re-show do not refresh /status')
 const afterRemount=rail()
 await refresh('status');await until(()=>timer()==='0h1m');assert.deepEqual(rail(),confirmed,'later request restores the original idle timestamp and rank')

 // Deliver a pre-wait response after clear and after the avatar has unmounted.
 holdStatus=row=>new Promise(resolve=>{releaseStatus=()=>resolve([row,betaOffice])})
 releaseStatus=null
 await React.act(async()=>{pendingStatus=client.refetchQueries({queryKey:['sessioncrew','status'],type:'active'})})
 await until(()=>releaseStatus)
 await waitForInput();await clearInput();await setVisible(false)
 holdStatus=null
 await React.act(async()=>{releaseStatus();await pendingStatus})
 await setVisible(true)
 const afterLateReply=rail()
 assert.deepEqual({afterRemount,afterLateReply},{afterRemount:fenced,afterLateReply:fenced},'visibility must not revive cached or late pre-wait idle timers or rank, or change unread')
 await refresh('status');await until(()=>timer()==='0h1m');assert.deepEqual(rail(),confirmed,'later request with unchanged idle origin restores timer and rank after a late reply')

 // A request at the same clock tick cannot clear the fence until scope changes.
 const wallClock=Date.now;const tick=wallClock();try{
  Date.now=()=>tick
  await waitForInput();await clearInput();await refresh('status')
  assert.deepEqual(rail(),fenced,'a request started at the invalidation time is not newer')
  await React.act(async()=>epoch.set(3))
  await until(()=>timer()==='0h1m'&&rail().unread.every(Boolean))
  assert.deepEqual(rail(),confirmed,'a new activation scope does not inherit the prior idle fence')
 }finally{Date.now=wallClock}
 console.log('PASS visibility retains owner idle fences for cached and late samples without changing unread or sibling state; newer requests and scope reset restore the original timer and rank')
}finally{await React.act(async()=>root.unmount());client.clear()}
