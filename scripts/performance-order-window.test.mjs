import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('./performance-scenario.mjs', import.meta.url), 'utf8');
const watermark = source.match(/const previousMoveOrderId = ([^;]+);/)?.[1];
const planning = source.match(/        const recentPlanning = [\s\S]*?(?=\n      }\n      if \(slowReader\))/)?.[0];
assert.ok(watermark && planning, 'actual scenario planning assertions found');

function job(orderId, team, overrides = {}) {
  const unitCount = team === -1 ? 2 : 1000;
  return { orderId, team, mode: team === -1 ? 'blocked-route-repair' : 'shared-start', unitCount,
    nonEmptyPaths: unitCount, alreadyInDestinationCell: 0, routeFailures: 0,
    setupMs: 1, maxPathPlanningSliceMs: 2, finalizationMs: 1, ...overrides };
}
function check(jobs, previous = []) {
  const context = { assert, jobs, previous, maxBlockingBudgetMs: 100 };
  // Build arrays in the scenario realm so strict equality checks their values.
  return vm.runInNewContext(`const priorHealth = { movePlanning: Array.from(previous) };
    const health = { armySize: 2000, movePlanning: Array.from(jobs) };
    const previousMoveOrderId = ${watermark}; ${planning}; plannedOrders`, context);
}

test('completed planning jobs may arrive out of order across movement waves', () => {
  const result = check([job(2, 1), job(1, 0), job(4, 1), job(3, 0)], [job(2, 1), job(1, 0)]);
  assert.deepEqual(Array.from(result, (sample) => sample.orderId), [4, 3]);
});

test('first movement wave has no prior completed order and supports both planner configurations', () => {
  for (const mode of ['shared-start', 'per-unit']) {
    const result = check([job(1, 0, { mode }), job(2, 1, { mode })]);
    assert.deepEqual(Array.from(result, sample => sample.orderId), [1, 2]);
  }
});

test('internal repair completions do not masquerade as additional issued team orders', () => {
  const result = check([job(1, 0), job(2, 1), job(3, -1), job(4, -1), job(5, -1), job(6, -1)]);
  assert.deepEqual(Array.from(result, sample => sample.orderId), [1, 2]);
});

test('missing, duplicate, extra or incomplete team orders still fail', () => {
  for (const jobs of [
    [job(1, 0), job(2, -1)],
    [job(1, 0), job(2, 0)],
    [job(1, 0), job(2, 1), job(3, 1)],
    [job(1, 0), job(2, 1, { unitCount: 999, nonEmptyPaths: 999 })],
    [job(1, 0), job(2, 1, { mode: 'blocked-route-repair' })],
  ]) assert.throws(() => check(jobs), { code: 'ERR_ASSERTION' });
});

test('repair jobs retain route completeness, zero-failure and bounded-unit assertions', () => {
  for (const overrides of [
    { routeFailures: 1 }, { nonEmptyPaths: 0 }, { unitCount: 0, nonEmptyPaths: 0 },
    { unitCount: 2001, nonEmptyPaths: 2001 }, { unitCount: 1.5, nonEmptyPaths: 1.5 }, { team: 2 },
  ]) assert.throws(() => check([job(1, 0), job(2, 1), job(3, -1, overrides)]), { code: 'ERR_ASSERTION' });
});

test('timing limits apply to both issued and internal jobs without invalid metric escapes', () => {
  for (const field of ['setupMs', 'maxPathPlanningSliceMs', 'finalizationMs']) {
    for (const value of [101, -1, NaN, Infinity, undefined]) {
      for (const team of [0, -1]) {
        const jobs = [job(1, 0), job(2, 1)];
        if (team === 0) jobs[0] = job(1, 0, { [field]: value });
        else jobs.push(job(3, -1, { [field]: value }));
        assert.throws(() => check(jobs), { code: 'ERR_ASSERTION' });
      }
    }
  }
});
