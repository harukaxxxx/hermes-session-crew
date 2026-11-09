import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
const {chromium}=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())+'/package.json')('playwright')
const browser=await chromium.launch({headless:true,executablePath:(process.env.CHROME_PATH||(()=>{throw Error('Set CHROME_PATH')})())})
try {for(const height of [700,400]){const page=await browser.newPage({viewport:{width:900,height},reducedMotion:'reduce'});await page.route('**/sdk-bundle.js',async route=>route.fulfill({status:200,contentType:'text/javascript',body:await readFile('tests/original-folder-bundle.js')}));await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href);await page.addStyleTag({path:path.resolve('tests/sdk-css/styles.css')});await page.waitForFunction(()=>window.originalPicker);await page.evaluate(()=>{void window.originalPicker.selectPaths({defaultPath:'/fixture/hermes',title:'選擇資料夾'})});await page.getByRole('button',{name:'first',exact:true}).waitFor();await page.screenshot({path:`evidence/original-folder-${height}.png`});console.log('PASS tracked original picker',height);await page.close()}}finally{await browser.close()}
