// Native UI input and verified result; no model execution or host inspection.
// Record taller native viewport to keep the SDK popup within its viewport.
// Final 1080p edit crops native pixels (x=0,y=48,w=1920,h=1080), no upscale.
const fs = await import('node:fs/promises');
const path = await import('node:path');
const {performance} = await import('node:perf_hooks');
const {setTimeout: sleep} = await import('node:timers/promises');
const root = '/Users/haruka/.hermes/profiles/shirogane-yuine/workspace/hermes-session-crew-demo/video/capture/loki-quickcreate-complete';
await fs.mkdir(root, {recursive: true});
const dir = await fs.mkdtemp(path.join(root, 'take-'));
const p = (await taskSpace(81)).page('p1');
const frames = [];
const markers = [];
async function nativeClick(x, y) {
  await p.cdp('Input.dispatchMouseEvent', {type:'mouseMoved',x,y});
  for (const type of ['mousePressed','mouseReleased']) await p.cdp('Input.dispatchMouseEvent', {type,x,y,button:'left',clickCount:1});
}
let started = false, done = false, failure = null, previous = -Infinity, begin, end, resultURL;
function size(b) {
  for (let i = 2; i + 8 < b.length;) {
    if (b[i++] !== 255) throw Error('Invalid JPEG');
    while (b[i] === 255) i++;
    const m = b[i++];
    if (m === 216 || m === 1 || (m >= 208 && m <= 215)) continue;
    const n = b.readUInt16BE(i);
    if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(m)) return {height: b.readUInt16BE(i + 3), width: b.readUInt16BE(i + 5)};
    i += n;
  }
  throw Error('No JPEG dimensions');
}
async function drain() {
  for (const e of await p.events()) {
    if (e.method !== 'Page.screencastFrame') continue;
    const q = e.params;
    await p.cdp('Page.screencastFrameAck', {sessionId: q.sessionId});
    const b = Buffer.from(q.data, 'base64'), dimensions = size(b), timestamp = q.metadata?.timestamp;
    if (dimensions.width !== 1920 || dimensions.height !== 1440 || !Number.isFinite(timestamp) || timestamp <= previous) throw Error('Invalid native capture');
    previous = timestamp;
    const filename = String(frames.length).padStart(6, '0') + '.jpg';
    await fs.writeFile(path.join(dir, filename), b, {flag: 'wx'});
    frames.push({filename, timestamp, ...dimensions});
  }
}
await p.cdp('Emulation.setDeviceMetricsOverride', {width:1920,height:1440,deviceScaleFactor:1,mobile:false});
await nativeClick(1200,800);
await sleep(300);
await p.screenshot({path: path.join(dir, 'preflight.png')});
const oldURL = await p.url();
try {
  await p.cdp('Page.startScreencast', {format:'jpeg',quality:95,maxWidth:1920,maxHeight:1440,everyNthFrame:1});
  started = true; begin = performance.now();
  const action = (async () => {
    await sleep(800);
    markers.push({action:'open_loki_menu',seconds:(performance.now()-begin)/1000});
    await nativeClick(104,458);
    await sleep(1400);
    await p.screenshot({path:path.join(dir,'menu.png')});
    markers.push({action:'quick_create',seconds:(performance.now()-begin)/1000});
    await nativeClick(338,870);
    for (let i=0;i<20;i++) {resultURL=await p.url();if(resultURL!==oldURL)break;await sleep(300);}
    if (!resultURL || resultURL===oldURL) throw Error('Quick create did not navigate');
    markers.push({action:'new_session_route',seconds:(performance.now()-begin)/1000,url:resultURL});
    await sleep(2000);
    await p.screenshot({path:path.join(dir,'native-created.png')});
  })().catch(e=>failure=e).finally(()=>done=true);
  while(!done && performance.now()-begin<18000){await drain();await sleep(5);}
  await action; await drain(); end=performance.now();
} finally {if(started)await p.cdp('Page.stopScreencast');}
if(frames.length<2)throw Error('Insufficient native events');
const wallSeconds=(end-begin)/1000,finalHold=Math.max(.001,wallSeconds-(frames.at(-1).timestamp-frames[0].timestamp));
let concat='ffconcat version 1.0\n';
for(let i=0;i<frames.length;i++)concat+=`file '${frames[i].filename}'\noption framerate 1000\nduration ${i+1<frames.length?(frames[i+1].timestamp-frames[i].timestamp).toFixed(6):finalHold.toFixed(6)}\n`;
concat+=`file '${frames.at(-1).filename}'\noption framerate 1000\n`;
await fs.writeFile(path.join(dir,'frames.ffconcat'),concat,{flag:'wx'});
await fs.writeFile(path.join(dir,'timestamps.json'),JSON.stringify({frames,wallSeconds,finalHold,markers,classification:'Native Quick create UI, no inference; later titled result is a separate held capture',crop:{x:0,y:48,width:1920,height:1080}},null,2),{flag:'wx'});
if(failure)throw failure;
const id = new URL(resultURL).hash.slice(2).split('?')[0];
if(!/^local-[a-f0-9]+$/.test(id))throw Error('Unexpected created session identifier');
const detail=await p.fetch(`/api/sessions/${id}?profile=loki`);
const before=JSON.parse(detail.body);
if(!detail.ok||before.profile!=='loki'||before.message_count!==0)throw Error('Created session identity/content mismatch');
const title='Rainbow Bridge — Delayed Approval';
const update=await p.fetch(`/api/sessions/${id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({profile:'loki',title,expected_revision:before.runtime_revision,expected_generation:before.runtime_generation,request_id:`title-${id}`})});
const check=await p.fetch(`/api/sessions/${id}?profile=loki`);
const after=JSON.parse(check.body);
if(!update.ok||!check.ok||after.title!==title||after.profile!=='loki')throw Error('Title readback mismatch');
await fs.writeFile(path.join(dir,'readback.json'),JSON.stringify({id,profile:after.profile,title:after.title,message_count:after.message_count,runtime_revision:after.runtime_revision,url:resultURL},null,2),{flag:'wx'});
await p.reload(); await sleep(6500);
await p.cdp('Emulation.setDeviceMetricsOverride',{width:1920,height:1440,deviceScaleFactor:1,mobile:false});
await nativeClick(104,458); await sleep(1200);
await p.screenshot({path:path.join(dir,'titled-result.png')});
await p.keyboard.press('Escape');
await p.cdp('Emulation.clearDeviceMetricsOverride');
console.log(JSON.stringify({dir,events:frames.length,wallSeconds,markers,resultURL,id,title,crop:{x:0,y:48,width:1920,height:1080}},null,2));
