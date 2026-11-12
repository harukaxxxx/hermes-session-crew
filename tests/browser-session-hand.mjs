import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';import path from 'node:path';import assert from 'node:assert/strict'
const {chromium}=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())+'/package.json')('playwright')
const browser=await chromium.launch({headless:true,executablePath:(process.env.CHROME_PATH||(()=>{throw Error('Set CHROME_PATH')})())}),page=await browser.newPage({viewport:{width:900,height:700},reducedMotion:'reduce'})
try{
 await page.addInitScript(()=>{window.fixtureActivity={sessions:[{id:'id0',session_key:'id0',source:'desktop',status:'working'}]};window.fixtureOwners={id0:'Aster'};window.fixtureSources={id0:'desktop'};window.fixtureRoster={sessions:[]}})
 await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?office&gallery&snapshot');await page.waitForFunction(()=>window.fixtureStorage?.['completion-snapshot-v2']?.coverage)
 await page.evaluate(async()=>{const p=window.fixtureSnapshot.profiles[0];p.rows=['id0','id1'].map((session_id,i)=>({seq:i+1,admission_id:'turn'+i,session_id,status:'terminal',outcome:'completed',generation:i+1}));p.high_water=2;await window.refreshFixtureSnapshot()})
 await page.locator('[data-completion-badge]').first().waitFor();await page.locator('.profile-rail-hit').first().click();await page.locator('[data-recent-row]').first().waitFor()
 const rows=page.locator('[data-recent-row]'),hand=rows.nth(0).locator('[data-session-completion-badge]');assert.equal(await rows.nth(1).locator('[data-session-completion-badge]').count(),1);assert.equal(await rows.nth(2).locator('[data-session-completion-badge]').count(),0)
 for(const marker of [hand,page.locator('[data-completion-badge]').first()]){
  const visual=await marker.evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {width:r.width,height:r.height,radius:s.borderRadius,background:s.backgroundColor,text:e.textContent,foreground:s.color}})
  assert.equal(visual.width,14);assert.equal(visual.height,14);assert.equal(visual.radius,'50%');assert.equal(visual.background,'rgb(229, 57, 53)');assert.equal(visual.text,'');assert.notEqual(visual.background,visual.foreground)
 }
 const geometry=await hand.evaluate(e=>{const a=e.getBoundingClientRect(),b=e.closest('button').getBoundingClientRect();return {top:a.top-b.top,left:a.left-b.left,inside:a.right<=b.right&&a.bottom<=b.bottom}});assert.deepEqual(geometry,{top:0,left:0,inside:true})
 const overlap=await hand.evaluate(e=>{const a=e.getBoundingClientRect(),b=e.closest('button').querySelector('strong').getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top});assert.equal(overlap,false,'unread circle does not overlap row title')
 await rows.nth(0).locator('[data-session-arc]').waitFor();assert.equal(await hand.count(),1,'working arc and unread coexist')
 await page.screenshot({path:'evidence/unread-circles-controlled.png'})
 await page.evaluate(()=>{window.fixtureActivity.sessions[0].status='waiting';window.emitFixtureGatewayEvent({type:'gateway.ready'})})
 const waiting=rows.nth(0).locator('[data-session-waiting]');await waiting.waitFor();assert.equal(await hand.count(),0,'waiting takes priority')
 const waitingSize=await waiting.evaluate(e=>({fontSize:getComputedStyle(e).fontSize,height:e.getBoundingClientRect().height}));assert.equal(waitingSize.fontSize,'14px');assert.equal(waitingSize.height,14)
 await page.locator('[data-avatar-waiting]').waitFor();assert.equal(await page.locator('[data-completion-badge]').count(),0)
 await page.evaluate(()=>{window.fixtureActivity.sessions=[];window.emitFixtureGatewayEvent({type:'gateway.ready'})});await hand.waitFor()
 await rows.nth(0).click();await page.waitForFunction(()=>window.openCalls?.length===1);await page.locator('.profile-rail-hit').first().click();await page.locator('[data-recent-row]').first().waitFor();assert.equal(await rows.nth(0).locator('[data-session-completion-badge]').count(),0);assert.equal(await rows.nth(1).locator('[data-session-completion-badge]').count(),1)
 console.log('PASS Chromium row markers at upper-left and per-session click acknowledgement')
}finally{await browser.close()}
