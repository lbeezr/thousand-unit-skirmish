import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { installInteractionAudioProbe, validateAudioObservation, interactionKeys } from './renderer-interaction-audio-scenario.mjs';
import { loadCaptureCases } from './renderer-feature-capture.mjs';
import { DEFAULT_GAME_AUDIO_REFERENCE } from '../src/audio-shipped-catalog.mjs';

// These are receipt-contract tests, not a native decode or listening claim.
const sourceSha256 = 'a'.repeat(64);
function output() {
  const bytes = Buffer.alloc(2048); Buffer.from('1a45dfa3', 'hex').copy(bytes);
  return { base64: bytes.toString('base64'), mimeType: 'audio/webm;codecs=opus', faults: [],
    peak: .2, rms: .02, elapsedMs: 3500, meteredSamples: 4096,
    starts: [{ sha256: sourceSha256, duration: 1.3 }] };
}
test('output receipt requires native media, actual signal and one matching recording start', () => {
  const valid = validateAudioObservation(output(), [sourceSha256]);
  assert.equal(valid.bytes.length, 2048); assert.equal(valid.sourceSha256, sourceSha256);
  assert.match(valid.sha256, /^[0-9a-f]{64}$/);
  for (const changed of [
    { base64: Buffer.alloc(2048).toString('base64') }, { mimeType: 'audio/mpeg' },
    { faults: ['recorder-error'] }, { peak: 0, rms: 0 }, { peak: 1 }, { rms: NaN },
    { elapsedMs: 20 }, { elapsedMs: 15000 }, { meteredSamples: 0 },
    { starts: [] }, { starts: [{ sha256: 'b'.repeat(64), duration: 1 }] },
    { starts: [...output().starts, ...output().starts] },
    { starts: [{ sha256: sourceSha256, duration: 0 }] },
  ]) assert.throws(() => validateAudioObservation({ ...output(), ...changed }, [sourceSha256]));
});
test('ordinary audio adapter is registered without executing browser or provider work on import', async () => {
  const loaded = await loadCaptureCases('interaction-audio');
  assert.deepEqual(loaded.issues, []); assert.equal(loaded.adapters[0].id, 'interaction-audio');
  const ref = DEFAULT_GAME_AUDIO_REFERENCE;
  const manifest = JSON.parse(await readFile(new URL(`../assets/audio/runtime/${ref.packId}/${ref.version}/manifest.json`, import.meta.url)));
  const bindings = manifest.pack.profiles.find(p => p.id === 'interactions').bindings;
  for (const key of interactionKeys) assert.ok(bindings[key]?.variants.every(v => manifest.downloads[v.sourceId]));
});
test('page probe preserves native decoding, start and speaker connection while recording a parallel output', async () => {
  const connections = [], starts = [], intervals = [], timers = [];
  let now = 1000, nativeBuffer;
  class NativeNode {
    constructor(context) { this.context = context; }
    connect(destination) { connections.push([this, destination]); return destination; }
  }
  class NativeSource extends NativeNode { start(...args) { starts.push(args); } }
  class NativeContext {
    destination = {};
    decodeAudioData() { nativeBuffer = { duration: 1.3 }; return Promise.resolve(nativeBuffer); }
    createMediaStreamDestination() { return { stream: {} }; }
    createAnalyser() { return { getFloatTimeDomainData(data) { data.fill(.1); } }; }
  }
  class Recorder {
    mimeType = 'audio/webm;codecs=opus';
    start() {}
    stop() { this.ondataavailable({ data: new Blob([Buffer.from(output().base64, 'base64')]) }); this.onstop(); }
  }
  const window = {};
  runInNewContext(`(${installInteractionAudioProbe.toString()})()`, { window,
    BaseAudioContext: NativeContext, AudioNode: NativeNode, AudioBufferSourceNode: NativeSource,
    MediaRecorder: Recorder, crypto: webcrypto, Blob, Float32Array, Uint8Array,
    performance: { now: () => now }, btoa: text => Buffer.from(text, 'binary').toString('base64'),
    setInterval: fn => { intervals.push(fn); return 1; }, clearInterval() {}, setTimeout: fn => timers.push(fn),
  });
  const context = new NativeContext(), master = new NativeNode(context), source = new NativeSource(context);
  assert.equal(master.connect(context.destination), context.destination);
  assert.equal(connections.length, 3);
  assert.equal(connections[0][1], context.destination, 'original speaker output must remain connected');
  assert.ok(connections.every(([node]) => node === master), 'tap must observe the existing master');
  const original = Uint8Array.of(1, 2, 3).buffer;
  source.buffer = await context.decodeAudioData(original);
  assert.equal(source.buffer, nativeBuffer, 'native decoded buffer must stay unchanged');
  const probe = window.__rtsInteractionAudio;
  probe.begin(); source.start(10, 0, 1.3); intervals[0](); now += 3500; timers[0]();
  const result = await probe.finish();
  assert.deepEqual(starts, [[10, 0, 1.3]], 'native start must run exactly once with original timing');
  const expected = createHash('sha256').update(new Uint8Array(original)).digest('hex');
  const verified = validateAudioObservation(JSON.parse(JSON.stringify(result)), [expected]);
  assert.equal(verified.sourceSha256, expected); assert.equal(probe.recording, null);
});
