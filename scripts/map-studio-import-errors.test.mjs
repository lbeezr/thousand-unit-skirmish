import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createMapStudioFormState } from '../src/authoring/map-studio-form-state.mjs';
import { mapStudioDraftFixture } from './fixtures/map-studio-draft-fixture.mjs';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const readMessage = 'Map file could not be read. Choose the file again and retry.';
const syntaxMessage = 'That file is not valid JSON.';
const referenceFields = ['editorDefinition', 'editorResourceNodes', 'editorTriggers', 'editorScenarioEvents',
  'editorGroundMaterials', 'editorCellMaterials', 'editorGroundLevels', 'editorCellElevations'];

function fixture(t) {
  const f = mapStudioDraftFixture(t);
  f.open();
  f.edit('studio-name', 'Retained local import edit');
  f.flush();
  f.formState = createMapStudioFormState({ root: f.w.ui.mapStudio, document: f.d });
  return f;
}

function capture(f) {
  return {
    references: referenceFields.map(field => f.w[field]),
    values: referenceFields.map(field => f.copy(f.w[field])),
    form: f.formState.capture(), match: f.copy(f.w.mapDefinition), saved: f.saved(),
    history: [...f.w.scenarioEditHistory.states], historyIndex: f.w.scenarioEditHistory.index,
    timers: [...f.timers], redraws: f.w.redraws, dirty: f.w.editorDraftDirty,
    savedAt: f.w.lastDraftSavedAt(), storageKey: f.w.editorDraftStorageKey,
    sourceMapId: f.w.editorDraftSourceMapId, status: f.w.ui.studioDraftStatus.textContent,
  };
}

function assertPreserved(f, before, { bubblingChange = false } = {}) {
  for (const [index, field] of referenceFields.entries()) assert.equal(f.w[field], before.references[index], field);
  const after = capture(f);
  if (bubblingChange) {
    // The real dialog listener schedules a draft write for an input change, even
    // when import fails. That existing lifecycle belongs to the host.
    assert.equal(after.dirty, true);
    assert.equal(after.timers.length, 1);
    assert.equal(after.timers[0][1].delay, 160);
    assert.equal(after.status, 'SAVING DRAFT…');
    after.dirty = before.dirty;
    after.timers = before.timers;
    after.status = before.status;
  }
  assert.deepEqual(after, before);
}

function mountInputHandler(f) {
  const start = source.indexOf("ui.studioImportFile.addEventListener('change', async () => {");
  const end = source.indexOf("document.querySelector('#studio-width').addEventListener", start);
  assert.ok(start >= 0 && end > start, 'Production file input handler');
  f.w.eval(source.slice(start, end));
}

async function chooseFile(f, file) {
  Object.defineProperty(f.w.ui.studioImportFile, 'files', { value: file ? [file] : [], configurable: true });
  f.w.ui.studioImportFile.dispatchEvent(new f.w.Event('change', { bubbles: true }));
  await new Promise(setImmediate);
  assert.equal(f.w.ui.studioImportFile.value, '');
}

for (const name of ['NotFoundError', 'NotReadableError', 'SecurityError']) {
  test(`actual map import retains native ${name} cause with safe read feedback and no state changes`, async t => {
    const f = fixture(t), before = capture(f), status = f.w.ui.studioMessage.textContent;
    const original = new f.w.DOMException('Private path, contents and token detail', name);
    let reads = 0, parses = 0;
    f.w.JSON.parse = () => { parses++; throw new Error('Reading must succeed before parsing'); };
    await assert.rejects(f.w.importEditorMap({ name: 'private-path.json', size: 900_000,
      text: async () => { reads++; throw original; } }), error => {
      assert.equal(error.message, readMessage);
      assert.equal(error.cause, original);
      return true;
    });
    assert.equal(reads, 1); assert.equal(parses, 0);
    assert.equal(f.w.ui.studioMessage.textContent, status);
    assertPreserved(f, before);
  });

  test(`actual bubbling file-input handler displays safe ${name} feedback and retains draft scheduling`, async t => {
    const f = fixture(t), before = capture(f);
    mountInputHandler(f);
    await chooseFile(f, { name: 'private-path.json', size: 1,
      text: async () => { throw new f.w.DOMException('Private path, contents and token detail', name); } });
    assert.equal(f.w.ui.studioMessage.textContent, readMessage);
    assertPreserved(f, before, { bubblingChange: true });
  });
}

for (const fault of ['TypeError', 'spoofed-native-name', 'unexpected-DOMException']) {
  test(`actual map import preserves unexpected read ${fault} identity`, async t => {
    const f = fixture(t), before = capture(f);
    const original = fault === 'TypeError' ? new f.w.TypeError('Unexpected reader defect')
      : fault === 'spoofed-native-name' ? Object.assign(new f.w.Error('Unexpected reader defect'), { name: 'NotReadableError' })
        : new f.w.DOMException('Unexpected reader defect', 'InvalidStateError');
    await assert.rejects(f.w.importEditorMap({ name: 'map.json', size: 1, text: async () => { throw original; } }),
      error => error === original);
    assertPreserved(f, before);
  });
}

test('actual map import keeps malformed JSON wording, syntax cause and state', async t => {
  const f = fixture(t), before = capture(f), parse = f.w.JSON.parse;
  let original;
  f.w.JSON.parse = text => { try { return parse(text); } catch (error) { original = error; throw error; } };
  await assert.rejects(f.w.importEditorMap({ name: 'private-path.json', size: 1,
    text: async () => '{ private file contents' }), error => {
    assert.equal(error.message, syntaxMessage);
    assert.equal(error.cause, original);
    assert.ok(original instanceof f.w.SyntaxError);
    return true;
  });
  assertPreserved(f, before);
});

test('actual bubbling file-input handler preserves malformed JSON feedback and draft scheduling', async t => {
  const f = fixture(t), before = capture(f);
  mountInputHandler(f);
  await chooseFile(f, { name: 'private-path.json', size: 1, text: async () => '{ private file contents' });
  assert.equal(f.w.ui.studioMessage.textContent, syntaxMessage);
  assertPreserved(f, before, { bubblingChange: true });
});

for (const fault of ['TypeError', 'spoofed-syntax-name']) {
  test(`actual map import preserves unexpected parse ${fault} identity`, async t => {
    const f = fixture(t), before = capture(f);
    const original = fault === 'TypeError' ? new f.w.TypeError('Unexpected parser defect')
      : Object.assign(new f.w.Error('Unexpected parser defect'), { name: 'SyntaxError' });
    f.w.JSON.parse = () => { throw original; };
    await assert.rejects(f.w.importEditorMap({ name: 'map.json', size: 1, text: async () => '{}' }), error => error === original);
    assertPreserved(f, before);
  });
}

test('actual map import rejects oversized input before reading or parsing', async t => {
  const f = fixture(t), before = capture(f);
  let reads = 0;
  await assert.rejects(f.w.importEditorMap({ name: 'large.json', size: 900_001,
    text: async () => { reads++; return '{}'; } }), { message: 'Map JSON must be smaller than 900 KB so it can be sent safely.' });
  assert.equal(reads, 0);
  assertPreserved(f, before);
});

test('actual map import retains schema validation order and feedback without changing state', async t => {
  const f = fixture(t), before = capture(f);
  await assert.rejects(f.w.importEditorMap({ name: 'invalid.json', size: 1,
    text: async () => JSON.stringify({ fogOfWar: 'bad', id: 'bad id' }) }), { message: 'Fog of war must be enabled or disabled.' });
  assertPreserved(f, before);
});

test('actual file-input handler supports explicit read repair/retry and unchanged successful import', async t => {
  const f = fixture(t);
  mountInputHandler(f);
  let reads = 0, failed = true;
  const definition = f.copy(f.w.mapDefinition);
  definition.id = 'import-retry'; definition.name = 'IMPORTED RETRY';
  const file = { name: 'retry.json', size: 1, text: async () => {
    reads++;
    if (failed) throw new f.w.DOMException('Private detail', 'NotReadableError');
    return JSON.stringify(definition);
  } };
  const before = capture(f);
  await chooseFile(f, file);
  assert.equal(f.w.ui.studioMessage.textContent, readMessage);
  assertPreserved(f, before, { bubblingChange: true });
  failed = false;
  assert.equal(reads, 1, 'Repair alone does not retry');
  await chooseFile(f, file);
  assert.equal(reads, 2);
  assert.equal(f.w.editorDefinition.id, 'import-retry');
  assert.equal(f.w.ui.studioName.value, 'IMPORTED RETRY');
  assert.equal(f.w.ui.studioMessage.textContent, 'Loaded retry.json. Review the map ID, then publish it to the room when ready.');
  assert.equal(f.w.redraws, before.redraws + 1);
  assert.equal(f.timers.size, 1);
  assert.deepEqual(f.saved(), before.saved);
  f.flush();
  const saved = JSON.parse(f.w.localStorage.getItem(f.w.editorDraftStorageKey));
  assert.equal(saved.editor.definition.id, 'import-retry');
  assert.equal(saved.editor.definition.name, 'IMPORTED RETRY');
  assert.deepEqual(f.copy(f.w.mapDefinition), before.match);
});
