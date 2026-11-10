import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())+'/package.json')('playwright');
const browser=await chromium.launch({headless:true,executablePath:(process.env.CHROME_PATH||(()=>{throw Error('Set CHROME_PATH')})())});
const url=pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?office&gallery';
try {
 for(const {width,height,count,owner} of [{width:900,height:700,count:3,owner:'Aster'},{width:900,height:300,count:12,owner:'Profile 10'},{width:280,height:430,count:12,owner:'Aster'}]) {
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
  await page.addInitScript(n=>{window.fixtureProjects=Array.from({length:n},(_,i)=>({id:'p'+i,label:'Project '+i+' '+('very long name '.repeat(12)),path:'/fixture/project'+i,sessionIds:['id0'],repos:[]}))},count);
  await page.goto(url);const avatar=page.getByRole('button',{name:new RegExp('^'+owner+' · 狀態')});await avatar.scrollIntoViewIfNeeded();await avatar.click();await page.waitForSelector('[data-recent-row]');await page.getByRole('button',{name:'▦ 開啟專案'}).click();
  const dialogs=page.locator('[data-slot="popover-content"]'),main=dialogs.first(),sub=dialogs.last();await sub.getByRole('button',{name:/Project 0 /}).waitFor();
  console.log('initial bounds',width,height,await dialogs.evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height,r.bottom]})));
  await page.waitForFunction(()=>{const [a,b]=document.querySelectorAll('[data-slot="popover-content"]');if(!a||!b)return false;const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();return y.top>=0&&y.bottom<=innerHeight&&(y.bottom<=x.top||y.top>=x.bottom||y.left>=x.right||y.right<=x.left)},null,{timeout:3000});
  const measure=await sub.evaluate(e=>{const m=document.querySelector('[data-slot="popover-content"]'),r=e.getBoundingClientRect(),a=m.getBoundingClientRect(),list=e.querySelector('[data-project-list]');return {main:{x:a.x,y:a.y,width:a.width,height:a.height,bottom:a.bottom},sub:{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom},scrollHeight:list.scrollHeight,clientHeight:list.clientHeight,rows:[...list.querySelectorAll('[data-project-row]')].map(b=>{const x=b.getBoundingClientRect(),s=getComputedStyle(b.querySelector('[data-project-name]'));return {height:x.height,top:x.top,bottom:x.bottom,lineHeight:s.lineHeight,fontSize:s.fontSize,scrollHeight:b.scrollHeight,clientHeight:b.clientHeight,overflow:s.textOverflow}})}});
  console.log(JSON.stringify({width,height,count,owner,...measure}));
  await page.screenshot({path:`evidence/project-layout-${width}x${height}.png`});
  assert.ok(Math.abs(measure.main.width-measure.sub.width)<1,'secondary outer width matches main');
  assert.ok(measure.rows.every(r=>r.height>=28&&r.scrollHeight<=r.clientHeight),'each project row retains readable height without vertical clipping');
  assert.ok(measure.rows.every((r,i)=>!i||r.top>=measure.rows[i-1].bottom-0.1),'rows do not overlap');
  assert.ok(measure.rows[0].overflow==='ellipsis','long names ellipsize');
  assert.ok(measure.sub.y>=0&&measure.sub.bottom<=height+1,'secondary remains in viewport');
  assert.ok(measure.sub.bottom<=measure.main.y+1||measure.sub.y>=measure.main.bottom-1||measure.sub.x>=measure.main.x+measure.main.width-1||measure.sub.x+measure.sub.width<=measure.main.x+1,'popovers do not overlap');
  if(count>3){assert.ok(measure.scrollHeight>measure.clientHeight,'many items scroll');await sub.locator('[data-project-list]').evaluate(e=>{e.scrollTop=e.scrollHeight});const last=sub.getByRole('button',{name:new RegExp('Project '+(count-1)+' ')});await last.scrollIntoViewIfNeeded();assert.ok(await last.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2))}),'last project action hittable');}
  await page.keyboard.press('Escape');assert.equal(await dialogs.count(),1);await page.getByRole('button',{name:'▦ 開啟專案'}).click();await sub.getByRole('button',{name:/Project 0 /}).click();await page.waitForFunction(()=>window.openCalls?.length===1);const calls=await page.evaluate(()=>({create:window.createCalls[0],open:window.openCalls[0]}));assert.equal(calls.create.route.profile,owner);assert.equal(calls.create.params.cwd,'/fixture/project0');assert.equal(calls.create.params.cwd_explicit,true);assert.equal(calls.open[1].route.profile,owner);
  await page.close();
 }
 console.log('PASS project layout and owner routing');
} finally {await browser.close()}
