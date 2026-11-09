# 操作完成後的漂浮版樣式核對表

此表由封存 `archive/floating-v1/index.html` 的已選 A 版樣式及 `design/floating-version.md` 整理；是後續驗收條件，不是通過紀錄。封存不得修改。

## 基準與最小適配

- 原 rail 寬 50px；頭像圖像 37px、圓角 10px，原型以狀態邊框表達狀態。
- rail 透明、無框、無容器陰影，隱藏捲軸但保留滾動與最後一個頭像可達性。
- 原型是聊天內 overlay 並預留訊息與 composer inset；現行 SDK pane 的 80px 下限是已知差異。不能透過宿主 DOM 或 CSS injection 假裝支持原 overlay。
- 使用宿主 theme tokens 替代封存 HTML 的硬編色碼，保留原有層次與幾何，不直接複製模擬宿主的 CSS。

## 可獨立完成的插件視覺

- idle/offline/unknown 圖像實際遮住約三分之一；hover、鍵盤 focus 與選中時露出。穩定 hit 區，不夾掉獨立 ✋。
- profile 氣泡沿用 A 版，箭頭跟隨所選頭像；清單更新、重排、滾動或 resize 後仍對準，進入圓角危險區前關閉。
- 不加入彩色狀態點、最近工作階段標題或未讀完成文字。
- 短句硬限 28 grapheme、單行，過長預覽為 ASCII `...`；點擊後單行全文，窄畫面可橫捲。
- session 初始三筆，`⋯` 每次 +10；一般最多五列高，短畫面可再縮清單，不可藏起固定 footer。
- footer 左快速新增、右開啟專案；次浮窗優先在下，空間不足可翻上。兩浮窗視為共同互動區，Escape 先關次浮窗。
- working 小氣泡固定寬 190px、高 25px；背景從左起 72px 開始漸淡、160px 完全透明，文字保持不透明。無真實狀態來源時不得展示假 working 狀態。
- working 小氣泡不攔點擊，同頭像大氣泡開啟時隱藏；尊重 reduced motion。

## 渲染驗證（尚待執行）

- 正常與短畫面；頂／中／底頭像；三筆與展開清單。
- footer 與專案選項不只 DOM 存在，還要實際 hit-test 與點擊。
- hover/focus 展開與退出、滾動兩方向、箭頭圓角提早關閉。
- 長 session/project 名稱與長短句不拉寬氣泡、不擠走 footer。
- 控制瀏覽器結果與實際 Desktop 驗收分開記錄；不得將此清單稱為完成證據。
