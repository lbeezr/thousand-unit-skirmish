// Ordinary clicks and native Web Audio output; the shared cloud runner owns
// the clean pack, sandbox, server and browser. This module never launches one.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_GAME_AUDIO_REFERENCE } from '../src/audio-shipped-catalog.mjs';
import { validateCaptureContext } from './renderer-capture-context.mjs';
import { postRenderLine } from './renderer-worker-animation-scenario.mjs';
import { clickNovicePoint } from './renderer-qualification-novice.mjs';
import { findTreePixel } from './renderer-tree-targeting-scenario.mjs';

export const id = 'interaction-audio';
export const contextVersion = 1;
const mapId = 'veyrholds-terraced-vale';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const interactionKeys = Object.freeze([
  'unit.worker.select', 'unit.worker.gather.wood',
  'building.town-center.select', 'building.barracks.select',
]);

// A parallel tap on the actual final output. Keep the original connection and
// native decoding/playback; do not fabricate speech, unlock audio or change mix.
// Only this disposable page is instrumented. No microphone or device capture.
export function installInteractionAudioProbe() {
  const probe = window.__rtsInteractionAudio = { last: null, starts: [], faults: [], recording: null };
  const decoded = new WeakMap(), tapped = new WeakSet();
  const nativeDecode = BaseAudioContext.prototype.decodeAudioData;
  BaseAudioContext.prototype.decodeAudioData = function (bytes, ...callbacks) {
    const copy = bytes.slice(0);
    const result = nativeDecode.call(this, bytes, ...callbacks);
    return result.then(async buffer => {
      const digest = await crypto.subtle.digest('SHA-256', copy);
      decoded.set(buffer, [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join(''));
      return buffer;
    });
  };
  const nativeStart = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...args) {
    const result = nativeStart.apply(this, args);
    const sha256 = decoded.get(this.buffer);
    if (sha256 && probe.starts.length < 128) probe.starts.push({ sha256, time: performance.now(), duration: this.buffer.duration });
    return result;
  };
  const nativeConnect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (destination, ...args) {
    const result = nativeConnect.call(this, destination, ...args);
    if (destination === this.context.destination && !tapped.has(this)) {
      tapped.add(this);
      if (probe.stream) { probe.faults.push('multiple-final-outputs'); return result; }
      const stream = this.context.createMediaStreamDestination();
      const analyser = this.context.createAnalyser(); analyser.fftSize = 2048;
      nativeConnect.call(this, stream); nativeConnect.call(this, analyser);
      probe.stream = stream.stream; probe.analyser = analyser;
    }
    return result;
  };
  probe.begin = () => {
    if (!probe.stream || probe.recording) throw Error('Audio output unavailable or capture already active');
    const recorder = new MediaRecorder(probe.stream, { mimeType: 'audio/webm;codecs=opus' });
    const chunks = [], samples = new Float32Array(probe.analyser.fftSize);
    const record = { from: probe.starts.length, peak: 0, energy: 0, samples: 0, began: performance.now() };
    let finish;
    record.done = new Promise(resolve => { finish = resolve; }); probe.recording = record;
    const meter = setInterval(() => {
      probe.analyser.getFloatTimeDomainData(samples);
      for (const sample of samples) { record.peak = Math.max(record.peak, Math.abs(sample)); record.energy += sample * sample; }
      record.samples += samples.length;
    }, 20);
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onerror = () => { probe.faults.push('recorder-error'); };
    recorder.onstop = async () => {
      clearInterval(meter);
      const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
      let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
      finish({ base64: btoa(binary), mimeType: recorder.mimeType, peak: record.peak,
        rms: Math.sqrt(record.energy / Math.max(1, record.samples)), meteredSamples: record.samples,
        elapsedMs: performance.now() - record.began, starts: probe.starts.slice(record.from), faults: [...probe.faults] });
    };
    recorder.start(); setTimeout(() => recorder.stop(), 3500);
    return true;
  };
  probe.finish = async () => { const result = await probe.recording.done; probe.recording = null; return result; };
}

// Non-pausing read-only observation in the real Main module after rendering.
export function observeInteractionAudio() {
  const probe = window.__rtsInteractionAudio;
  if (!probe) return false;
  const rect = renderer.domElement.getBoundingClientRect();
  const project = (x, z, lift = 0) => {
    const p = new THREE.Vector3(x, groundHeight(x, z) + lift, z).project(camera);
    const point = { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
    return Math.abs(p.z) < 1 && document.elementFromPoint(point.x, point.y) === renderer.domElement ? point : null;
  };
  probe.last = { mapId: mapDefinition?.id, team: localTeam, status: audio.getStatus(),
    inspector: audio.getInspector(), settings: audio.getSettings(),
    workers: units.filter(u => u?.team === localTeam && u.kind === 'worker' && u.hp > 0).slice(0, 4)
      .map(u => ({ id: u.id, selected: selected.has(u.id), point: project(u.renderX, u.renderZ, .65) })),
    buildings: latestBuildings.filter(b => b.team === localTeam && b.hp > 0 && ['town-center', 'barracks'].includes(b.type))
      .map(b => ({ id: b.id, type: b.type, complete: b.complete, selected: b.id === selectedBuildingId, point: project(b.x, b.z) })),
  };
  return false;
}

export function validateAudioObservation(record, allowedHashes) {
  assert.equal(record.mimeType, 'audio/webm;codecs=opus');
  assert.ok(typeof record.base64 === 'string' && record.base64.length < 1000000);
  const bytes = Buffer.from(record.base64, 'base64');
  assert.ok(bytes.length > 1000 && bytes.subarray(0, 4).equals(Buffer.from('1a45dfa3', 'hex')), 'native WebM output is required');
  assert.deepEqual(record.faults, []);
  assert.ok(record.elapsedMs >= 3000 && record.elapsedMs < 10000, 'bounded real output duration required');
  assert.ok(record.meteredSamples >= 2048 && Number.isFinite(record.peak) && record.peak > .001 && record.peak < 1
    && Number.isFinite(record.rms) && record.rms > .0001 && record.rms <= record.peak + 1e-6, 'nonzero bounded metered output required');
  const matching = record.starts.filter(sample => allowedHashes.includes(sample.sha256));
  assert.equal(matching.length, 1, 'one native start of the expected hash-verified recording is required');
  assert.ok(matching[0].duration > .2 && matching[0].duration < 5);
  return { bytes, sha256: hash(bytes), sourceSha256: matching[0].sha256 };
}

async function control(page, selector) {
  const point = await page.cdp.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)});
    if (!e || e.disabled || e.hidden) return null; e.scrollIntoView({block:'nearest'});
    const r = e.getBoundingClientRect(); return r.width && r.height ? {x:r.x+r.width/2,y:r.y+r.height/2} : null; })()`);
  await clickNovicePoint(page, point);
}

export async function run(value) {
  const { page, origin, source, capture, evidenceDirectory } = validateCaptureContext(value);
  const report = { schemaVersion: 1, source, mapId, status: 'failed', recordings: [], issues: [], listeningReview: 'pending' };
  let stage = 'source';
  try {
    const main = await (await fetch(`${origin}/src/main.js`)).text();
    const reference = DEFAULT_GAME_AUDIO_REFERENCE;
    const manifestBytes = Buffer.from(await (await fetch(`${origin}/assets/audio/runtime/${reference.packId}/${reference.version}/manifest.json`)).arrayBuffer());
    assert.equal(hash(manifestBytes), DEFAULT_GAME_AUDIO_REFERENCE.sha256);
    const manifest = JSON.parse(manifestBytes), bindings = manifest.pack.profiles.find(p => p.id === 'interactions').bindings;
    await page.cdp.call('Page.addScriptToEvaluateOnNewDocument', { source: `(${installInteractionAudioProbe.toString()})()` });
    await page.cdp.call('Debugger.enable');
    await page.cdp.call('Debugger.setBreakpointByUrl', { url: `${origin}/src/main.js`, lineNumber: postRenderLine(main),
      condition: `(${observeInteractionAudio.toString()})()` });
    stage = 'ordinary-entry';
    await page.cdp.call('Page.navigate', { url: origin + '/' });
    await page.wait('document.querySelector("#menu-new-game")?.disabled === false', 'ordinary New Game');
    await control(page, '#menu-new-game');
    await page.wait(`window.__rtsInteractionAudio?.last?.mapId === '${mapId}' && window.__rtsInteractionAudio.last.workers.some(w => w.point)`, 'normal opening Workers');
    await page.wait('window.__rtsInteractionAudio.last.inspector.bindings.some(b => b.key === "unit.worker.gather.wood" && b.sources.every(s => s.available))', 'default recordings ready');
    const state = () => page.cdp.evaluate('window.__rtsInteractionAudio.last');
    // The first ordinary battlefield gesture unlocks the game audio context.
    // Record a subsequent genuine click after its normal selection cooldown.
    let worker = (await state()).workers.find(w => w.point);
    await clickNovicePoint(page, worker.point);
    await page.wait('window.__rtsInteractionAudio.last.status === "running" && window.__rtsInteractionAudio.stream', 'gesture-unlocked native output');
    await page.cdp.evaluate('new Promise(resolve => setTimeout(resolve, 1500))');
    const recordClick = async (key, checkpoint, action) => {
      stage = checkpoint;
      const before = (await state()).inspector.decisions.filter(d => d.key === key && d.outcome === 'sample scheduled').length;
      await page.cdp.evaluate('window.__rtsInteractionAudio.begin()');
      await action();
      await page.wait(`window.__rtsInteractionAudio.last.inspector.decisions.filter(d => d.key === ${JSON.stringify(key)} && d.outcome === 'sample scheduled').length > ${before}`, 'ordinary click schedules its exact recording');
      await capture({ page, mapId, checkpoint });
      const output = await page.cdp.evaluate('window.__rtsInteractionAudio.finish()');
      const allowed = bindings[key].variants.map(v => manifest.downloads[v.sourceId].sha256);
      const verified = validateAudioObservation(output, allowed);
      const file = `${checkpoint}.webm`;
      await writeFile(path.join(evidenceDirectory, file), verified.bytes, { flag: 'wx' });
      const current = await state();
      report.recordings.push({ key, file, sha256: verified.sha256, sourceSha256: verified.sourceSha256,
        peak: output.peak, rms: output.rms, elapsedMs: output.elapsedMs, settings: current.settings });
    };
    // Clicking the Town Center clears the first Worker selection legitimately.
    const town = (await state()).buildings.find(b => b.type === 'town-center' && b.complete && b.point);
    assert.ok(town, 'ordinary opening Town Center must be visible');
    await recordClick('building.town-center.select', 'town-center-click', () => clickNovicePoint(page, town.point));
    worker = (await state()).workers.find(w => w.id === worker.id && w.point);
    assert.ok(worker);
    await recordClick('unit.worker.select', 'worker-click', () => clickNovicePoint(page, worker.point));
    const trees = await page.cdp.evaluate('window.__rtsTreeTargetCapture.snapshot()');
    const target = await findTreePixel(page, trees, 'node') || await findTreePixel(page, trees, 'forest');
    assert.ok(target, 'a disclosed ordinary wood target must be visible');
    await recordClick('unit.worker.gather.wood', 'worker-wood-order', async () => {
      await clickNovicePoint(page, target, 'right');
      await page.wait('document.querySelector("#order-status")?.dataset.state === "applied"', 'wood order accepted by server');
    });
    stage = 'paid-barracks';
    if (await page.cdp.evaluate('document.querySelector("#command-deck").hidden')) await control(page, '#dock-toggle');
    await control(page, '#dock-tab-economy'); await control(page, '#select-workers'); await control(page, '#build-barracks');
    const rect = await page.cdp.evaluate('(() => { const r=document.querySelector("#viewport canvas").getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; })()');
    let site = null;
    for (const fy of [.45, .55, .35, .65]) for (const fx of [.45, .55, .35, .65]) {
      if (site) break;
      const point = { x: rect.x + rect.width * fx, y: rect.y + rect.height * fy };
      if (!await page.cdp.evaluate(`document.elementFromPoint(${point.x},${point.y}) === document.querySelector('#viewport canvas')`)) continue;
      await page.cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
      await page.cdp.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      if (await page.cdp.evaluate('window.__rtsBuildingPlacementSnapshot?.active && window.__rtsBuildingPlacementSnapshot.valid')) site = point;
    }
    assert.ok(site, 'an ordinary valid Barracks site must be found');
    await clickNovicePoint(page, site);
    const barracks = await page.wait('window.__rtsInteractionAudio.last.buildings.find(b => b.type === "barracks" && b.complete && b.point)', 'paid Barracks completes', 60000);
    await recordClick('building.barracks.select', 'barracks-click', () => clickNovicePoint(page, barracks.point));
    assert.deepEqual(report.recordings.map(r => r.key).sort(), [...interactionKeys].sort());
    report.status = 'captured-needs-listening';
  } catch { report.issues.push({ stage, code: 'interaction-audio-capture-failed' }); }
  await writeFile(path.join(evidenceDirectory, 'interaction-audio.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  const passed = report.status === 'captured-needs-listening';
  return { status: passed ? 'passed' : 'failed', checks: [{ id: 'ordinary-clicks-native-output-recorded', passed }] };
}
