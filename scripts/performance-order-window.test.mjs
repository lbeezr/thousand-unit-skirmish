import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { checkpointAttackMap, comparePerformanceReports, observePerformanceResources, performanceIdentity, resourceSnapshot, resourceValidity } from './performance-run-evidence.mjs';

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
  serverHighWaterRssBytes: 100_000_000, hostTotalBytes: 2_000_000_000,
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
    map: { id: 'open-field', sha256: 'b'.repeat(64), terrainSeed: 881, width: 64, height: 64, fogOfWar: true } },
    configuration: { scope: 'native-cpu', workloadMode: 'move', durationSeconds: 10, requestedRepeatCount: 1, repeatCount: 1,
      durationKind: 'requested workload duration; server timing is a rolling 300-tick window',
      requestedUnitCount: 2000, verifiedUnitCount: 2000, formation: 'box', connectedTeams: 2,
      diagnostics: 'RTS_TICK_DIAGNOSTICS=1', planningTurnsPerTick: 0, matchModeId: 'authored', matchModeVersion: 1,
      checkpointIntervalMs: 1000, tickRate: 30, window: 'rolling 300 server ticks after orders',
      warmup: 'no dedicated warmup; first full window', acceptedCommandReplay: 'not-recorded; map seed and authored workload are controls' },
    environment: { machineSessionSha256: 'c'.repeat(64), platform: 'linux', architecture: 'x64',
      node: 'v24.14.0', cpuModel: 'test CPU', logicalCpuCount: 2, nodeOptionsSha256: 'd'.repeat(64), renderer: 'none',
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

test('every resource timestamp, nonnegative observation and finite limit is required', () => {
  for (const overrides of [{ monotonicMs: null }, { monotonicMs: -1 }, { monotonicMs: 20_000 },
    { serverRssBytes: -1 }, { serverHighWaterRssBytes: null }, { hostTotalBytes: -1 },
    { hostAvailableBytes: -1 }, { cgroupCurrentBytes: -1 }, { cgroupLimitBytes: null },
    { cgroupLimitBytes: -1 }, { cgroupLimitKind: 'unlimited', cgroupLimitBytes: 1 },
    { swapInPages: -1 }, { swapOutPages: 1.5 }, { cgroupEvents: { high: -1, max: 27, oom: 0, oom_kill: 0 } }]) {
    const result = resourceValidity([memorySample(0), memorySample(5000, overrides), memorySample(10_000)]);
    assert.notEqual(result.status, 'observed-without-disruption', JSON.stringify(overrides));
  }
  assert.equal(resourceValidity([memorySample(0), memorySample(0)]).status, 'unknown');
  assert.equal(resourceValidity([null, null]).status, 'unknown');
  assert.equal(resourceValidity([memorySample(0, { cgroupLimitBytes: null }), memorySample(10_000, { cgroupLimitBytes: null })]).status, 'unknown');
  assert.equal(resourceValidity([0, 10_000].map(time => memorySample(time, { cgroupLimitKind: 'unlimited', cgroupLimitBytes: null }))).status,
    'observed-without-disruption');
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
    item => { item.identity.build.declaredRelease = { sourceRevision: sourceIds[0], sourceDirty: false }; },
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

test('equal missing or invalid environment and workload values cannot qualify as controls', () => {
  for (const [section, field, value] of [
    ...['node', 'platform', 'architecture', 'cpuModel', 'logicalCpuCount', 'nodeOptionsSha256'].map(field => ['environment', field, undefined]),
    ...['node', 'platform', 'architecture', 'cpuModel', 'nodeOptionsSha256'].map(field => ['environment', field, 'unknown']),
    ['environment', 'logicalCpuCount', -1], ['environment', 'camera', 'unknown'], ['environment', 'resolution', 'unknown'],
    ...['durationSeconds', 'requestedRepeatCount', 'repeatCount', 'checkpointIntervalMs', 'tickRate', 'matchModeVersion', 'planningTurnsPerTick']
      .map(field => ['configuration', field, -1]),
    ['configuration', 'durationSeconds', 121], ['configuration', 'requestedRepeatCount', 6],
    ['configuration', 'planningTurnsPerTick', 2], ['configuration', 'matchModeVersion', 2],
    ...['diagnostics', 'window', 'warmup', 'acceptedCommandReplay', 'matchModeId', 'durationKind']
      .map(field => ['configuration', field, 'unknown']),
  ]) {
    const reports = [performanceReport(), performanceReport(1)];
    for (const report of reports) report.measurementEvidence[section][field] = value;
    assert.equal(comparePerformanceReports(...reports, sourceIds).status, 'not-comparable', `${section}.${field}=${value}`);
  }
  for (const field of ['id', 'width', 'height', 'fogOfWar']) {
    const reports = [performanceReport(), performanceReport(1)];
    for (const report of reports) delete report.measurementEvidence.identity.map[field];
    assert.equal(comparePerformanceReports(...reports, sourceIds).status, 'not-comparable', `map.${field}`);
  }
  const idle = [performanceReport(), performanceReport(1)];
  for (const report of idle) Object.assign(report.measurementEvidence.configuration, { workloadMode: 'idle', requestedRepeatCount: 3 });
  assert.equal(comparePerformanceReports(...idle, sourceIds).status, 'comparable-diagnostics', 'idle verifies one window rather than fabricating requested repetitions');
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
    const git = args => {
      const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
    };
    git(['init', '-q']); git(['add', '.']);
    git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture']);
    const checkoutSha = git(['rev-parse', 'HEAD']);
    const clean = await performanceIdentity(directory, 'maps/map.json');
    assert.equal(clean.build.kind, 'source-checkout'); assert.equal(clean.build.sourceRevision, checkoutSha);
    assert.equal(clean.build.sourceDirty, false); assert.equal(clean.build.declaredRelease.sourceRevision, sourceIds[0]);
    await writeFile(path.join(directory, 'server.mjs'), 'export const source = 2;');
    const dirty = await performanceIdentity(directory, 'maps/map.json');
    assert.equal(dirty.build.sourceDirty, true, 'a stale clean declaration cannot override observed dirtiness');
    assert.equal(dirty.build.sourceRevision, checkoutSha);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('independent attack fixtures have stable raw map identity and exclude only the owned untracked map', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'rts-performance-attack-'));
  const helper = new URL('./performance-run-evidence.mjs', import.meta.url).href;
  const openField = { id: 'open-field', terrainSeed: 881, width: 64, height: 64, terrain: [1, 2], victoryHoldSeconds: 30 };
  try {
    await Promise.all(['src', 'maps', 'scripts'].map(name => mkdir(path.join(directory, name))));
    await Promise.all(['server.mjs', 'package-lock.json', 'src/leaf.mjs', 'scripts/checkpoint-performance-scenario.mjs',
      'scripts/performance-scenario.mjs', 'scripts/performance-run-evidence.mjs'].map(name => writeFile(path.join(directory, name), '{}')));
    const git = args => {
      const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    };
    git(['init', '-q']); git(['add', '.']); git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture']);
    const script = `import { writeFile, rm } from 'node:fs/promises';
      import { checkpointAttackMap, performanceIdentity } from ${JSON.stringify(helper)};
      const root = process.argv[1], map = 'maps/.perf-checkpoint-' + process.pid + '.json';
      await writeFile(root + '/' + map, JSON.stringify(checkpointAttackMap(${JSON.stringify(openField)})));
      try { console.log(JSON.stringify({ pid: process.pid, identity: await performanceIdentity(root, map, { ownedTemporaryMapPath: map }) })); }
      finally { await rm(root + '/' + map); }`;
    const runs = [0, 1].map(() => {
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', script, directory], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout);
    });
    assert.notEqual(runs[0].pid, runs[1].pid);
    assert.deepEqual(runs[0].identity, runs[1].identity);
    assert.equal(runs[0].identity.build.sourceDirty, false);
    const map = `maps/.perf-checkpoint-${process.pid}.json`, options = { ownedTemporaryMapPath: map };
    await writeFile(path.join(directory, map), JSON.stringify(checkpointAttackMap(openField)));
    await writeFile(path.join(directory, 'other-untracked'), 'unrelated');
    assert.equal((await performanceIdentity(directory, map, options)).build.sourceDirty, true);
    await rm(path.join(directory, 'other-untracked'));
    git(['add', map]); git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'tracked map']);
    await writeFile(path.join(directory, map), JSON.stringify({ ...checkpointAttackMap(openField), terrainSeed: 882 }));
    assert.equal((await performanceIdentity(directory, map, options)).build.sourceDirty, true, 'tracked map edits are never excluded');
    assert.equal((await performanceIdentity(directory, map, options)).map.terrainSeed, 882, 'gameplay fields are not normalized out');
    assert.deepEqual(checkpointAttackMap(openField).terrain, openField.terrain);
    assert.equal(checkpointAttackMap(openField).victoryHoldSeconds, 30);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('attack setup cleans a partial owned write and preserves preexisting files and original errors', async () => {
  const driver = readFileSync(new URL('./checkpoint-performance-scenario.mjs', import.meta.url), 'utf8');
  const setup = driver.match(/  if \(workloadMode === 'attack-move'\) \{[\s\S]*?(?=\n  port = await reservePort)/)?.[0];
  const cleanup = driver.match(/  if \(tempMapPath\) await rm\(tempMapPath, \{ force: true \}\);/)?.[0];
  assert.ok(setup && cleanup, 'actual runner setup and owned-map cleanup found');
  for (const failureCode of ['ENOSPC', 'EEXIST']) {
    const failure = Object.assign(new Error(failureCode), { code: failureCode });
    let ownedFilePresent = false, closed = false;
    const removed = [];
    const context = { path, ROOT: '/fixture', process: { pid: 123 }, workloadMode: 'attack-move',
      tempMapPath: null, mapRelativePath: 'maps/open-field.json', checkpointAttackMap,
      readFile: async () => '{}',
      open: async (_filename, flags) => {
        assert.equal(flags, 'wx');
        if (failureCode === 'EEXIST') throw failure;
        ownedFilePresent = true;
        return { writeFile: async () => { throw failure; },
          close: async () => { closed = true; throw new Error('secondary close error'); } };
      },
      rm: async filename => { removed.push(filename); ownedFilePresent = false; },
    };
    await assert.rejects(vm.runInNewContext(`(async () => { try { ${setup} } finally { ${cleanup} } })()`, context), error => error === failure);
    assert.equal(ownedFilePresent, false);
    assert.equal(closed, failureCode === 'ENOSPC');
    assert.deepEqual(removed, failureCode === 'ENOSPC' ? ['/fixture/maps/.perf-checkpoint-123.json'] : []);
  }
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
