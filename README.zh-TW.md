<p align="center"><img src="assets/sessioncrew-hero.png" width="100%" alt="復古編輯插畫：團隊整理不同 profile 的對話"></p>

<h1 align="center">SessionCrew</h1>

<p align="center"><strong>多個 profile，各自的對話，一處掌握。</strong></p>

<p align="center"><a href="README.md">English</a> | <strong>繁體中文</strong></p>

<p align="center"><a href="#功能">功能</a> · <a href="#安裝與需求">安裝</a> · <a href="#基本使用">使用</a></p>

SessionCrew 是一個 Hermes Desktop 插件，讓你在一個側邊面板查看不同 profile 的工作階段。選取頭像後，就能開啟該 profile 的對話、建立新對話，或查看與它有關的專案。適合同時使用多個 Hermes profile、不想反覆切換清單的人。

## 功能

- **以 profile 瀏覽對話**：點選頭像查看近期工作階段；可開啟既有對話，或在 Home 與相關專案中建立對話。
- **查看與建立專案**：列出與所選 profile 的工作階段有關的專案，也能瀏覽 gateway 上的資料夾、建立資料夾並新增專案。建立後，非空白的專案點子會儲存為主要資料夾中的 `IDEA.md`，不覆寫既有檔案。
- **觀察狀態**：顯示可取得的工作、等待、離線等狀態；資料不足時顯示未知。頭像旁的活動數量只代表觀察到的部分，不是所有執行工作的完整計數。
- **工作階段活動與徽章**：可驗證的執行中 turn 與部分背景工作顯示仿原生流動細邊；等待輸入顯示手掌，未讀完成顯示紅點。等待狀態優先顯示，但不清除未讀狀態。未知不等於閒置；backend 僅比對 ID 所屬資料庫，不讀取訊息。
- **完成提醒**：觀察到新的已完成工作時顯示紅點，可以開啟對話或使用「全部已讀」確認。這不是完整的未讀通知：中斷期間或來源不完整的完成可能漏掉。「全部已讀」確認目前連線中可驗證來源內所選 profile 已知的未讀完成，包括清單中尚未載入的工作階段；不會將其他 profile 標記為已讀。
- **個人化顯示**：可依狀態編輯短句，並在設定中控制可見 profile、離線 profile 與 cron 對話。介面提供英文和繁體中文；不支援翻譯 API 的 Desktop 版本會回退英文。

## 安裝與需求

SessionCrew 包含 Desktop 介面與自己的 Python backend，兩者都需要。backend 需要 [`plugin.yaml`](plugin.yaml) 列出的 `ruamel.yaml` 依賴，以及提供所需公開插件 API 的 Hermes 環境。受控測試的最低版本為 Hermes 0.23.0（`requires_hermes: >=0.23.0`）；受控相容與 owner 路由測試不代表已完成 live 路由驗收。Catalog 收錄仍須通過官方 CI 與維護者審查。

插件 ID 為 `sessioncrew`。請參照 [Hermes 插件安裝說明](https://hermes-agent.nousresearch.com/docs/user-guide/features/plugins)，檢視並安裝本倉庫的插件套件。安裝後需在 Desktop **Capabilities → Plugins** 啟用 SessionCrew 介面，並在需要提供資料的各 profile 分別啟用本插件的 backend；只啟用介面不足以提供 backend 資料。

## 基本使用

1. 在 Hermes Desktop 開啟 SessionCrew 面板，選取一個 profile 頭像。
2. 點選工作階段以開啟對話；使用面板中的新增按鈕，可在 Home 或所列專案建立對話。
3. 開啟專案清單可查看相關專案，或選擇新增專案並挑選 gateway 上的資料夾。
4. 在 **Settings → Plugins → SessionCrew** 調整顯示選項；點選氣泡中的短句可編輯目前狀態的文字。

若建立對話時顯示失敗，請先檢查原生工作階段清單：請求可能已成功但回覆遺失，直接重試可能建立重複對話。連線、資料或權限不可用時，介面會顯示錯誤或未知；不會改讀本機資料來冒充遠端結果。

## 資料與權限

- backend 會依已授權的 profile 讀取 Hermes 資料根中的 profile 設定、狀態與工作階段中繼資料，以顯示名稱、狀態和完成提醒。完成快照不讀取對話訊息內容；對話與專案清單則透過 Hermes 的介面取得。
- 資料夾選擇器從 gateway 的 Hermes 資料根開始，但可以瀏覽該程序有權存取的其他絕對路徑，並在可寫入位置建立資料夾。它會揭露資料夾名稱，不是限定於 Hermes 根目錄的沙箱；不讀取檔案內容、不跟隨 symbolic link。目前僅實作 POSIX 路徑。
- 顯示設定、短句與完成提醒紀錄保存在目前 client 的插件儲存空間，不會自動跨裝置同步。連線切換或重新載入後會重新建立完成觀察基準，不回補中斷期間的完成。
- 在 Linux 上，backend 會讀取 `/proc/self/ns/pid`，並可能查詢程序存活狀態與啟動時間，以判斷 lease 狀態；資訊不可用時視為未知。在 POSIX 系統上，`dashboard/waiting_status.py` 的較早探測不可用時，可能以子行程執行 `ps`（`subprocess.run(['ps', '-o', 'state=', '-p', str(pid)], ...)`，採 Python 預設 `shell=False`），盡力檢查 zombie 狀態；此操作不啟動 shell。
- 使用專案點子生成功能時，專案名稱會送至所選 profile 的模型；網路與資料處理取決於該 profile 的模型供應商設定。插件不自行讀取憑證、不執行 shell、不另開 HTTP listener、不自我更新，也沒有遙測。Hermes 本身可能按需啟動 profile plugin-host 子行程。

## 限制

- 狀態與活動數量是有限範圍的觀察；未知或未觀察到活動不等於沒有工作。
- 列狀態需要連線正常、同名且唯一的 owner route，以及符合 authority 形狀的 `session.active_list`：ID 等於 `session_key`，非空 `source` 與唯一歸屬的資料庫紀錄一致。受檢查 Hermes 版本的 authority 由持久 live entry 產生此形狀；跨 profile 的舊版列表沒有 `source`，即使 fallback ID 等於 key 也不足以證明。這是版本限定的形狀檢查，並非 producer 明確認證。嚴格 inventory 遇到不支援的 profile 項目或無法讀取的資料庫即不顯示；重複 ID、source 或 owner 不符、紀錄缺失、資料過期或請求失敗亦不顯示。不推測 lineage 別名。`subagent.roster` 背景工作僅在已識別且非等待的 active 列顯示；starting 本身不是執行中。這些觀察不涵蓋所有原生狀態或背景工作，尚未 live 驗證。
- 對話清單不是跨來源的完整時間排序，且受後端回傳數量與權限限制。
- 完成提醒不是可重播的事件日誌；來源截斷、無法讀取或連線中斷時可能漏報。⚠️ 提示來源出錯時可手動重試。
- 資料夾操作及點子儲存會修改 gateway 檔案系統。點子上限為 65,536 UTF-8 bytes，絕不覆寫既有的 `IDEA.md`；相同內容重試可確認儲存，不同內容或結果不明時會保留文字供複製或只重試儲存點子。重試前請先檢查實際檔案；目錄忙碌時會回報錯誤而不等待。
- 點子寫入會檢查 runtime 和目錄 identity，拒絕 symbolic link、hardlink、常見憑證目錄及 Hermes 管理根目錄，並讀回檔案確認。這些檢查不是沙箱：其他程序仍可移動目錄或修改檔案，而鎖只約束配合的寫入者。backend 回顯 project ID 與 owner，但不獨立認證專案歸屬；owner RPC 與 REST 是否指向同一檔案系統、包括連線變更在內的路由尚未 live 驗證，已送出的請求仍可能與 scope 變更競爭。若建立完成前連線變更，對話框會保留已知專案及文字，不跨 scope 儲存。

## 開發

Desktop 入口是 [`desktop/plugin.js`](desktop/plugin.js)，backend 是 [`dashboard/plugin_api.py`](dashboard/plugin_api.py)。受控測試入口為 [`tests/run-controlled.mjs`](tests/run-controlled.mjs)：需要既有 Hermes checkout、JavaScript 依賴、Python 環境、Chrome，以及 repo 外的 scratch 目錄。設定 `HERMES_CHECKOUT`、`CHROME_PATH` 和 `RAIL_TEST_SCRATCH` 後，以 Node 22 執行 `node tests/run-controlled.mjs`。

語法與模擬測試、catalog validator、真實 Desktop／backend 驗收及官方 catalog 審查是分開的關卡，任一項通過都不能代表其他項通過。此候選版本的 live 路由與 Desktop／backend 驗收及官方審查尚未完成；提交前須審查 validator 的安全與 Desktop surface 警告。

## 授權

SessionCrew 自有程式碼依 [MIT License](LICENSE) 授權。第三方素材與程式碼的來源和條款見 [Office 授權通知](dashboard/OFFICE-LICENSE)、[Hermes 資料夾選擇器授權通知](desktop/HERMES-REMOTE-PICKER-LICENSE)、[Hermes spinner 授權通知](desktop/HERMES-SPINNER-LICENSE)及 [Hermes 列邊框授權通知](desktop/HERMES-ARC-LICENSE)。
