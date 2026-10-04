// Derived, room-private geometry only; never serialize this cache or seat masks.
// These limits prepare visibility for 320, without admitting a larger playable map.
export const VISION_CACHE_MAX_SIDE = 320;
export const VISION_CACHE_MAX_SIGHT = 16;
export const VISION_CACHE_KEY_STRIDE = VISION_CACHE_MAX_SIGHT + 1;
export const VISION_CACHE_MAX_BYTES = 8 * 1024 * 1024;
export const VISION_CACHE_MAX_ENTRIES = 8192;

function integer(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${label} must be an integer in [${min}, ${max}].`);
  }
  return value;
}

function ownedIndices(indices, cells) {
  if (!Array.isArray(indices) && !(ArrayBuffer.isView(indices) && typeof indices.length === 'number')) {
    throw new TypeError('Coverage must contain index arrays.');
  }
  // Validate before Uint32 conversion: it would truncate fractions and wrap negatives.
  for (const cell of indices) integer(cell, 0, cells - 1, 'Coverage cell');
  // Always copy, including foreign views/subarrays: retained backing buffers are exact
  // and callers cannot mutate an insertion through their original array.
  return Uint32Array.from(indices);
}

export class VisionCoverageCache {
  #entries = new Map();
  #bytes = 0;
  #peakBytes = 0;
  #peakEntries = 0;
  #hits = 0;
  #misses = 0;
  #evictions = 0;
  #uncached = 0;
  #clears = 0;
  #config;

  constructor({ width, height, generation = 0, reason = 'initial',
    maxBytes = VISION_CACHE_MAX_BYTES, maxEntries = VISION_CACHE_MAX_ENTRIES }) {
    integer(width, 1, VISION_CACHE_MAX_SIDE, 'Width');
    integer(height, 1, VISION_CACHE_MAX_SIDE, 'Height');
    integer(generation, 0, Number.MAX_SAFE_INTEGER, 'Generation');
    integer(maxBytes, 0, VISION_CACHE_MAX_BYTES, 'Payload budget');
    integer(maxEntries, 0, VISION_CACHE_MAX_ENTRIES, 'Entry budget');
    if (typeof reason !== 'string') throw new TypeError('Invalidation reason must be a string.');
    this.#config = Object.freeze({ width, height, cells: width * height, generation, reason, maxBytes, maxEntries });
  }

  #key(sourceCell, sight) {
    integer(sourceCell, 0, this.#config.cells - 1, 'Source cell');
    integer(sight, 1, VISION_CACHE_MAX_SIGHT, 'Sight');
    return sourceCell * VISION_CACHE_KEY_STRIDE + sight;
  }

  // Inspection for instrumentation: no hit/miss accounting or LRU promotion.
  has(sourceCell, sight) { return this.#entries.has(this.#key(sourceCell, sight)); }

  get(sourceCell, sight) {
    const key = this.#key(sourceCell, sight), entry = this.#entries.get(key);
    if (!entry) { this.#misses++; return undefined; }
    this.#hits++;
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return entry;
  }

  set(sourceCell, sight, coverage) {
    const key = this.#key(sourceCell, sight);
    // Complete validation/ownership before changing existing accounting or LRU order.
    const entry = Object.freeze({ visible: ownedIndices(coverage?.visible, this.#config.cells),
      fringe: ownedIndices(coverage?.fringe, this.#config.cells) });
    const bytes = entry.visible.byteLength + entry.fringe.byteLength;
    this.delete(sourceCell, sight);
    if (bytes > this.#config.maxBytes || this.#config.maxEntries === 0) {
      this.#uncached++;
      return entry;
    }
    while (this.#entries.size >= this.#config.maxEntries || this.#bytes + bytes > this.#config.maxBytes) {
      const oldest = this.#entries.keys().next().value;
      const removed = this.#entries.get(oldest);
      this.#entries.delete(oldest);
      this.#bytes -= removed.visible.byteLength + removed.fringe.byteLength;
      this.#evictions++;
    }
    this.#entries.set(key, entry);
    this.#bytes += bytes;
    this.#peakBytes = Math.max(this.#peakBytes, this.#bytes);
    this.#peakEntries = Math.max(this.#peakEntries, this.#entries.size);
    return entry;
  }

  delete(sourceCell, sight) {
    const key = this.#key(sourceCell, sight), entry = this.#entries.get(key);
    if (!entry) return false;
    this.#entries.delete(key);
    this.#bytes -= entry.visible.byteLength + entry.fringe.byteLength;
    return true;
  }

  // Pure-cache API only. Geometry mutation in the runtime must replace the object
  // so ensureVisionMasks refreshes even if tickNumber has not changed.
  clear() { this.#entries.clear(); this.#bytes = 0; this.#clears++; }

  metrics() {
    return { ...this.#config, indexBits: 32, entries: this.#entries.size, payloadBytes: this.#bytes,
      peakEntries: this.#peakEntries, peakPayloadBytes: this.#peakBytes,
      hits: this.#hits, misses: this.#misses, evictions: this.#evictions,
      uncached: this.#uncached, clears: this.#clears };
  }
}
