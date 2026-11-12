const fs=await import('node:fs/promises');
const root='/Users/haruka/.hermes/profiles/shirogane-yuine/workspace/hermes-session-crew-demo/video/capture/story-v2-after-restart';await fs.mkdir(root,{recursive:true});
const p=(await taskSpace(78)).page('p1'); if(!(await p.url()).startsWith('http://192.168.1.100:4178/'))throw Error('origin');
const data=[
{profile:'heimdall',name:'heimdall',title:'Nine Realms — Readiness Report',messages:[{role:'user',content:'Give us the Nine Realms progress report.'},{role:'assistant',content:'I have checked progress across the Nine Realms. Everyone is ready — except Loki. Can someone ask him where the Rainbow Bridge acceptance report is?'}]},
{profile:'loki',name:'loki',title:'Rainbow Bridge — Missing Approval',messages:[{role:'user',content:'Heimdall is looking for you. Where is the Rainbow Bridge acceptance report?'},{role:'assistant',content:'It must be Ragnarök again. They scheduled the end of the world, but forgot to get Odin’s approval.'}]},
{profile:'default',name:'odin',title:'Ragnarök — Awaken the Gods',messages:[{role:'user',content:'The gods are still waiting for your command. Any longer, and Ragnarök will be nothing but twilight.'},{role:'assistant',content:"Then awaken the gods. And I'll form the head!"}]}];
for(const s of data){
 const id=`sessioncrew-scripted-story-${s.name}-v2`, file=`${root}/${s.name}-import.json`;
 const receipt={classification:'scripted synthetic dialogue; not model execution',id,expected:s};
 // A previous receipt means a prior run may already have submitted this request.
 try{await fs.access(file);console.log(JSON.stringify({id,skipped:'receipt already exists'}));continue}catch(e){if(e.code!=='ENOENT')throw e}
 const get=async path=>{const r=await p.fetch(path,{timeout:10000});return {status:r.status,body:r.body}};
 const base=`/api/sessions/${id}`, query=`?profile=${s.profile}`;
 try{
  receipt.before=await get(`${base}/mutation-snapshot${query}`);
  if(receipt.before.status!==200)throw Error('before snapshot failed');
  const before=JSON.parse(receipt.before.body);
  if(before.session_id!==id || typeof before.exists!=='boolean' || !Number.isInteger(before.runtime_revision))throw Error('invalid snapshot');
  if(!before.exists){
   const payload={profile:s.profile,request_id:`import-${id}`,expected_revision:before.runtime_revision,sessions:[{id,title:s.title,source:'cli',messages:s.messages}]};
   receipt.payload=payload;
   // Persist intent first: interruption must not permit an accidental duplicate attempt.
   await fs.writeFile(file,JSON.stringify({...receipt,attempt:'starting'},null,2),{flag:'wx'});
   try{const r=await p.fetch('/api/sessions/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),timeout:10000});receipt.imported={status:r.status,body:r.body}}catch(e){receipt.importError=String(e)}
  }else receipt.skipped='existing session: no overwrite';
  try{receipt.after=await get(`${base}/mutation-snapshot${query}`)}catch(e){receipt.afterError=String(e)}
  if(before.exists || (receipt.after?.status===200 && JSON.parse(receipt.after.body).exists)){
   for(const suffix of ['', '/messages'])try{receipt[suffix||'session']=await get(`${base}${suffix}${query}`)}catch(e){receipt[suffix||'session']={error:String(e)}}
  }
 }catch(e){receipt.error=String(e)}
 await fs.writeFile(file,JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}
