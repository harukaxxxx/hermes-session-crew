import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'
const {chromium}=createRequire(process.env.HERMES_CHECKOUT+'/package.json')('playwright')
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH})
const url=pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?office&gallery&snapshot&locale=en'
const expectedOrder=['Mika','Profile 2','Profile 1','Aster',...Array.from({length:8},(_,i)=>'Profile '+(i+3))]
try{
 for(const dev of [true,false]){
  const page=await browser.newPage({viewport:{width:900,height:700}})
  await page.clock.install({time:new Date('2026-01-01T12:00:00Z')})
  await page.addInitScript(()=>{
   const last=Date.parse('2026-01-01T12:00:00Z')/1000
   const mixed=(profile,last_session_activity)=>({profile,online:true,state:'online_unobserved',busy:null,idle_since:null,status_observation:'fresh_shared_gateway_no_observed_owner_work',last_session_activity})
   // Seed the very first /status response, not an update on a warm rail.
   Object.defineProperty(window,'fixtureStatus',{configurable:true,set(rows){
    const samples=rows.map(({profile})=>mixed(profile,null))
    Object.assign(samples[0],{last_session_activity:last-190,shared_gateway_observation:'positive'})
    samples[1]={profile:'Mika',online:true,state:'working',busy:true}
    Object.assign(samples[2],{last_session_activity:last-130}) // Legacy (no independent shared field).
    Object.assign(samples[3],{state:'working',busy:true,status_observation:'recent_session_activity',last_session_activity:last-35,shared_gateway_observation:'positive'})
    Object.defineProperty(window,'fixtureStatus',{value:samples,writable:true,configurable:true})
   }})
  })
  const rows=()=>page.locator('[data-profile-rail] .profile-rail-hit').evaluateAll(nodes=>nodes.map(x=>({name:x.getAttribute('aria-label').split(' · ')[0],state:x.dataset.stateName,title:x.getAttribute('title'),timer:x.closest('[data-avatar-stack]').querySelector('[data-idle-minutes]')?.textContent??null})))
  const hasStatus=()=>page.locator('.profile-rail-hit[data-state-name="online_unobserved"][aria-label^="Aster ·"]').waitFor()
  const check=async()=>{
   await hasStatus();const seen=await rows(),byName=new Map(seen.map(x=>[x.name,x]))
   assert.equal(byName.get('Aster').timer,dev?'0h3m':null,'cold positive status estimates only from this owner’s last activity')
   assert.equal(byName.get('Profile 1').timer,dev?'0h2m':null,'legacy fresh shared shape is supported')
   assert.equal(byName.get('Profile 2').timer,dev?'0h0m':null,'session recency backed by a positive shared observation')
   for(const name of ['Aster','Profile 1','Profile 2']){
    assert.equal(byName.get(name).state,'online_unobserved');if(dev)assert.match(byName.get(name).title,/last recorded session activity.*idle not confirmed/i);else assert.equal(byName.get(name).title,null)
   }
   assert.equal(byName.get('Mika').state,'working');assert.equal(byName.get('Mika').timer,null)
   assert.equal(byName.get('Profile 3').timer,null,'no per-owner timestamp means no estimate')
   assert.deepEqual(seen.map(x=>x.name),expectedOrder,'elapsed ordering is independent of developer mode')
  }
  await page.goto(url+(dev?'&developer':''));await check()
  for(let i=0;i<3;i++)await page.evaluate(()=>window.officeClient.refetchQueries({queryKey:['sessioncrew','status'],type:'active'}))
  await check()
  await page.reload();await check()
  if(dev){
   const label=page.locator('.profile-rail-hit[aria-label^="Aster ·"]').locator('xpath=ancestor::*[@data-avatar-stack]').locator('[data-idle-minutes]')
   assert.ok(await label.evaluate(e=>{const b=e.getBoundingClientRect(),r=e.closest('[data-profile-rail]').getBoundingClientRect();return b.width>0&&b.height>0&&b.left>=r.left&&b.right<=r.right&&b.bottom<=r.bottom}))
   await page.screenshot({path:path.resolve('evidence/cold-idle-estimate-on.png')})
   await page.clock.runFor(61000)
   assert.equal((await rows()).find(x=>x.name==='Aster').timer,'0h4m','estimate advances without resetting on recurring polls')
  }else await page.screenshot({path:path.resolve('evidence/cold-idle-estimate-off.png')})
  if(dev){
   const aster=async()=> (await rows()).find(x=>x.name==='Aster')
   const hit=page.locator('.profile-rail-hit[aria-label^="Aster ·"]')
   const label=hit.locator('xpath=ancestor::*[@data-avatar-stack]').locator('[data-idle-minutes]')
   const original=await page.evaluate(()=>window.fixtureStatus[0])
   const publish=async row=>page.evaluate(async row=>{
    window.fixtureStatus[0]=row
    await window.officeClient.refetchQueries({queryKey:['sessioncrew','status'],type:'active'})
   },row)
   await page.evaluate(()=>window.fixtureSetLocale('zh-hant'))
   await page.waitForFunction(()=>[...document.querySelectorAll('.profile-rail-hit')].some(x=>x.title.includes('未確認閒置')))
   await page.evaluate(()=>window.fixtureSetLocale('en'))
   for(const invalid of [null,0,-1,String(original.last_session_activity),original.last_session_activity+3600]){
    await publish({...original,last_session_activity:invalid});await label.waitFor({state:'detached'})
    await publish(original);await label.waitFor()
   }
   for(const fields of [{state:'unknown'},{online:false},{shared_gateway_observation:'zero'},{state:'working',status_observation:'recent_delegated_activity'}]){
    await publish({...original,...fields});await label.waitFor({state:'detached'})
    await publish(original);await label.waitFor()
   }
   await page.evaluate(()=>{const q=window.officeClient.getQueryCache().find({queryKey:['sessioncrew','status'],exact:false,predicate:q=>q.isActive()});window.officeClient.setQueryData(q.queryKey,q.state.data,{updatedAt:Date.now()-16000})})
   await label.waitFor({state:'detached'});assert.equal((await aster()).state,'unknown')
   await publish(original);await label.waitFor()
   await publish({...original,state:'idle',idle_since:original.last_session_activity-180});await label.waitFor()
   await publish(original);await hit.and(page.locator('[title*="last confirmed idle"]')).waitFor()
   assert.equal(await label.innerText(),'0h7m','warm confirmed history supersedes even a newer activity origin')
   // Change the gateway generation while it cannot validate the shared host.
   await page.evaluate(()=>{window.fixtureStatus[0]={...window.fixtureStatus[0],state:'unknown'};window.fixtureSetGateway('closed')})
   await label.waitFor({state:'detached'})
   await page.evaluate(()=>window.fixtureSetGateway('open'))
   await hit.and(page.locator('[data-state-name="unknown"]')).waitFor();assert.equal(await label.count(),0)
   await publish(original);await label.waitFor();assert.match((await aster()).title,/last recorded session activity.*idle not confirmed/i)
  }
  await page.close()
 }
 console.log('PASS cold mixed rail estimates, legacy and recent shape, ordering, clocks and remount')
}finally{await browser.close()}
