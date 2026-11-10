// Controlled React/SDK fixture: no installation, gateway or live Desktop.
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
const checkout=process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT
if(!checkout)throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')
const require=createRequire(checkout+'/package.json')
const React=require('react'),{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom'),jsx=require('react/jsx-runtime')
const {useQuery,QueryClient,QueryClientProvider}=require('@tanstack/react-query')
const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'})
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
let locale='en',bundles;const listeners=new Set()
const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)}
const change=async next=>React.act(async()=>{locale=next;for(const fn of listeners)fn();await new Promise(r=>setTimeout(r,20))})
// Simulate the real SDK ordering: context updates before the non-reactive runtime locale.
const translate=(current,key,...args)=>{const get=locale=>key.split('.').reduce((node,part)=>node?.[part],bundles?.[locale]);const value=get(current)??get('en');return typeof value==='function'?value(...args):typeof value==='string'?value:key}
const i18n={register:b=>{bundles=b},t:(key,...args)=>translate('en',key,...args)}
const atom=value=>({get:()=>value,subscribe:()=>()=>{}})
const host={state:{connectionId:atom('c'),profile:atom('alpha')},profiles:{list:async()=>({profiles:[{name:'alpha'}]})},openSession:async()=>{throw Error('Custom server failure')},requestProfile:async(route,method)=>method==='session.list'?{sessions:[{id:'one',title:''},{id:'two',title:'Custom title'}]}:{projects:[{isNoProject:true,sessionIds:['one']},{label:'Custom project',sessionIds:['two']}]}}
const sdk={host,useValue:a=>a.get(),useQuery,usePluginI18n:id=>{assert.equal(id,'sessioncrew');const current=React.useSyncExternalStore(subscribe,()=>locale);return (key,...args)=>translate(current,key,...args)},Popover:()=>null,PopoverContent:()=>null,PopoverTrigger:()=>null}
const element=tag=>({children,...props})=>React.createElement(tag,props,children)
Object.assign(sdk,{Dialog:({children})=>children,DialogContent:element('section'),DialogHeader:element('header'),DialogTitle:element('h2'),DialogDescription:element('p'),DialogFooter:element('footer'),Input:props=>React.createElement('input',props),Textarea:props=>React.createElement('textarea',props),Button:element('button'),Codicon:()=>null})
const source=await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8')
const mod=new SourceTextModule(source+'\nexport {Settings,Recent,StatusQuote,ProjectDialog,LocalizedRoot,createPreferences,messages,localizeError,errorMessage,LocalizedError,LocalizedTimeoutError};')
await mod.link(async spec=>{const obj=spec==='@hermes/plugin-sdk'?sdk:spec==='react/jsx-runtime'?jsx:React;return new SyntheticModule(Object.keys(obj),function(){for(const [k,v] of Object.entries(obj))this.setExport(k,v)})})
await mod.evaluate()
const {Settings,Recent,StatusQuote,ProjectDialog,LocalizedRoot,createPreferences,messages,localizeError,errorMessage,LocalizedError,LocalizedTimeoutError}=mod.namespace
let saved=new Map();const storage={get:async k=>saved.get(k),set:async(k,v)=>saved.set(k,v)}
let railContribution,settingsContribution
mod.namespace.default.register({i18n,storage,register:x=>{railContribution=x},registerSettingsPage:x=>{settingsContribution=x}})
assert.equal(railContribution.render().type,LocalizedRoot)
assert.equal(settingsContribution.render().type,LocalizedRoot)
assert.deepEqual(Object.keys(messages).sort(),['en','zh-hant'])
const leaves=(node,prefix='')=>Object.entries(node).flatMap(([key,value])=>typeof value==='object'&&value!==null?leaves(value,`${prefix}${key}.`):[`${prefix}${key}`])
const englishKeys=leaves(messages.en).sort()
assert.deepEqual(englishKeys,leaves(messages['zh-hant']).sort())
assert.ok(englishKeys.every(key=>key.includes('.')&&!/(^|\.)(m|x)\d+($|\.)/.test(key)),'translations must use grouped semantic keys')
assert.doesNotMatch(source,/['"](?:m|x)\d+['"]/,'source must not retain orphan numbered keys')
assert.equal(translate('en','project.newForOwner','A$&'),'New project (A$&)')
assert.equal(translate('zh-hant','project.newForOwner','A$&'),'新增專案（A$&）')
assert.match(translate('en','activity.observed',2),/^Observed 2 active turns/)
assert.match(translate('zh-hant','activity.observed',2),/^已觀察到 2 個/)
assert.equal(translate('en','session.loadFailure','SERVER'),'Could not load sessions: SERVER')
assert.equal(translate('zh-hant','session.loadFailure','SERVER'),'工作階段無法載入：SERVER')
assert.equal(translate('en','status.profileAria','A','working',true,'',''),'A · state working · unread completions')
assert.equal(translate('en','session.newInProject','My project'),'New conversation in My project')
assert.equal(translate('zh-hant','session.newInProject','My project'),'在 My project 新增對話')
const prefs=createPreferences(storage),client=new QueryClient({defaultOptions:{queries:{retry:false}}}),root=createRoot(document.getElementById('root'))
const completion={watermark:()=>[],coverageReady:false,ackAll:()=>{}}
function Fixture(){return React.createElement(React.Fragment,null,React.createElement(Settings,{preferences:prefs}),React.createElement(Recent,{owner:{name:'alpha',connectionId:'c',route:{}},completion}),React.createElement(StatusQuote,{storage,ownerKey:'quote',status:'working'}))}
const wrap=child=>React.createElement(QueryClientProvider,{client},React.createElement(LocalizedRoot,null,child))
await React.act(async()=>{root.render(wrap(React.createElement(Fixture)));await new Promise(r=>setTimeout(r,80))})
async function waitFor(text){for(let i=0;i<40&&!document.body.textContent.includes(text);i++)await React.act(async()=>new Promise(r=>setTimeout(r,10)));assert.ok(document.body.textContent.includes(text),`missing ${text}: ${document.body.textContent}`)}
await waitFor('Untitled');await waitFor('Home');await waitFor('Focusing on the task at hand.')
assert.match(document.body.textContent,/Hide offline profiles/);assert.match(document.body.textContent,/Custom project/)
const quoteButton=document.querySelector('[data-status-quote]');assert.equal(quoteButton.title,'Focusing on the task at hand.')
await React.act(async()=>{document.querySelector('[data-recent-row]').click();await new Promise(r=>setTimeout(r,10))})
await waitFor('Could not open: Custom server failure')
await change('zh-hant');await waitFor('未命名');await waitFor('主頁');await waitFor('正在專心整理眼前的事情。')
assert.match(document.body.textContent,/隱藏離線設定檔/);assert.equal(quoteButton.title,'正在專心整理眼前的事情。');assert.match(document.body.textContent,/Custom title/);assert.match(document.body.textContent,/Custom project/)
await waitFor('開啟失敗：Custom server failure');assert.equal(errorMessage(new LocalizedError('errors.otherProfilesUnsupported'),(key,...args)=>translate('zh-hant',key,...args)),'此版本不支援讀取其他設定檔')
assert.equal(errorMessage(new LocalizedTimeoutError('settings.profileList'),(key,...args)=>translate('zh-hant',key,...args)),'設定檔清單逾時')
assert.equal(errorMessage({localizationKey:'errors.otherProfilesUnsupported',message:'External error'}),'External error')
// External text is not translated merely because it matches plugin copy.
assert.equal(localizeError('Could not save settings; try again'),'Could not save settings; try again')
await change('fr');assert.equal(quoteButton.title,'Focusing on the task at hand.');assert.match(document.body.textContent,/Hide offline profiles/)
await React.act(async()=>root.unmount());client.clear()
// Settings subscribes independently, and an already-stored error follows locale.
const failing=createPreferences({get:async()=>{throw Error('storage')},set:async()=>{}}),settingsRoot=createRoot(document.getElementById('root'))
await React.act(async()=>{settingsRoot.render(wrap(React.createElement(Settings,{preferences:failing})));await new Promise(r=>setTimeout(r,40))})
await waitFor('Could not read settings');await change('zh-hant');await waitFor('設定無法讀取')
assert.match(document.body.textContent,/隱藏離線設定檔/)
await React.act(async()=>settingsRoot.unmount());client.clear()
// Persisted custom quote is user content, not a dictionary key or translated fallback.
await change('en');saved.set('quote:quote-v1:working','使用者自訂');const root2=createRoot(document.getElementById('root'))
await React.act(async()=>{root2.render(wrap(React.createElement(Fixture)));await new Promise(r=>setTimeout(r,60))})
await waitFor('使用者自訂');await change('zh-hant');assert.equal(document.querySelector('[data-status-quote]').title,'使用者自訂')
await React.act(async()=>root2.unmount());client.clear()
// The complete translated dialog title interpolates the owner in each locale.
await change('en');const dialogRoot=createRoot(document.getElementById('root'))
await React.act(async()=>dialogRoot.render(wrap(React.createElement(ProjectDialog,{owner:{connectionId:'c',route:{connectionId:'c',targetProfile:'alpha'}},ownerName:'Aster',isCurrent:()=>true,onClose:()=>{},onCreated:()=>{},onRefresh:()=>{},unknownProjects:{current:new Set()}}))))
assert.equal(document.querySelector('h2').textContent,'New project (Aster)')
await change('zh-hant');assert.equal(document.querySelector('h2').textContent,'新增專案（Aster）')
await React.act(async()=>dialogRoot.unmount());client.clear()
// Missing registration API must show English, not raw translation keys.
mod.namespace.default.register({storage,register:()=>{},registerSettingsPage:()=>{}})
const root3=createRoot(document.getElementById('root'))
await React.act(async()=>{root3.render(wrap(React.createElement(Settings,{preferences:prefs})));await new Promise(r=>setTimeout(r,20))})
assert.match(document.body.textContent,/Hide offline profiles/);assert.doesNotMatch(document.body.textContent,/settings.hideOffline/)
await React.act(async()=>root3.render(wrap(React.createElement(ProjectDialog,{owner:{connectionId:'c',route:{connectionId:'c',targetProfile:'alpha'}},ownerName:'A$&',isCurrent:()=>true,onClose:()=>{},onCreated:()=>{},onRefresh:()=>{},unknownProjects:{current:new Set()}}))))
assert.equal(document.querySelector('h2').textContent,'New project (A$&)')
await React.act(async()=>root3.unmount());client.clear()
console.log('PASS locale registration, reactive en/zh-Hant, fallback, cached labels and custom quote')