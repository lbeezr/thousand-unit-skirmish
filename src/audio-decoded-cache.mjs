// Cached PCM is charged once per source; pending consumers share one decode.
const MAX_BYTES = 24 * 1024 * 1024;

export function createDecodedAudioCache() {
  const retained = new Map();
  const pending = new Map();
  let generation = 0;
  let decodedBytes = 0;

  async function resolve(sourceId, load) {
    if (retained.has(sourceId)) {
      const buffer = retained.get(sourceId);
      retained.delete(sourceId); retained.set(sourceId, buffer);
      return buffer;
    }
    let entry = pending.get(sourceId);
    if (!entry) {
      const ticket = generation;
      entry = { consumers: 0, promise: null };
      entry.promise = Promise.resolve().then(() => {
        if (ticket !== generation) throw new Error('Audio pack changed during decoding');
        return load();
      }).then((buffer) => {
        if (ticket !== generation) throw new Error('Audio pack changed during decoding');
        const bytes = buffer.length * buffer.numberOfChannels * 4;
        if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_BYTES) {
          throw new Error(`Decoded source ${sourceId} exceeds memory limit`);
        }
        while (decodedBytes + bytes > MAX_BYTES && retained.size) {
          const [oldId, oldBuffer] = retained.entries().next().value;
          decodedBytes -= oldBuffer.length * oldBuffer.numberOfChannels * 4;
          retained.delete(oldId);
        }
        retained.set(sourceId, buffer); decodedBytes += bytes;
        return buffer;
      }).finally(() => {
        // A late completion from an old pack must not remove a new same-ID job.
        if (pending.get(sourceId) === entry) pending.delete(sourceId);
      });
      pending.set(sourceId, entry);
    }
    entry.consumers++;
    try { return await entry.promise; }
    finally { entry.consumers--; }
  }

  return {
    resolve,
    clear() { generation++; retained.clear(); pending.clear(); decodedBytes = 0; },
    getStats: () => ({ decodedBytes, decodedSources: retained.size, pendingSources: pending.size,
      decodeConsumers: [...pending.values()].reduce((sum, entry) => sum + entry.consumers, 0) }),
  };
}
