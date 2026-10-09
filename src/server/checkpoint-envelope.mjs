import { preflightXlCheckpointRoutes } from './checkpoint-route-budget.mjs';
import { preflightXlCheckpointState } from './checkpoint-json-budget.mjs';
import { validateEconomyCheckpoint } from '../simulation/economy/economy-checkpoint.mjs';
import { DEFAULT_FACTION_ID } from '../gameplay-definitions.mjs';
import { validateMatchModeCheckpoint } from '../match-mode-checkpoint.mjs';
import { assertMatchModeCompatibility, effectiveMapForMatchMode } from '../match-modes.mjs';

function assertSnapshot(condition, message) {
  if (!condition) throw new Error(`Invalid match checkpoint: ${message}`);
}

// Private ordered envelope only. Domain-state validation and restore stay with
// the authority caller; parsed map defaulting/hash behavior belongs to its adapters.
export function validateCheckpointEnvelope(snapshot, {
  checkpointSchemaVersion, gameRulesVersion, maxUnits, maxBuildings, maxResourceNodes,
  validateMapDefinition, matchMapHash, launchMode, practice,
}) {
  assertSnapshot(snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot), 'expected an object');
  preflightXlCheckpointRoutes(snapshot.mapDefinition, snapshot.state,
    { maxUnits, maxResourceNodes });
  preflightXlCheckpointState(snapshot,
    { maxUnits, maxBuildings, maxResourceNodes });
  assertSnapshot(snapshot.schemaVersion === checkpointSchemaVersion, 'unsupported schema version');
  validateEconomyCheckpoint(snapshot);
  assertSnapshot(snapshot.factionId === DEFAULT_FACTION_ID, 'unsupported faction');
  assertSnapshot([1, 2, 3, 4, gameRulesVersion].includes(snapshot.rulesVersion),
    'unsupported game rules version');
  assertSnapshot(Number.isSafeInteger(snapshot.sequence) && snapshot.sequence >= 1, 'invalid sequence');
  assertSnapshot(Number.isFinite(snapshot.savedAt) && snapshot.savedAt > 0, 'invalid save time');
  assertSnapshot(typeof snapshot.matchId === 'string' && /^[A-Za-z0-9_-]{22}$/.test(snapshot.matchId), 'invalid match identity');
  const canonicalDefinition = validateMapDefinition(snapshot.mapDefinition, 'match checkpoint');
  const savedMatchMode = validateMatchModeCheckpoint(snapshot);
  assertMatchModeCompatibility(savedMatchMode, canonicalDefinition, { mode: launchMode, practice });
  const effectiveDefinition = effectiveMapForMatchMode(canonicalDefinition, savedMatchMode);
  assertSnapshot(snapshot.rulesVersion === gameRulesVersion
    || !effectiveDefinition.elevationPatches?.some((patch) => patch.level > 0),
  'elevated map requires current game rules');
  assertSnapshot(snapshot.mapHash === matchMapHash(canonicalDefinition), 'map checksum mismatch');
  assertSnapshot(typeof snapshot.state === 'object' && snapshot.state !== null, 'missing simulation state');
  const state = snapshot.state;
  return { canonicalDefinition, effectiveDefinition, state, savedMatchMode };
}
