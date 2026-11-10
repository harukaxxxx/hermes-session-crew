import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'
const {chromium}=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())+'/package.json')('playwright')
const browser=await chromium.launch({headless:true,executablePath:(process.env.CHROME_PATH||(()=>{throw Error('Set CHROME_PATH')})())})
const page=await browser.newPage({viewport:{width:900,height:700},reducedMotion:'reduce'})
try {
 await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?office&gallery&snapshot')
 const a=page.locator('.profile-rail-hit').first()
 await a.locator('[data-avatar]').waitFor()
 await page.waitForFunction(()=>window.fixtureStorage?.['completion-snapshot-v2']?.coverage)
 await page.evaluate(async()=>{const p=window.fixtureSnapshot.profiles[0];p.rows=[{seq:1,admission_id:'test',session_id:'id0',status:'terminal',outcome:'completed',generation:1}];p.high_water=1;p.activity={version:1,coverage:'observed',observed_active_count:2,observed_child_active:true,observed_child_count:2,observed_at:Date.now()/1000,unknown_reasons:['bounded_observation'],definition:'native active-turn lease'};await window.refreshFixtureSnapshot()})
 const stack=a.locator('xpath=ancestor::*[@data-avatar-stack]');await stack.locator('[data-running-count]').waitFor();await stack.locator('[data-completion-badge]').waitFor();assert.equal(await stack.locator('[data-child-shadow]').count(),3)
 const geometry=await a.evaluate(e=>{const q=s=>e.closest('[data-avatar-stack]').querySelector(s),avatar=q('[data-avatar]'),shadow=q('[data-child-shadow]'),hand=q('[data-completion-badge]'),count=q('[data-running-count]'),r=avatar.getBoundingClientRect(),s=shadow.getBoundingClientRect(),h=hand.getBoundingClientRect(),c=count.getBoundingClientRect();return {width:r.width,height:r.height,radius:getComputedStyle(avatar).borderRadius,dx:s.left-r.left,behind:+getComputedStyle(shadow).zIndex<+getComputedStyle(avatar).zIndex,filter:getComputedStyle(shadow).filter,handTop:h.top<r.top,countBottom:c.bottom>=r.bottom,nonoverlap:h.bottom<=c.top,text:count.textContent}})
 assert.deepEqual(geometry,{width:34,height:34,radius:'22%',dx:6,behind:true,filter:'brightness(0.55)',handTop:true,countBottom:true,nonoverlap:true,text:'x2'})
 assert.match(await a.getAttribute('aria-label'),/已觀察到 2 個/)
 await a.hover();await page.screenshot({path:'evidence/activity-controlled-hover.png'})
 await a.click();const panel=page.locator('[data-slot="popover-content"]').first();await panel.waitFor();assert.doesNotMatch(await panel.innerText(),/已觀察到.*執行中的 turn|native active-turn lease|可能有遺漏/);assert.equal(await panel.locator('[data-activity-scope]').count(),0)
 await page.screenshot({path:'evidence/activity-controlled-selected.png'})
 await page.evaluate(async()=>{window.fixtureSnapshot.profiles[0].activity.coverage='unavailable';await window.refreshFixtureSnapshot()})
 await page.waitForFunction(()=>!document.querySelector('[data-running-count]')&&!document.querySelector('[data-child-shadow]'))
 await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?office&gallery&snapshot&locale=en')
 await page.waitForFunction(()=>window.fixtureStorage?.['completion-snapshot-v2']?.coverage)
 await page.evaluate(async()=>{window.fixtureSnapshot.profiles[0].activity={version:1,coverage:'observed',observed_active_count:2,observed_child_active:true,observed_child_count:2,observed_at:Date.now()/1000,unknown_reasons:['bounded_observation'],definition:'native active-turn lease'};await window.refreshFixtureSnapshot()})
 await page.locator('[data-running-count]').first().waitFor()
 assert.match(await page.locator('.profile-rail-hit').first().getAttribute('aria-label'),/Observed 2 active turns; only verifiable native active-turn leases are covered\. Work may be missing; this is not all work\./)
 console.log('PASS controlled Chromium snapshot → x2 + child + ✋; bounds, accessible scope, no visible debug, unknown')
} finally {await browser.close()}
