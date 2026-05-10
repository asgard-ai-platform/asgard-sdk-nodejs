import { AsgardError } from './error.js';
import { GenericBotMessage, GenericBotSseEvent, SseEventType } from './models.js';

const SSE_DONE_EVENTS: SseEventType[] = [
  'asgard.run.done',
  'asgard.run.error',
];

/**
 * BotProviderStreamer provides an async-iterator interface over SSE events.
 *
 * Usage:
 *   const streamer = client.newStreamer(message, opts);
 *   for await (const event of streamer) { ... }
 *   // or: while (await streamer.next()) { streamer.current() }
 */
export class BotProviderStreamer implements AsyncIterable<GenericBotSseEvent> {
  private _current: GenericBotSseEvent | null = null;
  private _error: AsgardError | null = null;
  private _done = false;
  private _abortController = new AbortController();

  /** Internal queue filled by the background reader */
  private _queue: Array<GenericBotSseEvent | AsgardError> = [];
  private _resolve: (() => void) | null = null;

  constructor(
    private readonly url: string,
    private readonly headers: Record<string, string>,
    private readonly message: GenericBotMessage,
    private readonly timeoutMs: number,
  ) {
    this._startReading();
  }

  private _enqueue(item: GenericBotSseEvent | AsgardError): void {
    this._queue.push(item);
    this._resolve?.();
    this._resolve = null;
  }

  private _waitForItem(): Promise<void> {
    if (this._queue.length > 0) return Promise.resolve();
    return new Promise((resolve) => {
      this._resolve = resolve;
    });
  }

  private _startReading(): void {
    const timeoutId = setTimeout(
      () => this._abortController.abort(),
      this.timeoutMs,
    );

    fetch(this.url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(this.message),
      signal: this._abortController.signal,
    })
      .then(async (resp) => {
        if (!resp.ok) {
          this._enqueue(
            new AsgardError(
              `SSE connection failed (HTTP ${resp.status})`,
              resp.status,
            ),
          );
          return;
        }
        if (!resp.body) {
          this._enqueue(new AsgardError('SSE response has no body'));
          return;
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });

            // Parse SSE: split on double-newline
            const blocks = buf.split(/\n\n/);
            buf = blocks.pop() ?? '';

            for (const block of blocks) {
              const dataLine = block
                .split('\n')
                .find((l) => l.startsWith('data:'));
              if (!dataLine) continue;
              const raw = dataLine.slice(5).trim();
              if (!raw || raw === '[DONE]') continue;

              let event: GenericBotSseEvent;
              try {
                event = JSON.parse(raw) as GenericBotSseEvent;
              } catch {
                this._enqueue(
                  new AsgardError(`Failed to parse SSE event: ${raw}`),
                );
                continue;
              }
              this._enqueue(event);
            }
          }
        } finally {
          reader.releaseLock();
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') {
          this._enqueue(new AsgardError('SSE connection timed out'));
        } else {
          this._enqueue(
            new AsgardError(
              err instanceof Error ? err.message : String(err),
            ),
          );
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
        this._done = true;
        // Wake up any pending waiter so it can drain remaining queue
        this._resolve?.();
        this._resolve = null;
      });
  }

  /** Advance to the next event. Returns false when the stream is finished. */
  async next(): Promise<boolean> {
    while (true) {
      if (this._queue.length > 0) {
        const item = this._queue.shift()!;
        if (item instanceof AsgardError) {
          this._error = item;
          return false;
        }
        this._current = item;
        if (SSE_DONE_EVENTS.includes(item.eventType)) {
          // Deliver the terminal event, then stop on the next call
          return true;
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

  /** Returns the error if the stream ended with an error. */
  err(): AsgardError | null {
    return this._error;
  }

  /** Abort the underlying HTTP connection. */
  close(): void {
    this._abortController.abort();
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<GenericBotSseEvent> {
    while (await this.next()) {
      yield this._current!;
      if (this._current && SSE_DONE_EVENTS.includes(this._current.eventType)) {
        break;
      }
    }
    if (this._error) throw this._error;
  }
}
