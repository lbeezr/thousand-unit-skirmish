import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runFrontierTrial, compareFrontierTrials } from './crowd-dependency-frontier-diagnostic.mjs';
import { assessRetainedFrontier } from './crowd-service-admission-diagnostic.mjs';
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');

export function comparePassageWitness(baseline, candidate, retainedIds) {
  assert.equal(baseline.traceSha256, candidate.traceSha256, 'read-only feasibility must preserve normal movement');
  // Conservative whole affected set, including actors invisible to the four
  // local queries and all retained harmed controls. Never select only winners.
  const allIds = baseline.initialActors.map(a => a.id);
  const comparison = compareFrontierTrials({ ...baseline, affectedIds: allIds }, { ...candidate, affectedIds: allIds });
  const prior = new Map(candidate.samples.find(s => s.tick === candidate.ticks - 24).actors.map(a => [a.id, a]));
  const before = new Map(baseline.samples.at(-1).actors.map(a => [a.id, a]));
  const service = new Map(candidate.probe.ledger.actors.map(a => [a.id, a]));
  const allReceiptsValid = !candidate.probe.ledger.failed && allIds.every(id => service.get(id)?.valid === true);
  const serviceBoundsRetained = allIds.every(id => {
    const s = service.get(id);
    return s && s.debtAge <= 12 && s.maxDebtAge <= 12 && s.worstBackslide <= .15 + 1e-9;
  });
  const actors = candidate.samples.at(-1).actors.map(a => ({ id: a.id,
    progress: a.rawProgress, last24Progress: a.rawProgress - prior.get(a.id).rawProgress,
    baselineDelta: a.rawProgress - before.get(a.id).rawProgress, service: service.get(a.id) }));
  return { ...comparison, actors, retainedControls: actors.filter(a => retainedIds.includes(a.id)),
    admitted: candidate.probe.events.some(e => e.type === 'admit'),
    completeServiceWitness: candidate.probe.state === 'complete', zeroInterventionBaselineRepeat: true,
    allReceiptsValid, serviceBoundsRetained,
    qualified: comparison.qualified && candidate.probe.state === 'complete' && allReceiptsValid && serviceBoundsRetained };
}

async function main() {
  const options = Object.fromEntries(process.argv.slice(2).map(a => {
    const i = a.indexOf('='); assert.ok(i > 2, 'use --name=value'); return [a.slice(2, i), a.slice(i + 1)];
  }));
  assert.ok(options.input && options['control-48'] && options['control-96'], 'authorized local input/controls required');
  const [input, c48, c96] = await Promise.all([options.input, options['control-48'], options['control-96']]
    .map(async f => JSON.parse(await readFile(f, 'utf8'))));
  const assessment = assessRetainedFrontier(c48, c96), ticks = Number(options.ticks ?? 48);
  assert.ok([48, 96].includes(ticks));
  const baseline = (ticks === 48 ? c48 : c96).runs.find(r => r.mode === 'baseline');
  const a = await runFrontierTrial({ input, mode: 'passage', ticks, serviceAccounting: true,
    probeModuleUrl: new URL('./crowd-passage-service-probe.mjs', import.meta.url).href });
  const b = await runFrontierTrial({ input, mode: 'passage', ticks, serviceAccounting: true,
    probeModuleUrl: new URL('./crowd-passage-service-probe.mjs', import.meta.url).href });
  assert.equal(a.traceSha256, b.traceSha256); assert.equal(hash(a.probe), hash(b.probe), 'deterministic complete witness');
  const covered = a.probe.census.filter(c => c.covered);
  const outsiders = [...new Set(a.probe.census.flatMap(c => c.uncovered))].sort((a, b) => a - b);
  console.log(JSON.stringify({ assessment, ticks, limits: ['read-only feasibility; no motion policy or recovery claim',
    'whole-affected floors are diagnostic acceptance bounds, not guaranteed bounds on normal executor motion',
    'query coverage is deliberately conservative and not a minimal physical dependency component',
    'cold retained serial-pose source, not warm native scheduling'],
    scope: { rounds: a.probe.census.length, coveredRounds: covered.length, outsideIds: outsiders,
      firstRound: a.probe.census[0], admission: a.probe.events[0] },
    comparison: comparePassageWitness(baseline, a, assessment.retainedHarmedIds), runs: [a, b] }, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(e => { console.error(e); process.exitCode = 1; });
