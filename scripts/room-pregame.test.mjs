import assert from 'node:assert/strict';
import test from 'node:test';
import { RoomPregame, validatePregameCheckpoint } from '../src/room-pregame.mjs';

const host = { id: 'player-1', team: 0 };
const guest = { id: 'player-2', team: 1 };
const maps = new Map([['a', { id: 'a', startingArmySize: 8 }], ['b', { id: 'b', startingArmySize: 500 }]]);
function lobby() {
  const value = new RoomPregame('a', 8);
  value.syncSeats([{ ...host, connected: true }, { ...guest, connected: true }]);
  return value;
}
function readyBoth(value) {
  for (const player of [host, guest]) value.setReady(player, { revision: value.revision, ready: true });
}

test('host settings reject invalid, unsupported and stale changes atomically', () => {
  const value = lobby();
  readyBoth(value);
  const before = value.payload();
  for (const [player, command] of [
    [guest, { mapId: 'b' }], [host, { mapId: 'absent' }], [host, { armySize: 8 }],
    [host, { armySize: '500' }], [host, { armySize: null }], [host, { mapId: null }],
    [host, { mapId: 'b', armySize: 0 }], [host, { mode: 'pve' }], [host, { civilization: 'boughward' }],
  ]) {
    assert.throws(() => value.configure(player, { revision: value.revision, ...command }, maps));
    assert.deepEqual(value.payload(), before);
  }
  assert.throws(() => value.configure(host, { revision: value.revision - 1, mapId: 'b' }, maps));
  assert.deepEqual(value.payload(), before);
  assert.equal(value.configure(host, { revision: value.revision, mapId: 'a' }, maps), false);
  assert.deepEqual(value.payload(), before, 'unchanged settings retain ready');
  assert.equal(value.configure(host, { revision: value.revision, mapId: 'b' }, maps), true);
  assert.equal(value.armySize, 500, 'map change uses the actual map opening');
  assert.equal(value.canLaunch(), false);
});

test('readiness binds to connected session identity and current settings', () => {
  const value = lobby();
  const revision = value.revision;
  value.setReady(host, { revision, ready: true });
  value.setReady(host, { revision, ready: true });
  assert.equal(value.canLaunch(), false);
  assert.throws(() => value.setReady({ id: host.id, team: null }, { revision, ready: true }));
  assert.throws(() => value.setReady(guest, { revision, ready: 'true' }));
  assert.throws(() => value.launch(host, revision));
  value.configure(host, { revision, armySize: 250 }, maps);
  assert.throws(() => value.setReady(guest, { revision, ready: true }));
  readyBoth(value);
  assert.throws(() => value.launch(guest, value.revision));
  assert.equal(value.launch(host, value.revision), true);
  assert.equal(value.launch(host, value.revision), false, 'duplicate launch never starts a second match');
  assert.throws(() => value.configure(host, { revision: value.revision, mapId: 'b' }, maps));
});

test('disconnect, rejoin and replacement invalidate ready without changing seats', () => {
  const value = lobby();
  readyBoth(value);
  const revision = value.revision;
  value.syncSeats([{ ...host, connected: false }, { ...guest, connected: true }]);
  assert.equal(value.canLaunch(), false);
  assert.throws(() => value.launch(host, value.revision));
  value.syncSeats([{ ...host, connected: true }, { ...guest, connected: true }]);
  assert.equal(value.payload().seats[0].id, host.id);
  assert.ok(value.payload().seats.every(seat => !seat.ready));
  assert.throws(() => value.launch(host, revision));
  value.syncSeats([{ id: 'player-3', team: 0, connected: true }, { ...guest, connected: true }]);
  assert.throws(() => value.setReady(host, { revision: value.revision, ready: true }));
  assert.equal(value.payload().seats[1].team, 1, 'guest is not silently promoted');
});

test('recovery preserves phase and clears readiness; reset requires a new launch', () => {
  const value = lobby();
  readyBoth(value);
  const restored = new RoomPregame('a', 8, value.checkpoint());
  restored.syncSeats(value.seats);
  assert.equal(restored.phase, 'lobby');
  assert.equal(restored.canLaunch(), false);
  value.launch(host, value.revision);
  const running = new RoomPregame('a', 8, value.checkpoint());
  running.syncSeats(value.seats);
  assert.equal(running.phase, 'running');
  running.reset('b', 500);
  assert.equal(running.phase, 'lobby');
  assert.equal(running.canLaunch(), false);
  assert.throws(() => running.launch(host, value.revision));
  for (const invalid of [undefined, {}, [], { phase: 'launching', revision: 0 },
    { phase: 'lobby', revision: -1 }, { phase: 'lobby', revision: 1.5 },
    { phase: 'running', revision: 1, ready: true }]) assert.throws(() => validatePregameCheckpoint(invalid));
});
