import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const base = new URL(process.argv[2] || '');
const roomId = process.argv[3];
const authorMap = process.argv.includes('--author');
assert.equal(base.protocol, 'https:', 'pass the staging HTTPS origin');
assert.match(roomId || '', /^[A-Za-z0-9_-]{32}$/, 'pass a saved QA invite room ID');
assert.ok(process.env.RTS_ACCESS_PASSWORD, 'run with staging service variables');
const auth = `Basic ${Buffer.from(`${process.env.RTS_ACCESS_USER || 'players'}:${process.env.RTS_ACCESS_PASSWORD}`).toString('base64')}`;
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
await stat(chromePath);

const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'rts-staging-browser-'));
const browsers = [];

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitFor(check, description, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let result;
  while (Date.now() < deadline) {
    result = await check();
    if (result) return result;
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function setField(cdp, selector, value) {
  await cdp.evaluate(`(() => {
    const field = document.querySelector(${JSON.stringify(selector)});
    field.value = ${JSON.stringify(value)};
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}

async function importMap(cdp, definition, filename) {
  await cdp.evaluate(`(() => {
    const file = new File([${JSON.stringify(JSON.stringify(definition))}], ${JSON.stringify(filename)},
      { type: 'application/json' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input = document.querySelector('#studio-import-file');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}

const readState = `(() => ({
  boot: document.documentElement.dataset.boot || null,
  team: document.querySelector('#player-team')?.textContent || null,
  network: document.querySelector('#network-status')?.textContent || null,
  players: document.querySelector('#players-online')?.textContent || null,
  map: document.querySelector('#map-label-title')?.textContent || null,
  error: document.querySelector('#runtime-error')?.textContent || null,
  canvas: Boolean(document.querySelector('#viewport canvas')),
}))()`;

class Cdp {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
    this.open = new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', () => reject(new Error('CDP connection failed')), { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== undefined) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error) pending.reject(new Error(`CDP ${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result || {});
      } else for (const listener of this.events.get(message.method) || []) listener(message.params || {});
    });
    this.socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) pending.reject(new Error('CDP connection closed'));
      this.pending.clear();
    });
  }

  on(method, callback) {
    const listeners = this.events.get(method) || new Set();
    listeners.add(callback);
    this.events.set(method, listeners);
  }

  async call(method, params = {}, timeoutMs = 10_000) {
    await this.open;
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${method} timed out`));
      }, timeoutMs);
      this.pending.set(id, { method, resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const response = await this.call('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result?.value;
  }

  close() { this.socket.close(); }
}

async function launch(label) {
  const profile = path.join(tempRoot, `${label}-profile`);
  const child = spawn(chromePath, [
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding', '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=0', '--remote-allow-origins=*',
    '--window-size=1440,900', `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  const record = { label, child, output: '', cdp: null, diagnostics: [] };
  child.stdout.on('data', (chunk) => { record.output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { record.output += chunk.toString(); });
  browsers.push(record);

  let port;
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`${label} Chrome exited: ${record.output.slice(-1000)}`);
    try {
      port = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split(/\r?\n/)[0]);
      if (port > 0) break;
    } catch {}
    await sleep(100);
  }
  assert.ok(port > 0, `${label} Chrome did not start DevTools`);
  let target;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      target = (await response.json()).find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
      if (target) break;
    } catch {}
    await sleep(100);
  }
  assert.ok(target, `${label} Chrome has no page target`);
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  record.cdp = cdp;
  await cdp.open;
  await Promise.all([cdp.call('Runtime.enable'), cdp.call('Page.enable'), cdp.call('Network.enable')]);
  cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
    record.diagnostics.push(`JS: ${exceptionDetails?.text || 'exception'}`);
  });
  cdp.on('Network.loadingFailed', ({ errorText, requestId }) => {
    record.diagnostics.push(`LOAD: ${errorText} (${requestId})`);
  });
  cdp.on('Network.webSocketHandshakeResponseReceived', ({ response }) => {
    record.diagnostics.push(`WS HTTP ${response?.status || 'unknown'}`);
  });
  await cdp.call('Network.setExtraHTTPHeaders', { headers: { Authorization: auth } });
  const url = new URL(base);
  url.searchParams.set('room', roomId);
  await cdp.call('Page.navigate', { url: url.toString() });
  let last = null;
  while (Date.now() < deadline + 15_000) {
    last = await cdp.evaluate(readState);
    if (last.boot === 'ready' && ['AZURE', 'EMBER'].includes(last.team)) break;
    await sleep(150);
  }
  assert.equal(last.boot, 'ready', `${label} page did not boot: ${JSON.stringify({ last, diagnostics: record.diagnostics })}`);
  record.state = last;
  return record;
}

try {
  const room = await fetch(new URL(`/api/rooms/${roomId}`, base), {
    headers: { authorization: auth }, signal: AbortSignal.timeout(10_000),
  });
  assert.equal(room.status, 200, 'saved QA room should exist');
  const azure = await launch('azure');
  const ember = await launch('ember');
  const liveDeadline = Date.now() + 10_000;
  while (Date.now() < liveDeadline) {
    [azure.state, ember.state] = await Promise.all([
      azure.cdp.evaluate(readState), ember.cdp.evaluate(readState),
    ]);
    if ([azure.state, ember.state].every((state) =>
      state.network === 'ROOM LIVE' && state.players === '2 / 2 PLAYERS')) break;
    await sleep(150);
  }
  assert.ok([azure.state, ember.state].every((state) =>
    state.network === 'ROOM LIVE' && state.players === '2 / 2 PLAYERS'),
  `both browsers should see a live two-player room: ${JSON.stringify([azure.state, ember.state])}`);
  assert.equal(azure.state.team, 'AZURE', `first browser should own Azure: ${JSON.stringify(azure.state)}`);
  assert.equal(ember.state.team, 'EMBER', `second browser should own Ember: ${JSON.stringify(ember.state)}`);
  assert.ok(!azure.state.error, 'Azure runtime error should be empty');
  assert.ok(!ember.state.error, 'Ember runtime error should be empty');
  assert.ok(azure.state.canvas && ember.state.canvas, 'both browsers should render a canvas');
  assert.equal(azure.state.map, ember.state.map, 'both browsers should see the same map');

  await azure.cdp.evaluate("document.querySelector('#map-studio-open').click()");
  const studioOpen = await azure.cdp.evaluate("document.querySelector('#map-studio')?.open === true");
  assert.equal(studioOpen, true, 'Azure should be able to open Map Studio');
  const guestStudioDisabled = await ember.cdp.evaluate("document.querySelector('#map-studio-open')?.disabled === true");
  assert.equal(guestStudioDisabled, true, 'Ember should see host-only authoring');

  for (const record of [azure, ember]) {
    const shot = await record.cdp.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(path.join(os.tmpdir(), `rts-qa-staging-${record.label}.png`), Buffer.from(shot.data, 'base64'));
  }
  let authoredMap = null;
  let validationFeedback = null;
  if (authorMap) {
    const id = `qa-browser-${Date.now().toString(36)}`;
    const name = `QA Browser ${id}`;
    const downloadDir = path.join(tempRoot, 'downloads');
    await mkdir(downloadDir);
    await azure.cdp.call('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });
    await setField(azure.cdp, '#studio-id', 'Invalid Map ID!');
    await azure.cdp.evaluate("document.querySelector('#studio-download').click()");
    const invalidId = await azure.cdp.evaluate("document.querySelector('#studio-message').textContent");
    assert.match(invalidId, /Map ID must use lowercase letters, numbers, and hyphens/,
      'invalid map ID should name a concrete fix');
    const sourceMap = JSON.parse(await readFile(new URL('../maps/stone-pass.json', import.meta.url), 'utf8'));
    const unreachable = structuredClone(sourceMap);
    unreachable.obstacles = [{ column: 31, row: 0, width: 2, height: unreachable.height, material: 'stone' }];
    await importMap(azure.cdp, unreachable, 'unreachable.json');
    const unreachableResource = await waitFor(async () => {
      const message = await azure.cdp.evaluate("document.querySelector('#studio-message').textContent");
      return /Resource node .* must be reachable from both team spawns/.test(message) ? message : null;
    }, 'unreachable resource validation feedback');
    validationFeedback = { invalidId, unreachableResource };
    await importMap(azure.cdp, sourceMap, 'stone-pass.json');
    await waitFor(async () => {
      const message = await azure.cdp.evaluate("document.querySelector('#studio-message').textContent");
      return message.startsWith('Loaded stone-pass.json.') ? message : null;
    }, 'valid Stone Pass import');
    await setField(azure.cdp, '#studio-name', name);
    await setField(azure.cdp, '#studio-id', id);
    await setField(azure.cdp, '#studio-starting-food', '333');
    await azure.cdp.evaluate("document.querySelector('#studio-add-event').click()");
    await setField(azure.cdp, '#studio-event-name', 'Browser Supply');
    await setField(azure.cdp, '#studio-event-after', '60');
    await azure.cdp.evaluate("document.querySelector('#studio-download').click()");
    const downloadPath = path.join(downloadDir, `${id}.json`);
    await waitFor(async () => (await readdir(downloadDir)).includes(`${id}.json`), 'Map Studio JSON download');
    const exported = JSON.parse(await readFile(downloadPath, 'utf8'));
    assert.equal(exported.id, id, 'downloaded map should have edited ID');
    assert.equal(exported.name, name, 'downloaded map should have edited name');
    assert.equal(exported.startingResources?.food, 333, 'downloaded map should have edited starting food');
    assert.ok(exported.triggers?.length > 0, 'authored map should retain its capture objective');
    assert.ok(exported.scenarioEvents?.some((event) => event.name === 'Browser Supply'),
      'downloaded map should include the new scenario event');
    await azure.cdp.evaluate("document.querySelector('#studio-publish').click()");
    let publishObservation;
    await waitFor(async () => {
      const states = await Promise.all([azure.cdp.evaluate(readState), ember.cdp.evaluate(readState)]);
      publishObservation = {
        states,
        studioOpen: await azure.cdp.evaluate("document.querySelector('#map-studio').open"),
        studioMessage: await azure.cdp.evaluate("document.querySelector('#studio-message').textContent"),
      };
      return states.every((state) => state.map?.toUpperCase() === name.toUpperCase())
        && !publishObservation.studioOpen;
    }, 'saved map to reach both browsers').catch((error) => {
      throw new Error(`${error.message}: ${JSON.stringify(publishObservation)}`);
    });
    for (const record of [azure, ember]) {
      await record.cdp.call('Page.reload', { ignoreCache: true });
      record.state = await waitFor(async () => {
        const state = await record.cdp.evaluate(readState);
        return state.boot === 'ready' && state.team === record.label.toUpperCase()
          && state.map?.toUpperCase() === name.toUpperCase() ? state : null;
      }, `${record.label} browser to reclaim its seat and reload the saved map`, 20_000);
    }
    authoredMap = { id, name, downloadedBytes: (await stat(downloadPath)).size };
  }
  console.log(JSON.stringify({
    status: 'passed', origin: base.origin,
    azure: azure.state, ember: ember.state,
    mapStudioHostOpen: studioOpen, mapStudioGuestDisabled: guestStudioDisabled,
    authoredMap, validationFeedback,
    diagnostics: browsers.map(({ label, diagnostics }) => ({ label, diagnostics })),
  }, null, 2));
} finally {
  for (const record of browsers) {
    record.cdp?.close();
    if (record.child.exitCode === null && record.child.signalCode === null) record.child.kill('SIGTERM');
  }
  await Promise.all(browsers.map(({ child }) => new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once('exit', resolve);
    setTimeout(resolve, 3000);
  })));
  for (const { child } of browsers) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
  await rm(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
