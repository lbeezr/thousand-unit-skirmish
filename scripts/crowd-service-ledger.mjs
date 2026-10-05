// Read-only diagnostic accounting for admitted executor receipts, not proposals.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const EPS = 1e-9;
const finite = p => Number.isFinite(p?.x) && Number.isFinite(p?.z);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function createCrowdServiceLedger({ origins, startTick, serviceDistance = .15 }) {
  assert.ok(Array.isArray(origins) && origins.length > 0 && origins.length <= 64);
  assert.ok(Number.isInteger(startTick) && Number.isFinite(serviceDistance) && serviceDistance > 0);
  const records = new Map(origins.map(o => {
    assert.ok(Number.isInteger(o.id) && finite(o) && finite(o.raw));
    assert.ok(Number.isInteger(o.pathLength) && o.pathLength >= 0);
    return [o.id, { origin: o, pose: { x: o.x, z: o.z }, valid: true, reason: null,
      progress: 0, bestProgress: 0, servedProgress: 0, lastServiceTick: startTick,
      serviceCount: 0, maxDebtAge: 0, worstBackslide: 0, lastExecuted: null, actor: null, path: null }];
  }));
  assert.equal(records.size, origins.length);
  const stats = { frames: 0, receipts: 0, maxReceipts: 0, maxActors: records.size, rejectedFrames: 0,
    declaredRouteCells: origins.reduce((n, o) => n + o.pathLength, 0), routeCellChecks: 0 };
  let lastTick = startTick, phase = null, failed = null;
  function fail(reason) {
    failed ??= reason; stats.rejectedFrames++;
    for (const r of records.values()) { r.valid = false; r.reason ??= reason; }
  }
  const invalid = (r, reason) => { r.valid = false; r.reason ??= reason; };
  function snapshot(id, tick = lastTick) {
    const r = records.get(id);
    if (!r) return { id, valid: false, reason: 'unaccounted-actor' };
    return { id, valid: r.valid && tick === lastTick, reason: r.reason ?? (tick !== lastTick ? 'stale-receipts' : null),
      progress: r.progress, bestProgress: r.bestProgress, serviceCount: r.serviceCount,
      debtAge: tick - r.lastServiceTick, maxDebtAge: r.maxDebtAge,
      backslide: r.bestProgress - r.progress, worstBackslide: r.worstBackslide,
      lastExecuted: r.lastExecuted && structuredClone(r.lastExecuted) };
  }
  return {
    snapshot,
    freshFor(ctx) { return !failed && lastTick === ctx.tick - 1 && phase
      && phase.navigationRevision === ctx.navigationRevision && phase.epoch === ctx.epoch; },
    get report() { return { stats, lastTick, failed, actors: [...records.keys()].sort((a, b) => a - b).map(id => snapshot(id)) }; },
    observeExecuted(frame) {
      if (failed) return;
      if (frame.tick !== lastTick + 1) { fail('receipt-gap-or-duplicate'); return; }
      if (!Array.isArray(frame.steps) || frame.steps.length > 128) { fail('receipt-overflow'); return; }
      if (phase && (phase.navigationRevision !== frame.navigationRevision || phase.epoch !== frame.epoch)) {
        fail('receipt-phase-change'); return;
      }
      phase ??= { navigationRevision: frame.navigationRevision, epoch: frame.epoch };
      const groups = new Map();
      for (const step of frame.steps) {
        if (!finite(step.from) || !finite(step.to) || distance(step.from, step.to) > .25 + EPS
          || step.tick !== frame.tick || step.navigationRevision !== frame.navigationRevision) {
          fail('invalid-admitted-receipt'); return;
        }
        if (records.has(step.id)) {
          if (!groups.has(step.id)) groups.set(step.id, []);
          groups.get(step.id).push(step);
        }
      }
      stats.frames++; stats.receipts += frame.steps.length;
      stats.maxReceipts = Math.max(stats.maxReceipts, frame.steps.length);
      for (const [id, r] of records) {
        if (!r.valid) continue;
        const u = frame.units[id], o = r.origin;
        if (!u || u.generation !== o.generation || u.orderRevision !== o.orderRevision
          || u.pathIndex !== o.pathIndex || u.moveGoalCell !== o.goal
          || JSON.stringify(u.queuedWaypoints.map(q => q.destination)) !== JSON.stringify(o.queue)) {
          invalid(r, 'accepted-route-change'); continue;
        }
        if (!Array.isArray(u.path) || u.path.length !== o.pathLength) { invalid(r, 'published-path-change'); continue; }
        stats.routeCellChecks += u.path.length;
        if (hash(u.path) !== o.pathSha256) { invalid(r, 'published-path-change'); continue; }
        if (!r.actor) {
          r.actor = u; r.path = u.path;
        }
        if (u !== r.actor || u.path !== r.path) { invalid(r, 'actor-or-path-reference-change'); continue; }
        let position = r.pose;
        for (const step of groups.get(id) ?? []) {
          if (step.generation !== o.generation || step.revision !== o.orderRevision || distance(step.from, position) > EPS) {
            invalid(r, 'unmatched-admitted-chain'); break;
          }
          position = step.to;
        }
        if (!r.valid) continue;
        if (!finite(u) || distance(position, u) > EPS) { invalid(r, 'unreceipted-position-change'); continue; }
        r.maxDebtAge = Math.max(r.maxDebtAge, frame.tick - r.lastServiceTick);
        // Validate the whole chain and live endpoint before crediting any part.
        // A within-tick peak remains served even if a later admitted step returns.
        for (const step of groups.get(id) ?? []) {
          r.lastExecuted = { tick: frame.tick, from: { ...step.from }, to: { ...step.to },
            forwardProgress: distance(step.from, o.raw) - distance(step.to, o.raw) };
          const stepProgress = distance(o, o.raw) - distance(step.to, o.raw), previousBest = r.bestProgress;
          r.bestProgress = Math.max(r.bestProgress, stepProgress);
          r.worstBackslide = Math.max(r.worstBackslide, r.bestProgress - stepProgress);
          // Revisiting an old maximum cannot pay new service debt.
          if (stepProgress > previousBest + EPS && stepProgress >= r.servedProgress + serviceDistance - EPS) {
            r.servedProgress = stepProgress; r.lastServiceTick = frame.tick; r.serviceCount++;
          }
        }
        r.pose = { x: u.x, z: u.z };
        r.progress = distance(o, o.raw) - distance(u, o.raw);
        r.worstBackslide = Math.max(r.worstBackslide, r.bestProgress - r.progress);
      }
      lastTick = frame.tick;
    },
  };
}

// Exact distance between two finite segments, including interior intersections.
export function segmentPairDistanceSquared(a, b, c, d) {
  assert.ok([a, b, c, d].every(finite));
  const cross = (p, q, r) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const sides = [cross(a, b, c), cross(a, b, d), cross(c, d, a), cross(c, d, b)];
  const project = (p, x, y) => {
    const dx = y.x - x.x, dz = y.z - x.z, n = dx * dx + dz * dz;
    const t = n ? Math.max(0, Math.min(1, ((p.x - x.x) * dx + (p.z - x.z) * dz) / n)) : 0;
    return (p.x - x.x - t * dx) ** 2 + (p.z - x.z - t * dz) ** 2;
  };
  const endpointDistance = Math.min(project(a, c, d), project(b, c, d), project(c, a, b), project(d, a, b));
  return sides[0] * sides[1] < 0 && sides[2] * sides[3] < 0 ? 0 : endpointDistance;
}
