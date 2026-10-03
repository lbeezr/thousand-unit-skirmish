import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { createWaterUnitRuntime, waterUnitOccupiedCells } from '../src/water-unit-runtime.mjs';
import { createSkiffFishingContext } from '../src/skiff-fishing.mjs';
import { waterRaster } from '../src/water-contours.mjs';

const map = { id: 'selected-skiff-groups', name: 'Selected Skiff groups', width: 64, height: 64,
  terrainSeed: 19, fogOfWar: false, startingArmySize: 24, startingResources: { food: 1000, wood: 1000 },
  spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
  obstacles: [18, 43].map(column => ({ column, row: 42, width: 8, height: 10, material: 'water' })),
  resourceNodes: [0, 1].map(team => ({ id: `fish-${team}`, type: 'food', resourceVariant: 'shore-fish',
    x: team ? 17.5 : -7.5, z: 9.5, stock: 31 })), triggers: [], scenarioEvents: [] };
const water = createWaterUnitRuntime(map), fishing = createSkiffFishingContext(map, water), wet = waterRaster(map);
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 90_000 });
let clients, tokens, workers, selected, unselected, order = 100;
const command = async (team, value, expression) => {
  if (value.type !== 'returnCargo') return clients[team].command({ ...value, clientOrderToken: order++ }, expression);
  const notice = await clients[team].command({ ...value, clientOrderToken: order++ }, /.*/);
  assert.match(notice.message, expression, `${value.type} seat ${team}`);
  return notice;
};
const saved = async () => JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
const boats = snapshot => snapshot.state.units.filter(unit => unit.kind === 'skiff' && unit.hp > 0);
const ownBoats = (snapshot, team) => boats(snapshot).filter(unit => unit.team === team);
const nodeStock = (snapshot, team) => snapshot.state.resourceNodes.find(node => node.id === `fish-${team}`).stock;
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function safe(snapshot) {
  const occupied = new Set(), nodes = new Map(map.resourceNodes.map(node => [node.id, node]));
  for (const unit of snapshot.state.units.filter(unit => unit.hp > 0)) {
    if (unit.kind !== 'skiff') { assert.ok(!wet[water.graph.cellAt(unit.x, unit.z)]); continue; }
    assert.ok(water.validRoute(unit)); assert.ok(fishing.validState(unit, nodes, snapshot.state.buildings));
    for (const cell of waterUnitOccupiedCells(water.graph, unit)) { assert.ok(!occupied.has(cell)); occupied.add(cell); }
  }
  for (const team of [0, 1]) close(nodeStock(snapshot, team) + snapshot.state.teamFood[team] - 1000
    + ownBoats(snapshot, team).reduce((sum, unit) => sum + unit.cargo, 0), 31);
}
const identity = unit => ({ id: unit.id, generation: unit.generation, team: unit.team, x: unit.x, z: unit.z,
  cargo: unit.cargo, cargoType: unit.cargoType, gatherNodeId: unit.gatherNodeId, gatherPhase: unit.gatherPhase,
  path: unit.path, pathIndex: unit.pathIndex, moveGoalCell: unit.moveGoalCell, orderRevision: unit.orderRevision });
let unselectedBefore;
function exactUnselected(snapshot) {
  for (const team of [0, 1]) assert.deepEqual(identity(snapshot.state.units[unselected[team]]), unselectedBefore[team]);
}
async function reconnect() {
  await fixture.start(); clients = [await fixture.connect(0, tokens[0]), await fixture.connect(1, tokens[1])];
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint));
}
try {
  await fixture.start(); clients = [await fixture.connect(0), await fixture.connect(1)];
  tokens = clients.map(client => client.welcome.player.sessionToken);
  clients[0].send({ type: 'publishMap', map });
  await Promise.all(clients.map(client => client.wait(message => message.type === 'mapChange' && message.map.id === map.id)));
  workers = clients.map((client, team) => client.latest.units.filter(unit => unit[1] === team && unit[5] === 'worker').map(unit => unit[0]));
  for (const team of [0, 1]) await command(team, { type: 'build', buildingType: 'dock', ids: workers[team], x: team ? 12.5 : -12.5, z: 8.5 }, /DOCK PLACED/);
  const built = await fixture.checkpoint(snapshot => snapshot.state.buildings.length === 2 && snapshot.state.buildings.every(building => building.complete));
  const dockIds = [0, 1].map(team => built.state.buildings.find(building => building.team === team).id);
  for (const team of [0, 1]) for (let i = 0; i < 3; i++) await command(team, { type: 'trainUnit', buildingId: dockIds[team], kind: 'skiff' }, /QUEUED/);
  selected = [[], []];
  for (let index = 0; index < 2; index++) {
    const spawned = await fixture.checkpoint(snapshot => [0, 1].every(team => ownBoats(snapshot, team).length === index + 1));
    for (const team of [0, 1]) {
      const unit = ownBoats(spawned, team).find(unit => !selected[team].includes(unit.id)); selected[team].push(unit.id);
      const point = water.graph.pointAt(49 * 64 + (team ? 44 : 19) + index);
      await command(team, { type: 'move', ids: [unit.id], x: point.x, z: point.z }, /SKIFF WATER ROUTE/);
    }
    try {
      await fixture.checkpoint(snapshot => [0, 1].every(team => snapshot.state.units[selected[team][index]].path.length === 0
        && Math.abs(snapshot.state.units[selected[team][index]].z - 17.5) < 1e-7));
    } catch (error) {
      const snapshot = await saved();
      console.error(JSON.stringify({ stage: 'production-berth-clearing', index, units: boats(snapshot).map(unit => ({ ...identity(unit), blocked: unit.waterMoveBlocked })) }));
      throw error;
    }
  }
  const ready = await fixture.checkpoint(snapshot => [0, 1].every(team => ownBoats(snapshot, team).length === 3)); safe(ready);
  unselected = [0, 1].map(team => ownBoats(ready, team).find(unit => !selected[team].includes(unit.id)).id);
  unselectedBefore = unselected.map(id => identity(ready.state.units[id]));
  assert.deepEqual(ready.state.teamWood, [675, 675]);
  for (const team of [0, 1]) {
    await command(team, { type: 'move', ids: selected[team], unitGenerations: [0, 0], x: team ? 16.5 : -8.5, z: 15.5 }, /NO VALID UNITS/);
    await command(team, { type: 'move', ids: [...selected[team], workers[team][0]], x: team ? 16.5 : -8.5, z: 15.5 }, /SELECT ONLY SKIFFS/);
    await command(team, { type: 'move', ids: selected[team], x: team ? -8.5 : 16.5, z: 15.5 }, /DISCONNECTED/);
    await command(team, { type: 'move', ids: [...selected[team]].reverse(), x: team ? 16.5 : -8.5, z: 15.5 }, /2 SKIFF WATER ROUTES/);
  }
  await fixture.stop(); const moving = await saved(); safe(moving); exactUnselected(moving);
  const destinations = selected.map(ids => ids.map(id => moving.state.units[id].moveGoalCell));
  assert.ok(destinations.every(goals => goals.every(cell => cell >= 0) && new Set(goals).size === 2)); await reconnect();
  const arrived = await fixture.checkpoint(snapshot => selected.flat().every(id => snapshot.state.units[id].path.length === 0)); safe(arrived); exactUnselected(arrived);
  for (const team of [0, 1]) for (let i = 0; i < 2; i++) {
    const unit = arrived.state.units[selected[team][i]];
    const point = water.graph.pointAt(destinations[team][i]); close(unit.x, point.x); close(unit.z, point.z);
  }
  for (const team of [0, 1]) {
    await command(team, { type: 'gather', ids: [...selected[team], unselected[team]], nodeId: `fish-${team}` }, /NEED DISTINCT REACHABLE/);
    await command(team, { type: 'gather', ids: selected[team], nodeId: `fish-${team}`, queue: true }, /QUEUED FISHING IS UNAVAILABLE/);
    // Duplicates and a foreign supplied ID cannot recruit an unselected boat.
    await command(team, { type: 'gather', ids: [...selected[team], selected[team][0], unselected[1 - team]], nodeId: `fish-${team}` }, /2 SKIFFS/);
  }
  await fixture.checkpoint(snapshot => selected.flat().every(id => snapshot.state.units[id].cargo >= .1));
  for (const team of [0, 1]) await command(team, { type: 'move', ids: selected[team], x: team ? 16.5 : -8.5, z: 15.5, queue: true }, /FINISH-OR-STOP-FISHING-FIRST/);
  for (const team of [0, 1]) await command(team, { type: 'stop', ids: selected[team] }, /STOP ORDER/);
  await fixture.stop(); const stopped = await saved(); safe(stopped); exactUnselected(stopped);
  const loads = selected.map(ids => ids.map(id => stopped.state.units[id].cargo)); await reconnect();
  const idle = await fixture.checkpoint(snapshot => snapshot.state.tickNumber > stopped.state.tickNumber + 5); safe(idle);
  for (const team of [0, 1]) {
    assert.deepEqual(selected[team].map(id => idle.state.units[id].cargo), loads[team]); assert.equal(nodeStock(idle, team), nodeStock(stopped, team));
    await command(team, { type: 'returnCargo', ids: selected[team] }, /2 SKIFFS TO OWNED DOCK/);
  }
  await fixture.stop(); const returning = await saved(); safe(returning); exactUnselected(returning);
  for (const ids of selected) assert.equal(new Set(ids.map(id => returning.state.units[id].moveGoalCell)).size, 2);
  await reconnect();
  const delivered = await fixture.checkpoint(snapshot => selected.flat().every(id => snapshot.state.units[id].cargo === 0 && snapshot.state.units[id].gatherPhase === ''));
  safe(delivered); exactUnselected(delivered);
  for (const team of [0, 1]) { close(delivered.state.teamFood[team], 1000 + loads[team].reduce((sum, load) => sum + load, 0)); assert.equal(nodeStock(delivered, team), nodeStock(stopped, team)); }
  for (const team of [0, 1]) await command(team, { type: 'gather', ids: selected[team], nodeId: `fish-${team}` }, /2 SKIFFS/);
  await fixture.checkpoint(snapshot => selected.flat().some(id => snapshot.state.units[id].cargo === 10 && snapshot.state.units[id].gatherPhase === 'to-base'));
  await fixture.stop(); const automatic = await saved(); safe(automatic); exactUnselected(automatic); await reconnect();
  let exhausted;
  try {
    exhausted = await fixture.checkpoint(snapshot => [0, 1].every(team => nodeStock(snapshot, team) === 0)
      && selected.flat().every(id => snapshot.state.units[id].cargo === 0 && snapshot.state.units[id].gatherPhase === ''));
  } catch (error) {
    const snapshot = await saved();
    console.error(JSON.stringify({ stage: 'automatic-fishing-depletion', food: snapshot.state.teamFood,
      stock: [0, 1].map(team => nodeStock(snapshot, team)), units: boats(snapshot).map(unit => ({ ...identity(unit),
        blocked: unit.waterMoveBlocked, retry: unit.repathTimer, dropoffBuildingId: unit.dropoffBuildingId })) }));
    throw error;
  }
  safe(exhausted); exactUnselected(exhausted); assert.deepEqual(exhausted.state.teamFood, [1031, 1031]); assert.deepEqual(exhausted.state.teamWood, [675, 675]);
  await fixture.stop(); const depleted = await saved(); await reconnect();
  const recovered = await fixture.checkpoint(snapshot => snapshot.state.tickNumber > depleted.state.tickNumber + 5); safe(recovered); exactUnselected(recovered);
  assert.deepEqual(recovered.state.teamFood, [1031, 1031]);
  console.log(JSON.stringify({ scenario: 'Both-seat exact selected Skiff groups', selectedBoatsPerSeat: 2, untouchedBoatsPerSeat: 1,
    distinctMoveFishAndDockDestinations: true, staleForeignMixedAndQueueRejections: true,
    perBoatMoveStopReturnAndAutomaticRecovery: true, finiteSharedFoodConserved: true, finalFood: [1031, 1031], finalWood: [675, 675],
    boundaries: 'up to16 selected Skiffs; atomic capacity rejection; unqueued-order proof; water waypoints tested separately; no passengers, weapons or final art' }));
} finally { await fixture.dispose(); }
