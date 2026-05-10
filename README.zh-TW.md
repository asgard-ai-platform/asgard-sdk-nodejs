# asgard-sdk-nodejs

Asgard Edge Server BotProvider API 的 Node.js / TypeScript SDK。

## 系統需求

- Node.js 18+
- npm 8+

## 安裝

### 從 GitHub Packages 引用

在專案的 `.npmrc` 中新增 GitHub Packages registry：

```
@asgard-ai-platform:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=你的_GITHUB_TOKEN
```

然後安裝：

```bash
npm install @asgard-ai-platform/asgard-sdk-nodejs
```

認證需要具備 `read:packages` 權限的 GitHub Personal Access Token。

### 本機建置

```bash
git clone https://github.com/asgard-ai-platform/asgard-sdk-nodejs.git
cd asgard-sdk-nodejs
npm install
npm run build
```

## 快速開始

### 發送訊息（同步等待回覆）

```typescript
import { AsgardSdk, BotProviderConfig, GenericBotMessage } from '@asgard-ai-platform/asgard-sdk-nodejs';

const config: BotProviderConfig = {
  edgeServerHost: 'https://edge.example.com',
  namespace: 'my-namespace',
  botProviderName: 'my-bot',
  botProviderApiKey: 'your-api-key',
};

const client = AsgardSdk.newClient(config);

const message: GenericBotMessage = {
  customChannelId: 'channel-001',
  text: '你好！',
};

const reply = await client.sendMessage(message, null);
reply.messages?.forEach(m => console.log(m.text));
```

### SSE 串流接收事件

```typescript
const streamer = await client.newStreamer(message, null);
try {
  // 方式一：async iterator（推薦）
  for await (const event of streamer) {
    console.log(event.eventType, event.fact);
  }

  // 方式二：pull-based API
  while (streamer.next()) {
    const event = streamer.current();
    console.log(event?.eventType, event?.fact);
  }
  if (streamer.err()) throw streamer.err();
} finally {
  await streamer.close();
}
```

### 使用 BotAgent（高階介面）

```typescript
import { AsgardSdk } from '@asgard-ai-platform/asgard-sdk-nodejs';

const agent = AsgardSdk.newBotAgent(
  'https://edge.example.com',
  'my-namespace',
  'my-bot',
  'your-api-key',
);

const reply = await agent.sendMessage(message, null);
```

### 使用 FunctionAgent

```typescript
const fn = AsgardSdk.newFunctionAgent(
  'https://edge.example.com',
  'my-namespace',
  'my-function',
  'your-api-key',
);

const result = await fn.triggerJson({ key: 'value' });
```

### 上傳 Blob

```typescript
import { createReadStream } from 'fs';

const stream = createReadStream('photo.jpg');
const blob = await client.uploadBlob('channel-001', stream, 'photo.jpg', 'image/jpeg');
console.log('已上傳：', blob.blobId);
```

### 表單觸發（含檔案）

```typescript
const stream = createReadStream('data.csv');
const result = await client.triggerForm(
  { mode: 'csv' },
  stream,
  'data.csv',
  'text/csv',
);
```

## 設定

| 欄位 | 必填 | 說明 |
|------|------|------|
| `edgeServerHost` | ✓ | Edge Server 基礎 URL（結尾不含 `/`） |
| `namespace` | ✓ | Namespace 識別碼 |
| `botProviderName` | ✓ | Bot Provider 名稱 |
| `botProviderApiKey` | ✓ | API 金鑰（作為 `X-API-KEY` 標頭傳送，不可被 `headers` 覆蓋） |
| `fetchClient` | — | 自訂 fetch 函式；預設使用 Node.js 18+ 內建 `fetch` |
| `headers` | — | 額外請求標頭 |

### 每次請求選項

```typescript
import { MessageRequestOptions } from '@asgard-ai-platform/asgard-sdk-nodejs';

const opts: MessageRequestOptions = {
  isDebug: true,                        // 加入 ?is_debug=true
  userIdentityHint: 'user@example.com', // X-ASGARD-USER-IDENTITY-HINT（最多 128 字元）
};

const reply = await client.sendMessage(message, opts);
```

## 錯誤處理

所有 Client 方法在失敗時拋出 `AsgardError`：

```typescript
import { AsgardError } from '@asgard-ai-platform/asgard-sdk-nodejs';

try {
  const reply = await client.sendMessage(message, null);
} catch (e) {
  if (e instanceof AsgardError) {
    console.error('HTTP 狀態碼：', e.statusCode);   // 例如 401、500
    console.error('錯誤代碼：  ', e.errorCode);     // Server 定義的錯誤代碼
    console.error('錯誤訊息：  ', e.message);
  }
}
```

SSE 串流在連線建立後遇到的錯誤，透過 streamer 來取得：

```typescript
// async iterator：拋出 AsgardError
try {
  for await (const event of streamer) { /* ... */ }
} catch (e) {
  if (e instanceof AsgardError) { /* 處理錯誤 */ }
}

// pull-based：next() 回傳 false 後檢查 err()
if (streamer.err()) {
  console.error(streamer.err());
}
```

## 發布套件

推送 `v*` tag 時，GitHub Actions 會自動發布到 GitHub Packages：

```bash
npm version patch   # 或 minor / major
git push --follow-tags
```

若要同時發布到 npm 公開 registry，請在 GitHub Actions 手動觸發 **Publish** workflow，並勾選 **Also publish to npm public registry** 選項（需設定 `NPM_TOKEN` secret）。

## 授權

MIT
