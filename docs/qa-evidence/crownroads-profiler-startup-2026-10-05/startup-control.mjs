// Executed source-control receipt; no game server, inspector or timing benchmark.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { createTickAttribution } = await import(pathToFileURL(process.argv[2]));
const functions = { roomPayload() {}, deflateRawSync() {}, encodeWebSocketFrame() {}, prepareJsonFrame() {},
  ensureVisionMasks() {}, updateVisionMasks() {}, markVisionFrom() {}, captureMatchCheckpoint() {},
  recordTickDuration() {}, runSimulationTick() {} };
const observer = createTickAttribution({ functions, context: () => ({ tickNumber: 3 }), visionContext: () => ({}), profiles: false, now: () => 0 });
const start = await observer.start(), report = await observer.stop();
assert.ok(start.startupWindow, 'Observer-only startup must retain its request/completion window');
assert.deepEqual(start.startupWindow, { startRequest: { tickNumber: 3, monotonicMs: 0 }, startCompletion: { tickNumber: 3, monotonicMs: 0 } });
assert.equal(report.profiles, false); assert.deepEqual(report.profileWindows, {});
assert.equal(report.cpuProfile, null); assert.equal(report.allocationProfile, null);
assert.equal(report.droppedStartupRows, 0);
console.log('PASS: observer-only startup boundaries retained; CPU/allocation profiles absent.');
