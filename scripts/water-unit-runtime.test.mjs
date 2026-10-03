import assert from 'node:assert/strict';
import test from 'node:test';
import { createWaterUnitRuntime, waterUnitOccupiedCells } from '../src/water-unit-runtime.mjs';
import { BUILDING_DEFINITIONS as B, UNIT_DEFINITIONS as U, GAMEPLAY_DEFINITIONS, validateGameplayDefinitions } from '../src/gameplay-definitions.mjs';

const map = { width: 20, height: 20, obstacles: [{ material: 'water', column: 2, row: 2, width: 14, height: 14 }] };
const cell = (column, row) => row * 20 + column;
const runtime = () => createWaterUnitRuntime(map);
function boat(context, column = 4, row = 4) {
  return { ...context.graph.pointAt(cell(column, row)), hp: 120, kind: 'skiff', movementDomain: 'water',
    path: [], pathIndex: 0, moveGoalCell: -1, waterMoveBlocked: false };
}
function move(context, unit, destination, actors = [unit]) {
  const point = context.graph.pointAt(destination), route = context.plan(unit, point.x, point.z, actors);
  assert.equal(route.status, 'found'); unit.path = route.cells; unit.pathIndex = 0; unit.moveGoalCell = destination;
}

test('Skiff has stable water identity, paid population and explicit zero offensive capabilities', () => {
  assert.equal(U.skiff.wireId, 7); assert.equal(U.skiff.movementDomain, 'water');
  assert.deepEqual(U.skiff.capabilities, ['move']); assert.deepEqual(U.skiff.combat.targetTags, []);
  assert.equal(U.skiff.combat.damage, 0); assert.equal(U.skiff.combat.structureDamage, 0);
  assert.equal(U.skiff.cost.wood, 75); assert.equal(U.skiff.population, 1);
  assert.deepEqual(B.dock.products, ['skiff']);
  for (const change of [definition => { definition.units.skiff.movementDomain = 'air'; },
    definition => { definition.units.skiff.capabilities.push('attack'); },
    definition => { definition.units.skiff.combat.damage = 1; }]) {
    const definition = structuredClone(GAMEPLAY_DEFINITIONS); change(definition);
    assert.throws(() => validateGameplayDefinitions(definition));
  }
});

test('water movement follows cardinal centers, obeys speed and never uses dry destinations', () => {
  const context = runtime(), unit = boat(context);
  move(context, unit, cell(10, 10));
  const start = { x: unit.x, z: unit.z };
  context.advance([unit], 0.1, () => 2.4);
  assert.ok(Math.abs(Math.hypot(unit.x - start.x, unit.z - start.z) - 0.24) < 1e-9);
  for (let tick = 0; tick < 100; tick++) {
    assert.equal(context.validRoute(unit), true); context.advance([unit], 0.1, () => 2.4);
  }
  assert.deepEqual({ x: unit.x, z: unit.z }, context.graph.pointAt(cell(10, 10)));
  assert.deepEqual(unit.path, []); assert.equal(unit.moveGoalCell, -1);
  for (const [x, z] of [[-9.5, -9.5], [10, 0], [NaN, 0]]) assert.equal(context.plan(unit, x, z, [unit]).status, 'invalid-endpoints');
});

test('Stop between centers remains recoverable and replans without diagonal shore cutting', () => {
  const context = runtime(), unit = boat(context); move(context, unit, cell(10, 4));
  context.advance([unit], 0.1, () => 2.4);
  unit.path = []; unit.pathIndex = 0; unit.moveGoalCell = -1;
  const recovered = structuredClone(unit); assert.equal(context.validRoute(recovered), true);
  move(context, recovered, cell(4, 10));
  for (let tick = 0; tick < 100; tick++) {
    assert.equal(context.validRoute(recovered), true); context.advance([recovered], 0.1, () => 2.4);
  }
  assert.deepEqual({ x: recovered.x, z: recovered.z }, context.graph.pointAt(cell(4, 10)));
});

test('other-seat hull occupancy pauses a stale route and clears safely without losing its destination', () => {
  const context = runtime(), unit = boat(context), other = boat(context, 5, 4); other.team = 1;
  move(context, unit, cell(10, 4)); const route = [...unit.path];
  context.advance([unit, other], 0.1, () => 2.4);
  assert.equal(unit.waterMoveBlocked, true); assert.deepEqual(unit.path, route);
  assert.equal(unit.moveGoalCell, cell(10, 4));
  assert.equal(waterUnitOccupiedCells(context.graph, unit).some(cell => waterUnitOccupiedCells(context.graph, other).includes(cell)), false);
  other.hp = 0; context.advance([unit, other], 0.1, () => 2.4);
  assert.equal(unit.waterMoveBlocked, false); assert.ok(unit.x > context.graph.pointAt(cell(4, 4)).x);
});

test('boat reservations exclude both seats, dead boats and the actor requesting its own route', () => {
  const context = runtime(), unit = boat(context), other = boat(context, 10, 4);
  assert.equal(context.plan(unit, other.x, other.z, [unit, other]).status, 'invalid-endpoints');
  other.hp = 0; assert.equal(context.plan(unit, other.x, other.z, [unit, other]).status, 'found');
  assert.deepEqual(context.reservations([unit]), waterUnitOccupiedCells(context.graph, unit));
  assert.equal(context.plan(unit, unit.x, unit.z, [unit]).status, 'found');
});

test('islands, raised water, disconnected basins, bounded searches and forged paths stay explicit', () => {
  const definition = { width: 20, height: 20, obstacles: [
    { material: 'water', column: 2, row: 2, width: 6, height: 12 },
    { material: 'water', column: 10, row: 2, width: 6, height: 12 }] };
  const context = createWaterUnitRuntime(definition), unit = boat(context);
  const point = context.graph.pointAt(cell(12, 5));
  assert.equal(context.plan(unit, point.x, point.z, [unit]).status, 'disconnected');
  const same = context.graph.pointAt(cell(5, 10));
  assert.equal(context.plan(unit, same.x, same.z, [unit], 1).status, 'budget-exhausted');
  unit.path = [cell(4, 4), cell(5, 5)]; unit.moveGoalCell = cell(5, 5);
  assert.equal(context.validRoute(unit), false);
  unit.path = [cell(4, 4), cell(9, 4)]; unit.moveGoalCell = cell(9, 4);
  assert.equal(context.validRoute(unit), false);
  const raised = createWaterUnitRuntime({ ...map, elevationPatches: [{ column: 4, row: 4, width: 1, height: 1, level: 1 }] });
  assert.equal(raised.validRoute(boat(raised)), false);
});

test('water tick leaves land actors and authored geometry unchanged', () => {
  const source = structuredClone(map), context = createWaterUnitRuntime(source), unit = boat(context);
  const land = { ...boat(context, 10, 10), movementDomain: undefined, kind: 'infantry' };
  const before = structuredClone(land); move(context, unit, cell(10, 4), [unit, land]);
  source.obstacles.length = 0;
  context.advance([unit, land], 0.1, () => 2.4);
  assert.deepEqual(land, before); assert.equal(context.validRoute(unit), true);
});

test('independently planned adjacent arrivals can both sail away without deadlocking admission', () => {
  const context = runtime(), a = boat(context, 4, 4), b = boat(context, 8, 4);
  move(context, a, cell(5, 4), [a, b]); move(context, b, cell(6, 4), [a, b]);
  for (let tick = 0; tick < 25; tick++) context.advance([a, b], .1, () => 2.4);
  assert.equal(context.graph.cellAt(a.x, a.z), cell(5, 4));
  assert.equal(context.graph.cellAt(b.x, b.z), cell(6, 4));
  move(context, a, cell(3, 4), [a, b]); move(context, b, cell(9, 4), [a, b]);
  for (let tick = 0; tick < 25; tick++) {
    context.advance([a, b], .1, () => 2.4);
    assert.ok(!waterUnitOccupiedCells(context.graph, a).some(cell => waterUnitOccupiedCells(context.graph, b).includes(cell)));
  }
  assert.equal(context.graph.cellAt(a.x, a.z), cell(3, 4));
  assert.equal(context.graph.cellAt(b.x, b.z), cell(9, 4));
});

test('idle and completed checkpoints require recoverable centerline/center positions', () => {
  const context = runtime(), unit = boat(context);
  unit.x += .2; unit.z += .2; assert.equal(context.validRoute(unit), false);
  unit.z -= .2; assert.equal(context.validRoute(unit), true, 'mid-edge Stop is recoverable');
  unit.path = [cell(4, 4)]; unit.pathIndex = 1; unit.moveGoalCell = cell(4, 4);
  assert.equal(context.validRoute(unit), false, 'completed route must reach exact center');
  unit.x -= .2; assert.equal(context.validRoute(unit), true);
});
