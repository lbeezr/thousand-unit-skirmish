import assert from 'node:assert/strict';
import test from 'node:test';
import { createWaterUnitRuntime, waterUnitOccupiedCells } from '../src/water-unit-runtime.mjs';
import { createSkiffFishingContext } from '../src/skiff-fishing.mjs';
import { planSkiffGroupFishing, planSkiffGroupReturn } from '../src/skiff-group-orders.mjs';
import { planSkiffWaypoints, validSkiffWaypoints, advanceSkiffWaypoints } from '../src/skiff-waypoints.mjs';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
function fixture() {
  const map = { width: 64, height: 64, obstacles: [18, 43].map(column => ({ column, row: 42, width: 12, height: 16, material: 'water' })),
    resourceNodes: [0, 1].map(team => ({ id: `fish-${team}`, type: 'food', resourceVariant: 'shore-fish', x: team ? 17.5 : -7.5, z: 9.5, stock: 31 })) };
  const water = createWaterUnitRuntime(map), fishing = createSkiffFishingContext(map, water);
  const world = { nodes: new Map(map.resourceNodes.map(node => [node.id, structuredClone(node)])), teamFood: [1000, 1000],
    buildings: [0, 1].map(team => ({ id: team + 1, type: 'dock', team, hp: 1200, complete: true, x: team ? 12.5 : -12.5, z: 8.5 })),
    units: [0, 1].flatMap(team => [0, 1, 2].map(index => ({
      ...water.graph.pointAt((index === 2 ? 43 : 49) * 64 + (team ? 44 : 19) + (index === 2 ? 0 : index)),
      id: team * 3 + index, team, kind: 'skiff', movementDomain: 'water', hp: 120,
      cargo: 0, cargoType: null, gatherNodeId: null, gatherForestCell: -1, gatherPhase: '', dropoffBuildingId: null,
      path: [], pathIndex: 0, moveGoalCell: -1, waterMoveBlocked: false, holdingPosition: false,
      repathTimer: 0, orderRevision: 0, queuedWaypoints: [],
    }))) };
  const selected = team => world.units.slice(team * 3, team * 3 + 2);
  const load = (unit, cargo) => { unit.cargo = cargo; unit.cargoType = cargo > 0 ? 'food' : null; world.nodes.get(`fish-${unit.team}`).stock -= cargo; };
  const start = (team, returning = false) => {
    const node = world.nodes.get(`fish-${team}`), plan = returning
      ? planSkiffGroupReturn(fishing, selected(team), world.buildings, world.units)
      : planSkiffGroupFishing(fishing, selected(team), node, world.buildings, world.units);
    assert.equal(plan.status, 'found');
    for (const { unit, route, nodeId, phase } of plan.assignments) fishing.start(unit, nodeId, phase, route);
  };
  const queue = (team, selection = selected(team)) => {
    const point = water.graph.pointAt(55 * 64 + (team ? 52 : 27)), before = structuredClone(world);
    const plan = planSkiffWaypoints(water, selection, point.x, point.z, world.units);
    assert.deepEqual(world, before, 'queue admission preserves fishing, cargo and stock');
    if (plan.status === 'found') for (const { unit, destination, append } of plan.assignments) {
      assert.equal(append, true); unit.queuedWaypoints.push({ destination, attackMove: false });
    }
    return plan;
  };
  const safe = () => {
    for (const team of [0, 1]) close(world.nodes.get(`fish-${team}`).stock
      + world.units.filter(unit => unit.team === team).reduce((sum, unit) => sum + unit.cargo, 0) + world.teamFood[team] - 1000, 31);
    const occupied = new Set();
    for (const unit of world.units.filter(unit => unit.hp > 0)) {
      assert.ok(water.validRoute(unit)); assert.ok(validSkiffWaypoints(water, unit));
      assert.ok(fishing.validState(unit, world.nodes, world.buildings));
      for (const cell of waterUnitOccupiedCells(water.graph, unit)) { assert.ok(!occupied.has(cell)); occupied.add(cell); }
    }
  };
  const tick = () => {
    const phases = world.units.map(unit => unit.gatherPhase), queues = world.units.map(unit => unit.queuedWaypoints.length);
    water.advance(world.units, 1 / 30, () => 2.4); fishing.update(world, 1 / 30); advanceSkiffWaypoints(water, world.units, 1 / 30);
    for (const [index, unit] of world.units.entries()) if (phases[index] && unit.queuedWaypoints.length < queues[index]) {
      assert.equal(unit.cargo, 0, 'the next Move cannot activate while any fishing cargo remains');
      assert.equal(unit.gatherPhase, '');
    }
    safe();
  };
  const recover = () => { world.units = structuredClone(world.units); world.buildings = structuredClone(world.buildings);
    world.nodes = structuredClone(world.nodes); world.teamFood = [...world.teamFood]; safe(); };
  const arrived = goals => goals.every(([id, cell]) => {
    const unit = world.units.find(unit => unit.id === id), point = water.graph.pointAt(cell);
    return Math.hypot(unit.x - point.x, unit.z - point.z) < 1e-7 && !unit.path.length && !unit.queuedWaypoints.length;
  });
  return { water, fishing, world, selected, load, start, queue, safe, tick, recover, arrived };
}

for (const team of [0, 1]) test(`seat ${team}: mixed fish loads bank one full cargo each before queued Move, then leave remaining stock`, () => {
  const f = fixture(), idle = structuredClone(f.world.units[team * 3 + 2]);
  f.load(f.selected(team)[0], .005); f.load(f.selected(team)[1], 9.25); f.start(team);
  const plan = f.queue(team); assert.equal(plan.status, 'found');
  const goals = plan.assignments.map(({ unit, destination }) => [unit.id, destination]);
  for (let i = 0; i < 25; i++) f.tick(); f.recover();
  for (let i = 0; i < 1200; i++) f.tick();
  assert.ok(f.arrived(goals)); close(f.world.teamFood[team], 1020); close(f.world.nodes.get(`fish-${team}`).stock, 11);
  assert.ok(f.selected(team).every(unit => unit.cargo === 0 && unit.gatherNodeId === null));
  assert.deepEqual(f.world.units[team * 3 + 2], idle);
});

for (const cargo of [0, .005]) test(`source depleted externally: ${cargo} carried food deposits before the accepted Move`, () => {
  const f = fixture(), unit = f.selected(0)[0]; f.load(unit, cargo); f.start(0);
  const plan = f.queue(0, [unit]), goals = plan.assignments.map(({ unit, destination }) => [unit.id, destination]);
  const node = f.world.nodes.get('fish-0'); f.world.teamFood[0] += node.stock; node.stock = 0;
  f.recover(); for (let i = 0; i < 800; i++) f.tick();
  assert.ok(f.arrived(goals)); close(f.world.teamFood[0], 1031); assert.equal(f.world.nodes.get('fish-0').stock, 0);
  assert.equal(f.world.units[0].cargo, 0);
});

for (const cargo of [0, .005]) test(`unavailable source approach: abandon the one-load job and preserve/deliver ${cargo} food`, () => {
  const f = fixture(), unit = f.selected(0)[0]; f.load(unit, cargo); f.start(0);
  const plan = f.queue(0, [unit]), goals = plan.assignments.map(({ unit, destination }) => [unit.id, destination]);
  for (const [index, cell] of f.fishing.siteAt('fish-0').cells.entries()) f.world.units.push({ ...structuredClone(f.world.units[2]),
    id: 100 + index, ...f.water.graph.pointAt(cell), team: 1 });
  f.recover(); for (let i = 0; i < 800; i++) f.tick();
  assert.ok(f.arrived(goals)); close(f.world.teamFood[0], 1000 + cargo); close(f.world.nodes.get('fish-0').stock, 31 - cargo);
  assert.equal(f.world.units[0].cargo, 0);
});

test('lost owned Docks keep both cargo and next Move across restart until real delivery is available', () => {
  const f = fixture();
  for (const team of [0, 1]) { f.load(f.selected(team)[0], .005); f.load(f.selected(team)[1], 9.25); f.start(team); assert.equal(f.queue(team).status, 'found'); }
  const goals = f.world.units.filter(unit => unit.queuedWaypoints.length).map(unit => [unit.id, unit.queuedWaypoints[0].destination]);
  const docks = f.world.buildings; f.world.buildings = [];
  for (let i = 0; i < 700; i++) f.tick(); f.recover();
  assert.deepEqual(f.world.teamFood, [1000, 1000]);
  for (const team of [0, 1]) assert.ok(f.selected(team).every(unit => unit.cargo === 10 && unit.gatherPhase === 'to-base' && unit.queuedWaypoints.length === 1));
  f.world.buildings = docks;
  for (let i = 0; i < 1000; i++) f.tick();
  assert.ok(f.arrived(goals)); assert.deepEqual(f.world.teamFood, [1020, 1020]);
});

test('explicit Return with mixed loads also releases queued Moves only after each cargo deposits', () => {
  const f = fixture();
  for (const team of [0, 1]) { f.load(f.selected(team)[0], .005); f.load(f.selected(team)[1], 10); f.start(team, true); assert.equal(f.queue(team).status, 'found'); }
  const goals = f.world.units.filter(unit => unit.queuedWaypoints.length).map(unit => [unit.id, unit.queuedWaypoints[0].destination]);
  f.recover(); for (let i = 0; i < 900; i++) f.tick();
  assert.ok(f.arrived(goals)); close(f.world.teamFood[0], 1010.005); close(f.world.teamFood[1], 1010.005);
});

test('fishing keeps the shared eight-pending cap and rejects the selected group atomically', () => {
  const f = fixture(); f.start(0);
  for (let i = 0; i < 8; i++) assert.equal(f.queue(0, [f.selected(0)[0]]).status, 'found');
  const before = structuredClone(f.world);
  assert.equal(f.queue(0).status, 'queue-limit'); assert.deepEqual(f.world, before);
});

test('future Move destinations cannot prevent real delivery at physically available Dock berths', () => {
  const f = fixture(), [a, b] = f.selected(0); f.load(a, .005); f.load(b, .005); f.start(0);
  for (let i = 0; i < 200 && !f.selected(0).every(unit => unit.gatherPhase === 'gathering'); i++) f.tick();
  assert.ok(f.selected(0).every(unit => unit.gatherPhase === 'gathering'));
  assert.equal(f.queue(0).status, 'found');
  for (const berth of f.fishing.dockCells(f.world.buildings[0]).filter(cell => !f.water.reservations(f.world.units, a).includes(cell))) {
    const point = f.water.graph.pointAt(berth), plan = planSkiffWaypoints(f.water, [a], point.x, point.z, f.world.units);
    assert.equal(plan.status, 'found'); a.queuedWaypoints.push({ destination: plan.assignments[0].destination, attackMove: false });
  }
  // Keep deferred Moves pending to isolate delivery: their future goals cannot
  // claim the berth access needed to release another boat's current food.
  for (let i = 0; i < 1000; i++) {
    f.water.advance(f.world.units, 1 / 30, () => 2.4); f.fishing.update(f.world, 1 / 30); f.safe();
  }
  close(f.world.teamFood[0], 1020); assert.equal(a.cargo, 0); assert.equal(b.cargo, 0);
  assert.ok(a.queuedWaypoints.length > 1); assert.equal(b.queuedWaypoints.length, 1);
});
