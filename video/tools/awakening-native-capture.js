// Genuine isolated renderer captures; staged statuses are not model execution.
const fs=await import('node:fs/promises'),path=await import('node:path');
const {setTimeout:sleep}=await import('node:timers/promises');
const root='/Users/haruka/.hermes/profiles/shirogane-yuine/workspace/hermes-session-crew-demo/video';
const t=await taskSpace(82),p=t.page('p1');
const dir=await fs.mkdtemp(path.join(root,'capture/awakening-native-'));
const output=path.join(root,'public/footage/awakening-native');await fs.mkdir(output,{recursive:true});
const stages=['awakening-0','awakening-1','awakening-2','awakening-3','awakening-4','awakening-overlap'];
const workers=['thor','tyr','freyja','frigg'],records=[];
async function api(url,options){const r=await p.fetch(url,options);if(!r.ok)throw Error(url+' HTTP '+r.status+' '+r.body.slice(0,200));return JSON.parse(r.body);}
async function control(stage){return api('/api/plugins/profile-rail/scripted/control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({stage})});}
async function snap(filename){await p.cdp('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:2,mobile:false});const r=await p.cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const bytes=Buffer.from(r.data,'base64');const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);if(width!==3840||height!==2160)throw Error('Native capture dimension mismatch '+width+'x'+height);await fs.writeFile(path.join(dir,filename),bytes);await fs.writeFile(path.join(output,filename),bytes);return {filename,width,height};}
let failure=null;
try{
 for(let index=0;index<stages.length;index++){
  const stage=stages[index];await control(stage);await sleep(6500);
  const status=await api('/api/plugins/profile-rail/status');
  const snapshot=await api('/api/plugins/profile-rail/completion-snapshot');
  const active=workers.slice(0,Math.min(index,4));
  if(!Array.isArray(status)||status.length!==8||status.some(x=>x.source!=='synthetic'||x.stage!==stage))throw Error('Stage readback mismatch '+stage);
  for(const name of workers){const row=status.find(x=>x.profile===name);if(row?.state!==(active.includes(name)?'working':'offline'))throw Error('Worker state mismatch '+stage+' '+name);}
  for(const name of ['loki','baldr'])if(status.find(x=>x.profile===name)?.state!=='offline')throw Error('Persistent offline mismatch '+name);
  const count=snapshot.profiles?.find(x=>x.profile==='default')?.activity?.child_metadata?.presentation_count;
  if(count!==(stage==='awakening-overlap'?3:0))throw Error('Odin layer readback mismatch '+stage);
  const image=await snap(stage+'.png');records.push({stage,status,snapshot,image,capturedAt:new Date().toISOString()});
  await fs.writeFile(path.join(dir,'capture.json'),JSON.stringify({classification:'Sequential genuine native 2x-density screenshots of isolated opt-in synthetic statuses; no model execution or continuous-frame-rate claim',records},null,2));
 }
}catch(e){failure=e;}
finally{
 try{await control('off');await sleep(6500);const status=await api('/api/plugins/profile-rail/status');if(!Array.isArray(status)||status.some(x=>x.source==='synthetic'))throw Error('Synthetic state remains');await fs.writeFile(path.join(dir,'off.json'),JSON.stringify({profiles:status.length,synthetic:0,status},null,2));console.log(JSON.stringify({off:true,profiles:status.length}));}catch(e){failure??=e;}
 await p.cdp('Emulation.clearDeviceMetricsOverride');
}
if(failure)throw failure;
if(records.length!==stages.length)throw Error('Incomplete captures');
console.log(JSON.stringify({dir,output,captures:records.length,stages},null,2));
