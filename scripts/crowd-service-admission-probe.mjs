// Conservative episode admissions around the retained finite experiment.
// These diagnostics add no headings, holds, grants, priorities or peer writes.
import assert from 'node:assert/strict';
import { ordinaryCrowdBodyRadius } from '../src/unit-crowd-steering.mjs';
import { createFiniteRoomProbe as createFrontier } from './crowd-dependency-frontier-probe.mjs';
import { createCrowdServiceLedger, segmentPairDistanceSquared } from './crowd-service-ledger.mjs';
const EPS = 1e-9;
const modes = ['baseline', 'single', 'frontier', 'return', 'return-debt', 'entry'];
const queryComplete = q => q && q.overflow === false && Number.isInteger(q.visits) && q.visits >= 0
  && q.visits <= 128 && Array.isArray(q.neighbors) && q.neighbors.length <= 64;

export function inspectSelectedService(ctx, candidate, { ledger, seedId, requireDebt, stats }) {
  stats.selectedChecks++;
  if (!ledger.freshFor(ctx) || !queryComplete(ctx.query))
    return { status: 'refuse', reason: 'selected-receipts-or-query-refused' };
  const seed = ledger.snapshot(seedId), receipt = seed.lastExecuted;
  const radius = ordinaryCrowdBodyRadius(ctx.units[seedId]) + ordinaryCrowdBodyRadius(ctx.unit);
  const returnMargin = receipt ? Math.sqrt(segmentPairDistanceSquared(receipt.from, receipt.to, ctx.unit, candidate.far)) - radius : null;
  const reasons = [];
  if (!seed.valid || receipt?.tick !== ctx.tick - 1 || !(receipt.forwardProgress > EPS)) reasons.push('missing-forward-return-receipt');
  if (returnMargin !== null && returnMargin < -EPS) reasons.push('observed-return-leg-intersects-corridor');
  const debt = [];
  if (requireDebt) for (const other of [ctx.unit, ...ctx.query.neighbors]) {
    stats.debtBodyVisits++;
    if (!ordinaryCrowdBodyRadius(other)) continue;
    const s = ledger.snapshot(other.id);
    if (!s.valid || s.debtAge > 12 || s.backslide > .15 + EPS) debt.push(s);
  }
  if (debt.length) reasons.push('unserved-or-regressing-boundary');
  return { status: reasons.length ? 'refuse' : 'admit', reason: reasons.join(',') || 'fresh-return-and-service',
    returnMargin, debt, ownerId: candidate.ownerId, recipientId: candidate.recipientId };
}

export function createFiniteRoomProbe(config) {
  assert.ok(modes.includes(config.mode));
  const ledger = createCrowdServiceLedger({ origins: config.serviceOrigins, startTick: config.startTick - 1 });
  const frontierIds = new Set(config.origins.map(o => o.id)), events = [];
  const stats = { returnChecks: 0, debtBodyVisits: 0, coverageBodyVisits: 0, selectedChecks: 0 };
  const record = (ctx, type, decision) => { events.push({ tick: ctx.tick, type, ...decision }); return decision; };
  const hooks = {};
  if (config.mode === 'entry') hooks.admitFirst = ctx => {
    if (!queryComplete(ctx.query)) return record(ctx, 'coverage', { status: 'refuse', reason: 'coverage-query-refused' });
    const uncovered = [];
    for (const other of ctx.query.neighbors) {
      stats.coverageBodyVisits++;
      if (ordinaryCrowdBodyRadius(other) && !frontierIds.has(other.id)) uncovered.push(other.id);
    }
    return record(ctx, 'coverage', uncovered.length ? { status: 'refuse', reason: 'unaccounted-active-boundary', uncovered }
      : { status: 'admit', reason: 'declared-neighbor-boundary' });
  };
  if (config.mode === 'return' || config.mode === 'return-debt') {
    hooks.admitSecond = (ctx, firstEnd) => {
      stats.returnChecks++;
      if (!ledger.freshFor(ctx)) return record(ctx, 'return', { status: 'refuse', reason: 'stale-service-frame' });
      const seed = ledger.snapshot(config.ownerId);
      if (!seed.valid) return record(ctx, 'return', { status: 'refuse', reason: 'invalid-seed-receipt', seed });
      if (seed.progress >= .15 - EPS) return record(ctx, 'return', { status: 'admit', reason: 'executed-seed-recovery', seed });
      return record(ctx, 'return', { status: ctx.tick <= firstEnd.tick + 12 ? 'wait' : 'refuse',
        reason: ctx.tick <= firstEnd.tick + 12 ? 'seed-debt-not-repaid' : 'seed-return-window-expired', seed });
    };
    hooks.admitSelected = (ctx, candidate) => record(ctx, 'selected', inspectSelectedService(ctx, candidate,
      { ledger, seedId: config.ownerId, requireDebt: config.mode === 'return-debt', stats }));
  }
  const controller = createFrontier({ ...config, mode: ['baseline', 'single', 'frontier'].includes(config.mode) ? config.mode : 'frontier' }, hooks);
  return { select: ctx => controller.select(ctx), observeExecuted: frame => ledger.observeExecuted(frame),
    get report() { return { ...controller.report, admission: { stats, events, ledger: ledger.report } }; } };
}
