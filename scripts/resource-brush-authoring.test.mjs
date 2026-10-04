import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { previewResourceBrush, applyResourceBrush, createResourceBrushEditor } from '../src/resource-brush-authoring.mjs';

const options = { seed: 93000, type: 'food', x: -8.5, z: -10.5, totalStock: 101 };
const clone = value => JSON.parse(JSON.stringify(value));
function map() {
  return { id: 'brush-test', name: 'BRUSH TEST', width: 64, height: 64, terrainBase: 'meadow',
    terrainPatches: [], elevationPatches: [], obstacles: [],
    spawnPoints: [{ team: 0, x: -20.5, z: 0.5 }, { team: 1, x: 20.5, z: 0.5 }],
    resourceNodes: [{ id: 'old-wood', type: 'wood', x: 8.5, z: 10.5, stock: 13.5 }],
    regions: [], scenarioEvents: [], summary: 'Keep unrelated authoring fields.' };
}
function fixture(limit = 64) {
  const state = { map: map(), selected: 'old-wood', writes: 0, reject: false };
  const editor = createResourceBrushEditor({ limit, readMap: () => state.map,
    readSelectedId: () => state.selected, commit(next) {
      if (state.reject) throw new Error('Commit rejected before writing');
      state.map.resourceNodes = next.resourceNodes; state.selected = next.selectedResourceId; state.writes++;
    } });
  return { state, editor };
}
function add(editor, settings = options) { return editor.apply(editor.preview(settings)); }

test('seeded preview is read-only, uses an explicit total budget and materializes exactly what was shown', () => {
  const input = map(), original = clone(input), settings = { ...options };
  const a = previewResourceBrush(input, settings), b = previewResourceBrush(input, settings);
  assert.deepEqual(a, b); assert.deepEqual(input, original);
  assert.equal(a.nodes.reduce((sum, node) => sum + node.stock, 0), 101);
  assert.deepEqual(a.nodes.map(node => node.stock), [21, 20, 20, 20, 20]);
  assert.notDeepEqual(a.nodes, previewResourceBrush(input, { ...settings, seed: 93001 }).nodes);
  settings.totalStock = 999;
  assert.throws(() => { a.nodes[0].stock = 999; }, TypeError);
  const result = applyResourceBrush(input, a);
  assert.deepEqual(result, [...original.resourceNodes, ...a.nodes]);
  result[0].stock = 1; assert.deepEqual(input, original);
  assert.equal(applyResourceBrush(input, a)[0].stock, 13.5);
  assert.throws(() => applyResourceBrush(input, clone(a)), /unknown/);
});

test('collisions, invalid budget and exhausted node slots reject without writes or history', () => {
  for (const change of [{ totalStock: undefined }, { totalStock: 4 }, { totalStock: 1.5 },
    { x: 8.5, z: 10.5 }, { x: 9.5, z: 10.5 }, { radius: 1 }, { nodesPerPatch: 17 }, { distribution: 'unknown' }]) {
    const { state, editor } = fixture(), original = clone(state);
    assert.throws(() => editor.preview({ ...options, ...change }));
    assert.deepEqual(state, original); assert.equal(editor.canUndo, false);
    assert.throws(() => editor.apply(), /Preview/);
  }
  const input = map(); input.resourceNodes = Array.from({ length: 124 }, (_, i) => ({
    id: `old-${i}`, type: 'wood', x: i % 32 - 31.5, z: Math.floor(i / 32) - 31.5, stock: 1,
  }));
  assert.throws(() => previewResourceBrush(input, options), /budget/);
});

test('stale placement inputs invalidate previews; unrelated metadata is preserved', () => {
  for (const field of ['id', 'width', 'height', 'terrainBase', 'terrainPatches', 'elevationPatches', 'obstacles', 'spawnPoints', 'resourceNodes']) {
    const input = map(), preview = previewResourceBrush(input, options);
    input[field] = typeof input[field] === 'number' ? input[field] + 1
      : typeof input[field] === 'string' ? input[field] + '-changed' : [...input[field], {}];
    assert.throws(() => applyResourceBrush(input, preview), /stale/, field);
  }
  const { state, editor } = fixture(), preview = editor.preview(options);
  state.map.name = 'Renamed'; state.map.scenarioEvents.push({ id: 'unrelated' });
  editor.apply(preview); editor.undo(); editor.redo();
  assert.equal(state.map.name, 'Renamed'); assert.deepEqual(state.map.scenarioEvents, [{ id: 'unrelated' }]);
});

test('one commit per patch, undo/redo restore resources and selection and branch without replaying old redo', () => {
  const { state, editor } = fixture(), original = clone(state.map);
  assert.equal(editor.undo(), false); assert.equal(editor.redo(), false);
  add(editor); const first = clone(state.map.resourceNodes), selected = state.selected;
  assert.equal(state.writes, 1); assert.equal(editor.canUndo, true);
  editor.undo(); assert.deepEqual(state.map, original); assert.equal(state.selected, 'old-wood');
  editor.redo(); assert.deepEqual(state.map.resourceNodes, first); assert.equal(state.selected, selected);
  add(editor, { ...options, type: 'wood', x: 10.5, z: -10.5, totalStock: 103 });
  editor.undo(); assert.deepEqual(state.map.resourceNodes, first);
  editor.undo(); assert.deepEqual(state.map, original);
  add(editor, { ...options, seed: 93001 }); assert.equal(editor.canRedo, false);
  assert.equal(editor.redo(), false); assert.notDeepEqual(state.map.resourceNodes, first);
});

test('failed commits never advance apply, undo or redo history', () => {
  const { state, editor } = fixture(), preview = editor.preview(options), original = clone(state.map);
  state.reject = true; assert.throws(() => editor.apply(preview), /Commit rejected/);
  assert.deepEqual(state.map, original); assert.equal(editor.canUndo, false);
  state.reject = false; editor.apply(preview); const applied = clone(state.map);
  state.reject = true; assert.throws(() => editor.undo(), /Commit rejected/);
  assert.deepEqual(state.map, applied); assert.equal(editor.canUndo, true); assert.equal(editor.canRedo, false);
  state.reject = false; editor.undo(); state.reject = true;
  assert.throws(() => editor.redo(), /Commit rejected/);
  assert.deepEqual(state.map, original); assert.equal(editor.canRedo, true);
});

test('cancel, replacement previews and external edits cannot apply or rewind the wrong operation', () => {
  const { state, editor } = fixture(), old = editor.preview(options);
  editor.preview({ ...options, seed: 93001 }); assert.throws(() => editor.apply(old), /Preview/);
  editor.cancel(); assert.throws(() => editor.apply(), /Preview/);
  add(editor); const count = state.writes;
  state.map.resourceNodes[0].stock = 99;
  assert.equal(editor.canUndo, false); assert.throws(() => editor.undo(), /outside/);
  assert.equal(state.writes, count); assert.equal(state.map.resourceNodes[0].stock, 99);
  editor.reset(); assert.equal(editor.canUndo, false); assert.equal(editor.canRedo, false);
  add(editor, { ...options, x: 10.5, z: -10.5 });
});

test('history is bounded by operations and JSON save/load keeps node identities and quantities', () => {
  const { state, editor } = fixture(2);
  add(editor); const first = clone(state.map.resourceNodes);
  add(editor, { ...options, x: 10.5, z: -10.5 });
  add(editor, { ...options, x: -8.5, z: 10.5 });
  const saved = JSON.stringify({ editor: { definition: state.map, selectedResourceId: state.selected } });
  const restored = JSON.parse(saved).editor;
  assert.deepEqual(restored.definition, state.map); assert.equal(restored.selectedResourceId, state.selected);
  editor.undo(); editor.undo(); assert.deepEqual(state.map.resourceNodes, first); assert.equal(editor.undo(), false);
  state.map = restored.definition; state.selected = restored.selectedResourceId; editor.reset();
  assert.equal(editor.canUndo, false); assert.equal(editor.canRedo, false);
  const before = clone(state.map.resourceNodes);
  add(editor, { ...options, type: 'wood', x: 10.5, z: 18.5, totalStock: 103 });
  assert.deepEqual(state.map.resourceNodes.slice(0, before.length), before);
  assert.equal(new Set(state.map.resourceNodes.map(node => node.id)).size, state.map.resourceNodes.length);
  editor.undo(); assert.deepEqual(state.map.resourceNodes, before);
});

test('ordinary host save/restart/load preserves applied brush nodes and serves the adapter import graph', async t => {
  const { state, editor } = fixture(); state.map.startingArmySize = 16;
  add(editor); add(editor, { ...options, type: 'wood', x: 10.5, z: -10.5, totalStock: 103, distribution: 'core-falloff' });
  const expected = clone(state.map.resourceNodes);
  const room = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 15_000 });
  t.after(() => room.dispose()); await room.start();
  const host = await room.connect(0);
  host.send({ type: 'publishMap', map: clone(state.map), persist: true });
  const result = await host.wait(m => m.type === 'mapPublished' || m.type === 'mapRejected', 'map admission');
  assert.equal(result.type, 'mapPublished', result.message); assert.equal(result.persisted, true);
  const saved = JSON.parse(await readFile(path.join(room.directory, 'custom', `${state.map.id}.json`), 'utf8'));
  assert.deepEqual(saved.resourceNodes, expected);
  const pending = ['/src/resource-brush-authoring.mjs', '/src/resource-brush-controls.mjs'], visited = new Set();
  while (pending.length) {
    const module = pending.pop(); if (visited.has(module)) continue; visited.add(module);
    const url = new URL(module, `http://127.0.0.1:${room.port}`), response = await fetch(url);
    assert.equal(response.status, 200, module); assert.match(response.headers.get('content-type'), /javascript/);
    for (const [, dependency] of (await response.text()).matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)) {
      if (dependency.startsWith('.')) pending.push(new URL(dependency, url).pathname);
    }
  }
  assert.ok(visited.has('/src/resource-cluster-authoring.mjs'));
  await room.stop(); await room.start();
  const recovered = await room.connect(0, host.welcome.player.sessionToken);
  assert.ok(recovered.welcome.maps.some(m => m.id === state.map.id));
  recovered.send({ type: 'selectMap', mapId: 'open-field' });
  await recovered.wait(m => m.type === 'mapChange' && m.map.id === 'open-field');
  recovered.send({ type: 'selectMap', mapId: state.map.id });
  const loaded = await recovered.wait(m => m.type === 'mapChange' && m.map.id === state.map.id);
  assert.deepEqual(loaded.map.resourceNodes, expected);
  state.map = clone(loaded.map); editor.reset();
  add(editor, { ...options, x: -8.5, z: 10.5 }); editor.undo();
  assert.deepEqual(state.map.resourceNodes, expected);
});
