// CPU rejection controls; none of these fabricated records qualify game pixels.
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { bootGameEntry } from '../src/game-entry.mjs';
import { createRoomLobby } from '../src/room-lobby-ui.mjs';
import { matchModeCatalog } from '../src/match-modes.mjs';
import { bracketFarmPhase, enterTinyFarmRoom, farmCdpFault, farmFailureCategory, installFarmObserver, observeFarmCdpEvents, readFarmCdpHealth, reduceFarmOrder, reduceFarmState, run, TINY_FARM_MAP, waitForFarmGuestReady,
  tinyFarmSites, validateFarmArt, validateFarmBuild, validateFarmEconomy, validateFarmFoundation, validateFarmSupply } from './renderer-tiny-farm-scenario.mjs';
import { loadCaptureCases } from './renderer-feature-capture.mjs';
import { createPveHeadlessFixture } from './pve-headless-fixture.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';

const clone = value => structuredClone(value);
function state(team = 0) {
  return { team, tick: 10, mapId: TINY_FARM_MAP, matchModeId: 'skirmish', matchModeVersion: 1,
    bank: { food: 150, wood: 250 }, buildings: [], dropoffs: [],
    workers: [1, 2, 3, 4].map(id => ({ id: id + team * 10, team, generation: 1,
      x: team ? 57.5 : -57.5, z: .5, cargo: 0, cargoType: null, task: 'idle' })) };
}
const plot = (team, extra = {}) => ({ id: 7, team, type: 'farm', x: team ? 51.5 : -51.5,
  z: 5.5, complete: true, harvestStock: 200, ...extra });
function message(team = 0) {
  const s = state(team);
  return { type: 'welcome', player: { team, sessionToken: 'private-secret' }, socketUrl: 'private-secret', state: {
    tick: s.tick, mapId: s.mapId, matchModeId: 'skirmish', matchModeVersion: 1,
    food: [150, 150], wood: [250, 250], chat: 'private-secret', buildings: [plot(0), plot(1)],
    units: [...state(0).workers, ...state(1).workers].map(w => [w.id, w.team, w.x, w.z, 60, 'worker', 0, null, 1, 'idle']),
    homeTownCenters: [{ id: 99, team, type: 'town-center', complete: true, hp: 1000, x: 0, z: 0 }],
  } };
}

for (const team of [0, 1]) {
  test(`seat ${team} reducer retains only owned economy and live wire cargo`, () => {
    const m = message(team); m.state.units[team * 4][6] = 3.33; m.state.units[team * 4][7] = 'food';
    const reduced = reduceFarmState(m, team);
    assert.equal(reduced.team, team); assert.equal(reduced.workers.length, 4);
    assert.ok(reduced.workers.every(w => w.team === team));
    assert.equal(reduced.workers[0].cargo, 3.33); assert.equal(reduced.buildings.length, 1);
    assert.equal(reduced.buildings[0].team, team); assert.deepEqual(reduced.bank, { food: 150, wood: 250 });
    assert.equal(reduced.dropoffs[0].type, 'town-center');
    assert.doesNotMatch(JSON.stringify(reduced), /private-secret|sessionToken|socketUrl|chat/);
    for (const bad of [null, { ...m, type: 'notice' }, { ...m, state: { ...m.state, tick: -1 } },
      { ...m, state: { ...m.state, mapId: 'authored-test-map' } }]) assert.equal(reduceFarmState(bad, team), null);
    assert.equal(reduceFarmState(m, null), null);
  });
  test(`seat ${team} paid foundations preserve exact costs and clicked identity`, () => {
    for (const type of ['farm', 'mill']) {
      const before = state(team), after = clone(before), site = { x: team ? 51.5 : -51.5, z: 5.5 };
      after.bank.wood -= type === 'farm' ? 60 : 75;
      after.buildings = [plot(team, { type, complete: false, harvestStock: type === 'farm' ? 0 : null })];
      const options = { team, type, site, ids: before.workers.map(w => w.id) };
      assert.equal(validateFarmBuild(before, after, options).id, 7);
      for (const mutation of [s => s.bank.wood++, s => s.bank.wood -= 60, s => s.bank.food++,
        s => s.buildings.push({ ...s.buildings[0], id: 8 }), s => s.buildings[0].team = 1 - team,
        s => s.buildings[0].complete = true, s => s.buildings[0].x += 3]) {
        const bad = clone(after); mutation(bad); assert.throws(() => validateFarmBuild(before, bad, options));
      }
      assert.throws(() => validateFarmBuild(before, after, { ...options, ids: options.ids.slice(1) }));
    }
  });
  test(`seat ${team} crop accounting includes carried Food and real exhaustion deposit`, () => {
    const initial = state(team), harvest = clone(initial);
    harvest.tick++; harvest.bank.food = 170;
    harvest.workers[0].cargo = 3.33; harvest.workers[0].cargoType = 'food'; harvest.workers[0].task = 'gathering';
    harvest.buildings = [plot(team, { harvestStock: 176.67 })];
    validateFarmSupply(initial, harvest, 7, { team });
    const depleted = clone(initial); depleted.bank.food = 350; depleted.buildings = [plot(team, { harvestStock: 0 })];
    validateFarmSupply(initial, depleted, 7, { team, exhausted: true });
    for (const mutation of [s => s.bank.food += .02, s => s.bank.food -= .02,
      s => s.workers[0].cargo = 0, s => s.workers[0].cargoType = null,
      s => s.workers[0].generation++, s => s.buildings[0].harvestStock = -1,
      s => s.buildings[0].complete = false, s => s.tick = 9, s => s.team = 1 - team]) {
      const bad = clone(harvest); mutation(bad); assert.throws(() => validateFarmSupply(initial, bad, 7, { team }));
    }
    const fakeDepleted = clone(harvest); fakeDepleted.buildings[0].harvestStock = 0;
    assert.throws(() => validateFarmSupply(initial, fakeDepleted, 7, { team, exhausted: true }));
    const renewed = clone(depleted); renewed.buildings = [plot(team, { id: 8, harvestStock: 190 })]; renewed.bank.food += 10;
    validateFarmSupply(depleted, renewed, 8, { team });
    renewed.bank.food = depleted.bank.food + 1e-10;
    assert.throws(() => validateFarmSupply(depleted, renewed, 8, { team }));
  });
}

test('orders retain only valid Farm identities and selection; generic commands are not evidence', () => {
  for (const command of [{ type: 'build', ids: [1, 2], buildingType: 'farm', x: -51.5, z: 5.5 },
    { type: 'gather', ids: [1, 2], nodeId: 'farm:7' }, { type: 'replantFarm', ids: [1, 2], buildingId: 7 }]) {
    assert.deepEqual(reduceFarmOrder({ ...command, sessionToken: 'private-secret', clientOrderToken: 123 }), command);
    assert.equal(reduceFarmOrder({ ...command, ids: [1, 1] }), null);
    assert.equal(reduceFarmOrder({ ...command, ids: [] }), null);
  }
  for (const bad of [{ type: 'move', ids: [1], x: 0, z: 0 }, { type: 'publishMap', ids: [1] },
    { type: 'gather', ids: [1], nodeId: 'forest-7' }, { type: 'gather', ids: [1], nodeId: 'farm:0' },
    { type: 'build', ids: [1], buildingType: 'farm', x: NaN, z: 0 },
    { type: 'replantFarm', ids: [1], buildingId: -1 }]) assert.equal(reduceFarmOrder(bad), null);
});

test('actual observer preserves native sends, refuses unrelated sockets, and bounds retained orders', () => {
  const sends = [];
  class Socket {
    constructor() { this.listeners = {}; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    send(data) { sends.push(data); return 'native'; }
  }
  const context = vm.createContext({ window: { WebSocket: Socket }, location: { href: 'http://127.0.0.1:1234/', host: '127.0.0.1:1234' }, URL });
  vm.runInContext(`(${installFarmObserver.toString()})(${reduceFarmState.toString()},${reduceFarmOrder.toString()})`, context);
  const socket = new context.window.WebSocket('ws://127.0.0.1:1234/ws');
  socket.listeners.message({ data: JSON.stringify(message()) });
  assert.equal(context.window.__rtsTinyFarm.latest.workers.length, 4);
  for (let i = 0; i < 20; i++) assert.equal(socket.send(JSON.stringify({ type: 'replantFarm', ids: [1], buildingId: 7 })), 'native');
  assert.equal(context.window.__rtsTinyFarm.orders.length, 16); assert.equal(context.window.__rtsTinyFarm.droppedOrders, 4);
  assert.equal(socket.send('not json'), 'native');
  const other = new context.window.WebSocket('ws://example.invalid/ws');
  assert.equal(other.send(JSON.stringify({ type: 'replantFarm', ids: [1], buildingId: 7 })), 'native');
  assert.equal(context.window.__rtsTinyFarm.orders.length, 16); assert.equal(sends.length, 22);
  assert.doesNotMatch(JSON.stringify(context.window.__rtsTinyFarm), /private-secret/);
});

test('malformed or non-Tiny economy cannot qualify either seat', () => {
  for (const mutate of [s => s.bank.food = NaN, s => s.workers.pop(), s => s.workers[0].cargo = 11,
    s => s.workers[0].generation = 0, s => s.mapId = 'open-field', s => s.matchModeId = 'bannerfall',
    s => s.workers[0].team = 1, s => s.workers[0].cargo = null]) {
    const bad = state(); mutate(bad); assert.throws(() => validateFarmEconomy(bad, 0));
  }
});

test('Farm state frames require admitted decoded art, depth and ownership standard', () => {
  const observation = { buildings: [{ id: 7, capture: { visible: true, decoded: true, state: 'exhausted',
    fallbackVisible: false, depthMatches: true, standardVisible: true,
    manifestPath: '/assets/buildings/frontier-economy-models-v1/farm-complete-renderer.json', sha256: 'a'.repeat(64) } }] };
  validateFarmArt(observation, 7, 'exhausted');
  for (const change of [{ visible: false }, { decoded: false }, { state: 'complete' }, { fallbackVisible: true },
    { depthMatches: false }, { standardVisible: false }, { manifestPath: '/preview/farm.json' }, { sha256: null }]) {
    const bad = clone(observation); Object.assign(bad.buildings[0].capture, change);
    assert.throws(() => validateFarmArt(bad, 7, 'exhausted'));
  }
});

test('completion during screenshot keeps failed partial evidence and refuses a foundation claim', async () => {
  for (const type of ['mill', 'farm']) {
    const before = state(), after = state(); before.bank.wood = after.bank.wood = type === 'farm' ? 55 : 175;
    before.buildings = [plot(0, { type, complete: false, harvestStock: type === 'farm' ? 0 : null })];
    after.buildings = [{ ...before.buildings[0], complete: true, harvestStock: type === 'farm' ? 200 : null }];
    const expected = { team: 0, type, id: 7, wood: before.bank.wood, site: before.buildings[0] }, retained = [];
    const snapshots = [before, after]; let captures = 0;
    await assert.rejects(() => bracketFarmPhase({ observe: async () => snapshots.shift(),
      take: async () => { captures++; return { image: 'retained-png' }; },
      validate: s => validateFarmFoundation(s, expected), retain: async r => retained.push(r) }));
    assert.equal(captures, 1); assert.equal(retained[0].phaseVerified, false);
    assert.equal(retained[0].before.buildings[0].complete, false); assert.equal(retained[0].after.buildings[0].complete, true);
    for (const change of [{ id: 8 }, { team: 1 }, { harvestStock: type === 'farm' ? 1 : null }]) {
      if (type === 'mill' && Object.hasOwn(change, 'harvestStock')) continue;
      const bad = clone(before); Object.assign(bad.buildings[0], change);
      assert.throws(() => validateFarmFoundation(bad, expected));
    }
  }
});

// CPU CDP boundary: actual serialized entry expressions, the real menu entry
// handler and pointer helper run against a DOM. Layout/lobby/network scheduling
// are modeled; this establishes orchestration, never browser/render acceptance.
async function entryFixture({ unavailable = false, brokenLobby = false, brokenGuest = false, noLaunch = false, transientMenu = false } = {}) {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8'), pages = [], requests = [], stages = [];
  const roomUrl = 'http://127.0.0.1:1234/?room=' + 'R'.repeat(32);
  const ready = new Set(); let launches = 0;
  const definition = JSON.parse(await readFile(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url)));
  let lobbyState = { phase: 'lobby', revision: 1, mapId: TINY_FARM_MAP, armySize: 24,
    matchModeId: 'skirmish', matchModeVersion: 1, matchModes: matchModeCatalog(definition),
    maps: [{ ...definition, matchModes: matchModeCatalog(definition) }], canLaunch: false,
    seats: [0, 1].map(team => ({ id: `cpu-seat-${team}`, team, connected: true, ready: false })) };
  const acknowledge = () => pages.forEach(p => p.lobby?.update(lobbyState, { id: `cpu-seat-${p.team}`, team: p.team }, true, definition));
  const makePage = team => {
    const page = { team, scripts: [], dom: new JSDOM('', { url: 'about:blank', runScripts: 'outside-only' }) };
    const prepare = async url => {
      page.dom.window.close(); page.dom = new JSDOM(html, { url, runScripts: 'outside-only' });
      const w = page.dom.window, doc = w.document;
      for (const script of page.scripts) w.eval(script);
      const layout = () => {
        for (const [i, button] of [...doc.querySelectorAll('button')].entries()) button.getBoundingClientRect = () => ({ left: 10, top: i * 10, width: 100, height: 9 });
      };
      layout();
      doc.elementFromPoint = (x, y) => [...doc.querySelectorAll('button')].find(button => { const r = button.getBoundingClientRect(); return x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height; }) ?? null;
      for (const dialog of doc.querySelectorAll('dialog')) { dialog.showModal = () => { dialog.open = true; }; dialog.close = () => { dialog.open = false; }; }
      if (!new URL(url).searchParams.has('room')) {
        await bootGameEntry({ win: w, navigate: next => { page.navigation = prepare(next); page.navigation.catch(() => {}); }, loadGame: async () => {},
          fetchImpl: async (target, options) => { requests.push({ target, method: options?.method });
            return new Response(JSON.stringify(options?.method === 'POST' ? { roomId: 'R'.repeat(32) } : { enabled: !unavailable })); } });
      } else {
        doc.documentElement.dataset.entry = 'game'; doc.documentElement.dataset.boot = 'ready';
        const lobby = doc.querySelector('#room-lobby');
        page.lobby = createRoomLobby({ root: lobby, copyInvite: () => {}, send: command => {
          if (command.type === 'configureLobby') lobbyState = { ...lobbyState, revision: lobbyState.revision + 1 };
          if (command.type === 'setReady') {
            ready.add(team); lobbyState = { ...lobbyState, canLaunch: !noLaunch && ready.size === 2,
              seats: lobbyState.seats.map(s => ({ ...s, ready: ready.has(s.team) })) };
          }
          if (command.type === 'launchMatch') {
            launches++; lobbyState = { ...lobbyState, phase: 'running' };
            for (const p of pages) { const win = p.dom.window;
              win.__rtsTinyFarm.latest = { mapId: TINY_FARM_MAP }; win.__rtsEnvironmentStateSnapshot = { fogOfWar: true }; }
          }
          setImmediate(acknowledge); return true;
        } });
        acknowledge(); layout(); if (brokenLobby || (brokenGuest && team === 1)) lobby.open = false;
        w.__rtsTinyFarm.team = team;
      }
    };
    page.cdp = {
      evaluate: async expression => {
        if ((brokenLobby || (brokenGuest && team === 1)) && expression.includes("#lobby-ready") && expression.includes('disabled===false'))
          throw new Error('CPU broken lobby refuses readiness');
        return page.dom.window.eval(expression);
      },
      call: async (method, params) => {
        if (method === 'Page.addScriptToEvaluateOnNewDocument') { new vm.Script(params.source); page.scripts.push(params.source); }
        if (method === 'Page.navigate') await prepare(params.url);
        if (method === 'Input.dispatchMouseEvent' && params.type === 'mouseReleased') {
          page.dom.window.document.elementFromPoint(params.x, params.y)?.click();
          await new Promise(resolve => setImmediate(resolve)); if (page.navigation) await page.navigation;
        }
        return {};
      },
    };
    page.wait = async (expression, label) => {
      if (transientMenu && label === 'ordinary Create Room menu') {
        const original = page.dom;
        for (const html of ['', '<html data-entry="menu"><head></head><body></body></html>',
          '<html data-entry="menu"><body><button id="menu-create-room" disabled></button></body></html>']) {
          page.dom = new JSDOM(html, { runScripts: 'outside-only' });
          if (!html) page.dom.window.document.documentElement.remove();
          try { assert.equal(Boolean(await page.cdp.evaluate(expression)), false, 'navigation cannot qualify an absent or disabled Create Room'); }
          finally { page.dom.window.close(); page.dom = original; }
        }
      }
      await new Promise(resolve => setImmediate(resolve)); const value = await page.cdp.evaluate(expression);
      assert.ok(value, `CPU orchestration refuses absent readiness: ${label}`); return value; };
    pages.push(page); return page;
  };
  const page = makePage(0);
  return { context: { page, openPage: async () => makePage(1), origin: 'http://127.0.0.1:1234' },
    stages, requests, roomUrl, pages, launches: () => launches, close: () => pages.forEach(p => p.dom.window.close()) };
}

test('actual Tiny entry runs normal Create Room, two-seat Ready and Launch without injected map', async () => {
  const f = await entryFixture();
  try {
    const pages = await enterTinyFarmRoom(f.context, { onStage: step => f.stages.push(step) });
    assert.equal(pages.length, 2); assert.equal(f.launches(), 1);
    assert.deepEqual(f.stages, ['install-host-observer', 'host-menu', 'create-room', 'select-tiny',
      'second-seat-url', 'second-seat-open', 'second-seat-blank', 'second-seat-observer',
      'second-seat-navigation', 'second-seat-ready', 'second-seat-identity', 'ready-seats', 'launch-tiny']);
    assert.equal(f.requests.filter(r => r.method === 'POST').length, 1);
    assert.ok(f.pages.every(p => new URL(p.dom.window.location.href).searchParams.get('room') === 'R'.repeat(32)));
  } finally { f.close(); }
});

test('actual entry waits through missing navigation document and partial menu without a TypeError or false readiness', async () => {
  const f = await entryFixture({ transientMenu: true });
  try { assert.equal((await enterTinyFarmRoom(f.context)).length, 2); assert.equal(f.launches(), 1); }
  finally { f.close(); }
});
for (const options of [{ unavailable: true }, { brokenLobby: true }, { noLaunch: true }])
  test(`actual Tiny entry refuses unavailable menu/lobby/launch: ${JSON.stringify(options)}`, async () => {
    const f = await entryFixture(options);
    try { await assert.rejects(() => enterTinyFarmRoom(f.context)); assert.equal(f.launches(), 0); }
    finally { f.close(); }
  });

const phases = ['mill-paid-foundation', 'farm-paid-foundation', 'farm-complete', 'farm-exhausted',
  'farm-renewal-selected', 'farm-renewal-foundation', 'farm-renewal-first-delivery', 'renewed-strategic'];
test('actual registered wrapper requires clean served identity, two pages and every seat checkpoint', async () => {
  const page = { cdp: { call: async () => ({}), evaluate: async () => ({}) }, wait: async () => ({}) };
  const guest = { ...page }, context = { version: 1, page, openPage: async () => guest,
    origin: 'http://127.0.0.1:1234', evidenceDirectory: '/tmp/cpu-farm-context', capture: async () => ({}),
    source: Object.freeze({ revision: 'a'.repeat(40), digest: `sha256:${'b'.repeat(64)}` }) };
  const result = { status: 'captured-needs-review', appearance: 'unreviewed', seats: [{ team: 0 }, { team: 1 }],
    frames: [0, 1].flatMap(team => phases.map(checkpoint => ({ team, checkpoint, phaseVerified: true }))) };
  const records = [];
  const deps = { record: async (_, json) => records.push(JSON.parse(json)), identify: async () => ({ ok: true, served: { sourceDirty: false } }),
    enter: async () => [page, guest], execute: async () => result };
  const loaded = await loadCaptureCases('tiny-farm'); assert.deepEqual(loaded.issues, []);
  assert.equal((await run(context, deps)).status, 'passed');
  for (const change of [{ status: 'failed' }, { appearance: 'approved' }, { seats: [{ team: 0 }] },
    { frames: result.frames.slice(1) }, { frames: result.frames.filter(f => f.team === 0) },
    { frames: result.frames.map((frame, index) => ({ ...frame, phaseVerified: index !== 1 })) }])
    await assert.rejects(() => run(context, { ...deps, execute: async () => ({ ...result, ...change }) }));
  for (const identity of [{ ok: false, served: { sourceDirty: false } }, { ok: true, served: { sourceDirty: true } }])
    await assert.rejects(() => run(context, { ...deps, identify: async () => identity,
      enter: async () => assert.fail('no navigation for mismatched source') }));
  await assert.rejects(() => run(context, { ...deps, enter: async () => [page, page] }));
  await assert.rejects(() => run(context, { ...deps, enter: async (_, { onStage }) => {
    onStage('create-room'); throw new Error('TypeError: private-secret');
  } }));
  assert.equal(records.at(-1).stage, 'entry-create-room'); assert.equal(records.at(-1).category, 'browser-type');
  await assert.rejects(() => run(context, { ...deps, enter: async ({ openPage }, { onStage }) => {
    await openPage(); onStage('second-seat'); throw new Error('private-secret timeout');
  } }));
  assert.equal(records.at(-1).stage, 'entry-second-seat'); assert.equal(records.at(-1).pageBoots.length, 2);
  assert.equal(records.at(-1).category, 'deadline');
  assert.doesNotMatch(JSON.stringify(records), /private-secret/);
});

test('second-seat failure receipt evaluates bounded DOM facts on both real entry pages', async () => {
  const f = await entryFixture({ brokenGuest: true });
  const records = [], context = { ...f.context, version: 1, evidenceDirectory: '/tmp/cpu-farm-diagnostic', capture: async () => ({}),
    source: Object.freeze({ revision: 'a'.repeat(40), digest: `sha256:${'b'.repeat(64)}` }) };
  try {
    await assert.rejects(() => run(context, { identify: async () => ({ ok: true, served: { sourceDirty: false } }),
      record: async (_, json) => records.push(JSON.parse(json)) }));
    const receipt = records.at(-1);
    assert.equal(receipt.stage, 'entry-second-seat-ready'); assert.equal(receipt.pageBoots.length, 2);
    assert.equal(receipt.pageBoots[0].lobbyOpen, true); assert.equal(receipt.pageBoots[1].lobbyOpen, false);
    assert.deepEqual(receipt.pageBoots.map(p => p.team), [0, 1]);
    assert.ok(receipt.pageBoots.every(p => p.observerInstalled && p.readyPresent && p.ownSeatRow));
    assert.doesNotMatch(JSON.stringify(receipt), /private-secret|room=|http:|sessionToken|cpu-seat/);
  } finally { f.close(); }
});

test('entry failure categories never retain arbitrary CDP payloads or exception text', () => {
  for (const [message, expected] of [['SyntaxError: private-secret', 'browser-syntax'],
    ['ReferenceError: private-secret', 'browser-reference'], ['TypeError: private-secret', 'browser-type'],
    ['private-secret timeout', 'deadline'], ['private-secret', 'execution']])
    assert.equal(farmFailureCategory(new Error(message)), expected);
});

test('CDP health distinguishes an available page target from a stalled runtime or missing API without private metadata', async () => {
  const calls = [], page = { cdp: { call: async method => {
    calls.push(method);
    if (method === 'Target.getTargetInfo') return { targetInfo: { type: 'page', attached: true,
      url: 'http://private-secret/?room=private-secret', title: 'private-secret', targetId: 'private-secret' } };
    throw new Error('Page.getFrameTree timeout');
  } } };
  const health = await readFarmCdpHealth(page);
  assert.deepEqual(calls.sort(), ['Page.getFrameTree', 'Target.getTargetInfo']);
  assert.deepEqual(health.target, { status: 'available', page: true, attached: true });
  assert.deepEqual(health.frame, { status: 'unavailable', fault: { kind: 'cdp-timeout', method: 'Page.getFrameTree' } });
  const missing = await readFarmCdpHealth({ cdp: { call: async () => { throw new Error("Method not found private-secret"); } } });
  assert.equal(missing.frame.fault.kind, 'cdp-method-unavailable');
  assert.deepEqual(farmCdpFault(new Error('Runtime.evaluate timeout')), { kind: 'cdp-timeout', method: 'Runtime.evaluate' });
  assert.deepEqual(farmCdpFault(new Error('CDP closed')), { kind: 'cdp-closed' });
  assert.deepEqual(farmCdpFault(new Error('private-secret timeout')), { kind: 'deadline' });
  assert.doesNotMatch(JSON.stringify({ health, missing }), /private-secret|targetId|url|title|room=/);
});

test('guest readiness survives only exact transient CDP timeout inside the original twenty-second window', async () => {
  let clock = 0, calls = 0;
  const page = { cdp: { evaluate: async expression => {
    assert.match(expression, /disabled===false/); calls++;
    if (calls === 1) { clock += 15000; throw new Error('Runtime.evaluate timeout'); }
    clock += 500; return true;
  } } };
  const receipt = await waitForFarmGuestReady(page, { now: () => clock, delay: async ms => { clock += ms; } });
  assert.deepEqual(receipt, { elapsedMs: 15600, transientCdpTimeouts: 1 }); assert.equal(calls, 2);
  for (const mode of ['late-ready', 'never-ready', 'closed', 'missing-method', 'type-error']) {
    let tick = 0, attempts = 0;
    const blocked = { cdp: { evaluate: async () => {
      attempts++;
      if (mode === 'late-ready') { tick = 20000; return true; }
      if (mode === 'never-ready') { tick += 1000; return false; }
      throw new Error({ closed: 'CDP closed', 'missing-method': 'Method not found', 'type-error': 'TypeError: private-secret' }[mode]);
    } } };
    await assert.rejects(() => waitForFarmGuestReady(blocked, { now: () => tick, delay: async ms => { tick += ms; } }));
    if (mode === 'never-ready') assert.equal(attempts, 19, 'no further polling after the original deadline');
    else assert.equal(attempts, 1);
  }
});

test('guest runtime timeout retains target/frame and bounded lifecycle evidence rather than labelling it absent readiness', async () => {
  const listeners = new Map(), guest = { cdp: { on: (event, fn) => listeners.set(event, fn),
    evaluate: async () => { throw new Error('Runtime.evaluate timeout'); },
    call: async method => method === 'Target.getTargetInfo'
      ? { targetInfo: { type: 'page', attached: true, url: 'private-secret' } }
      : { frameTree: { frame: { id: 'private-secret', url: 'private-secret' } } },
  }, wait: async () => {} };
  const page = { cdp: { call: async () => ({}), evaluate: async () => ({}) }, wait: async () => {} }, records = [];
  const context = { page, openPage: async () => guest, version: 1, origin: 'http://127.0.0.1:1234',
    capture: async () => ({}), evidenceDirectory: '/tmp/cpu-farm-cdp-failure',
    source: Object.freeze({ revision: 'a'.repeat(40), digest: `sha256:${'b'.repeat(64)}` }) };
  await assert.rejects(() => run(context, { identify: async () => ({ ok: true, served: { sourceDirty: false } }),
    record: async (_, json) => records.push(JSON.parse(json)),
    enter: async ({ openPage }, { onStage }) => {
      const guest = await openPage(); onStage('second-seat-blank');
      for (let i = 0; i < 110; i++) listeners.get('Runtime.executionContextCreated')({ private: 'private-secret' });
      listeners.get('Inspector.targetCrashed')({ private: 'private-secret' });
      await guest.cdp.evaluate('location.href');
    } }));
  const receipt = records.at(-1);
  assert.equal(receipt.stage, 'entry-second-seat-blank'); assert.equal(receipt.pageBoots[1], null);
  assert.deepEqual(receipt.fault, { kind: 'cdp-timeout', method: 'Runtime.evaluate' });
  assert.deepEqual(receipt.snapshotFaults[1], receipt.fault);
  assert.equal(receipt.pageHealth[1].target.page, true); assert.equal(receipt.pageHealth[1].frame.rootPresent, true);
  assert.equal(receipt.pageEvents[1].contextCreated, 100); assert.equal(receipt.pageEvents[1].crashed, 1);
  assert.equal(receipt.pageEvents[0].supported, false);
  assert.doesNotMatch(JSON.stringify(receipt), /private-secret|room=|http:|targetId|expression/);
  assert.equal(observeFarmCdpEvents(page).supported, false);
});

test('Farm registration preserves the existing sandbox/deadline and audio adapter', async () => {
  const workflow = await readFile(new URL('../.github/workflows/ordinary-game-capture.yml', import.meta.url), 'utf8');
  const source = await readFile(new URL('./renderer-tiny-farm-scenario.mjs', import.meta.url), 'utf8');
  assert.match(workflow, /- tiny-farm/); assert.match(workflow, /contents: read/);
  assert.doesNotMatch(workflow, /no-sandbox|secrets\.|sudo/);
  assert.doesNotMatch(source, /__rtsEnvironmentCaptureCommand|publishMap|setInterval|spawn\(/);
  assert.match(source, /runFarmRenewalCaptureStep/); assert.match(source, /coldProcessRecovery: 'not-exposed-by-v1-capture-context'/);
});

test('canonical Tiny pads pass actual client and server placement for both seats; sheep pad refuses', async () => {
  const map = JSON.parse(await readFile(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url)));
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  const begin = main.indexOf('function buildPlacementAt('), end = main.indexOf('\nfunction ', begin + 1);
  assert.ok(begin >= 0 && end > begin);
  const fixture = await createPveHeadlessFixture(map, { matchModeId: 'skirmish', matchModeVersion: 1 });
  const r = fixture.replay, snapshot = () => r.checkpoint().state;
  const workers = team => snapshot().units.filter(u => u.team === team && u.kind === 'worker');
  const order = (team, type, site) => r.order(team, { type: 'build', buildingType: type, ...site,
    ids: workers(team).map(w => w.id), unitGenerations: workers(team).map(w => w.generation) });
  const clientPlacement = (team, type, site) => {
    const live = snapshot(), observation = r.observe(team);
    const units = live.units.map(u => ({ ...u, serverX: u.x, serverZ: u.z, visible: true }));
    const context = vm.createContext({ mapDefinition: map, localTeam: team, BUILDING_DEFINITIONS,
      MAP_WIDTH: map.width, MAP_HEIGHT: map.height, MAP_HALF_X: map.width / 2, MAP_HALF_Z: map.height / 2,
      worldAt: () => site, buildingFootprint: t => BUILDING_DEFINITIONS[t].footprint,
      buildingWoodCost: t => BUILDING_DEFINITIONS[t].cost.wood,
      constructionCostForProfile: t => BUILDING_DEFINITIONS[t].cost,
      buildPlacementType: type, latestWood: live.teamWood, latestFood: live.teamFood,
      selectedIds: () => workers(team).map(w => w.id), units: Object.fromEntries(units.map(u => [u.id, u])),
      teamUnits: [0, 1].map(t => units.filter(u => u.team === t)),
      latestBuildings: [...observation.buildings, ...observation.homeTownCenters],
      latestForestStocks: new Map(), constructionResourceNodes: () => map.resourceNodes,
      latestResourceStocks: new Map(map.resourceNodes.map(n => [n.id, n.stock])),
    });
    vm.runInContext(main.slice(begin, end), context);
    return context.buildPlacementAt(0, 0);
  };
  try {
    for (const team of [0, 1]) {
      const pads = tinyFarmSites(map, team);
      assert.equal(clientPlacement(team, 'mill', pads.mill).valid, true, 'real client admits Mill pad');
      assert.ok((await order(team, 'mill', pads.mill)).some(n => /PLACED/.test(n.message)), 'real server admits Mill pad');
    }
    for (let tick = 0; tick < 900 && !snapshot().buildings.every(b => b.complete); tick++) r.step();
    assert.equal(snapshot().buildings.length, 2); assert.ok(snapshot().buildings.every(b => b.complete));
    for (const team of [0, 1]) {
      const pads = tinyFarmSites(map, team), spawn = map.spawnPoints.find(s => s.team === team);
      const badPad = { x: pads.farm.x, z: spawn.z + 5 }, before = snapshot();
      assert.match(clientPlacement(team, 'farm', badPad).blockedReason, /RESOURCE/);
      assert.ok((await order(team, 'farm', badPad)).some(n => /RESOURCE NODE IN FOOTPRINT/.test(n.message)), 'old sheep pad must stay rejected');
      assert.deepEqual(snapshot().teamWood, before.teamWood); assert.equal(snapshot().buildings.length, 2 + team);
      assert.equal(clientPlacement(team, 'farm', pads.farm).valid, true, 'real client admits corrected Farm pad');
      assert.ok((await order(team, 'farm', pads.farm)).some(n => /PLACED/.test(n.message)), 'real server admits corrected Farm pad');
      assert.equal(snapshot().teamWood[team], 115, 'only the real Mill and Farm spend opening wood');
    }
  } finally { await fixture.dispose(); }
});
