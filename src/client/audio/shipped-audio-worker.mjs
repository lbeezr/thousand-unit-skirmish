import { loadShippedAudio } from '../../audio-shipped-loader.mjs';

const MAX_PENDING_LOADS = 8;

// Export the actual message endpoint for CPU contract tests. Production uses
// the canonical loader unchanged, including its hash/MIME/size/deadline gates.
export function createShippedAudioWorkerEndpoint({ load = loadShippedAudio, postMessage } = {}) {
  const requests = new Map();
  let disposed = false, lastRequestId = 0;
  return {
    handleMessage(message) {
      if (disposed || !message || !Number.isSafeInteger(message.requestId) || message.requestId <= 0) return;
      const { requestId } = message;
      if (message.type === 'abort') { requests.get(requestId)?.abort(); return; }
      if (message.type !== 'load' || requestId <= lastRequestId) return;
      lastRequestId = requestId;
      if (requests.size >= MAX_PENDING_LOADS) {
        postMessage({ type: 'failed', requestId, cancelled: false }); return;
      }
      const controller = new AbortController();
      requests.set(requestId, controller);
      return Promise.resolve().then(() => {
        if (controller.signal.aborted) throw new Error('cancelled');
        return load(message.reference, { signal: controller.signal });
      }).then(loaded => {
        if (!disposed && !controller.signal.aborted) postMessage({ type: 'loaded', requestId, loaded });
      }).catch(() => {
        if (!disposed) postMessage({ type: 'failed', requestId, cancelled: controller.signal.aborted });
      }).finally(() => { requests.delete(requestId); });
    },
    dispose() {
      disposed = true;
      for (const controller of requests.values()) controller.abort();
      requests.clear();
    },
  };
}

// Importing the endpoint for tests or tooling must never install a page handler.
if (typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope) {
  const endpoint = createShippedAudioWorkerEndpoint({ postMessage: message => globalThis.postMessage(message) });
  globalThis.addEventListener('message', event => { void endpoint.handleMessage(event.data); });
}
