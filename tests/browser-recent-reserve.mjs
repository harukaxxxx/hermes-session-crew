import {createRequire} from 'node:module'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
const checkout=process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT
const require=createRequire(checkout+'/package.json'),{build}=require('esbuild'),{chromium}=require('playwright')
const source=await readFile('desktop/plugin.js','utf8')
const sdk=`export const host={requestProfile:(...a)=>window.fixtureRequest(...a),state:{connectionId:{get:()=> 'c'},profile:{get:()=> 'alpha'}}}; export {useQuery} from '@tanstack/react-query'; export const useValue=x=>x.get(); export const Popover=()=>null,PopoverContent=()=>null,PopoverTrigger=()=>null;`
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {Recent,DialogRestContext} from 'fixture-plugin'; import {activityResponse} from './tests/recent-activity-fixture.mjs'; const rest=async(path,opts)=>{if(path!=='/recent-activity')throw Error('unexpected fixture request');window.activityRequests++;return activityResponse(opts)};
const root=createRoot(document.getElementById('root'));const owner={connectionId:'c',name:'alpha',route:{connectionId:'c',profile:'alpha',targetProfile:'alpha',mode:'remote'}};let client,instance=0,settings,cap;
window.mountRecent=(mode,recentSessionCount)=>{client?.clear();instance++;window.resolveSessions=null;window.rejectSessions=null;settings=recentSessionCount===undefined?undefined:{recentSessionCount,showCron:false,hiddenMessagingSources:[]};cap=settings?960:400;client=new QueryClient({defaultOptions:{queries:{retry:false}}});window.renderRecent(mode)};
window.setRecentCount=recentSessionCount=>{settings={...settings,recentSessionCount};window.renderRecent('pending')};
window.renderRecent=(mode)=>root.render(React.createElement(QueryClientProvider,{client,key:instance},React.createElement('div',{'data-bubble':true,style:{width:310,maxHeight:'min('+cap+'px, calc(100vh - 24px))',display:'flex',flexDirection:'column',padding:16,border:'1px solid'}},React.createElement('div',null,'Header'),React.createElement(DialogRestContext.Provider,{value:rest},React.createElement(Recent,{owner:mode==='route'||mode==='route-error'?null:owner,phase:mode==='route'?'loading':'route error',retryRoutes:()=>{},onOpened:()=>{},settings,completion:{watermark:()=>[],coverageReady:false,ackAll:()=>{}}})),React.createElement('div',{'data-outer-footer':true,style:{height:30,flexShrink:0}},'Footer'))));`
const out=path.resolve('tests/recent-reserve-bundle.js')
await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'js'},bundle:true,format:'iife',outfile:out,nodePaths:[checkout+'/node_modules'],plugins:[{name:'fixture',setup(b){b.onResolve({filter:/^(fixture-plugin|@hermes\/plugin-sdk)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='fixture-plugin'?source+'\nexport {Recent,DialogRestContext};':sdk,resolveDir:process.cwd(),loader:'js'}))}}],logLevel:'silent'})
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH})
try{
 const page=await browser.newPage({viewport:{width:900,height:700}})
 await page.setContent('<style>*{box-sizing:border-box}body{font:14px system-ui}button{font:inherit}</style><div id="root"></div>')
 await page.addScriptTag({path:out})
 await page.evaluate(()=>{window.sessionRequests=[];window.activityRequests=0;window.fixtureRequest=(_route,method,params)=>method==='session.list'?new Promise((resolve,reject)=>{window.sessionRequests.push(params);window.resolveSessions=resolve;window.rejectSessions=reject}):Promise.resolve({projects:[]});window.mountRecent('route')})
 const list=page.locator('[data-recent-list]'),bubble=page.locator('[data-bubble]'),rows=page.locator('[data-recent-row]'),more=page.locator('[data-recent-more]'),all=page.locator('[data-completion-read-all]'),cue=page.locator('[data-recent-scroll-cue]'),thumb=page.locator('[data-recent-scroll-thumb]')
 const release=(n,cron=0)=>page.evaluate(({n,cron})=>{const resolve=window.resolveSessions;window.resolveSessions=null;resolve({sessions:[...Array.from({length:cron},(_,i)=>({id:'cron'+i,title:'Hidden cron '+i,source:'cron'})),...Array.from({length:n},(_,i)=>({id:'id'+i,title:'Session '+i,last_active:n-i}))]})},{n,cron})
 const bottom=()=>list.evaluate(el=>{el.scrollTop=el.scrollHeight;return el.scrollTop})
 const frames=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
 // Ignore the 2px marker bleed above the loaded content reserve.
 const geometry=()=>page.evaluate(()=>{const el=document.querySelector('[data-recent-list]');return {list:el.getBoundingClientRect().height-parseFloat(getComputedStyle(el).paddingTop),bubble:document.querySelector('[data-bubble]').getBoundingClientRect().height,footer:document.querySelector('[data-outer-footer]').getBoundingClientRect().top}})
 await list.waitFor();const route=await geometry();assert.equal(route.list,260)
 await page.evaluate(()=>window.renderRecent('route-error'));await page.getByText('route error').waitFor();assert.deepEqual(await geometry(),route)
 for(const n of [0,1,4,5,15,24,200]){
  await page.evaluate(()=>window.mountRecent('pending'));await page.waitForFunction(()=>typeof window.resolveSessions==='function');const pending=await geometry();assert.deepEqual(pending,route)
  const centers=await list.evaluate(el=>{const text=document.createTreeWalker(el,NodeFilter.SHOW_TEXT).nextNode();const range=document.createRange();range.selectNodeContents(text);const a=el.getBoundingClientRect(),b=range.getBoundingClientRect();return {text:text.textContent,dx:(b.left+b.right-a.left-a.right)/2,dy:(b.top+b.bottom-a.top-a.bottom)/2}})
  assert.match(centers.text,/Loading sessions|載入工作階段/);assert.ok(Math.abs(centers.dx)<=1,`loading text horizontal center offset: ${centers.dx}px`);assert.ok(Math.abs(centers.dy)<=1,`loading text vertical center offset: ${centers.dy}px`)
  await release(n)
  await all.waitFor()
  assert.equal(await rows.count(),Math.min(15,n),'default opens with up to 15 rows')
  assert.deepEqual(await geometry(),route,`loaded ${n}`)
  assert.equal(await list.evaluate(el=>el.getBoundingClientRect().height),262,'loaded viewport includes only the 2px marker bleed')
  if(n===200)assert.equal(await bubble.getByText(/Showing at most 200 fetched items|最多顯示已取得的 200 筆/).count(),0,'no visible 200-item limit notice')
  assert.equal(await cue.count(),Number(n>5),'cue is present only for overflow')
  assert.equal(await more.count(),0,'no Load more at the top')
  if(n<=15){await bottom();await frames();assert.equal(await more.count(),0,'no Load more at the bottom without remaining rows')}
  if(n===24||n===200){
   const width=await rows.first().evaluate(el=>el.getBoundingClientRect().width)
   const startTop=await thumb.evaluate(el=>el.getBoundingClientRect().top)
   await bottom();await more.waitFor()
   assert.ok(await thumb.evaluate(el=>el.getBoundingClientRect().top)>startTop,'scrolling moves the thumb')
   await list.evaluate(el=>{el.scrollTop-=52});await more.waitFor({state:'detached'})
   assert.equal(await rows.count(),15,'scrolling does not auto-load')
   for(const count of n===24?[24]:[25,35]){
    const oldTop=await bottom();await more.waitFor();await more.click()
    await more.waitFor({state:'detached'})
    assert.equal(await rows.count(),count)
    assert.equal(await list.evaluate(el=>el.scrollTop),oldTop,'append preserves scroll position')
    assert.deepEqual(await geometry(),route,'load more preserves list and footer geometry')
    assert.equal(await rows.first().evaluate(el=>el.getBoundingClientRect().width),width,'cue does not shift row width')
    assert.ok(await all.isVisible())
   }
   await bottom()
   if(n===24){await frames();assert.equal(await more.count(),0,'last partial batch exhausts the list')}
   else await more.waitFor()
  }
 }
 const thumbBox=await thumb.boundingBox();await page.mouse.move(thumbBox.x+thumbBox.width/2,thumbBox.y+thumbBox.height/2);await page.mouse.down();await page.mouse.move(thumbBox.x+thumbBox.width/2,thumbBox.y-45,{steps:4});await page.mouse.up();await more.waitFor({state:'detached'});assert.ok(await list.evaluate(el=>el.scrollTop<el.scrollHeight-el.clientHeight),'dragging the thumb scrolls away from the bottom')
 await page.evaluate(()=>window.mountRecent('pending'));await page.waitForFunction(()=>typeof window.rejectSessions==='function');await page.evaluate(()=>{window.rejectSessions(Error('fixture failure'));window.rejectSessions=null});await page.getByText(/fixture failure/).waitFor();assert.deepEqual(await geometry(),route)
 await page.setViewportSize({width:900,height:200});assert.ok((await bubble.boundingBox()).height<=176);assert.ok((await list.boundingBox()).height<260,'list shrinks in a short viewport');assert.ok(await page.locator('[data-outer-footer]').isVisible())
 await page.setViewportSize({width:900,height:1000})
 for(const count of [3,10,15]){
  await page.evaluate(count=>window.mountRecent('pending',count),count)
  await page.waitForFunction(()=>typeof window.resolveSessions==='function')
  const pending=await geometry();assert.equal(pending.list,count*52,`loading reserve for ${count}`)
  await page.evaluate(()=>window.resolveSessions({sessions:[{id:'sparse',title:'Sparse session'}]}))
  await list.getByRole('button',{name:/Sparse session/}).waitFor()
  assert.deepEqual(await geometry(),pending,`sparse results retain the ${count}-row reserve`)
 }
 // Keep cache age fixed; native timers are still live. Stay within the poll interval.
 await page.clock.setFixedTime(new Date('2026-01-01T00:00:00Z'))
 const started=performance.now()
 await page.evaluate(()=>{window.sessionRequests=[];window.activityRequests=0;window.mountRecent('pending',3)})
 await page.waitForFunction(()=>typeof window.resolveSessions==='function')
 await release(20,3);await all.waitFor()
 assert.equal(await rows.count(),9);assert.equal((await geometry()).list,156)
 assert.equal(await rows.first().locator('strong').textContent(),'Session 0','hidden cron rows do not consume the initial slice')
 assert.equal(await more.count(),0)
 await bottom();await more.waitFor()
 await page.setViewportSize({width:900,height:190});await more.waitFor({state:'detached'})
 await page.setViewportSize({width:900,height:1000});await more.waitFor()
 for(const count of [19,20]){
  const oldTop=await bottom();await more.waitFor();await more.click();await more.waitFor({state:'detached'})
  assert.equal(await rows.count(),count);assert.equal(await list.evaluate(el=>el.scrollTop),oldTop)
  assert.equal((await geometry()).list,156)
  assert.ok(await list.evaluate(el=>el.scrollTop<el.scrollHeight-el.clientHeight))
 }
 await bottom();await frames();assert.equal(await more.count(),0,'filtered-out rows do not count as remaining')
 await page.evaluate(()=>window.setRecentCount(5));await rows.nth(14).waitFor({state:'attached'})
 assert.equal(await rows.count(),15,'changing the setting resets the extra rows')
 assert.equal((await geometry()).list,260);assert.equal(await list.evaluate(el=>el.scrollTop),0)
 assert.equal(await more.count(),0)
 assert.ok(performance.now()-started<15000,'fixture ends before the automatic poll')
 assert.deepEqual(await page.evaluate(()=>window.sessionRequests),[{limit:200,scope:'stored'}],'the clicks issue no extra session.list RPCs')
 assert.equal(await page.evaluate(()=>window.activityRequests),1,'the clicks do not refetch activity ordering')
 console.log('PASS centered loading, configured reserves, bottom-only +10 batches without fetch or scroll jump, inner scrolling, footer, no 200-item notice, short viewport')
}finally{await browser.close()}