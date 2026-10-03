import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';

const mill = BUILDING_DEFINITIONS.mill;
const map = { id: 'mill-food-proof', name: 'Mill food-only proof', width: 64, height: 64,
  terrainSeed: 19, fogOfWar: false, startingArmySize: 24,
  startingResources: { food: 1000, wood: 1000 },
  spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }], obstacles: [],
  resourceNodes: [0, 1].flatMap(team => ['food', 'wood'].map(type => ({
    id: `${type}-${team}`, type, x: team ? 8.5 : -8.5, z: type === 'food' ? 8.5 : 12.5, stock: 1000,
  }))), triggers: [], scenarioEvents: [] };
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 45_000 });
let clients, tokens, workers, orderToken = 100;
const command = (team, value, result) => clients[team].command({ ...value, clientOrderToken: orderToken++ }, result);
const mills = snapshot => snapshot.state.buildings.filter(building => building.type === 'mill');
const byTeam = (snapshot, team) => mills(snapshot).find(building => building.team === team);
async function saved() { return JSON.parse(await readFile(fixture.checkpointPath, 'utf8')); }
async function reconnect() {
  await fixture.start();
  clients = [await fixture.connect(0, tokens[0]), await fixture.connect(1, tokens[1])];
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint));
}
async function stopWorkers() {
  for (const team of [0, 1]) await command(team, { type: 'stop', ids: workers[team] }, /STOP ORDER/);
  return fixture.checkpoint(snapshot => workers.flat().every(id => snapshot.state.units[id].gatherPhase === ''
    && snapshot.state.units[id].buildingTargetId === null));
}
function conserved(snapshot) {
  for (const type of ['food', 'wood']) {
    const bank = snapshot.state[type === 'food' ? 'teamFood' : 'teamWood'].reduce((sum, amount) => sum + amount, 0);
    const cargo = snapshot.state.units.filter(unit => unit.cargoType === type).reduce((sum, unit) => sum + unit.cargo, 0);
    const stock = snapshot.state.resourceNodes.filter(node => node.type === type).reduce((sum, node) => sum + node.stock, 0);
    const budget = 4000 - (type === 'wood' ? mill.cost.wood * 2 : 0);
    assert.ok(Math.abs(bank + cargo + stock - budget) < 1e-6, `${type} stock, cargo and paid bank reconcile`);
  }
}
async function returnStoppedCargo(type, workerIndex, destinations) {
  for (const team of [0, 1]) await command(team, { type: 'gather', ids: [workers[team][workerIndex]],
    nodeId: `${type}-${team}` }, /GATHER ORDER/);
  await fixture.checkpoint(snapshot => workers.every(ids => snapshot.state.units[ids[workerIndex]].cargoType === type
    && snapshot.state.units[ids[workerIndex]].cargo > 0));
  const stopped = await stopWorkers(); conserved(stopped);
  const bankName = type === 'food' ? 'teamFood' : 'teamWood';
  const carried = workers.map(ids => stopped.state.units[ids[workerIndex]].cargo);
  for (const team of [0, 1]) {
    await command(1 - team, { type: 'returnCargo', ids: [workers[team][workerIndex]] }, /RETURN CARGO REJECTED/);
    await command(team, { type: 'returnCargo', ids: [workers[team][workerIndex]] }, /RETURN CARGO ORDER/);
  }
  const delivered = await fixture.checkpoint(snapshot => workers.every((ids, team) => {
    const unit = snapshot.state.units[ids[workerIndex]];
    return unit.cargo === 0 && snapshot.state[bankName][team] === stopped.state[bankName][team] + carried[team];
  }));
  conserved(delivered);
  for (const [team, ids] of workers.entries()) {
    const unit = delivered.state.units[ids[workerIndex]];
    assert.equal(unit.dropoffBuildingId, destinations[team]);
    assert.equal(unit.gatherNodeId, null); assert.equal(unit.gatherForestCell, -1);
    assert.equal(unit.gatherPhase, '', 'explicit return stops after depositing');
    await command(team, { type: 'returnCargo', ids: [ids[workerIndex]] }, /RETURN CARGO REJECTED/);
  }
  assert.deepEqual(delivered.state.resourceNodes.map(node => node.stock), stopped.state.resourceNodes.map(node => node.stock),
    'returning retained cargo never gathers from or revives a source');
}

try {
  await fixture.start();
  clients = [await fixture.connect(0), await fixture.connect(1)];
  tokens = clients.map(client => client.welcome.player.sessionToken);
  clients[0].send({ type: 'publishMap', map });
  await Promise.all(clients.map(client => client.wait(message => message.type === 'mapChange' && message.map.id === map.id)));
  workers = clients.map((client, team) => client.latest.units.filter(unit => unit[1] === team && unit[5] === 'worker').map(unit => unit[0]));
  await command(0, { type: 'build', buildingType: 'mill', ids: workers[1], x: -12.5, z: 8.5 }, /SELECT A WORKER/);
  for (const team of [0, 1]) await command(team, { type: 'build', buildingType: 'mill', ids: workers[team],
    x: team ? 12.5 : -12.5, z: 8.5 }, /MILL PLACED/);
  const foundations = await fixture.checkpoint(snapshot => mills(snapshot).length === 2);
  assert.deepEqual(foundations.state.teamWood, [1000 - mill.cost.wood, 1000 - mill.cost.wood]);
  assert.deepEqual(foundations.state.teamFood, [1000, 1000]);
  assert.ok(mills(foundations).every(building => !building.complete));
  await command(1, { type: 'cancelConstruction', buildingId: byTeam(foundations, 0).id }, /CANCEL REJECTED/);
  await command(1, { type: 'build', buildingId: byTeam(foundations, 0).id, ids: workers[1] }, /SELECT YOUR BUILDING/);
  await fixture.stop();
  const unfinished = await saved();
  assert.ok(mills(unfinished).every(building => !building.complete), 'real paid construction remains unfinished at restart');
  await reconnect();
  assert.ok(clients.every(client => client.welcome.matchId === unfinished.matchId));
  const complete = await fixture.checkpoint(snapshot => mills(snapshot).length === 2 && mills(snapshot).every(building => building.complete));
  assert.deepEqual(complete.state.teamWood, [925, 925], 'recovery never repays construction');
  assert.ok(mills(complete).every(building => building.hp === mill.maxHp && building.productionQueue.length === 0));

  for (const team of [0, 1]) await command(team, { type: 'gather', ids: [workers[team][0]], nodeId: `food-${team}` }, /GATHER ORDER/);
  const foodRoutes = await fixture.checkpoint(snapshot => workers.every((ids, team) => snapshot.state.units[ids[0]].dropoffBuildingId === byTeam(snapshot, team).id));
  conserved(foodRoutes);
  await fixture.checkpoint(snapshot => snapshot.state.teamFood.every(food => food >= 1010));
  conserved(await stopWorkers());
  await returnStoppedCargo('food', 0, [byTeam(complete, 0).id, byTeam(complete, 1).id]);
  const homeIds = clients.map((client, team) => client.latest.homeTownCenters.find(center => center.team === team).id);
  for (const team of [0, 1]) await command(team, { type: 'gather', ids: [workers[team][1]], nodeId: `wood-${team}` }, /GATHER ORDER/);
  const woodRoutes = await fixture.checkpoint(snapshot => workers.every((ids, team) => snapshot.state.units[ids[1]].dropoffBuildingId === homeIds[team]));
  conserved(woodRoutes);
  await fixture.checkpoint(snapshot => snapshot.state.teamWood.every(wood => wood >= 935));
  conserved(await stopWorkers());
  await returnStoppedCargo('wood', 1, homeIds);

  // Damage is a declared checkpoint fixture; construction, gathering and bank credits above are real commands.
  await fixture.stop();
  let checkpoint = await saved();
  for (const building of mills(checkpoint)) building.hp = mill.maxHp / 2;
  await writeFile(fixture.checkpointPath, JSON.stringify(checkpoint)); await reconnect();
  const repairBank = [...checkpoint.state.teamWood];
  for (const team of [0, 1]) {
    await command(1 - team, { type: 'repairBuilding', buildingId: byTeam(checkpoint, team).id, ids: workers[1 - team] }, /REPAIR REJECTED/);
    await command(team, { type: 'repairBuilding', buildingId: byTeam(checkpoint, team).id, ids: workers[team] }, /REPAIR ORDER/);
  }
  await fixture.checkpoint(snapshot => mills(snapshot).every(building => building.hp > mill.maxHp / 2 && building.hp < mill.maxHp));
  await fixture.stop(); checkpoint = await saved();
  assert.ok(checkpoint.state.units.some(unit => unit.repairing), 'active paid repair survives restart');
  await reconnect();
  const repaired = await fixture.checkpoint(snapshot => mills(snapshot).every(building => building.hp === mill.maxHp));
  for (const team of [0, 1]) assert.ok(Math.abs(repairBank[team] - repaired.state.teamWood[team] - mill.cost.wood * 0.3 / 2) < 1e-6);
  await stopWorkers();

  const cancelBank = [...repaired.state.teamWood];
  for (const team of [0, 1]) await command(team, { type: 'build', buildingType: 'mill', ids: [workers[team][0]],
    x: team ? 16.5 : -16.5, z: -10.5 }, /MILL PLACED/);
  await fixture.checkpoint(snapshot => mills(snapshot).filter(building => !building.complete).length === 2
    && mills(snapshot).filter(building => !building.complete).every(building => building.progress >= 0.2));
  checkpoint = await stopWorkers();
  const cancelledIds = [];
  for (const team of [0, 1]) {
    const foundation = mills(checkpoint).find(building => building.team === team && !building.complete);
    cancelledIds.push(foundation.id);
    await command(1 - team, { type: 'cancelConstruction', buildingId: foundation.id }, /CANCEL REJECTED/);
    await command(team, { type: 'cancelConstruction', buildingId: foundation.id }, /CONSTRUCTION CANCELLED/);
    await command(team, { type: 'cancelConstruction', buildingId: foundation.id }, /CANCEL REJECTED/);
  }
  const cancelled = await fixture.checkpoint(snapshot => mills(snapshot).length === 2);
  for (const team of [0, 1]) {
    const foundation = mills(checkpoint).find(building => building.id === cancelledIds[team]);
    const refund = Math.round(mill.cost.wood * (1 - foundation.progress) * 1e6) / 1e6;
    assert.ok(Math.abs(cancelled.state.teamWood[team] - (cancelBank[team] - mill.cost.wood + refund)) < 1e-6,
      'only the unfinished fraction is refunded once to the owner');
  }

  for (const team of [0, 1]) await command(team, { type: 'gather', ids: [workers[team][0]], nodeId: `food-${team}` }, /GATHER ORDER/);
  await fixture.checkpoint(snapshot => workers.every(ids => snapshot.state.units[ids[0]].cargoType === 'food' && snapshot.state.units[ids[0]].cargo > 0));
  await fixture.stop(); checkpoint = await saved();
  const carriedFood = workers.map(ids => checkpoint.state.units[ids[0]].cargo);
  const beforeFood = [...checkpoint.state.teamFood];
  for (const team of [0, 1]) {
    const building = byTeam(checkpoint, team);
    building.hp = 1;
    const worker = checkpoint.state.units[workers[team][0]];
    Object.assign(worker, { gatherPhase: 'to-base', dropoffBuildingId: building.id,
      dropoffNavigationRevision: checkpoint.state.navigationRevision, buildingTargetId: null, repairing: false });
    const attacker = checkpoint.state.units.find(unit => unit.team !== team && unit.kind === 'infantry');
    Object.assign(attacker, { x: building.x - 2, z: building.z, path: [], pathIndex: 0,
      attackTargetId: -1, attackBuildingTargetId: building.id, attackCooldown: 0, movePlanningPending: false });
  }
  await writeFile(fixture.checkpointPath, JSON.stringify(checkpoint)); await reconnect();
  const destroyed = await fixture.checkpoint(snapshot => mills(snapshot).length === 0);
  for (const team of [0, 1]) {
    assert.equal(destroyed.state.units[workers[team][0]].cargo, carriedFood[team], 'destroying a Mill retains real harvested food');
    assert.equal(destroyed.state.units[workers[team][0]].dropoffBuildingId, homeIds[team]);
  }
  await fixture.checkpoint(snapshot => snapshot.state.teamFood.every((food, team) => food >= beforeFood[team] + carriedFood[team]));
  await stopWorkers(); await fixture.stop();
  const final = await saved(); await reconnect();
  assert.ok(clients.every(client => client.welcome.matchId === final.matchId));
  assert.ok(clients.every(client => client.latest.buildings.every(building => building.type !== 'mill')));
  assert.deepEqual((await fixture.checkpoint(snapshot => snapshot.sequence > final.sequence)).state.teamFood, final.state.teamFood,
    'recovery cannot credit a completed cargo deposit twice');
  console.log('Mill passed: both-seat paid/unfinished construction recovery, owner checks, real food-to-Mill and wood-to-Town-Center deposits, explicit retained food/wood Return cargo with conservation, paid repair recovery, proportional cancellation/replay rejection, destruction cargo rerouting and no duplicate recovery credit. Damage/assault positions were checkpoint fixtures; banks and cargo were never injected.');
} finally { await fixture.dispose(); }
