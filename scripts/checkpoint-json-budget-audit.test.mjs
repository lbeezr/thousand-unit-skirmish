import assert from 'node:assert/strict';
import test from 'node:test';
import { runCheckpointJsonBudgetAudit } from './checkpoint-json-budget-audit.mjs';

test('actual maximum admitted roster and supported-field upper witness fit the derived XL JSON quotas', async () => {
  const r = await runCheckpointJsonBudgetAudit({ native: true }), w = r.nativeWitness;
  assert.equal(w.status, 'passed'); assert.equal(w.actualAdmitted256Checkpoint.units, 2000);
  assert.ok(w.actualAdmitted256Checkpoint.unitMemberCountMax <= 128);
  const upper = w.synthetic320SupportedFieldUpperWitness;
  assert.equal(upper.routeEntries, 1048576); assert.equal(upper.maxForestRows, 102400);
  assert.equal(upper.buildings, 128); assert.equal(upper.resources, 128);
  assert.equal(upper.bytes, upper.observedCompactBytes); assert.ok(upper.bytes < r.limits.bytes);
  assert.ok(upper.unitNonRouteBytesMax <= 8192); assert.equal(upper.lexical.violation, null);
  const allowances = Object.values(r.canonicalInputSizingModel).filter(v => typeof v === 'number');
  assert.ok(allowances.reduce((a, b) => a + b, 0) < r.limits.bytes);
  assert.equal(r.ordinary320Admission, 'closed');
});
