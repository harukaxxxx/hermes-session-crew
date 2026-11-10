import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
const require=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT)+'/package.json')
const React=require('react'),{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom'),jsx=require('react/jsx-runtime'),{useQuery,QueryClient,QueryClientProvider}=require('@tanstack/react-query')
const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
const atom=value=>({get:()=>value}),host={state:{connectionId:atom('c'),profile:atom('alpha')},profiles:{list:async()=>({profiles:[{name:'alpha'},{name:'beta'},{name:'new'}]})},requestProfile:async(route,method)=>method==='session.list'?{sessions:[{id:'one',title:'cron-like title',source:'desktop'},{id:'two',title:'Scheduled',source:'cron'},{id:'three',title:'Unknown source'}]}:{projects:[]}}
const sdk={host,useValue:a=>a.get(),useQuery,Popover:()=>null,PopoverContent:()=>null,PopoverTrigger:()=>null},source=await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8')
const mod=new SourceTextModule(source+'\nexport {createPreferences,Settings,Recent,officeStatus,recentData,profileVisible};');await mod.link(async spec=>{const obj=spec==='@hermes/plugin-sdk'?sdk:spec==='react/jsx-runtime'?jsx:React;return new SyntheticModule(Object.keys(obj),function(){for(const [k,v] of Object.entries(obj))this.setExport(k,v)})});await mod.evaluate()
const {createPreferences,Settings,Recent,officeStatus,recentData,profileVisible}=mod.namespace
assert.equal(officeStatus(undefined),'unknown');assert.equal(officeStatus({online:false}),'offline')
assert.equal(profileVisible({name:'x',status:'unknown'},{hideOffline:true,hiddenProfiles:[]}),true);assert.equal(profileVisible({name:'x',status:'offline'},{hideOffline:true,hiddenProfiles:[]}),false);assert.equal(profileVisible({name:'x',status:'working'},{hideOffline:false,hiddenProfiles:['x']}),false)
const owner={name:'alpha',connectionId:'c',route:{}};const rows=(await recentData(owner)).rows;assert.deepEqual(rows.map(x=>x.source),['desktop','cron',null])
let saved;const storage={get:async()=>saved,set:async(k,v)=>{saved=structuredClone(v)}};let prefs=createPreferences(storage)
const client=new QueryClient({defaultOptions:{queries:{retry:false}}}),root=createRoot(document.getElementById('root'))
const completion={watermark:()=>[],coverageReady:false,ackAll:()=>{}}
const render=()=>React.createElement(QueryClientProvider,{client},React.createElement(React.Fragment,null,React.createElement(Settings,{preferences:prefs}),React.createElement(Recent,{owner,completion,settings:prefs.get()})))
async function update(){await React.act(async()=>{root.render(render());await new Promise(r=>setTimeout(r,30))})}
async function wait(fn){for(let i=0;i<30&&!fn();i++)await React.act(async()=>new Promise(r=>setTimeout(r,10)));assert.ok(fn())}
await update();await wait(()=>document.body.textContent.includes('Scheduled')&&document.body.textContent.includes('beta'))
assert.equal(prefs.get().hideOffline,false);assert.equal(prefs.get().showCron,true);assert.deepEqual(prefs.get().hiddenProfiles,[])
async function change(label){const el=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')===label||x.textContent===label);assert.ok(el,label);assert.ok(el.getAttribute('role')==='switch'||el.hasAttribute('aria-pressed'),label+' exposes state');await React.act(async()=>{el.click();await new Promise(r=>setTimeout(r,10))});await update()}
await change('顯示 Cron 工作階段');assert.doesNotMatch(document.body.textContent,/Scheduled/);assert.match(document.body.textContent,/cron-like title/);assert.match(document.body.textContent,/Unknown source/)
await change('beta');await change('隱藏離線設定檔');assert.deepEqual(saved,{hideOffline:true,showCron:false,hiddenProfiles:['beta']})
prefs=createPreferences(storage);await update();await wait(()=>prefs.get().ready);assert.deepEqual(prefs.get().hiddenProfiles,['beta']);assert.equal(prefs.get().showCron,false);assert.ok(!prefs.get().hiddenProfiles.includes('new'))
await change('顯示 Cron 工作階段');assert.match(document.body.textContent,/Scheduled/)
await React.act(async()=>root.unmount());client.clear();console.log('PASS display settings, durable reload, conservative cron source filtering and unknown/offline')
