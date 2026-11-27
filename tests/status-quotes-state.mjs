import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {createContext,SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
const require=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())+'/package.json'),{JSDOM}=require('jsdom'),dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'})
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
const React=require('react'),{createRoot}=require('react-dom/client'),jsx=require('react/jsx-runtime')
const sdk={host:{},useValue:()=>null,useQuery:()=>({}),Popover:()=>null,PopoverContent:()=>null,PopoverTrigger:()=>null,Dialog:({children})=>children,DialogContent:({onOpenAutoFocus,onCloseAutoFocus,onEscapeKeyDown,...props})=>jsx.jsx('section',{role:'dialog',...props}),DialogHeader:'header',DialogTitle:'h2',DialogFooter:'footer',Input:({size,...props})=>jsx.jsx('input',props),Button:({variant,...props})=>jsx.jsx('button',props)}
let draws=[],drawCount=0
const context=createContext({document,Math:Object.assign(Object.create(Math),{random:()=>{drawCount++;return draws.shift()??0}})})
const mod=new SourceTextModule(await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8')+'\nexport {StatusQuote};',{context});await mod.link(async s=>{const o=s==='@hermes/plugin-sdk'?sdk:s==='react/jsx-runtime'?jsx:React;return new SyntheticModule(Object.keys(o),function(){for(const [k,v] of Object.entries(o))this.setExport(k,v)},{context})});await mod.evaluate()
const values=new Map(),writes=[],get=async k=>structuredClone(values.get(k)),set=async(k,v)=>{writes.push([k,v]);values.set(k,structuredClone(v))},storage={get,set},root=createRoot(document.getElementById('root')),statusDialog={current:null}
const lastQuotes=new Map()
let statusRefresh=40
async function render(status,ownerKey='a',source=storage){await React.act(async()=>root.render(React.createElement(React.StrictMode,null,status&&React.createElement(mod.namespace.StatusQuote,{storage:source,ownerKey,status,statusDialog,statusRefresh,lastQuotes}))))}
async function sample(status,count=1){for(let i=0;i<count;i++){statusRefresh++;await render(status)}}
const find=selector=>document.querySelector(selector),quote=()=>find('[data-status-quote]'),accessible=()=>quote().querySelector('span:not([aria-hidden])').textContent,shown=()=>accessible().replace(/^Status: /,''),preview=()=>quote().firstChild.textContent
const input=row=>find(`[data-status-input="${row}"]`),setter=Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set
const open=()=>React.act(async()=>find('[data-status-edit]').click()),save=()=>React.act(async()=>find('[data-status-save]').click()),cancel=()=>React.act(async()=>find('footer button').click())
const fill=(row,text)=>React.act(async()=>{setter.call(input(row),text);input(row).dispatchEvent(new dom.window.Event('input',{bubbles:true}))})
const pointer=(type,relatedTarget)=>React.act(async()=>quote().dispatchEvent(new dom.window.MouseEvent(type,{bubbles:true,relatedTarget})))
const key=(owner,row)=>`${owner}:quote-v1:${row}`

values.set(key('a','working'),['First phrase','Second phrase','Third phrase','Third phrase'])
values.set(key('a','waiting'),['Waiting first','Waiting second'])
values.set(key('a','idle'),'One，fullwidth comma, literal ASCII too')
draws=[.8,.8,.9,.1,.9,.8]
await render('working');assert.equal(accessible(),'Status: Third phrase');assert.equal(drawCount,1,'Strict Mode does not replay the initial draw')
await sample('working',4);assert.equal(shown(),'Third phrase')
await render('working');assert.equal(shown(),'Third phrase','same refresh does not advance');assert.equal(drawCount,1)
await sample('working');assert.equal(shown(),'Second phrase')
await sample('working',3);await pointer('pointerover',null)
await sample('working',10);assert.equal(shown(),'Second phrase');assert.equal(preview(),'Second phrase')
await pointer('pointerout',document.body);assert.equal(shown(),'Second phrase','leaving hover does not catch up')
await sample('working');assert.equal(shown(),'Second phrase');await sample('working');assert.equal(shown(),'Third phrase','the phrase before last may recur')
statusRefresh+=11;await render('working');assert.equal(shown(),'First phrase','a batch makes one draw against the last visible phrase');assert.equal(drawCount,4)
await sample('working',3);await open();await sample('working',10);assert.equal(shown(),'First phrase')
await cancel();assert.equal(shown(),'First phrase','closing the editor does not catch up')
await sample('working');assert.equal(shown(),'Third phrase','batch remainder and pre-hold progress carry over')
await open()
await fill('working','Unsaved working draft');await sample('waiting');assert.equal(shown(),'Waiting second');assert.equal(input('working').value,'Unsaved working draft')
await cancel();await sample('waiting',4);assert.equal(shown(),'Waiting second');await sample('waiting');assert.equal(shown(),'Waiting first')
assert.equal(drawCount,6,'a single eligible phrase needs no draw')
await render('working');assert.equal(shown(),'First phrase');await render('waiting');assert.equal(shown(),'Waiting second');await sample('waiting',4)
assert.deepEqual(writes,[],'custom rotation does not touch preferences')
await open();await fill('waiting','Updated first, Waiting second');await save();assert.equal(shown(),'Waiting second','a changed list keeps its current phrase if still present')
await sample('waiting',4);assert.equal(shown(),'Waiting second','replacing the list resets its phase');await sample('waiting');assert.equal(shown(),'Updated first')
await open();await fill('waiting','Replacement first, Replacement second');draws=[.9];await save();assert.equal(shown(),'Replacement second','removing the visible phrase draws from the replacement list')
writes.length=0
await render('idle');const literal=shown();assert.match(literal,/fullwidth comma, literal/)
await sample('idle',10);assert.equal(shown(),literal);await render(null);await render('idle');assert.equal(shown(),literal,'a lone phrase repeats even on reopen')
await open();assert.equal(input('idle').value,literal);await save();assert.deepEqual(writes,[],'no write or conversion of untouched stored strings/arrays')
draws=[.6,.2,.6,.3]
await render('working','b');const bInitial="It's not done yet. I'll keep going.";assert.equal(shown(),bInitial)
await render('working','c');assert.equal(shown(),"I'm still working on this.",'another profile draws independently from the same defaults')
await render('working','another-connection:b');assert.equal(shown(),bInitial,'another connection can draw the same default for the same profile')
await render(null);await render('working','b');const bReopened="I'm still working on this.";assert.equal(shown(),bReopened,'reopening excludes only this profile’s last phrase')
statusRefresh+=4;await render('working','b');assert.equal(shown(),bReopened)
await pointer('pointerover',null);statusRefresh+=5;await render('working','b');assert.equal(shown(),bReopened)
await pointer('pointerout',document.body);await open();statusRefresh+=5;await render('working','b');assert.equal(shown(),bReopened)
await save();assert.deepEqual(writes,[],'opening and saving unmodified inherited defaults does not write')
statusRefresh++;await render('working','b');assert.equal(shown(),"I'm busy right now.",'defaults resume from their pre-hold progress')
draws=[.99,0];await render('working');assert.equal(shown(),'Third phrase','reopening custom phrases excludes the last text, including duplicate entries')
await open();assert.equal(input('working').value,'First phrase, Second phrase, Third phrase','drawing does not reorder the editor');await save()
await render(null);await render('working');assert.equal(shown(),'First phrase');assert.deepEqual(writes,[])

values.set('legacy','舊短句, 原樣保留');await render('idle','legacy');assert.equal(shown(),'舊短句, 原樣保留')
await open();await fill('idle','  新短句，保留  ,  第二句, , 新短句，保留');await save()
assert.deepEqual(values.get(key('legacy','idle')),['新短句，保留','第二句']);assert.equal(shown(),'新短句，保留')
assert.equal(values.get('legacy'),'舊短句, 原樣保留');await render('waiting','legacy');assert.equal(shown(),'舊短句, 原樣保留')
await render('idle','legacy');await open();await fill('idle',' ,  ');await save();assert.equal(values.get(key('legacy','idle')),'');assert.equal(shown(),"I'm free right now.")
await render('working','b');await render('idle','legacy');assert.equal(shown(),"You can reach me if you need anything.",'explicit clear overrides the legacy fallback and reopening excludes the last default')
const afterClear=writes.length
await open();assert.equal(input('idle').value,"I'm free right now., You can reach me if you need anything., I'm not busy right now., Feel free to send me a new task., I can take the next task.");await save()
await open();await fill('idle','');await save();assert.equal(writes.length,afterClear,'displaying or clearing already-inherited defaults does not write')
statusRefresh+=5;await render('idle','legacy');assert.equal(shown(),"I'm free right now.",'clearing restores rotation of the whole default list')

values.set('legacy-bad',['不應採用']);values.set(key('legacy-bad','working'),'有效短句')
await render('working','legacy-bad');assert.equal(shown(),'有效短句');await open()
assert.ok(input('waiting').readOnly);assert.match(find('[role=alert]').textContent,/Could not read some quotes/)
assert.equal(input('working').readOnly,false);await fill('working','仍可更新');await save();assert.equal(shown(),'仍可更新')
storage.get=async k=>{if(k==='legacy-offline')throw Error('legacy read failed');return get(k)}
values.set(key('legacy-offline','idle'),'Valid per-key string');await render('idle','legacy-offline');assert.equal(shown(),'Valid per-key string');storage.get=get

let resolveGet;const slow={...storage,get:k=>k==='slow'?new Promise(r=>resolveGet=r):get(k)}
await render('working','slow',slow);await render('waiting','other');await React.act(async()=>resolveGet('舊的遲到結果'));assert.notEqual(shown(),'舊的遲到結果')
await render('working','slow',slow);await render('working','slow',{get:async()=> 'New source',set});await React.act(async()=>resolveGet('Old source'));assert.equal(shown(),'New source')

const failOwner='partial',failIdle=key(failOwner,'idle'),failWaiting=key(failOwner,'waiting'),successWorking=key(failOwner,'working')
await render('idle',failOwner);await open();await fill('working','Saved first, Saved second');await fill('idle','Retained on reject');await fill('waiting','Retained on mismatch, Second')
storage.set=async(k,v)=>{if(k===failIdle)throw Error('failed');return set(k,v)}
storage.get=k=>k===failWaiting?Promise.resolve(['unexpected']):get(k)
await save();assert.equal(input('idle').value,'Retained on reject');assert.equal(input('waiting').value,'Retained on mismatch, Second');assert.equal(input('working').value,'Saved first, Saved second')
assert.match(find('[role=alert]').textContent,/Could not confirm all saves/);assert.match(find('[role=alert]').textContent,/Other changes were saved/)
assert.deepEqual(values.get(successWorking),['Saved first','Saved second']);assert.equal(values.has(failIdle),false)
storage.get=get;storage.set=set;await save();assert.equal(shown(),'Retained on reject');assert.deepEqual(values.get(failWaiting),['Retained on mismatch','Second']);assert.equal(writes.filter(([k])=>k===successWorking).length,1,'retry does not resend confirmed keys')

// A remount waits for the pending key but leaves other rows editable.
let finishWrite
const raceKey=key('race','working')
storage.set=(k,v)=>k===raceKey?new Promise(resolve=>{finishWrite=()=>resolve(set(k,v))}):set(k,v)
await render('working','race');await open();await fill('working','Old write');await save()
await render('idle','other');assert.equal(find('[role=dialog]'),null)
await render('idle','race');await open();assert.equal(input('working').readOnly,true);assert.equal(input('idle').readOnly,false)
await React.act(async()=>finishWrite());assert.equal(input('working').value,'Old write');assert.equal(input('working').readOnly,false)
storage.set=set;await fill('working','New write');await save();await render('working','race');assert.equal(shown(),'New write');assert.equal(values.get(raceKey),'New write')
await React.act(async()=>root.unmount())
console.log('PASS random non-repeat across rotations and reopen, independent profiles, batched refreshes, Strict Mode, pause, list changes, legacy, partial failure and ordered writes')
