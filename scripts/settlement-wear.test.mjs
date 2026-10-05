import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createSettlementWearCache, createSettlementWearMesh, updateSettlementWearMesh } from '../src/settlement-wear.mjs';

const definitions = { house: { footprint: 3 }, 'town-center': { footprint: 5 }, workshop: { footprint: 3 }, 'palisade-wall': { footprint: 1 } };
const map = { width: 40, height: 40, terrainSeed: 17, obstacles: [] };
const house = (id, x, z = 0, extra = {}) => ({ id, type: 'house', team: 0, x, z, orientation: 0, complete: true, ...extra });
const row = [house(1, -4.5, .5), house(2, -.5, .5), house(3, 3.5, .5)];
const run = (buildings = row, definition = map, team = 0) => createSettlementWearCache(definition, definitions).update(buildings, team);
const alphaAt = (plan, x, z) => {
  const values = [];
  for (let i = 0; i < plan.vertices.length / 3; i++) {
    if (plan.vertices[i * 3] === x && plan.vertices[i * 3 + 2] === z) values.push(plan.colors[i * 4 + 3]);
  }
  assert.ok(values.length, `missing sample ${x},${z}`);
  assert.ok(values.every(a => Math.abs(a - values[0]) < 1e-10), 'shared vertices must agree across adjoining cells');
  return values[0];
};

test('three nearby completed owned buildings form continuous subdued wear; one/two/distant/enemy/unfinished do not', () => {
  assert.ok(run().indices.length > 0);
  for (const buildings of [row.slice(0, 1), row.slice(0, 2), [row[0], row[1], house(3, 15.5)],
    row.map(b => ({ ...b, complete: false })), row.map(b => ({ ...b, team: 1 }))]) assert.equal(run(buildings).indices.length, 0);
  assert.ok(run(row.map(b => ({ ...b, team: 1 })), map, 1).indices.length > 0);
  const plan = run();
  assert.ok(alphaAt(plan, -2.5, 3.5) > .1, 'adjoining entrance aprons join');
  assert.ok(plan.colors.filter((_, i) => i % 4 === 3).every(a => a >= 0 && a <= .7));
  assert.ok(new Set(plan.colors.filter((_, i) => i % 4 === 3)).size > 20, 'soft varying alpha, not square stamps');
});

test('rotation follows +Z,+X,-Z,-X logical front and demolition removes wear', () => {
  for (let orientation = 0; orientation < 4; orientation++) {
    const plan = run(row.map(b => ({ ...b, orientation })));
    const lobe = plan.lobes.find(l => l.id === 2);
    const [dx, dz] = [[0, 1], [1, 0], [0, -1], [-1, 0]][orientation];
    assert.equal(lobe.x, row[1].x + dx * 2.1); assert.equal(lobe.z, row[1].z + dz * 2.1);
  }
  const cache = createSettlementWearCache(map, definitions);
  assert.ok(cache.update(row, 0).indices.length);
  assert.equal(cache.update(row.slice(0, 2), 0).indices.length, 0);
  assert.ok(cache.update(row, 0).indices.length);
  assert.equal(cache.update(row, 1).indices.length, 0, 'ownership change removes old wear');
});

test('seed/site variation is stable under snapshot order, HP/progress/time changes; cache and geometry upload do not repeat', () => {
  const cache = createSettlementWearCache(map, definitions);
  const input = structuredClone(row), before = structuredClone(input);
  const first = cache.update(input, 0);
  assert.deepEqual(input, before);
  const second = cache.update([...row].reverse().map(b => ({ ...b, hp: 10, progress: .9 })), 0);
  assert.equal(second, first); assert.equal(cache.rebuilds, 1);
  assert.deepEqual(run([...row].reverse()), first);
  assert.notDeepEqual(run(row, { ...map, terrainSeed: 23 }).colors, first.colors);
  const mesh = createSettlementWearMesh(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthTest: true, depthWrite: false }));
  assert.equal(updateSettlementWearMesh(mesh, first), true);
  const geometry = mesh.geometry;
  assert.equal(updateSettlementWearMesh(mesh, second), false); assert.equal(mesh.geometry, geometry);
  const rotated = cache.update(row.map(b => ({ ...b, orientation: 2 })), 0);
  assert.notEqual(rotated, first); assert.equal(cache.rebuilds, 2);
  updateSettlementWearMesh(mesh, cache.update([], 0)); assert.equal(mesh.visible, false);
  mesh.geometry.dispose(); mesh.material.dispose();
});

test('all disclosed footprints, water/blockers, level changes and map edges are excluded and feathered', () => {
  const obstacle = { column: 18, row: 24, width: 2, height: 3, material: 'water' };
  const raised = { column: 24, row: 21, width: 3, height: 8, level: 2 };
  const definition = { ...map, obstacles: [obstacle], elevationPatches: [raised] };
  const building = house(4, 7.5, 3.5, { type: 'palisade-wall', complete: false });
  const plan = run([...row, building], definition);
  for (const cell of plan.cells) {
    const column = cell % map.width, r = Math.floor(cell / map.width);
    assert.ok(!(column >= 18 && column < 20 && r >= 24 && r < 27));
    assert.ok(!(column >= 24 && column < 27 && r >= 21 && r < 29));
    for (const b of [...row, building]) {
      const half = Math.floor(definitions[b.type].footprint / 2), c = Math.floor(b.x + 20), row = Math.floor(b.z + 20);
      assert.ok(!(column >= c - half && column <= c + half && r >= row - half && r <= row + half));
    }
  }
  for (let i = 0; i < plan.vertices.length / 3; i++) {
    const x = plan.vertices[i * 3], z = plan.vertices[i * 3 + 2], a = plan.colors[i * 4 + 3];
    assert.ok(x >= -20 && x <= 20 && z >= -20 && z <= 20);
    if (x >= -2 && x <= 0 && z === 4) assert.equal(a, 0, 'water boundary fades fully before water');
  }
  const explicit = run([...row, { ...building, footprint: [23 * 40 + 18] }]);
  assert.ok(!explicit.cells.includes(23 * 40 + 18), 'historical explicit occupancy remains authoritative');
});

test('flat/raised geometry follows the actual terrain triangles, budget fails closed and ground cannot pick or occlude actors', () => {
  const raised = { ...map, elevationPatches: [{ column: 0, row: 0, width: 40, height: 40, level: 1 }] };
  const plan = run(row, raised);
  for (let i = 1; i < plan.vertices.length; i += 3) assert.ok(Math.abs(plan.vertices[i] - .801) < 1e-6);
  assert.equal(run(Array.from({ length: 129 }, (_, i) => house(i, 0))).indices.length, 0);
  const mesh = createSettlementWearMesh(new THREE.MeshBasicMaterial());
  assert.equal(mesh.renderOrder, -.75); assert.equal(mesh.visible, false);
  const intersections = []; mesh.raycast({}, intersections); assert.deepEqual(intersections, []);
  const env = readFileSync(new URL('../src/environment-art.mjs', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(env, /export function createSettlementGround[\s\S]*groundTexture\('dirt', definition\)[\s\S]*depthTest: true, depthWrite: false/);
  assert.match(main, /settlementWearCache\.update\(rows, localTeam\)/);
  assert.match(main, /settlementWearMesh = createSettlementGround\(definition\)/);
  mesh.geometry.dispose(); mesh.material.dispose();
});
