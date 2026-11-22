'use strict';

const NEURAL_VOICE = 'af_heart';
const NEURAL_SPEED = 1;
const NEURAL_AUDIO_VERSION = 'kokoro-js@1.2.1/kokoro-82m-v1.0-onnx/q8';
const neuralVoiceAvailable = Boolean(window.Worker && window.Audio);
let neuralWorker;
let audioDatabase;
let neuralQueue = Promise.resolve();

function openAudioDatabase() {
  if (!audioDatabase) {
    audioDatabase = new Promise((resolve, reject) => {
      const request = indexedDB.open('keycraft-prompt-audio', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('clips');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Audio cache is blocked'));
    });
  }
  return audioDatabase;
}

async function cachedPrompt(key, audio) {
  try {
    const database = await openAudioDatabase();
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction('clips', audio ? 'readwrite' : 'readonly');
      const store = transaction.objectStore('clips');
      const request = audio ? store.put(audio, key) : store.get(key);
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch {
    return undefined;
  }
}

function generateNeuralPrompt(text, report) {
  return new Promise((resolve, reject) => {
    neuralWorker ||= new Worker('neural-voice-worker.js', { type: 'module' });
    const worker = neuralWorker;
    const timeout = setTimeout(() => {
      worker.terminate();
      neuralWorker = undefined;
      reject(new Error('Neural voice timed out.'));
    }, 120000);
    worker.onmessage = ({ data }) => {
      if (data.status) report(data.status);
      else {
        clearTimeout(timeout);
        if (data.error) reject(new Error(data.error));
        else resolve(data.audio);
      }
    };
    worker.onerror = () => {
      clearTimeout(timeout);
      worker.terminate();
      neuralWorker = undefined;
      reject(new Error('Neural voice could not start.'));
    };
    neuralWorker.postMessage({ text, voice: NEURAL_VOICE, speed: NEURAL_SPEED });
  });
}

function voiceCacheKey(text) {
  return JSON.stringify([NEURAL_AUDIO_VERSION, NEURAL_VOICE, NEURAL_SPEED, text]);
}

async function neuralPrompt(text, isCurrent, report, requireCache = false) {
  const key = voiceCacheKey(text);
  const cached = await cachedPrompt(key);
  if (cached || !isCurrent()) return cached;
  const job = neuralQueue.then(async () => {
    if (!isCurrent()) return undefined;
    const existing = await cachedPrompt(key);
    if (existing || !isCurrent()) return existing;
    const audio = await generateNeuralPrompt(text, report);
    if (!audio?.size) throw new Error('Neural voice returned an empty prompt.');
    const stored = await cachedPrompt(key, audio);
    if (requireCache && !stored) return undefined;
    return audio;
  });
  neuralQueue = job.catch(() => {});
  return job;
}

let voiceCacheRunning = false;

async function warmVoiceCache(lines, enabled, report) {
  if (voiceCacheRunning || !enabled()) return;
  voiceCacheRunning = true;
  try {
    const database = await openAudioDatabase();
    const keys = await new Promise((resolve, reject) => {
      const request = database.transaction('clips').objectStore('clips').getAllKeys();
      request.onsuccess = () => resolve(new Set(request.result));
      request.onerror = () => reject(request.error);
    });
    if (!enabled()) return;
    const missing = lines.filter(text => !keys.has(voiceCacheKey(text)));
    let done = lines.length - missing.length;
    report(done, lines.length);
    for (const text of missing) {
      await new Promise(resolve => setTimeout(resolve, 120));
      if (!enabled()) return;
      const clip = await neuralPrompt(text, enabled, () => {}, true).catch(() => undefined);
      if (!enabled()) return;
      if (!clip) continue;
      report(++done, lines.length);
    }
    if (done < lines.length && enabled()) report(null, lines.length);
  } catch {
    if (enabled()) report(null, lines.length);
  } finally {
    voiceCacheRunning = false;
  }
}
