import assert from 'node:assert/strict';
import { createGameAudio } from '../src/audio.mjs';

const previousContext = globalThis.AudioContext;
const scheduled = [];
let stopped = 0;
const parameter = () => ({ value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
const node = () => ({ connect() {}, disconnect() {}, start(...args) { scheduled.push(args); }, stop() { stopped++; this.onended?.(); } });
class FakeContext {
  state = 'running';
  currentTime = 10;
  sampleRate = 100;
  destination = node();
  createGain() { return { ...node(), gain: parameter() }; }
  createBiquadFilter() { return { ...node(), frequency: parameter(), Q: parameter() }; }
  createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; }
  createBufferSource() { return { ...node(), onended: null, buffer: null }; }
  createOscillator() { return { ...node(), frequency: parameter() }; }
  async decodeAudioData(bytes) {
    if (new Uint8Array(bytes)[0] === 255) throw new Error('Unsupported codec');
    return { duration: 1, length: 100, numberOfChannels: 1 };
  }
  close() { return Promise.resolve(); }
  async suspend() { this.state = 'suspended'; }
  async resume() { this.state = 'running'; }
}
const doc = { hidden: false, addEventListener() {}, removeEventListener() {} };
const captions = [];
const cues = [];
const statuses = [];
const pack = { id: 'fixture', name: 'Fixture', compositions: [], profiles: [{ id: 'field', bindings: {
  'unit.worker.select': { bus: 'voice', variants: [{ sourceId: 'ready', caption: 'Ready worker' }] },
  'unit.worker.gather.wood': { bus: 'voice', variants: [{ sourceId: 'wood' }] },
  'unit.worker.gather.food': { bus: 'voice', variants: [{ sourceId: 'food' }] },
  'cue.base-alert': { bus: 'voice', variants: [{ sourceId: 'danger' }] },
}, music: {} }] };
const blobs = { ready: new Blob([Uint8Array.of(1)]), wood: new Blob([Uint8Array.of(2)]), food: new Blob([Uint8Array.of(3)]), danger: new Blob([Uint8Array.of(4)]) };
const library = { async loadPack() { return { pack, sourceBlobs: blobs }; } };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
globalThis.AudioContext = FakeContext;
try {
  let workClock = 10000;
  const audio = createGameAudio({ doc, workNow: () => workClock, onProfileCaption: (value) => captions.push(value),
    onCue: (value) => cues.push(value), onPackStatus: (value) => statuses.push(value) });
  audio.unlock();
  await audio.setMapAudio({ packId: 'fixture', profileId: 'field' }, library);
  const before = scheduled.length;
  assert.equal(audio.playEvent({ cue: 'select', kind: 'worker' }), true);
  await tick();
  assert.equal(scheduled.length, before + 1);
  assert.deepEqual(captions, ['Ready worker']);
  assert.deepEqual(cues, ['select']);
  const beforeUrgent = stopped;
  assert.equal(audio.playEvent({ cue: 'base-alert' }), true);
  await tick();
  assert.ok(stopped > beforeUrgent, 'urgent speech interrupts the prior voice');
  assert.equal(cues.at(-1), 'base-alert');
  await audio.setMapAudio({ packId: 'missing', profileId: 'field' }, { async loadPack() { return null; } });
  assert.match(audio.getPackStatus(), /missing/i);
  assert.equal(audio.playEvent({ cue: 'select', kind: 'worker' }), true, 'missing pack uses synthesis');
  assert.equal(cues.at(-1), 'select');
  blobs.ready = new Blob([Uint8Array.of(255)]);
  await audio.setMapAudio({ packId: 'fixture', profileId: 'field' }, library);
  audio.playEvent({ cue: 'select', kind: 'worker' });
  await tick();
  assert.match(statuses.at(-1), /could not decode/);
  assert.equal(cues.at(-1), 'select', 'decode failure uses synthesis');
  pack.profiles[0].bindings['unit.worker.work.wood'] = { bus: 'effects', cooldownMs: 0, variants: [{ sourceId: 'wood' }] };
  pack.profiles[0].bindings['unit.worker.work.food'] = { bus: 'effects', cooldownMs: 0, variants: [{ sourceId: 'food' }] };
  pack.profiles[0].bindings['unit.worker.work.repair'] = { bus: 'effects', cooldownMs: 0, variants: [{ sourceId: 'danger' }] };
  await audio.setMapAudio({ packId: 'fixture', profileId: 'field' }, library);
  const work = ['wood', 'food', 'repair'].map(resource => ({ cue: 'work', kind: 'worker', resource }));
  audio.updateWork(work); await tick();
  assert.equal(audio.getInspector().activeWork, 3);
  const workStops = stopped;
  audio.updateWork([]);
  assert.equal(stopped, workStops + 3, 'task changes stop all aggregate samples');
  assert.equal(audio.getInspector().activeWork, 0);
  const beforeRapidWork = scheduled.length;
  for (let i = 0; i < 100; i++) { audio.updateWork(work); audio.updateWork([]); }
  await tick();
  assert.equal(scheduled.length, beforeRapidWork, 'rapid task changes cannot bypass the aggregate rate limit');
  workClock += 2000;
  audio.updateWork(work); audio.stopWork(); await tick();
  assert.equal(audio.getInspector().activeWork, 0, 'pending decoding cannot resurrect work after reset/disconnect');
  audio.setSettings({ effectsLevel: 0 });
  const mutedStarts = scheduled.length;
  audio.updateWork(work); await tick();
  assert.equal(scheduled.length, mutedStarts, 'muted work bus stays silent');
  audio.setSettings({ effectsLevel: 1 }); audio.updateWork(work); await tick();
  await audio.setMapAudio(null);
  assert.equal(audio.getInspector().activeWork, 0, 'pack changes stop work');
  assert.equal(audio.play('unknown'), false);
  audio.dispose();

  // Reuse synthetic fixture bytes: distinct resource keys establish scheduling,
  // not distinct Stone material or native listening acceptance.
  const fourPack = structuredClone(pack);
  fourPack.profiles[0].bindings['unit.worker.work.stone'] = {
    bus: 'effects', cooldownMs: 0, variants: [{ sourceId: 'wood' }],
  };
  const fourLibrary = { async loadPack() { return { pack: fourPack, sourceBlobs: blobs }; } };
  let visibilityChanged;
  const fourDoc = { hidden: false,
    addEventListener(name, callback) { if (name === 'visibilitychange') visibilityChanged = callback; },
    removeEventListener() {} };
  let fourClock = 50000;
  const fourAudio = createGameAudio({ storage: null, doc: fourDoc, workNow: () => fourClock });
  const allWork = ['food', 'repair', 'stone', 'wood'].map(resource => ({ cue: 'work', kind: 'worker', resource }));
  const scheduledWork = () => fourAudio.getInspector().decisions.filter(decision => decision.outcome === 'sample scheduled');
  try {
    fourAudio.unlock();
    await fourAudio.setMapAudio({ packId: 'fixture', profileId: 'field' }, fourLibrary);
    const firstStarts = scheduled.length;
    fourAudio.updateWork(allWork); await tick();
    assert.equal(scheduled.length, firstStarts + 4);
    assert.equal(fourAudio.getInspector().activeWork, 4);
    assert.deepEqual(scheduledWork(), allWork.map(({ resource }) => ({
      cue: 'work', resource, key: `unit.worker.work.${resource}`, outcome: 'sample scheduled',
    })), 'every resource schedules through its binding, including Wood after Stone');
    const firstStops = stopped;
    fourAudio.updateWork([]);
    assert.equal(stopped, firstStops + 4);
    assert.equal(fourAudio.getInspector().activeWork, 0);
    const cadenceStarts = scheduled.length;
    fourClock += 1499;
    for (let i = 0; i < 100; i++) { fourAudio.updateWork(allWork); fourAudio.updateWork([]); }
    await tick();
    assert.equal(scheduled.length, cadenceStarts, 'all four resources retain the 1.5 s aggregate limit');
    fourClock++;
    fourAudio.updateWork(allWork); await tick();
    assert.equal(scheduled.length, cadenceStarts + 4, 'the exact cadence boundary admits all four');
    fourAudio.updateWork([]);
    fourClock += 1500;
    const resetStarts = scheduled.length;
    fourAudio.updateWork(allWork); fourAudio.stopWork(); await tick();
    assert.equal(scheduled.length, resetStarts, 'pending decode for all four cannot survive reset/disconnect');
    assert.equal(fourAudio.getInspector().activeWork, 0);

    for (const [muted, restored] of [[{ effectsLevel: 0 }, { effectsLevel: 1 }], [{ volume: 0 }, { volume: 1 }]]) {
      fourClock += 1500;
      fourAudio.updateWork(allWork); await tick();
      assert.equal(fourAudio.getInspector().activeWork, 4);
      fourAudio.setSettings(muted);
      assert.equal(fourAudio.getInspector().activeWork, 0, 'mute cancels every resource');
      const muteStarts = scheduled.length;
      fourClock += 1500;
      fourAudio.updateWork(allWork); await tick();
      assert.equal(scheduled.length, muteStarts);
      fourAudio.setSettings(restored); await tick();
      assert.equal(scheduled.length, muteStarts, 'restoring output does not replay stale work');
    }
    fourClock += 1500;
    fourAudio.updateWork(allWork); await tick();
    assert.equal(fourAudio.getInspector().activeWork, 4);
    fourDoc.hidden = true; visibilityChanged(); await tick();
    assert.equal(fourAudio.getInspector().activeWork, 0, 'actual visibility handler cancels every resource');
    const hiddenStarts = scheduled.length;
    fourClock += 1500;
    fourAudio.updateWork(allWork); await tick();
    assert.equal(scheduled.length, hiddenStarts);
    fourDoc.hidden = false; visibilityChanged(); await tick();
    assert.equal(scheduled.length, hiddenStarts, 'visibility restore does not replay stale work');
    fourAudio.updateWork(allWork); await tick();
    assert.equal(fourAudio.getInspector().activeWork, 4);
    await fourAudio.setMapAudio(null);
    assert.equal(fourAudio.getInspector().activeWork, 0, 'map/pack change cancels every resource');
    fourClock += 1500;
    fourAudio.updateWork(allWork);
    assert.deepEqual(fourAudio.getInspector().decisions.slice(-4), allWork.map(({ resource }) => ({
      cue: 'work', resource, key: null, outcome: 'synthesized fallback',
    })), 'unbound resources retain the generic synthesis route and its shared cooldown');
    await fourAudio.setMapAudio({ packId: 'fixture', profileId: 'field' }, fourLibrary);
    fourClock += 1500;
    const disposeStarts = scheduled.length;
    fourAudio.updateWork(allWork); fourAudio.dispose(); await tick();
    assert.equal(scheduled.length, disposeStarts, 'dispose cancels pending work');
  } finally { fourAudio.dispose(); }
} finally { globalThis.AudioContext = previousContext; }
console.log('sampled runtime playback and fallback passed');
