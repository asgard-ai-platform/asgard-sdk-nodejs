import FormData from 'form-data';
import { Readable } from 'stream';
import { bufferFormData, encodePath, parseApiResponse } from './_internal.js';
import { BotProviderConfig, MessageRequestOptions } from './config.js';
import { AsgardError } from './error.js';
import {
  ApiResponse,
  Blob,
  GenericBotMessage,
  GenericBotReply,
  SandboxFsListResult,
  SandboxFsReadMeta,
  SandboxFsWriteResult,
  SandboxHeartbeatResult,
} from './models.js';
import { BotProviderStreamer } from './streamer.js';

const DEFAULT_TIMEOUT_MS = 300_000;

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
   *
   * No request timeout is applied — SSE connections are long-lived by design.
   * Use BotProviderStreamer.close() to abort the stream when done.
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
      // No AbortSignal: SSE is indefinite. AbortSignal.timeout() would abort
      // the body read after timeoutMs, killing a healthy long-running stream.
    });
    if (!resp.ok) {
      // Consume and discard the body to release the underlying connection.
      await resp.body?.cancel();
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

  private sandboxBasePath(sandboxName: string): string {
    return `${this.basePath()}/sandbox/${encodePath(sandboxName)}`;
  }

  /**
   * Request a one-time editor open URL for the given sandbox.
   * Calls POST /sandbox/{sandboxName}/editor/open-url.
   */
  async generateSandboxEditorOpenUrl(sandboxName: string): Promise<string> {
    const url = `${this.config.edgeServerHost}${this.sandboxBasePath(sandboxName)}/editor/open-url`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(this.config, undefined, {
        'Content-Type': 'application/json',
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const data = await parseApiResponse<{ openURL: string }>(resp);
    if (!data?.openURL) {
      throw new AsgardError('response missing openURL field', resp.status);
    }
    return data.openURL;
  }

  async sandboxFsList(
    sandboxName: string,
    path: string,
  ): Promise<SandboxFsListResult> {
    const qs = new URLSearchParams({ path }).toString();
    const url = `${this.config.edgeServerHost}${this.sandboxBasePath(sandboxName)}/fs/list?${qs}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(this.config),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return parseApiResponse<SandboxFsListResult>(resp);
  }

  /**
   * Read raw bytes from a sandbox file. Returns the body together with
   * meta extracted from X-Total-Bytes / X-Truncated response headers.
   */
  async sandboxFsRead(
    sandboxName: string,
    path: string,
    opts?: { offsetBytes?: number; limitBytes?: number },
  ): Promise<{ data: Buffer; meta: SandboxFsReadMeta }> {
    const qs = new URLSearchParams({ path });
    if (opts?.offsetBytes != null) qs.set('offset_bytes', String(opts.offsetBytes));
    if (opts?.limitBytes != null) qs.set('limit_bytes', String(opts.limitBytes));
    const url = `${this.config.edgeServerHost}${this.sandboxBasePath(sandboxName)}/fs/file?${qs.toString()}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(this.config),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!resp.ok) {
      // Endpoint returns raw bytes on success but an ApiResponse JSON envelope on failure.
      const text = await resp.text().catch(() => '');
      try {
        const body = JSON.parse(text) as ApiResponse<unknown>;
        if (body && body.isSuccess === false) {
          throw new AsgardError(
            body.error ?? `sandbox fs read failed (HTTP ${resp.status})`,
            resp.status,
            body.errorCode ?? undefined,
          );
        }
      } catch (e) {
        if (e instanceof AsgardError) throw e;
      }
      throw new AsgardError(
        `sandbox fs read failed (HTTP ${resp.status})`,
        resp.status,
      );
    }
    const ab = await resp.arrayBuffer();
    const meta: SandboxFsReadMeta = {
      totalBytes: Number(resp.headers.get('X-Total-Bytes') ?? 0),
      truncated: resp.headers.get('X-Truncated') === 'true',
    };
    return { data: Buffer.from(ab), meta };
  }

  /**
   * Write a file into the sandbox via multipart/form-data (field "file").
   * `mode` is an octal POSIX mode (e.g. 0o644); server applies its default when omitted.
   * `createOnly: true` makes the call fail if the path already exists.
   */
  async sandboxFsWrite(
    sandboxName: string,
    path: string,
    file: { stream: Readable; filename: string },
    opts?: { mode?: number; createOnly?: boolean },
  ): Promise<SandboxFsWriteResult> {
    const qs = new URLSearchParams({ path });
    if (opts?.mode != null) qs.set('mode', String(opts.mode));
    if (opts?.createOnly) qs.set('create_only', 'true');
    const url = `${this.config.edgeServerHost}${this.sandboxBasePath(sandboxName)}/fs/file?${qs.toString()}`;
    const form = new FormData();
    form.append('file', file.stream, {
      filename: file.filename,
      contentType: 'application/octet-stream',
    });
    const body = await bufferFormData(form);
    const resp = await fetch(url, {
      method: 'PUT',
      headers: buildHeaders(this.config, undefined, form.getHeaders()),
      body,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return parseApiResponse<SandboxFsWriteResult>(resp);
  }

  /**
   * Extend the sandbox lease. Returns the new shutdown deadline.
   */
  async sandboxHeartbeat(
    sandboxName: string,
  ): Promise<SandboxHeartbeatResult> {
    const url = `${this.config.edgeServerHost}${this.sandboxBasePath(sandboxName)}/heartbeat`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(this.config),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return parseApiResponse<SandboxHeartbeatResult>(resp);
  }
}
