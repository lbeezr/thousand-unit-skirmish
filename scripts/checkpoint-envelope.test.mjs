import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPveHeadlessFixture } from './pve-headless-fixture.mjs';

const map = JSON.parse(await readFile(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url), 'utf8'));
const hash = definition => createHash('sha256').update(JSON.stringify(definition)).digest('base64url');
function rejection(call) {
  try { call(); } catch (error) { return { name: error.name, message: error.message, code: error.code }; }
  assert.fail('expected the checkpoint to be rejected');
}

for (const mode of ['authored', 'skirmish']) test(`${mode}: private envelope agrees with actual authority and keeps canonical/effective maps distinct`, async () => {
  const fixture = await createPveHeadlessFixture(map, { matchModeId: mode, matchModeVersion: 1 });
  try {
    const r = fixture.replay, world = r.checkpoint(), snapshot = structuredClone(world);
    snapshot.mapDefinition.triggers[0].victory = true;
    snapshot.mapDefinition.victoryHoldSeconds = 12;
    snapshot.mapHash = hash(snapshot.mapDefinition);
    const before = JSON.stringify(snapshot), control = structuredClone(snapshot);
    const expected = r.validateCheckpoint(control), actual = r.checkpointEnvelope(snapshot);
    assert.deepEqual(Object.keys(actual), ['canonicalDefinition', 'effectiveDefinition', 'state', 'savedMatchMode']);
    assert.deepEqual(actual.canonicalDefinition, expected.definition);
    assert.deepEqual(actual.savedMatchMode, expected.savedMatchMode);
    assert.equal(actual.state, snapshot.state);
    assert.deepEqual(actual.state, expected.state);
    assert.notEqual(actual.canonicalDefinition, actual.effectiveDefinition);
    assert.equal(actual.canonicalDefinition.triggers[0].victory, true);
    assert.equal(actual.canonicalDefinition.victoryHoldSeconds, 12);
    assert.equal(actual.effectiveDefinition.triggers[0].victory, mode === 'authored');
    assert.equal(Object.hasOwn(actual.effectiveDefinition, 'victoryHoldSeconds'), mode === 'authored');
    assert.equal(JSON.stringify(snapshot), before, 'normalized inputs retain their bytes');
    assert.deepEqual(r.checkpoint(), world, 'validation does not activate or change authority state');
  } finally { await fixture.dispose(); }
});

test('map defaults and their checksum rejection retain actual authority input normalization', async () => {
  const fixture = await createPveHeadlessFixture(map, { matchModeId: 'skirmish', matchModeVersion: 1 });
  try {
    const r = fixture.replay, world = r.checkpoint();
    for (const validHash of [true, false]) {
      const snapshot = structuredClone(world);
      snapshot.mapDefinition.victoryMode = null;
      snapshot.mapDefinition.fogOfWar = null;
      snapshot.mapHash = validHash ? hash({ ...snapshot.mapDefinition, victoryMode: 'any', fogOfWar: false }) : '';
      const before = JSON.stringify(snapshot), control = structuredClone(snapshot);
      if (validHash) {
        const expected = r.validateCheckpoint(control), actual = r.checkpointEnvelope(snapshot);
        assert.deepEqual(actual.canonicalDefinition, expected.definition);
        assert.equal(actual.state, snapshot.state);
      } else {
        assert.deepEqual(rejection(() => r.checkpointEnvelope(snapshot)), rejection(() => r.validateCheckpoint(control)));
      }
      assert.equal(snapshot.mapDefinition.victoryMode, 'any');
      assert.equal(snapshot.mapDefinition.fogOfWar, false);
      assert.notEqual(JSON.stringify(snapshot), before, 'the existing adapter normalizes before checksum validation');
      assert.equal(JSON.stringify(snapshot), JSON.stringify(control));
      assert.deepEqual(r.checkpoint(), world);
    }
  } finally { await fixture.dispose(); }
});

test('envelope first errors match the real authority through map/mode/hash checks', async () => {
  const fixture = await createPveHeadlessFixture(map, { matchModeId: 'skirmish', matchModeVersion: 1 });
  try {
    const r = fixture.replay, world = r.checkpoint();
    const changes = [
      s => { s.schemaVersion = 29; s.rulesetRevision = 'wrong'; },
      s => { s.rulesetRevision = 'wrong'; s.factionId = 'wrong'; },
      s => { s.state.teamFood[0] = -1; s.factionId = 'wrong'; },
      s => { s.factionId = 'wrong'; s.rulesVersion = 99; },
      s => { s.rulesVersion = 99; s.sequence = 0; },
      s => { s.sequence = 0; s.savedAt = 0; },
      s => { s.savedAt = 0; s.matchId = ''; },
      s => { s.matchId = ''; s.mapDefinition.width = 15; },
      s => { s.mapDefinition.width = 15; s.matchModeId = 'unknown'; },
      s => { s.matchModeId = 'unknown'; s.mapHash = ''; },
      s => { s.matchModeId = 'bannerfall'; s.mapHash = ''; },
      s => { s.mapHash = ''; s.state.forestStocks = null; },
    ];
    for (const change of changes) {
      const snapshot = structuredClone(world); change(snapshot);
      const control = structuredClone(snapshot);
      assert.deepEqual(rejection(() => r.checkpointEnvelope(snapshot)), rejection(() => r.validateCheckpoint(control)));
      assert.equal(JSON.stringify(snapshot), JSON.stringify(control));
      assert.deepEqual(r.checkpoint(), world);
    }
    for (const value of [undefined, null, [], 'checkpoint', 30]) {
      assert.deepEqual(rejection(() => r.checkpointEnvelope(value)), rejection(() => r.validateCheckpoint(value)));
    }
  } finally { await fixture.dispose(); }
});

test('private envelope stops before host-owned domain-state validation', async () => {
  const fixture = await createPveHeadlessFixture(map, { matchModeId: 'skirmish', matchModeVersion: 1 });
  try {
    const r = fixture.replay, world = r.checkpoint(), snapshot = structuredClone(world);
    snapshot.state.forestStocks = null;
    assert.equal(r.checkpointEnvelope(snapshot).state, snapshot.state);
    assert.throws(() => r.validateCheckpoint(snapshot), { message: 'Invalid match checkpoint: invalid forest stock table' });
    assert.throws(() => r.restore(snapshot), { message: 'Invalid match checkpoint: invalid forest stock table' });
    assert.deepEqual(r.checkpoint(), world);
  } finally { await fixture.dispose(); }
});

test('XL envelope retains actual route/state/schema error ordering and codes', async () => {
  const fixture = await createPveHeadlessFixture(map, { matchModeId: 'skirmish', matchModeVersion: 1 });
  try {
    const r = fixture.replay, world = r.checkpoint();
    const cases = [
      [s => { s.state.units[0].path = [-1]; s.state.buildings = null; }, undefined],
      [s => { s.state.buildings = null; }, 'CHECKPOINT_REJECTED'],
      [() => {}, undefined],
    ];
    for (const [change, code] of cases) {
      const snapshot = structuredClone(world);
      Object.assign(snapshot.mapDefinition, { width: 320, height: 320 });
      snapshot.schemaVersion = 29; change(snapshot);
      const control = structuredClone(snapshot), before = JSON.stringify(snapshot);
      const actual = rejection(() => r.checkpointEnvelope(snapshot));
      assert.deepEqual(actual, rejection(() => r.validateCheckpoint(control)));
      assert.equal(actual.code, code);
      assert.equal(JSON.stringify(snapshot), before);
      assert.deepEqual(r.checkpoint(), world);
    }
  } finally { await fixture.dispose(); }
});
