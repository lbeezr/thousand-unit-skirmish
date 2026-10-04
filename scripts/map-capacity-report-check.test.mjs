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
});
