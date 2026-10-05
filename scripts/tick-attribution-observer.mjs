// Read-only observer for disposable native server copies, never a runtime binding.
import { Session } from 'node:inspector/promises';
import { PerformanceObserver } from 'node:perf_hooks';

export function createTickAttribution({ functions, context, visionContext, memory = () => process.memoryUsage(),
  now = () => performance.now(), profiles = true, createSession = () => new Session() }) {
  const wrapped = { ...functions }, stringify = JSON.stringify;
  let active = false, current = null, frameDepth = 0, vision = null, session;
  let rowWindow = null, profileWindows = null, startupWindow = null, starting = false, startupCurrent = null;
  const startupRows = []; let droppedStartupRows = 0;
  const rows = [], gc = []; let droppedRows = 0;
  const captureGc = entries => {
    for (const e of entries) if (rowWindow && e.startTime >= rowWindow.start.monotonicMs
      && e.startTime <= (rowWindow.end?.monotonicMs ?? Infinity)) {
      gc.push({ startMs: e.startTime, durationMs: e.duration, kind: e.detail?.kind ?? null });
    }
  };
  const gcObserver = new PerformanceObserver(list => captureGc(list.getEntries()));
  const boundary = () => ({ tickNumber: context().tickNumber, monotonicMs: now() });
  const add = (key, value = 1) => { if (current) current[key] = (current[key] ?? 0) + value; };
  const measured = (name, callback) => {
    const callsKey = `${name}Calls`, msKey = `${name}Ms`;
    return function (...args) {
      if (!current) return callback.apply(this, args);
      const start = now();
      try { return callback.apply(this, args); }
      finally { add(callsKey); add(msKey, now() - start); }
    };
  };
  for (const name of ['roomPayload', 'deflateRawSync', 'encodeWebSocketFrame', 'captureMatchCheckpoint',
    'simulateTick', 'rebuildSpatialBuckets', 'getMoveVector', 'spreadInteractingUnits']) {
    if (typeof functions[name] !== 'function') continue;
    wrapped[name] = measured(name, functions[name]);
  }
  wrapped.stringify = function (...args) {
    if (!current || frameDepth === 0) return stringify.apply(this, args);
    const start = now();
    try { return stringify.apply(this, args); }
    finally { add('frameStringifyCalls'); add('frameStringifyMs', now() - start); }
  };
  wrapped.prepareJsonFrame = measured('prepareJsonFrame', function (message, ...args) {
    frameDepth++;
    try {
      const result = functions.prepareJsonFrame.call(this, message, ...args);
      add('jsonPayloadBytes', result.rtsPayloadBytes); add('jsonWireBytes', result.length);
      if (result.rtsCompressed) add('compressedFrames');
      if (message.type === 'state') {
        add('stateFrames'); add('statePayloadBytes', result.rtsPayloadBytes); add('stateWireBytes', result.length);
        add('stateUnitRows', message.units.length);
      }
      return result;
    } finally { frameDepth--; }
  });
  wrapped.ensureVisionMasks = function (...args) {
    if (current) {
      const c = context();
      add('ensureVisionCalls');
      add(c.visionTick !== c.tickNumber || c.visionCoverage !== c.coverage ? 'ensureVisionMisses' : 'ensureVisionHits');
      if (c.visionCoverage !== c.coverage) add('coverageInvalidationMisses');
      if (c.visionTick !== c.tickNumber) add('tickInvalidationMisses');
    }
    return functions.ensureVisionMasks.apply(this, args);
  };
  wrapped.updateVisionMasks = measured('updateVisionMasks', function (...args) {
    const previous = vision;
    if (current) vision = visionContext();
    try { return functions.updateVisionMasks.apply(this, args); }
    finally { vision = previous; }
  });
  wrapped.markVisionFrom = function (team, x, z, sight) {
    if (current && vision) {
      const cell = Math.floor(z + vision.halfZ) * vision.width + Math.floor(x + vision.halfX);
      const actualSight = sight ?? vision.defaultSight;
      add('visionSourceCalls');
      if (vision.processed[team][cell] >= actualSight) add('visionDuplicateSources');
      else {
        add('visionApplications');
        add(vision.coverage.has(cell, actualSight) ? 'visionCoverageHits' : 'visionCoverageMisses');
      }
    }
    return functions.markVisionFrom.call(this, team, x, z, sight);
  };
  wrapped.runSimulationTick = function (...args) {
    if (!active) {
      if (!starting) return functions.runSimulationTick.apply(this, args);
      startupCurrent = { previousTickStartedMs: context().tickStartedMs };
      try { return functions.runSimulationTick.apply(this, args); }
      finally { startupCurrent = null; }
    }
    const before = memory();
    current = { tickNumber: context().tickNumber + 1, startedMs: now(), heapBeforeBytes: before.heapUsed,
      previousTickStartedMs: context().tickStartedMs };
    const metrics = context().cacheMetrics;
    if (metrics) current.visionCacheBefore = metrics;
    try { return functions.runSimulationTick.apply(this, args); }
    finally { current = null; }
  };
  wrapped.recordTickDuration = function (duration, diagnostic, ...args) {
    const clockFields = row => {
      const tickStartedMs = context().tickStartedMs;
      return Number.isFinite(tickStartedMs) ? { tickStartedMs,
        startLagMs: Number.isFinite(row.previousTickStartedMs)
          ? Math.max(0, tickStartedMs - row.previousTickStartedMs - diagnostic.budgetMs) : null } : {};
    };
    if (startupCurrent) {
      startupRows.push({ ...startupCurrent, ...diagnostic, ...clockFields(startupCurrent), durationMs: duration });
      if (startupRows.length > 2000) { startupRows.shift(); droppedStartupRows++; }
    }
    if (current) {
      const after = memory();
      const metrics = context().cacheMetrics;
      if (metrics) current.visionCacheAfter = metrics;
      Object.assign(current, diagnostic, clockFields(current), { endedMs: now(), durationMs: duration,
        heapAfterBytes: after.heapUsed, netHeapDeltaBytes: after.heapUsed - current.heapBeforeBytes,
        rssBytes: after.rss, externalBytes: after.external, arrayBufferBytes: after.arrayBuffers });
      rows.push(current);
      if (rows.length > 2000) { rows.shift(); droppedRows++; }
    }
    return functions.recordTickDuration.call(this, duration, diagnostic, ...args);
  };
  return {
    wrapped,
    async start() {
      if (active || starting) throw new Error('Attribution already active');
      rows.length = 0; gc.length = 0; droppedRows = 0;
      rowWindow = null; profileWindows = {}; startupRows.length = 0; droppedStartupRows = 0;
      startupWindow = { startRequest: boundary() }; starting = true;
      try {
      if (profiles) {
        session = createSession(); session.connect();
        await session.post('Profiler.enable');
        await session.post('Profiler.setSamplingInterval', { interval: 1000 });
        profileWindows.cpu = { startRequest: boundary() };
        await session.post('Profiler.start');
        profileWindows.cpu.startCompletion = boundary();
        profileWindows.allocation = { startRequest: boundary() };
        await session.post('HeapProfiler.startSampling', { samplingInterval: 65536,
          includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
        profileWindows.allocation.startCompletion = boundary();
      }
      startupWindow.startCompletion = boundary(); starting = false;
      rowWindow = { start: boundary() };
      gcObserver.observe({ entryTypes: ['gc'] }); active = true;
      return { tickNumber: rowWindow.start.tickNumber, rowStart: rowWindow.start,
        startupWindow, profiles, samplingIntervalBytes: profiles ? 65536 : null };
      } catch (error) {
        starting = false; session?.disconnect(); session = null; throw error;
      }
    },
    async stop() {
      if (!active) throw new Error('Attribution is not active');
      // Stop row capture before any awaited shutdown can serve another tick.
      active = false; rowWindow.end = boundary();
      let cpuProfile = null, allocationProfile = null;
      if (session) {
        profileWindows.cpu.stopRequest = boundary();
        cpuProfile = (await session.post('Profiler.stop')).profile;
        profileWindows.cpu.stopCompletion = boundary();
        profileWindows.allocation.stopRequest = boundary();
        allocationProfile = (await session.post('HeapProfiler.stopSampling')).profile;
        profileWindows.allocation.stopCompletion = boundary();
        session.disconnect(); session = null;
      }
      // Drain notifications for GC that began within the frozen row window.
      await new Promise(resolve => setImmediate(resolve));
      captureGc(gcObserver.takeRecords()); gcObserver.disconnect();
      return { endTick: rowWindow.end.tickNumber, rowWindow, profileWindows, startupWindow,
        startupRows: [...startupRows], droppedStartupRows, profiles,
        rows: [...rows], droppedRows, gc: [...gc], cpuProfile, allocationProfile,
        limits: ['inclusive function timings overlap; do not add nested timings',
          'heap deltas are net live-heap change, not allocated bytes; sampled allocation estimates include collected objects',
          'payload/frame lengths count constructed bytes, not native allocation or peer traffic; external/arrayBuffer snapshots are retained occupancy',
          'V8 heap sampling does not measure all external allocations; use health.transport for peer traffic',
          'row/GC capture and CPU/allocation profiles have separately recorded endpoints; GC durations may extend beyond the row window',
          'wrappers, heap/CPU sampling and GC observation add overhead; use uninstrumented runs for whole-tick comparison'] };
    },
  };
}
