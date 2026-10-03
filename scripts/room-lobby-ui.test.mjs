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
  let rejoins = 0;
  const ui = createRoomLobby({ root, send: command => { sent.push(command); return true; }, copyInvite: () => invites++, rejoin: () => rejoins++ });
  const state = {
    phase: 'lobby', revision: 4, mapId: 'map-a', armySize: 8, canLaunch: false,
    maps: [{ id: 'map-a', name: '<img src=x>' }, { id: 'map-b', name: 'Second map' }],
    seats: [{ ...host, connected: true, ready: false }, { ...guest, connected: true, ready: false }],
  };
  ui.update(state, player);
  return { dom, root, ui, state, sent, player, get invites() { return invites; }, get rejoins() { return rejoins; }, node: id => root.querySelector(`#${id}`) };
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

test('a spectator sees actual seat availability and can request rejoin once', () => {
  const spectator = { id: 'spectator-3', team: null }, f = fixture(spectator);
  assert.match(f.node('lobby-status').textContent, /occupied/);
  f.ui.update({ ...f.state, seats: f.state.seats.filter(seat => seat.team === 0) }, spectator);
  assert.match(f.node('lobby-status').textContent, /seat is available/);
  const rejoin = f.node('lobby-rejoin');
  assert.equal(rejoin.hidden, false);
  assert.equal(rejoin.disabled, false);
  rejoin.click(); rejoin.click();
  assert.equal(f.rejoins, 1);
  assert.equal(f.sent.length, 0, 'rejoin uses existing admission, without seat-promotion commands');
  assert.equal(f.node('lobby-ready').disabled, true);
});

test('host departure explains reservation and vacancy without promoting Ember', () => {
  const f = fixture(guest);
  f.ui.update({ ...f.state, seats: f.state.seats.map(seat => ({ ...seat, connected: seat.team !== 0, ready: false })) }, guest);
  assert.match(f.node('lobby-status').textContent, /Host disconnected.*reserved.*remain Ember/);
  f.ui.update({ ...f.state, seats: f.state.seats.filter(seat => seat.team !== 0) }, guest);
  assert.match(f.node('lobby-status').textContent, /Host seat open.*new Azure host.*remain Ember/);
  assert.equal(f.node('lobby-map').disabled, true);
  assert.equal(f.node('lobby-launch').hidden, true);
  assert.equal(f.node('lobby-rejoin').hidden, true, 'Ember keeps their current seat');
});

test('reserved seats and active-token recovery never offer a new-seat request', () => {
  const spectator = { id: 'spectator-3', team: null }, f = fixture(spectator);
  const reserved = { ...f.state, seats: f.state.seats.map(seat => ({ ...seat, connected: seat.team === 0 })) };
  f.ui.update(reserved, spectator);
  assert.match(f.node('lobby-status').textContent, /disconnected seats are reserved/);
  assert.equal(f.node('lobby-rejoin').hidden, true);
  f.node('lobby-rejoin').click(); assert.equal(f.rejoins, 0);
  f.ui.update({ ...reserved, seats: [] }, { ...spectator, resumePending: true });
  assert.match(f.node('lobby-status').textContent, /active in another connection.*rejoin automatically/);
  assert.equal(f.node('lobby-rejoin').hidden, true);
  f.node('lobby-rejoin').click(); assert.equal(f.rejoins, 0);
});

test('vacancy races, disconnect and launch withdraw the action without granting authority', () => {
  const spectator = { id: 'spectator-3', team: null }, f = fixture(spectator);
  const vacancy = { ...f.state, seats: [f.state.seats[0]] }, join = f.node('lobby-rejoin');
  f.ui.update(vacancy, spectator); join.focus();
  f.ui.update(f.state, spectator);
  assert.equal(join.hidden, true);
  assert.equal(f.dom.window.document.activeElement, f.root.querySelector('button'), 'a withdrawn action returns focus inside the lobby');
  join.click(); assert.equal(f.rejoins, 0);
  f.ui.update(vacancy, spectator); f.ui.disconnect();
  assert.equal(join.disabled, true); join.click(); assert.equal(f.rejoins, 0);
  f.ui.update(vacancy, spectator);
  assert.equal(join.disabled, false);
  f.ui.update({ ...vacancy, phase: 'running' }, spectator);
  join.click(); assert.equal(f.rejoins, 0);
  assert.equal(f.root.open, false);
});

test('Azure gets specific waiting/reconnect guidance while errors and pending requests stay visible', () => {
  const f = fixture();
  f.ui.update({ ...f.state, seats: [f.state.seats[0]] }, host);
  assert.match(f.node('lobby-status').textContent, /Waiting for Ember.*Share the invite/);
  const reserved = { ...f.state, seats: f.state.seats.map(seat => ({ ...seat, connected: seat.team === 0 })) };
  f.ui.update(reserved, host);
  assert.match(f.node('lobby-status').textContent, /Ember disconnected.*reserved/);
  f.node('lobby-ready').click();
  assert.match(f.node('lobby-status').textContent, /Waiting for server/);
  f.ui.reject('Lobby changed', reserved, host);
  assert.match(f.node('lobby-status').textContent, /Lobby changed/);
});
