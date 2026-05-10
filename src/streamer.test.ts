import { AsgardError } from './error.js';
import { GenericBotSseEvent } from './models.js';
import { BotProviderStreamer } from './streamer.js';

const encoder = new TextEncoder();

function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

function makeEvent(overrides: Partial<GenericBotSseEvent> = {}): GenericBotSseEvent {
  return {
    eventType: 'asgard.run.init',
    requestId: 'r1',
    eventId: 'e1',
    namespace: 'ns',
    botProviderName: 'bot',
    customChannelId: 'ch1',
    fact: {} as GenericBotSseEvent['fact'],
    ...overrides,
  };
}

function sseChunk(event: GenericBotSseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

describe('BotProviderStreamer', () => {
  describe('async-iterator API', () => {
    it('delivers all events via for-await-of', async () => {
      const init = makeEvent({ eventType: 'asgard.run.init', eventId: 'e1' });
      const done = makeEvent({ eventType: 'asgard.run.done', eventId: 'e2' });
      const stream = makeStream([sseChunk(init), sseChunk(done)]);

      const events: GenericBotSseEvent[] = [];
      for await (const event of new BotProviderStreamer(stream)) {
        events.push(event);
      }

      expect(events).toHaveLength(2);
      expect(events[0].eventType).toBe('asgard.run.init');
      expect(events[1].eventType).toBe('asgard.run.done');
    });

    it('stops after terminal done event even if server sends more', async () => {
      const init = makeEvent({ eventType: 'asgard.run.init' });
      const done = makeEvent({ eventType: 'asgard.run.done' });
      const extra = makeEvent({ eventType: 'asgard.message.delta', eventId: 'e3' });
      const stream = makeStream([sseChunk(init), sseChunk(done), sseChunk(extra)]);

      const events: GenericBotSseEvent[] = [];
      for await (const event of new BotProviderStreamer(stream)) {
        events.push(event);
      }

      expect(events.map((e) => e.eventType)).toEqual([
        'asgard.run.init',
        'asgard.run.done',
      ]);
    });

    it('stops after terminal error event', async () => {
      const errorEvent = makeEvent({ eventType: 'asgard.run.error' });
      const stream = makeStream([sseChunk(errorEvent)]);

      const events: GenericBotSseEvent[] = [];
      for await (const event of new BotProviderStreamer(stream)) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('asgard.run.error');
    });

    it('throws AsgardError from iterator when SSE parse fails', async () => {
      const stream = makeStream(['data: not-valid-json\n\n']);
      const streamer = new BotProviderStreamer(stream);

      await expect(async () => {
        for await (const _ of streamer) {
          // should not reach here
        }
      }).rejects.toBeInstanceOf(AsgardError);
    });
  });

  describe('pull-based API (next/current/err)', () => {
    it('delivers events via next() / current()', async () => {
      const init = makeEvent({ eventType: 'asgard.run.init' });
      const done = makeEvent({ eventType: 'asgard.run.done' });
      const stream = makeStream([sseChunk(init), sseChunk(done)]);
      const streamer = new BotProviderStreamer(stream);

      expect(await streamer.next()).toBe(true);
      expect(streamer.current()?.eventType).toBe('asgard.run.init');

      expect(await streamer.next()).toBe(true);
      expect(streamer.current()?.eventType).toBe('asgard.run.done');

      // After terminal done, next() returns false
      expect(await streamer.next()).toBe(false);
      expect(streamer.err()).toBeNull();
    });

    it('returns false and sets err() on invalid JSON', async () => {
      const stream = makeStream(['data: {bad json}\n\n']);
      const streamer = new BotProviderStreamer(stream);

      expect(await streamer.next()).toBe(false);
      expect(streamer.err()).toBeInstanceOf(AsgardError);
      expect(streamer.err()?.message).toContain('Failed to parse SSE event');
    });

    it('returns false when stream ends without events', async () => {
      const stream = makeStream([]);
      const streamer = new BotProviderStreamer(stream);

      expect(await streamer.next()).toBe(false);
      expect(streamer.err()).toBeNull();
      expect(streamer.current()).toBeNull();
    });
  });

  describe('SSE format parsing', () => {
    it('handles events split across multiple chunks', async () => {
      const event = makeEvent({ eventType: 'asgard.run.init' });
      const raw = sseChunk(event);
      // Split in the middle of the JSON
      const mid = Math.floor(raw.length / 2);
      const stream = makeStream([raw.slice(0, mid), raw.slice(mid)]);

      const streamer = new BotProviderStreamer(stream);
      expect(await streamer.next()).toBe(true);
      expect(streamer.current()?.eventType).toBe('asgard.run.init');
    });

    it('ignores [DONE] sentinel', async () => {
      const init = makeEvent({ eventType: 'asgard.run.init' });
      const stream = makeStream([sseChunk(init), 'data: [DONE]\n\n']);

      const events: GenericBotSseEvent[] = [];
      const streamer = new BotProviderStreamer(stream);
      while (await streamer.next()) {
        events.push(streamer.current()!);
      }

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('asgard.run.init');
    });

    it('ignores SSE blocks without a data: line', async () => {
      const comment = ': keep-alive\n\n';
      const event = makeEvent({ eventType: 'asgard.run.done' });
      const stream = makeStream([comment, sseChunk(event)]);

      const streamer = new BotProviderStreamer(stream);
      expect(await streamer.next()).toBe(true);
      expect(streamer.current()?.eventType).toBe('asgard.run.done');
    });

    it('delivers multiple events in a single chunk', async () => {
      const e1 = makeEvent({ eventType: 'asgard.run.init', eventId: 'e1' });
      const e2 = makeEvent({ eventType: 'asgard.process.start', eventId: 'e2' });
      const e3 = makeEvent({ eventType: 'asgard.run.done', eventId: 'e3' });
      const single = sseChunk(e1) + sseChunk(e2) + sseChunk(e3);
      const stream = makeStream([single]);

      const events: GenericBotSseEvent[] = [];
      for await (const event of new BotProviderStreamer(stream)) {
        events.push(event);
      }

      expect(events.map((e) => e.eventType)).toEqual([
        'asgard.run.init',
        'asgard.process.start',
        'asgard.run.done',
      ]);
    });
  });

  describe('close()', () => {
    it('close() terminates the stream gracefully', async () => {
      // A stream that never closes on its own
      let enqueueFn: ((v: Uint8Array) => void) | null = null;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          enqueueFn = (v) => controller.enqueue(v);
        },
      });

      const streamer = new BotProviderStreamer(stream);
      streamer.close();

      // next() should return false after close()
      const result = await streamer.next();
      expect(result).toBe(false);
      expect(streamer.err()).toBeNull();
      void enqueueFn; // keep reference to prevent GC issues in test
    });
  });
});
