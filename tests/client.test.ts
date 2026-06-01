import { Readable } from 'stream';
import { BotProviderClient } from '../src/client.js';
import { BotProviderConfig } from '../src/config.js';
import { AsgardError } from '../src/error.js';
import { GenericBotMessage, GenericBotReply } from '../src/models.js';
import { BotProviderStreamer } from '../src/streamer.js';

const config: BotProviderConfig = {
  edgeServerHost: 'https://edge.example.com',
  namespace: 'my-ns',
  botProviderName: 'my-bot',
  botProviderApiKey: 'test-key',
};

const client = new BotProviderClient(config);

const testMessage: GenericBotMessage = {
  customChannelId: 'ch1',
  customMessageId: 'msg1',
  action: 'NONE',
};

const testReply: GenericBotReply = {
  requestId: 'r1',
  namespace: 'my-ns',
  botProviderName: 'my-bot',
  customChannelId: 'ch1',
  messages: [],
  errorDetail: null,
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({ isSuccess: true, data, error: null, errorCode: null }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}

function errorResponse(error: string, status: number): Response {
  return new Response(
    JSON.stringify({ isSuccess: false, data: null, error, errorCode: 'ERR' }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}

describe('BotProviderClient', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ─── sendMessage ──────────────────────────────────────────────────────────

  describe('sendMessage', () => {
    it('sends POST to /message with X-API-KEY and Content-Type', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(testReply));

      await client.sendMessage(testMessage);

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(url).toBe(
        'https://edge.example.com/ns/my-ns/bot-provider/my-bot/message',
      );
      expect(init.method).toBe('POST');
      expect(headers['X-API-KEY']).toBe('test-key');
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('appends ?is_debug=true when isDebug is true', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(testReply));

      await client.sendMessage(testMessage, { isDebug: true });

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('?is_debug=true');
    });

    it('does NOT append bypass_tool_call_consent even when bypassToolCallConsent is true', async () => {
      // bypassToolCallConsent is SSE-only — sendMessage must not forward this param
      fetchSpy.mockResolvedValue(jsonResponse(testReply));

      await client.sendMessage(testMessage, { bypassToolCallConsent: true });

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).not.toContain('bypass_tool_call_consent');
    });

    it('sets X-ASGARD-USER-IDENTITY-HINT when provided', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(testReply));

      await client.sendMessage(testMessage, { userIdentityHint: 'user-123' });

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['X-ASGARD-USER-IDENTITY-HINT']).toBe('user-123');
    });

    it('does not set X-ASGARD-USER-IDENTITY-HINT when not provided', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(testReply));

      await client.sendMessage(testMessage);

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['X-ASGARD-USER-IDENTITY-HINT']).toBeUndefined();
    });

    it('URL-encodes namespace and botProviderName', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(testReply));
      const specialClient = new BotProviderClient({
        ...config,
        namespace: 'my ns',
        botProviderName: 'my/bot',
      });

      await specialClient.sendMessage(testMessage);

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/ns/my%20ns/bot-provider/my%2Fbot/');
    });

    it('throws AsgardError on HTTP 401', async () => {
      fetchSpy.mockResolvedValue(errorResponse('Unauthorized', 401));

      await expect(client.sendMessage(testMessage)).rejects.toBeInstanceOf(
        AsgardError,
      );
    });

    it('AsgardError carries statusCode', async () => {
      fetchSpy.mockResolvedValue(errorResponse('Forbidden', 403));

      try {
        await client.sendMessage(testMessage);
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AsgardError);
        expect((err as AsgardError).statusCode).toBe(403);
      }
    });

    it('config.headers does not override X-API-KEY', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(testReply));
      const clientWithHeaders = new BotProviderClient({
        ...config,
        headers: { 'X-API-KEY': 'SHOULD-NOT-WIN' },
      });

      await clientWithHeaders.sendMessage(testMessage);

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['X-API-KEY']).toBe('test-key');
    });

    it('serialises the message body as JSON', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(testReply));

      await client.sendMessage(testMessage);

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as GenericBotMessage;
      expect(body.customChannelId).toBe('ch1');
      expect(body.customMessageId).toBe('msg1');
      expect(body.action).toBe('NONE');
    });
  });

  // ─── newStreamer ───────────────────────────────────────────────────────────

  describe('newStreamer', () => {
    it('sends POST to /message/sse with X-API-KEY', async () => {
      const body = new ReadableStream<Uint8Array>({
        start(c) { c.close(); },
      });
      fetchSpy.mockResolvedValue(new Response(body, { status: 200 }));

      const streamer = await client.newStreamer(testMessage);

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(url).toContain('/message/sse');
      expect(init.method).toBe('POST');
      expect(headers['X-API-KEY']).toBe('test-key');
      expect(streamer).toBeInstanceOf(BotProviderStreamer);
    });

    it('does not apply AbortSignal to SSE fetch (long-lived connection)', async () => {
      const body = new ReadableStream<Uint8Array>({ start(c) { c.close(); } });
      fetchSpy.mockResolvedValue(new Response(body, { status: 200 }));

      await client.newStreamer(testMessage);

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(init.signal).toBeUndefined();
    });

    it('throws AsgardError when server returns non-2xx', async () => {
      fetchSpy.mockResolvedValue(new Response('Unauthorized', { status: 401 }));

      await expect(client.newStreamer(testMessage)).rejects.toBeInstanceOf(
        AsgardError,
      );
    });

    it('AsgardError statusCode matches HTTP status', async () => {
      fetchSpy.mockResolvedValue(new Response('Not Found', { status: 404 }));

      try {
        await client.newStreamer(testMessage);
        fail('should have thrown');
      } catch (err) {
        expect((err as AsgardError).statusCode).toBe(404);
      }
    });

    it('appends ?is_debug=true when isDebug is true', async () => {
      const body = new ReadableStream<Uint8Array>({ start(c) { c.close(); } });
      fetchSpy.mockResolvedValue(new Response(body, { status: 200 }));

      await client.newStreamer(testMessage, { isDebug: true });

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('is_debug=true');
    });

    it('appends ?bypass_tool_call_consent=true when bypassToolCallConsent is true', async () => {
      const body = new ReadableStream<Uint8Array>({ start(c) { c.close(); } });
      fetchSpy.mockResolvedValue(new Response(body, { status: 200 }));

      await client.newStreamer(testMessage, { bypassToolCallConsent: true });

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('bypass_tool_call_consent=true');
    });

    it('appends both is_debug and bypass_tool_call_consent when both are true', async () => {
      const body = new ReadableStream<Uint8Array>({ start(c) { c.close(); } });
      fetchSpy.mockResolvedValue(new Response(body, { status: 200 }));

      await client.newStreamer(testMessage, { isDebug: true, bypassToolCallConsent: true });

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('is_debug=true');
      expect(url).toContain('bypass_tool_call_consent=true');
    });
  });

  // ─── triggerJson ──────────────────────────────────────────────────────────

  describe('triggerJson', () => {
    it('sends POST to /json with correct headers and body', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ result: 'ok' }));

      await client.triggerJson({ foo: 'bar', num: 42 });

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(url).toContain('/json');
      expect(headers['X-API-KEY']).toBe('test-key');
      expect(headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(init.body as string)).toEqual({ foo: 'bar', num: 42 });
    });

    it('returns the data payload', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ answer: 42 }));

      const result = await client.triggerJson({});
      expect(result).toEqual({ answer: 42 });
    });
  });

  // ─── triggerForm ──────────────────────────────────────────────────────────

  describe('triggerForm', () => {
    it('sends POST to /form with multipart/form-data content-type', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(null));

      await client.triggerForm({ key: 'value' });

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(url).toContain('/form');
      expect(headers['X-API-KEY']).toBe('test-key');
      expect(headers['content-type']).toMatch(/multipart\/form-data/);
    });

    it('body is a Buffer', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(null));

      await client.triggerForm({ foo: 'bar' });

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(init.body).toBeInstanceOf(Buffer);
    });

    it('includes json payload and file when file is provided', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(null));
      const stream = Readable.from(Buffer.from('file-content'));

      await client.triggerForm({ data: 1 }, { stream, filename: 'f.txt', mime: 'text/plain' });

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const bodyStr = (init.body as Buffer).toString();
      expect(bodyStr).toContain('"data":1');   // json field
      expect(bodyStr).toContain('file-content'); // file part
    });
  });

  // ─── uploadBlob ───────────────────────────────────────────────────────────

  describe('uploadBlob', () => {
    const blobData = [
      {
        channelId: 'ch1',
        blobId: 'b1',
        fileType: 'IMAGE',
        fileName: 'test.png',
        size: 512,
        mime: 'image/png',
      },
    ];

    it('sends POST to /blob (no channelId in URL)', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(blobData));
      const stream = Readable.from(Buffer.from('img'));

      await client.uploadBlob('my-channel', { stream, filename: 'test.png' });

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toMatch(/\/blob$/);   // ends with /blob, no additional path segment
      expect(url).not.toContain('/blob/');
    });

    it('includes customChannelId as multipart field', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(blobData));
      const stream = Readable.from(Buffer.from('data'));

      await client.uploadBlob('my-channel', { stream, filename: 'f.bin' });

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const bodyStr = (init.body as Buffer).toString();
      expect(bodyStr).toContain('my-channel');
    });

    it('returns first Blob from the array response', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(blobData));
      const stream = Readable.from(Buffer.from('data'));

      const blob = await client.uploadBlob('ch1', { stream, filename: 'f.png' });

      expect(blob.blobId).toBe('b1');
      expect(blob.fileType).toBe('IMAGE');
    });

    it('throws AsgardError when response blob array is empty', async () => {
      fetchSpy.mockResolvedValue(jsonResponse([]));
      const stream = Readable.from(Buffer.from('data'));

      await expect(
        client.uploadBlob('ch1', { stream, filename: 'f.png' }),
      ).rejects.toBeInstanceOf(AsgardError);
    });
  });

  // ─── generateSandboxEditorOpenUrl ─────────────────────────────────────────

  describe('generateSandboxEditorOpenUrl', () => {
    it('POSTs to /sandbox/{name}/editor/open-url and returns openURL', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ openURL: 'https://editor.example.com/abc' }));

      const url = await client.generateSandboxEditorOpenUrl('sbx-1');

      const [reqUrl, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(reqUrl).toBe(
        'https://edge.example.com/ns/my-ns/bot-provider/my-bot/sandbox/sbx-1/editor/open-url',
      );
      expect(init.method).toBe('POST');
      expect(url).toBe('https://editor.example.com/abc');
    });

    it('throws AsgardError when openURL is missing from response', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({}));

      await expect(
        client.generateSandboxEditorOpenUrl('sbx-1'),
      ).rejects.toBeInstanceOf(AsgardError);
    });

    it('URL-encodes sandbox name', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ openURL: 'x' }));

      await client.generateSandboxEditorOpenUrl('sbx/special name');

      const [reqUrl] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(reqUrl).toContain('/sandbox/sbx%2Fspecial%20name/');
    });
  });

  // ─── sandboxFsList ────────────────────────────────────────────────────────

  describe('sandboxFsList', () => {
    it('GETs /sandbox/{name}/fs/list?path=...', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({ entries: [], truncated: false }),
      );

      await client.sandboxFsList('sbx-1', '/work');

      const [reqUrl, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(reqUrl).toBe(
        'https://edge.example.com/ns/my-ns/bot-provider/my-bot/sandbox/sbx-1/fs/list?path=%2Fwork',
      );
      expect(init.method).toBe('GET');
    });

    it('returns decoded result', async () => {
      const result = {
        entries: [
          { name: 'a.txt', isDir: false, sizeBytes: 10, mtimeUnix: 1, mode: 0o644 },
        ],
        truncated: true,
      };
      fetchSpy.mockResolvedValue(jsonResponse(result));

      const got = await client.sandboxFsList('sbx-1', '/');
      expect(got).toEqual(result);
    });
  });

  // ─── sandboxFsRead ────────────────────────────────────────────────────────

  describe('sandboxFsRead', () => {
    it('GETs /sandbox/{name}/fs/file and returns body + meta from headers', async () => {
      fetchSpy.mockResolvedValue(
        new Response(Buffer.from('hello world'), {
          status: 200,
          headers: {
            'X-Total-Bytes': '11',
            'X-Truncated': 'false',
          },
        }),
      );

      const { data, meta } = await client.sandboxFsRead('sbx-1', '/file.txt');

      const [reqUrl, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(reqUrl).toBe(
        'https://edge.example.com/ns/my-ns/bot-provider/my-bot/sandbox/sbx-1/fs/file?path=%2Ffile.txt',
      );
      expect(init.method).toBe('GET');
      expect(data.toString()).toBe('hello world');
      expect(meta).toEqual({ totalBytes: 11, truncated: false });
    });

    it('passes offset_bytes and limit_bytes when provided', async () => {
      fetchSpy.mockResolvedValue(
        new Response(Buffer.from(''), {
          status: 200,
          headers: { 'X-Total-Bytes': '0', 'X-Truncated': 'false' },
        }),
      );

      await client.sandboxFsRead('sbx-1', '/x', { offsetBytes: 100, limitBytes: 200 });

      const [reqUrl] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(reqUrl).toContain('offset_bytes=100');
      expect(reqUrl).toContain('limit_bytes=200');
    });

    it('truncated flag is true when X-Truncated header is "true"', async () => {
      fetchSpy.mockResolvedValue(
        new Response(Buffer.from('partial'), {
          status: 200,
          headers: { 'X-Total-Bytes': '999', 'X-Truncated': 'true' },
        }),
      );

      const { meta } = await client.sandboxFsRead('sbx-1', '/x');
      expect(meta.truncated).toBe(true);
      expect(meta.totalBytes).toBe(999);
    });

    it('throws AsgardError with server error envelope on non-2xx', async () => {
      fetchSpy.mockResolvedValue(
        new Response(
          JSON.stringify({ isSuccess: false, data: null, error: 'not found', errorCode: 'NOT_FOUND' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      try {
        await client.sandboxFsRead('sbx-1', '/missing');
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AsgardError);
        expect((err as AsgardError).statusCode).toBe(404);
        expect((err as AsgardError).errorCode).toBe('NOT_FOUND');
      }
    });

    it('throws AsgardError with generic message when error body is not JSON', async () => {
      fetchSpy.mockResolvedValue(new Response('plain text', { status: 500 }));

      try {
        await client.sandboxFsRead('sbx-1', '/x');
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AsgardError);
        expect((err as AsgardError).statusCode).toBe(500);
      }
    });
  });

  // ─── sandboxFsWrite ───────────────────────────────────────────────────────

  describe('sandboxFsWrite', () => {
    it('PUTs to /sandbox/{name}/fs/file with multipart body', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ bytesWritten: 5 }));
      const stream = Readable.from(Buffer.from('hello'));

      const result = await client.sandboxFsWrite(
        'sbx-1',
        '/out.txt',
        { stream, filename: 'out.txt' },
      );

      const [reqUrl, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(reqUrl).toBe(
        'https://edge.example.com/ns/my-ns/bot-provider/my-bot/sandbox/sbx-1/fs/file?path=%2Fout.txt',
      );
      expect(init.method).toBe('PUT');
      expect(headers['content-type']).toMatch(/multipart\/form-data/);
      expect(init.body).toBeInstanceOf(Buffer);
      expect(result.bytesWritten).toBe(5);
    });

    it('appends mode and create_only query params when set', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ bytesWritten: 0 }));
      const stream = Readable.from(Buffer.from(''));

      await client.sandboxFsWrite(
        'sbx-1',
        '/x',
        { stream, filename: 'x' },
        { mode: 0o755, createOnly: true },
      );

      const [reqUrl] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(reqUrl).toContain(`mode=${0o755}`);
      expect(reqUrl).toContain('create_only=true');
    });
  });

  // ─── sandboxHeartbeat ─────────────────────────────────────────────────────

  describe('sandboxHeartbeat', () => {
    it('POSTs to /sandbox/{name}/heartbeat and returns shutdownAt', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({ shutdownAt: '2026-05-14T10:00:00Z' }),
      );

      const result = await client.sandboxHeartbeat('sbx-1');

      const [reqUrl, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(reqUrl).toBe(
        'https://edge.example.com/ns/my-ns/bot-provider/my-bot/sandbox/sbx-1/heartbeat',
      );
      expect(init.method).toBe('POST');
      expect(result.shutdownAt).toBe('2026-05-14T10:00:00Z');
    });
  });
});
