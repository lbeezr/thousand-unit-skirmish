// Diagnostic coordinator only. No production selector, grant, order or peer write.
import assert from 'node:assert/strict';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { ordinaryCrowdBodyRadius } from '../src/unit-crowd-steering.mjs';
import { LAND_CLEARANCE_PROFILE, canTraverseUnitStep, canTraverseStaticBodySegment,
  pointSegmentDistanceSquared } from '../src/unit-movement.mjs';
import { guardFor, projectOrdinaryStep } from './crowd-executor-projection.mjs';
import { createFiniteRoomProbe as createRetreat } from './crowd-finite-retreat-probe.mjs';

const EPS = 1e-9;
const ANGLES = [90, -90, 105, -105, 135, -135, 180];
const progress = (u, origin) => Math.hypot(origin.x - origin.raw.x, origin.z - origin.raw.z)
  - Math.hypot(u.x - origin.raw.x, u.z - origin.raw.z);
const inside = (p, map) => p.x >= -map.width / 2 + .5 && p.x <= map.width / 2 - .5
  && p.z >= -map.height / 2 + .5 && p.z <= map.height / 2 - .5;

function project(ctx, u, query, own = false) {
  return projectOrdinaryStep({ unit: u, query, map: ctx.map, tick: ctx.tick,
    navigationRevision: ctx.navigationRevision, epoch: ctx.epoch,
    expected: guardFor(u, ctx.tick, ctx.navigationRevision, ctx.epoch),
    budget: { actor: u, tick: ctx.tick, kind: own ? 'own-call' : 'future-turn-bound',
      remainingStep: own ? ctx.remainingStep : Math.min(.25, UNIT_DEFINITIONS[u.kind].combat.moveSpeed / 30) } });
}

// All inputs describe the same current serial world. A future preview spends nothing.
// Ranking is least executed raw-waypoint progress, identity only for exact ties.
// This deterministic experiment is not a starvation/fairness proof.
export function chooseFrontierCandidate(ctx, frames, attemptedOwners, stats) {
  const recipients = frames.filter(f => f.projection.status === 'projected'
    && !f.projection.staticBlockers.length && f.projection.bodyBlockers.length)
    .toSorted((a, b) => a.progress - b.progress || a.unit.id - b.unit.id);
  for (const recipient of recipients) {
    for (const blocker of recipient.projection.bodyBlockers) {
      const owner = frames.find(f => f.unit.id === blocker.id);
      if (!owner || attemptedOwners.has(owner.unit.id) || owner.projection.status !== 'projected') continue;
      const { unit, projection, query } = owner;
      const dx = projection.target.x - unit.x, dz = projection.target.z - unit.z, distance = Math.hypot(dx, dz);
      if (!distance) continue;
      for (const angle of ANGLES) {
        stats.candidateAngles++;
        const a = angle * Math.PI / 180;
        const far = { x: unit.x + .75 * (dx / distance * Math.cos(a) - dz / distance * Math.sin(a)),
          z: unit.z + .75 * (dz / distance * Math.cos(a) + dx / distance * Math.sin(a)) };
        if (!inside(far, ctx.map)
          || !canTraverseUnitStep(ctx.map.cell(unit.x, unit.z), ctx.map.cell(far.x, far.z), ctx.map.width, ctx.map.levels, ctx.map.isWalkable)
          || !canTraverseStaticBodySegment(unit, far, projection.radius, ctx.map.width, ctx.map.height, ctx.map.isWalkable)) continue;
        let corridor = true;
        for (const other of query.neighbors) {
          stats.corridorBodyVisits++;
          if (Math.sqrt(pointSegmentDistanceSquared(other, unit, far))
            - projection.radius - LAND_CLEARANCE_PROFILE.radiusByKind[other.kind] < -EPS) corridor = false;
        }
        if (!corridor) continue;
        // A retreat must clear every current blocker of the selected peer and
        // preserve all other currently clear frontier desired segments.
        let useful = true;
        for (const peer of frames.filter(f => f.unit !== unit)) {
          const after = project(ctx, peer.unit, { ...peer.query, neighbors: peer.query.neighbors
            .map(other => other === unit ? { ...unit, ...far } : other) });
          stats.counterfactualProjections++;
          stats.counterfactualBodyVisits += after.stats.bodyVisits;
          if (after.status !== 'projected' || (peer === recipient || peer.projection.strictClear) && !after.strictClear) useful = false;
        }
        if (useful) return { ownerId: unit.id, recipientId: recipient.unit.id, angle,
          recipientProgress: recipient.progress, far };
      }
    }
  }
  return null;
}

export function createFiniteRoomProbe(config) {
  assert.ok(['baseline', 'single', 'frontier'].includes(config.mode));
  assert.ok(config.origins.length >= 2 && config.origins.length <= 4);
  const ids = config.origins.map(o => o.id).toSorted((a, b) => a - b);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes(config.ownerId));
  const origins = new Map(config.origins.map(o => [o.id, o]));
  const initial = new Map(), observations = [], events = [];
  const stats = { ownCalls: 0, planningRounds: 0, candidateAngles: 0, corridorBodyVisits: 0,
    counterfactualProjections: 0, counterfactualBodyVisits: 0, futureQueries: 0,
    maxQueryVisits: 0, maxNeighbors: 0 };
  const first = createRetreat({ ...config, mode: config.mode === 'baseline' ? 'baseline' : 'retreat',
    peerIds: ids.filter(id => id !== config.ownerId) });
  let second = null, pending = null, planned = false, canceled = false, lastTick = null;
  const attemptedOwners = new Set([config.ownerId]);
  function cancel(tick, reason) {
    if (canceled) return;
    canceled = true; pending = null;
    first.cancel(tick, reason); second?.cancel(tick, reason);
    events.push({ type: 'frontier-abort', tick, reason });
  }
  function guard(ctx) {
    for (const id of ids) {
      const u = ctx.units[id], origin = origins.get(id);
      if (!u || !ordinaryCrowdBodyRadius(u)) return 'frontier-eligibility-loss';
      if (u.generation !== origin.generation || u.orderRevision !== origin.orderRevision
        || u.pathIndex !== origin.pathIndex || u.moveGoalCell !== origin.goal
        || JSON.stringify(u.queuedWaypoints.map(q => q.destination)) !== JSON.stringify(origin.queue)) return 'frontier-route-change';
      if (!initial.has(id)) initial.set(id, guardFor(u, ctx.tick, ctx.navigationRevision, ctx.epoch));
      const g = initial.get(id);
      if (u !== g.actor || u.path !== g.path || ctx.navigationRevision !== g.navigationRevision || ctx.epoch !== g.epoch) return 'frontier-phase-change';
    }
    return null;
  }
  function frame(ctx, id) {
    const u = ctx.units[id], own = id === ctx.unit.id, query = own ? ctx.query : ctx.queryFor(u);
    if (!own) stats.futureQueries++;
    stats.maxQueryVisits = Math.max(stats.maxQueryVisits, query?.visits ?? 0);
    stats.maxNeighbors = Math.max(stats.maxNeighbors, query?.neighbors?.length ?? 0);
    return { unit: u, query, projection: project(ctx, u, query, own), progress: progress(u, origins.get(id)) };
  }
  const dependencies = frames => JSON.stringify(frames.map(f => [f.unit.id, f.projection.status,
    f.projection.staticBlockers?.map(b => [b.reason, b.cell]),
    f.projection.bodyBlockers?.map(b => [b.id, b.generation]) ]));
  return {
    get report() { return { stats, events, observations, first: first.report, second: second?.report ?? null }; },
    select(ctx) {
      if (!ids.includes(ctx.unit.id)) return ctx.normal;
      stats.ownCalls++;
      const invalid = guard(ctx);
      if (invalid) cancel(ctx.tick, invalid);
      if (lastTick !== null && ctx.tick > lastTick + 1) cancel(ctx.tick, 'frontier-observation-gap');
      lastTick = ctx.tick;
      if (canceled) return ctx.normal;
      const own = frame(ctx, ctx.unit.id);
      observations.push({ tick: ctx.tick, id: ctx.unit.id, progress: own.progress,
        status: own.projection.status, blockers: own.projection.bodyBlockers?.map(b => b.id),
        staticBlockers: own.projection.staticBlockers, normalWait: Boolean(ctx.normal?.waitingForCrowd) });
      if (own.projection.status !== 'projected') { cancel(ctx.tick, own.projection.status); return ctx.normal; }
      if (config.mode !== 'frontier') return first.select(ctx);
      const firstEnd = first.report.events.find(e => e.type === 'finish' || e.type === 'abort' || e.type === 'refused');
      if (!firstEnd) return first.select(ctx);
      if (firstEnd.type !== 'finish') { cancel(ctx.tick, 'seed-not-completed'); return ctx.normal; }
      // Begin at a later tick; no overlapping retreat and no repeated planning
      // for an unchanged dependency. There is just one additional attempt.
      if (ctx.tick <= firstEnd.tick) return ctx.normal;
      if (second) return second.select(ctx);
      if (!planned || pending?.ownerId === ctx.unit.id) {
        const frames = ids.map(id => id === ctx.unit.id ? own : frame(ctx, id));
        if (frames.some(f => f.projection.status !== 'projected')) { cancel(ctx.tick, 'frontier-query-refused'); return ctx.normal; }
        const key = dependencies(frames);
        if (!planned) {
          planned = true; stats.planningRounds++;
          const selection = chooseFrontierCandidate(ctx, frames, attemptedOwners, stats);
          events.push({ type: 'frontier-choice', tick: ctx.tick, selection, dependencies: key });
          if (selection) pending = { ...selection, key, tick: ctx.tick };
        }
        if (pending?.ownerId === ctx.unit.id) {
          if (ctx.tick > pending.tick + 1 || key !== pending.key) { cancel(ctx.tick, 'changed-selected-dependency'); return ctx.normal; }
          const fresh = chooseFrontierCandidate(ctx, frames, attemptedOwners, stats);
          if (!fresh || fresh.ownerId !== pending.ownerId || fresh.recipientId !== pending.recipientId || fresh.angle !== pending.angle) {
            cancel(ctx.tick, 'changed-selected-candidate'); return ctx.normal;
          }
          attemptedOwners.add(pending.ownerId);
          second = createRetreat({ ownerId: pending.ownerId, peerIds: ids.filter(id => id !== pending.ownerId),
            angle: pending.angle, mode: 'retreat', startTick: ctx.tick });
          events.push({ type: 'second-own-call', tick: ctx.tick, ownerId: pending.ownerId, recipientId: pending.recipientId });
          pending = null;
          return second.select(ctx);
        }
      }
      if (pending && ctx.tick > pending.tick + 1) cancel(ctx.tick, 'selected-own-call-missing');
      return ctx.normal;
    },
  };
}
