import {activityResponse} from './recent-activity-fixture.mjs'
import {createPopoverFixture} from './popover-fixture.mjs'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
const require=createRequire(process.env.HERMES_CHECKOUT+'/package.json'),React=require('react'),{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom'),jsx=require('react/jsx-runtime'),{useQuery,QueryClient,QueryClientProvider}=require('@tanstack/react-query')
const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
let connection='c1',saved={},hold=null,entered=null
const atom=get=>({get}),routes=()=>['alpha','beta'].map(profile=>({connectionId:connection,mode:'remote',profile,targetProfile:profile}))
const host={state:{connectionId:atom(()=>connection),profile:atom(()=>'default')},profiles:{list:async()=>({profiles:routes().map(r=>({name:r.profile}))})},profileRoutes:async()=>routes(),openSession:async()=>{},requestProfile:async(_r,m)=>m==='session.list'?{sessions:[{id:'same',title:'Same'}]}:{projects:[]}}
const storage={get:async k=>saved[k],set:async(k,v)=>{if(hold){const p=hold;hold=null;entered();await p}saved[k]=structuredClone(v)}}
const snapshot=()=>({version:2,source_root:'default',source_id:'dataset-a',server_epoch:'epoch',profiles:['alpha','beta'].map(profile=>({profile,status:'ok',database_id:'db-'+profile,high_water:0,truncated:false,rows:[]}))})
let snap=snapshot();const rest=async (p,opts)=>p==='/recent-activity'?activityResponse(opts):p==='/status'?[]:structuredClone(snap)
const sdk={host,useValue:a=>a.get(),useQuery,...createPopoverFixture(React)}
const mod=new SourceTextModule(await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8'));await mod.link(async spec=>{const o=spec==='@hermes/plugin-sdk'?sdk:spec==='react/jsx-runtime'?jsx:React;return new SyntheticModule(Object.keys(o),function(){for(const [k,v] of Object.entries(o))this.setExport(k,v)})});await mod.evaluate()
let contribution;mod.namespace.default.register({storage,rest,register:x=>contribution=x});const client=new QueryClient({defaultOptions:{queries:{retry:false}}}),root=createRoot(document.getElementById('root'))
async function until(fn){const end=Date.now()+5000;while(Date.now()<end){await React.act(async()=>{await new Promise(r=>setTimeout(r,5))});if(fn())return}throw Error('fixture timeout: '+document.body.textContent)}
const render=()=>React.act(async()=>root.render(React.createElement(QueryClientProvider,{client},contribution.render())))
const refresh=()=>React.act(async()=>client.refetchQueries({queryKey:['sessioncrew','completion-snapshot']}))
const event=(p,id)=>{p.high_water++;p.rows.push({seq:p.high_water,admission_id:id,session_id:'same',status:'terminal',outcome:'completed',generation:1})}
const ledger=()=>saved['completion-snapshot-v2'],row=id=>ledger().rows.find(x=>JSON.parse(x.key)[4]===id)
async function select(i){await React.act(async()=>document.querySelectorAll('.profile-rail-hit')[i].click());await until(()=>document.querySelector('[data-completion-read-all]'))}
function pause(){let release;hold=new Promise(r=>release=r);const wait=new Promise(r=>entered=r);return {release,wait}}
try{
 await render();await until(()=>ledger()?.coverage)
 event(snap.profiles[0],'dataset-old');await refresh();await until(()=>row('dataset-old'))
 await select(0)
 // A changed snapshot is already queued and blocked in storage before the click.
 let gate=pause();snap.source_id='dataset-b';snap.profiles[0].high_water=0;snap.profiles[0].rows=[]
 await refresh();await React.act(async()=>gate.wait)
 await React.act(async()=>document.querySelector('[data-completion-read-all]').click())
 await React.act(async()=>gate.release());await until(()=>JSON.parse(ledger().coverage.source)[1]==='dataset-b')
 await until(()=>document.querySelector('[data-completion-read-all]')&&!document.querySelector('[data-completion-read-all]').disabled)
 assert.equal(row('dataset-old').read,false,'queued ack must not read prior dataset after coverage changes')
 event(snap.profiles[0],'dataset-new');await refresh();await until(()=>row('dataset-new'));assert.equal(row('dataset-new').read,false,'new dataset completion remains unread')
 // Same dataset, replacement database: the pending click must not cross the coverage fence.
 gate=pause();snap.profiles[0].database_id='db-replacement';snap.profiles[0].high_water=0;snap.profiles[0].rows=[]
 await refresh();await React.act(async()=>gate.wait);await React.act(async()=>document.querySelector('[data-completion-read-all]').click())
 await React.act(async()=>gate.release());await until(()=>ledger().coverage.profiles.find(p=>p.owner==='alpha')?.database_id==='db-replacement')
 event(snap.profiles[0],'database-new');await refresh();await until(()=>row('database-new'));assert.equal(row('database-new').read,false,'replacement database completion remains unread')
 // Block a different owner's write, then queue alpha's bulk action and change connection.
 event(snap.profiles[1],'beta-blocker');await refresh();await until(()=>row('beta-blocker'))
 await select(1);gate=pause();await React.act(async()=>{document.querySelector('[data-completion-read-all]').click();await gate.wait})
 await select(0);await React.act(async()=>document.querySelector('[data-completion-read-all]').click())
 connection='c2';snap=snapshot();await render();await React.act(async()=>gate.release())
 await until(()=>JSON.parse(ledger().coverage.source)[0]==='c2')
 assert.equal(row('database-new').read,false,'queued old-connection bulk action was fenced')
 event(snap.profiles[0],'connection-new');await refresh();await until(()=>row('connection-new'));assert.equal(row('connection-new').read,false,'new connection completion remains unread')
 assert.equal(row('database-new').connection,JSON.stringify('c1'));assert.equal(row('connection-new').connection,JSON.stringify('c2'))
 console.log('PASS queued bulk acknowledgement is fenced across dataset, database, and connection changes')
}finally{await React.act(async()=>root.unmount());client.clear()}
