import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
function between(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Production boundary: ${start}`);
  return source.slice(a, b);
}
function fixture(t) {
  const dom = new JSDOM('<button id="studio-publish">Save & Play</button><p id="studio-message">Draft ready to publish.</p>', { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const w = dom.window, toasts = [], cues = [], sent = [];
  const draft = { id: 'private-draft', name: 'Private draft', summary: 'private unpublished contents' };
  const before = structuredClone(draft);
  Object.assign(w, { ui: { studioPublish: w.document.querySelector('button'), studioMessage: w.document.querySelector('p') },
    socket: null, WebSocket: { OPEN: 1 }, units: [], TextEncoder,
    showToast: message => toasts.push(message), audio: { playEvent: event => cues.push(event.cue) },
    browserStateRecovery: { recovering: false, status: () => 'LIVE' }, collectEditorMap: () => draft,
  });
  w.eval(between('function sendCommand(command)', 'function projectUnit('));
  w.eval(between("document.querySelector('#studio-publish').addEventListener", "for (const button of document.querySelectorAll('[data-map-tool]'))"));
  t.after(() => assert.deepEqual(draft, before, 'failure reporting never modifies the draft'));
  return { w, toasts, cues, sent, draft, publish: () => w.ui.studioPublish.click(), status: () => w.ui.studioMessage.textContent,
    connect() { w.socket = { readyState: 1, send: payload => sent.push(payload) }; },
  };
}

for (const boundary of ['no socket', 'closed socket', 'recovering', 'server stalled']) {
  test(`Publish ${boundary} explains the rejection in the editor and permits explicit retry`, t => {
    const f = fixture(t);
    if (boundary === 'closed socket') f.w.socket = { readyState: 3, send() { assert.fail('closed socket cannot send'); } };
    if (boundary === 'recovering') f.w.browserStateRecovery.recovering = true;
    if (boundary === 'server stalled') f.w.browserStateRecovery.status = () => 'SERVER NOT ADVANCING';
    f.publish();
    const recovery = ['recovering', 'server stalled'].includes(boundary);
    assert.equal(f.status(), recovery
      ? 'Map not published. Wait for current server state, then retry. Draft edits remain here.'
      : 'Map not published. Reconnect, then retry. Draft edits remain here.');
    assert.equal(f.w.ui.studioPublish.disabled, false);
    assert.deepEqual(f.sent, []);
    assert.deepEqual(f.toasts, [recovery ? 'WAITING FOR CURRENT SERVER STATE · ORDER NOT SENT' : 'SERVER CONNECTION IS OFFLINE']);
    assert.deepEqual(f.cues, recovery ? [] : ['reject']);
    f.connect(); f.w.browserStateRecovery.recovering = false; f.w.browserStateRecovery.status = () => 'LIVE';
    assert.deepEqual(f.sent, [], 'connection recovery does not silently publish the draft');
    f.publish();
    assert.equal(f.sent.length, 1);
    assert.deepEqual(JSON.parse(f.sent[0]), { type: 'publishMap', map: f.draft, persist: true });
    assert.equal(f.w.ui.studioPublish.disabled, true);
    assert.equal(f.status(), 'Validating, saving to the custom map library, and syncing it to both players…');
  });
}

for (const recovering of [false, true]) {
  test(`ordinary rejected commands leave editor status unchanged (recovering=${recovering})`, t => {
    const f = fixture(t); f.w.browserStateRecovery.recovering = recovering;
    assert.equal(f.w.sendCommand({ type: 'move', ids: [1] }), false);
    assert.equal(f.status(), 'Draft ready to publish.');
    assert.equal(f.w.ui.studioPublish.disabled, false);
  });
}

test('connected normal commands retain serialization and generation identity', t => {
  const f = fixture(t); f.connect(); f.w.units = [{ generation: 8 }, { generation: 19 }];
  assert.equal(f.w.sendCommand({ type: 'attack', ids: [0], targetId: 1 }), true);
  assert.deepEqual(JSON.parse(f.sent[0]), { type: 'attack', ids: [0], targetId: 1, unitGenerations: [8], targetGeneration: 19 });
  assert.equal(f.status(), 'Draft ready to publish.');
});

test('oversize Publish retains existing safe size feedback and sends no private payload', t => {
  const f = fixture(t); f.connect();
  assert.equal(f.w.sendCommand({ type: 'publishMap', map: { notes: 'private'.repeat(140000) } }), false);
  assert.equal(f.status(), 'Map JSON is too large to send safely. Keep the published map under 900 KB.');
  assert.deepEqual(f.sent, []); assert.deepEqual(f.toasts, ['COMMAND TOO LARGE TO SEND']);
});

for (const fault of ['serialization', 'transport']) {
  test(`${fault} programmer faults preserve exact error/cause identity`, t => {
    const f = fixture(t); f.connect();
    const cause = new Error('private diagnostic details'), error = new TypeError('unexpected adapter fault', { cause });
    let command = { type: 'publishMap', map: f.draft };
    if (fault === 'serialization') command = { type: 'publishMap', map: { toJSON() { throw error; } } };
    else f.w.socket.send = () => { throw error; };
    assert.throws(() => f.w.sendCommand(command), observed => observed === error && observed.cause === cause);
    assert.equal(f.status(), 'Draft ready to publish.');
    assert.deepEqual(f.sent, []);
  });
}
