import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'

const root=process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT
const {chromium}=createRequire(path.join(root,'package.json'))('playwright')
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH})
const page=await browser.newPage({viewport:{width:900,height:500},reducedMotion:'reduce'})
page.setDefaultTimeout(4000)
const url=pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?locale=en'
const avatar=name=>page.getByRole('button',{name:new RegExp('^'+name+' ·')})
const rows=page.locator('[data-recent-row]')
const menu=page.locator('[data-avatar-context]')
const latest=menu.getByRole('button',{name:'Open latest',exact:true})
const starts=()=>page.evaluate(()=>window.calls.filter(c=>c.scope==='stored').map(c=>[c.epoch,c.name,c.priority]))
const allCalls=()=>page.evaluate(()=>window.calls.map(({epoch,name,scope})=>[epoch,name,scope]))
const quiet=async(expected,why)=>{await page.clock.runFor(650);assert.deepEqual(await starts(),expected,why)}
const pending=async(name,epoch=1)=>{
 await page.waitForFunction(key=>Object.hasOwn(window.gates,key),`${epoch}:${name}`)
}
const finish=(name,{epoch=1,error=false}={})=>page.evaluate(([key,error])=>window.gates[key](error),[`${epoch}:${name}`,error])
const assertNext=async(name,options,expected,why)=>{
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000))
 await finish(name,options)
 await page.clock.runFor(16)
 assert.deepEqual(await starts(),expected,why)
 await page.clock.resume()
}
const visible=hidden=>page.evaluate(hidden=>window.setHidden(hidden),hidden)
const routes=async()=>{
 await page.waitForFunction(()=>typeof window.releaseRoutes==='function')
 await page.evaluate(()=>window.releaseRoutes())
}
const idle=()=>page.waitForFunction(()=>!window.officeClient.isFetching({queryKey:['sessioncrew','recent']}))
const closePanel=()=>page.getByRole('button',{name:'Close panel'}).click()
const dismissMenu=async()=>{await page.keyboard.press('Escape');await menu.waitFor({state:'detached'})}
try{
 await page.clock.install()
 await page.addInitScript(()=>{
  let hidden=new URLSearchParams(location.search).has('hidden'),epoch=1
  Object.defineProperty(document,'visibilityState',{get:()=>hidden?'hidden':'visible'})
  Object.defineProperty(document,'hidden',{get:()=>hidden})
  window.setHidden=value=>{hidden=value;document.dispatchEvent(new Event('visibilitychange'))}
  window.fixtureProfileNames=['Mika','Aster','Nova','Iris','Orin','Jules','Rogue']
  window.fixtureProfileRoutes=()=>new Promise(resolve=>{
   window.releaseRoutes=()=>{
    delete window.releaseRoutes
    resolve(window.fixtureProfiles.filter(p=>p.name!=='Rogue').map(({name})=>({connectionId:'fixture',mode:'remote',profile:name,targetProfile:name})))
   }
  })
  window.calls=[]
  window.gates={}
  window.nextActivation=()=>window.fixtureSetActivation(++epoch)
  window.fixtureSessionList=(route,{scope},_timeout,{spawnPriority:priority})=>{
   const name=route.profile,key=`${epoch}:${name}`
   window.calls.push({epoch,name,scope,priority})
   if(scope==='live')return {scope,sessions:[]}
   return new Promise((resolve,reject)=>{
    if(window.gates[key])throw Error('duplicate stored request for '+key)
    window.gates[key]=error=>{
     delete window.gates[key]
     if(error)reject(Error('fixture cold list failure'))
     else resolve({scope,sessions:[{id:`${key}-session`,title:`${name} session ${epoch}`,source:'desktop'}]})
    }
   })
  }
 })
 await page.goto(url+'&hidden')
 await avatar('Mika').waitFor()
 const displayed=await page.locator('[data-profile-rail] button[aria-label]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label').split(' ·')[0]))
 assert.deepEqual(displayed,['Mika','Aster','Nova','Iris','Orin','Jules','Rogue'])
 await visible(false)
 await quiet([],'routes have not resolved')
 await visible(true);await routes()
 await quiet([],'a ready but hidden page does not start a warm')
 await visible(false)
 try{await pending('Mika')}catch(error){throw Error('expected the first displayed owner to prewarm before any click',{cause:error})}
 const first=[1,'Mika','background']
 await quiet([first],'a slow warm holds the next owner')
 assert.equal(await page.evaluate(()=>window.officeClient.getQueryCache().findAll({queryKey:['sessioncrew','projects']}).length),0)
 await avatar('Nova').click({button:'right'});await pending('Nova')
 assert.deepEqual(await starts(),[first,[1,'Nova','foreground']],'a later click takes the foreground path before the warm finishes')
 await dismissMenu()
 await finish('Mika')
 await quiet([first,[1,'Nova','foreground']],'closing the menu does not unblock warming while the foreground request remains active')
 const throughAster=[first,[1,'Nova','foreground'],[1,'Aster','background']]
 await assertNext('Nova',{},throughAster,'Aster starts without a cooldown after the foreground list settles')
 await pending('Aster')
 const reusedCalls=async()=>(await allCalls()).filter(([,name])=>name==='Mika'||name==='Nova')
 const beforeOpen=await reusedCalls()
 await avatar('Mika').click()
 assert.equal(await rows.first().locator('strong').textContent(),'Mika session 1')
 await closePanel()
 await avatar('Nova').click({button:'right'});await latest.waitFor()
 assert.equal(await latest.getAttribute('aria-disabled'),null)
 assert.deepEqual(await reusedCalls(),beforeOpen,'first warm panel and fresh compact open do not refetch Mika or Nova while Aster warms')
 await dismissMenu()
 await avatar('Aster').click({button:'right'})
 await menu.getByRole('button',{name:'Loading latest...'}).waitFor()
 await quiet(throughAster,'the cold menu joins the existing same-owner warm')
 await finish('Aster');await latest.waitFor()
 assert.equal(await latest.getAttribute('aria-disabled'),null)
 assert.deepEqual((await allCalls()).filter(c=>c[1]==='Aster'),[[1,'Aster','stored'],[1,'Aster','live']])
 // Reorder midway, remove one pending owner, and age a directly fetched owner.
 await page.evaluate(async()=>{
  const client=window.officeClient
  const recent=client.getQueryCache().findAll({queryKey:['sessioncrew','recent']}).find(q=>q.queryKey[6]==='Nova')
  client.setQueryData(recent.queryKey,recent.state.data,{updatedAt:Date.now()-10001})
  window.fixtureProfiles=window.fixtureProfiles.filter(p=>p.name!=='Orin').reverse()
  await client.refetchQueries({queryKey:['sessioncrew','roster']})
 })
 await avatar('Orin').waitFor({state:'detached'})
 await quiet(throughAster,'the open compact menu pauses new background work')
 const completed=[...throughAster,[1,'Iris','background'],[1,'Jules','background']]
 await dismissMenu();await pending('Iris')
 await assertNext('Iris',{error:true},completed,'Jules starts without a cooldown after the preceding warm fails')
 await pending('Jules');await finish('Jules');await idle()
 await page.evaluate(async()=>{
  const client=window.officeClient
  for(const q of client.getQueryCache().findAll({queryKey:['sessioncrew','recent']})){
   if(q.state.data)client.setQueryData(q.queryKey,q.state.data,{updatedAt:Date.now()-15001})
  }
  await client.refetchQueries({queryKey:['sessioncrew','roster']})
 })
 await quiet(completed,'no loop, no removed or invalid owners, and no second automatic fetch for stale Nova')
 await avatar('Iris').click({button:'right'});await pending('Iris')
 assert.deepEqual(await starts(),[...completed,[1,'Iris','foreground']],'failed warm leaves a cold user retry')
 await finish('Iris',{error:true});await menu.getByRole('alert').getByText(/fixture cold list failure/).waitFor()
 await dismissMenu()
 console.log('PASS ordered single pass, no overlap or cooldown between warms, immediate foreground, dedupe, first warm open, invalid/removed skips, stale skip and cold error')

 await page.goto(url);await avatar('Mika').waitFor();await routes();await pending('Mika')
 await visible(true);await finish('Mika');await idle()
 assert.deepEqual(await allCalls(),[[1,'Mika','stored'],[1,'Mika','live']],'hide does not cancel the already-running shared list')
 await quiet([first],'hide stops the next dispatch')
 await avatar('Mika').click({button:'right'});await latest.waitFor()
 assert.equal(await latest.getAttribute('aria-disabled'),null)
 assert.deepEqual(await allCalls(),[[1,'Mika','stored'],[1,'Mika','live']],'first compact open uses prewarmed rows without another request')
 await visible(false)
 await quiet([first],'show does not bypass the open compact menu')
 await dismissMenu();await pending('Aster')
 await page.evaluate(()=>{window.fixtureSetProfile('away');window.fixtureSetProfile('Aster');window.nextActivation()})
 await routes()
 await finish('Aster')
 await pending('Mika',2)
 assert.deepEqual(await starts(),[first,[1,'Aster','background'],[2,'Mika','background']],'same-scope reactivation cannot dispatch the old queue')
 assert.deepEqual((await allCalls()).filter(c=>c[1]==='Aster'),[[1,'Aster','stored']],'scope loss prevents any further old-scope list requests')
 await visible(true);await finish('Mika',{epoch:2});await idle()
 const afterSwitch=[first,[1,'Aster','background'],[2,'Mika','background']]
 await quiet(afterSwitch,'hiding the new activation stops it too')
 await visible(false);await pending('Aster',2)
 await assertNext('Aster',{epoch:2},[...afterSwitch,[2,'Aster','background'],[2,'Nova','background']],'Nova starts without a cooldown after a successful warm')
 console.log('PASS visibility pause/resume, in-flight completion on hide, same-scope activation fencing and no cooldown after success')
}finally{await browser.close()}
