import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createRoomLobby, lobbyRejoinUrl } from '../src/room-lobby-ui.mjs';
import { matchModeCatalog, effectiveMapForMatchMode } from '../src/match-modes.mjs';
import { readFileSync } from 'node:fs';
import { mapSizeIdentity } from '../src/map-size-policy.mjs';

const host = { id: 'player-1', team: 0 };
const guest = { id: 'player-2', team: 1 };

test('rejoining requests ordinary room admission even after a resumed player became a spectator', () => {
  const room = 'R'.repeat(32);
  const target = lobbyRejoinUrl(`https://game.test/?room=${room}&resume=1&studio=1&mode=pve#old`);
  assert.deepEqual([...target.searchParams], [['room', room]]);
  assert.equal(target.hash, '');
  assert.deepEqual([...lobbyRejoinUrl('https://game.test/?resume=1&play=1').searchParams], [['play', '1']],
    'a standalone shared lobby keeps deliberate game entry');
});
function disabledControlBlur(doc) {
  // JSDOM retains focus on disabled buttons; reproduce Chrome's BODY focus.
  doc.body.tabIndex = -1;
  doc.body.focus();
}
function fixture(player = host, settings = {}, definition) {
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
    ...settings,
  };
  ui.update(state, player, true, definition);
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

const millrace = JSON.parse(readFileSync(new URL('../maps/bellweather-millrace.json', import.meta.url)));
const lab = JSON.parse(readFileSync(new URL('../maps/stone-defense-field.json', import.meta.url)));
const skirmish = { matchModeId: 'skirmish', matchModeVersion: 1 };

test('Bannerfall host and guest see only the fixed opening size and stronghold rules while ready remains usable', () => {
  const canonical = JSON.parse(readFileSync(new URL('../maps/bannerfall-arena.json', import.meta.url)));
  const identity = { matchModeId: 'bannerfall', matchModeVersion: 1 };
  for (const player of [host, guest]) {
    const f = fixture(player, { ...identity, mapId: canonical.id, armySize: 16,
      matchModes: matchModeCatalog(canonical), maps: [{ ...canonical, matchModes: matchModeCatalog(canonical) }] },
      effectiveMapForMatchMode(canonical, identity));
    const size = f.node('lobby-army-size');
    assert.equal(size.disabled, true); assert.deepEqual([...size.options].map(option => option.value), ['16']);
    assert.match(size.title, /16 total units/); size.dispatchEvent(new f.dom.window.Event('change'));
    assert.deepEqual(f.sent, []); assert.equal(f.node('lobby-ready').disabled, false);
    assert.match(f.node('lobby-match-mode-summary').textContent, /waves.*15 seconds.*6 enemy troop kills.*original Town Center/);
    f.node('lobby-ready').click(); assert.equal(f.sent.at(-1).type, 'setReady');
    f.dom.window.close();
  }
});
function modeSettings(identity = {}) {
  return { ...identity, mapId: millrace.id, matchModes: matchModeCatalog(millrace),
    maps: [millrace, lab].map(map => ({ id: map.id, name: map.name, matchModes: matchModeCatalog(map) })) };
}

test('ordinary Confluence choice shows its admitted Authored Rules and uses one authoritative map/mode change', () => {
  const tiny = JSON.parse(readFileSync(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url)));
  const confluence = JSON.parse(readFileSync(new URL('../maps/siltmouths-confluence-grounds.json', import.meta.url)));
  const maps = [tiny, confluence].map(map => ({ ...map, ...mapSizeIdentity(map), selectable: true,
    matchModes: matchModeCatalog(map) }));
  for (const player of [host, guest]) {
    const f = fixture(player, { ...skirmish, mapId: tiny.id, matchModes: matchModeCatalog(tiny), maps,
      canLaunch: true, seats: [{ ...host, connected: true, ready: true }, { ...guest, connected: true, ready: true }] },
      effectiveMapForMatchMode(tiny, skirmish));
    const picker = f.node('lobby-map'), option = [...picker.options].find(value => value.value === confluence.id);
    assert.equal(option.disabled, false);
    assert.match(option.textContent, /Tiny · 160 × 160.*Confluence Grounds.*Authored Rules/);
    assert.deepEqual(maps[1].matchModes.map(mode => [mode.id, mode.version]), [['authored', 1]]);
    assert.equal(maps[1].supportedUnitCapacity, null);
    picker.value = confluence.id; picker.dispatchEvent(new f.dom.window.Event('change'));
    picker.dispatchEvent(new f.dom.window.Event('change'));
    if (player === guest) assert.deepEqual(f.sent, []);
    else {
      assert.deepEqual(f.sent, [{ type: 'configureLobby', mapId: confluence.id,
        matchModeId: 'authored', matchModeVersion: 1, revision: 4 }]);
      assert.equal(f.node('lobby-ready').disabled, true);
      assert.equal(f.node('lobby-launch').disabled, true);
      f.ui.update({ ...f.state, revision: 5, mapId: confluence.id, armySize: 24,
        matchModeId: 'authored', matchModeVersion: 1, matchModes: maps[1].matchModes, canLaunch: false,
        seats: f.state.seats.map(seat => ({ ...seat, ready: false })) }, player, true, confluence);
      assert.equal(f.node('lobby-match-mode').value, 'authored@1');
      assert.equal(f.node('lobby-army-size').value, '24');
      assert.equal(f.node('lobby-launch').disabled, true);
    }
    f.dom.window.close();
  }
});

test('a projected Tiny choice submits one map/mode tuple and retains legacy visibility without extra tiers', () => {
  const tiny = JSON.parse(readFileSync(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url)));
  const current = { ...millrace, ...mapSizeIdentity(millrace), selectable: false, legacyCurrent: true,
    matchModes: matchModeCatalog(millrace) };
  const offered = { ...tiny, ...mapSizeIdentity(tiny), selectable: true, legacyCurrent: false,
    matchModes: matchModeCatalog(tiny) };
  const objective = { matchModeId: 'objective-control', matchModeVersion: 1 };
  const f = fixture(host, { ...modeSettings(objective), maps: [current, offered], canLaunch: true,
    seats: [{ ...host, connected: true, ready: true }, { ...guest, connected: true, ready: true }] }, millrace);
  const picker = f.node('lobby-map'), options = [...picker.options];
  assert.deepEqual(options.map(option => option.value), [millrace.id, tiny.id]);
  assert.equal(options[0].disabled, true); assert.match(options[0].textContent, /Current legacy map/);
  assert.match(options[1].textContent, /Tiny · 160 × 160.*Authored Rules/);
  assert.doesNotMatch(picker.textContent, /Small|Medium|Large|XL/);
  picker.value = tiny.id; picker.dispatchEvent(new f.dom.window.Event('change'));
  picker.dispatchEvent(new f.dom.window.Event('change'));
  assert.deepEqual(f.sent, [{ type: 'configureLobby', revision: 4, mapId: tiny.id,
    matchModeId: 'authored', matchModeVersion: 1 }]);
  assert.equal(f.node('lobby-ready').disabled, true); assert.equal(f.node('lobby-launch').disabled, true);
  const accepted = { ...f.state, revision: 5, mapId: tiny.id, matchModeId: 'authored', matchModeVersion: 1,
    matchModes: matchModeCatalog(tiny), maps: [offered], canLaunch: false,
    seats: f.state.seats.map(seat => ({ ...seat, ready: false })) };
  f.ui.update(accepted, host, true, tiny);
  assert.equal(picker.value, tiny.id); assert.equal(f.node('lobby-ready').disabled, false);
  assert.equal(f.node('lobby-launch').disabled, true); assert.equal(f.node('lobby-match-mode').value, 'authored@1');
  f.dom.window.close();
});

test('host mode binding waits through unrelated projections and uses authoritative ready resets', () => {
  const f = fixture(host, modeSettings(), millrace), select = f.node('lobby-match-mode');
  select.focus(); select.value = 'skirmish@1'; select.dispatchEvent(new f.dom.window.Event('change'));
  assert.deepEqual(f.sent, [{ type: 'configureLobby', ...skirmish, revision: 4 }]);
  disabledControlBlur(f.dom.window.document);
  f.ui.update(f.state, host);
  assert.equal(select.disabled, true); assert.equal(f.node('lobby-ready').disabled, true);
  assert.equal(f.node('lobby-map').disabled, true);
  select.dispatchEvent(new f.dom.window.Event('change')); f.node('lobby-ready').click();
  assert.equal(f.sent.length, 1);
  const accepted = { ...f.state, ...skirmish, revision: 5 };
  f.ui.update(accepted, host, true, effectiveMapForMatchMode(millrace, skirmish));
  assert.equal(select.value, 'skirmish@1'); assert.equal(select.disabled, false);
  assert.equal(f.dom.window.document.activeElement, select);
  assert.equal(f.node('lobby-ready').textContent, 'Ready');
  assert.equal(f.node('lobby-launch').disabled, true);
  assert.deepEqual([...select.options].map(option => option.value), ['objective-control@1', 'skirmish@1'],
    'the effective map must not hide canonical Objective Control compatibility');
  f.dom.window.close();
});

test('map changes explicitly label and send the atomic authored fallback without a mode lock', () => {
  const f = fixture(host, modeSettings(skirmish), effectiveMapForMatchMode(millrace, skirmish));
  const map = f.node('lobby-map');
  const labOption = [...map.options].find(option => option.value === lab.id);
  assert.equal(labOption.disabled, false); assert.match(labOption.textContent, /Authored Rules/);
  map.value = lab.id; map.dispatchEvent(new f.dom.window.Event('change'));
  assert.deepEqual(f.sent, [{ type: 'configureLobby', mapId: lab.id, matchModeId: 'authored', matchModeVersion: 1, revision: 4 }]);
  assert.equal(f.node('lobby-match-mode').value, 'skirmish@1');
  f.ui.reject('Lobby changed', { ...f.state, revision: 5 }, host);
  assert.equal(f.node('lobby-map').value, millrace.id);
  assert.equal(f.node('lobby-match-mode').value, 'skirmish@1');
  assert.equal(f.node('lobby-ready').disabled, false);
  f.dom.window.close();
});

test('guests cannot choose modes and unsupported identities block ready and launch', () => {
  const f = fixture(guest, modeSettings(skirmish), effectiveMapForMatchMode(millrace, skirmish));
  const select = f.node('lobby-match-mode');
  assert.equal(select.disabled, true);
  select.value = 'objective-control@1'; select.dispatchEvent(new f.dom.window.Event('change'));
  assert.deepEqual(f.sent, []);
  f.ui.update({ ...f.state, matchModeVersion: 2, canLaunch: true }, host);
  assert.equal(f.node('lobby-ready').disabled, true); assert.equal(f.node('lobby-launch').disabled, true);
  assert.match(f.node('lobby-match-mode-status').textContent, /Reload/);
  f.dom.window.close();
});

test('projected tier labels and current legacy availability are consumed without guessing capacity', () => {
  const maps = [
    { id: 'tiny', name: 'Terraced Vale', width: 160, height: 160, sizeTierLabel: 'Tiny', selectable: true, supportedUnitCapacity: null },
    { id: 'legacy', name: 'Old Lab', width: 64, height: 64, selectable: false, legacyCurrent: true },
  ];
  const f = fixture(host, { maps, mapId: 'legacy' });
  const options = [...f.node('lobby-map').options];
  assert.equal(options[0].textContent, 'Tiny · 160 × 160 · Terraced Vale');
  assert.equal(options[1].textContent, 'Old Lab · Current legacy map');
  assert.equal(options[1].disabled, true); assert.equal(f.node('lobby-map').value, 'legacy');
  assert.equal(f.root.textContent.includes('capacity'), false);
  f.dom.window.close();
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
  const firstReady = { ...f.state, seats: f.state.seats.map(seat => ({ ...seat, ready: seat.id === guest.id })) };
  f.ui.update(firstReady, guest);
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
