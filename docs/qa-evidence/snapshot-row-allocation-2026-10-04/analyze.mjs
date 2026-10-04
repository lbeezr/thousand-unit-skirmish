import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { basename, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const directory = resolve(process.argv[2] ?? import.meta.dirname);
const sha = data => createHash('sha256').update(data).digest('hex');
const load = async name => {
  const stored = await readFile(resolve(directory, name));
  const decoded = name.endsWith('.gz') ? gunzipSync(stored) : stored;
  return { data: JSON.parse(decoded), sha256: sha(decoded), storedSha256: sha(stored) };
};
const manifest = (await load('run-manifest.json')).data;
assert.equal(manifest.runs.length, 12);
assert.ok(manifest.completedUtc);
assert.deepEqual(manifest.runs.map(r => [r.variant, r.policy, r.repeat, r.observed]), manifest.cases);
for (const key of ['srcTree', 'harnessSha256', 'observerSha256'])
  assert.equal(manifest.identities.baseline[key], manifest.identities.candidate[key]);

const processFiles = manifest.runs.map(r => `${basename(r.output)}.gz`);
const nativeAnalysisPath = resolve(directory, '../tick-cost-attribution-2026-10-04/analyze.mjs');
const native = JSON.parse(execFileSync(process.execPath,
  [nativeAnalysisPath, ...processFiles.map(name => resolve(directory, name))], {maxBuffer: 20 * 1024 * 1024}));
const processAllocation = [], processReports = [];
for (let index = 0; index < manifest.runs.length; index++) {
  const run = manifest.runs[index], report = (await load(processFiles[index])).data;
  const identity = manifest.identities[run.variant];
  assert.equal(run.exitCode, 0); assert.equal(run.failure, null);
  assert.equal(report.head, identity.head); assert.equal(report.sourceSha256, identity.serverSha256);
  assert.equal(report.policy, run.policy); assert.equal(report.size, 2000);
  assert.equal(report.ticks.length, 930);
  assert.equal(!!report.attribution, run.observed);
  processReports.push({...native.reports[index], variant: run.variant, repeat: run.repeat});
  if (!run.observed) continue;
  const a = report.attribution;
  let selfEstimatedBytes = 0, inclusiveEstimatedBytes = 0;
  const visit = (node, ancestorSnapshot = false) => {
    const ownSnapshot = node.callFrame.functionName === 'snapshotUnits';
    if (ownSnapshot) selfEstimatedBytes += node.selfSize;
    if (ancestorSnapshot || ownSnapshot) inclusiveEstimatedBytes += node.selfSize;
    for (const child of node.children) visit(child, ancestorSnapshot || ownSnapshot);
  };
  visit(a.allocationProfile.head);
  const capturedUnitRows = a.rows.reduce((n, row) => n + (row.stateUnitRows ?? 0), 0);
  const witnessUnitRows = native.reports[index].attribution.counters.stateUnitRows;
  assert.ok(capturedUnitRows > 0 && witnessUnitRows > 0);
  processAllocation.push({variant: run.variant, policy: run.policy, filename: processFiles[index],
    selfEstimatedBytes, inclusiveEstimatedBytes, capturedUnitRows, witnessUnitRows,
    selfEstimatedBytesPerCapturedRow: selfEstimatedBytes / capturedUnitRows,
    inclusiveEstimatedBytesPerCapturedRow: inclusiveEstimatedBytes / capturedUnitRows,
    rowWindow: a.rowWindow, profileWindows: a.profileWindows,
    limit: 'Profile endpoints and captured tick rows differ; per-row ratios are approximate workload normalization, not exact allocated or saved bytes.'});
}

const probes = [], probePairs = [];
const functionHashes = {
  baseline: '4815ed55d734594e9883d68d10d5b0ac7a940f2923086f4ea49605411bb3154e',
  candidate: '1fda4f484793bcba5c8992e5d4ce88f3e332e03a2d810f05493dab6dbef5b425',
};
for (let repeat = 1; repeat <= 3; repeat++) {
  const pair = {};
  for (const variant of ['baseline', 'candidate']) {
    const filename = `snapshot-row-probe-${variant}-${repeat}.json.gz`;
    const {data: r, sha256, storedSha256} = await load(filename);
    assert.equal(r.variant, variant); assert.equal(r.head, manifest.identities.candidate.head);
    assert.equal(r.functionSha256, functionHashes[variant]);
    assert.equal(r.warmupCalls, 50); assert.deepEqual(r.views, [0, 1, null]);
    assert.equal(r.samplingIntervalBytes, 65536);
    assert.equal(r.iterations, 500); assert.equal(r.actors, 2000);
    assert.equal(r.rows, 888611); assert.equal(r.checksum, 1888111);
    pair[variant] = r;
    const {profile, ...details} = r;
    probes.push({filename, sha256, storedSha256, repeat, ...details});
  }
  assert.equal(pair.baseline.actorHash, pair.candidate.actorHash);
  assert.deepEqual(pair.baseline.viewJsonHashes, pair.candidate.viewJsonHashes);
  const inclusiveReductionFraction = 1 - pair.candidate.snapshotInclusiveEstimatedBytes / pair.baseline.snapshotInclusiveEstimatedBytes;
  assert.ok(inclusiveReductionFraction >= manifest.retentionCriteria.minimumFixedProbeAllocationReductionFraction);
  probePairs.push({repeat, baselineEstimatedBytesPerRow: pair.baseline.inclusiveEstimatedBytesPerRow,
    candidateEstimatedBytesPerRow: pair.candidate.inclusiveEstimatedBytesPerRow, inclusiveReductionFraction,
    selfReductionFraction: 1 - pair.candidate.snapshotSelfEstimatedBytes / pair.baseline.snapshotSelfEstimatedBytes});
}
const processPairs = [0, 4].map(policy => {
  const baseline = processAllocation.find(r => r.policy === policy && r.variant === 'baseline');
  const candidate = processAllocation.find(r => r.policy === policy && r.variant === 'candidate');
  const inclusiveNormalizedReductionFraction = 1 - candidate.inclusiveEstimatedBytesPerCapturedRow / baseline.inclusiveEstimatedBytesPerCapturedRow;
  assert.ok(inclusiveNormalizedReductionFraction > 0, 'process profiles must confirm allocation direction');
  return {policy, baseline, candidate, inclusiveNormalizedReductionFraction,
    selfNormalizedReductionFraction: 1 - candidate.selfEstimatedBytesPerCapturedRow / baseline.selfEstimatedBytesPerCapturedRow};
});
console.log(JSON.stringify({schemaVersion: 1, identities: manifest.identities,
  retentionEvidence: {fixedProbeMinimumReductionPassed: true, processAllocationDirectionPassed: true,
    wholeTickRowsRetained: processReports.reduce((n, r) => n + r.wholeTickMs.count, 0),
    functionalProcessRunsPassed: processReports.length,
    remainingChecks: 'Exact wire/privacy/recovery regression, independent review and integration are recorded in verification.json.'},
  probePairs, processPairs, probes, reports: processReports,
  limits: ['Two repeats per plain variant/policy; serial process runs on a shared host, not a causal timing or capacity experiment.',
    'Native paid battle process checks are not deployed or rendered acceptance.',
    'Different accepted order ticks and casualties; process wire hashes are not asserted equal between dynamic runs.',
    'Fixed probe hashes compare unchanged views/actors across the frozen production function bodies.',
    'V8 allocation estimates include collected objects and omit some native/external allocations; occupancy is not allocation.',
    'Profile windows differ from tick-row windows; normalized process estimates are approximate.',
    'No planner policy/default, fog, ownership, checkpoint or animation-timing change.']}, null, 2));
