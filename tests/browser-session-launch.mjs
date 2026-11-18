import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import path from 'node:path'

const require=createRequire(path.join(process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT,'package.json'))
const {chromium}=require('playwright')
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH})
const url=pathToFileURL(path.resolve('tests/sdk-preview.html'))
url.searchParams.set('locale','en')
try{
 for(const [source,interference] of [
  ['quick','focus'],['project','focus'],['quick','geometry'],['quick','close'],['quick','pointer'],
  ['project','escape'],['project','pointer'],['quick','profile'],['quick','connection'],['quick','switch'],['project','reject'],
 ]){
  const page=await browser.newPage({viewport:{width:1100,height:700},reducedMotion:'reduce'})
  try{
   await page.addInitScript(()=>{
    window.fixtureCreateSession=()=>new Promise(resolve=>{window.releaseCreate=()=>resolve({stored_session_id:'delayed-id'})})
    window.fixtureOpenSession=()=>{if(window.rejectFixtureOpen)throw Error('fixture gateway unavailable')}
   })
   await page.goto(url.href)
   const avatar=page.getByRole('button',{name:/^Aster ·/}),panel=page.locator('[data-panel-avatar]')
   const quick=page.getByRole('button',{name:'Quick create'}),retry=page.getByRole('button',{name:'Retry opening'})
   await avatar.click()
   if(source==='project'){
    await page.getByRole('button',{name:/Open projects?/i}).click()
    await page.locator('[data-project-row] button').click()
   }else await quick.click()
   await page.waitForFunction(()=>typeof window.releaseCreate==='function')
   assert.equal(await quick.isDisabled(),true)
   const expectedCreate={route:{connectionId:'fixture',mode:'remote',profile:'Aster',targetProfile:'Aster'},params:source==='project'?{source:'desktop',cwd:'/fixture/project',cwd_explicit:true}:{source:'desktop'}}
   assert.deepEqual(await page.evaluate(()=>window.createCalls),[expectedCreate])
   const incidental=['focus','geometry','reject'].includes(interference)
   if(interference==='focus')await page.evaluate(()=>{const button=document.createElement('button');document.body.append(button);button.focus()})
   if(interference==='geometry')await page.evaluate(()=>{
    document.querySelector('[data-profile-rail]').style.transform='translateY(-200px)'
    window.dispatchEvent(new Event('resize'))
   })
   if(interference==='reject')await page.evaluate(()=>{window.rejectFixtureOpen=true})
   if(interference==='close')await page.getByRole('button',{name:'Close panel'}).click()
   if(interference==='pointer')await page.mouse.click(1000,500)
   if(interference==='escape')await page.keyboard.press('Escape')
   if(interference==='profile')await page.evaluate(()=>{window.fixtureSetProfile('Other');window.fixtureSetProfile('Aster')})
   if(interference==='connection')await page.evaluate(()=>{window.fixtureSetConnection('Other');window.fixtureSetConnection('fixture')})
   if(interference==='switch')await page.locator('.profile-rail-hit').nth(1).click()
   await page.evaluate(()=>new Promise(resolve=>{requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))}))
   if(incidental){
    assert.equal(await panel.isVisible(),true,'incidental '+interference+' dismissed '+source+' launch')
    if(source==='project')assert.equal(await page.locator('[data-project-row]').isVisible(),true,'nested project list dismissed')
   }else{
    if(interference==='switch')assert.equal(await avatar.getAttribute('data-selected'),'false')
    else await panel.waitFor({state:'hidden',timeout:3000})
    // Reopening BEFORE the reply must not revive the old navigation intent.
    await avatar.click()
    assert.equal(await quick.isDisabled(),true)
   }
   await page.evaluate(()=>window.releaseCreate())
   if(!incidental||interference==='reject'){
    await retry.waitFor()
    if(interference==='reject'){
     await page.getByRole('alert').filter({hasText:/delayed-id.*fixture gateway unavailable/}).waitFor()
     await page.evaluate(()=>{window.rejectFixtureOpen=false})
    }else assert.deepEqual(await page.evaluate(()=>window.openCalls||[]),[])
    await retry.click()
   }
   await panel.waitFor({state:'hidden',timeout:3000})
   const open=['delayed-id',{route:expectedCreate.route,intent:'in-place'}]
   assert.deepEqual(await page.evaluate(()=>window.openCalls),interference==='reject'?[open,open]:[open])
   assert.deepEqual(await page.evaluate(()=>window.createCalls),[expectedCreate])
   console.log(`PASS ${source}/${interference}`)
  }finally{await page.close()}
 }
}finally{await browser.close()}