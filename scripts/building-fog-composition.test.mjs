import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import * as THREE from 'three';
import { clearOwnedBuildingFog } from '../src/building-fog-composition.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';

const columns = 16, rows = 12, count = columns * rows;
const alphaIndex = cell => ((rows - 1 - Math.floor(cell / columns)) * columns + cell % columns) * 4 + 3;
function remembered() {
  const cells = new Uint8Array(count).fill(1), pixels = new Uint8Array(count * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set([8, 14, 12, 154], i);
  return { cells, pixels };
}
const building = (team = 0, type = 'barracks', other = {}) => ({ id: 1, team, type, x: .5, z: .5, hp: 100, complete: true, progress: 1, ...other });
function footprint(b) {
  const size = BUILDING_DEFINITIONS[b.type].footprint, half = Math.floor(size / 2);
  const cx = Math.floor(b.x + columns / 2), cy = Math.floor(b.z + rows / 2), cells = [];
  for (let row = cy - half; row <= cy + half; row++) for (let col = cx - half; col <= cx + half; col++) cells.push(row * columns + col);
  return cells;
}

test('both sides retain owned art across construction, completion, damage and repair without revealing surrounding ground', () => {
  const states = [{ complete: false, progress: 0 }, { complete: false, progress: .5 },
    { complete: true, progress: 1 }, { complete: true, progress: 1, hp: 50 },
    { complete: true, progress: 1, hp: 20 }, { complete: true, progress: 1, hp: 100 }];
  for (const team of [0, 1]) for (const type of ['barracks', 'stable', 'farm', 'mill', 'town-center', 'house', 'palisade-wall']) {
    for (const state of states) {
      const b = building(team, type, state), { cells, pixels } = remembered();
      const inputCells = cells.slice(), inputBuilding = structuredClone(b), occupied = new Set(footprint(b));
      clearOwnedBuildingFog(pixels, cells, [b], team, columns, rows);
      for (let cell = 0; cell < count; cell++) assert.equal(pixels[alphaIndex(cell)], occupied.has(cell) ? 0 : 154, `${team}/${type}/${cell}`);
      assert.deepEqual(cells, inputCells, 'visibility state for targeting/forest remains authoritative');
      assert.deepEqual(b, inputBuilding);
      for (let i = 0; i < pixels.length; i += 4) assert.deepEqual(Array.from(pixels.slice(i, i + 3)), [8, 14, 12]);
    }
  }
});

test('unexplored and invalid states remain opaque even inside an owned footprint; current visibility stays clear', () => {
  const b = building(), { cells, pixels } = remembered();
  const states = [0, 1, 2, 3];
  footprint(b).forEach((cell, i) => {
    cells[cell] = states[i % 4]; pixels[alphaIndex(cell)] = [255, 154, 0, 255][cells[cell]];
  });
  const before = cells.slice();
  clearOwnedBuildingFog(pixels, cells, [b], 0, columns, rows);
  for (const cell of footprint(b)) assert.equal(pixels[alphaIndex(cell)], cells[cell] === 1 || cells[cell] === 2 ? 0 : 255);
  assert.deepEqual(cells, before);
});

test('same-team buildings compose together; enemy, remembered-only, absent and spectator objects confer no exemption', () => {
  for (const team of [0, 1]) {
    const owned = [building(team, 'barracks', { x: -1.5 }), building(team, 'stable', { id: 2, x: 1.5 })];
    const enemy = building(1 - team, 'mill', { id: 3, x: -5.5 });
    const { cells, pixels } = remembered();
    const mask = new Set(owned.flatMap(footprint));
    clearOwnedBuildingFog(pixels, cells, [...owned, enemy], team, columns, rows);
    for (let cell = 0; cell < count; cell++) assert.equal(pixels[alphaIndex(cell)], mask.has(cell) ? 0 : 154);
    const enemyOnly = remembered();
    clearOwnedBuildingFog(enemyOnly.pixels, enemyOnly.cells, [enemy], team, columns, rows);
    assert.ok(enemyOnly.pixels.filter((_, i) => i % 4 === 3).every(a => a === 154));
  }
  for (const team of [null, undefined, -1, 2, '0']) {
    const { cells, pixels } = remembered(), before = pixels.slice();
    clearOwnedBuildingFog(pixels, cells, [building()], team, columns, rows);
    assert.deepEqual(pixels, before);
  }
  // There is no cross-team alliance disclosure in this two-team game.
  for (const b of [building(2), building(0, 'unknown'), building(0, '__proto__'),
    building(0, 'barracks', { hp: 0 }), building(0, 'barracks', { hp: -1 }),
    building(0, 'barracks', { hp: '100' }), building(0, 'barracks', { hp: Infinity }),
    building(0, 'barracks', { x: NaN }), building(0, 'barracks', { x: 1000 }),
    building(0, 'town-center', { home: true }), null]) {
    const { cells, pixels } = remembered(), before = pixels.slice();
    clearOwnedBuildingFog(pixels, cells, [b], 0, columns, rows); assert.deepEqual(pixels, before);
  }
});

function clientFog(height = 0) {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const declarations = parse(main, { ecmaVersion: 'latest', sourceType: 'module' }).body;
  const extract = name => {
    const node = declarations.find(n => n.type === 'FunctionDeclaration' && n.id.name === name);
    return main.slice(node.start, node.end);
  };
  const geometry = new THREE.PlaneGeometry(columns, rows); geometry.rotateX(-Math.PI / 2); geometry.translate(0, height, 0);
  const context = vm.createContext({ THREE, clearOwnedBuildingFog,
    MAP_WIDTH: columns, MAP_HEIGHT: rows, MAP_HALF_X: columns / 2, MAP_HALF_Z: rows / 2,
    localTeam: 0, fogTexture: null, fogMesh: null, latestFogCells: null,
    latestBuildings: [building(0, 'mill', { x: -5.5 })], // Deliberately stale: must not be used.
    terrainSurface: { geometry }, minimapFogCanvas: {}, minimapFogImage: null,
    minimapFogContext: { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} },
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    addMapObject() {}, performance: { now: () => 0 }, drawMinimap() {} });
  vm.runInContext(extract('buildFogOverlay') + '\n' + extract('updateFogFromState'), context);
  context.buildFogOverlay({ fogOfWar: true });
  return context;
}
const wire = cells => {
  const packed = Buffer.alloc(Math.ceil(count / 4));
  cells.forEach((state, i) => { packed[i >> 2] |= state << ((i & 3) * 2); });
  return { columns, rows, data: packed.toString('base64') };
};

test('shipped fog update removes the demonstrated band while minimap, forest/terrain state and elevation/depth stay unchanged', () => {
  for (const height of [0, 2.4]) for (const team of [0, 1]) {
    const context = clientFog(height); context.localTeam = team;
    const b = building(team), cells = new Uint8Array(count).fill(2), center = Math.floor(rows / 2) * columns + Math.floor(columns / 2);
    cells[center] = 1; cells[0] = 0;
    const geometryBefore = context.fogMesh.geometry.attributes.position.array.slice();
    const update = buildings => context.updateFogFromState({ fogOfWar: true, visibility: wire(cells), buildings });
    update([b]);
    assert.equal(context.fogTexture.image.data[alphaIndex(center)], 0, 'own building center no longer paints across the sprite');
    assert.equal(context.minimapFogImage.data[center * 4 + 3], 154, 'minimap retains remembered ground');
    assert.equal(context.fogTexture.image.data[alphaIndex(0)], 255, 'unknown terrain stays hidden');
    assert.deepEqual(Array.from(context.latestFogCells), Array.from(cells), 'forest and picking consume original states');
    assert.deepEqual(context.fogMesh.geometry.attributes.position.array, geometryBefore);
    assert.equal(context.fogMesh.material.depthTest, false); assert.equal(context.fogMesh.material.depthWrite, false);
    assert.equal(context.fogMesh.renderOrder, 12);
    update([building(1 - team)]);
    assert.equal(context.fogTexture.image.data[alphaIndex(center)], 154, 'currently disclosed enemy gets no footprint exemption');
    update([]);
    assert.equal(context.fogTexture.image.data[alphaIndex(center)], 154, 'removal/cancel restores fog from the current snapshot');
    update(undefined);
    assert.equal(context.fogTexture.image.data[alphaIndex(center)], 154, 'missing disclosure cannot retain a previous exemption');
    context.updateFogFromState({ fogOfWar: false }); assert.equal(context.fogMesh.visible, false);
    assert.equal(context.latestFogCells, null);
    context.fogMesh.geometry.dispose(); context.fogMesh.material.dispose(); context.fogTexture.dispose(); context.terrainSurface.geometry.dispose();
  }
});

test('malformed buffers and dimensions cannot clear unrelated texture bytes', () => {
  for (const [cols, rs] of [[0, rows], [columns, -1], [NaN, rows], [columns + .5, rows], [columns + 1, rows]]) {
    const { cells, pixels } = remembered(), before = pixels.slice();
    clearOwnedBuildingFog(pixels, cells, [building()], 0, cols, rs); assert.deepEqual(pixels, before);
  }
  const { cells, pixels } = remembered(), before = pixels.slice();
  clearOwnedBuildingFog(pixels, cells.subarray(1), [building()], 0, columns, rows);
  clearOwnedBuildingFog(pixels, cells, null, 0, columns, rows);
  assert.deepEqual(pixels, before);
});
