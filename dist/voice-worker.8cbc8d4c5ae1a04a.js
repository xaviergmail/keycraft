const KOKORO_URL = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm';
const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const DTYPE = 'q8';
let model;

self.onmessage = async ({ data: { text, voice, speed } }) => {
  try {
    if (!model) {
      self.postMessage({ status: 'Loading neural voice…' });
      const { KokoroTTS } = await import(KOKORO_URL);
      model = await KokoroTTS.from_pretrained(MODEL, {
        dtype: DTYPE,
        device: 'wasm',
        progress_callback(progress) {
          if (progress.status === 'progress' && progress.file?.endsWith('.onnx')) {
            self.postMessage({ status: `Loading neural voice… ${Math.round(progress.progress)}%` });
          }
        }
      });
    }
    self.postMessage({ status: 'Generating prompt…' });
    const audio = await model.generate(text, { voice, speed });
    self.postMessage({ audio: audio.toBlob() });
  } catch {
    model = undefined;
    self.postMessage({ error: 'Neural voice could not generate this prompt.' });
  }
};
