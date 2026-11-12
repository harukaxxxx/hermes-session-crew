import {createPopoverFixture} from './popover-fixture.mjs'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
const home=(process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())
const require=createRequire(home+'/package.json'),React=require('react'),{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom'),jsx=require('react/jsx-runtime'),{useQuery,QueryClient,QueryClientProvider}=require('@tanstack/react-query')
const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
const atom=v=>{const listeners=new Set();return {get:()=>v,subscribe:f=>(listeners.add(f),()=>listeners.delete(f)),set:x=>{v=x;for(const f of listeners)f()}}},routes=['alpha','beta'].map(profile=>({connectionId:'conn',mode:'remote',profile,targetProfile:profile}))
const gateway=atom('open'),active={alpha:[],beta:[]},owners={one:'alpha',two:'alpha',read:'alpha',hidden:'alpha'}
let failOpen=false,dropWrites=false,saved={},holdWrite=null,writeEntered=null
const host={state:{gateway,connectionId:atom('conn'),profile:atom('default')},profiles:{list:async()=>({profiles:routes.map(r=>({name:r.profile}))})},profileRoutes:async()=>routes,openSession:async()=>{if(failOpen)throw Error('open failed')},requestProfile:async(r,m)=>m==='session.active_list'?{sessions:structuredClone(active[r.profile])}:m==='subagent.roster'?{sessions:[]}:m==='session.list'?{sessions:[{id:'one',title:'One'},{id:'two',title:'Two'},{id:'read',title:'Read'}]}:{projects:[]}}
const storage={get:async k=>saved[k],set:async(k,v)=>{if(holdWrite){const wait=holdWrite;holdWrite=null;writeEntered();await wait}if(!dropWrites)saved[k]=structuredClone(v)}}
const snap={version:2,source_root:'default',source_id:'source',server_epoch:'epoch',profiles:routes.map(r=>({profile:r.profile,status:'ok',database_id:'db-'+r.profile,high_water:0,truncated:false,rows:[]}))}
const rest=async(p,opts)=>p==='/status'?[]:p==='/row-owners'?{owners:Object.fromEntries(opts.body.ids.map(id=>[id,owners[id]])),sources:Object.fromEntries(opts.body.ids.map(id=>[id,'cli']))}:structuredClone(snap)
const sdk={host,useValue:a=>a.get(),useQuery,...createPopoverFixture(React)}
const mod=new SourceTextModule(await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8'));await mod.link(async spec=>{const o=spec==='@hermes/plugin-sdk'?sdk:spec==='react/jsx-runtime'?jsx:React;return new SyntheticModule(Object.keys(o),function(){for(const [k,v] of Object.entries(o))this.setExport(k,v)})});await mod.evaluate()
let contribution;mod.namespace.default.register({storage,rest,register:x=>contribution=x});const client=new QueryClient({defaultOptions:{queries:{retry:false}}}),root=createRoot(document.getElementById('root'))
async function until(fn){const end=Date.now()+3000;while(Date.now()<end){await React.act(async()=>{await new Promise(r=>setTimeout(r,5))});if(fn())return}throw Error('fixture timeout: '+document.body.textContent)}
const rows=()=>[...document.querySelectorAll('[data-recent-row]')],mark=row=>row.querySelector('[data-session-completion-badge]')
try{
 await React.act(async()=>root.render(React.createElement(QueryClientProvider,{client},contribution.render())))
 await until(()=>saved['completion-snapshot-v2']?.coverage)
 const p=snap.profiles[0];p.high_water=2;p.rows=['one','two'].map((session_id,i)=>({seq:i+1,admission_id:'turn'+i,session_id,status:'terminal',outcome:'completed',generation:1}))
 await React.act(async()=>client.refetchQueries({queryKey:['sessioncrew','completion-snapshot']}));await until(()=>saved['completion-snapshot-v2']?.rows.length===2)
 await React.act(async()=>document.querySelectorAll('.profile-rail-hit')[1].click());await until(()=>rows().length===3)
 assert.ok(rows().every(r=>!mark(r)),'same session ids in another owner have no marker')
 await React.act(async()=>document.querySelectorAll('.profile-rail-hit')[0].click());await until(()=>rows().length===3)
 assert.equal(mark(rows()[0])?.textContent,'','unread completion has dot');assert.equal(mark(rows()[1])?.textContent,'');assert.equal(mark(rows()[2]),null,'read session has no marker')
 const record=(id,status)=>({id,session_key:id,source:'cli',status})
 active.alpha=[record('one','working'),record('hidden','waiting')]
 await React.act(async()=>{await client.refetchQueries({queryKey:['sessioncrew','profile-input-waiting']});await client.refetchQueries({queryKey:['sessioncrew','row-activity']})})
 await until(()=>document.querySelector('[data-avatar-waiting]')&&rows()[0].querySelector('[data-session-arc]'))
 assert.equal(mark(rows()[0]).textContent,'','working row retains unread while an unloaded session waits')
 owners.hidden='beta';await React.act(async()=>client.refetchQueries({queryKey:['sessioncrew','profile-input-waiting']}));await until(()=>!document.querySelector('[data-avatar-waiting]'))
 assert.ok(document.querySelector('[data-completion-badge]'),'owner mismatch fails closed without affecting ledger');owners.hidden='alpha'
 active.alpha=[record('one','waiting'),record('hidden','working')]
 await React.act(async()=>{await client.refetchQueries({queryKey:['sessioncrew','profile-input-waiting']});await client.refetchQueries({queryKey:['sessioncrew','row-activity']})})
 await until(()=>document.querySelector('[data-avatar-waiting]')&&rows()[0].querySelector('[data-session-waiting]'))
 assert.equal(document.querySelector('[data-avatar-waiting]').textContent,'✋');assert.equal(document.querySelectorAll('[data-completion-badge]').length,0,'waiting supersedes unread on same avatar')
 assert.equal(rows()[0].querySelector('[data-session-waiting]').textContent,'✋');assert.equal(mark(rows()[0]),null,'waiting supersedes same session unread');assert.equal(mark(rows()[1]).textContent,'','other session unread survives')
 assert.ok(document.querySelector('.profile-rail-hit').getAttribute('aria-label').includes('Waiting for input'))
 assert.ok(saved['completion-snapshot-v2'].rows.every(x=>!x.read),'presentation leaves ledger intact')
 await React.act(async()=>gateway.set('closed'));await until(()=>!document.querySelector('[data-avatar-waiting]'));assert.ok(document.querySelector('[data-completion-badge]'),'disconnect fails closed without clearing unread')
 active.alpha=[];await React.act(async()=>gateway.set('open'));await until(()=>mark(rows()[0]));
 assert.equal(rows()[0].style.position,'relative');assert.equal(mark(rows()[0]).style.width,'10px');assert.equal(mark(rows()[0]).style.height,'10px');assert.equal(mark(rows()[0]).parentElement.getAttribute('data-session-indicator'),'true');assert.ok(rows().every(r=>r.querySelector('[data-session-indicator]')))
 const beta=snap.profiles[1];beta.high_water=1;beta.rows=[{seq:1,admission_id:'beta-turn',session_id:'not-loaded',status:'terminal',outcome:'completed',generation:1}]
 p.high_water=3;p.rows.push({seq:3,admission_id:'alpha-hidden',session_id:'not-loaded',status:'terminal',outcome:'completed',generation:1})
 await React.act(async()=>client.refetchQueries({queryKey:['sessioncrew','completion-snapshot']}));await until(()=>saved['completion-snapshot-v2'].rows.length===4)
 const all=document.querySelector('[data-completion-read-all]');assert.ok(all,'mark all is present even without more rows')
 await React.act(async()=>all.click());await until(()=>saved['completion-snapshot-v2'].rows.filter(x=>x.owner==='alpha').every(x=>x.read))
 assert.equal(saved['completion-snapshot-v2'].rows.find(x=>x.owner==='beta').read,false,'other owner remains unread')
 assert.equal(document.querySelectorAll('[data-completion-badge]').length,1,'other owner hand remains visible')
 beta.high_water=2;beta.rows.push({seq:2,admission_id:'before-click',session_id:'not-loaded',status:'terminal',outcome:'completed',generation:1})
 p.high_water=4;p.rows.push({seq:4,admission_id:'alpha-queued',session_id:'not-loaded',status:'terminal',outcome:'completed',generation:1})
 await React.act(async()=>client.refetchQueries({queryKey:['sessioncrew','completion-snapshot']}));await until(()=>saved['completion-snapshot-v2'].rows.length===6)
 let release,entered;holdWrite=new Promise(r=>release=r);entered=new Promise(r=>writeEntered=r)
 await React.act(async()=>document.querySelectorAll('.profile-rail-hit')[1].click());await until(()=>rows().length===3)
 await React.act(async()=>{document.querySelector('[data-completion-read-all]').click();await entered})
 await React.act(async()=>document.querySelectorAll('.profile-rail-hit')[0].click());await until(()=>rows().length===3)
 await React.act(async()=>document.querySelector('[data-completion-read-all]').click())
 await React.act(async()=>document.querySelectorAll('.profile-rail-hit')[1].click());await until(()=>rows().length===3)
 beta.high_water=3;beta.rows.push({seq:3,admission_id:'after-click',session_id:'not-loaded',status:'terminal',outcome:'completed',generation:1})
 await React.act(async()=>client.refetchQueries({queryKey:['sessioncrew','completion-snapshot']}))
 await React.act(async()=>release());await until(()=>saved['completion-snapshot-v2'].rows.length===7)
 assert.equal(saved['completion-snapshot-v2'].rows.find(x=>x.key.includes('before-click')).read,true)
 assert.equal(saved['completion-snapshot-v2'].rows.find(x=>x.key.includes('alpha-queued')).read,true,'queued ack retains clicked owner after selection changes')
 assert.equal(saved['completion-snapshot-v2'].rows.find(x=>x.key.includes('after-click')).read,false,'completion arriving while ack persists stays unread')
 p.high_water=6;p.rows.push(...['one','two'].map((session_id,i)=>({seq:i+5,admission_id:'new'+i,session_id,status:'terminal',outcome:'completed',generation:1})))
 await React.act(async()=>client.refetchQueries({queryKey:['sessioncrew','completion-snapshot']}));await until(()=>saved['completion-snapshot-v2'].rows.length===9)
 await React.act(async()=>document.querySelectorAll('.profile-rail-hit')[0].click());await until(()=>rows().length===3)
 failOpen=true;await React.act(async()=>rows()[0].click());await until(()=>document.querySelector('[role=alert]'));assert.ok(mark(rows()[0]),'failed open keeps marker');assert.ok(saved['completion-snapshot-v2'].rows.filter(x=>x.key.includes('new')).every(x=>!x.read))
 failOpen=false;await React.act(async()=>rows()[0].click());await until(()=>saved['completion-snapshot-v2'].rows.find(x=>x.key.includes('new0')).read)
 await React.act(async()=>document.querySelectorAll('.profile-rail-hit')[0].click());await until(()=>rows().length===3)
 assert.equal(mark(rows()[0]),null,'opened session is read');assert.ok(mark(rows()[1]),'another session remains pending')
 dropWrites=true;await React.act(async()=>document.querySelector('[data-completion-read-all]').click());await until(()=>document.querySelector('[data-completion-error]'));assert.equal(saved['completion-snapshot-v2'].rows.find(x=>x.key.includes('new1')).read,false,'failed durable ack does not clear ledger')
 console.log('PASS owner-scoped row markers, position, read isolation, open and storage failures')
}finally{await React.act(async()=>root.unmount());client.clear()}
