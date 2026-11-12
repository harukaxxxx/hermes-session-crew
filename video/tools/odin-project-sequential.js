// Genuine sequential native captures of project launch; no continuous-FPS claim.
const fs=await import('node:fs/promises'),path=await import('node:path');
const {performance}=await import('node:perf_hooks');const {setTimeout:sleep}=await import('node:timers/promises');
const root='/Users/haruka/.hermes/profiles/shirogane-yuine/workspace/hermes-session-crew-demo/video/capture/odin-project-sequential';
await fs.mkdir(root,{recursive:true});const dir=await fs.mkdtemp(path.join(root,'take-'));
const p=(await taskSpace(81)).page('p1'),before=await p.url();
if(!before.includes('local-f5959b6a7b8a785be6a1b918782598da3b7e5bb2ef47567df9d73bcdd28fc713'))throw Error('Unexpected initial page; no action taken');
await p.cdp('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
const started=performance.now(),captures=[],actions=[];
async function snap(label){const r=await p.cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const filename=label+'.png';await fs.writeFile(path.join(dir,filename),Buffer.from(r.data,'base64'));captures.push({filename,seconds:(performance.now()-started)/1000});}
async function click(x,y,label){actions.push({label,x,y,seconds:(performance.now()-started)/1000});for(const type of ['mousePressed','mouseReleased'])await p.cdp('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1});}
await click(1200,800,'Close any existing menu');await snap('before');
await click(104,104,'Open Odin');await sleep(500);await snap('odin-menu');
await click(550,414,'Open project picker');await sleep(500);await snap('project-picker');
actions.push({label:'Press existing Ragnarok row PLUS, not new-project header plus',x:738,y:808,seconds:(performance.now()-started)/1000});
await p.cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:738,y:808,button:'left',clickCount:1});await snap('plus-pressed');
await p.cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:738,y:808,button:'left',clickCount:1});await sleep(2200);await snap('created-native');
const after=await p.url();
await fs.writeFile(path.join(dir,'capture.json'),JSON.stringify({before,after,captures,actions,classification:'Sequential native browser captures of actual input/result, not continuous recording; no model call'},null,2));
if(after===before)throw Error('Native project PLUS did not navigate; preserved '+dir);
const id=new URL(after).hash.slice(2).split('?')[0];if(!/^local-[a-f0-9]+$/.test(id))throw Error('Unexpected literal ID '+id);
const r=await p.fetch(`/api/sessions/${id}?profile=default`),d=JSON.parse(r.body);
if(!r.ok||d.profile!=='default'||d.cwd!=='/Users/haruka/SessionCrew-Demo/Ragnarök'||d.message_count!==0)throw Error('Native project result identity/cwd/messages mismatch '+id);
const title='Ragnarök — Council of the Gods';
const rename=await p.fetch(`/api/sessions/${id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({profile:'default',title,expected_revision:d.runtime_revision,expected_generation:d.runtime_generation,request_id:`title-${id}`})});
const check=await p.fetch(`/api/sessions/${id}?profile=default`),c=JSON.parse(check.body);
if(!rename.ok||!check.ok||c.title!==title)throw Error('Readback failed '+id);
await fs.writeFile(path.join(dir,'readback.json'),JSON.stringify({id,profile:c.profile,cwd:c.cwd,title:c.title,message_count:c.message_count,url:after},null,2));
await p.reload();await sleep(6500);await p.cdp('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
await click(104,104,'Show newly created project session');await sleep(500);await snap('named-result');
await fs.writeFile(path.join(dir,'capture.json'),JSON.stringify({before,after,captures,actions,classification:'Sequential genuine native captures; result title set through public PATCH/readback; no continuous-FPS or inference claim'},null,2));
await p.cdp('Emulation.clearDeviceMetricsOverride');
console.log(JSON.stringify({dir,id,profile:c.profile,cwd:c.cwd,title:c.title,message_count:c.message_count,captures:captures.length},null,2));
