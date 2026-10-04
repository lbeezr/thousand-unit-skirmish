// Versioned boundary shared by independently owned ordinary capture adapters.
import assert from 'node:assert/strict';

/** @typedef {{cdp: {call: (method: string, params?: object) => Promise<unknown>,
 * evaluate: (expression: string) => Promise<unknown>},
 * wait: (expression: string, description?: string, timeoutMs?: number) => Promise<unknown>}} CapturePage */
/** @typedef {{version: 1, page: CapturePage, openPage: () => Promise<CapturePage>, origin: string,
 * source: Readonly<{revision: string, digest: string}>,
 * capture: (options: {page?: CapturePage, mapId: string, checkpoint: string}) => Promise<unknown>}} CaptureContext */
/** @typedef {{id: string, contextVersion: 1, run: (context: CaptureContext) =>
 * Promise<{status: 'passed'|'failed'|'blocked', checks: {id: string, passed: boolean}[]}>}} CaptureAdapter */

export const CAPTURE_CONTEXT_VERSION = 1;

/** @param {unknown} value @returns {Record<string, unknown>} */
function record(value) {
  assert.ok(value && typeof value === 'object', 'capture contract requires an object');
  return /** @type {Record<string, unknown>} */ (value);
}

/** @param {unknown} value @param {string} id @returns {CaptureAdapter} */
export function validateCaptureAdapter(value, id) {
  const adapter = record(value);
  assert.equal(adapter.id, id, 'adapter identity must match its registered case');
  assert.equal(adapter.contextVersion, CAPTURE_CONTEXT_VERSION, 'adapter must declare capture context version1');
  assert.equal(typeof adapter.run, 'function', 'adapter must export run(context)');
  return /** @type {CaptureAdapter} */ (value);
}

/** @param {unknown} value @returns {CaptureContext} */
export function validateCaptureContext(value) {
  const context = record(value), page = record(context.page), cdp = record(page.cdp), source = record(context.source);
  assert.equal(context.version, CAPTURE_CONTEXT_VERSION, 'capture context version1 is required');
  for (const method of ['call', 'evaluate']) assert.equal(typeof cdp[method], 'function', 'capture context requires an instrumented CDP page');
  assert.equal(typeof page.wait, 'function', 'capture context requires page.wait');
  assert.equal(typeof context.openPage, 'function', 'capture context requires owned page acquisition');
  assert.equal(typeof context.capture, 'function', 'capture context requires checkpoint capture');
  assert.ok(typeof context.origin === 'string', 'capture context requires a loopback origin');
  const origin = new URL(context.origin);
  assert.ok(origin.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)
    && origin.origin === context.origin && !origin.username && !origin.password, 'capture origin must be an exact owned loopback origin');
  assert.ok(typeof source.revision === 'string' && /^[a-f0-9]{40}$/.test(source.revision), 'capture source revision is required');
  assert.ok(typeof source.digest === 'string' && /^sha256:[a-f0-9]{64}$/.test(source.digest), 'capture release digest is required');
  assert.equal(Object.isFrozen(source), true, 'capture source identity must be immutable');
  return /** @type {CaptureContext} */ (value);
}
