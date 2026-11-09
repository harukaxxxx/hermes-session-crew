import path from 'node:path';
import {createRequire} from 'node:module';
const root=process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT;
if(!root||!path.isAbsolute(root))throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT to an absolute checkout path');
const {build}=createRequire(path.join(root,'package.json'))('esbuild');
// The reference picker must be the exact tracked HEAD source, not a modified
// checkout or a stale generated artifact. Its private imports are test-only.
const {execFileSync}=await import('node:child_process');
const {readFile,stat}=await import('node:fs/promises');
const original=await readFile('tests/original-remote-picker.tsx');
const tracked=execFileSync('git',['show','HEAD:apps/desktop/src/app/right-sidebar/files/remote-picker.tsx'],{cwd:root});
if(!original.equals(tracked))throw Error('original picker does not match tracked checkout HEAD');
await build({entryPoints:['tests/original-folder-entry.jsx'],bundle:true,format:'iife',outfile:'tests/original-folder-bundle.js',jsx:'automatic',nodePaths:[root+'/node_modules'],alias:{'@/i18n':path.resolve('tests/original-folder-i18n.js'),'@/lib/desktop-fs':path.resolve('tests/original-folder-fs.js'),'@':root+'/apps/desktop/src'},define:{'process.env.NODE_ENV':'"production"'},logLevel:'info'});
if(!(await stat('tests/original-folder-bundle.js')).size)throw Error('original picker bundle is empty');
// Bundle the checkout's actual REST bridge and scope helpers only for fixture tests.
const client=await readFile(root+'/apps/desktop/src/api/client.ts','utf8');
const source=await readFile(root+'/apps/desktop/src/api/plugins.ts','utf8');
const extract=(text,a,b)=>{const i=text.indexOf(a),j=text.indexOf(b,i);if(i<0||j<0)throw Error('checkout bridge contract changed');return text.slice(i,j)};
const bridge='const $apiRequestScope={get:()=>window.fixtureScope()};\n'+extract(client,'export function profileScoped(',"\n/** A session's OWNER")+extract(client,'export function connectionScoped()','\n// Whether the window')+extract(client,'export function hermesApi<T>(', '\n// ── Capability scope')+extract(source,'function pluginPathSuffix(', '\n/** Refusals in a row');
await build({plugins:[{name:'fixture-actual-rest',setup(b){b.onResolve({filter:/^fixture-actual-rest$/},()=>({path:'bridge',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:bridge,loader:'ts'}))}}],entryPoints:['tests/sdk-entry.jsx'],bundle:true,format:'iife',outfile:'tests/sdk-bundle.js',jsx:'automatic',nodePaths:[root+'/node_modules'],alias:{'@hermes/plugin-sdk':path.resolve('tests/sdk-mock.js'),'@':root+'/apps/desktop/src'},define:{'process.env.NODE_ENV':'"production"'},logLevel:'info'});
// Compile the actual Desktop stylesheet and its Tailwind utilities for the
// controlled visual test; no host build, installation or deployment.
const {build: viteBuild}=await import(root+'/node_modules/vite/dist/node/index.js');
const {default: tailwind}=await import(root+'/node_modules/@tailwindcss/vite/dist/index.mjs');
await viteBuild({configFile:false,root:root+'/apps/desktop',plugins:[tailwind()],logLevel:'warn',publicDir:false,build:{outDir:path.resolve('tests/sdk-css'),emptyOutDir:false,rollupOptions:{input:root+'/apps/desktop/src/styles.css',output:{assetFileNames:'[name][extname]'}}}});
