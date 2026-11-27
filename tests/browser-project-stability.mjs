import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT
const require=createRequire(root+'/package.json')
const {chromium}=require('playwright')
const codicon='@vscode/codicons/dist/codicon.css'
const codiconCss=pathToFileURL(require.resolve(codicon,{paths:[root+'/apps/desktop',root]})).href
const sdkCss=pathToFileURL(path.resolve('tests/sdk-css/styles.css')).href
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH})
const cases=[{width:900,height:900,count:8},{width:900,height:700,count:1},{width:900,height:430,count:8},{width:900,height:300,count:8},{width:390,height:430,count:8}]
try {
 let standardInset
 for(const {width,height,count} of cases) {
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'})
  await page.addInitScript(n=>{
   const long='Long name '.repeat(20)
   window.fixtureSessionCount=5
   window.fixtureSessionList=async()=>({sessions:Array.from({length:window.fixtureSessionCount},(_,i)=>({id:'id'+i,title:`Session ${i} ${long}`}))})
   window.fixtureProjects=Array.from({length:n},(_,i)=>({id:'p'+i,label:`Project ${i} ${long}`,path:'/fixture/project'+i,sessionIds:i===0?['id0']:[],repos:[]}))
  },count)
  await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?office&gallery')
  await page.addStyleTag({url:sdkCss})
  await page.addStyleTag({url:codiconCss})
  await page.getByRole('button',{name:/^Aster · 狀態/}).click()
  const dialogs=page.locator('[data-slot="popover-content"]'),main=dialogs.first(),project=dialogs.last()
  const cue=main.locator('[data-recent-scroll-cue]')
  await main.locator('[data-recent-row] strong + span').filter({hasText:'Project 0 Long name'}).first().waitFor()
  await page.waitForFunction(()=>document.querySelector('[data-slot="popover-content"]').getBoundingClientRect().left>0)
  const initial=await recentGeometry(main)
  if(height>=700) assert.equal(initial.cueLeft,null,'five rows fit without a cue')
  await page.evaluate(async()=>{window.fixtureSessionCount=24;await window.officeClient.refetchQueries({queryKey:['sessioncrew','recent']})})
  await main.locator('[data-recent-row]').nth(14).waitFor({state:'attached'})
  await cue.waitFor()
  const list=main.locator('[data-recent-list]')
  await list.evaluate(el=>{el.scrollTop=el.scrollHeight})
  await main.locator('[data-recent-more]').click()
  await list.evaluate(el=>{el.scrollTop=0})
  const overflow=await recentGeometry(main)
  assert.equal(overflow.inset,initial.inset,'loading more does not shift the chevron column')
  const measure=()=>main.evaluate(e=>{const rect=x=>{const r=x.getBoundingClientRect();return [r.x,r.y,r.width,r.height]};const s=getComputedStyle(e);return {main:rect(e),padding:s.padding,header:rect(e.querySelector('[data-panel-avatar]').parentElement),row:rect(e.querySelector('[data-recent-row]')),footer:rect([...e.querySelectorAll('button')].find(x=>x.textContent.includes('快速新增')).parentElement)}})
  const before=await measure()
  await page.screenshot({path:`evidence/stability-before-${width}x${height}.png`})
  await main.getByRole('button',{name:'▦ 開啟專案'}).click()
  await project.locator('[data-project-row]').first().waitFor({state:'attached'})
  await page.waitForFunction(()=>{
   const [main,project]=document.querySelectorAll('[data-slot="popover-content"]')
   const a=main.getBoundingClientRect(),b=project.getBoundingClientRect()
   return b.top>=0&&b.bottom<=innerHeight&&(b.top>=a.bottom||b.bottom<=a.top||b.left>=a.right||b.right<=a.left)
  })
  if(count>3) await project.locator('[data-project-scroll-cue]').waitFor()
  const after=await measure()
  const recent=await recentGeometry(main)
  const columns=await project.evaluate(e=>{
   const center=x=>{const {left,right}=x.getBoundingClientRect();return (left+right)/2}
   const header=e.querySelector('button'),rows=[...e.querySelectorAll('[data-project-launch]')]
   const cue=e.querySelector('[data-project-scroll-cue]'),list=e.querySelector('[data-project-list]')
   return {left:e.getBoundingClientRect().left,top:e.getBoundingClientRect().top,header:center(header),rowPlus:rows.map(center),cueLeft:cue?.getBoundingClientRect().left??null,listOverflow:list.scrollHeight>list.clientHeight}
  })
  await page.mouse.move(0,0)
  await page.screenshot({path:`evidence/stability-after-${width}x${height}.png`})
  console.log(JSON.stringify({width,height,count,before,after,initial,overflow,recent,columns,delta:recent.center-columns.rowPlus[0]}))
  if(height===900){
   assert.ok(Math.abs(columns.left-before.main[0])<=1,'the stacked panels share their inline alignment within the trigger border')
   assert.ok(columns.top>=after.main[1]+after.main[3]&&columns.listOverflow&&columns.cueLeft!==null)
   assert.ok(columns.rowPlus.every(x=>Math.abs(recent.center-x)<=0.5),'chevrons align with the per-row plus in the stacked overflow layout')
   assert.ok(Math.abs(recent.center-columns.header)>4,'header plus is not the reference column')
   standardInset=recent.inset
  }
  assert.equal(recent.inset,standardInset,'short, narrow, and non-overflowing Project layouts keep a fixed right inset')
  assert.ok(recent.cueLeft-recent.chevronRight>=8,'visible chevrons clear the scrollbar track')
  assert.ok(recent.thumbLeft===recent.cueLeft&&recent.thumbHittable,'thumb remains in its track and can be grabbed')
  assert.ok(recent.fullWidthRows&&recent.height===52&&recent.titleLeft===8&&recent.rowHittable,'session rows retain their height, full width and hit target')
  assert.ok(recent.labelGap===0&&recent.ellipsized&&!recent.horizontalOverflow,'long session and project labels stay compact and truncate without horizontal overflow')
  if(height>=700)assert.deepEqual(after,before,`main bubble must not shrink with ample space at height ${height}`)
  else {
   assert.ok(after.main[3]<before.main[3],`main bubble must make room for Projects at height ${height}`)
   assert.equal(after.header[3],before.header[3],'header stays full height')
   assert.equal(after.footer[3],before.footer[3],'actions stay full height')
   const bounds=await project.boundingBox()
   assert.ok(bounds.y>=0&&bounds.y+bounds.height<=height,'project chooser stays within the viewport')
  }
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('[data-slot="popover-content"]').count(),1)
  await page.waitForFunction(h=>Math.abs(document.querySelector('[data-slot="popover-content"]').getBoundingClientRect().height-h)<1,before.main[3])
  assert.deepEqual(await measure(),before,`main bubble geometry must be restored after closing at height ${height}`)
  if(height===900){
   const thumb=await cue.locator('[data-recent-scroll-thumb]').boundingBox()
   const x=thumb.x+thumb.width/2,y=thumb.y+thumb.height/2
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y+50,{steps:5});await page.mouse.up()
   assert.ok(await list.evaluate(e=>e.scrollTop>0),'dragging the thumb still scrolls the recent list')
   await page.mouse.move(x,y+50);await page.mouse.wheel(0,-1200)
   await page.waitForFunction(()=>document.querySelector('[data-recent-list]').scrollTop===0)
   await page.mouse.click(recent.chevronRight+1,before.row[1]+before.row[3]/2)
   await page.waitForFunction(()=>window.openCalls?.[0]?.[0]==='id0')
  }
  await page.close()
 }
 console.log('PASS chevron alignment and scrollbar clearance; projects toggle and restore the primary geometry')
} finally {await browser.close()}

function recentGeometry(main){
 return main.evaluate(e=>{
  const list=e.querySelector('[data-recent-list]'),rows=[...list.querySelectorAll('[data-recent-row]')],row=rows[0]
  const title=row.querySelector('strong'),label=title.nextElementSibling,chevron=row.lastElementChild
  const r=row.getBoundingClientRect(),g=chevron.getBoundingClientRect(),t=title.getBoundingClientRect(),l=list.getBoundingClientRect()
  const cue=e.querySelector('[data-recent-scroll-cue]'),thumb=e.querySelector('[data-recent-scroll-thumb]')
  const track=cue?.getBoundingClientRect(),handle=thumb?.getBoundingClientRect()
  const glyph=document.createRange();glyph.selectNodeContents(chevron)
  return {center:(g.left+g.right)/2,inset:r.right-(g.left+g.right)/2,chevronRight:g.right,glyphRight:glyph.getBoundingClientRect().right,cueLeft:track?.left??null,thumbLeft:handle?.left??null,
   thumbHittable:!!handle&&document.elementFromPoint((handle.left+handle.right)/2,(handle.top+handle.bottom)/2)===thumb,
   height:r.height,titleLeft:t.left-r.left,fullWidthRows:rows.every(x=>{const b=x.getBoundingClientRect();return b.right===l.right&&b.left===r.left&&b.height===r.height}),
   rowHittable:row.contains(document.elementFromPoint(g.right+1,(r.top+r.bottom)/2)),
   labelGap:label.getBoundingClientRect().top-t.bottom,
   ellipsized:[title,label].every(x=>getComputedStyle(x).textOverflow==='ellipsis'&&x.scrollWidth>x.clientWidth),horizontalOverflow:list.scrollWidth>list.clientWidth}
 })
}
