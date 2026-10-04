// Opt-in graphics lane. One normal-sandbox browser launch, no installation,
// retry, match, credentials, public debug port or game-acceptance claim.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFortifiedBrowser } from './fortified-browser-fixture.mjs';
import { diagnoseBrowserFailure } from './browser-preflight.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
function sourceMetadata() {
  try {
    return { revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      dirty: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() !== '' };
  } catch { return { revision: null, dirty: null }; }
}
const issue = (code, message) => ({ code, message });
function baseReport(source) {
  return { schemaVersion: 1, scope: 'renderer-capability-only', status: 'blocked', source,
    backend: 'Chromium/CDP', platform: process.platform, architecture: process.arch,
    sandbox: 'enabled', maxLaunchAttempts: 1, launchAttempts: 0, browser: null,
    renderer: null, softwareRenderer: null, webglReadbackPassed: false,
    renderedGameFrames: 0, screenshots: 0, consoleErrors: [], issues: [] };
}
function probeWebGL() {
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 32; document.body.append(canvas);
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) return { available: false };
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = { version: gl.getParameter(gl.VERSION), vendor: gl.getParameter(gl.VENDOR),
    name: gl.getParameter(gl.RENDERER), unmaskedName: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null };
  const read = color => {
    gl.clearColor(...color.map(v => v / 255)); gl.clear(gl.COLOR_BUFFER_BIT); gl.finish();
    const pixel = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return Array.from(pixel);
  };
  return { available: true, renderer, samples: [read([17, 33, 65, 255]), read([91, 123, 177, 255])],
    glError: gl.getError(), contextLost: gl.isContextLost() };
}
export async function checkRendererCapability({ openBrowser = createFortifiedBrowser,
  getSource = sourceMetadata, timeoutMs = 30000 } = {}) {
  const result = baseReport(getSource());
  let browser, timer;
  try {
    assert.match(result.source.revision ?? '', /^[a-f0-9]{40}$/, 'source revision is unavailable');
    const probe = async () => {
      result.launchAttempts = 1;
      browser = await openBrowser();
      assert.ok(browser.version?.product, 'browser version is unavailable');
      result.browser = browser.version;
      const page = await browser.page('about:blank');
      page.cdp.on('Runtime.consoleAPICalled', e => {
        if (e.type === 'error') result.consoleErrors.push('Browser console error during the isolated WebGL probe');
      });
      const graphics = await page.cdp.evaluate(`(${probeWebGL.toString()})()`);
      assert.equal(graphics?.available, true, 'WebGL context is unavailable');
      result.renderer = graphics.renderer;
      const name = graphics.renderer.unmaskedName;
      result.softwareRenderer = name ? /swiftshader|llvmpipe|lavapipe|softpipe|software|basic render/i.test(name) : null;
      assert.equal(graphics.contextLost, false, 'WebGL context was lost');
      assert.equal(graphics.glError, 0, 'WebGL readback returned an error');
      assert.deepEqual(graphics.samples, [[17, 33, 65, 255], [91, 123, 177, 255]], 'WebGL readback did not advance');
      assert.deepEqual(page.errors, [], 'browser exception during WebGL probe');
      assert.deepEqual(result.consoleErrors, [], 'browser console error during WebGL probe');
      result.webglReadbackPassed = true;
    };
    await Promise.race([probe(), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('renderer capability timeout')), timeoutMs);
    })]);
    result.status = 'ready';
  } catch (error) {
    if (/WebGL|browser (?:exception|console)/.test(error.message)) result.issues.push(issue('webgl-unavailable', error.message.split('\n')[0]));
    else if (/renderer capability timeout/.test(error.message)) result.issues.push(issue('capability-timeout', 'Renderer probe exceeded its bounded deadline'));
    else if (/source revision/.test(error.message)) result.issues.push(issue('source-unavailable', 'Source revision could not be identified'));
    else result.issues.push(...diagnoseBrowserFailure(error));
  } finally {
    clearTimeout(timer);
    if (browser) {
      try { await browser.dispose(); }
      catch { result.status = 'blocked'; result.issues.push(issue('cleanup-failed', 'Browser cleanup failed')); }
    }
  }
  return result;
}
export async function runRendererCapability(args, { readLog = file => readFile(file, 'utf8'),
  openBrowser = createFortifiedBrowser, getSource = sourceMetadata,
  output = text => process.stdout.write(text), usage = text => process.stderr.write(text) } = {}) {
  if (args.length !== 1 || args[0] !== '--launch' && !/^--diagnose=.+$/.test(args[0])) {
    usage('Usage: node scripts/renderer-capability.mjs --launch | --diagnose=STARTUP_LOG\n'); return 2;
  }
  let result;
  if (args[0] === '--launch') result = await checkRendererCapability({ openBrowser, getSource });
  else {
    result = baseReport(getSource());
    try { result.issues = diagnoseBrowserFailure(await readLog(args[0].slice(11))); }
    catch { result.issues = [issue('log-unreadable', 'Startup log could not be read')]; }
  }
  output(`${JSON.stringify(result, null, 2)}\n`);
  return result.status === 'ready' ? 0 : 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runRendererCapability(process.argv.slice(2));
}
