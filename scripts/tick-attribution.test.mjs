import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { deflateRawSync, constants } from 'node:zlib';
import { encodeWebSocketFrame } from '../src/networking/websocket-frame.mjs';
import { attributionSource } from './tick-attribution-adapter.mjs';
import { createTickAttribution } from './tick-attribution-observer.mjs';
import { VisionCoverageCache } from '../src/server/vision-coverage-cache.mjs';
const source = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const body = (text, name) => {
  const start = text.indexOf(`function ${name}(`), end = text.indexOf('\nfunction ', start + 1);
  assert.ok(start >= 0 && end > start, name); return text.slice(start, end);
};
test('disposable observer keeps real gameplay, fog, payload, framing and tick bodies intact', () => {
  const adapted = attributionSource(source, { simulation: true });
  for (const name of ['simulateTick','runSimulationTick','roomPayload','prepareJsonFrame','recordTickDuration',
    'ensureVisionMasks','updateVisionMasks','markVisionFrom','captureMatchCheckpoint','broadcastState',
    'rebuildSpatialBuckets','getMoveVector','spreadInteractingUnits']) {
    assert.equal(body(adapted, name), body(source, name), name);
  }
  assert.throws(() => attributionSource(source.replace("  if (url.pathname === '/health') {", '')), /Attribution seam changed/);
});

test('inner function wrappers preserve receiver, result and thrown errors while retaining tick identity', async () => {
  let observer, clock = 0;
  const failure = new Error('production failure'), receiver = { marker: 7 };
  const functions = { roomPayload() {}, deflateRawSync() {}, encodeWebSocketFrame() {}, prepareJsonFrame() {},
    updateVisionMasks() {}, markVisionFrom() {}, captureMatchCheckpoint() {}, ensureVisionMasks() {}, recordTickDuration() {},
    simulateTick() {
      assert.equal(observer.wrapped.getMoveVector.call(receiver, 3), 10);
      assert.throws(() => observer.wrapped.spreadInteractingUnits(), error => error === failure);
    },
    getMoveVector(value) { return this.marker + value; }, spreadInteractingUnits() { throw failure; },
    runSimulationTick() {
      observer.wrapped.simulateTick();
      observer.wrapped.recordTickDuration(10, { tickNumber: 1, matchId: 'match-a', mapId: 'crownroads', budgetMs: 1000 / 30,
        overBudget: false, cpuMs: 5, simulationMs: 8, visionMs: 1, scenarioMs: 0, broadcastMs: 1, checkpointMs: 0 });
    } };
  observer = createTickAttribution({ functions, context: () => ({ tickNumber: 0 }), visionContext: () => ({}), profiles: false,
    now: () => ++clock });
  assert.equal(observer.wrapped.getMoveVector.call(receiver, 3), 10, 'inactive wrapper preserves behavior');
  await observer.start(); observer.wrapped.runSimulationTick(); const report = await observer.stop();
  const row = report.rows[0];
  assert.equal(row.matchId, 'match-a'); assert.equal(row.mapId, 'crownroads'); assert.equal(row.budgetMs, 1000 / 30);
  for (const name of ['simulateTick', 'getMoveVector', 'spreadInteractingUnits']) {
    assert.equal(row[`${name}Calls`], 1); assert.ok(row[`${name}Ms`] > 0);
  }
  assert.equal(report.droppedRows, 0);
});

test('bounded observer reports expired rows rather than implying complete capture', async () => {
  let observer, tick = 0;
  const functions = { roomPayload() {}, deflateRawSync() {}, encodeWebSocketFrame() {}, prepareJsonFrame() {},
    updateVisionMasks() {}, markVisionFrom() {}, captureMatchCheckpoint() {}, ensureVisionMasks() {}, recordTickDuration() {},
    runSimulationTick() { observer.wrapped.recordTickDuration(1, { tickNumber: ++tick }); } };
  observer = createTickAttribution({ functions, context: () => ({ tickNumber: tick }), visionContext: () => ({}), profiles: false });
  await observer.start(); for (let i = 0; i < 2001; i++) observer.wrapped.runSimulationTick();
  const report = await observer.stop();
  assert.equal(report.droppedRows, 1); assert.equal(report.rows.length, 2000); assert.equal(report.rows[0].tickNumber, 2);
  await observer.start(); observer.wrapped.runSimulationTick();
  assert.equal((await observer.stop()).droppedRows, 0, 'drop count resets for the next window');
});
for (const compressed of [false, true]) test(`observed production framing preserves exact ${compressed ? 'compressed' : 'plain'} private wire bytes`, async () => {
  const payload = { type: 'state', units: Array.from({length: 250}, (_, i) => [i, i % 2, i / 10, -i / 20, 100, 'worker']),
    fog: 'private-view', ownerOnly: { queue: ['infantry'], food: 150 }, label: '↖ 食' };
  const context = vm.createContext({ Buffer, JSON, deflateRawSync, encodeWebSocketFrame,
    MIN_COMPRESS_FRAME_BYTES: 512, PERMESSAGE_DEFLATE_TRAILER: Buffer.from([0,0,255,255]), zlibConstants: constants });
  vm.runInContext(body(source, 'prepareJsonFrame'), context);
  const plain = context.prepareJsonFrame(payload, compressed);
  let observedFrame, observer, clock = 0;
  const functions = { roomPayload: () => payload, prepareJsonFrame: context.prepareJsonFrame,
    deflateRawSync, encodeWebSocketFrame, ensureVisionMasks() {}, updateVisionMasks() {}, markVisionFrom() {},
    captureMatchCheckpoint() {}, recordTickDuration() {},
    runSimulationTick() {
      observedFrame = observer.wrapped.prepareJsonFrame(observer.wrapped.roomPayload(0), compressed);
      observer.wrapped.recordTickDuration(3, { tickNumber: 1 });
    } };
  observer = createTickAttribution({ functions, context: () => ({ tickNumber: 0 }), visionContext: () => ({}),
    profiles: false, now: () => ++clock, memory: () => ({ heapUsed: 50, rss: 100, external: 20, arrayBuffers: 10 }) });
  context.deflateRawSync = observer.wrapped.deflateRawSync; context.encodeWebSocketFrame = observer.wrapped.encodeWebSocketFrame;
  context.JSON = { stringify: observer.wrapped.stringify };
  await observer.start(); observer.wrapped.runSimulationTick(); const report = await observer.stop();
  assert.deepEqual(observedFrame, plain); assert.equal(observedFrame.rtsCompressed, plain.rtsCompressed);
  assert.equal(observedFrame.rtsPayloadBytes, plain.rtsPayloadBytes);
  assert.equal(report.rows.length, 1); const row = report.rows[0];
  assert.equal(row.statePayloadBytes, plain.rtsPayloadBytes); assert.equal(row.stateWireBytes, plain.length);
  assert.equal(row.stateFrames, 1); assert.equal(row.stateUnitRows, 250);
  assert.equal(row.frameStringifyCalls, 1); assert.equal(row.encodeWebSocketFrameCalls, 1);
  assert.equal(row.deflateRawSyncCalls ?? 0, compressed ? 1 : 0);
  assert.equal(row.netHeapDeltaBytes, 0);
  assert.deepEqual(payload.ownerOnly, { queue: ['infantry'], food: 150 });
});
test('vision observer distinguishes current masks, tick invalidation and geometry invalidation without changing context', async () => {
  let observer; const cache = [], context = { tickNumber: 1, visionTick: 1, coverage: cache, visionCoverage: cache };
  const functions = { roomPayload() {}, deflateRawSync() {}, encodeWebSocketFrame() {}, prepareJsonFrame() {},
    updateVisionMasks() {}, markVisionFrom() {}, captureMatchCheckpoint() {}, ensureVisionMasks() {}, recordTickDuration() {},
    runSimulationTick() {
      observer.wrapped.ensureVisionMasks(); context.visionTick = -1; observer.wrapped.ensureVisionMasks();
      context.visionTick = 1; context.coverage = []; observer.wrapped.ensureVisionMasks();
      observer.wrapped.recordTickDuration(1, { tickNumber: 1 });
    } };
  observer = createTickAttribution({ functions, context: () => context, visionContext: () => ({}), profiles: false });
  await observer.start(); observer.wrapped.runSimulationTick(); const { rows } = await observer.stop();
  assert.equal(rows[0].ensureVisionHits, 1); assert.equal(rows[0].ensureVisionMisses, 2);
  assert.equal(rows[0].tickInvalidationMisses, 1); assert.equal(rows[0].coverageInvalidationMisses, 1);
  assert.equal(context.visionTick, 1); assert.equal(context.visionCoverage, cache);
});
test('stop freezes row capture before asynchronous shutdown can serve another simulation tick', async () => {
  let observer, tickNumber = 0;
  const functions = { roomPayload() {}, deflateRawSync() {}, encodeWebSocketFrame() {}, prepareJsonFrame() {},
    updateVisionMasks() {}, markVisionFrom() {}, captureMatchCheckpoint() {}, ensureVisionMasks() {}, recordTickDuration() {},
    runSimulationTick() { tickNumber++; observer.wrapped.recordTickDuration(1, { tickNumber }); } };
  observer = createTickAttribution({ functions, context: () => ({ tickNumber }), visionContext: () => ({}), profiles: false });
  await observer.start(); observer.wrapped.runSimulationTick();
  setImmediate(() => observer.wrapped.runSimulationTick());
  const report = await observer.stop();
  assert.equal(tickNumber, 2, 'queued tick really ran while stop awaited its notification drain');
  assert.equal(report.endTick, 1); assert.equal(report.rowWindow.end.tickNumber, 1);
  assert.deepEqual(report.rows.map(row => row.tickNumber), [1]);
  assert.ok(report.rowWindow.end.monotonicMs >= report.rowWindow.start.monotonicMs);
  assert.deepEqual(report.profileWindows, {});
});

test('vision instrumentation observes bounded cache without promoting entries or changing gameplay counters', async () => {
  const coverage = new VisionCoverageCache({ width: 16, height: 16, maxEntries: 2 });
  coverage.set(0, 8, { visible: [0], fringe: [1] });
  coverage.set(1, 8, { visible: [1], fringe: [] });
  let observer;
  const processed = [new Uint8Array(256), new Uint8Array(256)];
  const functions = { roomPayload() {}, deflateRawSync() {}, encodeWebSocketFrame() {}, prepareJsonFrame() {},
    updateVisionMasks() {}, ensureVisionMasks() {}, captureMatchCheckpoint() {}, recordTickDuration() {},
    markVisionFrom() {},
    runSimulationTick() {
      observer.wrapped.updateVisionMasks();
      observer.wrapped.recordTickDuration(1, { tickNumber: 1 });
    } };
  functions.updateVisionMasks = () => {
    observer.wrapped.markVisionFrom(0, .5, .5, 8); // source 0, cached
    observer.wrapped.markVisionFrom(1, 2.5, .5, 8); // source 2, missing
    processed[0][0] = 8;
    observer.wrapped.markVisionFrom(0, .5, .5, 8); // processed duplicate
  };
  observer = createTickAttribution({ functions,
    context: () => ({ tickNumber: 0, cacheMetrics: coverage.metrics() }),
    visionContext: () => ({ coverage, processed, width: 16, halfX: 0, halfZ: 0, defaultSight: 8 }), profiles: false });
  const before = coverage.metrics();
  await observer.start(); observer.wrapped.runSimulationTick(); const report = await observer.stop();
  const row = report.rows[0];
  assert.equal(row.visionCoverageHits, 1); assert.equal(row.visionCoverageMisses, 1);
  assert.equal(row.visionDuplicateSources, 1);
  assert.deepEqual(row.visionCacheBefore, before); assert.deepEqual(row.visionCacheAfter, before);
  assert.deepEqual(coverage.metrics(), before, 'observer changes no cache counters');
  coverage.set(2, 8, { visible: [], fringe: [] });
  assert.equal(coverage.has(0, 8), false, 'observer hit does not alter LRU ordering');
});

test('startup captures queued production clocks before active rows and observer-only excludes all profiler commands', async () => {
  for (const profiles of [true, false]) {
    let observer, clock = 0, tickNumber = 0, tickStartedMs = null;
    const posts = [], functions = { roomPayload() {}, deflateRawSync() {}, encodeWebSocketFrame() {}, prepareJsonFrame() {},
      updateVisionMasks() {}, markVisionFrom() {}, captureMatchCheckpoint() {}, ensureVisionMasks() {}, recordTickDuration() {},
      runSimulationTick() {
        tickStartedMs = clock += 50; tickNumber++;
        observer.wrapped.recordTickDuration(5, { tickNumber, matchId: 'match-a', mapId: 'crownroads', budgetMs: 1000 / 30, overBudget: false });
      } };
    observer = createTickAttribution({ functions, context: () => ({ tickNumber, tickStartedMs }), visionContext: () => ({}),
      profiles, now: () => clock, createSession: () => ({ connect() {}, disconnect() {}, async post(name) {
        posts.push(name);
        if (name === 'Profiler.start') await new Promise(resolve => setImmediate(() => { observer.wrapped.runSimulationTick(); resolve(); }));
        return { profile: { samples: [] } };
      } }) });
    const start = await observer.start(); observer.wrapped.runSimulationTick(); const report = await observer.stop();
    assert.equal(start.profiles, profiles); assert.equal(report.profiles, profiles); assert.equal(report.droppedStartupRows, 0);
    assert.equal(report.startupRows.length, profiles ? 1 : 0); assert.equal(report.rows.length, 1);
    assert.equal(report.startupWindow.startRequest.monotonicMs, 0);
    assert.equal(report.startupWindow.startCompletion.monotonicMs, profiles ? 50 : 0);
    if (profiles) { assert.equal(report.rows[0].previousTickStartedMs, 50); assert.equal(report.rows[0].tickStartedMs, 100);
      assert.equal(report.rows[0].startLagMs, 50 - 1000 / 30); }
    else { assert.deepEqual(posts, []); assert.equal(report.cpuProfile, null); assert.equal(report.allocationProfile, null); }
  }
});
