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
  context.tickDiagnosticSamples = null;
  assert.equal(context.tickTimingPayload(true).samples, undefined);
});
