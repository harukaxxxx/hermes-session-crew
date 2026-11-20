import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'

const {chromium}=createRequire(process.env.HERMES_CHECKOUT+'/package.json')('playwright')
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH})
try{
 const page=await browser.newPage({viewport:{width:900,height:700}})
 await page.clock.install({time:new Date('2026-01-01T12:00:00Z')})
 await page.addInitScript(()=>{
  window.fixtureOwners={one:'Aster'};window.fixtureSources={one:'desktop'}
  window.fixtureActivityRequest=(route,method)=>Promise.resolve({sessions:route.profile==='Aster'&&method==='session.active_list'?(window.asterActivity||[]):[]})
 })
 const url=pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?office&snapshot&locale=en'
 await page.goto(url+'&developer')
 const hit=page.locator('.profile-rail-hit[aria-label^="Aster ·"]'),stack=hit.locator('xpath=ancestor::*[@data-avatar-stack]')
 const timer=stack.locator('[data-elapsed-minutes]'),dot=stack.locator('[data-completion-badge]'),hand=stack.locator('[data-avatar-waiting]')
 const anyTimer=stack.locator('[data-idle-minutes],[data-elapsed-minutes]')
 await hit.waitFor()
 const status=fields=>page.evaluate(async fields=>{
  window.fixtureStatus[0]={profile:'Aster',online:true,...fields}
  await window.officeClient.refetchQueries({queryKey:['sessioncrew','status'],type:'active'})
 },fields)
 const activity=(...states)=>page.evaluate(async states=>{
  window.asterActivity=states.map(([id,status])=>({id,session_key:id,source:'desktop',status}))
  await window.officeClient.refetchQueries({queryKey:['sessioncrew','profile-input-waiting'],type:'active'})
 },states)
 const complete=async seq=>{
  await page.waitForFunction(()=>window.fixtureStorage['completion-snapshot-v2']?.coverage)
  await page.evaluate(seq=>{
   const p=window.fixtureSnapshot.profiles[0];p.high_water=seq;p.rows.push({seq,admission_id:'done'+seq,session_id:'one',session_source:'desktop',status:'terminal',outcome:'completed',generation:1});return window.refreshFixtureSnapshot()
  },seq)
 }
 const expectTimer=async (text,title)=>{
  assert.equal(await hit.getAttribute('data-state-name'),'online_unobserved','elapsed time must not change profile status')
  assert.equal(await anyTimer.count(),1,'expected a visible elapsed label below the marker')
  assert.equal(await anyTimer.innerText(),text)
  assert.match(await hit.getAttribute('title'),title)
  assert.ok(await timer.evaluate(x=>{const a=x.getBoundingClientRect(),r=x.closest('[data-profile-rail]').getBoundingClientRect(),b=x.parentElement.querySelector('[data-avatar-waiting],[data-completion-badge]').getBoundingClientRect();return a.width>0&&a.left-1>=r.left&&a.right+1<=r.right&&a.bottom+1<=r.bottom&&a.top-1>=b.bottom}),'visible outlined timer and marker fit the narrow rail without overlap')
 }
 const mixed={state:'online_unobserved',busy:null,idle_since:null,status_observation:'fresh_shared_gateway_no_observed_owner_work',shared_gateway_observation:'positive'}
 await status(mixed);await hit.and(page.locator('[data-state-name="online_unobserved"]')).waitFor()
 if(process.argv[2]!=='wait'){
  await complete(1);await dot.waitFor();await expectTimer('0h0m',/since an unread completion was observed/i)
  await page.clock.runFor(61000);await expectTimer('0h1m',/since an unread completion was observed/i)
  await page.evaluate(()=>window.fixtureSetLocale('zh-hant'));await page.waitForFunction(()=>document.querySelector('.profile-rail-hit[aria-label^="Aster ·"]').title.includes('觀察到未讀完成'))
  await page.evaluate(()=>window.fixtureSetLocale('en'))
  await activity(['one','working']);await hit.and(page.locator('[data-state-name="working"]')).waitFor();assert.equal(await timer.count(),0,'working cannot display the completion timer')
  await activity();await hit.and(page.locator('[data-state-name="online_unobserved"]')).waitFor();assert.equal(await timer.count(),0,'work fences off earlier completion timing even when the dot remains')
  assert.equal(await dot.count(),1,'execution does not acknowledge unread')
 }
 if(process.argv[2]!=='unread'){
  await status({state:'idle',idle_since:await page.evaluate(()=>Date.now()/1000-1800)});await stack.locator('[data-idle-minutes]').waitFor()
  await activity(['one','waiting']);await hand.waitFor();await status(mixed)
  await expectTimer('0h0m',/since the current input wait was first observed/i)
  assert.equal(await stack.locator('[data-idle-minutes]').count(),0,'pre-wait idle is invalidated, not relabelled')
  assert.equal(await dot.count(),0,'the hand still has visual priority over unread')
  await page.clock.runFor(61000);await expectTimer('0h1m',/since the current input wait was first observed/i)
  await page.evaluate(()=>window.fixtureSetLocale('zh-hant'));await page.waitForFunction(()=>document.querySelector('.profile-rail-hit[aria-label^="Aster ·"]').title.includes('觀察到目前等待輸入'))
  await page.evaluate(()=>window.fixtureSetLocale('en'))
  await page.evaluate(()=>window.fixtureOwners.one='Mika');await activity(['one','waiting']);await hand.waitFor({state:'detached'})
  assert.equal(await anyTimer.count(),0,'an owner mismatch cannot keep a waiting timer alive')
  await page.evaluate(()=>window.fixtureOwners.one='Aster');await activity(['one','waiting']);await hand.waitFor();await expectTimer('0h0m',/since the current input wait was first observed/i)
  await activity();await hand.waitFor({state:'detached'});assert.equal(await timer.count(),0,'clearing the wait does not revive an old elapsed origin')
  await activity(['one','waiting']);await hand.waitFor();await expectTimer('0h0m',/since the current input wait was first observed/i)
  await page.evaluate(()=>window.fixtureSetGateway('closed'));await hand.waitFor({state:'detached'});assert.equal(await timer.count(),0,'a gateway scope change discards the in-memory wait clock')
 }
 if(!process.argv[2]){
  // A backend process or delegation wait is not an input request. It does
  // not use the hand clock, and it must not hide the unread marker.
  await page.evaluate(()=>window.fixtureSetGateway('open'));await activity()
  await status(mixed);await dot.waitFor()
  assert.equal(await anyTimer.count(),0,'reconnect keeps the unread record without reviving its old clock')
  await status({state:'waiting',waiting:true,busy:false,idle_since:null,waiting_sources:['process'],waiting_count:1})
  await hit.and(page.locator('[data-state-name="waiting"]')).waitFor();await dot.waitFor()
  assert.equal(await hand.count(),0,'background process wait does not get the input hand')
  assert.equal(await anyTimer.count(),0,'background process wait has no elapsed origin in the public row')
  await page.goto(url);await hit.waitFor();await status(mixed);await complete(1);await dot.waitFor()
  assert.equal(await anyTimer.count(),0,'elapsed timing stays opt-in')
 }
 console.log('PASS developer elapsed timing and marker precedence')
}finally{await browser.close()}