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
 const hit=page.locator('.profile-rail-hit[aria-label^="Aster ·"]')
 await hit.locator('img[data-avatar]').waitFor()
 await page.waitForFunction(()=>window.fixtureStorage?.['completion-snapshot-v2']?.coverage)
 await page.evaluate(async()=>{const p=window.fixtureSnapshot.profiles[0];p.rows=[{seq:1,admission_id:'test',session_id:'id0',status:'terminal',outcome:'completed',generation:1}];p.high_water=1;p.activity={version:1,coverage:'observed',observed_active_count:2,observed_child_active:true,observed_child_count:2,observed_at:Date.now()/1000,unknown_reasons:[],definition:'native active-turn lease'};await window.refreshFixtureSnapshot()})
 const stack=hit.locator('xpath=ancestor::*[@data-avatar-stack]')
 await stack.locator('[data-completion-badge]').waitFor()
 await stack.locator('[data-child-shadow]').first().waitFor()
 async function state(state,online=true){await page.evaluate(async ({state,online})=>{Object.assign(window.fixtureStatus[0],{state,online});await window.officeClient.refetchQueries({queryKey:['profile-rail','status']})},{state,online});await page.waitForFunction(s=>document.querySelector('.profile-rail-hit[aria-label^="Aster ·"]')?.dataset.stateName===s,online?state:'offline')}
 for(const s of ['idle','unknown','working','waiting']){await state(s);assert.equal(await hit.locator('[data-avatar]').evaluate(e=>getComputedStyle(e).filter),'none')}
 await state('idle',false)
 assert.equal(await hit.locator('[data-avatar]').evaluate(e=>getComputedStyle(e).filter),'grayscale(1)')
 assert.equal(await stack.locator('[data-child-shadow]').first().evaluate(e=>getComputedStyle(e).filter),'brightness(0.55) grayscale(1)')
 assert.equal(await stack.locator('[data-avatar-outline]').evaluate(e=>getComputedStyle(e).outlineWidth),'2px')
 assert.equal(await stack.locator('[data-avatar-outline]').evaluate(e=>getComputedStyle(e).filter),'none')
 assert.equal(await stack.locator('[data-completion-badge]').textContent(),'✋')
 assert.equal(await stack.locator('[data-running-count]').textContent(),'x2')
 const bounds=await hit.evaluate(e=>{const r=e.getBoundingClientRect(),a=e.querySelector('[data-avatar]').getBoundingClientRect();return [r.width,r.height,a.width,a.height]});assert.deepEqual(bounds,[34,34,34,34])
 await hit.hover();await hit.focus();await hit.click();await page.locator('[data-panel-avatar]').waitFor();assert.equal(await hit.getAttribute('data-selected'),'true')
 await page.evaluate(async()=>{Object.assign(window.fixtureStatus[1],{state:'unknown',online:true});await window.officeClient.refetchQueries({queryKey:['profile-rail','status']})});await page.waitForFunction(()=>{const es=[...document.querySelectorAll('.profile-rail-hit')];return es.findIndex(e=>e.getAttribute('aria-label')?.startsWith('Mika · state unknown'))>=0&&es.at(-1)?.getAttribute('aria-label')?.startsWith('Aster · state offline')});assert.equal(await hit.getAttribute('data-selected'),'true');assert.equal(await page.locator('[data-slot="popover-content"]').first().locator('strong').first().textContent(),'Aster')
 await state('working');assert.equal(await hit.locator('[data-avatar]').evaluate(e=>getComputedStyle(e).filter),'none');assert.equal(await stack.locator('[data-child-shadow]').first().evaluate(e=>getComputedStyle(e).filter),'brightness(0.55)');assert.equal(await stack.locator('[data-avatar-outline]').count(),0);assert.equal(await hit.getAttribute('data-selected'),'true')
 await page.goto(url+'?office');const fallback=page.locator('.profile-rail-hit[aria-label^="Aster ·"]');await fallback.locator('span[data-avatar]').waitFor();await page.evaluate(async()=>{window.fixtureStatus[0].online=false;await window.officeClient.refetchQueries({queryKey:['profile-rail','status']})});await page.waitForFunction(()=>document.querySelector('.profile-rail-hit[aria-label^="Aster ·"]')?.dataset.stateName==='offline');assert.equal(await fallback.locator('[data-avatar]').textContent(),'A');assert.equal(await fallback.locator('[data-avatar]').evaluate(e=>getComputedStyle(e).filter),'grayscale(1)')
 console.log('PASS actual Rail → AvatarLayers: offline only, online restoration, shadow, fallback, badges, outline, bounds, hover/focus/selection')
} finally {await browser.close()}
