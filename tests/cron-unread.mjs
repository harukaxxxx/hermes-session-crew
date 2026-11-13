import {activityResponse} from './recent-activity-fixture.mjs'
import {createPopoverFixture} from './popover-fixture.mjs'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
const require=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT)+'/package.json'),React=require('react'),{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom'),jsx=require('react/jsx-runtime'),{useQuery,QueryClient,QueryClientProvider}=require('@tanstack/react-query')
const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
let value={'display-settings-v1':{hideOffline:false,showCron:false,hiddenProfiles:[]}};const atom=v=>({get:()=>v}),route={connectionId:'conn',mode:'remote',profile:'alpha',targetProfile:'alpha'}
let routes=[route],active={};const connection=atom('conn'),gateway=atom('open')
const host={onEvent:()=>()=>{},openSession:async()=>{},state:{connectionId:connection,profile:atom('default'),gateway},profiles:{list:async()=>({profiles:routes.map(r=>({name:r.profile}))})},profileRoutes:async()=>routes,request:async()=>({}),requestProfile:async(r,m)=>m==='session.active_list'?{sessions:active[r.profile]||[]}:m==='session.list'?{sessions:[{id:'cron1',title:'cron',source:'cron'},{id:'normal1',title:'normal',source:'desktop'}]}:m==='subagent.roster'?{sessions:[]}:{projects:[]}}
const storage={get:async k=>value[k],set:async(k,v)=>{value[k]=structuredClone(v)}};const sdk={host,ackStoredSessionId:()=>{},useValue:a=>a.get(),useQuery,...createPopoverFixture(React)}
let snapshot={version:2,source_root:'default',source_id:'source1',server_epoch:'epoch1',profiles:[{profile:'alpha',status:'ok',database_id:'db1',high_water:2,truncated:false,rows:[{seq:1,admission_id:'c',session_id:'cron1',session_source:'cron',status:'started',outcome:null,generation:1},{seq:2,admission_id:'n',session_id:'normal1',session_source:'desktop',status:'started',outcome:null,generation:1}]}]};const rest=async(p,opts)=>p==='/recent-activity'?activityResponse(opts):p==='/completion-snapshot'?structuredClone(snapshot):p==='/row-owners'?{owners:Object.fromEntries(opts.body.ids.map(id=>[id,'alpha'])),sources:Object.fromEntries(opts.body.ids.map(id=>[id,'desktop']))}:{}
const mod=new SourceTextModule(await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8'));await mod.link(async spec=>{const obj=spec==='@hermes/plugin-sdk'?sdk:spec==='react/jsx-runtime'?jsx:React;return new SyntheticModule(Object.keys(obj),function(){for(const [k,v] of Object.entries(obj))this.setExport(k,v)})});await mod.evaluate();let rail,settings;mod.namespace.default.register({storage,rest,register:c=>rail=c,registerSettingsPage:c=>settings=c});let client=new QueryClient({defaultOptions:{queries:{retry:false}}}),root=createRoot(document.getElementById('root'))
async function until(fn){const end=Date.now()+4000;while(Date.now()<end){await React.act(async()=>{await new Promise(r=>setTimeout(r,5))});if(fn())return}throw Error('timeout '+document.body.textContent)}
const dot=()=>!!document.querySelector('[data-completion-badge]'),unread=()=>value['completion-snapshot-v2'].rows.filter(x=>!x.read),refetch=async()=>React.act(async()=>{await client.refetchQueries({queryKey:['sessioncrew','completion-snapshot']})}),mount=async()=>{await React.act(async()=>root.render(React.createElement(QueryClientProvider,{client},React.createElement(React.Fragment,null,rail.render(),settings.render()))));await until(()=>value['completion-snapshot-v2']?.coverage)}
await mount();snapshot.profiles[0].rows[0].status='terminal';snapshot.profiles[0].rows[0].outcome='completed';await refetch();await until(()=>unread().length===1);assert.equal(dot(),false,'cron-only unread hidden must not display a profile dot')
const toggle=()=>[...document.querySelectorAll('[role=switch]')].find(x=>x.getAttribute('aria-label').includes('Cron'));await React.act(async()=>toggle().click());await until(dot);await React.act(async()=>toggle().click());await until(()=>!dot());assert.equal(unread().length,1)
snapshot.profiles[0].rows[1].status='terminal';snapshot.profiles[0].rows[1].outcome='completed';await refetch();await until(()=>unread().length===2);assert.equal(dot(),true);await React.act(async()=>document.querySelector('.profile-rail-hit').click());await until(()=>document.querySelector('[data-recent-row]'));await React.act(async()=>document.querySelector('[data-recent-row]').click());await until(()=>unread().length===1);assert.equal(dot(),false);assert.equal(unread()[0].session,'cron1')
async function unmount(){await React.act(async()=>root.unmount());client.clear()}
async function remount(){client=new QueryClient({defaultOptions:{queries:{retry:false}}});root=createRoot(document.getElementById('root'));await mount();await until(()=>value['completion-snapshot-v2'].coverage)}
await unmount();await remount();assert.equal(dot(),false);await React.act(async()=>toggle().click());await until(dot);assert.equal(unread().length,1)
// Simulate a pre-upgrade ledger and coverage with no session source.
await React.act(async()=>toggle().click());await until(()=>!dot());await unmount();delete unread()[0].session_source;delete unread()[0].last_known_session_source;delete unread()[0].session_source_conflict;for(const r of value['completion-snapshot-v2'].coverage.profiles[0].rows)delete r.session_source
await remount();await until(()=>unread()[0].session_source==='cron');assert.equal(dot(),false);assert.equal(unread()[0].read,false)
// A source disagreement remains unknown, even after another poll.
snapshot.profiles[0].rows[0].session_source='desktop';await refetch();await until(()=>unread()[0].session_source_conflict===true);assert.equal(dot(),true);await refetch();assert.equal(unread()[0].session_source,null);assert.equal(dot(),true)
await unmount();await remount();await until(()=>unread()[0].session_source_conflict===true);assert.equal(dot(),true)
// Old backends cannot establish Cron identity; retain the unread dot.
await unmount();delete snapshot.profiles[0].rows[0].session_source;delete unread()[0].session_source;delete unread()[0].last_known_session_source;delete unread()[0].session_source_conflict;for(const r of value['completion-snapshot-v2'].coverage.profiles[0].rows)delete r.session_source
await remount();await until(()=>unread()[0].session_source===null);assert.equal(dot(),true);assert.equal(unread()[0].read,false)
await unmount()
// Fresh baseline: only a normal completion is unread while Cron is hidden.
value={'display-settings-v1':{hideOffline:false,showCron:false,hiddenProfiles:[]}}
const row=(id,source,admission)=>({seq:1,admission_id:admission,session_id:id,session_source:source,status:'started',outcome:null,generation:1})
const profile=(name,db,r)=>({profile:name,status:'ok',database_id:db,high_water:1,truncated:false,rows:[r]})
snapshot={version:2,source_root:'default',source_id:'source1',server_epoch:'epoch1',profiles:[profile('alpha','db1',row('normal1','desktop','same'))]}
await remount();snapshot.profiles[0].rows[0].status='terminal';snapshot.profiles[0].rows[0].outcome='completed';await refetch();await until(()=>unread().length===1&&dot());assert.equal(unread()[0].session_source,'desktop');assert.equal(dot(),true,'normal-only unread remains visible with Cron hidden')
await unmount()
// Same session and admission IDs in distinct owners must retain their own source.
value={'display-settings-v1':{hideOffline:false,showCron:false,hiddenProfiles:[]}};routes=[route,{...route,profile:'beta',targetProfile:'beta'}]
snapshot.profiles=[profile('alpha','db1',row('normal1','cron','same')),profile('beta','db-beta',row('normal1','desktop','same'))]
await remount();for(const p of snapshot.profiles){p.rows[0].status='terminal';p.rows[0].outcome='completed'}await refetch();await until(()=>unread().length===2&&document.querySelectorAll('.profile-rail-hit').length===2)
const badgeFor=i=>{const name=['Alpha','Beta'][i],hit=[...document.querySelectorAll('.profile-rail-hit')].find(x=>x.getAttribute('aria-label').startsWith(name+' ·'));assert.ok(hit,'profile exists: '+name);return !!hit.closest('[data-avatar-stack]').querySelector('[data-completion-badge]')}
await until(()=>badgeFor(1));assert.equal(badgeFor(0),false);assert.deepEqual(unread().map(x=>[x.owner,x.session_source]).sort(),[['alpha','cron'],['beta','desktop']]);await refetch();assert.deepEqual(unread().map(x=>[x.owner,x.session_source,x.session_source_conflict]).sort(),[['alpha','cron',false],['beta','desktop',false]])
// A replacement database with the same session/admission IDs rebaselines; its
// new normal completion must not inherit the old hidden Cron classification.
snapshot.profiles[0]=profile('alpha','db2',row('normal1','desktop','same'));await refetch();await until(()=>value['completion-snapshot-v2'].coverage.profiles.find(p=>p.owner==='alpha')?.database_id==='db2');assert.equal(badgeFor(0),false);assert.equal(badgeFor(1),true)
snapshot.profiles[0].rows[0].status='terminal';snapshot.profiles[0].rows[0].outcome='completed';await refetch();await until(()=>badgeFor(0));assert.equal(unread().find(x=>x.owner==='alpha').session_source,'desktop');assert.equal(badgeFor(1),true)
// Switch connection with an identical snapshot identity and IDs: old rows
// cannot light or classify the new connection, which starts as hidden Cron.
await unmount();connection.get=()=> 'conn2';routes=routes.map(r=>({...r,connectionId:'conn2'}));snapshot.profiles=[profile('alpha','db2',row('normal1','cron','same')),profile('beta','db-beta',row('normal1','desktop','same'))]
await remount();await until(()=>JSON.parse(value['completion-snapshot-v2'].coverage.source)[0]==='conn2');assert.equal(badgeFor(0),false);assert.equal(badgeFor(1),false)
snapshot.profiles[0].rows[0].status='terminal';snapshot.profiles[0].rows[0].outcome='completed';await refetch();await until(()=>unread().some(x=>x.connection==='"conn2"'&&x.owner==='alpha'));assert.equal(badgeFor(0),false);assert.equal(unread().find(x=>x.connection==='"conn2"'&&x.owner==='alpha').session_source,'cron');assert.equal(unread().find(x=>x.connection==='"conn"'&&x.owner==='alpha').session_source,'desktop')
snapshot.profiles[1].rows[0].status='terminal';snapshot.profiles[1].rows[0].outcome='completed';await refetch();await until(()=>badgeFor(1));assert.equal(badgeFor(0),false);assert.equal(unread().find(x=>x.connection==='"conn2"'&&x.owner==='beta').session_source,'desktop')
await unmount();connection.get=()=> 'conn';routes=routes.map(r=>({...r,connectionId:'conn'}));snapshot.profiles=[profile('alpha','db2',{...row('normal1','desktop','same'),status:'terminal',outcome:'completed'}),profile('beta','db-beta',{...row('normal1','desktop','same'),status:'terminal',outcome:'completed'})]
await remount();await until(()=>JSON.parse(value['completion-snapshot-v2'].coverage.source)[0]==='conn'&&badgeFor(0)&&badgeFor(1));assert.equal(unread().find(x=>x.connection==='"conn2"'&&x.owner==='alpha').session_source,'cron');assert.equal(unread().find(x=>x.connection==='"conn"'&&x.owner==='alpha').session_source,'desktop')
// Waiting is independent of hidden Cron completion and remains after normal ack.
await unmount();connection.get=()=> 'conn';routes=[route];active={alpha:[{id:'normal1',session_key:'normal1',source:'desktop',status:'waiting'}]};value={'display-settings-v1':{hideOffline:false,showCron:false,hiddenProfiles:[]}}
snapshot.profiles=[{...profile('alpha','db1',row('cron1','cron','c')),high_water:2,rows:[row('cron1','cron','c'),{...row('normal1','desktop','n'),seq:2}]}]
await remount();for(const r of snapshot.profiles[0].rows){r.status='terminal';r.outcome='completed'}await refetch();await until(()=>unread().length===2&&document.querySelector('[data-avatar-waiting]'));assert.equal(document.querySelector('[data-avatar-waiting]').textContent,'✋')
await React.act(async()=>document.querySelector('.profile-rail-hit').click());await until(()=>document.querySelector('[data-recent-row]'));await React.act(async()=>document.querySelector('[data-recent-row]').click());await until(()=>unread().length===1);assert.equal(unread()[0].session,'cron1');assert.equal(unread()[0].read,false);assert.ok(document.querySelector('[data-avatar-waiting]'),'opening a normal session leaves waiting hand and hidden Cron unread intact')
await unmount();active={}
// Construct actual persisted ledger and previous coverage through the plugin.
async function freshCron(){
 value={'display-settings-v1':{hideOffline:false,showCron:false,hiddenProfiles:[]}}
 snapshot.profiles=[profile('alpha','db1',row('cron1','cron','c'))]
 await remount();snapshot.profiles[0].rows[0].status='terminal';snapshot.profiles[0].rows[0].outcome='completed';await refetch();await until(()=>unread().length===1&&!dot());await unmount()
}
if(!process.env.CRON_CONFLICT_CASE||process.env.CRON_CONFLICT_CASE==='all-known'){
 await freshCron();value['completion-snapshot-v2'].coverage.profiles[0].rows[0].session_source='desktop'
 await remount();await until(()=>value['completion-snapshot-v2'].coverage.profiles[0].rows[0].session_source==='cron')
 assert.equal(unread()[0].session_source_conflict,true,'ledger cron, previous desktop and current cron must conflict');assert.equal(unread()[0].session_source,null);assert.equal(dot(),true)
 await unmount();await remount();await until(dot);assert.equal(unread()[0].session_source_conflict,true);await unmount()
}
if(!process.env.CRON_CONFLICT_CASE||process.env.CRON_CONFLICT_CASE==='missing'){
 await freshCron();delete snapshot.profiles[0].rows[0].session_source
 await remount();await until(()=>unread()[0].session_source===null&&dot());await refetch();assert.equal(unread()[0].session_source,null);assert.equal(dot(),true)
 await unmount();await remount();await until(dot);const remembered=unread()[0].last_known_session_source
 snapshot.profiles[0].rows[0].session_source='desktop';await refetch();await until(()=>value['completion-snapshot-v2'].coverage.profiles[0].rows[0].session_source==='desktop');assert.equal(unread()[0].session_source_conflict,true);assert.equal(unread()[0].session_source,null);assert.equal(dot(),true)
 assert.equal(remembered,'cron','missing snapshots retain the last known source without classifying the current one')
 await unmount();await remount();await until(dot);assert.equal(unread()[0].session_source_conflict,true);await unmount()
}
// Reject malformed optional evidence instead of trusting a corrupt ledger.
for(const bad of [42,'','x'.repeat(257)]){
 await freshCron();unread()[0].last_known_session_source=bad;const saved=structuredClone(value['completion-snapshot-v2'])
 await remount();await until(()=>document.querySelector('[data-completion-error]')?.getAttribute('title')==='Could not save completion records');assert.deepEqual(value['completion-snapshot-v2'],saved);assert.equal(dot(),false);await unmount()
}
client.clear();console.log('PASS cron unread and source conflict regressions')
