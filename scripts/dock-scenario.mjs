import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { BUILDING_DEFINITIONS as B, GAMEPLAY_RULESET_REVISION } from '../src/gameplay-definitions.mjs';
import { createDockPlacementContext } from '../src/dock-placement.mjs';

const map = { id: 'dock-shoreline-proof', name: 'Dock shoreline proof', width: 64, height: 64,
  terrainSeed: 19, fogOfWar: false, startingArmySize: 24,
  startingResources: { food: 1000, wood: 1000 },
  spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
  obstacles: [18, 43].map(column => ({ column, row: 42, width: 6, height: 8, material: 'water' })),
  resourceNodes: [0, 1].map(team => ({ id: `food-${team}`, type: 'food',
    x: team ? 8.5 : -8.5, z: -8.5, stock: 100 })), triggers: [], scenarioEvents: [] };
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 70_000 });
let clients, workers, tokens, order = 100;
const command = (team, value, expression) => clients[team].command({ ...value, clientOrderToken: order++ }, expression);
const docks = snapshot => snapshot.state.buildings.filter(building => building.type === 'dock');
const saved = async () => JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
const centerAt = (x, z) => Math.floor(z + 32) * 64 + Math.floor(x + 32);
async function reconnect() {
  await fixture.start(); clients = [await fixture.connect(0, tokens[0]), await fixture.connect(1, tokens[1])];
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint));
}
async function rejectSaved(source, expression) {
  await writeFile(fixture.checkpointPath, source); await fixture.start(); await fixture.stop();
  assert.notEqual((await saved()).matchId, JSON.parse(source).matchId, expression);
  const retained = await Promise.all((await readdir(fixture.directory))
    .filter(name => name.startsWith('match.json.rejected-'))
    .map(name => readFile(path.join(fixture.directory, name), 'utf8')));
  assert.ok(retained.includes(source), 'rejected save is preserved exactly');
}
try {
  await fixture.start(); clients = [await fixture.connect(0), await fixture.connect(1)];
  tokens = clients.map(client => client.welcome.player.sessionToken);
  clients[0].send({ type: 'publishMap', map });
  await Promise.all(clients.map(client => client.wait(message => message.type === 'mapChange' && message.map.id === map.id)));
  workers = clients.map((client, team) => client.latest.units.filter(unit => unit[1] === team && unit[5] === 'worker').map(unit => unit[0]));
  await fixture.stop(); const preDock = await saved();
  preDock.rulesetRevision = 'v1:c8a30de45cf9bfa527046662d022a0dc2cb28efc3ddd8b24521c5992eae328c2';
  await writeFile(fixture.checkpointPath, JSON.stringify(preDock)); await reconnect();
  const migrated = await fixture.checkpoint(snapshot => snapshot.rulesetRevision === GAMEPLAY_RULESET_REVISION);
  assert.equal(migrated.matchId, preDock.matchId);
  assert.deepEqual(migrated.state.teamWood, preDock.state.teamWood);
  await command(0, { type: 'build', buildingType: 'dock', ids: workers[1], x: -12.5, z: 8.5 }, /SELECT A WORKER/);
  for (const team of [0, 1]) {
    const x = team ? 12.5 : -12.5;
    await command(team, { type: 'build', buildingType: 'dock', ids: workers[team], x, z: -8.5 }, /DOCK NEEDS CLEAR WATER BERTH/);
    await command(team, { type: 'build', buildingType: 'dock', ids: workers[team], x, z: 11.5 }, /SPACE BLOCKED/);
  }
  const rejected = await fixture.checkpoint();
  assert.deepEqual(rejected.state.teamWood, [1000, 1000]); assert.equal(docks(rejected).length, 0);
  for (const team of [0, 1]) await command(team, { type: 'build', buildingType: 'dock',
    ids: workers[team], x: team ? 12.5 : -12.5, z: 8.5 }, /DOCK PLACED/);
  const foundations = await fixture.checkpoint(snapshot => docks(snapshot).length === 2);
  assert.deepEqual(foundations.state.teamWood, [900, 900]); assert.deepEqual(foundations.state.teamFood, [1000, 1000]);
  assert.ok(docks(foundations).every(building => !building.complete));
  await command(1, { type: 'cancelConstruction', buildingId: docks(foundations).find(building => building.team === 0).id }, /CANCEL REJECTED/);
  await fixture.stop(); const unfinished = await saved();
  assert.ok(docks(unfinished).every(building => !building.complete)); await reconnect();
  const completed = await fixture.checkpoint(snapshot => docks(snapshot).length === 2 && docks(snapshot).every(building => building.complete));
  assert.deepEqual(completed.state.teamWood, [900, 900], 'paid foundation recovers without a second charge');
  const context = createDockPlacementContext(map, B.dock);
  for (const building of docks(completed)) {
    assert.ok(context.accessAt(centerAt(building.x, building.z)).valid);
    assert.equal(building.hp, B.dock.maxHp); assert.deepEqual(building.productionQueue, []);
    assert.ok(clients[building.team].latest.buildings.some(row => row.id === building.id && row.complete));
    await command(building.team, { type: 'trainUnit', buildingId: building.id, kind: 'worker' }, /TRAINING REJECTED/);
  }
  assert.ok(completed.state.units.every(unit => !map.obstacles.some(obstacle => {
    const column = Math.floor(unit.x + 32), row = Math.floor(unit.z + 32);
    return column >= obstacle.column && column < obstacle.column + obstacle.width
      && row >= obstacle.row && row < obstacle.row + obstacle.height;
  })), 'Workers remain on land');
  for (const team of [0, 1]) await command(team, { type: 'gather', ids: [workers[team][0]], nodeId: `food-${team}` }, /GATHER ORDER/);
  const deposited = await fixture.checkpoint(snapshot => snapshot.state.teamFood.every(food => food > 1000));
  assert.ok(workers.every((ids, team) => deposited.state.units[ids[0]].dropoffBuildingId
    === clients[team].latest.homeTownCenters.find(center => center.team === team).id), 'Dock is not a food drop-off');
  for (const team of [0, 1]) await command(team, { type: 'stop', ids: workers[team] }, /STOP ORDER/);
  await fixture.stop(); const completeSave = await saved(); await reconnect();
  assert.deepEqual(docks(await fixture.checkpoint()).map(building => [building.id, building.team, building.complete]),
    docks(completeSave).map(building => [building.id, building.team, building.complete]));
  await fixture.stop();
  const oldPinWithDock = structuredClone(completeSave); oldPinWithDock.rulesetRevision = preDock.rulesetRevision;
  await rejectSaved(JSON.stringify(oldPinWithDock), 'an older content pin cannot claim a Dock');
  const inland = structuredClone(completeSave), badDock = docks(inland)[0];
  badDock.x = -5.5; badDock.z = -12.5; badDock.footprint = [];
  const cell = centerAt(badDock.x, badDock.z);
  for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) badDock.footprint.push(cell + z * 64 + x);
  await rejectSaved(JSON.stringify(inland), 'a valid square inland footprint cannot recover as a Dock');
  console.log(JSON.stringify({ scenario: 'Dock shoreline foundation', bothSeatPaidConstruction: true,
    landWorkersOnly: true, clearWaterBerthAndExit: true, unfinishedAndCompletedRecovery: true,
    preDockMigration: true, invalidDockCheckpointPreserved: true, foodStillUsesExistingDropoffs: true,
    gameplayAvailability: 'place/build/select Dock; paid Skiff production has its separate skiff-scenario; boat cargo and final pier art unavailable' }));
} finally { await fixture.dispose(); }
