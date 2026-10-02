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

export function seededMirroredResourceClusters(map, settings = MILLRACE_RESOURCE_CLUSTERS) {
  const { seed, nodesPerPatch: count, radius, spawnClearance, patches } = settings;
  const { width, height } = map;
  if (!Number.isSafeInteger(seed) || !Number.isInteger(count) || count < 1 || count > 16
    || !Number.isInteger(radius) || radius < 1 || radius > 8
    || !Number.isInteger(spawnClearance) || spawnClearance < 0 || spawnClearance > 16
    || !Array.isArray(patches) || !patches.length || patches.length * count * 2 > 128) {
    throw new Error('Invalid resource cluster settings or node budget.');
  }
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
    const positions = [{ dx: 0, dz: 0 }], candidates = [];
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
      if (Math.hypot(dx, dz) <= radius && Math.hypot(dx, dz) >= 2) candidates.push({ dx, dz, rank: rank(seed, index, dx, dz) });
    }
    candidates.sort((a, b) => a.rank - b.rank || a.dz - b.dz || a.dx - b.dx);
    for (const candidate of candidates) {
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
