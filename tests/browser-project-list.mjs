import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())+'/package.json');
const {chromium}=require('playwright');
const codiconCss=pathToFileURL(require.resolve('@vscode/codicons/dist/codicon.css')).href;
const browser=await chromium.launch({headless:true,executablePath:(process.env.CHROME_PATH||(()=>{throw Error('Set CHROME_PATH')})())});
try {
 for(const {width,height,count} of [{width:900,height:700,count:2},{width:900,height:700,count:8},{width:900,height:300,count:8},{width:280,height:430,count:8}]) {
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
  await page.addInitScript(n=>{window.fixtureProjects=Array.from({length:n},(_,i)=>({id:'p'+i,label:'Project '+i+' '+('long name '.repeat(12)),path:'/fixture/project'+i,sessionIds:['id0'],repos:[],icon:i===0?'rocket':null,isAuto:i===1,previewSessions:i===0?[{cwd:'/fixture/project0',git_branch:'feature/fixture-very-long-branch-name-0123456789'}]:[]}))},count);
  await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?office');await page.addStyleTag({url:codiconCss});
  await page.getByRole('button',{name:'Aster · 狀態 工作中'}).click();await page.waitForSelector('[data-recent-row]');await page.getByRole('button',{name:'▦ 開啟專案'}).click();
  const dialogs=page.locator('[data-slot="popover-content"]'), main=dialogs.first(), sub=dialogs.last(),rows=sub.locator('[data-project-row]'),list=sub.locator('[data-project-list]');
  await rows.first().waitFor();assert.equal(await rows.count(),count);assert.equal(await sub.getByRole('button',{name:'新增專案'}).isDisabled(),false);
  assert.equal(await rows.first().locator('[data-project-icon]').getAttribute('data-project-icon'),'rocket');assert.equal(await rows.nth(1).locator('[data-project-icon]').getAttribute('data-project-icon'),'repo');assert.equal(await rows.first().locator('.codicon-rocket').count(),1);assert.equal(await rows.nth(1).locator('.codicon-repo').count(),1);
  assert.doesNotMatch(await sub.innerText(),/feature\/fixture|分支資訊/);assert.equal(await sub.locator('[data-project-branch]').count(),0);
  for(const control of [page.getByRole('button',{name:'快速新增'}),sub.getByRole('button',{name:'新增專案'}),rows.first().locator('button')]){const icon=control.locator('.codicon-add');assert.equal(await icon.count(),1);assert.equal(await icon.evaluate(e=>getComputedStyle(e).fontSize),'12px');assert.notEqual(await icon.evaluate(e=>getComputedStyle(e,'::before').content),'none')}
  const geometry=await sub.evaluate(e=>{const l=e.querySelector('[data-project-list]'),m=document.querySelector('[data-slot="popover-content"]');return {width:e.getBoundingClientRect().width,main:m.getBoundingClientRect().width,list:l.clientHeight,scroll:l.scrollHeight,rows:[...l.children].map(x=>x.getBoundingClientRect().height),clip:[...l.querySelectorAll('[data-project-name]')].map(x=>getComputedStyle(x).textOverflow)}});
  assert.ok(Math.abs(geometry.width-geometry.main)<1);assert.ok(geometry.rows.every(h=>h===32));assert.ok(geometry.clip.every(x=>x==='ellipsis'));
  if(height===700){assert.equal(geometry.list,Math.min(count,3)*32);if(count>3)assert.ok(geometry.scroll>geometry.list)}
  await rows.first().locator('[data-project-name]').click();assert.equal(await page.evaluate(()=>window.createCalls?.length||0),0);
  await page.screenshot({path:`evidence/project-list-initial-${width}x${height}-${count}.png`});
  if(count>3){await list.hover();await page.mouse.wheel(0,1200);await page.waitForFunction(()=>{const e=document.querySelector('[data-project-list]');return e.scrollTop>0});assert.ok(await rows.last().locator('button').evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2))}),'wheel reaches a hittable final row')}
  await page.screenshot({path:`evidence/project-list-${width}x${height}-${count}.png`});
  await page.keyboard.press('Escape');assert.equal(await dialogs.count(),1);await page.getByRole('button',{name:'▦ 開啟專案'}).click();await page.locator('[data-project-row]').first().getByRole('button').click();await page.waitForFunction(()=>window.openCalls?.length===1);const calls=await page.evaluate(()=>({create:window.createCalls[0],open:window.openCalls[0]}));assert.equal(calls.create.route.profile,'Aster');assert.equal(calls.create.params.cwd,'/fixture/project0');assert.equal(calls.create.params.cwd_explicit,true);assert.equal(calls.open[1].route.profile,'Aster');
  console.log(JSON.stringify({width,height,count,geometry}));await page.close();
 }
 console.log('PASS controlled project list');
} finally {await browser.close()}
