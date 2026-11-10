import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {createInterface} from 'node:readline'
import {mkdir} from 'node:fs/promises'
const root=(process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())
const chrome=process.env.CHROME_PATH||(()=>{throw Error('Set CHROME_PATH')})()
const {chromium}=createRequire(root+'/package.json')('playwright')
const fixture=spawn(root+'/.venv/bin/python',['-I','-B',path.resolve('tests/folder_browser_fixture.py')],{env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},stdio:['pipe','pipe','inherit']})
const pending=[]
createInterface({input:fixture.stdout}).on('line',line=>{const p=pending.shift();if(p)p.resolve(JSON.parse(line))})
fixture.on('exit',()=>{for(const p of pending.splice(0))p.reject(Error('folder fixture exited'))})
const ask=body=>new Promise((resolve,reject)=>{pending.push({resolve,reject});fixture.stdin.write(JSON.stringify(body)+'\n')})
const browser=await chromium.launch({headless:true,executablePath:chrome})
await mkdir('evidence',{recursive:true})
try{
 for(const height of [700,400]){
  const page=await browser.newPage({viewport:{width:900,height},reducedMotion:'reduce'})
  let holdNext=false,release=null
  await page.exposeFunction('fixtureBridge',async req=>{assert.equal(req.connectionId,'fixture');assert.equal(req.profile,'Aster');assert.equal(req.method,'POST');assert.ok(['/api/plugins/sessioncrew/folders','/api/plugins/sessioncrew/folders/mkdir'].includes(req.path));const res=await ask({...req.body,_endpoint:req.path.replace('/api/plugins/sessioncrew','')});if(holdNext){holdNext=false;await new Promise(resolve=>release=resolve)}if(res.status!==200)throw Error(res.data.detail);return res.data})
  await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?office')
  await page.addStyleTag({path:path.resolve('tests/sdk-css/styles.css')})
  await page.getByRole('button',{name:'Aster · 狀態 工作中'}).click();await page.waitForSelector('[data-recent-row]')
  await page.getByRole('button',{name:'▦ 開啟專案'}).click();await page.getByRole('button',{name:'新增專案'}).click()
  await page.getByRole('button',{name:'瀏覽資料夾'}).click()
  // Native remote-picker FolderRow: the row itself opens on one click;
  // parent is an in-list '..' row and the footer selects the current folder.
  await page.getByRole('button',{name:'first',exact:true}).waitFor({timeout:3000})
  assert.equal(await page.getByRole('button',{name:'..',exact:true}).isDisabled(),false)
  assert.equal(await page.getByRole('button',{name:'新增資料夾',exact:true}).isDisabled(),false)
  await page.getByRole('button',{name:'..',exact:true}).click();await page.getByRole('button',{name:'outside',exact:true}).click();
  await page.getByRole('button',{name:'新增資料夾',exact:true}).click();await page.getByRole('textbox',{name:'資料夾名稱'}).fill('new'+height);await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'new'+height,exact:true}).waitFor();await page.getByRole('button',{name:'新增資料夾',exact:true}).click();await page.getByRole('textbox',{name:'資料夾名稱'}).fill('new'+height);await page.keyboard.press('Enter');assert.match(await page.getByRole('alert').innerText(),/結果未知/);await page.keyboard.press('Escape');await page.getByRole('button',{name:'new'+height,exact:true}).click();await page.getByRole('button',{name:'選取目前資料夾'}).click();
  assert.equal(await page.getByRole('button',{name:new RegExp('移除 .*outside/new'+height)}).count(),1);await page.getByRole('button',{name:new RegExp('移除 .*outside/new'+height)}).click();await page.getByRole('textbox',{name:'專案名稱'}).fill('');
  await page.getByRole('button',{name:'瀏覽資料夾'}).click();await page.getByRole('button',{name:'first',exact:true}).waitFor();
  assert.equal(await page.getByText('secret.txt').count(),0)
  await page.screenshot({path:path.resolve(`evidence/folder-${height}-root.png`)})
  await page.getByRole('button',{name:'denied'}).click();await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').innerText(),/synthetic access denied/)
  await page.screenshot({path:path.resolve(`evidence/folder-${height}-denied.png`)})
  await page.getByRole('button',{name:'first'}).click();await page.getByRole('button',{name:'child'}).waitFor();await page.getByRole('button',{name:'..',exact:true}).click();await page.getByRole('button',{name:'first'}).waitFor()
  await page.getByRole('button',{name:'載入更多'}).click();await page.getByRole('button',{name:'item59'}).waitFor()
  await page.getByRole('button',{name:'item59'}).scrollIntoViewIfNeeded();await page.screenshot({path:path.resolve(`evidence/folder-${height}-pagination.png`)})
  await page.getByRole('button',{name:'first'}).click();await page.getByRole('button',{name:'child'}).waitFor()
  await page.getByRole('button',{name:'child'}).click();await page.getByRole('navigation',{name:'資料夾階層'}).getByRole('button',{name:'child'}).waitFor()
  await page.screenshot({path:path.resolve(`evidence/folder-${height}-child.png`)})
  await page.getByRole('button',{name:'..',exact:true}).click();await page.getByRole('button',{name:'child'}).waitFor()
  await page.getByRole('button',{name:'選取目前資料夾'}).click();assert.match(await page.locator('[data-slot="dialog-content"]').innerText(),/first/)
  assert.equal(await page.getByRole('textbox',{name:'專案名稱'}).inputValue(),'first')
  assert.equal(await page.getByText('主要',{exact:true}).count(),1)
  await page.screenshot({path:path.resolve(`evidence/folder-${height}-selected.png`)})
  await page.getByRole('button',{name:'瀏覽資料夾'}).click();await page.getByRole('button',{name:'first'}).waitFor();await page.getByRole('dialog',{name:'選擇資料夾'}).getByRole('button',{name:'取消',exact:true}).click()
  assert.equal(await page.getByRole('button',{name:/移除 .*first/}).count(),1)
  if(height===700){holdNext=true;await page.getByRole('button',{name:'瀏覽資料夾'}).click();for(let i=0;i<100&&!release;i++)await new Promise(r=>setTimeout(r,10));assert.ok(release,'folder request was held');await page.evaluate(()=>window.fixtureSetConnection('different-fixture'));release();await page.waitForFunction(()=>!document.querySelector('[data-slot="dialog-content"]')||![...document.querySelectorAll('button')].some(b=>b.textContent==='建立'&&!b.disabled));assert.equal(await page.getByRole('button',{name:'選取目前資料夾'}).count(),0);await page.screenshot({path:path.resolve(`evidence/folder-${height}-connection-switch.png`)})}
  else {await page.getByRole('button',{name:'取消'}).click();await page.locator('[data-slot="dialog-content"]').waitFor({state:'detached'});await page.screenshot({path:path.resolve(`evidence/folder-${height}-cancel.png`)});await page.getByRole('button',{name:'新增專案'}).click();await page.getByRole('button',{name:'瀏覽資料夾'}).click();await page.getByRole('button',{name:'first'}).waitFor();await page.evaluate(()=>window.fixtureSetProfile('Mika'));await page.waitForFunction(()=>!document.querySelector('[data-slot="dialog-content"]')||![...document.querySelectorAll('button')].some(b=>b.textContent==='選取目前資料夾'&&!b.disabled))}
  console.log('PASS synthetic folder backend + actual SDK, viewport',height)
  await page.close()
 }
}finally{await browser.close();fixture.stdin.end();await new Promise(resolve=>fixture.on('exit',resolve))}
