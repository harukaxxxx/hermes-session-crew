// Genuine Loki Quick create with sequential 2x-density native captures.
// UI Scale 125% is a temporary public filming setting; restore to 150% afterward.
const fs=await import('node:fs/promises'),path=await import('node:path');
const {performance}=await import('node:perf_hooks');const {setTimeout:sleep}=await import('node:timers/promises');
const root='/Users/haruka/.hermes/profiles/shirogane-yuine/workspace/hermes-session-crew-demo/video/capture/loki-quickcreate-sequential';await fs.mkdir(root,{recursive:true});const dir=await fs.mkdtemp(path.join(root,'take-'));
const p=(await taskSpace(81)).page('p1');
async function inventory(){const r=await p.fetch('/api/sessions?profile=loki&limit=100');const j=JSON.parse(r.body),rows=Array.isArray(j)?j:j.sessions;if(!r.ok||!Array.isArray(rows))throw Error('Loki inventory unavailable');return rows;}
const beforeIds=new Set((await inventory()).map(x=>x.id)),before=await p.url();
await p.cdp('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:2,mobile:false});
const begin=performance.now(),captures=[],actions=[];
async function snap(label){const r=await p.cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const filename=label+'.png';await fs.writeFile(path.join(dir,filename),Buffer.from(r.data,'base64'));captures.push({filename,seconds:(performance.now()-begin)/1000});}
async function click(x,y,label){actions.push({label,x,y,seconds:(performance.now()-begin)/1000});for(const type of ['mousePressed','mouseReleased'])await p.cdp('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1});}
await click(1200,800,'Close existing menu');await snap('before');
await click(84,382,'Open Loki menu at measured 125 percent coordinates');await sleep(500);await snap('menu');
actions.push({label:'Quick create Loki',x:254,y:628,seconds:(performance.now()-begin)/1000});
await p.cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:254,y:628,button:'left',clickCount:1});await snap('pressed');
await p.cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:254,y:628,button:'left',clickCount:1});
let after=before;for(let i=0;i<16;i++){await sleep(500);after=await p.url();if(after!==before)break;}
await p.cdp('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:2,mobile:false});await snap('created-native');
const added=(await inventory()).filter(x=>!beforeIds.has(x.id)).map(x=>({id:x.id,title:x.title,message_count:x.message_count}));
await fs.writeFile(path.join(dir,'capture.json'),JSON.stringify({before,after,captures,actions,added,viewport:{width:1920,height:1080,deviceScaleFactor:2},uiScale:125,classification:'Sequential actual native input/result captures, not continuous recording or model execution'},null,2));
if(after===before)throw Error('No navigation; reconcile added IDs before any retry: '+JSON.stringify(added)+' '+dir);
const id=new URL(after).hash.slice(2).split('?')[0];if(!/^local-[a-f0-9]+$/.test(id))throw Error('Unexpected literal id '+id);
const r=await p.fetch(`/api/sessions/${id}?profile=loki`),d=JSON.parse(r.body);
if(!r.ok||d.profile!=='loki'||d.message_count!==0)throw Error('New Loki ownership/messages mismatch '+id);
const title='Rainbow Bridge — Delayed Approval';
const rename=await p.fetch(`/api/sessions/${id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({profile:'loki',title,expected_revision:d.runtime_revision,expected_generation:d.runtime_generation,request_id:`title-${id}`})});
const check=await p.fetch(`/api/sessions/${id}?profile=loki`),c=JSON.parse(check.body);if(!rename.ok||!check.ok||c.title!==title||c.profile!=='loki')throw Error('Title readback failed '+id);
await fs.writeFile(path.join(dir,'readback.json'),JSON.stringify({id,profile:c.profile,title:c.title,cwd:c.cwd,message_count:c.message_count,url:after,added},null,2));
await p.reload();await sleep(6500);await p.cdp('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:2,mobile:false});
await snap('named-closed-result');await click(84,382,'Show newly created Loki session');await sleep(500);await snap('named-menu-result');
await fs.writeFile(path.join(dir,'capture.json'),JSON.stringify({before,after,captures,actions,added,viewport:{width:1920,height:1080,deviceScaleFactor:2},uiScale:125,classification:'Native sequential captures plus separate titled result after public PATCH/readback; no continuous-FPS or inference claim'},null,2));
await p.cdp('Emulation.clearDeviceMetricsOverride');
console.log(JSON.stringify({dir,id,profile:c.profile,title:c.title,message_count:c.message_count,added,captures:captures.length},null,2));
