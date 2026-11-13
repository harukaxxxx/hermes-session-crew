import {readFile} from 'node:fs/promises'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
const calls=[]
const route={connectionId:'conn',profile:'alpha',targetProfile:'alpha',mode:'remote'}
const host={state:{connectionId:{get:()=> 'conn'},profile:{get:()=> 'beta'}},requestProfile:async(r,m,p)=>{calls.push([r,m,p]);return p.scope==='live'?{scope:'live',sessions:[{id:'live-new',title:'New live',started_at:200},{id:'duplicate',title:'Live duplicate'}]}:{scope:'stored',sessions:[{id:'duplicate',title:'Stored duplicate'},{id:'old',title:'Old'}]}}}
const sdk={host,useQuery:()=>{},useValue:()=>{},Popover:()=>{},PopoverContent:()=>{},PopoverTrigger:()=>{}}
const react={useState:()=>{},useRef:()=>{},useEffect:()=>{},useCallback:()=>{},useSyncExternalStore:()=>{},createContext:()=>({}),useContext:()=>{}}
const jsx={jsx:()=>{},jsxs:()=>{}}
const src=await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8')
const mod=new SourceTextModule(src+'\nexport {recentData};')
await mod.link(async spec=>{const o=spec==='@hermes/plugin-sdk'?sdk:spec==='react/jsx-runtime'?jsx:react;return new SyntheticModule(Object.keys(o),function(){for(const [k,v] of Object.entries(o))this.setExport(k,v)})});await mod.evaluate()
const rest=async(_p,o)=>({profile:o.body.profile,activity:Object.fromEntries(o.body.ids.map(id=>[id,null]))})
const result=await mod.namespace.recentData({name:'alpha',connectionId:'conn',route},'background',rest)
assert.deepEqual(result.rows.map(x=>x.id),['live-new','duplicate','old'],'canonical live sessions must not be omitted from stored history')
assert.equal(result.rows[1].title,'Live duplicate')
assert.deepEqual(calls.map(x=>x[2].scope).sort(),['live','stored'])
assert.ok(calls.every(x=>x[0]===route&&x[1]==='session.list'))
host.requestProfile=async(r,m,p)=>p.scope==='stored'?{scope:'stored',sessions:[]}:{error:{message:'failed'}}
await assert.rejects(()=>mod.namespace.recentData({name:'alpha',connectionId:'conn',route}),/Unsupported live session response format/)
host.requestProfile=async(r,m,p)=>p.scope==='live'?{scope:'live',sessions:Array.from({length:200},(_,i)=>({id:'live'+i}))}:{scope:'stored',sessions:[{id:'old'}]}
assert.equal((await mod.namespace.recentData({name:'alpha',connectionId:'conn',route},'background',rest)).rows.length,200)
console.log('PASS owner-scoped canonical live + stored merge')
