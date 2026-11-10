import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT
const {chromium}=createRequire(root+'/package.json')('playwright')
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH})
try {
 for(const height of [900,700,430,300]) {
  const page=await browser.newPage({viewport:{width:900,height},reducedMotion:'reduce'})
  await page.addInitScript(()=>{window.fixtureProjects=[{id:'p',label:'Project',path:'/fixture',sessionIds:['id0'],repos:[]}]})
  await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?office&gallery')
  await page.getByRole('button',{name:/^Aster · 狀態/}).click()
  await page.waitForSelector('[data-recent-row]')
  const main=page.locator('[data-slot="popover-content"]').first()
  const measure=()=>main.evaluate(e=>{const rect=x=>{const r=x.getBoundingClientRect();return [r.x,r.y,r.width,r.height]};const s=getComputedStyle(e);return {main:rect(e),padding:s.padding,header:rect(e.querySelector('[data-panel-avatar]').parentElement),row:rect(e.querySelector('[data-recent-row]')),footer:rect([...e.querySelectorAll('button')].find(x=>x.textContent.includes('快速新增')).parentElement)}})
  const before=await measure()
  await page.screenshot({path:`evidence/stability-before-${height}.png`})
  await main.getByRole('button',{name:'▦ 開啟專案'}).click()
  await page.locator('[data-project-row]').first().waitFor()
  await page.waitForTimeout(150)
  const after=await measure()
  await page.screenshot({path:`evidence/stability-after-${height}.png`})
  console.log(JSON.stringify({height,before,after}))
  assert.deepEqual(after,before,`main bubble geometry must not change at height ${height}`)
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('[data-slot="popover-content"]').count(),1)
  assert.deepEqual(await measure(),before,`main bubble geometry must remain stable after closing at height ${height}`)
  await page.close()
 }
 console.log('PASS project toggle preserves main bubble and content geometry')
} finally {await browser.close()}
