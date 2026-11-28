import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoice, voiceCacheKey, type VoiceDependencies } from '../src/voice.ts';

class FakeUtterance {
  text: string;
  lang = '';
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event?: unknown) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

class FakeAudio {
  onplaying: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: ((event?: unknown) => void) | null = null;
  plays = 0;
  paused = false;
  failure: unknown;

  constructor(failure?: unknown) {
    this.failure = failure;
  }

  play(): Promise<void> {
    this.plays += 1;
    if (this.failure !== undefined) return Promise.reject(this.failure);
    this.onplaying?.();
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
  }
}

class MemoryStorage {
  values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class MemoryCache {
  values = new Map<string, unknown>();
  reads: string[] = [];
  writes: string[] = [];

  get(key: string): unknown {
    this.reads.push(key);
    return Promise.resolve(this.values.get(key));
  }

  put(key: string, value: unknown): void {
    this.writes.push(key);
    this.values.set(key, value);
  }

  delete(key: string): void {
    this.values.delete(key);
  }
}
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  const { promise, resolve } = Promise.withResolvers<T>();
  return { promise, resolve };
}

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  terminated = false;
  private readonly result: { audio?: unknown; error?: string };
  constructor(result: { audio?: unknown; error?: string }) {
    this.result = result;
  }

  postMessage(message: { id: number }): void {
    queueMicrotask(() => this.onmessage?.(new MessageEvent('message', { data: { id: message.id, ...this.result } })));
  }

  terminate(): void {
    this.terminated = true;
  }
}
class ManualTimers {
  pending: Array<{ handler: () => void; delay: number; cancelled: boolean }> = [];

  setTimeout = (handler: () => void, delay: number): unknown => {
    const timer = { handler, delay, cancelled: false };
    this.pending.push(timer);
    return timer;
  };

  clearTimeout = (timer: unknown): void => {
    if (timer && typeof timer === 'object' && 'cancelled' in timer) (timer as { cancelled: boolean }).cancelled = true;
  };

  fire(delay: number): void {
    for (const timer of this.pending.filter((entry) => entry.delay === delay && !entry.cancelled)) timer.handler();
  }
}

function browserFakes(): {
  speech: { utterances: FakeUtterance[]; speak: (utterance: FakeUtterance) => void; cancel: () => void };
  dependencies: VoiceDependencies;
} {
  const speech = {
    utterances: [] as FakeUtterance[],
    speak(utterance: FakeUtterance) { this.utterances.push(utterance); },
    cancel() {},
  };
  return {
    speech,
    dependencies: {
      speechSynthesis: speech,
      SpeechSynthesisUtterance: FakeUtterance,
    },
  };
}

function settle(): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setImmediate(resolve);
  return promise;
}

const clip = new Blob(['synthetic PCM clip'], { type: 'audio/wav' });

test('cache identity preserves the legacy Kokoro tuple exactly', () => {
  assert.equal(
    voiceCacheKey('Eh flat minor third.'),
    '["kokoro-js@1.2.1/kokoro-82m-v1.0-onnx/q8","af_heart",1,"Eh flat minor third."]',
  );
});

test('a ready neural clip starts and releases the speaking clock', async () => {
  const cache = new MemoryCache();
  const audio = new FakeAudio();
  cache.values.set(voiceCacheKey('Eh flat minor third.'), clip);
  const playing: boolean[] = [];
  const statuses = [] as string[];
  const voice = createVoice((state) => statuses.push(state.message), (active) => playing.push(active), {
    cache,
    audioFactory: () => audio,
  });
  assert.equal(voice.state.engine, 'neural');
  voice.play('Eh flat minor third.');
  await settle();
  assert.deepEqual(playing, [true]);
  audio.onended?.();
  assert.deepEqual(playing, [true, false]);
  assert.equal(statuses.some((message) => message.includes('browser')), false);
});

test('browser speech normalizes Kokoro Eh and releases on completion', () => {
  const fakes = browserFakes();
  const playing: boolean[] = [];
  const voice = createVoice(() => {}, (active) => playing.push(active), fakes.dependencies);
  voice.setEngine('browser');
  voice.play('Eh flat minor third.');
  const utterance = fakes.speech.utterances[0];
  assert.equal(utterance.text, 'A, flat minor third.');
  utterance.onstart?.();
  utterance.onend?.();
  assert.deepEqual(playing, [true, false]);
});

test("a stopped stage cannot release the new stage's narration clock", () => {
  const fakes = browserFakes();
  const playing: boolean[] = [];
  const voice = createVoice(() => {}, active => playing.push(active), fakes.dependencies);
  voice.play('Play D minor.');
  const first = fakes.speech.utterances[0];
  first.onstart?.();
  voice.play('Play G seventh.');
  const second = fakes.speech.utterances[1];
  second.onstart?.();
  first.onend?.();
  first.onerror?.();
  assert.deepEqual(playing, [true, false, true]);
  second.onend?.();
  assert.deepEqual(playing, [true, false, true, false]);
});

test('broken cached audio falls back once while a missing activation stays actionable', async () => {
  const fakes = browserFakes();
  const cache = new MemoryCache();
  const broken = new FakeAudio(new Error('decode failed'));
  cache.values.set(voiceCacheKey('broken'), clip);
  const statuses: string[] = [];
  const voice = createVoice((state) => statuses.push(state.message), () => {}, {
    ...fakes.dependencies,
    cache,
    audioFactory: () => broken,
  });
  voice.play('broken');
  await settle();
  assert.equal(fakes.speech.utterances.length, 1);

  const blockedCache = new MemoryCache();
  const blocked = new FakeAudio({ name: 'NotAllowedError' });
  blockedCache.values.set(voiceCacheKey('blocked'), clip);
  const blockedVoice = createVoice((state) => statuses.push(state.message), () => {}, {
    ...fakes.dependencies,
    cache: blockedCache,
    audioFactory: () => blocked,
  });
  blockedVoice.play('blocked');
  await settle();
  assert.equal(fakes.speech.utterances.length, 1);
  assert.equal(statuses.at(-1)?.includes('Replay'), true);
});

test('cache deadline falls back immediately and ignores a late clip for the old prompt', async () => {
  const fakes = browserFakes();
  const timers = new ManualTimers();
  const pending = deferred<unknown>();
  const reads: string[] = [];
  const cache = {
    get(key: string) {
      reads.push(key);
      return pending.promise;
    },
    put() {},
  };
  const playing: boolean[] = [];
  const voice = createVoice(() => {}, (active) => playing.push(active), {
    ...fakes.dependencies,
    cache,
    audioFactory: () => new FakeAudio(),
    cacheDeadlineMs: 100,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
  });
  voice.play('slow prompt');
  await settle();
  assert.equal(fakes.speech.utterances.length, 0);
  timers.fire(100);
  await settle();
  assert.equal(fakes.speech.utterances.length, 1);
  pending.resolve(clip);
  await settle();
  assert.equal(fakes.speech.utterances.length, 1);
  assert.deepEqual(playing, []);
  assert.equal(reads.length >= 2, true);
});

test('a generated prompt can be replayed when saving the clip fails', async () => {
  const fakes = browserFakes();
  const audio = new FakeAudio();
  const requests: string[] = [];
  const voice = createVoice(() => {}, () => {}, {
    ...fakes.dependencies,
    cache: { get: () => undefined, put() { throw new Error('Storage denied'); } },
    audioFactory: () => audio,
    workerFactory: () => {
      const worker = new FakeWorker({ audio: clip });
      return {
        onmessage: null as ((event: MessageEvent) => void) | null,
        postMessage(message: { id: number; text: string }) {
          requests.push(message.text);
          worker.onmessage = this.onmessage ?? null;
          worker.postMessage(message);
        },
      };
    },
  });
  voice.play('Play C.');
  await settle();
  assert.match(voice.state.message, /ready.*Replay/i);
  assert.equal(fakes.speech.utterances.length, 1);
  assert.equal(audio.plays, 0);
  voice.play('Play C.');
  await settle();
  assert.equal(audio.plays, 1);
  assert.deepEqual(requests, ['Play C.']);
  audio.onended?.();
  voice.warm(['Play C.']);
  await settle();
  assert.match(voice.state.message, /Prepared 0\/1/);
  voice.dispose();
});

test('a failed worker job is isolated and later warm clips still run', async () => {
  const cache = new MemoryCache();
  const workers: FakeWorker[] = [];
  const messages: string[] = [];
  const voice = createVoice(state => messages.push(state.message), () => {}, {
    cache,
    audioFactory: () => new FakeAudio(),
    workerFactory: () => {
      const worker = new FakeWorker(workers.length === 0 ? { error: 'failed' } : { audio: clip });
      workers.push(worker);
      return worker;
    },
  });
  voice.warm(['failed prompt', 'good prompt']);
  await settle();
  assert.equal(workers.length, 2);
  assert.equal(cache.values.has(voiceCacheKey('good prompt')), true);
  assert.equal(voice.state.warming, undefined);
  assert.match(messages.at(-1)!, /Prepared 1\/2 clips/);
});

test('a stalled clip does not stop priority and duplicate jobs from completing', async () => {
  const timers = new ManualTimers();
  const generated: string[] = [];
  const cache = new MemoryCache();
  let instanceCount = 0;
  const voice = createVoice(() => {}, () => {}, {
    cache, audioFactory: () => new FakeAudio(),
    setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
    workerFactory: () => {
      const stalled = instanceCount++ === 0;
      const worker = new FakeWorker({ audio: clip });
      return {
        onmessage: null as ((event: MessageEvent) => void) | null,
        postMessage(message: { id: number; text: string }) {
          generated.push(message.text);
          if (!stalled) {
            worker.onmessage = this.onmessage ?? null;
            worker.postMessage(message);
          }
        },
        terminate() { worker.terminate(); },
      };
    },
  });
  voice.warm(['stalled', 'rest of catalog']);
  await settle();
  voice.prepare(['next stage', 'next stage']);
  timers.fire(120_000);
  await settle();
  assert.deepEqual(generated, ['stalled', 'next stage', 'rest of catalog']);
  assert.equal(cache.values.has(voiceCacheKey('stalled')), false);
  assert.equal(cache.values.has(voiceCacheKey('next stage')), true);
  assert.equal(cache.values.has(voiceCacheKey('rest of catalog')), true);
  voice.dispose();
});

test('browser-only preference persists and skips neural preparation', () => {
  const storage = new MemoryStorage();
  const fakes = browserFakes();
  const cache = new MemoryCache();
  const voice = createVoice(() => {}, () => {}, { ...fakes.dependencies, localStorage: storage, cache, audioFactory: () => new FakeAudio() });
  voice.setEngine('browser');
  voice.setEnabled(false);
  assert.equal(storage.values.get('keycraft-spoken-prompts'), 'off');
  assert.equal(storage.values.get('keycraft-voice-engine'), 'browser');
  voice.setEnabled(true);
  voice.prepare(['next stage']);
  assert.equal(cache.writes.length, 0);
});
