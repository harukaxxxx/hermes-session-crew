// Clean official source baseline, separate from the public plugin-boundary test.
// No local SDK worktree fallback; digest mismatch is an error, not a skip.
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {createHash} from 'node:crypto'
import {SourceTextModule,SyntheticModule} from 'node:vm'
import path from 'node:path'
import assert from 'node:assert/strict'
const [source,revision]=process.argv.slice(2)
assert.ok(source&&path.isAbsolute(source),'Pass an explicit absolute official source root')
assert.ok(['553595b9839209650632efffac4d5c92675fa1aa','3b421578588243f920886e6fe79a6faa87ea026e'].includes(revision),'Unreviewed official revision')
const expected={
 'apps/desktop/src/sdk/profile-request.ts':'a26328f0d9da375fd3bea1aeb04aa64743ca2dcc1c5b114a69cae809c1471d98',
 'apps/desktop/src/sdk/index.ts':'681b2ae2e18fe4a294e978c8a4ee08b57540b2e4374cc66f0c3a47c13644cc82',
 'apps/desktop/src/store/gateway.ts':'8ed2e259cd85ec0c917b1b9f0a7c1c3211e1e17a96382b03e54797dfe643d209'
}
const sources={}
for(const [file,digest] of Object.entries(expected)){
 sources[file]=await readFile(path.join(source,file),'utf8')
 assert.equal(createHash('sha256').update(sources[file]).digest('hex'),digest,'Official bytes changed: '+file)
}
const require=createRequire(process.env.HERMES_CHECKOUT+'/package.json'),{transform}=require('esbuild')
let calls=[]
const gateway={requestGatewayForAgent:async(...args)=>{calls.push(args);return {sessions:[]}},requestGatewayForProfile:async()=>{throw Error('unexpected legacy route')}}
const mod=new SourceTextModule((await transform(sources['apps/desktop/src/sdk/profile-request.ts'],{loader:'ts',format:'esm'})).code)
await mod.link(async name=>{assert.ok(['@/store/gateway','@/store/profile'].includes(name));const obj=name==='@/store/gateway'?gateway:{$profiles:{get:()=>[]}};return new SyntheticModule(Object.keys(obj),function(){for(const [k,v] of Object.entries(obj))this.setExport(k,v)})});await mod.evaluate()
const route={connectionId:'c',mode:'remote',profile:'alpha',targetProfile:'different-backend'}
await assert.rejects(mod.namespace.requestPluginProfile({...route,targetProfile:''},'session.list',{}))
assert.equal(calls.length,0,'invalid owner must not reach gateway')
await mod.namespace.requestPluginProfile(route,'session.list',{limit:200,scope:'stored'},30000,{spawnPriority:'foreground'})
assert.deepEqual(calls[0].slice(0,6),['c','alpha','session.list',{limit:200,scope:'stored'},30000,undefined])
assert.equal(calls[0][6]?.spawnPriority,'foreground')
console.log(JSON.stringify({revision,source,verified_sha256:expected,observed_gateway_call:calls[0],scope:'clean official adapter with fake final gateway; not wire routing'},null,2))
// Keep the prior safety-related expectation visible as a separate non-passing
// compatibility gate. A mock at host.requestProfile cannot discharge it.
// Its failure identifies missing forwarding evidence, NOT proof of a wrong
// wire target: official downstream registry resolution still needs an E2E test.
assert.equal(calls[0][6]?.targetProfile,route.targetProfile,
 'OPEN HOST GATE: official adapter lacks explicit targetProfile forwarding; verify downstream registry routing without a local SDK patch before claiming compatibility')
