# 漂浮版 v1：已選設計與實作邊界

選 **A**：透明、無框 rail 垂直覆蓋聊天 workspace 左緣；訊息及 composer 預留左側 padding。彈出的對話氣泡可覆蓋聊天，但不應重排訊息或輸入框。rail 隱藏 scrollbar，保留滾輪／觸控捲動；氣泡箭頭追隨目前頭像，接近圓角安全區時提前關閉，不強行夾住。sidebar 收合仍以 workspace 為錨點。

狀態排序 working → waiting → idle → offline/unknown；idle 越久越靠下，未知閒置時間獨立處理。idle、offline、unknown 頭像左側約三分之一收進邊緣，hover／focus 展開，選中時保持展開；不顯示 idle 時間。✋ 表示有完成但未讀，與執行狀態分離；開啟頭像不清除，成功開啟特定 session 才逐筆確認已讀。這些行為目前只有 mock。

working 以原生預設顏文字詞彙做裝飾示範，timer 循環不是原生事件節奏；固定寬 190px，背景 alpha 0.78，從左緣 72px 淡出至 160px 完全透明。大氣泡開啟時隱藏同一頭像的小氣泡，文字可讀且小氣泡不攔截點擊。

每 profile 初始 3 個 recent session 與 project，`⋯` 每次揭露最多 10 筆，列表一般最多顯示 5 列並在內部捲動。footer 左側 Home 快速新增、右側 project 新增；project 次浮窗優先在下方，短畫面需要時翻至上方。標題使用 display name，路由與選取仍使用穩定 owner-qualified ID。正式介面不加彩色狀態點、recent header、read-full 控制或「未讀完成」文字標籤。

短句單行，空間不足以 `...` 截短；點擊在獨立單行浮條顯示全文，資料硬限 28 grapheme。可由 profile 人工依 SOUL 撰寫，不讀取、修改或自動同步 SOUL。狀態切換、模擬完成等 demo 控制只供原型測試，正式版不帶；封存保持原樣，不刪 demo 控制。

## 資料和整合界線

封存原型的 profile、狀態、頭像（截圖裁切）、session、project、完成與開啟皆為記憶體 mock，無後端、無真實建立或已讀。已查 source 的 `session.list` stored 單次上限 200，無 RPC cursor／offset／continuation；原型的加載只是揭露本地資料。project tree 不等於完整參與名單，Bots 完全一致的命名與公開 avatar 契約仍待確認；真實 completion/read 資料來源及逐筆 acknowledgement 契約未解。Office 3D 必須保留 root-only backend，不增加每 profile 服務。

先前 source-only 查核未找到公開的 chat workspace overlay slot 與 core 管理 inset 契約；不得以 mock 或 DOM injection 假裝 SDK 已支持。要正式實作須重新確認執行中版本、身份／路由與 filter preservation，缺口涉及 core/SDK 或部署時須另獲授權。歷史報告 `integration-notes-historical.md` 與封存內後續查核 `../archive/floating-v1/integration-next-notes.md` 僅在本機保留，未隨公開倉庫發布。
