// Bounded synthetic host controls: actual selector and serial land executor.
// No retained private decision, native match, journey, renderer or deadline change.
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as movement from '../src/unit-movement.mjs';
import * as crowd from '../src/unit-crowd-steering.mjs';
import * as protocol from '../src/crowd-moving-entitlement.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';

const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('function getMoveVector('), source.indexOf('function stationaryWorkerCellsNear('));
const comment = source.indexOf('    // A target can move within its current cell after the flow path ends.');
const start = source.lastIndexOf('  for (const unit of units) {', comment);
const executor = source.slice(start, source.indexOf('  enqueueRouteRepairs(blockedRouteRepairs);', start));
assert.ok(start >= 0 && executor.includes('crowdFollowingStepAllowed') && executor.includes('finalizeCrowdMovement'));
const actor = (id, x, z, index = 0) => ({ id, x, z, team: 0, generation: 17 + id, orderRevision: 8,
  kind: 'infantry', hp: 100, path: [60, 63, 55, 7], pathIndex: index, moveGoalCell: 7,
  attackTargetId: -1, attackBuildingTargetId: -1, gatherNodeId: null, gatherForestCell: -1,
  buildingTargetId: null, queuedWaypoints: [{ destination: 15 }],
  moveGoalPoint: { version: 1, generation: 17 + id, revision: 8, cell: 7, x: 3.5, z: -3.5 } });
function host(offset = 0) {
  const unit = actor(2, .5, .5), peer = actor(1, .92, .85, 1), blocker = actor(3, .1, .7);
  const units = [peer, unit, blocker];
  for (const u of units) { u.x += offset; u.z += offset; }
  const c = vm.createContext({ ...movement, ...crowd, ...protocol, UNIT_DEFINITIONS, units: [unit],
    STEP_SECONDS: 1 / 30, MAP_WIDTH: 8, MAP_HEIGHT: 8, MAP_HALF_X: 4, MAP_HALF_Z: 4,
    worldToCell: (x, z) => Math.floor(z + 4) * 8 + Math.floor(x + 4),
    cellToWorld: cell => ({ x: cell % 8 - 3.5, z: Math.floor(cell / 8) - 3.5 }),
    isWalkable: cell => cell >= 0 && cell < 64, elevationLevelByCell: new Uint8Array(64),
    tickNumber: 40, navigationRevision: 3, movePlanningEpoch: 5,
    spatialBucketRosterCurrent: true, SEPARATION_DIAGNOSTICS_ENABLED: false,
    constructionMovementActive: () => false, workerPatrolAcquiredMovementActive: () => false,
    automaticPositionAllowed: () => true, blockedRouteRepairs: [], dirty: false,
    detourRouteLedger: null, landRouteRetentionTick: null });
  vm.runInContext(helpers, c);
  c.crowdNeighborsNear = u => ({ neighbors: units.filter(other => other !== u && other.hp > 0),
    overflow: false, visits: units.length });
  c.run = () => vm.runInContext(executor, c);
  for (const u of units) c.getMoveVector(u);
  for (const u of units) Object.assign(crowd.crowdSteeringRecord(u), { lastProgressTick: 0, bestDistance: 0 });
  // Capture a real selector proposal, then optionally change live state before
  // the executor's independent fresh admission. No selection result is invented.
  const get = c.getMoveVector;
  const h = { c, unit, peer, blocker, units, select: get, proposal: null };
  c.getMoveVector = (...args) => {
    h.proposal = get(...args);
    assert.ok(h.proposal?.crowdFollowingPoint, 'actual selector found the synthetic sole-following continuation: ' + JSON.stringify(h.proposal));
    h.beforeWrite?.(h.proposal);
    return h.proposal;
  };
  return h;
}

test('default selector and actual executor retain only the exact admitted sole-following step', () => {
  const h = host(), before = { x: h.unit.x, z: h.unit.z }, path = h.unit.path, queue = h.unit.queuedWaypoints;
  h.c.run();
  assert.deepEqual({ x: h.unit.x, z: h.unit.z }, h.proposal.crowdFollowingPoint);
  assert.notDeepEqual({ x: h.unit.x, z: h.unit.z }, before);
  assert.ok(h.unit.z > before.z && Math.hypot(.5 - h.unit.x, 3.5 - h.unit.z) < 3);
  assert.equal(h.unit.path, path); assert.equal(h.unit.pathIndex, 0); assert.equal(h.unit.queuedWaypoints, queue);
  const s = crowd.crowdSteeringRecord(h.unit);
  assert.equal(s.lastProgressTick, 0, 'selection or write does not manufacture historical net progress');
  assert.equal(s.lastGrantTick, -Infinity); assert.equal(s.lease, null);
  assert.ok(s.execution.spent <= h.c.crowdNextBudget(h.unit) + 1e-9);
  assert.ok(s.execution.work.proposals <= 128);
  assert.ok(crowd.canTraverseCrowdBodySegment(before, h.unit, .22, [h.peer, h.blocker]));
});

for (const [name, change] of [
  ['command', h => h.unit.orderRevision++],
  ['birth', h => h.unit.generation++],
  ['path identity', h => { h.unit.path = [...h.unit.path]; }],
  ['path index', h => h.unit.pathIndex++],
  ['navigation', h => h.c.navigationRevision++],
  ['restore epoch', h => h.c.movePlanningEpoch++],
  ['query overflow', h => { const near = h.c.crowdNeighborsNear; h.c.crowdNeighborsNear = u => ({ ...near(u), overflow: true }); }],
  ['roster stale', h => { h.c.spatialBucketRosterCurrent = false; }],
  ['travel spent', h => { crowd.crowdExecutionState(h.unit, h.c.tickNumber).spent = h.c.crowdNextBudget(h.unit); }],
  ['work exhausted', h => { crowd.crowdExecutionState(h.unit, h.c.tickNumber).work.proposals = 128; }],
  ['work exhausted after fresh admission', h => { crowd.crowdExecutionState(h.unit, h.c.tickNumber).work.proposals = 127; }],
  ['bounds', h => { h.c.MAP_HALF_X = .75; }],
  ['automatic policy', h => { h.c.automaticPositionAllowed = () => false; }],
  ['cell transition', h => { h.c.canTraverseUnitStep = () => false; }],
  ['static sweep', h => { h.c.canTraverseStaticBodySegment = () => false; }],
  ['original Worker write guard', h => { h.c.workerBodyStepAllowed = () => false; }],
  ['new body contact', h => {
    const to = h.proposal.crowdFollowingPoint, length = Math.hypot(to.x - h.unit.x, to.z - h.unit.z);
    h.blocker.x = to.x + .42 * (to.x - h.unit.x) / length;
    h.blocker.z = to.z + .42 * (to.z - h.unit.z) / length;
    assert.ok(Math.hypot(h.blocker.x - h.unit.x, h.blocker.z - h.unit.z) > .44);
  }],
  ['second original claimant', h => {
    h.units.push(actor(0, .2, .9));
    const c = h.c.crowdEntitlementContext(h.unit);
    assert.equal(c.claims(h.unit, h.proposal.crowdFollowingPoint).length, 2);
    assert.ok(c.admit(h.unit, h.unit, h.proposal.crowdFollowingPoint), 'the new second claim is physically clear');
  }],
]) test(`actual following write refuses fresh ${name}`, () => {
  const h = host(), from = { x: h.unit.x, z: h.unit.z };
  let path, index, queue;
  h.beforeWrite = () => { change(h); path = h.unit.path; index = h.unit.pathIndex; queue = h.unit.queuedWaypoints; };
  h.c.run();
  assert.deepEqual({ x: h.unit.x, z: h.unit.z }, from);
  assert.equal(h.unit.path, path); assert.equal(h.unit.pathIndex, index); assert.equal(h.unit.queuedWaypoints, queue);
  assert.equal(h.c.blockedRouteRepairs.length, 0);
  assert.ok(crowd.crowdExecutionState(h.unit, h.c.tickNumber).work.proposals <= 128);
});

for (const whom of ['unit', 'peer']) for (const [name, change] of [
  ['command stamp', (u, s) => { s.revision--; }],
  ['birth stamp', (u, s) => { s.generation--; }],
  ['route stamp', (u, s) => { s.path = [...u.path]; }],
  ['index stamp', (u, s) => { s.pathIndex++; }],
  ['navigation stamp', (u, s) => { s.navigationRevision--; }],
  ['epoch stamp', (u, s) => { s.epoch--; }],
  ['old observation', (u, s) => { s.lastTick -= 2; }],
  ['future observation', (u, s) => { s.lastTick++; }],
  ['detour', (u, s) => { s.detour = { x: 1, z: 1 }; }],
  ['passage lease', (u, s) => { s.lease = { peer: null, until: 50 }; }],
  ['ingress obligation', (u, s) => { s.lease = { kind: 'ingress-obligation', generation: u.generation }; }],
  ['contour', (u, s) => { s.contour = { x: 1, z: 1 }; }],
  ['ordinary activation', u => { u.attackMove = true; }],
]) test(`actual following write rechecks ${whom} ${name}`, () => {
  const h = host(), from = { x: h.unit.x, z: h.unit.z };
  h.beforeWrite = () => change(h[whom], crowd.crowdSteeringRecord(h[whom]));
  h.c.run(); assert.deepEqual({ x: h.unit.x, z: h.unit.z }, from);
});

test('a fresh live capsule blocks a following endpoint that remains clear of current bodies', () => {
  const h = host(), from = { x: h.unit.x, z: h.unit.z };
  h.beforeWrite = () => {
    const to = h.proposal.crowdFollowingPoint, owner = actor(4, to.x + .5, to.z + .02, 1);
    h.units.push(owner); h.select(owner);
    const c = h.c.crowdEntitlementContext(owner);
    const r = { owner, from: { x: owner.x, z: owner.z }, to: { x: owner.x - .08, z: owner.z },
      radius: .22, stamp: protocol.crowdMovementStart(owner, c).stamp, tick: h.c.tickNumber,
      winner: h.peer, request: null, attempted: false };
    crowd.crowdMovingEntitlement.slot(owner).reservation = r;
    assert.ok(crowd.crowdMovingEntitlement.live(r, c));
    assert.ok(h.c.crowdEntitlementContext(h.unit).admit(h.unit, h.unit, to));
  };
  h.c.run(); assert.deepEqual({ x: h.unit.x, z: h.unit.z }, from);
  assert.ok(crowd.crowdExecutionState(h.unit, h.c.tickNumber).work.reservationVisits > 0);
});

for (const guard of ['cell', 'static']) test(`a later ${guard} rejection cannot spend the waiver on a fallback endpoint`, () => {
  const h = host(), from = { x: h.unit.x, z: h.unit.z };
  h.beforeWrite = () => {
    const admit = h.c.crowdFollowingStepAllowed;
    h.c.crowdFollowingStepAllowed = (...args) => {
      assert.equal(admit(...args), true, 'fresh ordinary endpoint passed all continuation guards');
      h.c[guard === 'cell' ? 'canTraverseUnitStep' : 'canTraverseStaticBodySegment'] = () => false;
      return true;
    };
  };
  h.c.run(); assert.deepEqual({ x: h.unit.x, z: h.unit.z }, from);
  assert.equal(h.c.blockedRouteRepairs.length, 0);
});

test('actual write retains a non-round-tripping following endpoint after its own fresh admission', () => {
  const h = host(-.5); let to;
  h.beforeWrite = () => {
    // Isolate exact consumption. Real proposal selection is covered separately;
    // this generic short endpoint must independently pass the full fresh guards.
    for (const dx of [.01, .02, .03, .04, .05]) for (const dz of [.02, .03, .04, .05]) {
      const point = { x: h.unit.x + dx, z: h.unit.z + dz };
      const length = Math.hypot(point.x - h.unit.x, point.z - h.unit.z);
      if (!to && (h.unit.x + (point.x - h.unit.x) / length * length !== point.x
        || h.unit.z + (point.z - h.unit.z) / length * length !== point.z)
        && h.c.crowdFollowingStepAllowed(h.unit, point)) to = point;
    }
    assert.ok(to, 'synthetic endpoint exposes reconstruction rounding and passes fresh admission');
    const length = Math.hypot(to.x - h.unit.x, to.z - h.unit.z);
    Object.assign(h.proposal, { crowdFollowingPoint: to,
      x: (to.x - h.unit.x) / length, z: (to.z - h.unit.z) / length, stepDistance: length });
  };
  h.c.run(); assert.deepEqual({ x: h.unit.x, z: h.unit.z }, to);
});
