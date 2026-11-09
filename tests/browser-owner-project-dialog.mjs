import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'
const {chromium}=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())+'/package.json')('playwright')
const browser=await chromium.launch({headless:true,executablePath:(process.env.CHROME_PATH||(()=>{throw Error('Set CHROME_PATH')})())})
try{
 const page=await browser.newPage({viewport:{width:900,height:700}})
 await page.addInitScript(()=>{window.dialogCalls=0;window.fixtureOpenProjectDialog=()=>{window.dialogCalls++}})
 await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?office')
 await page.getByRole('button',{name:'Aster · state working'}).click();await page.waitForSelector('[data-recent-row]');await page.getByRole('button',{name:'▦ 開啟專案'}).click()
 const add=page.getByRole('button',{name:'新增專案'});assert.equal(await add.isDisabled(),false)
 await add.click();await page.getByRole('heading',{name:'新增專案（Aster）'}).waitFor();assert.equal(await page.evaluate(()=>window.dialogCalls),0)
 await page.getByRole('button',{name:'取消'}).click();assert.ok(await page.locator('[data-recent-row]').count());console.log('PASS plugin-owned dialog despite local extension')
}finally{await browser.close()}