# 驗收狀態

## 現有證據

封存的 verification.json（本機未隨發布紀錄 `../archive/floating-v1/verification.json`） 記錄 Ego Browser Chromium、file URL、mock 的 **176 pass / 0 fail**；是既有結果，不是本次重跑或真實 Desktop 驗收。原型 README 列出矩陣與尚未完整回歸的滑鼠／鍵盤展開、上下圓角及 composer 位置等案例。截圖與歷史 B/C、舊測試腳本均保留供追溯，非目前選定方案或完整驗收；最新腳本是 `verify-rail.mjs`，其中硬編原原型目錄，直接執行可能覆寫原路徑的驗證輸出，不能直接拿來驗證封存。

## 正式驗收前仍需

- 在實際 Desktop／執行中 SDK 驗證 overlay 掛載、sidebar 兩種狀態與訊息／composer inset；彈窗、箭頭、圓角關閉、滾動、短畫面及鍵盤／reduced-motion 完整互動回歸。
- 證明 profile 身分、Bots 名稱／頭像、Office 狀態、owner route、filter 不變和 project cwd；釐清有界 project membership 與 Home 語意。
- ✋ 部分接入 canonical live event 和 plugin-local 逐 session watermark；仍需修復首次未知 replay baseline、覆蓋缺失／離線事件，並獨立驗收 owner、連線與重連。自有 root-only snapshot backend 已有受控測試，但尚未接入或啟用。子代理影子與 xN 只有 fixture，真實 activity producer 尚未接入。不能以 idle 或 Office recent 推定完成／running。確認短句正式資料契約及 escaping。
- 區分 stored 200 上限與本地顯示更多，不宣稱 RPC 分頁；若需完整歷史、可靠 membership 或缺失 SDK 契約，另行取得授權。
- 以實際 Desktop、真資料及相關測試確認，不以 mock 176 項替代。正式版移除 demo controls，封存保持不變。

檔案完整性見 manifest（本機未隨發布紀錄 `../evidence/floating-v1-manifest.json`）：封存前後每檔 bytes、SHA-256 及檔案集合已核對；歷史整合報告另列 SHA-256。
