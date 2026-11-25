import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const hermes=process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})();
const rootRequire=createRequire(hermes+'/package.json'), desktopRequire=createRequire(hermes+'/apps/desktop/package.json');
const require=(()=>{try{rootRequire.resolve('@vscode/codicons/dist/codicon.css');return rootRequire}catch{return desktopRequire}})();
const {chromium}=(()=>{try{return require('playwright')}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;return createRequire(desktopRequire.resolve('@playwright/test'))('playwright')}})();
const codiconCss=pathToFileURL(require.resolve('@vscode/codicons/dist/codicon.css')).href;
const browser=await chromium.launch({headless:true,executablePath:(process.env.CHROME_PATH||(()=>{throw Error('Set CHROME_PATH')})())});
try {
 for(const {width,height,count} of [{width:900,height:700,count:2},{width:900,height:700,count:8},{width:900,height:300,count:8},{width:280,height:430,count:8}]) {
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
  await page.addInitScript(n=>{window.fixtureProjects=[
   ...Array.from({length:n},(_,i)=>({id:'p'+i,label:'Project '+i+' '+('long name '.repeat(12)),path:'/fixture/project'+i,sessionIds:i===0?[]:['id0'],repos:[],icon:i===0?'rocket':null,isAuto:i===1,isNoProject:false,previewSessions:i===1?[{cwd:'/fixture/project1',git_branch:'feature/fixture-very-long-branch-name-0123456789'}]:[]})),
   {id:'__no_project__',label:'Fixture Home',isNoProject:true,sessionIds:['home-session'],repos:[]},
   {id:'auto:/fixture/empty-auto',label:'Empty auto repo',isAuto:true,path:'/fixture/empty-auto',sessionIds:[],repos:[]},
  ]},count);
  await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?office');await page.addStyleTag({url:codiconCss});
  await page.getByRole('button',{name:'Aster · 狀態 工作中'}).click();await page.waitForSelector('[data-recent-row]');await page.getByRole('button',{name:'▦ 開啟專案'}).click();
  const dialogs=page.locator('[data-slot="popover-content"]'), main=dialogs.first(), sub=dialogs.last(),rows=sub.locator('[data-project-row]'),list=sub.locator('[data-project-list]');
  await rows.first().waitFor();assert.equal(await rows.count(),count);assert.equal(await sub.getByRole('button',{name:'新增專案'}).isDisabled(),false);
  assert.match(await rows.first().locator('[data-project-name]').innerText(),/^Project 0 /);assert.match(await rows.nth(1).locator('[data-project-name]').innerText(),/^Project 1 /);assert.doesNotMatch(await list.innerText(),/Fixture Home|Empty auto repo/);
  assert.equal(await rows.first().locator('[data-project-icon]').getAttribute('data-project-icon'),'rocket');assert.equal(await rows.nth(1).locator('[data-project-icon]').getAttribute('data-project-icon'),'repo');assert.equal(await rows.first().locator('.codicon-rocket').count(),1);assert.equal(await rows.nth(1).locator('.codicon-repo').count(),1);
  assert.doesNotMatch(await sub.innerText(),/feature\/fixture|分支資訊/);assert.equal(await sub.locator('[data-project-branch]').count(),0);
  for(const control of [page.getByRole('button',{name:'快速新增'}),sub.getByRole('button',{name:'新增專案'}),rows.first().locator('[data-project-launch]')]){const icon=control.locator('.codicon-add');assert.equal(await icon.count(),1);assert.equal(await icon.evaluate(e=>getComputedStyle(e).fontSize),'12px');assert.notEqual(await icon.evaluate(e=>getComputedStyle(e,'::before').content),'none')}
  const geometry=await sub.evaluate(e=>{const l=e.querySelector('[data-project-list]'),m=document.querySelector('[data-slot="popover-content"]');return {width:e.getBoundingClientRect().width,main:m.getBoundingClientRect().width,list:l.clientHeight,scroll:l.scrollHeight,rows:[...l.children].map(x=>x.getBoundingClientRect().height),clip:[...l.querySelectorAll('[data-project-name]')].map(x=>getComputedStyle(x).textOverflow)}});
  assert.ok(Math.abs(geometry.width-geometry.main)<1);assert.ok(geometry.rows.every(h=>h===32));assert.ok(geometry.clip.every(x=>x==='ellipsis'));
  if(height===700){assert.equal(geometry.list,Math.min(count,3)*32);if(count>3)assert.ok(geometry.scroll>geometry.list)}
  await rows.first().locator('[data-project-name]').click();assert.equal(await page.evaluate(()=>window.createCalls?.length||0),0);
  await page.screenshot({path:`evidence/project-list-initial-${width}x${height}-${count}.png`});
  if(count>3){await list.hover();await page.mouse.wheel(0,1200);await page.waitForFunction(()=>{const e=document.querySelector('[data-project-list]');return e.scrollTop>0});for(const control of await rows.last().locator('button').all())assert.ok(await control.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2))}),'wheel reaches a hittable final row')}
  await page.screenshot({path:`evidence/project-list-${width}x${height}-${count}.png`});
  await page.keyboard.press('Escape');assert.equal(await dialogs.count(),1);await page.getByRole('button',{name:'▦ 開啟專案'}).click();await page.locator('[data-project-row]').first().locator('[data-project-launch]').click();await page.waitForFunction(()=>window.openCalls?.length===1);const calls=await page.evaluate(()=>({create:window.createCalls[0],open:window.openCalls[0]}));assert.equal(calls.create.route.profile,'Aster');assert.equal(calls.create.params.cwd,'/fixture/project0');assert.equal(calls.create.params.cwd_explicit,true);assert.equal(calls.open[1].route.profile,'Aster');
  console.log(JSON.stringify({width,height,count,geometry}));await page.close();
 }
 await verifyProjectMenus(browser);
 console.log('PASS controlled project list and row menus');
} finally {await browser.close()}

async function verifyProjectMenus(browser){
 const page=await browser.newPage({viewport:{width:1000,height:800},reducedMotion:'reduce'});
 const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
 try{
  await page.addInitScript(()=>{
   const project=(name)=>({id:'same-id',name,primary_path:'/fixture/'+name,color:'#bada55',icon:'rocket',folders:[{path:'/fixture/'+name,is_primary:true}]});
   const stores={Aster:{projects:[project('Local')]},Mika:{projects:[project('Explicit')]},Alias:{projects:[project('Alias owner')]}};
   window.fixtureProfileNames=['Aster','Mika','Alias'];
   window.fixtureProfileRoutes=async()=>window.fixtureProfileNames.map(profile=>({connectionId:'fixture',mode:profile==='Aster'?'local':'remote',profile,targetProfile:profile==='Alias'?'mapped':profile}));
   window.projectCalls=[];window.fixtureStores=stores;
   window.fixtureProjectRequest=async(route,method,params)=>{
    window.projectCalls.push({route,method,params});
    const bucket=stores[route.profile],p=bucket.projects.find(x=>x.id===params.id),reply=data=>structuredClone(data);
    if(method==='projects.tree')return reply({active_id:null,projects:[...bucket.projects.map(p=>({id:p.id,label:p.name,path:p.primary_path,color:p.color,icon:p.icon,isAuto:false,isNoProject:false,sessionIds:[],repos:[]})),{id:'auto:/fixture/repo',label:'Auto',path:'/fixture/repo',isAuto:true,isNoProject:false,sessionIds:['id0'],repos:[]}]});
    if(params.profile!==route.profile)throw Error('wrong wire owner');
    if(method==='projects.get'){
     if(window.holdGet)await new Promise(resolve=>{window.releaseGet=resolve});
     return reply({project:window.wrongGet?{...p,id:'slug-collision'}:p});
    }
    if(method==='projects.list'){
     if(window.failList){window.failList=false;throw Error('fixture readback failed')}
     return reply(bucket);
    }
    if(method==='projects.update'){
     for(const field of ['name','color','icon'])if(Object.hasOwn(params,field))p[field]=params[field]||null;
     if(window.loseWrite){window.loseWrite=false;throw Error('fixture lost mutation reply')}
     return reply({project:p});
    }
    if(method==='projects.delete'){bucket.projects=bucket.projects.filter(x=>x.id!==params.id);return reply(bucket)}
    throw Error('Unexpected fixture RPC '+method);
   };
   window.copied=[];window.fixtureClipboard=async path=>{if(window.failCopy)throw Error('denied');window.copied.push(path)};
   window.folderRequests=[];
   window.fixtureBridge=async request=>{
    window.folderRequests.push(request);
    if(request.path!=='/api/plugins/sessioncrew/folders'||request.method!=='POST'||request.profile!=='Aster'||request.connectionId!=='fixture')throw Error('wrong folder authority');
    const {path}=request.body;
    return {scope:path?'gateway-filesystem':'gateway-hermes-root',root:'/fixture',path:path||'/fixture',root_id:'fixture-root',directory_id:'fixture-dir',runtime_id:'fixture-runtime',directories:path?[]:['extra'],next_after:null};
   };
  });
  await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?office&locale=en');
  await page.addStyleTag({url:pathToFileURL(path.resolve('tests/sdk-css/styles.css')).href});await page.addStyleTag({url:codiconCss});
  const panels=page.locator('[data-slot="popover-content"]'),menu=page.getByRole('menu'),dialog=page.locator('[data-slot="dialog-content"]');
  const row=label=>page.locator('[data-project-row]').filter({has:page.locator('[data-project-name]',{hasText:new RegExp('^'+label+'$')})});
  const button=label=>row(label).getByRole('button',{name:'Project actions for '+label,exact:true});
  const item=name=>menu.getByRole('menuitem',{name,exact:true});
  const storedActions=['Rename','Appearance','Copy path','Delete'];
  const expectStoredActions=async()=>assert.deepEqual(await menu.getByRole('menuitem').allTextContents(),storedActions);
  const openOwner=async name=>{await page.getByRole('button',{name:new RegExp('^'+name+' · state ')}).click();await page.getByRole('button',{name:'▦ Open project'}).click()};
  const openMenu=async label=>{await button(label).click();await menu.waitFor()};
  const writes=()=>page.evaluate(()=>window.projectCalls.filter(x=>!['projects.tree','projects.get','projects.list'].includes(x.method)));
  const expectWrite=async(method,profile,patch)=>assert.deepEqual((await writes()).at(-1),{route:{connectionId:'fixture',mode:profile==='Aster'?'local':'remote',profile,targetProfile:profile},method:'projects.'+method,params:{id:'same-id',...patch,profile}});
  await openOwner('Mika');await button('Explicit').focus();await page.keyboard.press('ArrowDown');await menu.waitFor();
  await expectStoredActions();
  assert.equal(await button('Explicit').locator('.codicon-kebab-vertical').count(),1);
  assert.deepEqual(await button('Explicit').evaluate(e=>[e.offsetWidth,e.offsetHeight]),await row('Explicit').locator('[data-project-launch]').evaluate(e=>[e.offsetWidth,e.offsetHeight]));
  const menuButton=await button('Explicit').boundingBox(),plusButton=await row('Explicit').locator('[data-project-launch]').boundingBox();
  assert.ok(menuButton&&plusButton);
  assert.equal(plusButton.x-(menuButton.x+menuButton.width),2,'the kebab sits 2px to the left of the plus');
  assert.notEqual(await menu.evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
  await page.waitForFunction(()=>{
   const menu=document.querySelector('[role="menu"]'),trigger=document.querySelector('[data-project-menu][aria-expanded="true"]');
   if(!menu||!trigger)return false;
   const m=menu.getBoundingClientRect(),t=trigger.getBoundingClientRect();
   return m.width>0&&m.height>0&&m.left>=0&&m.top>=0&&m.right<=innerWidth&&m.bottom<=innerHeight&&Math.abs(m.right-t.right)<12&&Math.min(Math.abs(m.top-t.bottom),Math.abs(m.bottom-t.top))<16;
  });
  await page.screenshot({path:'evidence/project-list-kebab.png',animations:'disabled'});
  await page.keyboard.press('Enter');await dialog.waitFor();assert.match(await dialog.innerText(),/Explicit.*Mika/);assert.equal(await panels.count(),2);
  await dialog.getByRole('textbox',{name:'Project name'}).fill('Renamed');await dialog.getByRole('button',{name:'Save'}).click();await row('Renamed').waitFor();
  await expectWrite('update','Mika',{name:'Renamed'});
  await openMenu('Renamed');await item('Appearance').click();await dialog.getByRole('button',{name:'Clear icon'}).click();await dialog.getByRole('button',{name:'Clear color'}).click();await dialog.getByRole('button',{name:'Save'}).click();
  await page.waitForFunction(()=>document.querySelector('[data-project-icon="folder-library"]'));
  await expectWrite('update','Mika',{color:'',icon:''});
  await openMenu('Renamed');await item('Copy path').click();await page.waitForFunction(()=>window.copied.length===1);assert.deepEqual(await page.evaluate(()=>window.copied),['/fixture/Explicit']);
  await openMenu('Auto');assert.deepEqual(await menu.getByRole('menuitem').allTextContents(),['Copy path']);await item('Copy path').click();assert.deepEqual(await page.evaluate(()=>window.copied),['/fixture/Explicit','/fixture/repo']);
  await page.evaluate(()=>{window.failCopy=true});await openMenu('Auto');await item('Copy path').click();await page.getByText('Could not copy the project path.').waitFor();await page.evaluate(()=>{window.failCopy=false});
  await openMenu('Renamed');await page.keyboard.press('Escape');assert.equal(await panels.count(),2);await page.waitForFunction(()=>document.activeElement?.matches('[data-project-menu]'));
  assert.equal(await page.evaluate(()=>window.fixtureScope().profile),'Aster');
  const rename=async next=>{await openMenu('Renamed');await item('Rename').click();await dialog.getByRole('textbox',{name:'Project name'}).fill(next);await dialog.getByRole('button',{name:'Save'}).click()};
  await page.evaluate(()=>{window.wrongGet=true});await rename('Wrong target');await page.getByText(/No change was sent/).waitFor();assert.equal((await writes()).length,2);
  await page.evaluate(()=>{window.wrongGet=false;window.loseWrite=true});await rename('Recovered');
  await page.getByText(/Could not confirm the change/).waitFor();const check=page.getByRole('button',{name:'Check change status'});
  await check.click();await row('Recovered').waitFor();assert.equal((await writes()).length,3);
  await openMenu('Recovered');await item('Delete').click();assert.match(await dialog.innerText(),/Recovered.*Mika.*not the folders or conversations/);await dialog.getByRole('button',{name:'Cancel'}).click();assert.equal((await writes()).length,3);
  await openMenu('Recovered');await item('Delete').click();await page.evaluate(()=>{window.failList=true});await dialog.getByRole('button',{name:'Delete',exact:true}).click();
  await page.getByText(/acknowledged, but the project list/).waitFor();await check.click();await row('Recovered').waitFor({state:'detached'});await expectWrite('delete','Mika',{});
  assert.deepEqual(await page.evaluate(()=>window.fixtureStores.Mika.projects),[]);
  await page.getByRole('button',{name:'Close panel'}).click();await openOwner('Alias');await openMenu('Alias owner');await expectStoredActions();
  for(const name of ['Rename','Appearance','Delete']){assert.equal(await item(name).isDisabled(),true);assert.match(await item(name).getAttribute('aria-description'),/owner could not be verified/)}
  assert.equal(await item('Copy path').isEnabled(),true);assert.equal(await item('Copy path').getAttribute('aria-description'),null);
  const aliasCalls=()=>page.evaluate(()=>window.projectCalls.filter(x=>x.route.profile==='Alias'));
  const beforeCopy=await aliasCalls();await item('Copy path').click();await page.waitForFunction(()=>window.copied.length===3);
  assert.deepEqual(await page.evaluate(()=>window.copied),['/fixture/Explicit','/fixture/repo','/fixture/Alias owner']);assert.deepEqual(await aliasCalls(),beforeCopy);
  await page.getByRole('button',{name:'Close panel'}).click();await openOwner('Aster');await openMenu('Local');await expectStoredActions();
  for(const name of storedActions)assert.equal(await item(name).isEnabled(),true);
  await page.keyboard.press('Escape');assert.deepEqual(await page.evaluate(()=>window.folderRequests),[]);
  await page.getByRole('button',{name:'New project',exact:true}).click();await dialog.getByRole('button',{name:'Browse folders'}).click();
  const browserDialog=dialog.filter({has:page.locator('[data-folder-browser]')});
  await browserDialog.getByRole('button',{name:'extra',exact:true}).click();await browserDialog.getByRole('button',{name:'Select current folder',exact:true}).click();
  await dialog.getByText('/fixture/extra',{exact:true}).waitFor();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>window.folderRequests.map(({profile,connectionId,body})=>[profile,connectionId,body.path??null])),[['Aster','fixture',null],['Aster','fixture','/fixture/extra']]);
  assert.deepEqual(await page.evaluate(()=>window.fixtureStores.Aster.projects[0].folders),[{path:'/fixture/Local',is_primary:true}]);
  await page.evaluate(()=>{window.holdGet=true});await openMenu('Local');await item('Rename').click();await dialog.getByRole('textbox',{name:'Project name'}).fill('Stale write');await dialog.getByRole('button',{name:'Save'}).click();
  await page.waitForFunction(()=>typeof window.releaseGet==='function');await page.evaluate(()=>{window.fixtureSetActivation(2);window.releaseGet()});
  await openMenu('Local');assert.equal(await item('Rename').isEnabled(),true);assert.equal((await writes()).length,4);
  assert.deepEqual(await page.evaluate(()=>[window.createCalls||[],window.openCalls||[]]),[[],[]]);
  assert.deepEqual(pageErrors,[]);
 }finally{await page.close()}
}
