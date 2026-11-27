import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'

const root=process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT
const executablePath=process.env.CHROME_PATH
if(!root||!executablePath)throw Error('Set HERMES_CHECKOUT (or HERMES_AGENT_ROOT) and CHROME_PATH')
const {chromium}=createRequire(path.join(root,'package.json'))('playwright')
const browser=await chromium.launch({headless:true,executablePath})
try{
 const p=await browser.newPage({viewport:{width:900,height:500}})
 await p.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?longquote')
 await p.getByRole('button',{name:'Aster · 狀態 未知'}).click()
 const full='ABCDEFGHIJKLMNOPQRSTUVWXYZXX'
 const q=p.locator('[data-status-quote]'),preview=q.locator('[aria-hidden="true"]')
 await p.waitForFunction(value=>document.querySelector('[data-status-quote]')?.title===value,full)
 const previous=await preview.textContent()
 await q.evaluate(e=>{e.style.width='95px';e.style.flex='0 0 95px'})
 await p.waitForFunction(previous=>{
  const text=document.querySelector('[data-status-quote] [aria-hidden="true"]')?.textContent
  return text!==previous&&text?.endsWith('...')
 },previous,{timeout:5000})
 const before=await preview.textContent()
 await q.hover()
 assert.equal(await q.getAttribute('title'),full)
 await p.screenshot({path:'evidence/status-quote-long.png'})
 await q.click()
 assert.equal(await p.locator('[data-status-full]').count(),0)
 assert.equal(await preview.textContent(),before)
 await q.evaluate(e=>{e.style.width='120px';e.style.flex='0 0 120px';return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))})
 assert.equal(await preview.textContent(),before,'hover holds the preview even when its box gets wider')
 assert.equal(await q.getAttribute('title'),full)
 await p.mouse.move(899,499)
 await p.waitForFunction(before=>document.querySelector('[data-status-quote] [aria-hidden="true"]')?.textContent!==before,before)
 await p.locator('[data-status-edit]').click()
 const dialog=p.getByRole('dialog',{name:'編輯狀態短句',exact:true}),input=dialog.getByRole('textbox',{name:'未知',exact:true})
 assert.equal(await input.inputValue(),full)
 await p.waitForFunction(length=>{
  const active=document.activeElement
  return active?.matches('[data-status-input="unknown"]')&&active.selectionStart===0&&active.selectionEnd===length
 },full.length)
 await p.keyboard.press('Escape')
 await dialog.waitFor({state:'detached'})
 assert.equal(await q.getAttribute('title'),full)
 console.log('PASS truncated ASCII preview, native hover title, passive click and pencil edit')
}finally{await browser.close()}
