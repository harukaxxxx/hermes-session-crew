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
const host={state:{gateway:atom('open'),connectionId:atom(connectionId),profile:atom(profile)},profiles:{list:async()=>({profiles:names.map(name=>({name}))})},profileRoutes:async()=>[],request:async()=>({found:false}),onEvent:(type,fn)=>{assert.equal(type,'gateway.ready');listeners.add(fn);return()=>listeners.delete(fn)}}
const sdk={host,useValue:a=>a.get(),useQuery,...createPopoverFixture(React)}
const mod=new SourceTextModule(await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8'))
await mod.link(spec=>{const o=spec==='@hermes/plugin-sdk'?sdk:spec==='react'?React:jsx;return new SyntheticModule(Object.keys(o),function(){for(const [k,v] of Object.entries(o))this.setExport(k,v)})});await mod.evaluate()
const mixed=[{profile:'alpha',online:true,state:'online_unobserved',busy:null,idle_since:null,status_observation:'fresh_shared_gateway_no_observed_owner_work',shared_gateway_observation:'positive'},{profile:'beta',online:true,state:'working',busy:true}]
const expected=['working','online_unobserved'],unknown=['unknown','unknown']
let contribution,canRead=process.argv[2]==='cache',reads=0,held
const rest=async path=>{if(path!=='/status')throw Error('other fixture route unavailable');reads++;if(!canRead)throw Error('REST not ready yet');if(held)await held;return structuredClone(mixed)}
mod.namespace.default.register({rest,register:x=>contribution=x})
// Match Desktop's QueryClient staleTime. Keep polling out of this immediate
// recovery check: QueryClient is imported before the DOM (server timer mode).
const client=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false,staleTime:60000}}}),root=createRoot(document.getElementById('root'))
const render=child=>React.act(async()=>root.render(child)),mount=()=>render(React.createElement(QueryClientProvider,{client},contribution.render()))
const states=()=>[...document.querySelectorAll('.profile-rail-hit')].map(node=>node.dataset.stateName)
const tick=()=>React.act(async()=>{await new Promise(resolve=>setTimeout(resolve,10))})
async function until(wanted){for(let i=0;i<30;i++){await tick();if(JSON.stringify(states())===JSON.stringify(wanted))break}assert.deepEqual(states(),wanted)}
const ready=overrides=>React.act(async()=>{for(const fn of listeners)fn({type:'gateway.ready',...(connectionId?{connectionId}:{}),profile,...overrides})})
try{
 if(process.argv[2]==='cache'){
  await mount();await until(expected);await render(null)
  const status=client.getQueryCache().find({queryKey:['sessioncrew','status'],exact:false})
  client.setQueryData(status.queryKey,status.state.data,{updatedAt:Date.now()-16000})
  await mount();await until(expected)
  assert.equal(reads,2,'an expired but host-cache-fresh sample is fetched on remount without opening a chat')
 }else{
  await mount();await until(unknown);assert.equal(reads,1,'initial REST read fails')
  canRead=true;await ready({connectionId:'other'});await ready({profile:'another'});await tick();assert.equal(reads,1,'unrelated ready events do not poll the active rail')
  let release;held=new Promise(resolve=>{release=resolve})
  await ready();await ready();await tick();const afterReady=reads
  await React.act(async()=>release());await until(expected)
  assert.equal(afterReady,2,'same-scope ready recovers without chat or polling and deduplicates in-flight reads')
  await ready();await tick();assert.equal(reads,2,'healthy status does not re-fetch on later ready events')
 }
 console.log('PASS',process.argv[2]==='cache'?'expired cache refreshes on remount':'matching gateway ready recovers an initial status failure')
}finally{await React.act(async()=>root.unmount());client.clear()}