// One explicit ordinary-feature batch; no arbitrary path or command dispatch.
import assert from 'node:assert/strict';
import { mkdir, lstat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureCheckpoint } from './capture-checkpoint.mjs';
import { CaptureCaseTimeoutError, qualifyPackedGame } from './renderer-qualification.mjs';

export const CAPTURE_CASES = Object.freeze({
  'worker-animations': './renderer-worker-animation-scenario.mjs',
  'novice-flow': './renderer-novice-flow-scenario.mjs',
  'worker-routes': './renderer-worker-route-scenario.mjs',
  'building-catalog': './renderer-building-catalog-scenario.mjs',
});
export function selectedCases(selection) {
  assert.ok(selection === 'all' || Object.hasOwn(CAPTURE_CASES, selection), 'select a registered capture case or all');
  return selection === 'all' ? Object.keys(CAPTURE_CASES) : [selection];
}
export async function loadCaptureCases(selection, { exists = lstat, load = url => import(url) } = {}) {
  const adapters = [], issues = [];
  for (const id of selectedCases(selection)) {
    try {
      const url = new URL(CAPTURE_CASES[id], import.meta.url);
      try { assert.equal((await exists(url)).isFile(), true, 'adapter must be an owned regular file'); }
      catch (error) { if (error.code === 'ENOENT') { issues.push({ id, code: 'case-unavailable' }); continue; } throw error; }
      const adapter = await load(url);
      assert.equal(adapter.id, id, 'adapter must export its registered identity');
      assert.equal(typeof adapter.run, 'function', 'adapter must export run(context)');
      adapters.push({ id, run: adapter.run });
    } catch (error) {
      // Missing owned cases are expected preparation gaps; broken imports or
      // invalid adapter exports are executable faults, never silently skipped.
      issues.push({ id, code: 'case-invalid' });
    }
  }
  return { adapters, issues };
}
export function validateCaseResult(result, captures) {
  assert.ok(result && ['passed', 'failed', 'blocked'].includes(result.status), 'case must return a known status');
  assert.ok(Array.isArray(result.checks) && result.checks.length > 0 && result.checks.length <= 128, 'bounded case checks are required');
  const ids = new Set();
  const checks = result.checks.map(check => {
    assert.ok(check && typeof check.id === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(check.id) && !ids.has(check.id)
      && typeof check.passed === 'boolean', 'case checks need unique safe identities and boolean results');
    ids.add(check.id); return { id: check.id, passed: check.passed };
  });
  if (result.status === 'passed') {
    assert.ok(checks.every(check => check.passed), 'unresolved feature checks cannot pass');
    assert.ok(captures.length > 0, 'passed case must retain actual checkpoint screenshots');
  }
  return { status: result.status, checks, captures };
}
export async function runFeatureBatch(packFile, outputDirectory, selection = 'all', {
  load = loadCaptureCases, qualify = qualifyPackedGame, checkpoint = captureCheckpoint, timeoutMs = 180000,
} = {}) {
  await mkdir(outputDirectory, { recursive: true });
  assert.ok(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 180000, 'capture case deadline must stay within three minutes');
  const loaded = await load(selection);
  const batch = { schemaVersion: 1, scope: 'ordinary-feature-batch', requestedCases: selectedCases(selection),
    status: loaded.issues.some(issue => issue.code === 'case-invalid') ? 'failed' : 'blocked',
    issues: loaded.issues, cases: [] };
  // All requested cases must exist before any browser starts. Never substitute
  // the infrastructure movement pilot for absent ordinary feature acceptance.
  if (!batch.issues.length) {
    assert.deepEqual(loaded.adapters.map(adapter => adapter.id), batch.requestedCases, 'requested case order must be complete and unique');
    for (const adapter of loaded.adapters) {
      const directory = path.join(outputDirectory, adapter.id), captures = [];
      let result, timer, captureCount = 0, operationFailed = false;
      const qualification = await qualify(packFile, directory, { captureCase: { id: adapter.id,
        run: async context => {
          const ownedPages = new Set([context.page]), operations = new Set();
          let accepting = true, retaining = true;
          const track = operation => {
            const promise = Promise.resolve().then(operation).catch(error => { operationFailed = true; throw error; });
            operations.add(promise);
            // Preserve rejection for callers and the drain even if an adapter
            // forgets to await it; never emit an unhandled private payload.
            promise.catch(() => {});
            return promise;
          };
          const openPage = () => {
            const allowed = accepting;
            return track(async () => {
              assert.equal(allowed, true, 'capture context is closed');
              const page = await context.openPage();
              assert.equal(retaining, true, 'capture context is closed');
              ownedPages.add(page); return page;
            });
          };
          const capture = options => {
            // Reserve and validate synchronously before the adapter can finish.
            const allowed = accepting;
            const count = ++captureCount;
            return track(async () => {
              assert.equal(allowed, true, 'capture context is closed');
              assert.ok(count <= 64, 'case screenshot count exceeded');
              const { page = context.page, mapId, checkpoint: name } = options;
              assert.ok(ownedPages.has(page), 'screenshots require an owned instrumented page');
              const capture = await checkpoint({ page, revision: context.pack.sourceRevision,
                browserVersion: context.browserVersion, mapId, checkpoint: name, outputDirectory: directory });
              const manifest = capture.manifest;
              if (retaining) captures.push({ checkpoint: name, mapId: manifest.scene.mapId, source: manifest.source,
                viewport: manifest.viewport, image: { ...manifest.image, file: `${name}/${manifest.image.file}` } });
              return capture;
            });
          };
          try {
            const runAndDrain = async () => {
              let outcome;
              try { outcome = await adapter.run({ page: context.page, openPage, capture, origin: context.origin,
                source: Object.freeze({ revision: context.pack.sourceRevision, digest: context.pack.digest }) }); }
              finally { accepting = false; }
              await Promise.allSettled([...operations]);
              assert.equal(operationFailed, false, 'failed capture operations cannot be hidden by a passing adapter');
              return outcome;
            };
            const outcome = await Promise.race([runAndDrain(),
              new Promise((_, reject) => { timer = setTimeout(() => reject(new CaptureCaseTimeoutError()), timeoutMs); })]);
            result = validateCaseResult(outcome, captures); return result.status;
          } finally { accepting = false; retaining = false; clearTimeout(timer); }
        } } });
      batch.cases.push({ id: adapter.id, status: qualification.status, source: qualification.source,
        release: qualification.release, result: result ?? { status: qualification.status, checks: [], captures },
        qualification: `${adapter.id}/qualification.json` });
    }
    batch.status = batch.cases.some(entry => entry.status === 'failed') ? 'failed'
      : batch.cases.every(entry => entry.status === 'passed') ? 'passed' : 'blocked';
  }
  await writeFile(path.join(outputDirectory, 'batch.json'), `${JSON.stringify(batch, null, 2)}\n`);
  return batch;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--check' && process.argv.length === 4) {
    const loaded = await loadCaptureCases(process.argv[3]);
    console.log(JSON.stringify({ cases: loaded.adapters.map(adapter => adapter.id), issues: loaded.issues }));
    process.exitCode = loaded.issues.length ? 1 : 0;
  } else if (process.argv.length === 5) {
    const result = await runFeatureBatch(process.argv[2], process.argv[3], process.argv[4]);
    console.log(JSON.stringify(result)); process.exitCode = result.status === 'passed' ? 0 : 1;
  } else {
    process.stderr.write('Usage: node scripts/renderer-feature-capture.mjs --check all|CASE\n       node scripts/renderer-feature-capture.mjs PACK_JSON EVIDENCE_DIRECTORY all|CASE\n');
    process.exitCode = 2;
  }
}
