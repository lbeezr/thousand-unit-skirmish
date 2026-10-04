import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { BUILDING_DEFINITIONS as B, GAMEPLAY_RULESET_REVISION } from '../src/gameplay-definitions.mjs';
import { farmHarvestNodeId } from '../src/farm-harvest.mjs';
import { createDeterministicPolicy, toOpponentObservation } from '../src/pve-opponent.mjs';

const outputArg = process.argv.slice(2).find(arg => arg.startsWith('--output='));
const fogged = process.argv.includes('--fog');
assert.ok(process.argv.slice(2).every(arg => arg === outputArg || arg === '--fog'), 'Usage: [--fog] [--output=NEW_DIRECTORY]');
const output = outputArg ? path.resolve(outputArg.slice(9)) : null;
if (output) await mkdir(output); // A prior record is never overwritten.
const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sourceDirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '';
const map = { id: 'finite-farm-proof', name: 'Finite Farm paid proof', width: 64, height: 64,
  terrainSeed: 19, fogOfWar: fogged, startingArmySize: 24,
  startingResources: { food: 300, wood: 600 },
  spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
  obstacles: [], resourceNodes: [], triggers: [], scenarioEvents: [] };
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 90_000 });
let clients, tokens, workers, token = 1;
const suppliedFood = [0, 0], spentWood = [0, 0], lostCrop = [0, 0], records = [];
const command = (team, value, notice) => clients[team].command({ ...value, clientOrderToken: token++ }, notice);
const farms = snapshot => snapshot.state.buildings.filter(building => building.type === 'farm');
const ownFarm = (snapshot, team) => farms(snapshot).find(building => building.team === team && building.z === 8.5);
const ownMill = (snapshot, team) => snapshot.state.buildings.find(building => building.team === team && building.type === 'mill');
const saved = async () => JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
function conserved(snapshot) {
  assert.equal(snapshot.state.resourceNodes.length, 0, 'paid plots never change the authored-node pool');
  for (const team of [0, 1]) {
    const crop = farms(snapshot).filter(building => building.team === team).reduce((n, building) => n + building.harvestStock, 0);
    const cargo = snapshot.state.units.filter(unit => unit.team === team && unit.cargoType === 'food').reduce((n, unit) => n + unit.cargo, 0);
    assert.ok(Math.abs(snapshot.state.teamFood[team] + crop + cargo + lostCrop[team]
      - map.startingResources.food - suppliedFood[team]) < 1e-5, `seat ${team}: paid crop supply = stock + cargo + bank + destroyed crop`);
    assert.ok(Math.abs(snapshot.state.teamWood[team] - map.startingResources.wood + spentWood[team]) < 1e-5,
      `seat ${team}: wood bank matches paid work and refunds`);
  }
}
function record(stage, snapshot) {
  conserved(snapshot);
  records.push({ stage, tick: snapshot.state.tickNumber, food: [...snapshot.state.teamFood], wood: [...snapshot.state.teamWood],
    farms: farms(snapshot).map(({ id, team, complete, progress, harvestStock }) => ({ id, team, complete, progress, harvestStock })),
    cargo: [0, 1].map(team => snapshot.state.units.filter(unit => unit.team === team).reduce((n, unit) => n + unit.cargo, 0)),
    suppliedFood: [...suppliedFood], spentWood: [...spentWood], lostCrop: [...lostCrop] });
  console.log(JSON.stringify({ stage, conserved: true }));
}
async function reconnect() {
  await fixture.start(); clients = [await fixture.connect(0, tokens[0]), await fixture.connect(1, tokens[1])];
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint));
}
async function stop() {
  for (const team of [0, 1]) await command(team, { type: 'stop', ids: workers[team] }, /STOP ORDER/);
  return fixture.checkpoint(snapshot => workers.flat().every(id => snapshot.state.units[id].gatherPhase === ''
    && snapshot.state.units[id].buildingTargetId === null));
}
async function build(team, type, ids, z = 8.5) {
  await command(team, { type: 'build', buildingType: type, ids, x: (team ? 1 : -1) * (type === 'mill' ? 16.5 : 10.5), z }, /PLACED · WORKERS BUILDING/);
  spentWood[team] += B[type].cost.wood;
}

try {
  await fixture.start(); clients = [await fixture.connect(0), await fixture.connect(1)];
  tokens = clients.map(client => client.welcome.player.sessionToken);
  clients[0].send({ type: 'publishMap', map });
  await Promise.all(clients.map(client => client.wait(message => message.type === 'mapChange' && message.map.id === map.id)));
  workers = clients.map((client, team) => client.latest.units.filter(unit => unit[1] === team && unit[5] === 'worker').map(unit => unit[0]));
  for (const team of [0, 1]) await build(team, 'mill', workers[team]);
  await fixture.checkpoint(snapshot => snapshot.state.buildings.filter(building => building.type === 'mill').every(building => building.complete)
    && snapshot.state.buildings.length === 2);
  // Re-pin a real, paid Farm-free save to the exact preceding Skiff roster.
  await fixture.stop(); const prior = await saved();
  prior.rulesetRevision = 'v1:b82d5b9fdd687e98dd47b8390aaaa04f7bc00df9dc6ac16273f8c04235cbeb54';
  await writeFile(fixture.checkpointPath, JSON.stringify(prior)); await reconnect();
  const migrated = await fixture.checkpoint(snapshot => snapshot.sequence > prior.sequence);
  assert.equal(migrated.matchId, prior.matchId); assert.deepEqual(migrated.state.teamWood, prior.state.teamWood);
  record('prior-Skiff-pin-preserved', migrated);
  for (const team of [0, 1]) await build(team, 'farm', [workers[team][0]]);
  const foundation = await fixture.checkpoint(snapshot => farms(snapshot).length === 2 && farms(snapshot).every(building => !building.complete));
  assert.ok(farms(foundation).every(building => building.harvestStock === 0)); record('paid-unfinished', foundation);
  const originalIds = [0, 1].map(team => ownFarm(foundation, team).id);
  for (const team of [0, 1]) await command(team, { type: 'gather', ids: [workers[team][1]], nodeId: farmHarvestNodeId(originalIds[team]) }, /NODE NOT FOUND/);
  await fixture.stop(); const unfinished = await saved(); await reconnect();
  assert.equal(clients[0].welcome.matchId, unfinished.matchId);
  for (const team of [0, 1]) await command(team, { type: 'build', buildingId: originalIds[team], ids: workers[team] }, /CONSTRUCTION RESUMED/);
  const complete = await fixture.checkpoint(snapshot => farms(snapshot).length === 2 && farms(snapshot).every(building => building.complete));
  suppliedFood.fill(B.farm.harvest.stock); record('completed-after-recovery', complete);
  for (const team of [0, 1]) {
    const state = await clients[team].state(state => state.buildings.some(building =>
      building.id === originalIds[team] && building.complete), 'completed owned Farm observation');
    const observation = toOpponentObservation(state, team, map);
    assert.deepEqual(observation.resourceNodes.map(node => node.id), [farmHarvestNodeId(originalIds[team])]);
    const gather = createDeterministicPolicy(19).next(observation).find(order =>
      order.type === 'gather' && order.nodeId === farmHarvestNodeId(originalIds[team]));
    assert.ok(gather, 'real owned Farm remains harvestable in deterministic observation, including fog');
  }
  for (const team of [0, 1]) {
    await command(team, { type: 'gather', ids: [workers[team][0]], nodeId: farmHarvestNodeId(originalIds[1 - team]) }, /FARM BELONGS TO THE OTHER TEAM/);
    await command(1 - team, { type: 'cancelConstruction', buildingId: originalIds[team] }, /CANCEL REJECTED/);
    await command(team, { type: 'cancelConstruction', buildingId: originalIds[team] }, /CANCEL REJECTED/);
    await command(team, { type: 'gather', ids: workers[team].slice(0, 2), nodeId: farmHarvestNodeId(originalIds[team]) }, /GATHER ORDER/);
  }
  await fixture.checkpoint(snapshot => workers.every(ids => ids.slice(0, 2).every(id => snapshot.state.units[id].cargo > 0)));
  const carrying = await stop(); record('stopped-real-cargo', carrying);
  await fixture.stop(); const retained = await saved();
  // The exact Farm/movement-only revision preserves real planted stock and land cargo.
  retained.rulesetRevision = 'v1:496509c24775ddfbd289faf9fbcc85dfef7d054d710c665caa9fe192c610ddcd';
  await writeFile(fixture.checkpointPath, JSON.stringify(retained)); await reconnect();
  const resumed = await fixture.checkpoint(snapshot => snapshot.sequence > retained.sequence);
  assert.deepEqual(resumed.state.units.map(unit => unit.cargo), retained.state.units.map(unit => unit.cargo));
  assert.deepEqual(farms(resumed).map(building => building.harvestStock), farms(retained).map(building => building.harvestStock));
  for (const team of [0, 1]) await command(team, { type: 'returnCargo', ids: workers[team].slice(0, 2) }, /RETURN CARGO ORDER/);
  const returned = await fixture.checkpoint(snapshot => workers.every(ids => ids.slice(0, 2).every(id => snapshot.state.units[id].cargo === 0)));
  for (const team of [0, 1]) {
    assert.ok(workers[team].slice(0, 2).every(id => returned.state.units[id].dropoffBuildingId === ownMill(returned, team).id));
    await command(team, { type: 'returnCargo', ids: workers[team].slice(0, 2) }, /RETURN CARGO REJECTED/);
    await command(team, { type: 'gather', ids: workers[team], nodeId: farmHarvestNodeId(originalIds[team]) }, /GATHER ORDER/);
  }
  const depleted = await fixture.checkpoint(snapshot => farms(snapshot).every(building => building.harvestStock === 0)
    && snapshot.state.units.every(unit => unit.cargo === 0));
  assert.ok(depleted.state.teamFood.every(food => Math.abs(food - 500) < 1e-8),
    'both seats receive only the finite 200 food, within accumulated floating-point noise');
  record('exact-finite-depletion', depleted);
  await stop(); await fixture.stop(); const exhausted = await saved(); await reconnect();
  const stillEmpty = await fixture.checkpoint(snapshot => snapshot.sequence > exhausted.sequence);
  assert.ok(farms(stillEmpty).every(building => building.harvestStock === 0));
  for (const team of [0, 1]) {
    await command(team, { type: 'gather', ids: workers[team], nodeId: farmHarvestNodeId(originalIds[team]) }, /RESOURCE NODE EMPTY/);
    await command(team, { type: 'cancelConstruction', buildingId: originalIds[team] }, /EXHAUSTED FARM CLEARED · NO REFUND/);
    await command(team, { type: 'cancelConstruction', buildingId: originalIds[team] }, /CANCEL REJECTED/);
  }
  const cleared = await fixture.checkpoint(snapshot => farms(snapshot).length === 0); record('cleared-no-refund', cleared);
  for (const team of [0, 1]) await build(team, 'farm', [workers[team][0]], -6.5);
  await fixture.checkpoint(snapshot => farms(snapshot).length === 2 && farms(snapshot).every(building => building.progress >= 0.2 && !building.complete));
  const partial = await stop();
  for (const team of [0, 1]) {
    const plot = farms(partial).find(building => building.team === team);
    await command(team, { type: 'cancelConstruction', buildingId: plot.id }, /CONSTRUCTION CANCELLED/);
    spentWood[team] -= Math.round(B.farm.cost.wood * (1 - plot.progress) * 1e6) / 1e6;
  }
  record('cancelled-partial-no-yield', await fixture.checkpoint(snapshot => farms(snapshot).length === 0));
  for (const team of [0, 1]) await build(team, 'farm', workers[team]);
  const replanted = await fixture.checkpoint(snapshot => farms(snapshot).length === 2 && farms(snapshot).every(building => building.complete));
  suppliedFood.forEach((_, team) => suppliedFood[team] += B.farm.harvest.stock);
  const newIds = [0, 1].map(team => ownFarm(replanted, team).id);
  assert.ok(newIds.every((id, team) => id > originalIds[team])); record('paid-fresh-planting', replanted);
  for (const team of [0, 1]) await command(team, { type: 'gather', ids: workers[team], nodeId: farmHarvestNodeId(originalIds[team]) }, /NODE NOT FOUND/);
  // Declare damage/attacker fixtures only; never change banks, cargo or crop stock.
  await fixture.stop(); const assault = await saved();
  const attackerIds = [0, 1].map(team => assault.state.units.find(unit => unit.team === team && unit.kind === 'infantry').id);
  for (const team of [0, 1]) {
    ownFarm(assault, team).hp = 1;
    const attacker = assault.state.units[attackerIds[1 - team]];
    Object.assign(attacker, { x: (team ? 1 : -1) * 12.5, z: 8.5,
      path: [], pathIndex: 0, moveGoalCell: -1, buildingTargetId: null });
  }
  await writeFile(fixture.checkpointPath, JSON.stringify(assault)); await reconnect();
  for (const team of [0, 1]) await command(team, { type: 'gather', ids: [workers[team][0]], nodeId: farmHarvestNodeId(newIds[team]) }, /GATHER ORDER/);
  const beforeAttack = await fixture.checkpoint(snapshot => workers.every(ids => snapshot.state.units[ids[0]].cargo > 0));
  record('real-cargo-before-destruction', beforeAttack);
  for (const team of [0, 1]) await command(1 - team, { type: 'attackBuilding', ids: [attackerIds[1 - team]], buildingId: newIds[team] }, /ATTACK/);
  const destroyed = await fixture.checkpoint(snapshot => farms(snapshot).length === 0);
  for (const team of [0, 1]) {
    const cargo = destroyed.state.units.filter(unit => unit.team === team && unit.cargoType === 'food').reduce((n, unit) => n + unit.cargo, 0);
    const priorCargo = beforeAttack.state.units.filter(unit => unit.team === team && unit.cargoType === 'food').reduce((n, unit) => n + unit.cargo, 0);
    assert.ok(destroyed.state.teamFood[team] + cargo + 1e-8 >= beforeAttack.state.teamFood[team] + priorCargo, 'destruction retains real carried food');
    lostCrop[team] = map.startingResources.food + suppliedFood[team] - destroyed.state.teamFood[team] - cargo;
    assert.ok(lostCrop[team] > 0 && lostCrop[team] <= ownFarm(beforeAttack, team).harvestStock + 1e-6);
  }
  record('destroyed-crop-cargo-retained', destroyed);
  for (const team of [0, 1]) await command(team, { type: 'stop', ids: [attackerIds[team]] }, /STOP ORDER/);
  const delivered = await fixture.checkpoint(snapshot => snapshot.state.units.every(unit => unit.cargo === 0));
  record('destroyed-source-cargo-delivered', delivered);
  await stop(); await fixture.stop(); const final = await saved(); await reconnect();
  const recovered = await fixture.checkpoint(snapshot => snapshot.sequence > final.sequence);
  assert.deepEqual(recovered.state.teamFood, final.state.teamFood); assert.equal(farms(recovered).length, 0);
  record('no-duplicate-credit-after-recovery', recovered);
  clients[0].send({ type: 'reset' });
  const reset = await fixture.checkpoint(snapshot => snapshot.state.buildings.length === 0 && snapshot.state.teamFood.every(food => food === 300));
  assert.deepEqual(reset.state.teamWood, [600, 600]); assert.equal(reset.state.resourceNodes.length, 0);
  assert.ok(reset.state.units.every(unit => unit.cargo === 0 && unit.gatherNodeId === null));
  const result = { evidenceType: 'authoritative-server-scenario', humanMatches: 0, sourceRevision, sourceDirty,
    rulesetRevision: GAMEPLAY_RULESET_REVISION, farmDefinition: B.farm, map, records,
    paidConstruction: true, ownerOnlyHarvest: true, unfinishedAndStockRecovery: true,
    priorContentPinPreserved: true, retainedCargoToMill: true, exactFiniteDepletion: true, paidReplanting: true,
    foggedOwnedFarmPolicy: fogged,
    cancelledPlantingCreatesNoStock: true, destroyedStockLostAndCargoRetained: true,
    noDuplicateCreditAfterRecovery: true, hostReset: true, banksCargoStockInjected: false,
    declaredFixtures: ['Farm HP lowered and two existing initial Infantry positioned for a real destruction order.'],
    visualQA: 'not captured' };
  if (output) await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ stage: 'passed', sourceRevision, sourceDirty, records: records.length, output }));
} finally { await fixture.dispose(); }
