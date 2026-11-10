import {createPopoverFixture} from './popover-fixture.mjs'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
const require=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())+'/package.json'),React=require('react'),{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom'),jsx=require('react/jsx-runtime'),{useQuery,QueryClient,QueryClientProvider}=require('@tanstack/react-query')
const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
const route={connectionId:'fixture',mode:'remote',profile:'beta',targetProfile:'backend-beta'},atom=v=>({get:()=>v,subscribe:()=>()=>{}});let calls=[],activations=0
const host={state:{connectionId:atom('fixture'),profile:atom('alpha')},profiles:{list:async()=>({profiles:[{name:'beta'}]})},profileRoutes:async()=>[route],request:async()=>({}),requestProfile:async(r,m)=>{calls.push([r,m]);return m==='session.list'?{sessions:[{id:'s',title:'Session'}]}:{projects:[{id:'unrelated',label:'Unrelated',path:'/other',sessionIds:[],repos:[]}]}},ensureAgent:()=>activations++}
const tag=t=>({children,...props})=>React.createElement(t,props,children)
const sdk={host,useValue:a=>a.get(),useQuery,...createPopoverFixture(React),Dialog:({open,children})=>open?children:null,DialogContent:tag('section'),DialogHeader:tag('header'),DialogTitle:tag('h2'),DialogDescription:tag('p'),DialogFooter:tag('footer'),Input:tag('input'),Textarea:tag('textarea'),Button:tag('button'),Codicon:()=>null}
const mod=new SourceTextModule(await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8'));await mod.link(async spec=>{const obj=spec==='@hermes/plugin-sdk'?sdk:spec==='react/jsx-runtime'?jsx:React;return new SyntheticModule(Object.keys(obj),function(){for(const [k,v] of Object.entries(obj))this.setExport(k,v)})});await mod.evaluate();let contribution;mod.namespace.default.register({register:c=>contribution=c});const client=new QueryClient({defaultOptions:{queries:{retry:false}}}),root=createRoot(document.getElementById('root'))
async function until(fn){const end=Date.now()+2500;while(Date.now()<end){await React.act(async()=>{await new Promise(r=>setTimeout(r,5))});if(fn())return}throw Error('timeout '+document.body.textContent)}
await React.act(async()=>root.render(React.createElement(QueryClientProvider,{client},contribution.render())));await until(()=>document.querySelector('button'));await React.act(async()=>document.querySelector('button').click());await until(()=>document.body.textContent.includes('Session'));await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Open project')).click());await until(()=>document.querySelector('button[aria-label="New project"]'))
const add=document.querySelector('button[aria-label="New project"]');assert.equal(add.disabled,false,'public plugin dialog is available')
let dialogCalls=0;host.openProjectDialog=async()=>{dialogCalls++;throw Error('local extension must not be called')}
await React.act(async()=>{root.render(React.createElement(QueryClientProvider,{client},contribution.render()))})
assert.equal(add.disabled,false,'local extension does not change availability')
await React.act(async()=>add.click());assert.equal(dialogCalls,0)
assert.match(document.body.textContent,/New project \(Beta\)/);assert.doesNotMatch(document.body.textContent,/Unrelated/);assert.equal(activations,0);assert.ok(document.body.textContent.includes('Session'),'selection remains open');assert.ok(calls.filter(x=>x[1]==='projects.tree').every(x=>x[0]===route),'project reads remain owner-routed')
await React.act(async()=>root.unmount());client.clear();console.log('PASS owner dialog Rail handler')
