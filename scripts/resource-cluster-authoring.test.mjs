import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { appendSeededResourceCluster, seededMirroredResourceClusters, MILLRACE_RESOURCE_CLUSTERS as settings } from '../src/resource-cluster-authoring.mjs';
import { buildElevationGrid } from '../src/map-utils.mjs';
import { canTraverseElevation } from '../src/elevation.mjs';
import { townCenterFootprintCells } from '../src/town-center-spawn.mjs';
import { settlementGround } from '../src/settlement-authoring.mjs';

const map = JSON.parse(await readFile(new URL('../maps/bellweather-millrace.json', import.meta.url)));
const baseline = JSON.parse(await readFile(new URL('./fixtures/settlement-ground-baseline.json', import.meta.url))).maps[map.id];
const before = { ...baseline, terrainPatches: settlementGround(baseline) };
const total = (nodes, type) => nodes.filter(n => n.type === type).reduce((sum, n) => sum + n.stock, 0);
const cell = n => Math.floor(n.z + map.height / 2) * map.width + Math.floor(n.x + map.width / 2);
const blocked = new Uint8Array(map.width * map.height);
for (const rect of map.obstacles) for (let row = rect.row; row < rect.row + rect.height; row++) blocked.fill(1, row * map.width + rect.column, row * map.width + rect.column + rect.width);
for (const team of [0, 1]) for (const index of townCenterFootprintCells(map.spawnPoints, team, map.width, map.height)) blocked[index] = 1;
const paint = Array(blocked.length).fill(map.terrainBase);
for (const rect of map.terrainPatches) for (let row = rect.row; row < rect.row + rect.height; row++) paint.fill(rect.material, row * map.width + rect.column, row * map.width + rect.column + rect.width);
const elevation = buildElevationGrid(map.width, map.height, map.elevationPatches);
function distances(team) {
  const result = new Int32Array(blocked.length).fill(-1), queue = [cell(map.spawnPoints.find(s => s.team === team))];
  result[queue[0]] = 0;
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head], col = current % map.width, row = Math.floor(current / map.width);
    for (const next of [col > 0 ? current - 1 : -1, col + 1 < map.width ? current + 1 : -1,
      row > 0 ? current - map.width : -1, row + 1 < map.height ? current + map.width : -1]) {
      if (next < 0 || blocked[next] || result[next] >= 0 || !canTraverseElevation(elevation, current, next)) continue;
      result[next] = result[current] + 1; queue.push(next);
    }
  }
  return result;
}
const paths = [distances(0), distances(1)];

test('Millrace materializes the profile reproducibly without changing other map fields', () => {
  const input = JSON.stringify(map);
  assert.deepEqual(seededMirroredResourceClusters(map), map.resourceNodes);
  assert.equal(JSON.stringify(map), input);
  for (const [key, value] of Object.entries(before)) if (key !== 'resourceNodes') assert.deepEqual(map[key], value, key);
  assert.notDeepEqual(seededMirroredResourceClusters(map, { ...settings, seed: 93001 }), map.resourceNodes);
  assert.equal(map.resourceNodes.length, 40);
  assert.equal(new Set(map.resourceNodes.map(n => n.id)).size, 40);
  assert.equal(new Set(map.resourceNodes.map(cell)).size, 40);
  assert.equal(total(before.resourceNodes, 'food'), 2800); assert.equal(total(map.resourceNodes, 'food'), 2800);
  assert.equal(total(before.resourceNodes, 'wood'), 2800); assert.equal(total(map.resourceNodes, 'wood'), 4200);
  const forestStock = map.obstacles.filter(r => r.material === 'forest').reduce((n, r) => n + r.width * r.height * 6, 0);
  assert.equal(forestStock, 1404);
  console.log(JSON.stringify({ before: { nodes: 8, food: 2800, nodeWood: 2800, totalWood: 4204 },
    after: { nodes: 40, food: 2800, nodeWood: 4200, totalWood: 5604 }, forestWood: forestStock }));
});

test('both seats retain anchors, accessible mirrored clusters, build clearings and painted routes', () => {
  for (const [index, patch] of settings.patches.entries()) {
    const nodes = map.resourceNodes.filter(n => n.id === `s0-${index}` || n.id.startsWith(`s0-${index}-`));
    assert.equal(nodes.length, 5); assert.equal(nodes.reduce((n, p) => n + p.stock, 0), patch.stock);
    const anchor = nodes[0];
    assert.deepEqual({ x: anchor.x, z: anchor.z, type: anchor.type }, { x: patch.x, z: patch.z, type: patch.type });
    for (const node of nodes) {
      const opposite = map.resourceNodes.find(n => n.id === node.id.replace('s0', 's1'));
      assert.deepEqual(opposite, { ...node, id: node.id.replace('s0', 's1'), x: -node.x });
      assert.ok(paths.every(p => p[cell(node)] >= 0 && p[cell(opposite)] >= 0));
      assert.equal(paths[0][cell(node)], paths[1][cell(opposite)]);
      assert.ok(Math.hypot(node.x - anchor.x, node.z - anchor.z) <= settings.radius);
      for (const other of nodes) if (other !== node) assert.ok(Math.hypot(node.x - other.x, node.z - other.z) >= 2);
      if (node === anchor) continue;
      for (const candidate of [node, opposite]) {
        assert.equal(blocked[cell(candidate)], 0); assert.notEqual(paint[cell(candidate)], 'dirt');
        assert.ok(map.spawnPoints.every(s => Math.max(Math.abs(candidate.x - s.x), Math.abs(candidate.z - s.z)) > settings.spawnClearance));
        assert.equal(elevation[cell(candidate)], elevation[cell(anchor)]);
      }
    }
    const travel = ns => ({ nearestCells: Math.min(...ns.map(n => paths[0][cell(n)])),
      stockWeightedMeanCells: ns.reduce((sum, n) => sum + paths[0][cell(n)] * n.stock, 0) / ns.reduce((sum, n) => sum + n.stock, 0) });
    console.log(JSON.stringify({ patch: index, type: patch.type, before: travel([before.resourceNodes.find(n => n.id === anchor.id)]), after: travel(nodes) }));
  }
});

test('explicit quantity settings conserve integer stock and fail closed on impossible placement', () => {
  const custom = { ...settings, nodesPerPatch: 3, patches: settings.patches.map(p => ({ ...p, stock: 101 })) };
  const nodes = seededMirroredResourceClusters(map, custom);
  assert.equal(nodes.length, 24); assert.ok(nodes.every(n => Number.isInteger(n.stock) && n.stock > 0));
  assert.equal(total(nodes, 'food'), 404); assert.equal(total(nodes, 'wood'), 404);
  for (const invalid of [{ nodesPerPatch: 17 }, { radius: 0 }, { seed: NaN }, { patches: Array(13).fill(settings.patches[0]) }]) {
    assert.throws(() => seededMirroredResourceClusters(map, { ...settings, ...invalid }), /settings|budget/);
  }
  assert.throws(() => seededMirroredResourceClusters({ ...map, obstacles: [{ column: 0, row: 0, width: map.width, height: map.height }] }), /anchor/);
  assert.throws(() => seededMirroredResourceClusters(map, { ...settings, radius: 1 }), /safe cluster space/);
  assert.throws(() => seededMirroredResourceClusters(map, { ...settings, patches: [settings.patches[0], settings.patches[0]] }), /overlapping/);
});

const additiveSettings = { seed: 93000, type: 'food', x: -8.5, z: -10.5, totalStock: 101 };
function additiveMap(resourceNodes = [
  { id: 'food-cluster-1-4', type: 'food', x: 8.5, z: 10.5, stock: 13.5 },
  { id: 'existing-wood', type: 'wood', x: -3.5, z: 14.5, stock: 83 },
]) {
  return { id: 'additive-test', name: 'ADDITIVE TEST', width: 64, height: 64, terrainBase: 'meadow', terrainPatches: [], elevationPatches: [],
    obstacles: [], spawnPoints: [{ team: 0, x: -20.5, z: 0.5 }, { team: 1, x: 20.5, z: 0.5 }], resourceNodes };
}
const pointCell = p => ({ column: Math.floor(p.x + 32), row: Math.floor(p.z + 32), width: 1, height: 1 });
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function rejectsUnchanged(input, options, pattern) {
  const before = JSON.stringify(input), request = JSON.stringify(options);
  assert.throws(() => appendSeededResourceCluster(freeze(input), freeze(options)), pattern);
  assert.equal(JSON.stringify(input), before); assert.equal(JSON.stringify(options), request);
}

test('append preserves existing stock and IDs, with a deterministic exact patch-total budget', () => {
  const input = freeze(additiveMap()), options = freeze({ ...additiveSettings });
  const nodes = appendSeededResourceCluster(input, options), added = nodes.slice(2);
  assert.deepEqual(nodes, appendSeededResourceCluster(input, options));
  assert.deepEqual(nodes.slice(0, 2), input.resourceNodes);
  assert.notEqual(nodes[0], input.resourceNodes[0]);
  assert.deepEqual(added.map(n => n.stock), [21, 20, 20, 20, 20]);
  assert.equal(total(added, 'food'), 101); assert.equal(total(nodes, 'wood'), 83);
  assert.deepEqual(added.map(n => n.id), [0, 1, 2, 3, 4].map(i => `food-cluster-2-${i}`));
  assert.deepEqual(added[0], { id: 'food-cluster-2-0', type: 'food', x: -8.5, z: -10.5, stock: 21 });
  assert.notDeepEqual(added, appendSeededResourceCluster(input, { ...options, seed: 93001 }).slice(2));
  assert.deepEqual(added, appendSeededResourceCluster({ ...input, resourceNodes: [...input.resourceNodes].reverse() }, options).slice(2));
  nodes[0].stock = 1; assert.equal(input.resourceNodes[0].stock, 13.5);
});

test('repeated additions work on either side and the center without implicit mirroring', () => {
  const input = additiveMap();
  const first = appendSeededResourceCluster(input, additiveSettings);
  const second = appendSeededResourceCluster({ ...input, resourceNodes: first }, { ...additiveSettings, x: 8.5 });
  assert.equal(second.length, 12); assert.deepEqual(second.slice(0, 7), first);
  assert.equal(new Set(second.map(n => n.id)).size, second.length);
  assert.ok(second.slice(7).every(n => n.x > 0));
  assert.equal(total(second, 'food'), 13.5 + 202);
  const centered = appendSeededResourceCluster(additiveMap([]), { ...additiveSettings, x: 0.5, z: 10.5 });
  assert.equal(centered.length, 5); assert.equal(centered[0].x, 0.5);
});

test('existing candidate cells and their two-cell clearance are respected without losing existing nodes', () => {
  const original = appendSeededResourceCluster(additiveMap([]), additiveSettings);
  const reserved = { ...original[1], id: 'reserved', stock: 42 };
  const nodes = appendSeededResourceCluster(additiveMap([reserved]), additiveSettings);
  assert.equal(nodes.length, 6); assert.deepEqual(nodes[0], reserved);
  assert.equal(total(nodes.slice(1), 'food'), 101);
  assert.ok(nodes.slice(1).every(n => Math.hypot(n.x - reserved.x, n.z - reserved.z) >= 2));
  assert.equal(new Set(nodes.map(n => `${Math.floor(n.x + 32)},${Math.floor(n.z + 32)}`)).size, 6);
  rejectsUnchanged(additiveMap([reserved]), { ...additiveSettings, x: reserved.x, z: reserved.z }, /occupied/);
});

test('the 128-node budget includes existing nodes and fails before changing either input', () => {
  const dense = Array.from({ length: 124 }, (_, i) => ({ id: `old-${i}`, type: 'wood',
    x: -31.5 + i % 16, z: -31.5 + Math.floor(i / 16), stock: 1 }));
  const nodes = appendSeededResourceCluster(additiveMap(dense.slice(0, 123)), { ...additiveSettings, x: 0.5, z: 10.5 });
  assert.equal(nodes.length, 128); assert.deepEqual(nodes.slice(0, 123), dense.slice(0, 123));
  rejectsUnchanged(additiveMap(dense), additiveSettings, /node budget/);
});

test('new stock must be an explicit safe integer total sufficient for every marker', () => {
  for (const invalid of [{ totalStock: undefined }, { totalStock: 4 }, { totalStock: 10.5 },
    { totalStock: Number.MAX_SAFE_INTEGER + 1 }, { totalStock: Infinity }, { seed: NaN },
    { nodesPerPatch: 17 }, { radius: 0 }, { spawnClearance: -1 }, { type: 'gold' }]) {
    rejectsUnchanged(additiveMap(), { ...additiveSettings, ...invalid }, /settings|stock|budget/);
  }
  const large = appendSeededResourceCluster(additiveMap([]), { ...additiveSettings, totalStock: Number.MAX_SAFE_INTEGER });
  assert.equal(total(large, 'food'), Number.MAX_SAFE_INTEGER);
  const single = appendSeededResourceCluster(additiveMap([]), { ...additiveSettings, nodesPerPatch: 1, totalStock: 1 });
  assert.equal(single.length, 1); assert.equal(single[0].stock, 1);
});

test('duplicate existing IDs or occupied cells and invalid existing nodes reject atomically', () => {
  const node = additiveMap().resourceNodes[0];
  for (const existing of [[node, { ...node, x: 12.5 }], [node, { ...node, id: 'other' }],
    [{ ...node, stock: 0 }], [{ ...node, x: 32 }], [{ ...node, id: 'invalid ID' }]]) {
    rejectsUnchanged(additiveMap(existing), additiveSettings, /existing resource node/);
  }
});

test('anchors reject bounds, blockers, dirt, actual home footprints and spawn clearings', () => {
  rejectsUnchanged(additiveMap(), { ...additiveSettings, x: 32 }, /anchor/);
  rejectsUnchanged({ ...additiveMap(), obstacles: [{ ...pointCell(additiveSettings), material: 'stone' }] }, additiveSettings, /anchor/);
  rejectsUnchanged({ ...additiveMap(), terrainPatches: [{ ...pointCell(additiveSettings), material: 'dirt' }] }, additiveSettings, /anchor/);
  const input = additiveMap(), homeCell = townCenterFootprintCells(input.spawnPoints, 0, 64, 64)[0];
  rejectsUnchanged(input, { ...additiveSettings, x: homeCell % 64 - 31.5, z: Math.floor(homeCell / 64) - 31.5, spawnClearance: 0 }, /anchor/);
  rejectsUnchanged(additiveMap(), { ...additiveSettings, x: -20.5, z: 0.5 }, /anchor/);
});

test('satellites avoid blocked cells, dirt tracks and different elevations', () => {
  const candidate = appendSeededResourceCluster(additiveMap([]), additiveSettings)[1];
  const rect = pointCell(candidate);
  for (const change of [{ obstacles: [{ ...rect, material: 'stone' }] },
    { terrainPatches: [{ ...rect, material: 'dirt' }] }, { elevationPatches: [{ ...rect, level: 1 }] }]) {
    const nodes = appendSeededResourceCluster({ ...additiveMap([]), ...change }, additiveSettings);
    assert.equal(nodes.length, 5); assert.equal(total(nodes, 'food'), 101);
    assert.ok(nodes.every(n => n.x !== candidate.x || n.z !== candidate.z));
  }
});

test('partial placement and final both-seat connectivity failures leave all state unchanged', () => {
  rejectsUnchanged(additiveMap(), { ...additiveSettings, nodesPerPatch: 6, radius: 2 }, /insufficient safe space/);
  rejectsUnchanged({ ...additiveMap([]), obstacles: [{ column: 32, row: 0, width: 1, height: 64, material: 'stone' }] },
    additiveSettings, /reachable from both seats/);
});
