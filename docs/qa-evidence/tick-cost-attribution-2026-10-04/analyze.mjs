import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { basename } from 'node:path';
const inputs = process.argv.slice(2);
const quantiles = values => {
  const sorted = values.toSorted((a, b) => a - b), at = q => sorted.length
    ? sorted[Math.max(0, Math.ceil(sorted.length * q) - 1)] : null;
  return { count: sorted.length, min: at(0), p50: at(.5), p95: at(.95), p99: at(.99), max: at(1) };
};
const sum = (rows, key) => rows.reduce((total, row) => total + (row[key] ?? 0), 0);
const groups = ['simulationMs', 'visionMs', 'scenarioMs', 'broadcastMs', 'checkpointMs'];
const frame = c => ({ name: c.functionName || '(anonymous)', url: c.url, line: c.lineNumber + 1 });
const categoriesByFunction = new Map(Object.entries({ roomPayload: 'private payload', prepareJsonFrame: 'JSON/compression/framing',
  captureMatchCheckpoint: 'checkpoint capture', markVisionFrom: 'vision', updateVisionMasks: 'vision',
  processMovePlanningSlice: 'planner', serviceMovePlanningForTick: 'planner',
  simulateTick: 'simulation' }));
const category = call => categoriesByFunction.get(call.functionName) ?? null;
function allocationSummary(profile) {
  const nodes = [], categories = {};
  const visit = (node, ancestors) => {
    const path = [...ancestors, node.callFrame], own = node.selfSize;
    const group = path.toReversed().map(category).find(Boolean) ?? 'other/observer/runtime';
    categories[group] = (categories[group] ?? 0) + own;
    if (own) nodes.push({ ...frame(node.callFrame), estimatedBytes: own,
      stack: path.slice(-6).map(frame) });
    for (const child of node.children) visit(child, path);
  };
  visit(profile.head, []);
  return { sampledEntries: profile.samples.length, estimatedBytes: nodes.reduce((n, item) => n + item.estimatedBytes, 0),
    sampleSizeSum: profile.samples.reduce((n, sample) => n + sample.size, 0), categories,
    top: nodes.toSorted((a, b) => b.estimatedBytes - a.estimatedBytes).slice(0, 15) };
}
function cpuSummary(profile) {
  const nodes = new Map(profile.nodes.map(node => [node.id, node])), parents = new Map();
  for (const node of nodes.values()) for (const child of node.children ?? []) parents.set(child, node.id);
  const weight = new Map(), categories = {};
  for (let index = 0; index < profile.samples.length; index++) {
    const id = profile.samples[index], ms = (profile.timeDeltas[index] ?? 0) / 1000;
    weight.set(id, (weight.get(id) ?? 0) + ms);
    let cursor = id, group;
    while (cursor != null && !group) { group = category(nodes.get(cursor).callFrame); cursor = parents.get(cursor); }
    group ??= 'other/observer/runtime/idle'; categories[group] = (categories[group] ?? 0) + ms;
  }
  return { samples: profile.samples.length, durationMs: (profile.endTime - profile.startTime) / 1000,
    sampleIntervalWeightMs: [...weight.values()].reduce((a, b) => a + b, 0), categories,
    top: [...weight].map(([id, sampledIntervalMs]) => ({ ...frame(nodes.get(id).callFrame), sampledIntervalMs }))
      .toSorted((a, b) => b.sampledIntervalMs - a.sampledIntervalMs).slice(0, 20) };
}
const reports = [];
for (const filename of inputs) {
  const stored = await readFile(filename), bytes = filename.endsWith('.gz') ? gunzipSync(stored) : stored, r = JSON.parse(bytes);
  assert.equal(r.failure, undefined, filename); assert.equal(r.paidLedger, true); assert.equal(r.checkpointRecovery, true);
  assert.deepEqual(r.spent, [{food:150,wood:325},{food:150,wood:325}]);
  assert.equal(r.economyProgress.length, 4); assert.ok(r.economyProgress.every(p => p.harvested > 0 && p.deposited > 0));
  assert.ok(r.casualties > 0); assert.equal(r.ticks.length, r.endTick - r.startTick);
  r.ticks.forEach((tick, index) => assert.equal(tick.tickNumber, r.startTick + index + 1));
  const overruns = r.ticks.filter(tick => tick.durationMs > 1000/30), dominant = {};
  for (const tick of overruns) {
    const group = groups.toSorted((a, b) => tick[b] - tick[a])[0]; dominant[group] = (dominant[group] ?? 0) + 1;
  }
  const before = r.healthObservations.beforeCommands, after = r.healthObservations.afterWitness;
  const transportKeys = ['jsonFramesSent','jsonPayloadBytesSent','jsonWireBytesSent','compressedFramesSent',
    'compressedPayloadBytesSent','compressedWireBytesSent','coalescedStateSnapshots','outboundQueueLimitDisconnects'];
  const record = { filename:basename(filename), sha256: createHash('sha256').update(bytes).digest('hex'),
    storedSha256:createHash('sha256').update(stored).digest('hex'), head:r.head, serverSha256:r.sourceSha256,
    policy:r.policy, size:r.size, instrumented:!!r.attribution, startTick:r.startTick, endTick:r.endTick, casualties:r.casualties,
    wholeTickMs:quantiles(r.ticks.map(t => t.durationMs)), components:Object.fromEntries(groups.map(key => [key,quantiles(r.ticks.map(t => t[key]))])),
    overBudgetTicks:overruns.length, zeroTickPlanningOverruns:overruns.filter(t => !(t.planningTurns > 0)).length,
    overrunDominantComponents:dominant, overruns,
    activeTickPlanningMs:quantiles(r.ticks.filter(t => t.planningTurns > 0).map(t => t.planningMs)),
    transport:{beforeTick:before.lastSampleTick,afterTick:after.lastSampleTick,compressionPeers:[before.transport.compressionPeers,after.transport.compressionPeers],
      counterDeltas:Object.fromEntries(transportKeys.map(key => [key,after.transport[key]-before.transport[key]])),
      peakQueuedBytes:[before.transport.peakQueuedBytes,after.transport.peakQueuedBytes]},
    functional:{spent:r.spent,economyProgress:r.economyProgress,paidLedger:r.paidLedger,checkpointRecovery:r.checkpointRecovery} };
  if (r.attribution) {
    const a = r.attribution;
    assert.equal(a.originalSha256, r.sourceSha256); assert.equal(a.endTick, a.rowWindow.end.tickNumber);
    assert.ok(a.rows.every(row => row.tickNumber > a.rowWindow.start.tickNumber && row.tickNumber <= a.endTick));
    assert.ok(a.gc.every(e => e.startMs >= a.rowWindow.start.monotonicMs && e.startMs <= a.rowWindow.end.monotonicMs));
    const rows = a.rows.filter(row => row.tickNumber > r.startTick && row.tickNumber <= r.endTick);
    const native = new Map(r.ticks.map(t => [t.tickNumber,t]));
    rows.forEach(row => assert.ok(Math.abs(row.durationMs-native.get(row.tickNumber).durationMs) <= .000501));
    const timings = ['roomPayload','prepareJsonFrame','frameStringify','deflateRawSync','encodeWebSocketFrame','updateVisionMasks','captureMatchCheckpoint'];
    const counters = ['jsonPayloadBytes','jsonWireBytes','stateFrames','statePayloadBytes','stateWireBytes','stateUnitRows',
      'ensureVisionCalls','ensureVisionHits','ensureVisionMisses','coverageInvalidationMisses','tickInvalidationMisses',
      'visionSourceCalls','visionDuplicateSources','visionApplications','visionCoverageHits','visionCoverageMisses'];
    const gcOverlaps = rows.map(row => ({tickNumber:row.tickNumber,durationMs:row.durationMs,
      gcOverlapMs:a.gc.reduce((total,e) => total+Math.max(0,Math.min(row.endedMs,e.startMs+e.durationMs)-Math.max(row.startedMs,e.startMs)),0)}))
      .filter(row => row.gcOverlapMs > 0);
    record.attribution = { adapterSha256:a.adapterSha256, rowWindow:a.rowWindow, profileWindows:a.profileWindows,
      capturedRows:a.rows.length, witnessRows:rows.length, firstWitnessRow:rows[0]?.tickNumber,lastWitnessRow:rows.at(-1)?.tickNumber,
      counters:Object.fromEntries(counters.map(key => [key,sum(rows,key)])),
      timings:Object.fromEntries(timings.map(name => [name,{calls:sum(rows,`${name}Calls`),
        totalInclusiveMs:sum(rows,`${name}Ms`),activeTickMs:quantiles(rows.filter(row => row[`${name}Calls`]>0).map(row => row[`${name}Ms`]))}])),
      netHeapDeltaBytes:quantiles(rows.map(row => row.netHeapDeltaBytes)),
      externalOccupancyBytes:quantiles(rows.map(row => row.externalBytes)),arrayBufferOccupancyBytes:quantiles(rows.map(row => row.arrayBufferBytes)),
      gc:{overlapScope:'observer tick span (setup and post-duration memory sampling included), not native duration alone',
        entries:a.gc.length,totalObservedDurationMs:sum(a.gc,'durationMs'),ticksOverlapping:gcOverlaps.length,
        overBudgetOverlapping:gcOverlaps.filter(row => row.durationMs>1000/30).length,largest:gcOverlaps.toSorted((a,b)=>b.gcOverlapMs-a.gcOverlapMs).slice(0,10)},
      allocation:allocationSummary(a.allocationProfile),cpu:cpuSummary(a.cpuProfile),limits:a.limits };
  }
  reports.push(record);
}
console.log(JSON.stringify({schemaVersion:1,reports},null,2));
