import { requireRecovery as requireDraftRecovery } from './map-studio/draft/v1/contract.mjs';
export { MAP_STUDIO_DRAFT_VERSION } from './map-studio/draft/v1/contract.mjs';

// Storage access stays deferred so browser getter failures reach existing catches.
// The host retains debounce, dialog lifecycle, capture and recovery presentation.
export function createMapStudioDraftStore({ getStorage }) {
  function key({ sessionStorageKey, origin, roomId, sourceMapId }) {
    return `${sessionStorageKey}:map-studio-draft:${origin}:${roomId || 'default'}:${sourceMapId}`;
  }

  function read(storageKey) {
    if (!storageKey) return null;
    try {
      const raw = getStorage().getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function write(storageKey, draft) {
    getStorage().setItem(storageKey, JSON.stringify(draft));
  }

  function remove(storageKey) {
    getStorage().removeItem(storageKey);
  }

  function requireRecovery(draft, sourceMapId) {
    return requireDraftRecovery(draft, sourceMapId);
  }

  return { key, read, write, remove, requireRecovery };
}
