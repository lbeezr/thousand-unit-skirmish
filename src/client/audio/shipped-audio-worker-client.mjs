import { loadShippedAudio } from '../../audio-shipped-loader.mjs';

const MAX_PENDING_LOADS = 8;
const failure = () => new Error('Shipped audio worker unavailable');
const aborted = () => Object.assign(new Error('Audio load cancelled'), { name: 'AbortError' });

// One worker belongs to one audio runtime. Verified Blob caching stays inside
// the canonical loader in that worker; no retries or second cache live here.
export function createShippedAudioLoader({ Worker = globalThis.Worker, directLoader = loadShippedAudio,
  scheduleTimeout = globalThis.setTimeout, cancelTimeout = globalThis.clearTimeout } = {}) {
  const pending = new Map();
  let worker = null, nextRequestId = 1, disposed = false, failed = false;
  const finish = (id, error, value) => {
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id); request.cleanup();
    if (error) request.reject(error); else request.resolve(value);
  };
  const releaseWorker = () => {
    if (!worker) return;
    worker.removeEventListener('message', onMessage);
    worker.removeEventListener('error', onError);
    worker.removeEventListener('messageerror', onError);
    worker.terminate(); worker = null;
  };
  const onError = () => {
    failed = true;
    for (const id of [...pending.keys()]) finish(id, failure());
    releaseWorker();
  };
  const onMessage = ({ data }) => {
    if (!data || !Number.isSafeInteger(data.requestId) || !pending.has(data.requestId)) return;
    if (data.type === 'loaded') finish(data.requestId, null, data.loaded);
    else if (data.type === 'failed') finish(data.requestId,
      data.cancelled ? aborted() : new Error('Shipped audio pack could not load'));
  };
  return {
    load(reference, { signal } = {}) {
      if (disposed || signal?.aborted) return Promise.reject(aborted());
      if (failed) return Promise.reject(failure());
      if (pending.size >= MAX_PENDING_LOADS || !Number.isSafeInteger(nextRequestId)) {
        return Promise.reject(new Error('Too many pending audio loads'));
      }
      const requestId = nextRequestId++, controller = new AbortController();
      return new Promise((resolve, reject) => {
        let timer = null;
        const cancelWorkerRequest = () => {
          try { worker?.postMessage({ type: 'abort', requestId }); } catch { onError(); }
        };
        const onAbort = () => {
          controller.abort();
          finish(requestId, aborted());
          cancelWorkerRequest();
        };
        pending.set(requestId, { resolve, reject, controller,
          cleanup: () => { signal?.removeEventListener('abort', onAbort); if (timer !== null) cancelTimeout(timer); } });
        signal?.addEventListener('abort', onAbort, { once: true });
        // Also bound worker startup/module-fetch silence before its own canonical
        // 30-second deadline can begin. A timeout never retries or changes lane.
        timer = scheduleTimeout(() => {
          controller.abort();
          finish(requestId, Object.assign(new Error('Shipped audio load timed out'), { name: 'TimeoutError' }));
          cancelWorkerRequest();
        }, 30_000);
        if (typeof Worker !== 'function') {
          void Promise.resolve().then(() => {
            if (!pending.has(requestId)) throw aborted();
            return directLoader(reference, { signal: controller.signal });
          }).then(value => finish(requestId, null, value), error => finish(requestId, error));
          return;
        }
        try {
          if (!worker) {
            worker = new Worker(new URL('./shipped-audio-worker.mjs', import.meta.url), { type: 'module' });
            worker.addEventListener('message', onMessage);
            worker.addEventListener('error', onError);
            worker.addEventListener('messageerror', onError);
          }
          worker.postMessage({ type: 'load', requestId, reference });
        } catch { onError(); }
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const [id, request] of [...pending]) {
        request.controller.abort(); finish(id, aborted());
      }
      releaseWorker();
    },
  };
}
