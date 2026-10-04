import { normalizeMatchMode, matchModeCatalog } from './match-modes.mjs';
import { mapSizeIdentity } from './map-size-policy.mjs';

// Use the configured canonical fresh-room map, never a current player's map.
// The menu needs victory rules and capability descriptors, not terrain data.
function mapDescription(map) {
  return {
      id: map.id, name: map.name, width: map.width, height: map.height,
      ...mapSizeIdentity(map),
      triggers: (map.triggers || []).map(({ id, name, victory }) => ({ id, name, victory })),
      victoryMode: map.victoryMode ?? 'any',
      ...(map.victoryHoldSeconds === undefined ? {} : { victoryHoldSeconds: map.victoryHoldSeconds }),
      ...(map.timedVictory === undefined ? {} : { timedVictory: { ...map.timedVictory } }),
  };
}

export function practiceEntryCatalog(map, presetMaps = []) {
  const matchModes = matchModeCatalog(map, { mode: 'pvp', practice: true });
  const presets = presetMaps.flatMap(candidate => matchModeCatalog(candidate, { mode: 'pvp', practice: true })
    .filter(choice => choice.selectable && choice.defaultMapId === candidate.id
      && !matchModes.some(current => current.id === choice.id && current.version === choice.version))
    .map(choice => ({ matchModeId: choice.id, matchModeVersion: choice.version,
      matchMode: choice, map: mapDescription(candidate) })));
  return {
    ...normalizeMatchMode(), matchModes, map: mapDescription(map), ...(presets.length ? { presets } : {}),
  };
}
