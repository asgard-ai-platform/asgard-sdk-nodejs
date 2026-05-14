import FormData from 'form-data';
import { Readable } from 'stream';
import { bufferFormData, encodePath, parseApiResponse } from './_internal.js';
import { AsgardError } from './error.js';
import {
  ApiResponse,
  SourceSetListDirectoryResult,
  SourceSetStatResult,
  SourceSetWriteFileResult,
} from './models.js';

const DEFAULT_TIMEOUT_MS = 300_000;

export interface SourceSetConfig {
  /** EdgeServer base URL, e.g. https://edge.example.com */
  edgeServerHost: string;
  namespace: string;
  sourceSetName: string;
  sourceSetApiKey: string;
  /** Additional headers forwarded on every request */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds (default: 300_000) */
  timeoutMs?: number;
}

export class SourceSetClient {
  private readonly timeoutMs: number;

  constructor(private readonly config: SourceSetConfig) {
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private baseUrl(): string {
    const ns = encodePath(this.config.namespace);
    const name = encodePath(this.config.sourceSetName);
    return `${this.config.edgeServerHost}/ns/${ns}/source-set/${name}`;
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      ...this.config.headers,
      'X-API-KEY': this.config.sourceSetApiKey,
      ...extra,
    };
  }

  async listDirectory(
    path: string,
    opts?: { page?: number; pageSize?: number },
  ): Promise<SourceSetListDirectoryResult> {
    const qs = new URLSearchParams({ path });
    if (opts?.page != null) qs.set('page', String(opts.page));
    if (opts?.pageSize != null) qs.set('page_size', String(opts.pageSize));
    const url = `${this.baseUrl()}/volume/list?${qs.toString()}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: this.buildHeaders(),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return parseApiResponse<SourceSetListDirectoryResult>(resp);
  }

  async stat(path: string): Promise<SourceSetStatResult> {
    const qs = new URLSearchParams({ path }).toString();
    const url = `${this.baseUrl()}/volume/stat?${qs}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: this.buildHeaders(),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return parseApiResponse<SourceSetStatResult>(resp);
  }

  /**
   * Download the file at path as raw bytes. Returns a Buffer.
   * On non-2xx the server returns an ApiResponse JSON envelope; this is surfaced as AsgardError.
   */
  async readFile(
    path: string,
    opts?: { offsetBytes?: number; limitBytes?: number },
  ): Promise<Buffer> {
    const qs = new URLSearchParams({ path });
    if (opts?.offsetBytes != null) qs.set('offset', String(opts.offsetBytes));
    if (opts?.limitBytes != null) qs.set('limit', String(opts.limitBytes));
    const url = `${this.baseUrl()}/volume/file?${qs.toString()}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: this.buildHeaders(),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      try {
        const body = JSON.parse(text) as ApiResponse<unknown>;
        if (body && body.isSuccess === false) {
          throw new AsgardError(
            body.error ?? `read file failed (HTTP ${resp.status})`,
            resp.status,
            body.errorCode ?? undefined,
          );
        }
      } catch (e) {
        if (e instanceof AsgardError) throw e;
      }
      throw new AsgardError(
        `read file failed (HTTP ${resp.status})`,
        resp.status,
      );
    }
    const ab = await resp.arrayBuffer();
    return Buffer.from(ab);
  }

  async writeFile(
    path: string,
    file: { stream: Readable; filename: string },
  ): Promise<SourceSetWriteFileResult> {
    const qs = new URLSearchParams({ path }).toString();
    const url = `${this.baseUrl()}/volume/file?${qs}`;
    const form = new FormData();
    form.append('file', file.stream, {
      filename: file.filename,
      contentType: 'application/octet-stream',
    });
    const body = await bufferFormData(form);
    const resp = await fetch(url, {
      method: 'PUT',
      headers: this.buildHeaders(form.getHeaders()),
      body,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return parseApiResponse<SourceSetWriteFileResult>(resp);
  }

  async makeDirectory(path: string): Promise<void> {
    const qs = new URLSearchParams({ path }).toString();
    const url = `${this.baseUrl()}/volume/mkdir?${qs}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    await parseApiResponse<unknown>(resp);
  }

  async remove(path: string): Promise<void> {
    const qs = new URLSearchParams({ path }).toString();
    const url = `${this.baseUrl()}/volume/item?${qs}`;
    const resp = await fetch(url, {
      method: 'DELETE',
      headers: this.buildHeaders(),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    await parseApiResponse<unknown>(resp);
  }

  async removeAll(path: string): Promise<void> {
    const qs = new URLSearchParams({ path }).toString();
    const url = `${this.baseUrl()}/volume/all?${qs}`;
    const resp = await fetch(url, {
      method: 'DELETE',
      headers: this.buildHeaders(),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    await parseApiResponse<unknown>(resp);
  }
}
