import {createPopoverFixture} from './popover-fixture.mjs'
import {readFile} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
const home=(process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())
const require=createRequire(home+'/package.json'),React=require('react'),{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom'),jsx=require('react/jsx-runtime'),{useQuery,QueryClient,QueryClientProvider}=require('@tanstack/react-query')
const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
const script=`from gateway.session_settlement_recovery import completion_payload\nfrom gateway.session_events import SessionEvents\nimport json\nx=SessionEvents()\nx.observers.add(lambda frame: print(json.dumps(frame['params'])))\nx.publish('s-one',completion_payload({'admission_id':'turn-one'},{'outcome':'completed'},'',{}),execution={'authority_epoch':1,'execution_generation':1,'admission_id':'turn-one'})`
const actual=JSON.parse(execFileSync(home+'/.venv/bin/python',['-c',`import os\ndef forbid(*a, **k): raise AssertionError('process probe forbidden')\nos.kill=forbid\nimport psutil\npsutil.Process=forbid\npsutil.pid_exists=forbid\n`+script],{cwd:home,encoding:'utf8'}))
assert.equal(actual.type,'message.complete');assert.equal(actual.payload.status,'complete');assert.equal(actual.payload.outcome,'completed');assert.ok(actual.replay_epoch);assert.ok(actual.seq)
let value={},events=new Map(),disposals=0,opens=[],acks=[];const atom=v=>({get:()=>v}),route={connectionId:'conn',mode:'remote',profile:'alpha',targetProfile:'alpha'}
const host={onEvent:(type,fn)=>{events.set(type,fn);return()=>{events.delete(type);disposals++}},openSession:async(...args)=>opens.push(args),state:{connectionId:atom('conn'),profile:atom('alpha')},profiles:{list:async()=>({profiles:[{name:'alpha'}]})},profileRoutes:async()=>[route],request:async()=>({}),requestProfile:async(_r,method)=>method==='session.list'?{sessions:[{id:'s-one',title:'one'},{id:'s-two',title:'two'}]}:{projects:[]}}
const storage={get:async key=>value[key],set:async(key,val)=>{value[key]=structuredClone(val)}}
const sdk={host,ackStoredSessionId:(...a)=>acks.push(a),useValue:a=>a.get(),useQuery,...createPopoverFixture(React)}
const mod=new SourceTextModule(await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8'));await mod.link(async spec=>{const obj=spec==='@hermes/plugin-sdk'?sdk:spec==='react/jsx-runtime'?jsx:React;return new SyntheticModule(Object.keys(obj),function(){for(const [k,v] of Object.entries(obj))this.setExport(k,v)})});await mod.evaluate();let contribution;mod.namespace.default.register({storage,register:c=>contribution=c});const client=new QueryClient(),root=createRoot(document.getElementById('root'))
async function until(fn){const end=Date.now()+2000;while(Date.now()<end){await React.act(async()=>{await new Promise(r=>setTimeout(r,5))});if(fn())return}throw Error('timeout '+document.body.textContent)}
async function send(event){await React.act(async()=>{const f=events.get(event.type)||events.get('*');if(f)f(event);await Promise.resolve()})}
assert.equal(typeof mod.namespace.AvatarLayers,'function','avatar layer contract available for controlled fixture')
await React.act(async()=>root.render(React.createElement(QueryClientProvider,{client},contribution.render())));await until(()=>document.querySelector('.profile-rail-hit'));assert.equal(document.querySelector('[data-completion-badge]'),null)
await send({...actual,connectionId:'conn',profile:'alpha'});
await React.act(async()=>{await new Promise(r=>setTimeout(r,30))});
assert.equal(Boolean(document.querySelector('[data-completion-badge]')),false,'unmarked old catch-up event without trustworthy baseline must not light badge');
await React.act(async()=>root.unmount());client.clear();console.log('PASS unmarked catch-up quarantined');
