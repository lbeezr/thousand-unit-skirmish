import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { mountAudioComposer, renderCompositionWav } from '../src/audio-composer.mjs';

const composition = { schemaVersion: 1, id: 'c', name: 'Export', bpm: 120, beatsPerBar: 4, lengthBars: 1,
  tracks: [{ id: 't', name: 'Track', gain: 1, pan: 0, mute: false, solo: false,
    clips: [{ id: 'clip', sourceId: 's', startBeat: 0, durationBeats: 1, offsetSeconds: 0,
      gain: 1, loop: false, fadeInSeconds: 0, fadeOutSeconds: 0 }] }] };
const node = () => ({ connect() {} });
const param = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {} });

function fixture({ readError, decodeError } = {}) {
  let reads = 0, decodes = 0, renders = 0, starts = 0, constructions = 0;
  const originalBytes = 'private original recording bytes';
  class Recording extends Blob {
    async arrayBuffer() { reads++; if (readError) throw readError; return super.arrayBuffer(); }
  }
  class Context {
    constructor(channels, length, sampleRate) {
      constructions++; Object.assign(this, { channels, length, sampleRate, destination: node() });
    }
    async decodeAudioData(bytes) {
      decodes++; assert.equal(new TextDecoder().decode(bytes), originalBytes);
      if (decodeError) throw decodeError;
      return { duration: 1 };
    }
    createBufferSource() { return { ...node(), start() { starts++; }, stop() {} }; }
    createGain() { return { ...node(), gain: param() }; }
    createStereoPanner() { return { ...node(), pan: param() }; }
    async startRendering() { renders++; return { numberOfChannels: 2, length: this.length,
      sampleRate: this.sampleRate, getChannelData: () => new Float32Array(this.length) }; }
  }
  const blob = new Recording([originalBytes]);
  const blobs = { s: blob };
  return { Context, blob, blobs, counts: () => ({ reads, decodes, renders, starts, constructions }),
    repair() { readError = null; decodeError = null; },
    export: (value = composition) => renderCompositionWav(value, blobs, { OfflineContext: Context, sampleRate: 100 }),
  };
}

for (const name of ['NotFoundError', 'NotReadableError', 'SecurityError']) {
  test(`native Blob ${name} keeps its cause behind a safe read message and can retry`, async () => {
    const original = new DOMException('private path/token details', name);
    const f = fixture({ readError: original });
    await assert.rejects(f.export(), error => {
      assert.equal(error.message, 'Could not read recording s. Reopen the library and retry.');
      assert.equal(error.cause, original);
      return true;
    });
    assert.deepEqual(f.counts(), { reads: 1, decodes: 0, renders: 0, starts: 0, constructions: 1 });
    f.repair();
    assert.equal((await f.export()).type, 'audio/wav');
    assert.equal(await f.blob.text(), 'private original recording bytes');
    assert.equal(f.counts().constructions, 2, 'retry gets its own offline context');
  });
}

test('native EncodingError keeps the existing decode message and exact cause; repaired retry matches valid WAV bytes', async () => {
  const original = new DOMException('private decoder details', 'EncodingError');
  const f = fixture({ decodeError: original });
  await assert.rejects(f.export(), error => {
    assert.equal(error.message, 'Could not decode recording s');
    assert.equal(error.cause, original);
    return true;
  });
  assert.deepEqual(f.counts(), { reads: 1, decodes: 1, renders: 0, starts: 0, constructions: 1 });
  f.repair();
  const retry = new Uint8Array(await (await f.export()).arrayBuffer());
  const valid = new Uint8Array(await (await fixture().export()).arrayBuffer());
  assert.deepEqual(retry, valid);
  assert.equal(await f.blob.text(), 'private original recording bytes');
});

for (const phase of ['read', 'decode']) {
  for (const original of [new TypeError('adapter fault'), new RangeError('allocation fault'),
    Object.assign(new Error('name alone is not a native failure'), { name: phase === 'read' ? 'NotReadableError' : 'EncodingError' }),
    new DOMException('wrong phase or lifecycle', phase === 'read' ? 'EncodingError' : 'InvalidStateError')]) {
    test(`${phase} unexpected ${original.name} keeps exact error identity and performs no rendering`, async () => {
      const f = fixture({ [`${phase}Error`]: original });
      await assert.rejects(f.export(), error => error === original);
      assert.equal(f.counts().renders, 0);
      assert.equal(f.counts().starts, 0);
      if (phase === 'read') assert.equal(f.counts().decodes, 0);
    });
  }
}

test('repeated clips read and decode once per source; valid WAV header and timing remain intact', async () => {
  const f = fixture();
  const repeated = structuredClone(composition);
  repeated.tracks[0].clips.push({ ...repeated.tracks[0].clips[0], id: 'repeat', startBeat: 1 });
  const wav = await f.export(repeated);
  assert.deepEqual(f.counts(), { reads: 1, decodes: 1, renders: 1, starts: 2, constructions: 1 });
  const header = new DataView(await wav.arrayBuffer());
  assert.equal(header.getUint32(24, true), 100);
  assert.equal(header.getUint32(40, true), 200 * 2 * 2);
});

test('mounted export displays safe read/decode messages without exposing native details or changing saved metadata', async t => {
  const dom = new JSDOM('<main></main>');
  const saved = ['document', 'Element', 'OfflineAudioContext'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  Object.assign(globalThis, { document: dom.window.document, Element: dom.window.Element });
  t.after(() => {
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  });
  for (const phase of ['read', 'decode']) {
    const f = fixture({ [`${phase}Error`]: new DOMException('private path/token details', phase === 'read' ? 'NotReadableError' : 'EncodingError') });
    globalThis.OfflineAudioContext = f.Context;
    const pack = { sources: [{ id: 's', name: 'Recording' }], compositions: [structuredClone(composition)] };
    let saves = 0;
    const editor = mountAudioComposer(document.querySelector('main'), { pack, sourceBlobs: f.blobs, onChange() { saves++; } });
    try {
      document.querySelector('[data-action="export"]').click();
      await new Promise(resolve => setImmediate(resolve));
      const status = document.querySelector('[role="status"]');
      assert.equal(status.dataset.error, 'true');
      assert.equal(status.textContent, phase === 'read'
        ? 'Could not read recording s. Reopen the library and retry.' : 'Could not decode recording s');
      assert.equal(saves, 0);
      assert.deepEqual(pack.compositions, [composition]);
    } finally { editor.dispose(); }
  }
});
