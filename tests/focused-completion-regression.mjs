// Desired behaviour regression: a completion already visible in the focused chat
// should not remain unread. Run with node --experimental-vm-modules.
import {createPopoverFixture} from './popover-fixture.mjs'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
const home=(process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())
const require=createRequire(home+'/package.json'),React=require('react'),{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom'),jsx=require('react/jsx-runtime'),{useQuery,QueryClient,QueryClientProvider}=require('@tanstack/react-query')
const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
const atom=value=>{const listeners=new Set();return {get:()=>value,set:v=>{value=v;listeners.forEach(f=>f())},subscribe:f=>{listeners.add(f);return()=>listeners.delete(f)}}}
const focusId=atom('same'),focusOwner=atom({connectionId:'conn',profile:'alpha'})
const host={state:{connectionId:atom('conn'),profile:atom('default'),focusedStoredSessionId:focusId,focusedSessionOwner:focusOwner},profiles:{list:async()=>({profiles:[{name:'alpha'}]})},profileRoutes:async()=>[{connectionId:'conn',mode:'remote',profile:'alpha',targetProfile:'alpha'}],request:async()=>({}),requestProfile:async()=>({sessions:[],projects:[]})}
const sdk={host,useValue:a=>React.useSyncExternalStore(a.subscribe,a.get,a.get),useQuery,...createPopoverFixture(React)}
let saved={};const storage={get:async k=>saved[k],set:async(k,v)=>{saved[k]=structuredClone(v)}}
let status='started',extra=[];const snapshot=()=>({version:2,source_root:'default',source_id:'source',server_epoch:'epoch',profiles:[{profile:'alpha',status:'ok',database_id:'db',high_water:1+extra.length,truncated:false,rows:[{seq:1,admission_id:'turn',session_id:'same',status,outcome:status==='terminal'?'completed':null,generation:1},...extra]}]})
const rest=async path=>path==='/status'?[]:snapshot()
const mod=new SourceTextModule(await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8'));await mod.link(async spec=>{const o=spec==='@hermes/plugin-sdk'?sdk:spec==='react/jsx-runtime'?jsx:React;return new SyntheticModule(Object.keys(o),function(){for(const [k,v] of Object.entries(o))this.setExport(k,v)})});await mod.evaluate()
let contribution;mod.namespace.default.register({storage,rest,register:x=>contribution=x});const client=new QueryClient({defaultOptions:{queries:{retry:false}}}),root=createRoot(document.getElementById('root'))
async function until(fn){const end=Date.now()+3000;while(Date.now()<end){await React.act(async()=>{await new Promise(r=>setTimeout(r,5))});if(fn())return}throw Error('fixture timed out')}
try{
 await React.act(async()=>root.render(React.createElement(QueryClientProvider,{client},contribution.render())))
 await until(()=>saved['completion-snapshot-v2']?.coverage)
 status='terminal';await React.act(async()=>client.refetchQueries({queryKey:['profile-rail','completion-snapshot']}))
 await until(()=>saved['completion-snapshot-v2']?.rows.length===1)
 assert.equal(Boolean(document.querySelector('[data-completion-badge]')),false,'already focused session completion must not remain unread')
 console.log('PASS focused completion acknowledged')
 await React.act(async()=>{focusOwner.set({connectionId:'other',profile:'alpha'})})
 extra=[{seq:2,admission_id:'second',session_id:'same',status:'terminal',outcome:'completed',generation:1}]
 await React.act(async()=>client.refetchQueries({queryKey:['profile-rail','completion-snapshot']}))
 await until(()=>saved['completion-snapshot-v2']?.rows.length===2)
 assert.equal(saved['completion-snapshot-v2'].rows.find(x=>JSON.parse(x.key)[4]==='second').read,false,'different connection must not acknowledge')
 await React.act(async()=>{focusOwner.set({connectionId:'conn',profile:'other'})})
 assert.equal(saved['completion-snapshot-v2'].rows.find(x=>JSON.parse(x.key)[4]==='second').read,false,'different owner must not acknowledge')
 await React.act(async()=>{focusOwner.set({connectionId:'conn',profile:'alpha'})})
 await until(()=>saved['completion-snapshot-v2'].rows.find(x=>JSON.parse(x.key)[4]==='second').read)
 assert.equal(Boolean(document.querySelector('[data-completion-badge]')),false,'focus transition acknowledges only matching session')
 console.log('PASS owner isolation and focus transition')
} finally {await React.act(async()=>root.unmount());client.clear()}
