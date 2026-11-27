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
 const p=await browser.newPage({viewport:{width:900,height:500},reducedMotion:'reduce'})
 const page=pathToFileURL(path.resolve('tests/sdk-preview.html')).href
 const full='ABCDEFGHIJKLMNOPQRSTUVWXYZXX',short='Ready'
 const q=p.locator('[data-status-quote]'),preview=q.locator('[aria-hidden="true"]'),accessible=q.locator('span:not([aria-hidden])')
 const avatar=p.locator('[data-panel-avatar]'),pencil=p.locator('[data-status-edit]')
 const bubble=p.locator('[data-slot="popover-content"]').filter({has:avatar})
 const open=async query=>{
  await p.goto(page+query)
  await p.addStyleTag({path:path.resolve('tests/sdk-css/styles.css')})
  await p.getByRole('button',{name:'Aster · 狀態 未知'}).click()
 }
 const presentation=(text,clipped)=>p.waitForFunction(({text,clipped})=>{
  const q=document.querySelector('[data-status-quote]'),preview=q?.querySelector('[aria-hidden="true"]')?.textContent
  return clipped?q?.getAttribute('title')===text&&preview!==text&&preview?.endsWith('...'):preview===text&&!q.hasAttribute('title')
 },{text,clipped},{timeout:5000})
 const layout=async tag=>{
  const {image,loaded,a,n,q,e,h,border,line,font}=await avatar.evaluate(avatar=>{
   const header=avatar.parentElement,name=header.querySelector('strong'),quote=header.querySelector('[data-status-quote]'),edit=header.querySelector('[data-status-edit]'),css=getComputedStyle(quote)
   const rect=el=>el.getBoundingClientRect().toJSON()
   return {image:avatar.tagName,loaded:avatar.tagName!=='IMG'||avatar.naturalWidth>0,a:rect(avatar),n:rect(name),q:rect(quote),e:rect(edit),h:rect(header),border:getComputedStyle(avatar).borderTopWidth,line:parseFloat(css.lineHeight),font:parseFloat(css.fontSize)}
  })
  const close=(first,second,message)=>assert.ok(Math.abs(first-second)<1,`${message}: ${first} vs. ${second}`)
  assert.equal(image,tag)
  assert.ok(loaded)
  assert.equal(border,'2px')
  close(a.height,34,'avatar outer height including border')
  close(a.top,n.top,'name line starts at avatar top')
  close(a.bottom,q.bottom,'quote line ends at avatar bottom')
  close(n.bottom,q.top,'name and quote line boxes meet')
  close(h.height,a.height,'header stays at avatar height')
  close(q.right,e.left,'pencil stays to the right of the quote')
  assert.ok(q.width>0&&line>=font&&e.height>=20,'quote and pencil retain usable space')
  console.log(`  ${tag} layout: avatar ${a.height}px, name ${n.height}px, quote ${q.height}px, pencil ${e.height}px`)
 }
 await open('?longquote')
 await bubble.evaluate(e=>{e.style.width='380px'})
 await p.waitForFunction(text=>document.querySelector('[data-status-quote] [aria-hidden="true"]')?.textContent===text,full)
 assert.equal(await q.getAttribute('title'),null,'a complete preview does not show a redundant tooltip')
 await layout('SPAN')
 await p.screenshot({path:'evidence/status-quote-header.png'})
 await bubble.evaluate(e=>{e.style.width='195px'})
 await presentation(full,true)
 await layout('SPAN')
 assert.equal(await accessible.textContent(),`狀態：${full}`)
 const before=await preview.textContent()
 await q.hover()
 assert.equal(await q.getAttribute('title'),full)
 await p.screenshot({path:'evidence/status-quote-long.png'})
 await q.click()
 assert.equal(await p.locator('[data-status-full], [data-status-editor]').count(),0)
 assert.equal(await preview.textContent(),before)
 await bubble.evaluate(e=>{e.style.width='380px';return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))})
 assert.equal(await preview.textContent(),before,'hover holds the preview even when its box grows')
 assert.equal(await q.getAttribute('title'),full)
 await p.mouse.move(899,499)
 await presentation(full,false)
 await q.hover({position:{x:10,y:6}})
 await bubble.evaluate(e=>{e.style.width='195px'})
 assert.equal(await q.evaluate(e=>e.matches(':hover')),true,'narrowing keeps the pointer over the quote')
 await presentation(full,true)
 await pencil.click()
 const dialog=p.getByRole('dialog',{name:'編輯狀態短句',exact:true}),input=dialog.getByRole('textbox',{name:'未知',exact:true})
 assert.equal(await input.inputValue(),full)
 await p.waitForFunction(length=>{
  const active=document.activeElement
  return active?.matches('[data-status-input="unknown"]')&&active.selectionStart===0&&active.selectionEnd===length
 },full.length)
 await input.fill(short)
 await dialog.getByRole('button',{name:'儲存'}).click()
 await dialog.waitFor({state:'detached'})
 await presentation(short,false)
 assert.equal(await accessible.textContent(),`狀態：${short}`)
 await p.screenshot({path:'evidence/status-quote-short.png'})
 await pencil.click()
 await input.fill(full)
 await dialog.getByRole('button',{name:'儲存'}).click()
 await dialog.waitFor({state:'detached'})
 await presentation(full,true)
 assert.equal(await accessible.textContent(),`狀態：${full}`)

 await p.setViewportSize({width:340,height:500})
 await open('?longquote&gallery')
 await presentation(full,true)
 await layout('IMG')
 console.log('PASS aligned fallback and image headers, tooltip only on truncation, resize/hover, accessible full text, passive click and pencil edits')
}finally{await browser.close()}
