import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { GAMEPLAY_RULESET_REVISION } from '../src/gameplay-definitions.mjs';
import { teamPopulation } from '../src/population.mjs';
import { createWaterUnitRuntime, waterUnitOccupiedCells } from '../src/water-unit-runtime.mjs';
import { waterRaster } from '../src/water-contours.mjs';

const previousDockPin = 'v1:561c62ccc67ac78cc067e8e639942a83fc6d6b1f89633e5b1c73aedc20f4a3a6';
const previousLandPin = 'v1:525ab43cd600206d5c6cfab131c9d1fe193a59d9160ab219dc96a0dfb181605b';
const map = { id: 'skiff-water-proof', name: 'Skiff water proof', width: 64, height: 64,
  terrainSeed: 19, fogOfWar: false, startingArmySize: 24,
  startingResources: { food: 1000, wood: 1000 },
  spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
  obstacles: [18, 43].map(column => ({ column, row: 42, width: 6, height: 8, material: 'water' })),
  resourceNodes: [0, 1].map(team => ({ id: `food-${team}`, type: 'food',
    x: team ? 8.5 : -8.5, z: -8.5, stock: 100 })), triggers: [], scenarioEvents: [] };
const runtime = createWaterUnitRuntime(map);
const authoredWater = waterRaster(map);
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 70_000 });
let clients, workers, tokens, order = 100;
const command = (team, value, expression) => clients[team].command({ ...value, clientOrderToken: order++ }, expression);
const docks = snapshot => snapshot.state.buildings.filter(building => building.type === 'dock');
const boats = snapshot => snapshot.state.units.filter(unit => unit.kind === 'skiff' && unit.hp > 0);
const saved = async () => JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
const pop = (snapshot, team) => teamPopulation({ ...snapshot.state, openingArmySize: snapshot.state.currentArmySize }, team);
async function reconnect() {
  await fixture.start(); clients = [await fixture.connect(0, tokens[0]), await fixture.connect(1, tokens[1])];
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint));
}
async function rejectSaved(snapshot, reason) {
  const source = JSON.stringify(snapshot);
  await writeFile(fixture.checkpointPath, source); await fixture.start(); await fixture.stop();
  assert.notEqual((await saved()).matchId, snapshot.matchId, reason);
  const retained = await Promise.all((await readdir(fixture.directory)).filter(name => name.startsWith('match.json.rejected-'))
    .map(name => readFile(path.join(fixture.directory, name), 'utf8')));
  assert.ok(retained.includes(source), 'rejected checkpoint retained exactly');
}
function assertSafe(snapshot) {
  const occupied = new Set();
  for (const unit of boats(snapshot)) {
    assert.equal(unit.movementDomain, 'water'); assert.ok(runtime.validRoute(unit));
    assert.equal(unit.cargo, 0); assert.equal(unit.cargoType, null);
    for (const cell of waterUnitOccupiedCells(runtime.graph, unit)) {
      assert.ok(!occupied.has(cell), 'live hull reservations do not overlap'); occupied.add(cell);
    }
  }
}
try {
  await fixture.start(); clients = [await fixture.connect(0), await fixture.connect(1)];
  tokens = clients.map(client => client.welcome.player.sessionToken);
  clients[0].send({ type: 'publishMap', map });
  await Promise.all(clients.map(client => client.wait(message => message.type === 'mapChange' && message.map.id === map.id)));
  workers = clients.map((client, team) => client.latest.units.filter(unit => unit[1] === team && unit[5] === 'worker').map(unit => unit[0]));
  for (const team of [0, 1]) await command(team, { type: 'build', buildingType: 'dock', ids: workers[team], x: team ? 12.5 : -12.5, z: 8.5 }, /DOCK PLACED/);
  await fixture.checkpoint(snapshot => docks(snapshot).length === 2 && docks(snapshot).every(building => building.complete));
  await fixture.stop(); const preBoat = await saved(); preBoat.rulesetRevision = previousDockPin;
  await writeFile(fixture.checkpointPath, JSON.stringify(preBoat)); await reconnect();
  const migrated = await fixture.checkpoint(snapshot => snapshot.rulesetRevision === GAMEPLAY_RULESET_REVISION);
  assert.equal(migrated.matchId, preBoat.matchId); assert.deepEqual(migrated.state.teamWood, [900, 900]);
  await fixture.stop(); const priorLand = await saved(); priorLand.rulesetRevision = previousLandPin;
  await writeFile(fixture.checkpointPath, JSON.stringify(priorLand)); await reconnect();
  const migratedLand = await fixture.checkpoint(snapshot => snapshot.rulesetRevision === GAMEPLAY_RULESET_REVISION);
  assert.equal(migratedLand.matchId, priorLand.matchId); assert.deepEqual(migratedLand.state.teamWood, [900, 900]);
  const dockIds = [0, 1].map(team => docks(migrated).find(building => building.team === team).id);
  await command(1, { type: 'trainUnit', buildingId: dockIds[0], kind: 'skiff' }, /TRAINING REJECTED/);
  await command(0, { type: 'setRallyPoint', buildingId: dockIds[0], x: -12.5, z: 15.5 }, /MOVE THE SKIFF AFTER SPAWN/);
  for (const team of [0, 1]) await command(team, { type: 'trainUnit', buildingId: dockIds[team], kind: 'skiff' }, /QUEUED/);
  await command(0, { type: 'trainUnit', buildingId: dockIds[0], kind: 'skiff' }, /QUEUED/);
  await command(1, { type: 'cancelTraining', buildingId: dockIds[0], queueIndex: 1 }, /CANCEL REJECTED/);
  await command(0, { type: 'cancelTraining', buildingId: dockIds[0], queueIndex: 1 }, /REFUND 0 FOOD \+ 75 WOOD/);
  const refund = await fixture.checkpoint(snapshot => snapshot.state.teamWood[0] === 825);
  assert.equal(pop(refund, 0).reserved, 1);
  await command(0, { type: 'trainUnit', buildingId: dockIds[0], kind: 'skiff' }, /QUEUED/);
  const paid = await fixture.checkpoint(snapshot => docks(snapshot).find(building => building.team === 0).queue === 2);
  assert.deepEqual(paid.state.teamWood, [750, 825]); assert.deepEqual(paid.state.teamFood, [1000, 1000]);
  assert.equal(pop(paid, 0).reserved, 2); assert.equal(pop(paid, 1).reserved, 1);
  await fixture.stop(); const paidSave = await saved(); await reconnect();
  const blocked = await fixture.checkpoint(snapshot => boats(snapshot).length === 2
    && docks(snapshot).find(building => building.team === 0).productionBlocked);
  assertSafe(blocked); assert.equal(docks(blocked).find(building => building.team === 0).queue, 1);
  assert.deepEqual(blocked.state.teamWood, paidSave.state.teamWood);
  await fixture.stop(); const blockedSave = await saved(); await reconnect();
  const recovered = await fixture.checkpoint(snapshot => snapshot.state.tickNumber > blockedSave.state.tickNumber);
  assert.equal(boats(recovered).length, 2); assert.equal(docks(recovered).find(building => building.team === 0).queue, 1);
  const boatIds = [0, 1].map(team => boats(recovered).find(unit => unit.team === team).id);
  await command(0, { type: 'move', ids: [boatIds[0]], unitGenerations: [0], x: -12.5, z: 15.5 }, /NO VALID UNITS/);
  await command(1, { type: 'move', ids: [boatIds[0]], x: -12.5, z: 15.5 }, /NO VALID UNITS/);
  for (const team of [0, 1]) {
    await command(team, { type: 'move', ids: [boatIds[team]], x: 0, z: 0 }, /WATER ROUTE INVALID-ENDPOINTS/);
    await command(team, { type: 'move', ids: [boatIds[team]], x: team ? -12.5 : 12.5, z: 15.5 }, /WATER ROUTE DISCONNECTED/);
    await command(team, { type: 'move', ids: [boatIds[team], workers[team][0]], x: team ? 12.5 : -12.5, z: 15.5 }, /SELECT ONE SKIFF/);
    await command(team, { type: 'move', ids: [boatIds[team]], x: team ? 12.5 : -12.5, z: 15.5, queue: true }, /SUPPORTS MOVE AND STOP/);
    await command(team, { type: 'gather', ids: [boatIds[team]], nodeId: `food-${team}` }, /NO REACHABLE WORKERS SELECTED/);
    await command(team, { type: 'move', ids: [boatIds[team]], x: team ? 12.5 : -12.5, z: 15.5 }, /SKIFF WATER ROUTE/);
  }
  await clients[1].state(state => state.units.find(unit => unit[0] === boatIds[1])?.[3] > 11.6, 'Skiff starts moving');
  await command(1, { type: 'stop', ids: [boatIds[1]] }, /STOP ORDER/);
  await fixture.stop(); const stopped = await saved(); assertSafe(stopped);
  assert.equal(stopped.state.units[boatIds[1]].path.length, 0);
  await reconnect();
  for (const team of [0, 1]) await command(team, { type: 'move', ids: [boatIds[team]], x: team ? 12.5 : -12.5, z: 15.5 }, /SKIFF WATER ROUTE/);
  await fixture.stop(); const moving = await saved(); assertSafe(moving);
  assert.ok(moving.state.units[boatIds[1]].path.length > 0, 'moving route is checkpointed');
  await reconnect();
  const done = await fixture.checkpoint(snapshot => boats(snapshot).length === 3
    && boatIds.every(id => snapshot.state.units[id].path.length === 0 && snapshot.state.units[id].z === 15.5));
  assertSafe(done); assert.deepEqual(done.state.teamWood, [750, 825]); assert.equal(pop(done, 0).reserved, 0);
  assert.equal(pop(done, 0).used - pop(preBoat, 0).used, 2); assert.equal(pop(done, 1).used - pop(preBoat, 1).used, 1);
  assert.deepEqual(done.state.teamFood, [1000, 1000]);
  assert.ok(done.state.units.filter(unit => unit.kind !== 'skiff').every(unit => !authoredWater[runtime.graph.cellAt(unit.x, unit.z)]), 'land actors stay on land including shore margins');
  await fixture.stop(); const final = await saved();
  for (const [reason, mutate] of [
    ['missing movement domain', snapshot => { delete snapshot.state.units[boatIds[0]].movementDomain; }],
    ['dry actor position', snapshot => { snapshot.state.units[boatIds[0]].x = 0; }],
    ['unsupported fish cargo', snapshot => { snapshot.state.units[boatIds[0]].cargo = 1; snapshot.state.units[boatIds[0]].cargoType = 'food'; }],
    ['off-center idle position', snapshot => { snapshot.state.units[boatIds[0]].x += .2; snapshot.state.units[boatIds[0]].z += .2; }],
    ['land-planner pending state', snapshot => { snapshot.state.units[boatIds[0]].movePlanningPending = true; }],
    ['overlapping hulls', snapshot => { const a = boats(snapshot)[0], b = boats(snapshot)[2]; b.x = a.x; b.z = a.z; }],
    ['old content pin with Skiff', snapshot => { snapshot.rulesetRevision = previousDockPin; }],
  ]) { const invalid = structuredClone(final); mutate(invalid); await rejectSaved(invalid, reason); }
  const oldQueue = structuredClone(paidSave); oldQueue.rulesetRevision = previousDockPin;
  await rejectSaved(oldQueue, 'old content pin with paid Skiff queue');
  const preSkiffQueue = structuredClone(paidSave); preSkiffQueue.rulesetRevision = previousLandPin;
  await rejectSaved(preSkiffQueue, 'immediately preceding land content pin cannot claim a paid Skiff queue');
  console.log(JSON.stringify({ scenario: 'Dock paid Skiff movement', bothSeatPaidProduction: true,
    tailRefundAndPopulationReservation: true, priorDockAndGatePinMigration: true, paidQueueRecovery: true,
    blockedBerthRecovery: true, ownerAndDomainRejections: true, stopAndMovingRecovery: true,
    waterOnlyNonoverlappingHulls: true, invalidCheckpointPreserved: true,
    gameplayAvailability: 'Dock trains one unarmed Skiff placeholder; select one boat and Move/Stop on authored level-zero water; no fish cargo, transport, naval combat or rally' }));
} finally { await fixture.dispose(); }
