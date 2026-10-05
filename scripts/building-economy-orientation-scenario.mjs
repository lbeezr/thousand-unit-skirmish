// Native paid sites, exact costs, facing-bound Skiff births and two cold starts.
// Completion is a declared checkpoint fixture; this scenario renders no frames.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { BUILDING_DEFINITIONS as B, UNIT_DEFINITIONS as U } from '../src/gameplay-definitions.mjs';
import { createDockPlacementContext } from '../src/dock-placement.mjs';

const sites = [0, 1].flatMap(team => Array.from({ length: 4 }, (_, orientation) => ({ team, orientation,
  column: (team ? 42 : 10) + (orientation % 2) * 11, row: orientation < 2 ? 40 : 53 })));
const water = site => [
  { column: site.column - 1, row: site.row + 2, width: 3, height: 5 },
  { column: site.column + 2, row: site.row - 1, width: 5, height: 3 },
  { column: site.column - 1, row: site.row - 6, width: 3, height: 5 },
  { column: site.column - 6, row: site.row - 1, width: 5, height: 3 },
][site.orientation];
const map = { id: 'economy-facing-recovery', name: 'Economy facing recovery', width: 64, height: 64,
  terrainSeed: 19, fogOfWar: false, startingArmySize: 24, startingResources: { food: 2000, wood: 2000 },
  spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
  obstacles: sites.map(site => ({ ...water(site), material: 'water' })), resourceNodes: [], triggers: [], scenarioEvents: [] };
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 70000 });
let clients, tokens, order = 1;
const command = async (team, value, expression) => {
  const notice = await clients[team].command({ ...value, clientOrderToken: order++ }, /PLACED|REJECTED|QUEUED|STOP ORDER/);
  assert.match(notice.message, expression);
  return notice;
};
const save = () => readFile(fixture.checkpointPath, 'utf8').then(JSON.parse);
async function reconnect() {
  await fixture.start(); clients = [await fixture.connect(0, tokens[0]), await fixture.connect(1, tokens[1])];
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint));
}
try {
  await fixture.start(); clients = [await fixture.connect(0), await fixture.connect(1)];
  tokens = clients.map(client => client.welcome.player.sessionToken);
  clients[0].send({ type: 'publishMap', map });
  await Promise.all(clients.map(client => client.wait(message => message.type === 'mapChange' && message.map.id === map.id)));
  const workers = clients.map((client, team) => client.latest.units.filter(unit => unit[1] === team && unit[5] === 'worker').map(unit => unit[0]));
  for (const site of sites) {
    const value = { type: 'build', buildingType: 'dock', ids: workers[site.team],
      x: site.column - 31.5, z: site.row - 31.5, orientation: site.orientation };
    await command(site.team, { ...value, orientation: (site.orientation + 1) % 4 }, /DOCK FRONT.*ROTATE/);
    await command(site.team, value, /PLACED/);
  }
  for (const team of [0, 1]) for (const [i, type] of ['mill', 'farm'].entries()) {
    await command(team, { type: 'build', buildingType: type, ids: workers[team],
      x: team ? 10.5 + i * 5 : -10.5 - i * 5, z: -12.5, orientation: 3 - i }, /PLACED/);
  }
  for (const team of [0, 1]) await command(team, { type: 'build', buildingType: 'house', ids: workers[team],
    x: team ? 20.5 : -20.5, z: -20.5, orientation: 0 }, /PLACED/);
  for (const team of [0, 1]) await command(team, { type: 'stop', ids: workers[team] }, /STOP ORDER/);
  await fixture.stop(); let saved = await save();
  assert.equal(saved.state.buildings.length, 14);
  const expectedWood = 2000 - 4 * B.dock.cost.wood - B.mill.cost.wood - B.farm.cost.wood - B.house.cost.wood;
  assert.deepEqual(saved.state.teamWood, [expectedWood, expectedWood], 'wrong shores never debit or consume an ID');
  assert.deepEqual(saved.state.buildings.map(b => b.id), Array.from({ length: 14 }, (_, i) => i + 1));
  for (const building of saved.state.buildings) { building.complete = true; building.progress = 1; }
  await writeFile(fixture.checkpointPath, JSON.stringify(saved)); await reconnect();
  for (const client of clients) for (const building of client.latest.buildings) {
    const paid = saved.state.buildings.find(b => b.id === building.id);
    assert.equal(building.orientation, paid.orientation);
    assert.equal(building.dockFacingVersion, paid.dockFacingVersion);
  }
  const docks = saved.state.buildings.filter(b => b.type === 'dock');
  for (const dock of docks) await command(dock.team, { type: 'trainUnit', kind: 'skiff', buildingId: dock.id }, /QUEUED/);
  await fixture.stop(); saved = await save();
  assert.deepEqual(saved.state.teamWood, [expectedWood - 4 * U.skiff.cost.wood, expectedWood - 4 * U.skiff.cost.wood]);
  for (const building of saved.state.buildings) if (building.type === 'dock') building.trainingRemaining = .05;
  await writeFile(fixture.checkpointPath, JSON.stringify(saved)); await reconnect();
  const produced = await fixture.checkpoint(s => s.state.units.filter(u => u.kind === 'skiff').length === 8);
  const berths = createDockPlacementContext(map, B.dock), born = produced.state.units.filter(u => u.kind === 'skiff');
  for (const dock of docks) {
    const berth = berths.accessAt(Math.floor(dock.z + 32) * 64 + Math.floor(dock.x + 32), dock.orientation);
    assert.equal(berth.valid, true); assert.equal(dock.dockFacingVersion, 1);
    assert.ok(born.some(unit => unit.team === dock.team && Math.floor(unit.z + 32) * 64 + Math.floor(unit.x + 32) === berth.spawnCell));
  }
  console.log(JSON.stringify({ scope: 'native-paid-economy-facing-recovery', paidSites: 14,
    dockFacingsPerSeat: 4, wrongShoreRejections: 8, processRestarts: 2, persistedFacingAndMarker: true,
    costsAndIDs: true, chosenShoreSkiffBirths: 8, completion: 'declared checkpoint fixture', renderedFrames: 0 }));
} finally { await fixture.dispose(); }
