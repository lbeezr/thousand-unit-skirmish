import assert from 'node:assert/strict';
import test from 'node:test';
import { BANNERFALL_RULES, createBannerfallState, creditBannerfallKill,
  bannerfallWaveKind, stepBannerfallWaves, validateBannerfallState, bannerfallWinner } from '../src/bannerfall-rules.mjs';

const victim = (id = 0, generation = 1, team = 1) => ({ id, generation, team, hp: 0, kind: 'infantry' });
function waveCallbacks(population = [0, 0], blocked = () => false) {
  const calls = [];
  const reads = [];
  return { population, calls, reads,
    populationForTeam(team) { reads.push(team); return population[team]; },
    spawn(team, kind) {
      calls.push([team, kind]);
      if (blocked(team, kind)) return false;
      population[team] += kind === 'rider' ? 2 : 1;
      return true;
    },
  };
}

test('rules are frozen and each new match gets independent counters and receipts', () => {
  assert.deepEqual(BANNERFALL_RULES, { version: 1, waveSeconds: 15, waveSize: 2, populationCap: 12,
    evolutionKills: 6, openingArmySize: 16, initialKind: 'infantry', evolvedKind: 'rider', mapId: 'bannerfall-arena' });
  assert.throws(() => { BANNERFALL_RULES.waveSize = 2000; }, TypeError);
  const first = createBannerfallState(), second = createBannerfallState();
  assert.deepEqual(first, { version: 1, nextWaveIndex: 1, kills: [0, 0], creditedGenerations: [] });
  creditBannerfallKill(first, victim(), 0);
  assert.deepEqual(second, { version: 1, nextWaveIndex: 1, kills: [0, 0], creditedGenerations: [] });
});

test('a current death credits once; a recycled ID credits a fresh generation including wrap', () => {
  const state = createBannerfallState();
  assert.equal(creditBannerfallKill(state, victim(19, 0xffffffff), 0), true);
  assert.equal(creditBannerfallKill(state, victim(19, 0xffffffff), 0), false);
  assert.equal(creditBannerfallKill(state, victim(19, 1), 0), true);
  assert.equal(creditBannerfallKill(state, victim(19, 1), 0), false);
  assert.deepEqual(state.kills, [2, 0]);
  assert.deepEqual(state.creditedGenerations, [[19, 1]], 'only the latest receipt for the ID is retained');
  assert.equal(creditBannerfallKill(state, { ...victim(1999, 17, 0), kind: 'rider' }, 1), true);
  assert.deepEqual(state.kills, [2, 1]);
});

test('only opposite-team, dead military units with exact valid identities can score', () => {
  const state = createBannerfallState();
  for (const invalid of [null, {}, ...[
    { hp: 100 }, { hp: -1 }, { hp: '0' }, { hp: NaN },
    { kind: 'worker' }, { kind: 'skiff' }, { kind: 'town-center' }, { kind: 'archer' },
    { team: 0 }, { team: 2 }, { team: null }, { team: '1' },
    { id: -1 }, { id: 2000 }, { id: 0.5 }, { id: '0' },
    { generation: 0 }, { generation: 0x100000000 }, { generation: 1.5 }, { generation: '1' },
  ].map(fields => ({ ...victim(), ...fields }))]) {
    assert.equal(creditBannerfallKill(state, invalid, 0), false);
  }
  for (const attacker of [undefined, null, -1, 2, '0', false]) {
    assert.equal(creditBannerfallKill(state, victim(), attacker), false);
  }
  assert.deepEqual(state, createBannerfallState());
});

test('six kills evolve future waves once and scores saturate while receipts continue', () => {
  const state = createBannerfallState();
  for (let id = 0; id < 5; id++) assert.equal(creditBannerfallKill(state, victim(id), 0), true);
  assert.equal(bannerfallWaveKind(state, 0), 'infantry');
  assert.equal(creditBannerfallKill(state, victim(5), 0), true);
  assert.equal(bannerfallWaveKind(state, 0), 'rider');
  assert.equal(bannerfallWaveKind(state, 1), 'infantry');
  for (let id = 6; id < 20; id++) assert.equal(creditBannerfallKill(state, victim(id), 0), true);
  assert.deepEqual(state.kills, [6, 0]);
  assert.equal(state.creditedGenerations.length, 20, 'accepted deaths remain deduplicated after saturation');
  const callbacks = waveCallbacks();
  assert.deepEqual(stepBannerfallWaves(state, 15, callbacks), { due: true, spawned: [2, 2] });
  assert.deepEqual(callbacks.calls, [[0, 'rider'], [0, 'rider'], [1, 'infantry'], [1, 'infantry']]);
});

test('pre-wave calls have no callbacks and the exact boundary attempts team zero then one', () => {
  const state = createBannerfallState();
  const callbacks = waveCallbacks();
  for (const elapsed of [0, 1, 14.999]) {
    assert.deepEqual(stepBannerfallWaves(state, elapsed, callbacks), { due: false, spawned: [0, 0] });
  }
  assert.deepEqual(callbacks.calls, []);
  assert.deepEqual(callbacks.reads, []);
  assert.deepEqual(state, createBannerfallState());
  assert.deepEqual(stepBannerfallWaves(state, 15, callbacks), { due: true, spawned: [2, 2] });
  assert.deepEqual(callbacks.calls, [[0, 'infantry'], [0, 'infantry'], [1, 'infantry'], [1, 'infantry']]);
  assert.equal(state.nextWaveIndex, 2);
  assert.deepEqual(stepBannerfallWaves(state, 15, callbacks), { due: false, spawned: [0, 0] });
  assert.equal(callbacks.calls.length, 4);
});

test('blocked slots and missed waves expire without a backlog, and future waves continue', () => {
  const state = createBannerfallState();
  const blocked = waveCallbacks([0, 0], () => true);
  assert.deepEqual(stepBannerfallWaves(state, 150, blocked), { due: true, spawned: [0, 0] });
  assert.equal(blocked.calls.length, 4, 'ten missed waves still attempt only two slots per team');
  assert.equal(state.nextWaveIndex, 11);
  const callbacks = waveCallbacks();
  assert.deepEqual(stepBannerfallWaves(state, 164.999, callbacks), { due: false, spawned: [0, 0] });
  assert.deepEqual(callbacks.calls, []);
  assert.deepEqual(stepBannerfallWaves(state, 165, callbacks), { due: true, spawned: [2, 2] });
  assert.equal(state.nextWaveIndex, 12);
});

test('weighted population is rechecked per slot: Infantry costs one and Rider costs two', () => {
  const state = createBannerfallState();
  state.kills = [6, 0];
  const callbacks = waveCallbacks([9, 11]);
  assert.deepEqual(stepBannerfallWaves(state, 15, callbacks), { due: true, spawned: [1, 1] });
  assert.deepEqual(callbacks.population, [11, 12]);
  assert.deepEqual(callbacks.calls, [[0, 'rider'], [1, 'infantry']]);
  assert.equal(state.nextWaveIndex, 2, 'unused capped slots expire');
  callbacks.population[0] = 8;
  callbacks.population[1] = 10;
  assert.deepEqual(stepBannerfallWaves(state, 30, callbacks), { due: true, spawned: [2, 2] });
  assert.deepEqual(callbacks.population, [12, 12]);
  assert.deepEqual(stepBannerfallWaves(state, 45, callbacks), { due: true, spawned: [0, 0] });
});

test('a blocked first slot can use the second slot without receiving a later replacement', () => {
  const state = createBannerfallState();
  let attempts = 0;
  const callbacks = waveCallbacks([11, 12], () => attempts++ === 0);
  assert.deepEqual(stepBannerfallWaves(state, 15, callbacks), { due: true, spawned: [1, 0] });
  assert.equal(callbacks.calls.length, 2);
  assert.deepEqual(callbacks.population, [12, 12]);
  assert.deepEqual(stepBannerfallWaves(state, 16, callbacks), { due: false, spawned: [0, 0] });
});

test('serialized restore clones state and retains deduplication without matching recycled generations', () => {
  const state = createBannerfallState();
  creditBannerfallKill(state, victim(7, 0xffffffff), 0);
  stepBannerfallWaves(state, 30, waveCallbacks());
  const serialized = JSON.parse(JSON.stringify(state));
  const before = structuredClone(serialized);
  const restored = validateBannerfallState(serialized,
    { elapsed: 30, units: [{ id: 7, generation: 1, hp: 100, kind: 'infantry' }] });
  assert.deepEqual(restored, state);
  assert.notEqual(restored, serialized);
  assert.notEqual(restored.kills, serialized.kills);
  assert.notEqual(restored.creditedGenerations[0], serialized.creditedGenerations[0]);
  assert.equal(creditBannerfallKill(restored, victim(7, 0xffffffff), 0), false);
  assert.equal(creditBannerfallKill(restored, victim(7, 1), 0), true);
  assert.deepEqual(serialized, before);
  assert.deepEqual(validateBannerfallState(state, { elapsed: 30 }), state,
    'standalone validation does not require a runtime roster');
});

test('restore accepts the first pending wave and late pending indexes but rejects future schedules', () => {
  const state = createBannerfallState();
  assert.deepEqual(validateBannerfallState(state), state);
  assert.deepEqual(validateBannerfallState(state, { elapsed: 150 }), state);
  assert.deepEqual(validateBannerfallState({ ...state, nextWaveIndex: 11 }, { elapsed: 150 }),
    { ...state, nextWaveIndex: 11 });
  assert.throws(() => validateBannerfallState({ ...state, nextWaveIndex: 2 }, { elapsed: 14.999 }), /next wave/);
  assert.throws(() => validateBannerfallState({ ...state, nextWaveIndex: 12 }, { elapsed: 150 }), /next wave/);
});

test('restore rejects malformed shape, counters and receipts without mutating inputs', () => {
  const malformed = [null, [], {}, { ...createBannerfallState(), extra: true }];
  for (const fields of [
    { version: 2 }, { version: '1' }, { nextWaveIndex: 0 }, { nextWaveIndex: 1.5 },
    { nextWaveIndex: '1' }, { kills: [0] }, { kills: [0, 0, 0] }, { kills: Array(2) },
    { kills: [7, 0] }, { kills: [-1, 0] }, { kills: [0, '0'] }, { kills: [0, 0.5] },
    { creditedGenerations: null }, { creditedGenerations: [[0, 1], [0, 2]] },
    { creditedGenerations: [[0]] }, { creditedGenerations: [[0, 1, 2]] },
    ...[[-1, 1], [2000, 1], ['0', 1], [0.5, 1], [0, 0], [0, 0x100000000],
      [0, 1.5], [0, '1']].map(entry => ({ creditedGenerations: [entry] })),
  ]) malformed.push({ ...createBannerfallState(), ...fields });
  for (const state of malformed) {
    const before = structuredClone(state);
    assert.throws(() => validateBannerfallState(state), /Invalid Bannerfall state/);
    assert.deepEqual(state, before);
  }
  const state = { ...createBannerfallState(), creditedGenerations: [[7, 1]] };
  assert.throws(() => validateBannerfallState(state, { units: [] }), /receipt identity/);
  assert.throws(() => validateBannerfallState(state, { units: [{ id: 8 }], maxUnits: 10 }), /receipt identity/);
  assert.throws(() => validateBannerfallState(state, { maxUnits: 7 }), /receipt identity/);
  for (const maxUnits of [0, 2001, 1.5, '2000']) {
    assert.throws(() => validateBannerfallState(state, { maxUnits }), /restore context/);
  }
});

test('receipt storage stays bounded to one entry per available ID even after repeated reuse', () => {
  const state = createBannerfallState();
  for (let id = 0; id < 2000; id++) creditBannerfallKill(state, victim(id, 0xffffffff), 0);
  for (let id = 0; id < 2000; id++) creditBannerfallKill(state, victim(id, 1), 0);
  assert.equal(state.creditedGenerations.length, 2000);
  assert.deepEqual(state.kills, [6, 0]);
  assert.deepEqual(validateBannerfallState(state), state);
  assert.throws(() => validateBannerfallState({ ...state, creditedGenerations: [...state.creditedGenerations, [0, 2]] }), /ledger/);
});

test('stronghold damage gives one terminal winner or a simultaneous draw', () => {
  assert.equal(bannerfallWinner([2400, 2400]), -1);
  assert.equal(bannerfallWinner([0.5, 1]), -1);
  assert.equal(bannerfallWinner([0, 2400]), 1);
  assert.equal(bannerfallWinner([2400, 0]), 0);
  assert.equal(bannerfallWinner([0, 0]), 2);
  for (const hp of [null, [], [0], [0, 0, 0], Array(2), [-1, 0], [0, Infinity], [NaN, 0], ['0', 1]]) {
    assert.throws(() => bannerfallWinner(hp), /core HP/);
  }
});

test('invalid elapsed time and teams reject before invoking spawn callbacks', () => {
  const state = createBannerfallState();
  for (const elapsed of [-1, NaN, Infinity, '15', 1e20]) {
    const callbacks = waveCallbacks();
    assert.throws(() => stepBannerfallWaves(state, elapsed, callbacks), /elapsed time/);
    assert.deepEqual(callbacks.calls, []);
    assert.deepEqual(state, createBannerfallState());
  }
  for (const team of [-1, 2, '0', null]) assert.throws(() => bannerfallWaveKind(state, team), /team/);
});
