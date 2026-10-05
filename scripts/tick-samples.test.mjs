import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const start = source.indexOf('function tickTimingPayload(');
const body = source.slice(start, source.indexOf('\nfunction ', start + 1));
const durationStorageDeclaration = source.match(/^const tickDurationsMs = .+;$/m)[0];
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
    TICK_SAMPLE_WINDOW: values.length, tickDiagnosticSamples: null, inputDurations: values,
    tickStartLagCount: 0, tickStartLagCursor: 0, tickStartLagsMs: [], TICK_RATE: rate,
    skippedTickSlotsTotal: 0, lastOverloadSkippedSlots: 0, lastOverloadTick: null,
    MOVE_PLANNING_TURNS_PER_TICK: 0 });
  vm.runInContext(`${durationStorageDeclaration}\ntickDurationsMs.set(inputDurations);\n${body}`, context);
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
  const justAbove = period + 1e-7;
  assert.ok(new Float32Array([justAbove])[0] < period, 'the previous storage rounds this overrun below budget');
  assert.equal(timingContext([justAbove]).tickTimingPayload().overBudgetTickCount, 1);
});

test('inactive ring slots and expired overruns do not leak into a new window', () => {
  const context = timingContext([80, 2, 3, 90], { count: 2, cursor: 3 });
  const report = context.tickTimingPayload();
  assert.equal(report.p99Ms, 3); assert.equal(report.overBudgetTickCount, 0);
  context.tickDurationCount = 0;
  const empty = context.tickTimingPayload();
  assert.equal(empty.p99Ms, null); assert.equal(empty.overBudgetTickCount, 0);
});

test('actual outer-tick diagnostics preserve match/map identity and the exact overrun flag before display rounding', () => {
  const tickStart = source.indexOf('function runSimulationTick(');
  const tickBody = source.slice(tickStart, source.indexOf('\nfunction ', tickStart + 1));
  const period = 1000 / 30;
  for (const duration of [period - 1e-7, period, period + 1e-7]) {
    let clockCall = 0, diagnostic;
    const context = vm.createContext({
      performance: { now: () => clockCall++ === 0 ? 0 : duration },
      process: { cpuUsage: () => ({ user: 0, system: 0 }) }, tickDiagnosticSamples: [],
      tickNumber: 30, matchId: 'current-match', mapDefinition: { id: 'crownroads' },
      lastSimulationTickStartedAt: null, recordTickStartLag() {},
      serviceMovePlanningForTick: () => null, simulateTick: () => { context.tickNumber++; },
      visionMasksUpdatedTick: 0, workerPerformingActions: { finishStep: () => false },
      compatibleWorkerPerformingAction() {}, recordSeparationWorkSample() {}, takeMoveStartBroadcastRequest: () => false,
      STATE_EVERY_TICKS: 3, MATCH_CHECKPOINT_INTERVAL_TICKS: 30, TICK_RATE: 30,
      TICK_INTERVAL_MS: period, dirty: false, landRouteRetentionTick: null,
      recordTickDuration: (_, row) => { diagnostic = row; },
      advanceTickDeadline: () => ({ skippedTickSlots: 0, nextDeadlineMs: 200 }),
      simulationDeadlineMs: 100, scheduleSimulationTick() {},
    });
    vm.runInContext(`${tickBody}\nrunSimulationTick();`, context);
    assert.equal(diagnostic.matchId, 'current-match'); assert.equal(diagnostic.mapId, 'crownroads');
    assert.equal(diagnostic.tickNumber, 31); assert.equal(diagnostic.budgetMs, period);
    assert.equal(diagnostic.durationMs, 33.333); assert.equal(diagnostic.overBudget, duration > period);
  }
});
