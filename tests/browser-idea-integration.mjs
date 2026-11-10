import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {createInterface} from 'node:readline'
import {readFile} from 'node:fs/promises'
const root=process.env.HERMES_CHECKOUT
const {chromium}=createRequire(root+'/package.json')('playwright')
const fixture=spawn(root+'/.venv/bin/python',['-I','-B',path.resolve('tests/folder_browser_fixture.py')],{env:process.env,stdio:['pipe','pipe','inherit']})
const pending=[]
createInterface({input:fixture.stdout}).on('line',line=>pending.shift()?.resolve(JSON.parse(line)))
fixture.on('exit',()=>{for(const p of pending.splice(0))p.reject(Error('fixture exited'))})
const ask=body=>new Promise((resolve,reject)=>{pending.push({resolve,reject});fixture.stdin.write(JSON.stringify(body)+'\n')})
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH})
try{
 const page=await browser.newPage({viewport:{width:900,height:700}})
 let savedRequest
 await page.exposeFunction('fixtureBridge',async req=>{assert.equal(req.connectionId,'fixture');assert.equal(req.profile,'Aster');if(req.path.endsWith('/idea'))savedRequest=req;const result=await ask({...req.body,_endpoint:req.path.replace('/api/plugins/profile-rail','')});if(result.status!==200)throw Error(result.data.detail);return result.data})
 await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?office')
 await page.addStyleTag({path:path.resolve('tests/sdk-css/styles.css')})
 await page.getByRole('button',{name:'Aster · 狀態 工作中'}).click();await page.waitForSelector('[data-recent-row]')
 await page.getByRole('button',{name:'▦ 開啟專案'}).click();await page.getByRole('button',{name:'新增專案'}).click()
 await page.getByRole('button',{name:'瀏覽資料夾'}).click();await page.getByRole('button',{name:'first',exact:true}).waitFor()
 await page.getByRole('button',{name:'..',exact:true}).click();await page.getByRole('button',{name:'outside',exact:true}).click();await page.getByRole('button',{name:'選取目前資料夾'}).click()
 const text='  測試 fixture idea\n第二行  '
 await page.getByRole('textbox',{name:'專案點子'}).fill(text)
 await page.getByRole('button',{name:'建立',exact:true}).click()
 await page.getByText('IDEA.md 已儲存並讀回確認。').waitFor()
 assert.ok(savedRequest);assert.equal(savedRequest.body.content,text)
 const calls=await page.evaluate(()=>window.projectCreateCalls);assert.equal(calls.length,1);assert.equal(calls[0].route.targetProfile,'Aster');assert.equal(calls[0].params.primary_path,savedRequest.body.path);assert.equal(savedRequest.body.owner,'Aster');assert.equal(savedRequest.body.project_id,'fixture-project')
 const file=path.join(savedRequest.body.path,'IDEA.md');assert.equal(await readFile(file,'utf8'),text)
 console.log('PASS controlled Chromium → plugin FastAPI → disk readback:',file)
}finally{await browser.close();fixture.stdin.end();await new Promise(resolve=>fixture.on('exit',resolve))}
