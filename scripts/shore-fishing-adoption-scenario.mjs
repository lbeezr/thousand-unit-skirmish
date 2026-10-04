// Shipped pilot + real DOM choices/Shift-minimap handlers + authoritative server.
// No browser rendering or physical pointer usability is claimed by this fixture.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { bootGameEntry } from '../src/game-entry.mjs';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { minimapFixture } from './minimap-client-fixture.mjs';
import { economyClientBindings } from './economy-client-fixture.mjs';
import { BUILDING_DEFINITIONS, UNIT_DEFINITIONS, TECHNOLOGY_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { formatResourceRequirement } from '../src/resource-format.mjs';
import { setHudActionAvailability, isHudActionUnavailable } from '../src/hud-layout.mjs';
import { updateProductionPortrait } from '../src/selection-portrait.mjs';

const map = JSON.parse(await readFile(new URL('../maps/shore-fishing.json', import.meta.url)));
const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const between = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
assert.ok(process.argv.slice(2).every(arg => arg === '--practice'), 'only the --practice proof option is supported');
const practice = process.argv.includes('--practice'), teams = practice ? [0] : [0, 1];
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 110_000, supervisor: practice });
const dom = [], minimaps = [];
let clients, roomId = null, checkpointPath = fixture.checkpointPath, order = 900;
const checkpoint = predicate => fixture.checkpoint(predicate, checkpointPath);
const command = (team, value, expression) => clients[team].command({ ...value, clientOrderToken: order++ }, expression);
const boats = snapshot => snapshot.state.units.filter(unit => unit.kind === 'skiff' && unit.hp > 0);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
async function connect(tokens = []) {
  clients = [];
  for (const team of teams) clients.push(await fixture.connect(team, tokens[team], roomId));
  if (practice) {
    assert.equal(clients[0].welcome.state.practice, true);
    assert.equal(clients[0].welcome.state.connected, 1);
    assert.equal(clients[0].welcome.state.lobby, undefined);
  }
}
async function minimap(team, x, expression = /WAYPOINT QUEUED/) {
  const f = minimaps[team], r = f.w.minimapMapRect(384, 384), before = clients[team].messages.length;
  f.w.socket = clients[team].socket;
  f.event('pointerdown', { x: 100 + (r.left + (x + map.width / 2) * r.scale) / 2,
    y: 40 + (r.top + (7.5 + map.height / 2) * r.scale) / 2, shiftKey: true });
  const notice = await clients[team].wait(message => message.type === 'notice' && message.clientOrderToken === f.w.orderToken,
    'shipped pilot Shift minimap Move', before);
  assert.match(notice.message, expression);
}
function menu(team, workers) {
  const page = new JSDOM(html); dom.push(page);
  const placements = [], training = [];
  const context = vm.createContext({ ...economyClientBindings(), mapDefinition: map,
    document: page.window.document, BUILDING_DEFINITIONS, UNIT_DEFINITIONS, TECHNOLOGY_DEFINITIONS,
    formatResourceRequirement, setHudActionAvailability, isHudActionUnavailable,
    castPreview: false, humanRosterPreview: false, updateProductionPortrait,
    localTeam: team, latestBuildings: [], latestFood: clients[team].latest.food, latestWood: clients[team].latest.wood,
    latestTeamResearch: [{}, {}], teamUnits: [0, 1].map(seat => clients[team].latest.units.filter(row => row[1] === seat)
      .map(row => ({ id: row[0], hp: row[4], kind: row[5] }))), latestWorkerProduction: [null, null],
    latestPopulation: clients[team].latest.population, latestRosterSize: 8,
    BARRACKS_QUEUE_LIMIT: 5, MAX_PER_TEAM: 1000, MAX_UNITS: 2000, matchWinner: -1,
    selectedWorkerIds: () => workers, buildPlacementPending: false, buildPlacementActive: false,
    buildPlacementType: 'house', beginBuildPlacement: kind => placements.push(kind), cancelBuildPlacement() {},
    getBuildingQueueLength: building => building.queue || 0,
    sendCommand: value => training.push(command(team, value, /QUEUED/)),
  });
  vm.runInContext(between('function updateRosterBuildingOptions(', 'function updateEconomyUI(')
    + between('function updateRosterProductionOptions(', 'function updateBuildingLifecycleActions('), context);
  return { page, context, placements, training };
}
try {
  assert.equal(map.startingResources.wood, 0);
  const cost = BUILDING_DEFINITIONS.dock.cost.wood + UNIT_DEFINITIONS.skiff.cost.wood;
  for (const team of [0, 1]) assert.equal(map.resourceNodes.find(node => node.id === `${team ? 'ember' : 'azure'}-wood`).stock, cost);
  await fixture.start();
  if (practice) {
    const origin = `http://127.0.0.1:${fixture.port}`, navigations = [];
    const page = new JSDOM(await (await fetch(origin + '/')).text(), { url: origin }); dom.push(page);
    await bootGameEntry({ win: page.window, fetchImpl: (url, options) => fetch(new URL(url, origin), options),
      navigate: url => navigations.push(new URL(url)), loadGame() { throw Error('Root Practice choice must not boot a renderer before navigation'); } });
    assert.equal(page.window.document.documentElement.dataset.entry, 'menu');
    page.window.document.querySelector('#menu-practice').click();
    page.window.document.querySelector('#menu-practice').click();
    const deadline = Date.now() + 15_000;
    while (!navigations.length && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(navigations.length, 1, 'actual root Practice handler creates one fresh room');
    roomId = navigations[0].searchParams.get('room'); assert.ok(roomId);
    assert.equal(navigations[0].searchParams.has('play'), false);
    assert.equal(navigations[0].searchParams.has('studio'), false);
    const room = await (await fetch(origin + '/api/rooms/' + roomId)).json();
    assert.deepEqual(room.launchOptions,
      { mode: 'pvp', practice: true, matchModeId: 'authored', matchModeVersion: 1 });
    checkpointPath = path.join(fixture.directory, 'rooms', 'rooms', roomId, 'match-state.json');
  }
  await connect();
  const tokens = clients.map(client => client.welcome.player.sessionToken);
  assert.ok(clients[0].welcome.maps.some(entry => entry.id === map.id && entry.name.endsWith(map.name)),
    'the ordinary catalog contains the authored pilot ID and title, independent of regional-audio grouping');
  clients[0].send({ type: 'selectMap', mapId: map.id });
  await Promise.all(clients.map(client => client.wait(message => message.type === 'mapChange' && message.map.id === map.id)));
  const workers = clients.map((client, team) => client.latest.units.filter(row => row[1] === team && row[5] === 'worker').map(row => row[0]));
  for (const team of teams) await command(team, { type: 'gather', ids: workers[team], nodeId: `${team ? 'ember' : 'azure'}-wood` }, /GATHER ORDER/);
  const banked = await checkpoint(snapshot => teams.every(team => Math.abs(snapshot.state.teamWood[team] - cost) < 1e-7)
    && snapshot.state.units.every(unit => unit.cargo === 0));
  if (practice) assert.equal(banked.state.scenarioClockStarted, true, 'one connected player advances the ordinary Practice clock');
  for (const team of teams) assert.equal(banked.state.resourceNodes.find(node => node.id === `${team ? 'ember' : 'azure'}-wood`).stock, 0);
  const menus = workers.map((ids, team) => menu(team, ids));
  for (const [team, m] of menus.entries()) {
    const container = m.page.window.document.querySelector('#roster-building-options');
    m.context.updateRosterBuildingOptions(container);
    const button = container.querySelector('[data-building="dock"]');
    assert.equal(button.disabled, false); assert.match(button.textContent, /Build Dock.*100 WOOD/);
    button.click(); assert.deepEqual(m.placements, ['dock']);
    // Canvas placement is outside this DOM fixture; use the documented legal bank.
    await command(team, { type: 'build', buildingType: m.placements[0], ids: workers[team], x: team ? 4.5 : -4.5, z: 8.5 }, /DOCK PLACED/);
  }
  const completed = await checkpoint(snapshot => snapshot.state.buildings.filter(row => row.type === 'dock' && row.complete).length === teams.length);
  for (const team of teams) close(completed.state.teamWood[team], 75);
  for (const [team, m] of menus.entries()) {
    m.context.latestBuildings = clients[team].latest.buildings;
    m.context.latestWood = clients[team].latest.wood;
    const dock = m.context.latestBuildings.find(row => row.team === team && row.type === 'dock' && row.complete);
    const container = m.page.window.document.querySelector('[data-context-products]');
    m.context.updateRosterProductionOptions(container, dock);
    const button = container.querySelector('[data-product="skiff"]');
    assert.equal(button.getAttribute('aria-disabled'), 'false');
    assert.match(button.textContent, /Train Skiff \(placeholder\).*75 wood/);
    button.click(); await Promise.all(m.training);
  }
  const ready = await checkpoint(snapshot => boats(snapshot).length === teams.length);
  for (const wood of ready.state.teamWood) close(wood, 0);
  const ids = teams.map(team => boats(ready).find(unit => unit.team === team).id);
  for (const team of teams) await command(team, { type: 'gather', ids: [ids[team]], nodeId: `${team ? 'ember' : 'azure'}-food` }, /SKIFF/);
  await checkpoint(snapshot => ids.every(id => snapshot.state.units[id].cargo >= .1));
  for (const team of teams) {
    const f = minimapFixture(team); minimaps.push(f);
    Object.assign(f.w, { MAP_WIDTH: map.width, MAP_HEIGHT: map.height, MAP_HALF_X: map.width / 2,
      MAP_HALF_Z: map.height / 2, mapDefinition: map, selected: new Set([ids[team]]), units: [] });
    f.w.units[ids[team]] = ready.state.units[ids[team]];
    for (const x of team ? [7.5, 8.5] : [-7.5, -8.5]) await minimap(team, x);
  }
  await fixture.stop();
  const saved = JSON.parse(await readFile(checkpointPath, 'utf8'));
  assert.ok(ids.every(id => saved.state.units[id].queuedWaypoints.length === 2 && saved.state.units[id].cargo > 0));
  await fixture.start(); await connect(tokens);
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint));
  assert.ok(clients.every(client => client.welcome.matchId === saved.matchId));
  const delivered = await checkpoint(snapshot => teams.every(team => snapshot.state.teamFood[team] === 10)
    && ids.every(id => !snapshot.state.units[id].gatherPhase && !snapshot.state.units[id].queuedWaypoints.length
      && !snapshot.state.units[id].path.length));
  for (const [team, id] of ids.entries()) {
    const boat = delivered.state.units[id]; close(boat.x, team ? 8.5 : -8.5); close(boat.z, 7.5);
    assert.equal(boat.cargo, 0);
    close(delivered.state.resourceNodes.find(node => node.id === `${team ? 'ember' : 'azure'}-food`).stock, 50);
  }
  let stoppedLoad = null, final = delivered;
  if (practice) {
    await command(0, { type: 'gather', ids, nodeId: 'azure-food' }, /SKIFF/);
    await checkpoint(snapshot => snapshot.state.units[ids[0]].cargo >= 1);
    await minimap(0, -7.5);
    await command(0, { type: 'stop', ids }, /STOP ORDER/);
    await fixture.stop();
    const stopped = JSON.parse(await readFile(checkpointPath, 'utf8')), boat = stopped.state.units[ids[0]];
    stoppedLoad = boat.cargo; assert.ok(stoppedLoad > 0 && stoppedLoad < 10);
    assert.equal(boat.gatherPhase, ''); assert.deepEqual(boat.queuedWaypoints, []); assert.equal(stopped.state.teamFood[0], 10);
    await fixture.start(); await connect(tokens);
    const restored = await checkpoint(snapshot => snapshot.sequence > stopped.sequence);
    close(restored.state.units[ids[0]].cargo, stoppedLoad);
    assert.deepEqual(restored.state.units[ids[0]].queuedWaypoints, []);
    await command(0, { type: 'returnCargo', ids }, /RETURN/);
    await minimap(0, -7.5, /SKIFF WATER ROUTE|WAYPOINT QUEUED/);
    final = await checkpoint(snapshot => Math.abs(snapshot.state.teamFood[0] - 10 - stoppedLoad) < 1e-7
      && !snapshot.state.units[ids[0]].cargo && !snapshot.state.units[ids[0]].path.length
      && !snapshot.state.units[ids[0]].queuedWaypoints.length);
    close(final.state.units[ids[0]].x, -7.5); close(final.state.units[ids[0]].z, 7.5);
    close(final.state.resourceNodes.find(node => node.id === 'azure-food').stock + final.state.teamFood[0], 60);
    assert.equal(final.state.teamFood[1], 0); assert.equal(final.state.teamWood[1], 0);
    assert.equal(final.state.resourceNodes.find(node => node.id === 'ember-food').stock, 60);
    assert.equal(final.state.resourceNodes.find(node => node.id === 'ember-wood').stock, 175);
  }
  console.log(JSON.stringify({ scenario: practice ? 'normal one-player Practice paid Skiff delivery' : 'shipped Shore Fishing Dock/Skiff adoption',
    actualRootPracticeEntry: practice, ordinaryMapCatalog: true, paidOnlyFromLocalWood: teams.map(() => 175), defaultDomBuildAndTrainingChoices: true,
    actualShiftMinimapHandlers: true, pendingFishingMovesRecovered: true,
    food: final.state.teamFood, wood: final.state.teamWood, oneDeliveryFood: delivered.state.teamFood,
    stoppedLoad, stoppedCargoRecoveredAndReturned: practice, inactiveSeatStockUnchanged: practice,
    evidenceBoundary: 'DOM/server; deployed build, canvas placement and native browser usability remain unverified' }));
} catch (error) {
  console.error(JSON.stringify(clients?.map(client => ({ mapId: client.latest.mapId, wood: client.latest.wood,
    resources: client.latest.resourceNodes, units: client.latest.units.filter(row => ['worker', 'skiff'].includes(row[5]))
      .slice(0, 16).map(row => ({ id: row[0], x: row[2], z: row[3], cargo: row[6], task: row[9] })) }))));
  throw error;
} finally {
  for (const page of dom) page.window.close();
  for (const f of minimaps) f.dom.window.close();
  await fixture.dispose();
}
