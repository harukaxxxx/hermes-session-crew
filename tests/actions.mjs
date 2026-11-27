import {activityResponse} from './recent-activity-fixture.mjs'
import {createPopoverFixture} from './popover-fixture.mjs'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
import {test} from 'node:test'
const require=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())+'/package.json'),React=require('react'),{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom'),jsx=require('react/jsx-runtime'),{useQuery,QueryClient,QueryClientProvider}=require('@tanstack/react-query')
const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.innerHeight=dom.window.innerHeight;globalThis.innerWidth=dom.window.innerWidth
const route={connectionId:'fixture',mode:'remote',profile:'beta',targetProfile:'backend-beta'}, atom=v=>({get:()=>v});let liveRoute=route,opens=[],calls=[],loseCreateReply=false,failOpen=false,delayCreate,delayOpen
const stored=[]
const host={state:{connectionId:atom('fixture'),profile:atom('alpha')},profiles:{list:async()=>({profiles:[{name:'beta'}]})},profileRoutes:async()=>[liveRoute],request:async()=>({}),requestProfile:async(r,m,p)=>{calls.push([r,m,p]);if(m==='session.create'&&delayCreate)return delayCreate;if(m==='session.create'&&loseCreateReply){stored.push({id:`lost-${stored.length+1}`,title:'Background write'});throw Error('fixture lost reply')}return m==='session.list'?{sessions:[{id:'same',title:'Target'},...stored]}:m==='session.create'?{stored_session_id:p.cwd?'new-project':'new-home'}:{projects:[{id:'p',label:'Joined',path:'/work/p',sessionIds:['same'],repos:[]},{id:'e',label:'Empty',path:'/work/e',sessionIds:[],repos:[]},{id:'n',label:'No path',sessionIds:['same'],repos:[]}]}},openSession:async(...args)=>{opens.push(args);if(failOpen)throw Error('open fixture failure');return delayOpen}}
const sdk={host,useValue:a=>a.get(),useQuery,...createPopoverFixture(React)}
const mod=new SourceTextModule(await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8'));await mod.link(async spec=>{const obj=spec==='@hermes/plugin-sdk'?sdk:spec==='react/jsx-runtime'?jsx:React;return new SyntheticModule(Object.keys(obj),function(){for(const [k,v] of Object.entries(obj))this.setExport(k,v)})});await mod.evaluate();let contribution;mod.namespace.default.register({rest:async(path,opts)=>path==='/recent-activity'?activityResponse(opts):Promise.reject(Error('fixture unavailable')),register:c=>contribution=c});const client=new QueryClient(),root=createRoot(document.getElementById('root'))
async function until(fn){const end=Date.now()+1500;while(Date.now()<end){await React.act(async()=>{await new Promise(r=>setTimeout(r,5))});if(fn())return}throw Error('timeout '+document.body.textContent)}
await React.act(async()=>root.render(React.createElement(QueryClientProvider,{client},contribution.render())));await until(()=>document.querySelector('button'));await React.act(async()=>document.querySelector('button').click());await until(()=>document.body.textContent.includes('Target'))
const row=document.querySelector('[data-recent-row]');assert.equal(row.tagName,'BUTTON','session row must be accessible button');failOpen=true;await React.act(async()=>{row.click();row.click()});assert.equal(opens.length,1);assert.match(document.body.textContent,/Could not open.*open fixture failure/);failOpen=false;opens=[];await React.act(async()=>row.click());assert.deepEqual(opens,[['same',{route,intent:'in-place'}]]);assert.doesNotMatch(document.body.textContent,/Target/)
const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes(text))
const click=el=>React.act(async()=>el.click())
const avatar=()=>document.querySelector('.profile-rail-hit')
const closePanel=()=>document.querySelector('button[aria-label="Close panel"]')
const pick=label=>document.querySelector(`[data-project-row] button[aria-label="New conversation in ${label}"]`)
const creates=()=>calls.filter(x=>x[1]==='session.create')
const alerts=()=>[...document.querySelectorAll('[role="alert"]')].map(el=>el.textContent).join('\n')
async function openPanel(){await click(avatar());await until(()=>document.body.textContent.includes('Target'))}
async function openProjects(){await click(button('Open project'));await until(()=>pick('Joined'))}
async function refreshRoute(next){
 liveRoute=next
 const start=calls.length
 await React.act(async()=>client.refetchQueries({queryKey:['sessioncrew','routes']}))
 await until(()=>calls.slice(start).some(([r,m])=>r.mode===next.mode&&r.targetProfile===next.targetProfile&&m==='projects.tree'))
 assert.ok(closePanel(),'route refresh alone leaves the panel selected')
}

await openPanel()
assert.equal(button('Quick create').disabled,false,'Home enabled')
await click(button('Quick create'));await until(()=>opens.length===2)
assert.deepEqual(creates()[0],[route,'session.create',{source:'desktop'}])
assert.deepEqual(opens[1],['new-home',{route,intent:'in-place'}])
await openPanel();await openProjects()
assert.ok(pick('Empty'),'an explicitly created project does not need sessions to be launchable')
await click(pick('Joined'));await until(()=>opens.length===3)
assert.deepEqual(creates()[1],[route,'session.create',{source:'desktop',cwd:'/work/p',cwd_explicit:true}])
assert.deepEqual(opens[2],['new-project',{route,intent:'in-place'}])

await openPanel();await openProjects()
await click(pick('No path'));await until(()=>document.body.textContent.includes('no available folder'))
assert.equal(creates().length,2,'pre-dispatch failure sends nothing')
failOpen=true
await click(button('Quick create'));await until(()=>document.body.textContent.includes('open fixture failure'))
assert.match(document.body.textContent,/Created new-home/)
assert.equal(creates().length,3,'pre-dispatch failure permits a subsequent create')
failOpen=false
await click(button('Retry opening'))
assert.equal(creates().length,3)
assert.deepEqual(opens.slice(-2),Array(2).fill(['new-home',{route,intent:'in-place'}]))

await test('target refresh before delayed ack leaves panel open and keeps retry at the dispatch destination',async()=>{
 await openPanel()
 const createCount=creates().length,openCount=opens.length
 const ack=Promise.withResolvers();delayCreate=ack.promise
 await click(button('Quick create'))
 assert.deepEqual(creates().slice(createCount),[[route,'session.create',{source:'desktop'}]])
 const other={...route,targetProfile:'replacement-beta'}
 try{
  await refreshRoute(other)
  await React.act(async()=>ack.resolve({stored_session_id:'delayed-id'}))
  assert.deepEqual({opens:opens.slice(openCount),panelOpen:!!closePanel()},{opens:[],panelOpen:true},'stale acknowledgement must neither open nor dismiss')
  assert.equal(button('Retry opening'),undefined,'the replacement cannot retry the old ID')

  const refreshed={...route,mode:'local'}
  await refreshRoute(refreshed)
  assert.equal(button('Retry opening')?.disabled,false,'the dispatch destination can still retry after a mode change')
  const opened=Promise.withResolvers();delayOpen=opened.promise
  await click(button('Retry opening'))
  assert.deepEqual(opens.slice(openCount),[['delayed-id',{route:refreshed,intent:'in-place'}]])
  assert.equal(creates().length,createCount+1,'retry only opens the known ID')

  await refreshRoute(other)
  await React.act(async()=>opened.resolve())
  assert.ok(closePanel(),'open completion must not dismiss the replacement panel')
 }finally{
  delayCreate=delayOpen=undefined
  if(closePanel())await click(closePanel())
  liveRoute={...route}
  await React.act(async()=>client.refetchQueries({queryKey:['sessioncrew','routes']}))
 }
})

await test('mode-only refresh after a lost reply does not send another create',async()=>{
 await openPanel()
 loseCreateReply=true
 const createCount=creates().length,opensBefore=opens.length
 await click(button('Quick create'))
 assert.equal(stored.length,1,'the fixture committed before losing its reply')
 const firstAlert=alerts()
 await click(avatar());await openPanel()
 await click(button('Quick create'))
 assert.equal(creates().length,createCount+1,'reopening without a refresh must not replay the write')

 await refreshRoute({...route,mode:'local'})
 await click(button('Quick create'))
 await openProjects();await click(pick('Joined'))
 assert.deepEqual(stored.map(s=>s.id),['lost-1'],'Quick and project launches must not replay the lost write after a mode-only refresh')
 assert.equal(creates().length,createCount+1)
 assert.equal(opens.length,opensBefore,'no known ID means no navigation')
 assert.equal(button('Retry opening'),undefined)
 assert.equal(button('Quick create').disabled,true)
 assert.equal(pick('Joined').disabled,true)
 assert.match(firstAlert,/creation could not be confirmed.*check.*session list/i)
 assert.match(alerts(),/creation could not be confirmed.*check.*session list/i)
})
await React.act(async()=>root.unmount());client.clear();console.log('PASS routed row, Quick, project cwd, pre-dispatch failure, and open-only retry')
