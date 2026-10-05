export const MAP_STUDIO_DRAFT_VERSION = 1;

export function requireRecovery(draft, sourceMapId) {
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
