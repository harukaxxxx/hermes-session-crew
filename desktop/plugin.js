import * as sdk from '@hermes/plugin-sdk'
import { host, useValue, useQuery, Popover, PopoverContent, PopoverTrigger } from '@hermes/plugin-sdk'
import { useState, useEffect, useRef, useCallback, useSyncExternalStore, createContext, useContext } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
const s={rail:{height:'100%',width:50,overflowY:'auto',display:'flex',flexDirection:'column',alignItems:'center',gap:10,paddingTop:18},hit:{width:45,height:37,padding:0,border:0,background:'transparent',cursor:'pointer',color:'var(--ui-text-primary)'},avatar:{width:34,height:34,borderRadius:'22%',border:'2px solid var(--ui-stroke-secondary)',objectFit:'cover',display:'grid',placeItems:'center'},bubble:{zIndex:50,width:310,maxWidth:'calc(100vw - 24px)',maxHeight:'min(360px, calc(100vh - 24px))',display:'flex',flexDirection:'column',padding:16,borderRadius:12,border:'1px solid var(--ui-stroke-secondary)',background:'var(--ui-bg-elevated)',color:'var(--ui-text-primary)'},quote:{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',color:'var(--ui-text-secondary)',fontSize:11,margin:'4px 0 0'},sessions:{overflowY:'auto',minHeight:35,flex:'1 1 auto',color:'var(--ui-text-secondary)'},footer:{display:'flex',justifyContent:'space-between',gap:8,marginTop:8,flexShrink:0},button:{color:'var(--ui-text-secondary)',background:'transparent',border:'1px solid var(--ui-stroke-secondary)',borderRadius:6,padding:'6px 8px'}}
function displayName(p){
 const trim=v=>typeof v==='string'?v.trim():''
 const title=trim(p?.ui_meta?.['hermes-bots']?.title)||trim(p?.title)||trim(p?.bot_title)
 if(title) return title
 const display=trim(p?.display_name)
 if(display) return display
 const name=trim(p?.name)
 if(name.toLowerCase()==='default') return 'Hermes'
 return name.replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
}
const scopeError=e=>/^invalid params for session\.list: scope: Extra inputs are not permitted(?: — the client and the Hermes backend are out of sync \(different versions\); run `hermes update` and restart both)?$/i.test(typeof e==='string'?e:e?.message||e?.detail||'')
const DEADLINE=30000
function bounded(task,label){
 let timer
 return Promise.race([Promise.resolve().then(task),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+'逾時')),DEADLINE)})]).finally(()=>clearTimeout(timer))
}
async function requestOwner(owner,method,params){
 if(typeof host.requestProfile==='function') return bounded(()=>host.requestProfile(owner.route,method,params,DEADLINE,{spawnPriority:'foreground'}),method)
 if(host.state.connectionId.get()===owner.connectionId && host.state.profile.get()===owner.name && typeof host.request==='function') return bounded(()=>host.request(method,params),method)
 throw new Error('此版本不支援讀取其他設定檔')
}
async function recentData(owner){
 let result
 try { result=await requestOwner(owner,'session.list',{limit:200,scope:'stored'}); if(result?.error) throw result.error }
 catch(e){if(!scopeError(e)) throw e;result=await requestOwner(owner,'session.list',{limit:200})}
 if(result?.error || !Array.isArray(result?.sessions) || (result.scope!=null && result.scope!=='stored')) throw new Error('工作階段回應格式不支援')
 // Canonical stored history excludes open canonical sessions; legacy has no scope.
 let sessions=result.sessions
 if(result.scope==='stored'){
  const live=await requestOwner(owner,'session.list',{limit:200,scope:'live'})
  if(live?.error || live?.scope!=='live' || !Array.isArray(live.sessions)) throw new Error('即時工作階段回應格式不支援')
  sessions=[...live.sessions,...sessions]
 }
 // Both supported stored-list implementations return MRU order but omit the
 // activity timestamp. started_at is creation time, not a sorting substitute.
 const seen=new Set(), rows=sessions.filter(x=>typeof x?.id==='string'&&x.id&&!seen.has(x.id)&&seen.add(x.id)).slice(0,200).map(x=>({id:x.id,title:typeof x.title==='string'?x.title:'',last_active:x.last_active,updated_at:x.updated_at,started_at:x.started_at}))
 return {rows}
}
async function projectData(owner){
 const tree=await requestOwner(owner,'projects.tree',{session_limit:2000,preview_limit:1})
 if(tree?.error || !Array.isArray(tree?.projects)) throw new Error('專案回應格式不支援')
 const projects=new Map()
 for(const p of tree.projects){const label=p.isNoProject?'主頁':typeof p.label==='string'&&p.label.trim()?p.label:'未分類';for(const id of p.sessionIds||[]) if(typeof id==='string'&&!projects.has(id)) projects.set(id,label);for(const repo of p.repos||[]) for(const group of repo.groups||[]) for(const row of group.sessions||[]) if(typeof row.id==='string'&&!projects.has(row.id)) projects.set(row.id,label)}
 return {labels:Object.fromEntries(projects),choices:tree.projects.filter(p=>!p.isNoProject&&Array.isArray(p.sessionIds)&&p.sessionIds.some(id=>typeof id==='string'&&id)).map(p=>{const path=typeof p.path==='string'&&p.path.trim()?p.path.trim():(p.repos||[]).find(r=>typeof r.path==='string'&&r.path.trim())?.path?.trim()||'';return {id:p.id,label:p.label||p.id||'未命名專案',path,icon:typeof p.icon==='string'&&p.icon.trim()?p.icon.trim():'',color:typeof p.color==='string'?p.color:'',isAuto:!!p.isAuto}})}
}
function routeFor(name,connectionId,activeProfile,routes){
 if(routes===null){if(connectionId==null) return name;throw Error('此版本不支援連線路由')}
 if(!Array.isArray(routes)) throw Error('路由清單格式不支援')
 const valid=routes.filter(r=>r && typeof r.connectionId==='string'&&r.connectionId.trim()&&typeof r.profile==='string'&&r.profile.trim()&&typeof r.targetProfile==='string'&&r.targetProfile.trim()&&['local','remote'].includes(r.mode))
 let source=connectionId
 if(source==null){const primary=valid.filter(r=>r.mode==='local'&&r.profile===activeProfile&&r.primary===true);if(primary.length===1) source=primary[0].connectionId;else {const local=[...new Set(valid.filter(r=>r.mode==='local'&&r.profile===activeProfile).map(r=>r.connectionId))];if(local.length===1) source=local[0]}}
 const matches=valid.filter(r=>r.connectionId===source&&r.profile===name)
 if(matches.length!==1) throw Error('找不到唯一的設定檔路由')
 return matches[0]
}
async function openOwned(owner,id){
 if(typeof host.openSession!=='function') throw Error('此版本不支援開啟工作階段')
 if(typeof owner.route==='string'){
  if(host.state.connectionId.get()!==owner.connectionId || host.state.profile.get()!==owner.name) throw Error('此版本只能開啟目前設定檔')
  return host.openSession(id,{profile:owner.name,intent:'in-place'})
 }
 return host.openSession(id,{route:owner.route,intent:'in-place'})
}
function Recent({owner,phase,retryRoutes,onOpened,completion}){
 const [count,setCount]=useState(3),[generation,setGeneration]=useState(0),[projectGeneration,setProjectGeneration]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),rowLock=useRef(false)
 async function open(id){if(rowLock.current)return;rowLock.current=true;setBusy(true);setError('');const watermark=completion.watermark(owner,id);try{await openOwned(owner,id);await completion.ack(owner,id,watermark);onOpened()}catch(e){setError('開啟失敗：'+(e?.message||'未知錯誤')+'，請再試一次')}finally{rowLock.current=false;setBusy(false)}}
 const route=owner?.route, key=[owner?.connectionId,owner?.name,typeof route==='string'?'legacy':route?.connectionId,route?.profile,route?.targetProfile,route?.mode]
 const q=useQuery({queryKey:['profile-rail','recent',...key,generation],queryFn:()=>recentData(owner),enabled:!!owner,retry:false,refetchOnMount:'always',refetchOnWindowFocus:true,refetchInterval:15000})
 const projects=useQuery({queryKey:['profile-rail','projects',...key,projectGeneration],queryFn:()=>projectData(owner),enabled:!!owner,retry:false})
 if(!owner) return jsxs('div',{style:s.sessions,children:[jsx('span',{children:phase==='loading'?'正在尋找設定檔路由…':phase||'連線尚未準備好'}),phase!=='loading'?jsx('button',{onClick:retryRoutes,children:'重試'}):null]})
 if(q.isPending) return jsx('div',{style:s.sessions,children:q.fetchStatus==='idle'?'連線尚未準備好':'載入工作階段…'})
 if(q.isError) return jsxs('div',{style:s.sessions,children:[jsx('span',{children:'工作階段無法載入：'+(q.error?.message||'未知錯誤')}),jsx('button',{onClick:()=>setGeneration(n=>n+1),children:'重試'})]})
 if(!q.data.rows.length) return jsx('div',{style:s.sessions,children:'沒有工作階段'})
 const ellipsis={whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',minWidth:0}
 const projectLabel=id=>projects.isError?'專案無法載入':projects.isPending?'專案載入中…':projects.data?.labels?.[id]||'未分類'
 return jsxs('div',{style:{minHeight:0,display:'flex',flexDirection:'column',flex:'1 1 auto',marginTop:12},children:[jsx('div',{'data-recent-list':true,style:{...s.sessions,maxHeight:260,overflowY:'auto'},children:q.data.rows.slice(0,count).map(row=>jsxs('button',{'data-recent-row':true,type:'button',disabled:busy,onClick:()=>open(row.id),style:{position:'relative',height:52,boxSizing:'border-box',minWidth:0,width:'100%',display:'flex',alignItems:'center',gap:10,textAlign:'left',color:'inherit',border:0,borderRadius:7,padding:'9px 8px',background:'transparent',cursor:'pointer'},children:[completion.watermark(owner,row.id).length?jsx('span',{'data-session-completion-badge':true,role:'img','aria-label':'完成後尚未閱讀',style:{position:'absolute',top:0,left:0,fontSize:10,lineHeight:1,pointerEvents:'none'},children:'✋'}):null,jsxs('span',{style:{minWidth:0,flex:'1 1 auto'},children:[jsx('strong',{style:{...ellipsis,display:'block',fontSize:12,color:'var(--ui-text-primary)'},title:row.title||'未命名',children:row.title||'未命名'}),jsx('span',{style:{...ellipsis,display:'block',fontSize:11,marginTop:4},title:projectLabel(row.id),children:'▧ '+projectLabel(row.id)})]}),jsx('span',{'aria-hidden':true,children:'›'})]},row.id))}),error?jsx('div',{role:'alert',children:error}):null,projects.isError?jsx('button',{onClick:()=>setProjectGeneration(n=>n+1),children:'重試專案'}):null,count<q.data.rows.length?jsx('button',{'data-recent-more':true,type:'button',onClick:()=>setCount(n=>n+10),style:{...s.button,alignSelf:'center',border:0,padding:'0 8px',height:18,lineHeight:'18px',flexShrink:0},'aria-label':'顯示更多工作階段',children:'⋯'}):null,q.data.rows.length>=200?jsx('small',{children:'最多顯示已取得的 200 筆'}):null]})
}
function FolderBreadcrumbs({root,path,busy,go}){
 if(!root)return jsx('span',{children:'載入根目錄…'})
 const parts=path.split('/').filter(Boolean)
 return jsxs('nav',{'aria-label':'資料夾階層',className:'shrink-0 flex flex-wrap items-center gap-1 border-b border-border/50 px-3 py-2 text-xs text-muted-foreground',children:[jsx('button',{type:'button',disabled:busy,onClick:()=>go('/'),className:'rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground',children:'/'}),...parts.map((part,i)=>jsx('button',{type:'button',disabled:busy,onClick:()=>go('/'+parts.slice(0,i+1).join('/')),className:'rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground',children:part},i))]})
}
function FolderBrowser({rest,valid,onCancel,onSelect,mkdirUnknown}){
 const [path,setPath]=useState(''),[items,setItems]=useState([]),[root,setRoot]=useState(null),[cursor,setCursor]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[directoryId,setDirectoryId]=useState(''),[folderName,setFolderName]=useState(null),[folderError,setFolderError]=useState(''),[creating,setCreating]=useState(false),[refreshPath,setRefreshPath]=useState(null)
 const seq=useRef(0),alive=useRef(false),rootRef=useRef(null),createLock=useRef(false)
 useEffect(()=>{alive.current=true;return ()=>{alive.current=false;seq.current++}},[])
 async function load(next,after=null){
  const n=++seq.current;setBusy(true);setError('');setFolderName(null)
  try{
   if(!valid()||typeof rest!=='function')throw Error('目前連線的後端不可用')
   const data=await rest('/folders',{method:'POST',body:next===null?{}:{path:next,after,limit:50},timeoutMs:30000})
   if(!alive.current||n!==seq.current||!valid())return
   const absolute=p=>typeof p==='string'&&p.startsWith('/')&&(p==='/'||(!p.endsWith('/')&&!p.split('/').slice(1).some(x=>x==='.'||x==='..'||!x)))
   if(!data||data.scope!==(next===null?'gateway-hermes-root':'gateway-filesystem')||!absolute(data.root)||!absolute(data.path)||(next!==null&&data.path!==next)||(next===null&&data.path!==data.root)||typeof data.root_id!=='string'||!data.root_id||typeof data.directory_id!=='string'||!data.directory_id||!Array.isArray(data.directories)||data.directories.some(x=>typeof x!=='string'||!x||x==='.'||x==='..'||/[\\/]/.test(x))||!(data.next_after===null||typeof data.next_after==='string'))throw Error('資料夾回應格式不支援')
   if(rootRef.current&&(rootRef.current.id!==data.root_id||rootRef.current.path!==data.root))throw Error('後端根目錄已變更，請重新開啟瀏覽器')
   rootRef.current={id:data.root_id,path:data.root};setRoot(rootRef.current);setPath(data.path);setItems(old=>after?[...old,...data.directories]:data.directories);setCursor(data.next_after);setDirectoryId(data.directory_id);setRefreshPath(null)
  }catch(e){if(alive.current&&n===seq.current)setError('資料夾無法載入：'+(e?.message||'未知錯誤'))}finally{if(alive.current&&n===seq.current)setBusy(false)}
 }
 useEffect(()=>{void load(null)},[])
 async function createFolder(){
  const name=(folderName||'').trim();if(createLock.current||mkdirUnknown.current||!directoryId||!valid())return
  if(!name||name==='.'||name==='..'||/[\\/\0]/.test(name)||name.length>255){setFolderError('請輸入有效的資料夾名稱');return}
  createLock.current=true;setCreating(true);setFolderError('');mkdirUnknown.current=true
  try{const result=await rest('/folders/mkdir',{method:'POST',body:{path,name,root_id:root.id,parent_id:directoryId},timeoutMs:30000});if(!result||result.root_id!==root.id||result.parent_id!==directoryId||result.name!==name||result.path!==(path==='/'?'':path)+'/'+name||typeof result.directory_id!=='string'||!result.directory_id)throw Error('回應格式不支援');mkdirUnknown.current=false;if(alive.current&&valid()){setRefreshPath(path);await load(path)}}
  catch(e){if(alive.current)setFolderError('建立結果未知，請先核對資料夾；不可自動重試。 '+(e?.message||''))}finally{createLock.current=false;if(alive.current)setCreating(false)}
 }
 const D=sdk.Dialog,C=sdk.DialogContent,T=sdk.DialogTitle,Desc=sdk.DialogDescription,B=sdk.Button,G=sdk.Codicon,I=sdk.Input
 const row=(name,disabled,onClick)=>jsxs('button',{type:'button',disabled,onClick,className:'row-hover flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-(--ui-text-secondary) hover:text-foreground disabled:pointer-events-none disabled:opacity-40',children:[jsx(G,{name:'folder',size:'0.875rem','aria-hidden':true}),jsx('span',{className:'min-w-0 truncate',children:name})]},name)
 return jsx(D,{open:true,onOpenChange:open=>{if(!open)onCancel()},children:jsxs(C,{className:'h-[min(36rem,calc(100vh-4rem))] max-w-lg',bodyClassName:'flex min-h-0 flex-col gap-0 overflow-hidden p-0',onInteractOutside:e=>e.preventDefault(),onEscapeKeyDown:e=>{if(folderName!==null){e.preventDefault();setFolderName(null);setFolderError('')}},children:[jsxs('div',{className:'shrink-0 border-b border-border/70 px-4 py-3',children:[jsx(T,{className:'text-sm',children:'選擇資料夾'}),jsx(Desc,{className:'mt-1 text-xs',children:'瀏覽目前 gateway 後端可存取的資料夾；不是此裝置的本機檔案系統。'})]}),jsxs('div',{className:'flex min-h-0 flex-1 flex-col','data-folder-browser':true,children:[jsx(FolderBreadcrumbs,{root,path,busy:busy||creating,go:load}),jsxs('div',{className:'min-h-0 flex-1 overflow-y-auto p-2',children:[row('..',busy||creating||!path||path==='/',()=>load(path.slice(0,path.lastIndexOf('/'))||'/')),folderName!==null?jsxs('div',{className:'px-2 py-1',children:[jsxs('div',{className:'flex items-center gap-2',children:[jsx(G,{name:'new-folder',size:'0.875rem'}),jsx(I,{'aria-label':'資料夾名稱',autoFocus:true,disabled:creating,value:folderName,onChange:e=>{setFolderName(e.target.value);setFolderError('')},onKeyDown:e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();void createFolder()}},size:'sm'}),jsx(B,{'aria-label':'建立資料夾',type:'button',disabled:creating||mkdirUnknown.current,onClick:createFolder,size:'icon-xs',variant:'ghost',children:jsx(G,{name:creating?'loading':'check',size:'0.875rem',spinning:creating})})]}),folderError?jsx('div',{role:'alert',className:'mt-1 pl-6 text-xs text-destructive',children:folderError}):null]}):null,...items.map(name=>row(name,busy||creating,()=>load((path==='/'?'':path)+'/'+name))),cursor?jsx(B,{type:'button',variant:'ghost',disabled:busy||creating,onClick:()=>load(path,cursor),children:'載入更多'}):null,error?jsx('div',{role:'alert',children:error}):null]})]}),jsxs('div',{className:'shrink-0 flex items-center justify-between gap-2 border-t border-border/70 px-4 py-3',children:[jsx('div',{className:'min-w-0 truncate text-xs text-muted-foreground',children:path}),jsxs('div',{className:'flex shrink-0 items-center gap-2',children:[jsx(B,{type:'button',size:'sm',variant:'ghost',disabled:!directoryId||busy||creating||folderName!==null||!!error||mkdirUnknown.current,onClick:()=>setFolderName(''),title:mkdirUnknown.current?'建立結果未知，請先核對':'',children:jsxs('span',{children:[jsx(G,{name:'new-folder',size:'0.875rem'}),'新增資料夾']})}),jsx(B,{type:'button',size:'sm',variant:'ghost',onClick:onCancel,children:'取消'}),jsx(B,{type:'button',size:'sm',disabled:busy||creating||!root||!!error||!valid(),onClick:()=>onSelect({path,rootId:root.id}),children:'選取目前資料夾'})]})]}),refreshPath&&error?jsx(B,{type:'button',disabled:busy,onClick:()=>load(refreshPath),children:'重試刷新'}):mkdirUnknown.current?jsx('small',{className:'px-4 pb-2 text-destructive',children:'建立結果未知，請先核對；不可重試。'}):null]})})
}
const DialogRestContext=createContext(null)
function ProjectDialog({owner:ownerProp,ownerName,isCurrent,onClose,onCreated,onRefresh,unknownProjects}){
 const dialogRest=useContext(DialogRestContext)
 const [owner]=useState(()=>({...ownerProp,route:Object.freeze({...ownerProp.route})}))
 const [name,setName]=useState(''),[paths,setPaths]=useState([]),[browsing,setBrowsing]=useState(false),[scopeLost,setScopeLost]=useState(false),[idea,setIdea]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[generating,setGenerating]=useState(false),[created,setCreated]=useState(null),[refreshFailed,setRefreshFailed]=useState(false),[round,setRound]=useState(0)
 const mkdirUnknown=useRef(false),alive=useRef(true),lock=useRef(false),generation=useRef(false),route=owner.route,unknownKey=JSON.stringify([route.connectionId,route.targetProfile])
 useEffect(()=>{alive.current=true;return ()=>{alive.current=false}},[])
 const activation=typeof sdk.useGatewayActivationEpoch==='function'?sdk.useGatewayActivationEpoch():null
 const [scope]=useState(()=>({connection:host.state.connectionId.get(),profile:host.state.profile.get(),epoch:typeof sdk.gatewayActivationEpoch==='function'?sdk.gatewayActivationEpoch():null})),lost=useRef(false)
 const scopeValid=()=>!lost.current&&isCurrent()&&typeof scope.connection==='string'&&typeof host.activeConnectionId==='function'&&host.activeConnectionId()===scope.connection&&typeof scope.epoch==='number'&&sdk.gatewayActivationEpoch()===scope.epoch&&scope.connection===owner.connectionId&&scope.connection===owner.route.connectionId&&host.state.connectionId.get()===scope.connection&&host.state.profile.get()===scope.profile
 useEffect(()=>{const check=()=>{if(host.state.connectionId.get()!==scope.connection||host.state.profile.get()!==scope.profile){lost.current=true;setScopeLost(true);setPaths([]);setBrowsing(false)}};const a=host.state.connectionId.subscribe(check),b=host.state.profile.subscribe(check);return ()=>{a();b()}},[])
 useEffect(()=>{if(activation!==scope.epoch){lost.current=true;setScopeLost(true);setPaths([]);setBrowsing(false)}},[activation])
 const visible=()=>alive.current&&isCurrent()
 const groups=[['📝 筆記','打造一個整理筆記的工具'],['🌱 習慣','建立簡單的習慣追蹤工具'],['📚 學習','製作學習資源整理工具'],['🎨 創作','建立創作靈感收集工具'],['🗺️ 探索','建立探索和分享地點的工具'],['🧰 工具','製作解決日常問題的小工具']]
 async function generate(){if(generation.current||lock.current)return;generation.current=true;setGenerating(true);setError('');try{const res=await requestOwner(owner,'llm.oneshot',{instructions:'You generate a single, concrete project idea as a short IDEA.md body: a one-line summary, then 3-5 bullet goals. No preamble, no code fences, under 120 words.',input:name.trim()?`Project name: ${name.trim()}`:'Surprise me with a fun project.',temperature:1.0});if(res?.error)throw Error(res.error.message||String(res.error));if(typeof res?.text!=='string'||!res.text.trim())throw Error('生成回應沒有內容');if(visible())setIdea(res.text.trim())}catch(e){if(visible())setError('點子生成失敗：'+(e?.message||'未知錯誤'))}finally{generation.current=false;if(visible())setGenerating(false)}}
 async function refresh(project){try{await projectData(owner);await onRefresh();if(visible()){setRefreshFailed(false);setError('')}}catch(e){if(visible()){setRefreshFailed(true);setError('已建立 '+project.id+'，專案清單刷新失敗：'+(e?.message||'未知錯誤')+'；重試只會刷新，不會重建。')}}}
 async function submit(){if(lock.current||generation.current||!visible()||!scopeValid()||unknownProjects.current.has(unknownKey))return;const folders=paths.map(x=>x.path);if(!name.trim()||!folders.length){setError('請輸入名稱並選擇至少一個資料夾');return}lock.current=true;setBusy(true);setError('');unknownProjects.current.add(unknownKey);try{const result=await requestOwner(owner,'projects.create',{name:name.trim(),folders,primary_path:folders[0],use:false});if(result?.error)throw Error(result.error.message||result.error.detail||String(result.error));const p=result?.project;if(!p||typeof p.id!=='string'||!p.id)throw Error('建立回應缺少專案 ID，結果未知');unknownProjects.current.delete(unknownKey);const project={id:p.id,label:p.name||name.trim(),path:p.primary_path||folders[0],icon:p.icon||'',color:p.color||''};onCreated(project);if(visible())setCreated(project);await refresh(project)}catch(e){if(visible())setError(unknownProjects.current.has(unknownKey)?'建立結果未知，請先核對正確設定檔的原生專案清單；重新載入會清除記憶體防護。 '+(e?.message||''): '建立失敗：'+(e?.message||'未知錯誤'))}finally{lock.current=false;if(visible())setBusy(false)}}
 async function retryRefresh(){if(lock.current||!created)return;lock.current=true;setBusy(true);setError('');try{await refresh(created)}finally{lock.current=false;if(visible())setBusy(false)}}
 const D=sdk.Dialog,C=sdk.DialogContent,H=sdk.DialogHeader,T=sdk.DialogTitle,Desc=sdk.DialogDescription,F=sdk.DialogFooter,B=sdk.Button,I=sdk.Input,A=sdk.Textarea,G=sdk.Codicon
 return jsxs('div',{children:[jsx(D,{open:true,onOpenChange:open=>{if(!open)onClose()},children:jsxs(C,{className:'max-w-md',onInteractOutside:e=>e.preventDefault(),children:[jsxs(H,{children:[jsx(T,{children:'新增專案（'+ownerName+'）'}),jsx(Desc,{children:'建立屬於所選設定檔的專案；不切換目前設定檔或專案。'})]}),jsxs('div',{style:{display:'flex',flexDirection:'column',gap:8},children:[jsx(I,{'aria-label':'專案名稱',placeholder:'專案名稱',value:name,disabled:busy||!!created,onChange:e=>setName(e.target.value)}),jsx('span',{children:'資料夾（第一個為主要資料夾）'}),...paths.map((item,index)=>jsxs('div',{className:'flex items-center gap-2 rounded-md bg-(--ui-control-hover-background) px-2 py-1 text-[0.75rem]',children:[jsx(G,{name:'folder',size:'0.75rem',className:'shrink-0 text-(--ui-text-tertiary)'}),jsx('span',{className:'min-w-0 flex-1 truncate',title:item.path,children:item.path}),index===0?jsx('span',{className:'shrink-0 text-[0.625rem] uppercase text-(--ui-text-quaternary)',children:'主要'}):null,jsx(B,{type:'button',variant:'ghost',size:'icon-xs',className:'size-5 shrink-0 text-(--ui-text-quaternary) hover:text-foreground',disabled:busy||!!created,'aria-label':'移除 '+item.path,onClick:()=>setPaths(old=>old.filter(x=>x.path!==item.path)),children:jsx(G,{name:'close',size:'0.75rem'})})]},item.path)),jsx(B,{type:'button',disabled:busy||!!created||!dialogRest||!scopeValid(),onClick:()=>setBrowsing(true),children:'瀏覽資料夾'}),!dialogRest||scopeLost||!scopeValid()?jsx('small',{children:'目前連線的資料夾後端不可用；請重新開啟並確認連線。'}):null,jsxs('div',{style:{display:'flex',flexDirection:'column',gap:6},children:[jsx('span',{children:'專案點子'}),jsx(A,{'aria-label':'專案點子',value:idea,disabled:generating,onChange:e=>setIdea(e.target.value)}),jsx('small',{children:'點子不會寫入 IDEA.md；請在關閉前複製文字。'}),jsx(B,{type:'button',disabled:busy||generating,onClick:generate,children:generating?'生成中…':'生成點子（使用所選設定檔的 LLM）'}),jsxs('div',{style:{display:'flex',flexWrap:'wrap',gap:4},children:[...Array.from({length:3},(_,i)=>groups[(round+i)%groups.length]).map(([label,text])=>jsx(B,{type:'button',variant:'ghost',disabled:busy||generating,onClick:()=>setIdea(text),children:label},label)),jsx(B,{type:'button',variant:'ghost','aria-label':'重新整理點子建議',onClick:()=>setRound(n=>(n+3)%groups.length),children:jsx(G,{name:'refresh',size:'0.75rem'})})]})]}),created?jsx('div',{children:'已建立專案：'+created.label+'（'+created.id+'）'}):null,error?jsx('div',{role:'alert',children:error}):null,jsxs(F,{children:[jsx(B,{type:'button',variant:'ghost',onClick:onClose,children:created?'關閉':'取消'}),refreshFailed?jsx(B,{type:'button',disabled:busy,onClick:retryRefresh,children:'重試刷新'}):!created?jsx(B,{type:'button',disabled:busy||generating||!paths.length||!scopeValid()||unknownProjects.current.has(unknownKey),onClick:submit,children:busy?'建立中…':'建立'}):null]})]})]})}),browsing?jsx(FolderBrowser,{rest:dialogRest,valid:scopeValid,mkdirUnknown,onCancel:()=>setBrowsing(false),onSelect:item=>{if(!scopeValid())return;if(paths.length&&paths[0].rootId!==item.rootId){setError('後端根目錄已變更，請重新開啟對話框');return}setPaths(old=>old.some(x=>x.path===item.path)?old:[...old,item]);setName(old=>old.trim()||item.path.split('/').filter(Boolean).pop()||old);setBrowsing(false)}}):null]})
}
function Launchers({owner,ownerName,isCurrent,onOpened,pending,projectOpen,setProjectOpen,createdProjects,dialogActive,unknownProjects}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[projectGeneration,setProjectGeneration]=useState(0),[dialogOpen,setDialogOpen]=useState(false),lock=useRef(false),projectTrigger=useRef(null),[projectLayout,setProjectLayout]=useState({side:'bottom',maxHeight:220})
 useEffect(()=>{if(!projectOpen)return;const update=()=>{const r=projectTrigger.current?.closest('[data-slot="popover-content"]')?.getBoundingClientRect();if(!r)return;const desired=Math.min(220,innerHeight*.325-7.5),available=Math.max(0,Math.max(r.top,innerHeight-r.bottom)-12),room=innerWidth-r.right>=r.width+12,horizontal=available<desired&&room,overlay=available<76&&!room;setProjectLayout({side:horizontal?'right':'bottom',maxHeight:horizontal||overlay?desired:Math.min(desired,available),overlay,sideOffset:overlay?Math.max(0,Math.min(r.top,innerHeight-desired))-r.bottom:undefined,alignOffset:overlay?Math.max(0,Math.min(r.left,innerWidth-r.width-2))-r.left:undefined})};update();window.addEventListener('resize',update);window.addEventListener('scroll',update,true);return()=>{window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true)}},[projectOpen])
 const dialogAvailable=!!owner&&typeof owner.route==='object'&&!!owner.route&&typeof host.requestProfile==='function'&&['Dialog','DialogContent','DialogHeader','DialogTitle','DialogDescription','DialogFooter','Button','Input','Textarea'].every(k=>!!sdk[k])
 useEffect(()=>()=>{dialogActive.current=false},[dialogActive])
 const route=owner?.route, queryKey=['profile-rail','projects',owner?.connectionId,owner?.name,typeof route==='string'?'legacy':route?.connectionId,route?.profile,route?.targetProfile,route?.mode,projectGeneration]
 const projects=useQuery({queryKey,queryFn:()=>projectData(owner),enabled:!!owner,retry:false})
 const key=JSON.stringify([owner?.connectionId,owner?.name,owner?.route])
 const unknownKey=JSON.stringify([route?.connectionId,route?.targetProfile])
 const unknownWarning='建立結果未知，請先核對正確設定檔的原生專案清單。此防護僅存於記憶體；重新載入或 Rail 卸載重建後會清除，請勿未核對就再次建立。'
 const choices=[...(projects.data?.choices||[])];for(const project of createdProjects.current.get(key)||[])if(!choices.some(p=>p.id===project.id))choices.push(project)
 function createProject(){if(!dialogAvailable||dialogActive.current||unknownProjects.current.has(unknownKey))return;dialogActive.current=true;setDialogOpen(true)}
 function closeDialog(){dialogActive.current=false;setDialogOpen(false)}
 function rememberProject(project){const rows=createdProjects.current.get(key)||[];createdProjects.current.set(key,[...rows.filter(x=>x.id!==project.id),project]);try{Promise.resolve(sdk.queryClient?.invalidateQueries?.({queryKey:queryKey.slice(0,-1),refetchType:'none'})).catch(()=>{})}catch{}if(isCurrent())setProjectGeneration(n=>n+1)}
 async function refreshProjects(){if(sdk.queryClient?.invalidateQueries)await sdk.queryClient.invalidateQueries({queryKey:queryKey.slice(0,-1),refetchType:'none'});if(isCurrent())setProjectGeneration(n=>n+1)}
 async function create(project=null){
  if(lock.current||!owner)return
  let record=pending.current.get(key)
  if(record?.inflight){setError('建立或開啟進行中');return}
  record=record||{id:null,inflight:false};pending.current.set(key,record);record.inflight=true
  lock.current=true;setBusy(true);setError('')
  let id=record.id
  try{
   if(!id){
    if(project&&!project.path)throw Error('專案沒有可用的資料夾路徑')
    const params=project?{source:'desktop',cwd:project.path,cwd_explicit:true}:{source:'desktop'}
    let result
    if(typeof owner.route==='string'&&(host.state.connectionId.get()!==owner.connectionId||host.state.profile.get()!==owner.name))throw Error('此版本只能建立目前設定檔的工作階段')
    if(typeof host.requestProfile==='function') result=await host.requestProfile(owner.route,'session.create',params,undefined,{spawnPriority:'foreground'})
    else if(host.state.connectionId.get()===owner.connectionId&&host.state.profile.get()===owner.name) result=await host.request('session.create',params)
    else throw Error('此版本只能建立目前設定檔的工作階段')
    if(result?.error) throw Error(result.error.message||result.error.detail||String(result.error))
    id=result?.stored_session_id||result?.session_key||result?.session_id
    if(!id)throw Error('建立回應缺少工作階段 ID')
    record.id=id
   }
   if(!isCurrent())return
   await openOwned(owner,id)
   pending.current.delete(key)
   if(isCurrent())onOpened()
  }catch(e){if(!id)pending.current.delete(key);if(isCurrent())setError((id?'已建立 '+id+'，開啟失敗；重試只會開啟：':'建立失敗：')+(e?.message||'未知錯誤'))}
  finally{record.inflight=false;lock.current=false;setBusy(false)}
 }
 const ellipsis={display:'block',minWidth:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}
 const Glyph=sdk.Codicon||'span'
 return jsxs('div',{style:{flexShrink:0},children:[dialogOpen?jsx(ProjectDialog,{owner,ownerName,isCurrent,onClose:closeDialog,onCreated:rememberProject,onRefresh:refreshProjects,unknownProjects}):null,jsxs('div',{style:s.footer,children:[jsx('button',{type:'button',disabled:busy||!owner,onClick:()=>create(),style:{...s.button,flex:1,minWidth:0},children:pending.current.get(key)?.id?'重試開啟':jsxs('span',{style:{display:'inline-flex',alignItems:'center',gap:4},children:[jsx(Glyph,{name:'add',size:'0.75rem','aria-hidden':true}),'快速新增']})}),jsxs(Popover,{open:projectOpen,onOpenChange:open=>{if(open||!dialogActive.current)setProjectOpen(open)},children:[jsx(PopoverTrigger,{asChild:true,children:jsx('span',{'aria-hidden':true,tabIndex:-1,style:{position:'absolute',inset:0,pointerEvents:'none'}})}),jsx('button',{ref:projectTrigger,type:'button',disabled:busy||!owner,'aria-expanded':projectOpen,'aria-haspopup':'dialog',onClick:()=>setProjectOpen(!projectOpen),style:{...s.button,flex:1,minWidth:0},children:'▦ 開啟專案'}),jsxs(PopoverContent,{side:projectLayout.side,align:'start',avoidCollisions:!projectLayout.overlay,sideOffset:projectLayout.sideOffset,alignOffset:projectLayout.alignOffset,onCloseAutoFocus:e=>{e.preventDefault();projectTrigger.current?.focus({preventScroll:true})},onInteractOutside:e=>{if(dialogActive.current||projectTrigger.current?.closest('[data-slot="popover-content"]')?.contains(e.target))e.preventDefault()},style:{...s.bubble,padding:'min(16px, 2vh)',maxHeight:projectLayout.maxHeight,overflow:'hidden'},children:[jsxs('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,height:30},children:[jsx('strong',{children:'專案'}),jsx('button',{type:'button','aria-label':'新增專案',title:unknownProjects.current.has(unknownKey)?'建立結果未知，請先核對專案清單':dialogAvailable?'新增此設定檔的專案':'此版本缺少建立專案所需的公開路由或介面元件',disabled:busy||!dialogAvailable||unknownProjects.current.has(unknownKey),onClick:()=>void createProject(),style:{...s.button,border:0},children:jsx(Glyph,{name:'add',size:'0.75rem','aria-hidden':true})})]}),unknownProjects.current.has(unknownKey)?jsx('div',{role:'alert',children:unknownWarning,style:{fontSize:12,overflowY:'auto',flexShrink:1}}):null,projects.isPending&&!choices.length?'載入專案…':projects.isError&&!choices.length?jsxs('div',{role:'alert',children:['專案無法載入',jsx('button',{onClick:()=>setProjectGeneration(n=>n+1),children:'重試專案'})]}):!choices.length?'沒有參與的專案':jsx('div',{'data-project-list':true,style:{minHeight:0,maxHeight:96,overflowY:'auto',flex:'0 1 auto'},children:choices.map(project=>jsxs('div',{'data-project-row':true,style:{height:32,boxSizing:'border-box',flexShrink:0,display:'flex',alignItems:'center',gap:8,minWidth:0},children:[project.color&&!project.icon?jsx('span',{'data-project-icon':'color','aria-hidden':true,style:{width:14,height:14,display:'grid',placeItems:'center',flex:'none'},children:jsx('span',{style:{width:4,height:4,borderRadius:'50%',background:project.color}})}):jsx('span',{'data-project-icon':project.icon||(project.isAuto?'repo':'folder-library'),'aria-hidden':true,style:{color:project.color||'var(--ui-text-tertiary)',width:14,flex:'none'},children:jsx(Glyph,{name:project.icon||(project.isAuto?'repo':'folder-library'),size:'0.875rem'})}),jsx('div',{style:{minWidth:0,flex:'1 1 auto'},children:jsx('strong',{'data-project-name':true,title:project.label,style:{...ellipsis,fontSize:12},children:project.label})}),jsx('button',{type:'button',disabled:busy,'aria-label':'在 '+project.label+' 新增對話',onClick:()=>create(project),style:{...s.button,border:0,flex:'none'},children:jsx(Glyph,{name:'add',size:'0.75rem','aria-hidden':true})})]},project.id))})]})]})]}),error?jsx('div',{role:'alert',children:error}):null]})
}
function statusText(value){
 const text=typeof value==='string'?value.replace(/\s+/gu,' ').trim():''
 if(!text) return ''
 const parts=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text)].map(x=>x.segment):Array.from(text.matchAll(/(?:\P{Mark}\p{Mark}*|\p{Mark}+)(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}])?(?:\u200D(?:\P{Mark}\p{Mark}*)(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}])?)*/gu),x=>x[0])
 return parts.slice(0,28).join('')
}
const quoteDefaults={working:'正在專心整理眼前的事情。',waiting:'先稍作等待，準備好再繼續。',idle:'有需要時，隨時可以找我。',offline:'暫時不在線，稍後再見。',unknown:'目前還沒有足夠的狀態資訊。'}
const quoteQueues=new WeakMap()
function queueQuote(storage,key,task){
 let queues=quoteQueues.get(storage);if(!queues){queues=new Map();quoteQueues.set(storage,queues)}
 const job=(queues.get(key)||Promise.resolve()).catch(()=>{}).then(task);queues.set(key,job)
 job.finally(()=>{if(queues.get(key)===job)queues.delete(key)}).catch(()=>{})
 return job
}
function StatusQuote({storage,ownerKey,status}){
 const state=Object.hasOwn(quoteDefaults,status)?status:'unknown'
 return jsx(StatusQuoteEntry,{storage,ownerKey,state},JSON.stringify([ownerKey,state]))
}
function StatusQuoteEntry({storage,ownerKey,state}){
 const [text,setText]=useState(''),[draft,setDraft]=useState(''),[editing,setEditing]=useState(false),[expanded,setExpanded]=useState(false),[error,setError]=useState(''),[ready,setReady]=useState(false),[busy,setBusy]=useState(false)
 const alive=useRef(false),lock=useRef(false),key=ownerKey+':quote-v1:'+state
 useEffect(()=>{let active=true;alive.current=true;setReady(false);Promise.resolve().then(async()=>{if(typeof storage?.get!=='function')throw Error('storage.get unavailable');const legacy=await storage.get(ownerKey),saved=await storage.get(key);const raw=saved==null?legacy:saved;const first=saved!=null&&Array.isArray(raw)?raw[0]:raw;if(first!=null&&typeof first!=='string')throw Error('invalid quote');if(active){setText(statusText(first));setReady(true)}}).catch(()=>{if(active)setError('短句無法讀取，請重新開啟面板')});return()=>{active=false;alive.current=false}},[storage,ownerKey,key])
 const value=text||quoteDefaults[state]
 const quoteRef=useRef(null),[preview,setPreview]=useState(value)
 useEffect(()=>{const el=quoteRef.current;if(!el)return;const fit=()=>{const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx){setPreview(value);return}const css=getComputedStyle(el);ctx.font=`${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;const parts=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(value)].map(x=>x.segment):Array.from(value);let next=value;if(ctx.measureText(next).width>el.clientWidth){while(parts.length&&ctx.measureText(parts.join('')+'...').width>el.clientWidth)parts.pop();next=parts.join('')+'...'}setPreview(next)};if(typeof ResizeObserver==='function'){const observer=new ResizeObserver(fit);observer.observe(el);fit();return()=>observer.disconnect()}setPreview(value)},[value])
 async function save(){if(lock.current||!ready)return;lock.current=true;setBusy(true);try{if(typeof storage?.set!=='function'||typeof storage?.get!=='function')throw Error();const clean=statusText(draft);await queueQuote(storage,key,async()=>{await storage.set(key,clean);const confirmed=await storage.get(key);if(confirmed!==clean)throw Error()});if(alive.current){setText(clean);setEditing(false);setError('')}}catch{if(alive.current)setError('短句無法儲存，請重試')}finally{lock.current=false;if(alive.current)setBusy(false)}}
 return jsxs('div',{style:{minWidth:0,flexShrink:0},children:[jsxs('div',{style:{display:'flex',alignItems:'center',minWidth:0},children:[jsx('button',{ref:quoteRef,'data-status-quote':true,type:'button',onClick:()=>setExpanded(x=>!x),title:value,'aria-label':'狀態：'+value,style:{...s.quote,textAlign:'left',border:0,background:'transparent',padding:0,minWidth:0,flex:'1 1 auto',cursor:'pointer'},children:preview}),jsx('button',{'data-status-edit':true,type:'button',disabled:!ready||busy,onClick:()=>{setDraft(text);setEditing(x=>!x)},style:{...s.button,border:0,padding:4},'aria-label':'編輯狀態短句',children:'✎'})]}),expanded?jsx('div',{'data-status-full':true,tabIndex:0,style:{whiteSpace:'nowrap',overflowX:'auto',maxWidth:'100%',color:'var(--ui-text-secondary)',fontSize:12},children:value}):null,editing?jsxs('div',{children:[jsx('span',{children:'編輯 '+state+'（僅本機）'}),jsx('input',{'data-status-input':true,disabled:busy,value:draft,onChange:e=>setDraft(e.target.value),maxLength:512,'aria-label':'狀態短句',style:{maxWidth:'100%',boxSizing:'border-box'}}),jsx('button',{'data-status-save':true,type:'button',onClick:save,children:'儲存'})]}):null,error?jsx('small',{role:'alert',children:error}):null]})
}
// Profile Rail's own namespace; never depends on Office being mounted.
const STATUS_TTL=15000
function useRailSnapshot(rest,connection,profile){
 const epoch=typeof sdk.useGatewayActivationEpoch==='function'?sdk.useGatewayActivationEpoch():null
 const scope=JSON.stringify([connection,profile,epoch]), current=useRef(scope);current.current=scope
 const [clock,tick]=useState(0)
 const q=useQuery({queryKey:['profile-rail','status',connection,profile,epoch],enabled:!!profile&&typeof rest==='function',retry:false,refetchInterval:5000,refetchOnWindowFocus:true,queryFn:async()=>{
  const data=await rest('/status',{method:'GET',timeoutMs:10000})
  if(current.current!==scope||host.state.connectionId.get()!==connection||host.state.profile.get()!==profile)throw Error('連線已變更')
  if(!Array.isArray(data))throw Error('狀態來源格式不支援')
  const names=new Set();for(const row of data){if(!row||typeof row.profile!=='string'||!row.profile||names.has(row.profile)||typeof row.online!=='boolean'||typeof row.state!=='string')throw Error('狀態來源格式不支援');names.add(row.profile)}
  return data
 }})
 useEffect(()=>{const timer=setInterval(()=>tick(n=>n+1),2500);return()=>clearInterval(timer)},[])
 if(q.isError||!Number.isFinite(q.dataUpdatedAt)||Date.now()-q.dataUpdatedAt>STATUS_TTL||q.dataUpdatedAt>Date.now()+1000||!Array.isArray(q.data))return [[],clock]
 return [q.data,clock]
}
function officeStatus(row){if(!row)return 'unknown';if(!row.online)return 'offline';if(row.state==='running')return row.busy===true?'working':row.busy===false?'idle':'unknown';return ['working','waiting','idle','unknown'].includes(row.state)?row.state:'unknown'}
const statusOrder={working:0,waiting:1,idle:2,unknown:3,offline:4}
const statusColor={working:'var(--ui-green, var(--ui-accent))',waiting:'var(--ui-yellow, var(--ui-accent))',idle:'var(--ui-text-secondary)',offline:'var(--ui-text-quaternary)',unknown:'var(--ui-stroke-secondary)'}
const faces=['(｡•́︿•̀｡)','(◔_◔)','(¬‿¬)','( •_•)>⌐■-■','(⌐■_■)','(´･_･`)','◉_◉','(°ロ°)','( ˘⌣˘)♡','ヽ(>∀<☆)☆','٩(๑❛ᴗ❛๑)۶','(⊙_⊙)','ಠ_ಠ']
function RailItem({working,selected,clock,children}){
 const ref=useRef(null),[pos,setPos]=useState(null)
 useEffect(()=>{
  if(!working||selected)return
  const update=()=>{const el=ref.current,rail=el?.closest('[data-profile-rail]'),stack=el?.querySelector('[data-avatar-stack]');if(!el||!rail||!stack)return;const a=el.getBoundingClientRect(),r=rail.getBoundingClientRect(),sr=stack.getBoundingClientRect();const x=Math.min(sr.right,r.right)+6,y=a.top+6;const visible=a.top>=r.top&&a.bottom<=r.bottom&&x+190<=window.innerWidth&&y>=0&&y+25<=window.innerHeight;setPos(old=>visible?(old?.x===x&&old?.y===y?old:{x,y}):null)}
  const rail=ref.current?.closest('[data-profile-rail]');update();rail?.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);const ro=typeof ResizeObserver==='function'?new ResizeObserver(update):null;if(ro&&ref.current)ro.observe(ref.current);if(ro&&rail)ro.observe(rail)
  return()=>{rail?.removeEventListener('scroll',update);window.removeEventListener('resize',update);ro?.disconnect()}
 })
 const reduced=typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
 return jsxs('div',{ref,style:{width:'100%',height:37,flexShrink:0},children:[children,working&&!selected&&pos?jsx('div',{'data-working-bubble':true,'aria-hidden':true,style:{position:'fixed',left:pos.x,top:pos.y,zIndex:30,boxSizing:'border-box',width:190,height:25,display:'flex',alignItems:'center',padding:'0 8px',borderRadius:'9px 0 0 9px',pointerEvents:'none',color:'var(--ui-text-secondary)',fontSize:10,background:'linear-gradient(to right, color-mix(in srgb, var(--ui-bg-elevated) 78%, transparent) 0px, color-mix(in srgb, var(--ui-bg-elevated) 78%, transparent) 72px, transparent 160px)'},children:jsx('span',{style:{fontFamily:'monospace'},children:faces[reduced?0:clock%faces.length]})}):null]})
}
// Radix may clamp its arrow while the real anchor continues moving. Never leave
// that detached arrow near a rounded corner or an anchor outside our own rail.
function GuardedPopover({active,onOpenChange,children}){
 const avatar=useRef(null),content=useRef(null),close=useRef(onOpenChange),geometryClose=useRef(false)
 const [,setContentElement]=useState(null)
 const contentRef=useCallback(node=>{content.current=node;setContentElement(node)},[])
 close.current=onOpenChange
 useEffect(()=>{
  if(!active)return
  const a=avatar.current,c=content.current,rail=a?.closest('[data-profile-rail]')
  if(!a||!c||!rail)return
  let first=0,second=0
  const check=()=>{const ar=a.getBoundingClientRect(),rr=rail.getBoundingClientRect(),cr=c.getBoundingClientRect();const center=(ar.top+ar.bottom)/2,style=getComputedStyle(c);const top=(parseFloat(style.borderTopLeftRadius)||0)+10,bottom=(parseFloat(style.borderBottomLeftRadius)||0)+10;if(center<rr.top||center>rr.bottom||center-cr.top<top||cr.bottom-center<bottom){geometryClose.current=true;close.current(false)}}
  const schedule=()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);first=requestAnimationFrame(()=>{second=requestAnimationFrame(check)})}
  schedule();rail.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule)
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;observer?.observe(a);observer?.observe(c);observer?.observe(rail)
  return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);rail.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);observer?.disconnect()}
 })
 return jsxs(Popover,{open:active,onOpenChange,children:children(avatar,contentRef,e=>{if(geometryClose.current){e.preventDefault();geometryClose.current=false}})})
}
// Never consume host message.complete: server catch-up can send unmarked history.
// Only complete, bounded root snapshots can establish and advance a baseline.
const SNAPSHOT_LEDGER='completion-snapshot-v2'
let snapshotStorageQueue=Promise.resolve()
function queueSnapshotStorage(task){const job=snapshotStorageQueue.then(task);snapshotStorageQueue=job.catch(()=>{});return job}
async function writeSnapshotLedger(storage,rows,baseline){
 const coverage=baseline?{source:baseline.source,profiles:[...baseline.profiles].map(([owner,p])=>({owner,database_id:p.database_id,high_water:p.high_water,rows:p.rows}))}:null
 const value={version:2,rows,coverage};await storage.set(SNAPSHOT_LEDGER,value)
 if(JSON.stringify(await storage.get(SNAPSHOT_LEDGER))!==JSON.stringify(value))throw Error('completion storage write was not durable')
}
function validateSnapshot(data){
 const text=x=>typeof x==='string'&&x.length>0&&x.length<=256
 if(!data||data.version!==2||data.source_root!=='default'||!text(data.source_id)||!text(data.server_epoch)||!Array.isArray(data.profiles)||data.profiles.length>1000)throw Error('完成快照格式不支援')
 const names=new Set()
 for(const p of data.profiles){
  if(!p||!text(p.profile)||names.has(p.profile)||!['ok','unavailable'].includes(p.status))throw Error('完成快照來源格式不支援')
  names.add(p.profile)
  if(p.status==='unavailable')continue
  if(!text(p.database_id)||!Number.isSafeInteger(p.high_water)||p.high_water<0||typeof p.truncated!=='boolean'||!Array.isArray(p.rows)||p.rows.length>2000)throw Error('完成快照資料格式不支援')
  const seqs=new Set(),ids=new Set()
  for(const r of p.rows){if(!r||!Number.isSafeInteger(r.seq)||r.seq<1||r.seq>p.high_water||seqs.has(r.seq)||!text(r.admission_id)||ids.has(r.admission_id)||!text(r.session_id)||!['queued','started','unknown','terminal'].includes(r.status)||(r.outcome!==null&&typeof r.outcome!=='string')||(r.generation!==null&&(!Number.isSafeInteger(r.generation)||r.generation<1)))throw Error('完成快照事件格式不支援');seqs.add(r.seq);ids.add(r.admission_id)}
 }
 return data
}
function validStoredLedger(saved){
 try{
  if(!saved||saved.version!==2||!Array.isArray(saved.rows)||saved.rows.length>5000)return false
  const keys=new Set(),text=x=>typeof x==='string'&&x.length>0&&x.length<=256
  for(const x of saved.rows){
   if(!x||typeof x.key!=='string'||!text(x.owner)||!text(x.session)||!text(x.database)||typeof x.connection!=='string'||typeof x.source!=='string'||typeof x.read!=='boolean'||keys.has(x.key))return false
   const source=JSON.parse(x.source),key=JSON.parse(x.key)
   if(!Array.isArray(source)||source.length!==3||!(source[0]===null||text(source[0]))||!text(source[1])||!text(source[2])||JSON.stringify(source)!==x.source||JSON.stringify(source[0])!==x.connection||!Array.isArray(key)||key.length!==5||key[0]!==x.source||key[1]!==x.owner||key[2]!==x.database||key[3]!==x.session||!text(key[4])||JSON.stringify(key)!==x.key)return false
   keys.add(x.key)
  }
  if(saved.coverage!=null){const c=saved.coverage,source=JSON.parse(c.source);if(!Array.isArray(source)||source.length!==3||!Array.isArray(c.profiles))return false;validateSnapshot({version:2,source_root:'default',source_id:source[1],server_epoch:source[2],profiles:c.profiles.map(p=>({profile:p.owner,status:'ok',database_id:p.database_id,high_water:p.high_water,truncated:false,rows:p.rows}))})}
  return true
 }catch{return false}
}
function sameSnapshotDataset(a,b){try{const x=JSON.parse(a),y=JSON.parse(b);return x[0]===y[0]&&x[1]===y[1]}catch{return false}}
function useCompletion(storage,rest,connection,profile){
 const focusIdAtom=host.state.focusedStoredSessionId,focusOwnerAtom=host.state.focusedSessionOwner
 const focusedId=useSyncExternalStore(fn=>focusIdAtom?.subscribe?.(fn)||(()=>{}),()=>focusIdAtom?.get?.()??null,()=>null)
 const focusedOwner=useSyncExternalStore(fn=>focusOwnerAtom?.subscribe?.(fn)||(()=>{}),()=>focusOwnerAtom?.get?.()??null,()=>null)
 const focusedMatches=(owner,id)=>{const current=focusOwnerAtom?.get?.();return !!current&&typeof current.connectionId==='string'&&current.connectionId===connection&&current.profile===owner&&focusIdAtom?.get?.()===id}
 const activation=typeof sdk.useGatewayActivationEpoch==='function'?sdk.useGatewayActivationEpoch():null
 const [generation,retry]=useState(0),[,render]=useState(0),ref=useRef(null)
 const scope=JSON.stringify([connection??null,profile,activation,generation])
 if(!ref.current||ref.current.scope!==scope)ref.current={scope,ready:false,failed:false,baseline:null,known:null,gap:false,rows:[],queue:Promise.resolve()}
 const state=ref.current
 const q=useQuery({queryKey:['profile-rail','completion-snapshot',connection,profile,activation,generation],enabled:!!profile&&typeof rest==='function',retry:false,refetchOnWindowFocus:false,refetchOnReconnect:false,refetchInterval:query=>query.state.status==='success'&&query.state.fetchFailureCount===0?15000:false,queryFn:async()=>{const data=validateSnapshot(await rest('/completion-snapshot',{method:'GET',timeoutMs:30000}));if(host.state.connectionId.get()!==connection||host.state.profile.get()!==profile)throw Error('連線已變更');return data}})
 useEffect(()=>{let live=true
  state.queue=queueSnapshotStorage(async()=>{if(!storage?.get||!storage?.set)throw Error('storage unavailable');const saved=await storage.get(SNAPSHOT_LEDGER);if(saved!==undefined&&!validStoredLedger(saved))throw Error('invalid ledger');if(!live||ref.current!==state)return;state.rows=saved?.rows||[];state.known=saved?.coverage?{source:saved.coverage.source,profiles:new Map(saved.coverage.profiles.map(p=>[p.owner,{database_id:p.database_id,high_water:p.high_water,rows:p.rows}]))}:null;state.ready=true;render(n=>n+1)}).catch(()=>{if(live&&ref.current===state){state.failed=true;render(n=>n+1)}})
  return()=>{live=false}
 },[storage,state])
 useEffect(()=>{
  if(q.isError){state.baseline=null;return}
  if(!q.data||q.isFetching)return
  const data=q.data
  state.queue=queueSnapshotStorage(async()=>{
   if(state.failed||!state.ready||ref.current!==state)return
   const source=JSON.stringify([connection??null,data.source_id,data.server_epoch]),old=state.baseline
   if(old&&old.source!==source)state.gap=false
   let rows=state.rows.slice()
   const next=new Map(),known=state.known&&sameSnapshotDataset(state.known.source,source)?new Map(state.known.profiles):new Map()
   for(const p of data.profiles){
    if(p.status!=='ok'||p.truncated)continue
    const before=old?.source===source?old.profiles.get(p.profile):null
    const reference=before||known.get(p.profile)
    const prior=reference?new Map(reference.rows.map(r=>[r.admission_id,r])):new Map()
    const now=new Map(p.rows.map(r=>[r.admission_id,r]))
    const consistent=reference&&reference.database_id===p.database_id&&p.high_water>=reference.high_water&&reference.rows.every(r=>{const n=now.get(r.admission_id);return n&&n.seq===r.seq&&n.session_id===r.session_id})&&p.rows.every(r=>prior.has(r.admission_id)||r.seq>reference.high_water)
    if(!consistent){
    if(reference){state.gap=true;rows=rows.filter(x=>!sameSnapshotDataset(x.source,source)||x.owner!==p.profile)}
    else rows=rows.filter(x=>{if(!sameSnapshotDataset(x.source,source)||x.owner!==p.profile)return true;const r=now.get(JSON.parse(x.key)[4]);return x.database===p.database_id&&r?.session_id===x.session&&r.status==='terminal'&&r.outcome==='completed'})
   }
    if(before&&consistent)for(const r of p.rows){const previous=prior.get(r.admission_id);const becameComplete=r.status==='terminal'&&r.outcome==='completed'&&(!previous||previous.status!=='terminal'||previous.outcome!=='completed');if(!becameComplete)continue;const key=JSON.stringify([source,p.profile,p.database_id,r.session_id,r.admission_id]);if(!rows.some(x=>sameSnapshotDataset(x.source,source)&&x.owner===p.profile&&x.database===p.database_id&&x.session===r.session_id&&JSON.parse(x.key)[4]===r.admission_id))rows.push({key,connection:JSON.stringify(connection??null),source,owner:p.profile,database:p.database_id,session:r.session_id,read:focusedMatches(p.profile,r.session_id)})}
    const coverage={database_id:p.database_id,high_water:p.high_water,rows:p.rows};next.set(p.profile,coverage);known.set(p.profile,coverage)
   }
   if(rows.length>5000)throw Error('completion ledger full')
   const baseline={source,profiles:next},knownCoverage={source,profiles:known}
   await writeSnapshotLedger(storage,rows,knownCoverage)
   if(ref.current!==state)return
   state.rows=rows;state.baseline=baseline;state.known=knownCoverage;render(n=>n+1)
  }).catch(()=>{if(ref.current===state){state.failed=true;state.baseline=null;render(n=>n+1)}})
 },[q.data,q.dataUpdatedAt,q.isError,q.isFetching,state,storage,connection])
 const usable=()=>ref.current===state&&state.ready&&!state.failed&&!!state.baseline&&!q.isError&&!!profile
 const matches=(x,owner,id)=>sameSnapshotDataset(x.source,state.baseline?.source)&&x.database===state.baseline?.profiles.get(owner?.name)?.database_id&&x.connection===JSON.stringify(owner?.connectionId??null)&&x.owner===owner?.name&&x.session===id&&!x.read
 useEffect(()=>{
  if(!usable()||!focusedOwner||!focusedId||!focusedMatches(focusedOwner.profile,focusedId))return
  const owner={name:focusedOwner.profile,connectionId:focusedOwner.connectionId}
  const keys=new Set(state.rows.filter(x=>matches(x,owner,focusedId)).map(x=>x.key))
  if(!keys.size)return
  state.queue=queueSnapshotStorage(async()=>{
   if(!usable()||!focusedMatches(owner.name,focusedId))return
   const rows=state.rows.map(x=>keys.has(x.key)&&matches(x,owner,focusedId)?{...x,read:true}:x)
   await writeSnapshotLedger(storage,rows,state.known)
   if(ref.current===state){state.rows=rows;render(n=>n+1)}
  }).catch(()=>{if(ref.current===state){state.failed=true;render(n=>n+1)}})
 },[focusedId,focusedOwner,state,state.rows,state.baseline,q.isError,storage])
 const activityFor=name=>{
  if(!profile||q.isError||!Array.isArray(q.data?.profiles)||host.state.connectionId.get()!==connection||host.state.profile.get()!==profile)return null
  const a=q.data.profiles.find(p=>p.profile===name)?.activity
  if(!a||a.version!==1||a.coverage!=='observed'||a.definition!=='native active-turn lease'||!Number.isSafeInteger(a.observed_active_count)||a.observed_active_count<0||typeof a.observed_child_active!=='boolean'||!Number.isFinite(a.observed_at)||!Array.isArray(a.unknown_reasons)||!a.unknown_reasons.every(x=>typeof x==='string'))return null
  if(Object.hasOwn(a,'observed_child_count')&&(!Number.isSafeInteger(a.observed_child_count)||a.observed_child_count<0||a.observed_child_count>1000000))return {...a,observed_child_count:null,observed_child_active:null}
  return a
 }
 const childMetadataFor=name=>{
  if(!profile||q.isError||!Array.isArray(q.data?.profiles)||host.state.connectionId.get()!==connection||host.state.profile.get()!==profile)return null
  const a=q.data.profiles.find(p=>p.profile===name)?.activity,m=a?.child_metadata
  if(m===undefined)return undefined // old backend: retain the lease-only fallback
  if(a.version!==1||!Number.isFinite(a.observed_at)||!m||m.availability!=='available'||!Number.isSafeInteger(m.presentation_count)||m.presentation_count<0||m.presentation_count>50||!Array.isArray(m.children)||m.children.length>50||!m.children.every(x=>x&&typeof x.id==='string'&&x.id.length>0&&x.id.length<=256&&['queued','recent','stale','ended','completed','failed','interrupted'].includes(x.kind)&&typeof x.leased==='boolean')||new Set(m.children.filter(x=>x.kind==='queued'||x.kind==='recent').map(x=>x.id)).size!==m.presentation_count)return null
  return m
 }
 return {activityFor,childMetadataFor,coverageReady:usable(),covers:name=>state.baseline?.profiles.has(name)===true,error:typeof rest!=='function'?'完成來源不可用':state.failed?'完成紀錄無法儲存':q.isError?'完成來源不可用':state.gap?'完成來源不連續，已重新建立基準':q.data?.profiles?.some(p=>p.status!=='ok'||p.truncated)?'部分完成來源不可用或超過上限':null,retry:()=>retry(n=>n+1),has:name=>usable()&&state.baseline.profiles.has(name)&&state.rows.some(x=>sameSnapshotDataset(x.source,state.baseline.source)&&x.database===state.baseline.profiles.get(name).database_id&&x.connection===JSON.stringify(connection??null)&&x.owner===name&&!x.read),watermark:(owner,id)=>usable()?state.rows.filter(x=>matches(x,owner,id)).map(x=>x.key):[],ack:async(owner,id,keys)=>{if(!usable()||!keys.length)return;const selected=new Set(keys);state.queue=queueSnapshotStorage(async()=>{if(!usable())return;const rows=state.rows.map(x=>matches(x,owner,id)&&selected.has(x.key)?{...x,read:true}:x);await writeSnapshotLedger(storage,rows,state.known);if(ref.current===state){state.rows=rows;render(n=>n+1)}}).catch(()=>{state.failed=true;render(n=>n+1)});await state.queue}}
}
const activityLabel=n=>'已觀察到 '+n+' 個執行中的 turn；僅涵蓋可驗證的 native active-turn lease，可能有遺漏，並非全部工作。'
// Activity inputs are tri-state: unknown does not invent a child or a count.
export function AvatarLayers({avatar,name,color,avatarRef,unread,offline=false,childRunning=null,childCount=null,runningCount=null,triggerProps={}}){
 const box=useRef(null),[width,setWidth]=useState(0)
 useEffect(()=>{const el=box.current;if(!el)return;const update=()=>setWidth(el.clientWidth);update();const ro=typeof ResizeObserver==='function'?new ResizeObserver(update):null;ro?.observe(el);return()=>ro?.disconnect()},[])
 const count=(Number.isSafeInteger(runningCount)&&runningCount>1?runningCount-1:0)+(Number.isSafeInteger(childCount)&&childCount>=0?childCount:childRunning===true?1:0)
 const available=Math.max(0,width-8),natural=34+6*count,visible=Math.min(count,Math.max(0,Math.ceil((available-6)/6)))
 const face=(ref,index=0)=>{const shadow=index>0,props={ref,'data-avatar':shadow?undefined:true,'data-child-shadow':shadow||undefined,className:'profile-rail-avatar',style:{...s.avatar,boxSizing:'border-box',border:0,outline:shadow||offline?'none':'2px solid '+color,position:'absolute',left:index*6,top:shadow?1.5:0,zIndex:shadow?-index:1,filter:[shadow?'brightness(0.55)':'',offline?'grayscale(1)':''].filter(Boolean).join(' ')||undefined},...(avatar?{src:avatar,alt:''}:{children:name.slice(0,1).toUpperCase()})};return jsx(avatar?'img':'span',props,index)}
 return jsx('span',{ref:box,style:{display:'block',width:'100%',height:37},children:jsxs('span',{'data-avatar-stack':true,style:{position:'relative',display:'block',margin:'0 auto',width:Math.min(natural,available),height:37},children:[jsx('span',{style:{position:'absolute',inset:0,overflow:'hidden',zIndex:0},children:Array.from({length:visible},(_,i)=>face(null,i+1))}),jsx(PopoverTrigger,{asChild:true,children:jsx('button',{...triggerProps,ref:avatarRef,type:'button',className:'profile-rail-hit',style:{...s.hit,position:'absolute',left:0,top:1.5,width:34,height:34,zIndex:1},children:face(null)})}),offline?jsx('span',{'data-avatar-outline':true,'aria-hidden':true,style:{position:'absolute',left:0,top:1.5,width:34,height:34,borderRadius:'22%',outline:'2px solid '+color,zIndex:2,pointerEvents:'none'}}):null,unread?jsx('span',{'data-completion-badge':true,'aria-hidden':true,style:{position:'absolute',left:26,top:-5,zIndex:3,fontSize:14,lineHeight:1,pointerEvents:'none'},children:'✋'}):null,Number.isSafeInteger(runningCount)&&runningCount>=2?jsx('span',{'data-running-count':true,title:activityLabel(runningCount),'aria-hidden':true,style:{position:'absolute',left:26,bottom:0,zIndex:3,borderRadius:'50%',minWidth:17,height:17,lineHeight:'17px',textAlign:'center',fontSize:9,color:'var(--ui-text-primary)',background:'var(--ui-bg-elevated)',border:'1px solid var(--ui-stroke-secondary)',pointerEvents:'none'},children:'x'+runningCount}):null]})})
}
function Rail({storage,rest}){
 const connectionId=useValue(host.state.connectionId),profile=useValue(host.state.profile)
 const completion=useCompletion(storage,rest,connectionId,profile)
 const [office,clock]=useRailSnapshot(rest,connectionId,profile)
 const [selected,setSelected]=useState(null),[projectOwner,setProjectOwner]=useState(null),[routeGeneration,setRouteGeneration]=useState(0),selectedRef=useRef(null),selectionEpoch=useRef(0),pending=useRef(new Map()),createdProjects=useRef(new Map()),unknownProjects=useRef(new Set()),dialogActive=useRef(false)
 const select=value=>{const next=typeof value==='function'?value(selectedRef.current):value;if(next!==selectedRef.current){selectionEpoch.current++;setProjectOwner(null)}selectedRef.current=next;setSelected(next)}
 useEffect(()=>{select(null)},[connectionId,profile])
 const routes=useQuery({queryKey:['profile-rail','routes',connectionId,profile,routeGeneration],queryFn:()=>typeof host.profileRoutes==='function'?bounded(()=>host.profileRoutes(),'路由查詢'):Promise.resolve(null),enabled:!!profile,retry:false})
 const q=useQuery({queryKey:['profile-rail','roster',connectionId,profile],queryFn:async()=>{
  const result=await bounded(()=>host.profiles.list({connectionId,profile}),'設定檔清單')
  if(!Array.isArray(result?.profiles)) throw new Error('Invalid profile response')
  const rows=await Promise.all(result.profiles.map(async p=>{
   let avatar=null
   try {const asset=await bounded(()=>host.request('profiles.get_asset',{name:p.name,asset:'avatar'}),'頭像');if(asset?.found&&typeof asset.data==='string'&&/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(asset.data)) avatar=asset.data} catch {}
   return {...p,avatar}
  }))
  if(host.state.connectionId.get()!==connectionId || host.state.profile.get()!==profile) throw new Error('Connection changed')
  return rows
 },enabled:!!profile,retry:false})
 if(q.isPending) return jsx('p',{children:q.fetchStatus==='idle'?'Connection not ready':'Loading profiles…'})
 if(q.isError) return jsxs('div',{children:[jsx('p',{children:'Profiles unavailable · state unknown'}),jsx('button',{onClick:()=>q.refetch(),children:'Retry'})]})
 if(!q.data?.length) return jsx('p',{children:'No profiles available'})
 const byName=new Map(office.map(row=>[row.profile,row]))
 const profiles=q.data.filter(p=>typeof p.name==='string').map((p,index)=>({...p,index,office:byName.get(p.name),status:officeStatus(byName.get(p.name))})).sort((a,b)=>{
  const rank=statusOrder[a.status]-statusOrder[b.status];if(rank)return rank
  if(a.status==='idle'){const x=a.office?.idle_since,y=b.office?.idle_since,valid=v=>typeof v==='number'&&Number.isFinite(v)&&v>0; if(valid(x)&&valid(y)&&x!==y)return y-x;if(valid(x)!==valid(y))return valid(x)?-1:1}
  return a.index-b.index
 })
 const completionError=completion.error||(completion.coverageReady&&profiles.some(p=>!completion.covers(p.name))?'部分設定檔完成來源不可用':null)
 return jsxs('div',{'data-profile-rail':true,'aria-label':'SessionCrew',style:{...s.rail,width:'100%',position:'relative',alignItems:'flex-start',overflowX:'hidden',scrollbarWidth:'none'},children:[jsx('style',{children:'[data-profile-rail]::-webkit-scrollbar{display:none}'}),...profiles.map(p=>{
  const name=displayName(p),activity=completion.activityFor(p.name),metadata=completion.childMetadataFor(p.name),metadataLabel=metadata?.presentation_count?'子代理排隊／近期活動，非執行證明。':'',epoch=selectionEpoch.current,selectionKey=JSON.stringify([connectionId,profile,p.name]),active=selected===selectionKey
  const isCurrent=()=>selectedRef.current===selectionKey&&selectionEpoch.current===epoch&&host.state.connectionId.get()===connectionId&&host.state.profile.get()===profile
  let owner=null,phase=routes.isPending?(routes.fetchStatus==='idle'?'連線尚未準備好':'loading'):routes.isError?'設定檔路由無法載入：'+(routes.error?.message||'未知錯誤'):''
  if(!phase) try {owner={connectionId,name:p.name,route:routeFor(p.name,connectionId,profile,routes.data)}} catch(e){phase=e.message}
  return jsx(RailItem,{working:p.status==='working',selected:active,clock,children:jsx(GuardedPopover,{active,onOpenChange:open=>{if(!open&&dialogActive.current)return;if(open)select(selectionKey);else if(selectedRef.current===selectionKey)select(null)},children:(avatarRef,contentRef,onCloseAutoFocus)=>[
   jsx(AvatarLayers,{avatar:p.avatar,name,color:statusColor[p.status],avatarRef,offline:p.status==='offline',unread:completion.has(p.name),runningCount:activity?.observed_active_count,childCount:metadata===undefined?activity?.observed_child_count:metadata?.presentation_count,childRunning:metadata!==undefined||activity&&Object.hasOwn(activity,'observed_child_count')?null:activity?.observed_child_active,triggerProps:{'data-selected':active,'data-low':['idle','offline','unknown'].includes(p.status),'data-state-name':p.status,'aria-label':name+' · state '+p.status+(completion.has(p.name)?' · 有未讀完成':'')+(activity?' · '+activityLabel(activity.observed_active_count):'')+(metadataLabel?' · '+metadataLabel:''),title:[activity?activityLabel(activity.observed_active_count):'',metadataLabel].filter(Boolean).join(' ')||undefined}}),
  jsxs(PopoverContent,{ref:contentRef,onInteractOutside:e=>{if(dialogActive.current)e.preventDefault()},onCloseAutoFocus:e=>{onCloseAutoFocus(e);if(selectedRef.current&&selectedRef.current!==selectionKey)e.preventDefault()},side:'right',align:'center',collisionPadding:0,style:{...s.bubble,position:'relative'},children:[jsxs('div',{style:{display:'flex',gap:11,alignItems:'center',minWidth:0,flexShrink:0},children:[p.avatar?jsx('img',{'data-panel-avatar':true,src:p.avatar,alt:'',style:{...s.avatar,flex:'none',borderColor:statusColor[p.status]}}):jsx('span',{'data-panel-avatar':true,style:{...s.avatar,flex:'none',borderColor:statusColor[p.status]},children:name.slice(0,1).toUpperCase()}),jsxs('div',{style:{minWidth:0,flex:'1 1 auto'},children:[jsx('strong',{style:{display:'block',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',minWidth:0,fontSize:14},children:name}),jsx(StatusQuote,{storage,ownerKey:'status:'+JSON.stringify([connectionId,p.name]),status:p.status})]}),jsx('button',{type:'button','aria-label':'關閉面板',onClick:()=>select(null),style:{...s.button,border:0,fontSize:20,padding:0,alignSelf:'flex-start'},children:'×'})]}),active?jsx(Recent,{owner,phase,completion,retryRoutes:()=>setRouteGeneration(n=>n+1),onOpened:()=>{if(isCurrent())select(null)}},JSON.stringify([connectionId,p.name])):null,active?jsx(Launchers,{owner,ownerName:name,isCurrent,createdProjects,unknownProjects,dialogActive,projectOpen:projectOwner===selectionKey,setProjectOpen:open=>setProjectOwner(open?selectionKey:null),onOpened:()=>{if(isCurrent())select(null)},pending},'launch:'+JSON.stringify([connectionId,p.name,owner?.route])):null]})]})},p.name)
 }),completionError?jsx(profile&&rest?'button':'span',{'data-completion-error':true,title:completionError,'aria-label':completionError,...(profile&&rest?{onClick:completion.retry}:{}),style:{...s.button,position:'absolute',top:0,right:0,zIndex:5,fontSize:9,padding:'1px 3px'},children:'!'}):null]})
}
export default {id:'profile-rail',name:'SessionCrew',defaultEnabled:true,register(ctx){const rest=typeof ctx.rest==='function'?(path,opts)=>ctx.rest(path,opts):null;ctx.register({id:'rail',area:'panes',title:'SessionCrew',data:{placement:'left',dock:{pane:'workspace',pos:'left'},width:'80px',minWidth:'80px'},render:()=>jsx(DialogRestContext.Provider,{value:rest,children:jsx(Rail,{storage:ctx.storage,rest})})})}}
