import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createRoomLobbyChat } from '../src/room-lobby-chat-ui.mjs';

const host = { id: 'player-1', team: 0 }, guest = { id: 'player-2', team: 1 };
const state = { phase: 'lobby', seats: [{ ...host, connected: true }, { ...guest, connected: true }] };
const message = (id, text, player = host, clientMessageId = `client-${id}`) => ({ id, text, playerId: player.id, team: player.team, clientMessageId });
function fixture(identity = host) {
  const dom = new JSDOM('<section></section>');
  const root = dom.window.document.querySelector('section');
  const sent = [];
  let id = 0, accepts = true;
  const ui = createRoomLobbyChat({ root, send: command => { sent.push(command); return accepts; }, createId: () => `client-${++id}` });
  ui.context(state, identity, true);
  return { dom, root, ui, sent, set accepts(value) { accepts = value; },
    input: root.querySelector('input'), button: root.querySelector('button'), log: root.querySelector('ol'),
    status: root.querySelector('#lobby-chat-status'), submit() { root.querySelector('form').dispatchEvent(new dom.window.Event('submit', { cancelable: true })); } };
}

test('chat uses plain text, stable seat labels and an accessible log without unrelated reannouncements', () => {
  const f = fixture();
  f.ui.update([message(1, '<img src=x>'), message(2, 'Hello', guest)]);
  assert.equal(f.root.querySelector('img'), null);
  assert.equal(f.log.children[0].textContent, 'Azure (you): <img src=x>');
  assert.equal(f.log.children[1].textContent, 'Ember: Hello');
  assert.equal(f.log.getAttribute('role'), 'log');
  assert.equal(f.log.getAttribute('aria-live'), 'polite');
  assert.equal(f.input.maxLength, 240);
  const first = f.log.children[0];
  f.ui.context({ ...state, revision: 99 }, host, true);
  assert.equal(f.log.children[0], first);
  f.ui.context(state, { id: 'replacement', team: 0 }, true);
  assert.equal(f.log.children[0].textContent, 'Azure: <img src=x>', 'a replacement does not inherit old-seat authorship');
});

test('pending sends suppress duplicates across lobby updates and clear only on their own acknowledgement', () => {
  const f = fixture();
  f.input.value = 'Draft'; f.submit(); f.submit();
  assert.deepEqual(f.sent, [{ type: 'sendLobbyChat', clientMessageId: 'client-1', text: 'Draft' }]);
  f.ui.context({ ...state, revision: 5 }, host, true);
  f.submit();
  assert.equal(f.sent.length, 1, 'another readiness update cannot release a pending send');
  f.ui.update([message(1, 'Other', guest)], { playerId: guest.id, clientMessageId: 'client-1' });
  assert.equal(f.input.value, 'Draft');
  assert.equal(f.button.disabled, true);
  f.ui.update([message(1, 'Draft')], { playerId: host.id, clientMessageId: 'client-1' });
  assert.equal(f.input.value, '');
  assert.equal(f.button.disabled, false);
  f.submit(); assert.equal(f.sent.length, 1, 'empty text does not send');
});

test('rejections/offline preserve drafts; spectators and running matches cannot send', () => {
  const f = fixture();
  f.input.value = 'Draft'; f.submit();
  f.ui.reject('ignored', 'other');
  assert.equal(f.button.disabled, true);
  f.ui.reject('Wait a few seconds', 'client-1');
  assert.equal(f.input.value, 'Draft');
  assert.match(f.status.textContent, /Wait/);
  f.accepts = false; f.submit();
  assert.equal(f.input.value, 'Draft');
  assert.match(f.status.textContent, /offline/);
  f.ui.context(state, host, false); f.submit();
  assert.equal(f.button.disabled, true);
  assert.match(f.status.textContent, /Reconnecting/);
  f.ui.context(state, { id: 'spectator-3', team: null }, true); f.submit();
  assert.match(f.status.textContent, /Spectators/);
  assert.equal(f.input.disabled, true);
  f.ui.context({ ...state, phase: 'running' }, host, true);
  assert.equal(f.button.disabled, true);
});

test('history truncation removes all old nodes and a recovered empty history clears prior logs', () => {
  const f = fixture();
  f.ui.update([message(1, 'one'), message(2, 'two'), message(3, 'three')]);
  f.ui.update([message(4, 'four')]);
  assert.equal(f.log.children.length, 1);
  assert.equal(f.log.children[0].textContent, 'Azure (you): four');
  f.input.value = 'Keep draft'; f.submit();
  f.ui.update([], null, true);
  assert.equal(f.log.children.length, 0);
  assert.equal(f.input.value, 'Keep draft');
  assert.equal(f.button.disabled, false);
});

test('new messages follow the log bottom and preserve a scrolled-up reading position', () => {
  const f = fixture();
  Object.defineProperty(f.log, 'scrollHeight', { value: 600 });
  Object.defineProperty(f.log, 'clientHeight', { value: 150 });
  f.log.scrollTop = 450;
  f.ui.update([message(1, 'new at bottom')]);
  assert.equal(f.log.scrollTop, 600);
  f.log.scrollTop = 100;
  f.ui.update([message(1, 'new at bottom'), message(2, 'another')]);
  assert.equal(f.log.scrollTop, 100, 'receiving a message does not pull a reader away from older text');
});

test('a browser without secure-context randomUUID still sends a bounded request ID', () => {
  const dom = new JSDOM('<section></section>', { url: 'http://192.0.2.10/' });
  const root = dom.window.document.querySelector('section'), sent = [];
  Object.defineProperty(dom.window.crypto, 'randomUUID', { value: undefined });
  assert.equal(dom.window.crypto.randomUUID, undefined);
  const ui = createRoomLobbyChat({ root, send: command => { sent.push(command); return true; } });
  ui.context(state, host, true);
  root.querySelector('input').value = 'LAN lobby';
  root.querySelector('form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  assert.equal(sent.length, 1);
  assert.match(sent[0].clientMessageId, /^[A-Za-z0-9_-]{1,64}$/);
  assert.equal(sent[0].text, 'LAN lobby');
});

test('chat acknowledgement/rejection restores its control, without stealing deliberate focus', () => {
  const f = fixture(), doc = f.dom.window.document;
  f.input.value = 'First'; f.input.focus(); f.submit(); f.input.blur();
  f.ui.update([message(1, 'First')], { playerId: host.id, clientMessageId: 'client-1' });
  assert.equal(doc.activeElement, f.input);
  f.input.value = 'Rejected'; f.submit(); f.input.blur();
  f.ui.reject('Wait', 'client-2');
  assert.equal(doc.activeElement, f.input);
  f.submit(); f.input.blur();
  const elsewhere = doc.createElement('button'); doc.body.append(elsewhere); elsewhere.focus();
  f.ui.update([message(1, 'First'), message(2, 'Rejected', host, 'client-3')], { playerId: host.id, clientMessageId: 'client-3' });
  assert.equal(doc.activeElement, elsewhere);
});
