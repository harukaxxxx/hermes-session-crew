import {createPopoverFixture} from './popover-fixture.mjs'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
const require=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT)+'/package.json')
const React=require('react'),{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom'),jsx=require('react/jsx-runtime'),{useQuery,QueryClient,QueryClientProvider}=require('@tanstack/react-query')
const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
const atom=v=>({get:()=>v,subscribe:()=>()=>{}})
const names=['plain','dot','hand','both','idle-old','idle-new','working','office-wait','offline']
const routes=names.map(profile=>({connectionId:'conn',mode:'remote',profile,targetProfile:profile}))
const active=Object.fromEntries(names.map(n=>[n,[]]))
const record=n=>({id:n,session_key:n,source:'cli',status:'waiting'})
const host={state:{gateway:atom('open'),connectionId:atom('conn'),profile:atom('default')},profiles:{list:async()=>({profiles:names.map(name=>({name}))})},profileRoutes:async()=>routes,request:async()=>({found:false}),requestProfile:async(r,m)=>m==='session.active_list'?{sessions:structuredClone(active[r.profile])}:m==='session.list'?{sessions:[]}:{projects:[]}}
let saved={};const storage={get:async k=>saved[k],set:async(k,v)=>{saved[k]=structuredClone(v)}}
const snapshot={version:2,source_root:'default',source_id:'source',server_epoch:'epoch',profiles:names.map(profile=>({profile,status:'ok',database_id:'db-'+profile,high_water:0,truncated:false,rows:[]}))}
const status=names.map(profile=>({profile,online:profile!=='offline',state:profile==='working'?'working':profile==='office-wait'?'waiting':'idle',idle_since:profile==='idle-new'?50:profile==='idle-old'?10:20}))
const rest=async(p,opts)=>p==='/status'?structuredClone(status):p==='/row-owners'?{owners:Object.fromEntries(opts.body.ids.map(id=>[id,id])),sources:Object.fromEntries(opts.body.ids.map(id=>[id,'cli']))}:structuredClone(snapshot)
const sdk={host,useValue:a=>a.get(),useQuery,...createPopoverFixture(React)}
const mod=new SourceTextModule(await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8'));await mod.link(async spec=>{const o=spec==='@hermes/plugin-sdk'?sdk:spec==='react/jsx-runtime'?jsx:React;return new SyntheticModule(Object.keys(o),function(){for(const [k,v] of Object.entries(o))this.setExport(k,v)})});await mod.evaluate()
let contribution;mod.namespace.default.register({storage,rest,register:x=>contribution=x});const client=new QueryClient({defaultOptions:{queries:{retry:false}}}),root=createRoot(document.getElementById('root'))
async function until(fn){const end=Date.now()+3000;while(Date.now()<end){await React.act(async()=>{await new Promise(r=>setTimeout(r,5))});if(fn())return}throw Error('fixture timeout: '+document.body.textContent)}
const entries=()=>[...document.querySelectorAll('.profile-rail-hit')].map(x=>({name:x.getAttribute('aria-label').split(' · ')[0].toLowerCase(),hand:!!x.closest('[data-avatar-stack]').querySelector('[data-avatar-waiting]'),dot:!!x.closest('[data-avatar-stack]').querySelector('[data-completion-badge]')}))
const order=()=>entries().map(x=>x.name)
try{
 await React.act(async()=>root.render(React.createElement(QueryClientProvider,{client},contribution.render())))
 await until(()=>saved['completion-snapshot-v2']?.coverage&&order().length===names.length)
 for(const name of ['dot','both']){const p=snapshot.profiles.find(p=>p.profile===name);p.high_water=1;p.rows=[{seq:1,admission_id:name,session_id:name,status:'terminal',outcome:'completed',generation:1}]}
 active.hand=[record('hand')];active.both=[record('both')]
 await React.act(async()=>{await client.refetchQueries({queryKey:['sessioncrew','completion-snapshot']});await client.refetchQueries({queryKey:['sessioncrew','profile-input-waiting']})})
 await until(()=>entries().filter(x=>x.hand).length===2&&entries().some(x=>x.name==='dot'&&x.dot))
 assert.deepEqual(order(),['working','office wait','hand','both','dot','idle new','plain','idle old','offline'],'status first, then visible hand, visible dot, and idle timestamp; office waiting is not an input hand')
 assert.equal(entries().find(x=>x.name==='both').dot,false,'hand hides retained unread')
 active.both=[]
 await React.act(async()=>client.refetchQueries({queryKey:['sessioncrew','profile-input-waiting']}))
 await until(()=>entries().find(x=>x.name==='both')?.dot)
 assert.deepEqual(order(),['working','office wait','hand','dot','both','idle new','plain','idle old','offline'],'resolving input reveals unread and reorders by idle/index within dots')
 await React.act(async()=>[...document.querySelectorAll('.profile-rail-hit')].find(x=>x.getAttribute('aria-label').startsWith('Dot ·')).click())
 await until(()=>document.querySelector('[data-completion-read-all]'))
 await React.act(async()=>document.querySelector('[data-completion-read-all]').click())
 await until(()=>!entries().find(x=>x.name==='dot')?.dot)
 assert.deepEqual(order(),['working','office wait','hand','both','idle new','plain','dot','idle old','offline'],'acknowledgement reorders without clearing another profile')
 active.hand=[]
 await React.act(async()=>client.refetchQueries({queryKey:['sessioncrew','profile-input-waiting']}))
 await until(()=>!entries().some(x=>x.hand))
 assert.deepEqual(order(),['working','office wait','both','idle new','plain','dot','hand','idle old','offline'],'last hand removal restores idle tie-break')
 active.offline=[record('offline')]
 await React.act(async()=>client.refetchQueries({queryKey:['sessioncrew','profile-input-waiting']}))
 await until(()=>entries().find(x=>x.name==='offline')?.hand)
 assert.equal(order().at(-1),'offline','even a displayed hand cannot cross a status group')
 assert.equal(entries().find(x=>x.name==='office wait').hand,false,'office waiting does not produce an avatar hand')
 console.log('PASS profile attention ordering uses displayed markers')
}finally{await React.act(async()=>root.unmount());client.clear()}
