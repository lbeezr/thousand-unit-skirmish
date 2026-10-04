/** Server-owned Play vs AI presets with the historical seeded map pool preserved. */
import { matchModeDefinition, normalizeMatchMode } from './match-modes.mjs';

export const PVE_MAP_IDS = Object.freeze(['bellweather-millrace', 'underbough-rootways']);

export function parseUint32Seed(value, label = 'seed') {
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isInteger(number) || number < 0 || number > 0xffff_ffff) {
    throw new TypeError(`${label} must be an unsigned 32-bit integer.`);
  }
  return number;
}

export function selectPveMapId(mapSeed, mapIds = PVE_MAP_IDS) {
  const seed = parseUint32Seed(mapSeed, 'PvE map seed');
  if (!Array.isArray(mapIds) || mapIds.length === 0
    || mapIds.some((id) => typeof id !== 'string' || id.length === 0)) {
    throw new TypeError('PvE map pool must contain at least one map ID.');
  }
  return mapIds[seed % mapIds.length];
}

export function readPveLaunchOptions(environment = process.env) {
  const mode = environment.RTS_GAME_MODE ?? 'pvp';
  if (mode === 'pvp') return null;
  if (mode !== 'pve') throw new TypeError('RTS_GAME_MODE must be "pvp" or "pve".');

  const mapSeed = parseUint32Seed(environment.RTS_PVE_MAP_SEED, 'RTS_PVE_MAP_SEED');
  const policySeed = parseUint32Seed(environment.RTS_PVE_POLICY_SEED, 'RTS_PVE_POLICY_SEED');
  const identity = normalizeMatchMode({
    ...(environment.RTS_MATCH_MODE_ID === undefined ? {} : { matchModeId: environment.RTS_MATCH_MODE_ID }),
    ...(environment.RTS_MATCH_MODE_VERSION === undefined ? {} : {
      matchModeVersion: /^\d+$/.test(environment.RTS_MATCH_MODE_VERSION)
        ? Number(environment.RTS_MATCH_MODE_VERSION) : environment.RTS_MATCH_MODE_VERSION,
    }),
  });
  return Object.freeze({
    mode,
    mapSeed,
    policySeed,
    // Only the explicit new identity chooses the accepted Tiny preset. Historical
    // omission/Authored/Objective Control retain the exact seed-owned map pool.
    mapId: identity.matchModeId === 'skirmish'
      ? matchModeDefinition(identity).defaultMapId : selectPveMapId(mapSeed),
  });
}
