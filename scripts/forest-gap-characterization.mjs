#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { configureForestGapReplay, FOREST_GAP_CASES, runForestGap, runForestPlug } from './forest-gap-fixture.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const selection = process.argv[2] ?? 'small', repeats = Number(process.argv[3] ?? 2), maxTicks = Number(process.argv[4] ?? 1800);
assert.ok(['small', 'all', 'plug', ...[0, 1, 2, 4].map(gap => `gap-${gap}`)].includes(selection), 'unknown bounded forest selection');
assert.ok(Number.isInteger(repeats) && repeats >= 1 && repeats <= 2);
assert.ok(Number.isInteger(maxTicks) && maxTicks >= 300 && maxTicks <= 2700);
configureForestGapReplay();
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const readIdentity = async () => ({ head: git(['rev-parse', 'HEAD']), sourceDirty: Boolean(git(['status', '--porcelain'])),
  fixtureSha256: createHash('sha256').update(await readFile(new URL('./forest-gap-fixture.mjs', import.meta.url))).digest('hex'),
  runnerSha256: createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex') });
const identity = await readIdentity();
const cases = selection === 'plug' ? [] : FOREST_GAP_CASES.filter(spec => selection === 'all'
  || (selection === 'small' ? spec.group === 16 && spec.formation === 'box' && spec.gap <= 1 : spec.gap === Number(selection.slice(4))));
const specs = [...cases, ...(['small', 'all', 'plug'].includes(selection) ? [0, 1].map(team => ({ team, plug: true })) : [])];
const records = [];
const report = { ...identity, node: process.version, platform: process.platform, selection, repeats, maxTicks, records,
  scope: 'cell-gap route/formation characterization; actual fixed-tick server bodies',
  controls: { width: 64, height: 48, seed: 881, flat: true, planning: 'callback default; drained between fixed ticks',
    formations: ['box', 'line', 'column'], traffic: [1, 16, 64], bypassRows: { north: [0, 3], south: [44, 47] },
    noProgress: 'no 0.05-unit improvement in remaining route distance; repair starts a new observation window',
    queue: 'ticks without route-distance progress before completing the belt crossing',
    freeExit: 'reserved goals are at least four columns beyond the belt; inactive enemy homes/rosters are outside the route region; no health loss',
    wood: 'six per live forest cell; totals differ with authored gaps and plug' },
  limits: ['Land occupancy is unit-center/cell based;0.56 soft separation is not a physical radius or swept hull.',
    'A one-cell gap does not establish a one-unit physical throat, cavalry radius or visual forest permeability.',
    'Rule-function orders through the existing adapter; listening, peers, asynchronous intake and native process restart excluded.',
    'Fresh-adapter loaded recovery uses production checkpoint validation/restore; it is not a real process/transport restart.',
    'Logical ticks/distances are measurements, not hardware timings,2k capacity, rendered pixels or deployed acceptance.'] };
try {
  for (const spec of specs) {
    const runs = [], record = { ...spec, runs, initialCheckpoint: null, deterministicReplay: false };
    records.push(record);
    for (let repeat = 0; repeat < repeats; repeat++) {
      const options = { maxTicks, initialCheckpoint: record.initialCheckpoint,
        captureInput: checkpoint => { if (!record.initialCheckpoint) record.initialCheckpoint = checkpoint; } };
      runs.push(spec.plug ? await runForestPlug(spec.team, options) : await runForestGap(spec, options));
    }
    const stable = run => spec.plug ? [run.beforeRoutes, run.after, run.harvest] : run;
    assert.ok(runs.every(run => JSON.stringify(stable(run)) === JSON.stringify(stable(runs[0]))), 'fixed-input forest replay differs');
    records.at(-1).deterministicReplay = repeats > 1;
    const measured = spec.plug ? runs[0].after : runs[0];
    console.log(JSON.stringify({ ...spec, arrived: measured.arrived, ticks: measured.ticks,
      firstCrossingTick: measured.firstCrossingTick, lastCrossingTick: measured.lastCrossingTick,
      bypass: measured.observedBypass, maxNoProgressTicks: measured.maxNoProgressTicks }));
    assert.equal(measured.invalidSteps, 0); assert.equal(measured.arrived, measured.uniqueGoals);
    assert.equal(measured.arrived, spec.plug ? 16 : spec.group);
    assert.equal(measured.goalsUnchanged, true); assert.equal(measured.freeExit, true);
    assert.equal(measured.reformedAtAssignedGoals, true);
  }
  assert.deepEqual(await readIdentity(), identity, 'source identity changed during the bounded run');
  assert.equal(new Set(records.flatMap(record => record.runs.map(run => run.sourceSha256))).size, 1,
    'server source changed between scenarios');
  report.outcome = 'passed';
} catch (error) { report.outcome = 'failed'; report.failure = error.message; throw error; }
finally {
  if (process.env.FOREST_GAP_RECORD) {
    const bytes = JSON.stringify(report, null, 2) + '\n';
    try {
      await writeFile(process.env.FOREST_GAP_RECORD, process.env.FOREST_GAP_RECORD.endsWith('.gz') ? gzipSync(bytes) : bytes);
    } catch (error) {
      if (report.outcome !== 'failed') throw error;
      console.error(`Failed to retain forest report: ${error.message}`);
    }
  }
}
