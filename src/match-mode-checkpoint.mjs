import { normalizeMatchMode } from './match-modes.mjs';

/** Run after existing content migrations; legacy matches keep their authored rules. */
export function migrateMatchModeCheckpoint(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)
    || snapshot.schemaVersion !== 25 || snapshot.rulesVersion !== 6
    || !snapshot.state || typeof snapshot.state !== 'object' || Array.isArray(snapshot.state)
    || Object.hasOwn(snapshot, 'matchModeId') || Object.hasOwn(snapshot, 'matchModeVersion')) {
    return snapshot;
  }
  snapshot.schemaVersion = 26;
  snapshot.matchModeId = 'authored';
  snapshot.matchModeVersion = 1;
  return snapshot;
}

/** Validate saved identity before restore; canonical map compatibility is checked by the caller. */
export function validateMatchModeCheckpoint(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('Invalid match checkpoint: expected an object');
  }
  if (snapshot.schemaVersion !== 26) {
    throw new Error('Invalid match checkpoint: unsupported match mode schema version');
  }
  if (snapshot.rulesVersion !== 6) {
    throw new Error('Invalid match checkpoint: unsupported game rules version');
  }
  if (!Object.hasOwn(snapshot, 'matchModeId') || !Object.hasOwn(snapshot, 'matchModeVersion')) {
    throw new Error('Invalid match checkpoint: requires both matchModeId and matchModeVersion');
  }
  try {
    return normalizeMatchMode(snapshot);
  } catch (error) {
    throw new Error(`Invalid match checkpoint: ${error.message}`);
  }
}
