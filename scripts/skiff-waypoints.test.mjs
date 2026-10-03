import assert from 'node:assert/strict';
import test from 'node:test';
import { createWaterUnitRuntime, waterUnitOccupiedCells } from '../src/water-unit-runtime.mjs';
import { planSkiffGroupMove } from '../src/skiff-group-orders.mjs';
import { planSkiffWaypoints, validSkiffWaypoints, advanceSkiffWaypoints } from '../src/skiff-waypoints.mjs';

function fixture() {
  const map = { width: 64, height: 64, obstacles: [18, 43].map(column => ({ column, row: 42, width: 12, height: 16, material: 'water' })) };
  const water = createWaterUnitRuntime(map);
  let units = [0, 1].flatMap(team => [0, 1, 2].map(index => ({
    ...water.graph.pointAt((index === 2 ? 43 : 48) * 64 + (team ? 44 : 19) + (index < 2 ? index + 1 : 0)),
    id: team * 3 + index, team, hp: 120, kind: 'skiff', movementDomain: 'water', cargo: index === 0 ? .005 : index === 1 ? 2.25 : 0,
    cargoType: index < 2 ? 'food' : null, gatherPhase: '', gatherNodeId: null, gatherForestCell: -1,
    path: [], pathIndex: 0, moveGoalCell: -1, queuedWaypoints: [], repathTimer: 0,
    waterMoveBlocked: false, orderRevision: 1, holdingPosition: false,
  })));
  const point = (column, row) => water.graph.pointAt(row * 64 + column);
  const selected = team => units.slice(team * 3, team * 3 + 2);
  const move = (team, column, row) => {
    const p = point(column, row), plan = planSkiffGroupMove(water, selected(team), p.x, p.z, units);
    assert.equal(plan.status, 'found');
    for (const { unit, route } of plan.assignments) { unit.path = route.cells; unit.moveGoalCell = route.cells.at(-1); }
  };
  const queue = (selection, column, row) => {
    const p = point(column, row), before = structuredClone(units), plan = planSkiffWaypoints(water, selection, p.x, p.z, units);
    assert.deepEqual(units, before, 'preflight never changes a route, queue or cargo');
    if (plan.status === 'found') for (const { unit, route, destination, append } of plan.assignments) {
      if (append) unit.queuedWaypoints.push({ destination, attackMove: false });
      else { unit.path = route.cells; unit.pathIndex = 0; unit.moveGoalCell = destination; unit.holdingPosition = false; }
    }
    return plan;
  };
  const safe = () => {
    const occupied = new Set();
    for (const unit of units.filter(unit => unit.hp > 0)) {
      assert.ok(water.validRoute(unit)); assert.ok(validSkiffWaypoints(water, unit));
      for (const cell of waterUnitOccupiedCells(water.graph, unit)) { assert.ok(!occupied.has(cell)); occupied.add(cell); }
    }
  };
  const tick = () => { water.advance(units, 1 / 30, () => 2.4); advanceSkiffWaypoints(water, units, 1 / 30); safe(); };
  return { water, point, selected, move, queue, tick, safe, get units() { return units; }, recover() { units = structuredClone(units); } };
}

for (const team of [0, 1]) test(`seat ${team}: selected water waypoints retain individual tails, fractional cargo and restart`, () => {
  const f = fixture(), offset = team ? 25 : 0, idle = structuredClone(f.units[team * 3 + 2]);
  f.move(team, 23 + offset, 52);
  const active = f.selected(team).map(unit => [...unit.path]);
  assert.equal(f.queue(f.selected(team), 26 + offset, 53).status, 'found');
  assert.equal(f.queue(f.selected(team), 27 + offset, 47).status, 'found');
  assert.deepEqual(f.selected(team).map(unit => unit.path), active);
  const goals = f.selected(team).map(unit => unit.queuedWaypoints.at(-1).destination);
  assert.equal(new Set(goals).size, 2);
  for (let i = 0; i < 8; i++) f.tick(); f.recover();
  for (let i = 0; i < 700; i++) f.tick();
  for (let i = 0; i < 2; i++) {
    const unit = f.selected(team)[i], p = f.water.graph.pointAt(goals[i]);
    assert.ok(Math.hypot(unit.x - p.x, unit.z - p.z) < 1e-7);
    assert.equal(unit.queuedWaypoints.length, 0); assert.equal(unit.moveGoalCell, -1);
    assert.equal(unit.cargo, i ? 2.25 : .005);
  }
  assert.deepEqual(f.units[team * 3 + 2], idle);
});

test('Shift on an idle boat starts immediately; repeated targets obey the shared eight-waypoint cap', () => {
  const f = fixture(), unit = f.units[0];
  assert.equal(f.queue([unit], 25, 54).assignments[0].append, false);
  for (let i = 0; i < 8; i++) assert.equal(f.queue([unit], 25, 54).status, 'found');
  const before = structuredClone(f.units);
  assert.equal(f.queue([unit, f.units[1]], 27, 54).status, 'queue-limit'); assert.deepEqual(f.units, before);
  for (let i = 0; i < 700; i++) f.tick();
  assert.equal(unit.queuedWaypoints.length, 0); assert.equal(unit.cargo, .005);
});

test('fishing/return, mixed domains, land and disconnected Shift orders reject without changing any intent', () => {
  const f = fixture(), unit = f.units[0];
  for (const phase of ['to-node', 'gathering', 'to-base']) {
    unit.gatherPhase = phase; const before = structuredClone(unit);
    assert.equal(f.queue([unit], 25, 54).status, 'finish-or-stop-fishing-first'); assert.deepEqual(unit, before);
  }
  unit.gatherPhase = '';
  assert.notEqual(f.queue([unit, { ...f.units[1], kind: 'worker', movementDomain: undefined }], 25, 54).status, 'found');
  assert.notEqual(f.queue([unit], 0, 0).status, 'found');
  assert.equal(f.queue([unit], 50, 54).status, 'disconnected');
});

test('future destinations stay reserved; a blocked accepted head survives restart and retries the same cell', () => {
  const f = fixture(), a = f.units[0], b = f.units[1];
  b.queuedWaypoints = [{ destination: 54 * 64 + 25, attackMove: false }];
  assert.notEqual(f.queue([a], 25, 54).status, 'found'); b.queuedWaypoints = [];
  const destination = 54 * 64 + 25;
  a.queuedWaypoints = [{ destination, attackMove: false }];
  Object.assign(b, f.water.graph.pointAt(destination));
  advanceSkiffWaypoints(f.water, f.units, 1 / 30);
  assert.equal(a.queuedWaypoints.length, 1); assert.equal(a.path.length, 0);
  f.recover(); f.units[1].hp = 0;
  for (let i = 0; i < 700; i++) f.tick();
  const recovered = f.units[0], point = f.water.graph.pointAt(destination);
  assert.ok(Math.hypot(recovered.x - point.x, recovered.z - point.z) < 1e-7);
  assert.equal(recovered.queuedWaypoints.length, 0); assert.equal(recovered.cargo, .005);
});

test('water checkpoint queues reject attack-move, shore, disconnected goals, excess length and fishing combinations', () => {
  const f = fixture(), unit = f.units[0], destination = 54 * 64 + 25;
  unit.queuedWaypoints = [{ destination, attackMove: false }]; assert.ok(validSkiffWaypoints(f.water, unit));
  for (const queue of [[{ destination, attackMove: true }], [{ destination: 0, attackMove: false }],
    [{ destination: 54 * 64 + 50, attackMove: false }], Array.from({ length: 9 }, () => ({ destination, attackMove: false }))]) {
    unit.queuedWaypoints = queue; assert.equal(validSkiffWaypoints(f.water, unit), false);
  }
  unit.queuedWaypoints = [{ destination, attackMove: false }]; unit.gatherPhase = 'to-base';
  assert.equal(validSkiffWaypoints(f.water, unit), false);
});
