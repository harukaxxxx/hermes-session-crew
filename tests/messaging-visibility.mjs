import {activityResponse} from './recent-activity-fixture.mjs'
import {createPopoverFixture} from './popover-fixture.mjs'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
const require=createRequire(process.env.HERMES_CHECKOUT+'/package.json'),React=require('react'),{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom'),jsx=require('react/jsx-runtime'),{useQuery,QueryClient,QueryClientProvider}=require('@tanstack/react-query')
const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
let value={'display-settings-v1':{hideOffline:false,showCron:true,hiddenProfiles:[]}},rows=[{id:'d',title:'Discord',source:'discord'},{id:'t',title:'Telegram',source:'telegram'},{id:'n',title:'Desktop',source:'desktop'},{id:'u',title:'Unknown',source:null}]
const atom=v=>({get:()=>v}),route={connectionId:'conn',mode:'remote',profile:'alpha',targetProfile:'alpha'}
const host={onEvent:()=>()=>{},openSession:async()=>{},state:{connectionId:atom('conn'),profile:atom('default'),gateway:atom('open')},profiles:{list:async()=>({profiles:[{name:'alpha'}]})},profileRoutes:async()=>[route],request:async()=>({}),requestProfile:async(r,m)=>m==='session.active_list'?{sessions:[]}:m==='session.list'?{sessions:rows}:m==='subagent.roster'?{sessions:[]}:{projects:[]}}
const storage={get:async k=>value[k],set:async(k,v)=>{value[k]=structuredClone(v)}},sdk={host,ackStoredSessionId:()=>{},useValue:a=>a.get(),useQuery,...createPopoverFixture(React)}
const mk=(id,source,seq)=>({seq,admission_id:id,session_id:id,session_source:source,status:'started',outcome:null,generation:1})
let snapshot={version:2,source_root:'default',source_id:'source1',server_epoch:'epoch1',profiles:[{profile:'alpha',status:'ok',database_id:'db1',high_water:5,truncated:false,rows:[mk('d','discord',1),mk('t','telegram',2),mk('n','desktop',3),mk('u',null,4),mk('o','oneshot',5)]}]}
const rest=async(p,opts)=>p==='/recent-activity'?activityResponse(opts):p==='/completion-snapshot'?structuredClone(snapshot):p==='/row-owners'?{owners:{},sources:{}}:{}
const mod=new SourceTextModule(await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8'));await mod.link(async spec=>{const obj=spec==='@hermes/plugin-sdk'?sdk:spec==='react/jsx-runtime'?jsx:React;return new SyntheticModule(Object.keys(obj),function(){for(const [k,v] of Object.entries(obj))this.setExport(k,v)})});await mod.evaluate()
let client,root
async function until(fn){const end=Date.now()+4000;while(Date.now()<end){await React.act(async()=>{await new Promise(r=>setTimeout(r,5))});if(fn())return}throw Error('timeout '+document.body.textContent)}
async function mount(){let rail,settings;mod.namespace.default.register({storage,rest,register:c=>rail=c,registerSettingsPage:c=>settings=c});client=new QueryClient({defaultOptions:{queries:{retry:false}}});root=createRoot(document.getElementById('root'));await React.act(async()=>root.render(React.createElement(QueryClientProvider,{client},React.createElement(React.Fragment,null,rail.render(),settings.render()))));await until(()=>value['completion-snapshot-v2']?.coverage&&toggle()&&!toggle().disabled)}
async function unmount(){await React.act(async()=>root.unmount());client.clear()}
const toggle=()=>document.querySelector('[aria-label="Hide messaging-platform sessions"]'),dot=()=>!!document.querySelector('[data-completion-badge]'),unread=()=>value['completion-snapshot-v2'].rows.filter(x=>!x.read),refresh=()=>React.act(async()=>client.refetchQueries({queryKey:['sessioncrew','completion-snapshot']})),click=async el=>React.act(async()=>el.click())
await mount();assert.equal(toggle().getAttribute('aria-checked'),'false');assert.equal(value['display-settings-v1'].hideMessaging,undefined,'legacy read does not write')
for(const r of snapshot.profiles[0].rows){r.status='terminal';r.outcome='completed'}await refresh();await until(()=>unread().length===5&&dot())
await click(document.querySelector('.profile-rail-hit'));await until(()=>document.querySelectorAll('[data-recent-row]').length===3);assert.match(document.body.textContent,/Discord/);assert.match(document.body.textContent,/Telegram/)
await click(toggle());await until(()=>value['display-settings-v1'].hideMessaging===true);await until(()=>!document.body.textContent.includes('Discord'));assert.ok(document.body.textContent.includes('Desktop'));assert.ok(document.body.textContent.includes('Unknown'));assert.equal(dot(),true,'desktop and unknown keep dot')
await unmount();await mount();assert.equal(toggle().getAttribute('aria-checked'),'true');assert.equal(unread().length,5);assert.equal(dot(),true)
// Acknowledge visible desktop and unknown through their explicit opens.
for(const title of ['Desktop','Unknown']){await click(document.querySelector('.profile-rail-hit'));await until(()=>[...document.querySelectorAll('[data-recent-row]')].some(x=>x.textContent.includes(title)));await click([...document.querySelectorAll('[data-recent-row]')].find(x=>x.textContent.includes(title)));await until(()=>!unread().some(x=>x.session===(title==='Desktop'?'n':'u')))}
assert.equal(dot(),false,'only hidden messaging and oneshot remain unread');assert.equal(unread().length,3)
await click(toggle());await until(dot);assert.equal(unread().length,3,'showing does not clear unread');await unmount();await mount();assert.equal(toggle().getAttribute('aria-checked'),'false');assert.equal(dot(),true)
await click(toggle());await until(()=>!dot());await unmount();await mount();assert.equal(toggle().getAttribute('aria-checked'),'true');assert.equal(dot(),false);assert.equal(unread().length,3)
await unmount()
// Exercise every explicitly supported source through both the recent list and
// completion ledger, independently, rather than just the classifier.
const sources=['telegram','discord','whatsapp','whatsapp_cloud','slack','signal','mattermost','matrix','email','sms','dingtalk','feishu','wecom','wecom_callback','weixin','bluebubbles','qqbot','yuanbao','line','google_chat','teams','irc','simplex']
for(const source of sources){
 value={'display-settings-v1':{hideOffline:false,showCron:true,hideMessaging:true,hiddenProfiles:[]}}
 rows=[{id:'platform',title:'Platform session',source}]
 snapshot={version:2,source_root:'default',source_id:'source1',server_epoch:'epoch1',profiles:[{profile:'alpha',status:'ok',database_id:'db1',high_water:1,truncated:false,rows:[mk('platform',source,1)]}]}
 await mount();snapshot.profiles[0].rows[0].status='terminal';snapshot.profiles[0].rows[0].outcome='completed';await refresh();await until(()=>unread().length===1)
 assert.equal(dot(),false,source+' hidden avatar unread')
 await click(document.querySelector('.profile-rail-hit'));await until(()=>client.getQueryCache().findAll({queryKey:['sessioncrew','recent']}).some(q=>q.state.status==='success'))
 assert.equal(document.body.textContent.includes('Platform session'),false,source+' hidden row')
 await click(toggle());await until(()=>value['display-settings-v1'].hideMessaging===false&&dot());await until(()=>document.body.textContent.includes('Platform session'))
 assert.equal(unread().length,1,source+' unread preserved');await unmount();await mount();assert.equal(toggle().getAttribute('aria-checked'),'false',source+' persistence');assert.equal(dot(),true,source+' visible avatar unread');await unmount()
}
// Canonical live/stored conflicts must survive filtering in both directions,
// including cron and absent evidence.
for(const [live,stored] of [['discord','desktop'],['desktop','discord'],['cron','desktop'],['desktop','cron'],['discord',null],[null,'discord']]){
 value={'display-settings-v1':{hideOffline:false,showCron:false,hideMessaging:true,hiddenProfiles:[]}}
 snapshot={version:2,source_root:'default',source_id:'source1',server_epoch:'epoch1',profiles:[{profile:'alpha',status:'ok',database_id:'db1',high_water:0,truncated:false,rows:[]}]}
 host.requestProfile=async(r,m,p)=>m==='session.active_list'?{sessions:[]}:m==='session.list'?{scope:p.scope,sessions:[{id:'conflict',title:'Conflicting session',source:p.scope==='live'?live:stored}]}:m==='subagent.roster'?{sessions:[]}:{projects:[]}
 await mount();await click(document.querySelector('.profile-rail-hit'));await until(()=>document.body.textContent.includes('Conflicting session'));assert.equal(document.querySelectorAll('[data-recent-row]').length,1,`${live}/${stored}`);await unmount()
}
console.log('PASS messaging visibility, unread, persistence, source conflicts and oneshot')
