import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'
const {chromium}=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())+'/package.json')('playwright')
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||(()=>{throw Error('Set CHROME_PATH')})()})
try{
 const page=await browser.newPage({viewport:{width:900,height:700}})
 await page.addInitScript(()=>{window.dialogCalls=0;window.fixtureOpenProjectDialog=()=>{window.dialogCalls++};window.fixtureProjects=[{id:'p',label:'Fixture project',path:'/fixture/project',sessionIds:['id0'],repos:[]}]})
 await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?office')
 for(const [name,state] of [['Aster','working'],['Mika','idle']]){
  await page.getByRole('button',{name:`${name} · state ${state}`}).click();await page.waitForSelector('[data-recent-row]')
  await page.getByRole('button',{name:'▦ 開啟專案'}).click()
  const add=page.getByRole('button',{name:'新增專案'});assert.equal(await add.isDisabled(),false)
  await add.click();await page.getByRole('heading',{name:`新增專案（${name}）`}).waitFor();assert.equal(await page.evaluate(()=>window.dialogCalls),0);await page.getByRole('button',{name:'取消'}).click()
  await page.getByRole('button',{name:'在 Fixture project 新增對話'}).click()
  await page.waitForFunction(n=>window.createCalls?.some(c=>c.route.profile===n),name)
  const call=(await page.evaluate(()=>window.createCalls)).at(-1);assert.equal(call.route.profile,name);assert.equal(call.route.targetProfile,name);assert.equal(call.params.cwd,'/fixture/project');assert.equal(call.params.cwd_explicit,true)
 }
 console.log('PASS plugin dialog and owner-isolated project session routes')
}finally{await browser.close()}