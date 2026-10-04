// Adapter contracts only; these injected records are not browser evidence.
import assert from 'node:assert/strict';
import test from 'node:test';
import { id, contextVersion, run, validateResume } from './renderer-browser-resume-scenario.mjs';
import { validateCaptureAdapter } from './renderer-capture-context.mjs';
const page = { cdp: { call: async () => assert.fail('no acquisition without normal background policy'), evaluate: async () => ({}) }, wait: async () => ({}) };
const context = { version: 1, page, openPage: async () => page, origin: 'http://127.0.0.1:1234',
  evidenceDirectory: '/tmp/browser-resume-cpu-contract',
  source: Object.freeze({ revision: 'a'.repeat(40), digest: `sha256:${'b'.repeat(64)}` }), capture: async () => ({}) };
test('version1 adapter refuses inherited throttling bypass or absent policy before navigation', async () => {
  validateCaptureAdapter({ id, contextVersion, run }, 'browser-resume');
  for (const backgroundPolicy of [undefined, 'unthrottled']) {
    assert.equal((await run({ ...context, backgroundPolicy })).status, 'blocked');
  }
});
test('real hidden/authoritative/current-state requirements reject fake visibility and stagnant or stale presentation', () => {
  const before = { applied: 1, tick: 10, selected: [1], camera: { x: 1, z: 2, zoom: 1 },
    worker: { id: 1, renderX: 1, renderZ: 1, serverX: 1, serverZ: 1 } };
  const hidden = { applied: 1, pendingCount: 0, visibility: 'hidden' };
  const after = { ...before, applied: 2, tick: 100, visibility: 'visible', recovering: false };
  validateResume(before, hidden, after);
  for (const change of [{ visibility: 'hidden' }, { recovering: true }, { tick: 10 }, { selected: [] },
    { camera: { x: 9, z: 2, zoom: 1 } }, { worker: { ...after.worker, renderX: 99 } }]) {
    assert.throws(() => validateResume(before, hidden, { ...after, ...change }));
  }
  for (const change of [{ visibility: 'visible' }, { applied: 2 }, { pendingCount: 2 }]) {
    assert.throws(() => validateResume(before, { ...hidden, ...change }, after));
  }
});
