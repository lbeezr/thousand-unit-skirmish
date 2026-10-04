// Match victory policy is independent of the pvp/pve opponent setup.
// Callers supply validated canonical maps; this module does not validate terrain.
import { BANNERFALL_RULES } from './bannerfall-rules.mjs';
export const NORMAL_MATCH_MAP_ID = 'veyrholds-terraced-vale';
export const NORMAL_HUMAN_MATCH_MODE = Object.freeze({ matchModeId: 'skirmish', matchModeVersion: 1 });
/** @type {ReadonlyArray<Readonly<{id:string, version:number, label:string, victoryPolicy:string, aiStrategyId:string, pveSupported:boolean, pveMapIds?:ReadonlyArray<string>, selectable:boolean, defaultMapId?:string, fixedArmySize?:number}>>} */
const definitions = Object.freeze([
  Object.freeze({ id: 'authored', version: 1, label: 'Authored Rules',
    victoryPolicy: 'authored', aiStrategyId: 'capture-posts',
    pveSupported: true, selectable: false, defaultMapId: NORMAL_MATCH_MAP_ID }),
  Object.freeze({ id: 'objective-control', version: 1, label: 'Objective Control',
    victoryPolicy: 'authored', aiStrategyId: 'capture-posts',
    pveSupported: true, selectable: true, defaultMapId: 'woodland-expanse' }),
  Object.freeze({ id: 'skirmish', version: 1, label: 'Skirmish',
    victoryPolicy: 'recovery-elimination', aiStrategyId: 'base-elimination',
    pveSupported: true, pveMapIds: Object.freeze([NORMAL_MATCH_MAP_ID]),
    selectable: true, defaultMapId: NORMAL_MATCH_MAP_ID }),
  Object.freeze({ id: 'bannerfall', version: 1, label: 'Bannerfall',
    victoryPolicy: 'designated-stronghold', aiStrategyId: 'unsupported',
    defaultMapId: BANNERFALL_RULES.mapId, fixedArmySize: BANNERFALL_RULES.openingArmySize,
    pveSupported: false, selectable: true }),
]);
const skirmishMapIds = new Set(['bellweather-millrace', 'underbough-rootways', NORMAL_MATCH_MAP_ID,
  'veyrholds-threefold-basin', 'veyrholds-riven-escarpment', 'veyrholds-crownroads']);

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
  if (definition.id === 'bannerfall') return map.id === BANNERFALL_RULES.mapId;
  if (definition.id === 'objective-control') {
    return Array.isArray(map.triggers) && map.triggers.some(trigger => trigger.victory === true);
  }
  return definition.id !== 'skirmish' || skirmishMapIds.has(map.id);
}

function supportsPve(definition, map) {
  return definition.pveSupported && (!definition.pveMapIds || definition.pveMapIds.includes(map.id));
}

// Catalog descriptors report the capability of this map, not another preset.
function mapDescriptor(definition, map) {
  const pveSupported = supportsPve(definition, map);
  return pveSupported === definition.pveSupported ? definition : Object.freeze({ ...definition, pveSupported });
}

/** Return the descriptor on success; never silently substitute a mode or map. */
export function assertMatchModeCompatibility(value, map, options) {
  const definition = matchModeDefinition(value);
  const { mode } = assertContext(options);
  assertMap(map);
  if (!mapCompatible(definition, map)) {
    throw new Error(`${definition.label} is not compatible with map ${map.id || '(unnamed)'}.`);
  }
  if (mode === 'pve' && !supportsPve(definition, map)) {
    if (definition.id === 'bannerfall') throw new Error('Bannerfall supports human matches and Practice; its AI is not implemented.');
    throw new Error(`${definition.label} does not support PvE on map ${map.id}; AI is accepted only on Terraced Vale (${NORMAL_MATCH_MAP_ID}).`);
  }
  return mapDescriptor(definition, map);
}

/** Project simulation rules without mutating or relabeling the canonical map. */
export function effectiveMapForMatchMode(map, value) {
  const definition = assertMatchModeCompatibility(value, map);
  const effective = structuredClone(map);
  // Reserved effective-only metadata cannot opt an authored map into this mode.
  delete effective.bannerfall;
  if (definition.id === 'bannerfall') {
    effective.startingArmySize = BANNERFALL_RULES.openingArmySize;
    effective.startingResources = { food: 0, wood: 0 };
    effective.resourceNodes = [];
    effective.triggers = [];
    effective.scenarioEvents = [];
    effective.bannerfall = { ...BANNERFALL_RULES };
    delete effective.victoryHoldSeconds;
    delete effective.timedVictory;
  }
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
    && (mode !== 'pve' || supportsPve(definition, map)))
    .map(definition => mapDescriptor(definition, map));
}
