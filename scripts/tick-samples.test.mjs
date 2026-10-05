import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const start = source.indexOf('function tickTimingPayload(');
const body = source.slice(start, source.indexOf('\nfunction ', start + 1));
test('opt-in diagnostic samples preserve chronological wrapped ticks and actual whole-tick values', () => {
  const rows = [3, 4, 1, 2].map(tickNumber => ({ tickNumber, durationMs: tickNumber * 10,
    scenarioEvaluated: false, planningTurns: 0 }));
  const context = vm.createContext({ tickDurationCount: 4, tickDurationCursor: 2, TICK_SAMPLE_WINDOW: 4,
    tickDiagnosticSamples: rows, tickDurationsMs: [30, 40, 10, 20], tickStartLagCount: 0,
    tickStartLagCursor: 0, tickStartLagsMs: [], TICK_RATE: 30, skippedTickSlotsTotal: 0,
    lastOverloadSkippedSlots: 0, lastOverloadTick: null, MOVE_PLANNING_TURNS_PER_TICK: 4 });
  vm.runInContext(body, context);
  assert.equal(context.tickTimingPayload().samples, undefined);
  const report = context.tickTimingPayload(true);
  assert.deepEqual(Array.from(report.samples, row => row.tickNumber), [1, 2, 3, 4]);
  assert.deepEqual(Array.from(report.samples, row => row.durationMs), [10, 20, 30, 40]);
  assert.equal(report.maxMs, 40); assert.equal(report.slowestTick.tickNumber, 4);
  assert.equal(report.p99Ms, 40); assert.equal(report.overBudgetTickCount, 1);
  context.tickDiagnosticSamples = null;
  assert.equal(context.tickTimingPayload(true).samples, undefined);
});

function timingContext(values, { count = values.length, cursor = count, rate = 30 } = {}) {
  const context = vm.createContext({ tickDurationCount: count, tickDurationCursor: cursor,
    TICK_SAMPLE_WINDOW: values.length, tickDiagnosticSamples: null, tickDurationsMs: values,
    tickStartLagCount: 0, tickStartLagCursor: 0, tickStartLagsMs: [], TICK_RATE: rate,
    skippedTickSlotsTotal: 0, lastOverloadSkippedSlots: 0, lastOverloadTick: null,
    MOVE_PLANNING_TURNS_PER_TICK: 0 });
  vm.runInContext(body, context);
  return context;
}

test('rare over-budget ticks remain visible even when p95 and p99 pass', () => {
  const values = Array(300).fill(10); values[0] = 40; values[1] = 50;
  const report = timingContext(values).tickTimingPayload();
  assert.equal(report.p95Ms, 10); assert.equal(report.p99Ms, 10);
  assert.equal(report.maxMs, 50); assert.equal(report.overBudgetTickCount, 2);
  assert.equal(report.samples, undefined, 'count is available without diagnostic samples');
});

test('budget count uses the exact tick period and raw durations before rounding', () => {
  const period = 1000 / 30;
  const report = timingContext([period - .00001, period, period + .00001]).tickTimingPayload();
  assert.equal(report.budgetMs, 33.333); assert.equal(report.maxMs, 33.333);
  assert.equal(report.overBudgetTickCount, 1);
  assert.equal(timingContext([20, 20.00001], { rate: 50 }).tickTimingPayload().overBudgetTickCount, 1);
});

test('inactive ring slots and expired overruns do not leak into a new window', () => {
  const context = timingContext([80, 2, 3, 90], { count: 2, cursor: 3 });
  const report = context.tickTimingPayload();
  assert.equal(report.p99Ms, 3); assert.equal(report.overBudgetTickCount, 0);
  context.tickDurationCount = 0;
  const empty = context.tickTimingPayload();
  assert.equal(empty.p99Ms, null); assert.equal(empty.overBudgetTickCount, 0);
});
