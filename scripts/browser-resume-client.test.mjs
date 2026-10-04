// Actual composition-root functions and sprite/matrix application; CPU only.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { BrowserStateRecovery } from '../src/browser-state-recovery.mjs';
import { createUnitPresentationClientFixture, workerSnapshotRow } from './unit-presentation-client-fixture.mjs';
import { classifyOrderNotice } from '../src/order-feedback.mjs';

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
