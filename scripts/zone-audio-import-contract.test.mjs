import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {validateZoneAudioImportMetadata} from './zone-audio-import-contract.mjs';

const catalog = JSON.parse(await readFile(new URL('../assets/audio/vaelora-zones-v1/catalog.json', import.meta.url), 'utf8'));

test('all 44 current catalog records pass the shared Audio Studio import contract without mutation', () => {
  const original = structuredClone(catalog);
  const pack = validateZoneAudioImportMetadata(catalog);
  assert.equal(pack.sources.length, 44);
  assert.deepEqual(pack.compositions, []); assert.deepEqual(pack.profiles, []);
  for (const [index, source] of catalog.sources.entries()) {
    const imported = pack.sources[index];
    assert.equal(imported.id, source.id);
    assert.equal(imported.fileName, source.file.split('/').at(-1));
    assert.equal(imported.provenance.model, source.model);
    assert.equal(imported.provenance.createdAt, source.downloadedOn);
    assert.equal(imported.provenance.prompt, source.prompt);
    assert.equal(imported.provenance.attribution, `Flow node ${source.nodeId}; see repository catalog for hashes and settings`);
  }
  assert.deepEqual(catalog, original, 'validation preserves the source evidence');
});

for (const field of ['model', 'downloadedOn']) {
  test(`missing or invalid ${field} is rejected with the actionable catalog field and shared import limit`, () => {
    for (const value of [undefined, null, '', '   ', 12, {}, 'x'.repeat(401)]) {
      const candidate = structuredClone(catalog);
      if (value === undefined) delete candidate.sources[0][field];
      else candidate.sources[0][field] = value;
      assert.throws(() => validateZoneAudioImportMetadata(candidate), error => {
        assert.ok(error.message.startsWith(`catalog.sources[0].${field}:`), error.message);
        assert.match(error.message, /non-empty text of at most 400 characters/);
        assert.match(error.cause.message, new RegExp(`provenance\\.${field === 'model' ? 'model' : 'createdAt'}:`));
        return true;
      });
    }
  });
  test(`${field} follows the shared text boundary without inventing a stricter metadata format`, () => {
    const candidate = structuredClone(catalog);
    candidate.sources[0][field] = 'x'.repeat(400);
    const pack = validateZoneAudioImportMetadata(candidate);
    assert.equal(pack.sources[0].provenance[field === 'model' ? 'model' : 'createdAt'], 'x'.repeat(400));
  });
}
