// Actual ordinary map selection + hash-verified HTTP loading + modeled Web Audio lifecycle.
// Buffer scheduling is observed; no browser decode, hearing or aesthetic acceptance is claimed.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { createGameAudio } from '../src/audio.mjs';
import { SHIPPED_AUDIO_REFERENCES } from '../src/audio-shipped-catalog.mjs';

const expected = SHIPPED_AUDIO_REFERENCES.find(ref => ref.packId === 'vaelora-siltmouths');
const map = JSON.parse(await readFile(new URL('../maps/shore-fishing.json', import.meta.url)));
const manifest = JSON.parse(await readFile(new URL('../assets/audio/runtime/vaelora-siltmouths/v2/manifest.json', import.meta.url)));
const idsByHash = new Map(Object.entries(manifest.downloads).map(([id, value]) => [value.sha256, id]));
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 30_000 });
const originalContext = globalThis.AudioContext, originalFetch = globalThis.fetch;
const contexts = [], seats = [];
const param = () => ({ value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
const node = () => ({ connect() {}, disconnect() {}, start() {}, stop() {} });
class Context {
  state = 'running'; currentTime = 0; sampleRate = 100; destination = node(); sources = [];
  constructor() { contexts.push(this); }
  createGain() { return { ...node(), gain: param() }; }
  createBiquadFilter() { return { ...node(), frequency: param(), Q: param() }; }
  createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; }
  createBufferSource() {
    const source = { ...node(), active: false, start() { this.active = true; }, stop(at) { if (at === undefined) this.active = false; } };
    this.sources.push(source); return source;
  }
  createOscillator() { return { ...node(), frequency: param() }; }
  async decodeAudioData(bytes) {
    const id = idsByHash.get(createHash('sha256').update(new Uint8Array(bytes)).digest('hex'));
    assert.ok(id, 'scheduled buffer comes from a verified public Siltmouths original');
    return { id, duration: 30, length: 3000, numberOfChannels: 1 };
  }
  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
  async close() { this.state = 'closed'; }
}
const nextTask = () => new Promise(resolve => setTimeout(resolve, 0));
const active = (seat, id) => seat.context?.sources.filter(source => source.active && source.buffer?.id === id).length || 0;
function makeSeat() {
  const events = new Map(), statuses = [];
  const doc = { hidden: false, addEventListener(type, callback) { events.set(type, callback); }, removeEventListener(type) { events.delete(type); } };
  const audio = createGameAudio({ doc, storage: null, onPackStatus: value => statuses.push(value) });
  const seat = { audio, doc, statuses, context: null, visibility() { events.get('visibilitychange')?.(); },
    unlock() { audio.unlock(); this.context ||= contexts.at(-1); } };
  seats.push(seat); return seat;
}
const localLibrary = { async loadPack() { throw new Error('A shipped map must not require a local Audio Studio import'); } };
async function load(seat, definition) { await seat.audio.setMapAudio(definition.audio, localLibrary); }
async function layers(seat, music, bed) {
  const deadline = Date.now() + 5000;
  await nextTask();
  while (Date.now() < deadline) {
    if (active(seat, 'siltmouths-music') === music && active(seat, 'siltmouths-terrain') === bed) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.equal(active(seat, 'siltmouths-music'), music, 'expected active score layer within deadline');
  assert.equal(active(seat, 'siltmouths-terrain'), bed, 'expected active terrain layer within deadline');
}
async function select(clients, id) {
  const offsets = clients.map(client => client.messages.length);
  clients[0].send({ type: 'selectMap', mapId: id });
  return Promise.all(clients.map((client, index) => client.wait(message => message.type === 'mapChange' && message.map.id === id,
    `ordinary ${id} map selection`, offsets[index])));
}
try {
  assert.deepEqual(map.audio, expected, 'ordinary Shore Fishing references the registered public v2 profile');
  assert.deepEqual(Object.keys(manifest.downloads).sort(), ['siltmouths-music', 'siltmouths-terrain'], 'contrast/signature are not silently adopted');
  await fixture.start();
  let clients = [await fixture.connect(0), await fixture.connect(1)];
  const tokens = clients.map(client => client.welcome.player.sessionToken);
  assert.ok(clients.every(client => client.welcome.maps.some(entry => entry.id === map.id)), 'both seats can select the ordinary shipped map');
  const selected = await select(clients, map.id);
  assert.ok(selected.every(message => JSON.stringify(message.map.audio) === JSON.stringify(expected)), 'both authoritative map changes preserve the exact audio reference');
  globalThis.AudioContext = Context;
  globalThis.fetch = (url, options) => originalFetch(new URL(url, `http://127.0.0.1:${fixture.port}`), options);
  const pair = [makeSeat(), makeSeat()];
  for (const [index, seat] of pair.entries()) {
    const beforeUnlock = contexts.length;
    await load(seat, selected[index].map); await layers(seat, 0, 0);
    assert.equal(contexts.length, beforeUnlock, 'loading cannot create an audio context before input unlock');
    assert.match(seat.statuses.at(-1), /ready.*Shipped content loads automatically/);
    seat.unlock(); await layers(seat, 1, 1);
    assert.equal(seat.audio.playEvent({ cue: 'select', kind: 'worker' }), true, 'worker selection retains synthesized feedback');
    assert.equal(seat.audio.playEvent({ cue: 'gather', kind: 'worker', resource: 'food' }), true, 'fishing keeps the existing food acknowledgement');
    assert.equal(seat.audio.getInspector().decisions.at(-1).outcome, 'synthesized fallback');
    seat.unlock(); await layers(seat, 1, 1);
  }
  pair[0].audio.setSettings({ ambience: false }); await layers(pair[0], 1, 0); await layers(pair[1], 1, 1);
  pair[0].audio.setSettings({ ambience: true, musicLevel: 0 }); await layers(pair[0], 0, 1);
  pair[0].audio.setSettings({ musicLevel: 1, enabled: false }); await layers(pair[0], 0, 0); await layers(pair[1], 1, 1);
  pair[0].audio.setSettings({ enabled: true }); await layers(pair[0], 1, 1);
  pair[0].doc.hidden = true; pair[0].visibility(); await layers(pair[0], 0, 0); await layers(pair[1], 1, 1);
  pair[0].doc.hidden = false; pair[0].visibility(); await layers(pair[0], 1, 1);
  const other = await select(clients, 'open-field');
  for (const [index, seat] of pair.entries()) { await load(seat, other[index].map); await layers(seat, 0, 0); }
  const returned = await select(clients, map.id);
  for (const [index, seat] of pair.entries()) { await load(seat, returned[index].map); await layers(seat, 1, 1); }
  await Promise.all(clients.map(client => new Promise(resolve => { client.socket.addEventListener('close', resolve, { once: true }); client.socket.close(); })));
  for (const seat of pair) { seat.audio.dispose(); await layers(seat, 0, 0); }
  clients = [await fixture.connect(0, tokens[0]), await fixture.connect(1, tokens[1])];
  for (const client of clients) {
    assert.deepEqual(client.welcome.map.audio, expected, 'reconnected ordinary map retains shipped profile');
    const seat = makeSeat(), beforeUnlock = contexts.length;
    await load(seat, client.welcome.map); await layers(seat, 0, 0);
    assert.equal(contexts.length, beforeUnlock, 'resumed map loading also waits for input unlock');
    seat.unlock(); await layers(seat, 1, 1);
    seat.audio.dispose(); await layers(seat, 0, 0);
  }
  console.log(JSON.stringify({ map: map.id, reference: expected, sources: [...idsByHash.values()],
    ordinaryBothSeatSelection: true, httpHashVerifiedWithoutImport: true, activationOnce: true, synthesizedSelectionFoodCues: true,
    independentMixMuteVisibility: true, switchAwayAndBack: true, resumedProfile: true, disposal: true,
    scope: 'authoritative messages, actual HTTP bytes and modeled scheduling; browser decode/listening not established' }));
} finally {
  for (const seat of seats) seat.audio.dispose();
  globalThis.AudioContext = originalContext; globalThis.fetch = originalFetch;
  await fixture.dispose();
}
