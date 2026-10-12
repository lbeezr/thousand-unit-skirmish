// Ordinary clicks and native Web Audio output; the shared cloud runner owns
// the clean pack, sandbox, server and browser. This module never launches one.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_GAME_AUDIO_REFERENCE } from '../src/audio-shipped-catalog.mjs';
import { validateCaptureContext } from './renderer-capture-context.mjs';
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
  const probe = window.__rtsInteractionAudio = { starts: [], faults: [], recording: null };
  const decoded = new WeakMap(), tapped = new WeakSet(), sources = new WeakMap();
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
    const sha256 = decoded.get(this.buffer);
    // Arming observes the call without changing the native buffer, schedule,
    // arguments or destination. Capture failures must never prevent playback.
    try { probe.recording?.start(sha256); }
    catch { probe.faults.push('recorder-start-error'); }
    const result = nativeStart.apply(this, args);
    if (sha256 && probe.starts.length < 128) {
      const now = this.context.currentTime || 0, startedAt = Math.max(now, Number(args[0]) || 0);
      const entry = { sha256, time: performance.now() + (startedAt - now) * 1000,
        duration: this.buffer.duration, stopTime: null };
      probe.starts.push(entry); sources.set(this, { entry, startedAt, stoppedAt: null });
    }
    return result;
  };
  const nativeStop = AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.stop = function (...args) {
    // Observe only successful native calls, preserving their arguments, result
    // and errors. A later scheduled stop replaces an earlier one only while the
    // earlier deadline has not passed; stopping an ended node cannot revive it.
    const result = nativeStop.apply(this, args);
    try {
      const source = sources.get(this);
      if (source) {
        const now = this.context.currentTime, when = args[0] === undefined ? 0 : args[0];
        if (!Number.isFinite(now) || !Number.isFinite(when)) throw Error('Unobservable stop time');
        if (source.stoppedAt === null || source.stoppedAt > now) {
          source.stoppedAt = Math.max(now, when);
          // Anchor conversion at nominal completion so a stop scheduled exactly
          // there cannot appear prematurely ended through floating subtraction.
          source.entry.stopTime = source.entry.time + source.entry.duration * 1000
            + (source.stoppedAt - (source.startedAt + source.entry.duration)) * 1000;
        }
      }
    } catch { probe.faults.push('source-stop-observation-error'); }
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
  probe.begin = (allowedHashes) => {
    if (!probe.stream || probe.recording) throw Error('Audio output unavailable or capture already active');
    if (!Array.isArray(allowedHashes) || !allowedHashes.length || allowedHashes.length > 128
      || !allowedHashes.every(value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value))) {
      throw Error('Expected recording hashes are required');
    }
    const allowed = new Set(allowedHashes);
    const recorder = new MediaRecorder(probe.stream, { mimeType: 'audio/webm;codecs=opus' });
    const chunks = [], samples = new Float32Array(probe.analyser.fftSize);
    const record = { from: probe.starts.length, peak: 0, energy: 0, samples: 0,
      armedAt: performance.now(), began: null, ended: null, phase: 'armed' };
    let finish, meter, stopTimer, armTimer, settled = false, byteLength = 0;
    record.done = new Promise(resolve => { finish = resolve; }); probe.recording = record;
    const settle = async () => {
      if (settled) return;
      settled = true; record.phase = 'finished';
      clearTimeout(armTimer); clearTimeout(stopTimer);
      clearInterval(meter);
      let binary = '';
      try {
        const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
        for (const byte of bytes) binary += String.fromCharCode(byte);
      } catch { probe.faults.push('recorder-data-error'); }
      record.result = { base64: btoa(binary), mimeType: recorder.mimeType, peak: record.peak,
        rms: Math.sqrt(record.energy / Math.max(1, record.samples)), meteredSamples: record.samples,
        armedAt: record.armedAt, beganAt: record.began, endedAt: record.ended,
        stopObservation: 'native-stop-v1',
        elapsedMs: record.began === null || record.ended === null ? 0 : record.ended - record.began,
        starts: record.began === null ? [] : probe.starts.slice(record.from)
          .filter(start => start.time >= record.began && start.time <= record.ended).map(start => ({ ...start })),
        faults: [...probe.faults] };
      finish(record.result);
    };
    const expire = () => { probe.faults.push('recording-arm-timeout'); void settle(); };
    recorder.ondataavailable = event => {
      if (settled || !event.data.size) return;
      byteLength += event.data.size;
      if (byteLength >= 750000) { probe.faults.push('recorder-data-limit'); return; }
      chunks.push(event.data);
    };
    recorder.onerror = () => { probe.faults.push('recorder-error'); };
    recorder.onstop = settle;
    record.start = sha256 => {
      if (record.phase !== 'armed' || !allowed.has(sha256)) return;
      if (performance.now() - record.armedAt >= 30000) { expire(); return; }
      clearTimeout(armTimer); record.phase = 'recording'; record.from = probe.starts.length;
      record.began = performance.now();
      try { recorder.start(); }
      catch { probe.faults.push('recorder-start-error'); record.ended = performance.now(); void settle(); return; }
      meter = setInterval(() => {
        probe.analyser.getFloatTimeDomainData(samples);
        for (const sample of samples) { record.peak = Math.max(record.peak, Math.abs(sample)); record.energy += sample * sample; }
        record.samples += samples.length;
      }, 20);
      stopTimer = setTimeout(() => {
        record.ended = performance.now(); clearInterval(meter);
        try { recorder.stop(); }
        catch { probe.faults.push('recorder-stop-error'); void settle(); }
      }, 3500);
    };
    armTimer = setTimeout(expire, 30000);
    return true;
  };
  probe.finish = async () => { const result = await probe.recording.done; probe.recording = null; return result; };
}

export function validateAudioObservation(record, allowedHashes) {
  assert.equal(record.mimeType, 'audio/webm;codecs=opus');
  assert.ok(typeof record.base64 === 'string' && record.base64.length < 1000000);
  const bytes = Buffer.from(record.base64, 'base64');
  assert.ok(bytes.length > 1000 && bytes.subarray(0, 4).equals(Buffer.from('1a45dfa3', 'hex')), 'native WebM output is required');
  assert.deepEqual(record.faults, []);
  assert.ok(record.elapsedMs >= 3000 && record.elapsedMs < 10000, 'bounded real output duration required');
  assert.ok(Number.isFinite(record.beganAt) && Number.isFinite(record.endedAt)
    && Math.abs(record.endedAt - record.beganAt - record.elapsedMs) < 1, 'recording interval must be explicit');
  assert.ok(Number.isFinite(record.armedAt) && record.beganAt >= record.armedAt
    && record.beganAt - record.armedAt < 30000, 'recording must begin within its bounded arming interval');
  assert.ok(record.meteredSamples >= 2048 && Number.isFinite(record.peak) && record.peak > .001 && record.peak < 1
    && Number.isFinite(record.rms) && record.rms > .0001 && record.rms <= record.peak + 1e-6, 'nonzero bounded metered output required');
  const matching = record.starts.filter(sample => allowedHashes.includes(sample.sha256));
  assert.equal(matching.length, 1, 'one native start of the expected hash-verified recording is required');
  assert.ok(matching[0].duration > .2 && matching[0].duration < 5);
  assert.ok(matching[0].time >= record.beganAt
    && matching[0].time + matching[0].duration * 1000 <= record.endedAt,
  'the nominal expected recording duration must fit within the captured interval');
  // Historical receipts predate stop observation. Keep them readable without
  // claiming the stronger observation retroactively.
  const stopObservation = record.stopObservation ?? 'unavailable';
  assert.ok(['native-stop-v1', 'unavailable'].includes(stopObservation), 'known source stop observation required');
  if (stopObservation === 'native-stop-v1') {
    assert.ok(matching[0].stopTime === null || (Number.isFinite(matching[0].stopTime)
      && matching[0].stopTime >= matching[0].time + matching[0].duration * 1000),
    'the expected recording must not be stopped before its nominal completion');
  }
  return { bytes, sha256: hash(bytes), sourceSha256: matching[0].sha256, stopObservation };
}

async function control(page, selector) {
  const point = await page.cdp.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)});
    if (!e || e.disabled || e.hidden) return null; e.scrollIntoView({block:'nearest'});
    const r = e.getBoundingClientRect(); return r.width && r.height ? {x:r.x+r.width/2,y:r.y+r.height/2} : null; })()`);
  await clickNovicePoint(page, point);
}

// Observe the same unit-first picker used by a normal left click. A building's
// projected ground center can be occupied by a nearby unit; scan its actual
// rendered bounds without changing selection or advancing stacked-unit picks.
export function interactionTargetPoint(kind, id) {
  const state = window.__rtsInteractionAudioSnapshot();
  const target = (kind === 'unit' ? state.units ?? state.workers : state.buildings).find(row => row.id === id);
  if (!target) return null;
  const candidates = target.point ? [target.point] : [];
  if (target.bounds) {
    const { left, right, top, bottom } = target.bounds;
    for (let row = 0; row < 8; row++) for (let col = 0; col < 9; col++) {
      candidates.push({ x: left + (right - left) * (col + .5) / 9, y: top + (bottom - top) * (row + .5) / 8 });
    }
  }
  return candidates.find(point => {
    const pick = window.__rtsInteractionAudioPick(point.x, point.y);
    return pick?.kind === kind && pick.id === id;
  }) ?? null;
}

export async function run(value) {
  const { page, origin, source, capture, evidenceDirectory } = validateCaptureContext(value);
  const report = { schemaVersion: 1, source, mapId, status: 'failed', recordings: [], issues: [], listeningReview: 'pending' };
  const reportFile = path.join(evidenceDirectory, 'interaction-audio.json');
  await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  const persistReport = () => writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
  // Only local, public audio paths; never retain query strings, headers or
  // unrelated requests. Completed and aborted transfers distinguish a slow
  // first load from a lifecycle restart without changing browser networking.
  const downloads = [], requests = new Map();
  page.cdp.on('Network.requestWillBeSent', event => {
    const url = new URL(event.request.url);
    if (url.origin !== origin || !/^\/assets\/audio\/[A-Za-z0-9/_-]+\.(mp3|wav|ogg|json)$/.test(url.pathname)
      || downloads.length >= 512) return;
    const row = { path: url.pathname, startedAt: event.timestamp, state: 'pending' };
    downloads.push(row); requests.set(event.requestId, row);
  });
  page.cdp.on('Network.loadingFinished', event => {
    const row = requests.get(event.requestId); if (!row) return;
    Object.assign(row, { state: 'completed', elapsedMs: (event.timestamp - row.startedAt) * 1000, bytes: event.encodedDataLength });
    requests.delete(event.requestId);
  });
  page.cdp.on('Network.loadingFailed', event => {
    const row = requests.get(event.requestId); if (!row) return;
    Object.assign(row, { state: event.canceled ? 'canceled' : 'failed', elapsedMs: (event.timestamp - row.startedAt) * 1000 });
    requests.delete(event.requestId);
  });
  let stage = 'source';
  try {
    const reference = DEFAULT_GAME_AUDIO_REFERENCE;
    const manifestBytes = Buffer.from(await (await fetch(`${origin}/assets/audio/runtime/${reference.packId}/${reference.version}/manifest.json`)).arrayBuffer());
    assert.equal(hash(manifestBytes), DEFAULT_GAME_AUDIO_REFERENCE.sha256);
    const manifest = JSON.parse(manifestBytes), bindings = manifest.pack.profiles.find(p => p.id === 'interactions').bindings;
    await page.cdp.call('Page.addScriptToEvaluateOnNewDocument', { source: `(${installInteractionAudioProbe.toString()})()` });
    stage = 'ordinary-entry';
    await page.cdp.call('Page.navigate', { url: origin + '/' });
    await page.wait('document.documentElement?.dataset.entry === "menu" && document.querySelector("#menu-new-game")?.disabled === false', 'ordinary New Game');
    stage = 'new-game-click';
    await control(page, '#menu-new-game');
    stage = 'opening-workers';
    await page.wait(`window.__rtsInteractionAudioSnapshot?.()?.mapId === '${mapId}' && window.__rtsInteractionAudioSnapshot().workers.some(w => w.point)`, 'normal opening Workers');
    stage = 'default-audio-ready';
    await page.wait('window.__rtsInteractionAudioSnapshot().inspector.bindings.some(b => b.key === "unit.worker.gather.wood" && b.sources.every(s => s.available))', 'default recordings ready', 35000);
    const state = () => page.cdp.evaluate('window.__rtsInteractionAudioSnapshot()');
    const targetPoint = async (kind, id) => {
      const point = await page.cdp.evaluate(`(${interactionTargetPoint.toString()})(${JSON.stringify(kind)}, ${id})`);
      assert.ok(point, 'the ordinary picker must identify a visible target pixel');
      return point;
    };
    // The first ordinary battlefield gesture unlocks the game audio context.
    // Record a subsequent genuine click after its normal selection cooldown.
    let worker = (await state()).workers.find(w => w.point);
    await clickNovicePoint(page, await targetPoint('unit', worker.id));
    stage = 'gesture-unlock';
    await page.wait('window.__rtsInteractionAudioSnapshot().status === "running" && window.__rtsInteractionAudio.stream', 'gesture-unlocked native output');
    await page.cdp.evaluate('new Promise(resolve => setTimeout(resolve, 1500))');
    const recordClick = async (key, checkpoint, action) => {
      stage = checkpoint;
      const before = (await state()).inspector.decisions.filter(d => d.key === key && d.outcome === 'sample scheduled').length;
      const allowed = bindings[key].variants.map(v => manifest.downloads[v.sourceId].sha256);
      await page.cdp.evaluate(`window.__rtsInteractionAudio.begin(${JSON.stringify(allowed)})`);
      await action();
      stage = `${checkpoint}-scheduled`;
      await page.wait(`window.__rtsInteractionAudioSnapshot().inspector.decisions.filter(d => d.key === ${JSON.stringify(key)} && d.outcome === 'sample scheduled').length > ${before}`, 'ordinary click schedules its exact recording');
      // Poll a settled value instead of holding a Runtime.evaluate promise past
      // the shared CDP transport's 15-second call deadline on a busy renderer.
      stage = `${checkpoint}-output`;
      await page.wait('Boolean(window.__rtsInteractionAudio.recording?.result)', 'native recording finalized', 45000);
      const output = await page.cdp.evaluate('window.__rtsInteractionAudio.finish()');
      stage = `${checkpoint}-receipt`;
      report.lastOutput = { key, armedAt: output.armedAt, beganAt: output.beganAt, endedAt: output.endedAt, elapsedMs: output.elapsedMs,
        starts: output.starts, stopObservation: output.stopObservation,
        faults: output.faults, peak: output.peak, rms: output.rms, meteredSamples: output.meteredSamples };
      await persistReport();
      const verified = validateAudioObservation(output, allowed);
      const file = `${checkpoint}.webm`;
      await writeFile(path.join(evidenceDirectory, file), verified.bytes, { flag: 'wx' });
      const current = await state();
      report.recordings.push({ key, file, sha256: verified.sha256, sourceSha256: verified.sourceSha256,
        stopObservation: verified.stopObservation, starts: output.starts,
        peak: output.peak, rms: output.rms, elapsedMs: output.elapsedMs, settings: current.settings });
      delete report.lastOutput;
      // Keep each completed native recording even if a later visual checkpoint
      // or the bounded case deadline fails. Partial evidence stays incomplete.
      await persistReport();
    };
    // Clicking the Town Center clears the first Worker selection legitimately.
    const town = (await state()).buildings.find(b => b.type === 'town-center' && b.complete && b.point);
    assert.ok(town, 'ordinary opening Town Center must be visible');
    const townPoint = await targetPoint('building', town.id);
    await recordClick('building.town-center.select', 'town-center-click', () => clickNovicePoint(page, townPoint));
    worker = (await state()).workers.find(w => w.id === worker.id && w.point);
    assert.ok(worker);
    const workerPoint = await targetPoint('unit', worker.id);
    await recordClick('unit.worker.select', 'worker-click', () => clickNovicePoint(page, workerPoint));
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
    const barracks = await page.wait('window.__rtsInteractionAudioSnapshot().buildings.find(b => b.type === "barracks" && b.complete && b.point)', 'paid Barracks completes', 60000);
    const barracksPoint = await targetPoint('building', barracks.id);
    await recordClick('building.barracks.select', 'barracks-click', () => clickNovicePoint(page, barracksPoint));
    assert.deepEqual(report.recordings.map(r => r.key).sort(), [...interactionKeys].sort());
    stage = 'recorded-audio-checkpoint';
    await capture({ page, mapId, checkpoint: 'recorded-audio-checkpoint' });
    report.status = 'captured-needs-listening';
  } catch (error) {
    const reason = /pointer point must be inside/.test(error?.message) ? 'pointer-outside-viewport'
      : /Cannot read properties of null/.test(error?.message) ? 'dom-not-ready'
        : /timeout/i.test(error?.message) ? 'wait-timeout' : 'operation-failed';
    report.issues.push({ stage, code: 'interaction-audio-capture-failed', reason, errorType: error?.name || 'Error' });
    try {
      report.diagnostic = await page.cdp.evaluate(`(() => {
        const probe = window.__rtsInteractionAudio, last = window.__rtsInteractionAudioSnapshot?.();
        return { entry: document.documentElement?.dataset.entry ?? null,
          boot: document.documentElement?.dataset.boot ?? null,
          viewport: { width: innerWidth, height: innerHeight },
          newGame: (() => { const e = document.querySelector('#menu-new-game');
            if (!e) return null; const r = e.getBoundingClientRect();
            return { disabled: e.disabled, x: r.x, y: r.y, width: r.width, height: r.height }; })(),
          probe: Boolean(probe), faults: probe?.faults ?? [],
          mapId: last?.mapId ?? null, team: last?.team ?? null,
          observationAgeMs: last ? performance.now() - last.observedAt : null,
          audioStatus: last?.status ?? null, packStatus: last?.inspector?.status ?? null,
          bindingCount: last?.inspector?.bindings?.length ?? 0,
          decisions: last?.inspector?.decisions?.slice(-12) ?? [],
          nativeStarts: probe?.starts?.slice(-12) ?? [],
          recording: probe?.recording ? { phase: probe.recording.phase, armedAt: probe.recording.armedAt,
            beganAt: probe.recording.began, endedAt: probe.recording.ended, ready: Boolean(probe.recording.result) } : null,
          workers: last?.workers ?? [], buildings: last?.buildings ?? [] };
      })()`);
      // Entry may fail before a rendered game frame exists. Retain a raw
      // diagnostic viewport without calling it an ordinary-game checkpoint.
      const screenshot = await page.cdp.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const bytes = Buffer.from(screenshot.data, 'base64');
      assert.ok(bytes.length > 1000 && bytes.length < 10000000
        && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')));
      const file = `failure-${stage}.png`;
      await writeFile(path.join(evidenceDirectory, file), bytes, { flag: 'wx' });
      report.diagnosticImage = { file, sha256: hash(bytes), scope: 'failure-diagnostic-only' };
    } catch { report.issues.push({ stage, code: 'failure-diagnostic-unavailable' }); }
  }
  report.downloads = downloads;
  await persistReport();
  const passed = report.status === 'captured-needs-listening';
  return { status: passed ? 'passed' : 'failed', checks: [{ id: 'ordinary-clicks-native-output-recorded', passed }] };
}
