import { compileComposition } from './composition.mjs';

function wavBlob(buffer) {
  const channels = Math.min(2, buffer.numberOfChannels);
  const samples = buffer.length;
  const bytes = new ArrayBuffer(44 + samples * channels * 2);
  const view = new DataView(bytes);
  let pos = 0;
  const write = text => { for (const char of text) view.setUint8(pos++, char.charCodeAt(0)); };
  write('RIFF'); view.setUint32(pos, bytes.byteLength - 8, true); pos += 4;
  write('WAVEfmt '); view.setUint32(pos, 16, true); pos += 4;
  view.setUint16(pos, 1, true); pos += 2;
  view.setUint16(pos, channels, true); pos += 2;
  view.setUint32(pos, buffer.sampleRate, true); pos += 4;
  view.setUint32(pos, buffer.sampleRate * channels * 2, true); pos += 4;
  view.setUint16(pos, channels * 2, true); pos += 2;
  view.setUint16(pos, 16, true); pos += 2;
  write('data'); view.setUint32(pos, samples * channels * 2, true); pos += 4;
  const data = Array.from({length: channels}, (_, channel) => buffer.getChannelData(channel));
  for (let frame = 0; frame < samples; frame++) for (let channel = 0; channel < channels; channel++) {
    const sample = Math.max(-1, Math.min(1, data[channel][frame]));
    view.setInt16(pos, sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767), true);
    pos += 2;
  }
  return new Blob([bytes], {type: 'audio/wav'});
}

export async function renderCompositionWav(composition, sourceBlobs, {OfflineContext = globalThis.OfflineAudioContext, sampleRate = 44100} = {}) {
  if (!OfflineContext) throw new Error('Offline audio rendering is unavailable in this browser');
  const {durationSeconds, events} = compileComposition(composition);
  if (durationSeconds > 300) throw new Error('WAV export is limited to five minutes per composition');
  const context = new OfflineContext(2, Math.ceil(durationSeconds * sampleRate), sampleRate);
  const cache = new Map();
  for (const event of events) {
    const blob = sourceBlobs?.[event.sourceId];
    if (!(blob instanceof Blob)) throw new Error(`Missing recording for source ${event.sourceId}`);
    if (!cache.has(event.sourceId)) {
      let bytes;
      try { bytes = await blob.arrayBuffer(); }
      catch (error) {
        if (!(error instanceof DOMException) || !['NotFoundError', 'NotReadableError', 'SecurityError'].includes(error.name)) throw error;
        throw new Error(`Could not read recording ${event.sourceId}. Reopen the library and retry.`, {cause: error});
      }
      try { cache.set(event.sourceId, await context.decodeAudioData(bytes)); }
      catch (error) {
        if (!(error instanceof DOMException) || error.name !== 'EncodingError') throw error;
        throw new Error(`Could not decode recording ${event.sourceId}`, {cause: error});
      }
    }
    const buffer = cache.get(event.sourceId);
    if (event.offsetSeconds >= buffer.duration) throw new Error(`Clip offset exceeds recording ${event.sourceId}`);
    const audible = event.loop ? event.durationSeconds : Math.min(event.durationSeconds, buffer.duration - event.offsetSeconds);
    if (audible <= 0) continue;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const panner = context.createStereoPanner();
    source.buffer = buffer;
    source.loop = event.loop;
    if (event.loop) { source.loopStart = event.offsetSeconds; source.loopEnd = buffer.duration; }
    panner.pan.value = event.pan;
    source.connect(gain); gain.connect(panner); panner.connect(context.destination);
    const start = event.startSeconds;
    const end = start + audible;
    const fadeIn = Math.min(event.fadeInSeconds, audible / 2);
    const fadeOut = Math.min(event.fadeOutSeconds, audible / 2);
    gain.gain.setValueAtTime(fadeIn ? 0 : event.gain, start);
    if (fadeIn) gain.gain.linearRampToValueAtTime(event.gain, start + fadeIn);
    if (fadeOut) {
      gain.gain.setValueAtTime(event.gain, end - fadeOut);
      gain.gain.linearRampToValueAtTime(0, end);
    }
    if (event.loop) { source.start(start, event.offsetSeconds); source.stop(end); }
    else source.start(start, event.offsetSeconds, audible);
  }
  return wavBlob(await context.startRendering());
}
