import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';

// Real commands and checkpoint recovery; no injected economy or unit positions.
const map = JSON.parse(await readFile(new URL('../maps/open-field.json', import.meta.url)));
Object.assign(map, { id: 'wildlife-food-proof', name: 'WILDLIFE FOOD PROOF', startingArmySize: 8,
  startingResources: { food: 0, wood: 0 }, scenarioEvents: [],
  resourceNodes: [
    { id: 'azure-sheep', type: 'food', x: -15, z: 6, stock: 22.5 },
    { id: 'ember-sheep', type: 'food', x: 15, z: 6, stock: 3.5 },
    { id: 'shared-sheep', type: 'food', x: 0, z: 6, stock: 8.25 },
    { id: 'living-sheep', type: 'food', x: -15, z: -6, stock: 100 },
    { id: 'hidden-sheep', type: 'food', x: 0, z: 14, stock: 2 },
  ].map(node => ({ ...node, wildlifeSpecies: 'bellweather-sheep' })),
});
const initialStock = map.resourceNodes.reduce((total, node) => total + node.stock, 0);
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 40_000 });
let orderToken = 100;
const recordNode = (snapshot, id) => snapshot.state.resourceNodes.find(node => node.id === id);
function assertConserved(snapshot) {
  const stock = snapshot.state.resourceNodes.reduce((total, node) => total + node.stock, 0);
  const bank = snapshot.state.teamFood.reduce((total, food) => total + food, 0);
  const cargo = snapshot.state.units.filter(unit => unit.cargoType === 'food').reduce((total, unit) => total + unit.cargo, 0);
  assert.ok(Math.abs(initialStock - stock - bank - cargo) < 0.000001,
    'one authored food pool equals remaining stock plus both banks and carried cargo');
}
async function command(client, value, expression) {
  return client.command({ ...value, clientOrderToken: orderToken++ }, expression);
}
async function publish(client, value, accepted) {
  const after = client.messages.length;
  client.send({ type: 'publishMap', map: value, persist: true });
  return client.wait(message => message.type === (accepted ? 'mapPublished' : 'mapRejected'), 'map validation', after);
}

try {
  await fixture.start();
  let clients = [await fixture.connect(0), await fixture.connect(1)];
  const tokens = clients.map(client => client.welcome.player.sessionToken);
  for (const change of [{ type: 'wood' }, { wildlifeSpecies: 'deer' }, { wildlifeState: 'carcass' }]) {
    const invalid = structuredClone(map);
    Object.assign(invalid.resourceNodes[0], change);
    assert.match((await publish(clients[0], invalid, false)).message, /invalid.*resource node/);
    assert.equal(clients[0].latest.mapId, 'open-field', 'rejected map preserves the running match');
  }
  await publish(clients[0], map, true);
  await clients[1].wait(message => message.type === 'mapChange' && message.map.id === map.id);
  const starting = await fixture.checkpoint(snapshot => snapshot.mapDefinition.id === map.id);
  assertConserved(starting);
  assert.ok(starting.state.resourceNodes.every(node => node.wildlifeState === 'alive'));
  assert.ok(clients.every(client => !client.latest.resourceNodes.some(node => node.id === 'hidden-sheep')),
    'hidden wildlife lifecycle is omitted from both seat snapshots');
  const workers = clients.map((client, team) => client.latest.units.filter(unit => unit[1] === team && unit[5] === 'worker').map(unit => unit[0]));
  await command(clients[0], { type: 'gather', ids: [workers[0][0]], nodeId: 'hidden-sheep' }, /WILDLIFE NOT VISIBLE/);
  await command(clients[0], { type: 'gather', ids: [workers[1][0]], nodeId: 'azure-sheep' }, /NO REACHABLE WORKERS/);
  await command(clients[0], { type: 'gather', ids: [], nodeId: 'living-sheep' }, /NO REACHABLE WORKERS/);
  const rejected = await fixture.checkpoint(snapshot => snapshot.sequence > starting.sequence);
  assert.ok(rejected.state.resourceNodes.every(node => node.wildlifeState === 'alive'));
  assertConserved(rejected);
  for (const [team, id] of ['azure-sheep', 'ember-sheep'].entries()) {
    await command(clients[team], { type: 'gather', ids: [workers[team][0]], nodeId: id }, /GATHER ORDER/);
    await command(clients[team], { type: 'gather', ids: [workers[team][0]], nodeId: id }, /GATHER ORDER/);
  }
  const carrying = await fixture.checkpoint(snapshot => {
    const node = recordNode(snapshot, 'azure-sheep');
    return node.wildlifeState === 'carcass' && node.stock > 0 && node.stock < 22.5
      && snapshot.state.units.some(unit => unit.cargo > 0);
  });
  assertConserved(carrying);
  const duplicateCredit = structuredClone(carrying); duplicateCredit.state.teamFood[0] += 1;
  assert.throws(() => assertConserved(duplicateCredit), /one authored food pool/);
  const lostCargo = structuredClone(carrying); lostCargo.state.units.find(unit => unit.cargo > 0).cargo = 0;
  assert.throws(() => assertConserved(lostCargo), /one authored food pool/);
  await fixture.stop();
  const saved = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
  assertConserved(saved);
  await fixture.start();
  clients = [await fixture.connect(0, tokens[0]), await fixture.connect(1, tokens[1])];
  for (const client of clients) {
    assert.equal(client.welcome.recoveredFromCheckpoint, true);
    assert.equal(client.welcome.matchId, saved.matchId);
    assert.ok(client.latest.tick >= saved.state.tickNumber);
  }
  const restored = await fixture.checkpoint(snapshot => snapshot.sequence > saved.sequence);
  assertConserved(restored);
  assert.equal(recordNode(restored, 'azure-sheep').wildlifeState, 'carcass');
  assert.ok(recordNode(restored, 'azure-sheep').stock <= recordNode(saved, 'azure-sheep').stock);
  assert.equal(recordNode(restored, 'living-sheep').wildlifeState, 'alive');

  // Seat 0 starts a shared carcass, interrupts gathering, and leaves it for seat 1.
  await command(clients[0], { type: 'move', ids: [workers[0][1]], x: -1.5, z: 6 }, /MOVE ORDER/);
  await clients[0].state(state => state.resourceNodes.some(node => node.id === 'shared-sheep'), 'shared sheep revealed');
  await command(clients[0], { type: 'gather', ids: [workers[0][1]], nodeId: 'shared-sheep' }, /GATHER ORDER/);
  const shared = await fixture.checkpoint(snapshot => recordNode(snapshot, 'shared-sheep').stock < 8.25);
  assertConserved(shared);
  await command(clients[0], { type: 'stop', ids: [workers[0][1]] }, /STOP ORDER/);
  await command(clients[0], { type: 'move', ids: [workers[0][1]], x: -10, z: 10 }, /MOVE ORDER/);
  await clients[0].state(state => {
    const worker = state.units.find(unit => unit[0] === workers[0][1]);
    return worker && worker[2] < -8;
  }, 'first gatherer leaves shared carcass');
  // Return the interrupted Worker's existing cargo without creating another pool.
  await command(clients[0], { type: 'gather', ids: [workers[0][1]], nodeId: 'azure-sheep' }, /GATHER ORDER/);
  await command(clients[1], { type: 'move', ids: [workers[1][1]], x: 1.5, z: 6 }, /MOVE ORDER/);
  await clients[1].state(state => state.resourceNodes.some(node => node.id === 'shared-sheep'), 'opponent sees shared carcass');
  await command(clients[1], { type: 'gather', ids: [workers[1][1]], nodeId: 'shared-sheep' }, /GATHER ORDER/);
  const depleted = await fixture.checkpoint(snapshot => ['azure-sheep', 'ember-sheep', 'shared-sheep']
    .every(id => recordNode(snapshot, id).wildlifeState === 'depleted')
    && snapshot.state.units.every(unit => unit.cargo === 0));
  assertConserved(depleted);
  assert.ok(depleted.state.teamFood.every(food => food > 0), 'both seats deposit sheep food through existing drop-offs');
  assert.ok(Math.abs(depleted.state.teamFood[0] + depleted.state.teamFood[1] - 34.25) < 0.000001);
  assert.equal(recordNode(depleted, 'living-sheep').stock, 100);
  assert.equal(recordNode(depleted, 'hidden-sheep').stock, 2);
  await command(clients[0], { type: 'gather', ids: [workers[0][0]], nodeId: 'azure-sheep' }, /RESOURCE NODE EMPTY/);
  await fixture.stop(); await fixture.start();
  clients = [await fixture.connect(0, tokens[0]), await fixture.connect(1, tokens[1])];
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint));
  const exhaustedRecovery = await fixture.checkpoint(snapshot => snapshot.sequence > depleted.sequence);
  assertConserved(exhaustedRecovery);
  for (const id of ['azure-sheep', 'ember-sheep', 'shared-sheep']) {
    assert.equal(recordNode(exhaustedRecovery, id).wildlifeState, 'depleted');
    assert.equal(recordNode(exhaustedRecovery, id).stock, 0);
  }
  const resetTick = clients[0].latest.tick;
  clients[0].send({ type: 'reset' });
  await Promise.all(clients.map((client, team) => client.state(state => state.food[team] === 0
    && state.resourceNodes.every(node => node.wildlifeState === 'alive'), `seat ${team} rematch resets economy`)));
  assert.deepEqual(clients[0].latest.food, [0, null]);
  assert.deepEqual(clients[1].latest.food, [null, 0]);
  const rematch = await fixture.checkpoint(snapshot => snapshot.state.tickNumber >= resetTick && snapshot.sequence > exhaustedRecovery.sequence
    && snapshot.state.resourceNodes.every(node => node.wildlifeState === 'alive'));
  assertConserved(rematch);
  assert.equal(rematch.state.resourceNodes.reduce((total, node) => total + node.stock, 0), initialStock);

  // A contradictory persisted lifecycle must be rejected by the full worker.
  await fixture.stop();
  const invalid = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
  recordNode(invalid, 'living-sheep').wildlifeState = 'depleted';
  await writeFile(fixture.checkpointPath, JSON.stringify(invalid));
  await fixture.start();
  const fresh = await fixture.connect(0);
  assert.equal(fresh.welcome.recoveredFromCheckpoint, false);
  assert.notEqual(fresh.welcome.matchId, invalid.matchId);
  assert.ok((await readdir(fixture.directory)).some(name => name.startsWith('match.json.rejected-')));
  console.log(JSON.stringify({ scenario: 'neutral sheep food foundation', bothSeatGathering: true,
    hiddenAndForeignWorkerOrdersRejected: true, sharedCarcassAfterInterruption: true,
    soleStockPoolConserved: true, duplicateCreditAndLostCargoControls: true,
    carcassCargoAndLiveCheckpointRecovery: true, depletionRecovery: true, rematchRestoresLiveStock: true,
    contradictoryCheckpointRejected: true, deliveredFood: depleted.state.teamFood, initialStock }));
} finally { await fixture.dispose(); }
