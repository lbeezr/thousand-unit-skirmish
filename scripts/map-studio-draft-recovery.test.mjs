import assert from 'node:assert/strict';
import test from 'node:test';
import { requireRecovery } from '../src/authoring/map-studio/draft/v1/contract.mjs';
import { createMapStudioDraftStore } from '../src/authoring/map-studio-draft-store.mjs';
import { createMapStudioFormState } from '../src/authoring/map-studio-form-state.mjs';
import { mapStudioDraftFixture } from './fixtures/map-studio-draft-fixture.mjs';

const fields = ['resourceNodes', 'triggers', 'scenarioEvents', 'terrainPatches'];
const recoveryMessage = 'The saved draft could not be read. Discard it to start a fresh map.';
const draftFor = definition => ({ version: 1, sourceMapId: 'source', editor: { definition } });
const minimalDefinition = () => ({ width: 16, height: 256, obstacles: [], spawnPoints: [] });

for (const field of fields) {
  test(`recovery preflight rejects truthy non-array ${field} without mutating its input`, () => {
    for (const value of [{ privateDetail: 'private invalid draft contents' }, 'private contents', true, 1]) {
      const draft = draftFor({ ...minimalDefinition(), [field]: value });
      const before = structuredClone(draft);
      assert.throws(() => requireRecovery(draft, 'source'), { message: recoveryMessage });
      assert.deepEqual(draft, before);
    }
  });

  test(`recovery preflight preserves array references and existing falsy ${field} fallbacks`, () => {
    for (const value of [undefined, null, false, 0, '', [], [{ id: 'unfinished' }]]) {
      const draft = draftFor({ ...minimalDefinition(), [field]: value });
      const before = structuredClone(draft);
      const recovered = requireRecovery(draft, 'source');
      assert.equal(recovered.state, draft.editor);
      assert.equal(recovered.definition, draft.editor.definition);
      assert.equal(recovered.definition[field], value);
      assert.deepEqual(draft, before);
    }
  });

  test(`actual Restore rejects malformed ${field} before changing editor state and supports repair/retry`, t => {
    const f = mapStudioDraftFixture(t);
    const formState = createMapStudioFormState({ root: f.w.ui.mapStudio, document: f.d });
    f.open();
    f.edit('studio-name', 'Retained local edit');
    f.flush();
    const key = f.w.editorDraftStorageKey;
    const validRaw = f.w.localStorage.getItem(key);
    const damaged = JSON.parse(validRaw);
    damaged.editor.definition.name = 'Private damaged draft';
    damaged.editor.definition[field] = {};
    const damagedRaw = JSON.stringify(damaged);
    f.w.localStorage.setItem(key, damagedRaw);
    f.w.showMapStudioDraftRecovery(damaged);
    const references = {
      definition: f.w.editorDefinition, resources: f.w.editorResourceNodes,
      triggers: f.w.editorTriggers, events: f.w.editorScenarioEvents,
      ground: f.w.editorGroundMaterials, cells: f.w.editorCellMaterials,
      levels: f.w.editorGroundLevels, elevations: f.w.editorCellElevations,
    };
    const before = {
      form: formState.capture(), match: f.copy(f.w.mapDefinition),
      redraws: f.w.redraws, savedAt: f.w.lastDraftSavedAt(),
      dirty: f.w.editorDraftDirty, status: f.w.ui.studioDraftStatus.textContent,
      history: [...f.w.scenarioEditHistory.states], historyIndex: f.w.scenarioEditHistory.index,
      timers: [...f.timers],
    };
    f.click('studio-draft-restore');
    assert.equal(f.w.editorDefinition, references.definition);
    assert.equal(f.w.editorResourceNodes, references.resources);
    assert.equal(f.w.editorTriggers, references.triggers);
    assert.equal(f.w.editorScenarioEvents, references.events);
    assert.equal(f.w.editorGroundMaterials, references.ground);
    assert.equal(f.w.editorCellMaterials, references.cells);
    assert.equal(f.w.editorGroundLevels, references.levels);
    assert.equal(f.w.editorCellElevations, references.elevations);
    assert.deepEqual(formState.capture(), before.form);
    assert.deepEqual(f.copy(f.w.mapDefinition), before.match);
    assert.equal(f.w.redraws, before.redraws);
    assert.equal(f.w.lastDraftSavedAt(), before.savedAt);
    assert.equal(f.w.editorDraftDirty, before.dirty);
    assert.equal(f.w.ui.studioDraftStatus.textContent, before.status);
    assert.deepEqual(f.w.scenarioEditHistory.states, before.history);
    assert.equal(f.w.scenarioEditHistory.index, before.historyIndex);
    assert.deepEqual([...f.timers], before.timers);
    assert.equal(f.w.ui.studioDraftRecoveryMessage.textContent, recoveryMessage);
    assert.equal(f.w.ui.studioDraftRecovery.hidden, false);
    assert.equal(f.w.ui.mapStudioLayout.inert, true);
    assert.equal(f.w.localStorage.getItem(key), damagedRaw);
    f.w.localStorage.setItem(key, validRaw);
    f.click('studio-draft-restore');
    assert.equal(f.w.ui.studioName.value, 'Retained local edit');
    assert.equal(f.w.ui.studioDraftRecovery.hidden, true);
    assert.equal(f.w.localStorage.getItem(key), validRaw);
    f.flush();
    assert.equal(JSON.parse(f.w.localStorage.getItem(key)).editor.definition.name, 'Retained local edit');
  });
}

test('recovery guards preserve original getter faults and existing storage exception contracts', () => {
  const failure = new DOMException('Private storage detail', 'SecurityError');
  const store = createMapStudioDraftStore({ getStorage() { throw failure; } });
  assert.equal(store.read('key'), null);
  assert.throws(() => store.write('key', {}), error => error === failure);
  assert.throws(() => store.remove('key'), error => error === failure);
  const draft = draftFor(minimalDefinition());
  Object.defineProperty(draft, 'editor', { get() { throw failure; } });
  assert.throws(() => requireRecovery(draft, 'source'), error => error === failure);
});


const elevationPatch = (level = 2) => ({ column: 0, row: 0, width: 1, height: 1, level });
const invalidElevations = [
  ['shape', {}],
  ['bounds', [{ ...elevationPatch(), column: 32 }]],
  ['level', [elevationPatch(3)]],
  ['overlap', [elevationPatch(), elevationPatch()]],
  ['limit', Array.from({ length: 4097 }, () => elevationPatch())],
];

for (const [reason, patches] of invalidElevations) {
  test(`actual Restore rejects elevation ${reason} before mutation and supports repair/retry`, t => {
    const f = mapStudioDraftFixture(t);
    const formState = createMapStudioFormState({ root: f.w.ui.mapStudio, document: f.d });
    f.open();
    f.edit('studio-name', 'Retained local edit');
    f.flush();
    const key = f.w.editorDraftStorageKey;
    const validRaw = f.w.localStorage.getItem(key);
    const damaged = JSON.parse(validRaw);
    damaged.editor.definition.name = 'Private damaged draft';
    damaged.editor.definition.elevationPatches = patches;
    const damagedRaw = JSON.stringify(damaged);
    f.w.localStorage.setItem(key, damagedRaw);
    f.w.showMapStudioDraftRecovery(damaged);
    const references = {
      definition: f.w.editorDefinition, resources: f.w.editorResourceNodes,
      triggers: f.w.editorTriggers, events: f.w.editorScenarioEvents,
      ground: f.w.editorGroundMaterials, cells: f.w.editorCellMaterials,
      levels: f.w.editorGroundLevels, elevations: f.w.editorCellElevations,
    };
    const before = {
      form: formState.capture(), match: f.copy(f.w.mapDefinition),
      definition: f.copy(f.w.editorDefinition),
      grids: [f.w.editorGroundMaterials, f.w.editorCellMaterials, f.w.editorGroundLevels, f.w.editorCellElevations]
        .map(grid => [...grid]),
      selectedRegion: f.w.selectedEditorRegionId, tool: f.w.editorTool,
      redraws: f.w.redraws, savedAt: f.w.lastDraftSavedAt(),
      dirty: f.w.editorDraftDirty, status: f.w.ui.studioDraftStatus.textContent,
      history: [...f.w.scenarioEditHistory.states], historyIndex: f.w.scenarioEditHistory.index,
      timers: [...f.timers],
    };
    f.click('studio-draft-restore');
    assert.equal(f.w.editorDefinition, references.definition);
    assert.equal(f.w.editorResourceNodes, references.resources);
    assert.equal(f.w.editorTriggers, references.triggers);
    assert.equal(f.w.editorScenarioEvents, references.events);
    assert.equal(f.w.editorGroundMaterials, references.ground);
    assert.equal(f.w.editorCellMaterials, references.cells);
    assert.equal(f.w.editorGroundLevels, references.levels);
    assert.equal(f.w.editorCellElevations, references.elevations);
    assert.deepEqual(f.copy(f.w.editorDefinition), before.definition);
    assert.deepEqual([f.w.editorGroundMaterials, f.w.editorCellMaterials, f.w.editorGroundLevels, f.w.editorCellElevations]
      .map(grid => [...grid]), before.grids);
    assert.equal(f.w.selectedEditorRegionId, before.selectedRegion);
    assert.equal(f.w.editorTool, before.tool);
    assert.deepEqual(formState.capture(), before.form);
    assert.deepEqual(f.copy(f.w.mapDefinition), before.match);
    assert.equal(f.w.redraws, before.redraws);
    assert.equal(f.w.lastDraftSavedAt(), before.savedAt);
    assert.equal(f.w.editorDraftDirty, before.dirty);
    assert.equal(f.w.ui.studioDraftStatus.textContent, before.status);
    assert.deepEqual(f.w.scenarioEditHistory.states, before.history);
    assert.equal(f.w.scenarioEditHistory.index, before.historyIndex);
    assert.deepEqual([...f.timers], before.timers);
    assert.equal(f.w.ui.studioDraftRecoveryMessage.textContent, `Invalid elevation patches: ${reason}.`);
    assert.equal(f.w.ui.studioDraftRecovery.hidden, false);
    assert.equal(f.w.ui.mapStudioLayout.inert, true);
    assert.equal(f.w.localStorage.getItem(key), damagedRaw);
    f.w.localStorage.setItem(key, validRaw);
    f.click('studio-draft-restore');
    assert.equal(f.w.ui.studioName.value, 'Retained local edit');
    assert.equal(f.w.ui.studioDraftRecovery.hidden, true);
    assert.equal(f.w.localStorage.getItem(key), validRaw);
    f.flush();
    assert.equal(JSON.parse(f.w.localStorage.getItem(key)).editor.definition.name, 'Retained local edit');
  });
}

test('elevation preflight preserves valid recovery references and unfinished form values', () => {
  for (const patches of [undefined, [], [elevationPatch(0)], [elevationPatch(2)]]) {
    const draft = draftFor({ ...minimalDefinition(), elevationPatches: patches });
    draft.editor.form = { name: '', width: 'unfinished' };
    const before = structuredClone(draft);
    const recovered = requireRecovery(draft, 'source');
    assert.equal(recovered.state, draft.editor);
    assert.equal(recovered.definition, draft.editor.definition);
    assert.equal(recovered.definition.elevationPatches, patches);
    assert.deepEqual(draft, before);
  }
  for (const patches of [null, false, 0, '']) {
    assert.throws(() => requireRecovery(draftFor({ ...minimalDefinition(), elevationPatches: patches }), 'source'),
      { message: 'Invalid elevation patches: shape.' });
  }
});

for (const [name, patches, expectedLevel] of [
  ['omitted', undefined, 0], ['empty', [], 0],
  ['zero level', [elevationPatch(0)], 0], ['raised level', [elevationPatch(2)], 2],
]) {
  test(`actual Restore accepts ${name} elevations and retains saved form state`, t => {
    const f = mapStudioDraftFixture(t);
    f.open();
    f.edit('studio-name', 'Saved valid recovery');
    f.flush();
    const key = f.w.editorDraftStorageKey;
    const draft = JSON.parse(f.w.localStorage.getItem(key));
    draft.editor.definition.elevationPatches = patches;
    const raw = JSON.stringify(draft);
    f.w.localStorage.setItem(key, raw);
    f.w.showMapStudioDraftRecovery(draft);
    f.click('studio-draft-restore');
    assert.equal(f.w.ui.studioName.value, 'Saved valid recovery');
    assert.equal(f.w.editorGroundLevels[0], expectedLevel);
    assert.equal(f.w.editorGroundLevels[1], 0);
    assert.equal(f.w.ui.studioDraftRecovery.hidden, true);
    assert.equal(f.w.localStorage.getItem(key), raw);
    f.flush();
    assert.equal(JSON.parse(f.w.localStorage.getItem(key)).editor.definition.name, 'Saved valid recovery');
  });
}

test('elevation preflight retains prior guard ordering and unexpected-error identity', () => {
  const failure = new Error('Private unexpected elevation detail');
  for (const makeDraft of [
    () => ({ ...draftFor(minimalDefinition()), version: 2 }),
    () => ({ ...draftFor(minimalDefinition()), sourceMapId: 'foreign' }),
    () => draftFor({ ...minimalDefinition(), width: 15 }),
    () => draftFor({ ...minimalDefinition(), resourceNodes: {} }),
  ]) {
    const draft = makeDraft();
    let reads = 0;
    Object.defineProperty(draft.editor.definition, 'elevationPatches', { get() { reads++; throw failure; } });
    assert.throws(() => requireRecovery(draft, 'source'), { message: recoveryMessage });
    assert.equal(reads, 0);
  }
  const draft = draftFor(minimalDefinition());
  Object.defineProperty(draft.editor.definition, 'elevationPatches', { get() { throw failure; } });
  assert.throws(() => requireRecovery(draft, 'source'), error => error === failure);
  const patch = elevationPatch();
  Object.defineProperty(patch, 'level', { get() { throw failure; } });
  assert.throws(() => requireRecovery(draftFor({ ...minimalDefinition(), elevationPatches: [patch] }), 'source'),
    error => error === failure);
});


const nullEntryCases = [
  ['terrainPatches', { column: 1, row: 2, width: 1, height: 2, material: 'dirt' },
    'Map has a ground paint patch outside its grid or with an invalid material.'],
  ['obstacles', { column: 1, row: 2, width: 1, height: 2, material: 'stone' },
    'Map has a terrain block outside its grid or with invalid dimensions.'],
];

for (const [field, record, message] of nullEntryCases) {
  for (const [name, records] of [
    ['single null', [null]], ['mixed entries', [record, null, { ...record, column: 5 }]],
  ]) {
    test(`actual Restore rejects ${field} ${name} before mutation and supports explicit repair/retry`, t => {
      const f = mapStudioDraftFixture(t);
      const formState = createMapStudioFormState({ root: f.w.ui.mapStudio, document: f.d });
      f.open();
      f.edit('studio-name', 'Retained local edit');
      f.flush();
      const key = f.w.editorDraftStorageKey;
      const validRaw = f.w.localStorage.getItem(key);
      const damaged = JSON.parse(validRaw);
      damaged.editor.definition.name = 'Private damaged draft';
      damaged.editor.definition[field] = records;
      const damagedRaw = JSON.stringify(damaged);
      f.w.localStorage.setItem(key, damagedRaw);
      f.w.showMapStudioDraftRecovery(damaged);
      const references = {
        definition: f.w.editorDefinition, resources: f.w.editorResourceNodes,
        triggers: f.w.editorTriggers, events: f.w.editorScenarioEvents,
        ground: f.w.editorGroundMaterials, cells: f.w.editorCellMaterials,
        levels: f.w.editorGroundLevels, elevations: f.w.editorCellElevations,
      };
      const before = {
        form: formState.capture(), match: f.copy(f.w.mapDefinition),
        definition: f.copy(f.w.editorDefinition),
        grids: [f.w.editorGroundMaterials, f.w.editorCellMaterials, f.w.editorGroundLevels, f.w.editorCellElevations]
          .map(grid => [...grid]),
        selectedRegion: f.w.selectedEditorRegionId, tool: f.w.editorTool,
        redraws: f.w.redraws, savedAt: f.w.lastDraftSavedAt(),
        dirty: f.w.editorDraftDirty, status: f.w.ui.studioDraftStatus.textContent,
        history: [...f.w.scenarioEditHistory.states], historyIndex: f.w.scenarioEditHistory.index,
        timers: [...f.timers],
      };
      f.click('studio-draft-restore');
      assert.equal(f.w.editorDefinition, references.definition);
      assert.equal(f.w.editorResourceNodes, references.resources);
      assert.equal(f.w.editorTriggers, references.triggers);
      assert.equal(f.w.editorScenarioEvents, references.events);
      assert.equal(f.w.editorGroundMaterials, references.ground);
      assert.equal(f.w.editorCellMaterials, references.cells);
      assert.equal(f.w.editorGroundLevels, references.levels);
      assert.equal(f.w.editorCellElevations, references.elevations);
      assert.deepEqual(f.copy(f.w.editorDefinition), before.definition);
      assert.deepEqual([f.w.editorGroundMaterials, f.w.editorCellMaterials, f.w.editorGroundLevels, f.w.editorCellElevations]
        .map(grid => [...grid]), before.grids);
      assert.equal(f.w.selectedEditorRegionId, before.selectedRegion);
      assert.equal(f.w.editorTool, before.tool);
      assert.deepEqual(formState.capture(), before.form);
      assert.deepEqual(f.copy(f.w.mapDefinition), before.match);
      assert.equal(f.w.redraws, before.redraws);
      assert.equal(f.w.lastDraftSavedAt(), before.savedAt);
      assert.equal(f.w.editorDraftDirty, before.dirty);
      assert.equal(f.w.ui.studioDraftStatus.textContent, before.status);
      assert.deepEqual(f.w.scenarioEditHistory.states, before.history);
      assert.equal(f.w.scenarioEditHistory.index, before.historyIndex);
      assert.deepEqual([...f.timers], before.timers);
      assert.equal(f.w.ui.studioDraftRecoveryMessage.textContent, message);
      assert.equal(f.w.ui.studioDraftRecovery.hidden, false);
      assert.equal(f.w.ui.mapStudioLayout.inert, true);
      assert.equal(f.w.localStorage.getItem(key), damagedRaw);
      const repaired = JSON.parse(validRaw);
      repaired.editor.definition[field] = [record, { ...record, column: 5 }];
      const repairedRaw = JSON.stringify(repaired);
      f.w.localStorage.setItem(key, repairedRaw);
      f.click('studio-draft-restore');
      assert.equal(f.w.ui.studioName.value, 'Retained local edit');
      assert.equal(f.w.ui.studioDraftRecovery.hidden, true);
      assert.equal(f.w.localStorage.getItem(key), repairedRaw);
      assert.deepEqual(f.copy(f.w.editorDefinition[field]), repaired.editor.definition[field]);
      f.flush();
      assert.equal(JSON.parse(f.w.localStorage.getItem(key)).editor.definition.name, 'Retained local edit');
    });
  }

  test(`null-entry preflight preserves unfinished non-null ${field} references and rejects serialized holes`, () => {
    for (const records of [[], [record], [{}], [{ id: 'unfinished' }], [false, 0, '', 'unfinished']]) {
      const draft = draftFor({ ...minimalDefinition(), [field]: records });
      const before = structuredClone(draft);
      const recovered = requireRecovery(draft, 'source');
      assert.equal(recovered.state, draft.editor);
      assert.equal(recovered.definition, draft.editor.definition);
      assert.equal(recovered.definition[field], records);
      assert.deepEqual(draft, before);
    }
    for (const records of [[null], [record, null], [undefined], new Array(1)]) {
      const draft = JSON.parse(JSON.stringify(draftFor({ ...minimalDefinition(), [field]: records })));
      const before = structuredClone(draft);
      assert.throws(() => requireRecovery(draft, 'source'), { name: 'Error', message });
      assert.deepEqual(draft, before);
    }
  });

  test(`null-entry preflight retains unexpected ${field} element getter fault identity`, () => {
    const failure = new Error('Private unexpected element access detail');
    const records = [];
    Object.defineProperty(records, 0, { get() { throw failure; } });
    assert.throws(() => requireRecovery(draftFor({ ...minimalDefinition(), [field]: records }), 'source'),
      error => error === failure);
  });
}

test('null-entry preflight retains envelope, collection, elevation, terrain and obstacle ordering', () => {
  const terrainMessage = nullEntryCases[0][2], obstacleMessage = nullEntryCases[1][2];
  const definition = { ...minimalDefinition(), terrainPatches: [null], obstacles: [null] };
  for (const invalid of [
    { ...draftFor(definition), version: 2 },
    { ...draftFor(definition), sourceMapId: 'foreign' },
    draftFor({ ...definition, width: 15 }),
    draftFor({ ...definition, resourceNodes: {} }),
  ]) assert.throws(() => requireRecovery(invalid, 'source'), { message: recoveryMessage });
  assert.throws(() => requireRecovery(draftFor({ ...definition, elevationPatches: {} }), 'source'),
    { message: 'Invalid elevation patches: shape.' });
  assert.throws(() => requireRecovery(draftFor(definition), 'source'), { message: terrainMessage });
  assert.throws(() => requireRecovery(draftFor({ ...definition, terrainPatches: [] }), 'source'),
    { message: obstacleMessage });
  const failure = new Error('Private unexpected later obstacle detail'), obstacles = [];
  Object.defineProperty(obstacles, 0, { get() { throw failure; } });
  assert.throws(() => requireRecovery(draftFor({ ...definition, obstacles }), 'source'),
    { message: terrainMessage });
});

const selectorEntryCases = [
  ['triggers', 'selectedTriggerId', {
    id: 'capture-zone-1', type: 'capture-zone', name: 'Capture point',
    zone: { column: 2, row: 2, width: 2, height: 2 }, requiredUnits: 8,
    captureSeconds: 3.5, foodReward: 0, victory: false,
  }, 'Map contains an invalid capture-zone trigger.'],
  ['scenarioEvents', 'selectedScenarioEventId', {
    id: 'supply-1', type: 'timed-supply', name: 'Supply', afterSeconds: 30,
    team: 'both', foodReward: 100,
  }, 'Map contains an invalid timed supply event.'],
  ['resourceNodes', 'selectedResourceId', {
    id: 'food', type: 'food', x: 0.5, z: 0.5, stock: 300,
  }, 'Map has an invalid, duplicate, out-of-bounds or unsupported resource node.'],
];

function selectorRecoverySnapshot(f, formState) {
  const names = ['editorDefinition', 'editorResourceNodes', 'editorTriggers', 'editorScenarioEvents',
    'editorGroundMaterials', 'editorCellMaterials', 'editorGroundLevels', 'editorCellElevations'];
  return {
    references: Object.fromEntries(names.map(name => [name, f.w[name]])),
    values: {
      definition: f.copy(f.w.editorDefinition), resources: f.copy(f.w.editorResourceNodes),
      triggers: f.copy(f.w.editorTriggers), events: f.copy(f.w.editorScenarioEvents),
      grids: names.slice(4).map(name => [...f.w[name]]),
      form: formState.capture(), match: f.copy(f.w.mapDefinition),
      selectedIds: [f.w.selectedEditorTriggerId, f.w.selectedEditorScenarioEventId,
        f.w.selectedEditorResourceId, f.w.selectedEditorRegionId],
      tool: f.w.editorTool, history: [...f.w.scenarioEditHistory.states],
      historyIndex: f.w.scenarioEditHistory.index,
      canUndo: f.w.scenarioEditHistory.canUndo, canRedo: f.w.scenarioEditHistory.canRedo,
      redraws: f.w.redraws, savedAt: f.w.lastDraftSavedAt(),
      dirty: f.w.editorDraftDirty, status: f.w.ui.studioDraftStatus.textContent,
      timers: [...f.timers], stored: f.saved(),
    },
  };
}

function assertSelectorRecoveryUnchanged(f, formState, before) {
  for (const [name, reference] of Object.entries(before.references)) assert.equal(f.w[name], reference, name);
  assert.deepEqual(selectorRecoverySnapshot(f, formState).values, before.values);
}

for (const [field, selectedKey, record, message] of selectorEntryCases) {
  for (const [name, records] of [
    ['single null', [null]], ['null before selected record', [null, record]],
    ['null after selected record', [record, null]],
  ]) {
    test(`actual Restore rejects ${field} ${name} without losing undo/redo and supports repair/retry`, t => {
      const f = mapStudioDraftFixture(t);
      const formState = createMapStudioFormState({ root: f.w.ui.mapStudio, document: f.d });
      f.open(); f.edit('studio-name', 'Retained local edit'); f.flush();
      const key = f.w.editorDraftStorageKey, validRaw = f.w.localStorage.getItem(key);
      const damaged = JSON.parse(validRaw);
      damaged.editor.definition.name = 'Private damaged draft';
      damaged.editor.definition[field] = records;
      damaged.editor[selectedKey] = record.id;
      const damagedRaw = JSON.stringify(damaged);
      f.w.localStorage.setItem(key, damagedRaw); f.w.showMapStudioDraftRecovery(damaged);
      const history = f.w.scenarioEditHistory;
      history.record({ ...f.w.scenarioEditorState(), regionId: 'retained-first' });
      history.record({ ...f.w.scenarioEditorState(), regionId: 'retained-second' });
      history.undo();
      assert.equal(history.canUndo, true); assert.equal(history.canRedo, true);
      const before = selectorRecoverySnapshot(f, formState);
      f.click('studio-draft-restore');
      assertSelectorRecoveryUnchanged(f, formState, before);
      assert.equal(f.w.ui.studioDraftRecoveryMessage.textContent, message);
      assert.equal(f.w.ui.studioDraftRecovery.hidden, false);
      assert.equal(f.w.ui.mapStudioLayout.inert, true);
      assert.equal(f.w.localStorage.getItem(key), damagedRaw);
      const repaired = JSON.parse(validRaw);
      repaired.editor.definition[field] = [record, { ...record, id: `${record.id}-second` }];
      repaired.editor[selectedKey] = record.id;
      const repairedRaw = JSON.stringify(repaired);
      f.w.localStorage.setItem(key, repairedRaw); f.click('studio-draft-restore');
      assert.equal(f.w.ui.studioName.value, 'Retained local edit');
      assert.equal(f.w.ui.studioDraftRecovery.hidden, true);
      assert.equal(f.w.ui.mapStudioLayout.inert, false);
      assert.equal(f.w.localStorage.getItem(key), repairedRaw);
      assert.deepEqual(f.copy(f.w.editorDefinition[field]), repaired.editor.definition[field]);
      assert.deepEqual(f.copy(f.w[`editor${field === 'triggers' ? 'Triggers'
        : field === 'scenarioEvents' ? 'ScenarioEvents' : 'ResourceNodes'}`]), repaired.editor.definition[field]);
      f.flush();
      const saved = JSON.parse(f.w.localStorage.getItem(key));
      assert.equal(saved.editor.definition.name, 'Retained local edit');
      assert.deepEqual(saved.editor.definition[field], repaired.editor.definition[field]);
    });
  }

  test(`selector-entry preflight preserves unfinished ${field} and rejects persisted nulls/holes`, () => {
    for (const records of [undefined, null, false, 0, '', [], [record], [{}], [{ id: 'unfinished' }],
      [false, 0, '', 'unfinished']]) {
      const draft = draftFor({ ...minimalDefinition(), [field]: records });
      const before = structuredClone(draft);
      const recovered = requireRecovery(draft, 'source');
      assert.equal(recovered.state, draft.editor); assert.equal(recovered.definition, draft.editor.definition);
      assert.equal(recovered.definition[field], records); assert.deepEqual(draft, before);
    }
    for (const records of [[null], [null, record], [record, null], [undefined], new Array(1)]) {
      const draft = JSON.parse(JSON.stringify(draftFor({ ...minimalDefinition(), [field]: records })));
      const before = structuredClone(draft);
      assert.throws(() => requireRecovery(draft, 'source'), { name: 'Error', message });
      assert.deepEqual(draft, before);
    }
  });

  test(`selector-entry preflight retains unexpected ${field} element getter identity`, () => {
    const failure = new Error('Private unexpected element detail'), records = [];
    Object.defineProperty(records, 0, { get() { throw failure; } });
    assert.throws(() => requireRecovery(draftFor({ ...minimalDefinition(), [field]: records }), 'source'),
      error => error === failure);
  });

  test(`actual import rejects null ${field} with the existing diagnostic before mutation`, async t => {
    const f = mapStudioDraftFixture(t);
    const formState = createMapStudioFormState({ root: f.w.ui.mapStudio, document: f.d });
    f.open(); f.edit('studio-name', 'Retained local edit'); f.flush();
    const input = f.copy(f.w.collectEditorMap()); input[field] = [null];
    const before = selectorRecoverySnapshot(f, formState);
    await assert.rejects(f.w.importEditorMap({ size: 10, text: async () => JSON.stringify(input) }),
      { name: 'Error', message });
    assertSelectorRecoveryUnchanged(f, formState, before);
    assert.equal(f.w.ui.studioDraftRecovery.hidden, true);
  });
}

test('selector-entry preflight retains earlier checks and trigger/event/resource diagnostic priority', () => {
  const definition = { ...minimalDefinition(), triggers: [null], scenarioEvents: [null], resourceNodes: [null] };
  for (const invalid of [
    { ...draftFor(definition), version: 2 }, draftFor({ ...definition, width: 15 }),
    draftFor({ ...definition, terrainPatches: {} }),
  ]) assert.throws(() => requireRecovery(invalid, 'source'), { message: recoveryMessage });
  for (const [overrides, message] of [
    [{ elevationPatches: {} }, 'Invalid elevation patches: shape.'],
    [{ terrainPatches: [null] }, nullEntryCases[0][2]],
    [{ obstacles: [null] }, nullEntryCases[1][2]],
    [{}, selectorEntryCases[0][3]],
    [{ triggers: [] }, selectorEntryCases[1][3]],
    [{ triggers: [], scenarioEvents: [] }, selectorEntryCases[2][3]],
  ]) assert.throws(() => requireRecovery(draftFor({ ...definition, ...overrides }), 'source'), { message });
  const failure = new Error('Private later collection detail');
  for (const [first, later, message] of [
    ['triggers', 'scenarioEvents', selectorEntryCases[0][3]],
    ['triggers', 'resourceNodes', selectorEntryCases[0][3]],
    ['scenarioEvents', 'resourceNodes', selectorEntryCases[1][3]],
  ]) {
    const records = []; Object.defineProperty(records, 0, { get() { throw failure; } });
    assert.throws(() => requireRecovery(draftFor({ ...minimalDefinition(), [first]: [null], [later]: records }),
      'source'), { message });
  }
});

test('actual Restore rejects null formValues before mutation and supports incomplete-form repair/retry', t => {
  const f = mapStudioDraftFixture(t);
  const formState = createMapStudioFormState({ root: f.w.ui.mapStudio, document: f.d });
  f.open(); f.edit('studio-name', 'Retained local edit');
  f.edit('studio-objective-name', 'Retained pending objective'); f.flush();
  const key = f.w.editorDraftStorageKey, validRaw = f.w.localStorage.getItem(key);
  const damaged = JSON.parse(validRaw);
  damaged.editor.definition.name = 'Private damaged draft';
  damaged.editor.formValues = null;
  const damagedRaw = JSON.stringify(damaged);
  f.w.localStorage.setItem(key, damagedRaw); f.w.showMapStudioDraftRecovery(damaged);
  const history = f.w.scenarioEditHistory;
  history.record({ ...f.w.scenarioEditorState(), regionId: 'retained-first' });
  history.record({ ...f.w.scenarioEditorState(), regionId: 'retained-second' }); history.undo();
  assert.equal(history.canUndo, true); assert.equal(history.canRedo, true);
  const before = selectorRecoverySnapshot(f, formState);
  f.click('studio-draft-restore');
  assertSelectorRecoveryUnchanged(f, formState, before);
  assert.equal(f.w.ui.studioDraftRecoveryMessage.textContent, recoveryMessage);
  assert.equal(f.w.ui.studioDraftRecovery.hidden, false);
  assert.equal(f.w.ui.mapStudioLayout.inert, true);
  assert.equal(f.w.localStorage.getItem(key), damagedRaw);
  const repaired = JSON.parse(validRaw);
  repaired.editor.formValues = {
    'studio-name': { value: 'Retained local edit' },
    'studio-objective-name': { value: 'Unfinished pending objective' },
    'studio-required-units': { value: '' }, 'studio-regions': { value: '[unfinished' },
  };
  const repairedRaw = JSON.stringify(repaired);
  f.w.localStorage.setItem(key, repairedRaw); f.click('studio-draft-restore');
  assert.equal(f.w.ui.studioDraftRecovery.hidden, true);
  assert.equal(f.w.ui.mapStudioLayout.inert, false);
  assert.equal(f.w.ui.studioName.value, 'Retained local edit');
  assert.equal(f.w.ui.studioObjectiveName.value, 'Unfinished pending objective');
  assert.equal(f.w.ui.studioRequiredUnits.value, '');
  assert.equal(f.w.ui.studioRegions.value, '[unfinished');
  assert.equal(f.w.localStorage.getItem(key), repairedRaw);
  f.flush();
  const saved = JSON.parse(f.w.localStorage.getItem(key));
  assert.equal(saved.editor.formValues['studio-objective-name'].value, 'Unfinished pending objective');
  assert.equal(saved.editor.formValues['studio-required-units'].value, '');
  assert.equal(saved.editor.formValues['studio-regions'].value, '[unfinished');
});

const successfulFormContainers = [
  ['absent', undefined], ['false', false], ['true', true], ['zero', 0], ['number', 3],
  ['empty string', ''], ['string', 'Existing empty-snapshot behavior'],
  ['empty array', []], ['null array', [null]],
  ['field-object array', [{ value: 'Ignored numeric key' }]],
  ['key/value-pair array', [['studio-name', { value: 'Ignored numeric key' }]]],
  ['empty object', {}],
  ['partial object', { 'studio-name': { value: 'Recovered partial form' } }],
  ['unfinished object', { 'studio-name': { value: '' }, 'studio-regions': { value: '[unfinished' } }],
  ['incomplete field entries', { 'studio-name': null, 'studio-summary': { value: 3 },
    'studio-required-units': [], 'studio-fog-of-war': { checked: 'true' },
    'studio-missing-control': { value: 'Ignored unknown key' } }],
];

for (const [name, formValues] of successfulFormContainers) {
  test(`actual Restore retains successful ${name} formValues recovery and capture/save behavior`, t => {
    const f = mapStudioDraftFixture(t);
    f.open(); f.edit('studio-name', 'Saved definition name'); f.flush();
    const key = f.w.editorDraftStorageKey, draft = JSON.parse(f.w.localStorage.getItem(key));
    if (formValues === undefined) delete draft.editor.formValues; else draft.editor.formValues = formValues;
    const raw = JSON.stringify(draft), persisted = JSON.parse(raw);
    const recovered = requireRecovery(persisted, 'draft-source');
    assert.equal(recovered.state, persisted.editor); assert.equal(recovered.definition, persisted.editor.definition);
    assert.equal(recovered.state.formValues, persisted.editor.formValues);
    const before = structuredClone(persisted);
    f.w.localStorage.setItem(key, raw); f.w.showMapStudioDraftRecovery(persisted);
    f.click('studio-draft-restore');
    assert.equal(f.w.ui.studioDraftRecovery.hidden, true);
    assert.equal(f.w.ui.mapStudioLayout.inert, false);
    assert.equal(f.w.ui.studioName.value, name === 'partial object' ? 'Recovered partial form'
      : name === 'unfinished object' ? '' : 'Saved definition name');
    if (name === 'unfinished object') assert.equal(f.w.ui.studioRegions.value, '[unfinished');
    assert.deepEqual(persisted, before);
    assert.equal(f.w.localStorage.getItem(key), raw);
    assert.equal(f.w.editorDraftDirty, true);
    assert.ok([...f.timers.values()].some(timer => timer.delay === 160));
    f.flush();
    const saved = JSON.parse(f.w.localStorage.getItem(key));
    assert.equal(Array.isArray(saved.editor.formValues), false);
    assert.equal(typeof saved.editor.formValues, 'object');
    assert.notEqual(saved.editor.formValues, null);
    assert.equal(saved.editor.formValues['studio-name'].value, f.w.ui.studioName.value);
    if (name === 'unfinished object') assert.equal(saved.editor.formValues['studio-regions'].value, '[unfinished');
  });
}

test('null formValues preflight preserves explicit undefined and earlier diagnostics/getter identity', () => {
  const draft = draftFor(minimalDefinition()); draft.editor.formValues = undefined;
  const recovered = requireRecovery(draft, 'source');
  assert.equal(recovered.state, draft.editor); assert.equal(Object.hasOwn(recovered.state, 'formValues'), true);
  assert.equal(recovered.state.formValues, undefined);
  const invalid = draftFor(minimalDefinition()); invalid.editor.formValues = null;
  const before = structuredClone(invalid);
  assert.throws(() => requireRecovery(invalid, 'source'), { name: 'Error', message: recoveryMessage });
  assert.deepEqual(invalid, before);
  const failure = new Error('Private unexpected form envelope detail');
  for (const [definition, message] of [
    [{ ...minimalDefinition(), width: 15 }, recoveryMessage],
    [{ ...minimalDefinition(), resourceNodes: {} }, recoveryMessage],
    [{ ...minimalDefinition(), elevationPatches: {} }, 'Invalid elevation patches: shape.'],
    [{ ...minimalDefinition(), terrainPatches: [null] }, nullEntryCases[0][2]],
    [{ ...minimalDefinition(), obstacles: [null] }, nullEntryCases[1][2]],
    ...selectorEntryCases.map(([field, , , message]) => [{ ...minimalDefinition(), [field]: [null] }, message]),
  ]) {
    const earlier = draftFor(definition); let reads = 0;
    Object.defineProperty(earlier.editor, 'formValues', { get() { reads++; throw failure; } });
    assert.throws(() => requireRecovery(earlier, 'source'), { message });
    assert.equal(reads, 0);
  }
  const unexpected = draftFor(minimalDefinition());
  Object.defineProperty(unexpected.editor, 'formValues', { get() { throw failure; } });
  assert.throws(() => requireRecovery(unexpected, 'source'), error => error === failure);
  const entries = {};
  Object.defineProperty(entries, 'studio-name', { enumerable: true, get() { throw failure; } });
  const opaque = draftFor(minimalDefinition()); opaque.editor.formValues = entries;
  assert.equal(requireRecovery(opaque, 'source').state.formValues, entries);
});
