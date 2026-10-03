import { buildElevationGrid, findUnreachableResourceNode } from './map-utils.mjs';
import { canTraverseElevation } from './elevation.mjs';
import { townCenterFootprintCells } from './town-center-spawn.mjs';
import { findInvalidResourceVariant, isShoreFish, SHORE_FISH_VARIANT } from './shore-fishing.mjs';

export const SHORE_FISHING_PILOT_SETTINGS = Object.freeze({ seed: 9300703, radius: 3, spawnClearance: 6,
  sites: Object.freeze([
    Object.freeze({ nodeId: 'azure-food', x: -10.5, z: 8.5 }),
    Object.freeze({ nodeId: 'ember-food', x: 10.5, z: 8.5 }),
  ]) });

// Inputs use the ordinary validated map contract. Water stays a blocker; the
// helper never changes terrain, node IDs, stock, cargo, or checkpoint fields.
function ground(map, includeTownCenters = false) {
  const { width, height } = map;
  const blocked = new Uint8Array(width * height), water = new Uint8Array(width * height);
  const paint = Array(width * height).fill(map.terrainBase);
  for (const rect of map.obstacles) for (let row = rect.row; row < rect.row + rect.height; row++) {
    blocked.fill(1, row * width + rect.column, row * width + rect.column + rect.width);
    if (rect.material === 'water') water.fill(1, row * width + rect.column, row * width + rect.column + rect.width);
  }
  for (const rect of map.terrainPatches || []) for (let row = rect.row; row < rect.row + rect.height; row++) {
    paint.fill(rect.material, row * width + rect.column, row * width + rect.column + rect.width);
  }
  if (includeTownCenters) for (const team of [0, 1]) {
    for (const cell of townCenterFootprintCells(map.spawnPoints, team, width, height)) blocked[cell] = 1;
  }
  const levels = buildElevationGrid(width, height, map.elevationPatches);
  const cell = point => Math.floor(point.z + height / 2) * width + Math.floor(point.x + width / 2);
  const point = cell => ({ x: cell % width - width / 2 + 0.5, z: Math.floor(cell / width) - height / 2 + 0.5 });
  const neighbours = cell => {
    const column = cell % width, row = Math.floor(cell / width);
    return [column > 0 ? cell - 1 : -1, column + 1 < width ? cell + 1 : -1,
      row > 0 ? cell - width : -1, row + 1 < height ? cell + width : -1];
  };
  return { width, height, blocked, water, paint, levels, cell, point, neighbours };
}

function waterCellAtBank(node, terrain) {
  const { width, height, blocked, water, levels, cell, point, neighbours } = terrain;
  if (!Number.isFinite(node.x) || !Number.isFinite(node.z)
    || Math.abs(node.x) >= width / 2 || Math.abs(node.z) >= height / 2) return null;
  const land = cell(node);
  if (blocked[land] || levels[land] !== 0) return null;
  const candidates = neighbours(land).filter(next => next >= 0 && water[next] && levels[next] === 0);
  const distance = index => { const p = point(index); return (p.x - node.x) ** 2 + (p.z - node.z) ** 2; };
  candidates.sort((a, b) => distance(a) - distance(b) || a - b);
  return candidates[0] ?? null;
}

// Renderer/brush handoff: x/z remains land authority. The visual is centered in
// ONE adjacent blocked water cell, with a one-cell school envelope. Derivation
// is stable for the same map and introduces no persisted schema or second pool.
export function shoreFishSitePositions(map) {
  const invalid = findInvalidResourceVariant(map);
  if (invalid) throw new Error(`Invalid shore fish ${invalid.nodeId}: ${invalid.reason}.`);
  const terrain = ground(map);
  return (map.resourceNodes || []).filter(isShoreFish).map(node => {
    const cell = waterCellAtBank(node, terrain);
    return { nodeId: node.id, land: { x: node.x, z: node.z },
      water: { ...terrain.point(cell), column: cell % map.width, row: Math.floor(cell / map.width) },
      visualEnvelope: { width: 1, depth: 1 } };
  });
}

function reachableFrom(spawn, terrain) {
  const seen = new Uint8Array(terrain.blocked.length), queue = new Int32Array(seen.length);
  const start = terrain.cell(spawn);
  if (terrain.blocked[start]) return seen;
  let head = 0, tail = 1; queue[0] = start; seen[start] = 1;
  while (head < tail) {
    const current = queue[head++];
    for (const next of terrain.neighbours(current)) {
      if (next < 0 || terrain.blocked[next] || seen[next]
        || !canTraverseElevation(terrain.levels, current, next)) continue;
      seen[next] = 1; queue[tail++] = next;
    }
  }
  return seen;
}

function rank(seed, dx, dz) {
  let value = (seed ^ Math.imul(dx + 16, 0x85ebca6b) ^ Math.imul(dz + 16, 0xc2b2ae35)) >>> 0;
  value = Math.imul(value ^ value >>> 16, 0x85ebca6b);
  value = Math.imul(value ^ value >>> 13, 0xc2b2ae35);
  return (value ^ value >>> 16) >>> 0;
}

// Convert specified EXISTING food nodes to shore fish, preserving their entire
// stock budget and identity. Return a complete copied node array atomically.
// Settings contain explicit anchors; there is no implicit map-wide scatter.
export function seedShoreFishSites(map, settings) {
  const { seed, sites, radius = 3, spawnClearance = 6 } = settings || {};
  const existing = map.resourceNodes || [];
  if (!Number.isSafeInteger(seed) || !Array.isArray(sites) || !sites.length || sites.length > 16
    || !Number.isInteger(radius) || radius < 0 || radius > 8
    || !Number.isInteger(spawnClearance) || spawnClearance < 0 || spawnClearance > 16
    || !Array.isArray(existing) || existing.length > 128) throw new Error('Invalid shore fish placement settings.');
  const existingIds = new Set(), existingCells = new Set();
  for (const node of existing) {
    const cell = Math.floor(node?.z + map.height / 2) * map.width + Math.floor(node?.x + map.width / 2);
    if (!node || typeof node.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(node.id)
      || existingIds.has(node.id) || existingCells.has(cell) || !['food', 'wood'].includes(node.type)
      || !Number.isFinite(node.x) || !Number.isFinite(node.z)
      || Math.abs(node.x) >= map.width / 2 || Math.abs(node.z) >= map.height / 2
      || !Number.isFinite(node.stock) || node.stock <= 0) throw new Error('Invalid or duplicate existing resource node ID/cell.');
    existingIds.add(node.id); existingCells.add(cell);
  }
  const targets = new Set();
  for (const site of sites) {
    const node = existing.find(node => node.id === site?.nodeId);
    if (!node || targets.has(site.nodeId) || node.type !== 'food' || node.wildlifeSpecies !== undefined || node.wildlifeState !== undefined
      || !Number.isFinite(node.stock) || node.stock <= 0
      || !Number.isFinite(site.x) || !Number.isFinite(site.z)
      || Math.abs(site.x) >= map.width / 2 || Math.abs(site.z) >= map.height / 2) {
      throw new Error('Shore fish sites need unique existing finite food nodes and in-bounds anchors.');
    }
    targets.add(site.nodeId);
  }
  const invalid = findInvalidResourceVariant(map);
  if (invalid) throw new Error(`Invalid existing resource variant: ${invalid.reason}.`);
  const terrain = ground(map, true);
  const reachability = [0, 1].map(team => reachableFrom(map.spawnPoints.find(point => point.team === team), terrain));
  const takenLand = existing.filter(node => !targets.has(node.id)).map(node => ({ x: node.x, z: node.z }));
  const takenWater = new Set(shoreFishSitePositions(map).filter(site => !targets.has(site.nodeId))
    .map(site => terrain.cell(site.water)));
  const replacements = new Map();
  for (const site of sites) {
    const candidates = [];
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
      if (Math.hypot(dx, dz) > radius) continue;
      const position = terrain.point(terrain.cell({ x: site.x, z: site.z }));
      position.x += dx; position.z += dz;
      if (Math.hypot(position.x - site.x, position.z - site.z) > radius) continue;
      const cell = terrain.cell(position), water = waterCellAtBank(position, terrain);
      if (water === null || takenWater.has(water) || terrain.paint[cell] === 'dirt'
        || !reachability.every(reachable => reachable[cell])
        || map.spawnPoints.some(spawn => Math.max(Math.abs(position.x - spawn.x), Math.abs(position.z - spawn.z)) <= spawnClearance)
        || takenLand.some(point => Math.hypot(position.x - point.x, position.z - point.z) < 2)) continue;
      candidates.push({ position, water, rank: rank(seed, dx * (site.x < 0 ? -1 : 1), dz), dx, dz });
    }
    candidates.sort((a, b) => a.rank - b.rank || a.dz - b.dz || (a.dx - b.dx) * (site.x < 0 ? -1 : 1));
    const chosen = candidates[0];
    if (!chosen) throw new Error(`No safe reachable shore fish bank for ${site.nodeId}.`);
    takenLand.push(chosen.position); takenWater.add(chosen.water);
    replacements.set(site.nodeId, { ...chosen.position, resourceVariant: SHORE_FISH_VARIANT });
  }
  const nodes = structuredClone(existing).map(node => Object.assign(node, replacements.get(node.id)));
  const unreachable = findUnreachableResourceNode(map.width, map.height, terrain.blocked, map.spawnPoints, nodes, terrain.levels);
  if (unreachable) throw new Error(`Resource ${unreachable.nodeId} must remain reachable from both seats with Town Centers present.`);
  return nodes;
}
