import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runFrontierTrial } from './crowd-dependency-frontier-diagnostic.mjs';
import { assessRetainedFrontier } from './crowd-service-admission-diagnostic.mjs';
import { comparePassageWitness } from './crowd-passage-service-diagnostic.mjs';
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function summarizeInfluence(report, harmedIds) {
  const horizons = [1, 3, 6, 9, 12].map(horizon => {
    const rows = report.measurements.map(m => m.rows.find(r => r.horizon === horizon));
    const union = key => [...new Set(rows.flatMap(r => r[key]))].sort((a, b) => a - b);
    const range = fn => ({ min: Math.min(...rows.map(fn)), max: Math.max(...rows.map(fn)) });
    return { horizon, fixedPhysicalCount: range(r => r.fixedCorridorPhysicalIds.length),
      outsidePhysicalIds: union('outsidePhysicalIds'), harmedPhysicalIds: union('fixedCorridorPhysicalIds').filter(id => harmedIds.includes(id)),
      missingFromCurrentQuery: union('missingFromCurrentQuery'), rootEnvelopeCount: range(r => r.anyDirectionRootPhysicalIds.length),
      currentInputComponent: range(r => r.currentInputClosure.length), possibleInputComponent: range(r => r.horizonInputClosure.length),
      allDecisionsRefuse: rows.every(r => r.decision.status === 'refuse'),
      staticCorridorRefusedRounds: rows.filter(r => !r.fixedCorridorStaticClear).length,
      coarseVisits: range(r => r.coarse.queryVisits), coarseReturned: range(r => r.coarse.returnedBodies),
      coarseEntrants: range(r => r.coarse.potentialEntrantIds.length), coarseOverflowRounds: rows.filter(r => r.coarse.overflow).length,
      bothDirectionsRounds: rows.filter(r => r.coarse.west.length && r.coarse.east.length).length,
      first: rows[0] };
  });
  return { horizons, stats: report.stats, oracleRefusals: report.refusals,
    occupiedFrames: report.portalFrames.filter(f => f.occupied.length).length,
    emptyFrames: report.portalFrames.filter(f => !f.occupied.length).length,
    occupancyMaximum: Math.max(...report.portalFrames.map(f => f.occupied.length)),
    crossingCandidates: report.crossingCandidates, fullTransits: report.fullTransits };
}
async function main() {
  const opts = Object.fromEntries(process.argv.slice(2).map(a => {
    const i = a.indexOf('='); assert.ok(i > 2, 'use --name=value'); return [a.slice(2, i), a.slice(i + 1)];
  }));
  assert.ok(opts.input && opts['control-48'] && opts['control-96'], 'authorized local source input/controls required');
  const [input, c48, c96] = await Promise.all([opts.input, opts['control-48'], opts['control-96']]
    .map(async f => JSON.parse(await readFile(f, 'utf8'))));
  assert.equal(input.mapDefinition.id, 'queued-wall-native-1');
  assert.deepEqual(input.mapDefinition.obstacles.map(o => [o.column, o.row, o.width, o.height]), [[48, 0, 1, 32], [48, 33, 1, 31]]);
  const ticks = Number(opts.ticks ?? 48); assert.ok([48, 96].includes(ticks));
  const baseline = (ticks === 48 ? c48 : c96).runs.find(r => r.mode === 'baseline'), assessment = assessRetainedFrontier(c48, c96);
  const args = { input, mode: 'influence', ticks, serviceAccounting: true,
    probeModuleUrl: new URL('./crowd-influence-boundary-probe.mjs', import.meta.url).href };
  const a = await runFrontierTrial(args), b = await runFrontierTrial(args);
  assert.equal(a.traceSha256, b.traceSha256); assert.equal(hash(a.probe), hash(b.probe));
  console.log(JSON.stringify({ assessment, limits: ['reachable-body sets are kinematic necessary overapproximations, not terrain routes or causal proofs',
    'full136-body current oracle/index builds are separately charged, not production query access',
    'current/potential input components are dependency overapproximations; no motion policy or local admission',
    'portal crossing candidates carry receipt validity; full transits require continuous valid chains, and neither proves recovery or scheduling'],
    comparison: comparePassageWitness(baseline, a, assessment.retainedHarmedIds),
    summary: summarizeInfluence(a.probe.influence, assessment.retainedHarmedIds), runs: [a, b] }, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(e => { console.error(e); process.exitCode = 1; });
