import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { GAMEPLAY_RULESET_REVISION } from '../src/gameplay-definitions.mjs';
import { createWaterUnitRuntime, waterUnitOccupiedCells } from '../src/water-unit-runtime.mjs';
import { createSkiffFishingContext } from '../src/skiff-fishing.mjs';
import { waterRaster } from '../src/water-contours.mjs';

const previousMovementPin = 'v1:b82d5b9fdd687e98dd47b8390aaaa04f7bc00df9dc6ac16273f8c04235cbeb54';
const previousFarmPin = 'v1:496509c24775ddfbd289faf9fbcc85dfef7d054d710c665caa9fe192c610ddcd';
const map = { id: 'skiff-fishing-proof', name: 'Skiff fishing proof', width: 64, height: 64,
  terrainSeed: 19, fogOfWar: false, startingArmySize: 24, startingResources: { food: 1000, wood: 1000 },
  spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
  obstacles: [18, 43].map(column => ({ column, row: 42, width: 6, height: 8, material: 'water' })),
  resourceNodes: [0, 1].map(team => ({ id: `fish-${team}`, type: 'food', resourceVariant: 'shore-fish',
    x: team ? 15.5 : -9.5, z: 9.5, stock: 31 })), triggers: [], scenarioEvents: [] };
const water = createWaterUnitRuntime(map), fishing = createSkiffFishingContext(map, water), wet = waterRaster(map);
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 70_000 });
let clients, workers, tokens, boatIds, order = 100;
const command = (team, value, expression) => clients[team].command({ ...value, clientOrderToken: order++ }, expression);
const docks = snapshot => snapshot.state.buildings.filter(building => building.type === 'dock');
const boats = snapshot => snapshot.state.units.filter(unit => unit.kind === 'skiff' && unit.hp > 0);
const saved = async () => JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
const stock = (snapshot, team) => snapshot.state.resourceNodes.find(node => node.id === `fish-${team}`).stock;
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
function safe(snapshot) {
  const occupied = new Set(), nodes = new Map(map.resourceNodes.map(node => [node.id, node]));
  for (const unit of snapshot.state.units.filter(unit => unit.hp > 0)) {
    if (unit.kind !== 'skiff') { assert.ok(!wet[water.graph.cellAt(unit.x, unit.z)], 'Workers remain on land'); continue; }
    assert.ok(water.validRoute(unit)); assert.ok(fishing.validState(unit, nodes, snapshot.state.buildings));
    for (const cell of waterUnitOccupiedCells(water.graph, unit)) {
      assert.ok(!occupied.has(cell), 'boat hulls stay disjoint'); occupied.add(cell);
    }
  }
  for (const team of [0, 1]) close(stock(snapshot, team)
    + snapshot.state.units.filter(unit => unit.team === team && unit.cargoType === 'food').reduce((sum, unit) => sum + unit.cargo, 0)
    + snapshot.state.teamFood[team] - 1000, 31);
}
async function reconnect() {
  await fixture.start(); clients = [await fixture.connect(0, tokens[0]), await fixture.connect(1, tokens[1])];
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint));
}
async function rejectSaved(snapshot, reason) {
  const source = JSON.stringify(snapshot);
  await writeFile(fixture.checkpointPath, source); await fixture.start(); await fixture.stop();
  assert.notEqual((await saved()).matchId, snapshot.matchId, reason);
  const rejected = await Promise.all((await readdir(fixture.directory)).filter(name => name.startsWith('match.json.rejected-'))
    .map(name => readFile(path.join(fixture.directory, name), 'utf8')));
  assert.ok(rejected.includes(source), 'rejected checkpoint preserved exactly');
}
try {
  await fixture.start(); clients = [await fixture.connect(0), await fixture.connect(1)];
  tokens = clients.map(client => client.welcome.player.sessionToken);
  clients[0].send({ type: 'publishMap', map });
  await Promise.all(clients.map(client => client.wait(message => message.type === 'mapChange' && message.map.id === map.id)));
  workers = clients.map((client, team) => client.latest.units.filter(unit => unit[1] === team && unit[5] === 'worker').map(unit => unit[0]));
  for (const team of [0, 1]) await command(team, { type: 'build', buildingType: 'dock', ids: workers[team], x: team ? 12.5 : -12.5, z: 8.5 }, /DOCK PLACED/);
  const built = await fixture.checkpoint(snapshot => docks(snapshot).length === 2 && docks(snapshot).every(building => building.complete));
  const dockIds = [0, 1].map(team => docks(built).find(building => building.team === team).id);
  for (const team of [0, 1]) await command(team, { type: 'trainUnit', buildingId: dockIds[team], kind: 'skiff' }, /QUEUED/);
  await fixture.checkpoint(snapshot => docks(snapshot).every(building => building.queue === 1));
  await fixture.stop(); const paid = await saved(); paid.rulesetRevision = previousMovementPin;
  await writeFile(fixture.checkpointPath, JSON.stringify(paid)); await reconnect();
  const migratedQueue = await fixture.checkpoint(snapshot => snapshot.rulesetRevision === GAMEPLAY_RULESET_REVISION);
  assert.equal(migratedQueue.matchId, paid.matchId); assert.deepEqual(migratedQueue.state.teamWood, [825, 825]);
  await fixture.checkpoint(snapshot => boats(snapshot).length === 2); await fixture.stop();
  const bare = await saved(); bare.rulesetRevision = previousFarmPin;
  await writeFile(fixture.checkpointPath, JSON.stringify(bare)); await reconnect();
  const migrated = await fixture.checkpoint(snapshot => snapshot.rulesetRevision === GAMEPLAY_RULESET_REVISION);
  assert.equal(migrated.matchId, bare.matchId); boatIds = [0, 1].map(team => boats(migrated).find(unit => unit.team === team).id);
  for (const id of boatIds) for (const key of ['id', 'generation', 'x', 'z', 'cargo', 'gatherPhase']) assert.equal(migrated.state.units[id][key], bare.state.units[id][key]);
  await command(1, { type: 'gather', ids: [boatIds[0]], nodeId: 'fish-0' }, /NO REACHABLE WORKERS SELECTED/);
  for (const team of [0, 1]) {
    await command(team, { type: 'gather', ids: [boatIds[team]], unitGenerations: [0], nodeId: `fish-${team}` }, /NO REACHABLE WORKERS SELECTED/);
    await command(team, { type: 'gather', ids: [boatIds[team], workers[team][0]], nodeId: `fish-${team}` }, /SELECT ONE SKIFF/);
    await command(team, { type: 'gather', ids: [boatIds[team]], nodeId: `fish-${1 - team}` }, /NEED REACHABLE WATER FISH AND AN OWNED DOCK/);
    await command(team, { type: 'gather', ids: [boatIds[team]], forestCell: 0 }, /SELECT A SHORE FISH SOURCE/);
    await command(team, { type: 'gather', ids: [boatIds[team]], nodeId: `fish-${team}`, queue: true }, /QUEUED FISHING IS UNAVAILABLE/);
    await command(team, { type: 'returnCargo', ids: [boatIds[team]] }, /NEED FOOD CARGO AND A REACHABLE OWNED DOCK/);
    await command(team, { type: 'gather', ids: [boatIds[team]], nodeId: `fish-${team}` }, /FISHING ORDER/);
  }
  await fixture.stop(); const outbound = await saved(); safe(outbound);
  assert.ok(boatIds.every(id => outbound.state.units[id].gatherPhase === 'to-node' && outbound.state.units[id].path.length > 0));
  await reconnect();
  await fixture.checkpoint(snapshot => boatIds.every(id => snapshot.state.units[id].cargo >= .1));
  await fixture.stop(); const harvesting = await saved(); safe(harvesting);
  assert.ok(boatIds.every(id => harvesting.state.units[id].gatherPhase === 'gathering'));
  await reconnect();
  for (const team of [0, 1]) await command(team, { type: 'stop', ids: [boatIds[team]] }, /STOP ORDER/);
  await fixture.stop(); const stopped = await saved(); safe(stopped);
  assert.deepEqual(stopped.state.teamFood, [1000, 1000]);
  const loads = boatIds.map(id => stopped.state.units[id].cargo); assert.ok(loads.every(load => load > 0 && load < 10));
  await reconnect();
  const idle = await fixture.checkpoint(snapshot => snapshot.state.tickNumber > stopped.state.tickNumber + 5);
  for (const team of [0, 1]) {
    assert.equal(idle.state.units[boatIds[team]].cargo, loads[team]); assert.equal(stock(idle, team), stock(stopped, team));
    await command(team, { type: 'returnCargo', ids: [boatIds[team], workers[team][0]] }, /SELECT ONE SKIFF/);
    await command(team, { type: 'returnCargo', ids: [boatIds[team]] }, /SKIFF TO OWNED DOCK/);
  }
  const delivered = await fixture.checkpoint(snapshot => boatIds.every(id => snapshot.state.units[id].cargo === 0 && snapshot.state.units[id].gatherPhase === ''));
  safe(delivered);
  for (const team of [0, 1]) {
    close(delivered.state.teamFood[team], 1000 + loads[team]); assert.equal(stock(delivered, team), stock(stopped, team));
    await command(team, { type: 'gather', ids: [boatIds[team]], nodeId: `fish-${team}` }, /FISHING ORDER/);
  }
  await fixture.checkpoint(snapshot => boatIds.every(id => snapshot.state.units[id].cargo === 10 && snapshot.state.units[id].gatherPhase === 'to-base'));
  await fixture.stop(); const returning = await saved(); safe(returning);
  assert.ok(boatIds.every(id => returning.state.units[id].gatherNodeId !== null)); await reconnect();
  const resumed = await fixture.checkpoint(snapshot => boatIds.every(id => snapshot.state.units[id].cargo < 10
    && ['to-node', 'gathering'].includes(snapshot.state.units[id].gatherPhase)));
  safe(resumed);
  for (const team of [0, 1]) await command(team, { type: 'gather', ids: [workers[team][0]], nodeId: `fish-${team}` }, /GATHER ORDER/);
  const exhausted = await fixture.checkpoint(snapshot => [0, 1].every(team => stock(snapshot, team) === 0
    && snapshot.state.units.filter(unit => unit.team === team).every(unit => unit.cargo === 0)));
  safe(exhausted); assert.deepEqual(exhausted.state.teamFood, [1031, 1031]); assert.deepEqual(exhausted.state.teamWood, [825, 825]);
  for (const team of [0, 1]) await command(team, { type: 'gather', ids: [boatIds[team]], nodeId: `fish-${team}` }, /RESOURCE NODE EMPTY/);
  await fixture.stop(); const final = await saved(); await reconnect();
  const recovered = await fixture.checkpoint(snapshot => snapshot.state.tickNumber > final.state.tickNumber + 5); safe(recovered);
  assert.deepEqual(recovered.state.teamFood, [1031, 1031]); assert.ok([0, 1].every(team => stock(recovered, team) === 0));
  await fixture.stop();
  for (const [reason, source, mutate] of [
    ['wood cargo', final, snapshot => Object.assign(snapshot.state.units[boatIds[0]], { cargo: 1, cargoType: 'wood' })],
    ['unknown fish source', returning, snapshot => { snapshot.state.units[boatIds[0]].gatherNodeId = 'missing'; }],
    ['foreign Dock target', returning, snapshot => { snapshot.state.units[boatIds[0]].dropoffBuildingId = dockIds[1]; }],
    ['off-approach harvesting', stopped, snapshot => { const unit = snapshot.state.units[boatIds[0]];
      Object.assign(unit, water.graph.pointAt(fishing.dockCell(docks(stopped).find(building => building.team === 0))), { gatherNodeId: 'fish-0', gatherPhase: 'gathering' }); }],
    ['old revision claiming cargo', stopped, snapshot => { snapshot.rulesetRevision = previousMovementPin; }],
    ['Farm revision claiming fish cargo', stopped, snapshot => { snapshot.rulesetRevision = previousFarmPin; }],
    ['old revision claiming fishing intent', returning, snapshot => { snapshot.rulesetRevision = previousMovementPin; }],
  ]) { const invalid = structuredClone(source); mutate(invalid); await rejectSaved(invalid, reason); }
  console.log(JSON.stringify({ scenario: 'Both-seat finite Skiff fishing', movementOnlyQueueAndBoatMigration: true,
    ownedSingleBoatAdmission: true, outboundAndHarvestingRecovery: true, stopAndFractionalReturnRecovery: true, automaticReturnAndResumeRecovery: true,
    sharedWorkerBoatStockConserved: true, finalFood: [1031, 1031], finalWood: [825, 825],
    depletedRestartWithoutRegrowth: true, invalidCheckpointsPreserved: true,
    boundaries: 'one boat per order; provisional 10 food / 1 food per second; owned Dock only; existing food ledger; placeholder art; no passengers, weapons or queued fishing' }));
} finally { await fixture.dispose(); }
