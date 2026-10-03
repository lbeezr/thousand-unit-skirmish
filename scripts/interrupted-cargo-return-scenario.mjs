import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';

// Preserve the failing fixture: no other food, bank, economy or position injection.
// --reproduce-only stops at the original stranded-cargo observation on either build.
const reproduceOnly = process.argv.includes('--reproduce-only');
const teams = reproduceOnly ? [0] : [0, 1];
const map = JSON.parse(await readFile(new URL('../maps/open-field.json', import.meta.url)));
Object.assign(map, { id: 'interrupted-sheep-cargo-proof', name: 'INTERRUPTED SHEEP CARGO',
  startingArmySize: 8, fogOfWar: false, startingResources: { food: 0, wood: 0 }, scenarioEvents: [],
  resourceNodes: [
    { id: 'last-sheep', type: 'food', x: -12, z: 6, stock: 0.5, wildlifeSpecies: 'bellweather-sheep' },
  ],
});
if (!reproduceOnly) map.resourceNodes.push({ id: 'last-ember-sheep', type: 'food', x: 12, z: 6,
  stock: 0.5, wildlifeSpecies: 'bellweather-sheep' });
const initialFood = map.resourceNodes.reduce((sum, node) => sum + node.stock, 0);
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 20_000 });
let token = 100;
const command = (client, value, expression) => client.command({ ...value, clientOrderToken: token++ }, expression);
const conserved = snapshot => {
  const state = snapshot.state;
  const stock = state.resourceNodes.reduce((sum, node) => sum + node.stock, 0);
  const bank = state.teamFood.reduce((sum, food) => sum + food, 0);
  const cargo = state.units.filter(unit => unit.cargoType === 'food').reduce((sum, unit) => sum + unit.cargo, 0);
  assert.ok(Math.abs(stock + bank + cargo - initialFood) < 1e-6, 'authored food equals stock plus both banks and cargo');
  assert.ok(state.resourceNodes.every(node => node.stock === 0 && node.wildlifeState === 'depleted'), 'exhausted sheep never revive');
};

try {
  await fixture.start();
  let clients = [await fixture.connect(0), await fixture.connect(1)];
  const sessions = clients.map(client => client.welcome.player.sessionToken);
  clients[0].send({ type: 'publishMap', map, persist: true });
  await clients[0].wait(message => message.type === 'mapPublished' && message.mapId === map.id);
  await clients[1].wait(message => message.type === 'mapChange' && message.map.id === map.id);
  const workers = clients.map((client, team) => client.latest.units.find(row => row[1] === team && row[5] === 'worker')[0]);
  const carryingWorkers = teams.map(team => workers[team]);
  for (const team of teams) {
    await command(clients[team], { type: 'gather', ids: [workers[team]], nodeId: map.resourceNodes[team].id }, /GATHER ORDER/);
  }
  await fixture.checkpoint(snapshot => snapshot.mapDefinition.id === map.id
    && snapshot.state.resourceNodes.every(node => node.stock === 0)
    && carryingWorkers.every(id => snapshot.state.units[id].cargo === 0.5));
  for (const team of teams) await command(clients[team], { type: 'stop', ids: [workers[team]] }, /STOP ORDER/);
  const stopped = await fixture.checkpoint(snapshot => carryingWorkers.every(id => snapshot.state.units[id].gatherPhase === '' && snapshot.state.units[id].cargo === 0.5));
  conserved(stopped); assert.deepEqual(stopped.state.teamFood, [0, 0]);
  for (const team of teams) {
    await command(clients[team], { type: 'gather', ids: [workers[team]], nodeId: map.resourceNodes[team].id }, /RESOURCE NODE EMPTY/);
    await command(clients[team], { type: 'gather', ids: [workers[team]], nodeId: 'stale-node' }, /RESOURCE NODE NOT FOUND/);
  }
  await fixture.stop(); await fixture.start();
  clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint));
  const stranded = await fixture.checkpoint(snapshot => snapshot.sequence > stopped.sequence);
  conserved(stranded); assert.deepEqual(stranded.state.teamFood, [0, 0]);
  assert.ok(carryingWorkers.every(id => stranded.state.units[id].gatherPhase === '' && stranded.state.units[id].cargo === 0.5));
  if (reproduceOnly) {
    console.log(JSON.stringify({ scenario: 'original interrupted final sheep delivery',
      originalBuild: '218e53cfba6041ba8fe247bcde302fbda495541c', map: map.id,
      stoppedCargo: 0.5, remainingStock: 0, banks: [0, 0], depletedAndStaleGatherRejected: true,
      stoppedCargoRecovery: true }));
  } else {
    for (const team of [0, 1]) {
      const own = workers[team], generation = stranded.state.units[own].generation;
      await command(clients[team], { type: 'returnCargo', ids: [workers[1 - team]] }, /RETURN CARGO REJECTED/);
      await command(clients[team], { type: 'returnCargo', ids: [own], unitGenerations: [generation - 1] }, /RETURN CARGO REJECTED/);
      await command(clients[team], { type: 'returnCargo', ids: [own], nodeId: map.resourceNodes[team].id }, /RETURN CARGO REJECTED/);
      for (let repeat = 0; repeat < 2; repeat++) {
        await command(clients[team], { type: 'returnCargo', ids: [own], unitGenerations: [generation] }, /RETURN CARGO ORDER/);
      }
    }
    await Promise.all(clients.map((client, team) => client.state(state => state.units.some(row => row[0] === workers[team] && row[9] === 'returning'), 'returning task is visible')));
    const returning = await fixture.checkpoint(snapshot => workers.every(id => snapshot.state.units[id].gatherPhase === 'to-base'
      && snapshot.state.units[id].gatherNodeId === null && snapshot.state.units[id].gatherForestCell === -1
      && snapshot.state.units[id].cargo === 0.5));
    conserved(returning); assert.deepEqual(returning.state.teamFood, [0, 0]);
    await fixture.stop();
    const saved = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
    conserved(saved); assert.ok(workers.every(id => saved.state.units[id].cargo === 0.5), 'restart occurs before final credit');
    await fixture.start();
    clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
    assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint));
    const delivered = await fixture.checkpoint(snapshot => snapshot.sequence > saved.sequence
      && snapshot.state.teamFood.every(food => food === 0.5) && workers.every(id => snapshot.state.units[id].cargo === 0));
    conserved(delivered); assert.ok(workers.every(id => delivered.state.units[id].gatherPhase === ''));
    for (const team of [0, 1]) {
      await command(clients[team], { type: 'returnCargo', ids: [workers[team]] }, /RETURN CARGO REJECTED/);
      await command(clients[team], { type: 'gather', ids: [workers[team]], nodeId: map.resourceNodes[team].id }, /RESOURCE NODE EMPTY/);
    }
    const duplicate = structuredClone(delivered); duplicate.state.teamFood[0] += 0.5;
    assert.throws(() => conserved(duplicate), /authored food/);
    const lost = structuredClone(returning); lost.state.units[workers[0]].cargo = 0;
    assert.throws(() => conserved(lost), /authored food/);
    await fixture.stop(); await fixture.start();
    clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
    assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint));
    const stable = await fixture.checkpoint(snapshot => snapshot.sequence > delivered.sequence);
    conserved(stable); assert.deepEqual(stable.state.teamFood, [0.5, 0.5]);
    assert.ok(workers.every(id => stable.state.units[id].cargo === 0 && stable.state.units[id].gatherPhase === ''));
    console.log(JSON.stringify({ scenario: 'interrupted final sheep delivery', map: map.id,
      bothSeatStopAndExplicitReturn: true, sourceFreeReturnRecovery: true, depletedAndStaleGatherRejected: true,
      foreignAndStaleGenerationRejected: true, duplicateOrdersAndPostDepositRestartCreditOnce: true,
      lostCargoAndDuplicateCreditControls: true, banks: stable.state.teamFood, remainingStock: 0 }));
  }
} finally { await fixture.dispose(); }
