// CPU rejection controls only. Browser input and PNGs come from the Linux
// clean-pack qualification run; these fabricated observations cannot pass it.
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { QUEUE_CAPTURE_MAP, readQueueObservation, validateQueueObservation,
  validateQueueRefund, dispatchQueueEnter, installQueueKeyObserver, readQueueSetupFailure } from './renderer-qualification-building-queue.mjs';
import { mapSizeIdentity } from '../src/map-size-policy.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';

const observation = (queue = ['spearman', 'infantry', 'spearman']) => ({
  mapId: QUEUE_CAPTURE_MAP.id, team: 0, bank: { food: 830, wood: 785 }, selected: true, focus: '1',
  building: { id: 7, type: 'barracks', team: 0, complete: true, queue, remaining: 6, blocked: false },
  controls: queue.map((kind, index) => ({ index, enabled: true,
    label: `${index + 1}. ${UNIT_DEFINITIONS[kind].label} · Cancel` })),
});

test('qualification CLI and reused selector imports initialize without a capture side effect', () => {
  const result = spawnSync(process.execPath, ['scripts/renderer-qualification.mjs'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 5000,
  });
  assert.equal(result.status, 2); assert.match(result.stderr, /^Usage:/); assert.equal(result.stdout, '');
});

test('Enter input carries native activation data and observes only trusted planned events', async () => {
  const calls = [];
  await dispatchQueueEnter({ cdp: { async call(method, parameters) { calls.push({ method, parameters }); } } });
  assert.deepEqual(calls.map(call => call.method), ['Input.dispatchKeyEvent', 'Input.dispatchKeyEvent']);
  const [down, up] = calls.map(call => call.parameters);
  assert.equal(down.type, 'keyDown'); assert.equal(up.type, 'keyUp');
  for (const input of [down, up]) {
    assert.equal(input.key, 'Enter'); assert.equal(input.code, 'Enter'); assert.equal(input.windowsVirtualKeyCode, 13);
  }
  assert.equal(down.text, '\r'); assert.equal(down.unmodifiedText, '\r'); assert.equal(up.text, undefined);
  const listeners = {}, window = {}, target = { closest: () => true };
  const context = vm.createContext({ window, document: { addEventListener(type, listener) { listeners[type] = listener; } } });
  vm.runInContext(`(${installQueueKeyObserver.toString()})()`, context);
  for (const type of ['keydown', 'keypress', 'keyup']) {
    listeners[type]({ key: 'private-unrelated-key', keyCode: 81, isTrusted: true, target });
    assert.equal(window.__rtsQueueKeyReceipt[type], false);
    listeners[type]({ key: 'Enter', keyCode: 0, isTrusted: true, target }); assert.equal(window.__rtsQueueKeyReceipt[type], false);
    listeners[type]({ key: 'Enter', keyCode: 13, isTrusted: false, target }); assert.equal(window.__rtsQueueKeyReceipt[type], false);
    listeners[type]({ key: 'Enter', keyCode: 13, isTrusted: true, target }); assert.equal(window.__rtsQueueKeyReceipt[type], true);
  }
  listeners.click({ target, isTrusted: false }); assert.equal(window.__rtsQueueKeyReceipt.trustedClick, false);
  listeners.click({ target, isTrusted: true }); assert.equal(window.__rtsQueueKeyReceipt.trustedClick, true);
  assert.doesNotMatch(JSON.stringify(window.__rtsQueueKeyReceipt), /private-unrelated/);
});

test('queue fixture admits ordinary authored play without starting buildings or a bank override', () => {
  assert.equal(mapSizeIdentity(QUEUE_CAPTURE_MAP).ordinarySelectable, true);
  assert.deepEqual(QUEUE_CAPTURE_MAP.startingResources, { food: 1000, wood: 1000 });
  assert.equal(QUEUE_CAPTURE_MAP.startingArmySize, 24); assert.deepEqual(QUEUE_CAPTURE_MAP.resourceNodes, []);
  assert.equal(QUEUE_CAPTURE_MAP.buildings, undefined);
});

test('queue observations require the owned selected completed producer and matching enabled HUD slots', () => {
  const good = observation(); validateQueueObservation(good, good.building.queue);
  for (const change of [{ mapId: 'other' }, { team: 1 }, { selected: false }, { bank: { food: NaN, wood: 785 } },
    ...[{ team: 1 }, { complete: false }, { type: 'house' }, { queue: ['infantry'] }, { remaining: -1 }]
      .map(building => ({ building: { ...good.building, ...building } })),
    ...[{ index: 9 }, { label: 'Cancel' }, { enabled: false }]
      .map(control => ({ controls: [{ ...good.controls[0], ...control }, ...good.controls.slice(1)] })),
    { controls: [] }]) assert.throws(() => validateQueueObservation({ ...good, ...change }, good.building.queue));
});

test('waiting cancellation proves its exact refund and preserves the other paid entries', () => {
  const before = observation(), after = observation(['spearman', 'spearman']);
  after.bank = { food: before.bank.food + 50, wood: before.bank.wood };
  assert.deepEqual(validateQueueRefund(before, after, 1), { kind: 'infantry', index: 1, refund: { food: 50, wood: 0 } });
  for (const bank of [{ food: 879, wood: 785 }, { food: 881, wood: 785 }, { food: 880, wood: 786 }])
    assert.throws(() => validateQueueRefund(before, { ...after, bank }, 1));
  assert.throws(() => validateQueueRefund(before, observation(['infantry', 'spearman']), 1));
  assert.throws(() => validateQueueRefund(before, { ...after, building: { ...after.building, id: 8 } }, 1));
});

test('the same refund contract supports an explicit staging fixture without accepting mixed map identities', () => {
  const before = observation(), after = observation(['spearman', 'spearman']);
  before.mapId = after.mapId = 'hud-buildings';
  after.bank = { food: before.bank.food + 50, wood: before.bank.wood };
  assert.throws(() => validateQueueRefund(before, after, 1));
  assert.deepEqual(validateQueueRefund(before, after, 1, 'hud-buildings').refund, { food: 50, wood: 0 });
  for (const changed of [{ mapId: QUEUE_CAPTURE_MAP.id }, { team: 1 }, { bank: { food: 881, wood: 785 } }])
    assert.throws(() => validateQueueRefund(before, { ...after, ...changed }, 1, 'hud-buildings'));
});

test('active cancellation proves proportional incomplete-work refund, including the final entry', () => {
  for (const queue of [['spearman', 'spearman'], ['spearman']]) {
    const before = observation(queue), after = observation(queue.slice(1));
    after.bank = { food: before.bank.food + 24, wood: before.bank.wood + 8 };
    validateQueueRefund(before, after, 0);
    for (const delta of [[0, 0], [60, 20], [24, 7], [31, 31 / 3], [-1, -1]])
      assert.throws(() => validateQueueRefund(before, { ...after,
        bank: { food: before.bank.food + delta[0], wood: before.bank.wood + delta[1] } }, 0));
    for (const remaining of [0, 12]) assert.throws(() => validateQueueRefund({ ...before,
      building: { ...before.building, remaining } }, after, 0));
  }
});

test('queue readout reduces only known HUD and disclosed production facts', () => {
  const row = { id: 7, team: 0, type: 'barracks', complete: true, productionQueue: ['spearman'],
    trainingRemaining: 6, productionBlocked: false, privateSession: 'must-not-retain' };
  const context = vm.createContext({ window: { __rtsEnvironmentStateSnapshot: { mapId: QUEUE_CAPTURE_MAP.id,
    team: 0, bank: { food: 830, wood: 785 }, buildings: [row] }, __rtsInteractionAudioSnapshot: () => ({ buildings: [{ id: 7, selected: true }] }) },
    document: { activeElement: { dataset: { queueIndex: '0' } }, querySelector: () => ({ querySelectorAll: () => [{
      dataset: { queueIndex: '0' }, textContent: '1. Spearman · Cancel', disabled: false,
      getAttribute: () => 'false', closest: () => null }] }) } });
  const value = vm.runInContext(`(${readQueueObservation.toString()})(7)`, context);
  validateQueueObservation(JSON.parse(JSON.stringify(value)), ['spearman']);
  assert.equal(value.focus, '0'); assert.doesNotMatch(JSON.stringify(value), /privateSession|must-not-retain/);
});

test('setup diagnostics retain bounded owned state without messages, URLs or unrelated controls', () => {
  const element = { closest: () => null, getClientRects: () => [{}], getAttribute: () => 'false',
    disabled: false, dataset: { activePanel: 'economy' }, textContent: 'private-unrelated-content' };
  const context = vm.createContext({ window: { __rtsEnvironmentStateSnapshot: { mapId: QUEUE_CAPTURE_MAP.id,
    team: 0, bank: { food: 1000, wood: 825, privateValue: 'private-unrelated-content' },
    workers: [{ team: 0 }, { team: 1 }], buildings: [{ id: 7, team: 0, type: 'barracks', complete: false,
      progress: .5, privateValue: 'private-unrelated-content' }, { id: 8, team: 1, type: 'house' }],
    messages: ['private-unrelated-content'] }, __rtsBuildingPlacementSnapshot: { active: true, pending: false,
      type: 'barracks', valid: true, visible: true, privateValue: 'private-unrelated-content' } },
    document: { documentElement: { dataset: { entry: 'game' } }, querySelector: () => element } });
  const value = vm.runInContext(`(${readQueueSetupFailure.toString()})()`, context);
  assert.equal(value.workerCount, 1); assert.equal(value.buildings.length, 1); assert.equal(value.buildings[0].id, 7);
  assert.equal(value.controls['#select-workers'].visible, true); assert.equal(value.drawer, 'economy');
  assert.doesNotMatch(JSON.stringify(value), /private-unrelated-content|privateValue|messages/);
});

test('diagnostic production fields remain opt-in and never expose enemy queue data', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const start = main.indexOf('function updateEnvironmentStateCaptureSnapshot(');
  const fn = main.slice(start, main.indexOf('\nfunction ', start + 1));
  for (const flag of [undefined, true]) {
    class Vector3 { constructor(x, y, z) { Object.assign(this, { x, y, z }); } project() { return this; } }
    const window = { __rtsCaptureDiagnostics: flag };
    const context = vm.createContext({ window, roomPageUrl: new URL('http://localhost/'), localTeam: 0,
      mapDefinition: {}, resourceNodeVisuals: new Map(), buildingVisuals: new Map(), camera: { zoom: 1 },
      renderer: { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }) } },
      groundHeight: () => 0, THREE: { Vector3 }, constructionGroundStage: () => 'complete', mapObjects: [],
      constructionGroundMeshes: new Map(), palisadeGroundMeshes: new Map(), RESOURCE_STATE_ASSET_STATUS: {},
    });
    vm.runInContext(fn, context);
    context.updateEnvironmentStateCaptureSnapshot({ mapId: QUEUE_CAPTURE_MAP.id, food: [830, 900], wood: [785, 900], units: [],
      buildings: [0, 1].map(team => ({ id: 7 + team, team, type: 'barracks', complete: true,
        productionQueue: ['spearman'], trainingRemaining: 6, productionBlocked: false, x: 0, z: 0 })) });
    if (flag !== true) assert.equal(window.__rtsEnvironmentStateSnapshot, undefined);
    else {
      const [own, enemy] = window.__rtsEnvironmentStateSnapshot.buildings;
      assert.deepEqual([...own.productionQueue], ['spearman']); assert.equal(own.trainingRemaining, 6);
      for (const key of ['productionQueue', 'trainingRemaining', 'productionBlocked']) assert.equal(Object.hasOwn(enemy, key), false);
    }
  }
});
