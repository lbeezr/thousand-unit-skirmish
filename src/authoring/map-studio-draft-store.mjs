export const MAP_STUDIO_DRAFT_VERSION = 1;

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
    const state = draft?.editor;
    const definition = state?.definition;
    if (draft?.version !== MAP_STUDIO_DRAFT_VERSION || draft.sourceMapId !== sourceMapId
      || !definition || !Number.isInteger(definition.width) || !Number.isInteger(definition.height)
      || definition.width < 16 || definition.width > 256 || definition.height < 16 || definition.height > 256
      || !Array.isArray(definition.obstacles) || !Array.isArray(definition.spawnPoints)) {
      throw new Error('The saved draft could not be read. Discard it to start a fresh map.');
    }
    return { state, definition };
  }

  return { key, read, write, remove, requireRecovery };
}
