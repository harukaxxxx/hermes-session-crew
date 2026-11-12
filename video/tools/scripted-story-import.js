const p=(await taskSpace(64)).page('p1');
if (!(await p.url()).startsWith('http://192.168.1.100:4178/')) throw Error('Unexpected origin');
const data=[
 {profile:'heimdall',id:'sessioncrew-scripted-story-heimdall-v1',title:'Scripted demo: Nine Realms report',messages:[{role:'user',content:'Scripted demo: Give us the Nine Realms progress report.'},{role:'assistant',content:'I have checked progress across the Nine Realms. Everyone is ready — except Loki. Can someone ask him where the Rainbow Bridge acceptance report is?'}]},
 {profile:'loki',id:'sessioncrew-scripted-story-loki-v1',title:'Scripted demo: Rainbow Bridge',messages:[{role:'user',content:'Scripted demo: Heimdall is looking for you. Where is the Rainbow Bridge acceptance report?'},{role:'assistant',content:'It must be Ragnarök again. They scheduled the end of the world, but forgot to get Odin’s approval.'}]},
 {profile:'default',id:'sessioncrew-scripted-story-odin-v1',title:'Scripted demo: Ragnarök',messages:[{role:'user',content:'Scripted demo: The gods are still waiting for your command. Any longer, and Ragnarök will be nothing but twilight.'},{role:'assistant',content:"Then awaken the gods. And I'll form the head!"}]}
];
for(const s of data){
 const q=`/api/sessions/${s.id}/mutation-snapshot?profile=${s.profile}`;
 const before=await p.fetch(q); console.log('BEFORE',s.profile,before.status,before.body);
 if(!before.ok || JSON.parse(before.body).exists || JSON.parse(before.body).runtime_revision!==0) throw Error('Anchor not confirmed absent: '+s.id);
 const payload={profile:s.profile,request_id:`import-${s.id}`,expected_revision:0,sessions:[{id:s.id,title:s.title,source:'cli',messages:s.messages}]};
 const r=await p.fetch('/api/sessions/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),timeout:10000}); console.log('IMPORT',s.profile,r.status,r.body); if(!r.ok) throw Error('Import failed; do not retry blindly');
 for(const suffix of ['', '/messages']){const x=await p.fetch(`/api/sessions/${s.id}${suffix}?profile=${s.profile}`); console.log('READBACK',s.profile,suffix,x.status,x.body);if(!x.ok)throw Error('Readback failed');}
}
