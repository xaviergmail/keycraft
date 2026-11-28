export type VoiceEngine = 'neural' | 'browser';

export interface VoiceState {
  enabled: boolean;
  engine: VoiceEngine;
  neuralAvailable: boolean;
  browserAvailable: boolean;
  message: string;
  warming?: { done: number; total: number };
}

interface AudioLike {
  paused?: boolean;
  onplaying?: (() => void) | null;
  onended?: (() => void) | null;
  onerror?: ((event?: unknown) => void) | null;
  play: () => void | Promise<void>;
  pause?: () => void;
}

interface SpeechUtteranceLike {
  text: string;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event?: unknown) => void) | null;
}

interface SpeechSynthesisLike {
  speak: (utterance: SpeechUtteranceLike) => void;
  cancel: () => void;
}

interface WorkerResult {
  id?: number;
  status?: string;
  audio?: unknown;
  error?: string;
}

interface WorkerLike {
  onmessage?: ((event: MessageEvent<WorkerResult | undefined>) => void) | null;
  onerror?: ((event: ErrorEvent) => void) | null;
  postMessage(message: { id: number; text: string; voice: string; speed: number }): void;
  terminate?: () => void;
}

interface CacheLike {
  get: (key: string) => unknown;
  put: (key: string, value: unknown) => unknown;
  delete?: (key: string) => unknown;
}

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

export interface VoiceDependencies {
  Audio?: new (url: string) => AudioLike;
  audioFactory?: (url: string) => AudioLike;
  SpeechSynthesisUtterance?: new (text: string) => SpeechUtteranceLike;
  speechSynthesis?: SpeechSynthesisLike;
  workerFactory?: () => WorkerLike;
  worker?: WorkerLike;
  URL?: {
    createObjectURL?: (value: Blob) => string;
    revokeObjectURL?: (url: string) => void;
  };
  indexedDB?: IDBFactory;
  cache?: CacheLike;
  localStorage?: StorageLike;
  navigator?: { onLine?: boolean; speechSynthesis?: SpeechSynthesisLike };
  online?: boolean;
  setTimeout?: (handler: () => void, delay: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
  cacheDeadlineMs?: number;
  workerTimeoutMs?: number;
}

export interface VoiceController {
  readonly state: VoiceState;
  play(text: string): void;
  stop(): void;
  prepare(texts: Iterable<string>): void;
  warm(texts: Iterable<string>): void;
  setEnabled(enabled: boolean): void;
  setEngine(engine: VoiceEngine): void;
  dispose(): void;
}

export const NEURAL_AUDIO_VERSION = 'kokoro-js@1.2.1/kokoro-82m-v1.0-onnx/q8';
export const NEURAL_VOICE = 'af_heart';
export const NEURAL_SPEED = 1;
export const VOICE_CACHE_NAME = 'keycraft-prompt-audio';
export const VOICE_CACHE_STORE = 'clips';
export const VOICE_PREFERENCE_KEY = 'keycraft-spoken-prompts';
export const VOICE_ENGINE_KEY = 'keycraft-voice-engine';
const CACHE_DEADLINE_MS = 100;
const WORKER_TIMEOUT_MS = 120_000;
const RECENT_CLIP_LIMIT = 8;
type Preparation = 'cached' | 'temporary' | 'unavailable';

export function voiceCacheKey(text: string): string {
  return JSON.stringify([NEURAL_AUDIO_VERSION, NEURAL_VOICE, NEURAL_SPEED, text]);
}

function mergeDependencies(dependencies: readonly VoiceDependencies[]): VoiceDependencies {
  const merged: VoiceDependencies = {};
  for (const dependency of dependencies) {
    if (dependency && typeof dependency === 'object') Object.assign(merged, dependency);
  }
  return merged;
}

function browserGlobal(): Record<string, unknown> {
  return typeof globalThis === 'undefined' ? {} : globalThis as unknown as Record<string, unknown>;
}

function getStorage(dependencies: VoiceDependencies): StorageLike | undefined {
  try {
    return dependencies.localStorage ?? (typeof window === 'undefined' ? undefined : window.localStorage);
  } catch {
    return undefined;
  }
}

function getSpeechSynthesis(dependencies: VoiceDependencies): SpeechSynthesisLike | undefined {
  const explicit = dependencies.speechSynthesis;
  if (explicit) return explicit;
  const candidate = browserGlobal().speechSynthesis;
  return candidate && typeof candidate === 'object' ? candidate as SpeechSynthesisLike : undefined;
}

function getUtteranceConstructor(dependencies: VoiceDependencies): (new (text: string) => SpeechUtteranceLike) | undefined {
  const explicit = dependencies.SpeechSynthesisUtterance;
  if (explicit) return explicit;
  const candidate = browserGlobal().SpeechSynthesisUtterance;
  return typeof candidate === 'function' ? candidate as new (text: string) => SpeechUtteranceLike : undefined;
}

function getAudioFactory(dependencies: VoiceDependencies): ((url: string) => AudioLike) | undefined {
  if (dependencies.audioFactory) return dependencies.audioFactory;
  if (dependencies.Audio) return (url: string) => new dependencies.Audio!(url);
  const candidate = browserGlobal().Audio;
  if (typeof candidate !== 'function') return undefined;
  return (url: string) => new (candidate as new (url: string) => AudioLike)(url);
}

function normalizeBrowserText(text: string): string {
  return text.replace(/\bEh\b/g, 'A,');
}

function uniqueTexts(texts: Iterable<string>): string[] {
  const seen = new Set<string>();
  for (const text of texts) if (text && !seen.has(text)) seen.add(text);
  return [...seen];
}

function isNotAllowed(error: unknown): boolean {
  if (typeof error === 'string') {
    const message = error.toLowerCase();
    return message.includes('notallowed') || message.includes('not allowed');
  }
  if (!error || typeof error !== 'object') return false;
  const value = error as { name?: unknown; error?: unknown; message?: unknown };
  const name = String(value.name ?? '').toLowerCase();
  const reason = String(value.error ?? '').toLowerCase();
  const message = String(value.message ?? '').toLowerCase();
  return name === 'notallowederror' || reason === 'not-allowed' || message.includes('not allowed');
}

function clipBlob(value: unknown): value is Blob {
  return typeof Blob !== 'undefined' && value instanceof Blob;
}

export function createVoice(
  onStatus: (state: VoiceState) => void,
  onPlaying: (playing: boolean) => void,
  ...injected: readonly VoiceDependencies[]
): VoiceController {
  const dependencies = mergeDependencies(injected);
  const globals = browserGlobal();
  const speechSynthesis = getSpeechSynthesis(dependencies);
  const utteranceConstructor = getUtteranceConstructor(dependencies);
  const audioFactory = getAudioFactory(dependencies);
  const workerFactory: (() => WorkerLike) | undefined = dependencies.workerFactory ?? (typeof Worker === 'undefined'
    ? undefined
    : () => new Worker(new URL('./voice-worker.ts', import.meta.url), { type: 'module' }));
  const directWorker = dependencies.worker;
  const cacheAdapter = dependencies.cache;
  const indexedDatabase = dependencies.indexedDB ?? (globals.indexedDB as IDBFactory | undefined);
  const storage = getStorage(dependencies);
  const navigatorLike = dependencies.navigator ?? (globals.navigator as { onLine?: boolean; speechSynthesis?: SpeechSynthesisLike } | undefined);
  const browserAvailable = Boolean(speechSynthesis && utteranceConstructor);
  const neuralAvailable = Boolean(audioFactory && (workerFactory || directWorker || cacheAdapter || indexedDatabase));
  const deadlineMs = dependencies.cacheDeadlineMs ?? CACHE_DEADLINE_MS;
  const workerTimeoutMs = dependencies.workerTimeoutMs ?? WORKER_TIMEOUT_MS;
  const schedule = dependencies.setTimeout ?? ((handler: () => void, delay: number) => globalThis.setTimeout(handler, delay));
  const cancelSchedule = dependencies.clearTimeout ?? ((handle: unknown) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>));
  const online = (): boolean => dependencies.online ?? navigatorLike?.onLine !== false;

  let enabledPreference = true;
  let enginePreference: VoiceEngine | undefined;
  try {
    enabledPreference = storage?.getItem(VOICE_PREFERENCE_KEY) !== 'off';
    const savedEngine = storage?.getItem(VOICE_ENGINE_KEY);
    if (savedEngine === 'neural' || savedEngine === 'browser') enginePreference = savedEngine;
  } catch {
    enabledPreference = true;
  }

  const state: VoiceState = {
    enabled: enabledPreference && (neuralAvailable || browserAvailable),
    engine: enginePreference === 'browser' && browserAvailable ? 'browser' : neuralAvailable ? 'neural' : 'browser',
    neuralAvailable,
    browserAvailable,
    message: !enabledPreference ? 'Spoken prompts off.' : neuralAvailable || browserAvailable ? 'Spoken prompts on.' : 'Speech unavailable.',
  };

  let generation = 0;
  let disposed = false;
  let foregroundText: string | undefined;
  let activePlayback: {
    token: number;
    text: string;
    audio?: AudioLike;
    url?: string;
    started: boolean;
    watchdog?: unknown;
  } | undefined;
  let worker: WorkerLike | undefined = directWorker;
  let workerRequest = 0;
  let activeJob: Job | undefined;
  let activeGenerateResolve: ((value: unknown) => void) | undefined;
  let workerTimer: unknown;
  let foregroundLookup: number | undefined;
  let warmGeneration = 0;
  const queue: Job[] = [];
  const pendingJobs = new Map<string, Job>();
  const recentClips = new Map<string, Blob>();
  let databasePromise: Promise<IDBDatabase | undefined> | undefined;

  interface Job {
    key: string;
    text: string;
    priority: number;
    resolve: (result: Preparation) => void;
    promise: Promise<Preparation>;
  }

  const emitState = (patch?: Partial<VoiceState>): void => {
    if (patch) Object.assign(state, patch);
    onStatus({ ...state, warming: state.warming ? { ...state.warming } : undefined });
  };

  const setMessage = (message: string): void => emitState({ message });

  const persist = (): void => {
    try {
      if (state.enabled) storage?.setItem(VOICE_PREFERENCE_KEY, 'on');
      else storage?.setItem(VOICE_PREFERENCE_KEY, 'off');
      storage?.setItem(VOICE_ENGINE_KEY, state.engine);
    } catch {
      // Voice settings are best effort and never gate practice.
    }
  };

  const isCurrent = (token: number): boolean => !disposed && token === generation;

  const releasePlayback = (playback: NonNullable<typeof activePlayback>): void => {
    if (playback.watchdog !== undefined) cancelSchedule(playback.watchdog);
    playback.watchdog = undefined;
    if (playback.started) {
      playback.started = false;
      onPlaying(false);
    }
  };

  const revokePlayback = (playback: NonNullable<typeof activePlayback>): void => {
    releasePlayback(playback);
    playback.audio?.pause?.();
    if (playback.url) {
      const urlApi = dependencies.URL ?? globals.URL as { revokeObjectURL?: (url: string) => void } | undefined;
      urlApi?.revokeObjectURL?.(playback.url);
    }
  };

  const finishPlayback = (token: number, message?: string, expected?: NonNullable<typeof activePlayback>): void => {
    const playback = activePlayback;
    if (!playback || playback.token !== token || (expected !== undefined && playback !== expected)) return;
    revokePlayback(playback);
    activePlayback = undefined;
    if (message !== undefined) setMessage(message);
  };

  const beginPlayback = (token: number, expected?: NonNullable<typeof activePlayback>): void => {
    const playback = activePlayback;
    if (!playback || playback.token !== token || (expected !== undefined && playback !== expected) || playback.started || !isCurrent(token)) return;
    playback.started = true;
    onPlaying(true);
    if (!isCurrent(token) || activePlayback !== playback) return;
    const timeout = Math.max(12_000, playback.text.length * 120);
    playback.watchdog = schedule(() => {
      if (isCurrent(token)) {
        speechSynthesis?.cancel();
        finishPlayback(token, 'Voice playback timed out. Replay to try again.', playback);
      }
    }, timeout);
  };


  const speakBrowser = (text: string, token: number): void => {
    if (!isCurrent(token) || !browserAvailable || !speechSynthesis || !utteranceConstructor) return;
    const playback: NonNullable<typeof activePlayback> = { token, text, started: false };
    activePlayback = playback;
    let utterance: SpeechUtteranceLike;
    try {
      utterance = new utteranceConstructor(normalizeBrowserText(text));
      utterance.lang = 'en-US';
      utterance.onstart = () => beginPlayback(token, playback);
      utterance.onend = () => finishPlayback(token, undefined, playback);
      utterance.onerror = (event?: unknown) => {
        const message = isNotAllowed(event) ? 'Select Replay prompt to allow audio playback.' : 'Browser voice could not play. Replay to try again.';
        finishPlayback(token, message, playback);
      };
      speechSynthesis.speak(utterance);
    } catch (error) {
      const message = isNotAllowed(error) ? 'Select Replay prompt to allow audio playback.' : 'Browser voice could not start. Replay to try again.';
      finishPlayback(token, message, playback);
    }
  };

  const playAudio = (clip: Blob, text: string, token: number, key: string): void => {
    const urlApi = dependencies.URL ?? globalThis.URL;
    let url: string | undefined;
    let playback: NonNullable<typeof activePlayback> | undefined;
    const fail = (error: unknown) => {
      if (!isCurrent(token)) return;
      if (playback) {
        if (activePlayback !== playback) return;
        finishPlayback(token, undefined, playback);
      } else if (url) urlApi.revokeObjectURL?.(url);
      fallbackAfterNeuralFailure(text, token, key, isNotAllowed(error));
    };
    try {
      if (!audioFactory) throw new Error('Audio playback is unavailable');
      url = urlApi.createObjectURL?.(clip);
      if (!url) throw new Error('Audio object URLs are unavailable');
      const audio = audioFactory(url);
      const current = { token, text, audio, url, started: false };
      activePlayback = playback = current;
      audio.onplaying = () => beginPlayback(token, current);
      audio.onended = () => finishPlayback(token, 'Kokoro voice ready.', current);
      audio.onerror = fail;
      void Promise.resolve(audio.play()).catch(fail);
    } catch (error) {
      fail(error);
    }
  };

  const openDatabase = (): Promise<IDBDatabase | undefined> => {
    if (cacheAdapter || !indexedDatabase) return Promise.resolve(undefined);
    if (!databasePromise) {
      databasePromise = new Promise((resolve) => {
        let request: IDBOpenDBRequest;
        try {
          request = indexedDatabase.open(VOICE_CACHE_NAME, 1);
        } catch {
          resolve(undefined);
          return;
        }
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(VOICE_CACHE_STORE)) database.createObjectStore(VOICE_CACHE_STORE);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(undefined);
        request.onblocked = () => resolve(undefined);
      });
    }
    return databasePromise;
  };

  const cacheGet = async (key: string): Promise<unknown> => {
    if (cacheAdapter) {
      try {
        return await cacheAdapter.get(key);
      } catch {
        return undefined;
      }
    }
    const database = await openDatabase();
    if (!database) return undefined;
    try {
      return await new Promise<unknown>((resolve) => {
        const transaction = database.transaction(VOICE_CACHE_STORE, 'readonly');
        const request = transaction.objectStore(VOICE_CACHE_STORE).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(undefined);
      });
    } catch {
      return undefined;
    }
  };

  const cachePut = async (key: string, value: Blob): Promise<boolean> => {
    try {
      if (cacheAdapter) {
        await cacheAdapter.put(key, value);
        return true;
      }
      const database = await openDatabase();
      if (!database) return false;
      return await new Promise<boolean>(resolve => {
        const transaction = database.transaction(VOICE_CACHE_STORE, 'readwrite');
        transaction.objectStore(VOICE_CACHE_STORE).put(value, key);
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => resolve(false);
        transaction.onabort = () => resolve(false);
      });
    } catch {
      return false;
    }
  };

  const cacheDelete = async (key: string): Promise<void> => {
    if (cacheAdapter?.delete) {
      try { await cacheAdapter.delete(key); } catch { /* optional */ }
      return;
    }
    const database = await openDatabase();
    if (!database) return;
    try {
      await new Promise<void>((resolve) => {
        const transaction = database.transaction(VOICE_CACHE_STORE, 'readwrite');
        transaction.objectStore(VOICE_CACHE_STORE).delete(key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
        transaction.onabort = () => resolve();
      });
    } catch {
      // Storage is optional.
    }
  };

  const withinCacheDeadline = async <T>(operation: Promise<T>): Promise<T | undefined> => {
    let timer: unknown;
    const timeout = new Promise<undefined>((resolve) => {
      timer = schedule(() => resolve(undefined), deadlineMs);
    });
    try {
      return await Promise.race([operation, timeout]);
    } finally {
      if (timer !== undefined) cancelSchedule(timer);
    }
  };

  const terminateWorker = (): void => {
    if (workerTimer !== undefined) cancelSchedule(workerTimer);
    workerTimer = undefined;
    const reusable = worker === directWorker && !worker?.terminate;
    worker?.terminate?.();
    worker = reusable ? directWorker : undefined;
  };

  const generate = (job: Job): Promise<unknown> => new Promise((resolve) => {
    activeGenerateResolve = resolve;
    if (!isGenerationAllowed()) {
      activeGenerateResolve = undefined;
      resolve(undefined);
      return;
    }
    try {
      const instance = worker ?? workerFactory?.();
      if (!instance) {
        activeGenerateResolve = undefined;
        resolve(undefined);
        return;
      }
      worker = instance;
      const requestId = ++workerRequest;
      const timeout = schedule(() => {
        if (worker !== instance || activeJob !== job) return;
        if (workerTimer !== undefined) cancelSchedule(workerTimer);
        workerTimer = undefined;
        instance.onmessage = null;
        instance.onerror = null;
        activeGenerateResolve = undefined;
        terminateWorker();
        resolve(undefined);
      }, workerTimeoutMs);
      workerTimer = timeout;
      const finish = (value: unknown): void => {
        if (worker !== instance || activeJob !== job) return;
        if (workerTimer !== undefined) cancelSchedule(workerTimer);
        workerTimer = undefined;
        instance.onmessage = null;
        instance.onerror = null;
        activeGenerateResolve = undefined;
        resolve(value);
      };
      instance.onmessage = (event) => {
        const data = event.data;
        if (!data || (data.id !== undefined && data.id !== requestId)) return;
        if (data.status) {
          if ((state.warming || foregroundText === job.text) && state.message !== data.status) setMessage(data.status);
          return;
        }
        if (data.error) {
          finish(undefined);
          terminateWorker();
          return;
        }
        finish(data.audio);
      };
      instance.onerror = () => {
        finish(undefined);
        terminateWorker();
      };
      instance.postMessage({ id: requestId, text: job.text, voice: NEURAL_VOICE, speed: NEURAL_SPEED });
    } catch {
      activeGenerateResolve = undefined;
      terminateWorker();
      resolve(undefined);
    }
  });

  const isGenerationAllowed = (): boolean => state.enabled && state.engine === 'neural' && state.neuralAvailable && online() && !disposed;

  const settleJob = (job: Job, result: Preparation): void => {
    if (pendingJobs.get(job.key) !== job) return;
    pendingJobs.delete(job.key);
    if (activeJob === job) activeJob = undefined;
    job.resolve(result);
    pumpQueue();
  };

  const runJob = async (job: Job): Promise<void> => {
    if (!isGenerationAllowed()) {
      settleJob(job, 'unavailable');
      return;
    }
    const existing = await withinCacheDeadline(cacheGet(job.key));
    if (activeJob !== job) return;
    if (clipBlob(existing)) {
      settleJob(job, 'cached');
      return;
    }
    const generated = recentClips.get(job.key) ?? await generate(job);
    if (activeJob !== job) return;
    if (!clipBlob(generated)) {
      settleJob(job, 'unavailable');
      return;
    }
    if (job.priority > 1) {
      recentClips.delete(job.key);
      recentClips.set(job.key, generated);
      if (recentClips.size > RECENT_CLIP_LIMIT) recentClips.delete(recentClips.keys().next().value!);
    }
    const stored = await withinCacheDeadline(cachePut(job.key, generated));
    settleJob(job, stored ? 'cached' : recentClips.has(job.key) ? 'temporary' : 'unavailable');
  };

  const pumpQueue = (): void => {
    if (foregroundLookup !== undefined || activeJob || queue.length === 0 || !isGenerationAllowed()) return;
    queue.sort((left, right) => right.priority - left.priority);
    const job = queue.shift()!;
    activeJob = job;
    void runJob(job).catch(() => settleJob(job, 'unavailable'));
  };

  const enqueue = (text: string, priority: number): Promise<Preparation> => {
    if (!isGenerationAllowed()) return Promise.resolve('unavailable');
    const key = voiceCacheKey(text);
    const existing = pendingJobs.get(key);
    if (existing) {
      existing.priority = Math.max(existing.priority, priority);
      return existing.promise;
    }
    const { promise, resolve } = Promise.withResolvers<Preparation>();
    const job: Job = { key, text, priority, resolve, promise };
    pendingJobs.set(key, job);
    queue.push(job);
    pumpQueue();
    return promise;
  };

  const cancelQueue = (): void => {
    const jobs = [...pendingJobs.values()];
    const activeResolver = activeGenerateResolve;
    activeGenerateResolve = undefined;
    queue.length = 0;
    pendingJobs.clear();
    activeJob = undefined;
    terminateWorker();
    activeResolver?.(undefined);
    for (const job of jobs) job.resolve('unavailable');
  };

  const fallbackAfterNeuralFailure = (text: string, token: number, key: string, notAllowed: boolean): void => {
    if (!isCurrent(token)) return;
    if (notAllowed) {
      setMessage('Select Replay prompt to allow audio playback.');
      return;
    }
    recentClips.delete(key);
    void cacheDelete(key);
    if (browserAvailable) {
      setMessage('Neural voice unavailable. Using browser voice.');
      speakBrowser(text, token);
    } else setMessage('Neural voice unavailable. Replay to try again.');
  };

  const playNeural = async (text: string, token: number): Promise<void> => {
    const key = voiceCacheKey(text);
    foregroundLookup = token;
    const cached = recentClips.get(key) ?? await withinCacheDeadline(cacheGet(key));
    if (foregroundLookup === token) foregroundLookup = undefined;
    if (isCurrent(token)) {
      if (clipBlob(cached)) playAudio(cached, text, token, key);
      else {
        if (browserAvailable) speakBrowser(text, token);
        if (isGenerationAllowed()) {
          if (!browserAvailable) setMessage('Neural voice is preparing. Replay when it is ready.');
          void enqueue(text, 3).then(result => {
            if (!isCurrent(token)) return;
            setMessage(result === 'unavailable' ? 'Neural voice could not prepare this prompt. Replay to try again.' :
              'Neural prompt ready. Replay to listen.');
          });
        } else if (!browserAvailable) setMessage('Voice clip is not cached. Follow the written prompt.');
      }
    }
    pumpQueue();
  };

  const play = (text: string): void => {
    stop();
    if (!text || !state.enabled) return;
    const token = generation;
    if (state.engine === 'browser' || !state.neuralAvailable) {
      if (browserAvailable) speakBrowser(text, token);
      else setMessage('Speech is unavailable. Replay when audio is available.');
      return;
    }
    foregroundText = text;
    void playNeural(text, token).catch(() => {
      if (isCurrent(token)) setMessage('Voice is unavailable. Replay to try again.');
    });
  };

  const stop = (): void => {
    generation += 1;
    foregroundText = undefined;
    speechSynthesis?.cancel();
    const playback = activePlayback;
    activePlayback = undefined;
    if (playback) revokePlayback(playback);
  };

  const prepare = (texts: Iterable<string>): void => {
    if (!isGenerationAllowed()) return;
    for (const text of uniqueTexts(texts)) void enqueue(text, 2);
  };

  const warm = (texts: Iterable<string>): void => {
    const list = uniqueTexts(texts);
    const token = ++warmGeneration;
    if (!isGenerationAllowed()) {
      setMessage(state.engine === 'browser' ? 'Browser voice selected; neural warmup skipped.' : 'Voice warmup is unavailable while muted or offline.');
      return;
    }
    state.warming = { done: 0, total: list.length };
    setMessage('Preparing neural voice (~90 MB model)…');
    void (async () => {
      let prepared = 0;
      for (const text of list) {
        if (token !== warmGeneration) return;
        if (!isGenerationAllowed()) break;
        const result = await enqueue(text, 1);
        if (token !== warmGeneration) return;
        if (result === 'cached') prepared += 1;
        emitState({ warming: { done: prepared, total: list.length } });
      }
      if (token !== warmGeneration) return;
      emitState({
        warming: undefined,
        message: prepared === list.length ? 'Neural voice catalog ready.' :
          `Prepared ${prepared}/${list.length} clips. Warm the catalog again to retry missing clips.`,
      });
    })().catch(() => {
      if (token === warmGeneration) emitState({ warming: undefined, message: 'Neural voice warmup could not finish.' });
    });
  };

  const setEnabled = (value: boolean): void => {
    const next = value && (state.neuralAvailable || state.browserAvailable);
    if (!next) {
      warmGeneration += 1;
      stop();
      cancelQueue();
      state.warming = undefined;
    }
    state.enabled = next;
    persist();
    setMessage(next ? 'Spoken prompts on.' : 'Spoken prompts off.');
  };

  const setEngine = (engine: VoiceEngine): void => {
    if (state.engine === engine) return;
    warmGeneration += 1;
    stop();
    cancelQueue();
    state.warming = undefined;
    state.engine = engine;
    persist();
    setMessage(engine === 'browser' ? 'Using browser voice.' : state.neuralAvailable ? 'Using Kokoro voice.' : 'Kokoro voice is unavailable.');
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    warmGeneration += 1;
    stop();
    cancelQueue();
    recentClips.clear();
    databasePromise = undefined;
  };

  const controller: VoiceController = { state, play, stop, prepare, warm, setEnabled, setEngine, dispose };
  emitState();
  return controller;
}
