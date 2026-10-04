// Read-only observer for disposable native server copies, never a runtime binding.
import { Session } from 'node:inspector/promises';
import { PerformanceObserver } from 'node:perf_hooks';

export function createTickAttribution({ functions, context, visionContext, memory = () => process.memoryUsage(),
  now = () => performance.now(), profiles = true }) {
  const wrapped = { ...functions }, stringify = JSON.stringify;
  let active = false, current = null, frameDepth = 0, vision = null, session;
  const rows = [], gc = [];
  const gcObserver = new PerformanceObserver(list => {
    if (active) for (const e of list.getEntries()) gc.push({ startMs: e.startTime, durationMs: e.duration, kind: e.detail?.kind ?? null });
  });
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
  for (const name of ['roomPayload', 'deflateRawSync', 'encodeWebSocketFrame', 'captureMatchCheckpoint']) {
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
        add(vision.coverage[cell]?.has(actualSight) ? 'visionCoverageHits' : 'visionCoverageMisses');
      }
    }
    return functions.markVisionFrom.call(this, team, x, z, sight);
  };
  wrapped.runSimulationTick = function (...args) {
    if (!active) return functions.runSimulationTick.apply(this, args);
    const before = memory();
    current = { tickNumber: context().tickNumber + 1, startedMs: now(), heapBeforeBytes: before.heapUsed };
    try { return functions.runSimulationTick.apply(this, args); }
    finally { current = null; }
  };
  wrapped.recordTickDuration = function (duration, diagnostic, ...args) {
    if (current) {
      const after = memory();
      Object.assign(current, { tickNumber: diagnostic.tickNumber, endedMs: now(), durationMs: duration,
        heapAfterBytes: after.heapUsed, netHeapDeltaBytes: after.heapUsed - current.heapBeforeBytes,
        rssBytes: after.rss, externalBytes: after.external, arrayBufferBytes: after.arrayBuffers });
      rows.push(current);
      if (rows.length > 2000) rows.shift();
    }
    return functions.recordTickDuration.call(this, duration, diagnostic, ...args);
  };
  return {
    wrapped,
    async start() {
      if (active) throw new Error('Attribution already active');
      rows.length = 0; gc.length = 0;
      if (profiles) {
        session = new Session(); session.connect();
        await session.post('Profiler.enable');
        await session.post('Profiler.setSamplingInterval', { interval: 1000 });
        await session.post('Profiler.start');
        await session.post('HeapProfiler.startSampling', { samplingInterval: 65536,
          includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
      }
      gcObserver.observe({ entryTypes: ['gc'] }); active = true;
      return { tickNumber: context().tickNumber, samplingIntervalBytes: profiles ? 65536 : null };
    },
    async stop() {
      if (!active) throw new Error('Attribution is not active');
      const endTick = context().tickNumber;
      let cpuProfile = null, allocationProfile = null;
      if (session) {
        cpuProfile = (await session.post('Profiler.stop')).profile;
        allocationProfile = (await session.post('HeapProfiler.stopSampling')).profile;
        session.disconnect(); session = null;
      }
      await new Promise(resolve => setImmediate(resolve));
      active = false; gcObserver.disconnect();
      return { endTick, rows: [...rows], gc: [...gc], cpuProfile, allocationProfile,
        limits: ['inclusive function timings overlap; do not add nested timings',
          'heap deltas are net live-heap change, not allocated bytes; sampled allocation estimates include collected objects',
          'native Buffer bytes are separately counted; V8 heap sampling does not measure all external allocations',
          'wrappers, heap/CPU sampling and GC observation add overhead; use uninstrumented runs for whole-tick comparison'] };
    },
  };
}
