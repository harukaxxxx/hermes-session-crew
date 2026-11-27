import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'

const {chromium}=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())+'/package.json')('playwright')
const browser=await chromium.launch({headless:true,executablePath:(process.env.CHROME_PATH||(()=>{throw Error('Set CHROME_PATH')})())})
try{
 const p=await browser.newPage({viewport:{width:900,height:500},reducedMotion:'reduce'})
 await p.addInitScript(()=>{Math.random=()=>.6})
 await p.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?office')
 await p.addStyleTag({path:path.resolve('tests/sdk-css/styles.css')})
 const avatar=p.getByRole('button',{name:'Aster · 狀態 工作中'}),quote=p.locator('[data-status-quote]')
 const editTitle='編輯狀態短句'
 const editor=p.getByRole('dialog',{name:editTitle,exact:true}),field=name=>editor.getByRole('textbox',{name,exact:true}),working=field('工作中'),waiting=field('等待中')
 const overlay=p.locator('[data-slot="dialog-overlay"]')
 const workingDefaults=['我正在忙。','這件事還在做。','正在處理，稍等一下。','還沒做完，我繼續。','我先忙這件事。']
 const waitingDefaults=['我在等你回覆。','還需要你補充一下。','我先停在這裡，等你確認。','你回我之後，我再接著做。','下一步等你說。']
 const idleDefaults=['我現在有空。','有事可以找我。','現在沒在忙。','有新任務，可以交給我。','我可以接下一件事。']
 const defaultQuote=workingDefaults[3],waitingDefault=waitingDefaults[3],mikaDefault=idleDefaults[3]
 const savedQuote='瀏覽器本機短句',savedWaiting=['等一下，先別走','等等就回來']
 const asterKey=state=>`status:["fixture","Aster"]:quote-v1:${state}`
 const stored=()=>p.evaluate(()=>Object.entries(window.fixtureStorage).filter(([key])=>key.startsWith('status:')))
 const changeState=state=>p.evaluate(async value=>{window.fixtureStatus[0].state=value;await window.officeClient.refetchQueries({queryKey:['sessioncrew','status']})},state)
 const waitForQuote=title=>p.waitForFunction(value=>document.querySelector('[data-status-quote]')?.title===value,title)
 const dismissed=async()=>{
  await editor.waitFor({state:'detached'})
  await p.waitForFunction(()=>document.activeElement?.matches('[data-status-edit]'))
  await quote.waitFor({state:'visible'})
 }
 const open=async (expected,state='working')=>{
  await p.getByRole('button',{name:editTitle,exact:true}).click()
  await editor.waitFor()
  await p.waitForFunction(({state,expected})=>{
   const field=document.activeElement
   return field?.dataset.statusInput===state&&field.value===expected&&field.selectionStart===0&&field.selectionEnd===expected.length
  },{state,expected})
 }
 await avatar.click()
 await open(workingDefaults.join(', '))
 assert.equal(await editor.locator('[data-slot="dialog-header"] [data-slot="dialog-title"]').textContent(),editTitle)
 assert.equal(await editor.getByRole('textbox').count(),6)
 for(const name of ['工作中','等待中','閒置','在線','離線','未知']){
  assert.deepEqual(await field(name).evaluate(input=>{
   const label=input.labels[0],dialog=input.closest('[role=dialog]').getBoundingClientRect(),box=input.getBoundingClientRect(),lab=label.getBoundingClientRect()
   return [input.tagName,input.type,input.maxLength,input.readOnly,lab.right<box.left,lab.top<box.bottom&&lab.bottom>box.top,box.top>=dialog.top&&box.bottom<=dialog.bottom]
  }),['INPUT','text',512,false,true,true,true],name)
 }
 assert.match(await editor.getByText(/半形逗號/).textContent(),/準備好了, 稍後回來.*還原預設短句/)
 assert.match(await editor.getAttribute('class'),/\bmax-w-md\b/)
 assert.equal(await editor.locator('[data-slot="dialog-footer"]').getByRole('button',{name:'取消'}).getAttribute('data-variant'),'ghost')
 assert.equal(await editor.locator('[data-slot="dialog-footer"]').getByRole('button',{name:'儲存'}).getAttribute('data-variant'),'default')
 assert.equal(await editor.locator('[data-slot="dialog-close-button"]').count(),1)
 assert.equal(await editor.evaluate(el=>{
  const {x,y,width,height}=el.getBoundingClientRect()
  return getComputedStyle(el).position==='fixed'&&Math.abs(x+width/2-innerWidth/2)<1&&Math.abs(y+height/2-innerHeight/2)<1
 }),true,'native dialog is centered in the viewport')
 assert.equal(await overlay.evaluate(el=>{
  const {width,height}=el.getBoundingClientRect(),css=getComputedStyle(el)
  return width===innerWidth&&height===innerHeight&&css.position==='fixed'&&css.backgroundColor!=='rgba(0, 0, 0, 0)'
 }),true,'native scrim covers the viewport')
 assert.equal(await quote.count(),1,'underlying bubble remains mounted')
 await p.screenshot({path:'evidence/status-quote-editor.png'})
 await working.press('Enter')
 await dismissed()
 assert.deepEqual(await stored(),[],'unchanged defaults are not persisted')

 for(const dismiss of [()=>editor.getByRole('button',{name:'取消'}).click(),()=>p.keyboard.press('Escape'),()=>editor.locator('[data-slot="dialog-close-button"]').click()]){
  await open(workingDefaults.join(', '))
  await working.fill('未送出的草稿')
  await waiting.fill('另一個未送出的草稿')
  await dismiss()
  await dismissed()
  assert.deepEqual(await stored(),[])
  assert.equal(await quote.getAttribute('title'),defaultQuote)
 }
 await open(workingDefaults.join(', '))
 const waitingDraft=` ${savedWaiting.join(', , ')} , ${savedWaiting[0]} `
 await working.fill(`  ${savedQuote}  `)
 await waiting.fill(waitingDraft)
 await changeState('waiting')
 await waitForQuote(waitingDefault)
 assert.equal(await working.inputValue(),`  ${savedQuote}  `)
 assert.equal(await waiting.inputValue(),waitingDraft)
 assert.equal(await p.evaluate(()=>document.activeElement?.dataset.statusInput),'waiting')
 assert.deepEqual(await stored(),[])
 for(const key of ['Enter','Escape'])await waiting.evaluate((el,key)=>el.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,isComposing:true})),key)
 assert.equal(await editor.count(),1)
 assert.deepEqual(await stored(),[])
 await waiting.press('Enter')
 await dismissed()
 await waitForQuote(savedWaiting[1])
 const asterValues=[[asterKey('working'),savedQuote],[asterKey('waiting'),savedWaiting]]
 assert.deepEqual(await stored(),asterValues)
 await changeState('working')
 await waitForQuote(savedQuote)
 await p.getByRole('button',{name:'關閉面板'}).click()
 await p.getByRole('button',{name:'Mika · 狀態 閒置'}).click()
 await open(idleDefaults.join(', '),'idle')
 assert.equal(await working.inputValue(),workingDefaults.join(', '),'another owner never sees Aster’s drafts or storage')
 assert.equal(await waiting.inputValue(),waitingDefaults.join(', '))
 await working.fill('Mika 的短句')
 await working.press('Enter')
 await dismissed()
 const ownerValues=[...asterValues,['status:["fixture","Mika"]:quote-v1:working','Mika 的短句']]
 assert.deepEqual(await stored(),ownerValues)
 assert.equal(await quote.getAttribute('title'),mikaDefault)
 await p.getByRole('button',{name:'關閉面板'}).click()
 await avatar.click()
 await waitForQuote(savedQuote)
 await open(savedQuote)
 assert.equal(await waiting.inputValue(),savedWaiting.join(', '))
 await p.keyboard.press('Escape')
 await dismissed()
 assert.deepEqual(await stored(),ownerValues)
 await p.setViewportSize({width:900,height:300})
 const projects=p.getByRole('button',{name:'▦ 開啟專案'})
 await projects.click()
 assert.equal(await p.getByRole('dialog').count(),2)
 await open(savedQuote)
 await p.keyboard.press('Escape')
 await dismissed()
 assert.equal(await p.getByRole('dialog').count(),2,'closing the editor preserves both existing popovers')
 await p.screenshot({path:'evidence/remaining-quotes-short.png'})
 await p.keyboard.press('Escape')
 assert.equal(await p.getByRole('dialog').count(),1)
 await projects.click()
 await p.getByRole('dialog').last().getByRole('button',{name:/Very long project title/}).click()
 await p.waitForFunction(()=>window.openCalls?.length===1)
 assert.equal((await p.evaluate(()=>window.openCalls[0]))[1].route.profile,'Aster')
 console.log('PASS six labeled inputs in the native modal, focus and cancellation/IME, cross-status persistence and owner isolation, and nested project popup')

 // The SDK fixture uses real TanStack Query and its existing polling interval.
 await p.clock.install()
 await p.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?office')
 await avatar.click()
 await waitForQuote(defaultQuote)
 await p.clock.pauseAt(await p.evaluate(()=>Date.now()+250))
 const statusQuery=op=>p.evaluate(async op=>{
  const client=window.officeClient, query=client.getQueryCache().find({queryKey:['sessioncrew','status'],exact:false})
  if(op==='cache')client.setQueryData(query.queryKey,query.state.data)
  if(op==='fail')window.fixtureStatus=null
  if(op==='refetch'||op==='fail')await client.refetchQueries({queryKey:query.queryKey})
  return {updates:query.state.dataUpdateCount,errors:query.state.errorUpdateCount}
 },op)
 for(let i=0;i<6;i++){
  await statusQuery('cache');await p.clock.runFor(30)
  assert.equal(await quote.getAttribute('title'),defaultQuote,'cache deliveries are not status refreshes')
 }
 const start=(await statusQuery()).updates
 await statusQuery('refetch');await p.clock.runFor(30)
 assert.equal((await statusQuery()).updates,start+1)
 assert.equal(await quote.getAttribute('title'),defaultQuote)
 for(let i=2;i<=5;i++){
  await p.clock.runFor(5000)
  assert.equal((await statusQuery()).updates,start+i,'the existing interval sampled exactly once')
  assert.equal(await quote.getAttribute('title'),i===5?workingDefaults[2]:defaultQuote,`default quote after ${i} successful status refreshes`)
 }
 await statusQuery('fail');await p.clock.runFor(30)
 const unknownDefault='我這邊還沒有狀態可回報。'
 assert.equal(await quote.getAttribute('title'),unknownDefault,'status change draws from that state’s defaults')
 const failed=await statusQuery()
 for(let i=1;i<=5;i++){
  await statusQuery('refetch');await p.clock.runFor(30)
  assert.deepEqual(await statusQuery(),{updates:failed.updates,errors:failed.errors+i})
  assert.equal(await quote.getAttribute('title'),unknownDefault,'failed status refreshes do not advance')
 }
 await p.getByRole('button',{name:'關閉面板'}).click()
 await quote.waitFor({state:'detached'})
 await p.getByRole('button',{name:'Aster · 狀態 未知'}).click()
 await waitForQuote('我的狀態暫時沒顯示。')
 assert.deepEqual(await stored(),[],'rotating and reopening the defaults does not write storage')
 console.log('PASS random defaults change on the fifth shared /status success, skip cache updates and failures, and exclude the last phrase on reopen without writing storage')
}finally{await browser.close()}
