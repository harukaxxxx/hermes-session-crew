// Continuous CDP capture of native Odin menu over Baldr's conversation.
// Run: ego-browser nodejs < /absolute/path/video/tools/project-clean-record.js
const fs = await import('node:fs/promises');
const path = await import('node:path');
const {performance} = await import('node:perf_hooks');
const {setTimeout:sleep} = await import('node:timers/promises');
const root='/Users/haruka/.hermes/profiles/shirogane-yuine/workspace/hermes-session-crew-demo/video/capture/project-clean';
await fs.mkdir(root,{recursive:true});
const dir=await fs.mkdtemp(path.join(root,'take01-'));
const page=(await taskSpace(77)).page('p1');
let started=false, override=false, done=false, actionError=null;
const frames=[];let start,end,previous=-Infinity;
function size(b){for(let i=2;i+8<b.length;){if(b[i++]!==255)throw Error('bad JPEG');while(b[i]===255)i++;const m=b[i++];if(m===216||m===1||(m>=208&&m<=215))continue;const n=b.readUInt16BE(i);if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(m))return {height:b.readUInt16BE(i+3),width:b.readUInt16BE(i+5)};i+=n;}throw Error('no JPEG dimensions');}
try {
 await page.cdp('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});override=true;
 await page.screenshot({path:path.join(dir,'preflight.png')}); await sleep(400);
 await page.cdp('Page.startScreencast',{format:'jpeg',quality:95,maxWidth:1920,maxHeight:1080,everyNthFrame:1});started=true;start=performance.now();
 const action=Promise.resolve().then(async()=>{await sleep(1200);await page.mouse.click(102,105,{label:'Open Odin sessions'});await sleep(7500);}).catch(e=>actionError=e).finally(()=>done=true);
 while(!done && performance.now()-start<20000){for(const e of await page.events()){if(e.method!=='Page.screencastFrame')continue;const p=e.params;await page.cdp('Page.screencastFrameAck',{sessionId:p.sessionId});const b=Buffer.from(p.data,'base64'), s=size(b), timestamp=p.metadata?.timestamp;if(s.width!==1920||s.height!==1080||!Number.isFinite(timestamp)||timestamp<=previous)throw Error('invalid source dimension or timestamp');previous=timestamp;const filename=String(frames.length).padStart(6,'0')+'.jpg';await fs.writeFile(path.join(dir,filename),b,{flag:'wx'});frames.push({filename,timestamp,...s});}await sleep(5);}
 end=performance.now();if(!done)throw Error('action timeout');await action;if(actionError)throw actionError;
}finally{if(started)await page.cdp('Page.stopScreencast');if(override)await page.cdp('Emulation.clearDeviceMetricsOverride');}
if(frames.length<2)throw Error('Insufficient frames');
const wallSeconds=(end-start)/1000, firstTime=frames[0].timestamp, finalHold=Math.max(.001,wallSeconds-(frames.at(-1).timestamp-firstTime));
let concat='ffconcat version 1.0\n';for(let i=0;i<frames.length;i++)concat+=`file '${frames[i].filename}'\noption framerate 1000\nduration ${i+1<frames.length?(frames[i+1].timestamp-frames[i].timestamp).toFixed(6):finalHold.toFixed(6)}\n`;concat+=`file '${frames.at(-1).filename}'\noption framerate 1000\n`;
await fs.writeFile(path.join(dir,'frames.ffconcat'),concat,{flag:'wx'});await fs.writeFile(path.join(dir,'timestamps.json'),JSON.stringify({frames,wallSeconds,firstTime,finalHold},null,2),{flag:'wx'});console.log(JSON.stringify({dir,frames:frames.length,wallSeconds,firstTime,lastTime:frames.at(-1).timestamp,finalHold},null,2));
