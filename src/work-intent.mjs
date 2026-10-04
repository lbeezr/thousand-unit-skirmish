// Durable player work, separate from transient targets/routes/orderRevision.
import { STONE_ECONOMY_PROFILE_ID } from './economy-profile.mjs';
export const WORK_INTENT_VERSION = 1;

export const isAreaGatherResource = resource => resource === 'wood' || resource === 'stone';

export function createGatherWorkIntent(generation, source, resource = 'wood') {
  if (!isAreaGatherResource(resource)) throw new Error('Unsupported gather area resource');
  return { version: 1, kind: 'gather', generation, resource, anchor: { x: source.x, z: source.z } };
}

export function createConstructionWorkIntent(generation, siteIds, area) {
  return { version: 1, kind: 'construction', generation, siteIds: [...siteIds], area: { ...area } };
}

export function clearWorkIntent(unit) { unit.workIntent = null; }
export function clearGatherWorkIntent(unit) {
  if (unit.workIntent?.kind === 'gather') clearWorkIntent(unit);
}
export function activeWorkIntent(unit) {
  return unit.hp > 0 && unit.workIntent?.version === 1 && unit.workIntent.generation === unit.generation
    ? unit.workIntent : null;
}

function keys(value, expected) {
  return !!value && !Array.isArray(value) && Object.keys(value).length === expected.length
    && expected.every(key => Object.hasOwn(value, key));
}
function onMap(point, map) {
  return Number.isFinite(point.x) && Number.isFinite(point.z)
    && point.x >= -map.width / 2 && point.x < map.width / 2
    && point.z >= -map.height / 2 && point.z < map.height / 2;
}

export function validWorkIntent(intent, unit, map, { buildings = [], nextBuildingId = Infinity, maxSites = Infinity } = {}) {
  if (intent === null || intent === undefined) return true;
  if (unit.kind !== 'worker' || unit.movementDomain === 'water' || intent.version !== 1
    || !Number.isSafeInteger(intent.generation) || intent.generation < 1
    || intent.generation !== unit.generation) return false;
  if (intent.kind === 'gather') return keys(intent, ['version', 'kind', 'generation', 'resource', 'anchor'])
    && isAreaGatherResource(intent.resource)
    && (intent.resource !== 'stone' || map.economyProfileId === STONE_ECONOMY_PROFILE_ID)
    && keys(intent.anchor, ['x', 'z']) && onMap(intent.anchor, map);
  if (intent.kind !== 'construction' || !keys(intent, ['version', 'kind', 'generation', 'siteIds', 'area'])) return false;
  const area = intent.area;
  if (!keys(area, ['minX', 'maxX', 'minZ', 'maxZ']) || !Object.values(area).every(Number.isFinite)
    || area.minX < -map.width / 2 || area.maxX > map.width / 2 || area.minX > area.maxX
    || area.minZ < -map.height / 2 || area.maxZ > map.height / 2 || area.minZ > area.maxZ) return false;
  return Array.isArray(intent.siteIds) && intent.siteIds.length > 0 && intent.siteIds.length <= maxSites
    && new Set(intent.siteIds).size === intent.siteIds.length
    && intent.siteIds.every(id => Number.isSafeInteger(id) && id > 0 && id < nextBuildingId
      && !buildings.some(building => building.id === id && building.team !== unit.team));
}
