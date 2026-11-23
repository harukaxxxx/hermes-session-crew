import * as sdk from '@hermes/plugin-sdk'
import { host, useValue, useQuery, Popover, PopoverContent, PopoverTrigger } from '@hermes/plugin-sdk'
import * as React from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

const { useState, useEffect, useRef, useCallback, useSyncExternalStore, createContext, useContext }=React

// Plugin-owned copy; zh-hant is the SDK normalized ID for zh-TW.
const messages = {
  "en": {
    sessionActivity: { waiting: 'Waiting for input' },
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
      recentSessionCount: "Recent sessions",
      messagingHelp: "Choose which messaging sessions appear in bubbles and unread dots. Unknown sources remain visible; unread records are preserved.",
      platforms: "Messaging platforms",
      observedPlatforms: "Recently observed platforms",
      partiallyShown: "Partially shown",
      otherPlatforms: "Other platforms",
      showAllPlatforms: "Show all",
      hideAllPlatforms: "Hide all",
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
      developerMode: "Developer mode", developerHelp: "Show elapsed time on profile avatars when idle, an input wait, or a completion has been observed.",

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
      historicalIdle: "Elapsed since last confirmed idle; current activity unknown",
      observedIdle: "Elapsed since work was observed to end; other activity may be unknown",
      lastActivityElapsed: "Elapsed since last recorded session activity; idle not confirmed",
      inputWaitElapsed: "Elapsed since the current input wait was first observed",
      unreadCompletionElapsed: "Elapsed since an unread completion was observed; idle not confirmed",
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
      activityUnavailable: "Session activity ordering unavailable; retry",
      missingProjectId: "Creation response lacks a project ID; outcome unknown",
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
      openLatest: "Open latest",
      loadingLatest: "Loading latest...",
      noRecentSessions: "No recent sessions",
      quickCreate: "Quick create",
      limit: "Showing at most 200 fetched items",
      untitled: "Untitled",
      findingRoute: "Finding profile route…",
      empty: "No sessions",
      loading: "Loading sessions…",
      retryOpen: "Retry opening",
      createUnconfirmed: "Session creation could not be confirmed. Check this profile’s session list and open the session if it appears. Quick create and project launches are paused for this profile until SessionCrew reloads.",
      showMore: "Show more sessions",
      openFailure: error => `Could not open: ${error}; try again`,
      loadFailure: error => `Could not load sessions: ${error}`,
      refreshFailure: error => `Could not refresh sessions. Showing the previous list: ${error}`,
      createdOpenFailure: (id, error) => `Created ${id}, but opening failed; retry only opens it: ${error}`,
      newInProject: project => `New conversation in ${project}`,
    },
  },
  "zh-hant": {
    sessionActivity: { waiting: '等待輸入' },
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
      recentSessionCount: "近期工作階段",
      messagingHelp: "選擇要在泡泡及未讀紅點中顯示的訊息平台。來源未知時仍顯示；未讀紀錄會保留。",
      platforms: "訊息平台",
      observedPlatforms: "近期觀察到的平台",
      partiallyShown: "部分顯示",
      otherPlatforms: "其他平台",
      showAllPlatforms: "全部顯示",
      hideAllPlatforms: "全部隱藏",
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
      developerMode: "開發者模式", developerHelp: "有閒置、等待輸入或完成的觀察紀錄時，在設定檔頭像顯示經過時間。",

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
      historicalIdle: "自上次確認閒置起經過的時間；目前活動狀態未知",
      observedIdle: "自觀察到工作結束起經過的時間；其他活動可能未知",
      lastActivityElapsed: "距上次記錄的工作階段活動已過的時間；未確認閒置",
      inputWaitElapsed: "自首次觀察到目前等待輸入起經過的時間",
      unreadCompletionElapsed: "自觀察到未讀完成起經過的時間；未確認閒置",
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
      activityUnavailable: "工作階段活動排序無法使用，請重試",
      missingProjectId: "建立回應缺少專案 ID，結果未知",
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
      openLatest: "開啟最近",
      loadingLatest: "載入最近...",
      noRecentSessions: "查無最近",
      quickCreate: "快速新增",
      limit: "最多顯示已取得的 200 筆",
      untitled: "未命名",
      findingRoute: "正在尋找設定檔路由…",
      empty: "沒有工作階段",
      loading: "載入工作階段…",
      retryOpen: "重試開啟",
      createUnconfirmed: "無法確認會話是否已建立。請查看此角色的會話清單；若找到該會話，請直接開啟。重新載入 SessionCrew 前，此角色暫停快速建立及從專案啟動會話。",
      showMore: "顯示更多工作階段",
      openFailure: error => `開啟失敗：${error}，請再試一次`,
      loadFailure: error => `工作階段無法載入：${error}`,
      refreshFailure: error => `工作階段無法更新，目前顯示上次的清單：${error}`,
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
function LocalizedRoot({children}){const hook=typeof sdk.usePluginI18n==='function'?sdk.usePluginI18n('sessioncrew'):null,t=pluginI18n&&hook?hook:english;return jsx(TranslationContext.Provider,{value:t,children})}
function useTranslator(){const current=useContext(TranslationContext)||tr,ref=useRef(current);ref.current=current;return useCallback((...args)=>ref.current(...args),[])}
const s={rail:{height:'100%',width:50,overflowY:'auto',display:'flex',flexDirection:'column',alignItems:'center',gap:10,paddingTop:18},hit:{width:45,height:37,padding:0,border:0,background:'transparent',cursor:'pointer',color:'var(--ui-text-primary)'},avatar:{width:34,height:34,borderRadius:'22%',border:'2px solid var(--ui-stroke-secondary)',objectFit:'cover',display:'grid',placeItems:'center'},bubble:{zIndex:50,width:310,maxWidth:'calc(100vw - 24px)',display:'flex',flexDirection:'column',padding:16,borderRadius:12,border:'1px solid var(--ui-stroke-secondary)',background:'var(--ui-bg-elevated)',color:'var(--ui-text-primary)'},quote:{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',color:'var(--ui-text-secondary)',fontSize:11,margin:'4px 0 0'},sessions:{overflowY:'auto',minHeight:35,flex:'1 1 auto',color:'var(--ui-text-secondary)'},footer:{display:'flex',justifyContent:'space-between',gap:8,marginTop:8,flexShrink:0},button:{color:'var(--ui-text-secondary)',background:'transparent',border:'1px solid var(--ui-stroke-secondary)',borderRadius:6,padding:'6px 8px'}}
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
async function recentData(owner,spawnPriority='background',rest=null){
 const connection=host.state.connectionId.get(),profile=host.state.profile.get(),activation=sdk.gatewayActivationEpoch?.();let changed=false
 const dispose=[host.state.connectionId,host.state.profile].map(atom=>typeof atom.subscribe==='function'?atom.subscribe(()=>{if(host.state.connectionId.get()!==connection||host.state.profile.get()!==profile)changed=true}):null)
 const sameScope=()=>!changed&&host.state.connectionId.get()===connection&&host.state.profile.get()===profile&&sdk.gatewayActivationEpoch?.()===activation
 try{return await recentDataScoped(owner,spawnPriority,rest,sameScope)}finally{for(const off of dispose)if(typeof off==='function')off()}
}
async function recentDataScoped(owner,spawnPriority,rest,sameScope){
 const list=params=>{
  if(!sameScope())throw new LocalizedError('errors.connectionChanged')
  return requestOwner(owner,'session.list',params,spawnPriority)
 }
 let result
 try { result=await list({limit:200,scope:'stored'}); if(result?.error) throw result.error }
 catch(e){if(!scopeError(e)) throw e;result=await list({limit:200})}
 if(result?.error || !Array.isArray(result?.sessions) || (result.scope!=null && result.scope!=='stored')) throw new LocalizedError('errors.sessionFormat')
 // Canonical stored history excludes open canonical sessions; legacy has no scope.
 let sessions=result.sessions
 if(result.scope==='stored'){
  const live=await list({limit:200,scope:'live'})
  if(live?.error || live?.scope!=='live' || !Array.isArray(live.sessions)) throw new LocalizedError('errors.liveSessionFormat')
  sessions=[...live.sessions,...sessions]
 }
 const seen=new Map(),unique=[]
 for(const x of sessions){if(typeof x?.id!=='string'||!x.id)continue;const source=typeof x.source==='string'&&x.source?x.source:null,previous=seen.get(x.id);if(previous){if(previous.source!==source)previous.sourceConflict=true}else{const entry={...x,source,sourceConflict:false};seen.set(x.id,entry);unique.push(entry)}}
 let activity={}
 if(unique.length){
  const profile=typeof owner.route==='string'?owner.name:owner.route?.targetProfile
  if(!profile||!sameScope()||host.state.connectionId.get()!==owner.connectionId)throw new LocalizedError('errors.routingUnsupported')
  if(typeof rest!=='function')throw new LocalizedError('errors.activityUnavailable')
  let data
  try{data=await rest('/recent-activity',{method:'POST',body:{profile,ids:unique.map(x=>x.id)},timeoutMs:10000})}catch{throw new LocalizedError('errors.activityUnavailable')}
  if(!sameScope()||host.state.connectionId.get()!==owner.connectionId)throw new LocalizedError('errors.routingUnsupported')
  if(data?.profile!==profile||!data.activity||typeof data.activity!=='object'||Array.isArray(data.activity)||unique.some(x=>!Object.hasOwn(data.activity,x.id)||(data.activity[x.id]!==null&&(typeof data.activity[x.id]!=='number'||!Number.isFinite(data.activity[x.id])||data.activity[x.id]<=0))))throw new LocalizedError('errors.activityUnavailable')
  activity=data.activity
 }
 // Unknown timestamps retain input order after known activity; unread is independent.
 const rows=unique.map((x,index)=>({x,index,time:typeof activity[x.id]==='number'&&Number.isFinite(activity[x.id])&&activity[x.id]>0?activity[x.id]:null})).sort((a,b)=>(b.time??-Infinity)-(a.time??-Infinity)||a.index-b.index).slice(0,200).map(({x,time})=>({id:x.id,title:typeof x.title==='string'?x.title:'',source:x.source,sourceConflict:x.sourceConflict,last_activity_at:time,last_active:x.last_active,updated_at:x.updated_at,started_at:x.started_at}))
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
const launchOwnerKey=({connectionId,name,route})=>JSON.stringify([route?.connectionId??connectionId,name])
const launchDestination=({connectionId,route})=>JSON.stringify(typeof route==='string'?[connectionId,route]:[route.connectionId,route.profile,route.targetProfile])
async function openOwned(owner,id){
 if(typeof host.openSession!=='function') throw new LocalizedError('errors.openUnsupported')
 if(typeof owner.route==='string'){
  if(host.state.connectionId.get()!==owner.connectionId || host.state.profile.get()!==owner.name) throw new LocalizedError('errors.openOtherUnsupported')
  return host.openSession(id,{profile:owner.name,intent:'in-place'})
 }
 return host.openSession(id,{route:owner.route,intent:'in-place'})
}
// A plugin-owned overlay remains visible even when macOS hides native scrollbars.
function RecentScroll({style,children,revision}){
 const list=useRef(null),drag=useRef(null),[metrics,setMetrics]=useState(null)
 const measure=useCallback(()=>{const el=list.current;if(!el)return;const {clientHeight:h,scrollHeight:total,scrollTop:top}=el;const height=Math.min(h,Math.max(18,h*h/total));setMetrics(total>h?{height,top:top/(total-h)*(h-height)}:null)},[])
 useEffect(()=>{measure();const el=list.current;if(!el||typeof ResizeObserver==='undefined')return;const observer=new ResizeObserver(measure);observer.observe(el);return()=>observer.disconnect()},[measure,revision])
 const move=e=>{if(!drag.current||!list.current)return;const el=list.current,track=el.clientHeight-metrics.height;if(track>0)el.scrollTop=drag.current.top+(e.clientY-drag.current.y)*(el.scrollHeight-el.clientHeight)/track}
 return jsxs('div',{style:{...style,overflow:'visible',position:'relative'},children:[jsx('div',{'data-recent-list':true,ref:list,onScroll:measure,style:{height:'calc(100% + 2px)',width:'calc(100% + 2px)',boxSizing:'border-box',marginTop:-2,marginLeft:-2,paddingTop:2,paddingLeft:2,overflowY:'auto',scrollbarWidth:'none'},children}),metrics?jsx('div',{'data-recent-scroll-cue':true,'aria-hidden':true,style:{position:'absolute',right:1,top:0,bottom:0,width:6,borderRadius:3,background:'var(--ui-stroke-secondary, #888)',opacity:.8},children:jsx('div',{'data-recent-scroll-thumb':true,onPointerDown:e=>{drag.current={y:e.clientY,top:list.current.scrollTop};e.currentTarget.setPointerCapture(e.pointerId)},onPointerMove:move,onPointerUp:()=>{drag.current=null},onPointerCancel:()=>{drag.current=null},style:{position:'absolute',top:metrics.top,height:metrics.height,width:'100%',borderRadius:3,background:'var(--ui-text-secondary, #555)',cursor:'grab',touchAction:'none'}})}):null,jsx('style',{children:'[data-recent-list]::-webkit-scrollbar{display:none}'})]})
}
// Adapted from Hermes Desktop styles.css, commit 2bd378e; see HERMES-ARC-LICENSE.
const rowArcCss=`[data-session-waiting]{width:14px;text-align:center;transform:scale(.75);transform-origin:top left}@keyframes sessioncrew-arc{to{transform:translate(-50%,-50%)}}[data-session-arc]{position:absolute;inset:0;overflow:hidden;border-radius:7px;padding:.078125rem;pointer-events:none;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}[data-session-arc]::before{content:'';position:absolute;top:0;left:0;width:240%;height:240%;background:repeating-linear-gradient(160deg,transparent 0%,transparent 18.75%,var(--dt-foreground,var(--ui-text-primary)) 25%,color-mix(in srgb,var(--dt-foreground,var(--ui-text-primary)) 45%,transparent) 31.25%,transparent 43.75%,transparent 50%);will-change:transform;animation:sessioncrew-arc 2.23s linear infinite}@media(prefers-reduced-motion:reduce){[data-session-arc]::before{animation:none}}`
// One generation per host scope, shared by all observers and retained across
// unmounts so an A→B→A transition cannot revive an in-flight A response.
const activityScope={generation:0,listeners:new Set(),initialized:false}
function initActivityScope(){
 if(activityScope.initialized)return;activityScope.initialized=true
 for(const atom of [host.state.gateway,host.state.connectionId,host.state.profile]){let last=atom?.get?.();atom?.subscribe?.(()=>{const next=atom.get();if(next===last)return;last=next;activityScope.generation++;for(const fn of activityScope.listeners)fn()})}
}
const subscribeActivityScope=fn=>(activityScope.listeners.add(fn),()=>activityScope.listeners.delete(fn))
const getActivityGeneration=()=>activityScope.generation
function useActivityScope(){
 initActivityScope();const generation=useSyncExternalStore(subscribeActivityScope,getActivityGeneration,getActivityGeneration)
 const epoch=typeof sdk.useGatewayActivationEpoch==='function'?sdk.useGatewayActivationEpoch():null
 return {generation,epoch,gateway:host.state.gateway?.get?.()??null,connection:host.state.connectionId?.get?.()??null,profile:host.state.profile?.get?.()??null}
}
function useRowActivity(owner,rows){
 const rest=useContext(DialogRestContext),{activity}=useProfileInputWaiting(owner,rest,false),states=activity?.states||{}
 return Object.fromEntries((rows||[]).filter(r=>Object.hasOwn(states,r.id)).map(r=>[r.id,states[r.id]]))
}
const ACTIVITY_TTL=20000
class OwnerActivityConflict extends Error{}
function useProfileInputWaiting(owner,rest,poll=true){
 const {generation,epoch,gateway,connection,profile}=useActivityScope(),route=owner?.route,key=JSON.stringify([generation,connection,profile,epoch,owner?.name,route])
 const supported=!!owner&&!!rest&&gateway==='open'&&connection===owner.connectionId&&typeof route==='object'&&route?.connectionId===connection&&route.profile===owner.name&&route.targetProfile===owner.name
 const q=useQuery({queryKey:['sessioncrew','profile-input-waiting',key],enabled:supported,retry:false,staleTime:10000,refetchOnMount:poll,refetchOnWindowFocus:poll,refetchInterval:poll?10000:false,queryFn:async()=>{
  const started=Date.now(),sameScope=()=>activityScope.generation===generation&&host.state.gateway?.get?.()==='open'&&host.state.connectionId.get()===connection&&host.state.profile.get()===profile&&(typeof sdk.gatewayActivationEpoch!=='function'||sdk.gatewayActivationEpoch()===epoch)
  const [active,roster]=await Promise.all([requestOwner(owner,'session.active_list',{profile:owner.name}),requestOwner(owner,'subagent.roster',{profile:owner.name}).catch(()=>null)]);if(!sameScope()||!Array.isArray(active?.sessions)||active.sessions.length>200)throw Error('activity unavailable')
  const ids=[],seen=new Set();for(const r of active.sessions){if(!r||typeof r.session_key!=='string'||!r.session_key||r.session_key.length>256||r.id!==r.session_key||typeof r.source!=='string'||!r.source||!['working','waiting','starting','idle'].includes(r.status)||seen.has(r.session_key))throw Error('invalid activity');seen.add(r.session_key);ids.push(r.session_key)}
  const ownership=ids.length?await rest('/row-owners',{method:'POST',body:{ids},timeoutMs:10000}):null
  if(!sameScope()||Date.now()-started>=ACTIVITY_TTL||ids.length&&(!ownership?.owners||!ownership?.sources))throw Error('ownership unavailable')
  for(const r of active.sessions)if(!Object.hasOwn(ownership.owners,r.id)||ownership.owners[r.id]!==owner.name||!Object.hasOwn(ownership.sources,r.id)||ownership.sources[r.id]!==r.source)throw new OwnerActivityConflict('ownership mismatch')
  const eligible=new Set(active.sessions.filter(r=>['idle','starting','working'].includes(r.status)).map(r=>r.id)),background=[]
  let rosterKnown=Array.isArray(roster?.sessions),unmatchedBackground=false
  if(rosterKnown)for(const r of roster.sessions){
   if(!r||typeof r.session_id!=='string'||!r.session_id||!Number.isSafeInteger(r.background)||r.background<0||!Number.isSafeInteger(r.subagents)||r.subagents<0)rosterKnown=false
   if((Number.isFinite(r?.background)&&r.background>0)||(Number.isFinite(r?.subagents)&&r.subagents>0)){
    if(eligible.has(r.session_id))background.push(r.session_id)
    else unmatchedBackground=true // May block timing, never drives another profile's indicators.
   }
  }
  const uniqueBackground=[...new Set(background)].sort(),backgroundSet=new Set(uniqueBackground),states=Object.fromEntries(active.sessions.map(r=>[r.id,backgroundSet.has(r.id)?'background':r.status]))
  const inputWait=active.sessions.filter(r=>r.status==='waiting').map(r=>JSON.stringify([r.id,r.source])).sort()
  return {states,waiting:inputWait.length>0,inputWaitKey:JSON.stringify(inputWait),working:active.sessions.some(r=>r.status==='working'||r.status==='starting'),background:uniqueBackground,started,observedAt:Date.now(),sessions:active.sessions,rosterKnown,unmatchedBackground}
 }})
 const [,tick]=useState(0);useEffect(()=>{if(!q.data)return;const timer=setTimeout(()=>tick(n=>n+1),Math.max(0,q.data.started+ACTIVITY_TTL-Date.now()));return()=>clearTimeout(timer)},[q.data])
 useEffect(()=>{if(!poll||!supported||typeof host.onEvent!=='function')return;return host.onEvent('gateway.ready',()=>{void q.refetch({cancelRefetch:false})})},[poll,supported,key])
 const age=Date.now()-q.data?.started
 return {activity:supported&&!q.isError&&age>=0&&age<ACTIVITY_TTL?q.data:null,conflict:supported&&q.isError&&q.error instanceof OwnerActivityConflict}
}
// Absence is not completion: retain the known executing cohort across partial
// lists, and require explicit idle for every member with the same source.
function observeIdle(previous,activity,allowed){
 const executing=new Map(),since=null
 if(!allowed||!activity||activity.waiting)return {executing,since,activity}
 if(previous?.activity===activity)return previous
 const fresh=previous?.activity&&activity.started>=previous.activity.started&&activity.observedAt-previous.activity.started<ACTIVITY_TTL
 const history=fresh?previous:null,sessions=activity.sessions||[]
 const byId=new Map(sessions.map(r=>[r.id,r]))
 if(!activity.rosterKnown||[...(history?.executing||[])].some(([id,source])=>byId.has(id)&&byId.get(id).source!==source))return {executing,since,activity}
 const busy=activity.working||activity.background.length>0||activity.unmatchedBackground
 const cohort=busy&&history?.since?executing:new Map(history?.executing)
 if(busy){
  for(const r of sessions)if(r.status==='working')cohort.set(r.id,r.source)
  if(cohort.size)for(const r of sessions)if(r.status==='starting'||activity.states[r.id]==='background')cohort.set(r.id,r.source)
  return {executing:cohort,since,activity}
 }
 const allIdle=cohort.size>0&&[...cohort.keys()].every(id=>byId.get(id)?.status==='idle')
 return {executing:history?.since&&!allIdle?executing:cohort,since:allIdle?(history?.since??activity.observedAt/1000):null,activity}
}
const elapsedMinutes=(clock,since)=>Math.max(0,Math.floor((clock-since*1000)/60000))
function ProfileAvatar({owner,ownerName,rest,attentionKey,idleAllowed,onActivity,clock,status,unreadSince,elapsedHint,...props}){
 const tr=useTranslator(),{activity,conflict}=useProfileInputWaiting(owner,rest),waiting=activity?.waiting===true,label=waiting?tr('sessionActivity.waiting'):'',history=useRef(null)
 const previous=history.current?.key===attentionKey?history.current:null
 const continuedWait=waiting&&previous?.activity?.waiting&&previous.activity.inputWaitKey===activity.inputWaitKey&&activity.started>=previous.activity.started&&activity.observedAt-previous.activity.started<ACTIVITY_TTL
 const waitingSince=waiting?(continuedWait?previous.waitingSince:activity.observedAt/1000):null
 useEffect(()=>()=>onActivity(ownerName,attentionKey,undefined,null),[ownerName,attentionKey,onActivity])
 useEffect(()=>{const next=observeIdle(history.current?.key===attentionKey?history.current:null,activity,idleAllowed);history.current={...next,key:attentionKey,waitingSince};onActivity(ownerName,attentionKey,activity,next.since,conflict)},[ownerName,attentionKey,onActivity,activity,idleAllowed,conflict,waitingSince])
 const busy=activity&&(activity.working||activity.background.length>0)
 const allowed=props.developerMode&&!busy&&status!=='offline'&&status!=='working'
 const idle=allowed&&!waiting?props.idleMinutes:null
 const attentionSince=allowed&&!activity?.unmatchedBackground?(waiting?waitingSince:!conflict&&idle===null?unreadSince:null):null
 const hint=attentionSince?(waiting?'inputWaitElapsed':'unreadCompletionElapsed'):idle!==null?elapsedHint:null
 return jsx(AvatarLayers,{...props,waiting,idleMinutes:idle,attentionMinutes:attentionSince?elapsedMinutes(clock,attentionSince):null,triggerProps:{...props.triggerProps,'aria-label':[props.triggerProps['aria-label'],label].filter(Boolean).join(' · '),title:[props.triggerProps.title,hint?tr('status.'+hint):'',label|| (props.unread?tr('completion.unread'):'')].filter(Boolean).join(' ')||undefined}})
}
// Explicit known messaging adapter sources; unknown/plugin sources stay visible.
const messagingPlatforms=[['Telegram',['telegram']],['Discord',['discord']],['WhatsApp',['whatsapp','whatsapp_cloud']],['Slack',['slack']],['Signal',['signal']],['Mattermost',['mattermost']],['Matrix',['matrix']],['Email',['email']],['SMS',['sms']],['DingTalk',['dingtalk']],['Feishu',['feishu']],['WeCom',['wecom','wecom_callback']],['Weixin',['weixin']],['BlueBubbles',['bluebubbles']],['QQ',['qqbot']],['Yuanbao',['yuanbao']],['LINE',['line']],['Google Chat',['google_chat']],['Teams',['teams']],['IRC',['irc']],['SimpleX',['simplex']]]
const messagingSources=new Set(messagingPlatforms.flatMap(([,sources])=>sources))
const isMessagingSource=source=>messagingSources.has(source)
const sourceVisible=(source,hidden)=>!isMessagingSource(source)||!hidden?.includes(source)
const recentSessionCounts=[3,5,10,15],defaultRecentSessionCount=5,recentRowHeight=52
const normalizeRecentSessionCount=count=>recentSessionCounts.includes(count)?count:defaultRecentSessionCount
const recentStaleTime=10000
const ownerRouteKey=owner=>{const route=owner?.route;return [owner?.connectionId,owner?.name,typeof route==='string'?'legacy':route?.connectionId,route?.profile,route?.targetProfile,route?.mode]}
const recentQueryKey=(scope,owner)=>['sessioncrew','recent',...scope,...ownerRouteKey(owner),0]
const recentRows=(data,settings)=>data?.rows.filter(row=>row.sourceConflict||(settings.showCron||row.source!=='cron')&&sourceVisible(row.source,settings.hiddenMessagingSources))
const recentFresh=query=>query.status==='success'&&!query.isInvalidated&&Date.now()-query.dataUpdatedAt<recentStaleTime
function Recent({owner,phase,retryRoutes,onOpened,completion,settings={showCron:false,hiddenMessagingSources:[]},menu}){
 const tr=useTranslator()
 const activeConnection=useValue(host.state.connectionId),activeProfile=useValue(host.state.profile),activation=typeof sdk.useGatewayActivationEpoch==='function'?sdk.useGatewayActivationEpoch():null
 const recentRest=useContext(DialogRestContext)
 const baseCount=normalizeRecentSessionCount(settings.recentSessionCount)
 const [page,setPage]=useState({baseCount,extra:0}),[projectGeneration,setProjectGeneration]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),rowLock=useRef(false),latestIntent=useRef(null)
 if(page.baseCount!==baseCount)setPage({baseCount,extra:0})
 const count=baseCount+(page.baseCount===baseCount?page.extra:0)
 function liveMenuOwner(){
  if(!owner||activation!==null&&typeof sdk.gatewayActivationEpoch==='function'&&sdk.gatewayActivationEpoch()!==activation)return null
  const target=menu.getLiveOwner(launchDestination(owner))
  return target?.route?.mode===owner.route?.mode?target:null
 }
 async function open(id){
  const target=menu?liveMenuOwner():owner
  if(rowLock.current||!target)return
  rowLock.current=true;setBusy(true);setError('')
  const watermark=completion.watermark(target,id,true)
  try{await openOwned(target,id);if(!menu||menu.isCurrent()){await completion.ack(target,id,watermark,menu?.isCurrent);onOpened()}}
  catch(e){if(!menu||menu.isCurrent())setError({message:()=>tr('session.openFailure',errorMessage(e,tr)||tr('errors.unknown'))})}
  finally{rowLock.current=false;if(!menu||menu.isCurrent())setBusy(false)}
 }
 const key=ownerRouteKey(owner),queryKey=recentQueryKey([activeConnection,activeProfile,activation],owner)
 const queryState=()=>sdk.queryClient?.getQueryState?.(queryKey)
 // Consume the open/retry intent once; interval and focus callbacks stay background.
 const recentIntent=useRef(null),intentKey=JSON.stringify(queryKey)
 const q=useQuery({queryKey,queryFn:()=>{const priority=recentIntent.current===intentKey?'background':'foreground';recentIntent.current=intentKey;return recentData(owner,priority,recentRest)},enabled:!!owner,retry:false,staleTime:recentStaleTime,refetchOnMount:true,refetchOnWindowFocus:!menu,refetchInterval:menu?false:15000})
 useEffect(()=>{if(q.data)recentIntent.current=intentKey},[intentKey,q.data])
 useEffect(()=>{
  if(latestIntent.current&&latestIntent.current.key!==intentKey){latestIntent.current=null;setBusy(false)}
 },[intentKey])
 const refetchRecent=()=>{
  if((queryState()??q).fetchStatus==='idle')recentIntent.current=null
  return q.refetch({cancelRefetch:false})
 }
 const rows=recentRows(q.data,settings)
 const activity=useRowActivity(menu?null:owner,menu?null:rows)
 const projectIntent=useRef(0)
 const projects=useQuery({queryKey:['sessioncrew','projects',...key,projectGeneration],queryFn:()=>{const priority=projectIntent.current===projectGeneration?'background':'foreground';projectIntent.current=projectGeneration;return projectData(owner,priority)},enabled:!!owner&&!menu,retry:false})
 const routeStatus=phase==='loading'?tr('session.findingRoute'):localizeError(phase)||tr('common.connectionNotReady')
 const listStatus=q.isError?tr(!menu&&rows?.length?'session.refreshFailure':'session.loadFailure',localizeError(errorMessage(q.error,tr)||tr('errors.unknown'))):q.fetchStatus==='idle'||(menu&&q.fetchStatus==='paused')?tr('common.connectionNotReady'):tr('session.loading')
 const retryList=()=>jsx('button',{type:'button',disabled:q.isFetching,onClick:()=>void refetchRecent(),children:tr('common.retry')},'retry')
 if(menu){
  const loading=owner?q.fetchStatus==='fetching':phase==='loading'
  const issue=owner?(!loading&&(q.isError||q.isPaused||q.isPending)?listStatus:null):loading?null:routeStatus
  const canOpen=owner&&!issue&&!!rows?.length
  const latestLabel=canOpen||issue?'session.openLatest':loading?'session.loadingLatest':'session.noRecentSessions'
  const canRead=completion.coverageReady&&completion.covers(menu.owner.name)
  const openLatest=async()=>{
   if(latestIntent.current||!liveMenuOwner())return
   const current=queryState()??q
   const visible=recentRows(current.data,menu.getSettings())
   if(!visible?.length||current.fetchStatus==='paused'||current.status==='error'&&current.fetchStatus!=='fetching')return
   if(current.fetchStatus==='idle'&&recentFresh(current))return open(visible[0].id)
   // The click joins a running refresh or starts one for this exact query key.
   const intent={key:intentKey,updatedAt:current.dataUpdatedAt,updateCount:current.dataUpdateCount}
   latestIntent.current=intent;setBusy(true);setError('')
   let latest
   try{
    const result=await refetchRecent()
    const next=queryState()??result
    const advanced=next.dataUpdatedAt>intent.updatedAt||next.dataUpdateCount>intent.updateCount
    if(latestIntent.current===intent&&next.fetchStatus==='idle'&&advanced&&recentFresh(next)&&liveMenuOwner())latest=recentRows(next.data,menu.getSettings())?.[0]
   }finally{
    if(latestIntent.current===intent){latestIntent.current=null;if(menu.isCurrent())setBusy(false)}
   }
   if(latest)await open(latest.id)
  }
  // Keep the first action focusable while the fresh list is loading.
  const action=(label,disabled,run)=>jsx('button',{type:'button','aria-disabled':disabled||undefined,onClick:()=>{if(!disabled&&!rowLock.current&&!latestIntent.current&&menu.isCurrent())void run()},style:{...s.button,textAlign:'left',opacity:disabled ? .55 : 1,cursor:disabled?'default':'pointer'},children:label})
  const markAll=async()=>{
   rowLock.current=true;setBusy(true);setError('')
   try{await completion.ackAll(menu.owner,menu.isCurrent)}finally{rowLock.current=false;if(menu.isCurrent())setBusy(false)}
  }
  return jsxs(React.Fragment,{children:[action(tr(latestLabel),busy||!canOpen,openLatest),action(tr('completion.markAllRead'),busy||!canRead,markAll),issue?jsx('small',{role:'alert',children:issue}):null,error?jsx('small',{role:'alert',children:localizeError(error)}):null]})
 }

 // Match the loaded list and footer from the first render; allow shrinking in short viewports.
 const reserve=baseCount*recentRowHeight
 const recentLayout={minHeight:0,display:'flex',flexDirection:'column',flex:'1 1 auto',marginTop:12},recentList={...s.sessions,minHeight:0,height:reserve,flex:'1 1 auto',maxHeight:reserve,overflowY:'auto'}
 const placeholder=(children,center=false)=>jsxs('div',{style:recentLayout,children:[jsx('div',{'data-recent-list':true,style:center?{...recentList,display:'grid',placeItems:'center'}:recentList,children}),jsx('div',{style:{height:18,flexShrink:0}})]})
 if(!owner) return placeholder([jsx('span',{children:routeStatus},'message'),phase!=='loading'?jsx('button',{onClick:retryRoutes,children:tr('common.retry')},'retry'):null])
 if(q.isPending) return placeholder(listStatus,q.fetchStatus!=='idle')
 if(q.isError&&!rows?.length) return placeholder([jsx('span',{role:'alert',children:listStatus},'message'),retryList()])


 const ellipsis={whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',minWidth:0}
 const projectLabel=id=>projects.isError?tr('project.loadFailed'):projects.isPending?tr('project.loading'):(typeof projects.data?.labels?.[id]==='object'?tr(projects.data.labels[id].fallback):projects.data?.labels?.[id])||tr('project.uncategorized')
 return jsxs('div',{style:recentLayout,children:[jsx('style',{children:rowArcCss}),jsx(RecentScroll,{style:recentList,revision:Math.min(count,rows.length),children:rows.length?rows.slice(0,count).map(row=>jsxs('button',{'data-recent-row':true,type:'button',disabled:busy,onClick:()=>open(row.id),style:{position:'relative',height:recentRowHeight,boxSizing:'border-box',minWidth:0,width:'100%',display:'flex',alignItems:'center',gap:10,textAlign:'left',color:'inherit',border:0,borderRadius:7,padding:'9px 8px',background:'transparent',cursor:'pointer'},children:[['working','background'].includes(activity[row.id])?jsx('span',{'data-session-arc':true,'aria-hidden':true}):null,jsx('span',{'data-session-indicator':true,style:{position:'absolute',left:0,top:0,pointerEvents:'none'},children:activity[row.id]==='waiting'?jsx('span',{'data-session-waiting':true,role:'img','aria-label':tr('sessionActivity.waiting'),title:tr('sessionActivity.waiting'),style:{display:'block',fontSize:14,lineHeight:1},children:'✋'}):activity[row.id]!=='background'&&completion.watermark(owner,row.id).length?jsx('span',{'data-session-completion-badge':true,role:'img','aria-label':tr('completion.unread'),title:tr('completion.unread'),style:{...unreadCircle,display:'block',position:'relative',left:-2,top:-2}}):null}),jsxs('span',{style:{minWidth:0,flex:'1 1 auto'},children:[jsx('strong',{style:{...ellipsis,display:'block',fontSize:12,color:'var(--ui-text-primary)'},title:row.title||tr('session.untitled'),children:row.title||tr('session.untitled')}),jsx('span',{style:{...ellipsis,display:'block',fontSize:11,marginTop:4},title:projectLabel(row.id),children:'▧ '+projectLabel(row.id)})]}),jsx('span',{'aria-hidden':true,children:'›'})]},row.id)):tr('session.empty')},baseCount),q.isError?jsxs('div',{role:'alert',children:[listStatus,retryList()]}):null,error?jsx('div',{role:'alert',children:localizeError(error)}):null,projects.isError?jsx('button',{onClick:()=>setProjectGeneration(n=>n+1),children:tr('project.retry')}):null,jsxs('div',{'data-recent-footer':true,style:{position:'relative',display:'flex',alignItems:'center',justifyContent:'center',minHeight:18,flexShrink:0},children:[count<rows.length?jsx('button',{'data-recent-more':true,type:'button',onClick:()=>setPage(previous=>({...previous,extra:previous.extra+10})),style:{...s.button,border:0,padding:'0 8px',height:18,lineHeight:'18px'},'aria-label':tr('session.showMore'),children:tr('common.loadMore')}):null,jsx('button',{'data-completion-read-all':true,type:'button',disabled:!completion.coverageReady,onClick:()=>void completion.ackAll(owner),style:{...s.button,position:'absolute',right:0,border:0,padding:'0 8px',height:18,lineHeight:'18px'},children:tr('completion.markAllRead')})]})]})
}
const unreadCircle={width:10,height:10,borderRadius:'50%',background:'var(--ui-red, #e53935)'}
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
const projectMaxHeight=220,projectViewportPercent=32.5,projectHeightInset=7.5
const projectDesiredHeight=`clamp(0px, ${projectViewportPercent}vh - ${projectHeightInset}px, ${projectMaxHeight}px)`
const primaryViewportHeight='calc(100vh - 24px)'
// Keep one readable session row above the fixed controls when space allows.
const primaryWithProjectsHeight=`max(min(${152+recentRowHeight}px, ${primaryViewportHeight}), calc(${primaryViewportHeight} - ${projectDesiredHeight}))`
function Launchers({owner,ownerName,isCurrent,getLiveOwner,isLaunching,beginLaunch,onDismiss,onOpened,pending,projectOpen,setProjectOpen,createdProjects,dialogActive,unknownProjects,parentContentRef}){
 const tr=useTranslator()
 const [error,setError]=useState(''),[projectGeneration,setProjectGeneration]=useState(0),[dialogOpen,setDialogOpen]=useState(false),projectTrigger=useRef(null),[projectLayout,setProjectLayout]=useState({side:'bottom'})
 useEffect(()=>{
  const parent=parentContentRef?.current
  if(!projectOpen||!parent)return
  let first=0,second=0
  const update=()=>{
   const r=parentContentRef.current?.getBoundingClientRect()
   if(!r)return
   const {innerWidth:width,innerHeight:height}=window
   const desired=Math.max(0,Math.min(projectMaxHeight,height*projectViewportPercent/100-projectHeightInset))
   const available=Math.max(0,Math.max(r.top,height-r.bottom)-12)
   const room=width-r.right>=r.width+12,horizontal=available<desired&&room,overlay=available<76&&!room
   const side=horizontal?'right':'bottom',verticalLimit=!horizontal&&!overlay&&available<desired?available:undefined
   const sideOffset=overlay?Math.max(0,Math.min(r.top,height-desired))-r.bottom:undefined
   const alignOffset=overlay?Math.max(0,Math.min(r.left,width-r.width-2))-r.left:undefined
   setProjectLayout(old=>old.side===side&&old.verticalLimit===verticalLimit&&old.overlay===overlay&&old.sideOffset===sideOffset&&old.alignOffset===alignOffset?old:{side,verticalLimit,overlay,sideOffset,alignOffset})
  }
  const schedule=()=>{
   if(typeof window.requestAnimationFrame!=='function'){update();return}
   if(first||second)return
   first=window.requestAnimationFrame(()=>{first=0;second=window.requestAnimationFrame(()=>{second=0;update()})})
  }
  schedule()
  window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,true)
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null
  observer?.observe(parent,{box:'border-box'})
  return()=>{
   if(first)window.cancelAnimationFrame(first)
   if(second)window.cancelAnimationFrame(second)
   observer?.disconnect()
   window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule,true)
  }
 },[projectOpen,parentContentRef])
 const dialogAvailable=!!owner&&typeof owner.route==='object'&&!!owner.route&&typeof host.requestProfile==='function'&&['Dialog','DialogContent','DialogHeader','DialogTitle','DialogDescription','DialogFooter','Button','Input','Textarea'].every(k=>!!sdk[k])
 useEffect(()=>()=>{dialogActive.current=false},[dialogActive])
 const route=owner?.route, ownerScope=[owner?.connectionId,owner?.name,typeof route==='string'?'legacy':route?.connectionId,route?.profile,route?.targetProfile,route?.mode]
 const queryKey=['sessioncrew','projects',...ownerScope,projectGeneration]
 const projectIntent=useRef(0)
 const projects=useQuery({queryKey,queryFn:()=>{const priority=projectIntent.current===projectGeneration?'background':'foreground';projectIntent.current=projectGeneration;return projectData(owner,priority)},enabled:!!owner,retry:false})
 const key=JSON.stringify([owner?.connectionId,owner?.name,owner?.route])
 const launchKey=owner&&launchOwnerKey(owner),destination=owner&&launchDestination(owner)
 const launch=pending.current.get(launchKey),busy=!!launch?.inflight
 const unconfirmed=!busy&&launch?.phase==='dispatched'
 const retryable=launch?.phase==='acknowledged'&&launch.destination===destination
 const launchDisabled=busy||unconfirmed||launch?.phase==='acknowledged'&&!retryable
 const unknownKey=JSON.stringify([route?.connectionId,route?.targetProfile])
 const unknownWarning=tr('project.unknownWarning')
 const choices=[...(projects.data?.choices||[])];for(const project of createdProjects.current.get(key)||[])if(!choices.some(p=>p.id===project.id))choices.push(project)
 function createProject(){if(!dialogAvailable||dialogActive.current||unknownProjects.current.has(unknownKey))return;dialogActive.current=true;setDialogOpen(true)}
 function closeDialog(){dialogActive.current=false;setDialogOpen(false)}
 function rememberProject(project){const rows=createdProjects.current.get(key)||[];createdProjects.current.set(key,[...rows.filter(x=>x.id!==project.id),project]);try{Promise.resolve(sdk.queryClient?.invalidateQueries?.({queryKey:queryKey.slice(0,-1),refetchType:'none'})).catch(()=>{})}catch{}if(isCurrent())setProjectGeneration(n=>n+1)}
 async function refreshProjects(){if(sdk.queryClient?.invalidateQueries)await sdk.queryClient.invalidateQueries({queryKey:queryKey.slice(0,-1),refetchType:'none'});if(isCurrent())setProjectGeneration(n=>n+1)}
 async function create(project=null){
  const dispatchOwner=owner&&getLiveOwner(destination)
  if(!dispatchOwner)return
  const record=pending.current.get(launchKey)||{phase:'pre-dispatch',inflight:false,destination}
  if(record.inflight||record.phase==='dispatched'||record.destination!==destination)return
  pending.current.set(launchKey,record);record.inflight=true
  const finishLaunch=beginLaunch();setError('')
  try{
   if(record.phase==='pre-dispatch'){
    if(project&&!project.path)throw new LocalizedError('errors.projectNoPath')
    const params=project?{source:'desktop',cwd:project.path,cwd_explicit:true}:{source:'desktop'}
    const sameOwner=host.state.connectionId.get()===dispatchOwner.connectionId&&host.state.profile.get()===dispatchOwner.name
    const routed=typeof host.requestProfile==='function'
    if(((typeof dispatchOwner.route==='string'||!routed)&&!sameOwner)||(!routed&&typeof host.request!=='function'))throw new LocalizedError('errors.createOtherUnsupported')
    record.phase='dispatched'
    const result=routed?await host.requestProfile(dispatchOwner.route,'session.create',params,undefined,{spawnPriority:'foreground'}):await host.request('session.create',params)
    if(result?.error)return
    const id=[result?.stored_session_id,result?.session_key,result?.session_id].find(value=>typeof value==='string'&&value.trim())
    if(!id)return
    record.id=id;record.phase='acknowledged'
   }
   const liveOwner=getLiveOwner(record.destination)
   if(!liveOwner)return
   await openOwned(liveOwner,record.id)
   pending.current.delete(launchKey)
   if(getLiveOwner(record.destination))onOpened()
  }catch(e){
   if(record.phase==='pre-dispatch')pending.current.delete(launchKey)
   if(record.phase!=='dispatched'&&getLiveOwner(record.destination))setError({message:()=>record.phase==='acknowledged'?tr('session.createdOpenFailure',record.id,errorMessage(e,tr)||tr('errors.unknown')):tr('common.creationFailure',errorMessage(e,tr)||tr('errors.unknown'))})
  }
  finally{record.inflight=false;finishLaunch()}
 }
 const ellipsis={display:'block',minWidth:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}
 const Glyph=sdk.Codicon||'span'
 return jsxs('div',{style:{flexShrink:0},children:[dialogOpen?jsx(ProjectDialog,{owner,ownerName,isCurrent,onClose:closeDialog,onCreated:rememberProject,onRefresh:refreshProjects,unknownProjects}):null,jsxs('div',{style:s.footer,children:[jsx('button',{type:'button',disabled:launchDisabled||!owner,onClick:()=>create(),style:{...s.button,flex:1,minWidth:0},children:retryable?tr('session.retryOpen'):jsxs('span',{style:{display:'inline-flex',alignItems:'center',gap:4},children:[jsx(Glyph,{name:'add',size:'0.75rem','aria-hidden':true}),tr('session.quickCreate')]})}),jsxs(Popover,{open:projectOpen,onOpenChange:open=>{if(!open&&isLaunching())onDismiss();else if(open||!dialogActive.current)setProjectOpen(open)},children:[jsx(PopoverTrigger,{asChild:true,children:jsx('span',{'aria-hidden':true,tabIndex:-1,style:{position:'absolute',inset:0,pointerEvents:'none'}})}),jsx('button',{ref:projectTrigger,type:'button',disabled:busy||!owner,'aria-expanded':projectOpen,'aria-haspopup':'dialog',onClick:()=>setProjectOpen(!projectOpen),style:{...s.button,flex:1,minWidth:0},children:tr('project.open')}),jsxs(PopoverContent,{side:projectLayout.side,align:'start',avoidCollisions:!projectLayout.overlay,sideOffset:projectLayout.sideOffset,alignOffset:projectLayout.alignOffset,onCloseAutoFocus:e=>{e.preventDefault();if(isCurrent())projectTrigger.current?.focus({preventScroll:true})},onFocusOutside:e=>{if(isLaunching())e.preventDefault()},onInteractOutside:e=>{if(dialogActive.current||parentContentRef&&parentContentRef.current?.contains(e.target))e.preventDefault()},style:{...s.bubble,padding:'min(16px, 2vh)',boxSizing:'border-box',maxHeight:projectLayout.verticalLimit===undefined?projectDesiredHeight:`min(${projectDesiredHeight}, ${projectLayout.verticalLimit}px)`,overflow:'hidden'},children:[jsxs('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,height:30},children:[jsx('strong',{children:tr('project.title')}),jsx('button',{type:'button','aria-label':tr('project.new'),title:unknownProjects.current.has(unknownKey)?tr('project.unknownList'):dialogAvailable?tr('project.newForProfile'):tr('errors.projectUiUnsupported'),disabled:busy||!dialogAvailable||unknownProjects.current.has(unknownKey),onClick:()=>void createProject(),style:{...s.button,border:0},children:jsx(Glyph,{name:'add',size:'0.75rem','aria-hidden':true})})]}),unknownProjects.current.has(unknownKey)?jsx('div',{role:'alert',children:unknownWarning,style:{fontSize:12,overflowY:'auto',flexShrink:1}}):null,projects.isPending&&!choices.length?tr('project.loadingList'):projects.isError&&!choices.length?jsxs('div',{role:'alert',children:[tr('project.loadFailed'),jsx('button',{onClick:()=>setProjectGeneration(n=>n+1),children:tr('project.retry')})]}):!choices.length?tr('project.empty'):jsx('div',{'data-project-list':true,style:{minHeight:0,maxHeight:96,overflowY:'auto',flex:'0 1 auto'},children:choices.map(project=>jsxs('div',{'data-project-row':true,style:{height:32,boxSizing:'border-box',flexShrink:0,display:'flex',alignItems:'center',gap:8,minWidth:0},children:[project.color&&!project.icon?jsx('span',{'data-project-icon':'color','aria-hidden':true,style:{width:14,height:14,display:'grid',placeItems:'center',flex:'none'},children:jsx('span',{style:{width:4,height:4,borderRadius:'50%',background:project.color}})}):jsx('span',{'data-project-icon':project.icon||(project.isAuto?'repo':'folder-library'),'aria-hidden':true,style:{color:project.color||'var(--ui-text-tertiary)',width:14,flex:'none'},children:jsx(Glyph,{name:project.icon||(project.isAuto?'repo':'folder-library'),size:'0.875rem'})}),jsx('div',{style:{minWidth:0,flex:'1 1 auto'},children:jsx('strong',{'data-project-name':true,title:typeof project.label==='object'?tr(project.label.fallback):project.label,style:{...ellipsis,fontSize:12},children:typeof project.label==='object'?tr(project.label.fallback):project.label})}),jsx('button',{type:'button',disabled:launchDisabled,'aria-label':tr('session.newInProject',typeof project.label==='object'?tr(project.label.fallback):project.label),onClick:()=>create(project),style:{...s.button,border:0,flex:'none'},children:jsx(Glyph,{name:'add',size:'0.75rem','aria-hidden':true})})]},project.id))})]})]})]}),unconfirmed||error?jsx('div',{role:'alert',children:unconfirmed?tr('session.createUnconfirmed'):localizeError(error)}):null]})
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
// SessionCrew's own namespace; never depends on Office being mounted.
const STATUS_TTL=15000
const validIdleStart=(value,now)=>typeof value==='number'&&Number.isFinite(value)&&value>0&&value*1000<=now
const recentWork=row=>row?.online===true&&row.state==='working'&&['recent_session_activity','recent_delegated_activity'].includes(row.status_observation)
// Recency and fresh gateway observation are independent. Only zero can
// confirm idle; a positive count can carry history, not confirm a new start.
const railStatus=row=>recentWork(row)?row.status_observation==='recent_session_activity'&&row.shared_gateway_observation==='zero'?'idle':'online_unobserved':officeStatus(row)
const backendIdleStart=row=>recentWork(row)?row.last_session_activity:row.idle_since
const sharedIdleHistory=row=>recentWork(row)?row.shared_gateway_observation==='positive':row?.state==='online_unobserved'&&row.busy===null&&row.idle_since===null&&row.status_observation==='fresh_shared_gateway_no_observed_owner_work'
const ownBusyStatus=(row,status)=>row.active_turn===true||row.waiting===true||status==='working'||status==='waiting'
function oneshotProof(row,sampledAt,now){
 const {observed_at,expires_at}=row.oneshot_activity||{},observed=observed_at*1000,expires=expires_at*1000
 if(row.active_turn!==true||typeof observed_at!=='number'||typeof expires_at!=='number'||!Number.isFinite(observed)||!Number.isFinite(expires)||observed<=0||expires<=observed||observed<sampledAt-1000||observed>now+1000)return null
 // Bound validity by the sampled lease, not by a fresh cache delivery. Use
 // the request start for a conservative expiry even with minor clock skew.
 const validUntil=Math.min(expires,sampledAt+expires-observed,sampledAt+STATUS_TTL)
 return now<validUntil?{sampledAt,validUntil}:null
}
function lastActivityEstimate(row,now){
 if(!row?.online||row.active_turn===true||row.waiting===true||!validIdleStart(row.last_session_activity,now))return null
 const shared=row.shared_gateway_observation
 const explicit=row.state==='online_unobserved'&&sharedIdleHistory(row)&&(shared===undefined||shared==='positive')
 const recency=recentWork(row)&&row.status_observation==='recent_session_activity'&&shared==='positive'&&row.idle_since==null
 return explicit||recency?row.last_session_activity:null
}
const fenceAt=(fences,name,at)=>fences.set(name,Math.max(fences.get(name)||0,at))
const freshStatus=(q,now)=>!q.isError&&Array.isArray(q.data)&&Number.isFinite(q.dataUpdatedAt)&&now-q.dataUpdatedAt<STATUS_TTL&&q.dataUpdatedAt<=now+1000
function useRailSnapshot(rest,connection,profile,{epoch,generation,gateway}){
 const scope=JSON.stringify([connection,profile,epoch,generation]), current=useRef(scope);current.current=scope
 const sameScope=()=>current.current===scope&&activityScope.generation===generation&&host.state.connectionId.get()===connection&&host.state.profile.get()===profile&&(typeof sdk.gatewayActivationEpoch!=='function'||sdk.gatewayActivationEpoch()===epoch)
 const history=useRef(null);if(history.current?.scope!==scope)history.current={scope,starts:new Map(),idleFences:new Map(),estimateFences:new Map(),oneshotFences:new Map()}
 const [clock,tick]=useState(()=>Date.now())
 const enabled=!!profile&&typeof rest==='function'
 const q=useQuery({queryKey:['sessioncrew','status',connection,profile,epoch,generation],enabled,retry:false,staleTime:STATUS_TTL,refetchInterval:5000,refetchOnWindowFocus:true,queryFn:async({signal}={})=>{
 try{
  const sampledAt=Date.now()
  const data=await rest('/status',{method:'GET',timeoutMs:10000})
  if(signal?.aborted||!sameScope())throw new LocalizedError('errors.connectionChanged')
  if(!Array.isArray(data))throw new LocalizedError('errors.statusFormat')
  const names=new Set();for(const row of data){if(!row||typeof row.profile!=='string'||!row.profile||names.has(row.profile)||typeof row.online!=='boolean'||typeof row.state!=='string')throw new LocalizedError('errors.statusFormat');names.add(row.profile)}
  const starts=history.current.starts,now=Date.now();if(history.current.lastAt&&now-history.current.lastAt>STATUS_TTL)starts.clear();history.current.lastAt=now
  const rows=data.map(row=>{
   const status=railStatus(row),since=backendIdleStart(row)
   const proof=oneshotProof(row,sampledAt,now)
   if(proof&&row.online&&row.waiting!==true&&status!=='idle'&&status!=='waiting')fenceAt(history.current.oneshotFences,row.profile,sampledAt)
   if(row.online&&ownBusyStatus(row,status)){
    fenceAt(history.current.estimateFences,row.profile,sampledAt)
    starts.delete(row.profile)
   }else if(status==='idle'&&validIdleStart(since,now))starts.set(row.profile,{since,sampledAt})
   else if(status!=='online_unobserved'||!sharedIdleHistory(row))starts.delete(row.profile)
   const sample=proof?{...row,oneshotProof:proof}:row
   return status==='idle'?{...sample,idleSampledAt:sampledAt}:sample
  })
  for(const name of starts.keys())if(!names.has(name))starts.delete(name)
  return rows
 }catch(error){if(!signal?.aborted&&sameScope())history.current.starts.clear();throw error}
 }})
 useEffect(()=>{
  if(!enabled||gateway!=='open'||typeof host.onEvent!=='function')return
  return host.onEvent('gateway.ready',event=>{
   if((event?.connectionId??null)!==connection||event?.profile!==profile||!sameScope()||freshStatus(q,Date.now()))return
   void q.refetch({cancelRefetch:false})
  })
 },[enabled,gateway,scope,q.data,q.dataUpdatedAt,q.isError,q.refetch])
 useEffect(()=>{const update=()=>{if(!document.hidden)tick(Date.now())};const timer=setInterval(update,1000);document.addEventListener('visibilitychange',update);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update)}},[])
 const {starts,idleFences,estimateFences,oneshotFences}=history.current
 if(!freshStatus(q,Date.now())){starts.clear();return [[],clock,starts,idleFences,estimateFences,oneshotFences]}
 const rows=q.data.map(row=>{
  const status=railStatus(row),since=backendIdleStart(row),start=starts.get(row.profile)
  if(status==='idle'&&validIdleStart(since,Date.now()))return {...row,presentationIdleSince:since}
  if(status==='online_unobserved'&&sharedIdleHistory(row)&&start)return {...row,presentationIdleSince:start.since,idleSampledAt:start.sampledAt,historicalIdle:true}
  return row
 })
 return [rows,clock,starts,idleFences,estimateFences,oneshotFences]
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
function GuardedPopover({active,compact,onOpenChange,isLaunching,children}){
 const avatar=useRef(null),content=useRef(null),close=useRef(onOpenChange),geometryClose=useRef(false)
 const [,setContentElement]=useState(null)
 const contentRef=useCallback(node=>{content.current=node;setContentElement(node)},[])
 close.current=onOpenChange
 useEffect(()=>{
  if(!active||compact)return
  const a=avatar.current,c=content.current,rail=a?.closest('[data-profile-rail]')
  if(!a||!c||!rail)return
  let first=0,second=0
  const check=()=>{if(isLaunching())return;const ar=a.getBoundingClientRect(),rr=rail.getBoundingClientRect(),cr=c.getBoundingClientRect();const center=(ar.top+ar.bottom)/2,style=getComputedStyle(c);const top=(parseFloat(style.borderTopLeftRadius)||0)+10,bottom=(parseFloat(style.borderBottomLeftRadius)||0)+10;if(center<rr.top||center>rr.bottom||center-cr.top<top||cr.bottom-center<bottom){geometryClose.current=true;close.current(false)}}
  const schedule=()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);first=requestAnimationFrame(()=>{second=requestAnimationFrame(check)})}
  schedule();rail.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule)
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;observer?.observe(a);observer?.observe(c);observer?.observe(rail)
  return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);rail.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);observer?.disconnect()}
 })
 return jsxs(Popover,{open:active,onOpenChange,children:children(avatar,contentRef,e=>{if(geometryClose.current){e.preventDefault();geometryClose.current=false}},content)})
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
  for(const r of p.rows){if(!r||!Number.isSafeInteger(r.seq)||r.seq<1||r.seq>p.high_water||seqs.has(r.seq)||!text(r.admission_id)||ids.has(r.admission_id)||!text(r.session_id)||(r.session_source!=null&&!text(r.session_source))||!['queued','started','unknown','terminal'].includes(r.status)||(r.outcome!==null&&typeof r.outcome!=='string')||(r.generation!==null&&(!Number.isSafeInteger(r.generation)||r.generation<1)))throw new LocalizedError('errors.completionEventFormat');seqs.add(r.seq);ids.add(r.admission_id)}
 }
 return data
}
function validStoredLedger(saved){
 try{
  if(!saved||saved.version!==2||!Array.isArray(saved.rows)||saved.rows.length>5000)return false
  const keys=new Set(),text=x=>typeof x==='string'&&x.length>0&&x.length<=256
  for(const x of saved.rows){
   if(!x||typeof x.key!=='string'||!text(x.owner)||!text(x.session)||!text(x.database)||typeof x.connection!=='string'||typeof x.source!=='string'||(x.session_source!=null&&!text(x.session_source))||(x.last_known_session_source!=null&&!text(x.last_known_session_source))||(x.session_source_conflict!=null&&typeof x.session_source_conflict!=='boolean')||typeof x.read!=='boolean'||keys.has(x.key))return false
   const source=JSON.parse(x.source),key=JSON.parse(x.key)
   if(!Array.isArray(source)||source.length!==3||!(source[0]===null||text(source[0]))||!text(source[1])||!text(source[2])||JSON.stringify(source)!==x.source||JSON.stringify(source[0])!==x.connection||!Array.isArray(key)||key.length!==5||key[0]!==x.source||key[1]!==x.owner||key[2]!==x.database||key[3]!==x.session||!text(key[4])||JSON.stringify(key)!==x.key)return false
   keys.add(x.key)
  }
  if(saved.coverage!=null){const c=saved.coverage,source=JSON.parse(c.source);if(!Array.isArray(source)||source.length!==3||!Array.isArray(c.profiles))return false;validateSnapshot({version:2,source_root:'default',source_id:source[1],server_epoch:source[2],profiles:c.profiles.map(p=>({profile:p.owner,status:'ok',database_id:p.database_id,high_water:p.high_water,truncated:false,rows:p.rows}))})}
  return true
 }catch{return false}
}
function sameSnapshotDataset(a,b){try{const x=JSON.parse(a),y=JSON.parse(b);return x[0]===y[0]&&x[1]===y[1]}catch{return false}}
function useCompletion(storage,rest,connection,profile,showCron,hiddenMessagingSources,preferences){
 const tr=useTranslator()
 const focusIdAtom=host.state.focusedStoredSessionId,focusOwnerAtom=host.state.focusedSessionOwner
 const focusedId=useSyncExternalStore(fn=>focusIdAtom?.subscribe?.(fn)||(()=>{}),()=>focusIdAtom?.get?.()??null,()=>null)
 const focusedOwner=useSyncExternalStore(fn=>focusOwnerAtom?.subscribe?.(fn)||(()=>{}),()=>focusOwnerAtom?.get?.()??null,()=>null)
 const focusedMatches=(owner,id)=>{const current=focusOwnerAtom?.get?.();return !!current&&typeof current.connectionId==='string'&&current.connectionId===connection&&current.profile===owner&&focusIdAtom?.get?.()===id}
 const activation=typeof sdk.useGatewayActivationEpoch==='function'?sdk.useGatewayActivationEpoch():null
 const [generation,retry]=useState(0),[,render]=useState(0),ref=useRef(null)
 const scope=JSON.stringify([connection??null,profile,activation,generation])
 if(!ref.current||ref.current.scope!==scope)ref.current={scope,ready:false,failed:false,baseline:null,known:null,gap:false,rows:[],observed:new Map(),cleared:new Map(),queue:Promise.resolve()}
 const state=ref.current
 const q=useQuery({queryKey:['sessioncrew','completion-snapshot',connection,profile,activation,generation],enabled:!!profile&&typeof rest==='function',retry:false,refetchOnWindowFocus:false,refetchOnReconnect:false,refetchInterval:query=>query.state.status==='success'&&query.state.fetchFailureCount===0?15000:false,queryFn:async()=>{const data=validateSnapshot(await rest('/completion-snapshot',{method:'GET',timeoutMs:30000}));if(host.state.connectionId.get()!==connection||host.state.profile.get()!==profile)throw new LocalizedError('errors.connectionChanged');return data}})
 const queryClient=typeof sdk.useQueryClient==='function'?sdk.useQueryClient():null
 const observed=JSON.stringify((q.isError||q.fetchFailureCount?[]:q.data?.profiles||[]).flatMap(p=>p.status==='ok'?p.rows.map(r=>r.session_source):[]))
 useEffect(()=>{const cache=queryClient?.getQueryCache();let live=true
  const update=()=>{if(!live||host.state.connectionId.get()!==connection||host.state.profile.get()!==profile)return;const recent=cache?.findAll({queryKey:['sessioncrew','recent',connection,profile,activation]})||[],snapshot=cache?.find({queryKey:['sessioncrew','completion-snapshot',connection,profile,activation,generation],exact:true});const snapshotSources=cache?(snapshot?.state.status==='success'&&!snapshot.state.fetchFailureCount?(snapshot.state.data?.profiles||[]).flatMap(p=>p.status==='ok'?p.rows.map(r=>r.session_source):[]):[]):JSON.parse(observed);const sources=[...snapshotSources,...recent.flatMap(query=>query.state.status==='success'&&!query.state.fetchFailureCount?(query.state.data?.rows||[]).filter(row=>!row.sourceConflict).map(row=>row.source):[])];preferences.observe([...new Set(sources.filter(s=>messagingSources.has(s)))].sort())}
  update();const unsubscribe=cache?.subscribe(update);return()=>{live=false;unsubscribe?.()}
 },[preferences,observed,connection,profile,activation,generation,queryClient])
 useEffect(()=>{let live=true
  state.queue=queueSnapshotStorage(async()=>{if(!storage?.get||!storage?.set)throw Error('storage unavailable');const saved=await storage.get(SNAPSHOT_LEDGER);if(saved!==undefined&&!validStoredLedger(saved))throw Error('invalid ledger');if(!live||ref.current!==state)return;state.rows=saved?.rows||[];state.known=saved?.coverage?{source:saved.coverage.source,profiles:new Map(saved.coverage.profiles.map(p=>[p.owner,{database_id:p.database_id,high_water:p.high_water,rows:p.rows}]))}:null;state.ready=true;render(n=>n+1)}).catch(()=>{if(live&&ref.current===state){state.failed=true;render(n=>n+1)}})
  return()=>{live=false}
 },[storage,state])
 useEffect(()=>{
  if(q.isError){state.baseline=null;return}
  if(!q.data||q.isFetching)return
  const data=q.data,completionObservation={since:q.dataUpdatedAt/1000,generation:activityScope.generation}
  state.queue=queueSnapshotStorage(async()=>{
   if(state.failed||!state.ready||ref.current!==state)return
   const source=JSON.stringify([connection??null,data.source_id,data.server_epoch]),old=state.baseline
   if(old&&old.source!==source)state.gap=false
   let rows=state.rows.slice();const observed=new Map(state.observed)
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
    // Dataset identity is not the session source. Classify only against an
    // owner/database-matched complete snapshot; disagreements stay unknown.
    rows=rows.map(x=>{if(!sameSnapshotDataset(x.source,source)||x.owner!==p.profile||x.database!==p.database_id)return x;const r=now.get(JSON.parse(x.key)[4]),previous=prior.get(JSON.parse(x.key)[4]);if(!r||r.session_id!==x.session)return x;const s=r.session_source??null,known=[x.last_known_session_source,x.session_source,previous?.session_source,s].filter(Boolean),conflict=!!x.session_source_conflict||new Set(known).size>1;return {...x,session_source:conflict?null:s,last_known_session_source:s??previous?.session_source??x.session_source??x.last_known_session_source??null,session_source_conflict:conflict}})
    if(before&&consistent)for(const r of p.rows){const previous=prior.get(r.admission_id);const becameComplete=r.status==='terminal'&&r.outcome==='completed'&&(!previous||previous.status!=='terminal'||previous.outcome!=='completed');if(!becameComplete)continue;const key=JSON.stringify([source,p.profile,p.database_id,r.session_id,r.admission_id]);const conflict=!!(r.session_source&&previous?.session_source&&r.session_source!==previous.session_source);if(!rows.some(x=>sameSnapshotDataset(x.source,source)&&x.owner===p.profile&&x.database===p.database_id&&JSON.parse(x.key)[4]===r.admission_id)){
     const read=focusedMatches(p.profile,r.session_id)
     rows.push({key,connection:JSON.stringify(connection??null),source,owner:p.profile,database:p.database_id,session:r.session_id,session_source:conflict?null:r.session_source??null,last_known_session_source:r.session_source??previous?.session_source??null,session_source_conflict:conflict,read})
     if(!read&&!conflict)observed.set(key,completionObservation)
    }}
    const coverage={database_id:p.database_id,high_water:p.high_water,rows:p.rows};next.set(p.profile,coverage);known.set(p.profile,coverage)
   }
   if(rows.length>5000)throw Error('completion ledger full')
   const baseline={source,profiles:next},knownCoverage={source,profiles:known}
   await writeSnapshotLedger(storage,rows,knownCoverage)
   if(ref.current!==state)return
   state.observed=new Map(rows.filter(x=>!x.read&&x.source===source&&observed.has(x.key)).map(x=>[x.key,observed.get(x.key)]))
   state.rows=rows;state.baseline=baseline;state.known=knownCoverage;render(n=>n+1)
  }).catch(()=>{if(ref.current===state){state.failed=true;state.baseline=null;render(n=>n+1)}})
 },[q.data,q.dataUpdatedAt,q.isError,q.isFetching,state,storage,connection])
 state.queryError=q.isError
 const usable=()=>ref.current===state&&state.ready&&!state.failed&&!!state.baseline&&!state.queryError&&!!profile&&host.state.connectionId.get()===connection&&host.state.profile.get()===profile
 const matches=(x,owner,id)=>sameSnapshotDataset(x.source,state.baseline?.source)&&x.database===state.baseline?.profiles.get(owner?.name)?.database_id&&x.connection===JSON.stringify(owner?.connectionId??null)&&x.owner===owner?.name&&x.session===id&&!x.read
 // Record only a durable acknowledgement of the last presentation-relevant
 // unread event. Background suppression and waiting hands never alter ledger
 // relevance; a future settings change is not itself an acknowledgement.
 const visible=x=>x.session_source_conflict===true||(x.session_source!=='oneshot'&&(showCron||x.session_source!=='cron')&&sourceVisible(x.session_source,hiddenMessagingSources))
 state.visible=visible
 const clearKey=owner=>JSON.stringify([state.baseline?.source,owner.name,state.baseline?.profiles.get(owner.name)?.database_id])
 const commitAck=async(owner,rows)=>{
  const relevant=x=>covered(x,owner)&&state.visible(x),readKeys=new Set(rows.filter(x=>x.read).map(x=>x.key))
  const changed=state.rows.some(x=>relevant(x)&&readKeys.has(x.key))
  const last=changed&&!rows.some(relevant),key=clearKey(owner)
  await writeSnapshotLedger(storage,rows,state.known)
  if(ref.current===state){if(last&&usable()&&key===clearKey(owner))state.cleared.set(key,Date.now()/1000);state.rows=rows;render(n=>n+1)}
 }
 useEffect(()=>{
  if(!usable()||!focusedOwner||!focusedId||!focusedMatches(focusedOwner.profile,focusedId))return
  const owner={name:focusedOwner.profile,connectionId:focusedOwner.connectionId}
  const keys=new Set(state.rows.filter(x=>matches(x,owner,focusedId)).map(x=>x.key))
  if(!keys.size)return
  state.queue=queueSnapshotStorage(async()=>{
   if(!usable()||!focusedMatches(owner.name,focusedId))return
   const rows=state.rows.map(x=>keys.has(x.key)&&matches(x,owner,focusedId)?{...x,read:true}:x)
   await commitAck(owner,rows)
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
 const visibleUnread=(x,owner,background)=>covered(x,owner)&&visible(x)&&!background.includes(x.session)
 // Snapshot v2 has no terminal timestamp. Keep first observation times only
 // in this scope, rather than dating restored unread entries to this mount.
 const unreadSince=(name,background)=>{
  if(!usable())return null
  const owner={name,connectionId:connection};let since=null
  for(const x of state.rows){const sample=state.observed.get(x.key);if(sample?.generation===activityScope.generation&&x.source===state.baseline.source&&!x.session_source_conflict&&visibleUnread(x,owner,background))since=Math.max(since||0,sample.since)}
  return since
 }
 const ackAll=async(owner,isCurrent=()=>true)=>{if(!usable()||!isCurrent())return;const selected=new Set(state.rows.filter(x=>covered(x,owner)).map(x=>x.key));if(!selected.size)return;state.queue=queueSnapshotStorage(async()=>{if(!usable()||!isCurrent())return;const rows=state.rows.map(x=>selected.has(x.key)&&covered(x,owner)?{...x,read:true}:x);await commitAck(owner,rows)}).catch(()=>{if(ref.current===state){state.failed=true;render(n=>n+1)}});await state.queue}
 // Source classification comes from the scoped completion ledger, not the
 // bounded recent list. Unknown/conflicting evidence stays visible.
 return {activityFor,childMetadataFor,ackAll,unreadSince,clearedAt:name=>usable()&&state.baseline.profiles.has(name)?state.cleared.get(clearKey({name})):null,coverageReady:usable(),covers:name=>state.baseline?.profiles.has(name)===true,error:typeof rest!=='function'?tr('completion.unavailable'):state.failed?tr('completion.saveFailed'):q.isError?tr('completion.unavailable'):state.gap?tr('completion.rebuilt'):q.data?.profiles?.some(p=>p.status!=='ok'||p.truncated)?tr('completion.partial'):null,retry:()=>retry(n=>n+1),has:(name,background=[])=>usable()&&state.rows.some(x=>visibleUnread(x,{name,connectionId:connection},background)),watermark:(owner,id,forAck=false)=>usable()?state.rows.filter(x=>matches(x,owner,id)&&(forAck||visible(x))).map(x=>x.key):[],ack:async(owner,id,keys,isCurrent=()=>true)=>{if(!usable()||!keys.length||!isCurrent())return;const selected=new Set(keys);state.queue=queueSnapshotStorage(async()=>{if(!usable()||!isCurrent())return;const rows=state.rows.map(x=>matches(x,owner,id)&&selected.has(x.key)&&covered(x,owner)?{...x,read:true}:x);await commitAck(owner,rows)}).catch(()=>{if(ref.current===state){state.failed=true;render(n=>n+1)}});await state.queue}}
}
const activityLabel=(n,t=tr)=>t('activity.observed',n)
// Activity inputs are tri-state: unknown does not invent a child or a count.
// Developer spacing leaves room for the outlined minutes and the next hand.
export const profileRailGap=developerMode=>developerMode?18:10
export function AvatarLayers({avatar,name,color,avatarRef,unread,waiting=false,offline=false,childRunning=null,childCount=null,childMetadata=null,runningCount=null,idleMinutes=null,attentionMinutes=null,developerMode=false,triggerProps={}}){
 const tr=useTranslator()
 const box=useRef(null),[width,setWidth]=useState(0)
 useEffect(()=>{const el=box.current;if(!el)return;const update=()=>setWidth(el.clientWidth);update();const ro=typeof ResizeObserver==='function'?new ResizeObserver(update):null;ro?.observe(el);return()=>ro?.disconnect()},[])
 const count=(Number.isSafeInteger(runningCount)&&runningCount>1?runningCount-1:0)+(Number.isSafeInteger(childCount)&&childCount>=0?childCount:childRunning===true?1:0)
 const available=Math.max(0,width-8),natural=34+6*count,visible=Math.min(count,Math.max(0,Math.ceil((available-6)/6)))
 const extraRunning=Number.isSafeInteger(runningCount)&&runningCount>1?runningCount-1:0
 const seenChildren=new Set(),children=childMetadata?.children?.filter(x=>{if(!['queued','recent'].includes(x.kind)||seenChildren.has(x.id))return false;seenChildren.add(x.id);return true})||[]
 const shadowColor=i=>i<extraRunning?statusColor.working:children[i-extraRunning]?.leased?statusColor.working:children[i-extraRunning]?.kind==='queued'?statusColor.waiting:statusColor.unknown
 const face=(ref,index=0)=>{const shadow=index>0,props={ref,'data-avatar':shadow?undefined:true,'data-child-shadow':shadow||undefined,className:'profile-rail-avatar',style:{...s.avatar,boxSizing:'border-box',border:0,outline:shadow||offline?'none':'2px solid '+color,position:'absolute',left:0,top:0,zIndex:shadow?-index:1,filter:offline?'grayscale(1)':undefined,pointerEvents:avatar?'none':undefined},...(avatar?{src:avatar,alt:''}:{children:name.slice(0,1).toUpperCase()})};return jsx(avatar?'img':'span',props,index)}
 const minutes=attentionMinutes??idleMinutes,label=minutes===null?null:Math.floor(minutes/60)+'h'+minutes%60+'m'
 return jsx('span',{ref:box,style:{display:'block',width:'100%',height:37},children:jsxs('span',{'data-avatar-stack':true,style:{position:'relative',display:'block',margin:'0 auto',left:developerMode&&waiting&&width?Math.min(0,(width+Math.min(natural,available))/2-44):undefined,width:Math.min(natural,available),height:37},children:[jsx('span',{style:{position:'absolute',inset:0,overflow:'hidden',zIndex:0},children:Array.from({length:visible},(_,i)=>jsxs('span',{style:{position:'absolute',left:(i+1)*6,top:1.5,width:34,height:34,zIndex:-(i+1),opacity:Math.max(0,1-(i+1)/7),pointerEvents:'none'},children:[face(null,i+1),jsx('span',{'data-child-outline':true,'aria-hidden':true,style:{position:'absolute',left:0,top:0,width:34,height:34,borderRadius:'22%',boxShadow:'inset 0 0 0 1px '+shadowColor(i),zIndex:-(i+1),pointerEvents:'none'}})]},i))}),jsx(PopoverTrigger,{asChild:true,children:jsx('button',{...triggerProps,ref:avatarRef,type:'button',className:'profile-rail-hit',style:{...s.hit,position:'absolute',left:0,top:1.5,width:34,height:34,zIndex:1},children:face(null)})}),offline?jsx('span',{'data-avatar-outline':true,'aria-hidden':true,style:{position:'absolute',left:0,top:1.5,width:34,height:34,borderRadius:'22%',outline:'2px solid '+color,zIndex:2,pointerEvents:'none'}}):null,waiting||unread?jsx('span',{'data-completion-badge':unread&&!waiting||undefined,'data-avatar-waiting':waiting||undefined,'aria-hidden':true,style:{position:'absolute',left:26,top:-5,zIndex:3,pointerEvents:'none',...(waiting?{fontSize:14,lineHeight:1}:{...unreadCircle,left:28,top:-3})},children:waiting?'✋':undefined}):null,label!==null?jsx('span',{[attentionMinutes===null?'data-idle-minutes':'data-elapsed-minutes']:true,'aria-hidden':true,style:{position:'absolute',left:17,top:38,transform:'translateX(-50%)',zIndex:4,color:'#fff',fontSize:label.length>=10?5.5:label.length>=9?6:label.length>=8?7:label.length>=6?8:10,fontWeight:700,lineHeight:1,whiteSpace:'nowrap',textShadow:'-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',pointerEvents:'none'},children:label}):null,Number.isSafeInteger(runningCount)&&runningCount>=2?jsx('span',{'data-running-count':true,title:activityLabel(runningCount,tr),'aria-hidden':true,style:{position:'absolute',left:26,bottom:0,zIndex:3,borderRadius:'50%',minWidth:17,height:17,lineHeight:'17px',textAlign:'center',fontSize:9,color:'var(--ui-text-primary)',background:'var(--ui-bg-elevated)',border:'1px solid var(--ui-stroke-secondary)',pointerEvents:'none'},children:'x'+runningCount}):null]})})
}
// Fixed legacy set: future supported adapters must remain visible after migration.
const legacyMessagingSources=['telegram','discord','whatsapp','whatsapp_cloud','slack','signal','mattermost','matrix','email','sms','dingtalk','feishu','wecom','wecom_callback','weixin','bluebubbles','qqbot','yuanbao','line','google_chat','teams','irc','simplex']
const defaultPreferences={hideOffline:false,showCron:false,developerMode:false,hiddenMessagingSources:[],hiddenProfiles:[],recentSessionCount:defaultRecentSessionCount}
const profileVisible=(p,settings)=>!settings.hiddenProfiles.includes(p.name)&&(!settings.hideOffline||p.status!=='offline')
function createPreferences(storage){
 let value=defaultPreferences,ready=false,error='',pending=false,version=0
 let observedSources=[],snapshot={...value,observedSources,ready,error,pending};const listeners=new Set()
 const emit=()=>{snapshot={...value,observedSources,ready,error,pending};for(const fn of listeners)fn()}
 const valid=x=>x&&typeof x.hideOffline==='boolean'&&typeof x.showCron==='boolean'&&(x.developerMode===undefined||typeof x.developerMode==='boolean')&&(x.hideMessaging===undefined||typeof x.hideMessaging==='boolean')&&(x.hiddenMessagingSources===undefined||Array.isArray(x.hiddenMessagingSources)&&x.hiddenMessagingSources.every(v=>typeof v==='string'&&v.length>0&&v.length<=256))&&Array.isArray(x.hiddenProfiles)&&x.hiddenProfiles.every(v=>typeof v==='string'&&v.length>0)
 Promise.resolve().then(async()=>{if(!storage?.get||!storage?.set)throw Error();const saved=await storage.get('display-settings-v1');if(saved!==undefined&&saved!==null){if(!valid(saved))throw Error();value={hideOffline:saved.hideOffline,showCron:saved.showCron,developerMode:saved.developerMode??false,hiddenMessagingSources:[...new Set(saved.hiddenMessagingSources??(saved.hideMessaging?legacyMessagingSources:[]))],hiddenProfiles:[...new Set(saved.hiddenProfiles)],recentSessionCount:normalizeRecentSessionCount(saved.recentSessionCount)}}ready=true;emit()}).catch(()=>{error={translationKey:'settings.readFailed'};emit()})
 return {get:()=>snapshot,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},observe:sources=>{if(JSON.stringify(observedSources)!==JSON.stringify(sources)){observedSources=sources;emit()}},save:async next=>{if(!ready||pending||!valid(next)||!Array.isArray(next.hiddenMessagingSources)||!recentSessionCounts.includes(next.recentSessionCount))return;pending=true;error='';emit();const n=++version;try{await storage.set('display-settings-v1',next);const saved=await storage.get('display-settings-v1');if(JSON.stringify(saved)!==JSON.stringify(next))throw Error();if(n===version)value=next}catch{error={translationKey:'settings.saveFailed'}}finally{pending=false;emit()}}}
}
function Settings({preferences}){
 const tr=useTranslator()
 const settings=useSyncExternalStore(preferences.subscribe,preferences.get,preferences.get)
 const connectionId=useValue(host.state.connectionId),profile=useValue(host.state.profile)
 const q=useQuery({queryKey:['sessioncrew','settings-roster',connectionId,profile],enabled:!!profile,retry:false,queryFn:async()=>{const r=await bounded(()=>host.profiles.list({connectionId,profile}),'settings.profileList');if(!Array.isArray(r?.profiles)||host.state.connectionId.get()!==connectionId||host.state.profile.get()!==profile)throw new LocalizedError('settings.profileUnavailable');return r.profiles.filter(p=>typeof p.name==='string'&&p.name)}})
 const save=patch=>preferences.save({hideOffline:settings.hideOffline,showCron:settings.showCron,developerMode:settings.developerMode,hiddenMessagingSources:settings.hiddenMessagingSources,hiddenProfiles:settings.hiddenProfiles,recentSessionCount:normalizeRecentSessionCount(settings.recentSessionCount),...patch})
 const disabled=!settings.ready||settings.pending
 const description={fontSize:12,lineHeight:1.5,color:'var(--ui-text-secondary)',margin:'3px 0 0'}
 const toggle=(label,detail,checked,onChange)=>jsxs('div',{style:{display:'flex',gap:16,alignItems:'center',justifyContent:'space-between',padding:'12px 0'},children:[jsxs('div',{style:{minWidth:0},children:[jsx('div',{style:{fontSize:13,fontWeight:600,color:'var(--ui-text-primary)'},children:label}),jsx('p',{style:description,children:detail})]}),jsx('button',{type:'button',role:checked==='mixed'?'checkbox':'switch','aria-label':label,'aria-checked':checked,disabled,onClick:()=>onChange(checked==='mixed'||!checked),style:{position:'relative',flex:'0 0 auto',width:32,height:18,padding:0,border:0,borderRadius:9,cursor:disabled?'default':'pointer',background:checked?'var(--ui-accent)':'var(--ui-stroke-secondary)',opacity:disabled?0.55:1},children:jsx('span',{'aria-hidden':true,style:{position:'absolute',top:2,left:checked==='mixed'?9:checked?16:2,width:14,height:14,borderRadius:'50%',background:'var(--ui-bg-elevated)'}})})]})
 const observed=messagingPlatforms.filter(([,sources])=>sources.some(s=>settings.observedSources.includes(s)))
 const other=messagingPlatforms.filter(p=>!observed.includes(p))
 const platform=([name,sources])=>{const count=sources.filter(s=>!settings.hiddenMessagingSources.includes(s)).length,visible=count===sources.length?true:count===0?false:'mixed';return jsx('div',{children:toggle(name,visible==='mixed'?tr('settings.partiallyShown'):null,visible,v=>save({hiddenMessagingSources:v?settings.hiddenMessagingSources.filter(s=>!sources.includes(s)):[...new Set([...settings.hiddenMessagingSources,...sources])]}))},name)}
 const bulkStyle={minHeight:30,padding:'5px 10px',border:'1px solid var(--ui-stroke-secondary)',borderRadius:5,background:'var(--ui-bg-elevated)',color:'var(--ui-text-primary)',cursor:disabled?'default':'pointer'}
 const recentCountLabel=tr('settings.recentSessionCount'),recentCount=normalizeRecentSessionCount(settings.recentSessionCount)
 const recentCountControl=jsxs('div',{style:{display:'flex',flexWrap:'wrap',gap:10,alignItems:'center',justifyContent:'space-between',padding:'12px 0'},children:[
  jsx('div',{style:{fontSize:13,fontWeight:600,color:'var(--ui-text-primary)'},children:recentCountLabel}),
  jsx('div',{role:'group','aria-label':recentCountLabel,style:{display:'flex',flexWrap:'wrap',gap:8},children:recentSessionCounts.map(count=>{
   const pressed=count===recentCount
   return jsx('button',{type:'button',disabled,'aria-pressed':pressed,'aria-disabled':pressed||undefined,onClick:()=>{if(!pressed)save({recentSessionCount:count})},style:{...bulkStyle,...(pressed?{border:'1px solid var(--ui-accent)',background:'var(--ui-control-active-background)',fontWeight:600}:null)},children:count},count)
  })})
 ]})
 return jsxs('div',{style:{padding:20,width:'100%',boxSizing:'border-box'},children:[jsx('h2',{children:'SessionCrew'}),toggle(tr('settings.hideOffline'),tr('settings.offlineHelp'),settings.hideOffline,v=>save({hideOffline:v})),toggle(tr('settings.showCron'),tr('settings.cronHelp'),settings.showCron,v=>save({showCron:v})),toggle(tr('settings.developerMode'),tr('settings.developerHelp'),settings.developerMode,v=>save({developerMode:v})),recentCountControl,jsxs('div',{style:{padding:'12px 0'},children:[jsxs('div',{style:{display:'flex',flexWrap:'wrap',alignItems:'center',gap:10},children:[jsxs('div',{style:{flex:'1 1 340px',minWidth:0},children:[jsx('div',{style:{fontSize:13,fontWeight:600,color:'var(--ui-text-primary)'},children:tr('settings.platforms')}),jsx('p',{style:description,children:tr('settings.messagingHelp')})]}),jsxs('div',{style:{display:'flex',flexWrap:'wrap',gap:8,marginLeft:'auto'},children:[jsx('button',{type:'button',disabled,style:bulkStyle,onClick:()=>save({hiddenMessagingSources:settings.hiddenMessagingSources.filter(s=>!messagingSources.has(s))}),children:tr('settings.showAllPlatforms')}),jsx('button',{type:'button',disabled,style:bulkStyle,onClick:()=>save({hiddenMessagingSources:[...new Set([...settings.hiddenMessagingSources,...messagingSources])]}),children:tr('settings.hideAllPlatforms')})]})]}),observed.map(platform),jsxs('details',{children:[jsx('summary',{style:{cursor:'pointer',padding:'10px 0',color:'var(--ui-text-primary)',fontSize:13},children:tr('settings.otherPlatforms')}),...other.map(platform)]})]}),jsxs('section',{style:{padding:'12px 0'},children:[jsx('div',{style:{fontSize:13,fontWeight:600,color:'var(--ui-text-primary)'},children:tr('settings.visibleProfiles')}),jsx('p',{style:description,children:tr('settings.storageHelp')}),q.isPending?jsx('p',{children:tr('settings.loadingProfiles')}):q.isError?jsx('p',{role:'alert',children:tr('settings.profileLoadFailed')}):jsx('div',{style:{display:'flex',flexWrap:'wrap',gap:8,marginTop:10},children:(q.data||[]).map(p=>{const visible=!settings.hiddenProfiles.includes(p.name);return jsx('button',{type:'button','aria-pressed':visible,disabled,onClick:()=>save({hiddenProfiles:visible?[...settings.hiddenProfiles,p.name]:settings.hiddenProfiles.filter(x=>x!==p.name)}),style:{minHeight:30,maxWidth:'100%',overflowWrap:'anywhere',padding:'5px 10px',border:'1px solid '+(visible?'var(--ui-accent)':'var(--ui-stroke-secondary)'),borderRadius:5,background:visible?'var(--ui-accent)':'var(--ui-bg-elevated)',color:visible?'var(--dt-midground-foreground, var(--ui-bg-editor))':'var(--ui-text-primary)',fontSize:12,cursor:disabled?'default':'pointer',opacity:disabled?0.55:1},children:p.name},p.name)})})]}),settings.error?jsx('p',{role:'alert',children:settings.error.translationKey?tr(settings.error.translationKey):localizeError(settings.error)}):null]})
}
function useRecentPrewarm({connection,profile,activation,owners,ready,rest,selectedRef}){
 const latest=useRef(null),inFlight=useRef(false),wake=useRef(null)
 React.useLayoutEffect(()=>{
  const client=sdk.queryClient,cache=client?.getQueryCache?.()
  if(!profile||!rest||!client?.prefetchQuery||!client.getQueryState||!client.isFetching||!cache?.subscribe||typeof document==='undefined')return
  const scope=[connection,profile,activation],prefix=['sessioncrew','recent',...scope]
  const attempted=new Set()
  let queue=null,timer=null,stopped=false
  const atoms=[host.state.connectionId,host.state.profile]
  const sameScope=()=>!stopped&&atoms[0].get()===connection&&atoms[1].get()===profile&&(activation===null||typeof sdk.gatewayActivationEpoch!=='function'||sdk.gatewayActivationEpoch()===activation)
  const canRun=()=>sameScope()&&latest.current?.ready&&document.visibilityState==='visible'&&navigator.onLine!==false&&!selectedRef.current&&!inFlight.current&&!client.isFetching({queryKey:prefix})
  const clear=()=>{clearTimeout(timer);timer=null}
  async function next(){
   timer=null
   if(!canRun())return
   while(queue.length){
    const name=queue.shift(),owner=latest.current.owners.get(name)
    if(!owner||attempted.has(name))continue
    const queryKey=recentQueryKey(scope,owner),state=client.getQueryState(queryKey)
    if(state&&(state.fetchStatus!=='idle'||state.dataUpdateCount||state.errorUpdateCount))continue
    attempted.add(name);inFlight.current=true
    try{
     // Do not leave an offline prefetch paused inside QueryClient to auto-start later.
     await client.prefetchQuery({queryKey,queryFn:()=>recentData(owner,'background',rest),staleTime:recentStaleTime,retry:false,networkMode:'always'})
    }finally{inFlight.current=false;wake.current?.()}
    return
   }
  }
  const pump=()=>{
   // Snapshot order once. The live owner map is only for dispatch-time validation.
   if(queue===null&&sameScope()&&latest.current?.ready)queue=[...latest.current.owners.keys()]
   if(!queue?.length||!canRun()){clear();return}
   // Yield to browser and query callbacks; recheck guards on the next turn.
   if(timer===null)timer=setTimeout(()=>void next(),0)
  }
  wake.current=pump
  const unsubscribe=cache.subscribe(event=>{
   const key=event.query?.queryKey
   if(event.type!=='updated'||!key||!prefix.every((part,i)=>key[i]===part))return
   if(event.action?.type==='fetch')attempted.add(key[6])
   pump()
  })
  const unwatch=atoms.map(atom=>atom.subscribe?.(()=>{if(!sameScope()){stopped=true;clear()}}))
  document.addEventListener('visibilitychange',pump)
  window.addEventListener('online',pump);window.addEventListener('offline',pump)
  return()=>{
   stopped=true;clear();wake.current=null;unsubscribe();unwatch.forEach(off=>off?.())
   document.removeEventListener('visibilitychange',pump)
   window.removeEventListener('online',pump);window.removeEventListener('offline',pump)
  }
 },[connection,profile,activation,rest,selectedRef])
 React.useLayoutEffect(()=>{latest.current={owners,ready};wake.current?.()})
}
function Rail({storage,rest,preferences}){
 const tr=useTranslator()
 const connectionId=useValue(host.state.connectionId),profile=useValue(host.state.profile)
 const settings=useSyncExternalStore(preferences.subscribe,preferences.get,preferences.get)
 const completion=useCompletion(storage,rest,connectionId,profile,settings.showCron,settings.hiddenMessagingSources,preferences)
 const activityScopeNow=useActivityScope(),[office,clock,idleStarts,idleFences,estimateFences,oneshotFences]=useRailSnapshot(rest,connectionId,profile,activityScopeNow)
 const [activityMap,setActivityMap]=useState({})
 const onActivity=useCallback((name,key,activity,since,conflict=false)=>{
  if(activity&&(activity.working||activity.background.length||activity.waiting)){
   fenceAt(idleFences,name,activity.observedAt)
   if(idleStarts.get(name)?.sampledAt<=activity.observedAt)idleStarts.delete(name)
   fenceAt(estimateFences,name,activity.observedAt)
  }
  setActivityMap(previous=>{
  const old=previous[key]
  if(!activity&&!conflict&&!old||old?.activity===activity&&old?.since===since&&old?.conflict===conflict)return previous
  const next={...previous}
  if(activity===undefined)delete next[key]
  else next[key]={activity,since,conflict}
  return next
  })
 },[idleStarts,idleFences,estimateFences])
 const [selected,setSelected]=useState(null),[projectOwner,setProjectOwner]=useState(null),[routeGeneration,setRouteGeneration]=useState(0),selectedRef=useRef(null),selectionEpoch=useRef(0),pending=useRef(new Map()),createdProjects=useRef(new Map()),unknownProjects=useRef(new Set()),dialogActive=useRef(false)
 const launchEpoch=useRef(null),[,refreshLaunch]=useState(0)
 const select=useCallback((key,mode='panel')=>{
  if(key===(selectedRef.current?.key??null)&&(!key||mode===selectedRef.current.mode))return
  selectionEpoch.current++;setProjectOwner(null)
  const value=key===null?null:{key,mode};selectedRef.current=value;setSelected(value)
 },[])
 useEffect(()=>{select(null)},[connectionId,profile,select])
 useEffect(()=>{
  // Observe transitions even if React batches a switch away and back.
  const atoms=[host.state.connectionId,host.state.profile]
  let scope=atoms.map(atom=>atom.get())
  const check=()=>{const next=atoms.map(atom=>atom.get());if(next.some((value,i)=>value!==scope[i])){scope=next;select(null)}}
  const dispose=atoms.map(atom=>atom.subscribe?.(check))
  return()=>{dispose.forEach(fn=>fn?.());selectionEpoch.current++}
 },[select])
 const activation=activityScopeNow.epoch
 const routes=useQuery({queryKey:['sessioncrew','routes',connectionId,profile,routeGeneration,activation],queryFn:()=>typeof host.profileRoutes==='function'?bounded(()=>host.profileRoutes(),'common.routeLookup'):Promise.resolve(null),enabled:!!profile,retry:false})
 const liveRoutes=useRef(null)
 React.useLayoutEffect(()=>{liveRoutes.current=routes.isSuccess?{connectionId,profile,data:routes.data}:null},[connectionId,profile,routes.isSuccess,routes.data])
 const q=useQuery({queryKey:['sessioncrew','roster',connectionId,profile],queryFn:async()=>{
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
 const byName=new Map(office.map(row=>[row.profile,row]))
 const profiles=(q.data??[]).filter(p=>typeof p.name==='string').map((p,index)=>{
  const attentionKey=JSON.stringify([connectionId,profile,activityScopeNow.generation,activityScopeNow.epoch,p.name,routes.data]);const row=byName.get(p.name),base=railStatus(row)
  const evidence=activityMap[attentionKey],activity=evidence?.activity,waiting=activity?.waiting===true,background=activity?.background||[],working=activity?.working===true
  const idleAllowed=base==='idle'||base==='online_unobserved'&&(row.status_observation==='fresh_shared_gateway_no_observed_owner_work'||recentWork(row))
  const proof=row?.oneshotProof,now=Date.now()
  // An arbitrary idle RPC row is not owner idle. Only the existing confirmed
  // owner observation can veto overlapping/newer evidence; keep waiting and
  // explicit /status idle ahead of this fallback, not ahead of normal RPC work.
  const observedIdleAt=(evidence?.since||0)*1000
  const idleConflict=idleAllowed&&observedIdleAt>=proof?.sampledAt
  const leaseWorking=row?.online===true&&base!=='working'&&base!=='waiting'&&base!=='idle'&&row.waiting!==true&&!waiting&&!idleConflict&&proof?.sampledAt<=now&&now<proof.validUntil&&(!activityScopeNow.gateway||activityScopeNow.gateway==='open')
  let status=base;if(base!=='offline'&&(working||background.length&&base!=='waiting'||leaseWorking))status='working'
  const canShowIdle=idleAllowed&&!waiting&&!ownBusyStatus(row,base)&&['idle','online_unobserved'].includes(status)
  // Last activity is an elapsed-time origin, not the time idle was observed.
  // Only a new observation can supersede a prior execution sample.
  const invalidAt=idleFences.get(p.name)
  const backendSince=canShowIdle&&(!invalidAt||row?.idleSampledAt>invalidAt)?row?.presentationIdleSince:null
  const observedSince=canShowIdle&&observedIdleAt>=(oneshotFences.get(p.name)||0)?evidence?.since:null,confirmedSince=Math.max(backendSince||0,observedSince||0)||null
  // Estimates only fill a gap; they cannot replace stronger evidence or
  // reuse an activity origin at or before observed work/waiting in this scope.
  const estimated=canShowIdle&&base==='online_unobserved'&&!confirmedSince&&!evidence?.conflict&&!activity?.unmatchedBackground&&(!activityScopeNow.gateway||activityScopeNow.gateway==='open')?lastActivityEstimate(row,Date.now()):null
  const estimateSince=estimated*1000>(estimateFences.get(p.name)||0)?estimated:null
  const idleSince=confirmedSince??estimateSince
  const idleKind=observedSince&&confirmedSince===observedSince?'observedIdle':backendSince&&row?.historicalIdle?'historicalIdle':estimateSince?'lastActivityElapsed':null
  const completionSince=settings.developerMode&&canShowIdle&&!idleSince&&!evidence?.conflict&&!activity?.unmatchedBackground&&(!activityScopeNow.gateway||activityScopeNow.gateway==='open')?completion.unreadSince(p.name,background):null
  const unreadSince=validIdleStart(completionSince,now)&&completionSince*1000>(estimateFences.get(p.name)||0)?completionSince:null
  return {...p,index,attentionKey,status,waiting,unread:completion.has(p.name,background),idleAllowed,idleSince,idleKind,unreadSince}
 }).filter(p=>profileVisible(p,settings)).sort((a,b)=>{
  const order=p=>{
   if(p.status==='online_unobserved'&&(p.waiting||p.unread||p.idleSince)||p.status==='unknown'&&p.waiting)return statusOrder.idle
   return statusOrder[p.status]
  }
  const aRank=order(a),rank=aRank-order(b);if(rank)return rank
  const attention=p=>p.waiting?0:p.unread?1:2,attentionRank=attention(a)-attention(b);if(attentionRank)return attentionRank
  if(aRank===statusOrder.idle){const when=p=>Math.max(p.idleSince||0,completion.clearedAt(p.name)||0),x=when(a),y=when(b);if(x!==y)return y-x}
  return a.index-b.index
 })
 const routeStatus=routes.isPending?(routes.fetchStatus==='idle'?tr('common.connectionNotReady'):'loading'):routes.isError?tr('errors.routeLoadFailure',localizeError(errorMessage(routes.error,tr)||tr('errors.unknown'))):''
 const destinations=new Map(profiles.map(p=>{
  if(routeStatus)return [p.name,{owner:null,phase:routeStatus}]
  try{return [p.name,{owner:{connectionId,name:p.name,route:routeFor(p.name,connectionId,profile,routes.data)},phase:''}]}
  catch(e){return [p.name,{owner:null,phase:errorMessage(e,tr)}]}
 }))
 const warmOwners=new Map()
 for(const [name,{owner}] of destinations){
  if(!owner)continue
  const supported=typeof owner.route==='string'?name===profile&&typeof host.request==='function':typeof host.requestProfile==='function'
  if(supported)warmOwners.set(name,owner)
 }
 useRecentPrewarm({connection:connectionId,profile,activation,owners:warmOwners,ready:settings.ready&&q.isSuccess&&q.fetchStatus==='idle'&&routes.isSuccess&&routes.fetchStatus==='idle',rest,selectedRef})
 if(q.isPending) return jsx('p',{children:q.fetchStatus==='idle'?tr('common.connectionNotReady'):tr('settings.loadingProfiles')})
 if(q.isError) return jsxs('div',{children:[jsx('p',{children:tr('settings.profilesUnknown')}),jsx('button',{onClick:()=>q.refetch(),children:tr('common.retry')})]})
 if(!q.data?.length) return jsx('p',{children:tr('settings.noProfiles')})
 const completionError=completion.error||(completion.coverageReady&&profiles.some(p=>!completion.covers(p.name))?tr('completion.profilePartial'):null)
 return jsxs('div',{style:{height:'100%',minHeight:0,display:'flex',flexDirection:'column'},children:[jsxs('div',{'data-profile-rail':true,'aria-label':'SessionCrew',style:{...s.rail,gap:profileRailGap(settings.developerMode),height:'auto',flex:'1 1 auto',minHeight:0,width:'100%',position:'relative',alignItems:'flex-start',overflowX:'hidden',scrollbarWidth:'none'},children:[jsx('style',{children:'[data-profile-rail]::-webkit-scrollbar{display:none}'}),...profiles.map(p=>{
  const name=displayName(p),activity=completion.activityFor(p.name),metadata=completion.childMetadataFor(p.name),metadataLabel=metadata?.presentation_count?tr('activity.childDisclaimer'):'',epoch=selectionEpoch.current,selectionKey=JSON.stringify([connectionId,profile,p.name]),active=selected?.key===selectionKey,compact=active&&selected.mode==='menu'
  const isCurrent=()=>selectedRef.current?.key===selectionKey&&selectionEpoch.current===epoch&&host.state.connectionId.get()===connectionId&&host.state.profile.get()===profile
  const getLiveOwner=destination=>{
   const live=liveRoutes.current
   if(!isCurrent()||!live||live.connectionId!==connectionId||live.profile!==profile)return null
   try{const owner={connectionId,name:p.name,route:routeFor(p.name,connectionId,profile,live.data)};return launchDestination(owner)===destination?owner:null}catch{return null}
  }
  const isLaunching=()=>isCurrent()&&launchEpoch.current===epoch
  const beginLaunch=()=>{
   launchEpoch.current=epoch
   refreshLaunch(n=>n+1)
   return()=>{if(launchEpoch.current===epoch)launchEpoch.current=null;refreshLaunch(n=>n+1)}
  }
  const {owner,phase}=destinations.get(p.name)
  const openMenu=e=>{e.preventDefault();if(!dialogActive.current)select(selectionKey,'menu')}
  const avatarActions={onContextMenu:openMenu,onKeyDown:e=>{if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10')openMenu(e)},onClick:e=>{if(compact){e.preventDefault();select(selectionKey)}}}
  const preserveFocus=e=>{const next=selectedRef.current;if(next&&(next.key!==selectionKey||selectionEpoch.current!==epoch))e.preventDefault()}
  return jsx(RailItem,{working:p.status==='working',selected:active,clock,identity:JSON.stringify([connectionId,p.name]),children:jsx(GuardedPopover,{active,compact,isLaunching,onOpenChange:open=>{if(!open&&dialogActive.current)return;if(open)select(selectionKey);else if(isCurrent())select(null)},children:(avatarRef,contentRef,onCloseAutoFocus,parentContentRef)=>[
   jsx(ProfileAvatar,{owner,ownerName:p.name,rest,attentionKey:p.attentionKey,idleAllowed:p.idleAllowed,onActivity,avatar:p.avatar,name,color:statusColor[p.status],avatarRef,developerMode:settings.developerMode,offline:p.status==='offline',clock,status:p.status,elapsedHint:p.idleKind,unreadSince:p.unreadSince,idleMinutes:settings.developerMode&&p.idleSince?elapsedMinutes(clock,p.idleSince):null,unread:p.unread,runningCount:activity?.observed_active_count,childMetadata:metadata,childCount:metadata===undefined?activity?.observed_child_count:metadata?.presentation_count,childRunning:metadata!==undefined||activity&&Object.hasOwn(activity,'observed_child_count')?null:activity?.observed_child_active,triggerProps:{...avatarActions,'data-selected':active,'data-low':['idle','online_unobserved','offline','unknown'].includes(p.status),'data-state-name':p.status,'aria-label':tr('status.profileAria',name,tr({working:'status.working',waiting:'status.waiting',idle:'status.idle',online_unobserved:'status.onlineUnobserved',offline:'status.offline',unknown:'status.unknown'}[p.status]),p.unread,activity?activityLabel(activity.observed_active_count,tr):'',metadataLabel),title:[activity?activityLabel(activity.observed_active_count,tr):'',metadataLabel].filter(Boolean).join(' ')||undefined}}),
   compact?jsx(PopoverContent,{ref:contentRef,variant:'menu','aria-label':name,'data-avatar-context':true,onCloseAutoFocus:preserveFocus,side:'right',align:'center',style:{...s.bubble,width:'max-content',minWidth:144,padding:6,gap:3},children:jsx(Recent,{owner,phase,completion,settings,menu:{owner:{name:p.name,connectionId},isCurrent,getLiveOwner,getSettings:preferences.get},onOpened:()=>{if(isCurrent())select(null)}})},'menu'):
   jsxs(PopoverContent,{ref:contentRef,onFocusOutside:e=>{if(isLaunching())e.preventDefault()},onInteractOutside:e=>{if(dialogActive.current)e.preventDefault()},onCloseAutoFocus:e=>{onCloseAutoFocus(e);preserveFocus(e)},side:'right',align:'center',collisionPadding:0,style:{...s.bubble,boxSizing:'border-box',position:'relative',padding:'min(16px, 5vh) 16px',maxHeight:projectOwner===selectionKey?primaryWithProjectsHeight:primaryViewportHeight},children:[jsxs('div',{style:{display:'flex',gap:11,alignItems:'center',minWidth:0,flexShrink:0},children:[p.avatar?jsx('img',{'data-panel-avatar':true,src:p.avatar,alt:'',style:{...s.avatar,flex:'none',borderColor:statusColor[p.status]}}):jsx('span',{'data-panel-avatar':true,style:{...s.avatar,flex:'none',borderColor:statusColor[p.status]},children:name.slice(0,1).toUpperCase()}),jsxs('div',{style:{minWidth:0,flex:'1 1 auto'},children:[jsx('strong',{style:{display:'block',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',minWidth:0,fontSize:14},children:name}),jsx(StatusQuote,{storage,ownerKey:'status:'+JSON.stringify([connectionId,p.name]),status:p.status})]}),jsx('button',{type:'button','aria-label':tr('common.closePanel'),onClick:()=>select(null),style:{...s.button,border:0,fontSize:20,padding:0,alignSelf:'flex-start'},children:'×'})]}),active?jsx(Recent,{owner,phase,completion,settings,retryRoutes:()=>setRouteGeneration(n=>n+1),onOpened:()=>{if(isCurrent())select(null)}},JSON.stringify([connectionId,p.name])):null,active?jsx(Launchers,{parentContentRef,owner,ownerName:name,isCurrent,getLiveOwner,isLaunching,beginLaunch,onDismiss:()=>{if(owner&&getLiveOwner(launchDestination(owner)))select(null)},createdProjects,unknownProjects,dialogActive,projectOpen:projectOwner===selectionKey,setProjectOpen:open=>setProjectOwner(open?selectionKey:null),onOpened:()=>{if(isCurrent())select(null)},pending},'launch:'+JSON.stringify([connectionId,p.name,owner?.route])):null]},'panel')]})},p.name)
 })]}),completionError?jsx(profile&&rest?'button':'span',{'data-completion-error':true,title:completionError,'aria-label':completionError,...(profile&&rest?{onClick:completion.retry}:{}),style:{...s.button,border:0,alignSelf:'flex-end',flexShrink:0,margin:'8px 4px 4px 0',fontSize:12,padding:'1px 3px'},children:'⚠️'}):null]})
}
export default {id:'sessioncrew',name:'SessionCrew',defaultEnabled:true,register(ctx){pluginI18n=typeof ctx.i18n?.register==='function'&&typeof ctx.i18n?.t==='function'?ctx.i18n:null;pluginI18n?.register(messages);const rest=typeof ctx.rest==='function'?(path,opts)=>ctx.rest(path,opts):null;const preferences=createPreferences(ctx.storage);ctx.registerSettingsPage?.({id:'settings',title:'SessionCrew',icon:'account',render:()=>jsx(LocalizedRoot,{children:jsx(Settings,{preferences})})});ctx.register({id:'rail',area:'panes',title:'SessionCrew',data:{placement:'left',dock:{pane:'workspace',pos:'left'},width:'80px',minWidth:'80px'},render:()=>jsx(LocalizedRoot,{children:jsx(DialogRestContext.Provider,{value:rest,children:jsx(Rail,{storage:ctx.storage,rest,preferences})})})})}}
