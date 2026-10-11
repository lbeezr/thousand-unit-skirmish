// Separate staging runner: shared loopback/release validators remain unchanged.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFortifiedBrowser } from './fortified-browser-fixture.mjs';
import { safeRequestDiagnostic } from './renderer-qualification.mjs';
import { captureRosterSubset, identifyPublicAudioSource } from './renderer-roster-audio-capture.mjs';
import { rosterPlan, rosterSubsets, STAGING_ORIGIN, SUBSET_TIMEOUT_MS } from './renderer-roster-audio-plan.mjs';

export function rosterMatrix(requested) {
  if (requested === 'all') return [...rosterSubsets];
  rosterPlan(requested); return [requested];
}
export function validateRosterCapability(capability, revision, platform = process.platform) {
  assert.equal(platform, 'linux', 'roster capture is cloud Linux only');
  assert.equal(capability.status, 'ready'); assert.equal(capability.webglReadbackPassed, true);
  assert.equal(capability.sandbox, 'enabled'); assert.equal(capability.launchAttempts, 1);
  assert.equal(capability.source.revision, revision); assert.equal(capability.source.dirty, false);
}
export function observeRosterBrowser(page, origin, files) {
  const events = [], requests = new Map(); let active = true, overflow = false;
  const record = event => { if (active) { if (events.length < 128) events.push(event); else overflow = true; } };
  page.cdp.on('Runtime.exceptionThrown', () => record({ kind: 'exception' }));
  page.cdp.on('Runtime.consoleAPICalled', e => { if (e.type === 'error') record({ kind: 'console-error' }); });
  page.cdp.on('Network.requestWillBeSent', e => {
    if (!active) return;
    if (requests.size >= 2048) { overflow = true; return; }
    const diagnostic = safeRequestDiagnostic(e.request.url, origin, files, e.type);
    let purpose = 'other';
    try {
      const url = new URL(e.request.url);
      if (url.origin === origin) purpose = url.pathname === '/api/rooms/status' ? 'room-service-status'
        : url.pathname === '/api/rooms' ? 'room-create'
        : /^\/api\/rooms\/[A-Za-z0-9_-]{32}$/.test(url.pathname) ? 'room-lookup'
        : url.pathname === '/api/session' ? 'session-check' : 'other';
    } catch {}
    requests.set(e.requestId, { ...diagnostic, purpose,
      ...(Number.isFinite(e.timestamp) ? { startedAt: e.timestamp } : {}) });
  });
  page.cdp.on('Network.responseReceived', e => {
    const request = requests.get(e.requestId);
    if (request) request.responseStatus = e.response.status;
    if (e.response.status >= 400) record({ kind: 'http-error', status: e.response.status,
      ...safeRequestDiagnostic(e.response.url, origin, files, e.type) });
  });
  page.cdp.on('Network.loadingFailed', e => {
    const request = requests.get(e.requestId) ?? { path: null, route: 'unknown', scheme: 'unknown', resourceType: 'unknown' };
    record({ kind: 'request-failed', ...request, canceled: e.canceled === true,
      ...(Number.isFinite(e.timestamp) && Number.isFinite(request.startedAt)
        ? { elapsedMs: Math.round((e.timestamp - request.startedAt) * 1000) } : {}) });
    requests.delete(e.requestId);
  });
  page.cdp.on('Network.loadingFinished', e => requests.delete(e.requestId));
  return { finish() {
    active = false;
    // Anonymous staging rejects this absent optional icon at its authentication
    // boundary (401); local qualification returns 404. Retain both diagnostics.
    // All gameplay assets/authentication errors and canceled room API requests
    // still fail the browser gate, even when valid recordings survive.
    const unexpected = events.filter(e => !(e.kind === 'http-error' && e.path === '/favicon.ico' && [401, 404].includes(e.status)));
    return { events, overflow, passed: !overflow && unexpected.length === 0 };
  } };
}

export async function runRosterStaging({ subset, revision, directory, preflightFile }, {
  openBrowser = createFortifiedBrowser, identify = identifyPublicAudioSource,
  source = () => ({ revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '' }),
  platform = process.platform, capture = captureRosterSubset,
} = {}) {
  const plan = rosterPlan(subset); assert.match(revision, /^[a-f0-9]{40}$/);
  assert.ok(path.isAbsolute(directory) && path.isAbsolute(preflightFile));
  const actual = source(); assert.equal(actual.revision, revision); assert.equal(actual.dirty, false);
  const capability = JSON.parse(await readFile(preflightFile, 'utf8'));
  validateRosterCapability(capability, revision, platform);
  await mkdir(directory);
  let browser, timer, observation;
  const qualification = { schemaVersion: 1, subset, expectedRevision: revision, status: 'failed',
    deployedRevision: null, releaseDigest: null, sandbox: 'enabled', maxDurationMs: SUBSET_TIMEOUT_MS,
    scope: 'public-staging-native-audio', listeningReview: 'pending', issues: [] };
  const controller = new AbortController();
  let guestOpened = false;
  const guests = new Set(), guestObservations = [];
  try {
    const verified = await identify(STAGING_ORIGIN, revision);
    await writeFile(path.join(directory, 'public-source.json'), JSON.stringify(verified.identity, null, 2) + '\n', { flag: 'wx' });
    browser = await openBrowser(); qualification.browser = browser.version.product;
    const page = await browser.page('about:blank');
    observation = observeRosterBrowser(page, STAGING_ORIGIN, verified.identity.files.map(file => file.path.slice(1)));
    // Dispose the owned context to interrupt a CDP wait when the case expires;
    // await its failure/persistence path before ending the process or artifacts.
    timer = setTimeout(() => {
      controller.abort();
      for (const owned of [page, ...guests]) void owned.dispose().catch(() => {});
    }, SUBSET_TIMEOUT_MS);
    const openGuest = async () => {
      assert.ok(plan.repair && !guestOpened, 'only Repair may open its one owned guest');
      guestOpened = true; controller.signal.throwIfAborted();
      const guest = await browser.page('about:blank');
      const observed = observeRosterBrowser(guest, STAGING_ORIGIN, verified.identity.files.map(file => file.path.slice(1)));
      let disposed = false;
      const owned = { ...guest, dispose: async () => {
        if (disposed) return;
        disposed = true; guests.delete(owned); guestObservations.push(observed.finish()); await guest.dispose();
      } };
      guests.add(owned);
      if (controller.signal.aborted) { await owned.dispose(); controller.signal.throwIfAborted(); }
      return owned;
    };
    const result = await capture({ page, origin: STAGING_ORIGIN, revision, subset, directory,
      manifest: verified.manifest, identity: verified.identity, signal: controller.signal, openGuest });
    clearTimeout(timer);
    qualification.captureStatus = result.status;
    qualification.browserObservation = observation.finish(); observation = null;
    if (plan.repair) qualification.guestObservations = guestObservations;
    if (!controller.signal.aborted && result.status === 'captured-needs-listening' && qualification.browserObservation.passed
      && (!plan.repair || guestOpened && guests.size === 0 && guestObservations.length === 1 && guestObservations[0].passed)) {
      qualification.status = 'captured-needs-listening';
    } else qualification.issues.push({ code: controller.signal.aborted ? 'subset-deadline' : 'incomplete-capture-or-browser-errors' });
  } catch {
    qualification.issues.push({ code: 'staging-roster-contract-failed' });
  } finally {
    clearTimeout(timer);
    if (observation) qualification.browserObservation = observation.finish();
    for (const guest of [...guests]) {
      try { await guest.dispose(); }
      catch { qualification.status = 'failed'; qualification.issues.push({ code: 'owned-guest-cleanup-failed' }); }
    }
    if (plan.repair) qualification.guestObservations = guestObservations;
    try { await browser?.dispose(); }
    catch { qualification.status = 'failed'; qualification.issues.push({ code: 'owned-browser-cleanup-failed' }); }
    await writeFile(path.join(directory, 'qualification.json'), JSON.stringify(qualification, null, 2) + '\n', { flag: 'wx' });
  }
  return qualification;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 2 && args[0] === '--matrix') console.log(JSON.stringify(rosterMatrix(args[1])));
    else {
      assert.equal(args.length, 4, 'subset revision new-directory preflight-json required');
      const [subset, revision, directory, preflightFile] = args;
      const result = await runRosterStaging({ subset, revision, directory: path.resolve(directory), preflightFile: path.resolve(preflightFile) });
      console.log(JSON.stringify({ subset, status: result.status, listeningReview: result.listeningReview }));
      process.exitCode = result.status === 'captured-needs-listening' ? 0 : 1;
    }
  } catch { console.error('Roster audio prerequisites or bounded capture failed; see retained safe receipts.'); process.exitCode = 1; }
}
