// CPU rejection controls; none of these fabricated records qualify game pixels.
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { installFarmObserver, reduceFarmOrder, reduceFarmState, run, TINY_FARM_MAP,
  tinyFarmSites, validateFarmArt, validateFarmBuild, validateFarmEconomy, validateFarmSupply } from './renderer-tiny-farm-scenario.mjs';
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

const phases = ['mill-paid-foundation', 'farm-paid-foundation', 'farm-complete', 'farm-exhausted',
  'farm-renewal-selected', 'farm-renewal-foundation', 'farm-renewal-first-delivery', 'renewed-strategic'];
test('actual registered wrapper requires clean served identity, two pages and every seat checkpoint', async () => {
  const page = { cdp: { call: async () => ({}), evaluate: async () => ({}) }, wait: async () => ({}) };
  const guest = { ...page }, context = { version: 1, page, openPage: async () => guest,
    origin: 'http://127.0.0.1:1234', evidenceDirectory: '/tmp/cpu-farm-context', capture: async () => ({}),
    source: Object.freeze({ revision: 'a'.repeat(40), digest: `sha256:${'b'.repeat(64)}` }) };
  const result = { status: 'captured-needs-review', appearance: 'unreviewed', seats: [{ team: 0 }, { team: 1 }],
    frames: [0, 1].flatMap(team => phases.map(checkpoint => ({ team, checkpoint }))) };
  const deps = { identify: async () => ({ ok: true, served: { sourceDirty: false } }),
    enter: async () => [page, guest], execute: async () => result };
  const loaded = await loadCaptureCases('tiny-farm'); assert.deepEqual(loaded.issues, []);
  assert.equal((await run(context, deps)).status, 'passed');
  for (const change of [{ status: 'failed' }, { appearance: 'approved' }, { seats: [{ team: 0 }] },
    { frames: result.frames.slice(1) }, { frames: result.frames.filter(f => f.team === 0) }])
    await assert.rejects(() => run(context, { ...deps, execute: async () => ({ ...result, ...change }) }));
  for (const identity of [{ ok: false, served: { sourceDirty: false } }, { ok: true, served: { sourceDirty: true } }])
    await assert.rejects(() => run(context, { ...deps, identify: async () => identity,
      enter: async () => assert.fail('no navigation for mismatched source') }));
  await assert.rejects(() => run(context, { ...deps, enter: async () => [page, page] }));
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
