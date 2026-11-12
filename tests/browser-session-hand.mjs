import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';import path from 'node:path';import assert from 'node:assert/strict'
const {chromium}=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())+'/package.json')('playwright')
const browser=await chromium.launch({headless:true,executablePath:(process.env.CHROME_PATH||(()=>{throw Error('Set CHROME_PATH')})())}),page=await browser.newPage({viewport:{width:900,height:700},reducedMotion:'reduce'})
try{
 await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?office&gallery&snapshot');await page.waitForFunction(()=>window.fixtureStorage?.['completion-snapshot-v2']?.coverage)
 await page.evaluate(async()=>{const p=window.fixtureSnapshot.profiles[0];p.rows=['id0','id1'].map((session_id,i)=>({seq:i+1,admission_id:'turn'+i,session_id,status:'terminal',outcome:'completed',generation:i+1}));p.high_water=2;await window.refreshFixtureSnapshot()})
 await page.locator('[data-completion-badge]').first().waitFor();await page.locator('.profile-rail-hit').first().click();await page.locator('[data-recent-row]').first().waitFor()
 const rows=page.locator('[data-recent-row]'),hand=rows.nth(0).locator('[data-session-completion-badge]');assert.equal(await hand.textContent(),'●');assert.equal(await rows.nth(1).locator('[data-session-completion-badge]').count(),1);assert.equal(await rows.nth(2).locator('[data-session-completion-badge]').count(),0)
 const geometry=await hand.evaluate(e=>{const a=e.getBoundingClientRect(),b=e.closest('button').getBoundingClientRect();return {top:a.top-b.top,left:a.left-b.left,inside:a.right<=b.right&&a.bottom<=b.bottom}});assert.deepEqual(geometry,{top:0,left:0,inside:true})
 await rows.nth(0).click();await page.waitForFunction(()=>window.openCalls?.length===1);await page.locator('.profile-rail-hit').first().click();await page.locator('[data-recent-row]').first().waitFor();assert.equal(await rows.nth(0).locator('[data-session-completion-badge]').count(),0);assert.equal(await rows.nth(1).locator('[data-session-completion-badge]').count(),1)
 console.log('PASS Chromium row markers at upper-left and per-session click acknowledgement')
}finally{await browser.close()}
