import assert from 'node:assert/strict';
import test from 'node:test';
import { creditResourceBalance } from '../src/economy-ledger.mjs';
test('split fractional Worker cargo conserves the depleted node total', () => {
  const deposits = [40, 10 / 3, 10 / 3, 10 - 20 / 3];
  assert.equal(deposits.reduce(creditResourceBalance, 0), 50);
  assert.equal(deposits.reduce(creditResourceBalance, 75), 125);
  assert.equal(creditResourceBalance(49.9999, 0), 49.9999, 'real fractional shortages are preserved');
  assert.equal(creditResourceBalance(0, 10 / 3), 10 / 3, 'a partial delivery is never rounded to a whole unit');
});
