import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'

const root=process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT
const {chromium}=createRequire(path.join(root,'package.json'))('playwright')
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH})
const page=await browser.newPage({viewport:{width:900,height:500},reducedMotion:'reduce'})
page.setDefaultTimeout(5000)
const avatar=name=>page.getByRole('button',{name:new RegExp('^'+name+' ·')})
const menu=page.locator('[data-avatar-context]')
const latest=menu.getByRole('button',{name:/^(載入最近\.\.\.|查無最近|開啟最近|Loading latest\.\.\.|No recent sessions|Open latest)$/})
const all=menu.getByRole('button',{name:/^(全部已讀|Mark all read)$/})
const rows=page.locator('[data-recent-row]')
const focus=locator=>locator.evaluate(el=>el===document.activeElement)
const ledger=()=>page.evaluate(()=>window.fixtureStorage['completion-snapshot-v2'].rows.map(({owner,session,read})=>[owner,session,read]))
const enabled=locator=>locator.locator('xpath=self::button[not(@aria-disabled)]').waitFor()
const latestState=async(name,disabled)=>{
 await latest.and(menu.getByRole('button',{name,exact:true})).waitFor()
 assert.equal(await latest.getAttribute('aria-disabled'),disabled?'true':null)
 assert.equal(await menu.getByRole('status').count(),0)
 assert.equal(await menu.textContent(),name+await all.textContent(),'no separate status text')
}
const right=async name=>{await avatar(name).click({button:'right'});await menu.waitFor();assert.equal(await menu.getAttribute('aria-label'),name)}
try{
 await page.addInitScript(()=>{
  // Model only the AppContextMenu window-capture priority for image vs bare pane hits.
  window.addEventListener('contextmenu',event=>{
   const target=event.target,claimedImage=!!target.closest('img')
   window.fixtureContextHit={tag:target.tagName,owner:target.closest('button')?.getAttribute('aria-label'),claimedImage}
   if(claimedImage){event.preventDefault();event.stopPropagation()}
  },true)
  window.fixtureRecentActivity={Aster:{'aster-latest':75},Mika:{old:10,'mika-latest':100,cron:200,live:50}}
  window.fixtureSessionList=(route,{scope})=>{
   const session=(id,source='desktop')=>({id,title:id,source})
   const stored=route.profile==='Mika'?[session('old'),session('cron','cron'),session('mika-latest')]:[session('aster-latest')]
   const live=route.profile==='Mika'?[session('live')]:[]
   const result={scope,sessions:scope==='stored'?(window.emptyList?[session('cron','cron')]:stored):window.emptyList?[]:live}
   if(window.listError)throw Error('fixture list failure')
   if(window.delayList&&scope==='stored')return new Promise(resolve=>{window.finishList=()=>{window.delayList=false;resolve(result)}})
   return Promise.resolve(result)
  }
 })
 await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?snapshot')
 await page.waitForFunction(()=>window.fixtureStorage?.['completion-snapshot-v2']?.coverage)
 await right('Mika')
 await enabled(latest)
 await latestState('開啟最近',false)
 assert.equal(await all.getAttribute('aria-disabled'),'true','no coverage for Mika')
 assert.equal(await menu.getByRole('button').count(),2)
 assert.equal(await rows.count(),0)
 assert.equal(await page.evaluate(()=>window.officeClient.getQueryCache().findAll({queryKey:['sessioncrew','projects']}).some(q=>q.isActive()||q.state.fetchStatus!=='idle'||q.state.data!==undefined)),false,'menu does not fetch projects')
 await page.mouse.click(750,350);await menu.waitFor({state:'detached'})

 // Hold the fixture's route query pending before opening the compact menu.
 await page.evaluate(()=>{
  const query=window.officeClient.getQueryCache().find({queryKey:['sessioncrew','routes','fixture','default',0]})
  const routes=query.state.data
  query.reset()
  window.restoreRoutes=()=>query.setData(routes)
  void query.fetch({...query.options,queryFn:()=>new Promise((_,reject)=>{window.failRoutes=()=>reject(Error('fixture route failure'))})}).catch(()=>{})
 })
 await right('Mika');await latestState('載入最近...',true)
 await page.evaluate(()=>window.failRoutes())
 await menu.getByRole('alert').getByText(/fixture route failure/).waitFor()
 assert.equal(await latest.getAttribute('aria-disabled'),'true')
 await page.evaluate(()=>window.restoreRoutes())
 await enabled(latest);await latestState('開啟最近',false)
 await latest.press('Escape');await menu.waitFor({state:'detached'})

 await page.evaluate(async()=>{
  const profiles=window.fixtureSnapshot.profiles
  profiles.push({...profiles[0],profile:'Mika',database_id:'fixture-db-mika'})
  await window.refreshFixtureSnapshot()
 })
 await page.waitForFunction(()=>window.fixtureStorage['completion-snapshot-v2'].coverage.profiles.length===2)
 await page.evaluate(async()=>{
  for(const profile of window.fixtureSnapshot.profiles){
   const sessions=profile.profile==='Mika'?['mika-latest','outside-recent','cron']:['mika-latest','aster-latest']
   profile.rows=sessions.map((id,i)=>({seq:i+1,admission_id:'turn-'+i,session_id:id,session_source:id==='cron'?'cron':'desktop',status:'terminal',outcome:'completed',generation:i+1}))
   profile.high_water=sessions.length
  }
  await window.refreshFixtureSnapshot()
 })
 await page.waitForFunction(()=>window.fixtureStorage['completion-snapshot-v2'].rows.length===5)
 const unread=[['Aster','mika-latest',false],['Aster','aster-latest',false],['Mika','mika-latest',false],['Mika','outside-recent',false],['Mika','cron',false]]
 assert.deepEqual(await ledger(),unread)

 // Reopening must wait for fresh data, even with a populated owner cache.
 await page.evaluate(()=>window.delayList=true)
 await avatar('Mika').press('Shift+F10')
 await latestState('載入最近...',true)
 await latest.and(menu.locator(':focus')).waitFor()
 await latest.press('Enter');assert.equal(await page.evaluate(()=>window.openCalls?.length??0),0)
 await page.evaluate(()=>window.finishList())
 await enabled(latest);await latestState('開啟最近',false)
 assert.ok(await focus(latest),'fresh result leaves keyboard focus on the first action')
 await latest.press('Escape');await menu.waitFor({state:'detached'})
 await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')?.startsWith('Mika ·'))
 assert.deepEqual(await ledger(),unread,'opening, waiting, and dismissing do not mark read')

 await avatar('Mika').press('ContextMenu');await menu.waitFor()
 await avatar('Mika').click();await rows.first().waitFor();assert.equal(await menu.count(),0)
 assert.equal(await rows.first().locator('strong').textContent(),'mika-latest','ordinary left-click opens Recent with its normal activity order and cron filter')
 assert.equal(await rows.filter({hasText:'cron'}).count(),0)
 await right('Mika');await enabled(latest)
 await page.evaluate(()=>window.fixtureOpenSession=()=>new Promise(resolve=>{window.finishOpen=resolve}))
 await latest.click()
 await page.waitForFunction(()=>typeof window.finishOpen==='function')
 assert.deepEqual(await page.evaluate(()=>window.openCalls),[['mika-latest',{route:{connectionId:'fixture',mode:'remote',profile:'Mika',targetProfile:'Mika'},intent:'in-place'}]])
 await right('Aster');await enabled(latest)
 await page.evaluate(()=>{window.finishOpen();window.fixtureOpenSession=null})
 await page.keyboard.press('Tab');assert.ok(await focus(all),'late open does not close or move focus in the next menu')
 assert.deepEqual(await ledger(),unread,'dismissed async open did not ack either owner')

 await page.evaluate(()=>window.listError=true)
 await right('Mika');await menu.getByRole('alert').getByText(/fixture list failure/).waitFor()
 assert.equal(await latest.getAttribute('aria-disabled'),'true')
 await all.click()
 await page.waitForFunction(()=>window.fixtureStorage['completion-snapshot-v2'].rows.filter(r=>r.owner==='Mika').every(r=>r.read))
 assert.deepEqual(await ledger(),unread.map(([owner,session])=>[owner,session,owner==='Mika']),'mark-all covers only the chosen owner, including hidden and unlisted sessions')
 await page.keyboard.press('Escape');await menu.waitFor({state:'detached'})

 await page.evaluate(()=>{window.listError=false;window.emptyList=true;window.delayList=true})
 await right('Aster');await latestState('載入最近...',true)
 await page.waitForFunction(()=>typeof window.finishList==='function')
 await page.evaluate(()=>window.fixtureSetLocale('en'))
 await latestState('Loading latest...',true)
 await page.evaluate(()=>{window.fixtureSetLocale('zh-hant');window.finishList()})
 await latestState('查無最近',true)
 await page.evaluate(()=>window.fixtureSetLocale('en'))
 await latestState('No recent sessions',true);assert.equal(await all.textContent(),'Mark all read')
 await latest.press('Escape');await menu.waitFor({state:'detached'})
 await page.evaluate(()=>window.emptyList=false)
 await right('Aster');await enabled(latest);await latestState('Open latest',false)
 await page.evaluate(()=>{window.fixtureOpenSession=()=>{throw Error('fixture open failure')}})
 await latest.click();await menu.getByRole('alert').getByText(/fixture open failure/).waitFor()
 assert.deepEqual(await ledger(),unread.map(([owner,session])=>[owner,session,owner==='Mika']),'failed open does not acknowledge')
 await page.evaluate(()=>window.fixtureOpenSession=null)
 await enabled(latest);await latest.click()
 await menu.waitFor({state:'detached'})
 assert.equal(await page.evaluate(()=>window.openCalls.at(-1)[0]),'aster-latest')
 assert.deepEqual(await ledger(),unread.map(([owner,session])=>[owner,session,owner==='Mika'||session==='aster-latest']),'open latest acknowledges only the exact owner/session')
 console.log('PASS avatar context actions: mouse, keyboard/focus, normal panel, fresh owner routes and cron filter, error/empty states, stale open, two-owner ledger scope')

 await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?snapshot&gallery')
 const owner=avatar('Mika'),face=owner.locator('img[data-avatar]')
 await face.waitFor()
 const {x,y}=await face.evaluate(async img=>{
  await img.decode()
  if(!img.naturalWidth)throw Error('fixture avatar did not decode')
  const {x,y,width,height}=img.getBoundingClientRect()
  return {x:x+width/2,y:y+height/2}
 })
 await page.mouse.click(x,y,{button:'right'})
 assert.deepEqual(await page.evaluate(()=>window.fixtureContextHit),{
  tag:'BUTTON',owner:await owner.getAttribute('aria-label'),claimedImage:false
 },'right-click on the decoded avatar must reach its button before the image capture branch')
 await menu.waitFor()
 assert.equal(await menu.getAttribute('aria-label'),'Mika')
 await page.keyboard.press('Escape');await menu.waitFor({state:'detached'})
 await page.mouse.click(x,y)
 await rows.first().waitFor()
 assert.equal(await rows.first().locator('strong').textContent(),'mika-latest','left-click at the same image coordinates opens Recent')
 assert.equal(await menu.count(),0)
 console.log('PASS decoded rail avatar: coordinate right-click reaches the button through modeled capture; left-click opens Recent')
}finally{await browser.close()}
