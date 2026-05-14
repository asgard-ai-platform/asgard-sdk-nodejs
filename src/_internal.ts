import type FormData from 'form-data';
import { Writable } from 'stream';
import { AsgardError } from './error.js';
import { ApiResponse } from './models.js';

export function encodePath(segment: string): string {
  return encodeURIComponent(segment);
}

export async function parseApiResponse<T>(resp: Response): Promise<T> {
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
export function bufferFormData(form: FormData): Promise<Buffer> {
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
