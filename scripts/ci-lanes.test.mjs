import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ciChecks } from './ci.mjs';
import { rendererPrerequisite, EXTRA_LANES, parseCiOptions, runCiSelection, selectCiChecks } from './ci-lanes.mjs';

const checks = ciChecks();
const selected = args => selectCiChecks(checks, parseCiOptions(args));
const key = check => JSON.stringify(check);

test('fast and simulation partition every default check exactly once, preserving order', () => {
  const full = selected([]).selected;
  const fast = selected(['--lane=fast']).selected;
  const simulation = selected(['--lane=simulation']).selected;
  assert.deepEqual([...fast, ...simulation].map(key).sort(), full.map(key).sort());
  assert.ok(fast.length && simulation.length);
  for (const lane of [fast, simulation]) {
    assert.deepEqual(lane, full.filter(check => lane.includes(check)));
  }
  for (const file of ['audio-shipped-response', 'gameplay-action-rules', 'websocket-frame', 'websocket-deflate-offer']) {
    const floor = fast.find(check => check.args.includes(`--test-coverage-include=src/${file === 'websocket-frame' || file === 'websocket-deflate-offer' ? 'networking/' : file === 'gameplay-action-rules' ? 'rules/' : ''}${file}.mjs`));
    assert.ok(floor, file);
    assert.ok(floor.args.includes('--test-coverage-lines=100'));
    assert.ok(floor.args.includes('--test-coverage-branches=100'));
    assert.ok(floor.args.includes('--test-coverage-functions=100'));
  }
});

test('each CPU lane and the full registry shard without omissions or duplicate jobs', () => {
  for (const lane of ['full', 'fast', 'simulation']) {
    const all = selected([`--lane=${lane}`]).selected.map(key).sort();
    const shards = [1, 2, 3].flatMap(index => selected([`--lane=${lane}`, `--shard=${index}/3`]).selected.map(key));
    assert.deepEqual(shards.sort(), all);
    assert.equal(new Set(shards).size, shards.length);
  }
});

test('unknown, repeated, malformed, and unsupported shard options fail', () => {
  for (const args of [
    ['--lane=unknown'], ['--lane='], ['--lane=fast', '--lane=fast'],
    ['--list', '--list'], ['--unknown'], ['--report='], ['--report=   '],
    ['--shard=0/3'], ['--shard=4/3'], ['--shard=1/17'], ['--shard=1/0'],
    ['--shard=1/3', '--shard=2/3'], ['--lane=visual', '--shard=1/1'],
    ['--lane=performance', '--shard=1/3'],
  ]) assert.throws(() => parseCiOptions(args), /Usage:/, JSON.stringify(args));
  assert.throws(() => selectCiChecks([], parseCiOptions([])), /no checks/);
  assert.throws(() => selectCiChecks([checks[0]], parseCiOptions(['--shard=2/3'])), /no checks/);
});

test('visual runs a prerequisite and an actual adapter capture; performance runs a real CPU workload', () => {
  assert.deepEqual(selected(['--lane=visual']).selected, EXTRA_LANES.visual);
  assert.deepEqual(EXTRA_LANES.visual[0].args, ['scripts/renderer-capability.mjs', '--launch']);
  for (const file of ['scripts/unit-displacement-animation.test.mjs', 'scripts/renderer-capability.test.mjs']) {
    assert.ok(selected(['--lane=fast']).selected.some(check => check.args[0] === '--test' && check.args.includes(file)), file);
  }
  assert.equal(EXTRA_LANES.visual[1].command, 'game-dev');
  assert.ok(EXTRA_LANES.visual[1].args.includes('renderer-environment-state-pilot'));
  assert.ok(!EXTRA_LANES.visual[1].args.includes('--pilot-plan'));
  assert.deepEqual(selected(['--lane=performance']).selected, EXTRA_LANES.performance);
  assert.deepEqual(EXTRA_LANES.performance[0].args, ['scripts/checkpoint-performance-scenario.mjs', '10', 'move', '1']);
});

test('listing is planned evidence with no executed checks or suite-pass claim', () => {
  const options = parseCiOptions(['--lane=fast', '--list']);
  const result = runCiSelection(selected(['--lane=fast']), options, { execute: () => assert.fail('must not run') });
  assert.equal(result.exitCode, 0);
  assert.equal(result.report.status, 'planned');
  assert.equal(result.report.passedCount, 0);
  assert.equal(result.report.unrunCount, result.report.selectedCount);
  assert.equal(result.report.fullCpuSuitePassed, false);
});

const sample = [{ label: 'first', args: ['a'] }, { label: 'second', args: ['b'] }];
test('success reports exact scope; focused lanes and shards never claim the full CPU suite', () => {
  for (const args of [[], ['--lane=fast'], ['--shard=1/3']]) {
    const options = parseCiOptions(args);
    const result = runCiSelection({ selected: sample, laneCount: args.length ? 6 : 2 }, options, { execute: () => ({ status: 0 }) });
    assert.equal(result.exitCode, 0);
    assert.equal(result.report.status, 'passed');
    assert.equal(result.report.passedCount, 2);
    assert.equal(result.report.unrunCount, 0);
    assert.equal(result.report.fullCpuSuitePassed, args.length === 0);
  }
});

test('failure and signals stop subsequent checks and retain nonzero status', () => {
  for (const failure of [{ status: 7 }, { status: null, signal: 'SIGTERM' }]) {
    let calls = 0;
    const result = runCiSelection({ selected: sample, laneCount: 2 }, parseCiOptions([]),
      { execute: () => { calls++; return failure; } });
    assert.equal(calls, 1);
    assert.equal(result.exitCode, 1);
    assert.equal(result.report.status, 'failed');
    assert.equal(result.report.unrunCount, 1);
    assert.equal(result.report.fullCpuSuitePassed, false);
  }
});

test('programmer/execution faults fail safely and preserve the original error for diagnosis', () => {
  const fault = new TypeError('private diagnostic sentinel');
  const result = runCiSelection({ selected: sample, laneCount: 2 }, parseCiOptions([]),
    { execute: () => { throw fault; } });
  assert.equal(result.exitCode, 1);
  assert.equal(result.error, fault);
  assert.equal(result.report.status, 'failed');
  assert.ok(!JSON.stringify(result.report).includes('private diagnostic sentinel'));
});

test('unsupported browser blocks capture; ready startup alone cannot pass visual acceptance', () => {
  const options = parseCiOptions(['--lane=visual']);
  const unsupported = { status: 1, stdout: JSON.stringify({ schemaVersion: 1, scope: 'renderer-capability-only', status: 'blocked',
    issues: [{ code: 'sandbox-unavailable', message: 'The sandbox could not start.' }] }) };
  let calls = 0;
  const blocked = runCiSelection(selected(['--lane=visual']), options,
    { execute: () => { calls++; return unsupported; } });
  assert.equal(calls, 1);
  assert.equal(blocked.exitCode, 3);
  assert.equal(blocked.report.status, 'blocked');
  assert.equal(blocked.report.unrunCount, 1);
  assert.match(blocked.report.checks[0].reason, /sandbox-unavailable/);
  calls = 0;
  const captureFailure = runCiSelection(selected(['--lane=visual']), options,
    { execute: () => ++calls === 1
      ? { status: 0, stdout: JSON.stringify({ schemaVersion: 1, scope: 'renderer-capability-only', status: 'ready', webglReadbackPassed: true }) }
      : { status: 1 } });
  assert.equal(calls, 2);
  assert.equal(captureFailure.report.status, 'failed');
  assert.equal(captureFailure.exitCode, 1);
});

test('missing capture launcher is blocked; malformed preflight is a failure, not availability evidence', () => {
  const blocked = runCiSelection({ selected: [EXTRA_LANES.visual[1]], laneCount: 1 }, parseCiOptions(['--lane=visual']),
    { execute: () => ({ status: null, error: { code: 'ENOENT' } }) });
  assert.equal(blocked.exitCode, 3);
  assert.match(blocked.report.checks[0].reason, /launcher is unavailable/);
  for (const result of [{ status: 0, stdout: 'bad JSON' }, { status: 1, stdout: '{}' },
    { status: 0, stdout: '{"status":"unsupported"}' }]) {
    assert.equal(rendererPrerequisite(result), null);
    const failed = runCiSelection({ selected: [EXTRA_LANES.visual[0]], laneCount: 1 }, parseCiOptions(['--lane=visual']),
      { execute: () => result });
    assert.equal(failed.exitCode, 1);
    assert.equal(failed.report.status, 'failed');
  }
});

test('malformed capability issues and execution errors cannot escape or fabricate readiness', () => {
  const options = parseCiOptions(['--lane=visual']);
  const blocked = issues => ({ status: 1, stdout: JSON.stringify({
    schemaVersion: 1, scope: 'renderer-capability-only', status: 'blocked', issues,
  }) });
  const ready = { status: 0, stdout: JSON.stringify({
    schemaVersion: 1, scope: 'renderer-capability-only', status: 'ready', webglReadbackPassed: true,
  }) };
  for (const result of [
    blocked([null]), blocked([{}]), blocked([{ code: '', message: 'missing code' }]),
    blocked([{ code: 'code', message: 1 }]),
    { ...ready, error: new Error('private execution sentinel') },
    { ...ready, signal: 'SIGTERM' },
    { status: 0, stdout: JSON.stringify({ schemaVersion: 1, scope: 'renderer-capability-only', status: 'ready' }) },
  ]) {
    assert.equal(rendererPrerequisite(result), null);
    const failed = runCiSelection(selected(['--lane=visual']), options, { execute: () => result });
    assert.equal(failed.exitCode, 1);
    assert.equal(failed.report.status, 'failed');
    assert.equal(failed.report.unrunCount, 1);
    assert.equal(failed.report.fullCpuSuitePassed, false);
  }
});

test('CLI writes planned JSON evidence and rejects unknown arguments with exit2', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'ci-lane-contract-'));
  try {
    const report = path.join(directory, 'evidence.json');
    const plan = spawnSync(process.execPath, ['scripts/ci.mjs', '--lane=fast', '--list', `--report=${report}`], { encoding: 'utf8' });
    assert.equal(plan.status, 0, plan.stderr);
    assert.ok(JSON.parse(plan.stdout).length > 0);
    assert.equal(JSON.parse(readFileSync(report)).status, 'planned');
    const invalid = spawnSync(process.execPath, ['scripts/ci.mjs', '--unknown'], { encoding: 'utf8' });
    assert.equal(invalid.status, 2);
    assert.match(invalid.stdout, /"status":"invalid"/);
    assert.match(invalid.stderr, /Usage:/);
    const unwritable = spawnSync(process.execPath,
      ['scripts/ci.mjs', '--list', `--report=${report}/nested.json`], { encoding: 'utf8' });
    assert.equal(unwritable.status, 1);
    assert.match(unwritable.stderr, /evidence could not be written/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
