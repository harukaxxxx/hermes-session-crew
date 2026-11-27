import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
const require=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())+'/package.json'), {JSDOM}=require('jsdom')
const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
const React=require('react'), {createRoot}=require('react-dom/client'),jsx=require('react/jsx-runtime')
const atom=x=>({get:()=>x}),saved=new Map(),storage={get:async k=>saved.get(k),set:async(k,v)=>saved.set(k,v)}
const host={state:{connectionId:atom('fixture-connection'),profile:atom('alpha')}}
const sdk={host,useValue:a=>a.get(),useQuery:o=>o.queryKey[1]==='roster'?{data:[{name:'alpha'}]}:o.queryKey[1]==='routes'?{data:[]}:o.queryKey[1]==='status'?{data:[{profile:'alpha',online:true,state:'online_unobserved',busy:null}],dataUpdatedAt:Date.now()}:{data:{rows:[]}},Popover:p=>React.createElement('section',null,p.children),PopoverTrigger:p=>p.children,PopoverContent:p=>React.createElement('div',null,p.children)}
Object.assign(sdk,{Dialog:({children})=>children,DialogContent:({onOpenAutoFocus,onCloseAutoFocus,onEscapeKeyDown,...props})=>jsx.jsx('section',{role:'dialog',...props}),DialogHeader:'header',DialogTitle:'h2',DialogFooter:'footer',Input:({size,...props})=>jsx.jsx('input',props),Button:({variant,...props})=>jsx.jsx('button',props)})
const mod=new SourceTextModule(await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8'));await mod.link(async s=>{const obj=s==='@hermes/plugin-sdk'?sdk:s==='react/jsx-runtime'?jsx:React;return new SyntheticModule(Object.keys(obj),function(){for(const [k,v] of Object.entries(obj))this.setExport(k,v)})});await mod.evaluate();let c;mod.namespace.default.register({register:x=>c=x,storage});const root=createRoot(document.getElementById('root'));await React.act(async()=>root.render(c.render()))
const quote=document.querySelector('[data-status-quote]')
assert.ok(quote,'a generic status sentence is present')
const onlineDefaults="I'm online., I'm connected., I'm here., I've got a connection., I'm online now."
assert.ok(onlineDefaults.split(', ').includes(quote.firstChild.textContent))
// JSDOM does not lay out text. Exercise the real fit effect with a narrow quote.
Object.defineProperty(quote,'clientWidth',{value:12})
globalThis.ResizeObserver=class{constructor(fit){this.fit=fit}observe(el){if(el===quote)this.fit()}disconnect(){}}
globalThis.getComputedStyle=dom.window.getComputedStyle.bind(dom.window)
dom.window.HTMLCanvasElement.prototype.getContext=()=>({measureText:text=>({width:[...text].length})})
await React.act(async()=>document.querySelector('[data-status-edit]').click())
const dialog=document.querySelector('[role=dialog]'),input=dialog.querySelector('[data-status-input="online_unobserved"]')
assert.equal(dialog.className,'max-w-md')
assert.equal(dialog.querySelector('header h2').textContent,'Edit status quote')
assert.deepEqual([...dialog.querySelectorAll('label')].map(label=>[label.textContent,label.control.type,label.control.maxLength]),['working','waiting','idle','online','offline','unknown'].map(state=>[state,'text',512]))
assert.equal(input.value,onlineDefaults)
const value='👨‍👩‍👧‍👦'.repeat(35)+'  trailing';const setter=Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set
await React.act(async()=>{setter.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}))})
await React.act(async()=>document.querySelector('[data-status-save]').click())
const stored=[...saved.values()][0];assert.equal([...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(stored)].length,28)
assert.equal(stored,'👨‍👩‍👧‍👦'.repeat(28));assert.match([...saved.keys()][0],/fixture-connection/);assert.match([...saved.keys()][0],/alpha/);assert.match([...saved.keys()][0],/:quote-v1:online_unobserved$/)
const entry=quote.parentElement.parentElement,beforeClick=entry.innerHTML
let clicks=0
quote.addEventListener('click',()=>clicks++,{once:true})
await React.act(async()=>quote.click())
assert.equal(clicks,1,'the quote received the click')
assert.ok(!document.querySelector('[data-status-full]'),'the quote does not expand on click')
assert.equal(entry.innerHTML,beforeClick,'click leaves the quote and edit controls unchanged')
assert.equal(quote.tagName,'SPAN')
assert.equal(quote.tabIndex,-1)
assert.equal(quote.title,stored)
assert.equal(quote.querySelector('[aria-hidden="true"]').textContent,'👨‍👩‍👧‍👦...')
assert.equal([...quote.children].filter(child=>!child.hasAttribute('aria-hidden')).map(child=>child.textContent).join(''),`Status: ${stored}`)
await React.act(async()=>root.unmount());console.log('PASS owner-scoped status edit, 28 graphemes, truncated preview with full title and accessible text, and passive click')
