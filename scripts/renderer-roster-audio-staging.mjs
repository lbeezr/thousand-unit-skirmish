// Separate staging runner: shared loopback/release validators remain unchanged.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFortifiedBrowser } from './fortified-browser-fixture.mjs';
import { safeRequestDiagnostic } from './renderer-qualification.mjs';
import { captureRosterSubset, identifyPublicAudioSource, validateReviewRoom } from './renderer-roster-audio-capture.mjs';
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

const checkoutSource = () => ({ revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '' });
async function validatePrerequisites({ revision, directory, preflightFile }, { source = checkoutSource, platform = process.platform } = {}) {
  assert.match(revision, /^[a-f0-9]{40}$/); assert.ok(path.isAbsolute(directory) && path.isAbsolute(preflightFile));
  const actual = source(); assert.equal(actual.revision, revision); assert.equal(actual.dirty, false);
  validateRosterCapability(JSON.parse(await readFile(preflightFile, 'utf8')), revision, platform);
}
async function runOwnedRosterCase({ browser, page, verified, subset, revision, directory, reuseRoom = false, reviewRoom = null }, capture) {
  const plan = rosterPlan(subset);
  let timer, observation, result;
  const qualification = { schemaVersion: 1, subset, expectedRevision: revision, status: 'failed',
    deployedRevision: null, releaseDigest: null, sandbox: 'enabled', maxDurationMs: SUBSET_TIMEOUT_MS,
    scope: 'public-staging-native-audio', listeningReview: 'pending', issues: [] };
  const controller = new AbortController();
  let guestOpened = false, guestCleanupFailed = false;
  const guests = new Set(), guestObservations = [];
  try {
    await writeFile(path.join(directory, 'public-source.json'), JSON.stringify(verified.identity, null, 2) + '\n', { flag: 'wx' });
    qualification.browser = browser.version.product;
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
        disposed = true; guests.delete(owned); guestObservations.push(observed.finish());
        try { await guest.dispose(); }
        catch (error) { guestCleanupFailed = true; throw error; }
      } };
      guests.add(owned);
      if (controller.signal.aborted) { await owned.dispose(); controller.signal.throwIfAborted(); }
      return owned;
    };
    result = await capture({ page, origin: STAGING_ORIGIN, revision, subset, directory, reuseRoom, reviewRoom,
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
      catch { guestCleanupFailed = true; }
    }
    if (guestCleanupFailed) { qualification.status = 'failed'; qualification.issues.push({ code: 'owned-guest-cleanup-failed' }); }
    if (plan.repair) qualification.guestObservations = guestObservations;
    await writeFile(path.join(directory, 'qualification.json'), JSON.stringify(qualification, null, 2) + '\n', { flag: 'wx' });
  }
  const entrySucceeded = result?.entry?.mapId === `audio-${subset}`;
  let pageUsable = false;
  if (entrySucceeded && !controller.signal.aborted) {
    try { pageUsable = await page.cdp.evaluate(`document.documentElement?.dataset.boot === 'ready'
      && window.__rtsInteractionAudioSnapshot?.().mapId === ${JSON.stringify(`audio-${subset}`)}
      && window.__rtsInteractionAudioSnapshot().team === 0`) === true; }
    catch { /* A disposed or lost context cannot be reused. */ }
  }
  const reusable = pageUsable
    && (!plan.repair || guestOpened && guests.size === 0 && guestObservations.length === 1)
    && !qualification.issues.some(issue => ['owned-guest-cleanup-failed', 'staging-roster-contract-failed'].includes(issue.code));
  return { qualification, entrySucceeded, reusable };
}

export async function runRosterStaging(options, {
  openBrowser = createFortifiedBrowser, identify = identifyPublicAudioSource,
  source = checkoutSource, platform = process.platform, capture = captureRosterSubset,
  reviewRoom = process.env.RTS_AUDIO_REVIEW_ROOM,
} = {}) {
  reviewRoom = validateReviewRoom(reviewRoom);
  const { subset, revision, directory } = options; rosterPlan(subset);
  await validatePrerequisites(options, { source, platform }); await mkdir(directory);
  let browser, qualification;
  try {
    const verified = await identify(STAGING_ORIGIN, revision);
    browser = await openBrowser(); const page = await browser.page('about:blank');
    ({ qualification } = await runOwnedRosterCase({ browser, page, verified, subset, revision, directory, reviewRoom }, capture));
  } catch {
    qualification = { schemaVersion: 1, subset, expectedRevision: revision, status: 'failed', listeningReview: 'pending',
      issues: [{ code: 'staging-roster-contract-failed' }] };
  } finally {
    try { await browser?.dispose(); }
    catch { qualification.status = 'failed'; qualification.issues.push({ code: 'owned-browser-cleanup-failed' }); }
    await writeFile(path.join(directory, 'qualification.json'), JSON.stringify(qualification, null, 2) + '\n');
  }
  return qualification;
}

// One owned room and page across all subsets. Native reload/import in capture
// resets each map; a missing entry or lost context never creates a replacement.
export async function runRosterStagingBatch(options, {
  openBrowser = createFortifiedBrowser, identify = identifyPublicAudioSource,
  source = checkoutSource, platform = process.platform, capture = captureRosterSubset,
  reviewRoom = process.env.RTS_AUDIO_REVIEW_ROOM,
} = {}) {
  reviewRoom = validateReviewRoom(reviewRoom);
  const { revision, directory } = options;
  await validatePrerequisites(options, { source, platform }); await mkdir(directory);
  const subsets = ['unit-worker', 'buildings-home', ...rosterSubsets.filter(subset => !['unit-worker', 'buildings-home'].includes(subset))];
  const report = { schemaVersion: 1, status: 'failed', expectedRevision: revision,
    deployedRevision: null, releaseDigest: null, roomScope: 'one-owned-public-room',
    maxSubsetDurationMs: SUBSET_TIMEOUT_MS, plannedSubsets: subsets, results: [],
    notRunSubsets: [...subsets], listeningReview: 'pending', issues: [] };
  const file = path.join(directory, 'batch.json');
  await writeFile(file, '{}\n', { flag: 'wx' });
  const persist = () => writeFile(file, JSON.stringify(report, null, 2) + '\n');
  await persist(); let browser;
  try {
    const verified = await identify(STAGING_ORIGIN, revision);
    await writeFile(path.join(directory, 'public-source.json'), JSON.stringify(verified.identity, null, 2) + '\n', { flag: 'wx' });
    browser = await openBrowser(); const page = await browser.page('about:blank');
    for (const [index, subset] of subsets.entries()) {
      const caseDirectory = path.join(directory, subset); await mkdir(caseDirectory);
      const outcome = await runOwnedRosterCase({ browser, page, verified, subset, revision,
        directory: caseDirectory, reuseRoom: index > 0, reviewRoom: index === 0 ? reviewRoom : null }, capture);
      reviewRoom = null;
      const { qualification, entrySucceeded, reusable } = outcome;
      const caseStatus = qualification.status;
      qualification.status = 'failed';
      qualification.sourceCheck = { beforeMatch: true, afterMatch: false };
      await writeFile(path.join(caseDirectory, 'qualification.json'), JSON.stringify(qualification, null, 2) + '\n');
      try {
        const after = await identify(STAGING_ORIGIN, revision);
        assert.deepEqual(after.identity.files, verified.identity.files);
        assert.deepEqual(after.manifest, verified.manifest);
        qualification.sourceCheck.afterMatch = true;
        qualification.status = caseStatus;
      } catch { qualification.issues.push({ code: 'public-source-after-capture-mismatch' }); }
      if (!entrySucceeded) {
        qualification.status = 'failed'; qualification.issues.push({ code: 'owned-room-entry-missing' });
      }
      await writeFile(path.join(caseDirectory, 'qualification.json'), JSON.stringify(qualification, null, 2) + '\n');
      report.results.push({ subset, status: qualification.status, entrySucceeded, issues: qualification.issues });
      report.notRunSubsets = subsets.slice(index + 1); await persist();
      if (!qualification.sourceCheck.afterMatch) { report.issues.push({ code: 'public-source-changed-or-unavailable', subset }); break; }
      if (!reusable) { report.issues.push({ code: 'owned-room-no-longer-reusable', subset }); break; }
    }
    if (!report.issues.length && !report.notRunSubsets.length && report.results.length === subsets.length
      && report.results.every(result => result.status === 'captured-needs-listening')) report.status = 'captured-needs-listening';
  } catch {
    report.issues.push({ code: 'staging-roster-batch-contract-failed' });
  } finally {
    try { await browser?.dispose(); }
    catch { report.status = 'failed'; report.issues.push({ code: 'owned-browser-cleanup-failed' }); }
    await persist();
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 2 && args[0] === '--matrix') console.log(JSON.stringify(rosterMatrix(args[1])));
    else {
      assert.equal(args.length, 4, 'subset revision new-directory preflight-json required');
      const [subset, revision, directory, preflightFile] = args;
      const run = subset === 'all' ? runRosterStagingBatch : runRosterStaging;
      const result = await run({ subset, revision, directory: path.resolve(directory), preflightFile: path.resolve(preflightFile) });
      console.log(JSON.stringify({ subset, status: result.status, listeningReview: result.listeningReview }));
      process.exitCode = result.status === 'captured-needs-listening' ? 0 : 1;
    }
  } catch { console.error('Roster audio prerequisites or bounded capture failed; see retained safe receipts.'); process.exitCode = 1; }
}
