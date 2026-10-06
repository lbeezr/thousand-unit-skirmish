import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const drain = () => new Promise(resolve => setImmediate(resolve));
const recording = () => new Blob(['original recording bytes'], { type: 'audio/wav' });
function pack(id = 'alpha', name = 'Alpha') {
  return { schemaVersion: 1, id, name,
    sources: [{ id: 'wood', name: 'Wood', fileName: 'wood.wav', mimeType: 'audio/wav', tags: ['worker'],
      provenance: { provider: 'local', prompt: 'Original notes' } }],
    profiles: [{ id: 'default', name: 'Default', bindings: {}, music: {} }],
    compositions: [{ schemaVersion: 1, id: 'mix', name: 'First mix', bpm: 120, beatsPerBar: 4, lengthBars: 1,
      tracks: [{ id: 'track', name: 'Track', gain: 1, pan: 0, mute: false, solo: false,
        clips: [{ id: 'clip', sourceId: 'wood', startBeat: 0, durationBeats: 1, offsetSeconds: 0,
          gain: 1, loop: false, fadeInSeconds: 0, fadeOutSeconds: 0 }] }] }],
  };
}

// Real DOM controls call the real mount with a bounded store/audio adapter.
// This exercises consumer behavior; it is not a browser/IndexedDB/listening proof.
export async function verifyAudioLibraryUiConsumers(mountAudioLibrary) {
  const cases = [];
  async function check(name, action) {
    const dom = new JSDOM('<main id="studio"></main>', { url: 'https://fixture.example/audio-studio.html' });
    const saved = [];
    function replace(object, key, value) {
      saved.push([object, key, Object.getOwnPropertyDescriptor(object, key)]);
      Object.defineProperty(object, key, { value, configurable: true, writable: true });
    }
    const calls = [], records = new Map(), urls = [], revoked = [], timers = [], downloads = [], plays = [], pauses = [], contexts = [];
    const original = recording();
    records.set('alpha', { pack: pack(), sourceBlobs: { wood: original } });
    records.set('beta', { pack: pack('beta', 'Beta'), sourceBlobs: { wood: original } });
    const archive = new Blob(['original backup bytes'], { type: 'application/json' });
    const faults = {};
    const store = {
      async listPacks() { calls.push(['list']); return [...records.values()].map(({ pack }) => ({ id: pack.id, name: pack.name, sourceCount: pack.sources.length })); },
      async loadPack(id) { calls.push(['load', id]); const entry = records.get(id); return entry && { pack: structuredClone(entry.pack), sourceBlobs: { ...entry.sourceBlobs } }; },
      async savePack(value, changedBlobs = {}) {
        calls.push(['save', structuredClone(value), { ...changedBlobs }]);
        if (faults.save) throw faults.save;
        const next = structuredClone(value), previous = records.get(next.id);
        records.set(next.id, { pack: next, sourceBlobs: { ...previous?.sourceBlobs, ...changedBlobs } });
        return structuredClone(next);
      },
      async deletePack(id) { calls.push(['delete', id]); records.delete(id); },
      async exportPack(id) { calls.push(['export', id]); return archive; },
      async importPack(file) {
        calls.push(['import', file]); if (faults.import) throw faults.import;
        const imported = pack('imported', 'Imported');
        records.set(imported.id, { pack: imported, sourceBlobs: { wood: original } });
        return structuredClone(imported);
      },
    };
    replace(globalThis, 'document', dom.window.document);
    replace(globalThis, 'Element', dom.window.Element);
    let confirmation = false;
    replace(globalThis, 'confirm', value => { calls.push(['confirm', value]); return confirmation; });
    replace(globalThis, 'setTimeout', (callback, ms) => { timers.push({ callback, ms }); return timers.length; });
    replace(URL, 'createObjectURL', blob => { const url = `blob:library-${urls.length}`; urls.push({ url, blob }); return url; });
    replace(URL, 'revokeObjectURL', url => revoked.push(url));
    replace(dom.window.HTMLAnchorElement.prototype, 'click', function () { downloads.push({ href: this.getAttribute('href'), name: this.download }); });
    replace(dom.window.HTMLMediaElement.prototype, 'play', function () { plays.push(this); return Promise.resolve(); });
    replace(dom.window.HTMLMediaElement.prototype, 'pause', function () { pauses.push(this); });
    const node = () => ({ connect() {}, disconnect() {} });
    const parameter = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} });
    replace(globalThis, 'AudioContext', function () {
      const context = { destination: node(), currentTime: 0, closes: 0, starts: 0, decodes: 0,
        resume() { return Promise.resolve(); }, close() { this.closes++; return Promise.resolve(); },
        async decodeAudioData() { this.decodes++; return { duration: 1, length: 10, numberOfChannels: 1 }; },
        createBufferSource() { return { ...node(), start() { context.starts++; }, stop() {} }; },
        createGain() { return { ...node(), gain: parameter() }; },
        createStereoPanner() { return { ...node(), pan: parameter() }; },
      };
      contexts.push(context); return context;
    });
    const container = document.querySelector('main');
    let mounted;
    const mount = () => { mounted = mountAudioLibrary(container, { store }); return mounted; };
    const dispose = () => { mounted?.dispose(); mounted = null; };
    const settle = async () => { for (let i = 0; i < 8; i++) await drain(); };
    const click = text => {
      const buttons = [...container.querySelectorAll('button')].filter(button => button.textContent === text);
      assert.equal(buttons.length, 1, `one live ${text} control`); buttons[0].click();
    };
    const field = text => {
      const label = [...container.querySelectorAll('label')].find(label => label.querySelector('span')?.textContent === text);
      assert.ok(label, `${text} field`); return label.querySelector('input,select');
    };
    const change = (text, value) => { const input = field(text); input.value = value; input.dispatchEvent(new dom.window.Event('change', { bubbles: true })); };
    const upload = (input, files) => { Object.defineProperty(input, 'files', { value: files, configurable: true }); input.dispatchEvent(new dom.window.Event('change', { bubbles: true })); };
    const choose = async (label = 'Alpha · 1 sources') => { click(label); await settle(); };
    const status = () => container.querySelector('.studio-flash');
    try {
      // Prime only the existing actual lazy dependency; no replacement mount.
      await import('../../src/client/audio/composer.mjs');
      mount(); await settle();
      await action({ dom, container, calls, records, faults, urls, revoked, timers, downloads, plays, pauses, contexts,
        original, archive, mount, dispose, settle, click, field, change, upload, choose, status,
        confirm(value) { confirmation = value; } });
      assert.equal(records.get('beta')?.sourceBlobs.wood, original, 'untouched pack retains its original Blob');
      cases.push(name);
    } finally {
      dispose();
      for (const [object, key, descriptor] of saved.reverse()) {
        if (descriptor) Object.defineProperty(object, key, descriptor); else delete object[key];
      }
      dom.window.close();
    }
  }

  await check('selection listeners, document links and close/reopen preserve store identity', async f => {
    assert.deepEqual(f.calls, [['list']]);
    assert.equal(f.container.querySelector('a[href="./audio-zones.html"]').textContent, 'Zone palettes');
    assert.equal(f.container.querySelector('a[href="./"]').textContent, '← Game');
    await f.choose(); assert.deepEqual(f.calls, [['list'], ['load', 'alpha']]);
    assert.equal(f.field('Display name').value, 'Wood');
    await f.choose('Beta · 1 sources'); assert.equal(f.field('Pack name').value, 'Beta');
    f.dispose(); assert.equal(f.container.childNodes.length, 0);
    f.mount(); await f.settle(); await f.choose();
    f.change('Pack name', 'Renamed'); await f.settle();
    assert.equal(f.calls.filter(call => call[0] === 'save').length, 1, 'one live listener saves once after reopening');
    assert.deepEqual(f.calls.slice(-2).map(call => call[0]), ['save', 'list']);
    assert.equal(f.records.get('alpha').pack.name, 'Renamed');
    assert.equal(f.records.get('alpha').sourceBlobs.wood, f.original);
  });

  await check('failed save reports the original error and rolls back pack/blob edits', async f => {
    await f.choose(); const error = new Error('Browser storage is full'); f.faults.save = error;
    f.change('Display name', 'Attempted'); await f.settle();
    assert.equal(f.status().textContent, error.message); assert.equal(f.status().classList.contains('error'), true);
    assert.deepEqual(f.calls.slice(-1)[0][0], 'save'); assert.equal(f.records.get('alpha').pack.sources[0].name, 'Wood');
    delete f.faults.save; f.change('Pack name', 'Retry'); await f.settle();
    const saved = f.calls.filter(call => call[0] === 'save').at(-1);
    assert.equal(saved[1].sources[0].name, 'Wood', 'next mutation starts from restored metadata');
    assert.deepEqual(saved[2], {}); assert.equal(f.records.get('alpha').sourceBlobs.wood, f.original);
    assert.equal(f.status().textContent, 'Saved Retry'); assert.equal(f.status().classList.contains('error'), false);
  });

  await check('source validation precedes persistence and failed source import can retry', async f => {
    await f.choose(); const input = f.container.querySelector('#source-upload');
    f.upload(input, [{ name: 'empty.wav', size: 0, type: 'audio/wav' }]); await f.settle();
    assert.match(f.status().textContent, /between 1 byte and 16 MiB/); assert.equal(f.calls.filter(x => x[0] === 'save').length, 0);
    const file = recording(); Object.defineProperty(file, 'name', { value: 'new.wav' });
    f.faults.save = new Error('Recording could not be saved'); f.upload(input, [file]); await f.settle();
    assert.equal(f.status().textContent, 'Recording could not be saved'); assert.equal(f.records.get('alpha').pack.sources.length, 1);
    delete f.faults.save; f.upload(input, [file]); await f.settle();
    assert.equal(f.records.get('alpha').pack.sources.length, 2);
    const imported = f.records.get('alpha').pack.sources[1];
    assert.equal(imported.fileName, 'new.wav'); assert.equal(f.records.get('alpha').sourceBlobs[imported.id], file);
    assert.equal(f.records.get('alpha').sourceBlobs.wood, f.original);
    assert.deepEqual(f.calls.slice(-2).map(call => call[0]), ['save', 'list']);
    assert.equal(f.status().textContent, 'Imported 1 original recording');
  });

  await check('failed backup import feedback preserves selection and original retry order', async f => {
    await f.choose(); const input = f.container.querySelector('input[accept=".json,application/json"]');
    const unreadable = new Blob(['bad backup']); f.faults.import = new Error('Audio pack backup could not be read. Retry.');
    const before = f.calls.length; f.upload(input, [unreadable]); await f.settle();
    assert.deepEqual(f.calls.slice(before), [['import', unreadable]]);
    assert.equal(f.status().textContent, f.faults.import.message); assert.equal(f.status().classList.contains('error'), true);
    assert.equal(f.field('Pack name').value, 'Alpha'); assert.equal(f.records.get('alpha').sourceBlobs.wood, f.original);
    delete f.faults.import; f.upload(input, [f.archive]); await f.settle();
    assert.deepEqual(f.calls.slice(-3).map(x => x[0]), ['import', 'list', 'load']);
    assert.equal(f.calls.at(-1)[1], 'imported'); assert.equal(f.field('Pack name').value, 'Imported');
    assert.equal(f.status().textContent, 'Imported pack Imported'); assert.equal(f.status().classList.contains('error'), false);
  });

  await check('backup download preserves the Blob, filename and thirty-second cleanup', async f => {
    await f.choose(); f.click('Export backup'); await f.settle();
    assert.deepEqual(f.calls.at(-1), ['export', 'alpha']); assert.equal(f.urls[0].blob, f.archive);
    assert.deepEqual(f.downloads, [{ href: 'blob:library-0', name: 'alpha.audio-pack.json' }]);
    assert.equal(document.querySelector('a[download]'), null, 'temporary download anchor is removed');
    assert.equal(f.timers.length, 1); assert.equal(f.timers[0].ms, 30000); assert.deepEqual(f.revoked, []);
    f.dispose(); assert.deepEqual(f.revoked, [], 'existing backup timer owns its URL after closing');
    f.timers[0].callback(); assert.deepEqual(f.revoked, ['blob:library-0']);
  });

  await check('preview replacement, decode feedback, rendering and disposal clean original URLs', async f => {
    await f.choose(); f.click('Play'); assert.equal(f.urls[0].blob, f.original); assert.equal(f.plays.length, 1);
    const old = f.plays[0]; f.click('Play'); assert.deepEqual(f.revoked, ['blob:library-0']); assert.equal(f.pauses[0], old); assert.equal(old.isConnected, false);
    const active = f.plays[1]; active.onerror(); assert.equal(f.status().textContent, 'This browser cannot decode this recording. Original bytes remain stored.');
    f.change('Pack name', 'Preview pack'); await f.settle();
    assert.deepEqual(f.revoked, ['blob:library-0', 'blob:library-1']); assert.equal(active.isConnected, false);
    f.click('Play'); f.dispose(); assert.equal(f.pauses.length, 3); assert.deepEqual(f.revoked, ['blob:library-0', 'blob:library-1', 'blob:library-2']);
    assert.equal(f.container.childNodes.length, 0); assert.equal(f.records.get('alpha').sourceBlobs.wood, f.original);
  });

  await check('delete confirmation preserves selection or deletes then refreshes', async f => {
    await f.choose(); const before = f.calls.length; f.click('Delete pack'); await f.settle();
    assert.equal(f.calls.slice(before).length, 1); assert.equal(f.calls.at(-1)[0], 'confirm'); assert.equal(f.records.has('alpha'), true);
    f.confirm(true); f.click('Delete pack'); await f.settle();
    assert.deepEqual(f.calls.slice(-3).map(x => x[0]), ['confirm', 'delete', 'list']); assert.equal(f.records.has('alpha'), false);
    assert.equal(f.container.querySelector('.studio-tabs'), null); assert.match(f.container.querySelector('.empty-state').textContent, /Create a pack/);
  });

  await check('assignment listeners preserve validation, save order and failed edit rollback', async f => {
    await f.choose(); f.click('Event assignments');
    f.change('Default composition', 'mix'); await f.settle();
    assert.deepEqual(f.calls.slice(-2).map(x => x[0]), ['save', 'list']);
    assert.equal(f.records.get('alpha').pack.profiles[0].music.defaultCompositionId, 'mix');
    const before = f.calls.length; f.click('Add event'); await f.settle();
    assert.equal(f.status().textContent, 'Choose or enter an event key'); assert.equal(f.calls.length, before);
    f.container.querySelector('.inline-controls select').value = 'cue.select'; f.click('Add event'); await f.settle();
    f.change('Bus', 'effects'); await f.settle();
    assert.deepEqual(f.records.get('alpha').pack.profiles[0].bindings['cue.select'], { bus: 'effects', variants: [{ sourceId: 'wood' }] });
    f.faults.save = new Error('Assignment could not be saved'); f.click('Remove event'); await f.settle();
    assert.equal(f.status().textContent, 'Assignment could not be saved'); delete f.faults.save;
    f.change('Pack name', 'Retry assignment'); await f.settle();
    assert.equal(f.records.get('alpha').pack.profiles[0].bindings['cue.select'].bus, 'effects');
    assert.equal(f.records.get('alpha').sourceBlobs.wood, f.original);
  });

  await check('leaving or disposing the tab before lazy completion cannot mount a composer', async f => {
    await f.choose(); f.click('Composer'); f.click('Library'); await f.settle();
    assert.equal(f.container.querySelector('.audio-composer'), null); assert.equal(document.head.querySelector('link'), null);
    f.click('Composer'); f.dispose(); await f.settle();
    assert.equal(f.container.childNodes.length, 0); assert.equal(document.head.querySelector('link'), null); assert.deepEqual(f.contexts, []);
    f.mount(); await f.settle(); await f.choose(); assert.equal(f.field('Pack name').value, 'Alpha');
  });

  await check('composer tab save, failed save, reopen and disposal preserve store/resource lifetimes', async f => {
    await f.choose(); f.click('Composer'); await f.settle();
    let composer = f.container.querySelector('.audio-composer'); assert.ok(composer);
    assert.equal(document.head.querySelector('link').getAttribute('href'), './src/audio-composer.css');
    composer.querySelector('[data-action="play"]').click(); await f.settle(); assert.equal(f.contexts[0].starts, 1);
    let name = composer.querySelector('[data-field="name"]'); name.value = 'Saved mix'; name.dispatchEvent(new f.dom.window.Event('input', { bubbles: true }));
    composer.querySelector('[data-action="save"]').click(); await f.settle();
    assert.deepEqual(f.calls.slice(-2).map(x => x[0]), ['save', 'list']); assert.equal(f.records.get('alpha').pack.compositions[0].name, 'Saved mix');
    assert.equal(f.status().textContent, 'Composition saved');
    f.faults.save = new Error('Browser storage is full'); name = composer.querySelector('[data-field="name"]');
    name.value = 'Unsaved mix'; name.dispatchEvent(new f.dom.window.Event('input', { bubbles: true }));
    composer.querySelector('[data-action="save"]').click(); await f.settle();
    assert.equal(composer.querySelector('[role="status"]').textContent, 'Browser storage is full');
    assert.match(composer.querySelector('[data-action="save"]').textContent, /\*/); assert.equal(f.records.get('alpha').pack.compositions[0].name, 'Saved mix');
    delete f.faults.save; f.click('Library'); await f.settle(); assert.equal(composer.isConnected, false); assert.equal(f.contexts[0].closes, 1);
    assert.equal(document.head.querySelectorAll('link').length, 1, 'tab changes retain the existing stylesheet');
    f.click('Composer'); await f.settle(); composer = f.container.querySelector('.audio-composer');
    assert.equal(composer.querySelector('[data-field="name"]').value, 'Saved mix', 'reopen loads saved state rather than failed draft');
    composer.querySelector('[data-action="play"]').click(); await f.settle(); assert.equal(f.contexts[1].starts, 1);
    f.dispose(); assert.equal(f.contexts[1].closes, 1); assert.equal(document.head.querySelector('link'), null); assert.equal(f.container.childNodes.length, 0);
    f.mount(); await f.settle(); await f.choose(); assert.equal(f.field('Pack name').value, 'Alpha');
  });
  return cases;
}
