import assert from 'node:assert/strict';
import test from 'node:test';
import { CAPTURE_CONTEXT_VERSION, validateCaptureAdapter, validateCaptureContext } from './renderer-capture-context.mjs';

const page = { cdp: { call: async () => ({}), evaluate: async () => ({}) }, wait: async () => ({}) };
const context = { version: CAPTURE_CONTEXT_VERSION, page, openPage: async () => page, origin: 'http://127.0.0.1:4321',
  source: Object.freeze({ revision: 'a'.repeat(40), digest: `sha256:${'b'.repeat(64)}` }), capture: async () => ({}) };
test('version1 declares one exact adapter export and minimal owned context', () => {
  assert.equal(validateCaptureContext(context), context);
  const adapter = { id: 'novice-flow', contextVersion: 1, run: async () => ({ status: 'blocked', checks: [{ id: 'not-rendered', passed: false }] }) };
  assert.equal(validateCaptureAdapter(adapter, 'novice-flow'), adapter);
  for (const change of [{ id: 'wrong' }, { contextVersion: undefined }, { contextVersion: 2 }, { run: undefined }]) {
    assert.throws(() => validateCaptureAdapter({ ...adapter, ...change }, 'novice-flow'));
  }
});
test('legacy owner shapes and absent context fields fail before gameplay execution', () => {
  for (const legacy of [{ id: 'worker-work-cycle', run() {} }, { runNoviceScenario() {} }]) {
    assert.throws(() => validateCaptureAdapter(legacy, 'worker-routes'));
  }
  for (const field of Object.keys(context)) assert.throws(() => validateCaptureContext({ ...context, [field]: undefined }));
  for (const change of [{ version: 2 }, { page: {} }, { page: { ...page, cdp: {} } },
    { source: { ...context.source } }, { source: Object.freeze({ ...context.source, digest: 'unknown' }) },
    { origin: 'https://private.invalid' }, { origin: 'http://127.0.0.1:4321/?private-token' },
    { origin: 'http://secret@127.0.0.1:4321' }]) assert.throws(() => validateCaptureContext({ ...context, ...change }));
});
