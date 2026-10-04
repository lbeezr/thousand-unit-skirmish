import assert from 'node:assert/strict';
import test from 'node:test';
import { BrowserStateRecovery } from '../src/browser-state-recovery.mjs';

const state = (tick, fields = {}) => ({ type: 'state', serverInstanceId: 'server-a', matchId: 'match-a',
  tick, units: [[0, 0, tick, 0]], queuedWaypointCounts: [[0, 2]], ...fields });
function ready() {
  const recovery = new BrowserStateRecovery();
  recovery.reset(state(1), 0); recovery.frame(0); return recovery;
}

test('complete snapshots coalesce to one presentation, retaining the entire newest projection', () => {
  const recovery = ready();
  for (let i = 2; i <= 1200; i++) recovery.receive(state(i), i);
  assert.equal(recovery.pending.tick, 1200);
  assert.equal(recovery.coalesced, 1198);
  const update = recovery.frame(16);
  assert.deepEqual(update.state, state(1200));
  assert.equal(update.snap, false);
  assert.equal(recovery.frame(32), null);
  assert.equal(recovery.applied, 2);
});

for (const absence of [100, 600000]) test(`resume after ${absence}ms ignores obsolete backlog and requires a fresh correlated full state`, () => {
  const recovery = ready(); recovery.suspend();
  for (let i = 2; i <= 1200; i++) assert.equal(recovery.receive(state(i), i), false);
  assert.equal(recovery.pending, null); assert.equal(recovery.poll(absence), null);
  assert.equal(recovery.frame(absence), null);
  recovery.resume(absence);
  const request = recovery.poll(absence);
  assert.equal(request.type, 'stateRefresh');
  assert.equal(recovery.poll(absence + 1), null);
  assert.equal(recovery.receive(state(1200), absence + 2), false);
  assert.equal(recovery.receive(state(1200, { stateRefreshId: request.stateRefreshId + 1 }), absence + 3), false);
  assert.equal(recovery.status(absence + 3), 'SYNCING CURRENT STATE');
  assert.equal(recovery.receive(state(1201, { stateRefreshId: request.stateRefreshId }), absence + 4), true);
  const update = recovery.frame(absence + 5);
  assert.equal(update.snap, true); assert.equal(update.state.tick, 1201);
  assert.equal(recovery.status(absence + 5), null);
});

test('repeated switches invalidate earlier refresh IDs and do not multiply actions', () => {
  const recovery = ready(); let prior;
  for (let i = 0; i < 20; i++) {
    recovery.suspend(); recovery.resume(i * 100);
    const request = recovery.poll(i * 100);
    if (prior) assert.equal(recovery.receive(state(20, { stateRefreshId: prior }), i * 100), false);
    assert.equal(recovery.poll(i * 100 + 1), null);
    prior = request.stateRefreshId;
  }
  assert.equal(recovery.receive(state(21, { stateRefreshId: prior }), 2001), true);
  assert.equal(recovery.frame(2002).snap, true);
});

test('decreasing ticks, old epochs, invalid ticks and late replies cannot replace the pending snapshot', () => {
  const recovery = ready(); recovery.receive(state(20), 10);
  for (const packet of [state(19), state(99, { matchId: 'old' }), state(99, { serverInstanceId: 'old' }),
    state(NaN), state(-1), state(21, { stateRefreshId: 1 })]) assert.equal(recovery.receive(packet, 20), false);
  assert.equal(recovery.frame(30).state.tick, 20);
  // Same-tick projections can change after an admitted order; do not reject them.
  assert.equal(recovery.receive(state(20, { queuedWaypointCounts: [] }), 31), true);
  assert.deepEqual(recovery.frame(32).state.queuedWaypointCounts, []);
  recovery.reset(state(0, { serverInstanceId: 'server-b' }), 40);
  assert.equal(recovery.receive(state(100), 41), false);
  assert.equal(recovery.frame(42).state.tick, 0);
});

test('a real frame gap uses the same freshness barrier without catch-up frames', () => {
  const recovery = ready(); recovery.frame(16); recovery.receive(state(2), 100);
  assert.equal(recovery.frame(300000), null);
  assert.equal(recovery.recovering, true);
  const request = recovery.poll(300000);
  recovery.receive(state(3000, { stateRefreshId: request.stateRefreshId }), 300010);
  assert.equal(recovery.frame(300016).snap, true);
});

test('bounded heartbeat differentiates responsive non-progress from a transport timeout', () => {
  const recovery = ready();
  let request = recovery.poll(5000);
  assert.equal(recovery.poll(5001), null);
  recovery.receive(state(1, { stateRefreshId: request.stateRefreshId }), 5010);
  request = recovery.poll(10000);
  recovery.receive(state(1, { stateRefreshId: request.stateRefreshId }), 10010);
  assert.equal(recovery.status(10010), 'SERVER NOT ADVANCING');
  recovery.receive(state(2), 10020); assert.equal(recovery.status(10020), null);
  request = recovery.poll(15000);
  assert.equal(recovery.poll(24999), null);
  assert.equal(recovery.status(24999), 'AWAITING SERVER RESPONSE', 'missing responses do not prove a server simulation stall');
  assert.deepEqual(recovery.poll(25000), { type: 'reconnect' });
  recovery.disconnect(); assert.equal(recovery.poll(30000), null);
  assert.equal(recovery.pending, null);
  recovery.reset(state(300), 30000); assert.equal(recovery.frame(30001).snap, true);
});

test('hidden connection births and discards/reloads establish a new state without retained orders', () => {
  const recovery = new BrowserStateRecovery({ visible: false });
  recovery.reset(state(99), 0);
  assert.equal(recovery.frame(1), null); assert.equal(recovery.pending, null);
  recovery.resume(100); const request = recovery.poll(100);
  recovery.receive(state(100, { stateRefreshId: request.stateRefreshId }), 101);
  assert.equal(recovery.frame(102).snap, true);
  const reloaded = new BrowserStateRecovery(); reloaded.reset(state(200), 0);
  assert.equal(reloaded.nextRequestId, 1); assert.equal(reloaded.frame(1).state.tick, 200);
});

test('no-fog waypoint metadata follows deferred roster creation; full refresh supersedes earlier metadata', () => {
  const recovery = ready();
  const packet = state(2); delete packet.queuedWaypointCounts;
  recovery.receive(packet, 10);
  recovery.receiveWaypointCounts([[1, 2]]);
  assert.equal(recovery.frame(16).state.tick, 2);
  assert.deepEqual(recovery.takeWaypointCounts(), [[1, 2]]);
  assert.equal(recovery.takeWaypointCounts(), null);
  recovery.receiveWaypointCounts([[1, 3]]);
  recovery.receive(state(3, { queuedWaypointCounts: [[1, 4]] }), 17);
  assert.deepEqual(recovery.frame(32).state.queuedWaypointCounts, [[1, 4]]);
  assert.equal(recovery.takeWaypointCounts(), null);
  recovery.suspend(); recovery.receiveWaypointCounts([[1, 9]]);
  recovery.resume(100);
  const request = recovery.poll(100);
  recovery.receive(state(4, { stateRefreshId: request.stateRefreshId }), 101);
  assert.equal(recovery.recovering, true, 'commands remain gated until a frame applies the refresh');
  assert.equal(recovery.poll(102), null, 'a pending fresh presentation cannot issue a second request');
  recovery.receiveWaypointCounts([[1, 5]]);
  recovery.frame(116);
  assert.deepEqual(recovery.takeWaypointCounts(), [[1, 5]]);
});

test('a slow resume frame cannot invalidate its already-received fresh reply', () => {
  const recovery = ready(); recovery.frame(16);
  recovery.resume(1000); const request = recovery.poll(1000);
  recovery.receive(state(50, { stateRefreshId: request.stateRefreshId }), 1010);
  assert.equal(recovery.frame(5000).state.tick, 50);
  assert.equal(recovery.recovering, false);
});
