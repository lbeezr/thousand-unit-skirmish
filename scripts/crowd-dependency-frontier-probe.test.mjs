import test from 'node:test';
import assert from 'node:assert/strict';
import { guardFor, projectOrdinaryStep } from './crowd-executor-projection.mjs';
import { chooseFrontierCandidate, createFiniteRoomProbe } from './crowd-dependency-frontier-probe.mjs';
import { compareFrontierTrials } from './crowd-dependency-frontier-diagnostic.mjs';
const width = 12, height = 12, step = 2.6 / 30;
const cell = (x, z) => Math.floor(z + height / 2) * width + Math.floor(x + width / 2);
const point = c => ({ x: c % width - width / 2 + .5, z: Math.floor(c / width) - height / 2 + .5 });
const map = { width, height, cell, point, levels: new Int8Array(width * height), isWalkable: () => true };
const unit = (id, x, z, target = { x: 2.5, z: .5 }) => ({ id, x, z, generation: 7, team: 0,
  hp: 100, kind: 'infantry', orderRevision: 3, pathIndex: 0, path: [cell(target.x, target.z)],
  moveGoalCell: cell(target.x, target.z), queuedWaypoints: [], gatherNodeId: null, buildingTargetId: null });
const stats = () => ({ candidateAngles: 0, corridorBodyVisits: 0, counterfactualProjections: 0, counterfactualBodyVisits: 0 });
function framesFor(units, progressById = {}) {
  const ctx = { unit: units[0], units, tick: 9, navigationRevision: 2, epoch: 4, map, remainingStep: step };
  const frames = units.map(u => {
    const query = { visits: units.length, overflow: false, neighbors: units.filter(o => o !== u) };
    const projection = projectOrdinaryStep({ unit: u, query, map, tick: ctx.tick, navigationRevision: 2, epoch: 4,
      expected: guardFor(u, 9, 2, 4), budget: { actor: u, tick: 9, remainingStep: step, kind: 'future-turn-bound' } });
    return { unit: u, query, projection, progress: progressById[u.id] ?? 0 };
  });
  return { ctx, frames };
}
test('least executed progress selects the peer; input order never changes deterministic ties', () => {
  const units = [unit(1, .45, .5), unit(2, 0, .5), unit(3, .9, .5, { x: -2.5, z: .5 })];
  for (const values of [{ 2: .2, 3: .1 }, { 2: .1, 3: .1 }]) {
    const { ctx, frames } = framesFor(units, { 1: 1, ...values }), before = structuredClone(units);
    const a = chooseFrontierCandidate(ctx, frames, new Set(), stats());
    const b = chooseFrontierCandidate(ctx, [...frames].reverse(), new Set(), stats());
    assert.deepEqual(a, b); assert.equal(a.recipientId, values[2] === values[3] ? 2 : 3);
    assert.equal(a.ownerId, 1); assert.deepEqual(units, before);
  }
});
test('a presently clear peer segment is preserved even when the first corridor is legal', () => {
  const { ctx, frames } = framesFor([unit(1, .45, .5), unit(2, 0, .5), unit(3, 0, 1.25, { x: 2.5, z: 1.5 })]);
  assert.ok(frames[2].projection.strictClear);
  const choice = chooseFrontierCandidate(ctx, frames, new Set(), stats());
  assert.equal(choice.ownerId, 1); assert.equal(choice.recipientId, 2); assert.equal(choice.angle, -90);
});
test('every blocker counts; a third body or previously attempted owner cannot be exempted', () => {
  const { ctx, frames } = framesFor([unit(1, .45, .5), unit(2, 0, .5), unit(3, .46, .6)]);
  assert.equal(chooseFrontierCandidate(ctx, frames, new Set([1, 3]), stats()), null);
  const external = unit(8, .46, .42);
  for (const f of frames) f.query.neighbors.push(external);
  const f = frames[1]; f.projection = projectOrdinaryStep({ unit: f.unit, query: f.query, map, tick: 9,
    navigationRevision: 2, epoch: 4, expected: guardFor(f.unit, 9, 2, 4),
    budget: { actor: f.unit, tick: 9, remainingStep: step, kind: 'future-turn-bound' } });
  assert.ok(f.projection.bodyBlockers.some(b => b.id === 8));
  assert.equal(chooseFrontierCandidate(ctx, [frames[0], f], new Set(), stats()), null);
});
function episode() {
  const units = [unit(0, -1.5, .5), unit(1, 3.5, 3.5)];
  const origins = units.map(u => ({ id: u.id, x: u.x, z: u.z, raw: point(u.path[0]),
    generation: u.generation, orderRevision: u.orderRevision, pathIndex: u.pathIndex,
    goal: u.moveGoalCell, queue: [] }));
  const p = createFiniteRoomProbe({ mode: 'frontier', ownerId: 0, angle: 180, startTick: 9, origins });
  const ctx = { unit: units[0], units, tick: 9, remainingStep: step, navigationRevision: 2, epoch: 4, map,
    query: { visits: 1, overflow: false, neighbors: [] }, queryFor: () => ({ visits: 1, overflow: false, neighbors: [] }),
    normal: { x: 1, z: 0, target: point(units[0].path[0]), stepDistance: step }, hasGrant: false };
  return { p, ctx };
}
test('a changed peer order, Stop, path reference or phase permanently cancels the owner', () => {
  for (const change of ['order', 'stop', 'path', 'phase']) {
    const { p, ctx } = episode(); const move = p.select(ctx);
    ctx.unit.x += move.x * move.stepDistance; ctx.unit.z += move.z * move.stepDistance; ctx.tick++;
    const peer = ctx.units[1], originalPath = peer.path;
    if (change === 'order') peer.orderRevision++;
    if (change === 'stop') peer.holdingPosition = true;
    if (change === 'path') peer.path = [...peer.path];
    if (change === 'phase') ctx.epoch++;
    assert.equal(p.select(ctx), ctx.normal);
    peer.orderRevision = 3; peer.holdingPosition = false; peer.path = originalPath; ctx.epoch = 4; ctx.tick++;
    assert.equal(p.select(ctx), ctx.normal);
    assert.equal(p.report.first.events.filter(e => e.type === 'retreat-step').length, 1);
    assert.equal(p.report.events.filter(e => e.type === 'frontier-abort').length, 1);
  }
});
test('missing observations or incomplete own query suppress the episode without restart', () => {
  for (const change of ['gap', 'query']) {
    const { p, ctx } = episode(); const move = p.select(ctx);
    ctx.unit.x += move.x * move.stepDistance; ctx.unit.z += move.z * move.stepDistance;
    ctx.tick += change === 'gap' ? 2 : 1; if (change === 'query') ctx.query.overflow = true;
    assert.equal(p.select(ctx), ctx.normal); ctx.query.overflow = false; ctx.tick++;
    assert.equal(p.select(ctx), ctx.normal);
    assert.equal(p.report.first.events.filter(e => e.type === 'retreat-step').length, 1);
  }
});
test('no actionable dependency produces one bounded decision and no unchanged retry', () => {
  const { p, ctx } = episode();
  for (let i = 0; i < 48; i++) {
    ctx.tick = 9 + i; const move = p.select(ctx);
    ctx.unit.x += move.x * move.stepDistance; ctx.unit.z += move.z * move.stepDistance;
  }
  assert.equal(p.report.stats.planningRounds, 1);
  assert.equal(p.report.events.filter(e => e.type === 'frontier-choice').length, 1);
  assert.equal(p.report.second, null);
  assert.equal(p.report.first.events.filter(e => e.type === 'retreat-step').length, 9);
});
test('a future selected owner waits for its own call and spends only that call budget', () => {
  const { ctx } = episode();
  ctx.units[1] = unit(1, 0, .5); ctx.units.push(unit(2, .45, .5));
  const origins = ctx.units.map(u => ({ id: u.id, x: u.x, z: u.z, raw: point(u.path[0]),
    generation: u.generation, orderRevision: u.orderRevision, pathIndex: u.pathIndex, goal: u.moveGoalCell, queue: [] }));
  const p = createFiniteRoomProbe({ mode: 'frontier', ownerId: 0, angle: 180, startTick: 9, origins });
  ctx.queryFor = u => ({ visits: 3, overflow: false, neighbors: ctx.units.filter(o => o !== u) });
  for (let i = 0; i < 9; i++) {
    ctx.tick = 9 + i; ctx.query = ctx.queryFor(ctx.unit);
    const move = p.select(ctx); ctx.unit.x += move.x * move.stepDistance; ctx.unit.z += move.z * move.stepDistance;
  }
  ctx.tick++; ctx.query = ctx.queryFor(ctx.unit);
  assert.equal(p.select(ctx), ctx.normal);
  assert.equal(p.report.second, null);
  assert.equal(p.report.events[0].selection.ownerId, 2);
  const snapshot = structuredClone(ctx.units);
  ctx.unit = ctx.units[2]; ctx.query = ctx.queryFor(ctx.unit); ctx.remainingStep = .03;
  ctx.normal = { x: 1, z: 0, target: point(ctx.unit.path[0]), stepDistance: .03 };
  const move = p.select(ctx);
  assert.equal(move.stepDistance, .03); assert.equal(move.yieldingForCrowd, true);
  assert.deepEqual(ctx.units, snapshot, 'no actor is moved by selection');
  assert.equal(p.report.second.events.filter(e => e.type === 'retreat-step').length, 1);
  assert.ok(p.report.first.events.find(e => e.type === 'finish').tick < p.report.second.events.find(e => e.type === 'start').tick);
});
test('fairness comparison rejects transferred loss, late stalling and route replacement', () => {
  const make = (mode, values, overrides = {}) => ({ inputSha256: 'same', ticks: 48, mode, frontierIds: [1, 2],
    affectedIds: [1, 2, 3], initialActors: [1, 2, 3].map(id => ({ id, generation: 7, orderRevision: 3,
      pathIndex: 0, pathSha256: 'original-route', goal: 10, queue: [] })), samples: [24, 48].map(tick => ({ tick,
      actors: [1, 2, 3].map((id, i) => ({ id, generation: 7, revision: 3, pathIndex: 0,
        pathSha256: 'original-route', goal: 10, queue: [], rawProgress: tick === 24 ? 0 : values[i], ...overrides[id] })) })) });
  const baseline = make('baseline', [.4, .4, .4]);
  const good = compareFrontierTrials(baseline, make('frontier', [.5, .5, .5])); assert.ok(good.qualified);
  const loss = compareFrontierTrials(baseline, make('frontier', [.6, .6, .2]));
  assert.equal(loss.qualified, false); assert.deepEqual(loss.harmed.map(a => a.id), [3]);
  assert.equal(compareFrontierTrials(baseline, make('frontier', [.6, .6, .6], { 2: { pathIndex: 1 } })).qualified, false);
  assert.equal(compareFrontierTrials(baseline, make('frontier', [.6, .6, .6], { 2: { pathSha256: 'replacement-route' } })).qualified, false);
  assert.equal(compareFrontierTrials(baseline, make('frontier', [.6, .6, .1])).qualified, false);
});
