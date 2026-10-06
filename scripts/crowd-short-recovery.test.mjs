import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as movement from '../src/unit-movement.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { constructionMovementActive } from '../src/construction-work-intent.mjs';
import { workerPatrolAcquiredMovementActive } from '../src/combat-movement.mjs';

const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const selector = readFileSync(new URL('../src/unit-crowd-steering.mjs', import.meta.url), 'utf8');
// Test-only counterfactual removes exactly the newly added fallback. Every
// existing priority, body/static oracle, query and controller body stays real.
const fallbackStart = selector.indexOf('  // Tight moving queues');
const fallbackEnd = selector.indexOf('  return best ? { ...best, noProgressTicks, crowdControl: stats }', fallbackStart);
assert.ok(fallbackStart >= 0 && fallbackEnd > fallbackStart);
const originalSelector = selector.slice(0, fallbackStart) + selector.slice(fallbackEnd);
let moduleId = 0;
async function selectorModule({ original = false } = {}) {
  const source = (original ? originalSelector : selector).replace(/from '(\.\/?[^']+)'/g,
    (_, relative) => `from '${new URL(relative, new URL('../src/unit-crowd-steering.mjs', import.meta.url)).href}'`);
  return import(`data:text/javascript,${encodeURIComponent(source)}#control-${moduleId++}`);
}

// Complete four-actor public-source input; no checkpoint, private route payload
// or omitted query body. Poses are a small retained-geometry reduction. Frozen
// calls at 0/40 test the decision, not original live onset or persistent identity.
async function fixture({ original = false, mirror = false, terminal = false, tight = false, unclaimed = false } = {}) {
  const crowd = await selectorModule({ original });
  const width = 96, height = 64, sign = mirror ? -1 : 1, size = 1.2;
  const columns = Math.ceil(width / size), rows = Math.ceil(height / size);
  const cell = (x, z) => Math.floor(z + height / 2) * width + Math.floor(x + width / 2);
  const point = c => ({ x: c % width - width / 2 + .5, z: Math.floor(c / width) - height / 2 + .5 });
  const current = cell(sign * 1.5, sign * .5), next = cell(sign * .5, sign * .5);
  const actor = (id, x, z, goalX, goalZ, path) => ({ id, team: Number(mirror), kind: 'infantry', hp: 100,
    generation: 1, orderRevision: 2, x: sign * x, z: sign * z, movementDomain: 'land',
    path: path ?? [current, next, cell(sign * goalX, sign * goalZ)], pathIndex: 0,
    moveGoalCell: cell(sign * goalX, sign * goalZ), moveGoalPoint: null, movePlanningPending: false,
    queuedWaypoints: [{ destination: cell(sign * 16.5, sign * .5) }],
    attackTargetId: -1, attackBuildingTargetId: -1, buildingTargetId: null,
    gatherNodeId: null, gatherForestCell: -1, gatherPhase: '', attackMove: false });
  const unit = actor(75, 1.22, -.2978933805686979, -9.5, -3.5);
  const peers = [actor(73, 1.6197654835997641, -.08754899210976148, -11.5, -3.5),
    actor(95, 1.22, tight ? unit.z - .44 : -.7423664598313029, -6.5, -3.5),
    actor(110, 1.1972125275761414, .14556298048009927, -7.5, .5,
      [next, cell(sign * -.5, sign * .5), cell(sign * -7.5, sign * .5)])];
  if (unclaimed) for (const peer of peers) {
    const goal = point(peer.moveGoalCell); peer.moveGoalCell = cell(goal.x, sign * .5);
    peer.path[peer.path.length - 1] = peer.moveGoalCell;
  }
  if (terminal) unit.path = [current];
  const units = [], heads = new Int32Array(columns * rows).fill(-1), links = new Int32Array(111).fill(-1);
  const column = x => Math.max(0, Math.min(columns - 1, Math.floor((x + width / 2) / size)));
  const row = z => Math.max(0, Math.min(rows - 1, Math.floor((z + height / 2) / size)));
  for (const body of [unit, ...peers]) { units[body.id] = body; const bucket = row(body.z) * columns + column(body.x);
    links[body.id] = heads[bucket]; heads[bucket] = body.id; }
  const wallColumn = mirror ? 47 : 48, openingRow = mirror ? 31 : 32;
  const isWalkable = c => c >= 0 && c < width * height
    && (c % width !== wallColumn || Math.floor(c / width) === openingRow);
  const context = vm.createContext({ ...movement, ...crowd, UNIT_DEFINITIONS, constructionMovementActive,
    workerPatrolAcquiredMovementActive, units, STEP_SECONDS: 1 / 30,
    MAP_WIDTH: width, MAP_HEIGHT: height, MAP_HALF_X: width / 2, MAP_HALF_Z: height / 2,
    SPATIAL_BUCKET_SIZE: size, spatialBucketColumns: columns, spatialBucketRows: rows,
    spatialBucketHeads: heads, spatialBucketNext: links, spatialBucketColumn: column, spatialBucketRow: row,
    spatialBucketRosterCurrent: true, elevationLevelByCell: new Uint8Array(width * height),
    cellToWorld: point, worldToCell: cell, isWalkable, SEPARATION_DIAGNOSTICS_ENABLED: false,
    tickNumber: 0, navigationRevision: 0, movePlanningEpoch: 0 });
  const start = server.indexOf('function getMoveVector('), end = server.indexOf('function stationaryWorkerCellsNear(', start);
  assert.ok(start >= 0 && end > start, 'real host query/selection boundaries');
  vm.runInContext(server.slice(start, end), context);
  return { crowd, context, unit, peers, point, current, width, height, isWalkable,
    select(tick) { context.tickNumber = tick; return context.getMoveVector(unit); } };
}

for (const mirror of [false, true]) test(`a bounded prefix of existing yielding recovery admits safe waypoint progress, mirror=${mirror}`, async () => {
  const old = await fixture({ original: true, mirror }), f = await fixture({ mirror });
  old.select(0); const refusal = old.select(40);
  assert.ok(refusal.waitingForCrowd); assert.equal(refusal.stepDistance, 0);
  const query = f.context.crowdNeighborsNear(f.unit);
  assert.equal(query.visits, 4); assert.equal(query.overflow, false);
  assert.deepEqual(Array.from(query.neighbors, u => u.id), [73, 95, 110]);
  const before = structuredClone([f.unit, ...f.peers]); f.select(0); const result = f.select(40);
  assert.ok(!result.waitingForCrowd && result.yieldingForCrowd, 'the original yielding policy remains active');
  assert.ok(result.stepDistance > .001 && result.stepDistance < 2.6 / 60);
  const to = { x: f.unit.x + result.x * result.stepDistance, z: f.unit.z + result.z * result.stepDistance };
  const raw = f.point(f.current);
  const gain = Math.hypot(raw.x - f.unit.x, raw.z - f.unit.z) - Math.hypot(raw.x - to.x, raw.z - to.z);
  assert.ok(gain > .0001, `fixed-waypoint gain ${gain}`);
  assert.ok(movement.canTraverseStaticBodySegment(f.unit, to, .22, f.width, f.height, f.isWalkable));
  assert.ok(f.crowd.canTraverseCrowdBodySegment(f.unit, to, .22, f.peers));
  assert.ok(result.crowdControl.proposals <= f.crowd.CROWD_PROPOSAL_LIMIT);
  assert.ok(result.crowdControl.proposals - refusal.crowdControl.proposals <= 12);
  assert.deepEqual([f.unit, ...f.peers], before, 'no pose, path, goal, queue or neighbor write during selection');
});

for (const [label, options, tick] of [['before recovery age', {}, 0], ['terminal route', { terminal: true }, 40],
  ['no opposing priority claimant', { unclaimed: true }, 40]])
  test(`${label} retains the original selection exactly`, async () => {
    const old = await fixture({ ...options, original: true }), f = await fixture(options);
    if (tick) { old.select(0); f.select(0); }
    assert.deepEqual(structuredClone(f.select(tick)), structuredClone(old.select(tick)));
  });

test('every rejected short prefix remains physically rejected under tangency and overflow', async () => {
  const f = await fixture({ tight: true }); f.select(0); const result = f.select(40);
  if (!result.waitingForCrowd) {
    const to = { x: f.unit.x + result.x * result.stepDistance, z: f.unit.z + result.z * result.stepDistance };
    assert.ok(f.crowd.canTraverseCrowdBodySegment(f.unit, to, .22, f.peers));
    assert.ok(movement.canTraverseStaticBodySegment(f.unit, to, .22, f.width, f.height, f.isWalkable));
  }
  const overflow = f.crowd.selectCrowdStep({ unit: f.unit, target: f.point(f.current), radius: .22,
    stepDistance: 2.6 / 30, neighbors: f.peers, overflow: true, tick: 80,
    canTraverse() { throw Error('overflow must not query physical proposals'); } });
  assert.ok(overflow.waitingForCrowd); assert.equal(overflow.crowdControl.proposals, 0);
});
