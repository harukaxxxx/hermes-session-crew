import {createRequire} from 'node:module'
import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'

const root=process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT
const require=createRequire(path.join(root,'package.json'))
const desktopRequire=createRequire(path.join(root,'apps/desktop/package.json'))
const {chromium}=(()=>{try{return require('playwright')}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;return createRequire(desktopRequire.resolve('@playwright/test'))('playwright')}})()
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
const listCount=()=>page.evaluate(()=>window.listCalls.length)
const openCount=()=>page.evaluate(()=>window.openCalls?.length??0)
const expire=owner=>page.evaluate(owner=>{
 const client=window.officeClient
 const query=client.getQueryCache().findAll({queryKey:['sessioncrew','recent']}).find(q=>q.queryKey[6]===owner&&q.state.data)
 client.setQueryData(query.queryKey,query.state.data,{updatedAt:Date.now()-10001})
},owner)
const waitForList=()=>page.waitForFunction(()=>typeof window.finishList==='function')
const finishList=()=>page.evaluate(()=>window.finishList())
const waitForIdle=()=>page.waitForFunction(()=>!window.officeClient.isFetching({queryKey:['sessioncrew','recent']}))
try{
 await page.addInitScript(()=>{
  // Model only the AppContextMenu window-capture priority for image vs bare pane hits.
  window.addEventListener('contextmenu',event=>{
   const target=event.target,claimedImage=!!target.closest('img')
   window.fixtureContextHit={tag:target.tagName,owner:target.closest('button')?.getAttribute('aria-label'),claimedImage}
   if(claimedImage){event.preventDefault();event.stopPropagation()}
  },true)
  window.listCalls=[]
  window.listPriorities=[]
  const params=new URLSearchParams(location.search)
  if(params.has('quickJoin'))window.delayList='Mika'
  if(params.has('quickRoute')){
   window.delayList='Mika'
   window.fixtureProfileRoutes=()=>new Promise(resolve=>{
    window.finishRoutes=()=>resolve(window.fixtureProfiles.map(p=>({connectionId:'fixture',mode:'remote',profile:p.name,targetProfile:p.name})))
   })
  }
  window.fixtureRecentActivity={Aster:{'aster-latest':75},Mika:{old:10,'mika-latest':100,cron:200,live:50}}
  window.fixtureSessionList=(route,{scope},_timeout,{spawnPriority}={})=>{
   window.listCalls.push([route.profile,scope])
   window.listPriorities.push([route.profile,spawnPriority])
   const session=(id,source='desktop')=>({id,title:id,source})
   const stored=window.storedOverride?.[route.profile]??(route.profile==='Mika'?[session('old'),session('cron','cron'),session('mika-latest')]:[session('aster-latest')])
   const live=route.profile==='Mika'?[session('live')]:[]
   const result={scope,sessions:scope==='stored'?(window.emptyList?[session('cron','cron')]:stored):window.emptyList?[]:live}
   if(window.listError)throw Error('fixture list failure')
   if((window.delayList===true||window.delayList===route.profile)&&scope==='stored')return new Promise((resolve,reject)=>{window.finishList=(error)=>{delete window.finishList;window.delayList=false;if(error)reject(Error(error));else resolve(result)}})
   return Promise.resolve(result)
  }
 })
 const url=pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?snapshot'
 await page.goto(url+'&recentsettings')
 await page.waitForFunction(()=>window.fixtureStorage?.['completion-snapshot-v2']?.coverage)
 await right('Mika')
 await enabled(latest)
 await latestState('開啟最近',false)
 assert.equal(await all.getAttribute('aria-disabled'),'true','no coverage for Mika')
 assert.equal(await menu.getByRole('button').count(),2)
 assert.equal(await rows.count(),0)
 assert.equal(await page.evaluate(()=>window.officeClient.getQueryCache().findAll({queryKey:['sessioncrew','projects']}).some(q=>q.isActive()||q.state.fetchStatus!=='idle'||q.state.data!==undefined)),false,'menu does not fetch projects')
 // The SDK popover installs its outside pointer listener after mounting.
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
 await page.mouse.click(750,350);await menu.waitFor({state:'detached'})

 // Hold the fixture's route query pending before opening the compact menu.
 await page.evaluate(()=>{
  const query=window.officeClient.getQueryCache().find({queryKey:['sessioncrew','routes','fixture','default',0,1]})
  const routes=query.state.data
  query.reset()
  window.restoreRoutes=()=>query.setData(routes)
  void query.fetch({...query.options,queryFn:()=>new Promise((_,reject)=>{window.failRoutes=()=>reject(Error('fixture route failure'))})}).catch(()=>{})
 })
 await right('Mika');await latestState('載入最近...',true)
 assert.ok(await focus(latest),'the loading action remains focusable')
 await page.keyboard.press('Tab');assert.ok(await focus(all),'Tab reaches the aria-disabled mark-all action')
 await page.keyboard.press('Shift+Tab');assert.ok(await focus(latest))
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

 // A fresh reopen must not make even a deferred stored request.
 const warmCalls=await listCount()
 await page.evaluate(()=>window.delayList=true)
 await avatar('Mika').press('Shift+F10');await latestState('開啟最近',false)
 assert.equal(await listCount(),warmCalls,'fresh context reopen sends zero session.list requests')
 await latest.press('Escape');await menu.waitFor({state:'detached'})

 // Expired results permit queuing the refresh, but not opening a stale rank.
 await expire('Mika')
 await page.evaluate(()=>window.delayList=true)
 await avatar('Mika').press('Shift+F10')
 await latestState('開啟最近',false);await waitForList()
 await latest.and(menu.locator(':focus')).waitFor()
 await latest.press('Enter');await latest.press('Enter')
 assert.equal(await openCount(),0);assert.equal(await listCount(),warmCalls+1,'queued clicks join the one deferred stored request')
 await latest.press('Escape');await menu.waitFor({state:'detached'})
 await finishList();await waitForIdle()
 assert.equal(await openCount(),0,'dismissed refresh does not navigate')
 assert.equal(await listCount(),warmCalls+2,'one stored/live refresh pair')
 await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')?.startsWith('Mika ·'))
 assert.deepEqual(await ledger(),unread,'opening, waiting, and dismissing do not mark read')

 await avatar('Mika').press('ContextMenu');await menu.waitFor()
 await avatar('Mika').click();await rows.first().waitFor();assert.equal(await menu.count(),0)
 assert.equal(await rows.first().locator('strong').textContent(),'mika-latest','ordinary left-click opens Recent with its normal activity order and cron filter')
 assert.equal(await rows.filter({hasText:'cron'}).count(),0)
 await right('Mika');await latestState('開啟最近',false)
 assert.equal(await listCount(),warmCalls+2,'fresh panel to context switch sends zero session.list requests')
 assert.ok(await focus(latest),'ready action has keyboard focus')
 await page.evaluate(()=>window.fixtureOpenSession=()=>new Promise(resolve=>{window.finishOpen=resolve}))
 await latest.click()
 await page.waitForFunction(()=>typeof window.finishOpen==='function')
 assert.deepEqual(await page.evaluate(()=>window.openCalls),[['mika-latest',{route:{connectionId:'fixture',mode:'remote',profile:'Mika',targetProfile:'Mika'},intent:'in-place'}]])
 await right('Aster');await enabled(latest)
 await page.evaluate(()=>{window.finishOpen();window.fixtureOpenSession=null})
 await page.keyboard.press('Tab');assert.ok(await focus(all),'late open does not close or move focus in the next menu')
 assert.deepEqual(await ledger(),unread,'dismissed async open did not ack either owner')

 await expire('Mika');await page.evaluate(()=>window.listError=true)
 await right('Mika');await menu.getByRole('alert').getByText(/fixture list failure/).waitFor()
 assert.equal(await latest.getAttribute('aria-disabled'),'true')
 await all.click()
 await page.waitForFunction(()=>window.fixtureStorage['completion-snapshot-v2'].rows.filter(r=>r.owner==='Mika').every(r=>r.read))
 assert.deepEqual(await ledger(),unread.map(([owner,session])=>[owner,session,owner==='Mika']),'mark-all covers only the chosen owner, including hidden and unlisted sessions')
 await page.keyboard.press('Escape');await menu.waitFor({state:'detached'})

 await expire('Aster');await page.evaluate(()=>{window.listError=false;window.emptyList=true;window.delayList=true})
 await right('Aster');await latestState('開啟最近',false);await waitForList()
 await latest.press('Enter')
 await page.evaluate(()=>window.fixtureSetLocale('en'))
 await latestState('Open latest',true)
 await page.evaluate(()=>window.fixtureSetLocale('zh-hant'));await finishList()
 await latestState('查無最近',true)
 assert.equal(await openCount(),1,'filtered empty refresh does not fall back to the old row')
 await page.evaluate(()=>window.fixtureSetLocale('en'))
 await latestState('No recent sessions',true);assert.equal(await all.textContent(),'Mark all read')
 await latest.press('Escape');await menu.waitFor({state:'detached'})
 await expire('Aster');await page.evaluate(()=>window.emptyList=false)
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

 // Expiry while the menu stays open starts a refresh on click, then uses current settings.
 await right('Mika');await enabled(latest)
 const beforeClick=await listCount(),beforeOpen=await openCount()
 await expire('Mika')
 await page.evaluate(()=>{
  window.delayList='Mika'
  window.storedOverride={Mika:[{id:'updated',title:'Updated',source:'desktop'},{id:'new-cron',title:'New Cron',source:'cron'}]}
  window.fixtureRecentActivity.Mika={updated:100,'new-cron':200}
 })
 assert.equal(await listCount(),beforeClick,'an open compact menu does not poll on expiry')
 await latest.press('Enter');await waitForList();await latest.press('Enter')
 assert.equal(await openCount(),beforeOpen,'expired click cannot open the old result while waiting')
 assert.equal(await listCount(),beforeClick+1)
 await page.evaluate(()=>document.querySelector('[role="switch"][aria-label="Show Cron sessions"]').click())
 await page.waitForFunction(()=>document.querySelector('[role="switch"][aria-label="Show Cron sessions"]').getAttribute('aria-checked')==='true')
 await finishList();await menu.waitFor({state:'detached'})
 assert.equal(await listCount(),beforeClick+2,'queued retry uses one stored/live pair')
 assert.equal(await openCount(),beforeOpen+1)
 assert.deepEqual(await page.evaluate(()=>window.openCalls.at(-1)),['new-cron',{route:{connectionId:'fixture',mode:'remote',profile:'Mika',targetProfile:'Mika'},intent:'in-place'}])

 // A rejected refresh consumes its queued intent without opening cached data.
 await expire('Mika');await page.evaluate(()=>window.delayList='Mika')
 await right('Mika');await latestState('Open latest',false);await waitForList();await latest.press('Enter')
 await page.evaluate(()=>window.finishList('queued fixture failure'))
 await menu.getByRole('alert').getByText(/queued fixture failure/).waitFor()
 assert.equal(await openCount(),beforeOpen+1)
 await latest.press('Escape');await menu.waitFor({state:'detached'})

 // A different owner's fresh query cannot complete an intent queued for Mika.
 await page.evaluate(()=>window.delayList='Mika')
 await right('Mika');await latestState('Open latest',false);await waitForList();await latest.press('Enter')
 await right('Aster');await enabled(latest)
 await finishList();await waitForIdle()
 assert.equal(await openCount(),beforeOpen+1,'changed owner cancels the queued navigation')
 assert.equal(await menu.getAttribute('aria-label'),'Aster')
 await latest.press('Escape');await menu.waitFor({state:'detached'})

 // An activation change cannot reuse the old rows or fulfill an old intent.
 await expire('Mika');await page.evaluate(()=>window.delayList='Mika')
 await right('Mika');await latestState('Open latest',false);await waitForList();await latest.press('Enter')
 await page.evaluate(()=>{
  window.finishOldActivation=window.finishList;delete window.finishList
  window.storedOverride.Mika=[{id:'activation-2',title:'Activation 2',source:'desktop'}]
  window.fixtureRecentActivity.Mika={'activation-2':100}
  window.fixtureSetActivation(2)
 })
 await latestState('Loading latest...',true);await waitForList()
 await finishList();await enabled(latest)
 await page.evaluate(()=>window.finishOldActivation());await waitForIdle()
 assert.equal(await openCount(),beforeOpen+1,'old activation cannot navigate')
 await latest.press('Enter');await menu.waitFor({state:'detached'})
 assert.equal(await openCount(),beforeOpen+2)
 assert.equal(await page.evaluate(()=>window.openCalls.at(-1)[0]),'activation-2')
 console.log('PASS shared Recent cache: zero warm session.list calls, one stored/live pair per deferred refresh, current filters, failure/empty/dismiss/owner/activation fencing')

 await page.goto(url+'&gallery')
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

 const quick=()=>avatar('Mika').dblclick()
 const mikaLists=()=>page.evaluate(()=>window.listCalls.filter(([owner])=>owner==='Mika').map(([,scope])=>scope))
 const mikaPriorities=()=>page.evaluate(()=>window.listPriorities.filter(([owner])=>owner==='Mika').map(([,priority])=>priority))
 const expectOpens=async(ids)=>{
  assert.deepEqual(await page.evaluate(()=>window.openCalls??[]),ids.map(id=>[id,{route:{connectionId:'fixture',mode:'remote',profile:'Mika',targetProfile:'Mika'},intent:'in-place'}]))
  assert.equal(await page.evaluate(()=>window.createCalls?.length??0),0,'quick-open never creates a session')
 }
 const closeQuick=async()=>{await latest.press('Escape');await menu.waitFor({state:'detached'})}

 // No cached route or recent list when the double-click lands. The visible
 // quick popover waits, dispatches foreground once, then navigates by itself.
 await page.goto(url+'&quickRoute')
 await quick();await latestState('載入最近...',true)
 assert.deepEqual(await mikaLists(),[])
 await page.evaluate(()=>window.finishRoutes());await waitForList()
 assert.deepEqual(await mikaLists(),['stored'])
 assert.deepEqual(await mikaPriorities(),['foreground'])
 await quick();await latestState('載入最近...',true)
 assert.deepEqual(await mikaLists(),['stored'],'repeated double-click joins the held request')
 await expectOpens([])
 await finishList();await menu.waitFor({state:'detached'})
 await expectOpens(['mika-latest'])
 assert.deepEqual(await mikaLists(),['stored','live'])

 // Warm double-click opens immediately despite a held-RPC fixture, and never
 // sends a stored or live request. Desktop-like input still drives the click.
 await page.evaluate(()=>window.delayList='Mika')
 await quick();await page.waitForFunction(()=>window.openCalls?.length===2);await menu.waitFor({state:'detached'})
 await expectOpens(['mika-latest','mika-latest'])
 assert.deepEqual(await mikaLists(),['stored','live'])

 // A new click sequence can remount the compact view while navigation is
 // still pending. The second sequence must not send another open.
 await page.evaluate(()=>window.fixtureOpenSession=()=>new Promise(resolve=>{window.finishQuickOpen=resolve}))
 await quick();await page.waitForFunction(()=>typeof window.finishQuickOpen==='function')
 await quick();await latestState('開啟最近',false)
 await expectOpens(['mika-latest','mika-latest','mika-latest'])
 await page.evaluate(()=>{window.finishQuickOpen();window.fixtureOpenSession=null})
 await closeQuick()

 await expire('Mika')
 await page.evaluate(()=>{
  window.storedOverride={Mika:[{id:'new-first',title:'New first',source:'desktop'},{id:'cron',title:'Cron',source:'cron'}]}
  window.fixtureRecentActivity.Mika={'new-first':75,cron:200,live:10}
 })
 await quick();await menu.waitFor();await waitForList()
 await expectOpens(['mika-latest','mika-latest','mika-latest'])
 assert.deepEqual(await mikaLists(),['stored','live','stored'])
 await finishList();await menu.waitFor({state:'detached'})
 const opened=['mika-latest','mika-latest','mika-latest','new-first']
 await expectOpens(opened)

 await expire('Mika');await page.evaluate(()=>{window.emptyList=true;window.delayList='Mika'})
 await quick();await waitForList();await finishList();await latestState('查無最近',true)
 await expectOpens(opened)
 // An unrelated cache refresh may update the button, but must not revive the gesture.
 await page.evaluate(async()=>{
  window.emptyList=false
  await window.officeClient.refetchQueries({queryKey:['sessioncrew','recent'],type:'active'})
 })
 await latestState('開啟最近',false);await expectOpens(opened);await closeQuick()

 await expire('Mika');await page.evaluate(()=>window.delayList='Mika')
 await quick();await waitForList()
 await page.evaluate(()=>window.finishList('quick fixture failure'))
 await menu.getByRole('alert').getByText(/quick fixture failure/).waitFor()
 await expectOpens(opened);await closeQuick()

 await page.evaluate(()=>window.delayList='Mika')
 await quick();await waitForList();await closeQuick()
 await finishList();await waitForIdle();await expectOpens(opened)

 await expire('Mika');await page.evaluate(()=>window.delayList='Mika')
 await quick();await waitForList();await right('Aster')
 await finishList();await waitForIdle();await expectOpens(opened)
 assert.equal(await menu.getAttribute('aria-label'),'Aster');await closeQuick()

 // A query paused at gesture time may resume normally, but not auto-open.
 await expire('Mika')
 await page.context().setOffline(true);await page.waitForFunction(()=>!navigator.onLine)
 await quick();await menu.getByRole('alert').getByText('連線尚未準備好',{exact:true}).waitFor()
 await expectOpens(opened)
 await page.context().setOffline(false);await waitForIdle();await enabled(latest)
 await expectOpens(opened);await closeQuick()

 // Gateway changes in one batch can leave the same route and React values.
 // The quick intent must still be canceled when the older result completes.
 await expire('Mika');await page.evaluate(()=>window.delayList='Mika')
 await quick();await waitForList()
 await page.evaluate(()=>{window.fixtureSetGateway('closed');window.fixtureSetGateway('open')})
 await menu.waitFor({state:'detached'})
 await finishList();await waitForIdle();await expectOpens(opened)

 // If prewarm got there first, keep the same cache request and use its result.
 await page.goto(url+'&quickJoin');await waitForList()
 assert.deepEqual(await mikaLists(),['stored'])
 assert.deepEqual(await mikaPriorities(),['background'])
 await quick();await latestState('載入最近...',true);await expectOpens([])
 assert.deepEqual(await mikaLists(),['stored'])
 await finishList();await menu.waitFor({state:'detached'});await expectOpens(['mika-latest'])
 assert.deepEqual(await mikaLists(),['stored','live'])
 assert.deepEqual(await mikaPriorities(),['background','background'])
 console.log('PASS avatar double-click: cold foreground fetch, joined prewarm, warm cache, new ranking, filtered empty, error, pause, repeated navigation, dismissal, owner and scope cancellation')

 // Compare the two plugin-owned menus through the real SDK components and CSS.
 await page.goto(url+'&locale=en')
 const css=await readFile('tests/sdk-css/styles.css','utf8')
 const codicon=await readFile('tests/sdk-css/codicon.ttf')
 // Vite emits a root-relative font URL; inline the emitted font for the file:// fixture.
 await page.addStyleTag({content:css.replace(/url\(["']?\/?codicon\.ttf[^)]*\)/,`url(data:font/ttf;base64,${codicon.toString('base64')})`)})
 assert.ok((await page.evaluate(()=>document.fonts.load('14px codicon').then(fonts=>fonts.length)))>0,'Desktop Codicon font is loaded')
 await page.evaluate(()=>{
  document.documentElement.style.setProperty('--ui-bg-tertiary','#45424d')
  window.fixtureProjects=[{id:'style',label:'Style reference',path:'/fixture/style',sessionIds:[],isAuto:false,isNoProject:false}]
 })
 const surface=locator=>locator.evaluate(el=>{
  const {minWidth,padding,border,borderRadius,backgroundColor,boxShadow,backdropFilter,color}=getComputedStyle(el)
  // Popover's focus outline adds transparent CSS shadow layers that do not paint.
  return {minWidth,padding,border,borderRadius,backgroundColor,boxShadow:boxShadow.replace(/rgba\(0, 0, 0, 0\) 0px 0px 0px 0px, /g,''),backdropFilter,color}
 })
 const rowStyle=locator=>locator.evaluate(el=>{
  const {height,padding,borderRadius,columnGap,fontSize,lineHeight,color,backgroundColor}=getComputedStyle(el)
  const icon=el.firstElementChild,{fontSize:iconSize,color:iconColor}=getComputedStyle(icon)
  const glyph=icon.getBoundingClientRect(),row=el.getBoundingClientRect(),label=document.createRange()
  label.selectNode(el.lastChild)
  return {height,padding,borderRadius,columnGap,fontSize,lineHeight,color,backgroundColor,iconSize,iconColor,
   iconInset:glyph.left-row.left,iconCenter:glyph.top+glyph.height/2-row.top-row.height/2,labelGap:label.getBoundingClientRect().left-glyph.right}
 })
 const highlighted=async locator=>{
  const row=await locator.elementHandle()
  try{await page.waitForFunction(el=>getComputedStyle(el).backgroundColor==='rgb(69, 66, 77)',row)}
  finally{await row.dispose()}
 }
 await avatar('Aster').click();await rows.first().waitFor()
 await page.getByRole('button',{name:'▦ Open project'}).click()
 await page.locator('[data-project-menu]').click()
 const projectMenu=page.getByRole('menu'),copy=projectMenu.getByRole('menuitem',{name:'Copy path'})
 await copy.hover();await copy.and(projectMenu.locator(':focus')).waitFor();await highlighted(copy)
 const projectSurface=await surface(projectMenu),projectRow=await rowStyle(copy)
 assert.notEqual(projectSurface.boxShadow,'none','compiled Desktop menu CSS is loaded')
 assert.equal(projectSurface.minWidth,'144px')
 if(process.env.AVATAR_MENU_SCREENSHOT_DIR)await projectMenu.screenshot({path:path.join(process.env.AVATAR_MENU_SCREENSHOT_DIR,'project-context-reference.png'),animations:'disabled'})
 await page.keyboard.press('Escape');await projectMenu.waitFor({state:'detached'})
 await page.waitForFunction(()=>window.fixtureStorage?.['completion-snapshot-v2']?.coverage)
 await right('Aster');await latestState('Open latest',false);await enabled(all)
 assert.deepEqual(await surface(menu),projectSurface)
 assert.ok(await focus(latest))
 await highlighted(latest)
 assert.deepEqual(await rowStyle(latest),projectRow,'focused avatar action matches the project row')
 await all.hover();await highlighted(all)
 assert.deepEqual(await rowStyle(all),projectRow,'hovered avatar action matches the project row')
 for(const [action,glyph] of [[latest,'history'],[all,'check-all']]){
  const icon=action.locator(`:scope > .codicon-${glyph}[aria-hidden="true"]`)
  assert.equal(await icon.count(),1)
  const before=await icon.evaluate(el=>getComputedStyle(el,'::before').content)
  assert.ok(before!=='none'&&before!=='normal'&&before!=='""',`Codicon ${glyph} has a rendered glyph`)
 }
 if(process.env.AVATAR_MENU_SCREENSHOT_DIR){
  await latest.hover()
  await menu.screenshot({path:path.join(process.env.AVATAR_MENU_SCREENSHOT_DIR,'avatar-context-menu.png'),animations:'disabled'})
 }
 console.log('PASS avatar menu style: project surface, highlighted row geometry, and decorative leading Codicons')
}finally{await browser.close()}
