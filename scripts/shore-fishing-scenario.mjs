import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';

// Real host publishing, seat commands and worker restarts. No injected cargo,
// stock, banks or positions; the x/z anchors are land-side interaction points.
const map = JSON.parse(await readFile(new URL('../maps/open-field.json', import.meta.url)));
Object.assign(map, { id: 'shore-fishing-proof', name: 'SHORE FISHING PROOF', startingArmySize: 8,
  startingResources: { food: 0, wood: 0 }, scenarioEvents: [],
  resourceNodes: [
    { id: 'azure-fish', type: 'food', resourceVariant: 'shore-fish', x: -14.5, z: 6.5, stock: 22.5 },
    { id: 'ember-fish', type: 'food', resourceVariant: 'shore-fish', x: 14.5, z: 6.5, stock: 3.5 },
    { id: 'hidden-fish', type: 'food', resourceVariant: 'shore-fish', x: 0.5, z: 20.5, stock: 2 },
  ],
  obstacles: [
    { column: 16, row: 39, width: 4, height: 4, material: 'water' },
    { column: 44, row: 39, width: 4, height: 4, material: 'water' },
    { column: 32, row: 53, width: 4, height: 4, material: 'water' },
  ],
});
const initialStock = map.resourceNodes.reduce((total, node) => total + node.stock, 0);
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 45_000 });
let orderToken = 200;
const recordNode = (snapshot, id) => snapshot.state.resourceNodes.find(node => node.id === id);
function assertConserved(snapshot) {
  const stock = snapshot.state.resourceNodes.reduce((total, node) => total + node.stock, 0);
  const bank = snapshot.state.teamFood.reduce((total, food) => total + food, 0);
  const cargo = snapshot.state.units.filter(unit => unit.cargoType === 'food').reduce((total, unit) => total + unit.cargo, 0);
  assert.ok(Math.abs(initialStock - stock - bank - cargo) < 0.000001,
    'fish stock equals remaining food plus banks plus carried food');
  assert.deepEqual(snapshot.state.teamWood, [0, 0]);
  assert.ok(snapshot.state.resourceNodes.every(node => node.type === 'food' && node.wildlifeState === undefined));
  for (const unit of snapshot.state.units) {
    const column = Math.floor(unit.x + map.width / 2), row = Math.floor(unit.z + map.height / 2);
    assert.ok(!map.obstacles.some(obstacle => column >= obstacle.column && column < obstacle.column + obstacle.width
      && row >= obstacle.row && row < obstacle.row + obstacle.height), 'land Workers stay off water');
  }
}
async function command(client, value, expression) {
  return client.command({ ...value, clientOrderToken: orderToken++ }, expression);
}
async function publish(client, value, accepted) {
  const after = client.messages.length;
  client.send({ type: 'publishMap', map: value, persist: true });
  return client.wait(message => message.type === (accepted ? 'mapPublished' : 'mapRejected'), 'fish map validation', after);
}

try {
  await fixture.start();
  let clients = [await fixture.connect(0), await fixture.connect(1)];
  const tokens = clients.map(client => client.welcome.player.sessionToken);
  const schemaVersion = (await fixture.checkpoint(snapshot => snapshot.mapDefinition.id === 'open-field')).schemaVersion;
  await fixture.stop();
  const legacy = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
  legacy.schemaVersion = 20;
  delete legacy.matchModeId; delete legacy.matchModeVersion;
  delete legacy.economyProfileId; delete legacy.state.teamStone;
  await writeFile(fixture.checkpointPath, JSON.stringify(legacy));
  await fixture.start();
  clients = [await fixture.connect(0, tokens[0]), await fixture.connect(1, tokens[1])];
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint));
  await fixture.checkpoint(snapshot => snapshot.schemaVersion === schemaVersion);
  const invalidMaps = [];
  for (const change of [{ type: 'wood' }, { resourceVariant: 'ocean-fish' }, { resourceVariant: null },
    { wildlifeSpecies: 'bellweather-sheep' }, { x: -14.5, z: 7.5 }, { x: -10.5, z: 6.5 }]) {
    const invalid = structuredClone(map); Object.assign(invalid.resourceNodes[0], change); invalidMaps.push(invalid);
  }
  invalidMaps.push({ ...structuredClone(map), elevationPatches: [{ column: 17, row: 38, width: 1, height: 1, level: 1 }] });
  invalidMaps.push({ ...structuredClone(map), obstacles: [...map.obstacles,
    { column: 32, row: 0, width: 1, height: 64, material: 'stone' }].filter(obstacle => obstacle.material !== 'water' || obstacle.column !== 32),
  resourceNodes: map.resourceNodes.slice(0, 2) });
  for (const invalid of invalidMaps) {
    const rejected = await publish(clients[0], invalid, false);
    assert.match(rejected.message, /resource|shore fish/i);
    assert.equal(clients[0].latest.mapId, 'open-field', 'invalid fish map preserves running match');
  }
  await publish(clients[0], map, true);
  await clients[1].wait(message => message.type === 'mapChange' && message.map.id === map.id);
  const starting = await fixture.checkpoint(snapshot => snapshot.mapDefinition.id === map.id);
  assertConserved(starting);
  assert.equal(starting.schemaVersion, schemaVersion, 'optional identity is recorded in the checkpoint');
  assert.ok(starting.state.resourceNodes.every(node => node.resourceVariant === 'shore-fish'));
  assert.ok(starting.mapDefinition.resourceNodes.every(node => node.resourceVariant === 'shore-fish'));
  assert.ok(clients.every(client => !client.latest.resourceNodes.some(node => node.id === 'hidden-fish')));
  const workers = clients.map((client, team) => client.latest.units.filter(unit => unit[1] === team && unit[5] === 'worker').map(unit => unit[0]));
  await command(clients[0], { type: 'gather', ids: [workers[0][0]], nodeId: 'hidden-fish' }, /RESOURCE NODE NOT VISIBLE/);
  await command(clients[0], { type: 'gather', ids: [workers[1][0]], nodeId: 'azure-fish' }, /NO REACHABLE WORKERS/);
  for (const [team, id] of ['azure-fish', 'ember-fish'].entries()) {
    const visible = clients[team].latest.resourceNodes.find(node => node.id === id);
    assert.equal(visible.resourceVariant, 'shore-fish', 'filtered state carries fish identity');
    await command(clients[team], { type: 'gather', ids: [workers[team][0]], nodeId: id }, /GATHER ORDER/);
  }
  const carrying = await fixture.checkpoint(snapshot => recordNode(snapshot, 'azure-fish').stock < 22.5
    && recordNode(snapshot, 'azure-fish').stock > 0 && snapshot.state.units.some(unit => unit.cargo > 0));
  assertConserved(carrying);
  await fixture.stop();
  const saved = JSON.parse(await readFile(fixture.checkpointPath, 'utf8')); assertConserved(saved);
  assert.ok(saved.state.units.some(unit => unit.cargo > 0), 'shutdown checkpoint contains carried fish food');
  await fixture.start();
  clients = [await fixture.connect(0, tokens[0]), await fixture.connect(1, tokens[1])];
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint && client.welcome.matchId === saved.matchId));
  const recovered = await fixture.checkpoint(snapshot => snapshot.sequence > saved.sequence);
  assertConserved(recovered);
  assert.ok(recordNode(recovered, 'azure-fish').stock <= recordNode(saved, 'azure-fish').stock);
  assert.ok(recovered.mapDefinition.resourceNodes.every(node => node.resourceVariant === 'shore-fish'));
  assert.ok(recovered.state.resourceNodes.every(node => node.resourceVariant === 'shore-fish'));
  const delivered = await fixture.checkpoint(snapshot => ['azure-fish', 'ember-fish'].every(id => recordNode(snapshot, id).stock === 0)
    && snapshot.state.units.every(unit => unit.cargo === 0));
  assertConserved(delivered);
  for (const [team, amount] of [22.5, 3.5].entries()) {
    assert.ok(Math.abs(delivered.state.teamFood[team] - amount) < 0.000001,
      'both seats deposit fish as existing food');
  }
  assert.equal(recordNode(delivered, 'hidden-fish').stock, 2);
  await command(clients[0], { type: 'gather', ids: [workers[0][0]], nodeId: 'azure-fish' }, /RESOURCE NODE EMPTY/);
  await fixture.stop(); await fixture.start();
  clients = [await fixture.connect(0, tokens[0]), await fixture.connect(1, tokens[1])];
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint));
  const depletedRecovery = await fixture.checkpoint(snapshot => snapshot.sequence > delivered.sequence);
  assertConserved(depletedRecovery);
  for (const [team, amount] of [22.5, 3.5].entries()) {
    assert.ok(Math.abs(depletedRecovery.state.teamFood[team] - amount) < 0.000001);
  }
  assert.equal(recordNode(depletedRecovery, 'azure-fish').stock, 0, 'restart never regenerates fish');
  const resetTick = clients[0].latest.tick;
  clients[0].send({ type: 'reset' });
  const rematch = await fixture.checkpoint(snapshot => snapshot.sequence > depletedRecovery.sequence
    && snapshot.state.tickNumber >= resetTick && snapshot.state.teamFood.every(food => food === 0)
    && recordNode(snapshot, 'azure-fish').stock === 22.5);
  assertConserved(rematch);
  assert.equal(rematch.state.resourceNodes.reduce((total, node) => total + node.stock, 0), initialStock);
  await fixture.stop();
  const contradictory = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
  recordNode(contradictory, 'azure-fish').resourceVariant = 'ocean-fish';
  await writeFile(fixture.checkpointPath, JSON.stringify(contradictory));
  await fixture.start();
  const fresh = await fixture.connect(0);
  assert.equal(fresh.welcome.recoveredFromCheckpoint, false, 'mismatched persisted fish identity is rejected');
  assert.notEqual(fresh.welcome.matchId, contradictory.matchId);
  assert.ok((await readdir(fixture.directory)).some(name => name.startsWith('match.json.rejected-')));
  console.log(JSON.stringify({ scenario: 'shore fishing foundation', invalidMapCount: invalidMaps.length,
    bothSeatFoodDropoff: delivered.state.teamFood, landWorkersStayOffWater: true,
    soleFoodPoolConserved: true, cargoCheckpointRecovery: true, depletionRecovery: true,
    noRegrowth: true, rematchRestoresAuthoredStock: true, legacySchema20Recovery: true,
    contradictoryIdentityRejected: true, placeholderArt: true }));
} finally { await fixture.dispose(); }
