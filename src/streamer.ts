import { AsgardError } from './error.js';
import { GenericBotSseEvent } from './models.js';

/**
 * BotProviderStreamer wraps an established SSE response body and provides
 * both a pull-based API (next/current/err) and an async-iterator interface.
 *
 * Obtain an instance from BotProviderClient.newStreamer() — do not construct directly.
 *
 * Lifecycle:
 *   - Stream ends normally when server sends `asgard.run.done` (delivered to caller).
 *   - Stream ends with error when server sends `asgard.run.error` (NOT delivered;
 *     use err() to retrieve the error detail — mirrors Go SDK behaviour).
 *   - Call close() to abort early and release the TCP connection.
 *
 * Pull-based usage:
 *   while (await streamer.next()) { process(streamer.current()!); }
 *   if (streamer.err()) throw streamer.err();
 *
 * Async-iterator usage:
 *   for await (const event of streamer) { process(event); }
 *   // throws AsgardError if stream ended with asgard.run.error
 */
export class BotProviderStreamer implements AsyncIterable<GenericBotSseEvent> {
  private readonly _reader: ReadableStreamDefaultReader<Uint8Array>;
  private _current: GenericBotSseEvent | null = null;
  private _error: AsgardError | null = null;
  private _done = false;

  private _queue: Array<GenericBotSseEvent | AsgardError> = [];
  private _notify: (() => void) | null = null;

  constructor(body: ReadableStream<Uint8Array>) {
    this._reader = body.getReader();
    this._readLoop();
  }

  private _enqueue(item: GenericBotSseEvent | AsgardError): void {
    if (this._done) return; // discard items enqueued after stream is terminated
    this._queue.push(item);
    this._notify?.();
    this._notify = null;
  }

  private _waitForItem(): Promise<void> {
    if (this._queue.length > 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this._notify = resolve;
    });
  }

  private _cancelReader(): void {
    void this._reader.cancel().catch(() => {});
  }

  private _readLoop(): void {
    const decoder = new TextDecoder();
    let buf = '';

    const loop = async () => {
      try {
        while (true) {
          const { done, value } = await this._reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          // SSE blocks are delimited by double newline (\n\n or \r\n\r\n)
          const blocks = buf.split(/\r?\n\r?\n/);
          buf = blocks.pop() ?? '';

          for (const block of blocks) {
            const dataLine = block.split(/\r?\n/).find((l) => l.startsWith('data:'));
            if (!dataLine) continue;
            const raw = dataLine.slice(5).trim();
            if (!raw || raw === '[DONE]') continue;

            try {
              this._enqueue(JSON.parse(raw) as GenericBotSseEvent);
            } catch {
              this._enqueue(new AsgardError(`Failed to parse SSE event: ${raw}`));
            }
          }
        }
      } catch (err) {
        // Suppress errors triggered by an intentional close()
        if (!this._done) {
          this._enqueue(
            new AsgardError(err instanceof Error ? err.message : String(err)),
          );
        }
      } finally {
        this._done = true;
        this._notify?.();
        this._notify = null;
      }
    };

    void loop();
  }

  /**
   * Advance to the next event.
   * Returns true if an event is available (read it with current()).
   * Returns false when the stream ends normally or with an error (read it with err()).
   *
   * Note: `asgard.run.error` is NOT delivered as an event. next() returns false
   * and err() contains the error detail (mirrors Go SDK behaviour).
   */
  async next(): Promise<boolean> {
    while (true) {
      if (this._queue.length > 0) {
        const item = this._queue.shift()!;

        if (item instanceof AsgardError) {
          this._error = item;
          this._done = true;
          this._queue = [];
          this._cancelReader();
          return false;
        }

        // asgard.run.error: NOT delivered to caller (mirrors Go SDK).
        // Go: Next() sets s.err and returns false without exposing the event.
        if (item.eventType === 'asgard.run.error') {
          const detail = item.fact?.runError?.error;
          this._error = new AsgardError(detail?.message ?? 'SSE stream error');
          this._done = true;
          this._queue = [];
          this._cancelReader();
          return false;
        }

        this._current = item;

        // asgard.run.done: deliver to caller, then stop and release connection.
        if (item.eventType === 'asgard.run.done') {
          this._done = true;
          this._queue = [];
          this._cancelReader();
        }

        return true;
      }
      if (this._done) return false;
      await this._waitForItem();
    }
  }

  /** Returns the event delivered by the last successful next() call. */
  current(): GenericBotSseEvent | null {
    return this._current;
  }

  /** Returns the error if the stream ended with an error, otherwise null. */
  err(): AsgardError | null {
    return this._error;
  }

  /**
   * Cancel the underlying reader and release the TCP connection.
   * Safe to call multiple times.
   */
  close(): void {
    this._done = true; // set before cancel so _readLoop catch doesn't enqueue an error
    this._queue = [];
    this._notify?.();
    this._notify = null;
    this._cancelReader();
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<GenericBotSseEvent> {
    while (await this.next()) {
      yield this._current!;
    }
    if (this._error) throw this._error;
  }
}
