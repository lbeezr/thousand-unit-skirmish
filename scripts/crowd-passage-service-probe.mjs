// Read-only feasibility contract, not a motion controller. No retreat/hold/grant.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { ordinaryCrowdBodyRadius } from '../src/unit-crowd-steering.mjs';
import { guardFor, projectOrdinaryStep } from './crowd-executor-projection.mjs';
import { createCrowdServiceLedger } from './crowd-service-ledger.mjs';
const EPS = 1e-9, WINDOW = 12, SERVICE = .15, LOSS = .15;
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');

export function inspectPassageBoundary(ctx, origins, stats) {
  const ids = new Set(origins.map(o => o.id)), frames = [], uncovered = new Set(), refusals = [];
  for (const o of origins.toSorted((a, b) => a.id - b.id)) {
    const u = ctx.units[o.id];
    if (!u || !ordinaryCrowdBodyRadius(u) || u.generation !== o.generation
      || u.orderRevision !== o.orderRevision || u.pathIndex !== o.pathIndex || u.moveGoalCell !== o.goal
      || JSON.stringify(u.moveGoalPoint ?? null) !== JSON.stringify(o.goalPoint ?? null)
      || JSON.stringify(u.queuedWaypoints.map(q => q.destination)) !== JSON.stringify(o.queue)
      || u.path.length !== o.pathLength) { refusals.push({ id: o.id, reason: 'accepted-route-or-eligibility' }); continue; }
    stats.routeCellChecks += u.path.length;
    if (hash(u.path) !== o.pathSha256) { refusals.push({ id: o.id, reason: 'published-path-change' }); continue; }
    const own = u === ctx.unit, query = own ? ctx.query : ctx.queryFor(u);
    stats.queries++; stats.maxQueryVisits = Math.max(stats.maxQueryVisits, query?.visits ?? 0);
    stats.maxNeighbors = Math.max(stats.maxNeighbors, query?.neighbors?.length ?? 0);
    const projection = projectOrdinaryStep({ unit: u, query, map: ctx.map, tick: ctx.tick,
      navigationRevision: ctx.navigationRevision, epoch: ctx.epoch,
      expected: guardFor(u, ctx.tick, ctx.navigationRevision, ctx.epoch),
      budget: { actor: u, tick: ctx.tick, kind: own ? 'own-call' : 'future-turn-bound',
        remainingStep: own ? ctx.remainingStep : Math.min(.25, UNIT_DEFINITIONS[u.kind].combat.moveSpeed / 30) } });
    if (projection.status !== 'projected') { refusals.push({ id: o.id, reason: projection.status }); continue; }
    for (const other of query.neighbors) {
      stats.boundaryBodyVisits++;
      if (ordinaryCrowdBodyRadius(other) && !ids.has(other.id)) uncovered.add(other.id);
    }
    frames.push({ id: o.id, strictClear: projection.strictClear, stepDistance: projection.stepDistance,
      blockers: projection.bodyBlockers.map(b => b.id), staticBlockers: projection.staticBlockers });
  }
  return { tick: ctx.tick, frames, uncovered: [...uncovered].sort((a, b) => a - b), refusals,
    covered: !refusals.length && !uncovered.size && frames.length === origins.length };
}

// A successful witness requires at most two real, bounded service windows.
// Admission never spends future preview budgets or promises space. All normal
// executor movement continues, even during refusal, expiry or a service window.
export function createFiniteRoomProbe(config) {
  assert.equal(config.mode, 'passage');
  assert.ok(config.origins.length >= 2 && config.origins.length <= 4);
  assert.equal(new Set(config.origins.map(o => o.id)).size, config.origins.length);
  assert.ok(Number.isInteger(config.startTick));
  const origins = config.origins.toSorted((a, b) => a.id - b.id), captain = origins[0].id;
  const ledger = createCrowdServiceLedger({ origins: config.serviceOrigins, startTick: config.startTick - 1 });
  const stats = { rounds: 0, queries: 0, maxQueryVisits: 0, maxNeighbors: 0,
    boundaryBodyVisits: 0, routeCellChecks: 0, admissionAttempts: 0, handoffSelections: 0, handoffs: 0 };
  const census = [], events = [], served = new Set();
  const anchors = new Map();
  let state = 'armed', lastAuditTick = null, episode = null, service = null, pending = null;
  const end = (tick, reason, evidence = {}) => {
    if (state === 'aborted' || state === 'complete') return;
    state = 'aborted'; events.push({ type: 'abort', tick, reason, ...evidence }); pending = null;
  };
  const serviceFloor = () => {
    const rows = ledger.report.actors;
    return { rows, invalid: rows.filter(a => !a.valid),
      loss: rows.filter(a => a.worstBackslide > LOSS + EPS || episode && a.progress < episode.progress[a.id] - LOSS - EPS),
      debt: rows.filter(a => a.maxDebtAge > WINDOW || a.debtAge > WINDOW) };
  };
  const rank = boundary => boundary.frames.filter(f => f.strictClear && f.stepDistance > EPS && !served.has(f.id))
    .map(f => ledger.snapshot(f.id)).filter(s => s.valid)
    .sort((a, b) => b.debtAge - a.debtAge || a.bestProgress - b.bestProgress || a.id - b.id)[0];
  const boundaryServed = () => origins.every(o => {
    const a = ledger.snapshot(o.id), base = episode.serviceBase[o.id];
    return a.valid && a.serviceCount > base.serviceCount && a.bestProgress >= base.bestProgress + SERVICE - EPS
      && a.progress >= base.progress + SERVICE - EPS;
  });
  function audit(ctx) {
    const b = inspectPassageBoundary(ctx, origins, stats);
    for (const o of origins) if (ctx.units[o.id] !== anchors.get(o.id)?.actor
      || ctx.units[o.id]?.path !== anchors.get(o.id)?.path) {
      b.covered = false; b.refusals.push({ id: o.id, reason: 'actor-or-path-reference-change' });
    }
    return b;
  }
  function begin(ctx, candidate) {
    if (served.size) stats.handoffs++;
    service = { id: candidate.id, tick: ctx.tick, until: ctx.tick + WINDOW - 1,
      progress: candidate.progress, bestProgress: candidate.bestProgress, serviceCount: candidate.serviceCount };
    state = 'serving'; pending = null;
    events.push({ type: 'service-own-call', tick: ctx.tick, id: candidate.id, until: service.until });
  }
  return {
    get report() { return { state, stats, census, events, served: [...served], episode, service, ledger: ledger.report }; },
    select(ctx) {
      // Census is bounded read-only observation, including after terminal refusal;
      // it is never another admission attempt or unchanged-dependency retry.
      if (ctx.unit.id === captain && lastAuditTick !== ctx.tick) {
        lastAuditTick = ctx.tick; stats.rounds++;
        for (const o of origins) if (!anchors.has(o.id)) anchors.set(o.id,
          { actor: ctx.units[o.id], path: ctx.units[o.id]?.path });
        const b = audit(ctx); census.push(b);
        if (ctx.tick >= config.startTick + 1 && state === 'armed') {
          stats.admissionAttempts++;
          const floor = serviceFloor();
          if (!ledger.freshFor(ctx)) end(ctx.tick, 'missing-fresh-executed-frame');
          else if (!b.covered) end(ctx.tick, 'uncovered-or-invalid-boundary', { uncovered: b.uncovered, refusals: b.refusals });
          else if (floor.invalid.length || floor.loss.length || floor.debt.length)
            end(ctx.tick, 'whole-affected-service-floor', { invalid: floor.invalid.map(a => a.id),
              loss: floor.loss.map(a => a.id), debt: floor.debt.map(a => a.id) });
          else {
            const candidate = rank(b);
            if (!candidate) end(ctx.tick, 'no-strict-current-service-step');
            else {
              episode = { tick: ctx.tick, until: ctx.tick + WINDOW * 2 - 1,
                progress: Object.fromEntries(floor.rows.map(a => [a.id, a.progress])),
                serviceBase: Object.fromEntries(floor.rows.map(a => [a.id,
                  { progress: a.progress, bestProgress: a.bestProgress, serviceCount: a.serviceCount }])) };
              pending = { id: candidate.id, tick: ctx.tick }; state = 'pending';
              events.push({ type: 'admit', tick: ctx.tick, id: candidate.id, until: episode.until });
            }
          }
        } else if (state === 'handoff') {
          const floor = serviceFloor();
          if (!ledger.freshFor(ctx) || ctx.tick > episode.until || !b.covered
            || floor.invalid.length || floor.loss.length || floor.debt.length)
            end(ctx.tick, 'handoff-boundary-or-service-refused');
          else if (!boundaryServed()) {
            if (ctx.tick > service.until) end(ctx.tick, 'unserved-boundary-handoff-expired');
          }
          else {
            const candidate = rank(b);
            if (!candidate) end(ctx.tick, 'no-next-strict-service-step');
            else { pending = { id: candidate.id, tick: ctx.tick }; state = 'pending';
              stats.handoffSelections++;
              events.push({ type: 'handoff-selection', tick: ctx.tick, id: candidate.id }); }
          }
        } else if ((state === 'serving' || state === 'pending') && !b.covered)
          end(ctx.tick, 'boundary-changed', { uncovered: b.uncovered, refusals: b.refusals });
      }
      if (state === 'serving' || state === 'pending') {
        if (!ledger.freshFor(ctx) || ctx.tick > episode.until) end(ctx.tick, 'stale-frame-or-episode-expired');
        if (state === 'pending' && ctx.tick > pending.tick + 1) end(ctx.tick, 'selected-own-call-missing');
        if (state === 'pending' && ctx.unit.id === pending.id) {
          // Revalidate the entire serial boundary at the selected actor's real
          // call. Ranking at another actor's call is an unspendable observation.
          const b = audit(ctx), floor = serviceFloor();
          if (!b.covered || floor.invalid.length || floor.loss.length || floor.debt.length
            || served.size && !boundaryServed()
            || !b.frames.find(f => f.id === pending.id)?.strictClear || ctx.hasGrant)
            end(ctx.tick, 'selected-own-call-refused');
          else begin(ctx, ledger.snapshot(pending.id));
        }
      }
      return ctx.normal;
    },
    observeExecuted(frame) {
      ledger.observeExecuted(frame);
      if (state === 'armed' && frame.tick >= config.startTick + 1)
        end(frame.tick, 'first-own-call-missing');
      if (!['serving', 'pending', 'handoff'].includes(state)) return;
      const floor = serviceFloor();
      if (ledger.report.failed || floor.invalid.length || floor.loss.length || floor.debt.length) {
        end(frame.tick, 'executed-whole-affected-floor-failed', { invalid: floor.invalid.map(a => a.id),
          loss: floor.loss.map(a => a.id), debt: floor.debt.map(a => a.id) }); return;
      }
      if (frame.tick > episode.until) { end(frame.tick, 'episode-expired'); return; }
      if (state === 'handoff' && frame.tick >= service.until && !boundaryServed()) {
        end(frame.tick, 'unserved-boundary-handoff-expired'); return;
      }
      if (state !== 'serving') return;
      const actual = ledger.snapshot(service.id);
      // Both new peak and retained net gain must be real admitted receipt work.
      if (actual.serviceCount > service.serviceCount && actual.bestProgress >= service.bestProgress + SERVICE - EPS
        && actual.progress >= service.progress + SERVICE - EPS) {
        served.add(service.id); events.push({ type: 'executed-service', tick: frame.tick, id: service.id,
          gain: actual.progress - service.progress, highWaterGain: actual.bestProgress - service.bestProgress });
        if (served.size === 2) { state = 'complete'; events.push({ type: 'complete', tick: frame.tick }); return; }
        // No handoff until another fresh own-call audit and selection. This is
        // a service witness; it does not reserve or hold any actor in the gap.
        state = 'handoff';
      } else if (frame.tick >= service.until) end(frame.tick, 'service-window-expired');
    },
  };
}
