import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { migrateMatchModeCheckpoint, validateMatchModeCheckpoint } from '../src/match-mode-checkpoint.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function legacy() {
  const mapDefinition = {
    id: 'legacy-elimination-deadline', victoryMode: 'all',
    triggers: [{ id: 'supply', victory: false, foodReward: 75, woodReward: 50 }],
    timedVictory: { objectiveId: 'supply', afterSeconds: 900 },
    scenarioEvents: [{ id: 'relief', type: 'timed-supply', afterSeconds: 120, team: 'both' }],
  };
  return {
    schemaVersion: 26, rulesVersion: 6, rulesetRevision: 'saved-ruleset',
    sequence: 17, savedAt: 1791028800000, matchId: 'saved-match',
    mapDefinition, mapHash: hash(mapDefinition), revision: 8,
    state: {
      scenarioClockStarted: true, matchElapsedSeconds: 901.27,
      matchWinner: 1, matchWinnerReason: 'timed-control', matchWinnerTriggerId: 'supply',
      triggerStates: [{ id: 'supply', owner: 1, progress: 0.75, capturingTeam: 0 }],
      victoryHold: { progressSeconds: [0, 19.5], activeTeams: [false, true] },
      pregame: { phase: 'running', revision: 8, ready: [true, true] },
      workerProduction: [{ queue: 2, trainingRemaining: 12 }, { queue: 0, trainingRemaining: 0 }],
      units: [{ id: 4, team: 0, kind: 'worker', hp: 35 }],
    },
  };
}

test('exact schema 26 migration preserves the authored hybrid and finished match state', () => {
  const snapshot = legacy();
  const before = structuredClone(snapshot);
  const definition = snapshot.mapDefinition;
  const state = snapshot.state;
  assert.equal(migrateMatchModeCheckpoint(snapshot), snapshot);
  assert.deepEqual(snapshot, { ...before, schemaVersion: 27,
    matchModeId: 'authored', matchModeVersion: 1 });
  assert.equal(snapshot.mapDefinition, definition);
  assert.equal(snapshot.state, state);
  assert.equal(hash(snapshot.mapDefinition), before.mapHash);
  assert.deepEqual(validateMatchModeCheckpoint(snapshot), { matchModeId: 'authored', matchModeVersion: 1 });
  const migrated = structuredClone(snapshot);
  assert.equal(migrateMatchModeCheckpoint(snapshot), snapshot);
  assert.deepEqual(snapshot, migrated, 'migration is not reapplied to schema 27');
});

test('legacy snapshots claiming either mode field remain unchanged and fail schema validation', () => {
  for (const fields of [
    { matchModeId: 'skirmish', matchModeVersion: 1 },
    { matchModeId: 'unknown', matchModeVersion: 99 },
    { matchModeId: 'authored' }, { matchModeVersion: 1 },
    { matchModeId: undefined }, { matchModeVersion: undefined },
    { matchModeId: null, matchModeVersion: null },
  ]) {
    const snapshot = Object.assign(legacy(), fields);
    const before = structuredClone(snapshot);
    assert.equal(migrateMatchModeCheckpoint(snapshot), snapshot);
    assert.deepEqual(snapshot, before);
    assert.throws(() => validateMatchModeCheckpoint(snapshot), /Invalid match checkpoint:.*schema version/);
  }
});

test('migration refuses malformed state and every other schema or rules version', () => {
  const changes = [
    snapshot => delete snapshot.state,
    ...[null, [], 'state', 1, false].map(value => snapshot => { snapshot.state = value; }),
    ...[undefined, null, 0, 1, 25, 27, 28, '26'].map(value => snapshot => { snapshot.schemaVersion = value; }),
    ...[undefined, null, 0, 1, 4, 5, 7, '6'].map(value => snapshot => { snapshot.rulesVersion = value; }),
  ];
  for (const change of changes) {
    const snapshot = legacy();
    change(snapshot);
    const before = structuredClone(snapshot);
    assert.equal(migrateMatchModeCheckpoint(snapshot), snapshot);
    assert.deepEqual(snapshot, before);
  }
  for (const value of [undefined, null, [], 'snapshot', 26]) {
    assert.equal(migrateMatchModeCheckpoint(value), value);
  }
});

test('current explicit identities validate without changing the snapshot or its map', () => {
  for (const matchModeId of ['authored', 'objective-control', 'skirmish']) {
    const snapshot = { ...legacy(), schemaVersion: 27, matchModeId, matchModeVersion: 1 };
    const before = structuredClone(snapshot);
    assert.deepEqual(validateMatchModeCheckpoint(snapshot), { matchModeId, matchModeVersion: 1 });
    assert.deepEqual(snapshot, before);
    assert.equal(migrateMatchModeCheckpoint(snapshot), snapshot);
    assert.deepEqual(snapshot, before);
  }
});

test('schema 27 cannot inherit the implicit authored default or a partial identity', () => {
  for (const fields of [{}, { matchModeId: 'authored' }, { matchModeVersion: 1 }]) {
    const snapshot = { ...legacy(), schemaVersion: 27, ...fields };
    const before = structuredClone(snapshot);
    assert.throws(() => validateMatchModeCheckpoint(snapshot),
      /Invalid match checkpoint: requires both matchModeId and matchModeVersion/);
    assert.deepEqual(snapshot, before);
  }
  const inherited = Object.assign(Object.create({ matchModeId: 'authored', matchModeVersion: 1 }),
    { schemaVersion: 27, rulesVersion: 6 });
  assert.throws(() => validateMatchModeCheckpoint(inherited), /requires both/);
});

test('unknown, malformed or unsupported current identities fail with checkpoint context', () => {
  for (const matchModeId of [undefined, null, '', 'unknown', 'Skirmish', ' skirmish']) {
    const snapshot = { ...legacy(), schemaVersion: 27, matchModeId, matchModeVersion: 1 };
    const before = structuredClone(snapshot);
    assert.throws(() => validateMatchModeCheckpoint(snapshot), /Invalid match checkpoint: Unsupported matchModeId/);
    assert.deepEqual(snapshot, before);
  }
  for (const matchModeVersion of [undefined, null, 0, 2, '1', 1.5, true]) {
    const snapshot = { ...legacy(), schemaVersion: 27, matchModeId: 'skirmish', matchModeVersion };
    const before = structuredClone(snapshot);
    assert.throws(() => validateMatchModeCheckpoint(snapshot), /Invalid match checkpoint: Unsupported matchModeVersion/);
    assert.deepEqual(snapshot, before);
  }
});

test('validation rejects non-objects and unsupported schema or rules versions', () => {
  for (const value of [undefined, null, [], 'snapshot', 27]) {
    assert.throws(() => validateMatchModeCheckpoint(value), /Invalid match checkpoint: expected an object/);
  }
  for (const schemaVersion of [undefined, null, 26, 31, '27']) {
    assert.throws(() => validateMatchModeCheckpoint({ ...legacy(), schemaVersion,
      matchModeId: 'authored', matchModeVersion: 1 }), /Invalid match checkpoint:.*schema version/);
  }
  for (const rulesVersion of [undefined, null, 1, 4, 5, 7, '6']) {
    assert.throws(() => validateMatchModeCheckpoint({ ...legacy(), schemaVersion: 27, rulesVersion,
      matchModeId: 'authored', matchModeVersion: 1 }), /Invalid match checkpoint: unsupported game rules version/);
  }
});

for (const schemaVersion of [28, 29, 30]) test(`Herd/heading schema ${schemaVersion} retains strict explicit match mode validation`, () => {
  for (const matchModeId of ['authored', 'objective-control', 'skirmish']) {
    const snapshot = { ...legacy(), schemaVersion, matchModeId, matchModeVersion: 1 };
    const before = structuredClone(snapshot);
    assert.deepEqual(validateMatchModeCheckpoint(snapshot), { matchModeId, matchModeVersion: 1 });
    assert.equal(migrateMatchModeCheckpoint(snapshot), snapshot);
    assert.deepEqual(snapshot, before);
  }
  assert.throws(() => validateMatchModeCheckpoint({ ...legacy(), schemaVersion }), /requires both/);
});
