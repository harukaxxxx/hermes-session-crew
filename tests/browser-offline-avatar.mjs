import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'
const {chromium}=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())+'/package.json')('playwright')
const browser=await chromium.launch({headless:true,executablePath:(process.env.CHROME_PATH||(()=>{throw Error('Set CHROME_PATH')})())})
try {
 const page=await browser.newPage({viewport:{width:900,height:700},reducedMotion:'reduce'})
 const url=pathToFileURL(path.resolve('tests/sdk-preview.html')).href
 await page.goto(url+'?office&gallery&snapshot')
 await page.evaluate(()=>{const s=document.createElement('style');s.textContent=':root{--ui-green:#1f8a65;--ui-yellow:#c08532}';document.head.append(s)})
 const hit=page.locator('.profile-rail-hit[aria-label^="Aster ·"]')
 await hit.locator('img[data-avatar]').waitFor()
 await page.waitForFunction(()=>window.fixtureStorage?.['completion-snapshot-v2']?.coverage)
 await page.evaluate(async()=>{const p=window.fixtureSnapshot.profiles[0];p.rows=[{seq:1,admission_id:'test',session_id:'id0',status:'terminal',outcome:'completed',generation:1}];p.high_water=1;p.activity={version:1,coverage:'observed',observed_active_count:2,observed_child_active:true,observed_child_count:2,observed_at:Date.now()/1000,unknown_reasons:[],definition:'native active-turn lease'};await window.refreshFixtureSnapshot()})
 const stack=hit.locator('xpath=ancestor::*[@data-avatar-stack]')
 await stack.locator('[data-completion-badge]').waitFor()
 await stack.locator('[data-child-shadow]').first().waitFor()
 await page.locator('#pane').evaluate(e=>e.style.width='160px')
 await page.evaluate(async()=>{window.fixtureSnapshot.profiles[0].activity.observed_child_count=10;await window.refreshFixtureSnapshot()})
 await page.waitForFunction(()=>document.querySelectorAll('[data-child-shadow]').length===11)
 async function state(state,online=true){await page.evaluate(async ({state,online})=>{Object.assign(window.fixtureStatus[0],{state,online});await window.officeClient.refetchQueries({queryKey:['sessioncrew','status']})},{state,online});await page.waitForFunction(s=>document.querySelector('.profile-rail-hit[aria-label^="Aster ·"]')?.dataset.stateName===s,online?state:'offline')}
 for(const s of ['idle','unknown','working','waiting']){
  await state(s);assert.equal(await hit.locator('[data-avatar]').evaluate(e=>getComputedStyle(e).filter),'none')
  const primary=await hit.locator('[data-avatar]').evaluate(e=>({color:getComputedStyle(e).outlineColor,width:getComputedStyle(e).outlineWidth,opacity:getComputedStyle(e).opacity}))
  const shadows=stack.locator('[data-child-shadow]'),rings=stack.locator('[data-child-outline]')
  assert.equal(await rings.count(),await shadows.count(),'every shadow has a ring')
  assert.ok(await rings.count()>7,'exercise the seventh and deeper shadows')
  for(let i=0;i<await rings.count();i++){
   const ring=await rings.nth(i).evaluate(e=>({shadow:getComputedStyle(e).boxShadow,filter:getComputedStyle(e).filter,rect:JSON.stringify(e.getBoundingClientRect().toJSON()),opacity:getComputedStyle(e).opacity,groupOpacity:getComputedStyle(e.parentElement).opacity}))
   assert.equal(ring.shadow,`${i===0?'rgb(31, 138, 101)':'rgb(87, 87, 97)'} 0px 0px 0px 1px inset`,`${s} primary must not tint the shadow frame`)
   assert.equal(ring.filter,'none');assert.equal(ring.opacity,'1');assert.ok(Math.abs(Number(ring.groupOpacity)-Math.max(0,1-(i+1)/7))<0.000001,`shadow ${i+1} opacity: ${ring.groupOpacity}`)
   if(i>=6)assert.equal(Number(ring.groupOpacity),0,`shadow ${i+1} is fully transparent`)
   const face=await shadows.nth(i).evaluate(e=>({rect:JSON.stringify(e.getBoundingClientRect().toJSON()),ringRect:JSON.stringify(e.parentElement.querySelector('[data-child-outline]').getBoundingClientRect().toJSON()),filter:getComputedStyle(e).filter,opacity:getComputedStyle(e).opacity,group:e.parentElement===e.parentElement.querySelector('[data-child-outline]')?.parentElement}))
   assert.equal(face.filter,'none');assert.equal(face.opacity,'1');assert.equal(face.group,true,'face and frame composite in the same opacity group');assert.equal(face.ringRect,face.rect)
  }
  assert.equal(primary.width,'2px');assert.equal(primary.opacity,'1');assert.equal(primary.color,{working:'rgb(31, 138, 101)',waiting:'rgb(192, 133, 50)',idle:'rgb(170, 166, 175)',unknown:'rgb(87, 87, 97)'}[s])
 }
 await state('idle',false)
 assert.equal(await hit.locator('[data-avatar]').evaluate(e=>getComputedStyle(e).filter),'grayscale(1)')
 for(const face of await stack.locator('[data-child-shadow]').all())assert.equal(await face.evaluate(e=>getComputedStyle(e).filter),'grayscale(1)')
 assert.equal(await stack.locator('[data-avatar-outline]').evaluate(e=>getComputedStyle(e).outlineWidth),'2px')
 assert.equal(await stack.locator('[data-avatar-outline]').evaluate(e=>getComputedStyle(e).filter),'none')
 const offlineColor=await stack.locator('[data-avatar-outline]').evaluate(e=>getComputedStyle(e).outlineColor)
 assert.equal(offlineColor,'rgb(113, 109, 120)','offline primary retains its own status color')
 for(const [i,ring] of (await stack.locator('[data-child-outline]').all()).entries()){
  const style=await ring.evaluate(e=>({shadow:getComputedStyle(e).boxShadow,filter:getComputedStyle(e).filter}))
  assert.equal(style.shadow,`${i===0?'rgb(31, 138, 101)':'rgb(87, 87, 97)'} 0px 0px 0px 1px inset`);assert.equal(style.filter,'none')
 }
 assert.equal(await stack.locator('[data-completion-badge]').textContent(),'✋')
 assert.equal(await stack.locator('[data-running-count]').textContent(),'x2')
 const bounds=await hit.evaluate(e=>{const r=e.getBoundingClientRect(),a=e.querySelector('[data-avatar]').getBoundingClientRect();return [r.width,r.height,a.width,a.height]});assert.deepEqual(bounds,[34,34,34,34])
 await hit.hover();await hit.focus();await hit.click();await page.locator('[data-panel-avatar]').waitFor();assert.equal(await hit.getAttribute('data-selected'),'true')
 await page.evaluate(async()=>{Object.assign(window.fixtureStatus[1],{state:'unknown',online:true});await window.officeClient.refetchQueries({queryKey:['sessioncrew','status']})});await page.waitForFunction(()=>{const es=[...document.querySelectorAll('.profile-rail-hit')];return es.findIndex(e=>e.getAttribute('aria-label')?.startsWith('Mika · 狀態 未知'))>=0&&es.at(-1)?.getAttribute('aria-label')?.startsWith('Aster · 狀態 離線')});assert.equal(await hit.getAttribute('data-selected'),'true');assert.equal(await page.locator('[data-slot="popover-content"]').first().locator('strong').first().textContent(),'Aster')
 await state('working');assert.equal(await hit.locator('[data-avatar]').evaluate(e=>getComputedStyle(e).filter),'none');assert.equal(await stack.locator('[data-child-shadow]').first().evaluate(e=>getComputedStyle(e).filter),'none');assert.equal(await stack.locator('[data-avatar-outline]').count(),0);assert.equal(await hit.getAttribute('data-selected'),'true')
 await page.goto(url+'?office');const fallback=page.locator('.profile-rail-hit[aria-label^="Aster ·"]');await fallback.locator('span[data-avatar]').waitFor();await page.evaluate(async()=>{window.fixtureStatus[0].online=false;await window.officeClient.refetchQueries({queryKey:['sessioncrew','status']})});await page.waitForFunction(()=>document.querySelector('.profile-rail-hit[aria-label^="Aster ·"]')?.dataset.stateName==='offline');assert.equal(await fallback.locator('[data-avatar]').textContent(),'A');assert.equal(await fallback.locator('[data-avatar]').evaluate(e=>getComputedStyle(e).filter),'grayscale(1)')
 console.log('PASS actual Rail → AvatarLayers: offline only, online restoration, shadow, fallback, badges, outline, bounds, hover/focus/selection')
} finally {await browser.close()}
