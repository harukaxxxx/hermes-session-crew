import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'
const {chromium}=createRequire(process.env.HERMES_CHECKOUT+'/package.json')('playwright')
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH})
try{
 const page=await browser.newPage({viewport:{width:900,height:600},reducedMotion:'reduce'})
 await page.clock.install({time:new Date('2026-01-01T12:00:00Z')})
 await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?office&gallery&snapshot&developer&locale=en')
 await page.addStyleTag({content:':root{--ui-green:#1f8a65;--ui-yellow:#c08532;--ui-text-secondary:#8191a1}'})
 const hit=name=>page.locator(`.profile-rail-hit[aria-label^="${name} ·"]`)
 const aster=hit('Aster'),mika=hit('Mika'),stack=aster.locator('xpath=ancestor::*[@data-avatar-stack]'),child=stack.locator('[data-child-outline]'),idle=stack.locator('[data-idle-minutes]')
 const state=async expected=>aster.and(page.locator(`[data-state-name="${expected}"]`)).waitFor({timeout:3000})
 const ring=target=>target.locator('[data-avatar]').evaluate(e=>{const c=getComputedStyle(e);return [c.outlineColor,c.outlineWidth,c.outlineStyle,e.getBoundingClientRect().width]})
 const rpc=async status=>page.evaluate(async status=>{
  window.fixtureOwners={id0:'Aster'};window.fixtureSources={id0:'cli'}
  window.fixtureActivityRequest=(route,method)=>method==='session.active_list'&&route.profile==='Aster'&&status?{sessions:[{id:'id0',session_key:'id0',source:'cli',status}]}:{sessions:[]}
  await window.officeClient.refetchQueries({queryKey:['sessioncrew','profile-input-waiting'],type:'active'})
 },status)
 const publish=async (fields={},proof=null)=>page.evaluate(async ({fields,proof})=>{
  const now=Date.now()/1000
  window.fixtureStatus[0]={profile:'Aster',online:true,state:'working',status_observation:'recent_session_activity',active_turn:true,
   ...(proof&&{oneshot_activity:{observed_at:now+proof[0],expires_at:now+proof[1]}}),...fields}
  await window.officeClient.refetchQueries({queryKey:['sessioncrew','status'],type:'active'})
 },{fields,proof})
 await aster.waitFor()
 await page.evaluate(async()=>{window.fixtureSnapshot.profiles[0].activity={version:1,coverage:'observed',definition:'native active-turn lease',observed_active_count:1,observed_child_active:true,observed_child_count:1,observed_at:Date.now()/1000,unknown_reasons:[],child_metadata:{availability:'available',presentation_count:1,children:[{id:'child',kind:'recent',leased:true}]}};await window.refreshFixtureSnapshot()})
 await child.waitFor()
 await publish();await state('online_unobserved')
 const originalChild=await child.evaluate(e=>{const r=e.getBoundingClientRect();return [getComputedStyle(e).boxShadow,r.width,r.height,e.parentElement.style.opacity]})
 assert.match(originalChild[0],/rgb\(31, 138, 101\)/);assert.deepEqual(originalChild.slice(1,3),[34,34]);assert.equal(await idle.count(),0,'raw active_turn suppresses the timer, but stays neutral')
 const normal=await ring(mika);assert.deepEqual(normal,['rgb(31, 138, 101)','2px','solid',34])
 for(const invalid of [[-90,60],[60,90],[-1,-0.5]]){await publish({},invalid);await state('online_unobserved')}
 await publish({},[0,60]);await state('working')
 assert.deepEqual(await ring(aster),normal,'computed main outline is identical to ordinary work')
 assert.deepEqual(await child.evaluate(e=>{const r=e.getBoundingClientRect();return [getComputedStyle(e).boxShadow,r.width,r.height,e.parentElement.style.opacity]}),originalChild)
 assert.equal(await child.count(),1);assert.equal(await stack.locator('[data-running-count]').count(),0);assert.equal(await idle.count(),0)
 await page.screenshot({path:'evidence/oneshot-primary-and-child.png'})
 await aster.click();await page.locator('[data-recent-row]').first().waitFor();assert.equal(await page.locator('[data-session-arc]').count(),0,'a profile proof cannot identify a row');await page.keyboard.press('Escape')
 await rpc('waiting');await stack.locator('[data-avatar-waiting]').waitFor();await state('online_unobserved')
 await rpc('idle');await state('working') // Unrelated idle row does not prove the owner idle.
 await publish({state:'waiting'},[0,60]);await state('waiting');assert.equal((await ring(aster))[0],'rgb(192, 133, 50)')
 await publish({state:'idle'},[0,60]);await state('idle');assert.equal((await ring(aster))[0],'rgb(129, 145, 161)')
 await publish();await state('online_unobserved');await rpc('working');await state('working')
 await publish({},[0,60]);await rpc('idle');await state('online_unobserved') // Newer confirmed idle conflicts with the older proof.
 await page.clock.runFor(50);await publish({},[0,60]);await state('working') // New proof supersedes the old confirmation.
 await publish({active_turn:false});await state('online_unobserved');assert.equal(await idle.count(),0,'release does not revive a pre-lease idle start')
 await publish({},[0,2.5]);await state('working');await page.clock.runFor(3500);await state('online_unobserved');assert.equal(await child.count(),1,'lease expiry in the primary must not remove child metadata')
 await publish({},[0,60]);await state('working')
 await page.evaluate(()=>{window.fixtureStatus[0].oneshot_activity=undefined;window.fixtureSetProfile('Mika');window.fixtureSetProfile('default')})
 await state('online_unobserved');assert.equal(await idle.count(),0)
 console.log('PASS Chromium computed oneshot/normal green parity, independent child, row isolation, waiting/idle, expiry and scope')
}finally{await browser.close()}
