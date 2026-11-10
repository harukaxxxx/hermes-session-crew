import {createPopoverFixture} from './popover-fixture.mjs'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
const home=(process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())
const require=createRequire(home+'/package.json'),React=require('react'),{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom'),jsx=require('react/jsx-runtime'),{useQuery,QueryClient,QueryClientProvider}=require('@tanstack/react-query')
const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
const atom=v=>({get:()=>v}),routes=['alpha','beta'].map(profile=>({connectionId:'conn',mode:'remote',profile,targetProfile:profile}))
let failOpen=false,dropWrites=false,saved={},holdWrite=null,writeEntered=null
const host={state:{connectionId:atom('conn'),profile:atom('default')},profiles:{list:async()=>({profiles:routes.map(r=>({name:r.profile}))})},profileRoutes:async()=>routes,openSession:async()=>{if(failOpen)throw Error('open failed')},requestProfile:async(_r,m)=>m==='session.list'?{sessions:[{id:'one',title:'One'},{id:'two',title:'Two'},{id:'read',title:'Read'}]}:{projects:[]}}
const storage={get:async k=>saved[k],set:async(k,v)=>{if(holdWrite){const wait=holdWrite;holdWrite=null;writeEntered();await wait}if(!dropWrites)saved[k]=structuredClone(v)}}
const snap={version:2,source_root:'default',source_id:'source',server_epoch:'epoch',profiles:routes.map(r=>({profile:r.profile,status:'ok',database_id:'db-'+r.profile,high_water:0,truncated:false,rows:[]}))}
const rest=async p=>p==='/status'?[]:structuredClone(snap)
const sdk={host,useValue:a=>a.get(),useQuery,...createPopoverFixture(React)}
const mod=new SourceTextModule(await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8'));await mod.link(async spec=>{const o=spec==='@hermes/plugin-sdk'?sdk:spec==='react/jsx-runtime'?jsx:React;return new SyntheticModule(Object.keys(o),function(){for(const [k,v] of Object.entries(o))this.setExport(k,v)})});await mod.evaluate()
let contribution;mod.namespace.default.register({storage,rest,register:x=>contribution=x});const client=new QueryClient({defaultOptions:{queries:{retry:false}}}),root=createRoot(document.getElementById('root'))
async function until(fn){const end=Date.now()+3000;while(Date.now()<end){await React.act(async()=>{await new Promise(r=>setTimeout(r,5))});if(fn())return}throw Error('fixture timeout: '+document.body.textContent)}
const rows=()=>[...document.querySelectorAll('[data-recent-row]')],mark=row=>row.querySelector('[data-session-completion-badge]')
try{
 await React.act(async()=>root.render(React.createElement(QueryClientProvider,{client},contribution.render())))
 await until(()=>saved['completion-snapshot-v2']?.coverage)
 const p=snap.profiles[0];p.high_water=2;p.rows=['one','two'].map((session_id,i)=>({seq:i+1,admission_id:'turn'+i,session_id,status:'terminal',outcome:'completed',generation:1}))
 await React.act(async()=>client.refetchQueries({queryKey:['profile-rail','completion-snapshot']}));await until(()=>saved['completion-snapshot-v2']?.rows.length===2)
 await React.act(async()=>document.querySelectorAll('.profile-rail-hit')[1].click());await until(()=>rows().length===3)
 assert.ok(rows().every(r=>!mark(r)),'same session ids in another owner have no marker')
 await React.act(async()=>document.querySelectorAll('.profile-rail-hit')[0].click());await until(()=>rows().length===3)
 assert.equal(mark(rows()[0])?.textContent,'✋','pending session has hand');assert.equal(mark(rows()[1])?.textContent,'✋');assert.equal(mark(rows()[2]),null,'read session has no marker')
 assert.equal(rows()[0].style.position,'relative');assert.equal(mark(rows()[0]).style.position,'absolute');assert.equal(mark(rows()[0]).style.top,'0px');assert.equal(mark(rows()[0]).style.left,'0px')
 const beta=snap.profiles[1];beta.high_water=1;beta.rows=[{seq:1,admission_id:'beta-turn',session_id:'not-loaded',status:'terminal',outcome:'completed',generation:1}]
 await React.act(async()=>client.refetchQueries({queryKey:['profile-rail','completion-snapshot']}));await until(()=>saved['completion-snapshot-v2'].rows.length===3)
 const all=document.querySelector('[data-completion-read-all]');assert.ok(all,'mark all is present even without more rows')
 await React.act(async()=>all.click());await until(()=>saved['completion-snapshot-v2'].rows.every(x=>x.read))
 assert.equal(document.querySelectorAll('[data-completion-badge]').length,0,'all covered owners cleared')
 beta.high_water=2;beta.rows.push({seq:2,admission_id:'before-click',session_id:'not-loaded',status:'terminal',outcome:'completed',generation:1})
 await React.act(async()=>client.refetchQueries({queryKey:['profile-rail','completion-snapshot']}));await until(()=>saved['completion-snapshot-v2'].rows.length===4)
 let release,entered;holdWrite=new Promise(r=>release=r);entered=new Promise(r=>writeEntered=r)
 await React.act(async()=>{all.click();await entered})
 beta.high_water=3;beta.rows.push({seq:3,admission_id:'after-click',session_id:'not-loaded',status:'terminal',outcome:'completed',generation:1})
 await React.act(async()=>client.refetchQueries({queryKey:['profile-rail','completion-snapshot']}))
 await React.act(async()=>release());await until(()=>saved['completion-snapshot-v2'].rows.length===5)
 assert.equal(saved['completion-snapshot-v2'].rows.find(x=>x.key.includes('before-click')).read,true)
 assert.equal(saved['completion-snapshot-v2'].rows.find(x=>x.key.includes('after-click')).read,false,'completion arriving while ack persists stays unread')
 p.high_water=4;p.rows.push(...['one','two'].map((session_id,i)=>({seq:i+3,admission_id:'new'+i,session_id,status:'terminal',outcome:'completed',generation:1})))
 await React.act(async()=>client.refetchQueries({queryKey:['profile-rail','completion-snapshot']}));await until(()=>saved['completion-snapshot-v2'].rows.length===7)
 failOpen=true;await React.act(async()=>rows()[0].click());await until(()=>document.querySelector('[role=alert]'));assert.ok(mark(rows()[0]),'failed open keeps marker');assert.ok(saved['completion-snapshot-v2'].rows.filter(x=>x.key.includes('new')).every(x=>!x.read))
 failOpen=false;await React.act(async()=>rows()[0].click());await until(()=>saved['completion-snapshot-v2'].rows.find(x=>x.key.includes('new0')).read)
 await React.act(async()=>document.querySelectorAll('.profile-rail-hit')[0].click());await until(()=>rows().length===3)
 assert.equal(mark(rows()[0]),null,'opened session is read');assert.ok(mark(rows()[1]),'another session remains pending')
 dropWrites=true;await React.act(async()=>document.querySelector('[data-completion-read-all]').click());await until(()=>document.querySelector('[data-completion-error]'));assert.equal(saved['completion-snapshot-v2'].rows.find(x=>x.key.includes('new1')).read,false,'failed durable ack does not clear ledger')
 console.log('PASS owner-scoped row markers, position, read isolation, open and storage failures')
}finally{await React.act(async()=>root.unmount());client.clear()}
