import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { planPalisadeConstructionGround as plan, createPalisadeConstructionGroundMesh as create,
  updatePalisadeConstructionGroundMesh as update } from '../src/palisade-construction-ground.mjs';
import { constructionGroundStage } from '../src/building-visual-state.mjs';
import { isPalisade } from '../src/palisade-gate.mjs';

const row = (id, x, z, extra = {}) => ({ id, team: 0, x, z, type: 'palisade-wall', progress: .1,
  complete: false, connections: ['north', 'east', 'south', 'west'], ...extra });
const flat = () => 0;
const cells = p => [...p.earthwork.cells, ...p.foundation.cells];
test('owned connected construction cells join at straight/corner/junction edges, across real stages', () => {
  const input = [row(1, .5, .5), row(2, 1.5, .5, { progress: .5 }), row(3, 1.5, 1.5), row(4, 1.5, -.5)];
  const before = structuredClone(input), p = plan(input, flat), byId = new Map(cells(p).map(c => [c.id, c]));
  assert.deepEqual(byId.get(1).edges, [1, 0, 1, 1]);
  assert.deepEqual(byId.get(2).edges, [0, 1, 0, 0]);
  assert.deepEqual(byId.get(3).edges, [1, 1, 0, 1]);
  assert.equal(p.foundation.cells.length, 1); assert.equal(p.earthwork.cells.length, 3);
  assert.deepEqual(plan([...input].reverse(), flat), p, 'placement must not depend on snapshot order');
  assert.deepEqual(input, before, 'render planning must not edit simulation snapshots');
});

test('gaps, diagonal neighbours, other owners, complete/open gates and missing connections cannot bridge', () => {
  for (const neighbour of [row(2, 2.5, .5), row(2, 1.5, 1.5), row(2, 1.5, .5, { team: 1 }),
    row(2, 1.5, .5, { complete: true }), row(2, 1.5, .5, { progress: 1 }),
    row(2, 1.5, .5, { connections: [] }), row(2, 1.5, .5, { type: 'house' }),
    row(2, 1.5, .5, { type: 'palisade-gate', complete: true, gateOpen: true })]) {
    assert.deepEqual(cells(plan([row(1, .5, .5), neighbour], flat)).find(c => c.id === 1).edges, [1, 1, 1, 1]);
  }
  const gate = row(2, 1.5, .5, { type: 'palisade-gate' });
  assert.equal(cells(plan([row(1, .5, .5), gate], flat))[0].edges[1], 0);
  assert.equal(cells(plan([row(1, .5, .5), gate], x => x < 1 ? 0 : .8))[0].edges[1], 1);
  assert.equal(cells(plan([row(1, .5, .5), row(2, .5, .5)], flat)).length, 1, 'duplicate rows cannot darken a cell');
});

test('union triangles cover only real cells once, follow terrain and reuse buffers until membership/topology changes', () => {
  const material = new THREE.MeshBasicMaterial({ transparent: true, depthTest: true, depthWrite: false });
  const mesh = create(material, 4), buffers = { ...mesh.geometry.attributes };
  const input = [row(1, .5, .5), row(2, 1.5, .5), row(3, 1.5, 1.5)];
  const sample = (x, z) => x * .1 + z * .05, p = plan(input, sample);
  assert.equal(update(mesh, p.earthwork), true);
  assert.equal(mesh.geometry.drawRange.count, 18); assert.equal(mesh.userData.palisadeGround.count, 3);
  let area = 0;
  const pos = mesh.geometry.attributes.position, index = mesh.geometry.index;
  for (let t = 0; t < mesh.geometry.drawRange.count; t += 3) {
    const points = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(pos, index.getX(t + k)));
    const [a, b, c] = points;
    area += Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) / 2;
    assert.ok(a.x >= 0 && a.x <= 2 && a.z >= 0 && a.z <= 2);
    const cell = p.earthwork.cells[Math.floor(t / 6)];
    for (const point of points) {
      assert.ok(point.x >= cell.x - .5 && point.x <= cell.x + .5
        && point.z >= cell.z - .5 && point.z <= cell.z + .5, 'each triangle stays in its one occupied cell');
    }
    assert.ok(Math.abs(a.y - sample(a.x, a.z) - .002) < 1e-6, 'terrain contact retains lift, not a raised plane');
  }
  assert.equal(area, 3, 'no expanded/overlapping 3x3 site squares');
  const version = pos.version;
  assert.equal(update(mesh, plan(input.map(r => ({ ...r, progress: .2 })), sample).earthwork), true);
  assert.equal(pos.version, version, 'progress within one stage must not rewrite geometry');
  assert.equal(update(mesh, { signature: 'overflow', cells: Array(5).fill(p.earthwork.cells[0]) }), false);
  assert.equal(pos.version, version); assert.equal(mesh.geometry.drawRange.count, 18);
  assert.equal(update(mesh, plan([input[0]], sample).earthwork), true);
  assert.equal(mesh.geometry.drawRange.count, 6);
  assert.equal(update(mesh, plan([], sample).earthwork), true);
  assert.equal(mesh.visible, false); assert.equal(mesh.geometry.drawRange.count, 0);
  for (const name of Object.keys(buffers)) assert.equal(mesh.geometry.attributes[name], buffers[name]);
  assert.equal(mesh.renderOrder, -.5); mesh.geometry.dispose(); material.dispose();
});

test('real reconciliation uses union ground exclusively for walls/gates and clears both batches on completion/removal', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const code = source.slice(source.indexOf('function buildConstructionGroundBatches('), source.indexOf('\nfunction addResourceNodeVisual('));
  const oldUpdates = [], groundMeshes = new Map(), wallMeshes = new Map();
  const context = vm.createContext({ THREE, isPalisade, constructionGroundStage,
    constructionGroundMeshes: groundMeshes, palisadeGroundMeshes: wallMeshes, constructionGroundSignatures: new Map(),
    MAX_MAP_BUILDINGS: 128, groundHeight: flat, addMapObject() {},
    createConstructionGroundInstances: stage => ({ stage, count: 0 }),
    updateConstructionGroundInstances: (mesh, rows) => { mesh.count = rows.length; oldUpdates.push(rows); return true; },
    createConnectedPalisadeGround: () => create(new THREE.MeshBasicMaterial(), 128),
    planPalisadeConstructionGround: plan, updatePalisadeConstructionGroundMesh: update,
  });
  vm.runInContext(code, context); context.buildConstructionGroundBatches();
  const input = [row(1, .5, .5), row(2, 1.5, .5, { type: 'palisade-gate' }), row(3, 8.5, .5, { type: 'watchtower' })];
  context.updateConstructionGroundBatches(input);
  assert.equal(groundMeshes.get('earthwork').count, 1);
  assert.ok(oldUpdates.flat().every(r => !isPalisade(r.type)), 'no wall receives the old square overlay as well');
  assert.equal(wallMeshes.get('earthwork').userData.palisadeGround.count, 2);
  context.updateConstructionGroundBatches(input.map(r => ({ ...r, complete: true })));
  for (const mesh of groundMeshes.values()) assert.equal(mesh.count, 0);
  for (const mesh of wallMeshes.values()) { assert.equal(mesh.visible, false); assert.equal(mesh.geometry.drawRange.count, 0); }
  context.updateConstructionGroundBatches([]);
  for (const mesh of wallMeshes.values()) { mesh.geometry.dispose(); mesh.material.dispose(); }
});

test('connected soil shader retains map decode, alpha cutout and fog, with feather only on exposed boundaries', () => {
  const material = new THREE.MeshBasicMaterial(), mesh = create(material, 2);
  const shader = { vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
  material.onBeforeCompile(shader);
  assert.ok(shader.vertexShader.includes('vGroundWorld = position.xz'));
  assert.ok(shader.fragmentShader.includes('0.3 + 0.4 * abs(fract(vGroundWorld'));
  for (const chunk of ['#include <alphatest_fragment>', '#include <fog_fragment>']) assert.ok(shader.fragmentShader.includes(chunk));
  assert.ok(shader.fragmentShader.includes('diffuseColor *= sampledDiffuseColor'));
  assert.ok(shader.fragmentShader.includes('mix(vec4(1.0), edgeDistance, vGroundEdges)'));
  mesh.geometry.dispose(); material.dispose();
});
