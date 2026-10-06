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
