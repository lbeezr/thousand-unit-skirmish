import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createRoomLobby } from '../src/room-lobby-ui.mjs';

const host = { id: 'player-1', team: 0 };
const guest = { id: 'player-2', team: 1 };
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
