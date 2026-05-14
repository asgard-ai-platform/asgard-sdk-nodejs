# asgard-sdk-nodejs

Asgard EdgeServer 的 Node.js / TypeScript SDK。

> English version: [README.md](README.md)

## 目錄

- [安裝](#安裝)
- [BotProviderClient](#botproviderclient)
- [Streaming (SSE)](#streaming-sse)
- [SendMessage (REST)](#sendmessage-rest)
- [UploadBlob](#uploadblob)
- [TriggerJSON](#triggerjson)
- [TriggerForm](#triggerform)
- [Sandbox 操作](#sandbox-操作)
  - [generateSandboxEditorOpenUrl](#generatesandboxeditoropenurl)
  - [sandboxFsList](#sandboxfslist)
  - [sandboxFsRead](#sandboxfsread)
  - [sandboxFsWrite](#sandboxfswrite)
  - [sandboxHeartbeat](#sandboxheartbeat)
- [SourceSetClient](#sourcesetclient)
  - [listDirectory](#listdirectory)
  - [stat](#stat)
  - [readFile](#readfile)
  - [writeFile](#writefile)
  - [makeDirectory](#makedirectory)
  - [remove / removeAll](#remove--removeall)
- [自訂 headers 與 timeout](#自訂-headers-與-timeout)
- [錯誤處理](#錯誤處理)
- [授權](#授權)

## 安裝

需要 Node.js 18+（使用內建的 `fetch` 與 `AbortSignal.timeout`）。

```bash
npm install @asgard-js/nodejs
```

## BotProviderClient

`BotProviderClient` 是所有 bot-provider API 的唯一入口：streaming、訊息、blob 上傳、function trigger、sandbox 操作都在這裡。

```typescript
import { BotProviderClient } from '@asgard-js/nodejs';

const client = new BotProviderClient({
  edgeServerHost: 'https://api.asgard-ai.com',
  namespace: 'default',         // namespace
  botProviderName: 'my-bot',    // bot provider 名稱
  botProviderApiKey: 'your-api-key',
});
```

## Streaming (SSE)

最常見的用法 — 以事件流的方式逐筆接收 bot 回覆：

```typescript
import {
  BotProviderClient,
  GenericBotMessage,
  PostBackActionNone,
  SseEventTypeMessageComplete,
  SseEventTypeMessageDelta,
  SseEventTypeRunError,
} from '@asgard-js/nodejs';

const client = new BotProviderClient({
  edgeServerHost: 'https://api.asgard-ai.com',
  namespace: 'default',
  botProviderName: 'my-bot',
  botProviderApiKey: 'your-api-key',
});

const message: GenericBotMessage = {
  customChannelId: 'channel-1',
  customMessageId: 'msg-1',
  text: 'Hello',
  action: PostBackActionNone,
};

const streamer = await client.newStreamer(message);
try {
  for await (const event of streamer) {
    switch (event.eventType) {
      case SseEventTypeMessageDelta:
        if (event.fact.messageDelta) {
          process.stdout.write(event.fact.messageDelta.message.text);
        }
        break;
      case SseEventTypeMessageComplete:
        process.stdout.write('\n');
        break;
      case SseEventTypeRunError:
        if (event.fact.runError) {
          console.error('run error:', event.fact.runError.error.message);
        }
        break;
    }
  }
} finally {
  await streamer.close();
}
```

每個 enum 風格的型別（`SseEventType`、`PostBackAction`、`FileType`、`ToolCallConsentResult`、`MessageTemplateType`、`MessageTemplateActionType`）都有對應的 `SseEventType*` / `PostBackAction*` 等常數一起匯出 — 建議優先使用常數而非 inline 字串。

Streamer 也提供 pull-based 介面（`next()` / `current()` / `err()`），若不想用 `for await` 可改用這套。

## SendMessage (REST)

同步呼叫 — 等待完整回覆：

```typescript
const reply = await client.sendMessage(message);
for (const m of reply.messages) {
  console.log(m.text);
}
```

透過 `MessageRequestOptions` 開啟 debug 模式或附帶 user identity hint：

```typescript
import { MessageRequestOptions } from '@asgard-js/nodejs';

const opts: MessageRequestOptions = {
  isDebug: true,
  userIdentityHint: 'user-123',  // 轉發為 X-ASGARD-USER-IDENTITY-HINT（最長 128 字）
};
const reply = await client.sendMessage(message, opts);
```

## UploadBlob

上傳檔案後，可在後續訊息以 `blobIds` 引用：

```typescript
import { createReadStream } from 'node:fs';
import { GenericBotMessage, PostBackActionNone } from '@asgard-js/nodejs';

const stream = createReadStream('invoice.pdf');
const blob = await client.uploadBlob('channel-1', {
  stream,
  filename: 'invoice.pdf',
  mime: 'application/pdf',
});

const message: GenericBotMessage = {
  customChannelId: 'channel-1',
  customMessageId: 'msg-2',
  text: '請處理這份發票',
  action: PostBackActionNone,
  blobIds: [blob.blobId],
};
```

## TriggerJSON

一次性 JSON trigger — 不維持對話狀態：

```typescript
const result = await client.triggerJson({
  event: 'order.created',
  orderId: 'ORD-001',
});
console.log(result);
```

## TriggerForm

帶選擇性檔案的 form trigger：

```typescript
import { createReadStream } from 'node:fs';

const result = await client.triggerForm(
  { type: 'invoice' },
  {
    stream: createReadStream('invoice.pdf'),
    filename: 'invoice.pdf',
    mime: 'application/pdf',
  },
);
```

不附檔案時，省略第二個參數：

```typescript
const result = await client.triggerForm({ type: 'invoice' });
```

## Sandbox 操作

`BotProviderClient` 也包含 sandbox 相關端點。下列五個方法都以 sandbox name（由你的 provisioning flow 取得）作為第一個參數。

### generateSandboxEditorOpenUrl

取得一次性 sandbox editor 開啟 URL：

```typescript
const openUrl = await client.generateSandboxEditorOpenUrl('sbx-1');
console.log(openUrl);
```

### sandboxFsList

列出 sandbox 內某目錄：

```typescript
const result = await client.sandboxFsList('sbx-1', '/work');
for (const entry of result.entries) {
  console.log(`${entry.name}  dir=${entry.isDir}  size=${entry.sizeBytes}`);
}
```

### sandboxFsRead

以 raw bytes 讀取 sandbox 檔案。回傳的 `meta` 帶有從 response header 來的 `totalBytes` 與 `truncated`：

```typescript
const { data, meta } = await client.sandboxFsRead('sbx-1', '/work/report.csv');
console.log(`讀了 ${data.length} / ${meta.totalBytes} bytes,truncated=${meta.truncated}`);
console.log(data.toString('utf8'));
```

帶 offset / limit 做切片讀取:

```typescript
const { data } = await client.sandboxFsRead('sbx-1', '/work/report.csv', {
  offsetBytes: 1024,
  limitBytes: 4096,
});
```

### sandboxFsWrite

將檔案寫入 sandbox(multipart):

```typescript
import { createReadStream } from 'node:fs';

const stream = createReadStream('report.csv');
const result = await client.sandboxFsWrite(
  'sbx-1',
  '/work/report.csv',
  { stream, filename: 'report.csv' },
  { mode: 0o644, createOnly: false },
);
console.log(`寫入 ${result.bytesWritten} bytes`);
```

`mode` 與 `createOnly` 是可選的 — 省略則使用 server 預設。

### sandboxHeartbeat

延長 sandbox lease,回傳新的關機時間:

```typescript
const { shutdownAt } = await client.sandboxHeartbeat('sbx-1');
console.log(`sandbox 將於 ${shutdownAt} 關閉`);
```

## SourceSetClient

`SourceSetClient` 對應 SourceSet volume 端點。

```typescript
import { SourceSetClient } from '@asgard-js/nodejs';

const ss = new SourceSetClient({
  edgeServerHost: 'https://api.asgard-ai.com',
  namespace: 'default',         // namespace
  sourceSetName: 'my-sourceset',// source set 名稱
  sourceSetApiKey: 'your-api-key',
});
```

### listDirectory

```typescript
const result = await ss.listDirectory('/data');
for (const entry of result.entries) {
  console.log(`${entry.name}  dir=${entry.isDir}  size=${entry.sizeBytes}`);
}
```

可選的分頁:

```typescript
const result = await ss.listDirectory('/data', { page: 1, pageSize: 50 });
```

### stat

```typescript
const info = await ss.stat('/data/report.csv');
console.log(`exists=${info.exists} size=${info.sizeBytes}`);
```

### readFile

```typescript
const data = await ss.readFile('/data/report.csv');
console.log(data.toString('utf8'));
```

帶 offset / limit 做切片讀取:

```typescript
const data = await ss.readFile('/data/report.csv', {
  offsetBytes: 1024,
  limitBytes: 4096,
});
```

### writeFile

```typescript
import { createReadStream } from 'node:fs';

const stream = createReadStream('report.csv');
const result = await ss.writeFile('/data/report.csv', {
  stream,
  filename: 'report.csv',
});
console.log(`寫入 ${result.bytesWritten} bytes`);
```

### makeDirectory

```typescript
await ss.makeDirectory('/data/2026/reports');
```

### remove / removeAll

```typescript
// 移除單一檔案或空目錄
await ss.remove('/data/old.csv');

// 遞迴刪除目錄與所有內容
await ss.removeAll('/data/archive');
```

## 自訂 headers 與 timeout

`BotProviderConfig` 與 `SourceSetConfig` 都接受額外的 `headers` 與 `timeoutMs`:

```typescript
const client = new BotProviderClient({
  edgeServerHost: 'https://api.asgard-ai.com',
  namespace: 'default',
  botProviderName: 'my-bot',
  botProviderApiKey: 'your-api-key',
  headers: { 'X-Request-Source': 'my-service' },
  timeoutMs: 60_000,
});

const ss = new SourceSetClient({
  edgeServerHost: 'https://api.asgard-ai.com',
  namespace: 'default',
  sourceSetName: 'my-sourceset',
  sourceSetApiKey: 'your-api-key',
  timeoutMs: 120_000,
});
```

`X-API-KEY` header 永遠取自 config 對應的 API key 欄位,無法用 `headers` 覆寫。`timeoutMs` 預設 5 分鐘。注意:`newStreamer` 不套用 `timeoutMs` — SSE 連線是長連線,必須用 `streamer.close()` 結束。

## 錯誤處理

所有 client 方法在失敗時都會拋出 `AsgardError`:

```typescript
import { AsgardError } from '@asgard-js/nodejs';

try {
  const reply = await client.sendMessage(message);
} catch (e) {
  if (e instanceof AsgardError) {
    console.error('HTTP status:', e.statusCode);   // 例如 401, 500
    console.error('Error code :', e.errorCode);    // server 端定義的代碼
    console.error('Message    :', e.message);
  }
}
```

對於 SSE 串流,連線建立後發生的錯誤會由 streamer 表面化:

```typescript
// async iterator — 迭代過程中拋出 AsgardError
try {
  for await (const event of streamer) { /* ... */ }
} catch (e) {
  if (e instanceof AsgardError) { /* handle */ }
}

// pull-based — next() 回 false 後檢查 err()
if (streamer.err()) {
  console.error(streamer.err());
}
```

## 授權

MIT

## 發版流程（維護者）

發版完全靠推 tag 觸發 — `Publish to npm` workflow 走 npm Trusted Publishing (OIDC)，不需要 token。

```bash
# 1. main 乾淨且 CI 綠燈
git checkout main && git pull

# 2. Bump 版號 + 同步建 git tag
npm version <patch|minor|major>
#    → 更新 package.json 的 "version"
#    → 建立 `v<X.Y.Z>` git tag 指向這次 bump commit

# 3. 一併推送 commit 與 tag
git push --follow-tags
```

Workflow 在 publish 前會跑四個 guard，任一失敗就中止：

1. 必須是 tag ref（不能從 branch 觸發）
2. tag 是合法的 [SemVer 2.0.0](https://semver.org/)
3. tag 與 `package.json` 版本一致（package.json 是唯一真實來源 — 兩邊都不要手改、永遠透過 `npm version`）
4. 該版本在 npm 上尚未發佈（已發佈的版本不可變更）

全部通過後，workflow 跑 `npm ci && npm run build && npm test`，再用 OIDC token `npm publish --provenance --access public`。發佈成功後 npm 頁面會出現 **Provenance** 綠勾。
