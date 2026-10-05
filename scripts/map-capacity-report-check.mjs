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

// Inclusive diagnostic functions overlap; these are not a budget decomposition.
export function capturedInnerAttribution(runs, tickRows, mapId) {
  if (!Array.isArray(runs) || !runs.length) return { status: 'unavailable', reasons: ['no-inner-capture'] };
  const reasons = new Set(), rows = [], keys = new Set(), gc = [];
  const identity = row => JSON.stringify([row.workerRun, row.matchId, row.mapId, row.tickNumber]);
  const native = new Map((tickRows ?? []).map(row => [identity(row), row]));
  const functions = ['simulateTick', 'rebuildSpatialBuckets', 'getMoveVector', 'spreadInteractingUnits'];
  for (const run of runs) {
    if (!Number.isInteger(run.workerRun) || run.workerRun < 1 || run.droppedRows !== 0
      || !Array.isArray(run.rows) || !Array.isArray(run.gc)
      || !Number.isFinite(run.rowWindow?.start?.monotonicMs) || !Number.isFinite(run.rowWindow?.end?.monotonicMs)
      || run.rowWindow.end.monotonicMs < run.rowWindow.start.monotonicMs) {
      reasons.add('incomplete-inner-capture'); continue;
    }
    for (const raw of run.rows) {
      const row = { ...raw, workerRun: run.workerRun }, key = identity(row);
      if (keys.has(key)) reasons.add('duplicate-inner-tick-identity');
      keys.add(key);
      if (!Number.isFinite(row.startedMs) || !Number.isFinite(row.endedMs)
        || row.startedMs < run.rowWindow.start.monotonicMs || row.endedMs > run.rowWindow.end.monotonicMs
        || row.endedMs < row.startedMs || !Number.isFinite(row.netHeapDeltaBytes)
        || !['rssBytes', 'heapBeforeBytes', 'heapAfterBytes', 'externalBytes', 'arrayBufferBytes'].every(k => Number.isFinite(row[k]) && row[k] >= 0)
        || !functions.every(name => row[`${name}Calls`] === undefined && row[`${name}Ms`] === undefined
          || Number.isSafeInteger(row[`${name}Calls`]) && row[`${name}Calls`] > 0
            && Number.isFinite(row[`${name}Ms`]) && row[`${name}Ms`] >= 0)
        || row.simulateTickCalls !== 1) reasons.add('invalid-inner-row');
      const joined = native.get(key);
      if (joined && (Math.abs(joined.durationMs - row.durationMs) > .0005
        || joined.overBudget !== row.overBudget || joined.budgetMs !== row.budgetMs
        || ['cpuMs', ...tickPhases].some(phase => joined[phase] !== row[phase]))) reasons.add('inner-native-tick-mismatch');
      rows.push(row);
    }
    for (const event of run.gc) {
      if (!Number.isFinite(event.startMs) || !Number.isFinite(event.durationMs) || event.durationMs < 0
        || event.startMs < run.rowWindow.start.monotonicMs || event.startMs > run.rowWindow.end.monotonicMs) reasons.add('invalid-gc-window');
      else gc.push({ ...event, workerRun: run.workerRun });
    }
  }
  const outer = capturedTickAttribution(rows, mapId);
  if (outer.status !== 'valid-observations') reasons.add('invalid-inner-tick-attribution');
  const measured = rows.filter(row => row.mapId === mapId);
  const overlapRows = measured.filter(row => gc.some(event => event.workerRun === row.workerRun
    && event.startMs < row.endedMs && event.startMs + event.durationMs > row.startedMs));
  return { status: reasons.size ? 'invalid-observations' : 'valid-observations', reasons: [...reasons],
    ticks: outer, joinedNativeTicks: measured.filter(row => native.has(identity(row))).length,
    innerOnlyTicks: measured.filter(row => !native.has(identity(row))).length,
    functions: Object.fromEntries(functions.map(name => {
      const active = measured.filter(row => row[`${name}Calls`] > 0);
      return [name, { activeTicks: active.length, calls: active.reduce((n, row) => n + row[`${name}Calls`], 0),
        activeTickMs: quantiles(active.map(row => row[`${name}Ms`])) }];
    })),
    gc: { observedEvents: gc.length, observedDurationMs: gc.reduce((n, event) => n + event.durationMs, 0),
      overlappingTickIdentities: overlapRows.map(row => ({ workerRun: row.workerRun, matchId: row.matchId, mapId: row.mapId, tickNumber: row.tickNumber })),
      overlappingOverBudgetTicks: overlapRows.filter(row => row.overBudget).length },
    netHeapDeltaBytes: measured.length ? { min: Math.min(...measured.map(row => row.netHeapDeltaBytes)), max: Math.max(...measured.map(row => row.netHeapDeltaBytes)) } : null,
    limits: ['Inclusive function times overlap and do not sum to simulation time.',
      'GC overlap uses the broader observer span (wrapper entry through diagnostic/memory capture), not only production duration; it is not proof of an overrun cause.',
      'Net heap change and RSS/external occupancy are not allocated bytes or peak-between-sample measurements.',
      'Inner-only rows lie outside the independent rolling-health capture; joins preserve worker/match/map/tick identity.',
      'Diagnostic profiles and wrappers add overhead; no uninstrumented speedup or capacity claim.'] };
}

export function capturedRecoveryProfileControl(cases, runs, tickRows, mapId) {
  if (cases === undefined) return { status: 'unavailable', reasons: ['no-recovery-profile-control'] };
  const reasons = new Set();
  if (!Array.isArray(cases) || cases.length !== 4 || cases.some((c, i) => c?.profiles !== [true, false, false, true][i])
    || new Set(cases.map(c => c.checkpointSHA256)).size !== 1
    || new Set(cases.map(c => c.checkpointTick)).size !== 1
    || !cases.every(c => /^[a-f0-9]{64}$/.test(c.checkpointSHA256))) {
    return { status: 'invalid-observations', reasons: ['unmatched-recovery-cases'] };
  }
  if (new Set(cases.map(c => c.workerRun)).size !== 4) reasons.add('duplicate-recovery-worker');
  const observations = cases.map(c => {
    const selected = (tickRows ?? []).filter(row => row.workerRun === c.workerRun && row.mapId === mapId
      && row.tickNumber >= c.firstTick && row.tickNumber <= c.lastTick);
    const matchingRuns = (runs ?? []).filter(run => run.workerRun === c.workerRun), run = matchingRuns[0];
    const timing = capturedTickAttribution(selected, mapId);
    if (!Number.isSafeInteger(c.workerRun) || c.workerRun < 2 || c.ordinal !== cases.indexOf(c) + 1
      || !Number.isSafeInteger(c.checkpointTick) || c.firstTick !== c.checkpointTick + 1 || c.lastTick !== c.checkpointTick + 60
      || timing.status !== 'valid-observations' || timing.uniqueObservedTicks !== 60
      || timing.coverage.length !== 1 || timing.coverage[0].firstTick !== c.firstTick || timing.coverage[0].lastTick !== c.lastTick
      || matchingRuns.length !== 1 || run?.profiles !== c.profiles || run?.droppedStartupRows !== 0
      || !Number.isFinite(run?.startupWindow?.startRequest?.monotonicMs)
      || !Number.isFinite(run?.startupWindow?.startCompletion?.monotonicMs)
      || run.startupWindow.startCompletion.monotonicMs < run.startupWindow.startRequest.monotonicMs
      || run.startupWindow.startRequest.tickNumber !== c.checkpointTick + 3
      || c.beforeStartup?.workerRun !== c.workerRun || c.afterStartup?.workerRun !== c.workerRun
      || c.beforeStartup?.health?.map !== mapId || c.afterStartup?.health?.map !== mapId
      || !c.beforeStartup?.health?.tickTiming || !c.afterStartup?.health?.tickTiming) reasons.add('incomplete-recovery-control');
    if (run && (c.profiles ? !run.cpuProfile || !run.allocationProfile
      : run.cpuProfile !== null || run.allocationProfile !== null || Object.keys(run.profileWindows ?? {}).length !== 0)) reasons.add('profile-mode-mismatch');
    const clockRows = [...(run?.startupRows ?? []), ...(run?.rows ?? [])].filter(row => row.mapId === mapId
      && row.tickNumber >= c.firstTick && row.tickNumber <= c.lastTick).toSorted((a, b) => a.tickNumber - b.tickNumber);
    for (const row of clockRows) {
      const initial = row.tickNumber === c.firstTick && row.previousTickStartedMs === null && row.startLagMs === null;
      if (!Number.isFinite(row.tickStartedMs) || !initial && (!Number.isFinite(row.previousTickStartedMs) || row.tickStartedMs < row.previousTickStartedMs || !Number.isFinite(row.startLagMs)
        || Math.abs(row.startLagMs - Math.max(0, row.tickStartedMs - row.previousTickStartedMs - row.budgetMs)) > 1e-8))
        reasons.add('invalid-recovery-tick-clock');
      const joined = selected.find(tick => tick.matchId === row.matchId && tick.tickNumber === row.tickNumber);
      if (!joined || Math.abs(joined.durationMs - row.durationMs) > .0005 || joined.budgetMs !== row.budgetMs
        || joined.overBudget !== row.overBudget || ['cpuMs', ...tickPhases].some(key => joined[key] !== row[key])) reasons.add('recovery-clock-identity-mismatch');
    }
    if (clockRows.length !== 57 || clockRows.some((row, i) => row.tickNumber !== c.checkpointTick + 4 + i
      || i > 0 && row.previousTickStartedMs !== clockRows[i - 1].tickStartedMs)
      || new Set(clockRows.map(row => JSON.stringify([row.matchId, row.mapId, row.tickNumber]))).size !== clockRows.length)
      reasons.add('incomplete-recovery-tick-clocks');
    const startupMs = run?.startupWindow ? run.startupWindow.startCompletion.monotonicMs - run.startupWindow.startRequest.monotonicMs : null;
    return { ordinal: c.ordinal, profiles: c.profiles, workerRun: c.workerRun, checkpointSHA256: c.checkpointSHA256,
      firstTick: c.firstTick, lastTick: c.lastTick, timing, startupWindow: run?.startupWindow, startupMs,
      profileWindows: run?.profileWindows, observedClockRows: clockRows.length,
      startLagMs: quantiles(clockRows.filter(row => Number.isFinite(row.startLagMs)).map(row => row.startLagMs)),
      beforeStartupTiming: c.beforeStartup?.health?.tickTiming, afterStartupTiming: c.afterStartup?.health?.tickTiming,
      afterWindowTiming: c.afterWindow?.health?.tickTiming,
      startupAdjacentRows: clockRows.filter(row => run?.startupWindow
        && Number.isFinite(row.previousTickStartedMs)
        && row.previousTickStartedMs <= run.startupWindow.startCompletion.monotonicMs
        && row.tickStartedMs >= run.startupWindow.startRequest.monotonicMs) };
  });
  return { status: reasons.size ? 'invalid-observations' : 'valid-observations', reasons: [...reasons], observations,
    limits: ['Same checkpoint bytes and fixed first60 game ticks, with no new gameplay commands; peer connection receipt times and host scheduling are not replayed.',
      'Observer-only keeps function/memory/GC instrumentation; it isolates CPU/allocation profiler startup, not all observer overhead.',
      'Profiler and observer startup precede active inner rows; native rolling health retains earlier recovery ticks.',
      'Temporal overlap with a tick-start gap is not proof that all delay is caused by profiler startup; budgets remain unchanged.'] };
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
    const innerAttribution = capturedInnerAttribution(load.attributionRuns, load.tickRows, report.mapId);
    const recoveryProfileControl = capturedRecoveryProfileControl(load.recoveryProfileCases, load.attributionRuns, load.tickRows, report.mapId);
    return { armySize: load.armySize, envelope, tickAttribution, innerAttribution, recoveryProfileControl, passed: load.passed === true && load.coldRecovery === true
      && (load.tickRows === undefined || tickAttribution.status === 'valid-observations')
      && (load.attributionRuns === undefined || innerAttribution.status === 'valid-observations')
      && (load.recoveryProfileCases === undefined || recoveryProfileControl.status === 'valid-observations')
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
