import { Readable } from 'stream';
import { AsgardError } from '../src/error.js';
import { SourceSetClient, SourceSetConfig } from '../src/source-set.js';

const config: SourceSetConfig = {
  edgeServerHost: 'https://edge.example.com',
  namespace: 'my-ns',
  sourceSetName: 'my-set',
  sourceSetApiKey: 'set-key',
};

const client = new SourceSetClient(config);

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

describe('SourceSetClient', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ─── listDirectory ────────────────────────────────────────────────────────

  describe('listDirectory', () => {
    it('GETs /volume/list with path query and X-API-KEY', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ entries: [], paging: null }));

      await client.listDirectory('/data');

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(url).toBe(
        'https://edge.example.com/ns/my-ns/source-set/my-set/volume/list?path=%2Fdata',
      );
      expect(init.method).toBe('GET');
      expect(headers['X-API-KEY']).toBe('set-key');
    });

    it('passes page and page_size query params', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ entries: [], paging: null }));

      await client.listDirectory('/data', { page: 2, pageSize: 50 });

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('page=2');
      expect(url).toContain('page_size=50');
    });

    it('URL-encodes namespace and sourceSetName', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ entries: [], paging: null }));
      const c = new SourceSetClient({
        ...config,
        namespace: 'ns 1',
        sourceSetName: 'set/x',
      });

      await c.listDirectory('/');

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/ns/ns%201/source-set/set%2Fx/');
    });

    it('config.headers does not override X-API-KEY', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ entries: [], paging: null }));
      const c = new SourceSetClient({
        ...config,
        headers: { 'X-API-KEY': 'SHOULD-NOT-WIN' },
      });

      await c.listDirectory('/');

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['X-API-KEY']).toBe('set-key');
    });

    it('throws AsgardError on HTTP 401', async () => {
      fetchSpy.mockResolvedValue(errorResponse('Unauthorized', 401));

      await expect(client.listDirectory('/')).rejects.toBeInstanceOf(AsgardError);
    });
  });

  // ─── stat ─────────────────────────────────────────────────────────────────

  describe('stat', () => {
    it('GETs /volume/stat with path query', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({
          exists: true,
          isDir: false,
          sizeBytes: 42,
          mtimeUnix: 1700000000,
          etag: 'etag-1',
        }),
      );

      const result = await client.stat('/data/file.csv');

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        'https://edge.example.com/ns/my-ns/source-set/my-set/volume/stat?path=%2Fdata%2Ffile.csv',
      );
      expect(init.method).toBe('GET');
      expect(result.exists).toBe(true);
      expect(result.sizeBytes).toBe(42);
    });
  });

  // ─── readFile ─────────────────────────────────────────────────────────────

  describe('readFile', () => {
    it('GETs /volume/file and returns raw Buffer', async () => {
      fetchSpy.mockResolvedValue(
        new Response(Buffer.from('csv-payload'), { status: 200 }),
      );

      const buf = await client.readFile('/data/x.csv');

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        'https://edge.example.com/ns/my-ns/source-set/my-set/volume/file?path=%2Fdata%2Fx.csv',
      );
      expect(buf.toString()).toBe('csv-payload');
    });

    it('passes offset and limit as query params', async () => {
      fetchSpy.mockResolvedValue(new Response(Buffer.from(''), { status: 200 }));

      await client.readFile('/x', { offsetBytes: 1024, limitBytes: 4096 });

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('offset=1024');
      expect(url).toContain('limit=4096');
    });

    it('throws AsgardError on non-2xx response with error envelope', async () => {
      fetchSpy.mockResolvedValue(errorResponse('not found', 404));

      try {
        await client.readFile('/missing');
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AsgardError);
        expect((err as AsgardError).statusCode).toBe(404);
        expect((err as AsgardError).errorCode).toBe('ERR');
      }
    });
  });

  // ─── writeFile ────────────────────────────────────────────────────────────

  describe('writeFile', () => {
    it('PUTs /volume/file with multipart body and returns bytesWritten', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ bytesWritten: 11 }));
      const stream = Readable.from(Buffer.from('hello world'));

      const result = await client.writeFile('/out.csv', { stream, filename: 'out.csv' });

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(url).toBe(
        'https://edge.example.com/ns/my-ns/source-set/my-set/volume/file?path=%2Fout.csv',
      );
      expect(init.method).toBe('PUT');
      expect(headers['content-type']).toMatch(/multipart\/form-data/);
      expect(init.body).toBeInstanceOf(Buffer);
      expect(result.bytesWritten).toBe(11);
    });
  });

  // ─── makeDirectory ────────────────────────────────────────────────────────

  describe('makeDirectory', () => {
    it('POSTs /volume/mkdir with path query', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(null));

      await client.makeDirectory('/data/2026');

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        'https://edge.example.com/ns/my-ns/source-set/my-set/volume/mkdir?path=%2Fdata%2F2026',
      );
      expect(init.method).toBe('POST');
    });

    it('throws AsgardError on failure', async () => {
      fetchSpy.mockResolvedValue(errorResponse('forbidden', 403));

      await expect(client.makeDirectory('/x')).rejects.toBeInstanceOf(AsgardError);
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('DELETEs /volume/item with path query', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(null));

      await client.remove('/old.csv');

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        'https://edge.example.com/ns/my-ns/source-set/my-set/volume/item?path=%2Fold.csv',
      );
      expect(init.method).toBe('DELETE');
    });
  });

  // ─── removeAll ────────────────────────────────────────────────────────────

  describe('removeAll', () => {
    it('DELETEs /volume/all with path query', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(null));

      await client.removeAll('/archive');

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        'https://edge.example.com/ns/my-ns/source-set/my-set/volume/all?path=%2Farchive',
      );
      expect(init.method).toBe('DELETE');
    });
  });
});
