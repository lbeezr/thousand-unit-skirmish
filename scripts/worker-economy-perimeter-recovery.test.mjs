import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createWorkerPerimeterRecovery, WORKER_PERIMETER_RECOVERY_LIMITS } from '../src/economy-perimeter-recovery.mjs';
import { createWorkerPerimeterAccess } from '../src/economy-perimeter-access.mjs';
import * as movement from '../src/unit-movement.mjs';
import { workerPerimeterServerFunctions } from './economy-server-fixture.mjs';

const actor = (id, team = 0, extra = {}) => ({ id, team, hp: 35, kind: 'worker', movementDomain: 'land',
  generation: 1, orderRevision: 2, x: -5.5, z: -5.5, gatherPhase: 'to-base', cargo: 10,
  cargoType: 'food', gatherNodeId: null, gatherForestCell: -1, dropoffBuildingId: 1,
  dropoffNavigationRevision: 0, moveGoalCell: 210, path: [210], pathIndex: 0,
  movePlanningPending: false, attackTargetId: -1, attackBuildingTargetId: -1, buildingTargetId: null, ...extra });
function service(units, overrides = {}) {
  const recovery = createWorkerPerimeterRecovery(), building = {}, calls = [];
  const args = { units, tick: 0, movePlanningEpoch: 0, navigationRevision: 0,
    targetFor: () => ({ building }), attempt: unit => { calls.push([unit.id, args.tick]); return { status: 'deferred' }; }, ...overrides };
  return { args, calls, step() { const result = recovery.run(args); args.tick++; return result; }, recovery };
}
test('30 consecutive stalled ticks, accumulated .02 progress and no per-tick retry/revision churn', () => {
  assert.deepEqual(WORKER_PERIMETER_RECOVERY_LIMITS, { stalledTicks: 30, progress: .02, attempts: 8, cooldownTicks: 30, units: 2000 });
  const unit = actor(0), s = service([unit]);
  for (let n = 0; n < 30; n++) assert.equal(s.step().attempts, 0);
  assert.equal(s.step().attempts, 1);
  for (let n = 0; n < 29; n++) assert.equal(s.step().attempts, 0);
  assert.equal(s.step().attempts, 1);
  assert.deepEqual(s.calls, [[0, 30], [0, 60]]); assert.equal(unit.orderRevision, 2);
  const moving = service([unit]);
  for (let n = 0; n < 100; n++) { unit.x += .005; assert.equal(moving.step().attempts, 0); }
});
test('eight fair attempts rotate past overflow/deferred actors with 30-tick actor cooldown', () => {
  const units = Array.from({ length: 25 }, (_, id) => actor(id)), s = service(units);
  for (let n = 0; n < 30; n++) s.step();
  assert.deepEqual([s.step().attempts, s.step().attempts, s.step().attempts, s.step().attempts], [8, 8, 8, 1]);
  assert.deepEqual(s.calls.map(([id]) => id), units.map(u => u.id));
  while (s.args.tick < 60) assert.equal(s.step().attempts, 0);
  assert.equal(s.step().attempts, 8);
  for (const unit of units) {
    const ticks = s.calls.filter(([id]) => id === unit.id).map(([, tick]) => tick);
    if (ticks.length > 1) assert.ok(ticks[1] - ticks[0] >= 30);
  }
  assert.equal(s.recovery.run({ ...s.args, tick: 60 }).attempts, 0, 'duplicate tick cannot spend twice');
});
for (const change of ['cancel', 'death', 'navigation', 'epoch', 'generation', 'revision', 'goal', 'source', 'recipient', 'cold'])
test(`${change}: stale observations cannot inherit a stalled window`, () => {
  const unit = actor(0), units = [unit], s = service(units);
  for (let n = 0; n < 25; n++) s.step();
  if (change === 'cancel') unit.gatherPhase = '';
  if (change === 'death') unit.hp = 0;
  if (change === 'navigation') s.args.navigationRevision++;
  if (change === 'epoch') s.args.movePlanningEpoch++;
  if (change === 'generation') unit.generation++;
  if (change === 'revision') unit.orderRevision++;
  if (change === 'source') unit.gatherNodeId = 'farm:2';
  if (change === 'recipient') unit.dropoffBuildingId++;
  if (change === 'goal') { unit.moveGoalCell++; unit.path = [unit.moveGoalCell]; }
  if (change === 'cold') units[0] = structuredClone(unit);
  for (let n = 0; n < 30; n++) assert.equal(s.step().attempts, 0);
  assert.equal(s.step().attempts, ['cancel', 'death'].includes(change) ? 0 : 1);
});
test('pending planning, nonfinal routes, target/range rejection, roster overflow and tick gaps defer', () => {
  for (const extra of [{ movePlanningPending: true }, { path: [] }, { path: [211] }]) {
    const s = service([actor(0, 0, extra)]); for (let n = 0; n < 40; n++) assert.equal(s.step().attempts, 0);
  }
  const range = service([actor(0)], { targetFor: () => null });
  for (let n = 0; n < 40; n++) assert.equal(range.step().attempts, 0);
  const large = service(Array.from({ length: 2001 }, (_, id) => actor(id)));
  for (let n = 0; n < 40; n++) assert.equal(large.step().observed, 0);
  const gap = service([actor(0)]); for (let n = 0; n < 29; n++) gap.step(); gap.args.tick++;
  assert.equal(gap.step().attempts, 0);
});

const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
function body(name) {
  const start = source.indexOf(`function ${name}(`), end = source.indexOf('\nfunction ', start + 1);
  assert.ok(start >= 0 && end > start); return source.slice(start, end);
}
function host(team, { overflow = false, claimOnly = false, xl = false } = {}) {
  const width = xl ? 320 : 20, height = width, cell = (x, z) => Math.floor(z + height / 2) * width + Math.floor(x + width / 2);
  const point = c => ({ x: c % width - width / 2 + .5, z: Math.floor(c / width) - width / 2 + .5 });
  const goal = cell(.5, .5), alternative = cell(2.5, .5), own = actor(0, team, { moveGoalCell: goal, path: [goal] });
  const blocker = actor(1, 1 - team, { kind: 'infantry', x: .5, z: .5, gatherPhase: '' });
  if (claimOnly) Object.assign(blocker, { kind: 'worker', team, x: 5.5, z: 5.5, gatherPhase: 'to-base',
    moveGoalCell: goal, path: [goal], dropoffNavigationRevision: 0 });
  const units = [own, blocker];
  if (overflow) for (let n = 0; n < 65; n++) units.push(actor(units.length, team, { x: 1.5, z: 1.5, gatherPhase: '' }));
  const building = { id: 1, team, hp: 100, complete: true, type: 'storehouse', footprint: [] };
  const context = vm.createContext({ ...movement, units, MAP_WIDTH: width, MAP_HEIGHT: height,
    MAP_HALF_X: width / 2, MAP_HALF_Z: height / 2, MAX_UNITS: 2000, MAX_RESOURCE_NODES: 512,
    XL_CHECKPOINT_ROUTE_MAX_ENTRIES: 1, resourceNodeStates: new Map(), dirty: false,
    movePlanningEpoch: 0, navigationRevision: 0, WORKER_INTERACTION_RANGE: 1.5,
    buildingsById: new Map([[1, building]]), acceptsProfileDropoff: () => true, matchEconomyProfileId: () => 'starter-stone',
    distanceToBuildingEdge: () => 3, nearestOpenCell: c => c, worldToCell: cell, cellToWorld: point,
    walkableComponents: new Uint8Array(width * height), buildingAccessCells: () => [goal],
    elevationLevelByCell: new Uint8Array(width * height), isWalkable: () => true,
    WALK_SPEED: 4, STEP_SECONDS: 1 / 30, workerFlowPath: (_u, p) => p,
    attackFlowFields: new Map(), getAttackFlowFieldForGoals: goals => ({ goals: new Set(goals) }),
    pathFromAttackFlow: (_s, field) => [...field.goals],
    workerPerimeterAccessScope: createWorkerPerimeterAccess({ units, width, height, maxUnits: 2000,
      epoch: 0, navigationRevision: 0, current: () => ({ epoch: 0, navigationRevision: 0 }) }),
    workerEconomyRouteScope: xl ? { ledger: null } : null });
  vm.runInContext(workerPerimeterServerFunctions + '\n' + body('applyWorkerFlowRoute') + '\n' + body('publishWorkerEconomyRoute'), context);
  return { context, own, units, building, goal, alternative };
}
for (const team of [0, 1]) for (const mode of ['no alternatives', 'overflow', 'claim only', 'XL refusal'])
test(`seat ${team}: ${mode} cannot alter a retained route or job`, () => {
  const h = host(team, { overflow: mode === 'overflow', claimOnly: mode === 'claim only', xl: mode === 'XL refusal' });
  if (mode === 'XL refusal') {
    h.context.buildingAccessCells = () => [h.goal, h.alternative];
    h.context.workerEconomyRouteScope.ledger = { check: () => ({ status: 'deferred' }) };
  }
  const before = structuredClone(h.own), path = h.own.path;
  assert.equal(h.context.reselectWorkerPerimeter(h.own, { building: h.building }).status, 'deferred');
  assert.deepEqual(h.own, before); assert.equal(h.own.path, path); assert.equal(h.context.dirty, false);
  assert.ok(h.context.workerPerimeterAccessScope.diagnostics.checks <= 256);
});
test('actual shared point exhaustion rotates fairly without restoring budget or publishing', () => {
  const h = host(0), recovery = service(h.units, { targetFor: u => h.context.workerPerimeterRecoveryTarget(u),
    attempt: (u, t) => h.context.reselectWorkerPerimeter(u, t) });
  for (let n = 0; n < 256; n++) h.context.workerPerimeterAccessScope.select(h.own, [h.goal]);
  for (let n = 0; n < 31; n++) recovery.step();
  assert.equal(h.context.workerPerimeterAccessScope.diagnostics.checks, 256);
  assert.equal(h.context.dirty, false); assert.equal(h.own.moveGoalCell, h.goal);
});
for (const pressure of ['points', 'visits']) test(`real ${pressure} deferral fairly reaches every due actor`, () => {
  const units = Array.from({ length: 25 }, (_, id) => actor(id));
  if (pressure === 'visits') for (let n = 0; n < 65; n++) units.push(actor(units.length, 1,
    { kind: 'infantry', gatherPhase: '', x: 1.5, z: 1.5 }));
  const calls = [], building = {}, args = { units, tick: 0, movePlanningEpoch: 0, navigationRevision: 0,
    targetFor: () => ({ building }), attempt: null };
  const recovery = createWorkerPerimeterRecovery();
  for (; args.tick < 30; args.tick++) recovery.run({ ...args, attempt: () => assert.fail('early query') });
  for (; args.tick < 34; args.tick++) {
    const scope = createWorkerPerimeterAccess({ units, width: 20, height: 20, maxUnits: 2000,
      epoch: 0, navigationRevision: 0, current: () => ({ epoch: 0, navigationRevision: 0 }) });
    if (pressure === 'points') for (let n = 0; n < 256; n++) scope.select(units[0], [210]);
    const result = recovery.run({ ...args, attempt: unit => {
      calls.push(unit.id); const selected = scope.select(unit, [unit.moveGoalCell]);
      assert.equal(selected.status, 'deferred'); return selected;
    } });
    assert.ok(result.attempts <= 8); assert.ok(scope.diagnostics.checks <= 256);
    scope.close();
  }
  assert.deepEqual(calls, Array.from({ length: 25 }, (_, id) => id));
  assert.ok(units.slice(0, 25).every(u => u.orderRevision === 2 && u.moveGoalCell === 210));
});
test('fresh physical occupation accepts an alternative while preserving every job field', () => {
  const h = host(0), before = structuredClone(h.own);
  h.context.buildingAccessCells = () => [h.goal, h.alternative];
  assert.equal(h.context.reselectWorkerPerimeter(h.own, { building: h.building }).status, 'ready');
  const expected = { ...before, path: [h.alternative], pathIndex: 0, moveGoalCell: h.alternative };
  assert.deepEqual(h.own, expected); assert.equal(h.context.dirty, true);
});
