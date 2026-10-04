#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { LAND_BODY_STUDY } from './land-body-clearance.mjs';
import { LAND_BODY_CASES, configureLandBodyReplay, runLandBodyCase } from './land-body-clearance-fixture.mjs';
import { LAND_CLEARANCE_PROFILE } from '../src/unit-movement.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const selection = process.argv[2] ?? 'all', maxTicks = Number(process.argv[3] ?? 1800);
assert.ok(['all', 'corner', 'forest', ...LAND_BODY_CASES.map(s => s.id)].includes(selection));
assert.ok(Number.isInteger(maxTicks) && maxTicks >= 1 && maxTicks <= 2700);
configureLandBodyReplay();
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const files = ['server.mjs', 'src/unit-movement.mjs', 'scripts/pathing-replay-fixture.mjs', 'scripts/forest-gap-fixture.mjs',
  'scripts/land-body-clearance.mjs', 'scripts/land-body-clearance-fixture.mjs', 'scripts/land-body-clearance-study.mjs'];
const identity = async () => ({ head: git(['rev-parse', 'HEAD']), sourceDirty: Boolean(git(['status', '--porcelain'])),
  files: Object.fromEntries(await Promise.all(files.map(async file => [file,
    createHash('sha256').update(await readFile(new URL(`../${file}`, import.meta.url))).digest('hex')])) ) });
const before = await identity(), records = [];
const rawHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const range = values => ({ first: values.length ? Math.min(...values) : null, last: values.length ? Math.max(...values) : null });
function summarize(record) {
  const { initialCheckpoint, runs, ...spec } = record, run = runs[0];
  return { ...spec, repeats: runs.length, fullRunHashes: runs.map(rawHash), ...(run ? {
    sourceSha256: run.sourceSha256, initialCheckpointSha256: run.initialCheckpointSha256,
    navigationMaskSha256: run.navigationMaskSha256, navigationRevision: run.navigationRevision,
    ticks: run.ticks, actors: run.actors.length, arrived: run.arrived,
    arrivals: range(run.actors.flatMap(u => u.arrivalTick === null ? [] : [u.arrivalTick])),
    crossings: range(run.actors.flatMap(u => u.crossedTick === null ? [] : [u.crossedTick])),
    maxNoDisplacementTicks: Math.max(...run.actors.map(u => u.maxNoDisplacementTicks)),
    observedSubsteps: run.observedSubsteps, selectedSubsteps: run.selectedSubsteps,
    staticContactSteps: run.staticContactSteps, pairContactSteps: run.pairContactSteps,
    minimumStaticContactMargin: run.minimumStaticContactMargin, minimumPairMargin: run.minimumPairMargin,
    maxStaticQueries: run.maxStaticQueries, traceSha256: run.traceSha256,
    invalidCenterSubsteps: run.invalidCenterSubsteps, unobservedPositionMutations: run.unobservedPositionMutations,
    healthLoss: run.healthLoss } : {}) };
}
const report = { ...before, node: process.version, platform: process.platform, selection, maxTicks,
  profile: LAND_BODY_STUDY, records,
  productionClearance: { profile: LAND_CLEARANCE_PROFILE,
    adopters: 'ordinary single-land-unit Move/queued Move; static footprints only; body pairs and other caller policies remain open' },
  scope: 'Candidate circles swept along admitted authoritative land substeps; diagnostic hypotheses, not production radii.',
  controls: { units: 'one world unit equals one tile; circles centered on authoritative x/z',
    pairs: 'directed moving capsule against each living land body at its current serial-executor position',
    penetration: 'margin below -1e-9; tangency is allowed; counts are contact substeps, not unique impacts',
    input: 'trusted diagnostic placements/Scout kind, production-validated checkpoint; real Move commands; both seats/noAttack',
    replay: 'two fresh adapters from the same complete checkpoint; actual actor identity, no normalization',
    navigation: 'constant revision and occupancy hash; no harvest, construction or cliff patches',
    progress: 'longest consecutive ticks with no admitted displacement before first arrival; this is not route-progress fairness' },
  limits: ['The probe itself makes no production body, avoidance, planner, checkpoint, wire or presentation change.',
    'No dynamic occupancy/elevation-volume clearance, gate/bridge policy, naval hull, Sheep or all-caller acceptance.',
    'Fixed ticks with planning callbacks drained; no asynchronous intake/process restart guarantee.',
    'No hardware timing/capacity, clean release digest, deployed identity or ordinary-game pixels.'] };
try {
  for (const spec of LAND_BODY_CASES.filter(s => selection === 'all' || selection === s.scene || selection === s.id)) {
    report.activeCase = spec.id;
    let initialCheckpoint;
    const first = await runLandBodyCase(spec, { maxTicks, captureInput: value => { initialCheckpoint = value; } });
    const record = { ...spec, deterministicReplay: false, initialCheckpoint, runs: [first] }; records.push(record);
    const second = await runLandBodyCase(spec, { maxTicks, initialCheckpoint }); record.runs.push(second);
    assert.equal(rawHash(second), rawHash(first), 'full raw geometry/motion/actor records must repeat without identity normalization');
    record.deterministicReplay = true;
    console.log(JSON.stringify({ id: spec.id, ticks: first.ticks, arrived: first.arrived, actors: first.actors.length,
      staticContactSteps: first.staticContactSteps, pairContactSteps: first.pairContactSteps,
      minimumStaticContactMargin: first.minimumStaticContactMargin, minimumPairMargin: first.minimumPairMargin }));
  }
  assert.deepEqual(await identity(), before, 'source identity changed during study');
  delete report.activeCase; report.outcome = 'measured'; report.integrityOutcome = 'passed';
  report.travelOutcome = records.every(r => r.runs[0].arrived === r.runs[0].actors.length) ? 'complete' : 'unfinished';
} catch (error) { report.outcome = 'failed'; report.failure = error.message; throw error; }
finally {
  if (process.env.LAND_BODY_RECORD) await writeFile(process.env.LAND_BODY_RECORD, gzipSync(JSON.stringify(report) + '\n'));
  if (process.env.LAND_BODY_SUMMARY) await writeFile(process.env.LAND_BODY_SUMMARY, JSON.stringify({ ...report,
    records: records.map(summarize) }, null, 2) + '\n');
}
