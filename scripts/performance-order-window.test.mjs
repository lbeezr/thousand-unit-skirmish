import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { comparePerformanceReports, observePerformanceResources, performanceIdentity, resourceSnapshot, resourceValidity } from './performance-run-evidence.mjs';

const source = readFileSync(new URL('./performance-scenario.mjs', import.meta.url), 'utf8');
const watermark = source.match(/const previousMoveOrderId = ([^;]+);/)?.[1];
const planning = source.match(/        const recentPlanning = [\s\S]*?(?=\n      }\n      if \(slowReader\))/)?.[0];
assert.ok(watermark && planning, 'actual scenario planning assertions found');

function job(orderId, team, overrides = {}) {
  const unitCount = team === -1 ? 2 : 1000;
  return { orderId, team, mode: team === -1 ? 'blocked-route-repair' : 'shared-start', unitCount,
    nonEmptyPaths: unitCount, alreadyInDestinationCell: 0, routeFailures: 0,
    setupMs: 1, maxPathPlanningSliceMs: 2, finalizationMs: 1, ...overrides };
}
function check(jobs, previous = []) {
  const context = { assert, jobs, previous, maxBlockingBudgetMs: 100 };
  // Build arrays in the scenario realm so strict equality checks their values.
  return vm.runInNewContext(`const priorHealth = { movePlanning: Array.from(previous) };
    const health = { armySize: 2000, movePlanning: Array.from(jobs) };
    const previousMoveOrderId = ${watermark}; ${planning}; plannedOrders`, context);
}

test('completed planning jobs may arrive out of order across movement waves', () => {
  const result = check([job(2, 1), job(1, 0), job(4, 1), job(3, 0)], [job(2, 1), job(1, 0)]);
  assert.deepEqual(Array.from(result, (sample) => sample.orderId), [4, 3]);
});

test('first movement wave has no prior completed order and supports both planner configurations', () => {
  for (const mode of ['shared-start', 'per-unit']) {
    const result = check([job(1, 0, { mode }), job(2, 1, { mode })]);
    assert.deepEqual(Array.from(result, sample => sample.orderId), [1, 2]);
  }
});

test('internal repair completions do not masquerade as additional issued team orders', () => {
  const result = check([job(1, 0), job(2, 1), job(3, -1), job(4, -1), job(5, -1), job(6, -1)]);
  assert.deepEqual(Array.from(result, sample => sample.orderId), [1, 2]);
});

test('missing, duplicate, extra or incomplete team orders still fail', () => {
  for (const jobs of [
    [job(1, 0), job(2, -1)],
    [job(1, 0), job(2, 0)],
    [job(1, 0), job(2, 1), job(3, 1)],
    [job(1, 0), job(2, 1, { unitCount: 999, nonEmptyPaths: 999 })],
    [job(1, 0), job(2, 1, { mode: 'blocked-route-repair' })],
  ]) assert.throws(() => check(jobs), { code: 'ERR_ASSERTION' });
});

test('repair jobs retain route completeness, zero-failure and bounded-unit assertions', () => {
  for (const overrides of [
    { routeFailures: 1 }, { nonEmptyPaths: 0 }, { unitCount: 0, nonEmptyPaths: 0 },
    { unitCount: 2001, nonEmptyPaths: 2001 }, { unitCount: 1.5, nonEmptyPaths: 1.5 }, { team: 2 },
  ]) assert.throws(() => check([job(1, 0), job(2, 1), job(3, -1, overrides)]), { code: 'ERR_ASSERTION' });
});

test('timing limits apply to both issued and internal jobs without invalid metric escapes', () => {
  for (const field of ['setupMs', 'maxPathPlanningSliceMs', 'finalizationMs']) {
    for (const value of [101, -1, NaN, Infinity, undefined]) {
      for (const team of [0, -1]) {
        const jobs = [job(1, 0), job(2, 1)];
        if (team === 0) jobs[0] = job(1, 0, { [field]: value });
        else jobs.push(job(3, -1, { [field]: value }));
        assert.throws(() => check(jobs), { code: 'ERR_ASSERTION' });
      }
    }
  }
});

const memorySample = (monotonicMs, overrides = {}) => ({ monotonicMs, serverRssBytes: 90_000_000,
  serverAtRootCgroup: true,
  hostAvailableBytes: 1_000_000_000, cgroupCurrentBytes: 300_000_000, cgroupLimitBytes: 2_000_000_000,
  cgroupLimitKind: 'finite', swapInPages: 0, swapOutPages: 0,
  cgroupEvents: { high: 0, max: 27, oom: 0, oom_kill: 0 }, ...overrides });
const sourceIds = ['1'.repeat(40), '2'.repeat(40)];
function performanceReport(index = 0) {
  const samples = [memorySample(10), memorySample(10_010)];
  return { samples: [{ tickTiming: { sampleCount: 300, p95Ms: 10, maxMs: 20,
    startLagP95Ms: 1, startLagMaxMs: 2, budgetMs: 33.333 } }], measurementEvidence: {
    schemaVersion: 1, runId: `run-${index}`, identityUnchanged: true,
    identity: { build: { kind: 'source-checkout', sourceRevision: sourceIds[index], sourceDirty: false,
      runtimeSha256: String(index + 3).repeat(64), driverSha256: 'a'.repeat(64) },
    map: { id: 'open-field', sha256: 'b'.repeat(64), terrainSeed: 881 } },
    configuration: { scope: 'native-cpu', workloadMode: 'move', durationSeconds: 10, repeatCount: 1,
      requestedUnitCount: 2000, verifiedUnitCount: 2000, formation: 'box', connectedTeams: 2,
      diagnostics: 'on', planningTurnsPerTick: 0, matchModeId: 'authored', matchModeVersion: 1,
      checkpointIntervalMs: 1000, tickRate: 30, window: '300 ticks', warmup: 'none', acceptedCommandReplay: 'not-recorded' },
    environment: { machineSessionSha256: 'c'.repeat(64), node: 'test-runtime', renderer: 'none',
      camera: 'not-applicable', resolution: 'not-applicable', powerState: 'unobserved' },
    resources: { samples, validity: resourceValidity(samples) }, outcome: 'passed', failure: null } };
}

test('historical memory-limit events do not invalidate a new window without disruptions', () => {
  assert.equal(resourceValidity([memorySample(0), memorySample(10_000)]).status, 'observed-without-disruption');
  assert.equal(comparePerformanceReports(performanceReport(), performanceReport(1), sourceIds).status, 'comparable-diagnostics');
});

test('measured OOM invalidates timings; pressure, swap and changed limits refuse comparisons without a RAM ratio cutoff', () => {
  for (const key of ['oom', 'oom_kill', 'high', 'max']) {
    const last = memorySample(10_000); last.cgroupEvents[key]++;
    const expected = key.startsWith('oom') ? 'invalid' : 'not-comparable';
    assert.equal(resourceValidity([memorySample(0), last]).status, expected, key);
  }
  for (const last of [memorySample(10_000, { swapInPages: 1 }), memorySample(10_000, { swapOutPages: 1 }),
    memorySample(10_000, { cgroupLimitBytes: 1_000_000_000 })]) {
    assert.equal(resourceValidity([memorySample(0), last]).status, 'not-comparable');
  }
  assert.equal(resourceValidity([memorySample(0, { hostAvailableBytes: 1 }), memorySample(10_000, { hostAvailableBytes: 1 })]).status,
    'observed-without-disruption', 'available-memory amount alone does not invent a cutoff');
});

test('missing observations and counter resets stay explicit, including a lost middle sample', () => {
  assert.equal(resourceValidity([]).status, 'unknown');
  assert.equal(resourceValidity([memorySample(0)]).status, 'unknown');
  assert.equal(resourceValidity([memorySample(0), memorySample(10_000, { serverRssBytes: null })]).status, 'unknown');
  assert.equal(resourceValidity([memorySample(0), memorySample(10_000, { serverAtRootCgroup: false })]).status, 'unknown');
  const middle = memorySample(5000); middle.cgroupEvents.oom = null;
  assert.equal(resourceValidity([memorySample(0), middle, memorySample(10_000)]).status, 'unknown');
  middle.cgroupEvents.max = 28; middle.cgroupEvents.oom = 0;
  assert.equal(resourceValidity([memorySample(0), middle, memorySample(10_000)]).status, 'not-comparable');
});

test('comparison recomputes resource validity and retains failures instead of hiding them behind a budget pass', () => {
  const failed = performanceReport(1);
  failed.measurementEvidence.resources.samples[1].cgroupEvents.oom_kill = 1;
  failed.measurementEvidence.resources.validity.status = 'observed-without-disruption';
  failed.measurementEvidence.outcome = 'failed'; failed.measurementEvidence.failure = 'original tick budget failure';
  const result = comparePerformanceReports(performanceReport(), failed, sourceIds);
  assert.equal(result.status, 'not-comparable');
  assert.ok(result.reasons.includes('candidate:resources-invalid'));
  assert.ok(result.reasons.includes('candidate:failed-run-retained'));
  assert.equal(result.candidateFailure, 'original tick budget failure');
  assert.equal(result.hardwareCapacityEstablished, false);
});

test('build, workload, seed, warmup, instrumentation and machine mismatches refuse timing comparisons', () => {
  for (const change of [
    item => { item.identity.build.sourceRevision = 'wrong'; }, item => { item.identity.build.sourceDirty = true; },
    item => { item.identity.build.driverSha256 = 'd'.repeat(64); }, item => { item.identityUnchanged = false; },
    item => { item.identity.map.terrainSeed++; }, item => { item.identity.map.sha256 = 'e'.repeat(64); },
    item => { item.configuration.verifiedUnitCount = 1999; }, item => { item.configuration.warmup = 'five seconds'; },
    item => { item.environment.machineSessionSha256 = 'f'.repeat(64); },
    item => { item.servedBuildIdentity = { sourceRevision: sourceIds[0] }; },
  ]) {
    const candidate = performanceReport(1); change(candidate.measurementEvidence);
    assert.equal(comparePerformanceReports(performanceReport(), candidate, sourceIds).status, 'not-comparable');
  }
  assert.equal(comparePerformanceReports({}, performanceReport(1), sourceIds).status, 'not-comparable');
  assert.ok(comparePerformanceReports(performanceReport(), performanceReport(), [sourceIds[0], sourceIds[0]]).reasons.includes('same-run'));
});

test('software rendering and incomplete windows cannot be admitted as native or consumer GPU capacity', () => {
  const candidate = performanceReport(1); candidate.measurementEvidence.environment.renderer = 'software';
  const result = comparePerformanceReports(performanceReport(), candidate, sourceIds);
  assert.ok(result.reasons.includes('candidate:unsupported-timing-scope'));
  assert.equal(result.hardwareCapacityEstablished, false);
  candidate.measurementEvidence.environment.renderer = 'none'; candidate.samples[0].tickTiming.sampleCount = 299;
  assert.ok(comparePerformanceReports(performanceReport(), candidate, sourceIds).reasons.includes('candidate:incomplete-timing-window'));
  candidate.samples[0].tickTiming.sampleCount = 300; candidate.samples[0].tickTiming.budgetMs *= 2;
  assert.ok(comparePerformanceReports(performanceReport(), candidate, sourceIds).reasons.includes('mismatched:timing-budgets'));
});

test('identity records actual source/map bytes and declared artifact identity instead of a workload label', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'rts-performance-identity-'));
  try {
    await Promise.all(['src', 'maps', 'scripts'].map(name => mkdir(path.join(directory, name))));
    const files = { 'server.mjs': 'export const source = 1;', 'package-lock.json': '{}', 'src/leaf.mjs': 'export const leaf = 1;',
      'maps/map.json': JSON.stringify({ id: 'map', terrainSeed: 881, width: 64, height: 64 }),
      'scripts/checkpoint-performance-scenario.mjs': 'checkpoint driver', 'scripts/performance-scenario.mjs': 'load driver',
      'scripts/performance-run-evidence.mjs': 'resource observer',
      'release-manifest.json': JSON.stringify({ sourceRevision: sourceIds[0], sourceDirty: false, digest: `sha256:${'a'.repeat(64)}` }) };
    await Promise.all(Object.entries(files).map(([name, bytes]) => writeFile(path.join(directory, name), bytes)));
    const original = await performanceIdentity(directory, 'maps/map.json');
    assert.equal(original.build.sourceRevision, sourceIds[0]); assert.equal(original.build.sourceDirty, false);
    assert.equal(original.build.kind, 'declared-release'); assert.equal(original.map.terrainSeed, 881);
    await writeFile(path.join(directory, 'src/leaf.mjs'), 'export const leaf = 2;');
    const changed = await performanceIdentity(directory, 'maps/map.json');
    assert.notEqual(changed.build.runtimeSha256, original.build.runtimeSha256);
    assert.equal(changed.build.driverSha256, original.build.driverSha256);
    assert.equal(changed.map.sha256, original.map.sha256);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('resource observation measures the actual process and stops with both boundary samples', async () => {
  const actual = await resourceSnapshot(process.pid);
  if (process.platform === 'linux') assert.ok(actual.serverRssBytes > 0);
  let calls = 0;
  const stop = await observePerformanceResources(process.pid, { intervalMs: 60_000,
    sample: async () => memorySample(++calls) });
  const result = await stop();
  assert.equal(calls, 2); assert.equal(result.samples.length, 2);
  assert.equal(result.validity.status, 'observed-without-disruption');
});

test('comparison CLI distinguishes missing controls from file errors and preserves failure evidence', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'rts-comparison-test-'));
  try {
    const files = [path.join(directory, 'baseline.json'), path.join(directory, 'candidate.json')];
    await Promise.all(files.map((filename, index) => writeFile(filename, JSON.stringify(performanceReport(index)))));
    const run = args => spawnSync(process.execPath, [new URL('./compare-performance-runs.mjs', import.meta.url).pathname, ...args], { encoding: 'utf8' });
    const valid = run([...files, ...sourceIds]);
    assert.equal(valid.status, 0, valid.stderr); assert.equal(JSON.parse(valid.stdout).status, 'comparable-diagnostics');
    const wrongSource = run([...files, sourceIds[0], sourceIds[0]]);
    assert.equal(wrongSource.status, 3); assert.ok(JSON.parse(wrongSource.stdout).reasons.includes('candidate:unexpected-source'));
    assert.equal(run([...files]).status, 2);
    assert.equal(run([files[0], path.join(directory, 'missing.json'), ...sourceIds]).status, 2);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
