import assert from 'node:assert/strict';
import test from 'node:test';
import { MapStudioTerrainHistory } from '../src/authoring/map-studio-terrain-history.mjs';
import { mapStudioDraftFixture } from './fixtures/map-studio-draft-fixture.mjs';

function state(width = 2, height = 2) {
  return { width, height, groundMaterials: new Int8Array(width * height).fill(-1),
    groundLevels: new Uint8Array(width * height), obstacleMaterials: new Int8Array(width * height).fill(-1),
    obstacleElevations: new Float64Array(width * height).fill(1.12),
    resourceNodes: [{ id: 'sheep', type: 'food', stock: 13.5, x: 0.5, z: 0.5,
      wildlifeSpecies: 'bellweather-sheep' }], selectedResourceId: 'sheep' };
}
function edit(history, current, apply) {
  const before = history.begin(current); apply(current); return history.record(before, current);
}

test('cell deltas restore exact layers, displaced resource identity/stock/selection and optional seed', () => {
  const h = new MapStudioTerrainHistory(), s = state(), original = structuredClone(s);
  edit(h, s, s => {
    s.groundMaterials[1] = 2; s.groundLevels[2] = 2;
    s.obstacleMaterials[3] = 0; s.obstacleElevations[3] = 0.72;
    s.resourceNodes = []; s.selectedResourceId = null; s.terrainSeed = 123;
  });
  const changed = structuredClone(s);
  assert.equal(h.canUndo, true); assert.equal(h.canRedo, false);
  h.restore('undo', s);
  assert.deepEqual(s, { ...original, terrainSeed: undefined });
  assert.equal(h.canUndo, false); assert.equal(h.canRedo, true);
  h.restore('redo', s); assert.deepEqual(s, changed);
  assert.equal(h.restore('redo', s), null);
});

test('no-op gestures and selection keep redo; a new real stroke drops the abandoned branch', () => {
  const h = new MapStudioTerrainHistory(), s = state();
  edit(h, s, s => { s.groundLevels[0] = 1; });
  h.restore('undo', s); s.selectedResourceId = null;
  assert.equal(edit(h, s, () => {}), false); assert.equal(h.canRedo, true);
  edit(h, s, s => { s.groundLevels[1] = 2; });
  assert.equal(h.canRedo, false); assert.equal(h.entries.length, 1);
  h.restore('undo', s); assert.deepEqual([...s.groundLevels], [0, 0, 0, 0]);
  assert.equal(s.selectedResourceId, null);
});

test('external node, terrain, seed and same-area dimension changes refuse stale navigation', () => {
  for (const mutate of [s => { s.resourceNodes[0].stock = 7; },
    s => { s.obstacleMaterials[1] = 2; }, s => { s.terrainSeed = 12; },
    s => { s.width = 1; s.height = 4; }]) {
    const h = new MapStudioTerrainHistory(), s = state();
    edit(h, s, s => { s.groundLevels[0] = 2; }); mutate(s);
    const expected = structuredClone(s);
    assert.equal(h.restore('undo', s), null); assert.deepEqual(s, expected);
    assert.equal(h.canUndo, false); assert.equal(h.canRedo, false);
    edit(h, s, s => { s.groundLevels[0] = 1; });
    h.restore('undo', s); assert.equal(s.groundLevels[0], 2);
  }
});

test('history evicts oldest steps by count and byte budget on a maximum-size grid', () => {
  const h = new MapStudioTerrainHistory({ limit: 2 }), s = state();
  for (let i = 0; i < 4; i++) edit(h, s, s => { s.groundLevels[0] = i + 1; });
  assert.equal(h.entries.length, 2);
  h.restore('undo', s); h.restore('undo', s);
  assert.equal(s.groundLevels[0], 2); assert.equal(h.restore('undo', s), null);
  const large = state(256, 256), bounded = new MapStudioTerrainHistory({ byteLimit: 600000 });
  for (let i = 0; i < 10; i++) edit(bounded, large, s => { s.groundLevels.fill(i % 2 + 1); });
  assert.equal(bounded.entries.length, 1); assert.ok(bounded.bytes <= bounded.byteLimit);
  bounded.restore('undo', large); assert.equal(large.groundLevels[65535], 1);
  const tiny = new MapStudioTerrainHistory({ byteLimit: 1 });
  edit(tiny, s, s => { s.groundLevels[0] = 0; }); assert.equal(tiny.canUndo, false);
  for (const options of [{ limit: 0 }, { byteLimit: -1 }, { limit: 1.5 }]) {
    assert.throws(() => new MapStudioTerrainHistory(options), RangeError);
  }
});

function fixture(t) {
  const f = mapStudioDraftFixture(t, { terrainGestures: true }); f.open();
  f.w.ui.studioGroundBrushSize.value = '1'; f.w.ui.studioElevationBrushSize.value = '1';
  f.w.ui.studioObstacleBrushSize.value = '1'; f.w.ui.studioObstacleShape.value = 'rectangle';
  f.pointer = (type, column, row, pointerId = 1) => {
    const event = new f.w.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { button: 0, pointerId, clientX: (column + 0.5) * 10, clientY: (row + 0.5) * 10 });
    f.w.ui.studioGrid.dispatchEvent(event);
  };
  f.stroke = (tool, start = [3, 3], end = start, finish = 'pointerup') => {
    f.w.editorTool = tool; f.pointer('pointerdown', ...start);
    f.pointer('pointermove', ...end); f.pointer(finish, ...end);
  };
  f.terrain = () => {
    const s = f.w.editorTerrainState();
    return { ground: [...s.groundMaterials], levels: [...s.groundLevels],
      obstacles: [...s.obstacleMaterials], elevations: [...s.obstacleElevations],
      nodes: f.copy(s.resourceNodes), seed: s.terrainSeed };
  };
  return f;
}

test('real pointer gestures commit one step each; previews, cancel, no-ops and branching are safe', t => {
  const f = fixture(t), original = f.terrain();
  f.w.editorTool = 'ground:dirt'; f.pointer('pointerdown', 3, 3); f.pointer('pointermove', 8, 4);
  assert.deepEqual(f.terrain(), original); assert.equal(f.d.getElementById('studio-terrain-undo').disabled, true);
  f.pointer('pointerup', 8, 4); const painted = f.terrain(); assert.notDeepEqual(painted, original);
  f.click('studio-terrain-undo'); assert.deepEqual(f.terrain(), original);
  assert.equal(f.d.getElementById('studio-terrain-undo').disabled, true);
  f.stroke('ground-reset'); // already base ground; preserve the existing redo
  assert.equal(f.d.getElementById('studio-terrain-redo').disabled, false);
  f.stroke('ground:gravel', [2, 2], [7, 8], 'pointercancel');
  assert.deepEqual(f.terrain(), original); f.click('studio-terrain-redo');
  assert.deepEqual(f.terrain(), painted);
  f.click('studio-terrain-undo'); f.stroke('elevation:raise');
  assert.equal(f.d.getElementById('studio-terrain-redo').disabled, true);
  f.click('studio-terrain-undo'); assert.deepEqual(f.terrain(), original);
});

test('real obstacle rectangles and strokes restore displaced nodes with exact stock and selection', t => {
  const f = fixture(t);
  f.w.selectedEditorResourceId = 'food'; f.w.syncEditorResourceControls();
  const original = f.terrain();
  f.stroke('cliff', [16, 16]);
  assert.equal(f.w.editorResourceNodes.length, 0); assert.equal(f.w.selectedEditorResourceId, null);
  const painted = f.terrain(); assert.equal(painted.elevations[16 * 32 + 16], 2.1);
  f.click('studio-terrain-undo'); assert.deepEqual(f.terrain(), original);
  assert.equal(f.w.selectedEditorResourceId, 'food'); assert.equal(f.w.ui.studioResourceStock.value, '300');
  f.click('studio-terrain-redo'); assert.deepEqual(f.terrain(), painted);
  f.w.ui.studioObstacleShape.value = 'stroke'; f.stroke('erase', [16, 16], [19, 19]);
  assert.equal(f.terrain().obstacles[16 * 32 + 16], -1);
  f.click('studio-terrain-undo'); assert.deepEqual(f.terrain(), painted);
  f.click('studio-terrain-undo'); assert.deepEqual(f.terrain(), original);
});

test('foreign pointers cannot replace or finish a preview; lost capture cancels without a history step', t => {
  const f = fixture(t), original = f.terrain();
  f.w.editorTool = 'forest'; f.pointer('pointerdown', 3, 3, 1);
  f.pointer('pointerdown', 10, 10, 2); f.pointer('pointermove', 11, 11, 2);
  f.pointer('pointerup', 11, 11, 2); assert.deepEqual(f.terrain(), original);
  assert.equal(f.w.editorDrag.pointerId, 1);
  f.pointer('lostpointercapture', 3, 3, 1); assert.equal(f.w.editorDrag, null);
  assert.equal(f.d.getElementById('studio-terrain-undo').disabled, true);
  assert.deepEqual(f.terrain(), original);
  f.stroke('forest'); assert.equal(f.d.getElementById('studio-terrain-undo').disabled, false);
});

test('all real terrain brushes and rolling-ground generation round trip including seed', t => {
  const f = fixture(t);
  for (const tool of ['ground:dirt', 'ground-reset', 'forest', 'water', 'stone', 'rock', 'cliff', 'erase',
    'elevation:raise', 'elevation:lower', 'elevation:0', 'elevation:1', 'elevation:2', 'elevation:smooth']) {
    f.w.populateMapEditor(f.w.mapDefinition, 'Fresh map');
    f.w.editorGroundLevels.fill(tool === 'elevation:1' ? 2 : 1);
    if (tool === 'elevation:smooth') f.w.editorGroundLevels[3 * 32 + 3] = 2;
    f.w.editorCellMaterials[3 * 32 + 3] = 0;
    f.w.editorGroundMaterials[3 * 32 + 3] = 2;
    const original = f.terrain(); f.stroke(tool, [3, 3], [5, 4]); const changed = f.terrain();
    assert.notDeepEqual(changed, original, tool);
    f.click('studio-terrain-undo'); assert.deepEqual(f.terrain(), original, tool);
    f.click('studio-terrain-redo'); assert.deepEqual(f.terrain(), changed, tool);
  }
  f.w.populateMapEditor(f.w.mapDefinition, 'Fresh map');
  const original = f.terrain(); f.edit('studio-elevation-seed', '4523'); f.click('studio-generate-hills');
  const generated = f.terrain(); assert.equal(generated.seed, 4523); assert.notDeepEqual(generated, original);
  f.click('studio-terrain-undo'); assert.deepEqual(f.terrain(), original);
  assert.equal(f.w.ui.studioElevationSeed?.value ?? f.d.getElementById('studio-elevation-seed').value, '93000');
  f.click('studio-terrain-redo'); assert.deepEqual(f.terrain(), generated);
});

test('real resource edits, resize and map population clear stale terrain history', t => {
  const f = fixture(t);
  f.stroke('forest'); f.w.editorResourceNodes[0].stock = 400; f.w.drawEditorGrid();
  assert.equal(f.d.getElementById('studio-terrain-undo').disabled, true);
  f.stroke('water'); f.w.ui.studioWidth.value = '24';
  f.w.ui.studioWidth.dispatchEvent(new f.w.Event('change'));
  assert.equal(f.w.editorDefinition.width, 24);
  assert.equal(f.d.getElementById('studio-terrain-undo').disabled, true);
  f.w.populateMapEditor(f.w.mapDefinition, 'Fresh map');
  assert.equal(f.d.getElementById('studio-terrain-redo').disabled, true);
});

test('undone state is the saved draft and portable export; recovery starts with empty history', async t => {
  const f = fixture(t); f.stroke('elevation:2'); const retained = f.terrain();
  f.stroke('forest'); f.click('studio-terrain-undo'); f.flush();
  const saved = f.saved(); const draft = JSON.parse(Object.values(saved)[0]);
  assert.equal(draft.editor.definition.obstacles.length, 0);
  assert.ok(draft.editor.definition.elevationPatches.length > 0);
  assert.equal(Object.hasOwn(draft.editor, 'terrainHistory'), false);
  f.edit('studio-id', 'history-map'); f.w.downloadEditorMap();
  assert.ok(f.downloads.length, f.w.ui.studioMessage.textContent);
  const portable = JSON.parse(await f.downloads.at(-1).blob.text());
  assert.deepEqual(portable.obstacles, draft.editor.definition.obstacles);
  assert.deepEqual(portable.elevationPatches, draft.editor.definition.elevationPatches);
  const recovered = mapStudioDraftFixture(t, { saved, terrainGestures: true }); recovered.open();
  recovered.click('studio-draft-restore');
  assert.deepEqual([...recovered.w.editorGroundLevels], retained.levels);
  assert.equal(recovered.d.getElementById('studio-terrain-undo').disabled, true);
  assert.equal(recovered.d.getElementById('studio-terrain-redo').disabled, true);
});
