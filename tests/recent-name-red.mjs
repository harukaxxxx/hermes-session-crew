import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {SourceTextModule, SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
const require = createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())+'/package.json')
const React = require('react'), {createRoot} = require('react-dom/client'), {JSDOM} = require('jsdom'), jsx = require('react/jsx-runtime')
const dom = new JSDOM('<div id="root"></div>', {url:'https://fixture.invalid'})
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true
const atom = value => ({get:()=>value})
const sdk = {
  host:{state:{connectionId:atom(null),profile:atom('fixture')}},
  useValue:a=>a.get(),
  useQuery:()=>({data:[{name:'fixture',display_name:'Core label',ui_meta:{'hermes-bots':{title:'Structured label'}}}]}),
  Popover:p=>React.createElement('section',null,p.children),
  PopoverContent:p=>React.createElement('div',null,p.children),
  PopoverTrigger:p=>p.children
}
const mod = new SourceTextModule(await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8'))
await mod.link(async spec=>{
  const obj=spec==='@hermes/plugin-sdk'?sdk:spec==='react/jsx-runtime'?jsx:spec==='react'?React:null
  assert.ok(obj,spec)
  return new SyntheticModule(Object.keys(obj),function(){for(const [k,v] of Object.entries(obj))this.setExport(k,v)})
})
await mod.evaluate()
let contribution
mod.namespace.default.register({register:c=>contribution=c})
const root=createRoot(document.getElementById('root'))
await React.act(async()=>root.render(contribution.render()))
try {
  assert.equal(document.querySelector('button').getAttribute('aria-label'), 'Structured label · state unknown')
  console.log('PASS structured Bots title takes precedence')
} finally { await React.act(async()=>root.unmount()) }
