import test from 'node:test';
import assert from 'node:assert/strict';
import { freshVoluntaryEndings, voluntaryCapability, decideVoluntaryEnding, cancelVoluntaryOffer,
  savedVoluntaryEndings, validSavedVoluntaryEndings, migrateVoluntaryEndingCheckpoint } from '../src/server/voluntary-endings.mjs';
const context = team => ({ team, humanSeat: true, started: true, winner: -1, bothHumans: true });
const command = (state, action, more = {}) => ({ version: 1, generation: state.generation, revision: state.revision, action, ...more });
const validity = (state, more = {}) => validSavedVoluntaryEndings(savedVoluntaryEndings(state), {
  winner: state.result?.winner ?? -1, reason: state.result?.reason ?? null, triggerId: null, started: true, ...more });

for (const team of [0, 1]) {
  test(`seat ${team} can concede but cannot accept its own offer or fabricate consent`, () => {
    const state = freshVoluntaryEndings();
    const offer = command(state, 'offer');
    assert.equal(decideVoluntaryEnding(state, offer, context(team)).accepted, true);
    const before = structuredClone(state);
    for (const cmd of [offer, command(state, 'accept', { offerId: state.offer.id }),
      command(state, 'accept', { offerId: 99 }), command(state, 'unknown')]) {
      assert.equal(decideVoluntaryEnding(state, cmd, context(team)).accepted, false);
      assert.deepEqual(state, before);
    }
    assert.equal(decideVoluntaryEnding(state, command(state, 'accept', { offerId: state.offer.id }), context(1 - team)).accepted, true);
    assert.deepEqual(state.result, { winner: 2, reason: 'agreed-draw', agreedTeams: [0, 1] });
    assert.equal(validity(state), true);
    assert.equal(state.offer, null);
  });
  test(`seat ${team} resignation records the conceding seat even with an offline opponent`, () => {
    const state = freshVoluntaryEndings();
    assert.equal(decideVoluntaryEnding(state, command(state, 'resign'), { ...context(team), bothHumans: false }).accepted, true);
    assert.deepEqual(state.result, { winner: 1 - team, reason: 'resignation', resignedTeam: team });
    assert.equal(validity(state), true);
    assert.equal(validity(state, { winner: team }), false);
    assert.equal(validity(state, { pve: true }), false);
    const committed = structuredClone(state);
    assert.equal(decideVoluntaryEnding(state, command(state, 'resign'), context(1 - team)).accepted, false);
    assert.deepEqual(state, committed, 'a committed result cannot be overwritten even by a new revision');
  });
}
for (const change of [{ humanSeat: false }, { team: null }, { practice: true }, { pve: true }, { started: false }, { winner: 0 }, { winner: 2 }]) {
  test(`unsupported seat/state ${JSON.stringify(change)} cannot mutate a match`, () => {
    const state = freshVoluntaryEndings(), before = structuredClone(state);
    assert.equal(decideVoluntaryEnding(state, command(state, 'resign'), { ...context(0), ...change }).accepted, false);
    assert.deepEqual(state, before);
    assert.equal(voluntaryCapability(state, { ...context(0), ...change }).canResign, false);
  });
}
test('withdrawal, decline and disconnect cancel consent and invalidate previous offer identities', () => {
  const state = freshVoluntaryEndings();
  for (const action of ['withdraw', 'decline', 'disconnect']) {
    decideVoluntaryEnding(state, command(state, 'offer'), context(0));
    const accept = command(state, 'accept', { offerId: state.offer.id });
    const before = structuredClone(state);
    const wrong = action === 'withdraw' ? 1 : 0;
    if (action !== 'disconnect') {
      assert.equal(decideVoluntaryEnding(state, command(state, action, { offerId: state.offer.id }), context(wrong)).accepted, false);
      assert.deepEqual(state, before);
      assert.equal(decideVoluntaryEnding(state, command(state, action, { offerId: state.offer.id }), context(1 - wrong)).accepted, true);
    } else assert.equal(cancelVoluntaryOffer(state), true);
    assert.equal(decideVoluntaryEnding(state, accept, context(1)).accepted, false);
    assert.equal(state.result, null);
    assert.equal(state.offer, null);
  }
});
test('pending offer is not saved as consent and cold recovery retains monotonic revision', () => {
  const state = freshVoluntaryEndings();
  decideVoluntaryEnding(state, command(state, 'offer'), context(0));
  const saved = savedVoluntaryEndings(state);
  assert.deepEqual(saved, { version: 1, generation: 1, revision: 1, result: null });
  assert.equal(validity(state), true);
  const recovered = { ...saved, offer: null };
  assert.equal(decideVoluntaryEnding(recovered, command(recovered, 'accept', { offerId: 1 }), context(1)).accepted, false);
  decideVoluntaryEnding(recovered, command(recovered, 'offer'), context(0));
  assert.equal(recovered.offer.id, 2);
});
test('terminal proof rejects wrong mode/clock/seat/reason and invented agreement', () => {
  const state = freshVoluntaryEndings();
  decideVoluntaryEnding(state, command(state, 'offer'), context(0));
  decideVoluntaryEnding(state, command(state, 'accept', { offerId: state.offer.id }), context(1));
  for (const more of [{ reason: null }, { winner: 0 }, { started: false }, { practice: true }, { triggerId: 'objective' }]) assert.equal(validity(state, more), false);
  for (const teams of [[0], [1, 1], [0, 1, 1]]) {
    const saved = savedVoluntaryEndings(state); saved.result.agreedTeams = teams;
    assert.equal(validSavedVoluntaryEndings(saved, { winner: 2, reason: 'agreed-draw', triggerId: null, started: true }), false);
  }
});
test('legacy migration retains every previous rule/result and refuses claimed new endings', () => {
  const old = { schemaVersion: 29, state: { matchWinner: 1, matchWinnerReason: 'timed-control', matchElapsedSeconds: 900 } };
  const state = structuredClone(old.state);
  assert.equal(migrateVoluntaryEndingCheckpoint(old), true);
  assert.deepEqual(old, { schemaVersion: 30, state: { ...state, voluntaryEndings: { version: 0, generation: 1, revision: 0, result: null } } });
  assert.equal(migrateVoluntaryEndingCheckpoint(old), false);
  assert.equal(voluntaryCapability({ ...old.state.voluntaryEndings, offer: null }, context(0)).canResign, false);
  for (const bad of [{ schemaVersion: 28, state }, { schemaVersion: 31, state },
    { schemaVersion: 29, state: { ...state, voluntaryEndings: null } },
    { schemaVersion: 29, state: { ...state, matchWinnerReason: 'resignation' } }]) {
    const before = structuredClone(bad);
    assert.equal(migrateVoluntaryEndingCheckpoint(bad), false);
    assert.deepEqual(bad, before);
  }
});
