import {readFile} from 'node:fs/promises'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
let response, calls=[]
const host={state:{connectionId:{get:()=> 'c'},profile:{get:()=> 'alpha'}},requestProfile:async(route,method,params)=>{calls.push([route,method,params]);return params.scope==='live'?{scope:'live',sessions:[]}:response}}
let options=[]; const sdk={host,useQuery:o=>(options.push(o),{isPending:true}),useValue:()=>null,Popover:()=>null,PopoverContent:()=>null,PopoverTrigger:()=>null}
const React={useState:x=>[x,()=>{}],useRef:x=>({current:x}),useEffect:()=>{},useCallback:x=>x,useSyncExternalStore:()=>{},createContext:()=>({}),useContext:()=>{}}
const jsx={jsx:()=>null,jsxs:()=>null}
const src=await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8')
const mod=new SourceTextModule(src+'\nexport {recentData,Recent};');await mod.link(async spec=>{const o=spec==='@hermes/plugin-sdk'?sdk:spec==='react/jsx-runtime'?jsx:React;return new SyntheticModule(Object.keys(o),function(){for(const [k,v] of Object.entries(o))this.setExport(k,v)})});await mod.evaluate()
const a={name:'alpha',connectionId:'c',route:{connectionId:'c',profile:'alpha',targetProfile:'alpha',mode:'remote'}}
response={scope:'stored',sessions:[{id:'old-updated',title:'old but active',started_at:100},{id:'new-created',title:'new but inactive',started_at:200}]}
const nullTimes=async(_p,o)=>({profile:o.body.profile,activity:Object.fromEntries(o.body.ids.map(id=>[id,null]))})
assert.deepEqual((await mod.namespace.recentData(a,'background',nullTimes)).rows.map(x=>x.id),['old-updated','new-created'],'preserve source order for unknown timestamps, not creation time')
response={scope:'stored',sessions:[{id:'first',updated_at:'2026-11-08T00:00:00Z'},{id:'second',last_active:1793000000},{id:'third',started_at:1794000000}]}
const rest=async()=>({profile:'alpha',activity:{first:10,second:20,third:30}})
assert.deepEqual((await mod.namespace.recentData(a,'background',rest)).rows.map(x=>x.id),['third','second','first'],'canonical activity overrides source order and creation time')
mod.namespace.Recent({owner:a,phase:'',completion:{},retryRoutes:()=>{},onOpened:()=>{}})
assert.equal(options[0].queryKey[1],'recent')
assert.equal(options[0].refetchOnMount,'always')
assert.equal(options[0].refetchInterval,15000)
assert.equal(options[0].refetchOnWindowFocus,true)
assert.deepEqual(calls[0],[a.route,'session.list',{limit:200,scope:'stored'}])
const b={name:'beta',connectionId:'c',route:{connectionId:'c',profile:'beta',targetProfile:'beta',mode:'remote'}}
response={scope:'stored',sessions:[{id:'same',title:'beta only',started_at:1}]};assert.equal((await mod.namespace.recentData(b,'background',nullTimes)).rows[0].title,'beta only');assert.deepEqual(calls.at(-1)[0],b.route)
options=[];mod.namespace.Recent({owner:b,phase:'',completion:{},retryRoutes:()=>{},onOpened:()=>{}});assert.notDeepEqual(options[0].queryKey.slice(2),['c','alpha','c','alpha','alpha','remote',0])
console.log('PASS canonical activity ordering and metadata-only output')
