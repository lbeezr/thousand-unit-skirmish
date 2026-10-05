import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCrowdServiceLedger } from './crowd-service-ledger.mjs';
import { createFiniteRoomProbe, inspectSelectedService } from './crowd-service-admission-probe.mjs';
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const width = 12, height = 12, step = 2.6 / 30;
const cell = (x, z) => Math.floor(z + height / 2) * width + Math.floor(x + width / 2);
const point = c => ({ x: c % width - width / 2 + .5, z: Math.floor(c / width) - height / 2 + .5 });
const map = { width, height, cell, point, levels: new Int8Array(width * height), isWalkable: () => true };
const unit = (id, x, z, target = { x: 2.5, z: .5 }) => ({ id, x, z, hp: 100, kind: 'infantry', team: 0,
  generation: 7, orderRevision: 3, path: [cell(target.x, target.z)], pathIndex: 0,
  moveGoalCell: cell(target.x, target.z), queuedWaypoints: [], gatherNodeId: null, buildingTargetId: null });
const origin = u => ({ id: u.id, x: u.x, z: u.z, raw: point(u.path[0]), generation: u.generation,
  orderRevision: u.orderRevision, pathIndex: 0, goal: u.moveGoalCell, queue: [],
  pathSha256: hash(u.path), pathLength: u.path.length });
function episode(mode) {
  const units = [unit(0, -1.5, .5), unit(1, 3.5, 3.5)];
  const config = { mode, ownerId: 0, angle: 180, startTick: 1, origins: units.map(origin), serviceOrigins: units.map(origin) };
  const probe = createFiniteRoomProbe(config);
  const ctx = { unit: units[0], units, tick: 1, navigationRevision: 2, epoch: 4, map, remainingStep: step,
    query: { visits: 0, overflow: false, neighbors: [] }, queryFor: () => ({ visits: 0, overflow: false, neighbors: [] }),
    normal: { x: 0, z: 0, target: point(units[0].path[0]), stepDistance: 0, waitingForCrowd: true }, hasGrant: false };
  return { probe, ctx };
}
test('unaccounted active entry refuses the seed permanently without moving anyone', () => {
  const { probe, ctx } = episode('entry'); ctx.units.push(unit(2, .5, .5));
  ctx.query = { visits: 1, overflow: false, neighbors: [ctx.units[2]] };
  const before = structuredClone(ctx.units); assert.equal(probe.select(ctx), ctx.normal);
  assert.deepEqual(ctx.units, before); assert.equal(probe.report.first.events.filter(e => e.type === 'retreat-step').length, 0);
  assert.deepEqual(probe.report.admission.events[0].uncovered, [2]);
  ctx.tick++; ctx.query.neighbors = []; assert.equal(probe.select(ctx), ctx.normal);
  assert.equal(probe.report.admission.events.length, 1);
});
test('a parked neighbor stays a physical obstacle and gains no movement or service requirement', () => {
  const { probe, ctx } = episode('entry'), parked = { ...unit(2, .5, .5), holdingPosition: true };
  ctx.units.push(parked); ctx.query = { visits: 1, overflow: false, neighbors: [parked] };
  const before = structuredClone(parked), move = probe.select(ctx);
  assert.equal(move.yieldingForCrowd, true); assert.ok(move.stepDistance <= ctx.remainingStep);
  assert.deepEqual(parked, before); assert.equal(probe.report.admission.events[0].status, 'admit');
});
test('return waiting expires after12 ticks while ordinary steering remains unchanged', () => {
  const { probe, ctx } = episode('return');
  for (let tick = 1; tick <= 24; tick++) {
    ctx.tick = tick; const move = probe.select(ctx), from = { x: ctx.unit.x, z: ctx.unit.z };
    ctx.unit.x += move.x * move.stepDistance; ctx.unit.z += move.z * move.stepDistance;
    const steps = move.stepDistance ? [{ id: 0, generation: 7, revision: 3, tick, navigationRevision: 2,
      from, to: { x: ctx.unit.x, z: ctx.unit.z } }] : [];
    if (tick > 9) assert.equal(move, ctx.normal);
    probe.observeExecuted({ units: ctx.units, steps, tick, navigationRevision: 2, epoch: 4 });
  }
  assert.equal(probe.report.first.events.filter(e => e.type === 'retreat-step').length, 9);
  assert.equal(probe.report.second, null);
  assert.equal(probe.report.events.at(-1).tick, 22);
  assert.equal(probe.report.events.at(-1).reason, 'seed-return-window-expired');
  assert.equal(probe.report.admission.events.filter(e => e.status === 'wait').length, 12);
});
function servicedWorld(ownerZ = -2) {
  const units = [unit(0, .5, .26, { x: .5, z: 3.5 }), unit(1, 0, ownerZ, { x: 2.5, z: ownerZ + .5 }),
    unit(2, 2, ownerZ, { x: 2.5, z: ownerZ + .5 })];
  const ledger = createCrowdServiceLedger({ origins: units.map(origin), startTick: 0 });
  for (let tick = 1; tick <= 13; tick++) {
    const steps = [];
    for (const id of tick === 1 || tick === 2 ? [0, 1] : tick === 13 ? [0] : []) {
      const u = units[id], from = { x: u.x, z: u.z }; if (id === 0) u.z += .08; else u.x += .08;
      steps.push({ id, generation: 7, revision: 3, tick, navigationRevision: 2, from, to: { x: u.x, z: u.z } });
    }
    ledger.observeExecuted({ units, steps, tick, navigationRevision: 2, epoch: 4 });
  }
  const ctx = { unit: units[1], units, tick: 14, navigationRevision: 2, epoch: 4,
    query: { visits: 2, overflow: false, neighbors: units.filter(u => u !== units[1]
      && Math.hypot(u.x - units[1].x, u.z - units[1].z) <= 2.1) } };
  const candidate = { ownerId: 1, recipientId: 0, far: { x: units[1].x + .75, z: ownerZ } };
  const inspect = (requireDebt = false) => inspectSelectedService(ctx, candidate,
    { ledger, seedId: 0, requireDebt, stats: { selectedChecks: 0, debtBodyVisits: 0 } });
  return { ctx, candidate, ledger, inspect };
}
test('boundary service refuses an unserved neighbor while geometry-only admission would pass', () => {
  const { ctx, inspect } = servicedWorld(), before = structuredClone(ctx.units);
  assert.equal(inspect().status, 'admit');
  const debt = inspect(true); assert.equal(debt.status, 'refuse'); assert.deepEqual(debt.debt.map(a => a.id), [2]);
  assert.equal(debt.debt[0].debtAge, 13); assert.deepEqual(ctx.units, before);
  ctx.units[2].holdingPosition = true; assert.equal(inspect(true).status, 'admit');
});
test('an observed return leg can intersect the proposed corridor despite a clear current endpoint', () => {
  const { ctx, candidate, inspect } = servicedWorld(0), seed = ctx.units[0];
  assert.ok(Math.abs(seed.z - .5) < 1e-9);
  assert.equal(candidate.far.z, 0);
  assert.ok(seed.z > .44, 'current seed center clears the future corridor');
  const result = inspect(); assert.equal(result.status, 'refuse');
  assert.ok(result.returnMargin < 0); assert.ok(result.reason.includes('observed-return-leg-intersects-corridor'));
});
test('stale receipt frames and overflowing or incomplete queries cannot admit a selected actor', () => {
  for (const change of ['stale', 'overflow', 'incomplete', 'visits', 'bodies']) {
    const { ctx, inspect } = servicedWorld();
    if (change === 'stale') ctx.tick++;
    if (change === 'overflow') ctx.query.overflow = true;
    if (change === 'incomplete') delete ctx.query.overflow;
    if (change === 'visits') ctx.query.visits = 129;
    if (change === 'bodies') ctx.query.neighbors = Array(65).fill(ctx.units[2]);
    assert.equal(inspect(true).status, 'refuse');
  }
});
