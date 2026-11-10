// Public SDK boundary: UI intent versus SDK scheduled/focus refetch callbacks.
import {createPopoverFixture} from './popover-fixture.mjs'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
const require=createRequire(process.env.HERMES_CHECKOUT+'/package.json')
const React=require('react'),{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom'),jsx=require('react/jsx-runtime')
const {useQuery,QueryClient,QueryClientProvider}=require('@tanstack/react-query')
const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'})
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
const route={connectionId:'c',mode:'remote',profile:'alpha',targetProfile:'different-backend'},atom=v=>({get:()=>v})
let calls=[],queries=new Map(),failList=false,legacy=false,opens=[]
const host={state:{connectionId:atom('c'),profile:atom('alpha')},profiles:{list:async()=>({profiles:[{name:'alpha'}]})},profileRoutes:async()=>[route],request:async()=>{throw Error('must not fall back to active owner')},openSession:async(...args)=>opens.push(args),requestProfile:async(...args)=>{
 calls.push(args);const [,method,params]=args
 if(method==='session.list'){
  if(failList)throw Error('fixture unavailable')
  if(legacy&&params.scope)throw Error('invalid params for session.list: scope: Extra inputs are not permitted')
  return {sessions:params.scope==='live'?[]:[{id:'x',title:'Owner session'}],...(!legacy?{scope:params.scope}:{})}
 }
 if(method==='session.create')return {stored_session_id:'new'}
 return {projects:[]}
}}
const sdk={host,useValue:a=>a.get(),useQuery:o=>{queries.set(o.queryKey[1],o);return useQuery(o)},...createPopoverFixture(React)}
const mod=new SourceTextModule(await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8'))
await mod.link(async spec=>{const obj=spec==='@hermes/plugin-sdk'?sdk:spec==='react/jsx-runtime'?jsx:React;return new SyntheticModule(Object.keys(obj),function(){for(const [k,v] of Object.entries(obj))this.setExport(k,v)})});await mod.evaluate()
let contribution;mod.namespace.default.register({register:c=>contribution=c})
const client=new QueryClient(),root=createRoot(document.getElementById('root'))
async function until(fn){const end=Date.now()+1500;while(Date.now()<end){await React.act(async()=>{await new Promise(r=>setTimeout(r,5))});if(fn())return}throw Error('timeout '+document.body.textContent)}
function assertPriority(method,priority){const rows=calls.filter(c=>c[1]===method);assert.ok(rows.length);for(const c of rows){assert.deepEqual(c[0],route);assert.equal(c[4]?.spawnPriority,priority)}}
try{
 await React.act(async()=>root.render(React.createElement(QueryClientProvider,{client},contribution.render())))
 await until(()=>document.querySelector('button'))
 await React.act(async()=>document.querySelector('button').click())
 await until(()=>document.body.textContent.includes('Owner session'))
 assertPriority('session.list','foreground')
 const recent=queries.get('recent');assert.equal(recent.refetchInterval,15000);assert.equal(recent.refetchOnWindowFocus,true)
 calls=[];await recent.queryFn();assertPriority('session.list','background')
 calls=[];await recent.queryFn();assertPriority('session.list','background')
 // Legacy fallback must retain the poll's background priority as well.
 calls=[];legacy=true;await recent.queryFn();assertPriority('session.list','background');assert.equal(calls.filter(c=>c[1]==='session.list').length,2);legacy=false
 failList=true;await React.act(async()=>client.refetchQueries({queryKey:['profile-rail','recent']}))
 await until(()=>document.body.textContent.includes('fixture unavailable'))
 failList=false;calls=[]
 await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Retry').click())
 await until(()=>document.body.textContent.includes('Owner session'));assertPriority('session.list','foreground')
 calls=[];await queries.get('recent').queryFn();assertPriority('session.list','background')
 calls=[];await queries.get('projects').queryFn();assertPriority('projects.tree','background')
 calls=[];await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Quick create')).click())
 await until(()=>opens.length===1);assertPriority('session.create','foreground');assert.deepEqual(opens,[['new',{route,intent:'in-place'}]])
 console.log('PASS direct open/retry/create foreground; scheduled/focus/fallback reads background; exact owner route preserved')
}finally{await React.act(async()=>root.unmount());client.clear();dom.window.close()}
