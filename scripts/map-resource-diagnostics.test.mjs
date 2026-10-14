import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { analyzeMapResources } from '../src/authoring/map-resource-diagnostics.mjs';
import { resourceBudget, formatMapResourceAmount } from '../src/authoring/map-resource-budgets.mjs';
import { FOREST_WOOD_PER_CELL } from '../src/rules/forest-resources.mjs';
import { townCenterSpawnPosition } from '../src/town-center-spawn.mjs';
import { mapStudioDraftFixture } from './fixtures/map-studio-draft-fixture.mjs';

function map() {
  return { width: 32, height: 32, obstacles: [],
    spawnPoints: [{ team: 0, x: -10.5, z: 0.5 }, { team: 1, x: 9.5, z: 0.5 }],
    startingResources: { food: 150, wood: 250 },
    resourceNodes: [{ id: 'left-food', type: 'food', x: -6.5, z: 4.5, stock: 130 },
      { id: 'right-food', type: 'food', x: 5.5, z: 4.5, stock: 130 },
      { id: 'equal-food', type: 'food', x: -0.5, z: 4.5, stock: 60, resourceVariant: 'shore-fish' },
      { id: 'sheep', type: 'food', x: -7.5, z: -4.5, stock: 13.5, wildlifeSpecies: 'bellweather-sheep' },
      { id: 'wood', type: 'wood', x: 0.5, z: 6.5, stock: 900 }],
  };
}

function conservation(report) {
  for (const type of report.resourceTypes) {
    const allocation = resourceBudget([type]);
    for (const stock of [report.closer[0], report.closer[1], report.equal, report.inaccessible]) allocation.add(type, stock[type]);
    assert.equal(report.total[type], allocation.values()[type]);
    for (const team of [0, 1]) {
      const reachable = resourceBudget([type]);
      for (const node of report.nodes.filter(node => node.type === type && node.distances[team] !== null)) reachable.add(type, node.stock);
      assert.equal(report.reachable[team][type], reachable.values()[type]);
    }
  }
}

test('banks, finite fractional node stock, equal allocation and shared access are separate and conserved', () => {
  const m = map(), before = structuredClone(m), report = analyzeMapResources(m);
  assert.deepEqual(m, before); assert.deepEqual(report.total, { food: '333.5', wood: '900' });
  assert.deepEqual(report.startingPerSeat, [{ food: 150, wood: 250 }, { food: 150, wood: 250 }]);
  assert.equal(report.equal.food, '60'); assert.equal(report.closer[0].food, '143.5'); assert.equal(report.closer[1].food, '130');
  assert.deepEqual(report.reachable, [report.total, report.total]); assert.equal(report.spawnsConnected, true);
  assert.equal(report.nodes.find(node => node.id === 'equal-food').kind, 'Shore fish');
  assert.equal(report.nodes.find(node => node.id === 'sheep').kind, 'Sheep');
  assert.equal(report.nodes.find(node => node.id === 'left-food').distances[0], 8);
  assert.deepEqual(report.nodes[0].frontage, [4, 4]); conservation(report);
  m.economyProfileId = 'stone-defense-v1'; m.resourceNodes.push({ id: 'stone', type: 'stone', x: -0.5, z: -6.5, stock: 67 });
  const stone = analyzeMapResources(m); assert.equal(stone.total.stone, '67');
  assert.equal(stone.startingPerSeat[0].stone, 0); assert.equal(stone.startingPerSeat[1].stone, 0); conservation(stone);
});

test('blocked markers, initial Town Centers and two-level cliffs report seat-specific remedies', () => {
  const m = map(); m.elevationPatches = [{ column: 16, row: 0, width: 1, height: 32, level: 2 }];
  const divided = analyzeMapResources(m);
  assert.equal(divided.spawnsConnected, false); assert.ok(divided.issues.some(issue => /level-1 ramps/.test(issue.message)));
  assert.equal(divided.nodes.find(node => node.id === 'left-food').distances[1], null);
  assert.equal(divided.nodes.find(node => node.id === 'right-food').distances[0], null); conservation(divided);
  m.elevationPatches = [{ column: 16, row: 0, width: 1, height: 16, level: 2 },
    { column: 16, row: 16, width: 1, height: 1, level: 1 }, { column: 16, row: 17, width: 1, height: 15, level: 2 }];
  assert.equal(analyzeMapResources(m).spawnsConnected, true);
  const tc = townCenterSpawnPosition(m.spawnPoints, 0, m.width, m.height);
  m.resourceNodes.push({ id: 'under-center', type: 'wood', ...tc, stock: 99 });
  const covered = analyzeMapResources(m), row = covered.nodes.find(node => node.id === 'under-center');
  assert.deepEqual(row.distances, [null, null]); assert.deepEqual(row.frontage, [0, 0]);
  assert.equal(row.blockedBy, 'Town Center'); assert.equal(covered.inaccessible.wood, '99');
  assert.ok(covered.issues.some(issue => issue.nodeId === 'under-center' && /Town Center/.test(issue.message))); conservation(covered);
});

test('forest potential and initial edge access differ from nodes, banks and permanent barriers', () => {
  const m = map(); m.obstacles = [{ column: 16, row: 0, width: 1, height: 32, material: 'forest' }];
  const report = analyzeMapResources(m);
  assert.equal(report.spawnsConnected, false); assert.equal(report.total.wood, '900');
  assert.equal(report.forest.cells, 32); assert.equal(report.forest.potential, 32 * FOREST_WOOD_PER_CELL);
  assert.deepEqual(report.forest.reachableAfterCut, [192, 192]); assert.deepEqual(report.forest.initialEdgeCells, [32, 32]);
  m.obstacles.push({ column: 14, row: 0, width: 1, height: 32, material: 'water' });
  const water = analyzeMapResources(m); assert.equal(water.forest.reachableAfterCut[0], 0);
  assert.equal(water.forest.reachableAfterCut[1], 192);
  assert.equal(water.forest.initialEdgeCells[0], 0);
});

test('unsafe or unfinished analysis inputs fail without mutation, and blocked spawns get a remedy', () => {
  for (const change of [m => { m.width = 320; }, m => { m.resourceNodes[0].stock = NaN; },
    m => { m.resourceNodes[0].x = 100; }, m => { m.resourceNodes[0].type = 'stone'; },
    m => { m.resourceNodes.push({ ...m.resourceNodes[0] }); }, m => { m.startingResources.food = -1; },
    m => { m.elevationPatches = [{ column: 0, row: 0, width: 32, height: 32, level: 3 }]; },
    m => { m.obstacles = [{ column: 0, row: 0, width: 2, height: 2 }, { column: 0, row: 0, width: 1, height: 1 }]; }]) {
    const m = map(); change(m); const before = structuredClone(m);
    assert.throws(() => analyzeMapResources(m)); assert.deepEqual(m, before);
  }
  const m = map(); m.obstacles = [{ column: 5, row: 16, width: 1, height: 1, material: 'stone' }];
  assert.match(analyzeMapResources(m).issues[0].message, /Azure spawn.*Move the spawn/);
});

test('the whole shipped catalog conserves its authored supply; ordinary tiers retain exact budgets', () => {
  const expected = { 'veyrholds-terraced-vale': [6100, 7950, 18972], 'veyrholds-threefold-basin': [9700, 11950, 24204],
    'veyrholds-riven-escarpment': [12100, 14950, 38460], 'veyrholds-crownroads': [19700, 24150, 49356] };
  for (const file of readdirSync(new URL('../maps/', import.meta.url)).filter(file => file.endsWith('.json'))) {
    const m = JSON.parse(readFileSync(new URL(`../maps/${file}`, import.meta.url))), before = structuredClone(m);
    const report = analyzeMapResources(m); conservation(report); assert.deepEqual(m, before);
    if (expected[m.id]) {
      assert.deepEqual([report.total.food, report.total.wood, report.forest.potential],
        [String(expected[m.id][0]), String(expected[m.id][1]), expected[m.id][2]], file);
      assert.equal(report.issues.length, 0, file); assert.deepEqual(report.reachable, [report.total, report.total]);
    }
  }
  const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  assert.match(source, /import \{ FOREST_WOOD_PER_CELL \} from '\.\/src\/rules\/forest-resources\.mjs'/);
  assert.doesNotMatch(source, /const FOREST_WOOD_PER_CELL/);
  assert.equal(FOREST_WOOD_PER_CELL, 6);
});

function fixture(t) {
  const f = mapStudioDraftFixture(t, { resourceDiagnostics: true, terrainGestures: true });
  f.open(); f.flush();
  f.panel = f.d.querySelector('.studio-map-diagnostics');
  f.results = f.panel.querySelector('[data-diagnostics="results"]');
  f.status = f.panel.querySelector('[data-diagnostics="status"]');
  f.report = () => analyzeMapResources(f.w.readEditorResourceDiagnosticMap());
  f.stroke = tool => {
    f.w.editorTool = tool; f.w.ui.studioObstacleShape.value = 'rectangle';
    for (const type of ['pointerdown', 'pointerup']) {
      const event = new f.w.Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, { button: 0, pointerId: 1, clientX: 165, clientY: 165 });
      f.w.ui.studioGrid.dispatchEvent(event);
    }
  };
  return f;
}

test('real editor updates bank/node budgets, terrain removal/undo, spawn access and recovery with no diagnostic JSON', async t => {
  const f = fixture(t), original = f.w.collectEditorMap();
  assert.equal(f.results.hidden, false); assert.match(f.panel.textContent, /Starting banks per seat/);
  assert.match(f.panel.textContent, /Finite node stock.*reachable/s); assert.equal(f.report().total.food, '300');
  f.edit('studio-starting-food', 500); assert.equal(f.results.hidden, true); f.flush();
  assert.equal(f.report().startingPerSeat[0].food, 500); assert.equal(f.report().total.food, '300');
  f.w.selectedEditorResourceId = 'food'; f.w.syncEditorResourceControls(); f.edit('studio-resource-stock', '450.5'); f.flush();
  assert.equal(f.report().total.food, '450.5'); assert.match(f.results.textContent, /450\.5/);
  f.stroke('forest'); f.flush(); assert.equal(f.report().total.food, '0'); assert.equal(f.report().forest.cells, 1);
  f.click('studio-terrain-undo'); f.flush(); assert.equal(f.report().total.food, '450.5');
  f.w.editorTool = 'azure';
  const move = new f.w.Event('pointerdown', { bubbles: true, cancelable: true });
  Object.assign(move, { button: 0, pointerId: 1, clientX: 195, clientY: 165 });
  f.w.ui.studioGrid.dispatchEvent(move); f.flush();
  assert.notDeepEqual(f.report().nodes[0].distances, analyzeMapResources(original).nodes[0].distances);
  f.w.downloadEditorMap(); const portable = JSON.parse(await f.downloads.at(-1).blob.text());
  assert.equal(Object.hasOwn(portable, 'diagnostics'), false);
  const recovered = mapStudioDraftFixture(t, { saved: f.saved(), resourceDiagnostics: true, terrainGestures: true });
  recovered.open(); recovered.click('studio-draft-restore'); recovered.flush();
  assert.deepEqual(analyzeMapResources(recovered.w.readEditorResourceDiagnosticMap()), f.report());
});

test('analysis caching avoids preview redraws; invalid drafts hide stale reports and close cancels work', t => {
  const f = fixture(t), table = f.panel.querySelector('table');
  f.w.drawEditorGrid(); assert.equal(f.panel.querySelector('table'), table);
  assert.equal([...f.timers.values()].filter(timer => timer.callback.name === 'refresh').length, 0);
  f.edit('studio-name', 'Only metadata'); f.flush(); assert.equal(f.panel.querySelector('table'), table);
  f.w.editorResourceNodes[0].stock = -1; f.w.drawEditorGrid(); assert.equal(f.results.hidden, true); f.flush();
  assert.match(f.status.textContent, /Analysis unavailable.*resource nodes/); assert.equal(f.results.childElementCount, 0);
  f.w.editorResourceNodes[0].stock = 200; f.w.drawEditorGrid();
  f.click('map-studio-close'); assert.equal(f.results.hidden, true);
  assert.equal([...f.timers.values()].filter(timer => timer.callback.name === 'refresh').length, 0);
});

test('real patch Apply/Undo/Redo refreshes diagnostics and unsafe draft text stays text', t => {
  const f = fixture(t), before = f.report().total.food;
  const panel = f.d.querySelector('[data-brush="preview"]').closest('details');
  for (const [name, value] of [['column', '16'], ['row', '24']]) {
    const field = panel.querySelector(`#studio-brush-${name}`); field.value = value;
    field.dispatchEvent(new f.w.Event('input', { bubbles: true }));
  }
  panel.querySelector('[data-brush="preview"]').click();
  assert.equal(panel.querySelector('[data-brush="apply"]').disabled, false, panel.textContent);
  panel.querySelector('[data-brush="apply"]').click(); f.flush();
  const applied = f.report().total.food; assert.ok(Number(applied) > Number(before));
  panel.querySelector('[data-brush="undo"]').click(); f.flush(); assert.equal(f.report().total.food, before);
  panel.querySelector('[data-brush="redo"]').click(); f.flush(); assert.equal(f.report().total.food, applied);
  f.w.editorResourceNodes[0].id = '<img src=x onerror=alert(1)>'; f.w.drawEditorGrid(); f.flush();
  assert.equal(f.panel.querySelector('img'), null); assert.ok(f.panel.textContent.includes('<img src=x onerror=alert(1)>'));
});

test('real preset apply, undo, export and recovery preserve derived budgets and ordinary nodes', async t => {
  const f = fixture(t), before = f.report();
  for (const [name, value] of [['column', '16'], ['row', '24'], ['stock', '101'], ['preset', 'wood-grove']]) f.edit(`studio-brush-${name}`, value);
  const patch = f.d.querySelector('[data-brush="preview"]').closest('details');
  patch.querySelector('[data-brush="preview"]').click(); f.flush();
  assert.equal(patch.querySelector('[data-brush="apply"]').disabled, false, patch.textContent);
  assert.deepEqual(f.report(), before); assert.equal(f.report().total.wood, '0');
  patch.querySelector('[data-brush="apply"]').click(); f.flush();
  assert.equal(f.report().total.wood, '101'); assert.equal(f.report().nodes.filter(n => n.type === 'wood').length, 9);
  assert.equal(f.report().forest.cells, 0); assert.deepEqual(f.report().startingPerSeat, before.startingPerSeat);
  patch.querySelector('[data-brush="undo"]').click(); f.flush(); assert.equal(f.report().total.wood, '0');
  patch.querySelector('[data-brush="redo"]').click(); f.flush(); assert.equal(f.report().total.wood, '101');
  f.w.downloadEditorMap(); const portable = JSON.parse(await f.downloads.at(-1).blob.text());
  assert.equal(Object.hasOwn(portable, 'preset'), false);
  assert.ok(portable.resourceNodes.every(node => !Object.hasOwn(node, 'preset')));
  const recovered = mapStudioDraftFixture(t, { saved: f.saved(), resourceDiagnostics: true });
  recovered.open(); recovered.click('studio-draft-restore'); recovered.flush();
  assert.equal(recovered.d.querySelector('#studio-brush-preset').value, 'wood-grove');
  assert.deepEqual(analyzeMapResources(recovered.w.readEditorResourceDiagnosticMap()), f.report());
});

test('exact decimal budgets preserve large-plus-small stocks, overflow-sized sums and tiny positive display', t => {
  const m = map(); m.resourceNodes = [{ id: 'large', type: 'food', x: -6.5, z: 4.5, stock: 1e16 },
    ...Array.from({ length: 4 }, (_, index) => ({ id: `small-${index}`, type: 'food', x: 5.5, z: 4.5 + index, stock: 1 }))];
  const report = analyzeMapResources(m); assert.equal(report.total.food, '10000000000000004');
  assert.deepEqual(report.closer.map(stock => stock.food), ['10000000000000000', '4']); conservation(report);
  const sums = resourceBudget(['food']); sums.add('food', 1e308); sums.add('food', 1e308);
  assert.equal(sums.values().food, '2' + '0'.repeat(308));
  assert.equal(formatMapResourceAmount('10000000000000004'), '10,000,000,000,000,004');
  assert.equal(formatMapResourceAmount(1e-7), '0.0000001');
  sums.add('food', 1e-300); assert.ok(sums.values().food.endsWith('1'));
  assert.throws(() => formatMapResourceAmount('1e1000000'));
  const f = fixture(t); f.w.editorResourceNodes[0].stock = 1e-7; f.w.drawEditorGrid(); f.flush();
  assert.equal(f.report().total.food, '0.0000001'); assert.match(f.results.textContent, /0\.0000001/);
});
