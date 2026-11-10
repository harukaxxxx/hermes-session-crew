import {createRequire} from 'node:module'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
const checkout=process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT
const require=createRequire(checkout+'/package.json'),{build}=require('esbuild'),{chromium}=require('playwright')
const source=await readFile('desktop/plugin.js','utf8')
const sdk=`export const host={requestProfile:(...a)=>window.fixtureRequest(...a),state:{connectionId:{get:()=> 'c'},profile:{get:()=> 'alpha'}}}; export {useQuery} from '@tanstack/react-query'; export const useValue=x=>x.get(); export const Popover=()=>null,PopoverContent=()=>null,PopoverTrigger=()=>null;`
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {Recent} from 'fixture-plugin';
const root=createRoot(document.getElementById('root'));const owner={connectionId:'c',name:'alpha',route:{connectionId:'c',profile:'alpha',targetProfile:'alpha',mode:'remote'}};let client,instance=0;
window.mountRecent=(mode)=>{client?.clear();instance++;window.resolveSessions=null;window.rejectSessions=null;client=new QueryClient({defaultOptions:{queries:{retry:false}}});window.renderRecent(mode)};
window.renderRecent=(mode)=>root.render(React.createElement(QueryClientProvider,{client,key:instance},React.createElement('div',{'data-bubble':true,style:{width:310,maxHeight:'min(360px, calc(100vh - 24px))',display:'flex',flexDirection:'column',padding:16,border:'1px solid'}},React.createElement('div',null,'Header'),React.createElement(Recent,{owner:mode==='route'||mode==='route-error'?null:owner,phase:mode==='route'?'loading':'route error',retryRoutes:()=>{},onOpened:()=>{},completion:{watermark:()=>[],coverageReady:false,ackAll:()=>{}}}),React.createElement('div',{'data-outer-footer':true,style:{height:30,flexShrink:0}},'Footer'))));`
const out=path.resolve('tests/recent-reserve-bundle.js')
await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'js'},bundle:true,format:'iife',outfile:out,nodePaths:[checkout+'/node_modules'],plugins:[{name:'fixture',setup(b){b.onResolve({filter:/^(fixture-plugin|@hermes\/plugin-sdk)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='fixture-plugin'?source+'\nexport {Recent};':sdk,resolveDir:process.cwd(),loader:'js'}))}}],logLevel:'silent'})
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH})
try{
 const page=await browser.newPage({viewport:{width:900,height:700}})
 await page.setContent('<style>*{box-sizing:border-box}body{font:14px system-ui}button{font:inherit}</style><div id="root"></div>')
 await page.addScriptTag({path:out})
 await page.evaluate(()=>{window.fixtureRequest=(_route,method)=>method==='session.list'?new Promise((resolve,reject)=>{window.resolveSessions=resolve;window.rejectSessions=reject}):Promise.resolve({projects:[]});window.mountRecent('route')})
 const list=page.locator('[data-recent-list]'),bubble=page.locator('[data-bubble]')
 const geometry=()=>page.evaluate(()=>({list:document.querySelector('[data-recent-list]').getBoundingClientRect().height,bubble:document.querySelector('[data-bubble]').getBoundingClientRect().height,footer:document.querySelector('[data-outer-footer]').getBoundingClientRect().top}))
 await list.waitFor();const route=await geometry();assert.equal(route.list,156)
 await page.evaluate(()=>window.renderRecent('route-error'));await page.getByText('route error').waitFor();assert.deepEqual(await geometry(),route)
 for(const n of [0,1,2,3,24,200]){
  await page.evaluate(()=>window.mountRecent('pending'));await page.waitForFunction(()=>typeof window.resolveSessions==='function');const pending=await geometry();assert.deepEqual(pending,route)
  const centers=await list.evaluate(el=>{const text=document.createTreeWalker(el,NodeFilter.SHOW_TEXT).nextNode();const range=document.createRange();range.selectNodeContents(text);const a=el.getBoundingClientRect(),b=range.getBoundingClientRect();return {text:text.textContent,dx:(b.left+b.right-a.left-a.right)/2,dy:(b.top+b.bottom-a.top-a.bottom)/2}})
  assert.match(centers.text,/Loading sessions|載入工作階段/);assert.ok(Math.abs(centers.dx)<=1,`loading text horizontal center offset: ${centers.dx}px`);assert.ok(Math.abs(centers.dy)<=1,`loading text vertical center offset: ${centers.dy}px`)
  await page.evaluate(n=>{const resolve=window.resolveSessions;window.resolveSessions=null;resolve({sessions:Array.from({length:n},(_,i)=>({id:'id'+i,title:'Session '+i}))})},n)
  await page.waitForFunction(n=>document.querySelectorAll('[data-recent-row]').length===Math.min(3,n)&&!!document.querySelector('[data-recent-footer]'),n)
  assert.deepEqual(await geometry(),route,`loaded ${n}`)
  if(n===200)assert.equal(await bubble.getByText(/Showing at most 200 fetched items|最多顯示已取得的 200 筆/).count(),0,'no visible 200-item limit notice')
  assert.equal(await page.locator('[data-recent-scroll-cue]').count(),0,'no scrollbar cue when rows fit')
  if(n===24||n===200){const width=await page.locator('[data-recent-row]').first().evaluate(el=>el.getBoundingClientRect().width);for(const count of [13,23]){await page.locator('[data-recent-more]').click();assert.equal(await page.locator('[data-recent-row]').count(),count);assert.deepEqual(await geometry(),route,'load more preserves list and footer geometry');assert.ok(await list.evaluate(el=>el.scrollHeight>el.clientHeight));await page.locator('[data-recent-scroll-cue]').waitFor({state:'visible'});assert.equal(await page.locator('[data-recent-row]').first().evaluate(el=>el.getBoundingClientRect().width),width,'cue does not shift row width');const top=await page.locator('[data-recent-scroll-thumb]').evaluate(el=>el.getBoundingClientRect().top);await list.evaluate(el=>{el.scrollTop=el.scrollHeight});await page.waitForFunction(()=>document.querySelector('[data-recent-list]').scrollTop>0);await page.waitForFunction(t=>document.querySelector('[data-recent-scroll-thumb]').getBoundingClientRect().top>t,top);assert.ok(await page.locator('[data-completion-read-all]').isVisible())}}
 }
 const thumb=page.locator('[data-recent-scroll-thumb]'),thumbBox=await thumb.boundingBox();await page.mouse.move(thumbBox.x+thumbBox.width/2,thumbBox.y+thumbBox.height/2);await page.mouse.down();await page.mouse.move(thumbBox.x+thumbBox.width/2,thumbBox.y-45,{steps:4});await page.mouse.up();assert.ok(await list.evaluate(el=>el.scrollTop<el.scrollHeight-el.clientHeight),'dragging the thumb scrolls the list')
 await page.evaluate(()=>window.mountRecent('pending'));await page.waitForFunction(()=>typeof window.rejectSessions==='function');await page.evaluate(()=>{window.rejectSessions(Error('fixture failure'));window.rejectSessions=null});await page.getByText(/fixture failure/).waitFor();assert.deepEqual(await geometry(),route)
 await page.setViewportSize({width:900,height:200});assert.ok((await bubble.boundingBox()).height<=176);assert.ok((await list.boundingBox()).height<156,'list shrinks in a short viewport');assert.ok(await page.locator('[data-outer-footer]').isVisible())
 console.log('PASS centered loading; 156px reserve, +10 load-more, inner scrolling, footer, no 200-item notice, short viewport')
}finally{await browser.close()}