import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'

const require=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())+'/package.json')
const {chromium}=require('playwright')
const browser=await chromium.launch({headless:true,executablePath:(process.env.CHROME_PATH||(()=>{throw Error('Set CHROME_PATH')})())})
const url=pathToFileURL(path.resolve('tests/sdk-preview.html')).href
try{
 const page=await browser.newPage({viewport:{width:900,height:500}})
 const avatar=page.getByRole('button',{name:'Aster · 狀態 未知'}),list=page.locator('[data-recent-list]'),rows=page.locator('[data-recent-row]')
 await page.goto(url);await avatar.click();await rows.first().waitFor()
 assert.equal(await rows.count(),15)
 const initialHeight=await list.evaluate(el=>el.getBoundingClientRect().height)
 const more=page.locator('[data-recent-more]')
 assert.equal(await more.count(),0)
 await list.evaluate(el=>{el.scrollTop=el.scrollHeight})
 await more.click()
 assert.equal(await rows.count(),24)
 const result=await list.evaluate(el=>{
  const title=el.querySelector('[data-recent-row] strong'),r=el.getBoundingClientRect(),style=getComputedStyle(el)
  return {height:r.height,reserve:r.height-parseFloat(style.paddingTop),scrollHeight:el.scrollHeight,overflow:style.overflowY,titleOverflow:getComputedStyle(title).textOverflow,titleFits:title.getBoundingClientRect().right<=r.right}
 })
 assert.equal(result.overflow,'auto');assert.equal(result.height,initialHeight,'load more does not resize the viewport')
 assert.equal(result.reserve,260);assert.ok(result.scrollHeight>result.height)
 assert.equal(result.titleOverflow,'ellipsis');assert.ok(result.titleFits)
 for(const name of ['快速新增','▦ 開啟專案']){
  const {y,height}=await page.getByRole('button',{name,exact:true}).boundingBox()
  assert.ok(height>0&&y>=0&&y+height<=500,`${name} remains in the viewport`)
 }
 await page.goto(url+'?pending');await avatar.click();await rows.first().waitFor()
 assert.equal(await rows.count(),15);assert.match(await page.getByRole('dialog').innerText(),/專案載入中/)
 await page.goto(url+'?error');await avatar.click()
 await page.getByText('工作階段無法載入：fixture session error').waitFor()
 assert.equal(await page.getByRole('button',{name:'重試'}).count(),1)
 console.log('PASS controlled Chromium real Popover 15→24, fixed five-row viewport, footer, project pending, session error/retry',JSON.stringify(result))
}finally{await browser.close()}
