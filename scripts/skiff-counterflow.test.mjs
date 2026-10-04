import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createWaterUnitRuntime, waterUnitOccupiedCells } from '../src/water-unit-runtime.mjs';
import { advanceSkiffWaypoints } from '../src/skiff-waypoints.mjs';

const arena = JSON.parse(readFileSync(new URL('../maps/siltmouths-confluence-grounds.json', import.meta.url)));
const stepSeconds = 1 / 30;
function makeBoat(water, id, cell, team = id - 24) {
  return { ...water.graph.pointAt(cell), id, team, hp: 120, kind: 'skiff', movementDomain: 'water',
    path: [], pathIndex: 0, moveGoalCell: -1, waterMoveBlocked: false, holdingPosition: false,
    gatherPhase: '', gatherNodeId: null, queuedWaypoints: [], repathTimer: 0, orderRevision: 1,
    cargo: 0, cargoType: null };
}
function order(water, boat, destination, boats) {
  const point = water.graph.pointAt(destination), route = water.planReserved(boat, point.x, point.z, boats);
  assert.equal(route.status, 'found');
  Object.assign(boat, { path: route.cells, pathIndex: 0, moveGoalCell: destination, waterMoveBlocked: false, repathTimer: 0 });
}
function safe(water, boats) {
  const occupied = new Set();
  for (const boat of boats.filter(boat => boat.hp > 0)) {
    assert.ok(water.validRoute(boat), 'every intermediate/recovered route is cardinal and admitted');
    for (const cell of waterUnitOccupiedCells(water.graph, boat)) {
      assert.ok(!occupied.has(cell), 'opposing swept hull reservations never overlap'); occupied.add(cell);
    }
  }
}
function arrived(water, boat, destination) {
  const point = water.graph.pointAt(destination);
  assert.ok(Math.hypot(boat.x - point.x, boat.z - point.z) < 1e-7, `boat ${boat.id} reaches accepted cell ${destination}`);
  assert.deepEqual(boat.path, []);
}
function tick(water, boats, count = 1, queued = false) {
  for (let i = 0; i < count; i++) {
    water.advance(boats, stepSeconds, () => 2.4);
    if (queued) advanceSkiffWaypoints(water, boats, stepSeconds);
    safe(water, boats);
  }
}
function encounter(water, boats) {
  for (let i = 0; i < 1800; i++) {
    tick(water, boats);
    if (boats.every(boat => boat.waterMoveBlocked)) return;
  }
  assert.fail('documented opposing routes must reproduce the shared-cell obstruction');
}
function confluence(reverse = false) {
  const water = createWaterUnitRuntime(arena);
  const boats = [31, 128].map((column, team) => makeBoat(water, 24 + team, 106 * 160 + column));
  const goals = [20602, 20517];
  for (const [team, boat] of boats.entries()) order(water, boat, goals[team], boats);
  if (reverse) boats.reverse();
  return { water, boats, goals };
}

for (const reverse of [false, true]) test(`Confluence reciprocal crossings finish safely with actor order ${reverse ? 'reversed' : 'normal'}`, () => {
  const { water, boats, goals } = confluence(reverse);
  encounter(water, boats);
  for (const boat of boats) {
    assert.ok(Math.abs(boat.x - (boat.team ? .42 : -.42)) < 1e-7);
    assert.equal(boat.z, 40.5); assert.equal(boat.pathIndex, 63); assert.equal(boat.path.length, 114);
    assert.equal(boat.moveGoalCell, goals[boat.team]);
  }
  tick(water, boats, 2100);
  for (const boat of boats) {
    arrived(water, boat, goals[boat.team]); assert.equal(boat.waterMoveBlocked, false);
  }
});

test('blocked reciprocal intent and pending waypoints survive a cold runtime reconstruction', () => {
  let { water, boats } = confluence(); encounter(water, boats);
  for (const boat of boats) boat.queuedWaypoints = [{ destination: 129 * 160 + (boat.team ? 35 : 124), attackMove: false }];
  const before = structuredClone(boats);
  water = createWaterUnitRuntime(arena); boats = structuredClone(before); safe(water, boats);
  tick(water, boats, 2400, true);
  for (const boat of boats) {
    arrived(water, boat, before[boat.team].queuedWaypoints[0].destination);
    assert.deepEqual(boat.queuedWaypoints, []); assert.deepEqual(boat.path, []);
    assert.equal(boat.cargo, before[boat.team].cargo);
  }
});

test('a stopped opposing boat remains stopped while the other retries; replacement retains its new goal', () => {
  const { water, boats, goals } = confluence(); encounter(water, boats);
  const stopped = boats[1]; stopped.path = []; stopped.pathIndex = 0;
  stopped.moveGoalCell = -1; stopped.waterMoveBlocked = false; stopped.repathTimer = 0;
  stopped.cargo = 3; stopped.cargoType = 'food';
  const position = { x: stopped.x, z: stopped.z };
  tick(water, boats, 180);
  assert.deepEqual({ x: stopped.x, z: stopped.z }, position);
  assert.equal(stopped.cargo, 3); assert.deepEqual(stopped.path, []);
  const replacement = 132 * 160 + 120; order(water, stopped, replacement, boats);
  tick(water, boats, 2100);
  arrived(water, stopped, replacement); arrived(water, boats[0], goals[0]);
  assert.equal(stopped.cargo, 3);
});

test('stale opposed routes in a one-cell cleared channel keep goals intact rather than crossing shore or overlapping', () => {
  const map = { width: 24, height: 16, obstacles: [{ material: 'water', column: 1, row: 6, width: 22, height: 3 }] };
  const water = createWaterUnitRuntime(map), boats = [3, 20].map((column, team) => makeBoat(water, 24 + team, 7 * 24 + column));
  const goals = [7 * 24 + 18, 7 * 24 + 5];
  // Individually valid stale routes; ordinary admission also protects active
  // destinations, so this diagnostic does not claim this channel can pass.
  for (const [team, boat] of boats.entries()) {
    const point = water.graph.pointAt(goals[team]), route = water.plan(boat, point.x, point.z, boats);
    assert.equal(route.status, 'found'); Object.assign(boat, { path: route.cells, moveGoalCell: goals[team] });
  }
  encounter(water, boats); const held = structuredClone(boats);
  tick(water, boats, 150);
  for (const [team, boat] of boats.entries()) {
    assert.equal(boat.moveGoalCell, goals[team]); assert.deepEqual(boat.path, held[team].path);
    assert.equal(boat.waterMoveBlocked, true); assert.equal(boat.x, held[team].x); assert.equal(boat.z, held[team].z);
  }
  boats[1].hp = 0; tick(water, boats, 300);
  arrived(water, boats[0], goals[0]);
});

test('fishing jobs retain their own retry/berth rules rather than ordinary Move rerouting', () => {
  const { water, boats } = confluence(); encounter(water, boats);
  for (const boat of boats) { boat.gatherPhase = 'to-base'; boat.cargo = 4; boat.cargoType = 'food'; }
  const before = structuredClone(boats); tick(water, boats, 150);
  assert.deepEqual(boats, before);
});
