// Actual composition-root functions and sprite/matrix application; CPU only.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { BrowserStateRecovery } from '../src/browser-state-recovery.mjs';
import { createUnitPresentationClientFixture, workerSnapshotRow } from './unit-presentation-client-fixture.mjs';
import { classifyOrderNotice } from '../src/order-feedback.mjs';
import { createWelcomeSession } from '../src/client/networking/welcome-session.mjs';
import { browserRecoveryBindings } from './browser-recovery-fixture.mjs';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
function section(start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from); return source.slice(from, to);
}

test('actual snapshot application snaps current coordinates without rebuilding camera/selection or replaying combat', async () => {
  const f = await createUnitPresentationClientFixture();
  try {
    f.apply([workerSnapshotRow()], { initial: true });
    const unit = f.unit(0); f.context.selected.add(0);
    f.context.controlGroups[0].add(0);
    unit.attackStartedAt = unit.damageFlashUntil = 1000;
    unit.spriteClockStartedAt = 500;
    let rebuilds = 0, arrows = 0;
    f.context.setArmySize = () => { rebuilds++; };
    f.context.addArrowTrace = () => { arrows++; };
    f.context.applyState({ mapId: 'unit-presentation-fixture', tick: 100,
      armySize: 24, workerPerformingActionVersion: 1,
      units: [workerSnapshotRow({ x: 30, z: -20, hp: 80, task: 'idle', attackTick: 99 })] }, false, true);
    assert.equal(unit.renderX, 30); assert.equal(unit.renderZ, -20);
    assert.equal(unit.serverX, 30); assert.equal(unit.serverZ, -20);
    for (const field of ['attackStartedAt', 'hitStartedAt', 'damageFlashUntil', 'spawnStartedAt', 'defeatStartedAt']) assert.equal(unit[field], 0);
    assert.equal(rebuilds, 0); assert.equal(arrows, 0);
    assert.deepEqual([...f.context.selected], [0]);
    assert.deepEqual([...f.context.controlGroups[0]], [0]);
    assert.equal(unit.spriteClockStartedAt, 500, 'continuous sprite clocks are retained, with no replay loop');
    f.frame(601000, 0); assert.equal(unit.renderX, 30);
  } finally { f.dispose(); }
});

test('actual old packet path rebuilds presentation per receipt; the new state handler bounds it to a frame', async () => {
  const f = await createUnitPresentationClientFixture();
  try {
    let applications = 0;
    f.context.updateEconomyUI = () => { applications++; };
    const packet = { mapId: 'unit-presentation-fixture', serverInstanceId: 'a', matchId: 'b', tick: 1,
      units: [workerSnapshotRow()] };
    f.context.applyState(packet, true);
    applications = 0;
    for (let tick = 2; tick <= 1201; tick++) f.context.applyState({ ...packet, tick });
    assert.equal(applications, 1200, 'baseline immediate path does full HUD work for every queued state');
    applications = 0;
    const recovery = new BrowserStateRecovery(); recovery.reset(packet, 0); recovery.frame(0);
    const context = vm.createContext({ browserStateRecovery: recovery, performance: { now: () => 100 },
      message: null });
    const handler = section("    if (message.type === 'state' || message.type === 'stateRefresh')", "    if (message.type === 'lobby')");
    vm.runInContext(`function receive() { ${handler} }`, context);
    for (let tick = 2; tick <= 1201; tick++) { context.message = { ...packet, type: 'state', tick }; context.receive(); }
    assert.equal(applications, 0);
    const update = recovery.frame(16); f.context.applyState(update.state, false, update.snap);
    assert.equal(applications, 1); assert.equal(update.state.tick, 1201);
    recovery.suspend();
    for (let tick = 1202; tick <= 2401; tick++) { context.message = { ...packet, type: 'state', tick }; context.receive(); }
    assert.equal(recovery.pending, null); assert.equal(applications, 1);
  } finally { f.dispose(); }
});

test('visible blur clears held keys, pointer capture and gestures without a refresh or accidental order', () => {
  let commands = 0, cleared = 0; const released = [];
  const recovery = new BrowserStateRecovery();
  const context = vm.createContext({ browserStateRecovery: recovery,
    resetWallPlacement: () => {}, buildPlacementPending: false,
    cursorPointer: {}, cursorShift: true, tapOrderArmed: true,
    setTapOrderArmed: () => {}, spaceDown: true, spaceCenterPending: true,
    clearHeldCameraKeys: () => { cleared++; }, pan: {}, drag: {},
    selectionBox: { style: { display: 'block' }, removeAttribute: () => {} },
    tapOrderPointer: { id: 2 }, capturedCanvasPointerId: 2, minimapPointerId: 3,
    renderer: { domElement: { hasPointerCapture: () => true, releasePointerCapture: id => released.push(id) } },
    minimapCanvas: { hasPointerCapture: () => true, releasePointerCapture: id => released.push(id) },
    edgeScrollPointer: {}, syncBattlefieldCursor: () => {}, lastControlGroupRecall: {},
    lastFriendlyUnitClick: {}, lastUnitPickState: {}, sendCommand: () => { commands++; },
  });
  vm.runInContext(section('function clearSuspendedInput()', "window.addEventListener('blur'"), context);
  context.clearSuspendedInput();
  assert.equal(cleared, 1); assert.equal(commands, 0);
  assert.deepEqual(released, [2, 3]); assert.equal(recovery.visible, true); assert.equal(recovery.recovering, false);
  for (const field of ['pan', 'drag', 'tapOrderPointer', 'capturedCanvasPointerId', 'minimapPointerId', 'edgeScrollPointer']) assert.equal(context[field], null);
  assert.equal(context.selectionBox.style.display, 'none');
  assert.equal(context.spaceDown, false); assert.equal(context.spaceCenterPending, false);
});

test('queued reliable events suppress stale audio/toasts while still consuming order acknowledgements', () => {
  let sounds = 0, toasts = 0, acknowledgements = 0, victories = 0;
  const recovery = new BrowserStateRecovery(); recovery.resume(0);
  const context = vm.createContext({ browserStateRecovery: recovery, document: { visibilityState: 'visible' },
    message: null, localTeam: 0, currentOrderToken: 1, pendingBuildOrderToken: null,
    audio: { playEvent: () => { sounds++; } }, showToast: () => { toasts++; },
    cueForScenarioEvent: () => 'objective', cueForNotice: () => 'objective',
    updateMatchResult: () => { victories++; }, classifyOrderNotice,
    orderAudioGate: { observe: () => ({ cue: 'move' }) }, applyOrderNotice: () => { acknowledgements++; },
  });
  vm.runInContext(section('function canPresentLiveFeedback()', "window.addEventListener('online'"), context);
  const events = section("    if (message.type === 'trigger')", "    if (message.type === 'mapRejected')");
  const notices = section("    if (message.type === 'notice')", "\n  });\n  connection.addEventListener('close'");
  vm.runInContext(`function receive() { ${events}\n${notices} }`, context);
  for (const type of ['trigger', 'scenarioEvent', 'victory']) {
    context.message = { type, team: 0, message: 'old event' }; context.receive();
  }
  context.message = { type: 'notice', clientOrderToken: 1, message: 'MOVE ORDER · 1 UNITS' }; context.receive();
  assert.equal(sounds, 0); assert.equal(toasts, 0); assert.equal(victories, 0);
  assert.equal(acknowledgements, 1);
  recovery.recovering = false;
  context.message = { type: 'scenarioEvent', team: 0, message: 'current event' }; context.receive();
  assert.equal(sounds, 1); assert.equal(toasts, 1);
});

test('actual full refresh handler clears queued replaceable state/metadata before reliable response', async () => {
  const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  const from = server.indexOf('async function handleCommand('), to = server.indexOf('  if (pregame)', from);
  const sent = [], current = { type: 'state', tick: 10, units: [[1, 0, 2, 0]], queuedWaypointCounts: [[1, 2]] };
  const peer = { team: 0, pendingState: { tick: 10, units: [[1, 0, 1, 0]] }, pendingWaypointCounts: [[1, 1]],
    sendJson(packet) { assert.equal(this.pendingState, null); assert.equal(this.pendingWaypointCounts, null); sent.push(packet); } };
  const context = vm.createContext({ shuttingDown: false, roomPayload: team => { assert.equal(team, 0); return current; } });
  vm.runInContext(`${server.slice(from, to)}\n}`, context);
  await context.handleCommand(peer, { type: 'stateRefresh', stateRefreshId: 3 });
  assert.equal(sent.length, 1); assert.equal(sent[0].type, 'stateRefresh'); assert.equal(sent[0].stateRefreshId, 3);
  assert.deepEqual(sent[0].units, current.units);
  const queued = peer.pendingState = { tick: 10 };
  await context.handleCommand(peer, { type: 'stateRefresh', stateRefreshId: 0 });
  assert.equal(peer.pendingState, queued); assert.equal(sent.length, 1);
});

// Actual socket body and production key/factory initialization; controlled
// callbacks prove storage ordering without claiming rendered browser acceptance.
function welcomeFixture({ room = 'room-a', hasRoom = true, previous = {}, failAt, throwAt } = {}) {
  const trace = [], connections = [], values = new Map(Object.entries(previous));
  let accesses = 0;
  const prefix = 'thousand-unit-skirmish-session';
  const keys = { token: `${prefix}:${room || 'default'}`,
    instance: `${prefix}:instance:localhost:${room || 'default'}`,
    match: `${prefix}:match:localhost:${room || 'default'}`, lastRoom: 'thousand-unit-skirmish-last-room' };
  function record(label, value) {
    trace.push(value === undefined ? [label] : [label, value]);
    if (failAt === label || throwAt === label) throw new Error(label);
  }
  const storage = {
    getItem(key) { record(`get:${key}`); return values.get(key) ?? null; },
    setItem(key, value) { record(`set:${key}`, value); values.set(key, value); },
    removeItem(key) { record(`remove:${key}`); values.delete(key); },
  };
  class WebSocket {
    constructor(url, protocols) { this.url = url; this.protocols = protocols; this.events = new Map(); connections.push(this); }
    addEventListener(type, callback) { this.events.set(type, callback); }
    message(value) { this.events.get('message')({ data: JSON.stringify(value) }); }
  }
  const context = vm.createContext({ ...browserRecoveryBindings(), createWelcomeSession, WebSocket, URL,
    location: { protocol: 'http:', host: 'localhost' }, ROOM_ID: room, HAS_ROOM_PARAMETER: hasRoom,
    pageLeaving: false, localTeam: 0, cameraSeatTeam: 0, socket: null, waitingForResume: false,
    mapDefinition: null, currentArmySize: 24, document: { visibilityState: 'visible' },
    window: { reportPrototypeError: value => record('invalid-map', value) },
    ui: { orderStatus: { textContent: '' }, mapStudio: { open: false } }, TEAM_NAMES: ['Azure', 'Ember'],
    setConnection() {}, loadMapAudio: value => record('audio', value), buildMap: () => record('map'),
    setPlayer(player) { record('player'); context.localTeam = player.team; },
    applyLobby: () => record('lobby'), roomLobby: { updateChat: () => record('chat') },
    setMapCatalog: () => record('catalog'), setArmySize: () => record('army'),
    applyState: () => record('state'), updateRoomUI: () => record('room'),
    showToast: (value, duration) => record('toast', [value, duration]), reconnectDelayMs: 500,
  });
  Object.defineProperty(context, 'sessionStorage', { get() {
    accesses++; if (failAt === `access:${accesses}`) throw new Error('storage getter'); return storage;
  } });
  vm.runInContext(section('const SESSION_STORAGE_KEY', '\nconst welcomeSession')
    + section('const welcomeSession', '\n});') + '\n});', context);
  assert.equal(accesses, 0, 'construction must defer browser storage access');
  vm.runInContext(section('function connectSocket(', "\nwindow.addEventListener('beforeunload'"), context);
  const connect = () => { context.connectSocket({ onSessionConfirmed: () => record('confirmed') }); return connections.at(-1); };
  const welcome = (changes = {}) => ({ type: 'welcome', serverInstanceId: 'instance-b', matchId: 'match-b',
    map: { id: 'welcome-map', obstacles: [], triggers: [], scenarioEvents: [], audio: 'map-audio' }, maps: [],
    state: { armySize: 24, connected: 2, serverInstanceId: 'instance-b', matchId: 'match-b', tick: 1 },
    player: { team: 0, sessionToken: 'new-token' }, ...changes });
  return { context, keys, values, trace, connect, welcome, accesses: () => accesses };
}

test('actual welcome stores identity before audio/map and seat token before confirmation and state', () => {
  const f = welcomeFixture({ room: '' });
  f.values.set(f.keys.token, 'old-token'); f.values.set(f.keys.instance, 'instance-a'); f.values.set(f.keys.match, 'match-a');
  const connection = f.connect();
  assert.deepEqual([...connection.protocols], ['rts-v1', 'rts-resume.old-token']);
  assert.equal(connection.url.searchParams.get('room'), '');
  connection.message(f.welcome());
  assert.deepEqual(f.trace.slice(0, 9), [
    [`get:${f.keys.token}`], [`get:${f.keys.instance}`], [`set:${f.keys.instance}`, 'instance-b'],
    [`get:${f.keys.match}`], [`set:${f.keys.match}`, 'match-b'], ['audio', 'map-audio'], ['map'],
    [`set:${f.keys.token}`, 'new-token'], [`set:${f.keys.lastRoom}`, ''],
  ]);
  assert.deepEqual(f.trace.slice(9, -1).map(entry => entry[0]), ['player', 'confirmed', 'lobby', 'chat', 'catalog', 'army', 'state', 'room']);
  assert.deepEqual(f.trace.at(-1), ['toast', ['MATCH SERVER RESTARTED · THE MATCH RESET', 3600]]);
  assert.equal(f.accesses(), 7, 'each original storage expression evaluates the getter');
});

test('identity reads and writes fail independently; a failed write retains the computed reset flag', () => {
  for (const [fault, reset] of [['get:instance', false], ['set:instance', true], ['access:2', false], ['access:3', true]]) {
    const f = welcomeFixture(); f.values.set(f.keys.instance, 'instance-a'); f.values.set(f.keys.match, 'match-b');
    const failure = fault.replace(':instance', `:${f.keys.instance}`);
    const failed = welcomeFixture({ previous: Object.fromEntries(f.values), failAt: failure });
    failed.connect().message(failed.welcome());
    assert.equal(failed.values.get(failed.keys.match), 'match-b', failure);
    assert.equal(failed.values.get(failed.keys.token), 'new-token', failure);
    assert.equal(failed.trace.at(-1)[1][0].includes('MATCH RESET'), reset, failure);
    assert.ok(failed.trace.some(([label]) => label === `set:${failed.keys.match}`), failure);
  }
});

test('seat and last-room storage retain their shared catch and resume-pending deletion behavior', () => {
  for (const fault of ['token', 'lastRoom']) {
    const key = welcomeFixture().keys[fault];
    const f = welcomeFixture({ failAt: `set:${key}` }); f.values.set(f.keys.token, 'old-token');
    f.connect().message(f.welcome());
    assert.equal(f.values.get(f.keys.token), fault === 'token' ? 'old-token' : 'new-token');
    assert.equal(f.values.has(f.keys.lastRoom), false);
    assert.equal(f.trace.some(([label]) => label === `set:${f.keys.lastRoom}`), fault === 'lastRoom');
    assert.ok(f.trace.some(([label]) => label === 'state'));
  }
  for (const pending of [true, false]) {
    const f = welcomeFixture({ hasRoom: false }); f.values.set(f.keys.token, 'old-token');
    f.connect().message(f.welcome({ player: { team: null, resumePending: pending } }));
    assert.equal(f.values.has(f.keys.token), pending);
  }
  const f = welcomeFixture({ hasRoom: false }); f.connect().message(f.welcome());
  assert.equal(f.values.get(f.keys.lastRoom), 'default');
});

test('synchronous audio/map failures leave identity stored and skip seat writes and subsequent callbacks', () => {
  for (const callback of ['audio', 'map']) {
    const f = welcomeFixture({ throwAt: callback }); const connection = f.connect();
    assert.throws(() => connection.message(f.welcome()), new RegExp(callback));
    assert.equal(f.values.get(f.keys.instance), 'instance-b'); assert.equal(f.values.get(f.keys.match), 'match-b');
    assert.equal(f.values.has(f.keys.token), false); assert.equal(f.trace.at(-1)[0], callback);
    assert.equal(f.context.waitingForResume, false);
  }
});

test('stale welcome messages cannot access storage or invoke welcome callbacks', () => {
  const f = welcomeFixture(); const stale = f.connect(), current = f.connect();
  const before = structuredClone(f.trace), accesses = f.accesses();
  stale.message(f.welcome()); assert.deepEqual(f.trace, before); assert.equal(f.accesses(), accesses);
  current.message(f.welcome()); assert.equal(f.values.get(f.keys.token), 'new-token');
});

test('welcome identity preserves empty IDs and truthy versus strict checkpoint recovery decisions', () => {
  for (const recovery of [undefined, false, true, 'true']) {
    const values = new Map([['instance', 'old'], ['match', 'same']]);
    const session = createWelcomeSession({ getStorage: () => ({ getItem: key => values.get(key),
      setItem: (key, value) => values.set(key, value) }), instanceKey: 'instance', matchKey: 'match' });
    const flags = session.recordWelcomeIdentity({ serverInstanceId: '', matchId: 'same', recoveredFromCheckpoint: recovery });
    assert.deepEqual(flags, { matchInstanceChanged: true, matchIdentityChanged: false,
      matchWasReset: !recovery, matchWasRestored: recovery === true });
    assert.equal(values.get('instance'), '');
  }
  let accesses = 0;
  const session = createWelcomeSession({ getStorage: () => { accesses++; throw new Error('unavailable'); } });
  assert.equal(accesses, 0); assert.equal(session.readResumeToken(), null);
  assert.deepEqual(session.recordWelcomeIdentity({ serverInstanceId: null, matchId: 2 }), {
    matchInstanceChanged: false, matchIdentityChanged: false, matchWasReset: false, matchWasRestored: false,
  });
  assert.equal(accesses, 1, 'non-string IDs do not access storage');
});
