import { normalizeMatchMode, matchModeCatalog } from './match-modes.mjs';
import { mapSizeIdentity } from './map-size-policy.mjs';

// Use the configured canonical fresh-room map, never a current player's map.
// The menu needs victory rules and capability descriptors, not terrain data.
export function practiceEntryCatalog(map) {
  return {
    ...normalizeMatchMode(), matchModes: matchModeCatalog(map, { mode: 'pvp', practice: true }),
    map: {
      id: map.id, name: map.name, width: map.width, height: map.height,
      ...mapSizeIdentity(map),
      triggers: (map.triggers || []).map(({ id, name, victory }) => ({ id, name, victory })),
      victoryMode: map.victoryMode ?? 'any',
      ...(map.victoryHoldSeconds === undefined ? {} : { victoryHoldSeconds: map.victoryHoldSeconds }),
      ...(map.timedVictory === undefined ? {} : { timedVictory: { ...map.timedVictory } }),
    },
  };
}
