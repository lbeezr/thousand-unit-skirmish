import assert from 'node:assert/strict';

/** @typedef {'default'|'unthrottled'} BrowserBackgroundPolicy */
/** @param {unknown} policy @returns {BrowserBackgroundPolicy} */
export function validateBackgroundPolicy(policy) {
  assert.ok(policy === 'default' || policy === 'unthrottled', 'known browser background policy required');
  return policy;
}
