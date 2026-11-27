import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'
const require=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT)+'/package.json')
const {chromium}=require('playwright')
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH})
try{
 const page=await browser.newPage({viewport:{width:900,height:500}})
 await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href)
 await page.getByRole('button',{name:'Aster · 狀態 未知'}).click()
 const more=page.locator('[data-recent-more]'),all=page.locator('[data-completion-read-all]'),list=page.locator('[data-recent-list]')
 const bottom=()=>list.evaluate(el=>{el.scrollTop=el.scrollHeight})
 const footer=async()=>[await page.locator('[data-recent-footer]').boundingBox(),await all.boundingBox()]
 await all.waitFor()
 const initial=await footer()
 assert.equal(await more.count(),0)
 await bottom()
 await more.waitFor()
 assert.deepEqual(await footer(),initial,'showing Load more does not move the footer or Mark all read')
 assert.equal(await more.textContent(),'載入更多')
 assert.equal(await all.textContent(),'全部已讀')
 const rows=await page.locator('[data-recent-row]').evaluateAll(rows=>rows.map(row=>{
  const title=row.querySelector('strong'),project=title.nextElementSibling
  return {height:row.getBoundingClientRect().height,gap:project.getBoundingClientRect().top-title.getBoundingClientRect().bottom}
 }))
 assert.ok(rows.length>0&&rows.every(({height,gap})=>Math.abs(height-52)<1&&Math.abs(gap)<1),JSON.stringify(rows))
 const geometry=await page.evaluate(()=>{
  const box=x=>document.querySelector(x).getBoundingClientRect()
  const f=box('[data-recent-footer]'),m=box('[data-recent-more]'),a=box('[data-completion-read-all]')
  return {centerDelta:Math.abs((m.left+m.right-f.left-f.right)/2),rightDelta:Math.abs(a.right-f.right),sameRow:Math.abs((m.top+m.bottom-a.top-a.bottom)/2),separate:m.right<=a.left}
 })
 assert.ok(geometry.centerDelta<1,JSON.stringify(geometry))
 assert.ok(geometry.rightDelta<1&&geometry.sameRow<1&&geometry.separate,JSON.stringify(geometry))
 await more.click()
 assert.equal(await page.locator('[data-recent-row]').count(),24)
 await bottom()
 assert.equal(await more.count(),0)
 assert.deepEqual(await footer(),initial,'the exhausted list keeps the same footer geometry')
 assert.ok(await all.isVisible(),'mark all remains visible after the last page')
 await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?locale=en')
 await page.getByRole('button',{name:'Aster · state unknown'}).click()
 await all.waitFor();await bottom();await more.waitFor()
 assert.equal(await page.locator('[data-recent-more]').textContent(),'Load more')
 assert.equal(await page.locator('[data-completion-read-all]').textContent(),'Mark all read')
 console.log('PASS centered load-more and right-aligned persistent mark-all footer')
}finally{await browser.close()}
