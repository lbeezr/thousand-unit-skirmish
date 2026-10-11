import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { installInteractionAudioProbe, validateAudioObservation, interactionKeys, interactionTargetPoint } from './renderer-interaction-audio-scenario.mjs';
import { loadCaptureCases } from './renderer-feature-capture.mjs';
import { DEFAULT_GAME_AUDIO_REFERENCE } from '../src/audio-shipped-catalog.mjs';
import { UNIT_DEFINITIONS, BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';

// These are receipt-contract tests, not a native decode or listening claim.
const sourceSha256 = 'a'.repeat(64);
function output() {
  const bytes = Buffer.alloc(2048); Buffer.from('1a45dfa3', 'hex').copy(bytes);
  return { base64: bytes.toString('base64'), mimeType: 'audio/webm;codecs=opus', faults: [],
    peak: .2, rms: .02, armedAt: 0, beganAt: 0, endedAt: 3500, elapsedMs: 3500, meteredSamples: 4096,
    starts: [{ sha256: sourceSha256, time: 500, duration: 1.3 }] };
}
test('output receipt requires native media, actual signal and one matching recording start', () => {
  const valid = validateAudioObservation(output(), [sourceSha256]);
  assert.equal(valid.bytes.length, 2048); assert.equal(valid.sourceSha256, sourceSha256);
  assert.match(valid.sha256, /^[0-9a-f]{64}$/);
  for (const changed of [
    { base64: Buffer.alloc(2048).toString('base64') }, { mimeType: 'audio/mpeg' },
    { faults: ['recorder-error'] }, { peak: 0, rms: 0 }, { peak: 1 }, { rms: NaN },
    { elapsedMs: 20 }, { elapsedMs: 15000 }, { meteredSamples: 0 },
    { armedAt: 1 }, { armedAt: -30000 }, { armedAt: NaN },
    { starts: [] }, { starts: [{ sha256: 'b'.repeat(64), duration: 1 }] },
    { starts: [...output().starts, ...output().starts] },
    { starts: [{ sha256: sourceSha256, duration: 0 }] },
    ...[-100, 3000, 4000].map(time => ({ starts: [{ ...output().starts[0], time }] })),
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
test('ordinary target observation skips overlapping units and requires the exact visible building', () => {
  const center = { x: 100, y: 100 };
  const window = {
    __rtsInteractionAudioSnapshot: () => ({ workers: [{ id: 4, point: center }],
      buildings: [{ id: 10, point: center, bounds: { left: 80, right: 120, top: 60, bottom: 110 } }] }),
    __rtsInteractionAudioPick: (x, y) => y < 80 ? { kind: 'building', id: 10 } : { kind: 'unit', id: 4 },
  };
  const find = (kind, id) => runInNewContext(`(${interactionTargetPoint.toString()})(${JSON.stringify(kind)}, ${id})`, { window });
  assert.equal(find('unit', 4), center);
  const roof = find('building', 10);
  assert.ok(roof.y < 80 && roof.x > 80 && roof.x < 120);
  assert.equal(find('building', 11), null);
  window.__rtsInteractionAudioPick = () => ({ kind: 'building', id: 12 });
  assert.equal(find('building', 10), null, 'a nearby different building cannot satisfy the click');
  window.__rtsInteractionAudioPick = () => null;
  assert.equal(find('building', 10), null, 'covered or offscreen art cannot satisfy the click');
  window.__rtsInteractionAudioSnapshot = () => ({ units: [{ id: 7, kind: 'archer', point: center }], workers: [], buildings: [] });
  window.__rtsInteractionAudioPick = () => ({ kind: 'unit', id: 7 });
  assert.equal(find('unit', 7), center, 'the roster observer supports non-Worker units');
});

test('gated audio observation covers the owned roster with bounded read-only projection', async () => {
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  const begin = main.indexOf('if (window.__rtsCaptureDiagnostics === true) {');
  const end = main.indexOf('  window.__rtsBrowserRecoverySnapshot =', begin);
  assert.ok(begin > 0 && end > begin);
  const code = main.slice(begin, end) + '}';
  const kinds = Object.keys(UNIT_DEFINITIONS), types = Object.keys(BUILDING_DEFINITIONS);
  const units = Array.from({ length: 160 }, (_, id) => ({ id, team: 0, hp: 10,
    kind: kinds[id % kinds.length], renderX: 0, renderZ: 0 }));
  units.unshift({ id: 200, team: 1, hp: 10, kind: 'worker' }, { id: 201, team: 0, hp: 0, kind: 'worker' });
  const latestBuildings = Array.from({ length: 80 }, (_, id) => ({ id, type: types[id % types.length], team: 0, hp: 10, x: 0, z: 0, complete: true }));
  latestBuildings.unshift({ id: 200, team: 1, hp: 10 }, { id: 201, team: 0, hp: 0 });
  const selected = new Set([1]), before = JSON.stringify({ units, latestBuildings, selected: [...selected] });
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
  let covered = false;
  const globals = { window: { __rtsCaptureDiagnostics: true }, localTeam: 0, units, latestBuildings, selected,
    selectedBuildingId: 1, buildingVisuals: new Map(), camera: {}, groundHeight: () => 0,
    mapDefinition: { id: 'audio-roster-fixture' }, renderer: { domElement: canvas }, performance: { now: () => 123 },
    audio: { getStatus: () => 'running', getInspector: () => ({}), getSettings: () => ({ enabled: true }) },
    document: { elementFromPoint: () => covered ? null : canvas },
    THREE: { Vector3: class { constructor(x, y, z) { Object.assign(this, { x, y, z }); }
      project() { return { x: this.x / 100, y: this.y / 100, z: this.z / 100 }; } } },
  };
  runInNewContext(code, globals);
  const snapshot = globals.window.__rtsInteractionAudioSnapshot();
  assert.equal(snapshot.units.length, 128); assert.equal(snapshot.buildings.length, 64); assert.equal(snapshot.workers.length, 4);
  assert.deepEqual([...new Set(snapshot.units.map(u => u.kind))].sort(), kinds.sort());
  assert.deepEqual([...new Set(snapshot.buildings.map(b => b.type))].sort(), types.sort());
  assert.ok(!snapshot.units.some(u => u.id >= 200) && !snapshot.buildings.some(b => b.id >= 200));
  assert.equal(snapshot.units.find(u => u.id === 1).selected, true);
  assert.equal(snapshot.buildings.find(b => b.id === 1).selected, true);
  const project = globals.window.__rtsInteractionAudioProject;
  assert.ok(project(0, 0)); assert.equal(project(NaN, 0), null); assert.equal(project(0, Infinity), null);
  assert.equal(project(0, 0, Infinity), null); assert.equal(project(0, 200), null);
  covered = true; assert.equal(project(0, 0), null);
  assert.equal(JSON.stringify({ units, latestBuildings, selected: [...selected] }), before);
  const disabled = { window: {} }; runInNewContext(code, disabled);
  assert.deepEqual(Object.keys(disabled.window), [], 'normal clients expose none of the audit observations');
});
function probeFixture({ delayedStop = false, recorderStartFails = false, dataBytes = 2048 } = {}) {
  const connections = [], starts = [], events = [], timers = new Map(), stopped = [];
  let now = 1000, nextTimer = 1, nativeBuffer;
  const schedule = (fn, delay, repeat = false) => {
    const id = nextTimer++; timers.set(id, { fn, at: now + delay, repeat: repeat ? delay : null }); return id;
  };
  const advance = milliseconds => {
    const until = now + milliseconds;
    for (;;) {
      const due = [...timers].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      const [id, timer] = due; now = timer.at;
      if (timer.repeat) timer.at += timer.repeat; else timers.delete(id);
      timer.fn();
    }
    now = until;
  };
  class NativeNode {
    constructor(context) { this.context = context; }
    connect(destination) { connections.push([this, destination]); return destination; }
  }
  class NativeSource extends NativeNode {
    start(...args) { starts.push(args); events.push('native-start'); return 'native-result'; }
  }
  class NativeContext {
    destination = {};
    get currentTime() { return now / 1000; }
    decodeAudioData() { nativeBuffer = { duration: 1.3 }; return Promise.resolve(nativeBuffer); }
    createMediaStreamDestination() { return { stream: {} }; }
    createAnalyser() { return { getFloatTimeDomainData(data) { data.fill(.1); } }; }
  }
  class Recorder {
    mimeType = 'audio/webm;codecs=opus';
    start() { events.push('recorder-start'); if (recorderStartFails) throw Error('private recorder error'); }
    stop() {
      events.push('recorder-stop');
      const complete = () => {
        const bytes = Buffer.alloc(dataBytes); Buffer.from('1a45dfa3', 'hex').copy(bytes);
        this.ondataavailable({ data: new Blob([bytes]) }); this.onstop();
      };
      if (delayedStop) stopped.push(complete); else complete();
    }
  }
  const window = {};
  runInNewContext(`(${installInteractionAudioProbe.toString()})()`, { window,
    BaseAudioContext: NativeContext, AudioNode: NativeNode, AudioBufferSourceNode: NativeSource,
    MediaRecorder: Recorder, crypto: webcrypto, Blob, Float32Array, Uint8Array,
    performance: { now: () => now }, btoa: text => Buffer.from(text, 'binary').toString('base64'),
    setInterval: (fn, delay) => schedule(fn, delay, true), clearInterval: id => timers.delete(id),
    setTimeout: (fn, delay) => schedule(fn, delay), clearTimeout: id => timers.delete(id),
  });
  const context = new NativeContext(), master = new NativeNode(context);
  assert.equal(master.connect(context.destination), context.destination);
  assert.equal(connections.length, 3);
  assert.equal(connections[0][1], context.destination, 'original speaker output must remain connected');
  assert.ok(connections.every(([node]) => node === master), 'tap must observe the existing master');
  return { probe: window.__rtsInteractionAudio, context, events, starts, timers, advance,
    skipTimers: milliseconds => { now += milliseconds; }, flushStop: () => stopped.splice(0).forEach(fn => fn()),
    async source(bytes = [1, 2, 3]) {
      const original = Uint8Array.from(bytes).buffer, source = new NativeSource(context);
      source.buffer = await context.decodeAudioData(original);
      assert.equal(source.buffer, nativeBuffer, 'native decoded buffer must stay unchanged');
      return { source, hash: createHash('sha256').update(new Uint8Array(original)).digest('hex') };
    },
    async finish() { return JSON.parse(JSON.stringify(await window.__rtsInteractionAudio.finish())); },
  };
}

test('arming waits for delayed matching playback and preserves native call, return and speaker output', async () => {
  const f = probeFixture(), expected = await f.source(), unrelated = await f.source([4, 5, 6]);
  f.probe.begin([expected.hash]);
  assert.deepEqual(f.events, [], 'arming must not start a recorder or native audio');
  f.advance(6000); unrelated.source.start(f.context.currentTime, 0, 1.3);
  assert.deepEqual(f.events, ['native-start'], 'other source hashes must not trigger the recorder');
  const when = f.context.currentTime;
  assert.equal(expected.source.start(when, 0, 1.3), 'native-result');
  assert.deepEqual(f.events, ['native-start', 'recorder-start', 'native-start']);
  f.advance(3500);
  const result = await f.finish();
  assert.equal(result.armedAt, 1000); assert.equal(result.beganAt, 7000); assert.equal(result.endedAt, 10500);
  assert.equal(validateAudioObservation(result, [expected.hash]).sourceSha256, expected.hash);
  assert.deepEqual(f.starts, [[when, 0, 1.3], [when, 0, 1.3]], 'every native call keeps its original arguments');
  assert.equal(f.probe.recording, null); assert.equal(f.timers.size, 0);
});

test('future scheduled playback is measured at its AudioContext time and must fit the capture window', async () => {
  for (const delay of [1, 3, 5]) {
    const f = probeFixture(), expected = await f.source();
    f.probe.begin([expected.hash]);
    const when = f.context.currentTime + delay;
    expected.source.start(when, 0, 1.3); f.advance(3500);
    const result = await f.finish();
    assert.deepEqual(f.starts, [[when, 0, 1.3]], 'future scheduling must stay untouched');
    if (delay === 1) {
      assert.equal(result.starts[0].time, result.beganAt + 1000);
      validateAudioObservation(result, [expected.hash]);
    } else assert.throws(() => validateAudioObservation(result, [expected.hash]));
    if (delay === 5) assert.equal(result.starts.length, 0, 'playback beyond the window cannot satisfy the receipt');
    assert.equal(f.timers.size, 0);
  }
});

test('starts after stop cannot enter a receipt while the recorder completion event is delayed', async () => {
  const f = probeFixture({ delayedStop: true }), expected = await f.source();
  f.probe.begin([expected.hash]); expected.source.start(f.context.currentTime, 0, 1.3);
  f.advance(3500);
  assert.equal(f.timers.size, 0, 'metering ends with recording, before the onstop event');
  f.advance(2000); expected.source.start(f.context.currentTime, 0, 1.3); f.flushStop();
  const result = await f.finish();
  assert.equal(result.starts.length, 1); assert.equal(result.elapsedMs, 3500);
  validateAudioObservation(result, [expected.hash]);
});

test('arming expires after 30 seconds even when a late native call beats a delayed timer', async () => {
  for (const delayedTimer of [false, true]) {
    const f = probeFixture(), expected = await f.source();
    f.probe.begin([expected.hash]);
    if (delayedTimer) {
      f.skipTimers(31000);
      assert.equal(expected.source.start(f.context.currentTime, 0, 1.3), 'native-result');
    } else f.advance(30000);
    const result = await f.finish();
    assert.deepEqual(result.faults, ['recording-arm-timeout']);
    assert.equal(result.beganAt, null); assert.deepEqual(result.starts, []);
    assert.ok(!f.events.includes('recorder-start')); assert.equal(f.timers.size, 0);
    assert.throws(() => validateAudioObservation(result, [expected.hash]));
  }
});

test('capture start failure preserves native playback and oversized output remains a failed bounded receipt', async () => {
  for (const options of [{ recorderStartFails: true }, { dataBytes: 750000 }]) {
    const f = probeFixture(options), expected = await f.source();
    f.probe.begin([expected.hash]);
    assert.equal(expected.source.start(f.context.currentTime, 0, 1.3), 'native-result');
    f.advance(3500);
    const result = await f.finish();
    assert.deepEqual(result.faults, [options.recorderStartFails ? 'recorder-start-error' : 'recorder-data-limit']);
    assert.ok(result.base64.length < 1000000); assert.equal(f.timers.size, 0);
    assert.throws(() => validateAudioObservation(result, [expected.hash]));
  }
});
