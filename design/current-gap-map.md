# 實作缺口（本輪）

| 驗收 | 基線 | 目前限制 |
|---|---|---|
| 最近 session owner 跳轉、篩選不變 | 唯讀 | SDK `openSession` 的 explicit route 必定 `setShowAllProfiles(true)`；非 route 預設也 true，false 則切換 workspace 並設 false；沒有保留現狀的選項。不得用 DOM／私有 store 補。 |
| Home／參與專案建立及開啟 | 未接線 | `session.create` 支援明確 cwd；建立後自動開啟受同一 SDK filter 缺口阻擋。專案參與必須以 owner 的 session 關聯為證。 |
| Office 狀態／逐筆完成確認 | 未接線 | Office 自己的 `desktop/plugin.js:64-76` 用其 `ctx.rest('/state')`；SDK `src/api/plugins.ts:53-81` 明確將 ctx.rest 限制在呼叫插件自己的 namespace。SessionCrew 沒有獲授權的公開 cross-plugin/root-route 讀取；沒有實測到 completion/read contract，不可由 idle 推定完成。需可授權且明確指定 root backend 的公開狀態介面與逐 session 完成/確認生命週期。 |
| 設計／短句 | 簡化 pane | 須依封存 HTML 實作可行部分；SDK 的 80px pane 非 workspace overlay。 |
| 分層驗證 | 既有列表測試 | 控制測試、實際 loader hash 與真人 Desktop 操作需分開敘述。 |

來源：`apps/desktop/src/sdk/index.ts:957-967`、`plugin-open-session-plan.ts:35-48`，簽章 `PluginOpenSessionOptions` 未提供 preserve 選項。此為目前 checkout source 契約，非永久結論。
