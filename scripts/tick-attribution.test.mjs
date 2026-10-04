import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { deflateRawSync, constants } from 'node:zlib';
import { encodeWebSocketFrame } from '../src/networking/websocket-frame.mjs';
import { attributionSource } from './tick-attribution-adapter.mjs';
import { createTickAttribution } from './tick-attribution-observer.mjs';
const source = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const body = (text, name) => {
  const start = text.indexOf(`function ${name}(`), end = text.indexOf('\nfunction ', start + 1);
  assert.ok(start >= 0 && end > start, name); return text.slice(start, end);
};
test('disposable observer keeps real gameplay, fog, payload, framing and tick bodies intact', () => {
  const adapted = attributionSource(source);
  for (const name of ['simulateTick','runSimulationTick','roomPayload','prepareJsonFrame','recordTickDuration',
    'ensureVisionMasks','updateVisionMasks','markVisionFrom','captureMatchCheckpoint','broadcastState']) {
    assert.equal(body(adapted, name), body(source, name), name);
  }
  assert.throws(() => attributionSource(source.replace("  if (url.pathname === '/health') {", '')), /Attribution seam changed/);
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
