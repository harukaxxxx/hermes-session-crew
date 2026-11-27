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
 const header=page.locator('[data-recent-header]'),footer=page.locator('[data-recent-footer]'),list=page.locator('[data-recent-list]'),row=page.locator('[data-recent-row]').first()
 const all=header.locator('[data-completion-read-all]'),more=footer.locator('[data-recent-more]')
 const bubble=page.getByRole('dialog').filter({has:header}),pencil=bubble.locator('[data-status-edit]'),close=bubble.getByRole('button',{name:/^(關閉面板|Close panel)$/})
 const bottom=()=>list.evaluate(el=>{el.scrollTop=el.scrollHeight})
 const layout=()=>Promise.all([header,all,list,footer,page.getByRole('dialog').filter({has:header})].map(el=>el.boundingBox()))
 const center=box=>box.x+box.width/2
 const checkHeader=async (heading,label)=>{
  assert.equal(await header.getByRole('heading',{name:heading,exact:true}).count(),1)
  assert.equal(await header.getByRole('button',{name:label,exact:true}).count(),1)
  assert.equal(await header.getByTitle(label,{exact:true}).locator('button').count(),1)
  assert.equal(await all.textContent(),'','mark all is icon-only')
  const icon=all.locator('.codicon-check-all[aria-hidden="true"]')
  assert.equal(await icon.count(),1,'uses the Desktop double-check glyph')
  const [glyphBox,arrowBox,titleBox,rowTextBox]=await Promise.all([icon,row.locator(':scope > span:last-child'),header.getByRole('heading'),row.locator('strong')].map(el=>el.boundingBox()))
  assert.ok(Math.abs(center(glyphBox)-center(arrowBox))<1,'glyph centers on the row chevron')
  assert.ok(Math.abs(center(await pencil.boundingBox())-center(glyphBox))<1,'quote pencil centers on the double-check column')
  assert.ok(Math.abs(titleBox.x-rowTextBox.x)<1,'heading aligns with the row text')
  const [panel,cross,avatar]=await Promise.all([bubble,close,bubble.locator('[data-panel-avatar]')].map(el=>el.boundingBox()))
  const top=cross.y-panel.y,right=panel.x+panel.width-cross.x-cross.width
  assert.ok(top>=4&&top<=8&&right>=4&&right<=8&&cross.y<avatar.y,'close sits inside the upper right corner, above the profile row')
 }
 await row.waitFor()
 await checkHeader('工作階段','全部標示為已讀')
 const initial=await layout()
 assert.ok(initial.every(Boolean))
 assert.ok(initial[1].width>=20&&initial[1].height>=20,'double-check has a padded hit area')
 assert.ok((await row.boundingBox()).y-initial[0].y-initial[0].height>=3.9,'header has breathing room above the first row')
 assert.equal(initial[3].height,18)
 assert.equal(await footer.locator('button').count(),0)
 assert.equal(await footer.textContent(),'')
 await bottom()
 await more.waitFor()
 assert.deepEqual(await layout(),initial,'showing Load more does not move the header, viewport, footer or bubble')
 assert.equal(await footer.locator('button').count(),1)
 assert.equal(await more.textContent(),'載入更多')
 const rows=await page.locator('[data-recent-row]').evaluateAll(rows=>rows.map(row=>{
  const title=row.querySelector('strong'),project=title.nextElementSibling
  return {height:row.getBoundingClientRect().height,gap:project.getBoundingClientRect().top-title.getBoundingClientRect().bottom}
 }))
 assert.ok(rows.length>0&&rows.every(({height,gap})=>Math.abs(height-52)<1&&Math.abs(gap)<1),JSON.stringify(rows))
 assert.ok(Math.abs(center(await more.boundingBox())-center(await footer.boundingBox()))<1)
 await more.click()
 assert.equal(await page.locator('[data-recent-row]').count(),24)
 await bottom()
 await more.waitFor({state:'detached'})
 assert.equal(await more.count(),0)
 assert.equal(await footer.textContent(),'')
 assert.deepEqual(await layout(),initial,'the exhausted list keeps the same geometry')
 await checkHeader('工作階段','全部標示為已讀')
 await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?locale=en')
 await page.getByRole('button',{name:'Aster · state unknown'}).click()
 await row.waitFor();await bottom();await more.waitFor()
 assert.equal(await more.textContent(),'Load more')
 await checkHeader('Sessions','Mark all as read')
 await close.click();await bubble.waitFor({state:'hidden'})
 console.log('PASS localized Recent heading and double-check, aligned chevrons, centered load-more and stable bubble geometry')
}finally{await browser.close()}
