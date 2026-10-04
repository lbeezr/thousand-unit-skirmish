import assert from 'node:assert/strict';
import test from 'node:test';
import { attachDeterministicOpponent } from '../src/pve-opponent.mjs';

const skirmish = { matchModeId: 'skirmish', matchModeVersion: 1 };
const authored = { matchModeId: 'authored', matchModeVersion: 1 };

function fixture(team) {
  const map = { id: 'bellweather-millrace', width: 80, height: 64,
    startingResources: { food: 0, wood: 0 }, resourceNodes: [],
    triggers: [{ id: 'bonus', zone: { column: 37, row: 30, width: 6, height: 4 } }] };
  const state = { type: 'state', tick: 0, winner: -1, armySize: 24, food: [0, 0], wood: [0, 0],
    fogOfWar: true, visibility: { columns: 80, rows: 64, data: Buffer.alloc(1280, 0xaa).toString('base64') },
    units: Array.from({ length: 12 }, (_, slot) => [team * 12 + slot, team, team ? 20 : -20,
      0, 100, slot < 4 ? 'worker' : 'infantry', 0, '', 1, 'idle', 0]),
    workerProduction: [0, 1].map(team => ({ team, queue: 0 })), teamResearch: [{}, {}],
    buildings: [{ id: 100, team: 1 - team, type: 'barracks', x: 0, z: 0, hp: 1800, complete: true }],
    objectives: [{ id: 'bonus', owner: team, victory: false }] };
  const listeners = new Map(), sent = [], errors = [];
  const socket = { readyState: 1, send: data => sent.push(JSON.parse(data)),
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: type => listeners.delete(type) };
  const original = { setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval };
  let decide;
  globalThis.setInterval = callback => { decide = callback; return 1; };
  globalThis.clearInterval = () => {};
  const opponent = attachDeterministicOpponent(socket, { seed: 20260925,
    onError: error => errors.push(error.message) });
  return { map, state, sent, errors, decide: () => decide(),
    emit: message => listeners.get('message')({ data: JSON.stringify(message) }),
    close() { opponent.close(); Object.assign(globalThis, original); } };
}

for (const team of [0, 1]) {
  test(`seat ${team}: restored welcome selects Skirmish and repeated state preserves assault watches`, async () => {
    const f = fixture(team);
    try {
      await f.emit({ type: 'welcome', ...skirmish, player: { team }, map: f.map, state: { ...f.state, ...skirmish } });
      f.decide();
      assert.equal(f.sent[0]?.type, 'attackBuilding');
      assert.equal(f.sent[0].buildingId, 100);
      assert.deepEqual(f.sent[0].unitGenerations, Array(8).fill(1));
      for (const tick of [1, 30, 299]) {
        await f.emit({ ...f.state, ...skirmish, tick }); f.decide();
      }
      assert.equal(f.sent.length, 1, 'state identity must not restart the policy every observation');
      await f.emit({ ...f.state, ...skirmish, tick: 300 }); f.decide();
      assert.equal(f.sent.length, 2, 'normal bounded assault retry remains active');
      assert.deepEqual(f.sent.map(c => c.clientOrderToken), [1, 2]);
      assert.deepEqual(f.errors, []);
    } finally { f.close(); }
  });

  test(`seat ${team}: authoritative state/map change and rematch retain or replace the strategy`, async () => {
    const f = fixture(team);
    try {
      await f.emit({ type: 'welcome', player: { team }, map: f.map, state: f.state }); f.decide();
      assert.equal(f.sent.length, 0, 'legacy capture policy stops after owning the reward');
      await f.emit({ ...f.state, ...skirmish, tick: 1 }); f.decide();
      assert.equal(f.sent.at(-1)?.type, 'attackBuilding');
      await f.emit({ ...f.state, ...skirmish, tick: 2, winner: team });
      await f.emit({ type: 'victory', team }); f.decide();
      assert.equal(f.sent.length, 1);
      await f.emit({ ...f.state, ...skirmish, tick: 3 }); f.decide();
      assert.equal(f.sent.length, 2, 'winner-clear resets with the selected strategy');
      await f.emit({ type: 'mapChange', ...authored, map: f.map, state: { ...f.state, ...authored } }); f.decide();
      assert.equal(f.sent.length, 2, 'explicit authored selection resumes capture semantics');
      await f.emit({ type: 'mapChange', map: f.map, state: { ...f.state, ...skirmish } }); f.decide();
      assert.equal(f.sent.length, 3, 'state identity is accepted when the wrapper omits both fields');
      await f.emit({ type: 'welcome', player: { team }, map: f.map, state: f.state }); f.decide();
      assert.equal(f.sent.length, 3, 'a fresh legacy welcome restores authored semantics');
      assert.deepEqual(f.errors, []);
    } finally { f.close(); }
  });

  test(`seat ${team}: confirmed pristine host reset keeps the authoritative strategy`, async () => {
    const f = fixture(team);
    try {
      await f.emit({ type: 'welcome', ...skirmish, player: { team }, map: f.map, state: f.state }); f.decide();
      await f.emit({ type: 'victory', team });
      await f.emit({ type: 'notice', message: 'BATTLEFIELD RESET' });
      await f.emit({ ...f.state, ...skirmish, tick: 1, buildings: [],
        objectives: [{ id: 'bonus', owner: -1, victory: false }] });
      await f.emit({ ...f.state, ...skirmish, tick: 2 }); f.decide();
      assert.equal(f.sent.length, 2);
      assert.equal(f.sent.at(-1).type, 'attackBuilding');
      assert.deepEqual(f.errors, []);
    } finally { f.close(); }
  });

  test(`seat ${team}: malformed identities stop orders until a valid fresh setup`, async () => {
    const f = fixture(team);
    try {
      await f.emit({ type: 'welcome', ...skirmish, player: { team }, map: f.map, state: f.state }); f.decide();
      for (const invalid of [{ matchModeId: 'skirmish' }, { matchModeVersion: 1 },
        { matchModeId: 'skirmish', matchModeVersion: 2 }, { matchModeId: 'unknown', matchModeVersion: 1 }]) {
        await f.emit({ ...f.state, tick: 300, ...invalid }); f.decide();
        assert.equal(f.sent.length, 1);
      }
      assert.equal(f.errors.length, 4);
      await f.emit({ ...f.state, ...skirmish, tick: 300, winner: team });
      await f.emit({ ...f.state, ...skirmish, tick: 301 }); f.decide();
      assert.equal(f.sent.length, 1, 'winner-clear cannot hide an invalid identity');
      await f.emit({ type: 'mapChange', ...skirmish, map: f.map, state: f.state }); f.decide();
      assert.equal(f.sent.length, 2);
    } finally { f.close(); }
  });
}
