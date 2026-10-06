import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { mountAudioComposer } from '../src/client/audio/composer.mjs';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const drain = () => new Promise(resolve => setImmediate(resolve));
const composition = { schemaVersion: 1, id: 'a', name: 'First mix', bpm: 120, beatsPerBar: 4, lengthBars: 1,
  tracks: [{ id: 't', name: 'Track', gain: 1, pan: 0, mute: false, solo: false,
    clips: [{ id: 'clip', sourceId: 's', startBeat: 0, durationBeats: 1, offsetSeconds: 0,
      gain: 1, loop: false, fadeInSeconds: 0, fadeOutSeconds: 0 }] }] };

function fixture(t, { savePromise } = {}) {
  const dom = new JSDOM('<main></main>');
  const saved = ['document', 'Element', 'OfflineAudioContext', 'AudioContext', 'setTimeout']
    .map(key => [globalThis, key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  for (const key of ['createObjectURL', 'revokeObjectURL']) saved.push([URL, key, Object.getOwnPropertyDescriptor(URL, key)]);
  const node = () => ({ connect() {}, disconnect() {} });
  const param = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {} });
  const renders = [], urls = [], downloads = [], timers = [], revoked = [];
  let renderReached;
  const previewReached = deferred();
  class AudioContext {
    destination = node(); currentTime = 0;
    async resume() { previewReached.resolve(); }
    async close() {}
    async decodeAudioData() { return { duration: 1, length: 10, numberOfChannels: 1 }; }
    createBufferSource() { return { ...node(), start() {}, stop() {} }; }
    createGain() { return { ...node(), gain: param() }; }
    createStereoPanner() { return { ...node(), pan: param() }; }
  }
  class OfflineContext extends AudioContext {
    constructor(channels, length, sampleRate) { super(); Object.assign(this, { length, sampleRate }); }
    startRendering() {
      const done = deferred();
      const attempt = { length: this.length, fail: done.reject,
        finish: () => done.resolve({ numberOfChannels: 2, length: this.length,
          sampleRate: this.sampleRate, getChannelData: () => new Float32Array(this.length) }) };
      renders.push(attempt); renderReached.resolve(attempt); return done.promise;
    }
  }
  Object.assign(globalThis, { document: dom.window.document, Element: dom.window.Element,
    OfflineAudioContext: OfflineContext, AudioContext, setTimeout(callback, ms) { timers.push({ callback, ms }); return timers.length; } });
  URL.createObjectURL = blob => { const url = `blob:export-${urls.length}`; urls.push({ url, blob }); return url; };
  URL.revokeObjectURL = url => revoked.push(url);
  dom.window.HTMLAnchorElement.prototype.click = function () { downloads.push({ href: this.href, filename: this.download }); };
  const second = { ...structuredClone(composition), id: 'b', name: 'Second mix', lengthBars: 2 };
  const pack = { sources: [{ id: 's', name: 'Recording' }], compositions: [structuredClone(composition), second] };
  const before = structuredClone(pack);
  const blob = new Blob(['original recording bytes']), sourceBlobs = { s: blob };
  const saves = [];
  const editor = mountAudioComposer(document.querySelector('main'), { pack, sourceBlobs, onChange(next) { saves.push(next); return savePromise; } });
  const root = document.querySelector('.audio-composer');
  const click = action => root.querySelector(`[data-action="${action}"]`).click();
  const status = () => root.querySelector('[role="status"]').textContent;
  const field = (key, value, event = 'input') => {
    const element = root.querySelector(`[data-field="${key}"]`); element.value = value;
    element.dispatchEvent(new dom.window.Event(event, { bubbles: true }));
  };
  t.after(() => {
    editor.dispose();
    for (const [object, key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(object, key, descriptor); else delete object[key];
    }
    dom.window.close();
    assert.deepEqual(pack, before, 'export/control transitions do not mutate the supplied pack');
    assert.equal(sourceBlobs.s, blob, 'original recording remains intact');
  });
  return { renders, urls, downloads, timers, revoked, saves, editor, root, click, status, field,
    async play() { click('play'); await previewReached.promise; await drain(); },
    select(id) { const element = root.querySelector('[data-action="select-composition"]'); element.value = id;
      element.dispatchEvent(new dom.window.Event('change', { bubbles: true })); },
    start() { renderReached = deferred(); click('export'); return renderReached.promise; },
  };
}

function noPublication(f) {
  assert.deepEqual(f.urls, []); assert.deepEqual(f.downloads, []); assert.deepEqual(f.timers, []);
}

test('current export keeps initiating filename, WAV duration and ordinary URL cleanup', async t => {
  const f = fixture(t);
  const pending = await f.start(); pending.finish(); await drain();
  assert.equal(pending.length, 2 * 44100);
  assert.deepEqual(f.downloads, [{ href: 'blob:export-0', filename: 'First-mix.wav' }]);
  const header = new DataView(await f.urls[0].blob.arrayBuffer());
  assert.equal(header.getUint32(40, true), pending.length * 2 * 2);
  assert.equal(f.status(), 'WAV exported.');
  assert.equal(f.saves.length, 0);
  assert.equal(f.timers.length, 1); assert.equal(f.timers[0].ms, 60000);
  f.timers[0].callback(); assert.deepEqual(f.revoked, ['blob:export-0']);
});

test('rename/edit discards old output and retry exports the edited draft under its own name', async t => {
  const f = fixture(t);
  const old = await f.start();
  f.field('name', 'Edited mix'); f.field('lengthBars', '2');
  old.finish(); await drain();
  noPublication(f); assert.equal(f.status(), '');
  assert.equal(f.root.querySelector('[data-action="save"]').textContent, 'Save *');
  const retry = await f.start(); retry.finish(); await drain();
  assert.equal(retry.length, 4 * 44100);
  assert.equal(f.downloads[0].filename, 'Edited-mix.wav');
  assert.equal(f.saves.length, 0);
});

test('composition selection discards the old render and retry exports the selected composition', async t => {
  const f = fixture(t);
  const old = await f.start(); f.select('b'); old.finish(); await drain();
  noPublication(f); assert.equal(f.status(), '');
  const retry = await f.start(); retry.finish(); await drain();
  assert.equal(old.length, 2 * 44100); assert.equal(retry.length, 4 * 44100);
  assert.equal(f.downloads[0].filename, 'Second-mix.wav');
});

for (const result of ['success', 'failure']) {
  test(`Stop discards late export ${result} and preserves the stopped status`, async t => {
    const f = fixture(t);
    const pending = await f.start(); f.click('stop');
    if (result === 'success') pending.finish(); else pending.fail(new Error('Obsolete render failure'));
    await drain(); noPublication(f); assert.equal(f.status(), 'Preview stopped.');
  });

  test(`invalid edit status survives late export ${result}`, async t => {
    const f = fixture(t);
    const pending = await f.start(); f.field('bpm', '0', 'change');
    const validation = f.status(); assert.match(validation, /bpm must be/);
    if (result === 'success') pending.finish(); else pending.fail(new Error('Obsolete render failure'));
    await drain(); noPublication(f); assert.equal(f.status(), validation);
  });

  for (const timing of ['before retry completes', 'after retry completes']) {
    test(`obsolete export ${result} ${timing} cannot publish or change retry status`, async t => {
      const f = fixture(t);
      const old = await f.start(); const retry = await f.start();
      if (timing === 'after retry completes') { retry.finish(); await drain(); }
      if (result === 'success') old.finish(); else old.fail(new Error('Obsolete render failure'));
      await drain();
      assert.equal(f.status(), timing === 'before retry completes' ? 'Rendering WAV…' : 'WAV exported.');
      assert.equal(f.downloads.length, timing === 'before retry completes' ? 0 : 1);
      if (timing === 'before retry completes') { retry.finish(); await drain(); }
      assert.equal(f.downloads.length, 1); assert.equal(f.urls.length, 1); assert.equal(f.timers.length, 1);
    });
  }

  test(`disposal discards late export ${result} without allocating URLs`, async t => {
    const f = fixture(t);
    const pending = await f.start(); f.editor.dispose();
    const priorStatus = f.status();
    if (result === 'success') pending.finish(); else pending.fail(new Error('Obsolete render failure'));
    await drain(); noPublication(f); assert.equal(f.root.isConnected, false); assert.equal(f.status(), priorStatus);
  });
}

test('New composition, Save and Play each supersede pending export completion', async t => {
  const f = fixture(t);
  const saved = await f.start(); f.click('save'); await drain();
  assert.equal(f.status(), 'Composition saved.'); assert.equal(f.saves.length, 1);
  saved.finish(); await drain(); noPublication(f); assert.equal(f.status(), 'Composition saved.');
  const playing = await f.start(); await f.play();
  assert.equal(f.status(), 'Preview playing.');
  playing.fail(new Error('Obsolete render failure')); await drain(); noPublication(f); assert.equal(f.status(), 'Preview playing.');
  const fresh = await f.start(); f.click('new'); fresh.finish(); await drain();
  noPublication(f); assert.equal(f.status(), '');
  assert.equal(f.root.querySelector('[data-field="name"]').value, 'New composition');
});

test('current rendering failure keeps its message and cause and allows a successful retry', async t => {
  const f = fixture(t);
  const cause = new Error('private details');
  const error = new Error('Offline render failed. Try export again.', { cause });
  const pending = await f.start(); pending.fail(error); await drain();
  noPublication(f); assert.equal(f.status(), error.message); assert.equal(error.cause, cause);
  const retry = await f.start(); retry.finish(); await drain();
  assert.equal(f.status(), 'WAV exported.'); assert.equal(f.downloads.length, 1);
});

test('Save clears cancelled export progress while persistence is pending', async t => {
  const persistence = deferred();
  const f = fixture(t, { savePromise: persistence.promise });
  const pending = await f.start(); f.click('save');
  assert.equal(f.status(), '');
  pending.finish(); await drain(); noPublication(f); assert.equal(f.status(), '');
  persistence.resolve(); await drain(); assert.equal(f.status(), 'Composition saved.');
});

test('track selection without an edit still permits the current export', async t => {
  const f = fixture(t);
  const pending = await f.start(); f.click('select-track'); pending.finish(); await drain();
  assert.equal(f.downloads.length, 1); assert.equal(f.downloads[0].filename, 'First-mix.wav');
});
