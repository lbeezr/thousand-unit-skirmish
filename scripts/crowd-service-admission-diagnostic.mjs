import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runFrontierTrial, compareFrontierTrials } from './crowd-dependency-frontier-diagnostic.mjs';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function assessRetainedFrontier(control48, control96) {
  const mode = (c, name) => c.runs.find(r => r.mode === name);
  const comparison = (c, name) => c.comparisons.find(r => r.mode === name);
  const harm = comparison(control48, 'frontier').harmed;
  const seedHarm = new Map(comparison(control48, 'single').harmed.map(a => [a.id, a]));
  const seed = mode(control48, 'single'), baseline = mode(control48, 'baseline'), frontier = mode(control48, 'frontier');
  assert.equal(seed.inputSha256, frontier.inputSha256); assert.equal(seed.inputSha256, mode(control96, 'single').inputSha256);
  const sampledLoss = baseline.samples.map(s => {
    const other = seed.samples.find(v => v.tick === s.tick), before = new Map(s.actors.map(a => [a.id, a.rawProgress]));
    return { tick: s.tick, retainedHarmedWithSeedLoss: harm.filter(h =>
      other.actors.find(a => a.id === h.id).rawProgress - before.get(h.id) < -.01).length };
  });
  const declared = new Set(frontier.frontierIds);
  return { retainedHarmedIds: harm.map(a => a.id), alreadyHarmedBySeed: harm.filter(a => seedHarm.has(a.id)).length,
    unchangedBySecond: harm.filter(a => seedHarm.has(a.id) && Math.abs(a.delta - seedHarm.get(a.id).delta) < 1e-12).map(a => a.id),
    sampledLoss, outsideDesiredStepBlockers: [...new Set(frontier.probe.observations.flatMap(o => o.blockers ?? []))]
      .filter(id => !declared.has(id)).sort((a, b) => a - b),
    qualified48: comparison(control48, 'frontier').qualified, qualified96: comparison(control96, 'frontier').qualified };
}

export function compareAdmissionControls(baseline, candidate, retainedIds) {
  const comparison = compareFrontierTrials(baseline, candidate);
  const final = r => new Map(r.samples.at(-1).actors.map(a => [a.id, a]));
  const before = final(baseline), after = final(candidate);
  const service = new Map(candidate.probe.admission.ledger.actors.map(a => [a.id, a]));
  return { ...comparison, retainedControls: retainedIds.map(id => ({ id,
    delta: after.get(id).rawProgress - before.get(id).rawProgress,
    progress: after.get(id).rawProgress, service: service.get(id) })),
    zeroInterventionBaselineRepeat: !candidate.probe.first.events.some(e => e.type === 'retreat-step')
      && !candidate.probe.second?.events.some(e => e.type === 'retreat-step')
      && candidate.traceSha256 === baseline.traceSha256 };
}

async function main() {
  const options = Object.fromEntries(process.argv.slice(2).map(arg => {
    const i = arg.indexOf('='); assert.ok(i > 2, 'use --name=value'); return [arg.slice(2, i), arg.slice(i + 1)];
  }));
  assert.ok(options.input && options['control-48'] && options['control-96'], 'supply authorized local input and retained source-derived controls');
  const input = JSON.parse(await readFile(options.input, 'utf8'));
  const c48 = JSON.parse(await readFile(options['control-48'], 'utf8')), c96 = JSON.parse(await readFile(options['control-96'], 'utf8'));
  const assessment = assessRetainedFrontier(c48, c96), ticks = Number(options.ticks ?? 48), runs = [];
  assert.ok([48, 96].includes(ticks), 'retain the original48/96 comparison windows');
  for (const mode of ['baseline', 'single', 'frontier', 'return', 'return-debt', 'entry']) {
    const a = await runFrontierTrial({ input, mode, ticks, serviceAccounting: true });
    const b = await runFrontierTrial({ input, mode, ticks, serviceAccounting: true });
    assert.equal(a.traceSha256, b.traceSha256, `${mode} full-unit repeat`);
    assert.equal(hash(a.probe), hash(b.probe), `${mode} service/coordinator exact repeat`);
    const retained = (ticks === 48 ? c48 : c96).runs.find(r => r.mode === mode);
    if (retained) assert.equal(a.traceSha256, retained.traceSha256, 'read-only service accounting preserves original control');
    runs.push(a);
  }
  console.log(JSON.stringify({ assessment, limits: ['read-only accounting and conservative diagnostic admission; no new headings or production policy',
    'cold retained serial-pose fixture; zero-intervention equality proves refusal, not recovery'],
    comparisons: runs.slice(1).map(r => compareAdmissionControls(runs[0], r, assessment.retainedHarmedIds)), runs }, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(error => { console.error(error); process.exitCode = 1; });
