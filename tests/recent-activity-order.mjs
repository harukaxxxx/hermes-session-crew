import {readFile} from 'node:fs/promises'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import assert from 'node:assert/strict'
let times={A:300,B:200,C:100}, requested=[]
let connection='c',ambient='alpha'
const listeners={connectionId:new Set(),profile:new Set()}
const host={state:{connectionId:{get:()=>connection,subscribe:f=>(listeners.connectionId.add(f),()=>listeners.connectionId.delete(f))},profile:{get:()=>ambient,subscribe:f=>(listeners.profile.add(f),()=>listeners.profile.delete(f))}},requestProfile:async(_r,_m,p)=>p.scope==='stored'?{scope:'stored',sessions:[{id:'C',started_at:9000},{id:'B'}]}:{scope:'live',sessions:[{id:'A'},{id:'B',title:'live'}]}}
const sdk={host,useQuery:()=>{},useValue:()=>{},Popover:()=>{},PopoverContent:()=>{},PopoverTrigger:()=>{}}
const react={createContext:()=>({}),useState:()=>{},useEffect:()=>{},useRef:()=>{},useCallback:()=>{},useSyncExternalStore:()=>{},useContext:()=>{}}; const jsx={jsx:()=>{},jsxs:()=>{}}
const mod=new SourceTextModule((await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8'))+'\nexport {recentData};')
await mod.link(async spec=>{const o=spec==='@hermes/plugin-sdk'?sdk:spec==='react/jsx-runtime'?jsx:react;return new SyntheticModule(Object.keys(o),function(){for(const [k,v] of Object.entries(o))this.setExport(k,v)})});await mod.evaluate()
const owner={name:'alpha',connectionId:'c',route:{connectionId:'c',profile:'alpha',targetProfile:'alpha',mode:'remote'}}
const rest=async(path,options)=>{requested.push([path,options.body]);return {profile:'alpha',activity:Object.fromEntries(options.body.ids.map(id=>[id,times[id]??null]))}}
assert.deepEqual((await mod.namespace.recentData(owner,'background',rest)).rows.map(x=>x.id),['A','B','C'])
times={A:300,B:200,C:400}
const rows=(await mod.namespace.recentData(owner,'background',rest)).rows
assert.deepEqual(rows.map(x=>x.id),['C','A','B'],'third stored item must rise above live items on real activity')
assert.equal(rows.find(x=>x.id==='B').title,'live')
assert.equal(requested[0][1].profile,'alpha')
times={A:20,B:20,C:null}
assert.deepEqual((await mod.namespace.recentData(owner,'background',rest)).rows.map(x=>x.id),['A','B','C'],'ties and missing values retain input order')
host.requestProfile=async(_r,_m,p)=>p.scope==='live'?{scope:'live',sessions:Array.from({length:200},(_,i)=>({id:'live'+i}))}:{scope:'stored',sessions:[{id:'newest'}]}
times={newest:999}
const capped=(await mod.namespace.recentData(owner,'background',rest)).rows
assert.equal(capped.length,200);assert.equal(capped[0].id,'newest','sort before truncation')
for (const bad of [async()=>{throw Error('503')},async()=>({profile:'beta',activity:{}}),async()=>({profile:'alpha',activity:{}})]) {
 await assert.rejects(mod.namespace.recentData(owner,'background',bad),'unavailable or incomplete metadata must not masquerade as sorted')
}
const alias={...owner,route:{...owner.route,targetProfile:'backend'}}
await mod.namespace.recentData(alias,'background',async(_p,o)=>{assert.equal(o.body.profile,'backend');return {profile:'backend',activity:Object.fromEntries(o.body.ids.map(id=>[id,null]))}})
for(const change of [()=>{ambient='beta'},()=>{connection='other'}]){
 ambient='alpha';connection='c';let release;const wait=new Promise(r=>release=r);let entered
 const started=new Promise(r=>entered=r)
 const pending=mod.namespace.recentData(owner,'background',async(_p,o)=>{entered();await wait;return {profile:'alpha',activity:Object.fromEntries(o.body.ids.map(id=>[id,null]))}})
 await started;change();release();await assert.rejects(pending,'scope change must reject metadata');
}
ambient='alpha';connection='c';let releaseABA,enteredABA
const blocked=new Promise(r=>releaseABA=r),enteredPromise=new Promise(r=>enteredABA=r)
const aba=mod.namespace.recentData(owner,'background',async(_p,o)=>{enteredABA();await blocked;return {profile:'alpha',activity:Object.fromEntries(o.body.ids.map(id=>[id,null]))}})
await enteredPromise;ambient='beta';for(const f of listeners.profile)f();ambient='alpha';for(const f of listeners.profile)f();releaseABA();await assert.rejects(aba,'switch away and back rejects stale data')
connection='c';ambient='alpha'
host.requestProfile=async()=>({sessions:[{id:'shared'},{id:'other'}]})
const readFor=async(o)=>mod.namespace.recentData(o,'background',async(_p,opts)=>({profile:opts.body.profile,activity:{shared:connection==='c'?10:30,other:20}}))
assert.deepEqual((await readFor(owner)).rows.map(r=>r.id),['other','shared'])
connection='other';const owner2={...owner,connectionId:'other',route:{...owner.route,connectionId:'other'}}
assert.deepEqual((await readFor(owner2)).rows.map(r=>r.id),['shared','other'],'same IDs on another connection use that connection metadata')
assert.equal(listeners.profile.size,0);assert.equal(listeners.connectionId.size,0)
console.log('PASS recent activity ordering')
