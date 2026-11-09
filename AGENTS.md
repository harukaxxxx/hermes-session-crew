# SessionCrew：參賽與開發規範

## 資格與範圍

- 本案參加 **Nous Research 的 Hermes Agent Plugin Hackathon**，以**不修改 Hermes core／SDK 的插件**為交付方向。使用者先前已提供活動通知；[官方公告](https://x.com/NousResearch/status/2118094256438936062)及其連結的 catalog 規則是依據。以下條件不是本案已獲主辦認定合格的聲明。
- 依先前對話留存的公告全文：所有種類的插件均可參加，包含 Hermes Desktop 插件；參賽作品必須是可運作的插件本身，而不是只有 prompt 或 skill。評分面向為實用性、可靠性、完成度及創意，偏好超越單靠 prompt／skill 可達成的功能。
- 公告所列截止換算為台北時間是 **2026 年 11 月 12 日（星期四）上午 6:00（Asia/Taipei，UTC+8）**，原文為 2026 年 11 月 11 日下午 5 點 EST（UTC−5）；這是已留存公告的時間，不代表已確認後續沒有延期或修訂。正式投稿前須重查官方最新公告。
- 投稿須完成三項：開啟將插件加入 Hermes plugin catalog 的 PR；在 X 發布**少於 90 秒、展示插件實際運作**的 demo 影片並標記 `@NousResearch`；透過[官方表單](https://form.typeform.com/to/FwJLvOln)提交 PR 與影片兩個連結。公告允許 PR 開啟後即提交表單，不須等待合併；catalog checks 由維護者啟動，仍須遵守收錄規則與審查。
- 權威 Desktop 入口為 [`desktop/plugin.js`](desktop/plugin.js)；`dashboard/` 是 SessionCrew 自有 backend，不依賴 Office 的執行環境、API 或 cache。以 [README](README.md) 說明現況；`history/` 與 `evidence/` 是特定版本的歷史證據，不代表現版已驗收。
- 保留已核准的視覺與互動，不因 SDK 相容性重做設計。若公開 hook 或掛載契約不足，記錄執行版本、缺少的契約、證據及影響；不擅改核心、不把替代方案說成等價。可提出 upstream hook 需求，但開 issue 需另獲授權。

## 實作邊界

- 使用公開插件 hook、註冊 API、Desktop SDK slot／route 與插件自有 backend。前端合法匯入 `@hermes/plugin-sdk`、`react`、`react/jsx-runtime`；確認實際執行版本支援所用公開 export。
- 禁止 core／SDK patch、monkeypatch、替換或包裝核心模組與函式、修改私有表、runtime override，以及內部或未公開 imports；不以私有 bridge 或其他繞道取代缺失的公開契約。
- 禁止查詢、監看、點擊、隱藏或改寫**宿主** DOM／markup，或注入針對宿主的 CSS、script；禁止 `eval`、`new Function`、載入遠端或 blob 腳本及修改瀏覽器／renderer 原型。插件可正常操作**自己擁有的 DOM**，但不得藉此觸及宿主內部 UI。使用公開 SDK 的 Popover 等元件不等於自行操作宿主 DOM。
- 尊重權限與審批；不直接讀憑證檔、其他工具登入資料或繞過 Hermes 核准機制。安裝、啟用、重啟服務、發布、開 issue 或投稿均須另獲授權；既有部署紀錄不構成本次授權。

## 交付與驗證

依[官方 catalog admission rules](https://hermes-agent.nousresearch.com/docs/developer-guide/plugins/catalog-submission#admission-rules) 檢查，並以官方最新規則為準：

- 公開可 clone 的 HTTPS repo；固定可載入的 manifest 與入口，catalog entry 使用完整 40 字元 commit SHA，版本與該 commit 一致。投稿者須符合官方 owner／主要貢獻者規則或維護者收錄例外。
- `requires_hermes` 使用經實測且真實的 SemVer 下限，catalog entry 與 `plugin.yaml` 一致；宣告的 capabilities、設定、環境需求與實際行為相符。檢查依賴與 Hermes 核心限制相容，審查依賴安全性；盤點程式與素材授權及來源，確保有權發布與必要歸屬。
- 在 README 與 PR 揭露外部網路、插件資料外讀取、shell、長駐程序及憑證等風險；遙測須 opt-in。不自我更新；提交內容應可供掃描與審閱，並符合官方二進位例外規則。
- 針對擬 pin 的 checkout 執行官方同款 `hermes plugins validate /path/to/plugin --install-deps`，檢查失敗及安全警告；此命令可能安裝依賴，須先獲相應授權。catalog CI 綠燈後仍須維護者人工審查；UI 投稿附截圖。
- 分別記錄 **syntax、mock／受控測試、validator、真實 Desktop／backend live 驗收、官方審查**的命令、版本、結果及未執行原因。任何一層通過不代表其他層通過；validator、模擬畫面或歷史結果都不能證明本案參賽合格。
