import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { roomPresence } from '../src/room-presence.mjs';
import { browserRecoveryBindings } from './browser-recovery-fixture.mjs';

test('solo Practice is live with one player while ordinary two-seat rooms still wait', () => {
  assert.deepEqual(roomPresence({ connected: 1, practice: true }), {
    network: 'PRACTICE LIVE', match: 'SOLO PRACTICE', waiting: false, full: false,
  });
  assert.equal(roomPresence({ connected: 1 }).network, 'WAITING FOR PLAYER 2');
  assert.equal(roomPresence({ connected: 1 }).waiting, true);
  assert.equal(roomPresence({ connected: 0, practice: true }).network, 'WAITING FOR A PLAYER');
  assert.equal(roomPresence({ connected: 0, practice: true }).waiting, true);
  assert.equal(roomPresence({ connected: 2, practice: true }).match, '2 / 2 ONLINE · PRACTICE');
  assert.equal(roomPresence({ connected: 2 }).network, 'ROOM LIVE');
  assert.equal(roomPresence({ connected: 1, practice: 'true' }).network, 'WAITING FOR PLAYER 2');
});

test('active-seat recovery keeps priority over Practice/live status', () => {
  for (const practice of [false, true]) for (const connected of [0, 1, 2]) {
    const value = roomPresence({ connected, practice, resumePending: true });
    assert.equal(value.network, 'SEAT ACTIVE ELSEWHERE'); assert.equal(value.match, 'WAITING TO REJOIN');
    assert.equal(value.waiting, true);
  }
});

test('the actual room presentation applies Practice and recovery labels without changing two-seat counts', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const dom = new JSDOM('<p id="players"></p><div><span id="network"></span><i id="dot"></i></div><p id="match"></p>');
  const doc = dom.window.document;
  const context = vm.createContext({ ...browserRecoveryBindings(), connectedPlayers: 0, waitingForResume: false, soloPracticeActive: true, roomPresence,
    ui: { playersOnline: doc.querySelector('#players'), networkStatus: doc.querySelector('#network'),
      connectionDot: doc.querySelector('#dot'), matchStatus: doc.querySelector('#match') } });
  vm.runInContext(source.slice(source.indexOf('function updateRoomUI('), source.indexOf('\nfunction setConnection(')), context);
  context.updateRoomUI(1);
  assert.equal(doc.querySelector('#network').textContent, 'PRACTICE LIVE');
  assert.equal(doc.querySelector('#match').textContent, 'SOLO PRACTICE');
  assert.equal(doc.querySelector('#players').textContent, '1 / 2 PLAYERS');
  assert.equal(doc.querySelector('#dot').classList.contains('waiting'), false);
  context.waitingForResume = true; context.updateRoomUI(1);
  assert.equal(doc.querySelector('#network').textContent, 'SEAT ACTIVE ELSEWHERE');
  context.waitingForResume = false; context.soloPracticeActive = false; context.updateRoomUI(1);
  assert.equal(doc.querySelector('#network').textContent, 'WAITING FOR PLAYER 2');
  assert.equal(doc.querySelector('#dot').classList.contains('waiting'), true);
  dom.window.close();
});
