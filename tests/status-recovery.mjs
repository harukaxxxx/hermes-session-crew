import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
import {createPopoverFixture} from './popover-fixture.mjs'

const require=createRequire(process.env.HERMES_CHECKOUT+'/package.json')
const React=require('react'),{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom'),jsx=require('react/jsx-runtime'),{QueryClient,QueryClientProvider,useQuery}=require('@tanstack/react-query')
globalThis.window=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'}).window
globalThis.document=window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
const profile='default',connectionId=process.argv[2]==='legacy'?null:'conn',names=['alpha','beta'],listeners=new Set(),atom=value=>({get:()=>value,subscribe:()=>()=>{}})
const diagnosticMode=!process.argv[2],extra=['duplicate-first','duplicate-last','duplicate-valid','malformed','blank-online','blank-offline','bad-lease','missing','backend'],active=[]
const roster=diagnosticMode?[...names,...extra]:names
const host={state:{gateway:atom('open'),connectionId:atom(connectionId),profile:atom(profile)},profiles:{list:async()=>({profiles:roster.map(name=>({name}))})},profileRoutes:async()=>diagnosticMode?roster.map(name=>({connectionId,mode:'remote',profile:name,targetProfile:name})):[],request:async()=>({found:false}),requestProfile:async(route,method)=>({sessions:method==='session.active_list'&&route.profile==='malformed'?structuredClone(active):[]}),onEvent:(type,fn)=>{assert.equal(type,'gateway.ready');listeners.add(fn);return()=>listeners.delete(fn)}}
const sdk={host,useValue:a=>a.get(),useQuery,...createPopoverFixture(React)}
const mod=new SourceTextModule(await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8'))
await mod.link(spec=>{const o=spec==='@hermes/plugin-sdk'?sdk:spec==='react'?React:jsx;return new SyntheticModule(Object.keys(o),function(){for(const [k,v] of Object.entries(o))this.setExport(k,v)})});await mod.evaluate()
const mixed=[{profile:'alpha',online:true,state:'online_unobserved',busy:null,idle_since:null,status_observation:'fresh_shared_gateway_no_observed_owner_work',shared_gateway_observation:'positive'},{profile:'beta',online:true,state:'working',busy:true}]
const expected=['working','online_unobserved'],unknown=['unknown','unknown']
let contribution,canRead=process.argv[2]==='cache',reads=0,held,statusRows=mixed
const rest=async(path,opts)=>{
 if(path==='/row-owners')return {owners:Object.fromEntries(opts.body.ids.map(id=>[id,'malformed'])),sources:Object.fromEntries(opts.body.ids.map(id=>[id,'cli']))}
 if(path!=='/status')throw Error('other fixture route unavailable')
 reads++;if(held)await held;if(!canRead)throw Error('REST not ready yet');return structuredClone(statusRows)
}
const settings={hideOffline:false,showCron:false,developerMode:true,hiddenProfiles:[]}
mod.namespace.default.register({rest,storage:{get:async key=>key==='display-settings-v1'?settings:undefined,set:async()=>{}},register:x=>contribution=x})
// Match Desktop's QueryClient staleTime. Keep polling out of this immediate
// recovery check: QueryClient is imported before the DOM (server timer mode).
const client=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false,staleTime:60000}}}),root=createRoot(document.getElementById('root'))
const render=child=>React.act(async()=>root.render(child)),mount=()=>render(React.createElement(QueryClientProvider,{client},contribution.render()))
const avatars=()=>[...document.querySelectorAll('.profile-rail-hit')],nameOf=node=>node.getAttribute('aria-label').split(' · ')[0].toLowerCase().replaceAll(' ','-')
const avatar=name=>avatars().find(node=>nameOf(node)===name)
const states=()=>avatars().filter(node=>names.includes(nameOf(node))).map(node=>node.dataset.stateName)
const tick=()=>React.act(async()=>{await new Promise(resolve=>setTimeout(resolve,10))})
async function readyWhen(fn){for(let i=0;i<30;i++){await tick();if(fn())return}assert.ok(fn(),'fixture did not settle')}
async function until(wanted){await readyWhen(()=>JSON.stringify(states())===JSON.stringify(wanted))}
const ready=overrides=>React.act(async()=>{for(const fn of listeners)fn({type:'gateway.ready',...(connectionId?{connectionId}:{}),profile,...overrides})})
const query=()=>client.getQueryCache().find({queryKey:['sessioncrew','status'],exact:false})
const refresh=(key='status')=>React.act(async()=>{await client.refetchQueries({queryKey:['sessioncrew',key]});await new Promise(resolve=>setTimeout(resolve,10))})
const elapsed=name=>avatar(name)?.closest('[data-avatar-stack]').querySelector('[data-idle-minutes]')?.textContent??null
function diagnostic(name,state,reason){
 const node=avatar(name);assert.equal(node?.dataset.stateName,state,name)
 assert.match(node.title,reason,name+' tooltip')
 assert.match(node.getAttribute('aria-description')??'',reason,name+' accessible description')
}
try{
 if(process.argv[2]==='cache'){
  await mount();await until(expected);await render(null)
  const status=client.getQueryCache().find({queryKey:['sessioncrew','status'],exact:false})
  client.setQueryData(status.queryKey,status.state.data,{updatedAt:Date.now()-16000})
  await mount();await until(expected)
  assert.equal(reads,2,'an expired but host-cache-fresh sample is fetched on remount without opening a chat')
 }else{
  let rejectFirst
  if(diagnosticMode)held=new Promise(resolve=>{rejectFirst=resolve})
  await mount();await until(unknown)
  if(diagnosticMode)diagnostic('alpha','unknown',/waiting for the first status response/i)
  if(rejectFirst){held=null;await React.act(async()=>rejectFirst())}
  await readyWhen(()=>query().state.status==='error');await tick();assert.equal(reads,1,'initial REST read fails')
  if(diagnosticMode){
   diagnostic('alpha','unknown',/status request failed/i)
   assert.doesNotMatch(avatar('alpha').title,/last successful/i)
  }
  canRead=true;await ready({connectionId:'other'});await ready({profile:'another'});await tick();assert.equal(reads,1,'unrelated ready events do not poll the active rail')
  let release;held=new Promise(resolve=>{release=resolve})
  await ready();await ready();await tick();const afterReady=reads
  await React.act(async()=>release());await until(expected)
  assert.equal(afterReady,2,'same-scope ready recovers without chat or polling and deduplicates in-flight reads')
  await ready();await tick();assert.equal(reads,2,'healthy status does not re-fetch on later ready events')
 }
 if(diagnosticMode){
  held=null
  const since=Date.now()/1000-125, idle=profile=>({profile,online:true,state:'idle',idle_since:since}), shared=profile=>({...mixed[0],profile})
  statusRows=[...roster.map(idle)];await refresh();await readyWhen(()=>extra.every(name=>elapsed(name)==='0h2m'))
  statusRows=[shared('alpha'),mixed[1],null,{online:false,state:'working'},
   idle('duplicate-first'),{profile:'duplicate-first',online:'bad',state:'idle'},
   {profile:'duplicate-last',online:true,state:null},idle('duplicate-last'),
   idle('duplicate-valid'),shared('duplicate-valid'),
   {profile:'malformed',online:1,state:'working'},
   {profile:'blank-online',online:true,state:''},{profile:'blank-offline',online:false,state:'  '},
   {profile:'bad-lease',online:true,state:'unknown',active_turn:true,oneshot_activity:{observed_at:{valueOf:null,toString:null},expires_at:Date.now()/1000+10}},
   {profile:'backend',online:true,state:'unknown'}]
  await refresh();await until(expected)
  assert.equal(avatar('beta').dataset.stateName,'working','healthy sibling survives bad rows')
  assert.equal(elapsed('alpha'),'0h2m','healthy sibling retains its idle history')
  diagnostic('alpha','online_unobserved',/online.*no activity observed/i)
  for(const name of ['duplicate-first','duplicate-last','duplicate-valid'])diagnostic(name,'unknown',/duplicate status rows/i)
  diagnostic('malformed','unknown',/malformed status row/i)
  for(const name of ['blank-online','blank-offline'])diagnostic(name,'unknown',/malformed status row/i)
  diagnostic('bad-lease','unknown',/backend reported.*unknown/i)
  diagnostic('missing','unknown',/status response has no row/i)
  diagnostic('backend','unknown',/backend reported.*unknown/i)
  for(const name of extra)assert.equal(elapsed(name),null,`${name} hides stale idle`)

  active.push({id:'one',session_key:'one',source:'cli',status:'working'});await refresh('profile-input-waiting')
  await readyWhen(()=>avatar('malformed').dataset.stateName==='working')
  assert.doesNotMatch(avatar('malformed').title,/malformed status row/i,'fresh verified owner activity replaces the unknown presentation')
  active.length=0;await refresh('profile-input-waiting');await readyWhen(()=>avatar('malformed').dataset.stateName==='unknown')

  statusRows=[...roster.map(shared)];await refresh();await readyWhen(()=>extra.every(name=>avatar(name).dataset.stateName==='online_unobserved'))
  assert.equal(elapsed('alpha'),'0h2m')
  for(const name of extra)assert.equal(elapsed(name),null,`${name} cannot revive a stale start`)

  const lastSuccess=query().state.dataUpdatedAt
  statusRows={rows:[]};await refresh();await until(unknown)
  for(const name of roster)diagnostic(name,'unknown',/status request failed/i)
  assert.ok(avatar('alpha').title.includes(`Last successful status response: ${new Date(lastSuccess).toLocaleString()}`))
  statusRows=[...roster.map(shared)];await refresh();await readyWhen(()=>avatar('alpha').dataset.stateName==='online_unobserved')
  assert.equal(elapsed('alpha'),null,'whole-snapshot failure clears previously healthy historical idle')
  const status=query()
  await React.act(async()=>client.setQueryData(status.queryKey,status.state.data,{updatedAt:Date.now()-16000}));await until(unknown)
  diagnostic('alpha','unknown',/status response expired/i)
  assert.match(avatar('alpha').title,/last successful status response/i)
  statusRows=mixed;await refresh();await until(expected)
 }
 console.log('PASS',process.argv[2]==='cache'?'expired cache refreshes on remount':diagnosticMode?'status diagnostics, owner isolation, idle history and recovery':'matching gateway ready recovers an initial status failure')
}finally{await React.act(async()=>root.unmount());client.clear()}