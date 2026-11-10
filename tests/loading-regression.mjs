import {createPopoverFixture} from './popover-fixture.mjs'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
const require=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())+'/package.json')
const React=require('react'),{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom'),jsx=require('react/jsx-runtime'),{useQuery,QueryClient,QueryClientProvider}=require('@tanstack/react-query')
const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
const state={connectionId:'c',profile:'alpha'};const atom=k=>({get:()=>state[k]});let calls=[],handler,routesHandler,treeResolves=[]
const descriptors=['alpha','beta'].map(profile=>({connectionId:'c',mode:'remote',profile,targetProfile:'backend-'+profile}))
const host={state:{connectionId:atom('connectionId'),profile:atom('profile')},profiles:{list:async()=>({profiles:[{name:'alpha'},{name:'beta'}]})},profileRoutes:()=>routesHandler(),request:async()=>({}),requestProfile:(...args)=>{calls.push(args);return handler(...args)}}
const sdk={host,useValue:a=>a.get(),useQuery,...createPopoverFixture(React)}
const mod=new SourceTextModule(await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8'));await mod.link(async spec=>{const obj=spec==='@hermes/plugin-sdk'?sdk:spec==='react/jsx-runtime'?jsx:React;return new SyntheticModule(Object.keys(obj),function(){for(const [k,v] of Object.entries(obj))this.setExport(k,v)})});await mod.evaluate();let contribution;mod.namespace.default.register({register:c=>contribution=c})
const client=new QueryClient({defaultOptions:{queries:{retry:false}}}),root=createRoot(document.getElementById('root'))
async function until(predicate,description){const end=Date.now()+1500;while(Date.now()<end){await React.act(async()=>{await new Promise(r=>setTimeout(r,5))});if(predicate())return}throw Error('timeout: '+description+'; DOM='+document.body.textContent)}
async function click(text){const button=[...document.querySelectorAll('button')].find(x=>x.textContent===text||x.getAttribute('aria-label')?.startsWith(text));assert.ok(button,text);await React.act(async()=>button.click())}
routesHandler=async()=>descriptors
handler=async(route,method)=>method==='session.list'?{sessions:[{id:'1',title:route.profile+' session'}]}:new Promise(r=>treeResolves.push(r))
await React.act(async()=>root.render(React.createElement(QueryClientProvider,{client},contribution.render())))
await until(()=>document.querySelectorAll('.profile-rail-hit').length===2,'roster');await click('Alpha');await until(()=>document.body.textContent.includes('alpha session'),'sessions despite pending projects')
assert.match(document.body.textContent,/Loading projects/);assert.deepEqual(calls[0][0],descriptors[0]);assert.equal(calls[0][3],30000);assert.deepEqual(calls[0][4],{spawnPriority:'foreground'})
await click('Beta');await until(()=>document.body.textContent.includes('beta session'),'owner switch');assert.doesNotMatch(document.body.textContent,/alpha session/);assert.ok(calls.some(c=>c[0]===descriptors[1]));treeResolves.forEach(resolve=>resolve({projects:[]}))
await React.act(async()=>root.unmount());client.clear()
console.log('PASS independent session/project queries, foreground complete owner route and switch')
