// Native Odin → Open project → existing Ragnarök row's PLUS → new session.
// The project name is display-only; the row plus invokes create(project).
const fs=await import('node:fs/promises'),path=await import('node:path');
const {performance}=await import('node:perf_hooks');
const {setTimeout:sleep}=await import('node:timers/promises');
const root='/Users/haruka/.hermes/profiles/shirogane-yuine/workspace/hermes-session-crew-demo/video/capture/odin-project-real-action';
await fs.mkdir(root,{recursive:true});const dir=await fs.mkdtemp(path.join(root,'take-'));
const p=(await taskSpace(81)).page('p1');
await p.goto('http://192.168.1.100:4178/#/local-f5959b6a7b8a785be6a1b918782598da3b7e5bb2ef47567df9d73bcdd28fc713');
await sleep(6500);
await p.cdp('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
const frames=[],markers=[];let prev=-Infinity,started=false,begin,end,failure=null;
function size(b){for(let i=2;i+8<b.length;){if(b[i++]!==255)throw Error('bad JPEG');while(b[i]===255)i++;const m=b[i++];if(m===216||m===1||(m>=208&&m<=215))continue;const n=b.readUInt16BE(i);if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(m))return {height:b.readUInt16BE(i+3),width:b.readUInt16BE(i+5)};i+=n;}throw Error('no JPEG dimensions');}
async function click(x,y,label){markers.push({label,x,y,seconds:(performance.now()-begin)/1000});for(const type of ['mousePressed','mouseReleased'])await p.cdp('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1});}
async function snap(name){const r=await p.cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(dir,name+'.png'),Buffer.from(r.data,'base64'));}
async function drain(){for(const e of await p.events()){if(e.method!=='Page.screencastFrame')continue;const q=e.params;await p.cdp('Page.screencastFrameAck',{sessionId:q.sessionId});const b=Buffer.from(q.data,'base64'),s=size(b),timestamp=q.metadata?.timestamp;if(s.width!==1920||s.height!==1080||!Number.isFinite(timestamp)||timestamp<=prev)throw Error('native capture dimension/timestamp mismatch');prev=timestamp;const filename=String(frames.length).padStart(6,'0')+'.jpg';await fs.writeFile(path.join(dir,filename),b,{flag:'wx'});frames.push({filename,timestamp,...s});}}
async function hold(ms){const until=performance.now()+ms;while(performance.now()<until){await sleep(Math.min(120,until-performance.now()));await drain();}}
const beforeURL=await p.url();
try{
 await p.cdp('Page.startScreencast',{format:'jpeg',quality:97,maxWidth:1920,maxHeight:1080,everyNthFrame:1});started=true;begin=performance.now();
 await hold(900);await click(104,104,'Open Odin menu');await hold(1800);await snap('odin-menu');
 await click(550,414,'Open project picker');await hold(1800);await snap('project-picker');
 await click(738,808,'Launch existing Ragnarok project via row plus');await hold(3000);await snap('created-native');
 await drain();end=performance.now();
}catch(e){failure=e;end=performance.now();}finally{if(started)await p.cdp('Page.stopScreencast');}
const wallSeconds=(end-begin)/1000,first=frames[0]?.timestamp;
if(frames.length){const finalHold=Math.max(.001,wallSeconds-(frames.at(-1).timestamp-first));let text='ffconcat version 1.0\n';for(let i=0;i<frames.length;i++)text+=`file '${frames[i].filename}'\noption framerate 1000\nduration ${i+1<frames.length?(frames[i+1].timestamp-frames[i].timestamp).toFixed(6):finalHold.toFixed(6)}\n`;text+=`file '${frames.at(-1).filename}'\noption framerate 1000\n`;await fs.writeFile(path.join(dir,'frames.ffconcat'),text,{flag:'wx'});await fs.writeFile(path.join(dir,'timestamps.json'),JSON.stringify({frames,wallSeconds,finalHold,markers,classification:'Native project row-plus launch, no new project and no model inference; content-change events, not 30 unique captures/s'},null,2),{flag:'wx'});}
const afterURL=await p.url();
await fs.writeFile(path.join(dir,'action.json'),JSON.stringify({beforeURL,afterURL,markers,error:failure?.message||null},null,2),{flag:'wx'});
if(failure)throw failure;
if(afterURL===beforeURL)throw Error('Project PLUS did not navigate; preserve partial take '+dir);
const id=new URL(afterURL).hash.slice(2).split('?')[0];
if(!/^local-[a-f0-9]+$/.test(id))throw Error('Unexpected literal session id '+id);
const r=await p.fetch(`/api/sessions/${id}?profile=default`),detail=JSON.parse(r.body);
if(!r.ok||detail.profile!=='default'||detail.cwd!=='/Users/haruka/SessionCrew-Demo/Ragnarök'||detail.message_count!==0)throw Error('Project launch readback mismatch');
const title='Ragnarök — Council of the Gods';
const rename=await p.fetch(`/api/sessions/${id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({profile:'default',title,expected_revision:detail.runtime_revision,expected_generation:detail.runtime_generation,request_id:`title-${id}`})});
const check=await p.fetch(`/api/sessions/${id}?profile=default`),confirmed=JSON.parse(check.body);
if(!rename.ok||!check.ok||confirmed.title!==title)throw Error('Project session title readback failed');
await fs.writeFile(path.join(dir,'readback.json'),JSON.stringify({id,profile:confirmed.profile,cwd:confirmed.cwd,title:confirmed.title,message_count:confirmed.message_count,url:afterURL,classification:'Created empty session in existing Ragnarok project; not model execution'},null,2),{flag:'wx'});
await p.reload();await sleep(6500);await p.cdp('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});await snap('named-result');await p.cdp('Emulation.clearDeviceMetricsOverride');
console.log(JSON.stringify({dir,sourceEvents:frames.length,wallSeconds,id,title,url:afterURL,cwd:confirmed.cwd,message_count:confirmed.message_count},null,2));
