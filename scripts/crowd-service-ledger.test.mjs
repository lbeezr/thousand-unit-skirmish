import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCrowdServiceLedger, segmentPairDistanceSquared } from './crowd-service-ledger.mjs';
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const unit = id => ({ id, generation: 7, orderRevision: 3, x: 0, z: .5,
  path: [10], pathIndex: 0, moveGoalCell: 10, queuedWaypoints: [] });
const origin = u => ({ ...u, raw: { x: 2.5, z: .5 }, goal: u.moveGoalCell, queue: [],
  pathSha256: hash(u.path), pathLength: u.path.length });
function setup(count = 1) {
  const units = Array.from({ length: count }, (_, i) => unit(i));
  const ledger = createCrowdServiceLedger({ origins: units.map(origin), startTick: 0 });
  let tick = 0;
  function advance(deltas = [], extra = {}) {
    tick++;
    const steps = deltas.map(([id, dx]) => {
      const u = units[id], from = { x: u.x, z: u.z }; u.x += dx;
      return { id, generation: 7, revision: 3, navigationRevision: 2, tick,
        from, to: { x: u.x, z: u.z } };
    });
    ledger.observeExecuted({ units, steps, tick, navigationRevision: 2, epoch: 4, ...extra });
    return steps;
  }
  return { units, ledger, advance };
}
test('service comes from matched admitted movement, not proposals or oscillation', () => {
  const { ledger, advance } = setup();
  advance([[0, .08]]); advance([[0, .08]]);
  assert.equal(ledger.snapshot(0).serviceCount, 1);
  advance([[0, -.08]]); advance([[0, -.08]]); advance([[0, .08]]); advance([[0, .08]]);
  const s = ledger.snapshot(0);
  assert.equal(s.serviceCount, 1); assert.equal(s.debtAge, 4);
  assert.ok(Math.abs(s.bestProgress - .16) < 1e-9); assert.ok(Math.abs(s.worstBackslide - .16) < 1e-9);
  advance([[0, .08]]); advance([[0, .08]]); assert.equal(ledger.snapshot(0).serviceCount, 2);
});
test('within-tick receipt peaks pay service once; revisiting them cannot pay later', () => {
  const { units, ledger } = setup(); units[0].x = .29;
  const step = (from, to) => ({ id: 0, generation: 7, revision: 3, navigationRevision: 2,
    tick: 1, from: { x: from, z: .5 }, to: { x: to, z: .5 } });
  ledger.observeExecuted({ units, tick: 1, navigationRevision: 2, epoch: 4,
    steps: [step(0, .16), step(.16, .32), step(.32, .29)] });
  let s = ledger.snapshot(0); assert.equal(s.serviceCount, 2); assert.ok(Math.abs(s.bestProgress - .32) < 1e-9);
  units[0].x = .315;
  ledger.observeExecuted({ units, tick: 2, navigationRevision: 2, epoch: 4,
    steps: [{ ...step(.29, .315), tick: 2 }] });
  s = ledger.snapshot(0); assert.equal(s.serviceCount, 2); assert.equal(s.debtAge, 1);
});
test('a proposed receipt without the matching live endpoint earns no credit', () => {
  const { units, ledger } = setup();
  ledger.observeExecuted({ units, tick: 1, navigationRevision: 2, epoch: 4,
    steps: [{ id: 0, generation: 7, revision: 3, navigationRevision: 2, tick: 1,
      from: { x: 0, z: .5 }, to: { x: .2, z: .5 } }] });
  assert.equal(ledger.snapshot(0).valid, false); assert.equal(ledger.snapshot(0).serviceCount, 0);
  assert.equal(ledger.snapshot(0).reason, 'unreceipted-position-change');
});
test('unmatched chains, teleports and stale actor receipts refuse positive evidence', () => {
  for (const change of ['teleport', 'chain', 'generation']) {
    const { units, ledger } = setup(); units[0].x = .16;
    const steps = change === 'teleport' ? [] : [{ id: 0, generation: change === 'generation' ? 8 : 7,
      revision: 3, navigationRevision: 2, tick: 1, from: { x: .01, z: .5 }, to: { x: .16, z: .5 } }];
    ledger.observeExecuted({ units, steps, tick: 1, navigationRevision: 2, epoch: 4 });
    assert.equal(ledger.snapshot(0).valid, false); assert.equal(ledger.snapshot(0).serviceCount, 0);
  }
});
test('in-place and replacement paths cannot carry service across an accepted route change', () => {
  for (const change of ['in-place', 'reference', 'order', 'queue', 'index']) {
    const { units, ledger, advance } = setup(); advance([[0, .08]]);
    if (change === 'in-place') units[0].path[0] = 11;
    if (change === 'reference') units[0].path = [...units[0].path];
    if (change === 'order') units[0].orderRevision++;
    if (change === 'queue') units[0].queuedWaypoints.push({ destination: 12 });
    if (change === 'index') units[0].pathIndex++;
    advance([[0, .08]]);
    assert.equal(ledger.snapshot(0).valid, false); assert.equal(ledger.snapshot(0).serviceCount, 0);
  }
});
test('receipt overflow, gaps, duplicates and phase changes permanently refuse the ledger', () => {
  for (const change of ['overflow', 'gap', 'duplicate', 'navigation', 'epoch', 'long-step']) {
    const { units, ledger, advance } = setup(); advance();
    const frame = { units, steps: [], tick: 2, navigationRevision: 2, epoch: 4 };
    if (change === 'overflow') frame.steps = Array(129).fill({});
    if (change === 'gap') frame.tick = 3;
    if (change === 'duplicate') frame.tick = 1;
    if (change === 'navigation') frame.navigationRevision++;
    if (change === 'epoch') frame.epoch++;
    if (change === 'long-step') frame.steps = [{ id: 0, tick: 2, navigationRevision: 2,
      from: { x: 0, z: .5 }, to: { x: .3, z: .5 } }];
    ledger.observeExecuted(frame); advance([[0, .16]]);
    assert.equal(ledger.snapshot(0).valid, false);
    assert.equal(ledger.snapshot(0).serviceCount, 0); assert.ok(ledger.report.failed);
  }
});
test('an unserved actor accrues bounded-window debt; stale inspection is never fresh', () => {
  const { ledger, advance } = setup(); for (let i = 0; i < 13; i++) advance();
  assert.equal(ledger.snapshot(0).debtAge, 13); assert.equal(ledger.snapshot(0).serviceCount, 0);
  assert.ok(ledger.freshFor({ tick: 14, navigationRevision: 2, epoch: 4 }));
  assert.equal(ledger.freshFor({ tick: 15, navigationRevision: 2, epoch: 4 }), false);
  assert.equal(ledger.snapshot(0, 14).valid, false); assert.equal(ledger.snapshot(9).valid, false);
  assert.equal(ledger.report.stats.maxActors, 1);
  assert.throws(() => setup(65));
});
test('return-leg distance accounts for interior crossings, collinear overlaps and finite endpoints', () => {
  const p = (x, z) => ({ x, z });
  assert.equal(segmentPairDistanceSquared(p(-1, 0), p(1, 0), p(0, -1), p(0, 1)), 0);
  assert.equal(segmentPairDistanceSquared(p(0, 0), p(1, 0), p(.5, 0), p(2, 0)), 0);
  assert.equal(segmentPairDistanceSquared(p(0, 0), p(1, 0), p(0, 2), p(1, 2)), 4);
  assert.equal(segmentPairDistanceSquared(p(0, 0), p(0, 0), p(1, 0), p(2, 0)), 1);
  assert.throws(() => segmentPairDistanceSquared(p(NaN, 0), p(1, 0), p(0, 1), p(1, 1)));
});
