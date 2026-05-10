# asgard-sdk-nodejs

Node.js / TypeScript SDK for the Asgard Edge Server BotProvider API.

## Requirements

- Node.js 18+
- npm 8+

## Installation

### From GitHub Packages

Add the GitHub Packages registry to your project's `.npmrc`:

```
@asgard-ai-platform:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

Then install:

```bash
npm install @asgard-ai-platform/asgard-sdk-nodejs
```

Authentication requires a GitHub personal access token with `read:packages` scope.

### Build locally

```bash
git clone https://github.com/asgard-ai-platform/asgard-sdk-nodejs.git
cd asgard-sdk-nodejs
npm install
npm run build
```

## Quick Start

### Send a message (blocking)

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
  text: 'Hello!',
};

const reply = await client.sendMessage(message, null);
reply.messages?.forEach(m => console.log(m.text));
```

### Stream events (SSE)

```typescript
const streamer = await client.newStreamer(message, null);
try {
  // Option 1: async iterator (recommended)
  for await (const event of streamer) {
    console.log(event.eventType, event.fact);
  }

  // Option 2: pull-based API
  while (streamer.next()) {
    const event = streamer.current();
    console.log(event?.eventType, event?.fact);
  }
  if (streamer.err()) throw streamer.err();
} finally {
  await streamer.close();
}
```

### Using BotAgent (higher-level interface)

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

### Using FunctionAgent

```typescript
const fn = AsgardSdk.newFunctionAgent(
  'https://edge.example.com',
  'my-namespace',
  'my-function',
  'your-api-key',
);

const result = await fn.triggerJson({ key: 'value' });
```

### Upload a blob

```typescript
import { createReadStream } from 'fs';

const stream = createReadStream('photo.jpg');
const blob = await client.uploadBlob('channel-001', stream, 'photo.jpg', 'image/jpeg');
console.log('Uploaded:', blob.blobId);
```

### Upload a form with file

```typescript
const stream = createReadStream('data.csv');
const result = await client.triggerForm(
  { mode: 'csv' },
  stream,
  'data.csv',
  'text/csv',
);
```

## Configuration

| Field | Required | Description |
|-------|----------|-------------|
| `edgeServerHost` | ✓ | Edge Server base URL (no trailing slash) |
| `namespace` | ✓ | Namespace identifier |
| `botProviderName` | ✓ | Bot provider name |
| `botProviderApiKey` | ✓ | API key (sent as `X-API-KEY` header) |
| `fetchClient` | — | Custom fetch function; defaults to global `fetch` (Node.js 18+) |
| `headers` | — | Extra request headers (cannot override `X-API-KEY`) |

### Per-request options

```typescript
import { MessageRequestOptions } from '@asgard-ai-platform/asgard-sdk-nodejs';

const opts: MessageRequestOptions = {
  isDebug: true,                      // appends ?is_debug=true
  userIdentityHint: 'user@example.com', // X-ASGARD-USER-IDENTITY-HINT (max 128 chars)
};

const reply = await client.sendMessage(message, opts);
```

## Error Handling

All client methods throw `AsgardError` on failure:

```typescript
import { AsgardError } from '@asgard-ai-platform/asgard-sdk-nodejs';

try {
  const reply = await client.sendMessage(message, null);
} catch (e) {
  if (e instanceof AsgardError) {
    console.error('HTTP status :', e.statusCode);   // e.g. 401, 500
    console.error('Error code  :', e.errorCode);    // server-defined code
    console.error('Message     :', e.message);
  }
}
```

For SSE streams, errors encountered after the connection is established are surfaced via the streamer:

```typescript
// async iterator: throws AsgardError
try {
  for await (const event of streamer) { /* ... */ }
} catch (e) {
  if (e instanceof AsgardError) { /* handle */ }
}

// pull-based: check err() after next() returns false
if (streamer.err()) {
  console.error(streamer.err());
}
```

## Publishing

The package is published automatically to GitHub Packages when a `v*` tag is pushed:

```bash
npm version patch   # or minor / major
git push --follow-tags
```

To also publish to the npm public registry, trigger the `Publish` workflow manually in GitHub Actions and enable the **Also publish to npm public registry** option (requires `NPM_TOKEN` secret).

## License

MIT
