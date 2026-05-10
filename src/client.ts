import FormData from 'form-data';
import { Readable, Writable } from 'stream';
import { BotProviderConfig, MessageRequestOptions } from './config.js';
import { AsgardError } from './error.js';
import {
  ApiResponse,
  Blob,
  GenericBotMessage,
  GenericBotReply,
} from './models.js';
import { BotProviderStreamer } from './streamer.js';

const DEFAULT_TIMEOUT_MS = 300_000;

function encodePath(segment: string): string {
  return encodeURIComponent(segment);
}

function buildUrl(
  base: string,
  path: string,
  opts?: MessageRequestOptions,
): string {
  const url = `${base}${path}`;
  if (opts?.isDebug) return `${url}?is_debug=true`;
  return url;
}

function buildHeaders(
  config: BotProviderConfig,
  opts?: MessageRequestOptions,
  extra?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = {
    ...config.headers,                        // user-supplied custom headers (lowest priority)
    'X-API-KEY': config.botProviderApiKey,    // always required, cannot be overridden
    ...extra,                                 // per-request headers (Content-Type etc.)
  };
  if (opts?.userIdentityHint) {
    headers['X-ASGARD-USER-IDENTITY-HINT'] = opts.userIdentityHint;
  }
  return headers;
}

async function parseApiResponse<T>(resp: Response): Promise<T> {
  let body: ApiResponse<T>;
  try {
    body = (await resp.json()) as ApiResponse<T>;
  } catch {
    throw new AsgardError(
      `Failed to parse response (HTTP ${resp.status})`,
      resp.status,
    );
  }
  if (!resp.ok || !body.isSuccess) {
    throw new AsgardError(
      body.error ?? `Request failed (HTTP ${resp.status})`,
      resp.status,
      body.errorCode ?? undefined,
    );
  }
  return body.data;
}

/**
 * Buffer an entire form-data Readable stream into a single Buffer.
 * form-data extends CombinedStream (old-style stream) which only starts
 * flowing when pipe() is called — pipe() internally calls resume().
 */
function bufferFormData(form: FormData): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const writer = new Writable({
      write(chunk: Buffer, _, cb) {
        chunks.push(chunk);
        cb();
      },
      final(cb) {
        resolve(Buffer.concat(chunks));
        cb();
      },
    });
    writer.on('error', reject);
    form.pipe(writer);
  });
}

export class BotProviderClient {
  private readonly timeoutMs: number;

  constructor(private readonly config: BotProviderConfig) {
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private basePath(): string {
    const ns = encodePath(this.config.namespace);
    const name = encodePath(this.config.botProviderName);
    return `/ns/${ns}/bot-provider/${name}`;
  }

  async sendMessage(
    message: GenericBotMessage,
    opts?: MessageRequestOptions,
  ): Promise<GenericBotReply> {
    const url = buildUrl(
      this.config.edgeServerHost,
      `${this.basePath()}/message`,
      opts,
    );
    const resp = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(this.config, opts, {
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return parseApiResponse<GenericBotReply>(resp);
  }

  /**
   * Establish an SSE connection and return a BotProviderStreamer.
   * Throws AsgardError if the connection cannot be established (non-2xx response).
   */
  async newStreamer(
    message: GenericBotMessage,
    opts?: MessageRequestOptions,
  ): Promise<BotProviderStreamer> {
    const url = buildUrl(
      this.config.edgeServerHost,
      `${this.basePath()}/message/sse`,
      opts,
    );
    const resp = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(this.config, opts, {
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!resp.ok) {
      throw new AsgardError(
        `SSE connection failed (HTTP ${resp.status})`,
        resp.status,
      );
    }
    if (!resp.body) {
      throw new AsgardError('SSE response has no body', resp.status);
    }
    return new BotProviderStreamer(resp.body);
  }

  async triggerJson(payload: Record<string, unknown>): Promise<unknown> {
    const url = `${this.config.edgeServerHost}${this.basePath()}/json`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(this.config, undefined, {
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return parseApiResponse<unknown>(resp);
  }

  async triggerForm(
    payload: Record<string, unknown>,
    file?: { stream: Readable; filename: string; mime?: string },
  ): Promise<unknown> {
    const url = `${this.config.edgeServerHost}${this.basePath()}/form`;
    const form = new FormData();
    form.append('json', JSON.stringify(payload));
    if (file) {
      form.append('file', file.stream, {
        filename: file.filename,
        contentType: file.mime ?? 'application/octet-stream',
      });
    }
    const body = await bufferFormData(form);
    const resp = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(this.config, undefined, form.getHeaders()),
      body,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return parseApiResponse<unknown>(resp);
  }

  async uploadBlob(
    channelId: string,
    file: { stream: Readable; filename: string; mime?: string },
  ): Promise<Blob> {
    const url = `${this.config.edgeServerHost}${this.basePath()}/blob`;
    const form = new FormData();
    form.append('customChannelId', channelId);
    form.append('file', file.stream, {
      filename: file.filename,
      contentType: file.mime ?? 'application/octet-stream',
    });
    const body = await bufferFormData(form);
    const resp = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(this.config, undefined, form.getHeaders()),
      body,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const blobs = await parseApiResponse<Blob[]>(resp);
    if (!blobs || blobs.length === 0) {
      throw new AsgardError(
        'Upload blob succeeded but no blob metadata returned',
        200,
      );
    }
    return blobs[0];
  }
}
