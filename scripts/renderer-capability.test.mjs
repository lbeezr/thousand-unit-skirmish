// CPU contract tests. Injected browser/readbacks do not constitute GPU evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkRendererCapability, runRendererCapability } from './renderer-capability.mjs';

const getSource = () => ({ revision: '1'.repeat(40), dirty: false });
const goodGraphics = { available: true, renderer: { version: 'WebGL 2.0 (test)', unmaskedName: 'ANGLE (SwiftShader)' },
  contextLost: false, glError: 0, samples: [[17, 33, 65, 255], [91, 123, 177, 255]] };
function fixture(graphics = goodGraphics, { errors = [], consoleError = false, cleanupError = false } = {}) {
  let attempts = 0, disposed = 0;
  return { openBrowser: async () => {
    attempts++;
    return { version: { product: 'Chrome/test' }, dispose: async () => { disposed++; if (cleanupError) throw new Error('cleanup'); },
      page: async url => { assert.equal(url, 'about:blank'); return { errors, cdp: {
        on: (_, callback) => { if (consoleError) callback({ type: 'error' }); }, evaluate: async () => graphics,
      } }; } };
  }, get counts() { return { attempts, disposed }; } };
}
test('ready requires two distinct exact WebGL readbacks, source/backend metadata and cleanup', async () => {
  const f = fixture(), result = await checkRendererCapability({ openBrowser: f.openBrowser, getSource });
  assert.equal(result.status, 'ready'); assert.equal(result.softwareRenderer, true);
  assert.equal(result.webglReadbackPassed, true); assert.equal(result.renderedGameFrames, 0);
  assert.equal(result.sandbox, 'enabled'); assert.deepEqual(result.source, getSource());
  assert.deepEqual(f.counts, { attempts: 1, disposed: 1 });
});
test('missing WebGL, frozen readback, GL/context/console errors and cleanup all block', async () => {
  for (const [graphics, options] of [[{ available: false }, {}], [{ ...goodGraphics, samples: [goodGraphics.samples[0], goodGraphics.samples[0]] }, {}],
    [{ ...goodGraphics, renderer: { version: 'WebGL 1.0' } }, {}],
    [{ ...goodGraphics, glError: 1282 }, {}], [{ ...goodGraphics, contextLost: true }, {}],
    [goodGraphics, { errors: ['exception'] }], [goodGraphics, { consoleError: true }], [goodGraphics, { cleanupError: true }]]) {
    const f = fixture(graphics, options), result = await checkRendererCapability({ openBrowser: f.openBrowser, getSource });
    assert.equal(result.status, 'blocked'); assert.ok(result.issues.length); assert.equal(result.renderedGameFrames, 0);
    assert.deepEqual(f.counts, { attempts: 1, disposed: 1 });
  }
});
test('startup blocker is explicit, sanitized and attempted exactly once', async () => {
  let attempts = 0;
  const result = await checkRendererCapability({ getSource, openBrowser: async () => {
    attempts++; throw new Error('No usable sandbox! private-token');
  } });
  assert.equal(result.status, 'blocked'); assert.equal(attempts, 1);
  assert.deepEqual(result.issues.map(i => i.code), ['sandbox-unavailable']);
  assert.doesNotMatch(JSON.stringify(result), /private-token/);
});
test('probe deadline blocks, cleans up and never retries', async () => {
  const f = fixture(), openBrowser = async () => {
    const browser = await f.openBrowser();
    browser.page = async () => new Promise(() => {}); return browser;
  };
  const result = await checkRendererCapability({ openBrowser, getSource, timeoutMs: 10 });
  assert.equal(result.status, 'blocked'); assert.equal(result.issues[0].code, 'capability-timeout');
  assert.deepEqual(f.counts, { attempts: 1, disposed: 1 });
});
test('CLI diagnoses without launch and returns 1, never a silent pass', async () => {
  let result;
  const exit = await runRendererCapability(['--diagnose=first.log'], { getSource,
    readLog: async file => { assert.equal(file, 'first.log'); return 'No usable sandbox!'; },
    openBrowser: () => assert.fail('unexpected launch'), output: text => { result = JSON.parse(text); } });
  assert.equal(exit, 1); assert.equal(result.status, 'blocked'); assert.equal(result.launchAttempts, 0);
});
test('CLI validates explicit mode, source provenance and graphics result', async () => {
  assert.equal(await runRendererCapability([], { usage() {}, openBrowser: () => assert.fail('unexpected launch') }), 2);
  const f = fixture();
  assert.equal(await runRendererCapability(['--launch'], { openBrowser: f.openBrowser, getSource, output() {} }), 0);
  const blocked = await checkRendererCapability({ openBrowser: () => assert.fail('unexpected launch'), getSource: () => ({ revision: null }) });
  assert.equal(blocked.status, 'blocked'); assert.equal(blocked.launchAttempts, 0);
});
