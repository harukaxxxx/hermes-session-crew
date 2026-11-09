import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
const require=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())+'/package.json'), {JSDOM}=require('jsdom')
const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
const React=require('react'), {createRoot}=require('react-dom/client'),jsx=require('react/jsx-runtime')
const atom=x=>({get:()=>x}),saved=new Map(),storage={get:async k=>saved.get(k),set:async(k,v)=>saved.set(k,v)}
const host={state:{connectionId:atom('fixture-connection'),profile:atom('alpha')}}
const sdk={host,useValue:a=>a.get(),useQuery:o=>o.queryKey[1]==='roster'?{data:[{name:'alpha'}]}:o.queryKey[1]==='routes'?{data:[]}:{data:{rows:[]}},Popover:p=>React.createElement('section',null,p.children),PopoverTrigger:p=>p.children,PopoverContent:p=>React.createElement('div',null,p.children)}
const mod=new SourceTextModule(await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8'));await mod.link(async s=>{const obj=s==='@hermes/plugin-sdk'?sdk:s==='react/jsx-runtime'?jsx:React;return new SyntheticModule(Object.keys(obj),function(){for(const [k,v] of Object.entries(obj))this.setExport(k,v)})});await mod.evaluate();let c;mod.namespace.default.register({register:x=>c=x,storage});const root=createRoot(document.getElementById('root'));await React.act(async()=>root.render(c.render()))
assert.ok(document.querySelector('[data-status-quote]'),'a generic status sentence is present')
assert.doesNotMatch(document.querySelector('[data-status-quote]').textContent,/未知|unknown/i)
await React.act(async()=>document.querySelector('[data-status-edit]').click())
let input=document.querySelector('[data-status-input]');assert.ok(input,'profile status authoring control exists')
const value='👨‍👩‍👧‍👦'.repeat(35)+'  trailing';const setter=Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set
await React.act(async()=>{setter.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}))})
await React.act(async()=>document.querySelector('[data-status-save]').click())
const stored=[...saved.values()][0];assert.equal([...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(stored)].length,28)
assert.equal(stored,'👨‍👩‍👧‍👦'.repeat(28));assert.match([...saved.keys()][0],/fixture-connection/);assert.match([...saved.keys()][0],/alpha/)
await React.act(async()=>document.querySelector('[data-status-quote]').click());assert.equal(document.querySelector('[data-status-full]').textContent,stored);assert.equal(document.querySelector('[data-status-full]').style.whiteSpace,'nowrap')
await React.act(async()=>root.unmount());console.log('PASS owner-scoped status, 28 graphemes and single-line reveal')
