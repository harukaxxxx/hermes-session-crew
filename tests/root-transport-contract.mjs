// Executable check of the installed REST transport, not a replacement SDK.
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { SourceTextModule, SyntheticModule } from 'node:vm'
import assert from 'node:assert/strict'

const require = createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())+'/package.json')
const { transform } = require('esbuild')
const sdkPath = (process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())+'/apps/desktop/src/api/plugins.ts'
const code = (await transform(await readFile(sdkPath, 'utf8'), { loader: 'ts', format: 'esm' })).code
let activeProfile = 'default'
let activeConnection = 'source-a'
const calls = []
// Extract the real, self-contained scoping helpers; only their atom and final
// Desktop bridge are test doubles. This checks the actual emitted parameters.
const client = await readFile((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())+'/apps/desktop/src/api/client.ts', 'utf8')
const extract = (start, end) => {
  assert.ok(client.includes(start) && client.includes(end))
  return client.slice(client.indexOf(start), client.indexOf(end, client.indexOf(start)))
}
const helpers = [
  extract('export function profileScoped(', '\n/** A session\'s OWNER'),
  extract('export function connectionScoped()', '\n// Whether the window'),
  extract('export function hermesApi<T>(', '\n// ── Capability scope')
].join('\n')
const helperCode = (await transform(`const $apiRequestScope = globalThis.__railScope;\n${helpers}`, { loader: 'ts', format: 'esm' })).code
globalThis.__railScope = { get: () => ({ profile: activeProfile, connectionId: activeConnection }) }
globalThis.window = { hermesDesktop: { api: async req => { calls.push(req); return {} } } }
const helperModule = new SourceTextModule(helperCode)
await helperModule.link(() => { throw Error('unexpected helper import') })
await helperModule.evaluate()
const imports = {
  '@hermes/shared': { isStableOpen: () => true, reconnectBackoffDelayMs: () => 0 },
  '@/lib/host-capabilities': { hostHas: () => false },
  '@/lib/with-timeout': { RECONNECT_ATTEMPT_TIMEOUT_MS: 30000, withTimeout: x => x },
  './client': {
    $apiRequestScope: { get: () => ({ profile: activeProfile, connectionId: activeConnection }) },
    getApiRequestConnection: () => activeConnection,
    getApiRequestProfile: () => activeProfile,
    profileScoped: helperModule.namespace.profileScoped,
    hermesApi: helperModule.namespace.hermesApi
  }
}
const mod = new SourceTextModule(code)
await mod.link(async name => {
  assert.ok(imports[name], `unexpected import ${name}`)
  const obj = imports[name]
  return new SyntheticModule(Object.keys(obj), function () {
    for (const [key, value] of Object.entries(obj)) this.setExport(key, value)
  })
})
await mod.evaluate()
const { pluginRest } = mod.namespace
await pluginRest('profile-rail', '/completion-snapshot', { method: 'GET', profile: 'default', connectionId: 'source-x' })
activeProfile = 'worker'
await pluginRest('profile-rail', '/completion-snapshot', { method: 'GET', profile: 'default', connectionId: 'source-x' })
activeConnection = 'source-b'
activeProfile = 'default'
await pluginRest('profile-rail', '/completion-snapshot', { method: 'GET' })
assert.deepEqual(calls.map(x => [x.connectionId, x.profile]), [['source-a','default'],['source-a','worker'],['source-b','default']])
assert.ok(calls.every(x => x.path === '/api/plugins/profile-rail/completion-snapshot'))
console.log('PASS actual pluginRest forwards active profile and connection; extra selector options ignored')
