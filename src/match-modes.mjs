// Match victory policy is independent of the pvp/pve opponent setup.
// Callers supply validated canonical maps; this module does not validate terrain.
const definitions = Object.freeze([
  Object.freeze({ id: 'authored', version: 1, label: 'Authored Rules',
    victoryPolicy: 'authored', aiStrategyId: 'capture-posts',
    pveSupported: true, selectable: false }),
  Object.freeze({ id: 'objective-control', version: 1, label: 'Objective Control',
    victoryPolicy: 'authored', aiStrategyId: 'capture-posts',
    pveSupported: true, selectable: true }),
  Object.freeze({ id: 'skirmish', version: 1, label: 'Skirmish',
    victoryPolicy: 'recovery-elimination', aiStrategyId: 'base-elimination',
    pveSupported: false, selectable: true }),
]);
const skirmishMapIds = new Set(['bellweather-millrace', 'underbough-rootways']);

/** Missing fields preserve legacy authored rules; explicit invalid fields reject. */
export function normalizeMatchMode(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Match mode settings must be an object.');
  }
  const hasId = Object.hasOwn(value, 'matchModeId');
  const hasVersion = Object.hasOwn(value, 'matchModeVersion');
  if (!hasId && !hasVersion) return { matchModeId: 'authored', matchModeVersion: 1 };
  if (hasId !== hasVersion) {
    throw new Error('Match mode requires both matchModeId and matchModeVersion.');
  }
  const { matchModeId, matchModeVersion } = value;
  if (!definitions.some(item => item.id === matchModeId)) {
    throw new Error(`Unsupported matchModeId: ${String(matchModeId)}`);
  }
  if (!definitions.some(item => item.id === matchModeId && item.version === matchModeVersion)) {
    throw new Error(`Unsupported matchModeVersion for ${matchModeId}: ${String(matchModeVersion)}`);
  }
  return { matchModeId, matchModeVersion };
}

/** Registry descriptors are immutable; launch/checkpoint identity uses the pair above. */
export function matchModeDefinition(value) {
  const { matchModeId, matchModeVersion } = normalizeMatchMode(value);
  return definitions.find(item => item.id === matchModeId && item.version === matchModeVersion);
}

function assertContext({ mode = 'pvp', practice = false } = {}) {
  if (mode !== 'pvp' && mode !== 'pve') throw new Error('Opponent mode must be pvp or pve.');
  if (typeof practice !== 'boolean') throw new Error('Practice must be a boolean.');
  if (practice && mode !== 'pvp') throw new Error('Practice requires human pvp setup.');
  return { mode, practice };
}

function assertMap(map) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    throw new Error('Match mode compatibility requires a validated map object.');
  }
}

function mapCompatible(definition, map) {
  if (definition.id === 'objective-control') {
    return Array.isArray(map.triggers) && map.triggers.some(trigger => trigger.victory === true);
  }
  return definition.id !== 'skirmish' || skirmishMapIds.has(map.id);
}

/** Return the descriptor on success; never silently substitute a mode or map. */
export function assertMatchModeCompatibility(value, map, options) {
  const definition = matchModeDefinition(value);
  const { mode } = assertContext(options);
  assertMap(map);
  if (!mapCompatible(definition, map)) {
    throw new Error(`${definition.label} is not compatible with map ${map.id || '(unnamed)'}.`);
  }
  if (mode === 'pve' && !definition.pveSupported) {
    throw new Error(`${definition.label} does not support PvE until its base-elimination AI is accepted.`);
  }
  return definition;
}

/** Project simulation rules without mutating or relabeling the canonical map. */
export function effectiveMapForMatchMode(map, value) {
  const definition = assertMatchModeCompatibility(value, map);
  const effective = structuredClone(map);
  if (definition.victoryPolicy === 'recovery-elimination') {
    for (const trigger of effective.triggers || []) {
      if (trigger.victory === true) trigger.victory = false;
    }
    delete effective.victoryHoldSeconds;
    delete effective.timedVictory;
  }
  return effective;
}

/** Compatible descriptors for a canonical map, including hidden legacy authored. */
export function matchModeCatalog(map, options) {
  const { mode } = assertContext(options);
  assertMap(map);
  return definitions.filter(definition => mapCompatible(definition, map)
    && (mode !== 'pve' || definition.pveSupported));
}
