// Shipped pilot + real DOM choices/Shift-minimap handlers + authoritative server.
// No browser rendering or physical pointer usability is claimed by this fixture.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { minimapFixture } from './minimap-client-fixture.mjs';
import { economyClientBindings } from './economy-client-fixture.mjs';
import { BUILDING_DEFINITIONS, UNIT_DEFINITIONS, TECHNOLOGY_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { formatResourceRequirement } from '../src/resource-format.mjs';
import { setHudActionAvailability, isHudActionUnavailable } from '../src/hud-layout.mjs';

const map = JSON.parse(await readFile(new URL('../maps/shore-fishing.json', import.meta.url)));
const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const between = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 110_000 });
const dom = [], minimaps = [];
let clients, order = 900;
const command = (team, value, expression) => clients[team].command({ ...value, clientOrderToken: order++ }, expression);
const boats = snapshot => snapshot.state.units.filter(unit => unit.kind === 'skiff' && unit.hp > 0);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function menu(team, workers) {
  const page = new JSDOM(html); dom.push(page);
  const placements = [], training = [];
  const context = vm.createContext({ ...economyClientBindings(), mapDefinition: map,
    document: page.window.document, BUILDING_DEFINITIONS, UNIT_DEFINITIONS, TECHNOLOGY_DEFINITIONS,
    formatResourceRequirement, setHudActionAvailability, isHudActionUnavailable,
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
  await fixture.start(); clients = [await fixture.connect(0), await fixture.connect(1)];
  const tokens = clients.map(client => client.welcome.player.sessionToken);
  assert.ok(clients[0].welcome.maps.some(entry => entry.id === map.id && /Lab.*SHORE FISHING/.test(entry.name)));
  clients[0].send({ type: 'selectMap', mapId: map.id });
  await Promise.all(clients.map(client => client.wait(message => message.type === 'mapChange' && message.map.id === map.id)));
  const workers = clients.map((client, team) => client.latest.units.filter(row => row[1] === team && row[5] === 'worker').map(row => row[0]));
  for (const team of [0, 1]) await command(team, { type: 'gather', ids: workers[team], nodeId: `${team ? 'ember' : 'azure'}-wood` }, /GATHER ORDER/);
  const banked = await fixture.checkpoint(snapshot => snapshot.state.teamWood.every(wood => Math.abs(wood - cost) < 1e-7)
    && snapshot.state.units.every(unit => unit.cargo === 0));
  assert.ok(banked.state.resourceNodes.filter(node => node.type === 'wood').every(node => node.stock === 0));
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
  const completed = await fixture.checkpoint(snapshot => snapshot.state.buildings.filter(row => row.type === 'dock' && row.complete).length === 2);
  for (const wood of completed.state.teamWood) close(wood, 75);
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
  const ready = await fixture.checkpoint(snapshot => boats(snapshot).length === 2);
  for (const wood of ready.state.teamWood) close(wood, 0);
  const ids = [0, 1].map(team => boats(ready).find(unit => unit.team === team).id);
  for (const team of [0, 1]) await command(team, { type: 'gather', ids: [ids[team]], nodeId: `${team ? 'ember' : 'azure'}-food` }, /SKIFF/);
  await fixture.checkpoint(snapshot => ids.every(id => snapshot.state.units[id].cargo >= .1));
  for (const team of [0, 1]) {
    const f = minimapFixture(team); minimaps.push(f);
    Object.assign(f.w, { MAP_WIDTH: map.width, MAP_HEIGHT: map.height, MAP_HALF_X: map.width / 2,
      MAP_HALF_Z: map.height / 2, mapDefinition: map, selected: new Set([ids[team]]), units: [] });
    f.w.units[ids[team]] = ready.state.units[ids[team]];
    f.w.socket = clients[team].socket;
    for (const x of team ? [7.5, 8.5] : [-7.5, -8.5]) {
      const r = f.w.minimapMapRect(384, 384), before = clients[team].messages.length;
      f.event('pointerdown', { x: 100 + (r.left + (x + map.width / 2) * r.scale) / 2,
        y: 40 + (r.top + (7.5 + map.height / 2) * r.scale) / 2, shiftKey: true });
      const notice = await clients[team].wait(message => message.type === 'notice' && message.clientOrderToken === f.w.orderToken,
        'shipped pilot Shift minimap Move', before);
      assert.match(notice.message, /WAYPOINT QUEUED/);
    }
  }
  await fixture.stop();
  const saved = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
  assert.ok(ids.every(id => saved.state.units[id].queuedWaypoints.length === 2 && saved.state.units[id].cargo > 0));
  await fixture.start(); clients = [await fixture.connect(0, tokens[0]), await fixture.connect(1, tokens[1])];
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint));
  const delivered = await fixture.checkpoint(snapshot => snapshot.state.teamFood.every(food => food === 10)
    && ids.every(id => !snapshot.state.units[id].gatherPhase && !snapshot.state.units[id].queuedWaypoints.length
      && !snapshot.state.units[id].path.length));
  for (const [team, id] of ids.entries()) {
    const boat = delivered.state.units[id]; close(boat.x, team ? 8.5 : -8.5); close(boat.z, 7.5);
    assert.equal(boat.cargo, 0);
    close(delivered.state.resourceNodes.find(node => node.id === `${team ? 'ember' : 'azure'}-food`).stock, 50);
  }
  console.log(JSON.stringify({ scenario: 'shipped Shore Fishing Dock/Skiff adoption', ordinaryMapCatalog: true,
    paidOnlyFromLocalWood: [175, 175], defaultDomBuildAndTrainingChoices: true,
    actualShiftMinimapHandlers: true, pendingFishingMovesRecovered: true,
    food: delivered.state.teamFood, wood: delivered.state.teamWood, remainingFishPerSeat: 50,
    evidenceBoundary: 'DOM/server; deployed build, canvas placement and native browser usability remain unverified' }));
} catch (error) {
  console.error(JSON.stringify(clients?.map(client => ({ wood: client.latest.wood, resources: client.latest.resourceNodes,
    units: client.latest.units.map(row => ({ id: row[0], x: row[2], z: row[3], cargo: row[6], task: row[9] })) }))));
  throw error;
} finally {
  for (const page of dom) page.window.close();
  for (const f of minimaps) f.dom.window.close();
  await fixture.dispose();
}
