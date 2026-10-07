import assert from 'node:assert/strict';
import test from 'node:test';
import { CONTESTED_RAID_TICKS, createContestedRaidDriver, publicRaidWaypoints } from './pve-contested-wood-case.mjs';
import { toOpponentObservation } from '../src/pve-opponent.mjs';

const raider = { id: 0, generation: 4, team: 0, kind: 'infantry', hp: 100, x: 0.5, z: .5 };
const worker = { id: 8, generation: 9, team: 1, kind: 'worker', hp: 100, x: 18.5, z: 2.5, cargo: 3, cargoType: 'wood' };
const waypoints = [{ x: 20.5, z: 2.5 }, { x: 10.5, z: -12.5 }, { x: 25.5, z: 24.5 }];
const create = (extra = {}) => createContestedRaidDriver({ team: 0, raiders: [raider], waypoints, initialTick: 100, ...extra });
const seen = (tick, enemies = [], own = [raider]) => ({ tick, units: { friendly: own, visibleEnemies: enemies } });
const attacks = decision => decision.commands.filter(c => c.type === 'attack');
const moves = decision => decision.commands.filter(c => c.type === 'move');

test('raid: no disclosure permits only authored search in noAttack stance', () => {
  const decision = create().next(seen(100));
  assert.deepEqual(attacks(decision), []);
  assert.equal(decision.focused, null);
  assert.deepEqual(decision.commands[0], { type: 'setStance', ids: [0], unitGenerations: [4], stance: 'noAttack' });
  assert.deepEqual(decision.witness, { kind: 'authored-map', waypointIndex: 0, point: waypoints[0] });
  assert.deepEqual(moves(decision)[0], { type: 'move', ids: [0], unitGenerations: [4], ...waypoints[0] });
});

test('raid: current living Worker generation is focused; dead, non-Worker and friendly rows are ineligible', () => {
  const invalid = [{ ...worker, hp: 0 }, { ...worker, id: 9, kind: 'infantry' }, { ...worker, id: 10, team: 0 }];
  assert.deepEqual(attacks(create().next(seen(100, invalid))), []);
  const decision = create().next(seen(100, [...invalid, worker]));
  assert.deepEqual(attacks(decision), [{ type: 'attack', ids: [0], unitGenerations: [4], targetId: 8, targetGeneration: 9 }]);
  assert.deepEqual(decision.focused, { id: 8, generation: 9 });
  assert.deepEqual(decision.disclosure, { tick: 100, target: { id: 8, generation: 9, x: 18.5, z: 2.5 } });
});

test('raid: lost sight uses the last witnessed coordinate and no focused Attack', () => {
  const driver = create(); driver.next(seen(100, [worker]));
  driver.next(seen(370, [{ ...worker, x: 19.5, z: 3.5 }]));
  const decision = driver.next(seen(400));
  assert.deepEqual(attacks(decision), []);
  assert.deepEqual(moves(decision)[0], { type: 'move', ids: [0], unitGenerations: [4], x: 19.5, z: 3.5 });
  assert.deepEqual(decision.witness, { kind: 'last-seen', tick: 370, target: { id: 8, generation: 9, x: 19.5, z: 3.5 } });
  assert.equal(decision.commands[0].stance, 'noAttack');
  assert.equal(attacks(driver.next(seen(700, [worker])))[0].targetGeneration, 9);
});

test('raid: slot reuse cannot substitute another generation or another Worker after focus', () => {
  for (const alternative of [{ ...worker, generation: 10 }, { ...worker, id: 9 }, { ...worker, hp: 0 }]) {
    const driver = create(); driver.next(seen(100, [worker]));
    const decision = driver.next(seen(400, [alternative]));
    assert.deepEqual(attacks(decision), []);
    assert.deepEqual(decision.focused, { id: 8, generation: 9 });
  }
});

test('raid: noAttack control uses the same search/pursuit driver and never enables automatic or focused damage', () => {
  const driver = create({ damage: false });
  const rows = [driver.next(seen(100)), driver.next(seen(400, [worker])),
    driver.next(seen(670, [worker])), driver.next(seen(700)), driver.next(seen(1000, [worker]))];
  assert.ok(rows.some(row => row.disclosure));
  assert.ok(rows.some(row => row.witness?.kind === 'last-seen'));
  for (const row of rows) {
    assert.deepEqual(attacks(row), []);
    assert.ok(row.commands.every(c => c.type === 'move' || (c.type === 'setStance' && c.stance === 'noAttack')));
    if (moves(row).length) assert.equal(row.commands[0].stance, 'noAttack', 'Move cannot run in aggressive automatic combat');
  }
});

test('raid: public decisions are independent of authority, victim views and private Worker jobs', () => {
  const plain = seen(100, [worker]);
  const poisoned = seen(100, [{ ...worker }]);
  for (const object of [poisoned, poisoned.units.visibleEnemies[0]]) {
    for (const name of ['checkpoint', 'victimView', 'workIntent', 'gatherNodeId', 'forestStocks']) {
      Object.defineProperty(object, name, { get() { throw new Error(`private read: ${name}`); } });
    }
  }
  assert.deepEqual(create().next(poisoned), create().next(plain));
});

test('raid: real peer projection conceals hidden Worker coordinates before selection', () => {
  const map = { width: 64, height: 64, resourceNodes: [], obstacles: [], spawnPoints: [] };
  const bytes = Buffer.alloc(64 * 64 / 4);
  const homeCell = 32 * 64 + 32; bytes[homeCell >> 2] |= 2 << ((homeCell & 3) * 2);
  const snapshot = hiddenX => ({ type: 'state', tick: 100, fogOfWar: true, food: [0, 0], wood: [0, 0],
    visibility: { columns: 64, rows: 64, data: bytes.toString('base64') },
    units: [[0, 0, .5, .5, 100, 'infantry', 0, '', 4], [8, 1, hiddenX, 2.5, 100, 'worker', 3, 'wood', 9]] });
  const a = toOpponentObservation(snapshot(18.5), 0, map), b = toOpponentObservation(snapshot(-18.5), 0, map);
  assert.deepEqual(a.units.visibleEnemies, []); assert.deepEqual(b.units.visibleEnemies, []);
  assert.deepEqual(create().next(a), create().next(b));
});

test('raid: search is finite, rate-limited and cannot reset the original deadline', () => {
  const driver = create(), commands = [], indices = [];
  for (let tick = 100; tick <= 100+CONTESTED_RAID_TICKS+600; tick += 30) {
    const row = driver.next(seen(tick));
    assert.equal(row.deadline, 100+CONTESTED_RAID_TICKS);
    if (row.commands.length) { commands.push(tick); indices.push(row.witness.waypointIndex); }
    if (tick >= row.deadline) assert.deepEqual(row.commands, []);
  }
  assert.equal(commands.length, waypoints.length, 'each authored waypoint is tried once');
  assert.equal(new Set(indices).size, indices.length);
  assert.ok(commands.every((tick, i) => !i || tick-commands[i-1] >= 300));
  const focusedDriver = create();
  for (let tick = 100; tick <= 100+CONTESTED_RAID_TICKS; tick += 30) {
    const row = focusedDriver.next(seen(tick, [{ ...worker, x: worker.x+tick/1000 }]));
    assert.equal(row.deadline, 100+CONTESTED_RAID_TICKS);
    if (tick === row.deadline) assert.deepEqual(row.commands, []);
  }
});

test('raid: authored search ignores live stocks/units and deterministically deduplicates terrain goals', () => {
  const map = { width: 64, height: 64, spawnPoints: [{ team: 1, x: 20.5, z: .5 }],
    obstacles: [{ column: 42, row: 30, width: 3, height: 3, material: 'forest' }] };
  for (const name of ['units', 'forestStocks', 'resourceNodes', 'checkpoint']) Object.defineProperty(map, name, { get() { throw new Error(name); } });
  const a = publicRaidWaypoints(map, 1), b = publicRaidWaypoints(map, 1);
  assert.deepEqual(a,b); assert.ok(a.length > 1);
  assert.equal(new Set(a.slice(1).map(p => `${Math.floor((p.x+32)/8)}:${Math.floor((p.z+32)/8)}`)).size, a.length-1);
  for (const p of a.slice(1)) assert.ok(!(p.x >= 10 && p.x < 13 && p.z >= -2 && p.z < 1), 'static forest cells are not destinations');
});
