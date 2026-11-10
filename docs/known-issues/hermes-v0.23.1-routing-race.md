# Hermes v0.23.1：shared-primary 等待期間切換來源會錯送請求

## 狀態與適用版本

**已在乾淨官方來源的 selected-function integration 重現 connection A → B 錯送；尚未上報上游、未修 Hermes core，也不能據此宣告 SessionCrew 的支持下限。**

- 官方 release：[v0.23.1](https://github.com/NousResearch/hermes-agent/releases/tag/v0.23.1)。本紀錄固定 revision 為 [`3b421578588243f920886e6fe79a6faa87ea026e`](https://github.com/NousResearch/hermes-agent/tree/3b421578588243f920886e6fe79a6faa87ea026e)，不是浮動 main 或本機 dirty SDK。
- SessionCrew 修補基線為 `c0454fd2f327c1b33b021c8e50294a8800ad7f98`；插件側狀態資料庫、請求優先序及公開 descriptor 測試的修補，不會修復以下宿主 race。
- 證據是官方函式接到**模擬 WebSocket 的實際 `send` 呼叫**，不是完整 release host 或 live Desktop 驗收。未實際讀取帳戶歷史、建立 session／project、呼叫 LLM 或發送寫入 RPC。

## 最小觸發步驟

以下 A、B、`alpha` 與 `.fixture.invalid` 網址全是合成 fixture 身分，並非真實帳戶或服務。

1. 建立含 local、遠端 A、遠端 B 的合成 connection registry；A/B roster 都含 `alpha`。registry 持久 primary 保持 local，renderer window 的目前 primary 設為 A/default，兩種 primary 身分分開。
2. 使用公開 `host.requestProfile` 直接委派的真實 `requestPluginProfile` 函式，傳入完整 owner descriptor：

   ```json
   {"connectionId":"A","mode":"remote","profile":"alpha","targetProfile":"alpha"}
   ```

   呼叫 `session.list`，params 為 `{"limit":200,"scope":"stored"}`。不 mock `requestGatewayForAgent` 或最終 gateway。
3. 讓 A/alpha 的真實 registry 解算停在遠端 readiness HTTP 等待；`ridesPrimaryBackend` 已在 await 前確認 connection A 等於當時 window primary。
4. 控制組保持 A/default。重現組在等待期間透過官方 `setPrimaryGateway` 與 `setPrimaryGatewayConnectionId` 將 window primary 換成 B/default。
5. 完成 A readiness，讓原請求繼續 dispatch；記錄真實 serializer 交給模擬 WebSocket `send` 的 URL 與 frame，斷言 owner 必須仍是 A。

### 預期與實際

預期：原請求仍送往有效的 A owner socket，或在來源變更時拒絕／重新解析；不能默默使用替換後的 B socket。

| 情境 | `WebSocket.send` 的實際 URL | owner 安全斷言 |
| --- | --- | --- |
| stable：等待期間保持 A/default | `wss://a.fixture.invalid/api/ws` | exit **0** |
| rehome：等待期間改為 B/default | `wss://b.fixture.invalid/api/ws` | exit **1** |

兩組送出的序列化 frame 相同：

```json
{"jsonrpc":"2.0","id":2,"method":"session.list","params":{"limit":200,"scope":"stored","profile":"alpha"}}
```

錯的是 **connection**，不是缺少 `profile`。同名 `alpha` 在兩個來源都存在，故錯送可能表面成功卻顯示另一來源的歷史；本 fixture 只證明請求送往錯誤 URL，沒有聲稱真實伺服器已回傳另一帳戶資料，也沒有證明 mutation 的實際影響。

## 根因與固定來源

所有連結都固定同一官方 SHA：

1. [`ridesPrimaryBackend`，gateway.ts:364–396](https://github.com/NousResearch/hermes-agent/blob/3b421578588243f920886e6fe79a6faa87ea026e/apps/desktop/src/store/gateway.ts#L364-L396)：await 前核對 `connectionId === primaryConnectionId()`，等待 `getConnectionFor`；await 後只看 resolved descriptor 的 shared flags，未再次驗證 window primary。
2. [`requestGatewayForAgent`，gateway.ts:1180–1183](https://github.com/NousResearch/hermes-agent/blob/3b421578588243f920886e6fe79a6faa87ea026e/apps/desktop/src/store/gateway.ts#L1180-L1183)：判定 shared-primary 後呼叫 `requestOnPrimaryGateway`。雖在 await 前捕捉 `primaryIdentity()`，該值只交給 `notePrimaryRider`。
3. [`notePrimaryRider`，gateway-shared-route.ts:49–56](https://github.com/NousResearch/hermes-agent/blob/3b421578588243f920886e6fe79a6faa87ea026e/apps/desktop/src/store/gateway-shared-route.ts#L49-L56)：只記錄 hint，未綁定送出 socket 或驗證當前 identity。
4. [`requestOnPrimaryGateway`，gateway.ts:412–426](https://github.com/NousResearch/hermes-agent/blob/3b421578588243f920886e6fe79a6faa87ea026e/apps/desktop/src/store/gateway.ts#L412-L426)：送出時才讀取當下 `g.primaryGateway`，因此使用 replacement B。

fixture 使用原樣的 [primary setters，gateway.ts:266–314](https://github.com/NousResearch/hermes-agent/blob/3b421578588243f920886e6fe79a6faa87ea026e/apps/desktop/src/store/gateway.ts#L266-L314)，不是私自改寫 routing 回傳值。公開入口的直接委派可核對 [sdk/index.ts:1384–1390](https://github.com/NousResearch/hermes-agent/blob/3b421578588243f920886e6fe79a6faa87ea026e/apps/desktop/src/sdk/index.ts#L1384-L1390) 與 [sdk/profile-request.ts](https://github.com/NousResearch/hermes-agent/blob/3b421578588243f920886e6fe79a6faa87ea026e/apps/desktop/src/sdk/profile-request.ts)。

## 證據強度與重建條件

實跑鏈為 `requestPluginProfile` → `requestGatewayForAgent` / `ridesPrimaryBackend` → 原樣 `hermes:connection:for` IPC callback → `connectDesktopProfileRoute` → `BackendDialClaims` → `ensureRegistryBackend` → registry reuse/SSH-shared guards → `connectRegistryBackend` → `buildRemoteConnection` → `waitForRemoteHermes` → shared-primary dispatch → `HermesGateway.request` → `JsonRpcGatewayClient` / `JsonRpcRequestChannel` → 模擬 WebSocket `send`。

- registry 使用官方 `createGatewayConnectionsStore` / `normalizeRegistry`，只讀合成 scratch registry，seed 標為 imported，沒有讀取使用者 token store。
- 以 TypeScript AST 擷取完整、未改寫的官方函式／宣告，esbuild 只轉譯語法；來源逐檔 SHA-256 與固定 revision tree 的 Git blob SHA-1 均有核對。primary atom、setters、scope key、shared-route、timeout 與 request-scope publication 也來自該 SHA。
- readiness HTTP 與 WebSocket transport 為 deterministic fixture；IPC 在同程序註冊／呼叫，保留原 callback，**未啟動 Electron**。沒有 window chrome instance，sender undefined／fallback null，走官方允許的無 window 分支。
- 沒有執行 Electron main module 整體 startup；這是 **selected-function integration、legacy wire、非 live**，不是完整 release host、真實 Electron IPC 或 canonical/native transport 驗收。

原執行證據保存在維護者本機 scratch 的 `session-crew-routing-final/`：`REPORT.md`、`stable-result.json`、`routing-result.json`、`verification.json`、`logs/stable.txt`、`logs/rehome.txt`、`routing-fixture.mjs` 與 `run.py`。scratch 可能清理，且未隨 repo 發布；本頁保留版本、輸入、交錯步驟、實際 frame、斷言結果與根因，不要求讀者具有該私人路徑。重建 fixture 須使用固定 SHA、上述完整真實函式鏈與既有 TypeScript/esbuild/nanostores 依賴，控制 readiness 等待及 primary setters；不能以 fake resolver 或 fake 最終 gateway 取代鏈中路由來宣稱重現。

證據識別用 SHA-256：

| 檔案 | SHA-256 |
| --- | --- |
| `routing-fixture.mjs` | `ff4c820497f971922b6af1918c7cfd8f3457a238fd715d16fd9ba2771f61fd63` |
| 官方 `store/gateway.ts` | `8ed2e259cd85ec0c917b1b9f0a7c1c3211e1e17a96382b03e54797dfe643d209` |
| 官方 `store/gateway-shared-route.ts` | `5fdfb53a8c771ed38acf3abe793752c551478ab8c2aec263ec384f876dc092ef` |
| 官方 `sdk/profile-request.ts` | `a26328f0d9da375fd3bea1aeb04aa64743ca2dcc1c5b114a69cae809c1471d98` |

`run.py` 的 exit 0 只表示「stable 控制成功、rehome 的 red regression 如預期失敗」；**不是相容性 PASS**。rehome 的獨立 exit 1 不得改寫成成功。

## 與舊 gate 的區別、剩餘缺口

[`tests/sdk-upstream-baseline.mjs`](../../tests/sdk-upstream-baseline.mjs) 保留的是 adapter 是否轉交 `options.targetProfile` 的舊斷言；該測試的最後 gateway 是 fake，因此它單獨失敗仍**不能證明 wire 錯送**。本頁是後續不同層級的證據：使用相同 profile/backend 名稱及真實路由鏈，重現等待期間 connection 改變造成的錯送，不依賴舊 options 形狀斷言。完整測試邊界見 [COMPATIBILITY.md](../../tests/COMPATIBILITY.md)。

本輪依錯送失敗停止，尚未完成 Desktop/backend 異名、secondary、其他 route-change 的完整矩陣，亦未完成全部公開 exports、Python backend import／掛載契約或完整官方 release 驗證。未追查最早可用版本；沒有 live、validator 或 catalog 審查結果。`plugin.yaml` 不變，**v0.23.1 不能作本案 owner-routing 保證下的無條件支持 floor**。

後續最小方向是由上游在 await 前綁定 socket 與 connection 身分，await 後來源變更時拒絕、重新解析或安全使用仍有效的原 owner socket；本 repo 沒有實作或驗收這項核心修正。不以私有 API、monkeypatch 或切換 active owner 繞過。

此紀錄僅留在 repo，**未發布 issue／PR，未修 core／SDK，未安裝、部署或重啟服務**。對外回報需另獲授權；拿到修正後的固定官方 revision，須先重跑同一 red regression，再完成剩餘契約矩陣，才可提出真實的 `requires_hermes` 下限。
