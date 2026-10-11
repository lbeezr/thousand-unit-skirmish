// CPU orchestration contracts only; no browser, room or listening claim.
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runRosterStagingBatch } from './renderer-roster-audio-staging.mjs';
import { rosterSubsets, STAGING_ORIGIN, SUBSET_TIMEOUT_MS } from './renderer-roster-audio-plan.mjs';

const revision = 'a'.repeat(40);
const identity = { expectedRevision: revision, files: [{ path: '/src/main.js', sha256: 'b'.repeat(64), bytes: 12 }] };
const manifest = { pack: { id: 'fixture' } };
async function fixture(t, { capture, identify, guestCleanupFails = false } = {}) {
  const temporary = await mkdtemp(path.join(tmpdir(), 'roster-audio-batch-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const preflightFile = path.join(temporary, 'preflight.json');
  await writeFile(preflightFile, JSON.stringify({ status: 'ready', webglReadbackPassed: true, sandbox: 'enabled',
    launchAttempts: 1, source: { revision, dirty: false } }));
  const f = { opened: 0, disposed: 0, pages: [], calls: [], identified: 0, active: 0, maxActive: 0 };
  f.options = { revision, directory: path.join(temporary, 'evidence'), preflightFile };
  f.dependencies = {
    platform: 'linux', source: () => ({ revision, dirty: false }),
    identify: async (origin, actualRevision) => {
      assert.equal(origin, STAGING_ORIGIN); assert.equal(actualRevision, revision); f.identified++;
      return identify ? identify(f) : { identity: structuredClone(identity), manifest: structuredClone(manifest) };
    },
    openBrowser: async () => {
      f.opened++;
      return { version: { product: 'cpu-contract' }, dispose: async () => { f.disposed++; }, page: async url => {
        assert.equal(url, 'about:blank');
        const listeners = new Map();
        const page = { usable: true, disposed: 0,
          emit: (name, event = {}) => { for (const fn of listeners.get(name) ?? []) fn(event); },
          cdp: { on: (name, fn) => { const handlers = listeners.get(name) ?? []; handlers.push(fn); listeners.set(name, handlers); },
            evaluate: async expression => {
              assert.ok(expression.includes('__rtsInteractionAudioSnapshot')); assert.ok(!expression.includes('location.href'));
              if (page.disposed) throw Error('closed context');
              return page.usable;
            } },
          dispose: async () => { page.disposed++; if (guestCleanupFails && f.pages.indexOf(page) > 0) throw Error('guest cleanup failed'); },
        };
        f.pages.push(page); return page;
      } };
    },
    capture: async args => {
      f.calls.push(args); f.active++; f.maxActive = Math.max(f.maxActive, f.active);
      try {
        assert.deepEqual(args.manifest, manifest); assert.deepEqual(args.identity, identity);
        assert.equal(args.signal.aborted, false);
        await writeFile(path.join(args.directory, 'partial.webm'), 'retained output');
        if (capture) return await capture(args, f);
        if (args.subset === 'worker-repair') { const guest = await args.openGuest(); await guest.dispose(); }
        return { status: 'captured-needs-listening', entry: { mapId: `audio-${args.subset}` } };
      } finally { f.active--; }
    },
  };
  f.run = () => runRosterStagingBatch(f.options, f.dependencies);
  f.read = async (subset, file = 'qualification.json') => JSON.parse(await readFile(path.join(f.options.directory, subset, file), 'utf8'));
  return f;
}
const success = args => ({ status: 'captured-needs-listening', entry: { mapId: `audio-${args.subset}` } });

test('full roster uses one browser and host page sequentially, with only the owned Repair guest', async t => {
  const f = await fixture(t), result = await f.run();
  assert.equal(result.status, 'captured-needs-listening'); assert.equal(result.listeningReview, 'pending');
  assert.equal(f.opened, 1); assert.equal(f.disposed, 1); assert.equal(f.pages.length, 2);
  assert.equal(f.pages[1].disposed, 1); assert.equal(f.maxActive, 1);
  assert.equal(f.calls.length, rosterSubsets.length); assert.equal(f.identified, rosterSubsets.length + 1);
  assert.deepEqual(f.calls.slice(0, 2).map(args => args.subset), ['unit-worker', 'buildings-home']);
  assert.ok(f.calls.every(args => args.page === f.pages[0]));
  assert.deepEqual(f.calls.map(args => args.reuseRoom), [false, ...Array(rosterSubsets.length - 1).fill(true)]);
  assert.deepEqual(result.notRunSubsets, []); assert.equal(result.results.length, rosterSubsets.length);
  for (const args of f.calls) {
    const qualification = await f.read(args.subset);
    assert.equal(qualification.maxDurationMs, 300000);
    assert.deepEqual(qualification.sourceCheck, { beforeMatch: true, afterMatch: true });
    assert.equal(await readFile(path.join(args.directory, 'partial.webm'), 'utf8'), 'retained output');
  }
});
test('cue-only failures and browser errors remain failed but allow later subsets in the same usable room', async t => {
  const f = await fixture(t, { capture: async (args, state) => {
    if (args.subset === 'worker-repair') { const guest = await args.openGuest(); await guest.dispose(); }
    if (state.calls.length === 1) return { ...success(args), status: 'failed' };
    if (state.calls.length === 2) args.page.emit('Runtime.exceptionThrown', { private: 'not retained' });
    return success(args);
  } });
  const result = await f.run();
  assert.equal(result.status, 'failed'); assert.equal(result.results.length, rosterSubsets.length);
  assert.deepEqual(result.results.slice(0, 2).map(row => row.status), ['failed', 'failed']);
  assert.deepEqual(result.notRunSubsets, []); assert.equal(f.opened, 1);
  assert.equal((await f.read('buildings-home')).browserObservation.passed, false);
  assert.ok(!JSON.stringify(await f.read('buildings-home')).includes('not retained'));
});
test('failed first entry leaves all remaining subsets explicit without a second room attempt', async t => {
  const f = await fixture(t, { capture: async () => ({ status: 'failed' }) }), result = await f.run();
  assert.equal(result.status, 'failed'); assert.equal(f.calls.length, 1); assert.equal(f.pages.length, 1);
  assert.equal(result.notRunSubsets.length, rosterSubsets.length - 1);
  assert.ok(result.results[0].issues.some(issue => issue.code === 'owned-room-entry-missing'));
  assert.equal(await readFile(path.join(f.calls[0].directory, 'partial.webm'), 'utf8'), 'retained output');
});
test('lost reused entry and disposed contexts stop instead of falling back to room creation', async t => {
  for (const mode of ['entry', 'context']) {
    const f = await fixture(t, { capture: async (args, state) => {
      if (state.calls.length === 2) {
        if (mode === 'entry') return { status: 'failed' };
        args.page.usable = false;
      }
      return success(args);
    } });
    const result = await f.run();
    assert.equal(result.status, 'failed'); assert.equal(f.calls.length, 2); assert.equal(f.pages.length, 1);
    assert.equal(f.calls[1].reuseRoom, true); assert.equal(result.notRunSubsets.length, rosterSubsets.length - 2);
    assert.ok(result.issues.some(issue => issue.code === 'owned-room-no-longer-reusable'));
  }
});
test('the real 300-second orchestration deadline closes the owned page and stops the batch', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = await fixture(t, { capture: async (args, state) => {
    if (state.calls.length === 2) {
      t.mock.timers.tick(SUBSET_TIMEOUT_MS - 1); assert.equal(args.signal.aborted, false);
      t.mock.timers.tick(1); assert.equal(args.signal.aborted, true);
    }
    return success(args);
  } });
  const result = await f.run();
  assert.equal(result.status, 'failed'); assert.equal(f.calls.length, 2); assert.equal(f.pages[0].disposed, 1);
  assert.ok(result.results[1].issues.some(issue => issue.code === 'subset-deadline'));
  assert.equal(f.disposed, 1);
});
test('changed source or failed post-capture verification preserves partial output and prevents the next reload', async t => {
  for (const mode of ['changed', 'unavailable']) {
    const f = await fixture(t, { identify: state => {
      if (state.identified === 1) return { identity, manifest };
      if (mode === 'unavailable') throw Error('private source endpoint failure');
      return { identity: { ...identity, files: [{ ...identity.files[0], sha256: 'c'.repeat(64) }] }, manifest };
    } });
    const result = await f.run(), qualification = await f.read('unit-worker');
    assert.equal(result.status, 'failed'); assert.equal(f.calls.length, 1); assert.equal(f.pages.length, 1);
    assert.equal(qualification.sourceCheck.afterMatch, false);
    assert.ok(qualification.issues.some(issue => issue.code === 'public-source-after-capture-mismatch'));
    assert.ok(!JSON.stringify(result).includes('private source'));
    assert.equal(await readFile(path.join(f.calls[0].directory, 'partial.webm'), 'utf8'), 'retained output');
  }
});
test('Repair guest cleanup failure cannot qualify the case or batch', async t => {
  const f = await fixture(t, { guestCleanupFails: true, capture: async args => {
    if (args.subset === 'worker-repair') { const guest = await args.openGuest(); await guest.dispose().catch(() => {}); }
    return success(args);
  } }), result = await f.run();
  assert.equal(result.status, 'failed'); assert.equal(result.results.at(-1).subset, 'worker-repair');
  assert.equal(result.results.at(-1).status, 'failed'); assert.equal(f.pages.length, 2); assert.equal(f.disposed, 1);
  assert.ok(result.results.at(-1).issues.some(issue => issue.code === 'owned-guest-cleanup-failed'));
});
test('source preflight failure opens no browser and records every subset as unrun', async t => {
  const f = await fixture(t, { identify: () => { throw Error('private'); } }), result = await f.run();
  assert.equal(f.opened, 0); assert.equal(f.calls.length, 0); assert.equal(result.results.length, 0);
  assert.equal(result.notRunSubsets.length, rosterSubsets.length); assert.equal(result.status, 'failed');
});
test('private review room reaches only first capture and never enters batch or qualification artifacts', async t => {
  const room = 'private-review'.padEnd(32, 'x'), f = await fixture(t);
  f.dependencies.reviewRoom = room;
  const result = await f.run();
  assert.equal(result.status, 'captured-needs-listening'); assert.equal(f.calls[0].reviewRoom, room);
  assert.ok(f.calls.slice(1).every(args => args.reviewRoom === null && args.reuseRoom === true));
  assert.ok(!JSON.stringify(result).includes(room));
  for (const args of f.calls) assert.ok(!JSON.stringify(await f.read(args.subset)).includes(room));
});
test('invalid private review room fails before any source request, browser or room creation', async t => {
  const f = await fixture(t); f.dependencies.reviewRoom = 'private-invalid-room';
  await assert.rejects(f.run(), error => error.message === 'Invalid private review room code.');
  assert.equal(f.identified, 0); assert.equal(f.opened, 0); assert.equal(f.calls.length, 0);
});
