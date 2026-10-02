import { buildElevationGrid, findUnreachableResourceNode } from './map-utils.mjs';
import { townCenterFootprintCells } from './town-center-spawn.mjs';

// Patch totals, not per-marker stocks. Ordinary nodes remain editable in Map Studio.
export const MILLRACE_RESOURCE_CLUSTERS = Object.freeze({
  seed: 93000, nodesPerPatch: 5, radius: 4, spawnClearance: 6,
  patches: Object.freeze([
    Object.freeze({ type: 'food', x: -21.5, z: 7.5, stock: 650 }),
    Object.freeze({ type: 'wood', x: -21.5, z: -6.5, stock: 975 }),
    Object.freeze({ type: 'food', x: -10.5, z: -13.5, stock: 750 }),
    Object.freeze({ type: 'wood', x: -13.5, z: 18.5, stock: 1125 }),
  ]),
});

// Seeded finite candidate ordering; no unbounded retries or global random state.
function rank(seed, patch, dx, dz) {
  let value = (seed ^ Math.imul(patch + 1, 0x9e3779b1)
    ^ Math.imul(dx + 16, 0x85ebca6b) ^ Math.imul(dz + 16, 0xc2b2ae35)) >>> 0;
  value = Math.imul(value ^ value >>> 16, 0x85ebca6b);
  value = Math.imul(value ^ value >>> 13, 0xc2b2ae35);
  return (value ^ value >>> 16) >>> 0;
}

function clusterGround(map) {
  const { width, height } = map;
  const cell = (x, z) => Math.floor(z + height / 2) * width + Math.floor(x + width / 2);
  const inside = (x, z) => x > -width / 2 && x < width / 2 && z > -height / 2 && z < height / 2;
  const blocked = new Uint8Array(width * height), paint = Array(width * height).fill(map.terrainBase);
  for (const rect of map.obstacles) for (let row = rect.row; row < rect.row + rect.height; row++) {
    blocked.fill(1, row * width + rect.column, row * width + rect.column + rect.width);
  }
  for (const rect of map.terrainPatches || []) for (let row = rect.row; row < rect.row + rect.height; row++) {
    paint.fill(rect.material, row * width + rect.column, row * width + rect.column + rect.width);
  }
  for (const team of [0, 1]) for (const index of townCenterFootprintCells(map.spawnPoints, team, width, height)) blocked[index] = 1;
  const elevation = buildElevationGrid(width, height, map.elevationPatches);
  return { width, height, cell, inside, blocked, paint, elevation };
}

function orderedOffsets(seed, patch, radius) {
  const candidates = [];
  for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
    if (Math.hypot(dx, dz) <= radius && Math.hypot(dx, dz) >= 2) candidates.push({ dx, dz, rank: rank(seed, patch, dx, dz) });
  }
  return candidates.sort((a, b) => a.rank - b.rank || a.dz - b.dz || a.dx - b.dx);
}

export function seededMirroredResourceClusters(map, settings = MILLRACE_RESOURCE_CLUSTERS) {
  const { seed, nodesPerPatch: count, radius, spawnClearance, patches } = settings;
  if (!Number.isSafeInteger(seed) || !Number.isInteger(count) || count < 1 || count > 16
    || !Number.isInteger(radius) || radius < 1 || radius > 8
    || !Number.isInteger(spawnClearance) || spawnClearance < 0 || spawnClearance > 16
    || !Array.isArray(patches) || !patches.length || patches.length * count * 2 > 128) {
    throw new Error('Invalid resource cluster settings or node budget.');
  }
  const { width, height, cell, inside, blocked, paint, elevation } = clusterGround(map);
  const taken = new Set();
  for (const patch of patches) {
    if (!['food', 'wood'].includes(patch.type) || !Number.isInteger(patch.stock) || patch.stock < count
      || !Number.isFinite(patch.x) || !Number.isFinite(patch.z) || patch.x >= 0
      || !inside(patch.x, patch.z) || blocked[cell(patch.x, patch.z)] || blocked[cell(-patch.x, patch.z)]
      || taken.has(cell(patch.x, patch.z)) || taken.has(cell(-patch.x, patch.z))) {
      throw new Error('Invalid or overlapping resource cluster anchor.');
    }
    taken.add(cell(patch.x, patch.z)); taken.add(cell(-patch.x, patch.z));
  }
  const teams = [[], []];
  for (const [index, patch] of patches.entries()) {
    const positions = [{ dx: 0, dz: 0 }];
    for (const candidate of orderedOffsets(seed, index, radius)) {
      if (positions.length === count) break;
      const x = patch.x + candidate.dx, z = patch.z + candidate.dz;
      if (!inside(x, z) || x >= 0 || positions.some(p => Math.hypot(p.dx - candidate.dx, p.dz - candidate.dz) < 2)) continue;
      if ([x, -x].some(px => blocked[cell(px, z)] || taken.has(cell(px, z)) || paint[cell(px, z)] === 'dirt'
        || elevation[cell(px, z)] !== elevation[cell(px < 0 ? patch.x : -patch.x, patch.z)]
        || map.spawnPoints.some(s => Math.max(Math.abs(px - s.x), Math.abs(z - s.z)) <= spawnClearance))) continue;
      positions.push(candidate); taken.add(cell(x, z)); taken.add(cell(-x, z));
    }
    if (positions.length !== count) throw new Error(`Resource patch ${index} has insufficient safe cluster space.`);
    for (const team of [0, 1]) for (const [node, { dx, dz }] of positions.entries()) {
      teams[team].push({ id: `s${team}-${index}${node ? `-${node}` : ''}`, type: patch.type,
        x: (patch.x + dx) * (team ? -1 : 1), z: patch.z + dz,
        stock: Math.floor(patch.stock / count) + (node < patch.stock % count ? 1 : 0) });
    }
  }
  const nodes = teams.flat();
  if (findUnreachableResourceNode(width, height, blocked, map.spawnPoints, nodes, elevation)) {
    throw new Error('Resource clusters must remain reachable from both seats with Town Centers present.');
  }
  return nodes;
}

// Pure append on a validated map: totalStock is the one patch's entire budget.
// Return the complete node array only after admission; never mutate map/settings.
export function appendSeededResourceCluster(map, settings = {}) {
  const { seed, nodesPerPatch: count = 5, radius = 4, spawnClearance = 6,
    type, x, z, totalStock } = settings;
  const existing = map.resourceNodes ?? [];
  if (!Number.isSafeInteger(seed) || !Number.isInteger(count) || count < 1 || count > 16
    || !Number.isInteger(radius) || radius < 1 || radius > 8
    || !Number.isInteger(spawnClearance) || spawnClearance < 0 || spawnClearance > 16
    || !['food', 'wood'].includes(type) || !Number.isFinite(x) || !Number.isFinite(z)
    || !Number.isSafeInteger(totalStock) || totalStock < count
    || !Array.isArray(existing) || existing.length + count > 128) {
    throw new Error('Invalid additive resource cluster settings, total stock or node budget.');
  }
  const { width, height, cell, inside, blocked, paint, elevation } = clusterGround(map);
  const occupied = new Set(), ids = new Set();
  for (const node of existing) {
    if (!node || typeof node.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(node.id)
      || ids.has(node.id) || !['food', 'wood'].includes(node.type)
      || !Number.isFinite(node.x) || !Number.isFinite(node.z) || !inside(node.x, node.z)
      || !Number.isFinite(node.stock) || node.stock <= 0 || occupied.has(cell(node.x, node.z))) {
      throw new Error('Invalid or duplicate existing resource node ID/cell.');
    }
    ids.add(node.id); occupied.add(cell(node.x, node.z));
  }
  const safe = (px, pz) => inside(px, pz) && !blocked[cell(px, pz)]
    && !occupied.has(cell(px, pz)) && paint[cell(px, pz)] !== 'dirt'
    && elevation[cell(px, pz)] === elevation[cell(x, z)]
    && map.spawnPoints.every(s => Math.max(Math.abs(px - s.x), Math.abs(pz - s.z)) > spawnClearance)
    && existing.every(n => Math.hypot(px - n.x, pz - n.z) >= 2);
  if (!safe(x, z)) throw new Error('Unsafe or occupied additive resource cluster anchor.');
  const positions = [{ x, z }];
  for (const { dx, dz } of orderedOffsets(seed, 0, radius)) {
    if (positions.length === count) break;
    const px = x + dx, pz = z + dz;
    if (safe(px, pz) && positions.every(p => Math.hypot(px - p.x, pz - p.z) >= 2)) {
      positions.push({ x: px, z: pz });
    }
  }
  if (positions.length !== count) throw new Error('Additive resource cluster has insufficient safe space.');
  // At most existing.length occupied groups; a free group exists within this bound.
  let group = 1;
  for (; group <= existing.length + 1; group++) {
    if (positions.every((_, i) => !ids.has(`${type}-cluster-${group}-${i}`))) break;
  }
  const added = positions.map((position, i) => ({ id: `${type}-cluster-${group}-${i}`, type,
    ...position, stock: Math.floor(totalStock / count) + (i < totalStock % count ? 1 : 0) }));
  const nodes = [...existing.map(n => ({ ...n })), ...added];
  if (findUnreachableResourceNode(width, height, blocked, map.spawnPoints, nodes, elevation)) {
    throw new Error('Additive resource clusters must remain reachable from both seats with Town Centers present.');
  }
  return nodes;
}
