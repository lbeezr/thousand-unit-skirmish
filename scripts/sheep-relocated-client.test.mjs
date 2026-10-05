import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createNeutralWildlifeRenderer } from '../src/neutral-wildlife-renderer.mjs';
import { wildlifeClientBindings, wildlifeClientFunctionSource } from './wildlife-client-fixture-bindings.mjs';
import { resourcePickingBindings, resourcePickingFunctionSource } from './resource-picking-fixture-bindings.mjs';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const start = main.indexOf('  // Resource markers stay legible');
const end = main.indexOf('\n  context.globalAlpha = 1;\n\n  const viewportCorners', start);
assert.ok(start >= 0 && end > start);
const minimapRows = `function paintResourceRows(context, rect) { ${main.slice(start, end)} }`;
const map = { id: 'relocated-client-proof', width: 16, height: 16, fogOfWar: true, resourceNodes: [
  { id: 'relocated-sheep', type: 'food', wildlifeSpecies: 'bellweather-sheep', stock: 100, x: 2.5, z: -3.5 },
] };
const authored = map.resourceNodes[0];
const cell = p => Math.floor(p.z + 8) * 16 + Math.floor(p.x + 8);
const actual = { ...authored, x: -4.5, z: 3.5, wildlifeState: 'alive', wildlifeHeading: Math.PI / 2,
  wildlifeActivity: 'wandering' };
function fixture(t, team) {
  const camera = new THREE.OrthographicCamera(-8, 8, 8, -8, .1, 100);
  camera.position.set(0, 20, 0); camera.up.set(0, 0, -1); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const scene = new THREE.Scene();
  const renderer = createNeutralWildlifeRenderer({ THREE, scene, groundHeight: () => .15,
    loadArt: () => Promise.reject(new Error('explicit CPU fallback')) });
  renderer.reset(map.resourceNodes, map);
  t.after(() => renderer.dispose());
  const fog = new Uint8Array(256), arcs = [];
  const context = vm.createContext({ ...resourcePickingBindings(), ...wildlifeClientBindings(), localTeam: team, mapDefinition: map, MAP_WIDTH: 16, MAP_HEIGHT: 16,
    MAP_HALF_X: 8, MAP_HALF_Z: 8, latestFogCells: fog, wildlifeRenderer: renderer,
    latestResourceStocks: new Map([[authored.id, 100]]), latestBuildings: [],
    isShoreFish: () => false, resourceNodeVisuals: new Map(), camera, screenPoint: new THREE.Vector3(), groundHeight: () => .15,
    renderer: { domElement: { getBoundingClientRect: () => ({ width: 200, height: 160 }) } },
    minimapPoint: (x, z) => ({ x: (x + 8) * 10, y: (z + 8) * 10 }),
  });
  vm.runInContext(wildlifeClientFunctionSource(main) + minimapRows + resourcePickingFunctionSource(main), context);
  const pen = { beginPath() {}, fill() {}, arc(x, y, radius) { arcs.push({ x, y, radius }); } };
  const screen = p => {
    const v = new THREE.Vector3(p.x, .37, p.z).project(camera);
    return [(v.x * .5 + .5) * 200, (-v.y * .5 + .5) * 160];
  };
  function disclose(rows) {
    context.applyWildlifeState({ mapId: map.id, forestEpoch: 7, resourceNodes: rows }); renderer.update(camera);
  }
  return { renderer, scene, fog, arcs, context, screen, disclose,
    paint() { arcs.length = 0; context.paintResourceRows(pen, {}); } };
}

for (const team of [0, 1]) test(`seat ${team}: relocated visible Sheep renders, picks and paints from its current cell`, t => {
  const f = fixture(t, team);
  f.fog[cell(authored)] = 0; f.fog[cell(actual)] = 2;
  for (const owner of [null, 0, 1]) {
    f.disclose([{ ...actual, wildlifeTeam: owner }]);
    assert.equal(f.renderer.isAvailable(authored.id), true, 'ownership does not change actual-cell sight');
    assert.deepEqual(f.scene.children[0].position.toArray(), [actual.x, .15, actual.z]);
    assert.equal(f.context.pickResourceNodeAt(...f.screen(actual), { visibleOnly: true }).id, authored.id);
    assert.equal(f.context.pickResourceNodeAt(...f.screen(authored), { visibleOnly: true }), null, 'vacated authored location cannot be picked');
    f.paint();
    assert.equal(f.arcs.length, 2);
    assert.deepEqual(f.arcs[0], { x: (actual.x + 8) * 10, y: (actual.z + 8) * 10, radius: 6 });
  }
});

for (const team of [0, 1]) test(`seat ${team}: ownership and an explored authored cell cannot reveal hidden relocated food`, t => {
  const f = fixture(t, team);
  f.fog[cell(authored)] = 2;
  for (const actualFog of [0, 1]) {
    f.fog[cell(actual)] = actualFog;
    f.disclose([{ ...actual, wildlifeTeam: team }]);
    assert.equal(f.renderer.isAvailable(authored.id), false);
    assert.equal(f.context.pickResourceNodeAt(...f.screen(actual)), null);
    f.paint(); assert.equal(f.arcs.length, 0);
  }
  f.fog[cell(actual)] = 2; f.disclose([{ ...actual, wildlifeTeam: team }]);
  f.disclose([]);
  assert.equal(f.context.pickResourceNodeAt(...f.screen(actual)), null);
  f.paint(); assert.equal(f.arcs.length, 0, 'omission removes rendering and minimap immediately');
});

test('relocated partial carcass remains gatherable; depletion removes its art and target', t => {
  const f = fixture(t, 0); f.fog[cell(actual)] = 2;
  f.disclose([{ ...actual, stock: 40, wildlifeState: 'carcass', wildlifeActivity: undefined, wildlifeTeam: 1 }]);
  assert.equal(f.renderer.diagnostics().nodes[0].mode, 'food-cache-marker');
  assert.equal(f.context.pickResourceNodeAt(...f.screen(actual), { visibleOnly: true }).id, authored.id);
  f.disclose([{ ...actual, stock: 0, wildlifeState: 'depleted', wildlifeActivity: undefined, wildlifeTeam: 1 }]);
  assert.equal(f.context.pickResourceNodeAt(...f.screen(actual)), null);
  f.paint(); assert.equal(f.arcs.length, 0);
});

for (const team of [0, 1]) test(`seat ${team}: inspection excludes Farm body/point but admits only current visible positive-food wildlife`, t => {
  const f = fixture(t, team), inspect = { visibleOnly: true, inspectableWildlifeOnly: true };
  f.context.camera.position.set(actual.x + 1.5, 20, actual.z);
  f.context.camera.lookAt(actual.x + 1.5, 0, actual.z);
  f.context.camera.zoom = 2; f.context.camera.updateProjectionMatrix(); f.context.camera.updateMatrixWorld();
  const farm = { id: 77, type: 'farm', team, complete: true, hp: 600,
    x: actual.x + 3.5, z: actual.z, harvestStock: 200 };
  const geometry = new THREE.BoxGeometry(3, 2, 3), material = new THREE.MeshBasicMaterial();
  const group = new THREE.Group(); group.position.set(farm.x, 1, farm.z);
  group.add(new THREE.Mesh(geometry, material));
  t.after(() => { geometry.dispose(); material.dispose(); });
  f.context.latestBuildings.push(farm); f.context.buildingVisuals.set(farm.id, { group });
  f.fog[cell(farm)] = 2; f.fog[cell(actual)] = 2;
  const body = f.screen({ x: farm.x + 1.2, z: farm.z }), base = f.screen(farm);
  assert.ok(Math.hypot(body[0] - base[0], body[1] - base[1]) > 26, 'real body hit lies outside point radius');
  for (const stock of [200, 0]) {
    farm.harvestStock = stock;
    for (const point of [body, base]) {
      const target = f.context.pickResourceNodeAt(...point);
      assert.equal(target.id, 'farm:77'); assert.equal(target.stock, stock);
      assert.equal(f.context.pickResourceNodeAt(...point, inspect), null, 'inspection cannot select a productive or exhausted Farm');
    }
  }
  // Removing the body still exercises the generic point loop's Farm adapter.
  group.visible = false;
  assert.equal(f.context.pickResourceNodeAt(...base).stock, 0);
  assert.equal(f.context.pickResourceNodeAt(...base, inspect), null);
  group.visible = true;
  const pick = () => f.context.pickResourceNodeAt(...f.screen(actual), inspect);
  for (const owner of [null, 0, 1]) for (const stock of [40, .004]) {
    f.disclose([{ ...actual, stock, wildlifeState: 'carcass', wildlifeActivity: undefined, wildlifeTeam: owner }]);
    assert.equal(pick()?.id, authored.id, 'visible shared carcass is inspectable regardless of former ownership');
    assert.equal(pick().stock, stock, 'fractional Food stays exact');
    assert.equal(f.context.pickResourceNodeAt(...f.screen(authored), inspect), null, 'vacated authored pose cannot reveal relocated food');
  }
  for (const owner of [null, 0, 1]) {
    f.disclose([{ ...actual, wildlifeTeam: owner }]);
    assert.equal(pick()?.id ?? null, owner === team ? authored.id : null, 'live inspection retains owned Sheep authority');
  }
  for (const fog of [0, 1]) {
    f.fog[cell(actual)] = fog;
    f.disclose([{ ...actual, stock: 40, wildlifeState: 'carcass', wildlifeActivity: undefined, wildlifeTeam: team }]);
    assert.equal(pick(), null, 'hidden/explored-only corpse is not inspectable');
  }
  f.fog[cell(actual)] = 2;
  f.disclose([{ ...actual, stock: 40, wildlifeState: 'carcass', wildlifeActivity: undefined, wildlifeTeam: team }]);
  f.context.wildlifeRenderer = { isAvailable: () => false };
  assert.equal(pick(), null, 'disclosed corpse without an available marker cannot be inspected');
  f.context.wildlifeRenderer = f.renderer;
  f.disclose([]); assert.equal(pick(), null, 'omitted disclosure cannot fall back to authored stock');
  f.disclose([{ ...actual, stock: 0, wildlifeState: 'depleted', wildlifeActivity: undefined, wildlifeTeam: team }]);
  assert.equal(pick(), null, 'empty corpse stays uninspectable');
});
