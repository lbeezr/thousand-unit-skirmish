import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { mountResourceBrushControls } from '../src/resource-brush-controls.mjs';

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
  Object.assign(w, { mountResourceBrushControls, resourceBrushControls: null,
    editorDefinition: { id: 'brush-ui', name: 'BRUSH UI', width: 64, height: 64,
      terrainBase: 'meadow', terrainPatches: [{ column: 0, row: 0, width: 64, height: 64, material: 'dirt' }],
      obstacles: [], spawnPoints: [{ team: 0, x: -20.5, z: 0.5 }, { team: 1, x: 20.5, z: 0.5 }] },
    editorResourceNodes: [{ id: 'old', type: 'wood', x: 8.5, z: 10.5, stock: 13.5 }],
    selectedEditorResourceId: 'old', terrain: [], blockers: [], elevation: [], saves: 0, redraws: 0,
    compressEditorGround: () => w.terrain, compressEditorObstacles: () => w.blockers,
    withCurrentEditorElevation: map => ({ ...map, elevationPatches: w.elevation }),
    syncEditorResourceControls: () => { w.ui.studioResourceStock.value = w.editorResourceNodes.find(n => n.id === w.selectedEditorResourceId)?.stock ?? 300; },
    drawEditorGrid: () => { w.redraws++; w.resourceBrushControls?.sync(); },
    scheduleMapStudioDraftSave: () => { w.saves++; },
    editorTool: 'pan', editorCellFromPointer: () => ({ column: 23, row: 21 }),
  });
  w.ui.studioTerrainBase.value = 'meadow'; w.ui.studioResourceStock.value = 13.5;
  w.ui.mapStudio.open = true;
  w.eval(between('resourceBrushControls = mountResourceBrushControls({', "ui.studioResourceStock.addEventListener('input'"));
  w.eval(between("ui.studioGrid.addEventListener('pointerdown'", "ui.studioGrid.addEventListener('pointermove'"));
  const panel = d.querySelector('.resource-node-fields details'); panel.open = true;
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
  f.set('stock', 101); const a = f.preview();
  assert.deepEqual(a.map(n => n.stock), [21, 20, 20, 20, 20]);
  assert.equal(a.reduce((sum, n) => sum + n.stock, 0), 101);
  assert.match(f.status.textContent, /101 total stock.*20–21 per marker.*seed 93000/);
  assert.deepEqual(f.preview(), a); assert.deepEqual(f.w.editorResourceNodes, original);
  assert.equal(f.w.selectedEditorResourceId, 'old'); assert.equal(f.w.saves, 0);
  assert.equal(f.w.ui.studioResourceStock.value, '13.5');
  f.set('seed', 93001); assert.equal(f.markers().length, 0); assert.notDeepEqual(f.preview(), a);
});

test('apply/undo/redo preserve stock, metadata, selection and unrelated map fields with one save per operation', t => {
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
  for (const [name, value] of [['stock', 4], ['stock', ''], ['stock', 5.5], ['seed', 1.5], ['column', 65], ['row', 0]]) {
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
  f.w.withCurrentEditorElevation = () => { throw new Error('Too many elevation patches'); };
  assert.doesNotThrow(() => f.w.drawEditorGrid()); assert.equal(f.button('undo').disabled, true);
  assert.equal(f.markers().length, 0); assert.match(f.status.textContent, /Too many elevation/);
});

test('same-map reload resets session; closing or changing tools clears overlays without adding nodes', t => {
  const f = fixture(t); f.preview(); f.button('apply').click(); f.w.resourceBrushControls.reset();
  assert.equal(f.button('undo').disabled, true); f.set('column', 44); f.preview();
  f.w.resourceBrushControls.cancel(); assert.equal(f.markers().length, 0);
  f.preview(); f.w.ui.mapStudio.dispatchEvent(new f.w.Event('close')); assert.equal(f.markers().length, 0);
  assert.equal(f.w.saves, 1); assert.equal(f.w.editorResourceNodes.length, 6);
});
