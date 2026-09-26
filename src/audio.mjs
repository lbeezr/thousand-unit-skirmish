// All sounds are synthesized here with Web Audio. No sampled or licensed media is used.
const STORAGE_KEY = 'tus-audio-v1';
const DEFAULT_SETTINGS = Object.freeze({
  enabled: true, volume: 0.5, effectsLevel: 1, ambience: true, ambienceLevel: 1,
});
const COOLDOWN_MS = Object.freeze({
  select: 90, move: 90, attack: 120, gather: 140, rally: 550, build: 170,
  queue: 170, complete: 2200, 'research-complete': 2600, 'scenario-reward': 2400,
  reject: 250, objective: 1200, 'objective-lost': 1200,
  'resource-empty': 8000, 'base-lost': 2000, 'building-complete': 2600,
  victory: 5000, defeat: 5000, draw: 5000,
  'battle-alert': 9000, 'selected-alert': 11000, 'base-alert': 11000,
});

function browserStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

export function readAudioSettings(storage = browserStorage()) {
  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || '{}');
    return {
      enabled: typeof saved.enabled === 'boolean' ? saved.enabled : DEFAULT_SETTINGS.enabled,
      volume: Number.isFinite(saved.volume) ? Math.max(0, Math.min(1, saved.volume)) : DEFAULT_SETTINGS.volume,
      effectsLevel: Number.isFinite(saved.effectsLevel)
        ? Math.max(0, Math.min(2, saved.effectsLevel)) : DEFAULT_SETTINGS.effectsLevel,
      ambience: typeof saved.ambience === 'boolean' ? saved.ambience : DEFAULT_SETTINGS.ambience,
      ambienceLevel: Number.isFinite(saved.ambienceLevel)
        ? Math.max(0, Math.min(2, saved.ambienceLevel)) : DEFAULT_SETTINGS.ambienceLevel,
    };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

export function createGameAudio({ storage = browserStorage(), doc = globalThis.document, onStatusChange, onCue } = {}) {
  let settings = readAudioSettings(storage);
  let context = null;
  let master = null;
  let effects = null;
  let atmosphere = null;
  let ambienceSource = null;
  let impactNoise = null;
  let musicTimer = null;
  let voiceCount = 0;
  let transientVoiceCount = 0;
  let voiceLimit = 12;
  let scheduledVoiceSerial = 0;
  let phraseNumber = 0;
  let lastAlertAt = -Infinity;
  let duckUntil = -Infinity;
  let duckTimer = null;
  const lastCueAt = new Map();

  function hasAudibleOutput() {
    return settings.enabled && settings.volume > 0
      && (settings.effectsLevel > 0 || (settings.ambience && settings.ambienceLevel > 0));
  }

  function status() {
    if (!(globalThis.AudioContext || globalThis.webkitAudioContext)) return 'unavailable';
    if (!settings.enabled || settings.volume <= 0) return 'muted';
    if (settings.effectsLevel <= 0 && (!settings.ambience || settings.ambienceLevel <= 0)) return 'silent';
    return context?.state || 'waiting';
  }

  function emitStatus() { onStatusChange?.(status()); }

  function save() {
    try { storage?.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
  }

  function applyLevels() {
    if (!context) return;
    const at = context.currentTime;
    master.gain.setTargetAtTime(settings.enabled ? settings.volume * 0.78 : 0, at, 0.045);
    effects.gain.setTargetAtTime(0.52 * settings.effectsLevel, at, 0.045);
    const ducked = performance.now() < duckUntil;
    atmosphere.gain.setTargetAtTime(settings.enabled && settings.ambience
      ? (ducked ? 0.045 : 0.18) * settings.ambienceLevel : 0, at, ducked ? 0.04 : 0.25);
  }

  function makeContext() {
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) return false;
    try {
      context = new AudioContextClass({ latencyHint: 'interactive' });
      context.onstatechange = emitStatus;
      master = context.createGain();
      effects = context.createGain();
      atmosphere = context.createGain();
      effects.gain.value = 0.52;
      atmosphere.gain.value = 0;
      effects.connect(master);
      atmosphere.connect(master);
      master.connect(context.destination);
      applyLevels();
      createAmbience();
      musicTimer = globalThis.setInterval(scheduleMusic, 34000);
      emitStatus();
      return true;
    } catch {
      context = null;
      emitStatus();
      return false;
    }
  }

  function createAmbience() {
    const sampleRate = context.sampleRate;
    const sourceLength = Math.max(1, Math.floor(sampleRate * 12));
    const candidateFadeLength = Math.min(Math.floor(sampleRate * 0.12), Math.floor(sourceLength / 8));
    const fadeLength = candidateFadeLength >= 2 ? candidateFadeLength : 0;
    const loopLength = sourceLength - fadeLength;
    const buffer = context.createBuffer(1, loopLength, sampleRate);
    const data = buffer.getChannelData(0);
    const head = fadeLength > 0 ? new Float32Array(fadeLength) : null;
    const tail = fadeLength > 0 ? new Float32Array(fadeLength) : null;
    let random = 0x845ac17;
    let drift = 0;
    for (let i = 0; i < sourceLength; i++) {
      random ^= random << 13; random ^= random >>> 17; random ^= random << 5;
      drift = drift * 0.995 + ((random >>> 0) / 0xffffffff * 2 - 1) * 0.005;
      const sample = drift * 0.65;
      if (fadeLength > 0 && i < fadeLength) head[i] = sample;
      if (i < loopLength) data[i] = sample;
      if (fadeLength > 0 && i >= sourceLength - fadeLength) tail[i - (sourceLength - fadeLength)] = sample;
    }

    // Join the tail to the head over 120 ms so the longer wind loop does not click at its seam.
    if (fadeLength > 0) {
      const bodyLength = sourceLength - fadeLength * 2;
      data.copyWithin(0, fadeLength, loopLength);
      for (let i = 0; i < fadeLength; i++) {
        const progress = i / (fadeLength - 1);
        const outgoing = Math.cos(progress * Math.PI / 2);
        const incoming = Math.sin(progress * Math.PI / 2);
        data[bodyLength + i] = tail[i] * outgoing + head[i] * incoming;
      }
    }
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 480;
    ambienceSource = context.createBufferSource();
    ambienceSource.buffer = buffer;
    ambienceSource.loop = true;
    ambienceSource.connect(filter);
    filter.connect(atmosphere);
    ambienceSource.start();
  }

  function tone(frequency, start, duration, { wave = 'sine', gain = 0.2, endFrequency = frequency, destination = effects } = {}) {
    if (!context || voiceCount >= voiceLimit) return;
    voiceCount++;
    let oscillator;
    let envelope;
    try {
      oscillator = context.createOscillator();
      envelope = context.createGain();
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + Math.min(0.018, duration * 0.25));
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(envelope);
      envelope.connect(destination);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); voiceCount--; };
      oscillator.start(start);
      oscillator.stop(start + duration + 0.01);
      scheduledVoiceSerial++;
    } catch {
      if (oscillator) oscillator.onended = null;
      try { oscillator?.stop(); } catch {}
      oscillator?.disconnect();
      envelope?.disconnect();
      voiceCount--;
    }
  }

  function noiseBurst(start, duration, { centerFrequency = 1400, gain = 0.04, destination = effects } = {}) {
    if (!context || voiceCount >= voiceLimit || transientVoiceCount >= 2) return;
    transientVoiceCount++;
    let source;
    let filter;
    let envelope;
    try {
      if (!impactNoise) {
        const length = Math.max(1, Math.floor(context.sampleRate * 0.09));
        impactNoise = context.createBuffer(1, length, context.sampleRate);
        const samples = impactNoise.getChannelData(0);
        let random = 0x6d2b79f5;
        for (let i = 0; i < samples.length; i++) {
          random ^= random << 13; random ^= random >>> 17; random ^= random << 5;
          const fade = 1 - i / samples.length;
          samples[i] = ((random >>> 0) / 0x7fffffff - 1) * fade;
        }
      }
      source = context.createBufferSource();
      source.buffer = impactNoise;
      filter = context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = centerFrequency;
      if (filter.Q) filter.Q.value = 0.65;
      envelope = context.createGain();
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + Math.min(0.004, duration * 0.2));
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(filter);
      filter.connect(envelope);
      envelope.connect(destination);
      source.onended = () => {
        source.disconnect(); filter.disconnect(); envelope.disconnect(); transientVoiceCount--;
      };
      source.start(start);
      source.stop(start + duration + 0.01);
      scheduledVoiceSerial++;
    } catch {
      if (source) source.onended = null;
      try { source?.stop(); } catch {}
      source?.disconnect(); filter?.disconnect(); envelope?.disconnect();
      transientVoiceCount--;
    }
  }

  function scheduleMusic() {
    if (!context || context.state !== 'running' || !settings.enabled || settings.volume <= 0 || !settings.ambience || settings.ambienceLevel <= 0
      || doc?.hidden || performance.now() - lastAlertAt < 10000) return;
    const start = context.currentTime + 0.08;
    const chords = [[146.83, 220, 293.66], [130.81, 196, 261.63], [164.81, 246.94, 329.63]];
    const notes = chords[phraseNumber++ % chords.length];
    for (let i = 0; i < notes.length; i++) {
      tone(notes[i], start + i * 0.58, 1.85, { wave: 'sine', gain: 0.06, destination: atmosphere });
    }
  }

  function unlock() {
    if (!hasAudibleOutput() || doc?.hidden) return;
    if (!context && !makeContext()) return;
    if (context.state === 'suspended') context.resume().then(emitStatus).catch(() => {});
  }

  function play(cue, { preview = false } = {}) {
    if (!settings.enabled || settings.volume <= 0 || settings.effectsLevel <= 0 || doc?.hidden) return false;
    if (!context || context.state === 'closed' || !(cue in COOLDOWN_MS)) return false;
    const now = performance.now();
    if (!preview && now - (lastCueAt.get(cue) ?? -Infinity) < COOLDOWN_MS[cue]) return false;
    const at = context.currentTime + 0.005;
    const scheduledBefore = scheduledVoiceSerial;
    voiceLimit = cue.includes('alert') || ['base-lost', 'objective', 'objective-lost', 'victory', 'defeat', 'draw'].includes(cue)
      ? 20 : 12;
    switch (cue) {
      case 'select': tone(620, at, 0.055, { endFrequency: 780, gain: 0.13 }); break;
      case 'move': tone(310, at, 0.09, { wave: 'triangle', endFrequency: 390, gain: 0.19 }); break;
      case 'attack':
        noiseBurst(at, 0.045, { centerFrequency: 1550, gain: 0.045 });
        tone(260, at, 0.11, { wave: 'triangle', endFrequency: 205, gain: 0.23 });
        tone(490, at + 0.025, 0.07, { endFrequency: 370, gain: 0.1 });
        break;
      case 'gather': tone(420, at, 0.07, { wave: 'triangle', endFrequency: 550, gain: 0.14 }); break;
      case 'rally':
        tone(466.16, at, 0.09, { wave: 'triangle', gain: 0.12 });
        tone(698.46, at + 0.1, 0.14, { wave: 'sine', gain: 0.1 });
        break;
      case 'build':
        noiseBurst(at, 0.035, { centerFrequency: 900, gain: 0.032 });
        tone(175, at, 0.16, { wave: 'triangle', endFrequency: 147, gain: 0.19 });
        tone(350, at + 0.055, 0.09, { gain: 0.09 });
        break;
      case 'queue': tone(470, at, 0.06, { wave: 'triangle', gain: 0.12 }); tone(590, at + 0.095, 0.07, { wave: 'triangle', gain: 0.1 }); break;
      case 'complete': tone(392, at, 0.13, { gain: 0.17 }); tone(587, at + 0.13, 0.23, { gain: 0.15 }); break;
      case 'research-complete':
        tone(523.25, at, 0.13, { wave: 'triangle', gain: 0.14 });
        tone(622.25, at + 0.14, 0.17, { wave: 'triangle', gain: 0.12 });
        tone(783.99, at + 0.29, 0.25, { wave: 'triangle', gain: 0.11 });
        break;
      case 'scenario-reward':
        tone(493.88, at, 0.15, { wave: 'triangle', gain: 0.12 });
        tone(739.99, at + 0.12, 0.22, { wave: 'sine', gain: 0.1 });
        break;
      case 'building-complete':
        tone(185, at, 0.1, { wave: 'triangle', gain: 0.11 });
        tone(277.18, at + 0.15, 0.2, { wave: 'sine', gain: 0.09 });
        break;
      case 'reject': tone(250, at, 0.13, { wave: 'sawtooth', endFrequency: 185, gain: 0.11 }); break;
      case 'battle-alert': tone(196, at, 0.17, { wave: 'triangle', gain: 0.14 }); tone(246.94, at + 0.17, 0.21, { wave: 'triangle', gain: 0.12 }); break;
      case 'selected-alert': tone(329.63, at, 0.11, { gain: 0.16 }); tone(220, at + 0.12, 0.22, { gain: 0.15 }); break;
      case 'base-alert': tone(174.61, at, 0.17, { wave: 'triangle', gain: 0.18 }); tone(174.61, at + 0.24, 0.22, { wave: 'triangle', gain: 0.15 }); break;
      case 'objective':
        tone(440, at, 0.16, { wave: 'sine', gain: 0.15 });
        tone(554.37, at + 0.13, 0.2, { wave: 'sine', gain: 0.13 });
        tone(659.25, at + 0.26, 0.28, { wave: 'sine', gain: 0.12 });
        break;
      case 'objective-lost': tone(349.23, at, 0.18, { gain: 0.15 }); tone(261.63, at + 0.17, 0.27, { gain: 0.13 }); break;
      case 'resource-empty': tone(415.3, at, 0.11, { wave: 'triangle', endFrequency: 311.13, gain: 0.11 }); break;
      case 'base-lost':
        tone(233.08, at, 0.16, { wave: 'sawtooth', endFrequency: 155.56, gain: 0.13 });
        tone(138.59, at + 0.11, 0.26, { wave: 'triangle', endFrequency: 103.83, gain: 0.16 });
        tone(116.54, at + 0.31, 0.3, { wave: 'triangle', endFrequency: 87.31, gain: 0.13 });
        break;
      case 'victory': for (const [i, hz] of [880, 1108.73, 1318.51, 1760].entries()) tone(hz, at + i * 0.17, 0.48, { gain: 0.18 }); break;
      case 'defeat': for (const [i, hz] of [329.63, 261.63, 196].entries()) tone(hz, at + i * 0.2, 0.4, { gain: 0.14 }); break;
      case 'draw': tone(293.66, at, 0.34, { gain: 0.13 }); tone(293.66, at + 0.34, 0.35, { gain: 0.11 }); break;
    }
    voiceLimit = 12;
    const scheduled = scheduledVoiceSerial > scheduledBefore;
    if (scheduled) {
      if (!preview) lastCueAt.set(cue, now);
      if (!preview && (cue.includes('alert') || ['victory', 'defeat', 'draw', 'objective', 'objective-lost', 'base-lost'].includes(cue))) {
        lastAlertAt = now;
        duckUntil = now + 2400;
        applyLevels();
        if (duckTimer !== null) globalThis.clearTimeout(duckTimer);
        duckTimer = globalThis.setTimeout(() => { duckTimer = null; applyLevels(); }, 2450);
      }
      if (!preview) {
        try { onCue?.(cue); } catch {}
      }
    }
    return scheduled;
  }

  function preview(cue) { return play(cue, { preview: true }); }

  function setSettings(next) {
    settings = {
      enabled: typeof next.enabled === 'boolean' ? next.enabled : settings.enabled,
      volume: Number.isFinite(next.volume) ? Math.max(0, Math.min(1, next.volume)) : settings.volume,
      effectsLevel: Number.isFinite(next.effectsLevel)
        ? Math.max(0, Math.min(2, next.effectsLevel)) : settings.effectsLevel,
      ambience: typeof next.ambience === 'boolean' ? next.ambience : settings.ambience,
      ambienceLevel: Number.isFinite(next.ambienceLevel)
        ? Math.max(0, Math.min(2, next.ambienceLevel)) : settings.ambienceLevel,
    };
    save();
    applyLevels();
    if (hasAudibleOutput()) unlock();
    else context?.suspend().catch(() => {});
    emitStatus();
    return { ...settings };
  }

  function onVisibilityChange() {
    if (!context) return;
    if (doc?.hidden) context.suspend().then(emitStatus).catch(() => {});
    else if (hasAudibleOutput()) context.resume().then(emitStatus).catch(() => {});
  }
  doc?.addEventListener?.('visibilitychange', onVisibilityChange);

  return {
    play, preview, unlock, setSettings,
    getSettings: () => ({ ...settings }), getStatus: status,
    dispose() {
      doc?.removeEventListener?.('visibilitychange', onVisibilityChange);
      if (musicTimer !== null) globalThis.clearInterval(musicTimer);
      if (duckTimer !== null) globalThis.clearTimeout(duckTimer);
      ambienceSource?.stop();
      context?.close().catch(() => {});
    },
  };
}
