import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'
const {chromium}=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())+'/package.json')('playwright')
const browser=await chromium.launch({headless:true,executablePath:(process.env.CHROME_PATH||(()=>{throw Error('Set CHROME_PATH')})())})
try{
 const page=await browser.newPage({viewport:{width:900,height:700},reducedMotion:'reduce'})
 await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?office&gallery&snapshot')
 const hit=page.locator('.profile-rail-hit').first();await hit.locator('[data-avatar]').waitFor();await page.waitForFunction(()=>window.fixtureStorage?.['completion-snapshot-v2']?.coverage)
 for(const childCount of [2,3,50]){
  await page.evaluate(async childCount=>{const p=window.fixtureSnapshot.profiles[0];p.rows=[{seq:1,admission_id:'test',session_id:'id0',status:'terminal',outcome:'completed',generation:1}];p.high_water=1;const children=Array.from({length:childCount},(_,i)=>({id:'child'+i,kind:i%2?'queued':'recent',leased:false}));p.activity={version:1,coverage:'observed',observed_active_count:2,observed_child_active:false,observed_child_count:0,observed_at:Date.now()/1000,unknown_reasons:['bounded_observation'],definition:'native active-turn lease',child_metadata:{availability:'available',presentation_count:childCount,children,truncated:false}};await window.refreshFixtureSnapshot()},childCount)
  await page.waitForFunction(n=>{const e=document.querySelector('[data-avatar-stack]');return e&&Math.abs(e.getBoundingClientRect().width-Math.min(34+6*(n+1),document.querySelector('[data-profile-rail]').clientWidth-8))<1},childCount)
  const m=await hit.evaluate(e=>{const rail=e.closest('[data-profile-rail]').getBoundingClientRect(),a=e.getBoundingClientRect(),stack=e.closest('[data-avatar-stack]'),s=stack.getBoundingClientRect(),h=stack.querySelector('[data-completion-badge]')?.getBoundingClientRect(),n=stack.querySelector('[data-running-count]')?.getBoundingClientRect();return {rail:rail.width,left:a.left-rail.left,width:a.width,stack:s.width,shadows:stack.querySelectorAll('[data-child-shadow]').length,hand:h&&h.left-a.left,badge:n&&n.left-a.left,label:e.getAttribute('aria-label')}})
  assert.equal(m.width,34);assert.ok(Math.abs(m.left-(m.rail-Math.min(34+6*(childCount+1),m.rail-8))/2)<1,JSON.stringify(m));assert.equal(m.shadows,Math.min(childCount+1,Math.ceil((m.rail-8-6)/6)));assert.ok(Math.abs(m.hand-26)<1);assert.ok(Math.abs(m.badge-26)<1);assert.match(m.label,/非執行證明/)
 }
 console.log('PASS own metadata schema: 2/3/50 child shadows, centered capped clip, 34px trigger, ✋ and x2')
}finally{await browser.close()}
