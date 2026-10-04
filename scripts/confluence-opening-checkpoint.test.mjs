// Declared invalid-checkpoint fixtures exercise intact authority functions.
// Authentic unedited paid room files are proved separately by the native CLI.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { createPveHeadlessFixture } from './pve-headless-fixture.mjs';
import { CONFLUENCE_PRE_OPENING_MAP_HASH } from '../src/confluence-opening-compat.mjs';
const old = JSON.parse(gunzipSync(readFileSync(new URL('../docs/qa-evidence/confluence-grounds-2026-10-04/retained-economy.json.gz', import.meta.url)))).mapDefinition;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('base64url');
const node = rows => rows.find(n => n.id === 's0-berries');

test('real restore boundary accepts exact historical map and rejects corruption before changing the world', async () => {
  const fixture = await createPveHeadlessFixture(old, { matchModeId: 'authored', matchModeVersion: 1 });
  const replay = fixture.replay;
  try {
    const valid = replay.checkpoint();
    assert.equal(valid.mapHash, CONFLUENCE_PRE_OPENING_MAP_HASH);
    replay.restore(valid);
    const live = replay.checkpoint();
    assert.equal(live.mapHash, valid.mapHash);
    assert.deepEqual(live.mapDefinition, valid.mapDefinition);
    for (const field of ['teamFood', 'teamWood', 'teamStone', 'resourceNodes', 'buildings', 'units', 'explored'])
      assert.deepEqual(live.state[field], valid.state[field]);
    const cases = [
      ['forged checksum', s => { s.mapHash = 'forged'; }, /map checksum mismatch/],
      ['runtime overstock', s => { node(s.state.resourceNodes).stock++; }, /invalid resource node state/],
      ['invalid cargo', s => { s.state.units.find(u => u.kind === 'worker').cargo = 1000; }, /invalid unit work state/],
      ['invalid route', s => { s.state.units[0].path = [s.mapDefinition.width * s.mapDefinition.height]; }, /invalid unit route/],
      ['unknown authored seed', s => { s.mapDefinition.terrainSeed++; }, /shipped map changed since checkpoint/],
      ['another shipped ID', s => { s.mapDefinition.id = 'veyrholds-terraced-vale'; }, /shipped map changed since checkpoint/],
      ['changed authored stock', s => { node(s.mapDefinition.resourceNodes).stock++; node(s.state.resourceNodes).stock++; }, /shipped map changed since checkpoint/],
      ['changed authored ID', s => { node(s.mapDefinition.resourceNodes).id = node(s.state.resourceNodes).id = 's0-renamed-berries'; }, /shipped map changed since checkpoint/],
      ['changed authored type', s => { node(s.mapDefinition.resourceNodes).type = node(s.state.resourceNodes).type = 'wood'; }, /shipped map changed since checkpoint/],
      ['extra relocated resource', s => { node(s.mapDefinition.resourceNodes).z--; node(s.state.resourceNodes).z--; }, /shipped map changed since checkpoint/],
    ];
    for (const [label, change, error] of cases) {
      const invalid = structuredClone(valid); change(invalid);
      if (label !== 'forged checksum') invalid.mapHash = hash(invalid.mapDefinition);
      const unchanged = structuredClone(invalid), world = replay.checkpoint();
      assert.throws(() => replay.restore(invalid), error, label);
      assert.deepEqual(invalid, unchanged, `${label} leaves input unchanged`);
      assert.deepEqual(replay.checkpoint(), world, `${label} leaves active world unchanged`);
    }
  } finally { await fixture.dispose(); }
});
