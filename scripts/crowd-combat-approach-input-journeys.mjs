import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as movement from '../src/unit-movement.mjs';
import * as crowd from '../src/unit-crowd-steering.mjs';
import { workerPatrolAcquiredMovementActive } from '../src/combat-movement.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const start = server.indexOf('function getMoveVector('), end = server.indexOf('// Local body adoption', start);
assert.ok(start >= 0 && end > start, 'production movement/input boundaries');

function fixture({ legacy = false, otherOccupied = false, denied = false } = {}) {
  const width = 16, height = 16;
  const point = c => ({ x: c % width - 8 + .5, z: Math.floor(c / width) - 8 + .5 });
  const cell = (x, z) => Math.floor(z + 8) * width + Math.floor(x + 8);
  const base = { kind: 'worker', hp: 100, generation: 1, orderRevision: 2,
    movementDomain: 'land', movePlanningPending: false, gatherNodeId: null,
    gatherForestCell: -1, gatherPhase: '', buildingTargetId: null, attackBuildingTargetId: -1 };
  const unit = { ...base, id: 1, team: 0, x: 4.001, z: .9536390482584135,
    path: [cell(5.5, .5)], pathIndex: 0, moveGoalCell: cell(5.5, .5), moveGoalPoint: null,
    queuedWaypoints: [], attackMove: true, persistentOrder: { type: 'patrol' }, attackTargetId: 8 };
  const target = { ...base, id: 8, team: 1, x: 5.5, z: .5, path: [], pathIndex: 0, attackTargetId: -1 };
  const parked = { ...base, id: 4, team: 0, kind: 'infantry', x: 2.5, z: .5,
    path: [], pathIndex: 0, holdingPosition: true, attackTargetId: -1 };
  const neighbors = [parked, target], units = [];
  for (const actor of [unit, ...neighbors]) units[actor.id] = actor;
  if (otherOccupied) { const other = { ...parked, id: 9, x: 5.5, z: .75 }; neighbors.push(other); units[9] = other; }
  const isWalkable = c => c >= 0 && c < width * height;
  const context = vm.createContext({ ...movement, ...crowd, UNIT_DEFINITIONS, units,
    workerPatrolAcquiredMovementActive, STEP_SECONDS: 1 / 30, SEPARATION_DIAGNOSTICS_ENABLED: false,
    // The caller owns activation. This fixture supplies the agreed acquired
    // Patrol radius to isolate the real shared input and unchanged selector.
    workerLocalBodyRadius: actor => workerPatrolAcquiredMovementActive(actor) ? .18 : 0,
    MAP_WIDTH: width, MAP_HEIGHT: height, MAP_HALF_X: 8, MAP_HALF_Z: 8,
    elevationLevelByCell: new Uint8Array(width * height), spatialBucketRosterCurrent: true,
    cellToWorld: point, worldToCell: cell, isWalkable, tickNumber: 1, navigationRevision: 0, movePlanningEpoch: 0,
    crowdNeighborsNear: () => ({ neighbors, visits: neighbors.length, overflow: false }) });
  vm.runInContext(server.slice(start, end), context);
  if (legacy) context.workerPatrolApproachBody = () => null;
  if (denied) context.canTraverseStaticBodySegment = (from, to) => from === to;
  return { unit, target, parked, neighbors, context, point, cell, width, height, isWalkable,
    select: () => context.getMoveVector(unit) };
}

test('actual acquired Worker Patrol target permits safe approach into existing weapon range', () => {
  const old = fixture({ legacy: true }), f = fixture();
  const refusal = old.select(); assert.ok(refusal.waitingForCrowd); assert.equal(refusal.crowdControl.proposals, 0);
  const original = structuredClone([f.unit, ...f.neighbors]); let steps = 0;
  while (Math.hypot(f.target.x - f.unit.x, f.target.z - f.unit.z) > UNIT_DEFINITIONS.worker.combat.range && steps < 20) {
    const result = f.select(); assert.ok(!result.waitingForCrowd && result.stepDistance > 0);
    const to = result.reachedWaypoint ? result.target
      : { x: f.unit.x + result.x * result.stepDistance, z: f.unit.z + result.z * result.stepDistance };
    assert.ok(movement.canTraverseStaticBodySegment(f.unit, to, .18, f.width, f.height, f.isWalkable));
    assert.ok(crowd.canTraverseCrowdBodySegment(f.unit, to, .18, f.neighbors));
    assert.ok(result.crowdControl.proposals <= crowd.CROWD_PROPOSAL_LIMIT);
    f.unit.x = to.x; f.unit.z = to.z; f.context.tickNumber++; steps++;
  }
  assert.ok(steps > 0 && steps < 20);
  assert.ok(Math.hypot(f.target.x - f.unit.x, f.target.z - f.unit.z) <= UNIT_DEFINITIONS.worker.combat.range);
  assert.deepEqual(f.neighbors, original.slice(1), 'target and parked peer retain every field');
  assert.deepEqual({ ...f.unit, x: original[0].x, z: original[0].z }, original[0], 'route, order and range policy stay intact');
});

test('unrelated occupied endpoint still waits while the actual target remains collidable', () => {
  const f = fixture({ otherOccupied: true }); const result = f.select();
  assert.ok(result.waitingForCrowd); assert.equal(result.crowdControl.proposals, 0);
  assert.equal(crowd.canTraverseCrowdBodySegment({ x: 5.12, z: .5 }, { x: 5.2, z: .5 }, .18, f.neighbors), false);
});

test('an approach body cannot bypass the terrain sweep or physical target contact', () => {
  const f = fixture({ denied: true }); const result = f.select();
  assert.ok(result.waitingForCrowd); assert.equal(result.stepDistance, 0);
  assert.ok(result.crowdControl.proposals > 0, 'approach enters the original physical oracle');
  assert.equal(crowd.canTraverseCrowdBodySegment({ x: 5.12, z: .5 }, { x: 5.2, z: .5 }, .18, f.neighbors), false);
});

for (const [label, change] of [
  ['missing target', f => { f.context.units[8] = undefined; }],
  ['dead target', f => { f.target.hp = 0; }],
  ['friendly target', f => { f.target.team = f.unit.team; }],
  ['different domain', f => { f.target.movementDomain = 'water'; }],
  ['different waypoint cell', f => { f.target.x = 6.5; }],
  ['intermediate waypoint', f => { f.unit.path.push(f.unit.path[0] + 1); }],
  ['pending route', f => { f.unit.movePlanningPending = true; }],
  ['direct acquired AttackMove', f => { f.unit.persistentOrder = null; }],
  ['construction replacement', f => { f.unit.buildingTargetId = 7; }],
  ['reused slot identity', f => { f.target.id = 9; }],
]) test(`${label} cannot acquire the endpoint approach input`, () => {
  const f = fixture(); change(f);
  assert.equal(f.context.workerPatrolApproachBody(f.unit, f.point(f.unit.path[f.unit.pathIndex])), null);
});

test('default and a same-ID clone retain the original occupied target refusal', () => {
  for (const approachBody of [null, { id: 8 }]) {
    const f = fixture();
    const result = crowd.selectCrowdStep({ unit: f.unit, target: f.target, approachBody,
      radius: .18, stepDistance: .08, neighbors: f.neighbors, canTraverse: () => true });
    assert.ok(result.waitingForCrowd); assert.equal(result.crowdControl.proposals, 0);
  }
});


test('a short target-contact proposal still waits when the permitted forward corridor has no clear step', () => {
  const f = fixture(); Object.assign(f.unit, { x: 5.12, z: .5 });
  const before = structuredClone([f.unit, ...f.neighbors]);
  const to = { x: 5.2, z: .5 };
  assert.ok(Math.hypot(to.x - f.unit.x, to.z - f.unit.z) < .25, 'within the bounded physical sweep limit');
  assert.equal(crowd.canTraverseCrowdBodySegment(f.unit, to, .18, f.neighbors), false);
  const result = crowd.selectCrowdStep({ unit: f.unit, target: f.target, approachBody: f.target,
    radius: .18, stepDistance: .08, neighbors: f.neighbors,
    canTraverse: p => p.x >= f.unit.x && Math.abs(p.z - f.unit.z) < 1e-12 });
  assert.ok(result.waitingForCrowd); assert.equal(result.stepDistance, 0);
  assert.ok(result.crowdControl.proposals > 0);
  assert.deepEqual([f.unit, ...f.neighbors], before);
});
