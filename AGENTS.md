# SessionCrew：開發規範

## 專案範圍與設計方向

- 以**不修改 Hermes core／SDK 的插件**為開發方向。權威 Desktop 入口為 [`desktop/plugin.js`](desktop/plugin.js)；`dashboard/` 是 SessionCrew 自有 backend。
- 保留已核准的視覺與互動，不因 SDK 相容性重做設計。若公開 hook 或掛載契約不足，記錄執行版本、缺少的契約、證據及影響；不擅改核心、不把替代方案說成等價。可提出 upstream hook 需求，但開 issue 需另獲授權。

## 實作邊界

- 使用公開插件 hook、註冊 API、Desktop SDK slot／route 與插件自有 backend。前端合法匯入 `@hermes/plugin-sdk`、`react`、`react/jsx-runtime`；確認實際執行版本支援所用公開 export。
- 禁止 core／SDK patch、monkeypatch、替換或包裝核心模組與函式、修改私有表、runtime override，以及內部或未公開 imports；不以私有 bridge 或其他繞道取代缺失的公開契約。
- 禁止查詢、監看、點擊、隱藏或改寫**宿主** DOM／markup，或注入針對宿主的 CSS、script；禁止 `eval`、`new Function`、載入遠端或 blob 腳本及修改瀏覽器／renderer 原型。插件可正常操作**自己擁有的 DOM**，但不得藉此觸及宿主內部 UI。使用公開 SDK 的 Popover 等元件不等於自行操作宿主 DOM。
- 尊重權限與審批；不直接讀憑證檔、其他工具登入資料或繞過 Hermes 核准機制。使用者已常設授權此專案一般插件檔案更新與公開 rescan／reload；安裝、啟用、重啟服務、發布或開 issue 均須另獲明確授權，既有部署紀錄不構成此類授權。

## 此專案的開發流程

- `dev` 是本機日常停留與累積已驗收變更的整合分支；`main` 是發版主線，不作為日常開發或功能分支的直接合併目標。
- 每次新功能開發或修復先從 `dev` 建立新分支，再於既有、連結正式插件的 checkout 直接套用變更，必要時使用公開 rescan／reload；先確認範圍、備份將覆寫的檔案並保留原路徑與雜湊。此常設授權僅限 SessionCrew 專案，不擴及其他插件或 profile 設定。
- 保持在功能分支，直接套用、驗證並依使用者回饋反覆調整，直到使用者驗收；每一輪調整不自動隱含建立 commit 的授權。僅在使用者另行明確決定合併後，才將功能分支 fast-forward 合併至 `dev` 並回到 `dev`；保留功能分支。若無法 fast-forward，不自行改用其他合併方式或改寫歷史。失敗時停留在工作分支、保全證據，不宣稱完成。
- 準備進版發佈時，才透過 GitHub 建立 `dev` → `main` 的 PR；建立發版 PR 前，必須依本次累積變更更新插件版本，將實際版本檔案的修改納入同一張 PR，並檢查所有需同步的版本宣告一致，不能只在 PR 文字寫版本號。PR 應說明本次版本、自上次發版以來的累積變更、驗證結果與已知限制；獲明確授權後才合併與發佈，不以本機直接合併取代發版 PR。發版後本機仍以 `dev` 為日常分支。
- `dev` → `main` 發版 PR 使用 GitHub **Create a merge commit**，不使用 squash 或 rebase merge，保留原提交與祖先關係；保留來源分支。以 PR 標題、版本號與發版摘要整理發布內容，閱讀 `main` 時可用 first-parent 視角查看發版節點；功能分支合入 `dev` 的既有規則不變。
- 一般發版合併不要求僅為歷史對齊而將 `main` 合回 `dev`；若 CI、hotfix 等變更獨立進入 `main`，則須同步回 `dev`。此同步須另獲明確合併授權，可使用 merge commit，保留開發歷史並驗證整合結果，不受功能分支 ff-only 規則限制，也不自行 reset、rebase 或強推。已完成的 squash 合併不重寫歷史，依相同方式同步其結果。
- 不自動推送遠端、安裝依賴、啟用插件或執行會中斷服務的重啟；這些操作須各自另獲授權。

## 交付與驗證

依[官方 catalog admission rules](https://hermes-agent.nousresearch.com/docs/developer-guide/plugins/catalog-submission#admission-rules) 檢查，並以官方最新規則為準：

- 公開可 clone 的 HTTPS repo；固定可載入的 manifest 與入口，catalog entry 使用完整 40 字元 commit SHA，版本與該 commit 一致。catalog 提交者須符合官方 owner／主要貢獻者規則或維護者收錄例外。
- `requires_hermes` 使用經實測且真實的 SemVer 下限，catalog entry 與 `plugin.yaml` 一致；宣告的 capabilities、設定、環境需求與實際行為相符。檢查依賴與 Hermes 核心限制相容，審查依賴安全性；盤點程式與素材授權及來源，確保有權發布與必要歸屬。
- 在 README 與 catalog 提交內容揭露外部網路、插件資料外讀取、shell、長駐程序及憑證等風險；遙測須 opt-in。不自我更新；提交內容應可供掃描與審閱，並符合官方二進位例外規則。
- 針對擬 pin 的 checkout 執行官方同款 `hermes plugins validate /path/to/plugin --install-deps`，檢查失敗及安全警告；此命令可能安裝依賴，須先獲相應授權。catalog CI 綠燈後仍須維護者人工審查；UI catalog 提交附截圖。
- 分別記錄 **syntax、mock／受控測試、validator、真實 Desktop／backend live 驗收、官方審查**的命令、版本、結果及未執行原因。任何一層通過不代表其他層通過；validator、模擬畫面或歷史結果都不能證明現版已完成 live 驗收或通過官方審查。
