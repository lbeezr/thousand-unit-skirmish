import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createRoomLobby } from '../src/room-lobby-ui.mjs';

const host = { id: 'player-1', team: 0 };
const guest = { id: 'player-2', team: 1 };
function disabledControlBlur(doc) {
  // JSDOM retains focus on disabled buttons; reproduce Chrome's BODY focus.
  doc.body.tabIndex = -1;
  doc.body.focus();
}
function fixture(player = host) {
  const dom = new JSDOM('<dialog id="room-lobby"></dialog>', { url: 'http://localhost/' });
  const root = dom.window.document.querySelector('dialog');
  root.showModal = () => { root.open = true; };
  root.close = () => { root.open = false; };
  const sent = [];
  let invites = 0;
  const ui = createRoomLobby({ root, send: command => { sent.push(command); return true; }, copyInvite: () => invites++ });
  const state = {
    phase: 'lobby', revision: 4, mapId: 'map-a', armySize: 8, canLaunch: false,
    maps: [{ id: 'map-a', name: '<img src=x>' }, { id: 'map-b', name: 'Second map' }],
    seats: [{ ...host, connected: true, ready: false }, { ...guest, connected: true, ready: false }],
  };
  ui.update(state, player);
  return { dom, root, ui, state, sent, player, get invites() { return invites; }, node: id => root.querySelector(`#${id}`) };
}

test('host controls send supported configuration and suppress pending duplicate clicks', () => {
  const f = fixture();
  assert.equal(f.root.open, true);
  assert.equal(f.root.querySelector('img'), null, 'catalog text cannot become markup');
  assert.equal(f.node('lobby-army-size').value, '8', 'actual map opening is represented');
  const map = f.node('lobby-map');
  map.value = 'map-b';
  map.dispatchEvent(new f.dom.window.Event('change'));
  assert.deepEqual(f.sent, [{ type: 'configureLobby', mapId: 'map-b', revision: 4 }]);
  assert.equal(f.node('lobby-ready').disabled, true);
  f.node('lobby-ready').click();
  assert.equal(f.sent.length, 1);
  f.ui.reject('Lobby changed', { ...f.state, revision: 5 }, host);
  assert.equal(f.node('lobby-map').disabled, false);
  assert.match(f.node('lobby-status').textContent, /Lobby changed/);
  f.node('lobby-ready').click();
  assert.deepEqual(f.sent.at(-1), { type: 'setReady', ready: true, revision: 5 });
});

test('guest/spectator authority, readiness and reconnect are presented accurately', () => {
  const f = fixture(guest);
  assert.equal(f.node('lobby-map').disabled, true);
  assert.equal(f.node('lobby-launch').hidden, true);
  assert.equal(f.node('lobby-ready').disabled, false);
  f.ui.update({ ...f.state, seats: f.state.seats.map(row => ({ ...row, ready: true })), canLaunch: true }, guest);
  assert.equal(f.node('lobby-ready').textContent, 'Not ready');
  f.node('lobby-ready').click();
  assert.deepEqual(f.sent.at(-1), { type: 'setReady', ready: false, revision: 4 });
  f.ui.disconnect();
  assert.equal(f.node('lobby-ready').disabled, true);
  assert.match(f.node('lobby-status').textContent, /Reconnecting/);
  f.ui.update(f.state, { id: 'spectator-3', team: null });
  assert.equal(f.node('lobby-ready').disabled, true);
  assert.match(f.node('lobby-status').textContent, /Spectating/);
});

test('launch needs server readiness and keeps the modal until server acceptance', () => {
  const f = fixture();
  f.node('lobby-launch').click();
  assert.equal(f.sent.length, 0);
  f.ui.update({ ...f.state, canLaunch: true }, host);
  f.node('lobby-launch').click();
  f.node('lobby-launch').click();
  assert.deepEqual(f.sent, [{ type: 'launchMatch', revision: 4 }]);
  assert.equal(f.root.open, true);
  f.ui.update({ ...f.state, phase: 'running' }, host);
  assert.equal(f.root.open, false);
  f.ui.update(f.state, host);
  const cancel = new f.dom.window.Event('cancel', { cancelable: true });
  f.root.dispatchEvent(cancel);
  assert.equal(cancel.defaultPrevented, true);
  f.root.querySelector('button').click();
  assert.equal(f.invites, 1);
  assert.equal(f.root.querySelector('a').href, 'http://localhost/');
  f.ui.update(null, host);
  assert.equal(f.root.open, false, 'legacy rooms have no modal');
});

test('host/guest enter on enabled controls and Ready acknowledgements/rejections retain focus', () => {
  for (const player of [host, guest]) {
    const f = fixture(player), ready = f.node('lobby-ready'), doc = f.dom.window.document;
    assert.equal(doc.activeElement, f.node(player.team === 0 ? 'lobby-map' : 'lobby-ready'));
    ready.focus(); ready.click();
    disabledControlBlur(doc); assert.equal(doc.activeElement, doc.body);
    f.ui.update({ ...f.state, seats: f.state.seats.map(seat => ({ ...seat, ready: seat.id === player.id })) }, player);
    assert.equal(doc.activeElement, ready);
    assert.equal(ready.textContent, 'Not ready');
    ready.click(); disabledControlBlur(doc);
    f.ui.reject('Lobby changed', { ...f.state, revision: 5 }, player);
    assert.equal(doc.activeElement, ready);
  }
});

test('acknowledgements do not steal another control or refocus a closed lobby', () => {
  const f = fixture(), ready = f.node('lobby-ready'), doc = f.dom.window.document;
  ready.focus(); ready.click(); disabledControlBlur(doc);
  const invite = f.root.querySelector('button'); invite.focus();
  f.ui.update(f.state, host);
  assert.equal(doc.activeElement, invite);
  ready.focus(); ready.click(); disabledControlBlur(doc);
  f.ui.update({ ...f.state, phase: 'running' }, host);
  assert.equal(f.root.open, false);
  assert.equal(doc.activeElement, doc.body);
});

test('overlapping Ready and chat acknowledgements preserve the most recent control', () => {
  const f = fixture(guest), ready = f.node('lobby-ready'), input = f.node('lobby-chat-text');
  const doc = f.dom.window.document;
  const submitChat = () => f.root.querySelector('form').dispatchEvent(new f.dom.window.Event('submit', { cancelable: true }));
  ready.focus(); ready.click(); disabledControlBlur(doc);
  input.focus(); input.value = 'Hello'; submitChat(); disabledControlBlur(doc);
  const firstChat = f.sent.find(command => command.type === 'sendLobbyChat');
  f.ui.update(f.state, guest);
  assert.equal(doc.activeElement, doc.body, 'an older Ready acknowledgement cannot reclaim chat focus');
  f.ui.updateChat([], { playerId: guest.id, clientMessageId: firstChat.clientMessageId });
  assert.equal(doc.activeElement, input);

  input.value = 'Second'; submitChat(); disabledControlBlur(doc);
  const secondChat = f.sent.at(-1);
  ready.focus(); ready.click(); disabledControlBlur(doc);
  f.ui.updateChat([], { playerId: guest.id, clientMessageId: secondChat.clientMessageId });
  assert.equal(doc.activeElement, doc.body, 'an older chat acknowledgement cannot reclaim Ready focus');
  f.ui.update(f.state, guest);
  assert.equal(doc.activeElement, ready);
});
