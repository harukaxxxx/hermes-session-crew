import * as sdk from '@hermes/plugin-sdk'
import { host, useValue, useQuery, Popover, PopoverContent, PopoverTrigger } from '@hermes/plugin-sdk'
import { useState, useEffect, useRef, useCallback, useSyncExternalStore, createContext, useContext } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

// Plugin-owned copy; zh-hant is the SDK normalized ID for zh-TW.
const messages = {
  "en": {
    project: {
      open: "▦ Open project",
      home: "Home",
      title: "Project",
      name: "Project name",
      loadFailed: "Could not load projects",
      loading: "Loading projects…",
      idea: "Project idea",
      ideaCreative: "Create a tool to collect creative inspiration",
      createDescription: "Create a project for the selected profile without switching the current profile or project.",
      inProgress: "Creation or opening in progress",
      ideaExplore: "Create a tool for exploring and sharing places",
      ideaHabits: "Create a simple habit tracker",
      unknownList: "Creation outcome unknown; check the project list first",
      unknownWarning: "Creation outcome unknown. Check the selected profile's native project list first. This safeguard exists only in memory and is cleared on reload or Rail remount; do not create again without checking.",
      ideaNotes: "Build a tool to organize notes",
      new: "New project",
      newForProfile: "New project for this profile",
      uncategorized: "Uncategorized",
      untitled: "Untitled project",
      empty: "No projects with sessions",
      generating: "Generating…",
      generateIdea: "Generate idea (using the selected profile's LLM)",
      ideaLearning: "Build a tool to organize learning resources",
      ideaTools: "Build a tool to solve everyday problems",
      nameFoldersRequired: "Enter a name and select at least one folder",
      folders: "Folders (the first is primary)",
      loadingList: "Loading projects…",
      refreshIdeas: "Refresh idea suggestions",
      retry: "Retry projects",
      ideaCopyHelp: "Nonblank ideas are saved as IDEA.md in the primary folder after project creation, without overwriting existing files.",
      ideaSaveFailure: error => `IDEA.md was not confirmed saved: ${error}. Your text remains here; inspect the file before retrying.`,
      ideaSaved: "IDEA.md saved and verified.",
      ideaScopeLost: "Project created, but the connection changed and the idea was not saved. Copy your text before closing.",
      ideaRetry: "Save idea only",
      ideaCategoryHabits: "🌱 Habits",
      ideaCategoryCreative: "🎨 Creation",
      ideaCategoryLearning: "📚 Learning",
      ideaCategoryNotes: "📝 Notes",
      ideaCategoryExplore: "🗺️ Explore",
      ideaCategoryTools: "🧰 Tools",
      ideaFailure: error => `Idea generation failed: ${error}`,
      refreshFailure: (id, error) => `Created ${id}, but the project list could not refresh: ${error}; retry only refreshes and will not recreate it.`,
      unknownFailure: error => `Creation outcome unknown. Check the selected profile's native project list first; reloading clears the in-memory safeguard. ${error}`,
      newForOwner: owner => `New project (${owner})`,
      created: (label, id) => `Project created: ${label} (${id})`,
    },
    common: {
      primary: "Primary",
      save: "Save",
      cancel: "Cancel",
      create: "Create",
      creating: "Creating…",
      routeLookup: "Route lookup",
      loadMore: "Load more",
      connectionNotReady: "Connection not ready",
      retry: "Retry",
      retryRefresh: "Retry refresh",
      close: "Close",
      closePanel: "Close panel",
      avatar: "Avatar",

      creationFailure: error => `Creation failed: ${error}`,
    },
    settings: {
      cronHelp: "Cron is identified only by session source; sessions without a source remain visible.",
      offlineHelp: "Only definitely offline profiles are hidden; profiles with unknown status remain visible.",
      visibleProfiles: "Visible profiles",
      storageHelp: "Settings are saved on this client and shared across connections; new profiles are visible by default.",
      profileList: "Profile list",
      profileUnavailable: "Profile list unavailable",
      profileLoadFailed: "Could not load profile list",
      saveFailed: "Could not save settings; try again",
      readFailed: "Could not read settings",
      loadingProfiles: "Loading profiles…",
      hideOffline: "Hide offline profiles",
      showCron: "Show Cron sessions",

      profilesUnknown: "Profiles unavailable · state unknown",
      noProfiles: "No profiles available",
    },
    status: {
      waitingQuote: "Taking a moment to wait before continuing.",
      workingLabel: "Working",
      thinkingWords: "pondering,contemplating,musing,cogitating,ruminating,deliberating,mulling,reflecting,processing,reasoning,analyzing,computing,synthesizing,formulating,brainstorming",
      offlineQuote: "Offline for now; see you later.",
      idleQuote: "I'm here whenever you need me.",
      onlineUnobservedQuote: "Online; no activity observed for this profile.",
      workingQuote: "Focusing on the task at hand.",
      quote: "Status quote",
      unknownQuote: "Not enough status information yet.",
      saveFailed: "Could not save quote; try again",
      readFailed: "Could not read quote; reopen the panel",
      editQuote: "Edit status quote",

      working: "working",
      waiting: "waiting",
      idle: "idle",
      onlineUnobserved: "online · no activity observed",
      offline: "offline",
      unknown: "unknown",
      label: value => `Status: ${value}`,
      editLocal: state => `Edit ${state} (local only)`,
      profileAria: (name, state, unread, activity, metadata) => `${name} · state ${state}${unread ? " · unread completions" : ""}${activity ? ` · ${activity}` : ""}${metadata ? ` · ${metadata}` : ""}`,
    },
    completion: {
      markAllRead: "Mark all read",
      unavailable: "Completion source unavailable",
      rebuilt: "Completion source discontinuity; baseline rebuilt",
      unread: "Completed and unread",
      saveFailed: "Could not save completion records",
      partial: "Some completion sources are unavailable or exceed the limit",
      profilePartial: "Completion source unavailable for some profiles",
    },
    errors: {
      liveSessionFormat: "Unsupported live session response format",
      responseFormat: "Unsupported response format",
      completionEventFormat: "Unsupported completion snapshot event format",
      completionSourceFormat: "Unsupported completion snapshot source format",
      completionSnapshotFormat: "Unsupported completion snapshot format",
      completionDataFormat: "Unsupported completion snapshot data format",
      projectFormat: "Unsupported project response format",
      projectNoPath: "Project has no available folder path",
      sessionFormat: "Unsupported session response format",
      missingProjectId: "Creation response lacks a project ID; outcome unknown",
      missingSessionId: "Creation response lacks a session ID",
      rootChangedDialog: "Backend root changed; reopen the dialog",
      rootChangedBrowser: "Backend root changed; reopen the browser",
      routeNotUnique: "Could not find a unique profile route",
      unknown: "Unknown error",
      otherProfilesUnsupported: "This version cannot read other profiles",
      routingUnsupported: "This version does not support connection routing",
      openUnsupported: "This version cannot open sessions",
      createOtherUnsupported: "This version can create sessions only for the current profile",
      openOtherUnsupported: "This version can open only the current profile",
      projectUiUnsupported: "This version lacks the public route or UI components needed to create a project",
      statusFormat: "Unsupported status source format",
      emptyGeneration: "Generation returned no content",
      backendUnavailable: "Current connection's backend is unavailable",
      folderFormat: "Unsupported folder response format",
      routeFormat: "Unsupported route list format",
      connectionChanged: "Connection changed",
      routeLoadFailure: error => `Could not load profile route: ${error}`,
      timeout: label => `${label} timed out`,
    },
    activity: {
      childDisclaimer: "Queued or recent child-agent activity is not proof of execution.",
      observed: count => `Observed ${count} active turns; only verifiable native active-turn leases are covered. Work may be missing; this is not all work.`,
    },
    folder: {
      unknownShort: "Creation outcome unknown; check the folder first",
      unknownRetry: "Creation outcome unknown; check first and do not retry.",
      create: "Create folder",
      new: "New folder",
      description: "Browse folders accessible to the current gateway backend, not this device's local filesystem.",
      browse: "Browse folders",
      backendUnavailable: "Current connection's folder backend is unavailable; reopen and check the connection.",
      invalidName: "Enter a valid folder name",
      name: "Folder name",
      hierarchy: "Folder hierarchy",
      loadingRoot: "Loading root folder…",
      selectCurrent: "Select current folder",
      choose: "Choose folder",
      loadFailure: error => `Could not load folders: ${error}`,
      unknownFailure: error => `Creation outcome unknown. Check the folder first; do not retry automatically. ${error}`,
      remove: path => `Remove ${path}`,
    },
    session: {
      quickCreate: "Quick create",
      limit: "Showing at most 200 fetched items",
      untitled: "Untitled",
      findingRoute: "Finding profile route…",
      empty: "No sessions",
      loading: "Loading sessions…",
      retryOpen: "Retry opening",
      showMore: "Show more sessions",
      openFailure: error => `Could not open: ${error}; try again`,
      loadFailure: error => `Could not load sessions: ${error}`,
      createdOpenFailure: (id, error) => `Created ${id}, but opening failed; retry only opens it: ${error}`,
      newInProject: project => `New conversation in ${project}`,
    },
  },
  "zh-hant": {
    project: {
      open: "▦ 開啟專案",
      home: "主頁",
      title: "專案",
      name: "專案名稱",
      loadFailed: "專案無法載入",
      loading: "專案載入中…",
      idea: "專案點子",
      ideaCreative: "建立創作靈感收集工具",
      createDescription: "建立屬於所選設定檔的專案；不切換目前設定檔或專案。",
      inProgress: "建立或開啟進行中",
      ideaExplore: "建立探索和分享地點的工具",
      ideaHabits: "建立簡單的習慣追蹤工具",
      unknownList: "建立結果未知，請先核對專案清單",
      unknownWarning: "建立結果未知，請先核對正確設定檔的原生專案清單。此防護僅存於記憶體；重新載入或 Rail 卸載重建後會清除，請勿未核對就再次建立。",
      ideaNotes: "打造一個整理筆記的工具",
      new: "新增專案",
      newForProfile: "新增此設定檔的專案",
      uncategorized: "未分類",
      untitled: "未命名專案",
      empty: "沒有參與的專案",
      generating: "生成中…",
      generateIdea: "生成點子（使用所選設定檔的 LLM）",
      ideaLearning: "製作學習資源整理工具",
      ideaTools: "製作解決日常問題的小工具",
      nameFoldersRequired: "請輸入名稱並選擇至少一個資料夾",
      folders: "資料夾（第一個為主要資料夾）",
      loadingList: "載入專案…",
      refreshIdeas: "重新整理點子建議",
      retry: "重試專案",
      ideaCopyHelp: "建立專案後，非空白點子會自動儲存為主要資料夾的 IDEA.md，不覆寫既有檔案。",
      ideaSaveFailure: error => `尚未確認儲存 IDEA.md：${error}。文字保留在此；重試前請檢查檔案。`,
      ideaSaved: "IDEA.md 已儲存並讀回確認。",
      ideaScopeLost: "專案已建立，但連線變更，點子未儲存。請在關閉前複製文字。",
      ideaRetry: "僅儲存點子",
      ideaCategoryHabits: "🌱 習慣",
      ideaCategoryCreative: "🎨 創作",
      ideaCategoryLearning: "📚 學習",
      ideaCategoryNotes: "📝 筆記",
      ideaCategoryExplore: "🗺️ 探索",
      ideaCategoryTools: "🧰 工具",
      ideaFailure: error => `點子生成失敗：${error}`,
      refreshFailure: (id, error) => `已建立 ${id}，專案清單刷新失敗：${error}；重試只會刷新，不會重建。`,
      unknownFailure: error => `建立結果未知，請先核對正確設定檔的原生專案清單；重新載入會清除記憶體防護。 ${error}`,
      newForOwner: owner => `新增專案（${owner}）`,
      created: (label, id) => `已建立專案：${label} (${id})`,
    },
    common: {
      primary: "主要",
      save: "儲存",
      cancel: "取消",
      create: "建立",
      creating: "建立中…",
      routeLookup: "路由查詢",
      loadMore: "載入更多",
      connectionNotReady: "連線尚未準備好",
      retry: "重試",
      retryRefresh: "重試刷新",
      close: "關閉",
      closePanel: "關閉面板",
      avatar: "頭像",

      creationFailure: error => `建立失敗：${error}`,
    },
    settings: {
      cronHelp: "僅依工作階段來源辨識 Cron，無來源時保留。",
      offlineHelp: "只隱藏確定離線的設定檔；狀態未知時仍會顯示。",
      visibleProfiles: "可見設定檔",
      storageHelp: "設定保存在此用戶端，所有連線共用；新設定檔預設顯示。",
      profileList: "設定檔清單",
      profileUnavailable: "設定檔清單不可用",
      profileLoadFailed: "設定檔清單無法載入",
      saveFailed: "設定無法儲存，請重試",
      readFailed: "設定無法讀取",
      loadingProfiles: "載入設定檔…",
      hideOffline: "隱藏離線設定檔",
      showCron: "顯示 Cron 工作階段",

      profilesUnknown: "設定檔無法載入・狀態未知",
      noProfiles: "沒有設定檔",
    },
    status: {
      waitingQuote: "先稍作等待，準備好再繼續。",
      workingLabel: "工作中",
      thinkingWords: "pondering,contemplating,musing,cogitating,ruminating,deliberating,mulling,reflecting,processing,reasoning,analyzing,computing,synthesizing,formulating,brainstorming,思考,琢磨,沉思,推敲,斟酌,盤算,反思,處理,推理,分析,運算,整合,構思,腦力激盪",
      offlineQuote: "暫時不在線，稍後再見。",
      idleQuote: "有需要時，隨時可以找我。",
      onlineUnobservedQuote: "在線，尚未觀察到此設定檔的活動。",
      workingQuote: "正在專心整理眼前的事情。",
      quote: "狀態短句",
      unknownQuote: "目前還沒有足夠的狀態資訊。",
      saveFailed: "短句無法儲存，請重試",
      readFailed: "短句無法讀取，請重新開啟面板",
      editQuote: "編輯狀態短句",

      working: "工作中",
      waiting: "等待中",
      idle: "閒置",
      onlineUnobserved: "在線・未觀察到活動",
      offline: "離線",
      unknown: "未知",
      label: value => `狀態：${value}`,
      editLocal: state => `編輯 ${state}（僅本機）`,
      profileAria: (name, state, unread, activity, metadata) => `${name} · 狀態 ${state}${unread ? " · 有未讀完成" : ""}${activity ? ` · ${activity}` : ""}${metadata ? ` · ${metadata}` : ""}`,
    },
    completion: {
      markAllRead: "全部已讀",
      unavailable: "完成來源不可用",
      rebuilt: "完成來源不連續，已重新建立基準",
      unread: "完成後尚未閱讀",
      saveFailed: "完成紀錄無法儲存",
      partial: "部分完成來源不可用或超過上限",
      profilePartial: "部分設定檔完成來源不可用",
    },
    errors: {
      liveSessionFormat: "即時工作階段回應格式不支援",
      responseFormat: "回應格式不支援",
      completionEventFormat: "完成快照事件格式不支援",
      completionSourceFormat: "完成快照來源格式不支援",
      completionSnapshotFormat: "完成快照格式不支援",
      completionDataFormat: "完成快照資料格式不支援",
      projectFormat: "專案回應格式不支援",
      projectNoPath: "專案沒有可用的資料夾路徑",
      sessionFormat: "工作階段回應格式不支援",
      missingProjectId: "建立回應缺少專案 ID，結果未知",
      missingSessionId: "建立回應缺少工作階段 ID",
      rootChangedDialog: "後端根目錄已變更，請重新開啟對話框",
      rootChangedBrowser: "後端根目錄已變更，請重新開啟瀏覽器",
      routeNotUnique: "找不到唯一的設定檔路由",
      unknown: "未知錯誤",
      otherProfilesUnsupported: "此版本不支援讀取其他設定檔",
      routingUnsupported: "此版本不支援連線路由",
      openUnsupported: "此版本不支援開啟工作階段",
      createOtherUnsupported: "此版本只能建立目前設定檔的工作階段",
      openOtherUnsupported: "此版本只能開啟目前設定檔",
      projectUiUnsupported: "此版本缺少建立專案所需的公開路由或介面元件",
      statusFormat: "狀態來源格式不支援",
      emptyGeneration: "生成回應沒有內容",
      backendUnavailable: "目前連線的後端不可用",
      folderFormat: "資料夾回應格式不支援",
      routeFormat: "路由清單格式不支援",
      connectionChanged: "連線已變更",
      routeLoadFailure: error => `設定檔路由無法載入：${error}`,
      timeout: label => `${label}逾時`,
    },
    activity: {
      childDisclaimer: "子代理排隊／近期活動，非執行證明。",
      observed: count => `已觀察到 ${count} 個執行中的 turn；僅涵蓋可驗證的 native active-turn lease，可能有遺漏，並非全部工作。`,
    },
    folder: {
      unknownShort: "建立結果未知，請先核對資料夾",
      unknownRetry: "建立結果未知，請先核對；不可重試。",
      create: "建立資料夾",
      new: "新增資料夾",
      description: "瀏覽目前 gateway 後端可存取的資料夾；不是此裝置的本機檔案系統。",
      browse: "瀏覽資料夾",
      backendUnavailable: "目前連線的資料夾後端不可用；請重新開啟並確認連線。",
      invalidName: "請輸入有效的資料夾名稱",
      name: "資料夾名稱",
      hierarchy: "資料夾階層",
      loadingRoot: "載入根目錄…",
      selectCurrent: "選取目前資料夾",
      choose: "選擇資料夾",
      loadFailure: error => `資料夾無法載入：${error}`,
      unknownFailure: error => `建立結果未知，請先核對資料夾；不可自動重試。 ${error}`,
      remove: path => `移除 ${path}`,
    },
    session: {
      quickCreate: "快速新增",
      limit: "最多顯示已取得的 200 筆",
      untitled: "未命名",
      findingRoute: "正在尋找設定檔路由…",
      empty: "沒有工作階段",
      loading: "載入工作階段…",
      retryOpen: "重試開啟",
      showMore: "顯示更多工作階段",
      openFailure: error => `開啟失敗：${error}，請再試一次`,
      loadFailure: error => `工作階段無法載入：${error}`,
      createdOpenFailure: (id, error) => `已建立 ${id}，開啟失敗；重試只會開啟：${error}`,
      newInProject: project => `在 ${project} 新增對話`,
    },
  },
}
let pluginI18n=null
const english=(key,...args)=>{const value=key.split('.').reduce((part,name)=>part?.[name],messages.en);return typeof value==='function'?value(...args):typeof value==='string'?value:key}
const tr=(key,...args)=>pluginI18n?.t?.(key,...args)??english(key,...args)
// Keep plugin error keys separate from external error text, including across locale changes.
class LocalizedError extends Error {constructor(key){super(english(key));this.localizationKey=key}}
class LocalizedTimeoutError extends Error {constructor(label){super(english('errors.timeout',english(label)));this.label=label}}
const errorMessage=(e,t=tr)=>e instanceof LocalizedError?t(e.localizationKey):e instanceof LocalizedTimeoutError?t('errors.timeout',english(e.label)!==e.label?t(e.label):e.label):(e?.message||'')
const localizeError=value=>typeof value?.message==='function'?value.message():value
// Render with the hook's translator, not ctx.i18n.t: the SDK updates the latter
// in an effect after React has rendered the newly selected locale.
const TranslationContext=createContext(null)
function LocalizedRoot({children}){const hook=typeof sdk.usePluginI18n==='function'?sdk.usePluginI18n('profile-rail'):null,t=pluginI18n&&hook?hook:english;return jsx(TranslationContext.Provider,{value:t,children})}
function useTranslator(){const current=useContext(TranslationContext)||tr,ref=useRef(current);ref.current=current;return useCallback((...args)=>ref.current(...args),[])}
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
 return Promise.race([Promise.resolve().then(task),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new LocalizedTimeoutError(label)),DEADLINE)})]).finally(()=>clearTimeout(timer))
}
async function requestOwner(owner,method,params,spawnPriority='background'){
 if(typeof host.requestProfile==='function') return bounded(()=>host.requestProfile(owner.route,method,params,DEADLINE,{spawnPriority}),method)
 if(host.state.connectionId.get()===owner.connectionId && host.state.profile.get()===owner.name && typeof host.request==='function') return bounded(()=>host.request(method,params),method)
 throw new LocalizedError('errors.otherProfilesUnsupported')
}
async function recentData(owner,spawnPriority='background'){
 let result
 try { result=await requestOwner(owner,'session.list',{limit:200,scope:'stored'},spawnPriority); if(result?.error) throw result.error }
 catch(e){if(!scopeError(e)) throw e;result=await requestOwner(owner,'session.list',{limit:200},spawnPriority)}
 if(result?.error || !Array.isArray(result?.sessions) || (result.scope!=null && result.scope!=='stored')) throw new LocalizedError('errors.sessionFormat')
 // Canonical stored history excludes open canonical sessions; legacy has no scope.
 let sessions=result.sessions
 if(result.scope==='stored'){
  const live=await requestOwner(owner,'session.list',{limit:200,scope:'live'},spawnPriority)
  if(live?.error || live?.scope!=='live' || !Array.isArray(live.sessions)) throw new LocalizedError('errors.liveSessionFormat')
  sessions=[...live.sessions,...sessions]
 }
 // Both supported stored-list implementations return MRU order but omit the
 // activity timestamp. started_at is creation time, not a sorting substitute.
 const seen=new Set(), rows=sessions.filter(x=>typeof x?.id==='string'&&x.id&&!seen.has(x.id)&&seen.add(x.id)).slice(0,200).map(x=>({id:x.id,title:typeof x.title==='string'?x.title:'',source:typeof x.source==='string'?x.source:null,last_active:x.last_active,updated_at:x.updated_at,started_at:x.started_at}))
 return {rows}
}
async function projectData(owner,spawnPriority='background'){
 const tree=await requestOwner(owner,'projects.tree',{session_limit:2000,preview_limit:1},spawnPriority)
 if(tree?.error || !Array.isArray(tree?.projects)) throw new LocalizedError('errors.projectFormat')
 const projects=new Map()
 for(const p of tree.projects){const label=p.isNoProject?{fallback:'project.home'}:typeof p.label==='string'&&p.label.trim()?p.label:{fallback:'project.uncategorized'};for(const id of p.sessionIds||[]) if(typeof id==='string'&&!projects.has(id)) projects.set(id,label);for(const repo of p.repos||[]) for(const group of repo.groups||[]) for(const row of group.sessions||[]) if(typeof row.id==='string'&&!projects.has(row.id)) projects.set(row.id,label)}
 return {labels:Object.fromEntries(projects),choices:tree.projects.filter(p=>!p.isNoProject&&Array.isArray(p.sessionIds)&&p.sessionIds.some(id=>typeof id==='string'&&id)).map(p=>{const path=typeof p.path==='string'&&p.path.trim()?p.path.trim():(p.repos||[]).find(r=>typeof r.path==='string'&&r.path.trim())?.path?.trim()||'';return {id:p.id,label:p.label||p.id||{fallback:'project.untitled'},path,icon:typeof p.icon==='string'&&p.icon.trim()?p.icon.trim():'',color:typeof p.color==='string'?p.color:'',isAuto:!!p.isAuto}})}
}
function routeFor(name,connectionId,activeProfile,routes){
 if(routes===null){if(connectionId==null) return name;throw new LocalizedError('errors.routingUnsupported')}
 if(!Array.isArray(routes)) throw new LocalizedError('errors.routeFormat')
 const valid=routes.filter(r=>r && typeof r.connectionId==='string'&&r.connectionId.trim()&&typeof r.profile==='string'&&r.profile.trim()&&typeof r.targetProfile==='string'&&r.targetProfile.trim()&&['local','remote'].includes(r.mode))
 let source=connectionId
 if(source==null){const primary=valid.filter(r=>r.mode==='local'&&r.profile===activeProfile&&r.primary===true);if(primary.length===1) source=primary[0].connectionId;else {const local=[...new Set(valid.filter(r=>r.mode==='local'&&r.profile===activeProfile).map(r=>r.connectionId))];if(local.length===1) source=local[0]}}
 const matches=valid.filter(r=>r.connectionId===source&&r.profile===name)
 if(matches.length!==1) throw new LocalizedError('errors.routeNotUnique')
 return matches[0]
}
async function openOwned(owner,id){
 if(typeof host.openSession!=='function') throw new LocalizedError('errors.openUnsupported')
 if(typeof owner.route==='string'){
  if(host.state.connectionId.get()!==owner.connectionId || host.state.profile.get()!==owner.name) throw new LocalizedError('errors.openOtherUnsupported')
  return host.openSession(id,{profile:owner.name,intent:'in-place'})
 }
 return host.openSession(id,{route:owner.route,intent:'in-place'})
}
function Recent({owner,phase,retryRoutes,onOpened,completion,settings={showCron:true}}){
 const tr=useTranslator()
 const [count,setCount]=useState(3),[generation,setGeneration]=useState(0),[projectGeneration,setProjectGeneration]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),rowLock=useRef(false)
 async function open(id){if(rowLock.current)return;rowLock.current=true;setBusy(true);setError('');const watermark=completion.watermark(owner,id);try{await openOwned(owner,id);await completion.ack(owner,id,watermark);onOpened()}catch(e){setError({message:()=>tr('session.openFailure',errorMessage(e,tr)||tr('errors.unknown'))})}finally{rowLock.current=false;setBusy(false)}}
 const route=owner?.route, key=[owner?.connectionId,owner?.name,typeof route==='string'?'legacy':route?.connectionId,route?.profile,route?.targetProfile,route?.mode]
 // Consume the open/retry intent once; interval and focus callbacks stay background.
 const recentIntent=useRef(null),intentKey=JSON.stringify([...key,generation])
 const result=useQuery({queryKey:['profile-rail','recent',...key,generation],queryFn:()=>{const priority=recentIntent.current===intentKey?'background':'foreground';recentIntent.current=intentKey;return recentData(owner,priority)},enabled:!!owner,retry:false,refetchOnMount:'always',refetchOnWindowFocus:true,refetchInterval:15000})
 const q=result.data?{...result,data:{...result.data,rows:result.data.rows.filter(row=>settings.showCron||row.source!=='cron')}}:result
 const projectIntent=useRef(0)
 const projects=useQuery({queryKey:['profile-rail','projects',...key,projectGeneration],queryFn:()=>{const priority=projectIntent.current===projectGeneration?'background':'foreground';projectIntent.current=projectGeneration;return projectData(owner,priority)},enabled:!!owner,retry:false})
 if(!owner) return jsxs('div',{style:s.sessions,children:[jsx('span',{children:phase==='loading'?tr('session.findingRoute'):localizeError(phase)||tr('common.connectionNotReady')}),phase!=='loading'?jsx('button',{onClick:retryRoutes,children:tr('common.retry')}):null]})
 if(q.isPending) return jsx('div',{style:s.sessions,children:q.fetchStatus==='idle'?tr('common.connectionNotReady'):tr('session.loading')})
 if(q.isError) return jsxs('div',{style:s.sessions,children:[jsx('span',{children:tr('session.loadFailure',localizeError(errorMessage(q.error,tr)||tr('errors.unknown')))}),jsx('button',{onClick:()=>setGeneration(n=>n+1),children:tr('common.retry')})]})


 const ellipsis={whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',minWidth:0}
 const projectLabel=id=>projects.isError?tr('project.loadFailed'):projects.isPending?tr('project.loading'):(typeof projects.data?.labels?.[id]==='object'?tr(projects.data.labels[id].fallback):projects.data?.labels?.[id])||tr('project.uncategorized')
 return jsxs('div',{style:{minHeight:0,display:'flex',flexDirection:'column',flex:'1 1 auto',marginTop:12},children:[jsx('div',{'data-recent-list':true,style:{...s.sessions,maxHeight:260,overflowY:'auto'},children:q.data.rows.length?q.data.rows.slice(0,count).map(row=>jsxs('button',{'data-recent-row':true,type:'button',disabled:busy,onClick:()=>open(row.id),style:{position:'relative',height:52,boxSizing:'border-box',minWidth:0,width:'100%',display:'flex',alignItems:'center',gap:10,textAlign:'left',color:'inherit',border:0,borderRadius:7,padding:'9px 8px',background:'transparent',cursor:'pointer'},children:[completion.watermark(owner,row.id).length?jsx('span',{'data-session-completion-badge':true,role:'img','aria-label':tr('completion.unread'),style:{position:'absolute',top:0,left:0,fontSize:10,lineHeight:1,pointerEvents:'none'},children:'✋'}):null,jsxs('span',{style:{minWidth:0,flex:'1 1 auto'},children:[jsx('strong',{style:{...ellipsis,display:'block',fontSize:12,color:'var(--ui-text-primary)'},title:row.title||tr('session.untitled'),children:row.title||tr('session.untitled')}),jsx('span',{style:{...ellipsis,display:'block',fontSize:11,marginTop:4},title:projectLabel(row.id),children:'▧ '+projectLabel(row.id)})]}),jsx('span',{'aria-hidden':true,children:'›'})]},row.id)):tr('session.empty')}),error?jsx('div',{role:'alert',children:localizeError(error)}):null,projects.isError?jsx('button',{onClick:()=>setProjectGeneration(n=>n+1),children:tr('project.retry')}):null,jsxs('div',{'data-recent-footer':true,style:{position:'relative',display:'flex',alignItems:'center',justifyContent:'center',minHeight:18,flexShrink:0},children:[count<q.data.rows.length?jsx('button',{'data-recent-more':true,type:'button',onClick:()=>setCount(n=>n+10),style:{...s.button,border:0,padding:'0 8px',height:18,lineHeight:'18px'},'aria-label':tr('session.showMore'),children:tr('common.loadMore')}):null,jsx('button',{'data-completion-read-all':true,type:'button',disabled:!completion.coverageReady,onClick:()=>void completion.ackAll(owner),style:{...s.button,position:'absolute',right:0,border:0,padding:'0 8px',height:18,lineHeight:'18px'},children:tr('completion.markAllRead')})]}),q.data.rows.length>=200?jsx('small',{children:tr('session.limit')}):null]})
}
function FolderBreadcrumbs({root,path,busy,go}){
 const tr=useTranslator()
 if(!root)return jsx('span',{children:tr('folder.loadingRoot')})
 const parts=path.split('/').filter(Boolean)
 return jsxs('nav',{'aria-label':tr('folder.hierarchy'),className:'shrink-0 flex flex-wrap items-center gap-1 border-b border-border/50 px-3 py-2 text-xs text-muted-foreground',children:[jsx('button',{type:'button',disabled:busy,onClick:()=>go('/'),className:'rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground',children:'/'}),...parts.map((part,i)=>jsx('button',{type:'button',disabled:busy,onClick:()=>go('/'+parts.slice(0,i+1).join('/')),className:'rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground',children:part},i))]})
}
function FolderBrowser({rest,valid,onCancel,onSelect,mkdirUnknown}){
 const tr=useTranslator()
 const [path,setPath]=useState(''),[items,setItems]=useState([]),[root,setRoot]=useState(null),[cursor,setCursor]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[directoryId,setDirectoryId]=useState(''),[folderName,setFolderName]=useState(null),[folderError,setFolderError]=useState(''),[creating,setCreating]=useState(false),[refreshPath,setRefreshPath]=useState(null)
 const seq=useRef(0),alive=useRef(false),rootRef=useRef(null),createLock=useRef(false)
 useEffect(()=>{alive.current=true;return ()=>{alive.current=false;seq.current++}},[])
 async function load(next,after=null){
  const n=++seq.current;setBusy(true);setError('');setFolderName(null)
  try{
   if(!valid()||typeof rest!=='function')throw new LocalizedError('errors.backendUnavailable')
   const data=await rest('/folders',{method:'POST',body:next===null?{}:{path:next,after,limit:50},timeoutMs:30000})
   if(!alive.current||n!==seq.current||!valid())return
   const absolute=p=>typeof p==='string'&&p.startsWith('/')&&(p==='/'||(!p.endsWith('/')&&!p.split('/').slice(1).some(x=>x==='.'||x==='..'||!x)))
   if(!data||data.scope!==(next===null?'gateway-hermes-root':'gateway-filesystem')||!absolute(data.root)||!absolute(data.path)||(next!==null&&data.path!==next)||(next===null&&data.path!==data.root)||typeof data.root_id!=='string'||!data.root_id||typeof data.directory_id!=='string'||!data.directory_id||!Array.isArray(data.directories)||data.directories.some(x=>typeof x!=='string'||!x||x==='.'||x==='..'||/[\\/]/.test(x))||!(data.next_after===null||typeof data.next_after==='string'))throw new LocalizedError('errors.folderFormat')
   if(rootRef.current&&(rootRef.current.id!==data.root_id||rootRef.current.path!==data.root))throw new LocalizedError('errors.rootChangedBrowser')
   rootRef.current={id:data.root_id,path:data.root,runtimeId:data.runtime_id};setRoot(rootRef.current);setPath(data.path);setItems(old=>after?[...old,...data.directories]:data.directories);setCursor(data.next_after);setDirectoryId(data.directory_id);setRefreshPath(null)
  }catch(e){if(alive.current&&n===seq.current)setError({message:()=>tr('folder.loadFailure',errorMessage(e,tr)||tr('errors.unknown'))})}finally{if(alive.current&&n===seq.current)setBusy(false)}
 }
 useEffect(()=>{void load(null)},[])
 async function createFolder(){
  const name=(folderName||'').trim();if(createLock.current||mkdirUnknown.current||!directoryId||!valid())return
  if(!name||name==='.'||name==='..'||/[\\/\0]/.test(name)||name.length>255){setFolderError({message:()=>tr('folder.invalidName')});return}
  createLock.current=true;setCreating(true);setFolderError('');mkdirUnknown.current=true
  try{const result=await rest('/folders/mkdir',{method:'POST',body:{path,name,root_id:root.id,parent_id:directoryId},timeoutMs:30000});if(!result||result.root_id!==root.id||result.parent_id!==directoryId||result.name!==name||result.path!==(path==='/'?'':path)+'/'+name||typeof result.directory_id!=='string'||!result.directory_id)throw new LocalizedError('errors.responseFormat');mkdirUnknown.current=false;if(alive.current&&valid()){setRefreshPath(path);await load(path)}}
  catch(e){if(alive.current)setFolderError({message:()=>tr('folder.unknownFailure',errorMessage(e,tr)||'')})}finally{createLock.current=false;if(alive.current)setCreating(false)}
 }
 const D=sdk.Dialog,C=sdk.DialogContent,T=sdk.DialogTitle,Desc=sdk.DialogDescription,B=sdk.Button,G=sdk.Codicon,I=sdk.Input
 const row=(name,disabled,onClick)=>jsxs('button',{type:'button',disabled,onClick,className:'row-hover flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-(--ui-text-secondary) hover:text-foreground disabled:pointer-events-none disabled:opacity-40',children:[jsx(G,{name:'folder',size:'0.875rem','aria-hidden':true}),jsx('span',{className:'min-w-0 truncate',children:name})]},name)
 return jsx(D,{open:true,onOpenChange:open=>{if(!open)onCancel()},children:jsxs(C,{className:'h-[min(36rem,calc(100vh-4rem))] max-w-lg',bodyClassName:'flex min-h-0 flex-col gap-0 overflow-hidden p-0',onInteractOutside:e=>e.preventDefault(),onEscapeKeyDown:e=>{if(folderName!==null){e.preventDefault();setFolderName(null);setFolderError('')}},children:[jsxs('div',{className:'shrink-0 border-b border-border/70 px-4 py-3',children:[jsx(T,{className:'text-sm',children:tr('folder.choose')}),jsx(Desc,{className:'mt-1 text-xs',children:tr('folder.description')})]}),jsxs('div',{className:'flex min-h-0 flex-1 flex-col','data-folder-browser':true,children:[jsx(FolderBreadcrumbs,{root,path,busy:busy||creating,go:load}),jsxs('div',{className:'min-h-0 flex-1 overflow-y-auto p-2',children:[row('..',busy||creating||!path||path==='/',()=>load(path.slice(0,path.lastIndexOf('/'))||'/')),folderName!==null?jsxs('div',{className:'px-2 py-1',children:[jsxs('div',{className:'flex items-center gap-2',children:[jsx(G,{name:'new-folder',size:'0.875rem'}),jsx(I,{'aria-label':tr('folder.name'),autoFocus:true,disabled:creating,value:folderName,onChange:e=>{setFolderName(e.target.value);setFolderError('')},onKeyDown:e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();void createFolder()}},size:'sm'}),jsx(B,{'aria-label':tr('folder.create'),type:'button',disabled:creating||mkdirUnknown.current,onClick:createFolder,size:'icon-xs',variant:'ghost',children:jsx(G,{name:creating?'loading':'check',size:'0.875rem',spinning:creating})})]}),folderError?jsx('div',{role:'alert',className:'mt-1 pl-6 text-xs text-destructive',children:localizeError(folderError)}):null]}):null,...items.map(name=>row(name,busy||creating,()=>load((path==='/'?'':path)+'/'+name))),cursor?jsx(B,{type:'button',variant:'ghost',disabled:busy||creating,onClick:()=>load(path,cursor),children:tr('common.loadMore')}):null,error?jsx('div',{role:'alert',children:localizeError(error)}):null]})]}),jsxs('div',{className:'shrink-0 flex items-center justify-between gap-2 border-t border-border/70 px-4 py-3',children:[jsx('div',{className:'min-w-0 truncate text-xs text-muted-foreground',children:path}),jsxs('div',{className:'flex shrink-0 items-center gap-2',children:[jsx(B,{type:'button',size:'sm',variant:'ghost',disabled:!directoryId||busy||creating||folderName!==null||!!error||mkdirUnknown.current,onClick:()=>setFolderName(''),title:mkdirUnknown.current?tr('folder.unknownShort'):'',children:jsxs('span',{children:[jsx(G,{name:'new-folder',size:'0.875rem'}),tr('folder.new')]})}),jsx(B,{type:'button',size:'sm',variant:'ghost',onClick:onCancel,children:tr('common.cancel')}),jsx(B,{type:'button',size:'sm',disabled:busy||creating||!root||!!error||!valid(),onClick:()=>onSelect({path,rootId:root.id,directoryId,runtimeId:root.runtimeId}),children:tr('folder.selectCurrent')})]})]}),refreshPath&&error?jsx(B,{type:'button',disabled:busy,onClick:()=>load(refreshPath),children:tr('common.retryRefresh')}):mkdirUnknown.current?jsx('small',{className:'px-4 pb-2 text-destructive',children:tr('folder.unknownRetry')}):null]})})
}
const DialogRestContext=createContext(null)
function ProjectDialog({owner:ownerProp,ownerName,isCurrent,onClose,onCreated,onRefresh,unknownProjects}){
 const tr=useTranslator()
 const dialogRest=useContext(DialogRestContext)
 const [owner]=useState(()=>({...ownerProp,route:Object.freeze({...ownerProp.route})}))
 const [name,setName]=useState(''),[paths,setPaths]=useState([]),[browsing,setBrowsing]=useState(false),[scopeLost,setScopeLost]=useState(false),[idea,setIdea]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[generating,setGenerating]=useState(false),[created,setCreated]=useState(null),[refreshFailed,setRefreshFailed]=useState(false),[round,setRound]=useState(0),[ideaState,setIdeaState]=useState(''),[ideaError,setIdeaError]=useState('')
 const mkdirUnknown=useRef(false),alive=useRef(true),lock=useRef(false),generation=useRef(false),route=owner.route,unknownKey=JSON.stringify([route.connectionId,route.targetProfile])
 useEffect(()=>{alive.current=true;return ()=>{alive.current=false}},[])
 const activation=typeof sdk.useGatewayActivationEpoch==='function'?sdk.useGatewayActivationEpoch():null
 const [scope]=useState(()=>({connection:host.state.connectionId.get(),profile:host.state.profile.get(),epoch:typeof sdk.gatewayActivationEpoch==='function'?sdk.gatewayActivationEpoch():null})),lost=useRef(false)
 const scopeValid=()=>!lost.current&&isCurrent()&&typeof scope.connection==='string'&&typeof host.activeConnectionId==='function'&&host.activeConnectionId()===scope.connection&&typeof scope.epoch==='number'&&sdk.gatewayActivationEpoch()===scope.epoch&&scope.connection===owner.connectionId&&scope.connection===owner.route.connectionId&&host.state.connectionId.get()===scope.connection&&host.state.profile.get()===scope.profile
 useEffect(()=>{const check=()=>{if(host.state.connectionId.get()!==scope.connection||host.state.profile.get()!==scope.profile){lost.current=true;setScopeLost(true);setPaths([]);setBrowsing(false)}};const a=host.state.connectionId.subscribe(check),b=host.state.profile.subscribe(check);return ()=>{a();b()}},[])
 useEffect(()=>{if(activation!==scope.epoch){lost.current=true;setScopeLost(true);setPaths([]);setBrowsing(false)}},[activation])
 const visible=()=>alive.current&&isCurrent()
 const groups=[[tr('project.ideaCategoryNotes'),tr('project.ideaNotes')],[tr('project.ideaCategoryHabits'),tr('project.ideaHabits')],[tr('project.ideaCategoryLearning'),tr('project.ideaLearning')],[tr('project.ideaCategoryCreative'),tr('project.ideaCreative')],[tr('project.ideaCategoryExplore'),tr('project.ideaExplore')],[tr('project.ideaCategoryTools'),tr('project.ideaTools')]]
 async function generate(){if(generation.current||lock.current)return;generation.current=true;setGenerating(true);setError('');try{const res=await requestOwner(owner,'llm.oneshot',{instructions:'You generate a single, concrete project idea as a short IDEA.md body: a one-line summary, then 3-5 bullet goals. No preamble, no code fences, under 120 words.',input:name.trim()?`Project name: ${name.trim()}`:'Surprise me with a fun project.',temperature:1.0},'foreground');if(res?.error)throw Error(res.error.message||String(res.error));if(typeof res?.text!=='string'||!res.text.trim())throw new LocalizedError('errors.emptyGeneration');if(visible())setIdea(res.text.trim())}catch(e){if(visible())setError({message:()=>tr('project.ideaFailure',errorMessage(e,tr)||tr('errors.unknown'))})}finally{generation.current=false;if(visible())setGenerating(false)}}
 async function refresh(project){try{await projectData(owner,'foreground');await onRefresh();if(visible()){setRefreshFailed(false);setError('')}}catch(e){if(visible()){setRefreshFailed(true);setError({message:()=>tr('project.refreshFailure',project.id,errorMessage(e,tr)||tr('errors.unknown'))})}}}
 async function saveIdea(project,folder,text){
  if(!text.trim())return
  try{if(!scopeValid()||!visible()||!dialogRest||project.path!==folder.path||!folder.directoryId||!folder.runtimeId)throw Error('scope or selected directory identity unavailable');const result=await dialogRest('/folders/idea',{method:'POST',body:{path:folder.path,root_id:folder.rootId,directory_id:folder.directoryId,runtime_id:folder.runtimeId,project_id:project.id,owner:owner.route.targetProfile,content:text},timeoutMs:30000});if(!scopeValid()||!result||result.status!=='saved'||result.project_id!==project.id||result.owner!==owner.route.targetProfile||result.path!==(folder.path==='/'?'':folder.path)+'/IDEA.md')throw Error('save outcome unknown');if(visible()){setIdeaState('saved');setIdeaError('')}}catch(e){if(alive.current){setIdeaState('failed');setIdeaError(errorMessage(e,tr)||'save outcome unknown')}}
 }
 async function submit(){if(lock.current||generation.current||!visible()||!scopeValid()||unknownProjects.current.has(unknownKey))return;const folders=paths.map(x=>x.path),folder=paths[0],text=idea;if(!name.trim()||!folders.length){setError({message:()=>tr('project.nameFoldersRequired')});return}lock.current=true;setBusy(true);setError('');unknownProjects.current.add(unknownKey);try{const result=await requestOwner(owner,'projects.create',{name:name.trim(),folders,primary_path:folders[0],use:false},'foreground');if(result?.error)throw Error(result.error.message||result.error.detail||String(result.error));const p=result?.project;if(!p||typeof p.id!=='string'||!p.id)throw new LocalizedError('errors.missingProjectId');unknownProjects.current.delete(unknownKey);const project={id:p.id,label:p.name||name.trim(),path:p.primary_path,icon:p.icon||'',color:p.color||'',folder};onCreated(project);if(alive.current){setCreated(project);if(visible()&&scopeValid()){await saveIdea(project,folder,text);if(scopeValid())await refresh(project)}else if(text.trim()){setError({message:()=>tr('project.ideaScopeLost')})}}}catch(e){const unknown=unknownProjects.current.has(unknownKey);if(visible())setError({message:()=>unknown?tr('project.unknownFailure',errorMessage(e,tr)||''): tr('common.creationFailure',errorMessage(e,tr)||tr('errors.unknown'))})}finally{lock.current=false;if(alive.current)setBusy(false)}}
 async function retryIdea(){if(lock.current||!created||!scopeValid())return;lock.current=true;setBusy(true);try{await saveIdea(created,created.folder,idea)}finally{lock.current=false;if(visible())setBusy(false)}}
 async function retryRefresh(){if(lock.current||!created)return;lock.current=true;setBusy(true);setError('');try{await refresh(created)}finally{lock.current=false;if(visible())setBusy(false)}}
 const D=sdk.Dialog,C=sdk.DialogContent,H=sdk.DialogHeader,T=sdk.DialogTitle,Desc=sdk.DialogDescription,F=sdk.DialogFooter,B=sdk.Button,I=sdk.Input,A=sdk.Textarea,G=sdk.Codicon
 return jsxs('div',{children:[jsx(D,{open:true,onOpenChange:open=>{if(!open&&!lock.current)onClose()},children:jsxs(C,{className:'max-w-md',onInteractOutside:e=>e.preventDefault(),children:[jsxs(H,{children:[jsx(T,{children:tr('project.newForOwner',ownerName)}),jsx(Desc,{children:tr('project.createDescription')})]}),jsxs('div',{style:{display:'flex',flexDirection:'column',gap:8},children:[jsx(I,{'aria-label':tr('project.name'),placeholder:tr('project.name'),value:name,disabled:busy||!!created,onChange:e=>setName(e.target.value)}),jsx('span',{children:tr('project.folders')}),...paths.map((item,index)=>jsxs('div',{className:'flex items-center gap-2 rounded-md bg-(--ui-control-hover-background) px-2 py-1 text-[0.75rem]',children:[jsx(G,{name:'folder',size:'0.75rem',className:'shrink-0 text-(--ui-text-tertiary)'}),jsx('span',{className:'min-w-0 flex-1 truncate',title:item.path,children:item.path}),index===0?jsx('span',{className:'shrink-0 text-[0.625rem] uppercase text-(--ui-text-quaternary)',children:tr('common.primary')}):null,jsx(B,{type:'button',variant:'ghost',size:'icon-xs',className:'size-5 shrink-0 text-(--ui-text-quaternary) hover:text-foreground',disabled:busy||!!created,'aria-label':tr('folder.remove',item.path),onClick:()=>setPaths(old=>old.filter(x=>x.path!==item.path)),children:jsx(G,{name:'close',size:'0.75rem'})})]},item.path)),jsx(B,{type:'button',disabled:busy||!!created||!dialogRest||!scopeValid(),onClick:()=>setBrowsing(true),children:tr('folder.browse')}),!dialogRest||scopeLost||!scopeValid()?jsx('small',{children:tr('folder.backendUnavailable')}):null,jsxs('div',{style:{display:'flex',flexDirection:'column',gap:6},children:[jsx('span',{children:tr('project.idea')}),jsx(A,{'aria-label':tr('project.idea'),value:idea,disabled:generating||busy||ideaState==='saved',onChange:e=>setIdea(e.target.value)}),jsx('small',{children:tr('project.ideaCopyHelp')}),jsx(B,{type:'button',disabled:busy||generating||!!created,onClick:generate,children:generating?tr('project.generating'):tr('project.generateIdea')}),jsxs('div',{style:{display:'flex',flexWrap:'wrap',gap:4},children:[...Array.from({length:3},(_,i)=>groups[(round+i)%groups.length]).map(([label,text])=>jsx(B,{type:'button',variant:'ghost',disabled:busy||generating||!!created,onClick:()=>setIdea(text),children:label},label)),jsx(B,{type:'button',variant:'ghost','aria-label':tr('project.refreshIdeas'),onClick:()=>setRound(n=>(n+3)%groups.length),children:jsx(G,{name:'refresh',size:'0.75rem'})})]})]}),created?jsx('div',{children:tr('project.created',created.label,created.id)}):null,ideaState==='failed'?jsx('div',{role:'alert',children:tr('project.ideaSaveFailure',ideaError)}):ideaState==='saved'?jsx('div',{children:tr('project.ideaSaved')}):null,error?jsx('div',{role:'alert',children:localizeError(error)}):null,jsxs(F,{children:[jsx(B,{type:'button',variant:'ghost',disabled:busy,onClick:onClose,children:created?tr('common.close'):tr('common.cancel')}),ideaState==='failed'?jsx(B,{type:'button',disabled:busy||!scopeValid(),onClick:retryIdea,children:tr('project.ideaRetry')}):null,refreshFailed?jsx(B,{type:'button',disabled:busy,onClick:retryRefresh,children:tr('common.retryRefresh')}):!created?jsx(B,{type:'button',disabled:busy||generating||!paths.length||!scopeValid()||unknownProjects.current.has(unknownKey),onClick:submit,children:busy?tr('common.creating'):tr('common.create')}):null]})]})]})}),browsing?jsx(FolderBrowser,{rest:dialogRest,valid:scopeValid,mkdirUnknown,onCancel:()=>setBrowsing(false),onSelect:item=>{if(!scopeValid())return;if(paths.length&&paths[0].rootId!==item.rootId){setError({message:()=>tr('errors.rootChangedDialog')});return}setPaths(old=>old.some(x=>x.path===item.path)?old:[...old,item]);setName(old=>old.trim()||item.path.split('/').filter(Boolean).pop()||old);setBrowsing(false)}}):null]})
}
function Launchers({owner,ownerName,isCurrent,onOpened,pending,projectOpen,setProjectOpen,createdProjects,dialogActive,unknownProjects}){
 const tr=useTranslator()
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[projectGeneration,setProjectGeneration]=useState(0),[dialogOpen,setDialogOpen]=useState(false),lock=useRef(false),projectTrigger=useRef(null),[projectLayout,setProjectLayout]=useState({side:'bottom',maxHeight:220})
 useEffect(()=>{if(!projectOpen)return;const update=()=>{const r=projectTrigger.current?.closest('[data-slot="popover-content"]')?.getBoundingClientRect();if(!r)return;const desired=Math.min(220,innerHeight*.325-7.5),available=Math.max(0,Math.max(r.top,innerHeight-r.bottom)-12),room=innerWidth-r.right>=r.width+12,horizontal=available<desired&&room,overlay=available<76&&!room;setProjectLayout({side:horizontal?'right':'bottom',maxHeight:horizontal||overlay?desired:Math.min(desired,available),overlay,sideOffset:overlay?Math.max(0,Math.min(r.top,innerHeight-desired))-r.bottom:undefined,alignOffset:overlay?Math.max(0,Math.min(r.left,innerWidth-r.width-2))-r.left:undefined})};update();window.addEventListener('resize',update);window.addEventListener('scroll',update,true);return()=>{window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true)}},[projectOpen])
 const dialogAvailable=!!owner&&typeof owner.route==='object'&&!!owner.route&&typeof host.requestProfile==='function'&&['Dialog','DialogContent','DialogHeader','DialogTitle','DialogDescription','DialogFooter','Button','Input','Textarea'].every(k=>!!sdk[k])
 useEffect(()=>()=>{dialogActive.current=false},[dialogActive])
 const route=owner?.route, queryKey=['profile-rail','projects',owner?.connectionId,owner?.name,typeof route==='string'?'legacy':route?.connectionId,route?.profile,route?.targetProfile,route?.mode,projectGeneration]
 const projectIntent=useRef(0)
 const projects=useQuery({queryKey,queryFn:()=>{const priority=projectIntent.current===projectGeneration?'background':'foreground';projectIntent.current=projectGeneration;return projectData(owner,priority)},enabled:!!owner,retry:false})
 const key=JSON.stringify([owner?.connectionId,owner?.name,owner?.route])
 const unknownKey=JSON.stringify([route?.connectionId,route?.targetProfile])
 const unknownWarning=tr('project.unknownWarning')
 const choices=[...(projects.data?.choices||[])];for(const project of createdProjects.current.get(key)||[])if(!choices.some(p=>p.id===project.id))choices.push(project)
 function createProject(){if(!dialogAvailable||dialogActive.current||unknownProjects.current.has(unknownKey))return;dialogActive.current=true;setDialogOpen(true)}
 function closeDialog(){dialogActive.current=false;setDialogOpen(false)}
 function rememberProject(project){const rows=createdProjects.current.get(key)||[];createdProjects.current.set(key,[...rows.filter(x=>x.id!==project.id),project]);try{Promise.resolve(sdk.queryClient?.invalidateQueries?.({queryKey:queryKey.slice(0,-1),refetchType:'none'})).catch(()=>{})}catch{}if(isCurrent())setProjectGeneration(n=>n+1)}
 async function refreshProjects(){if(sdk.queryClient?.invalidateQueries)await sdk.queryClient.invalidateQueries({queryKey:queryKey.slice(0,-1),refetchType:'none'});if(isCurrent())setProjectGeneration(n=>n+1)}
 async function create(project=null){
  if(lock.current||!owner)return
  let record=pending.current.get(key)
  if(record?.inflight){setError({message:()=>tr('project.inProgress')});return}
  record=record||{id:null,inflight:false};pending.current.set(key,record);record.inflight=true
  lock.current=true;setBusy(true);setError('')
  let id=record.id
  try{
   if(!id){
    if(project&&!project.path)throw new LocalizedError('errors.projectNoPath')
    const params=project?{source:'desktop',cwd:project.path,cwd_explicit:true}:{source:'desktop'}
    let result
    if(typeof owner.route==='string'&&(host.state.connectionId.get()!==owner.connectionId||host.state.profile.get()!==owner.name))throw new LocalizedError('errors.createOtherUnsupported')
    if(typeof host.requestProfile==='function') result=await host.requestProfile(owner.route,'session.create',params,undefined,{spawnPriority:'foreground'})
    else if(host.state.connectionId.get()===owner.connectionId&&host.state.profile.get()===owner.name) result=await host.request('session.create',params)
    else throw new LocalizedError('errors.createOtherUnsupported')
    if(result?.error) throw Error(result.error.message||result.error.detail||String(result.error))
    id=result?.stored_session_id||result?.session_key||result?.session_id
    if(!id)throw new LocalizedError('errors.missingSessionId')
    record.id=id
   }
   if(!isCurrent())return
   await openOwned(owner,id)
   pending.current.delete(key)
   if(isCurrent())onOpened()
  }catch(e){if(!id)pending.current.delete(key);if(isCurrent())setError({message:()=>(id?tr('session.createdOpenFailure',id,errorMessage(e,tr)||tr('errors.unknown')):tr('common.creationFailure',errorMessage(e,tr)||tr('errors.unknown')))})}
  finally{record.inflight=false;lock.current=false;setBusy(false)}
 }
 const ellipsis={display:'block',minWidth:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}
 const Glyph=sdk.Codicon||'span'
 return jsxs('div',{style:{flexShrink:0},children:[dialogOpen?jsx(ProjectDialog,{owner,ownerName,isCurrent,onClose:closeDialog,onCreated:rememberProject,onRefresh:refreshProjects,unknownProjects}):null,jsxs('div',{style:s.footer,children:[jsx('button',{type:'button',disabled:busy||!owner,onClick:()=>create(),style:{...s.button,flex:1,minWidth:0},children:pending.current.get(key)?.id?tr('session.retryOpen'):jsxs('span',{style:{display:'inline-flex',alignItems:'center',gap:4},children:[jsx(Glyph,{name:'add',size:'0.75rem','aria-hidden':true}),tr('session.quickCreate')]})}),jsxs(Popover,{open:projectOpen,onOpenChange:open=>{if(open||!dialogActive.current)setProjectOpen(open)},children:[jsx(PopoverTrigger,{asChild:true,children:jsx('span',{'aria-hidden':true,tabIndex:-1,style:{position:'absolute',inset:0,pointerEvents:'none'}})}),jsx('button',{ref:projectTrigger,type:'button',disabled:busy||!owner,'aria-expanded':projectOpen,'aria-haspopup':'dialog',onClick:()=>setProjectOpen(!projectOpen),style:{...s.button,flex:1,minWidth:0},children:tr('project.open')}),jsxs(PopoverContent,{side:projectLayout.side,align:'start',avoidCollisions:!projectLayout.overlay,sideOffset:projectLayout.sideOffset,alignOffset:projectLayout.alignOffset,onCloseAutoFocus:e=>{e.preventDefault();projectTrigger.current?.focus({preventScroll:true})},onInteractOutside:e=>{if(dialogActive.current||projectTrigger.current?.closest('[data-slot="popover-content"]')?.contains(e.target))e.preventDefault()},style:{...s.bubble,padding:'min(16px, 2vh)',maxHeight:projectLayout.maxHeight,overflow:'hidden'},children:[jsxs('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,height:30},children:[jsx('strong',{children:tr('project.title')}),jsx('button',{type:'button','aria-label':tr('project.new'),title:unknownProjects.current.has(unknownKey)?tr('project.unknownList'):dialogAvailable?tr('project.newForProfile'):tr('errors.projectUiUnsupported'),disabled:busy||!dialogAvailable||unknownProjects.current.has(unknownKey),onClick:()=>void createProject(),style:{...s.button,border:0},children:jsx(Glyph,{name:'add',size:'0.75rem','aria-hidden':true})})]}),unknownProjects.current.has(unknownKey)?jsx('div',{role:'alert',children:unknownWarning,style:{fontSize:12,overflowY:'auto',flexShrink:1}}):null,projects.isPending&&!choices.length?tr('project.loadingList'):projects.isError&&!choices.length?jsxs('div',{role:'alert',children:[tr('project.loadFailed'),jsx('button',{onClick:()=>setProjectGeneration(n=>n+1),children:tr('project.retry')})]}):!choices.length?tr('project.empty'):jsx('div',{'data-project-list':true,style:{minHeight:0,maxHeight:96,overflowY:'auto',flex:'0 1 auto'},children:choices.map(project=>jsxs('div',{'data-project-row':true,style:{height:32,boxSizing:'border-box',flexShrink:0,display:'flex',alignItems:'center',gap:8,minWidth:0},children:[project.color&&!project.icon?jsx('span',{'data-project-icon':'color','aria-hidden':true,style:{width:14,height:14,display:'grid',placeItems:'center',flex:'none'},children:jsx('span',{style:{width:4,height:4,borderRadius:'50%',background:project.color}})}):jsx('span',{'data-project-icon':project.icon||(project.isAuto?'repo':'folder-library'),'aria-hidden':true,style:{color:project.color||'var(--ui-text-tertiary)',width:14,flex:'none'},children:jsx(Glyph,{name:project.icon||(project.isAuto?'repo':'folder-library'),size:'0.875rem'})}),jsx('div',{style:{minWidth:0,flex:'1 1 auto'},children:jsx('strong',{'data-project-name':true,title:typeof project.label==='object'?tr(project.label.fallback):project.label,style:{...ellipsis,fontSize:12},children:typeof project.label==='object'?tr(project.label.fallback):project.label})}),jsx('button',{type:'button',disabled:busy,'aria-label':tr('session.newInProject',typeof project.label==='object'?tr(project.label.fallback):project.label),onClick:()=>create(project),style:{...s.button,border:0,flex:'none'},children:jsx(Glyph,{name:'add',size:'0.75rem','aria-hidden':true})})]},project.id))})]})]})]}),error?jsx('div',{role:'alert',children:localizeError(error)}):null]})
}
function statusText(value){
 const text=typeof value==='string'?value.replace(/\s+/gu,' ').trim():''
 if(!text) return ''
 const parts=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text)].map(x=>x.segment):Array.from(text.matchAll(/(?:\P{Mark}\p{Mark}*|\p{Mark}+)(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}])?(?:\u200D(?:\P{Mark}\p{Mark}*)(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}])?)*/gu),x=>x[0])
 return parts.slice(0,28).join('')
}
const quoteDefaults={working:'status.workingQuote',waiting:'status.waitingQuote',idle:'status.idleQuote',online_unobserved:'status.onlineUnobservedQuote',offline:'status.offlineQuote',unknown:'status.unknownQuote'}
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
 const tr=useTranslator()
 const [text,setText]=useState(''),[draft,setDraft]=useState(''),[editing,setEditing]=useState(false),[expanded,setExpanded]=useState(false),[error,setError]=useState(''),[ready,setReady]=useState(false),[busy,setBusy]=useState(false)
 const alive=useRef(false),lock=useRef(false),key=ownerKey+':quote-v1:'+state
 useEffect(()=>{let active=true;alive.current=true;setReady(false);Promise.resolve().then(async()=>{if(typeof storage?.get!=='function')throw Error('storage.get unavailable');const legacy=await storage.get(ownerKey),saved=await storage.get(key);const raw=saved==null?legacy:saved;const first=saved!=null&&Array.isArray(raw)?raw[0]:raw;if(first!=null&&typeof first!=='string')throw Error('invalid quote');if(active){setText(statusText(first));setReady(true)}}).catch(()=>{if(active)setError({message:()=>tr('status.readFailed')})});return()=>{active=false;alive.current=false}},[storage,ownerKey,key])
 const value=text||tr(quoteDefaults[state])
 const quoteRef=useRef(null),[preview,setPreview]=useState(value)
 useEffect(()=>{const el=quoteRef.current;if(!el)return;const fit=()=>{const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx){setPreview(value);return}const css=getComputedStyle(el);ctx.font=`${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;const parts=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(value)].map(x=>x.segment):Array.from(value);let next=value;if(ctx.measureText(next).width>el.clientWidth){while(parts.length&&ctx.measureText(parts.join('')+'...').width>el.clientWidth)parts.pop();next=parts.join('')+'...'}setPreview(next)};if(typeof ResizeObserver==='function'){const observer=new ResizeObserver(fit);observer.observe(el);fit();return()=>observer.disconnect()}setPreview(value)},[value])
 async function save(){if(lock.current||!ready)return;lock.current=true;setBusy(true);try{if(typeof storage?.set!=='function'||typeof storage?.get!=='function')throw Error();const clean=statusText(draft);await queueQuote(storage,key,async()=>{await storage.set(key,clean);const confirmed=await storage.get(key);if(confirmed!==clean)throw Error()});if(alive.current){setText(clean);setEditing(false);setError('')}}catch{if(alive.current)setError({message:()=>tr('status.saveFailed')})}finally{lock.current=false;if(alive.current)setBusy(false)}}
 return jsxs('div',{style:{minWidth:0,flexShrink:0},children:[jsxs('div',{style:{display:'flex',alignItems:'center',minWidth:0},children:[jsx('button',{ref:quoteRef,'data-status-quote':true,type:'button',onClick:()=>setExpanded(x=>!x),title:value,'aria-label':tr('status.label',value),style:{...s.quote,textAlign:'left',border:0,background:'transparent',padding:0,minWidth:0,flex:'1 1 auto',cursor:'pointer'},children:preview}),jsx('button',{'data-status-edit':true,type:'button',disabled:!ready||busy,onClick:()=>{setDraft(text);setEditing(x=>!x)},style:{...s.button,border:0,padding:4},'aria-label':tr('status.editQuote'),children:'✎'})]}),expanded?jsx('div',{'data-status-full':true,tabIndex:0,style:{whiteSpace:'nowrap',overflowX:'auto',maxWidth:'100%',color:'var(--ui-text-secondary)',fontSize:12},children:value}):null,editing?jsxs('div',{children:[jsx('span',{children:tr('status.editLocal',tr({working:'status.working',waiting:'status.waiting',idle:'status.idle',online_unobserved:'status.onlineUnobserved',offline:'status.offline',unknown:'status.unknown'}[state]))}),jsx('input',{'data-status-input':true,disabled:busy,value:draft,onChange:e=>setDraft(e.target.value),maxLength:512,'aria-label':tr('status.quote'),style:{maxWidth:'100%',boxSizing:'border-box'}}),jsx('button',{'data-status-save':true,type:'button',onClick:save,children:tr('common.save')})]}):null,error?jsx('small',{role:'alert',children:localizeError(error)}):null]})
}
// Profile Rail's own namespace; never depends on Office being mounted.
const STATUS_TTL=15000
function useRailSnapshot(rest,connection,profile){
 const epoch=typeof sdk.useGatewayActivationEpoch==='function'?sdk.useGatewayActivationEpoch():null
 const scope=JSON.stringify([connection,profile,epoch]), current=useRef(scope);current.current=scope
 const [clock,tick]=useState(()=>Date.now())
 const q=useQuery({queryKey:['profile-rail','status',connection,profile,epoch],enabled:!!profile&&typeof rest==='function',retry:false,refetchInterval:5000,refetchOnWindowFocus:true,queryFn:async()=>{
  const data=await rest('/status',{method:'GET',timeoutMs:10000})
  if(current.current!==scope||host.state.connectionId.get()!==connection||host.state.profile.get()!==profile)throw new LocalizedError('errors.connectionChanged')
  if(!Array.isArray(data))throw new LocalizedError('errors.statusFormat')
  const names=new Set();for(const row of data){if(!row||typeof row.profile!=='string'||!row.profile||names.has(row.profile)||typeof row.online!=='boolean'||typeof row.state!=='string')throw new LocalizedError('errors.statusFormat');names.add(row.profile)}
  return data
 }})
 useEffect(()=>{const update=()=>{if(!document.hidden)tick(Date.now())};const timer=setInterval(update,1000);document.addEventListener('visibilitychange',update);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update)}},[])
 if(q.isError||!Number.isFinite(q.dataUpdatedAt)||Date.now()-q.dataUpdatedAt>STATUS_TTL||q.dataUpdatedAt>Date.now()+1000||!Array.isArray(q.data))return [[],clock]
 return [q.data,clock]
}
function officeStatus(row){if(!row)return 'unknown';if(!row.online)return 'offline';if(row.state==='running')return row.busy===true?'working':row.busy===false?'idle':'unknown';return ['working','waiting','idle','online_unobserved','unknown'].includes(row.state)?row.state:'unknown'}
const statusOrder={working:0,waiting:1,idle:2,online_unobserved:3,unknown:4,offline:5}
const statusColor={working:'var(--ui-green, var(--ui-accent))',waiting:'var(--ui-yellow, var(--ui-accent))',idle:'var(--ui-text-secondary)',online_unobserved:'var(--ui-text-secondary)',offline:'var(--ui-text-quaternary)',unknown:'var(--ui-stroke-secondary)'}
// Hermes Agent agent/display.py and locales/zh-hant.yaml, commit
// 809bc81571e14ac604d54cb9abbc3db9568b046c; see HERMES-SPINNER-LICENSE.
const faces=['(｡•́︿•̀｡)','(◔_◔)','(¬‿¬)','( •_•)>⌐■-■','(⌐■_■)','(´･_･`)','◉_◉','(°ロ°)','( ˘⌣˘)♡','ヽ(>∀<☆)☆','٩(๑❛ᴗ❛๑)۶','(⊙_⊙)','(¬_¬)','( ͡° ͜ʖ ͡°)','ಠ_ಠ']
function spinnerHash(value){let h=2166136261;for(const c of value)h=Math.imul(h^c.codePointAt(0),16777619);h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);return (h^h>>>16)>>>0}
function RailItem({working,selected,clock,identity,children}){
 const tr=useTranslator()
 const ref=useRef(null),[pos,setPos]=useState(null)
 useEffect(()=>{
  if(!working||selected)return
  const update=()=>{const el=ref.current,rail=el?.closest('[data-profile-rail]'),stack=el?.querySelector('[data-avatar-stack]');if(!el||!rail||!stack)return;const a=el.getBoundingClientRect(),r=rail.getBoundingClientRect(),sr=stack.getBoundingClientRect();const x=Math.min(sr.right,r.right)+6,y=a.top+6;const visible=a.top>=r.top&&a.bottom<=r.bottom&&x+190<=window.innerWidth&&y>=0&&y+25<=window.innerHeight;setPos(old=>visible?(old?.x===x&&old?.y===y?old:{x,y}):null)}
  const rail=ref.current?.closest('[data-profile-rail]');update();rail?.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);const ro=typeof ResizeObserver==='function'?new ResizeObserver(update):null;if(ro&&ref.current)ro.observe(ref.current);if(ro&&rail)ro.observe(rail)
  return()=>{rail?.removeEventListener('scroll',update);window.removeEventListener('resize',update);ro?.disconnect()}
 })
 const [reduced,setReduced]=useState(()=>typeof window!=='undefined'&&!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
 useEffect(()=>{const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');if(!media)return;const update=()=>setReduced(media.matches);update();media.addEventListener?.('change',update);return()=>media.removeEventListener?.('change',update)},[])
 const hash=spinnerHash(identity),words=tr('status.thinkingWords').split(','),faceStep=reduced?0:Math.floor((clock+(hash%2000))/(2200+hash%700)),wordStep=reduced?0:Math.floor((clock+((hash>>>8)%3000))/(3200+(hash>>>12)%1000))
 return jsxs('div',{ref,style:{width:'100%',height:37,flexShrink:0},children:[children,working&&!selected&&pos?jsx('div',{'data-working-bubble':true,'aria-hidden':true,style:{position:'fixed',left:pos.x,top:pos.y,zIndex:30,boxSizing:'border-box',width:190,height:25,display:'flex',alignItems:'center',padding:'0 8px',borderRadius:'9px 0 0 9px',pointerEvents:'none',color:'var(--ui-text-secondary)',fontSize:10,background:'linear-gradient(to right, color-mix(in srgb, var(--ui-bg-elevated) 78%, transparent) 0px, color-mix(in srgb, var(--ui-bg-elevated) 78%, transparent) 72px, transparent 160px)'},children:jsxs('span',{style:{display:'flex',alignItems:'center',gap:5,whiteSpace:'nowrap',maxWidth:'100%'},children:[jsx('span',{style:{fontFamily:'monospace'},children:faces[(hash+faceStep)%faces.length]}),jsx('span',{children:words[((hash>>>8)+wordStep)%words.length]})]})}):null]})
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
 if(!data||data.version!==2||data.source_root!=='default'||!text(data.source_id)||!text(data.server_epoch)||!Array.isArray(data.profiles)||data.profiles.length>1000)throw new LocalizedError('errors.completionSnapshotFormat')
 const names=new Set()
 for(const p of data.profiles){
  if(!p||!text(p.profile)||names.has(p.profile)||!['ok','unavailable'].includes(p.status))throw new LocalizedError('errors.completionSourceFormat')
  names.add(p.profile)
  if(p.status==='unavailable')continue
  if(!text(p.database_id)||!Number.isSafeInteger(p.high_water)||p.high_water<0||typeof p.truncated!=='boolean'||!Array.isArray(p.rows)||p.rows.length>2000)throw new LocalizedError('errors.completionDataFormat')
  const seqs=new Set(),ids=new Set()
  for(const r of p.rows){if(!r||!Number.isSafeInteger(r.seq)||r.seq<1||r.seq>p.high_water||seqs.has(r.seq)||!text(r.admission_id)||ids.has(r.admission_id)||!text(r.session_id)||!['queued','started','unknown','terminal'].includes(r.status)||(r.outcome!==null&&typeof r.outcome!=='string')||(r.generation!==null&&(!Number.isSafeInteger(r.generation)||r.generation<1)))throw new LocalizedError('errors.completionEventFormat');seqs.add(r.seq);ids.add(r.admission_id)}
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
 const tr=useTranslator()
 const focusIdAtom=host.state.focusedStoredSessionId,focusOwnerAtom=host.state.focusedSessionOwner
 const focusedId=useSyncExternalStore(fn=>focusIdAtom?.subscribe?.(fn)||(()=>{}),()=>focusIdAtom?.get?.()??null,()=>null)
 const focusedOwner=useSyncExternalStore(fn=>focusOwnerAtom?.subscribe?.(fn)||(()=>{}),()=>focusOwnerAtom?.get?.()??null,()=>null)
 const focusedMatches=(owner,id)=>{const current=focusOwnerAtom?.get?.();return !!current&&typeof current.connectionId==='string'&&current.connectionId===connection&&current.profile===owner&&focusIdAtom?.get?.()===id}
 const activation=typeof sdk.useGatewayActivationEpoch==='function'?sdk.useGatewayActivationEpoch():null
 const [generation,retry]=useState(0),[,render]=useState(0),ref=useRef(null)
 const scope=JSON.stringify([connection??null,profile,activation,generation])
 if(!ref.current||ref.current.scope!==scope)ref.current={scope,ready:false,failed:false,baseline:null,known:null,gap:false,rows:[],queue:Promise.resolve()}
 const state=ref.current
 const q=useQuery({queryKey:['profile-rail','completion-snapshot',connection,profile,activation,generation],enabled:!!profile&&typeof rest==='function',retry:false,refetchOnWindowFocus:false,refetchOnReconnect:false,refetchInterval:query=>query.state.status==='success'&&query.state.fetchFailureCount===0?15000:false,queryFn:async()=>{const data=validateSnapshot(await rest('/completion-snapshot',{method:'GET',timeoutMs:30000}));if(host.state.connectionId.get()!==connection||host.state.profile.get()!==profile)throw new LocalizedError('errors.connectionChanged');return data}})
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
 const covered=(x,owner)=>x.owner===owner?.name&&owner?.connectionId===connection&&sameSnapshotDataset(x.source,state.baseline?.source)&&x.connection===JSON.stringify(connection??null)&&x.database===state.baseline?.profiles.get(owner.name)?.database_id&&!x.read
 const ackAll=async(owner)=>{if(!usable())return;const selected=new Set(state.rows.filter(x=>covered(x,owner)).map(x=>x.key));if(!selected.size)return;state.queue=queueSnapshotStorage(async()=>{if(!usable())return;const rows=state.rows.map(x=>selected.has(x.key)&&covered(x,owner)?{...x,read:true}:x);await writeSnapshotLedger(storage,rows,state.known);if(ref.current===state){state.rows=rows;render(n=>n+1)}}).catch(()=>{if(ref.current===state){state.failed=true;render(n=>n+1)}});await state.queue}
 return {activityFor,childMetadataFor,ackAll,coverageReady:usable(),covers:name=>state.baseline?.profiles.has(name)===true,error:typeof rest!=='function'?tr('completion.unavailable'):state.failed?tr('completion.saveFailed'):q.isError?tr('completion.unavailable'):state.gap?tr('completion.rebuilt'):q.data?.profiles?.some(p=>p.status!=='ok'||p.truncated)?tr('completion.partial'):null,retry:()=>retry(n=>n+1),has:name=>usable()&&state.baseline.profiles.has(name)&&state.rows.some(x=>sameSnapshotDataset(x.source,state.baseline.source)&&x.database===state.baseline.profiles.get(name).database_id&&x.connection===JSON.stringify(connection??null)&&x.owner===name&&!x.read),watermark:(owner,id)=>usable()?state.rows.filter(x=>matches(x,owner,id)).map(x=>x.key):[],ack:async(owner,id,keys)=>{if(!usable()||!keys.length)return;const selected=new Set(keys);state.queue=queueSnapshotStorage(async()=>{if(!usable())return;const rows=state.rows.map(x=>matches(x,owner,id)&&selected.has(x.key)?{...x,read:true}:x);await writeSnapshotLedger(storage,rows,state.known);if(ref.current===state){state.rows=rows;render(n=>n+1)}}).catch(()=>{state.failed=true;render(n=>n+1)});await state.queue}}
}
const activityLabel=(n,t=tr)=>t('activity.observed',n)
// Activity inputs are tri-state: unknown does not invent a child or a count.
export function AvatarLayers({avatar,name,color,avatarRef,unread,offline=false,childRunning=null,childCount=null,childMetadata=null,runningCount=null,triggerProps={}}){
 const tr=useTranslator()
 const box=useRef(null),[width,setWidth]=useState(0)
 useEffect(()=>{const el=box.current;if(!el)return;const update=()=>setWidth(el.clientWidth);update();const ro=typeof ResizeObserver==='function'?new ResizeObserver(update):null;ro?.observe(el);return()=>ro?.disconnect()},[])
 const count=(Number.isSafeInteger(runningCount)&&runningCount>1?runningCount-1:0)+(Number.isSafeInteger(childCount)&&childCount>=0?childCount:childRunning===true?1:0)
 const available=Math.max(0,width-8),natural=34+6*count,visible=Math.min(count,Math.max(0,Math.ceil((available-6)/6)))
 const extraRunning=Number.isSafeInteger(runningCount)&&runningCount>1?runningCount-1:0
 const seenChildren=new Set(),children=childMetadata?.children?.filter(x=>{if(!['queued','recent'].includes(x.kind)||seenChildren.has(x.id))return false;seenChildren.add(x.id);return true})||[]
 const shadowColor=i=>i<extraRunning?statusColor.working:children[i-extraRunning]?.leased?statusColor.working:children[i-extraRunning]?.kind==='queued'?statusColor.waiting:statusColor.unknown
 const face=(ref,index=0)=>{const shadow=index>0,props={ref,'data-avatar':shadow?undefined:true,'data-child-shadow':shadow||undefined,className:'profile-rail-avatar',style:{...s.avatar,boxSizing:'border-box',border:0,outline:shadow||offline?'none':'2px solid '+color,position:'absolute',left:0,top:0,zIndex:shadow?-index:1,filter:offline?'grayscale(1)':undefined},...(avatar?{src:avatar,alt:''}:{children:name.slice(0,1).toUpperCase()})};return jsx(avatar?'img':'span',props,index)}
 return jsx('span',{ref:box,style:{display:'block',width:'100%',height:37},children:jsxs('span',{'data-avatar-stack':true,style:{position:'relative',display:'block',margin:'0 auto',width:Math.min(natural,available),height:37},children:[jsx('span',{style:{position:'absolute',inset:0,overflow:'hidden',zIndex:0},children:Array.from({length:visible},(_,i)=>jsxs('span',{style:{position:'absolute',left:(i+1)*6,top:1.5,width:34,height:34,zIndex:-(i+1),opacity:Math.max(0,1-(i+1)/7),pointerEvents:'none'},children:[face(null,i+1),jsx('span',{'data-child-outline':true,'aria-hidden':true,style:{position:'absolute',left:0,top:0,width:34,height:34,borderRadius:'22%',boxShadow:'inset 0 0 0 1px '+shadowColor(i),zIndex:-(i+1),pointerEvents:'none'}})]},i))}),jsx(PopoverTrigger,{asChild:true,children:jsx('button',{...triggerProps,ref:avatarRef,type:'button',className:'profile-rail-hit',style:{...s.hit,position:'absolute',left:0,top:1.5,width:34,height:34,zIndex:1},children:face(null)})}),offline?jsx('span',{'data-avatar-outline':true,'aria-hidden':true,style:{position:'absolute',left:0,top:1.5,width:34,height:34,borderRadius:'22%',outline:'2px solid '+color,zIndex:2,pointerEvents:'none'}}):null,unread?jsx('span',{'data-completion-badge':true,'aria-hidden':true,style:{position:'absolute',left:26,top:-5,zIndex:3,fontSize:14,lineHeight:1,pointerEvents:'none'},children:'✋'}):null,Number.isSafeInteger(runningCount)&&runningCount>=2?jsx('span',{'data-running-count':true,title:activityLabel(runningCount,tr),'aria-hidden':true,style:{position:'absolute',left:26,bottom:0,zIndex:3,borderRadius:'50%',minWidth:17,height:17,lineHeight:'17px',textAlign:'center',fontSize:9,color:'var(--ui-text-primary)',background:'var(--ui-bg-elevated)',border:'1px solid var(--ui-stroke-secondary)',pointerEvents:'none'},children:'x'+runningCount}):null]})})
}
const defaultPreferences={hideOffline:false,showCron:true,hiddenProfiles:[]}
const profileVisible=(p,settings)=>!settings.hiddenProfiles.includes(p.name)&&(!settings.hideOffline||p.status!=='offline')
function createPreferences(storage){
 let value=defaultPreferences,ready=false,error='',pending=false,version=0
 let snapshot={...value,ready,error,pending};const listeners=new Set()
 const emit=()=>{snapshot={...value,ready,error,pending};for(const fn of listeners)fn()}
 const valid=x=>x&&typeof x.hideOffline==='boolean'&&typeof x.showCron==='boolean'&&Array.isArray(x.hiddenProfiles)&&x.hiddenProfiles.every(v=>typeof v==='string'&&v.length>0)
 Promise.resolve().then(async()=>{if(!storage?.get||!storage?.set)throw Error();const saved=await storage.get('display-settings-v1');if(saved!==undefined&&saved!==null){if(!valid(saved))throw Error();value={hideOffline:saved.hideOffline,showCron:saved.showCron,hiddenProfiles:[...new Set(saved.hiddenProfiles)]}}ready=true;emit()}).catch(()=>{error={translationKey:'settings.readFailed'};emit()})
 return {get:()=>snapshot,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},save:async next=>{if(!ready||pending||!valid(next))return;pending=true;error='';emit();const n=++version;try{await storage.set('display-settings-v1',next);const saved=await storage.get('display-settings-v1');if(JSON.stringify(saved)!==JSON.stringify(next))throw Error();if(n===version)value=next}catch{error={translationKey:'settings.saveFailed'}}finally{pending=false;emit()}}}
}
function Settings({preferences}){
 const tr=useTranslator()
 const settings=useSyncExternalStore(preferences.subscribe,preferences.get,preferences.get)
 const connectionId=useValue(host.state.connectionId),profile=useValue(host.state.profile)
 const q=useQuery({queryKey:['profile-rail','settings-roster',connectionId,profile],enabled:!!profile,retry:false,queryFn:async()=>{const r=await bounded(()=>host.profiles.list({connectionId,profile}),'settings.profileList');if(!Array.isArray(r?.profiles)||host.state.connectionId.get()!==connectionId||host.state.profile.get()!==profile)throw new LocalizedError('settings.profileUnavailable');return r.profiles.filter(p=>typeof p.name==='string'&&p.name)}})
 const save=patch=>preferences.save({hideOffline:settings.hideOffline,showCron:settings.showCron,hiddenProfiles:settings.hiddenProfiles,...patch})
 const disabled=!settings.ready||settings.pending
 const description={fontSize:12,lineHeight:1.5,color:'var(--ui-text-secondary)',margin:'3px 0 0'}
 const toggle=(label,detail,checked,onChange)=>jsxs('div',{style:{display:'flex',gap:16,alignItems:'center',justifyContent:'space-between',padding:'12px 0'},children:[jsxs('div',{style:{minWidth:0},children:[jsx('div',{style:{fontSize:13,fontWeight:600,color:'var(--ui-text-primary)'},children:label}),jsx('p',{style:description,children:detail})]}),jsx('button',{type:'button',role:'switch','aria-label':label,'aria-checked':checked,disabled,onClick:()=>onChange(!checked),style:{position:'relative',flex:'0 0 auto',width:32,height:18,padding:0,border:0,borderRadius:9,cursor:disabled?'default':'pointer',background:checked?'var(--ui-accent)':'var(--ui-stroke-secondary)',opacity:disabled?0.55:1},children:jsx('span',{'aria-hidden':true,style:{position:'absolute',top:2,left:checked?16:2,width:14,height:14,borderRadius:'50%',background:'var(--ui-bg-elevated)'}})})]})
 return jsxs('div',{style:{padding:20,width:'100%',boxSizing:'border-box'},children:[jsx('h2',{children:'SessionCrew'}),toggle(tr('settings.hideOffline'),tr('settings.offlineHelp'),settings.hideOffline,v=>save({hideOffline:v})),toggle(tr('settings.showCron'),tr('settings.cronHelp'),settings.showCron,v=>save({showCron:v})),jsxs('section',{style:{padding:'12px 0'},children:[jsx('div',{style:{fontSize:13,fontWeight:600,color:'var(--ui-text-primary)'},children:tr('settings.visibleProfiles')}),jsx('p',{style:description,children:tr('settings.storageHelp')}),q.isPending?jsx('p',{children:tr('settings.loadingProfiles')}):q.isError?jsx('p',{role:'alert',children:tr('settings.profileLoadFailed')}):jsx('div',{style:{display:'flex',flexWrap:'wrap',gap:8,marginTop:10},children:(q.data||[]).map(p=>{const visible=!settings.hiddenProfiles.includes(p.name);return jsx('button',{type:'button','aria-pressed':visible,disabled,onClick:()=>save({hiddenProfiles:visible?[...settings.hiddenProfiles,p.name]:settings.hiddenProfiles.filter(x=>x!==p.name)}),style:{minHeight:30,maxWidth:'100%',overflowWrap:'anywhere',padding:'5px 10px',border:'1px solid '+(visible?'var(--ui-accent)':'var(--ui-stroke-secondary)'),borderRadius:5,background:visible?'var(--ui-accent)':'var(--ui-bg-elevated)',color:visible?'var(--dt-midground-foreground, var(--ui-bg-editor))':'var(--ui-text-primary)',fontSize:12,cursor:disabled?'default':'pointer',opacity:disabled?0.55:1},children:p.name},p.name)})})]}),settings.error?jsx('p',{role:'alert',children:settings.error.translationKey?tr(settings.error.translationKey):localizeError(settings.error)}):null]})
}
function Rail({storage,rest,preferences}){
 const tr=useTranslator()
 const connectionId=useValue(host.state.connectionId),profile=useValue(host.state.profile)
 const settings=useSyncExternalStore(preferences.subscribe,preferences.get,preferences.get)
 const completion=useCompletion(storage,rest,connectionId,profile)
 const [office,clock]=useRailSnapshot(rest,connectionId,profile)
 const [selected,setSelected]=useState(null),[projectOwner,setProjectOwner]=useState(null),[routeGeneration,setRouteGeneration]=useState(0),selectedRef=useRef(null),selectionEpoch=useRef(0),pending=useRef(new Map()),createdProjects=useRef(new Map()),unknownProjects=useRef(new Set()),dialogActive=useRef(false)
 const select=value=>{const next=typeof value==='function'?value(selectedRef.current):value;if(next!==selectedRef.current){selectionEpoch.current++;setProjectOwner(null)}selectedRef.current=next;setSelected(next)}
 useEffect(()=>{select(null)},[connectionId,profile])
 const routes=useQuery({queryKey:['profile-rail','routes',connectionId,profile,routeGeneration],queryFn:()=>typeof host.profileRoutes==='function'?bounded(()=>host.profileRoutes(),'common.routeLookup'):Promise.resolve(null),enabled:!!profile,retry:false})
 const q=useQuery({queryKey:['profile-rail','roster',connectionId,profile],queryFn:async()=>{
  const result=await bounded(()=>host.profiles.list({connectionId,profile}),'settings.profileList')
  if(!Array.isArray(result?.profiles)) throw new Error('Invalid profile response')
  const rows=await Promise.all(result.profiles.map(async p=>{
   let avatar=null
   try {const asset=await bounded(()=>host.request('profiles.get_asset',{name:p.name,asset:'avatar'}),'common.avatar');if(asset?.found&&typeof asset.data==='string'&&/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(asset.data)) avatar=asset.data} catch {}
   return {...p,avatar}
  }))
  if(host.state.connectionId.get()!==connectionId || host.state.profile.get()!==profile) throw new Error('Connection changed')
  return rows
 },enabled:!!profile,retry:false})
 if(q.isPending) return jsx('p',{children:q.fetchStatus==='idle'?tr('common.connectionNotReady'):tr('settings.loadingProfiles')})
 if(q.isError) return jsxs('div',{children:[jsx('p',{children:tr('settings.profilesUnknown')}),jsx('button',{onClick:()=>q.refetch(),children:tr('common.retry')})]})
 if(!q.data?.length) return jsx('p',{children:tr('settings.noProfiles')})
 const byName=new Map(office.map(row=>[row.profile,row]))
 const profiles=q.data.filter(p=>typeof p.name==='string').map((p,index)=>({...p,index,office:byName.get(p.name),status:officeStatus(byName.get(p.name))})).filter(p=>profileVisible(p,settings)).sort((a,b)=>{
  const rank=statusOrder[a.status]-statusOrder[b.status];if(rank)return rank
  if(a.status==='idle'){const x=a.office?.idle_since,y=b.office?.idle_since,valid=v=>typeof v==='number'&&Number.isFinite(v)&&v>0; if(valid(x)&&valid(y)&&x!==y)return y-x;if(valid(x)!==valid(y))return valid(x)?-1:1}
  return a.index-b.index
 })
 const completionError=completion.error||(completion.coverageReady&&profiles.some(p=>!completion.covers(p.name))?tr('completion.profilePartial'):null)
 return jsxs('div',{style:{height:'100%',minHeight:0,display:'flex',flexDirection:'column'},children:[jsxs('div',{'data-profile-rail':true,'aria-label':'SessionCrew',style:{...s.rail,height:'auto',flex:'1 1 auto',minHeight:0,width:'100%',position:'relative',alignItems:'flex-start',overflowX:'hidden',scrollbarWidth:'none'},children:[jsx('style',{children:'[data-profile-rail]::-webkit-scrollbar{display:none}'}),...profiles.map(p=>{
  const name=displayName(p),activity=completion.activityFor(p.name),metadata=completion.childMetadataFor(p.name),metadataLabel=metadata?.presentation_count?tr('activity.childDisclaimer'):'',epoch=selectionEpoch.current,selectionKey=JSON.stringify([connectionId,profile,p.name]),active=selected===selectionKey
  const isCurrent=()=>selectedRef.current===selectionKey&&selectionEpoch.current===epoch&&host.state.connectionId.get()===connectionId&&host.state.profile.get()===profile
  let owner=null,phase=routes.isPending?(routes.fetchStatus==='idle'?tr('common.connectionNotReady'):'loading'):routes.isError?tr('errors.routeLoadFailure',localizeError(errorMessage(routes.error,tr)||tr('errors.unknown'))):''
  if(!phase) try {owner={connectionId,name:p.name,route:routeFor(p.name,connectionId,profile,routes.data)}} catch(e){phase=errorMessage(e,tr)}
  return jsx(RailItem,{working:p.status==='working',selected:active,clock,identity:JSON.stringify([connectionId,p.name]),children:jsx(GuardedPopover,{active,onOpenChange:open=>{if(!open&&dialogActive.current)return;if(open)select(selectionKey);else if(selectedRef.current===selectionKey)select(null)},children:(avatarRef,contentRef,onCloseAutoFocus)=>[
   jsx(AvatarLayers,{avatar:p.avatar,name,color:statusColor[p.status],avatarRef,offline:p.status==='offline',unread:completion.has(p.name),runningCount:activity?.observed_active_count,childMetadata:metadata,childCount:metadata===undefined?activity?.observed_child_count:metadata?.presentation_count,childRunning:metadata!==undefined||activity&&Object.hasOwn(activity,'observed_child_count')?null:activity?.observed_child_active,triggerProps:{'data-selected':active,'data-low':['idle','online_unobserved','offline','unknown'].includes(p.status),'data-state-name':p.status,'aria-label':tr('status.profileAria',name,tr({working:'status.working',waiting:'status.waiting',idle:'status.idle',online_unobserved:'status.onlineUnobserved',offline:'status.offline',unknown:'status.unknown'}[p.status]),completion.has(p.name),activity?activityLabel(activity.observed_active_count,tr):'',metadataLabel),title:[activity?activityLabel(activity.observed_active_count,tr):'',metadataLabel].filter(Boolean).join(' ')||undefined}}),
  jsxs(PopoverContent,{ref:contentRef,onInteractOutside:e=>{if(dialogActive.current)e.preventDefault()},onCloseAutoFocus:e=>{onCloseAutoFocus(e);if(selectedRef.current&&selectedRef.current!==selectionKey)e.preventDefault()},side:'right',align:'center',collisionPadding:0,style:{...s.bubble,position:'relative'},children:[jsxs('div',{style:{display:'flex',gap:11,alignItems:'center',minWidth:0,flexShrink:0},children:[p.avatar?jsx('img',{'data-panel-avatar':true,src:p.avatar,alt:'',style:{...s.avatar,flex:'none',borderColor:statusColor[p.status]}}):jsx('span',{'data-panel-avatar':true,style:{...s.avatar,flex:'none',borderColor:statusColor[p.status]},children:name.slice(0,1).toUpperCase()}),jsxs('div',{style:{minWidth:0,flex:'1 1 auto'},children:[jsx('strong',{style:{display:'block',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',minWidth:0,fontSize:14},children:name}),jsx(StatusQuote,{storage,ownerKey:'status:'+JSON.stringify([connectionId,p.name]),status:p.status})]}),jsx('button',{type:'button','aria-label':tr('common.closePanel'),onClick:()=>select(null),style:{...s.button,border:0,fontSize:20,padding:0,alignSelf:'flex-start'},children:'×'})]}),active?jsx(Recent,{owner,phase,completion,settings,retryRoutes:()=>setRouteGeneration(n=>n+1),onOpened:()=>{if(isCurrent())select(null)}},JSON.stringify([connectionId,p.name])):null,active?jsx(Launchers,{owner,ownerName:name,isCurrent,createdProjects,unknownProjects,dialogActive,projectOpen:projectOwner===selectionKey,setProjectOpen:open=>setProjectOwner(open?selectionKey:null),onOpened:()=>{if(isCurrent())select(null)},pending},'launch:'+JSON.stringify([connectionId,p.name,owner?.route])):null]})]})},p.name)
 })]}),completionError?jsx(profile&&rest?'button':'span',{'data-completion-error':true,title:completionError,'aria-label':completionError,...(profile&&rest?{onClick:completion.retry}:{}),style:{...s.button,border:0,alignSelf:'flex-end',flexShrink:0,margin:'8px 4px 4px 0',fontSize:12,padding:'1px 3px'},children:'⚠️'}):null]})
}
export default {id:'profile-rail',name:'SessionCrew',defaultEnabled:true,register(ctx){pluginI18n=typeof ctx.i18n?.register==='function'&&typeof ctx.i18n?.t==='function'?ctx.i18n:null;pluginI18n?.register(messages);const rest=typeof ctx.rest==='function'?(path,opts)=>ctx.rest(path,opts):null;const preferences=createPreferences(ctx.storage);ctx.registerSettingsPage?.({id:'settings',title:'SessionCrew',icon:'account',render:()=>jsx(LocalizedRoot,{children:jsx(Settings,{preferences})})});ctx.register({id:'rail',area:'panes',title:'SessionCrew',data:{placement:'left',dock:{pane:'workspace',pos:'left'},width:'80px',minWidth:'80px'},render:()=>jsx(LocalizedRoot,{children:jsx(DialogRestContext.Provider,{value:rest,children:jsx(Rail,{storage:ctx.storage,rest,preferences})})})})}}
