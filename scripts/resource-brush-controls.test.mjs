import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { mountResourceBrushControls } from '../src/resource-brush-controls.mjs';
import { previewResourceBrush } from '../src/resource-brush-authoring.mjs';
import { createMapStudioFormState } from '../src/authoring/map-studio-form-state.mjs';
import { MAP_STUDIO_DRAFT_VERSION, createMapStudioDraftStore } from '../src/authoring/map-studio-draft-store.mjs';
import { mapStudioDraftFixture } from './fixtures/map-studio-draft-fixture.mjs';
import * as draftV1 from '../src/authoring/map-studio/draft/v1/contract.mjs';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
function between(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Production hook: ${start}`); return source.slice(a, b);
}
function fixture(t) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/' });
  t.after(() => dom.window.close());
  const w = dom.window, d = w.document;
  for (const [, name, selector] of source.matchAll(/^\s*(\w+): document\.querySelector\('([^']+)'\)/gm)) {
    (w.ui ??= {})[name] = d.querySelector(selector);
  }
  Object.assign(w, { mountResourceBrushControls, createMapStudioFormState, resourceBrushControls: null,
    editorDefinition: { id: 'brush-ui', name: 'BRUSH UI', width: 64, height: 64,
      terrainBase: 'meadow', terrainPatches: [{ column: 0, row: 0, width: 64, height: 64, material: 'dirt' }],
      obstacles: [], spawnPoints: [{ team: 0, x: -20.5, z: 0.5 }, { team: 1, x: 20.5, z: 0.5 }] },
    editorResourceNodes: [{ id: 'old', type: 'food', x: 8.5, z: 10.5, stock: 13.5, wildlifeSpecies: 'bellweather-sheep' }],
    selectedEditorResourceId: 'old', terrain: [], blockers: [], elevation: [], saves: 0, redraws: 0,
    compressEditorGround: () => w.terrain, compressEditorObstacles: () => w.blockers,
    withCurrentEditorElevation: map => ({ ...map, elevationPatches: w.elevation }),
    MAX_MAP_RESOURCE_NODES: 128, editorTriggerCreationPending: false, getSelectedEditorTrigger: () => null,
    drawEditorGrid: () => { w.redraws++; w.resourceBrushControls?.sync(); },
    scheduleMapStudioDraftSave: () => { w.saves++; },
    editorTool: 'pan', editorCellFromPointer: () => ({ column: 23, row: 21 }),
  });
  w.ui.studioTerrainBase.value = 'meadow'; w.ui.studioResourceStock.value = 13.5; w.ui.studioId.value = 'brush-ui';
  w.ui.mapStudio.open = true;
  w.eval(between('function getSelectedEditorResourceNode(', 'function saveSelectedEditorResourceStock('));
  w.eval(between('function setEditorTool(', 'function mapStudioViewportSize('));
  w.eval(between('const mapStudioFormState = createMapStudioFormState(', 'let editorDraftLastSavedAt')
    + 'window.mapStudioFormState = mapStudioFormState; window.captureMapStudioFormValues = mapStudioFormState.capture; window.restoreMapStudioFormValues = mapStudioFormState.restore;');
  w.eval(between('resourceBrushControls = mountResourceBrushControls({', "ui.studioResourceStock.addEventListener('input'"));
  w.eval(between("ui.studioGrid.addEventListener('pointerdown'", "ui.studioGrid.addEventListener('pointermove'"));
  const panel = d.querySelector('.resource-node-fields details'); assert.equal(panel.open, true);
  const button = name => panel.querySelector(`[data-brush="${name}"]`);
  const field = name => panel.querySelector(`#studio-brush-${name}`);
  const markers = () => {
    const result = [], context = { save() {}, restore() {}, setLineDash() {}, beginPath() {}, stroke() {},
      arc(x, y) { result.push({ x, y }); }, fillText(stock) { result.at(-1).stock = Number(stock); } };
    w.resourceBrushControls.draw(context, w.editorDefinition); return result;
  };
  return { w, d, panel, button, field, markers, status: panel.querySelector('[role="status"]'),
    set(name, value) { field(name).value = value; field(name).dispatchEvent(new w.Event('input', { bubbles: true })); },
    preview() { button('preview').click(); assert.equal(button('apply').disabled, false); return markers(); },
  };
}

test('actual client callbacks use live terrain; preview and overlay are read-only and deterministic', t => {
  const f = fixture(t), original = copy(f.w.editorResourceNodes);
  assert.equal(f.field('count').value, '5'); assert.equal(f.field('radius').value, '4');
  assert.equal(f.field('distribution').value, 'uniform');
  f.set('stock', 101); const a = f.preview();
  const legacy = previewResourceBrush({ ...f.w.editorDefinition, terrainPatches: [], resourceNodes: original },
    { type: 'food', seed: 93000, totalStock: 101, x: -8.5, z: -10.5 });
  assert.deepEqual(a, legacy.nodes.map(n => ({ x: n.x + 32, y: n.z + 32, stock: n.stock })));
  assert.deepEqual(a.map(n => n.stock), [21, 20, 20, 20, 20]);
  assert.equal(a.reduce((sum, n) => sum + n.stock, 0), 101);
  assert.match(f.status.textContent, /101 total stock.*20–21 per marker.*seed 93000/);
  assert.deepEqual(f.preview(), a); assert.deepEqual(f.w.editorResourceNodes, original);
  assert.equal(f.w.selectedEditorResourceId, 'old'); assert.equal(f.w.saves, 0);
  assert.equal(f.w.ui.studioResourceStock.value, '13.5');
  f.set('seed', 93001); assert.equal(f.markers().length, 0); assert.notDeepEqual(f.preview(), a);
  assert.equal(f.w.captureMapStudioFormValues()['studio-brush-seed'].value, '93001');
});

test('versioned draft contract preserves the store API, per-store methods and reference recovery', async () => {
  const legacy = await import('../src/authoring/map-studio-draft-store.mjs');
  assert.deepEqual(Object.keys(legacy), ['MAP_STUDIO_DRAFT_VERSION', 'createMapStudioDraftStore']);
  assert.deepEqual(Object.keys(draftV1), ['MAP_STUDIO_DRAFT_VERSION', 'requireRecovery']);
  assert.equal(MAP_STUDIO_DRAFT_VERSION, draftV1.MAP_STUDIO_DRAFT_VERSION);
  assert.equal(draftV1.MAP_STUDIO_DRAFT_VERSION, 1);
  const unavailableStorage = () => { throw new Error('Recovery must not access storage.'); };
  const a = createMapStudioDraftStore({ getStorage: unavailableStorage });
  const b = createMapStudioDraftStore({ getStorage: unavailableStorage });
  assert.deepEqual(Object.keys(a), ['key', 'read', 'write', 'remove', 'requireRecovery']);
  assert.notEqual(a.requireRecovery, b.requireRecovery);
  assert.equal(a.requireRecovery.name, 'requireRecovery');
  assert.equal(a.requireRecovery.length, 2);
  const draft = { version: 1, sourceMapId: 'source', editor: {
    definition: { width: 16, height: 256, obstacles: [], spawnPoints: [] }, formValues: {} } };
  const before = structuredClone(draft);
  for (const validate of [draftV1.requireRecovery, a.requireRecovery, b.requireRecovery]) {
    const recovered = validate(draft, 'source');
    assert.equal(recovered.state, draft.editor);
    assert.equal(recovered.definition, draft.editor.definition);
    for (const version of [0, 2, '1', undefined]) {
      assert.throws(() => validate({ ...draft, version }, 'source'),
        { message: 'The saved draft could not be read. Discard it to start a fresh map.' });
    }
    const failure = new Error('unexpected draft getter');
    assert.throws(() => validate({ get editor() { throw failure; } }, 'source'), error => error === failure);
  }
  assert.deepEqual(draft, before);
});

test('core falloff flows through preview, conserved budget, undo/redo and draft restoration', t => {
  const f = fixture(t), original = copy(f.w.editorResourceNodes);
  f.set('stock', 101); f.set('count', 9); f.set('radius', 8);
  const spread = f.preview(); f.set('distribution', 'core-falloff');
  assert.equal(f.button('apply').disabled, true); assert.equal(f.markers().length, 0);
  assert.equal(f.field('stock').value, '101');
  const core = f.preview(); assert.notDeepEqual(core, spread); assert.deepEqual(f.preview(), core);
  assert.equal(core.reduce((sum, n) => sum + n.stock, 0), 101);
  assert.match(f.status.textContent, /9 food markers.*101 total stock.*Core falloff/);
  assert.deepEqual(f.w.editorResourceNodes, original);
  const values = f.w.captureMapStudioFormValues(); assert.equal(values['studio-brush-distribution'].value, 'core-falloff');
  f.button('apply').click(); const applied = copy(f.w.editorResourceNodes);
  f.set('distribution', 'uniform'); assert.equal(f.button('undo').disabled, false);
  f.button('undo').click(); assert.deepEqual(f.w.editorResourceNodes, original);
  f.button('redo').click(); assert.deepEqual(f.w.editorResourceNodes, applied);
  assert.deepEqual(applied.slice(1).map(n => ({ x: n.x + 32, y: n.z + 32, stock: n.stock })), core);
  f.w.restoreMapStudioFormValues(values); f.w.resourceBrushControls.reset();
  assert.equal(f.field('distribution').value, 'core-falloff'); assert.equal(f.button('undo').disabled, true);
  assert.deepEqual(f.w.editorResourceNodes, applied);
});

test('tight and wider seeded patches share one unchanged budget and keep two-cell spacing', t => {
  const f = fixture(t), original = copy(f.w.editorResourceNodes), layouts = [];
  f.set('stock', 101);
  for (const [type, count, radius] of [['food', 3, 2], ['wood', 5, 8], ['wood', 16, 8]]) {
    f.set('type', type); f.set('count', count); f.set('radius', radius);
    assert.equal(f.field('stock').value, '101'); assert.equal(f.field('stock').min, String(count));
    const nodes = f.preview(); layouts.push(nodes);
    assert.equal(nodes.length, count); assert.equal(nodes.reduce((sum, n) => sum + n.stock, 0), 101);
    assert.ok(nodes.every(n => Math.hypot(n.x - 23.5, n.y - 21.5) <= radius));
    for (const [i, a] of nodes.entries()) for (const b of nodes.slice(i + 1)) {
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 2);
    }
    assert.deepEqual(f.preview(), nodes);
    assert.match(f.status.textContent, new RegExp(`${count} ${type} markers.*101 total stock.*radius ${radius} cells`));
  }
  assert.deepEqual(layouts[0].map(n => n.stock), [34, 34, 33]);
  assert.ok(layouts[1].some(n => Math.hypot(n.x - 23.5, n.y - 21.5) > 4));
  assert.deepEqual(f.w.editorResourceNodes, original); assert.equal(f.w.saves, 0);
  f.set('count', 1); f.set('radius', 1); f.set('stock', 1);
  assert.deepEqual(f.preview(), [{ x: 23.5, y: 21.5, stock: 1 }]);
});

test('shape edits cancel pending receipts but retain exact apply/undo/redo and Sheep/fish metadata', t => {
  const f = fixture(t);
  f.w.editorResourceNodes.push({ id: 'fish', type: 'food', x: 16.5, z: 10.5, stock: 42.25, resourceVariant: 'shore-fish' });
  f.w.blockers = [{ column: 49, row: 42, width: 1, height: 1, material: 'water' }];
  const original = copy(f.w.editorResourceNodes);
  f.set('stock', 101); f.set('count', 3); f.set('radius', 2); f.set('distribution', 'core-falloff');
  const nodes = f.preview(); f.button('apply').click();
  const applied = copy(f.w.editorResourceNodes), selection = f.w.selectedEditorResourceId;
  assert.deepEqual(applied.slice(0, 2), original);
  assert.deepEqual(applied.slice(2).map(n => ({ x: n.x + 32, y: n.z + 32, stock: n.stock })), nodes);
  f.set('column', 44); f.preview(); f.set('radius', 8);
  assert.equal(f.markers().length, 0); assert.equal(f.button('apply').disabled, true);
  assert.equal(f.button('undo').disabled, false);
  f.preview(); f.set('count', 5); assert.equal(f.markers().length, 0);
  f.button('undo').click(); assert.deepEqual(f.w.editorResourceNodes, original);
  assert.equal(f.w.selectedEditorResourceId, 'old');
  f.button('redo').click(); assert.deepEqual(f.w.editorResourceNodes, applied);
  assert.equal(f.w.selectedEditorResourceId, selection); assert.equal(f.w.saves, 3);
});

test('draft restore retains shape and budget while session history resets', t => {
  const f = fixture(t); f.set('stock', 101); f.set('count', 3); f.set('radius', 2);
  const expected = f.preview(), values = f.w.captureMapStudioFormValues(); f.button('apply').click();
  assert.equal(values['studio-brush-count'].value, '3'); assert.equal(values['studio-brush-radius'].value, '2');
  f.set('count', 16); f.set('radius', 8); f.w.restoreMapStudioFormValues(values);
  f.w.editorResourceNodes = [{ id: 'old', type: 'food', x: 8.5, z: 10.5, stock: 13.5, wildlifeSpecies: 'bellweather-sheep' }];
  f.w.resourceBrushControls.reset();
  assert.equal(f.button('undo').disabled, true); assert.equal(f.field('stock').min, '3');
  assert.equal(f.field('stock').value, '101'); assert.deepEqual(f.preview(), expected);
});

test('impossible density and insufficient stock reject without silently inflating budgets', t => {
  const f = fixture(t), original = copy(f.w.editorResourceNodes);
  f.set('stock', 5); f.set('count', 6); f.set('radius', 8); f.button('preview').click();
  assert.equal(f.field('stock').value, '5'); assert.equal(f.button('apply').disabled, true);
  assert.equal(f.d.activeElement, f.field('stock'));
  f.set('stock', 101); f.set('radius', 2); f.button('preview').click();
  assert.match(f.status.textContent, /insufficient safe space/); assert.equal(f.markers().length, 0);
  assert.equal(f.button('apply').disabled, true); assert.deepEqual(f.w.editorResourceNodes, original);
  assert.equal(f.w.saves, 0);
});

test('apply/undo/redo preserve stock, Sheep identity and selection, and notify draft saving after success', t => {
  const f = fixture(t), original = copy(f.w.editorResourceNodes), map = copy(f.w.editorDefinition);
  const markers = f.preview(); f.button('apply').click();
  assert.equal(f.w.saves, 1); assert.equal(f.w.editorResourceNodes.length, 6);
  assert.deepEqual(f.w.editorResourceNodes.slice(1).map(n => ({ x: n.x + 32, y: n.z + 32, stock: n.stock })), markers);
  const selected = f.w.selectedEditorResourceId; assert.notEqual(selected, 'old');
  assert.equal(f.d.activeElement, f.button('undo'));
  f.button('undo').click(); assert.deepEqual(f.w.editorResourceNodes, original);
  assert.equal(f.w.selectedEditorResourceId, 'old'); assert.equal(f.w.ui.studioResourceStock.value, '13.5');
  assert.equal(f.d.activeElement, f.button('redo')); f.button('redo').click();
  assert.equal(f.w.selectedEditorResourceId, selected); assert.equal(f.w.saves, 3);
  assert.deepEqual(f.w.editorDefinition, map);
  f.button('undo').click(); f.set('seed', 93001); f.preview(); f.button('apply').click();
  assert.equal(f.button('redo').disabled, true);
});

test('one-shot anchor picking precedes the pan/paint branch and generates the same typed preview', t => {
  const f = fixture(t), expected = f.preview(); f.button('cancel').click(); f.button('pick').click();
  assert.equal(f.button('pick').getAttribute('aria-pressed'), 'true');
  const event = new f.w.MouseEvent('pointerdown', { button: 0, bubbles: true, cancelable: true });
  f.w.ui.studioGrid.dispatchEvent(event); assert.equal(event.defaultPrevented, true);
  assert.equal(f.w.resourceBrushControls.picking, false); assert.deepEqual(f.markers(), expected);
  assert.equal(f.w.editorPanDrag, undefined); assert.equal(f.w.editorResourceNodes.length, 1);
});

test('Enter previews; Escape and dialog cancel consume only pending preview/pick and keep history', t => {
  const f = fixture(t);
  f.field('seed').dispatchEvent(new f.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  assert.equal(f.button('apply').disabled, false); f.button('apply').click(); f.set('column', 44); f.preview();
  const escape = new f.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  f.button('apply').dispatchEvent(escape); assert.equal(escape.defaultPrevented, true);
  assert.equal(f.button('apply').disabled, true); assert.equal(f.button('undo').disabled, false);
  assert.equal(f.d.activeElement, f.button('preview')); f.button('pick').click();
  const cancel = new f.w.Event('cancel', { cancelable: true }); f.w.ui.mapStudio.dispatchEvent(cancel);
  assert.equal(cancel.defaultPrevented, true); assert.equal(f.w.resourceBrushControls.picking, false);
  const normal = new f.w.Event('cancel', { cancelable: true }); f.w.ui.mapStudio.dispatchEvent(normal);
  assert.equal(normal.defaultPrevented, false); assert.equal(f.w.saves, 1);
});

test('invalid budget/seed/anchor and obstructed live terrain reject without resource writes', t => {
  const f = fixture(t), original = copy(f.w.editorResourceNodes);
  for (const [name, value] of [['count', 0], ['count', 17], ['count', 2.5], ['count', ''],
    ['radius', 0], ['radius', 9], ['radius', 1.5], ['radius', ''],
    ['stock', 4], ['stock', ''], ['stock', 5.5], ['seed', 1.5], ['column', 65], ['row', 0]]) {
    const old = f.field(name).value; f.set(name, value); f.button('preview').click();
    assert.equal(f.button('apply').disabled, true); assert.equal(f.field(name).getAttribute('aria-invalid'), 'true');
    f.set(name, old);
  }
  f.w.terrain = [{ column: 0, row: 0, width: 64, height: 64, material: 'dirt' }];
  f.button('preview').click(); assert.equal(f.button('apply').disabled, true);
  assert.deepEqual(f.w.editorResourceNodes, original); assert.equal(f.w.saves, 0);
});

test('external placement edits clear stale preview/history; metadata and failed read cannot rewind resources', t => {
  const f = fixture(t); f.preview(); f.button('apply').click();
  f.w.editorDefinition.name = 'Renamed'; f.w.resourceBrushControls.sync(); assert.equal(f.button('undo').disabled, false);
  f.set('row', 44); f.preview(); f.w.editorResourceNodes[0].stock = 7.25; f.w.drawEditorGrid();
  assert.equal(f.button('apply').disabled, true); assert.equal(f.button('undo').disabled, true);
  assert.equal(f.w.editorResourceNodes[0].stock, 7.25);
  f.set('column', 44); f.set('row', 22); f.preview(); f.button('apply').click();
  const applied = copy(f.w.editorResourceNodes), saves = f.w.saves;
  f.w.ui.studioId.value = 'renamed'; f.button('undo').click();
  assert.equal(f.button('undo').disabled, true); assert.deepEqual(f.w.editorResourceNodes, applied);
  assert.equal(f.w.saves, saves);
  f.w.withCurrentEditorElevation = () => { throw new Error('Too many elevation patches'); };
  assert.doesNotThrow(() => f.w.drawEditorGrid()); assert.equal(f.button('undo').disabled, true);
  assert.equal(f.markers().length, 0); assert.match(f.status.textContent, /Too many elevation/);
});

test('same-map reload resets session; closing or changing tools clears overlays without adding nodes', t => {
  const f = fixture(t); f.preview(); f.button('apply').click(); f.w.resourceBrushControls.reset();
  assert.equal(f.button('undo').disabled, true); f.set('column', 44); f.preview();
  f.w.setEditorTool('stone'); assert.equal(f.markers().length, 0);
  f.preview(); f.w.ui.mapStudio.dispatchEvent(new f.w.Event('close')); assert.equal(f.markers().length, 0);
  assert.equal(f.w.saves, 1); assert.equal(f.w.editorResourceNodes.length, 6);
  f.w.selectedEditorResourceId = null;
  f.w.setEditorTool('resource-food'); assert.equal(f.w.ui.studioResourceStock.value, '300');
  f.w.setEditorTool('resource-wood'); assert.equal(f.w.ui.studioResourceStock.value, '500');
});

test('form snapshots include live studio controls and round-trip through draft JSON', t => {
  const dom = new JSDOM(`<input id="studio-outside" value="outside"><dialog id="studio">
    <input id="studio-name" value="Map"><input id="studio-fog" type="checkbox" checked>
    <select id="studio-terrain"><option value="dirt" selected>Dirt</option></select>
    <section><textarea id="studio-notes">First\nSecond</textarea></section>
    <input id="studio-import" type="file"><input id="unrelated" value="ignored">
  </dialog>`);
  t.after(() => dom.window.close());
  const document = dom.window.document, root = document.getElementById('studio');
  const controller = createMapStudioFormState({ root, document });
  const first = controller.capture();
  assert.deepEqual(first, {
    'studio-name': { value: 'Map' }, 'studio-fog': { checked: true },
    'studio-terrain': { value: 'dirt' }, 'studio-notes': { value: 'First\nSecond' },
  });
  const dynamic = document.createElement('input'); dynamic.id = 'studio-brush-seed'; dynamic.value = '93000';
  root.append(dynamic);
  const draft = copy(controller.capture());
  assert.deepEqual(draft['studio-brush-seed'], { value: '93000' });
  assert.equal(first['studio-brush-seed'], undefined);
  document.getElementById('studio-name').value = 'Changed';
  document.getElementById('studio-fog').checked = false; dynamic.value = '2';
  controller.restore(draft);
  assert.equal(document.getElementById('studio-name').value, 'Map');
  assert.equal(document.getElementById('studio-fog').checked, true);
  assert.equal(dynamic.value, '93000');
  assert.deepEqual(controller.capture(), draft);
});

test('form restore stays dialog-scoped, preserves setter errors and emits no edit events', t => {
  const dom = new JSDOM(`<input id="studio-outside" value="outside"><dialog id="studio">
    <input id="studio-name" value="Map"><input id="studio-fog" type="checkbox" checked>
    <input id="studio-import" type="file">
  </dialog><dialog id="other"><input id="studio-other" value="other"></dialog>`);
  t.after(() => dom.window.close());
  const document = dom.window.document, root = document.getElementById('studio');
  const controller = createMapStudioFormState({ root, document });
  let events = 0;
  for (const type of ['input', 'change']) root.addEventListener(type, () => events++);
  controller.restore({
    'studio-name': { value: 7 }, 'studio-fog': { checked: 'true' },
    'studio-outside': { value: 'overwritten' }, 'studio-missing': { value: 'missing' },
    'studio-other': { value: 'overwritten' },
  });
  assert.equal(document.getElementById('studio-name').value, 'Map');
  assert.equal(document.getElementById('studio-fog').checked, false);
  assert.equal(document.getElementById('studio-outside').value, 'outside');
  assert.equal(document.getElementById('studio-other').value, 'other');
  controller.restore({ 'studio-name': { value: 'Restored' }, 'studio-fog': { checked: true } });
  assert.equal(document.getElementById('studio-name').value, 'Restored');
  assert.equal(document.getElementById('studio-fog').checked, true);
  assert.equal(events, 0);
  assert.doesNotThrow(() => controller.restore());
  assert.throws(() => controller.restore(null), TypeError);
  assert.throws(() => controller.restore({ 'studio-import': { value: 'forged.json' } }),
    { name: 'InvalidStateError' });
  const other = createMapStudioFormState({ root: document.getElementById('other'), document });
  other.restore({ 'studio-other': { value: 'independent' }, 'studio-name': { value: 'overwritten' } });
  assert.equal(document.getElementById('studio-other').value, 'independent');
  assert.equal(document.getElementById('studio-name').value, 'Restored');
});

test('actual draft capture uses the form controller after committing selected editor fields', t => {
  const f = fixture(t), commits = [];
  const commitNames = ['saveSelectedEditorTriggerFields', 'saveSelectedEditorScenarioEventFields',
    'saveEditorTimedVictoryFields', 'saveEditorVictoryHoldFields', 'saveEditorStartingResourcesFields',
    'saveSelectedEditorResourceStock'];
  Object.assign(f.w, {
    MAP_STUDIO_DRAFT_VERSION: 1, editorDraftSourceMapId: 'source-map',
    editorTriggers: [{ id: 'trigger' }], editorScenarioEvents: [{ id: 'event' }],
    selectedEditorTriggerId: 'trigger', selectedEditorScenarioEventId: 'event',
    readEditorRegions: () => [], selectedStudioAudio: () => undefined,
    selectedEditorPrerequisiteIds: () => ['before'],
  });
  for (const name of commitNames) f.w[name] = () => commits.push(name);
  f.w.saveEditorStartingResourcesFields = () => {
    commits.push('saveEditorStartingResourcesFields'); f.w.ui.studioName.value = 'Committed';
  };
  f.set('seed', '1701');
  const draft = f.w.captureMapStudioDraft();
  assert.deepEqual(commits, commitNames);
  assert.equal(draft.version, 1); assert.equal(draft.sourceMapId, 'source-map');
  assert.ok(Number.isFinite(draft.savedAt));
  assert.equal(draft.editor.definition.name, 'Committed');
  assert.deepEqual(copy(draft.editor.formValues), f.w.mapStudioFormState.capture());
  assert.deepEqual(draft.editor.formValues['studio-brush-seed'], { value: '1701' });
  assert.equal(draft.editor.formValues['studio-import'], undefined);
  assert.equal(draft.editor.selectedResourceId, 'old');
  assert.deepEqual(copy(draft.editor.definition.resourceNodes), copy(f.w.editorResourceNodes));
  f.w.editorResourceNodes[0].stock = 1;
  assert.equal(draft.editor.definition.resourceNodes[0].stock, 13.5);
});

test('draft store preserves version-1 keys and raw reads; recovery rejects old/corrupt shapes without migrating', () => {
  const storage = new Map();
  const store = createMapStudioDraftStore({ getStorage: () => ({
    getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  }) });
  const key = store.key({ sessionStorageKey: 'session', origin: 'https://example.test', roomId: null, sourceMapId: 'source' });
  assert.equal(key, 'session:map-studio-draft:https://example.test:default:source');
  assert.equal(store.key({ sessionStorageKey: 'session', origin: 'https://example.test', roomId: 'room', sourceMapId: 'source' }),
    'session:map-studio-draft:https://example.test:room:source');
  const draft = { version: MAP_STUDIO_DRAFT_VERSION, sourceMapId: 'source', savedAt: 123,
    editor: { definition: { width: 16, height: 256, obstacles: [], spawnPoints: [] }, formValues: {} } };
  store.write(key, draft); assert.equal(storage.get(key), JSON.stringify(draft));
  const recovered = store.read(key); assert.deepEqual(recovered, draft);
  const recovery = store.requireRecovery(recovered, 'source');
  assert.equal(recovery.state, recovered.editor); assert.equal(recovery.definition, recovered.editor.definition);
  for (const raw of ['', '{corrupt']) { storage.set(key, raw); assert.equal(store.read(key), null); }
  for (const raw of ['0', 'false', 'null']) { storage.set(key, raw); assert.equal(store.read(key), JSON.parse(raw)); }
  for (const invalid of [null, {}, { ...draft, version: 0 }, { ...draft, version: 2 }, { ...draft, sourceMapId: 'other' },
    ...[{ width: 15 }, { height: 257 }, { width: 16.5 }, { obstacles: null }, { spawnPoints: null }]
      .map(change => ({ ...draft, editor: { definition: { ...draft.editor.definition, ...change } } }))]) {
    assert.throws(() => store.requireRecovery(invalid, 'source'),
      { message: 'The saved draft could not be read. Discard it to start a fresh map.' });
  }
  store.remove(key); assert.equal(store.read(key), null);
});

test('draft storage getter and serialization failures keep their existing catch boundaries and access order', () => {
  let accesses = 0;
  const failure = new Error('storage denied');
  const store = createMapStudioDraftStore({ getStorage: () => { accesses++; throw failure; } });
  assert.equal(accesses, 0); assert.equal(store.read(null), null); assert.equal(accesses, 0);
  assert.equal(store.read('key'), null); assert.equal(accesses, 1);
  const circular = {}; circular.self = circular;
  assert.throws(() => store.write('key', circular), error => error === failure);
  assert.equal(accesses, 2); assert.throws(() => store.remove('key'), error => error === failure);
  let writes = 0;
  const available = createMapStudioDraftStore({ getStorage: () => ({ setItem() { writes++; } }) });
  assert.throws(() => available.write('key', circular), TypeError); assert.equal(writes, 0);
});

test('real draft debounce, interrupted close, cancel and pagehide preserve the last edits without changing the match', t => {
  const f = mapStudioDraftFixture(t), match = f.copy(f.w.mapDefinition);
  f.open(); f.edit('studio-name', 'First'); f.edit('studio-name', 'Interrupted');
  assert.equal(f.timers.size, 1); assert.equal([...f.timers.values()][0].delay, 160);
  f.click('map-studio-close');
  const key = Object.keys(f.saved())[0], draft = JSON.parse(f.saved()[key]);
  assert.equal(draft.version, 1); assert.equal(draft.editor.definition.name, 'Interrupted');
  assert.equal(f.timers.size, 0); assert.equal(f.w.editorDefinition, null);
  f.open(); assert.equal(f.w.ui.studioDraftRecovery.hidden, false);
  assert.equal(f.w.ui.mapStudioLayout.inert, true); f.cancel();
  assert.equal(f.saved()[key], JSON.stringify(draft), 'canceling recovery does not overwrite the saved draft');
  f.open(); f.click('studio-draft-restore');
  assert.equal(f.w.ui.studioName.value, 'Interrupted'); assert.equal(f.w.ui.studioDraftRecovery.hidden, true);
  f.edit('studio-name', 'Page hidden'); f.w.ui.mapStudio.open = false;
  f.w.dispatchEvent(new f.w.Event('pagehide'));
  assert.equal(JSON.parse(f.saved()[key]).editor.definition.name, 'Page hidden');
  assert.equal(f.timers.size, 0); assert.deepEqual(f.copy(f.w.mapDefinition), match);
});

test('real restore rereads storage, reports old drafts, and discard keeps failures recoverable', t => {
  const f = mapStudioDraftFixture(t); f.open(); f.edit('studio-name', 'Recovered'); f.flush();
  const key = f.w.editorDraftStorageKey, raw = f.w.localStorage.getItem(key);
  f.click('map-studio-close');
  const old = JSON.parse(raw); old.version = 0; f.w.localStorage.setItem(key, JSON.stringify(old));
  f.open(); f.click('studio-draft-restore');
  assert.match(f.w.ui.studioDraftRecoveryMessage.textContent, /saved draft could not be read/);
  assert.equal(f.w.ui.studioDraftRecovery.hidden, false); assert.equal(f.w.ui.mapStudioLayout.inert, true);
  assert.equal(f.w.ui.studioName.value, 'DRAFT SOURCE CUSTOM'); assert.equal(f.timers.size, 0);
  f.w.localStorage.setItem(key, raw); f.click('studio-draft-restore');
  assert.equal(f.w.ui.studioName.value, 'Recovered'); assert.equal(f.w.ui.studioDraftRecovery.hidden, true);
  assert.equal(f.w.scenarioEditHistory.canUndo, false); f.click('map-studio-close'); f.open();
  const remove = f.w.Storage.prototype.removeItem;
  f.w.Storage.prototype.removeItem = () => { throw new Error('storage denied'); };
  f.click('studio-draft-discard');
  assert.equal(f.w.ui.studioDraftRecovery.hidden, false);
  assert.match(f.w.ui.studioDraftRecoveryMessage.textContent, /could not clear/);
  assert.match(f.w.ui.studioDraftStatus.textContent, /COULD NOT BE CLEARED/);
  assert.ok(f.w.localStorage.getItem(key));
  f.w.Storage.prototype.removeItem = remove; f.click('studio-draft-discard');
  assert.equal(f.w.ui.studioDraftRecovery.hidden, true); assert.equal(f.w.localStorage.getItem(key), null);
  assert.equal(f.w.ui.studioDraftStatus.textContent, 'NO LOCAL DRAFT');
  f.click('map-studio-close'); f.open(); assert.equal(f.w.ui.studioDraftRecovery.hidden, true);
});

test('corrupt JSON and storage write failures retain data and existing dialog status without automatic retries', t => {
  const f = mapStudioDraftFixture(t); f.open(); const key = f.w.editorDraftStorageKey;
  f.click('map-studio-close'); f.w.localStorage.setItem(key, '{corrupt'); f.open();
  assert.equal(f.w.ui.studioDraftRecovery.hidden, true); assert.equal(f.w.localStorage.getItem(key), '{corrupt');
  const set = f.w.Storage.prototype.setItem; let attempts = 0;
  f.w.Storage.prototype.setItem = () => { attempts++; throw new Error('quota'); };
  f.edit('studio-name', 'Quota failure'); f.flush();
  assert.equal(f.w.ui.studioDraftStatus.textContent, 'LOCAL SAVE FAILED · DOWNLOAD JSON');
  assert.equal(f.w.lastDraftSavedAt(), null); assert.equal(f.timers.size, 0); assert.equal(attempts, 1);
  assert.equal(f.w.localStorage.getItem(key), '{corrupt'); f.flush(); assert.equal(attempts, 1);
  f.w.Storage.prototype.setItem = set; f.edit('studio-name', 'Next edit'); f.flush();
  assert.equal(JSON.parse(f.w.localStorage.getItem(key)).editor.definition.name, 'Next edit');
});

test('actual draft recovery preserves portable import/export through real map validation and population', async t => {
  const f = mapStudioDraftFixture(t); f.open();
  f.edit('studio-name', 'Portable recovery'); f.edit('studio-starting-food', '750'); f.edit('studio-fog-of-war', true);
  f.flush(); f.w.downloadEditorMap();
  const first = JSON.parse(await f.downloads.at(-1).blob.text());
  assert.equal(f.downloads.at(-1).filename, `${first.id}.json`);
  const saved = f.saved(); f.click('map-studio-close');
  const recovered = mapStudioDraftFixture(t, { saved }); recovered.open(); recovered.click('studio-draft-restore');
  recovered.w.downloadEditorMap();
  const second = JSON.parse(await recovered.downloads.at(-1).blob.text());
  assert.deepEqual(second, first); assert.equal(second.startingResources.food, 750); assert.equal(second.fogOfWar, true);
  const text = JSON.stringify(second);
  await recovered.w.importEditorMap({ name: 'roundtrip.json', size: text.length, text: async () => text });
  assert.deepEqual(recovered.copy(recovered.w.collectEditorMap()), first);
  assert.equal(recovered.timers.size, 2, 'one draft timer plus the export URL cleanup timer');
  await assert.rejects(recovered.w.importEditorMap({ name: 'broken.json', size: 1, text: async () => '{' }),
    { message: 'That file is not valid JSON.' });
  assert.deepEqual(recovered.copy(recovered.w.collectEditorMap()), first);
});

test('recovery preserves unfinished authoring fields while actual export still requires a valid map', t => {
  const f = mapStudioDraftFixture(t); f.open(); f.edit('studio-name', ''); f.flush();
  const key = f.w.editorDraftStorageKey;
  assert.equal(JSON.parse(f.w.localStorage.getItem(key)).editor.formValues['studio-name'].value, '');
  f.click('map-studio-close'); f.open(); f.click('studio-draft-restore');
  assert.equal(f.w.ui.studioName.value, ''); assert.equal(f.w.ui.studioDraftRecovery.hidden, true);
  f.w.downloadEditorMap(); assert.equal(f.downloads.length, 0);
  assert.equal(f.w.ui.studioMessage.textContent, 'Map name must be between 1 and 48 characters.');
  assert.ok(f.w.localStorage.getItem(key), 'export rejection retains the local draft');
});

test('actual scenario Undo/Redo restores region/event selections, retains branching and saves only the editor', t => {
  const f = mapStudioDraftFixture(t); f.open(); const match = f.copy(f.w.mapDefinition);
  const undo = f.d.getElementById('studio-scenario-undo'), redo = f.d.getElementById('studio-scenario-redo');
  assert.equal(undo.disabled, true); assert.equal(redo.disabled, true);
  const region = { id: 'pass', name: 'Pass', zone: { column: 4, row: 5, width: 2, height: 3 } };
  const event = { id: 'supply', name: 'Supply', type: 'timed-supply', afterSeconds: 5, team: '0', foodReward: 10 };
  f.w.editorScenarioEvents = [event]; f.w.selectedEditorRegionId = 'pass'; f.w.selectedEditorScenarioEventId = 'supply';
  f.w.writeEditorRegions([region]);
  f.w.editorScenarioEvents = [{ ...event, afterSeconds: 20 }]; f.w.selectedEditorRegionId = null;
  f.w.selectedEditorScenarioEventId = null; f.w.writeEditorRegions([{ ...region, name: 'Edited pass' }]);
  assert.equal(undo.disabled, false); f.click('studio-scenario-undo');
  assert.deepEqual(f.copy(f.w.readEditorRegions()), [region]); assert.deepEqual(f.copy(f.w.editorScenarioEvents), [event]);
  assert.equal(f.w.selectedEditorRegionId, 'pass'); assert.equal(f.w.selectedEditorScenarioEventId, 'supply');
  assert.equal(redo.disabled, false); assert.equal(f.timers.size, 1);
  f.click('studio-scenario-redo');
  assert.equal(f.w.readEditorRegions()[0].name, 'Edited pass'); assert.equal(f.w.editorScenarioEvents[0].afterSeconds, 20);
  assert.equal(f.w.selectedEditorRegionId, null); assert.equal(f.w.selectedEditorScenarioEventId, null);
  f.click('studio-scenario-undo'); f.w.writeEditorRegions([{ ...region, name: 'New branch' }]);
  assert.equal(redo.disabled, true); f.flush();
  const saved = JSON.parse(f.w.localStorage.getItem(f.w.editorDraftStorageKey));
  assert.equal(saved.editor.definition.regions[0].name, 'New branch');
  assert.deepEqual(saved.editor.definition.scenarioEvents, [event]);
  assert.deepEqual(f.copy(f.w.mapDefinition), match);
});

test('actual scenario history resets on draft recovery and portable import', async t => {
  const f = mapStudioDraftFixture(t); f.open();
  const region = { id: 'pass', name: 'Pass', zone: { column: 4, row: 5, width: 2, height: 3 } };
  f.w.writeEditorRegions([region]); f.flush(); assert.equal(f.w.scenarioEditHistory.canUndo, true);
  const portable = JSON.stringify(f.w.collectEditorMap());
  f.click('map-studio-close'); f.open(); f.click('studio-draft-restore');
  assert.deepEqual(f.copy(f.w.readEditorRegions()), [region]);
  assert.equal(f.w.scenarioEditHistory.canUndo, false); assert.equal(f.w.scenarioEditHistory.canRedo, false);
  assert.equal(f.d.getElementById('studio-scenario-undo').disabled, true);
  f.w.writeEditorRegions([{ ...region, name: 'Changed' }]); assert.equal(f.w.scenarioEditHistory.canUndo, true);
  await f.w.importEditorMap({ name: 'scenario.json', size: portable.length, text: async () => portable });
  assert.deepEqual(f.copy(f.w.readEditorRegions()), [region]);
  assert.equal(f.w.scenarioEditHistory.canUndo, false); assert.equal(f.w.scenarioEditHistory.canRedo, false);
  assert.equal(f.d.getElementById('studio-scenario-redo').disabled, true);
});
