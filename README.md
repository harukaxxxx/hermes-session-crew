# SessionCrew

SessionCrew 是 Hermes Desktop 插件，以類似 Bots 的 profile 清單管理各 owner 的 Sessions 與專案，並提供有範圍限制的狀態觀察。

Repository：<https://github.com/harukaxxxx/hermes-session-crew>。建議 checkout 目錄名稱為 `hermes-session-crew`，可置於任意工作目錄；本機既有部署可透過舊 `profile-rail` 路徑的相容連結繼續使用。

## 顯示設定（受控測試；尚未 live 驗收）

Desktop **Settings → Plugins → SessionCrew** 可隱藏 offline profiles、逐一選擇可見 profile，以及控制泡泡內 cron sessions。預設所有 profile 可見、offline 可見、cron 可見；新 profile 預設可見。僅確定為 offline 才依離線選項隱藏，狀態 unknown 不隱藏。設定寫入公開 `ctx.storage` 的 `hermes.plugin.profile-rail.display-settings-v1`，在此 client 的 plugin storage 保存，所有連線共用（同名 profile 共用可見性）；不是 gateway profile 設定、不跨裝置同步。寫入讀回成功後立即套用；失敗時顯示錯誤。需要支援公開 `ctx.registerSettingsPage` 的 Desktop 版本，舊版不提供該頁。

Cron 過濾只認 `session.list` 的結構化 `source === 'cron'`；缺少來源的列保留，不從 session 標題或 ID 猜測。這表示來源缺失或 backend 不回傳的 cron 仍可能顯示。使用者已取消額外顯示 `⏰<cron job 名稱>` 的需求，因此不實作此功能；不同版本的實際 feed 與認證路由尚未 live 驗證。

歷史品牌名為 **Profile Rail**。為維持既有安裝和資料相容，插件 ID、namespace、storage keys、API 路徑及 loader 等識別碼仍使用 `profile-rail`，不是顯示品牌。歷史紀錄保留原名原文。

下列 `evidence/`、`history/`、`archive/` 與 `design/integration-notes-historical.md` 歷史材料只留在本機、未隨此次發布，以避免公開私人部署路徑及工作紀錄；其紀錄不代表現版驗收。公開倉庫從插件本身的獨立快照開始，不包含開發者 Hermes profile 的 Git 歷史、設定或憑證。

> 改名前版本曾部署至本機共用來源，當時受控測試 61/61 通過。使用者曾確認「新建專案」與資料夾瀏覽可正常開啟；真實建立與持久化仍未驗證，不代表本次發布版本的全流程 live 通過。原始部署紀錄僅在本機保留。

**已部署檔案、尚未 live 驗收：** 從 gateway 的 `.hermes` 起始，可瀏覽 OS 權限允許的其他絕對路徑並建立資料夾。這不是唯讀，也沒有 root-only 沙箱保證。

持有的目錄 fd 指向選定目錄物件，不保證它在並行 rename 後仍位於原路徑。寫入後會再核對父目錄與子目錄 identity，但檢查並非原子性保證，也不能保證檢查後不再被移動；失敗時操作結果可能未知，禁止盲目重試或移除目錄。僅於合成 fixture 測試，不等於 live 認證、OS 權限、遠端連線或 Docker terminal filesystem 驗收。

## 授權

SessionCrew 自有程式碼依 [MIT License](LICENSE) 授權。第三方程式碼的通知及條款分別見 [`dashboard/OFFICE-LICENSE`](dashboard/OFFICE-LICENSE) 與 [`desktop/HERMES-REMOTE-PICKER-LICENSE`](desktop/HERMES-REMOTE-PICKER-LICENSE)。

## 新建專案：gateway 資料夾瀏覽（受控 candidate）

### 與上游 remote picker 的互動比對（尚未完成，不能視為驗收通過）

基準為 Hermes Agent tracked HEAD [`2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19`](https://github.com/NousResearch/hermes-agent/tree/2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19)，不是工作樹內未提交的 SDK 擴充。以下路徑均相對該 commit，行號為 source 原行號。上游採用的 folder row 有少量 markup/class 改寫，MIT 來源及許可條款見 [`desktop/HERMES-REMOTE-PICKER-LICENSE`](desktop/HERMES-REMOTE-PICKER-LICENSE)。

| 項目 | 原版 source 及實際行為 | candidate 現況 |
| --- | --- | --- |
| 本機／遠端 | `apps/desktop/src/lib/desktop-fs.ts:314-327`：本機呼叫 OS picker；remote 目錄選擇進入 app picker 並強制 `multiple:false`。`store/projects.ts:1680-1685` 雖請求多選，remote 每次仍只回一項 | 僅實作 remote 型態；不能視為本機 OS picker 等價 |
| 單擊資料夾 | `app/right-sidebar/files/remote-picker.tsx:266-267,298-306`：整行單擊即進入，無 checkbox、非雙擊選取 | 整行單擊進入，Chromium fixture 測試；已有受控同目錄原版與 candidate 截圖 |
| 目前目錄、返回、麵包屑 | `remote-picker.tsx:122-133,197-215,274-290`：麵包屑、列表中的 `..`、頁腳路徑與選取目前目錄 | 已實作，可向上至 `/`；有額外分頁按鈕 |
| 新增資料夾與 Escape | `remote-picker.tsx:153-175,184-189,216-250,276-284`：可新增目錄、Enter 建立、Escape 先取消命名 | 使用後端回傳的目錄 identity 啟用建立；Enter、pending、未知結果與 Escape 由 fixture 驗證 |
| 對話框結構／取消 | `remote-picker.tsx:180-195,274-290` 獨立 Dialog、原生標題和頁腳、取消只關 picker | 獨立 Dialog；Chromium fixture 驗證 Escape 依序取消命名、關 picker、關 project，取消 picker 保留名稱、點子和已選目錄 |
| 已選資料夾 | `app/chat/sidebar/project-dialog.tsx:117-145,232-281`：可多次加入去重、第一項 primary badge、移除；初次選取自動為空白名稱命名 | 已實作多次加入去重、主要標記、移除與空白名稱自動命名；視覺尚無上游同狀態比較 |
| 起點／安全邊界 | `store/projects.ts:1680-1685` 初始使用 Desktop 預設 cwd | 從 gateway Hermes data root 起始，OS 權限允許時可至外部；不跟隨 symlink |

本版仍有明確未完成項目；已依使用者授權部署檔案，**不得據此聲稱 live 驗收完成或互動等價**。受控同狀態截圖見 `evidence/original-vs-candidate-folder-700.png`、`original-vs-candidate-folder-400.png`，及同名 original/candidate 分圖；原版取 tracked HEAD source（以 `git show HEAD:apps/desktop/src/app/right-sidebar/files/remote-picker.tsx` 與測試副本 byte compare），僅測試 bundle 以 fixture 取代檔案系統及翻譯，實際 Desktop 元件和編譯 stylesheet；candidate 有 project Dialog 在後層，原版測試則沒有，故背景不同。candidate 可透過後端建立；非 live 驗收。

受控 UI 驗證：設定隔離 `HOME`、`HERMES_HOME` 及 `HERMES_CHECKOUT`、`CHROME_PATH` 後，bundle `tests/sdk-entry.jsx` 並執行 `node tests/browser-folder-ui.mjs`；原版以 `tests/original-folder-entry.jsx` bundle，alias 測試 FS/i18n，再執行 `node tests/browser-original-folder.mjs`；`node tests/folder-comparison.mjs` 組合截圖。`node --experimental-vm-modules tests/project-dialog-create.mjs` 需 `HERMES_AGENT_ROOT` 指向執行 checkout。這些只測 synthetic fixture，不啟動 live backend，不提供 root containment 保證。

Dialog 使用插件自己的 `POST /folders` 經 `ctx.rest` 在目前 gateway 後端列出**資料夾名稱**；不讀檔案內容，不執行 shell，不使用 Desktop 本機 picker 或 core `/api/fs`。從該 gateway 的全域 Hermes data root 起始，包含自訂 `HERMES_HOME`；可瀏覽並選取 OS 權限允許的其他絕對路徑，直到 `/`。可進入子目錄、以麵包屑或上一層返回、分頁、選目前資料夾、加入多個與移除；第一個是主要資料夾。隱藏資料夾可見，symbolic link 一律不進入；設定的 root 及其任何祖先若含 symbolic link（包括系統提供的路徑別名）也會被拒絕，需改用沒有 symbolic link 的實際路徑。這會對有插件存取權者揭露 gateway 程序可存取的資料夾名稱，且允許在可寫目錄建立資料夾；既有 plugin/profile consent 和 runtime inventory 限制仍適用，不等同 Desktop `ctx.files` 的授權保護。資料夾可能在選取後被外部程序移動或刪除。

REST 的目的地由宿主當前 connection/profile 決定，並非 owner 指定：Dialog 凍結 owner route 和目前 scope，僅在 active connection、owner route connection、公開 activation epoch 一致時啟用，變更時清除選擇並拒絕送出；無法確認時停用。不跨連線推定同機，不傳無效 selector 或切換 profile。尚未驗證真實部署中的 route/epoch 與 REST scope 全生命週期，特別是 secondary gateway 切換；不得據 fixture 宣稱其安全或可用。這個 candidate 目前只接受 POSIX 形式的根路徑；Windows 尚未驗證。失敗不回退本機或手動路徑。

建立使用捕捉的完整 owner route、`use:false`；已知 ID 後刷新失敗只能重試刷新。未知寫入結果的防護只在記憶體，重載或卸載會消失。點子可生成，但**不會寫入 IDEA.md**；使用該操作時，專案名稱會送至所選 profile 的 LLM，外部網路與資料處理遵循該 profile 的模型供應商設定。受控測試不建立真專案、session，不呼叫 LLM。插件不自行讀取憑證、不另啟 listener、不執行 shell、不自我更新，也沒有遙測。

在隔離 candidate 根目錄、已有 Hermes checkout／依賴和 Chrome 時執行（不安裝或啟動 gateway）：

```sh
HERMES_CHECKOUT=/absolute/path/to/hermes-agent \
CHROME_PATH='/absolute/path/to/Chrome' \
RAIL_TEST_SCRATCH=/absolute/path/to/existing/scratch \
node tests/run-controlled.mjs
```

runner 會在 scratch 複製來源並寫入 `results.json`、source/backend digest 與受控截圖；包含 fixture FastAPI TestClient、實際 checkout `pluginRest` 至模擬 bridge、真 React 與 SDK UI 元件的 Chromium 測試。它不是認證、網路、原生 renderer 或實際 backend live 驗收；模擬拒絕並不證明 OS 權限測試已完成。此前 56/56 為舊版本歷史結果，不代表本次修改。

Desktop 插件權威入口是 [`desktop/plugin.js`](desktop/plugin.js)，ID `profile-rail`。顯示 roster 的 Bots 結構化 title／核心顯示名稱及頭像 fallback；不讀 client-local alias。選取頭像後，顯示該 owner 的工作階段和對應專案：初始 3 筆，⋯ 每次揭露已取得的 10 筆，內層最多五列捲動。Canonical 分別取得 live 與 stored（各最多 200 筆），live 排前、stored 保留服務端順序並去重；兩個 feed 未提供可比較的活動時間，因此不能保證跨 feed 的全域最近活動排序。舊版只使用其不帶 scope 的列表。開啟泡泡時重查，泡泡開啟且視窗在前景期間每 15 秒更新，視窗重新取得焦點時亦會更新過期資料。這不是伺服器分頁，後端的權限及過濾規則亦可能排除部分工作階段。Session 和 `projects.tree` 分開查詢：專案尚在載入或失敗時，session 仍可顯示；失敗可手動重試。工作階段、路由和專案讀取均有 30 秒期限，失敗不自動重試；僅對精確的舊版 `scope` 不支援錯誤重試一次不帶 scope 的唯讀查詢。

合併去重後最多顯示 200 筆；live 排前可能擠掉部分 stored 結果。任一 canonical feed 失敗會顯示錯誤而非假裝完整。

路由從公開 `host.profileRoutes()` 的完整 descriptor 選取，匹配目前連線及所選 profile；找不到、重複或跨來源時顯示明確錯誤，不自行拼造 descriptor。舊版無 route inventory、且目前連線 ID 為 null 時使用 SDK 的 local/legacy 字串 overload，由 SDK 的來源安全檢查決定能否讀取。舊版也沒有 `requestProfile` 時只允許目前 owner 使用 `host.request`。連線未準備好或路由查詢失敗均明確顯示，非永久 spinner。

本輪接上工作階段列開啟、所選 owner 的 Home 新增，以及只列所選 owner 有 session 成員的專案新增；新增使用 owner route 的 `session.create`，專案帶明確 `cwd`／`cwd_explicit`，成功後以該 route 呼叫 `openSession`。開啟失敗會保留新 ID，重試只開啟，不重新建立。切換 owner 時已完成的舊 owner 新增不會自動開啟，可切回後重試。使用者已接受公開 SDK 在明確 route 開啟時將原生 session 篩選切成全部 profile，因此不再把篩選保留當成本輪阻擋，也不恢復私有狀態。

Home 建立不傳目前專案 cwd；舊版 gateway 的 `session.create` 對 desktop 空 cwd 使用原生預設，並將非明確 workspace 留在 Home。但 canonical gateway 的 `gateway/session_policy.py` 在未傳 cwd 時以 daemon cwd 建立政策，而 SDK 的 `canonical-protocol.ts` 暫不允許 `row_cwd`（雖然 canonical 後端有該欄位）；因此不能宣稱 canonical 模式下 Home 的持久分類或所選 profile 預設 cwd 已驗證。真實新建／開啟、專案持久歸屬及終端 cwd 都尚未 live 驗收，不能由 mock 證明。建立請求在結果遺失時可能已成功，若顯示建立失敗，請先檢查原生清單再手動重試；只有已取得 ID 的開啟失敗具備不重建保障。

狀態由 SessionCrew 自己的 `/status` endpoint 收集，前端每五秒輪詢，不再讀取 Office 的 cache 或呼叫 Office namespace。來源包含 gateway liveness、session 聚合以及等待與 lease metadata；連線／active profile／activation epoch 分開快取，錯誤或 15 秒未更新顯示 unknown。Office 的 task 文字前綴歸屬未啟用：僅使用結構化 `profile` 欄位，沒有明確 profile 就不歸屬。working 和 waiting 分別使用 `--ui-green` 和 `--ui-yellow`。這是本地實作，原生後端模組的重新載入、root 路由及認證仍未經 live 驗證；不得因前端自動重載而假設 Python 已更新。

顯示名稱由插件使用 `ruamel.yaml` 安全讀取各 profile 的 `profile.yaml`，優先 Bots title、其次 display name；讀不到或格式錯誤時使用空值。此依賴已列於 manifest，安裝依賴仍需獨立授權。Linux lease PID 只有在可讀到相符的 PID namespace 時可檢查；未標記、不同或無法辨識時保持未知，不以 PID 存活取代 namespace 判斷。非 Linux 依既有平台語義處理；Windows 未驗證。

Multiplexer ownership 另以原生 `multiplexer_liveness_for_profile` 判斷，因 generic liveness 可能先回傳共享 lock 的 PID；已確認 served 時不套用該 profile 過期的 standalone state，也不將 host-wide 正計數歸給任何 owner。對 default 和其他 served profile，僅當共享 host snapshot 的 PID／process start 符合當前程序、時間新鮮、狀態 running、served roster 包含該 profile、原生 host `active_agents` 明確為整數 0，且該 profile 的 session 聚合可讀並無近期活動時，顯示 **idle：該快照未觀察到共享 gateway 工作**（`status_observation=fresh_shared_gateway_zero_observed_work`）。這是有界的 operational idle，不證明其他程序、非持久化工作或 snapshot 更新間隔內沒有工作；原生計數亦是 best-effort。無法核對的 PID／restart epoch、過期或未來時間、缺失資料、衝突及 host 正計數均不藉此推論 idle，保持 unknown；waiting／working 優先。獨立 gateway 的既有行為不變。本輪結果（本機未隨發布紀錄 `evidence/shared-host-idle-regression.md`） 區分受控測試與程序內唯讀觀察；兩者不等於已執行 gateway backend 的新版本或 live renderer。先前紀錄（本機未隨發布紀錄 `evidence/multiplexer-status-result.md`） 為歷史結果。

漂浮版 A 視覺改為 310px 主氣泡、34px／22% 圓角的 Bots 尺寸頭像與姓名／短句、兩行 session、等寬繁中 footer；次浮窗獨立定位，短畫面先縮 session 區，依空間在主氣泡下方或上方顯示。頭像圖像本體為 34px，邊框不縮小圖像；✋ 與 xN 錨定主頭像。rail 隨 pane 寬度變化，主頭像與 activity 疊影按總寬置中；超過內寬時固定左端並裁切右側。子代理疊影使用本插件 snapshot 的 queued／recent metadata，**不證明正在執行**；舊後端無 metadata 時才回退至有效的 lease 子代理計數或布林值。Popover 使用主頭像 34px 按鈕作為公開 SDK 錨點，而非整個疊影列。依實際頭像與氣泡 bounds 檢查箭頭安全區，進入圓角危險區或離開 rail 時關閉。這仍不是原設計的聊天內 overlay。原生 Desktop 的本次渲染與真 gateway 行為尚未 live 驗收。

✋ 現為**局部 snapshot coverage，不是完整 fleet unread**。不再訂閱 `message.complete`：server-side `SessionEvents.catch_up` 會送出沒有 `replayed` 標記的歷史 frame，無可信首個 watermark 時無法區分歷史和新完成；舊 `completion-ledger-v1` 也不再讀取或顯示。新來源是本插件自己的 `ctx.rest('/completion-snapshot')`；第一個完整快照只建 baseline，不亮歷史提醒。後續僅對同一 source/server epoch/owner/database 的完整快照，偵測新 admission 或已見 admission 轉為原生 `status=terminal, outcome=completed`，不從 idle、子代理結束或 generic session close 推論成功。

Ledger 是本 client 的 plugin storage，按 connection、資料集 source、database、owner、stored session ID、admission ID 隔離；server epoch 變更先重建觀察基準，不把歷史亮成新完成。同一資料集、同一資料庫且仍可驗證的既有未讀與確認狀態保留。成功開啟列只確認開始開啟時的該列 watermark，期間的新完成和其他 owner 留下。寫入後會讀回核對；不符、格式損壞或容量上限會隱藏提醒並顯示錯誤。全量 baseline 的 metadata coverage 也寫入 storage，但重新載入、錯誤或重新連接後先重新建基準，**不把中斷期間完成當新事件回補**。資料庫替換、記錄消失或 watermark 倒退會隔離不確定來源；截斷或不可用 profile 不顯示其 badge，且有 `!` 錯誤提示。這是保守防誤亮，不是無遺漏 replay。Native SDK 的 `ackStoredSessionId(id, profileHint)` 先按 ID 找 loaded row，同 ID 跨 owner 時可能忽略 hint；本插件不直接呼叫該 mutator，不能宣稱與 core unread 同步。

`dashboard/plugin_api.py` 為 SessionCrew 自有唯讀 metadata snapshot；default 和各 named profile 須分別由 Hermes 原生插件 consent 啟用，請求使用目前連線／profile 的 `ctx.rest`。每個獲授權的 runtime 按需讀取由 `get_default_hermes_root()` 決定的共同資料根，並限制 runtime home 必須屬於該根目錄的有效 profile inventory；不接受呼叫者指定資料路徑。`source_root: default` 描述資料根，並非呼叫者 profile。另一個連線使用該連線自己的資料根；沒有 consent 或來源不可用時顯示未知並可手動重試，不回退讀本機。Native Hermes 對 secondary profile 可能按需啟動既有 profile plugin-host 子行程；插件本身不另開 HTTP listener 或服務，也未重啟 gateway。

完成紀錄只查 `session_admissions` 與 `sessions.source`，不讀訊息、標題或 payload；排除 `source=subagent`。v2 回 source hash、進程 epoch、各資料庫 identity、高水位和最多 2000 筆 admission metadata；超出時該 profile 標示截斷，profile inventory 最多 128 個，超限／讀取失敗回 503。這是 admission 建立序號，不是按完成時間排序的可重播事件日誌；斷線期間、超出上限或尚未以 canonical admission 記錄的工作可能漏報。失敗只探測一次、不自動重試，可用 `!` 手動重試；受控測試不等於 live routing 驗證。

## Active-turn 局部觀察

`dashboard/plugin_api.py` 以唯讀 SQLite transaction 查原生 `session_turn_leases` 與必要 session lineage metadata，輸出 version 1 `activity`。它只數可辨識 holder、未過期、PID 存活且 process start 不晚於 lease `acquired_at` 的 foreground compression lineage root；子代理 lease 仍獨立計數。另有 `child_metadata`：不依賴 lease coverage，按唯一 parent owner 歸屬，近 1200 秒且未結束者標為 recent，唯一 registered worker 標為 queued；stale、結束或失敗不顯示影子。native `agent_close` 只表示 ended，不推論成功。每個資料庫最多取 50 子代理（另探測截斷），缺失／歧義為 unknown；相同 ID 的 lease 與 metadata 不重複計數。來源不明、資料庫別名、缺行、存取失敗、未知 holder、過期／dead PID／PID reuse 和 lineage 不明不當成正面觀察；理由見 `unknown_reasons`。資料庫及活動掃描上限是各 20,000 筆。admission 截斷不決定活動 coverage，反之亦然。

**xN 是已觀察到的 N 個 turn，不是全部執行數。** lease 覆蓋 setup 和 finalize，不代表 token 正在前進；不持久化或沒有資料庫的執行不會留下 lease。lease 沒有 host／boot identity，PID 檢查只能在本機 namespace 假設下提供有限證據；共享磁碟跨機器的 holder 無法由此證明為本機。0 也不代表沒有工作；不發 `complete` coverage。snapshot 刷新後活動層消失不會清除 ✋ ledger。Popover 與 aria 說明局部範圍；舊後端、未啟用或來源無法驗證時隱藏活動層。Office 的 recent/active_sessions/open_sessions 不是 running 證據，不拿來湊數。

先前 `tests/test_activity_native_sources.py` 的手動 lease 寫入負向測試只證明 lease 自身不是無例外的全域精確真相，**不否定原生 `run_conversation` 的 producer**。受控 fixture 測試實際 facade 以兩個背景 thread acquire/release；無 LLM 呼叫、無真 session 建立。跨 profile fixture 的外部 parent 關係是合成 metadata，並非 live 跨 profile 行為驗收。真實 runtime 的 host identity、live UI 與已執行服務的路由仍需各自驗證；offline completion replay 仍不可用。

短句可在氣泡內按當前 working／waiting／idle／offline／unknown 各自編輯；切換狀態即切句，各狀態有通用預設。資料僅存目前 client 的 plugin storage，按連線、profile ID 和狀態分隔，**不是 core 資料，也不跨裝置同步**。舊單字串保留原 key 並作各狀態 fallback；編輯只覆寫新的狀態 key。寫入後讀回相符才更新顯示，失敗顯示錯誤並保留草稿可重試；同 key 在同一 renderer 的並行寫入依序處理。空白正規化並限制最多 28 grapheme，點短句可單行橫捲全文，預覽依字寬以 ASCII 三點截斷；不讀 SOUL/config。受控 fixture 已測儲存後重掛載，未證明真實 client 或跨裝置持久性。所有狀態均保持相同的置中位置，不再依 idle、hover 或 focus 收合；保留 reduced motion 與隱藏 scrollbar。

## 本機部署和還原

app-level standalone loader `~/.hermes/desktop-plugins/profile-rail` 指向本專案 `desktop/`，編輯 source 即改變 loader。最新 source 與 loader 的 readback hash、受控測試及缺口見 多 profile 結果（本機未隨發布紀錄 `evidence/multi-profile-routing-result.json`）；bytes 相同不代表原生 renderer 已載入。本輪前 source、backend、README 及測試保存在 `history/multi-profile-before-20261108-002730-632135/`；其他早期快照仍在 `history/`。插件尊重既有 toggle。

## 多 profile backend 部署狀態

使用者已授權共同程式碼與逐 profile 原生啟用。已發現 default 及 12 個 named profile，各自 `plugins/profile-rail` 指向同一專案，並逐項以原生 CLI 驗證 enable、不得覆寫工具及 scoped doctor；未改其他設定值。既有 app-level standalone loader 與 toggle 保留，不為每個 profile 新增 desktop loader；最小 `__init__.py` 只提供空的 agent `register`，不註冊工具或 hook。逐項記錄及精確讀回見 部署紀錄（本機未隨發布紀錄 `evidence/multi-profile-install-result.json`）。未重啟 gateway；原生 CLI 的插件重新載入訊息不證明舊的已執行 backend 已載入新 Python。新增的 `observed_child_count` 必須由執行中的 Python 模組重新載入後才會輸出；舊模組仍只提供布林 fallback，不能據 source hash 聲稱完整數量已生效。受認證 live endpoint、renderer 和不同 gateway 實際路由仍待驗證，不能據 fixture 宣稱成功；若實際需要重啟須另行確認。

## 驗證

專案次浮窗以單行呈現專案名稱，正常高度顯示最多三列，超出時捲動；列右新增圖示建立該專案對話，資訊區本身不建立。圖示依 tree 的 icon/color/isAuto 套用原生規則及公開 Codicon；不顯示分支。「新增專案」使用插件自有 Dialog，而非未公開的原生 `openProjectDialog`；其資料夾邊界和未驗證事項如本頁開頭所述。

歷史受控 Chromium 回歸見 專案列表結果（本機未隨發布紀錄 `evidence/project-list-results.json`），不代表目前版本或 live Desktop renderer 已驗收。歷史 runner 會寫 evidence，應僅在隔離副本執行。

2026-11-09 核對：公開 [Desktop SDK 文件](https://hermes-agent.nousresearch.com/docs/developer-guide/desktop-plugin-sdk)及上游 [SDK `index.ts`（commit `109fd8161a509db5a00942152ba48882e446e8b0`）](https://github.com/NousResearch/hermes-agent/blob/109fd8161a509db5a00942152ba48882e446e8b0/apps/desktop/src/sdk/index.ts)未列出 `host.openProjectDialog`。本機 Hermes checkout 為 `2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19`（`v0.23.0-dirty`），該方法出現在其 SDK 的未提交修改中；這不證明目前 Desktop 執行該版本。插件不再探測或呼叫這個擴充；測試 mock 保留該方法僅為驗證不會呼叫。沒有改用 active owner、私有 bridge 或其他替代互動。

| 驗收項目 | 目前狀態與證據 |
| --- | --- |
| 按狀態短句、舊值 fallback、失敗重試與非同步隔離 | 受控 React／mock storage 通過：本輪結果（本機未隨發布紀錄 `evidence/remaining-quotes-result.json`）；不代表跨 client 同步。 |
| 短畫面、儲存後重掛載、狀態重排、雙窗 Escape 與專案 owner | 受控 Chromium fixture 通過：畫面（本機未隨發布紀錄 `evidence/remaining-quotes-short.png`）；未使用真 session。 |
| 既有功能回歸 | 歷史結果不代表本版；完整受控結果以本次執行紀錄為準。 |
| 真實 Desktop、認證與 storage | 尚未 live 驗證；source 與 loader 一致不代表 renderer 已載入。 |
| canonical Home 建立 | 如上所述，SDK／後端分類合約限制，尚未 live 驗收，非短句功能缺陷。 |

舊 `tests/run-*.py` 部分寫入歷史 evidence，並非乾淨 checkout 的獨立測試入口。受控前端套件可使用 `tests/run-controlled.mjs`：設定絕對路徑 `HERMES_CHECKOUT`、`CHROME_PATH` 及 repo 外既存的 `RAIL_TEST_SCRATCH` 後以 Node 22 執行；它在 scratch 副本內產生結果，不安裝或連接 gateway。需既有 Hermes checkout、其 JavaScript 依賴、Python venv 與 Chrome。獨立狀態 collector 來源與 coverage 限制見歷史獨立狀態結果（本機未隨發布紀錄 `evidence/standalone-status-result.json`）：live 認證、Python 模組版本與原生 renderer 仍未驗證。原生重啟未進行。頭像其他回歸見 最終頭像疊影回歸（本機未隨發布紀錄 `evidence/avatar-stack-final-result.json`）；活動實作限制見 活動結果（本機未隨發布紀錄 `evidence/activity-result.json`）。

以下為歷史命令；部分 runner 會寫入 source 的 evidence，請先複製到隔離 scratch 再執行。Windows PID unknown 可能漏顯 waiting，尚未實機驗證；`requires_hermes` 下限、官方 validator、真實 Desktop／backend 與官方審查尚未驗證，不能宣稱符合參賽資格。從隔離副本目錄執行：

```sh
node --check desktop/plugin.js
node tests/live-contract.mjs
node --experimental-vm-modules tests/roster.mjs
node --experimental-vm-modules tests/recent-name-red.mjs
node --experimental-vm-modules tests/owner-recent.mjs
node --experimental-vm-modules tests/loading-regression.mjs
node --experimental-vm-modules tests/sdk-route-contract.mjs
node --experimental-vm-modules tests/status-quote.mjs
node --experimental-vm-modules tests/actions.mjs
node --experimental-vm-modules tests/actions-switch.mjs
node --experimental-vm-modules tests/office-cache.mjs
node tests/build-sdk.mjs
node tests/browser-recent.mjs
node tests/browser-rail-visual.mjs
node tests/browser-actions.mjs
node tests/browser-working.mjs
node tests/browser-quote-ascii.mjs
node tests/browser-floating-geometry.mjs
node tests/browser-working-pixels.mjs
node --experimental-vm-modules tests/completion.mjs
node --experimental-vm-modules tests/native-snapshot-integration.mjs
node --experimental-vm-modules tests/native-activity-integration.mjs
node --experimental-vm-modules tests/root-transport-contract.mjs
node --experimental-vm-modules tests/snapshot-switch.mjs
node tests/browser-completion.mjs
node tests/browser-activity.mjs
node tests/browser-stack-centering.mjs
node tests/popover-fixture-contract.mjs
node tests/browser-primary-anchor.mjs
# Or run the complete recorded manifest:
python3 tests/run-avatar-final.py
env -i PATH=/usr/bin:/bin HOME="$HOME" PYTHONNOUSERSITE=1 TMPDIR="$TMPDIR" /path/to/hermes-agent/.venv/bin/python -I -m pytest tests/test_activity_adapter.py tests/test_activity_native_sources.py tests/test_completion_backend.py tests/test_snapshot_identity.py tests/test_native_snapshot_path.py tests/test_snapshot_bounds.py tests/test_snapshot_inventory.py tests/test_native_mount_consent.py -q
```

`tests/native-snapshot-integration.mjs` 在同一測試中將原生 `SessionDB` admission／claim／settle，接到真 FastAPI TestClient HTTP 路由，經 checkout 的真實 `pluginRest` 和模擬 bridge 接入真 React Query，切換 default → alpha → beta → default；不啟動網路 listener，也不連真 gateway。`tests/test_native_mount_consent.py` 測真 Hermes mount 的 enabled／disabled gate，但替換 HTTP 認證／scope dependency，因此不是完整 live authorization 測試。`tests/snapshot-switch.mjs` 另外測來源 epoch、跨連線、延遲回覆及暫存舊快照。Chromium fixture 使用真 React Query、checkout 的 Popover 和合成 snapshot，不連真 gateway；fixture CSS 不是原生宿主樣式驗證。執行依賴本機 Hermes checkout 和 Chrome；測試結果與缺口（本機未隨發布紀錄 `evidence/multi-profile-routing-result.json`） 分開記錄受控與 live 驗證。

[設計](design/floating-version.md)、[驗收項目](design/acceptance.md)、漂浮版封存（本機未隨發布紀錄 `archive/floating-v1/README.md`）、歷史競賽探索（本機未隨發布紀錄 `history/contest-exploration/README.md`） 保留供參考；歷史文件的結果不代表目前版本。
