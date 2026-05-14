# asgard-sdk-nodejs

Node.js / TypeScript SDK for Asgard EdgeServer.

> 繁體中文版：[README.zh-TW.md](README.zh-TW.md)

## Table of Contents

- [Installation](#installation)
- [BotProviderClient](#botproviderclient)
- [Streaming (SSE)](#streaming-sse)
- [SendMessage (REST)](#sendmessage-rest)
- [UploadBlob](#uploadblob)
- [TriggerJSON](#triggerjson)
- [TriggerForm](#triggerform)
- [Sandbox operations](#sandbox-operations)
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
- [Custom headers and timeout](#custom-headers-and-timeout)
- [Error handling](#error-handling)
- [License](#license)

## Installation

Requires Node.js 18+ (uses the global `fetch` and `AbortSignal.timeout`).

```bash
npm install @asgard-js/nodejs
```

## BotProviderClient

`BotProviderClient` is the single interface for all bot-provider APIs: streaming, messaging, blob upload, function triggers, and sandbox operations.

```typescript
import { BotProviderClient } from '@asgard-js/nodejs';

const client = new BotProviderClient({
  edgeServerHost: 'https://api.asgard-ai.com',
  namespace: 'default',         // namespace
  botProviderName: 'my-bot',    // bot provider name
  botProviderApiKey: 'your-api-key',
});
```

## Streaming (SSE)

The most common usage — stream bot responses event by event:

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

Each enum-style type (`SseEventType`, `PostBackAction`, `FileType`, `ToolCallConsentResult`, `MessageTemplateType`, `MessageTemplateActionType`) has matching `SseEventType*` / `PostBackAction*` / etc. constants exported alongside the type — prefer those over inline string literals.

The streamer also exposes a pull-based API (`next()` / `current()` / `err()`) if you prefer not to use `for await`.

## SendMessage (REST)

Synchronous message — waits for the full reply:

```typescript
const reply = await client.sendMessage(message);
for (const m of reply.messages) {
  console.log(m.text);
}
```

Pass `MessageRequestOptions` to enable debug mode or set a user identity hint:

```typescript
import { MessageRequestOptions } from '@asgard-js/nodejs';

const opts: MessageRequestOptions = {
  isDebug: true,
  userIdentityHint: 'user-123',  // forwarded as X-ASGARD-USER-IDENTITY-HINT (max 128 chars)
};
const reply = await client.sendMessage(message, opts);
```

## UploadBlob

Upload a file to attach to subsequent messages via `blobIds`:

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
  text: 'Please process this invoice',
  action: PostBackActionNone,
  blobIds: [blob.blobId],
};
```

## TriggerJSON

One-shot JSON trigger — no conversation state:

```typescript
const result = await client.triggerJson({
  event: 'order.created',
  orderId: 'ORD-001',
});
console.log(result);
```

## TriggerForm

Form trigger with an optional file attachment:

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

To trigger without a file, omit the second argument:

```typescript
const result = await client.triggerForm({ type: 'invoice' });
```

## Sandbox operations

`BotProviderClient` also exposes the sandbox endpoints. All five methods take the sandbox name (returned by your provisioning flow) as the first argument.

### generateSandboxEditorOpenUrl

Request a one-time URL that opens the sandbox in the editor:

```typescript
const openUrl = await client.generateSandboxEditorOpenUrl('sbx-1');
console.log(openUrl);
```

### sandboxFsList

List directory contents inside the sandbox:

```typescript
const result = await client.sandboxFsList('sbx-1', '/work');
for (const entry of result.entries) {
  console.log(`${entry.name}  dir=${entry.isDir}  size=${entry.sizeBytes}`);
}
```

### sandboxFsRead

Read a sandbox file as raw bytes. The returned `meta` carries `totalBytes` and `truncated` (from response headers):

```typescript
const { data, meta } = await client.sandboxFsRead('sbx-1', '/work/report.csv');
console.log(`read ${data.length} of ${meta.totalBytes} bytes, truncated=${meta.truncated}`);
console.log(data.toString('utf8'));
```

Read a slice with optional offset and limit (bytes):

```typescript
const { data } = await client.sandboxFsRead('sbx-1', '/work/report.csv', {
  offsetBytes: 1024,
  limitBytes: 4096,
});
```

### sandboxFsWrite

Upload a file into the sandbox (multipart):

```typescript
import { createReadStream } from 'node:fs';

const stream = createReadStream('report.csv');
const result = await client.sandboxFsWrite(
  'sbx-1',
  '/work/report.csv',
  { stream, filename: 'report.csv' },
  { mode: 0o644, createOnly: false },
);
console.log(`wrote ${result.bytesWritten} bytes`);
```

`mode` and `createOnly` are optional — omit them to use the server defaults.

### sandboxHeartbeat

Extend the sandbox lease. Returns the new shutdown deadline:

```typescript
const { shutdownAt } = await client.sandboxHeartbeat('sbx-1');
console.log(`sandbox will shut down at ${shutdownAt}`);
```

## SourceSetClient

`SourceSetClient` is the interface for SourceSet volume operations.

```typescript
import { SourceSetClient } from '@asgard-js/nodejs';

const ss = new SourceSetClient({
  edgeServerHost: 'https://api.asgard-ai.com',
  namespace: 'default',         // namespace
  sourceSetName: 'my-sourceset',// source set name
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

Pagination is optional:

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

Read a slice with optional offset and limit (bytes):

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
console.log(`wrote ${result.bytesWritten} bytes`);
```

### makeDirectory

```typescript
await ss.makeDirectory('/data/2026/reports');
```

### remove / removeAll

```typescript
// Remove a single file or empty directory
await ss.remove('/data/old.csv');

// Recursively delete a directory and all its contents
await ss.removeAll('/data/archive');
```

## Custom headers and timeout

Both `BotProviderConfig` and `SourceSetConfig` accept additional `headers` and a `timeoutMs`:

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

The `X-API-KEY` header is always set from the config's API key field and cannot be overridden via `headers`. The `timeoutMs` default is 5 minutes. Note: `timeoutMs` is not applied to `newStreamer` — SSE connections are long-lived and must be ended with `streamer.close()`.

## Error handling

All client methods throw `AsgardError` on failure:

```typescript
import { AsgardError } from '@asgard-js/nodejs';

try {
  const reply = await client.sendMessage(message);
} catch (e) {
  if (e instanceof AsgardError) {
    console.error('HTTP status:', e.statusCode);   // e.g. 401, 500
    console.error('Error code :', e.errorCode);    // server-defined code
    console.error('Message    :', e.message);
  }
}
```

For SSE streams, errors encountered after the connection is established are surfaced via the streamer:

```typescript
// async iterator — throws AsgardError mid-iteration
try {
  for await (const event of streamer) { /* ... */ }
} catch (e) {
  if (e instanceof AsgardError) { /* handle */ }
}

// pull-based — check err() after next() returns false
if (streamer.err()) {
  console.error(streamer.err());
}
```

## License

MIT

## Release process (maintainers)

Releases are cut entirely by pushing a tag — the `Publish to npm` workflow does the rest (via npm Trusted Publishing / OIDC, no token required).

```bash
# 1. Be on a clean main with green CI
git checkout main && git pull

# 2. Bump version + create matching git tag atomically
npm version <patch|minor|major>
#    → updates package.json's "version"
#    → creates a `v<X.Y.Z>` git tag pointing at the bump commit

# 3. Push the commit and the tag together
git push --follow-tags
```

The workflow runs four guards before publishing — fail loudly if any of them trip:

1. Triggered from a tag ref (not from a branch)
2. Tag is valid [SemVer 2.0.0](https://semver.org/)
3. Tag matches `package.json` version (single source of truth — never hand-edit either; always use `npm version`)
4. That version is not already published on npm (published versions are immutable)

If everything passes, the workflow runs `npm ci && npm run build && npm test`, then `npm publish --provenance --access public` using the OIDC token. The release page on npm will show a green **Provenance** badge.
