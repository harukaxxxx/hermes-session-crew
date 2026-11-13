import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'
const {chromium}=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())+'/package.json')('playwright')
const browser=await chromium.launch({headless:true,executablePath:(process.env.CHROME_PATH||(()=>{throw Error('Set CHROME_PATH')})())})
try{
 const page=await browser.newPage({viewport:{width:900,height:700},reducedMotion:'reduce'})
 await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?office&gallery&snapshot')
 const hit=page.locator('.profile-rail-hit[aria-label^="Aster ·"]');await hit.locator('[data-avatar]').waitFor();await page.waitForFunction(()=>window.fixtureStorage?.['completion-snapshot-v2']?.coverage)
 for(const childCount of [2,3,50]){
  await page.evaluate(async childCount=>{const p=window.fixtureSnapshot.profiles[0];p.rows=[{seq:1,admission_id:'test',session_id:'id0',status:'terminal',outcome:'completed',generation:1}];p.high_water=1;const children=Array.from({length:childCount},(_,i)=>({id:'child'+i,kind:i%2?'queued':'recent',leased:false}));p.activity={version:1,coverage:'observed',observed_active_count:2,observed_child_active:false,observed_child_count:0,observed_at:Date.now()/1000,unknown_reasons:['bounded_observation'],definition:'native active-turn lease',child_metadata:{availability:'available',presentation_count:childCount,children,truncated:false}};await window.refreshFixtureSnapshot()},childCount)
  await page.waitForFunction(n=>{const e=document.querySelector('[data-avatar-stack]');return e&&Math.abs(e.getBoundingClientRect().width-Math.min(34+6*(n+1),document.querySelector('[data-profile-rail]').clientWidth-8))<1},childCount)
  const m=await hit.evaluate(e=>{const rail=e.closest('[data-profile-rail]').getBoundingClientRect(),a=e.getBoundingClientRect(),stack=e.closest('[data-avatar-stack]'),s=stack.getBoundingClientRect(),h=stack.querySelector('[data-completion-badge]')?.getBoundingClientRect(),n=stack.querySelector('[data-running-count]')?.getBoundingClientRect();return {rail:rail.width,left:a.left-rail.left,width:a.width,stack:s.width,shadows:stack.querySelectorAll('[data-child-shadow]').length,hand:h&&h.left-a.left,badge:n&&n.left-a.left,label:e.getAttribute('aria-label')}})
  assert.equal(m.width,34);assert.ok(Math.abs(m.left-(m.rail-Math.min(34+6*(childCount+1),m.rail-8))/2)<1,JSON.stringify(m));assert.equal(m.shadows,Math.min(childCount+1,Math.ceil((m.rail-8-6)/6)));assert.ok(Math.abs(m.hand-28)<1);assert.ok(Math.abs(m.badge-26)<1);assert.match(m.label,/非執行證明/)
 }
 const children=[{id:'recent',kind:'recent',leased:false},{id:'queued',kind:'queued',leased:false},{id:'leased',kind:'recent',leased:true},{id:'ended',kind:'ended',leased:false}]
 const update=async (rows,metadata=true)=>page.evaluate(async ({rows,metadata})=>{const a=window.fixtureSnapshot.profiles[0].activity;a.observed_active_count=2;a.observed_child_count=2;if(metadata)a.child_metadata={availability:'available',presentation_count:rows.filter(x=>['queued','recent'].includes(x.kind)).length,children:rows,truncated:false};else delete a.child_metadata;await window.refreshFixtureSnapshot()},{rows,metadata})
 const colors=()=>hit.locator('xpath=ancestor::*[@data-avatar-stack]').locator('[data-child-outline]').evaluateAll(es=>es.map(e=>e.style.boxShadow))
 await update(children);await page.waitForFunction(()=>document.querySelectorAll('[data-child-outline]').length===4)
 let c=await colors();assert.match(c[0],/--ui-green/);assert.match(c[1],/--ui-stroke-secondary/);assert.match(c[2],/--ui-yellow/);assert.match(c[3],/--ui-green/)
 await page.evaluate(async()=>{Object.assign(window.fixtureStatus[0],{state:'idle',online:false});await window.officeClient.refetchQueries({queryKey:['sessioncrew','status']})});await page.waitForFunction(()=>document.querySelector('.profile-rail-hit[aria-label^="Aster ·"]')?.dataset.stateName==='offline');assert.deepEqual(await colors(),c)
 await update([children[2],children[1],children[0],children[3]]);await page.waitForFunction(()=>document.querySelectorAll('[data-child-outline]')[1]?.style.boxShadow.includes('--ui-green'))
 c=await colors();assert.match(c[1],/--ui-green/);assert.match(c[2],/--ui-yellow/);assert.match(c[3],/--ui-stroke-secondary/)
 await update([],false);await page.waitForFunction(()=>document.querySelectorAll('[data-child-outline]').length===3)
 c=await colors();assert.match(c[0],/--ui-green/);assert.ok(c.slice(1).every(x=>x.includes('--ui-stroke-secondary')))
 await page.evaluate(async()=>{window.fixtureSnapshot.profiles[0].activity.child_metadata={availability:'unknown',children:[],presentation_count:0};await window.refreshFixtureSnapshot()});await page.waitForFunction(()=>document.querySelectorAll('[data-child-outline]').length===1);assert.match((await colors())[0],/--ui-green/)
 console.log('PASS metadata colors, reordering and aggregate fallback; bounded stack geometry')
}finally{await browser.close()}
