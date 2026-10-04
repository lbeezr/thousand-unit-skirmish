import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

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
    return { armySize: load.armySize, envelope, passed: load.passed === true && load.coldRecovery === true
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
