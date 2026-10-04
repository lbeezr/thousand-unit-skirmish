import assert from 'node:assert/strict';
import test from 'node:test';
import { capturedBudgetEnvelope } from './map-capacity-report-check.mjs';
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
