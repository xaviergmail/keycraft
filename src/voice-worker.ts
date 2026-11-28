const KOKORO_URL = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm';
const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const DTYPE = 'q8';

interface WorkerMessage {
  id?: number;
  text?: string;
  voice?: string;
  speed?: number;
}

interface WorkerScope {
  onmessage: ((event: { data: WorkerMessage }) => void) | null;
  postMessage: (message: unknown) => void;
}

const scope = globalThis as unknown as WorkerScope;
type KokoroModel = { generate: (text: string, options: { voice: string; speed: number }) => Promise<{ toBlob: () => Blob | Promise<Blob> }> };
let model: KokoroModel | undefined;

scope.onmessage = async (event) => {
  const { id, text, voice = 'af_heart', speed = 1 } = event.data;
  if (!text) return;
  try {
    if (!model) {
      scope.postMessage({ id, status: 'Loading neural voice…' });
      const moduleUrl = KOKORO_URL;
      const module = await import(/* @vite-ignore */ moduleUrl) as {
        KokoroTTS: {
          from_pretrained: (
            modelName: string,
            options: {
              dtype: string;
              device: string;
              progress_callback: (progress: { status?: string; file?: string; progress?: number }) => void;
            },
          ) => Promise<KokoroModel>;
        };
      };
      let modelPercent = -1;
      model = await module.KokoroTTS.from_pretrained(MODEL, {
        dtype: DTYPE,
        device: 'wasm',
        progress_callback(progress) {
          if (progress.status === 'progress' && progress.file?.endsWith('.onnx')) {
            const percent = Math.round(progress.progress ?? 0);
            if (percent === modelPercent) return;
            modelPercent = percent;
            scope.postMessage({ id, status: `Loading neural voice… ${percent}%` });
          }
        },
      });
    }
    scope.postMessage({ id, status: 'Generating prompt…' });
    const audio = await model.generate(text, { voice, speed });
    scope.postMessage({ id, audio: await audio.toBlob() });
  } catch {
    model = undefined;
    scope.postMessage({ id, error: 'Neural voice could not generate this prompt.' });
  }
};
