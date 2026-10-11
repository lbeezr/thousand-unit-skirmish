// HUD-owned staging capture. Uses the qualified Linux browser and ordinary UI;
// public file hashes are not a substitute for a provider deployment identity.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFortifiedBrowser } from './fortified-browser-fixture.mjs';
import { validateRosterCapability, observeRosterBrowser } from './renderer-roster-audio-staging.mjs';
import { STAGING_ORIGIN, validateStagingOrigin } from './renderer-roster-audio-plan.mjs';
import { captureHudStaging } from './renderer-hud-staging-scenario.mjs';

export const HUD_CASES = Object.freeze(['selections', 'buildings', 'panels']);
export const HUD_PUBLIC_FILES = Object.freeze(['index.html', 'style.css', 'src/main.js',
  'src/client/hud/selection-hud.css', 'src/client/hud/worker-hud.mjs', 'src/client/hud/worker-hud.css',
  'src/client/hud/building-hud.mjs', 'src/client/hud/building-hud.css',
  'src/client/hud/unit-hud.mjs', 'src/client/hud/unit-hud.css', 'src/client/hud/wildlife-hud.mjs',
  'src/client/hud/match-ui.css', 'assets/ui/fonts/dm-sans.ttf', 'assets/ui/fonts/barlow-condensed-medium.ttf']);
export const HUD_TIMEOUT_MS = 300000;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function hudMatrix(requested) {
  if (requested === 'all') return [...HUD_CASES];
  assert.ok(HUD_CASES.includes(requested), 'unknown HUD case'); return [requested];
}
export async function identifyHudSource(origin, revision, { fetcher = fetch,
  read = file => readFile(new URL(`../${file}`, import.meta.url)) } = {}) {
  validateStagingOrigin(origin); assert.match(revision, /^[a-f0-9]{40}$/);
  const files = [];
  for (const file of HUD_PUBLIC_FILES) {
    const response = await fetcher(`${origin}/${file}`, { redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200, 'HUD public source unavailable');
    let size = 0; const chunks = [];
    for await (const chunk of response.body) { size += chunk.length; assert.ok(size <= 2000000); chunks.push(chunk); }
    const bytes = Buffer.concat(chunks), sha256 = hash(bytes);
    assert.equal(sha256, hash(await read(file)), 'staging HUD source differs from checkout');
    files.push({ path: `/${file}`, bytes: bytes.length, sha256 });
  }
  return { expectedRevision: revision, identityScope: 'exact-public-HUD-file-hashes',
    deployedRevision: null, releaseDigest: null, files };
}

export async function runHudStaging({ subset, revision, directory, preflightFile }, {
  openBrowser = createFortifiedBrowser, identify = identifyHudSource, capture = captureHudStaging,
  source = () => ({ revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '' }),
  platform = process.platform,
} = {}) {
  assert.ok(HUD_CASES.includes(subset)); assert.match(revision, /^[a-f0-9]{40}$/);
  assert.ok(path.isAbsolute(directory) && path.isAbsolute(preflightFile));
  const actual = source(); assert.equal(actual.revision, revision); assert.equal(actual.dirty, false);
  validateRosterCapability(JSON.parse(await readFile(preflightFile, 'utf8')), revision, platform);
  await mkdir(directory);
  const report = { schemaVersion: 1, subset, expectedRevision: revision, scope: 'public-staging-HUD',
    status: 'failed', sandbox: 'enabled', deployedRevision: null, releaseDigest: null,
    appearanceReview: 'pending', issues: [] };
  let browser, observer, timer;
  try {
    report.source = await identify(STAGING_ORIGIN, revision);
    browser = await openBrowser(); report.browser = browser.version.product;
    const page = await browser.page('about:blank');
    observer = observeRosterBrowser(page, STAGING_ORIGIN, HUD_PUBLIC_FILES);
    const controller = new AbortController();
    timer = setTimeout(() => { controller.abort(); void page.dispose().catch(() => {}); }, HUD_TIMEOUT_MS);
    const outcome = await capture({ page, origin: STAGING_ORIGIN, subset, directory, signal: controller.signal });
    clearTimeout(timer);
    report.captureStatus = outcome.status;
    // A deployment during the run cannot silently mix two HUD revisions.
    report.sourceAfter = await identify(STAGING_ORIGIN, revision);
    report.browserObservation = observer.finish(); observer = null;
    if (!controller.signal.aborted && outcome.status === 'captured-needs-review' && report.browserObservation.passed) {
      report.status = 'captured-needs-review';
    } else report.issues.push({ code: controller.signal.aborted ? 'case-deadline' : 'capture-or-browser-failure' });
  } catch { report.issues.push({ code: 'staging-HUD-contract-failed' }); }
  finally {
    clearTimeout(timer); if (observer) report.browserObservation = observer.finish();
    try { await browser?.dispose(); }
    catch { report.status = 'failed'; report.issues.push({ code: 'owned-browser-cleanup-failed' }); }
    await writeFile(path.join(directory, 'qualification.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  }
  return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 2 && args[0] === '--matrix') console.log(JSON.stringify(hudMatrix(args[1])));
    else {
      assert.equal(args.length, 4);
      const [subset, revision, directory, preflightFile] = args;
      const report = await runHudStaging({ subset, revision, directory: path.resolve(directory), preflightFile: path.resolve(preflightFile) });
      console.log(JSON.stringify({ subset, status: report.status, appearanceReview: report.appearanceReview }));
      process.exitCode = report.status === 'captured-needs-review' ? 0 : 1;
    }
  } catch { console.error('HUD capture prerequisites failed; see safe retained receipts.'); process.exitCode = 1; }
}
