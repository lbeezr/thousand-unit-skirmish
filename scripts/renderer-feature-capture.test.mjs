import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { CAPTURE_CASES, loadCaptureCases, runFeatureBatch, selectedCases, validateCaseResult } from './renderer-feature-capture.mjs';

const sourceRevision = 'a'.repeat(40), digest = `sha256:${'b'.repeat(64)}`;
const page = () => ({ cdp: { call: async () => ({}), evaluate: async () => ({}) }, wait: async () => ({}) });
const runtime = () => ({ page: page(), openPage: async () => page(), origin: 'http://127.0.0.1:4321',
  pack: { sourceRevision, digest }, browserVersion: { product: 'CPU mock' } });

test('explicit selections cannot dispatch paths, commands, unknown or duplicate cases', () => {
  assert.deepEqual(selectedCases('all'), Object.keys(CAPTURE_CASES));
  assert.deepEqual(selectedCases('worker-animations,novice-flow'), ['worker-animations', 'novice-flow']);
  for (const id of Object.keys(CAPTURE_CASES)) assert.deepEqual(selectedCases(id), [id]);
  for (const value of ['', '../private', 'worker-routes;echo', 'worker-routes,worker-routes', 'unknown', null,
    'novice-flow,unknown', 'novice-flow,', ',novice-flow', 'novice-flow, worker-animations']) assert.throws(() => selectedCases(value));
});
test('absent owned files block; broken imports and malformed exports fail safely', async () => {
  const missing = await loadCaptureCases('all', { exists: async () => { throw Object.assign(new Error('private-token'), { code: 'ENOENT' }); } });
  assert.equal(missing.adapters.length, 0); assert.equal(missing.issues.length, Object.keys(CAPTURE_CASES).length);
  assert.ok(missing.issues.every(issue => issue.code === 'case-unavailable'));
  for (const load of [async () => { throw Object.assign(new Error('private-token'), { code: 'ERR_MODULE_NOT_FOUND' }); },
    async () => ({ id: 'wrong', run() {} }), async () => ({ id: 'worker-routes' })]) {
    const result = await loadCaptureCases('worker-routes', { exists: async () => ({ isFile: () => true }), load });
    assert.deepEqual(result.issues, [{ id: 'worker-routes', code: 'case-invalid' }]);
    assert.doesNotMatch(JSON.stringify(result), /private-token/);
  }
});
test('unresolved feature checks and absent screenshots cannot claim passed', () => {
  const good = { status: 'passed', checks: [{ id: 'paid-spearman-heading-0', passed: true }] };
  assert.deepEqual(validateCaseResult(good, [{}]).checks, good.checks);
  assert.throws(() => validateCaseResult(good, []));
  for (const result of [{ ...good, status: 'unknown' }, { ...good, checks: [] }, { ...good, checks: [{ id: 'bad path', passed: true }] },
    { ...good, checks: [{ id: 'heading-0', passed: false }] }, { ...good, checks: [{ id: 'heading-0', passed: 'true' }] },
    { ...good, checks: [{ id: 1, passed: true }] },
    { ...good, checks: [good.checks[0], good.checks[0]] }]) assert.throws(() => validateCaseResult(result, [{}]));
  assert.equal(validateCaseResult({ status: 'blocked', checks: [{ id: 'missing-spearman-heading-7', passed: false }] }, []).status, 'blocked');
});
test('one absent case blocks the whole requested batch before browser acquisition', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tus-batch-test-'));
  try {
    let acquisitions = 0;
    const report = await runFeatureBatch('/pack', directory, 'all', {
      load: async () => ({ adapters: [], issues: [{ id: 'worker-routes', code: 'case-unavailable' }] }),
      qualify: async () => { acquisitions++; },
    });
    assert.equal(report.status, 'blocked'); assert.equal(acquisitions, 0);
    assert.equal(JSON.parse(await readFile(path.join(directory, 'batch.json'), 'utf8')).status, 'blocked');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('sequential batch binds screenshots to one pack and preserves blocked cases while other cases run', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tus-batch-test-'));
  const revision = 'a'.repeat(40), digest = `sha256:${'b'.repeat(64)}`, sequence = [];
  try {
    const adapters = Object.keys(CAPTURE_CASES).map(id => ({ id, run: async context => {
      sequence.push(id); assert.deepEqual(context.source, { revision, digest }); assert.equal(context.version, 1);
      assert.equal(context.evidenceDirectory, path.join(directory, id)); assert.equal(Object.isFrozen(context), true);
      assert.equal(Object.isFrozen(context.source), true);
      await context.capture({ mapId: 'bellweather-millrace', checkpoint: `${id}-departure` });
      return { status: id === 'worker-animations' ? 'blocked' : 'passed', checks: [{ id: 'ordinary-case-evidence', passed: id !== 'worker-animations' }] };
    } }));
    const report = await runFeatureBatch('/pack', directory, 'all', { load: async () => ({ adapters, issues: [] }),
      qualify: async (file, output, { captureCase }) => {
        assert.equal(file, '/pack'); assert.equal(path.basename(output), captureCase.id);
        const status = await captureCase.run(runtime());
        return { status, source: { revision, dirty: false }, release: { sourceRevision: revision, digest } };
      }, checkpoint: async context => {
        assert.equal(context.revision, revision);
        return { manifest: { source: { revision }, scene: { mapId: context.mapId }, viewport: { width: 1280, height: 720 }, image: { file: 'color.png', sha256: 'c'.repeat(64) } } };
      } });
    assert.deepEqual(sequence, Object.keys(CAPTURE_CASES)); assert.equal(report.status, 'blocked');
    assert.deepEqual(report.cases.map(entry => entry.status), Object.keys(CAPTURE_CASES).map(id => id === 'worker-animations' ? 'blocked' : 'passed'));
    assert.ok(report.cases.every(entry => entry.result.captures[0].source.revision === revision));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('deadline and swallowed or unawaited screenshot failures remain failures', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tus-batch-test-'));
  try {
    for (const mode of ['deadline', 'swallowed', 'unawaited', 'unfinished', 'foreign-page']) {
      let outcome;
      let count = 0;
      const report = await runFeatureBatch('/pack', directory, 'worker-routes', {
        timeoutMs: 20, load: async () => ({ issues: [], adapters: [{ id: 'worker-routes', run: async context => {
          if (mode === 'deadline') return new Promise(() => {});
          await context.capture({ mapId: 'ordinary-map', checkpoint: 'departure' }).catch(() => {});
          if (mode === 'unawaited' || mode === 'unfinished') void context.capture({ mapId: 'ordinary-map', checkpoint: 'contact' }).catch(() => {});
          if (mode === 'foreign-page') await context.capture({ page: {}, mapId: 'ordinary-map', checkpoint: 'foreign' }).catch(() => {});
          return { status: 'passed', checks: [{ id: 'route', passed: true }] };
        } }] }),
        checkpoint: async context => {
          count++;
          if (mode === 'swallowed') throw new Error('private-token');
          if (count === 2) { if (mode === 'unfinished') return new Promise(() => {});
            await new Promise(resolve => setTimeout(resolve, 2)); throw new Error('private-token'); }
          return { manifest: { source: {}, scene: { mapId: context.mapId }, viewport: {}, image: { file: 'color.png' } } };
        },
        qualify: async (_, __, { captureCase }) => {
          try { await captureCase.run(runtime()); }
          catch (error) { outcome = error; }
          return { status: 'failed' };
        },
      });
      assert.equal(report.status, 'failed'); assert.ok(outcome);
      assert.equal(['deadline', 'unfinished'].includes(mode) ? outcome.name : outcome.code,
        ['deadline', 'unfinished'].includes(mode) ? 'CaptureCaseTimeoutError' : 'ERR_ASSERTION');
      if (mode === 'foreign-page') assert.equal(count, 1);
      assert.doesNotMatch(JSON.stringify(report), /private-token/);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('completed and timed-out adapters cannot acquire pages or publish later captures', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tus-batch-test-'));
  try {
    for (const timeout of [false, true]) {
      let saved, acquisitions = 0, captures = 0;
      const report = await runFeatureBatch('/pack', directory, 'worker-routes', {
        timeoutMs: 5, load: async () => ({ issues: [], adapters: [{ id: 'worker-routes', run: async context => {
          saved = context;
          if (timeout) return new Promise(() => {});
          await context.capture({ mapId: 'ordinary-map', checkpoint: 'departure' });
          return { status: 'passed', checks: [{ id: 'route', passed: true }] };
        } }] }), qualify: async (_, __, { captureCase }) => {
          try { return { status: await captureCase.run({ ...runtime(), openPage: async () => { acquisitions++; return page(); } }) }; }
          catch { return { status: 'failed' }; }
        }, checkpoint: async context => {
          captures++; return { manifest: { source: {}, scene: { mapId: context.mapId }, viewport: {}, image: { file: 'color.png' } } };
        },
      });
      await assert.rejects(saved.openPage());
      await assert.rejects(saved.capture({ mapId: 'ordinary-map', checkpoint: 'late' }));
      assert.equal(acquisitions, 0); assert.equal(captures, timeout ? 0 : 1);
      assert.equal(report.status, timeout ? 'failed' : 'passed');
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('owner exports are validated through the actual loader before qualification', async () => {
  const resourceModule = await import('./worker-work-cycle-capture.mjs');
  const legacy = await loadCaptureCases('worker-routes', { exists: async () => ({ isFile: () => true }), load: async () => resourceModule });
  assert.deepEqual(legacy.issues, [{ id: 'worker-routes', code: 'case-invalid' }]);
  const prepared = await loadCaptureCases('novice-flow', { exists: async () => ({ isFile: () => true }),
    load: async () => ({ id: 'novice-flow', contextVersion: 1, run: async () => ({ status: 'blocked', checks: [{ id: 'not-rendered', passed: false }] }) }) });
  assert.equal(prepared.issues.length, 0); assert.equal(prepared.adapters[0].contextVersion, 1);
});
test('an explicit prepared subset loads real owner exports without silently adding unavailable cases', async () => {
  const loaded = await loadCaptureCases('worker-animations,novice-flow');
  assert.deepEqual(loaded.issues, []);
  assert.deepEqual(loaded.adapters.map(adapter => [adapter.id, adapter.contextVersion]), [['worker-animations', 1], ['novice-flow', 1]]);
});
test('prepared forest, site and tree adapters satisfy the actual version1 loader contract', async () => {
  const loaded = await loadCaptureCases('forest-jobs,site-composition,tree-targeting');
  assert.deepEqual(loaded.issues, []);
  assert.deepEqual(loaded.adapters.map(adapter => [adapter.id, adapter.contextVersion]),
    [['forest-jobs', 1], ['site-composition', 1], ['tree-targeting', 1]]);
});
test('ordinary workflow is manual, source-pinned, globally serialized, read-only and validates cases before preflight', async () => {
  const workflow = await readFile(new URL('../.github/workflows/ordinary-game-capture.yml', import.meta.url), 'utf8');
  assert.match(workflow, /workflow_dispatch:/); assert.doesNotMatch(workflow, /pull_request:|push:/);
  assert.match(workflow, /ref: \$\{\{ github.sha \}\}/); assert.match(workflow, /contents: read/);
  assert.match(workflow, /group: ordinary-game-capture\n  cancel-in-progress: false/);
  assert.match(workflow, /timeout-minutes: 30/); assert.match(workflow, /retention-days: 1/);
  for (const id of Object.keys(CAPTURE_CASES)) assert.ok(workflow.includes(`- ${id}`));
  assert.ok(workflow.includes('worker-animations,novice-flow'));
  assert.ok(workflow.indexOf('--check "$CASES"') < workflow.indexOf('renderer-qualification.mjs --preflight'));
  assert.doesNotMatch(workflow, /no-sandbox|sudo|secrets\.|continue-on-error/);
});
