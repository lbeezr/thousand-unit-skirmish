import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { seededMirroredResourceClusters, MILLRACE_RESOURCE_CLUSTERS as settings } from '../src/resource-cluster-authoring.mjs';
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
