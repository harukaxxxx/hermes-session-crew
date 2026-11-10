import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
const {chromium}=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())+'/package.json')('playwright')
const browser=await chromium.launch({headless:true,executablePath:(process.env.CHROME_PATH||(()=>{throw Error('Set CHROME_PATH')})())})
await mkdir('evidence',{recursive:true})
try {
 for(const height of [700,400]) {
  const page=await browser.newPage({viewport:{width:900,height},reducedMotion:'reduce'})
  await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?office')
  await page.addStyleTag({path:path.resolve('tests/sdk-css/styles.css')})
  // Fixture palette: real SDK CSS, synthetic theme tokens (not a live host).
  await page.addStyleTag({content:':root{--ui-base:#eeeaf1;--ui-bg-editor:#292a30;--ui-chat-bubble-background:#292a30;--stroke-nous:#575761;--ui-text-primary:#eeeaf1;--ui-text-tertiary:#aaa6af;--ui-text-quaternary:#9a96a0;--conversation-text-font-size:14px;--conversation-caption-font-size:12px;--conversation-caption-line-height:1.4;--z-modal:100;--z-modal-backdrop:99;--foreground:#eeeaf1;--primary:#a7b9de}'} )
  await page.getByRole('button',{name:'Aster · 狀態 工作中'}).click();await page.waitForSelector('[data-recent-row]')
  await page.getByRole('button',{name:'▦ 開啟專案'}).click();await page.getByRole('button',{name:'新增專案'}).click()
  const dialog=page.locator('[data-slot="dialog-content"]');await page.getByRole('heading',{name:'新增專案（Aster）'}).waitFor()
  const info=await dialog.evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el),body=el.querySelector('[data-slot=dialog-header]').parentElement;return {x:r.x,y:r.y,w:r.width,h:r.height,position:s.position,overflow:getComputedStyle(body).overflowY,scrollHeight:body.scrollHeight,clientHeight:body.clientHeight}})
  assert.equal(info.position,'fixed');assert.equal(info.overflow,'auto');assert.ok(info.x>=0&&info.y>=0&&info.x+info.w<=900&&info.y+info.h<=height,JSON.stringify(info))
  await page.screenshot({path:path.resolve(`evidence/dialog-${height}-top.png`)})
  const generate=page.getByRole('button',{name:'生成點子（使用所選設定檔的 LLM）'});await generate.scrollIntoViewIfNeeded();await generate.click();await page.getByRole('alert').waitFor()
  assert.match(await page.getByRole('alert').innerText(),/點子生成失敗/)
  const cancel=page.getByRole('button',{name:'取消'});await cancel.scrollIntoViewIfNeeded();const cr=await cancel.boundingBox();assert.ok(cr.y>=0&&cr.y+cr.height<=height)
  if(height===400) assert.ok(await dialog.evaluate(el=>el.querySelector('[data-slot=dialog-header]').parentElement.scrollTop)>0)
  await page.screenshot({path:path.resolve(`evidence/dialog-${height}-footer.png`)})
  await cancel.click();await dialog.waitFor({state:'detached'})
  console.log('PASS',height,JSON.stringify(info),'generation fixture error and cancel clicked')
  await page.close()
 }
}finally{await browser.close()}
