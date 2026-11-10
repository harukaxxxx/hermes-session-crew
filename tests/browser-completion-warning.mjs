import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'

const checkout=process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT
if(!checkout||!process.env.CHROME_PATH||!process.env.RAIL_TEST_SCRATCH) throw Error('Set HERMES_CHECKOUT, CHROME_PATH and RAIL_TEST_SCRATCH')
const {chromium}=createRequire(path.join(checkout,'package.json'))('playwright')
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH})
try {
 for(const height of [700,300]) {
  const page=await browser.newPage({viewport:{width:900,height},reducedMotion:'reduce'})
  await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?office&gallery')
  const warning=page.locator('[data-completion-error]'), rail=page.locator('[data-profile-rail]')
  await warning.waitFor(); await page.locator('.profile-rail-hit').first().waitFor()
  assert.equal(await warning.textContent(),'⚠️')
  assert.equal(await warning.getAttribute('title'),await warning.getAttribute('aria-label'))
  assert.ok(await warning.getAttribute('title'))
  assert.equal(await warning.evaluate(e=>e.tagName),'BUTTON')
  const geometry=await page.evaluate(()=>{
   const panel=document.querySelector('#pane').getBoundingClientRect(), warning=document.querySelector('[data-completion-error]').getBoundingClientRect(),rail=document.querySelector('[data-profile-rail]').getBoundingClientRect()
   const style=getComputedStyle(document.querySelector('[data-completion-error]'))
   return {right:panel.right-warning.right,bottom:panel.bottom-warning.bottom,railBottom:rail.bottom,warningTop:warning.top,border:style.borderTopWidth,marginTop:style.marginTop}
  })
  assert.ok(geometry.right>0&&geometry.right<=12&&geometry.bottom>0&&geometry.bottom<=12,JSON.stringify(geometry))
  assert.equal(geometry.border,'0px',JSON.stringify(geometry))
  assert.equal(geometry.marginTop,'8px',JSON.stringify(geometry))
  assert.ok(geometry.warningTop-geometry.railBottom>=8,JSON.stringify(geometry))
  const last=page.locator('.profile-rail-hit').last()
  await rail.evaluate(e=>{e.scrollTop=e.scrollHeight})
  await last.scrollIntoViewIfNeeded()
  await last.click()
  await page.locator('[data-recent-row]').first().waitFor()
  await page.keyboard.press('Escape')
  await rail.evaluate(e=>{e.scrollTop=0})
  await page.screenshot({path:path.join(process.env.RAIL_TEST_SCRATCH,`completion-warning-${height}.png`)})
  await page.close()
 }
 console.log('PASS completion warning symbol, accessible label, bottom-right padding, and scrollable avatar interaction at 700px/300px')
} finally {await browser.close()}
