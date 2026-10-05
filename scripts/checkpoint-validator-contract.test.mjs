import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';

// The same authority adapter used by existing checkpoint/fog/native consumers.
// No validator copy or replacement policy is evaluated by this contract.
const map = JSON.parse(await readFile(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url), 'utf8'));

for (const mode of ['authored', 'skirmish']) test(`${mode}: validation retains canonical map/state and restore parity`, async () => {
  const fixture = await createPveHeadlessFixture(map, { matchModeId: mode, matchModeVersion: 1 });
  const replay = fixture.replay;
  try {
    const snapshot = replay.checkpoint(), bytes = JSON.stringify(snapshot);
    const world = replay.checkpoint(), observations = [replay.observe(0), replay.observe(1)];
    const result = replay.validateCheckpoint(snapshot);
    assert.deepEqual(Object.keys(result), ['definition', 'state', 'explored', 'savedMatchMode']);
    assert.deepEqual(result.definition, snapshot.mapDefinition, 'returns the canonical authored map');
    assert.equal(result.state, snapshot.state, 'state identity is retained, without cloning or activation');
    assert.deepEqual(result.savedMatchMode, { matchModeId: mode, matchModeVersion: 1 });
    assert.notEqual(result.savedMatchMode, snapshot);
    assert.equal(result.explored.length, 2);
    for (const [team, decoded] of result.explored.entries()) {
      assert.ok(Buffer.isBuffer(decoded));
      assert.equal(decoded.length, map.width * map.height);
      assert.equal(decoded.toString('base64'), snapshot.state.explored[team]);
    }
    if (mode === 'skirmish') {
      assert.equal(result.state.triggerStates.length, map.triggers.length, 'bonus posts remain active under Skirmish');
    }
    assert.equal(JSON.stringify(snapshot), bytes, 'validation preserves serialized input');
    assert.deepEqual(replay.checkpoint(), world, 'validation does not activate or alter the running match');
    replay.restore(snapshot);
    for (const team of [0, 1]) assertRecoveredWorkerObservation(replay.observe(team), observations[team]);
    assert.deepEqual(replay.checkpoint(), world, 'the existing restore consumer retains the authority state');
  } finally { await fixture.dispose(); }
});

test('canonical validation and effective rules precede the restore consumer shipped-map veto', async () => {
  const fixture = await createPveHeadlessFixture(map, { matchModeId: 'skirmish', matchModeVersion: 1 });
  const replay = fixture.replay;
  try {
    const candidate = structuredClone(replay.checkpoint()), world = structuredClone(replay.checkpoint());
    candidate.mapDefinition.triggers[0].victory = true;
    candidate.mapDefinition.victoryHoldSeconds = 12;
    candidate.mapHash = createHash('sha256').update(JSON.stringify(candidate.mapDefinition)).digest('base64url');
    const bytes = JSON.stringify(candidate);
    const result = replay.validateCheckpoint(candidate);
    assert.equal(result.definition.triggers[0].victory, true, 'returns authored victory metadata, not the effective elimination projection');
    assert.equal(result.definition.victoryHoldSeconds, 12);
    assert.equal(result.state, candidate.state);
    assert.deepEqual(result.state.victoryHoldState.progressSeconds, [0, 0]);
    const advancing = structuredClone(candidate);
    advancing.state.victoryHoldState.activeTeams[0] = true;
    advancing.state.victoryHoldState.progressSeconds[0] = 1;
    advancing.matchModeId = 'authored';
    assert.equal(replay.validateCheckpoint(advancing).state, advancing.state, 'the authored twelve-second hold admits one second of progress');
    advancing.matchModeId = 'skirmish';
    const advancingBytes = JSON.stringify(advancing);
    assert.throws(() => replay.validateCheckpoint(advancing), { message: 'Invalid match checkpoint: invalid victory hold state' },
      'the same progress is invalid under effective Skirmish rules');
    assert.equal(JSON.stringify(advancing), advancingBytes);
    assert.throws(() => replay.restore(candidate), { message: 'Invalid match checkpoint: shipped map changed since checkpoint' });
    assert.equal(JSON.stringify(candidate), bytes);
    assert.deepEqual(replay.checkpoint(), world, 'catalog compatibility belongs to restore, before activation');
  } finally { await fixture.dispose(); }
});

test('ordinary checkpoint rejection priority and restore errors retain input/live-state parity', async () => {
  const fixture = await createPveHeadlessFixture(map, { matchModeId: 'skirmish', matchModeVersion: 1 });
  const replay = fixture.replay;
  try {
    const valid = replay.checkpoint(), world = replay.checkpoint();
    const cases = [
      ['schema before economy', s => { s.schemaVersion = 29; s.rulesetRevision = 'wrong'; }, 'Invalid match checkpoint: unsupported schema version'],
      ['economy before faction', s => { s.rulesetRevision = 'wrong'; s.factionId = 'wrong'; }, 'Invalid match checkpoint: economy profile or gameplay ruleset revision mismatch'],
      ['bank before faction', s => { s.state.teamFood[0] = -1; s.factionId = 'wrong'; }, 'Invalid match checkpoint: invalid food bank'],
      ['faction before rules', s => { s.factionId = 'wrong'; s.rulesVersion = 99; }, 'Invalid match checkpoint: unsupported faction'],
      ['rules before sequence', s => { s.rulesVersion = 99; s.sequence = 0; }, 'Invalid match checkpoint: unsupported game rules version'],
      ['sequence before time', s => { s.sequence = 0; s.savedAt = 0; }, 'Invalid match checkpoint: invalid sequence'],
      ['time before match identity', s => { s.savedAt = 0; s.matchId = ''; }, 'Invalid match checkpoint: invalid save time'],
      ['match identity before map', s => { s.matchId = ''; s.mapDefinition.width = 15; }, 'Invalid match checkpoint: invalid match identity'],
      ['map before mode', s => { s.mapDefinition.width = 15; s.matchModeId = 'unknown'; }, 'Map match checkpoint width and height must be integers between 16 and 256.'],
      ['mode before checksum', s => { s.matchModeId = 'unknown'; s.mapHash = ''; }, 'Invalid match checkpoint: Unsupported matchModeId: unknown'],
      ['checksum before forest', s => { s.mapHash = ''; s.state.forestStocks = null; }, 'Invalid match checkpoint: map checksum mismatch'],
      ['exploration before counters', s => { s.state.explored[0] = 'invalid'; s.state.nextPlayerId = 0; }, 'Invalid match checkpoint: invalid exploration grid'],
    ];
    for (const [label, change, expected] of cases) {
      const candidate = structuredClone(valid); change(candidate);
      const bytes = JSON.stringify(candidate);
      for (const method of ['validateCheckpoint', 'restore']) {
        assert.throws(() => replay[method](candidate), { name: 'Error', message: expected }, `${method}: ${label}`);
        assert.equal(JSON.stringify(candidate), bytes, `${method}: ${label} retains serialized input`);
        assert.deepEqual(replay.checkpoint(), world, `${method}: ${label} retains live authority`);
      }
    }
    for (const value of [undefined, null, [], 'checkpoint', 30]) {
      assert.throws(() => replay.validateCheckpoint(value), { message: 'Invalid match checkpoint: expected an object' });
    }
  } finally { await fixture.dispose(); }
});

test('XL route and JSON preflights run before schema and ordinary map admission', async () => {
  const fixture = await createPveHeadlessFixture(map, { matchModeId: 'skirmish', matchModeVersion: 1 });
  const replay = fixture.replay;
  try {
    const valid = replay.checkpoint(), world = replay.checkpoint();
    const cases = [
      ['route before state quota and schema', s => { s.state.units[0].path = [-1]; s.state.buildings = null; }, 'Invalid match checkpoint: XL route budget invalid cell index', undefined],
      ['state quota before schema', s => { s.state.buildings = null; }, 'Invalid match checkpoint: XL JSON budget invalid buildings table', 'CHECKPOINT_REJECTED'],
      ['under both quotas reaches schema', () => {}, 'Invalid match checkpoint: unsupported schema version', undefined],
    ];
    for (const [label, change, message, code] of cases) {
      const candidate = structuredClone(valid);
      Object.assign(candidate.mapDefinition, { width: 320, height: 320 });
      candidate.schemaVersion = 29; change(candidate);
      const bytes = JSON.stringify(candidate);
      for (const method of ['validateCheckpoint', 'restore']) {
        assert.throws(() => replay[method](candidate), error => {
          assert.equal(error.message, message, label);
          assert.equal(error.code, code, label);
          return true;
        });
        assert.equal(JSON.stringify(candidate), bytes, `${label}: input preserved`);
        assert.deepEqual(replay.checkpoint(), world, `${label}: live authority preserved`);
      }
    }
  } finally { await fixture.dispose(); }
});
