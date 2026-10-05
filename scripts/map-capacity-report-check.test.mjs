import assert from 'node:assert/strict';
import test from 'node:test';
import { capturedBudgetEnvelope, capturedTickAttribution } from './map-capacity-report-check.mjs';
const sample = (maxMs, lag = 1) => ({ health: { tickTiming: { p95Ms: 2, maxMs, startLagP95Ms: 1, startLagMaxMs: lag } } });
test('a recovered final window cannot conceal a captured planning-phase duration or lag spike', () => {
  assert.equal(capturedBudgetEnvelope([sample(120), sample(3)]).passed, false);
  assert.equal(capturedBudgetEnvelope([sample(3, 120), sample(3)]).passed, false);
  assert.equal(capturedBudgetEnvelope([sample(3)], [{ maxPlanningSliceMs: 120 }]).passed, false);
});
test('retained valid windows pass without becoming hardware or capacity acceptance', () => {
  const result = capturedBudgetEnvelope([sample(3), sample(8)], [{ maxPlanningSliceMs: 12 }]);
  assert.equal(result.passed, true); assert.equal(result.tickMaxMs, 8); assert.equal(result.maximumPlanningSliceMs, 12);
  assert.equal(capturedBudgetEnvelope([]).passed, false);
  assert.equal(capturedBudgetEnvelope([{ health: { tickTiming: {} } }]).passed, false);
  assert.equal(capturedBudgetEnvelope([sample(3)], [{}]).passed, false);
  assert.equal(capturedBudgetEnvelope([sample(3)], [{ maxPlanningSliceMs: NaN }]).passed, false);
});
test('a cold first tick has no lag observation and remains explicitly counted, with its duration gated', () => {
  const initial = { health: { tickTiming: { sampleCount: 1, windowSeconds: 0, p95Ms: 12, maxMs: 12,
    startLagP95Ms: null, startLagMaxMs: null } } };
  const result = capturedBudgetEnvelope([initial, sample(4)]);
  assert.equal(result.passed, true); assert.equal(result.initialTickWindowsWithoutLag, 1);
  initial.health.tickTiming.sampleCount = 300;
  assert.equal(capturedBudgetEnvelope([initial]).passed, false);
  initial.health.tickTiming.sampleCount = 1; initial.health.tickTiming.maxMs = 120;
  assert.equal(capturedBudgetEnvelope([initial]).passed, false);
});

const row = (tickNumber, extra = {}) => ({ workerRun: 1, matchId: 'match-a', mapId: 'crownroads', tickNumber,
  durationMs: 10, budgetMs: 1000 / 30, overBudget: false, cpuMs: 9,
  simulationMs: 6, visionMs: 1, scenarioMs: 0, broadcastMs: 2, checkpointMs: 1, ...extra });

test('unique tick attribution retains rare phase tails even when p95 and p99 pass', () => {
  const rows = Array.from({ length: 300 }, (_, i) => row(i + 1));
  rows[0] = row(1, { durationMs: 40, overBudget: true, simulationMs: 36 });
  rows[1] = row(2, { durationMs: 50, overBudget: true, broadcastMs: 42 });
  const result = capturedTickAttribution([...rows, ...rows.slice(0, 50)], 'crownroads');
  assert.equal(result.status, 'valid-observations'); assert.equal(result.uniqueObservedTicks, 300);
  assert.equal(result.totalTickMs.p95Ms, 10); assert.equal(result.totalTickMs.p99Ms, 10);
  assert.equal(result.totalTickMs.maxMs, 50); assert.equal(result.overBudgetTicks, 2);
  assert.equal(result.overrunDominantPhaseCounts.simulationMs, 1);
  assert.equal(result.overrunDominantPhaseCounts.broadcastMs, 1);
  assert.equal(result.coverage[0].missingTicksWithinObservedRange, 0);
  assert.deepEqual(result.overrunRows.map(r => r.tickNumber), [1, 2]);
});

test('worker restart, match reset and map identity prevent false deduplication', () => {
  const result = capturedTickAttribution([row(1), row(1, { workerRun: 2 }), row(1, { matchId: 'match-b' }),
    row(1, { mapId: 'probe' })], 'crownroads');
  assert.equal(result.status, 'valid-observations'); assert.equal(result.uniqueObservedTicks, 3);
  assert.equal(result.excludedOtherMapTicks, 1); assert.equal(result.coverage.length, 3);
});

test('incomplete, corrupted or conflicting attribution cannot qualify as valid observations', () => {
  for (const extra of [{ matchId: null }, { workerRun: 0 }, { tickNumber: 0 }, { overBudget: null },
    { budgetMs: 0 }, { simulationMs: NaN }, { overBudget: true }, { simulationMs: 100 }]) {
    assert.equal(capturedTickAttribution([row(1, extra)], 'crownroads').status, 'invalid-observations');
  }
  assert.ok(capturedTickAttribution([row(1), row(1, { cpuMs: 10 })], 'crownroads').reasons.includes('conflicting-tick-identity'));
  assert.ok(capturedTickAttribution([row(1), row(2, { budgetMs: 50 })], 'crownroads').reasons.includes('changed-tick-budget'));
  assert.equal(capturedTickAttribution([row(1)], 'other-map').status, 'invalid-observations');
  assert.equal(capturedTickAttribution([], 'crownroads').status, 'unavailable');
});

test('gaps and exact boundary flags remain explicit instead of fabricating missing ticks', () => {
  const result = capturedTickAttribution([row(1, { durationMs: 33.333, simulationMs: 29.333, overBudget: true }),
    row(3, { durationMs: 33.333, simulationMs: 29.333, overBudget: false })], 'crownroads');
  assert.equal(result.status, 'valid-observations'); assert.equal(result.overBudgetTicks, 1);
  assert.equal(result.coverage[0].missingTicksWithinObservedRange, 1);
  assert.equal(result.uniqueObservedTicks, 2);
  const interrupted = capturedTickAttribution([row(1), row(2, { mapId: 'probe' }), row(3)], 'crownroads');
  assert.equal(interrupted.coverage[0].knownOtherMapTicksWithinObservedRange, 1);
  assert.equal(interrupted.coverage[0].missingTicksWithinObservedRange, 0, 'a known other-map tick is not lost capture');
});
