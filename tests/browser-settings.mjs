// Controlled Chromium: actual Settings component, React and client-local storage fixture.
import {createRequire} from 'node:module'
import {readFile,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import assert from 'node:assert/strict'
const checkout=process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT
const require=createRequire(checkout+'/package.json')
const {build}=require('esbuild'),{chromium}=require('playwright')
const source=await readFile('desktop/plugin.js','utf8')
const fixture=`import React from 'react'; import {createRoot} from 'react-dom/client'; import {QueryClient,QueryClientProvider} from '@tanstack/react-query'; import {Settings,createPreferences} from 'fixture-plugin'; const storage={value:{hideOffline:false,showCron:true,hiddenProfiles:['default']},async get(){return this.value},async set(k,v){this.value=structuredClone(v)}};const preferences=createPreferences(storage);window.fixture={preferences,storage};createRoot(document.getElementById('root')).render(React.createElement(QueryClientProvider,{client:new QueryClient({defaultOptions:{queries:{retry:false}}})},React.createElement(Settings,{preferences})));`
const sdk=`export const host={state:{connectionId:{get:()=> 'fixture'},profile:{get:()=> 'alpha'}},profiles:{list:async()=>({profiles:['default','alpha','beta','gamma','delta','epsilon','zeta','eta','theta','iota','profile-kappa','profile-lambda','profile-mu'].map(name=>({name}))})}};export const useValue=a=>a.get();export {useQuery} from '@tanstack/react-query';export const Popover=()=>null,PopoverTrigger=()=>null,PopoverContent=()=>null;`
const out=path.resolve('settings-fixture-bundle.js'),html=path.resolve('settings-fixture.html')
await build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'js'},bundle:true,format:'iife',outfile:out,nodePaths:[checkout+'/node_modules'],plugins:[{name:'fixture',setup(b){b.onResolve({filter:/^(fixture-plugin|@hermes\/plugin-sdk)$/},args=>({path:args.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='fixture-plugin'?source+'\nexport {Settings,createPreferences};':sdk,resolveDir:process.cwd(),loader:'js'}))}}],logLevel:'silent'})
await writeFile(html,`<!doctype html><html><head><meta charset="utf-8"><style>:root{--ui-bg-editor:#fff;--ui-bg-elevated:#f1f4fa;--ui-text-primary:#252b34;--ui-text-secondary:#858d98;--ui-stroke-secondary:#c5cee0;--ui-accent:#0755ed;--dt-midground-foreground:#fff}*{box-sizing:border-box}body{margin:0;background:var(--ui-bg-editor);color:var(--ui-text-primary);font:14px system-ui}button{font:inherit}</style></head><body><div id="root"></div><script src="settings-fixture-bundle.js"></script></body></html>`)
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH})
try{
 const page=await browser.newPage({viewport:{width:760,height:480},deviceScaleFactor:1})
 await page.goto(pathToFileURL(html).href)
 const cron=page.getByRole('switch',{name:'顯示 Cron 工作階段'}),offline=page.getByRole('switch',{name:'隱藏離線設定檔'}),alpha=page.getByRole('button',{name:'alpha',exact:true})
 await alpha.waitFor(); await page.waitForFunction(()=>window.fixture.preferences.get().ready)
 assert.equal(await cron.getAttribute('aria-checked'),'true');assert.equal(await offline.getAttribute('aria-checked'),'false');assert.equal(await page.getByRole('button',{name:'default',exact:true}).getAttribute('aria-pressed'),'false')
 await cron.focus();await page.keyboard.press('Space');await page.waitForFunction(()=>window.fixture.storage.value.showCron===false);assert.equal(await cron.getAttribute('aria-checked'),'false')
 await alpha.click();await page.waitForFunction(()=>window.fixture.storage.value.hiddenProfiles.includes('alpha'));assert.equal(await alpha.getAttribute('aria-pressed'),'false')
 await offline.click();await page.waitForFunction(()=>window.fixture.storage.value.hideOffline===true)
 const geometry=await page.evaluate(()=>{const section=document.querySelector('section'),chips=[...section.querySelectorAll('button')],sw=[...document.querySelectorAll('[role=switch]')],r=e=>e.getBoundingClientRect();return {wrap:chips.some(x=>r(x).top>r(chips[0]).top),switchRight:sw.map(x=>r(x).right),chipHeight:r(chips[0]).height,overflow:document.documentElement.scrollWidth>innerWidth}})
 assert.ok(geometry.wrap&&!geometry.overflow&&Math.abs(geometry.switchRight[0]-geometry.switchRight[1])<1&&geometry.chipHeight>=30,JSON.stringify(geometry))
 const screenshot=path.resolve('settings-controlled.png');await page.screenshot({path:screenshot});console.log('PASS Chromium settings keyboard/click persistence and wrapping',JSON.stringify(geometry),'screenshot:',screenshot)
 await page.setViewportSize({width:320,height:600});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.resolve('settings-controlled-narrow.png')});console.log('PASS narrow viewport screenshot:',path.resolve('settings-controlled-narrow.png'))
}finally{await browser.close()}
