import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createNeutralWildlifeRenderer } from '../src/neutral-wildlife-renderer.mjs';
import { wildlifeClientBindings, wildlifeClientFunctionSource } from './wildlife-client-fixture-bindings.mjs';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const start = main.indexOf('  // Resource markers stay legible');
const end = main.indexOf('\n  context.globalAlpha = 1;\n\n  const viewportCorners', start);
assert.ok(start >= 0 && end > start);
const minimapRows = `function paintResourceRows(context, rect) { ${main.slice(start, end)} }`;
const pickStart = main.indexOf('function pickResourceNodeAt(');
const picking = main.slice(pickStart, main.indexOf('\nfunction pickForestCellAt(', pickStart));
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
  const context = vm.createContext({ ...wildlifeClientBindings(), localTeam: team, mapDefinition: map, MAP_WIDTH: 16, MAP_HEIGHT: 16,
    MAP_HALF_X: 8, MAP_HALF_Z: 8, latestFogCells: fog, wildlifeRenderer: renderer,
    latestResourceStocks: new Map([[authored.id, 100]]), latestBuildings: [], farmHarvestNode: () => null,
    isShoreFish: () => false, resourceNodeVisuals: new Map(), camera, screenPoint: new THREE.Vector3(), groundHeight: () => .15,
    renderer: { domElement: { getBoundingClientRect: () => ({ width: 200, height: 160 }) } },
    minimapPoint: (x, z) => ({ x: (x + 8) * 10, y: (z + 8) * 10 }),
  });
  vm.runInContext(wildlifeClientFunctionSource(main) + minimapRows + picking, context);
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
