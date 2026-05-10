import { Readable } from 'stream';
import FormData from 'form-data';
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
    'X-API-KEY': config.botProviderApiKey,
    ...config.headers,
    ...extra,
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

  newStreamer(
    message: GenericBotMessage,
    opts?: MessageRequestOptions,
  ): BotProviderStreamer {
    const url = buildUrl(
      this.config.edgeServerHost,
      `${this.basePath()}/message/sse`,
      opts,
    );
    const headers = buildHeaders(this.config, opts, {
      'Content-Type': 'application/json',
    });
    return new BotProviderStreamer(url, headers, message, this.timeoutMs);
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
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        ...buildHeaders(this.config),
        ...form.getHeaders(),
      },
      body: Readable.toWeb(form) as ReadableStream,
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
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        ...buildHeaders(this.config),
        ...form.getHeaders(),
      },
      body: Readable.toWeb(form) as ReadableStream,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const blobs = await parseApiResponse<Blob[]>(resp);
    if (!blobs || blobs.length === 0) {
      throw new AsgardError('Upload blob succeeded but no blob metadata returned', 200);
    }
    return blobs[0];
  }
}
