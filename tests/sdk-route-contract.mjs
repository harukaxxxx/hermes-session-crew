import {activityResponse} from './recent-activity-fixture.mjs'
// Plugin contract, not a test of a locally patched gateway's argument shape.
// Official-host compatibility is a separate, mandatory gate: sdk-upstream-baseline.mjs.
import {createPopoverFixture} from './popover-fixture.mjs'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
const require=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT)+'/package.json')
const React=require('react'),{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom'),jsx=require('react/jsx-runtime'),{useQuery,QueryClient,QueryClientProvider}=require('@tanstack/react-query')
const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'})
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
const descriptor={connectionId:'c',mode:'remote',profile:'alpha',targetProfile:'different-backend'}
const atom=v=>({get:()=>v})
async function scenario(routes,valid){
 const calls=[],opens=[]
 const host={state:{connectionId:atom('c'),profile:atom('alpha')},profiles:{list:async()=>({profiles:[{name:'alpha'}]})},profileRoutes:async()=>routes,
  request:async()=>{throw Error('owner routing must not fall back to active gateway')},
  requestProfile:async(...args)=>{calls.push(args);return args[1]==='session.list'?{sessions:[{id:'x',title:'SDK routed'}]}:{projects:[]}},
  openSession:async(...args)=>opens.push(args)}
 const sdk={host,useValue:a=>a.get(),useQuery,...createPopoverFixture(React)}
 const mod=new SourceTextModule(await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8'))
 await mod.link(async spec=>{const obj=spec==='@hermes/plugin-sdk'?sdk:spec==='react/jsx-runtime'?jsx:React;return new SyntheticModule(Object.keys(obj),function(){for(const [k,v] of Object.entries(obj))this.setExport(k,v)})});await mod.evaluate()
 let contribution;mod.namespace.default.register({rest:async(path,opts)=>path==='/recent-activity'?activityResponse(opts):Promise.reject(Error('fixture unavailable')),register:c=>contribution=c})
 const client=new QueryClient(),root=createRoot(document.getElementById('root'))
 async function until(fn){const end=Date.now()+1500;while(Date.now()<end){await React.act(async()=>{await new Promise(r=>setTimeout(r,5))});if(fn())return}throw Error('timeout '+document.body.textContent)}
 try{
  await React.act(async()=>root.render(React.createElement(QueryClientProvider,{client},contribution.render())))
  await until(()=>document.querySelector('button'))
  await React.act(async()=>document.querySelector('button').click())
  if(valid){
   await until(()=>document.body.textContent.includes('SDK routed'))
   assert.deepEqual(calls.find(c=>c[1]==='session.list'),[descriptor,'session.list',{limit:200,scope:'stored'},30000,{spawnPriority:'foreground'}])
   assert.ok(calls.some(c=>c[1]==='projects.tree'))
   for(const call of calls)assert.deepEqual(call[0],descriptor,'complete targetProfile/connection/mode must reach public SDK unchanged')
   await React.act(async()=>document.querySelector('[data-recent-row]').click())
   assert.deepEqual(opens,[['x',{route:descriptor,intent:'in-place'}]])
  }else{
   await until(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Retry'))
   assert.deepEqual(calls,[],'ambiguous/incomplete owner must never reach SDK')
   assert.deepEqual(opens,[])
  }
 }finally{await React.act(async()=>root.unmount());client.clear()}
}
await scenario([{...descriptor,connectionId:'other',targetProfile:'wrong'},descriptor],true)
await scenario([{connectionId:'c',profile:'alpha',mode:'remote'}],false)
await scenario([descriptor,{...descriptor,targetProfile:'conflicting-owner'}],false)
dom.window.close()
console.log('PASS public requestProfile/openSession exact descriptor; missing/ambiguous routes fail closed. Mock boundary only, NOT upstream transport certification.')
