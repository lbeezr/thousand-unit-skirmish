import { waterRaster } from './water-contours.mjs';
import { isShoreFish } from './shore-fishing.mjs';
import { shoreFishSitePositions } from './shore-fishing-placement.mjs';

export const WATER_STUDY_FISH_LIMIT = 32;
const FORWARD = [[-1, 0, 1], [-1, -1, Math.SQRT2], [0, -1, 1], [1, -1, Math.SQRT2]];
const BACKWARD = FORWARD.map(([x, z, cost]) => [-x, -z, cost]);

// Cosmetic shore distance, not a measured bottom or a navigation depth.
export function buildWaterStudyField(definition) {
  const { width, height } = definition;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0
    || width > 512 || height > 512) throw new Error('Water study requires a bounded valid map');
  const cells = waterRaster(definition), distance = new Float32Array(cells.length);
  for (let i = 0; i < cells.length; i++) distance[i] = cells[i] ? Infinity : 0;
  const visit = (column, row, neighbours) => {
    const i = row * width + column;
    for (const [dx, dz, cost] of neighbours) {
      const x = column + dx, z = row + dz;
      if (x >= 0 && z >= 0 && x < width && z < height) {
        distance[i] = Math.min(distance[i], distance[z * width + x] + cost);
      }
    }
  };
  for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) {
    visit(c, r, FORWARD);
  }
  for (let r = height - 1; r >= 0; r--) for (let c = width - 1; c >= 0; c--) {
    visit(c, r, BACKWARD);
  }
  const pixels = new Uint8Array(cells.length * 4);
  for (let i = 0; i < cells.length; i++) {
    pixels[i * 4] = cells[i] * 255;
    pixels[i * 4 + 1] = cells[i] ? Math.round(Math.min(1, Math.max(0, distance[i] - .5) / 4) * 255) : 0;
    pixels[i * 4 + 3] = 255;
  }
  return { width, height, cells, distance, pixels };
}

function idPhase(id) {
  let hash = 2166136261;
  for (const code of id) hash = Math.imul(hash ^ code.codePointAt(0), 16777619) >>> 0;
  return hash / 4294967296;
}

// Fail closed: callers must supply current stock AND explicit visibility for
// the bank resource and the water cell. Authored stock is never a live signal.
export function selectWaterStudyFish(definition, {
  resourceNodes = [], visibleResourceIds = [], visibleWaterCells = [],
} = {}) {
  return createWaterStudyFishSelector(definition)({ resourceNodes, visibleResourceIds, visibleWaterCells });
}

// Map geometry is stable between rebuilds. Cache the shared fixed school
// positions once, so visibility cannot move a school to a different neighbor.
export function createWaterStudyFishSelector(definition) {
  let sites;
  try { sites = new Map(shoreFishSitePositions(definition).map(site => [site.nodeId, site])); }
  catch { return () => []; }
  const authored = new Map((definition.resourceNodes || []).map(n => [n.id, n]));
  return ({ resourceNodes = [], visibleResourceIds = [], visibleWaterCells = [] } = {}) => {
    if (!Array.isArray(resourceNodes) || !Array.isArray(visibleResourceIds) || !Array.isArray(visibleWaterCells)) return [];
    const resources = new Set(visibleResourceIds), water = new Set(visibleWaterCells);
    const candidates = [], seen = new Set();
    for (const live of resourceNodes.filter(n => n && typeof n.id === 'string').sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) {
      const node = authored.get(live.id), site = sites.get(live.id);
      if (!node || typeof node.id !== 'string' || seen.has(node.id) || !resources.has(node.id)
        || !site
        || !isShoreFish(node) || !isShoreFish(live) || node.type !== 'food' || live.type !== 'food'
        || node.wildlifeSpecies !== undefined || live.wildlifeSpecies !== undefined
        || node.wildlifeState !== undefined || live.wildlifeState !== undefined
        || !Number.isFinite(live.stock) || live.stock <= 0
        || !Number.isFinite(node.x) || !Number.isFinite(node.z)) continue;
      seen.add(node.id);
      const waterCell = site.water.row * definition.width + site.water.column;
      if (!water.has(waterCell)) continue;
      candidates.push({ id: node.id, waterCell, x: site.water.x, z: site.water.z,
        approachX: site.land.x, approachZ: site.land.z, phase: idPhase(node.id) });
      if (candidates.length === WATER_STUDY_FISH_LIMIT) break;
    }
    return candidates;
  };
}

export function waterStudyTime(seconds, { fixedTime = null, reducedMotion = false } = {}) {
  if (reducedMotion) return 0;
  if (Number.isFinite(fixedTime)) return Math.max(0, fixedTime);
  return Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
}
