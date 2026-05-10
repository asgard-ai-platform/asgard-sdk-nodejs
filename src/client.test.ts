import { Readable } from 'stream';
import { BotProviderClient } from './client.js';
import { BotProviderConfig } from './config.js';
import { AsgardError } from './error.js';
import { GenericBotMessage, GenericBotReply } from './models.js';
import { BotProviderStreamer } from './streamer.js';

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
});
