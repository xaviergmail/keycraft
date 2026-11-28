export interface OfflineState {
  ready: boolean;
  update: boolean;
  message: string;
}

type OfflineCallback = (state: OfflineState) => void;

type WorkerMessage = {
  type?: string;
  version?: string;
};

const unavailable = 'Offline support is unavailable in this browser.';

export function registerOffline(onChange: OfflineCallback): { applyUpdate: () => void; dispose: () => void } {
  let disposed = false;
  let registration: ServiceWorkerRegistration | undefined;
  let state: OfflineState = { ready: false, update: false, message: 'Preparing offline support…' };
  const installing = new Map<ServiceWorker, () => void>();

  const emit = (next: OfflineState) => {
    if (disposed) return;
    state = next;
    onChange(state);
  };

  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    emit({ ready: false, update: false, message: unavailable });
    return { applyUpdate: () => undefined, dispose: () => { disposed = true; } };
  }

  const markReady = () => {
    if (!state.update) emit({ ready: true, update: false, message: 'Offline practice is ready.' });
  };
  const markUpdate = () => emit({ ...state, update: true, message: 'A verified update is ready. Apply it when the drill is idle.' });

  const onMessage = (event: MessageEvent<WorkerMessage>) => {
    if (event.data?.type === 'KEYCRAFT_OFFLINE_READY') markReady();
    else if (event.data?.type === 'KEYCRAFT_UPDATE_READY' && navigator.serviceWorker.controller) markUpdate();
  };

  const watch = (worker: ServiceWorker) => {
    const onState = () => {
      if (worker.state === 'installed') {
        if (navigator.serviceWorker.controller) markUpdate();
        else markReady();
      } else if (worker.state === 'redundant') {
        installing.delete(worker);
      }
    };
    installing.set(worker, onState);
    worker.addEventListener('statechange', onState);
  };

  navigator.serviceWorker.addEventListener('message', onMessage);

  const load = async () => {
    try {
      const script = new URL('./sw.js', document.baseURI);
      const scope = new URL('./', document.baseURI);
      registration = await navigator.serviceWorker.register(script, {
        scope: scope.href,
        updateViaCache: 'none',
      });
      if (registration.installing) watch(registration.installing);
      registration.addEventListener('updatefound', () => {
        if (registration?.installing) watch(registration.installing);
      });
      if (registration.waiting && navigator.serviceWorker.controller) markUpdate();
      const ready = await navigator.serviceWorker.ready;
      if (ready.active) ready.active.postMessage({ type: 'KEYCRAFT_STATUS' });
      if (!state.update && ready.active) markReady();
    } catch {
      emit({ ready: false, update: false, message: 'Offline support could not be prepared; practice remains available online.' });
    }
  };
  void load();

  const applyUpdate = () => {
    if (disposed) return;
    const waiting = registration?.waiting;
    if (!waiting) {
      if (state.update && registration?.active) window.location.reload();
      return;
    }
    let reloaded = false;
    const finish = () => {
      if (reloaded || disposed) return;
      reloaded = true;
      waiting.removeEventListener('statechange', onState);
      navigator.serviceWorker.removeEventListener('controllerchange', finish);
      window.location.reload();
    };
    const onState = () => {
      if (waiting.state === 'activated') finish();
    };
    waiting.addEventListener('statechange', onState);
    navigator.serviceWorker.addEventListener('controllerchange', finish, { once: true });
    waiting.postMessage({ type: 'KEYCRAFT_ACTIVATE' });
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    navigator.serviceWorker.removeEventListener('message', onMessage);
    for (const [worker, listener] of installing) worker.removeEventListener('statechange', listener);
    installing.clear();
  };

  return { applyUpdate, dispose };
}
