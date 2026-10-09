import assert from 'node:assert/strict';
import test from 'node:test';
import { LOBBY_CHAT_LIMITS, RoomLobbyChat } from '../src/server/orchestration/room-lobby-chat.mjs';

const host = { id: 'player-1', team: 0 }, guest = { id: 'player-2', team: 1 };
const lobby = () => ({ phase: 'lobby', seats: [{ ...host, connected: true }, { ...guest, connected: true }] });
const command = (clientMessageId, text = 'Hello') => ({ type: 'sendLobbyChat', clientMessageId, text });

test('only the connected authoritative waiting seats can send, with no payload impersonation', () => {
  const chat = new RoomLobbyChat();
  const state = lobby();
  for (const player of [{ id: host.id, team: null }, { id: 'other', team: 0 }, { id: guest.id, team: 0 }]) {
    assert.throws(() => chat.send(player, command('one'), state), /connected/);
  }
  assert.throws(() => chat.send(host, command('one'), { ...state, phase: 'running' }), /before launch/);
  assert.throws(() => chat.send(host, command('one'), { ...state, seats: state.seats.map(seat => ({ ...seat, connected: false })) }), /connected/);
  assert.throws(() => chat.send(host, { ...command('one'), playerId: guest.id }, state), /identifier/);
  assert.equal(chat.history().length, 0);
  chat.send(guest, command('one'), state);
  assert.deepEqual(chat.history()[0], { id: 1, playerId: guest.id, team: 1, clientMessageId: 'one', text: 'Hello' });
});

test('invalid identifiers/text reject without changing history; plain Unicode/markup remains text', () => {
  const chat = new RoomLobbyChat(), state = lobby();
  for (const value of ['', null, {}, 'a'.repeat(65), 'not an id']) {
    assert.throws(() => chat.send(host, command(value), state));
  }
  for (const value of ['', '   ', null, 3, 'a'.repeat(241), 'line\nbreak', '\u0000', '\u007f', '\u0085']) {
    assert.throws(() => chat.send(host, command('one', value), state));
  }
  assert.equal(chat.history().length, 0);
  chat.send(host, command('one', '  Hello 🌲 <img src=x>  '), state);
  assert.equal(chat.history()[0].text, 'Hello 🌲 <img src=x>');
  const copy = chat.history(); copy[0].text = 'mutated'; copy.push({});
  assert.equal(chat.history()[0].text, 'Hello 🌲 <img src=x>');
  assert.equal(chat.history().length, 1);
});

test('seat-based rate limiting survives reconnect and retries acknowledge without extra sends', () => {
  let now = 1000;
  const chat = new RoomLobbyChat(() => now), state = lobby();
  for (let i = 0; i < 5; i++) chat.send(host, command(`host-${i}`), state);
  assert.throws(() => chat.send({ ...host }, command('six'), state), /Wait/);
  assert.equal(chat.send({ ...host }, command('host-0'), state).inserted, false);
  assert.throws(() => chat.send(host, command('host-0', 'different'), state), /different text/);
  assert.equal(chat.history().length, 5);
  chat.send(guest, command('host-0'), state);
  assert.equal(chat.history().length, 6, 'the guest has its own rate and message-ID space');
  now += LOBBY_CHAT_LIMITS.windowMs;
  assert.equal(chat.send(host, command('six'), state).inserted, true);
});

test('history, retry records and replaced-seat state stay bounded; old retry can acknowledge off-screen', () => {
  let now = 0;
  const chat = new RoomLobbyChat(() => now), state = lobby();
  for (let i = 1; i <= 100; i++) {
    now += 10_000;
    chat.send(host, command(`message-${i}`), state);
  }
  assert.equal(chat.history().length, LOBBY_CHAT_LIMITS.history);
  assert.equal(chat.history()[0].id, 69);
  assert.equal(chat.senders.get(host.id).seen.size, LOBBY_CHAT_LIMITS.retries);
  assert.deepEqual(chat.send(host, command('message-65'), state), {
    inserted: false, ack: { playerId: host.id, clientMessageId: 'message-65' },
  });
  assert.equal(chat.history().length, 32, 'deduplicated off-screen retry does not append');
  chat.send(guest, command('guest'), state);
  for (let i = 3; i <= 12; i++) {
    const replacement = { id: `player-${i}`, team: 0 };
    state.seats[0] = { ...replacement, connected: true };
    chat.send(replacement, command('new-seat'), state);
    assert.equal(chat.senders.size, 2);
  }
  assert.equal(chat.senders.has(host.id), false);
  assert.equal(new RoomLobbyChat().history().length, 0, 'a new worker starts without persisted chat');
});
