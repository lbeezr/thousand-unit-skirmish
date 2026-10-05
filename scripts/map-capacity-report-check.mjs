import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const tickPhases = ['simulationMs', 'visionMs', 'scenarioMs', 'broadcastMs', 'checkpointMs'];
const quantiles = values => {
  const sorted = values.toSorted((a, b) => a - b);
  const at = q => sorted.length ? sorted[Math.ceil(sorted.length * q) - 1] : null;
  return { count: sorted.length, meanMs: sorted.length ? values.reduce((sum, n) => sum + n, 0) / sorted.length : null,
    p50Ms: at(.5), p95Ms: at(.95), p99Ms: at(.99), maxMs: at(1) };
};

// Native map-capacity report analysis, not a timing budget or root-cause claim.
export function capturedTickAttribution(rows, mapId) {
  if (!Array.isArray(rows) || !rows.length) return { status: 'unavailable', reasons: ['no-raw-ticks'] };
  const unique = new Map(), reasons = new Set();
  for (const row of rows) {
    if (!Number.isInteger(row?.workerRun) || row.workerRun < 1
      || typeof row.matchId !== 'string' || !row.matchId || typeof row.mapId !== 'string' || !row.mapId
      || !Number.isSafeInteger(row.tickNumber) || row.tickNumber < 1 || typeof row.overBudget !== 'boolean'
      || !Number.isFinite(row.budgetMs) || row.budgetMs <= 0
      || !['durationMs', 'cpuMs', ...tickPhases].every(key => Number.isFinite(row[key]) && row[key] >= 0)) {
      reasons.add('incomplete-tick-attribution'); continue;
    }
    // Each diagnostic duration/phase has three decimal places. The exact flag
    // remains authoritative within that rounding interval, but not beyond it.
    if (row.overBudget && row.durationMs < row.budgetMs - .0005
      || !row.overBudget && row.durationMs > row.budgetMs + .0005) reasons.add('inconsistent-overrun-flag');
    if (Math.abs(tickPhases.reduce((sum, key) => sum + row[key], 0) - row.durationMs) > .004)
      reasons.add('inconsistent-outer-phase-total');
    const key = JSON.stringify([row.workerRun, row.matchId, row.mapId, row.tickNumber]);
    if (unique.has(key) && JSON.stringify(unique.get(key)) !== JSON.stringify(row)) reasons.add('conflicting-tick-identity');
    else unique.set(key, row);
  }
  const measured = [...unique.values()].filter(row => row.mapId === mapId);
  if (new Set(measured.map(row => row.budgetMs)).size > 1) reasons.add('changed-tick-budget');
  if (!measured.length) reasons.add('no-ticks-for-requested-map');
  const segments = new Map();
  for (const row of measured) {
    const key = JSON.stringify([row.workerRun, row.matchId, row.mapId]);
    if (!segments.has(key)) segments.set(key, { workerRun: row.workerRun, matchId: row.matchId, mapId: row.mapId, ticks: [] });
    segments.get(key).ticks.push(row.tickNumber);
  }
  const coverage = [...segments.values()].map(({ ticks, ...identity }) => {
    ticks.sort((a, b) => a - b);
    const observed = new Set(ticks);
    const otherMapTicks = new Set([...unique.values()].filter(row => row.workerRun === identity.workerRun
      && row.matchId === identity.matchId && row.mapId !== identity.mapId
      && row.tickNumber >= ticks[0] && row.tickNumber <= ticks.at(-1) && !observed.has(row.tickNumber))
      .map(row => row.tickNumber));
    return { ...identity, firstTick: ticks[0], lastTick: ticks.at(-1), observedTicks: ticks.length,
      knownOtherMapTicksWithinObservedRange: otherMapTicks.size,
      missingTicksWithinObservedRange: ticks.at(-1) - ticks[0] + 1 - ticks.length - otherMapTicks.size };
  });
  const overruns = measured.filter(row => row.overBudget);
  const dominantPhase = row => tickPhases.reduce((best, key) => row[key] > row[best] ? key : best);
  return { status: reasons.size ? 'invalid-observations' : 'valid-observations', reasons: [...reasons],
    uniqueObservedTicks: measured.length, excludedOtherMapTicks: unique.size - measured.length,
    coverage, totalTickMs: quantiles(measured.map(row => row.durationMs)),
    phases: Object.fromEntries(tickPhases.map(key => [key, quantiles(measured.map(row => row[key]))])),
    overBudgetTicks: overruns.length,
    overrunDominantPhaseCounts: Object.fromEntries(tickPhases.map(key => [key, overruns.filter(row => dominantPhase(row) === key).length])),
    overrunRows: overruns.map(row => ({ ...row, dominantPhase: dominantPhase(row) })),
    slowestRows: measured.toSorted((a, b) => b.durationMs - a.durationMs).slice(0, 10),
    scope: 'unique observed ticks for the requested map; process/worker, match and map identities are distinct',
    limits: ['Observed-range coverage does not prove capture of earlier startup or later shutdown ticks.',
      'Outer phases describe where elapsed time was recorded, not function, allocation, GC or scheduling cause.',
      'Planning within simulation and process CPU time are not additional disjoint wall-time phases.',
      'Raw durations are rounded; overBudget preserves the exact production duration comparison.',
      'Collecting raw diagnostics adds polling/serialization overhead; no controlled hardware or causal speedup claim.'] };
}

export function capturedBudgetEnvelope(samples, planning = []) {
  const timing = samples.map(s => s.health?.tickTiming).filter(Boolean);
  const peak = key => Math.max(0, ...timing.map(t => t[key] ?? 0));
  const maximumPlanningSliceMs = Math.max(0, ...planning.map(p => p.maxPlanningSliceMs ?? 0));
  // The first tick after cold restart has no preceding tick from which to
  // measure start lag. Count that exact initialization shape explicitly; all
  // ordinary windows and all duration/planner fields must still be finite.
  const initialTickWithoutLag = t => t.sampleCount === 1 && t.windowSeconds === 0
    && t.startLagP95Ms === null && t.startLagMaxMs === null;
  const result = { sampledWindows: timing.length, tickP95PeakMs: peak('p95Ms'), tickMaxMs: peak('maxMs'),
    startLagP95PeakMs: peak('startLagP95Ms'), startLagMaxMs: peak('startLagMaxMs'), maximumPlanningSliceMs,
    initialTickWindowsWithoutLag: timing.filter(initialTickWithoutLag).length,
    scope: 'peaks across every retained rolling health window, including preparation/planning; not per-tick raw telemetry' };
  const complete = timing.length === samples.length && timing.length > 0 && timing.every(t =>
    ['p95Ms', 'maxMs'].every(key => Number.isFinite(t[key]))
    && (['startLagP95Ms', 'startLagMaxMs'].every(key => Number.isFinite(t[key])) || initialTickWithoutLag(t)))
    && planning.every(p => Number.isFinite(p.maxPlanningSliceMs));
  return { ...result, passed: complete && result.tickP95PeakMs <= 1000 / 30 && result.tickMaxMs <= 100
    && result.startLagP95PeakMs <= 1000 / 30 && result.startLagMaxMs <= 100 && maximumPlanningSliceMs <= 100 };
}
export function checkCapacityReport(report) {
  const loads = report.loads.map(load => {
    const envelope = capturedBudgetEnvelope(load.samples, load.waves.flatMap(w => w.planning));
    const tickAttribution = capturedTickAttribution(load.tickRows, report.mapId);
    return { armySize: load.armySize, envelope, tickAttribution, passed: load.passed === true && load.coldRecovery === true
      && (load.tickRows === undefined || tickAttribution.status === 'valid-observations')
      && load.waves.length === 3 && load.waves.every(w => w.observedGameTicksAfterAcceptance >= 300
        && w.planning.length === 2 && w.planning.every(p => p.routeFailures === 0)) && envelope.passed };
  });
  return { schemaVersion: 1, sourceCommit: report.sourceCommit, mapId: report.mapId, mapSHA256: report.mapSHA256,
    measuredScriptSHA256: report.scriptSHA256, loads,
    passed: report.passed === true && loads.length === report.workload.loads.length && loads.every(l => l.passed),
    capacityClaim: false };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = checkCapacityReport(JSON.parse(await readFile(process.argv[2], 'utf8')));
  console.log(JSON.stringify(report, null, 2)); if (!report.passed) process.exitCode = 1;
}
