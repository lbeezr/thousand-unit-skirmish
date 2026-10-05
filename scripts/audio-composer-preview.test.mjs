import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { mountAudioComposer } from '../src/audio-composer.mjs';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const drain = () => new Promise(resolve => setImmediate(resolve));
const composition = { schemaVersion: 1, id: 'c', name: 'Preview', bpm: 120, beatsPerBar: 4, lengthBars: 1,
  tracks: [{ id: 't', name: 'Track', gain: 1, pan: 0, mute: false, solo: false,
    clips: [{ id: 'clip', sourceId: 's', startBeat: 0, durationBeats: 1, offsetSeconds: 0,
      gain: 1, loop: false, fadeInSeconds: 0, fadeOutSeconds: 0 }] }] };

function fixture(t) {
  const dom = new JSDOM('<main></main>');
  const saved = ['document', 'Element', 'AudioContext'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  const node = () => ({ connect() {}, disconnect() {} });
  const param = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {} });
  const resumes = [], starts = [], stops = [];
  let reached;
  let closes = 0, decodes = 0;
  const context = { destination: node(), currentTime: 0,
    resume() { const attempt = deferred(); resumes.push(attempt); reached.resolve(attempt); return attempt.promise; },
    close() { closes++; return Promise.resolve(); },
    async decodeAudioData() { decodes++; return { duration: 1, length: 10, numberOfChannels: 1 }; },
    createBufferSource() { return { ...node(), start(...args) { starts.push(args); }, stop(...args) { stops.push(args); } }; },
    createGain() { return { ...node(), gain: param() }; },
    createStereoPanner() { return { ...node(), pan: param() }; },
  };
  Object.assign(globalThis, { document: dom.window.document, Element: dom.window.Element,
    AudioContext: function () { return context; } });
  const pack = { sources: [{ id: 's', name: 'Recording' }], compositions: [structuredClone(composition)] };
  const blob = new Blob(['original recording']);
  const sourceBlobs = { s: blob };
  const editor = mountAudioComposer(document.querySelector('main'), { pack, sourceBlobs, onChange() {} });
  const root = document.querySelector('.audio-composer');
  const click = action => root.querySelector(`[data-action="${action}"]`).click();
  const status = () => root.querySelector('[role="status"]').textContent;
  t.after(() => {
    editor.dispose(); dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
    assert.deepEqual(pack.compositions, [composition], 'preview leaves saved metadata intact');
    assert.equal(sourceBlobs.s, blob, 'preview preserves original recording');
  });
  return { context, starts, stops, resumes, root, click, status, editor,
    closes: () => closes, decodes: () => decodes,
    play() { reached = deferred(); click('play'); return reached.promise; },
  };
}

test('Stop during context resume prevents decoding and scheduling; Play can retry', async t => {
  const f = fixture(t);
  const pending = await f.play();
  f.click('stop'); pending.resolve(); await drain();
  assert.equal(f.starts.length, 0);
  assert.equal(f.decodes(), 0);
  assert.equal(f.status(), 'Preview stopped.');
  const retry = await f.play(); retry.resolve(); await drain();
  assert.equal(f.starts.length, 1);
  assert.equal(f.status(), 'Preview playing.');
  f.click('stop'); assert.deepEqual(f.stops.at(-1), []);
});

test('late resume failure leaves stopped status intact', async t => {
  const f = fixture(t);
  const pending = await f.play();
  f.click('stop'); pending.reject(new Error('Old attempt failed')); await drain();
  assert.equal(f.status(), 'Preview stopped.');
  assert.equal(f.starts.length, 0);
});

for (const result of ['success', 'failure']) {
  test(`obsolete resume ${result} cannot stop or overwrite a successful retry`, async t => {
    const f = fixture(t);
    const old = await f.play();
    const retry = await f.play(); retry.resolve(); await drain();
    const stops = f.stops.length;
    if (result === 'success') old.resolve(); else old.reject(new Error('Old attempt failed'));
    await drain();
    assert.equal(f.starts.length, 1);
    assert.equal(f.stops.length, stops, 'obsolete success cannot call player.play and stop the retry');
    assert.equal(f.status(), 'Preview playing.');
  });
}

test('editing, selecting or starting a new composition cancels pending resume', async t => {
  const f = fixture(t);
  const pending = await f.play();
  const field = f.root.querySelector('[data-field="bpm"]');
  field.value = '96'; field.dispatchEvent(new field.ownerDocument.defaultView.Event('input', { bubbles: true }));
  pending.resolve(); await drain();
  assert.equal(f.starts.length, 0);
  const selected = await f.play();
  const select = f.root.querySelector('[data-action="select-composition"]');
  select.dispatchEvent(new select.ownerDocument.defaultView.Event('change', { bubbles: true }));
  selected.resolve(); await drain();
  assert.equal(f.starts.length, 0);
  const next = await f.play(); f.click('new'); next.resolve(); await drain();
  assert.equal(f.starts.length, 0);
  assert.equal(f.status(), '');
});

test('disposal during resume closes once and schedules no audio', async t => {
  const f = fixture(t);
  const pending = await f.play();
  f.editor.dispose(); pending.resolve(); await drain();
  f.editor.dispose();
  assert.equal(f.closes(), 1);
  assert.equal(f.starts.length, 0);
  assert.equal(f.decodes(), 0);
  assert.equal(f.root.isConnected, false);
});

test('active failure keeps its message and original cause; retry succeeds', async t => {
  const f = fixture(t);
  const cause = new Error('private recording details');
  const error = new Error('Audio permission unavailable. Try Play again.', { cause });
  const pending = await f.play(); pending.reject(error); await drain();
  assert.equal(f.status(), `Preview unavailable: ${error.message}`);
  assert.equal(error.cause, cause);
  assert.equal(f.root.querySelector('[role="status"]').dataset.error, 'true');
  const retry = await f.play(); retry.resolve(); await drain();
  assert.equal(f.starts.length, 1);
  assert.equal(f.status(), 'Preview playing.');
});

test('current programmer fault keeps its diagnostic instead of becoming an input error', async t => {
  const f = fixture(t);
  const fault = new TypeError('Unexpected decoder fault');
  f.context.decodeAudioData = async () => { throw fault; };
  const pending = await f.play(); pending.resolve(); await drain();
  assert.equal(f.status(), 'Preview unavailable: Unexpected decoder fault');
  assert.equal(f.starts.length, 0);
});

test('late decode success or failure after Stop cannot schedule or replace its status', async t => {
  const f = fixture(t);
  for (const result of ['success', 'failure']) {
    const decoded = deferred(), reached = deferred();
    f.context.decodeAudioData = () => { reached.resolve(); return decoded.promise; };
    const pending = await f.play(); pending.resolve(); await reached.promise;
    f.click('stop');
    if (result === 'success') decoded.resolve({ duration: 1, length: 10, numberOfChannels: 1 });
    else decoded.reject(new TypeError('Unexpected decoder fault'));
    await drain();
    assert.equal(f.starts.length, 0);
    assert.equal(f.status(), 'Preview stopped.');
  }
});
