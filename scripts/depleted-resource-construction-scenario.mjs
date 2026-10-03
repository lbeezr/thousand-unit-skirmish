import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';

// --reproduce-only preserves the original two-sheep map and reports the observed
// placement notices on either build. Default adds finite wood and untouched sheep.
const reproduceOnly = process.argv.includes('--reproduce-only');
const map = JSON.parse(await readFile(new URL('../maps/open-field.json', import.meta.url)));
const storeCost = BUILDING_DEFINITIONS.storehouse.cost.wood;
const wallCost = reproduceOnly ? 0 : BUILDING_DEFINITIONS['palisade-wall'].cost.wood;
Object.assign(map, { id: 'depleted-sheep-site-proof', name: 'DEPLETED SHEEP SITE', startingArmySize: 8,
  fogOfWar: false, startingResources: { food: 0, wood: reproduceOnly ? 100 : storeCost + wallCost }, scenarioEvents: [],
  resourceNodes: [0, 1].map(team => ({ id: `sheep-${team}`, type: 'food',
    x: team ? 12.5 : -12.5, z: 6.5, stock: 0.5, wildlifeSpecies: 'bellweather-sheep' })),
});
if (!reproduceOnly) {
  map.resourceNodes.push(...[0, 1].map(team => ({ id: `timber-${team}`, type: 'wood',
    x: team ? 12.5 : -12.5, z: -6.5, stock: 0.5 })));
  map.resourceNodes.push(...[0, 1].map(team => ({ id: `living-sheep-${team}`, type: 'food',
    x: team ? 12.5 : -12.5, z: 15.5, stock: 2, wildlifeSpecies: 'bellweather-sheep' })));
}
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 40_000 });
let token = 100;
const command = (client, value, pattern) => client.command({ ...value, clientOrderToken: token++ }, pattern);
const nodeAt = (snapshot, id) => snapshot.state.resourceNodes.find(node => node.id === id);
function conserved(snapshot) {
  for (const resource of ['food', 'wood']) {
    const initial = map.startingResources[resource] * 2
      + map.resourceNodes.filter(node => node.type === resource).reduce((sum, node) => sum + node.stock, 0);
    const state = snapshot.state;
    const stock = state.resourceNodes.filter(node => node.type === resource).reduce((sum, node) => sum + node.stock, 0);
    const bank = (resource === 'food' ? state.teamFood : state.teamWood).reduce((sum, amount) => sum + amount, 0);
    const cargo = state.units.filter(unit => unit.cargoType === resource).reduce((sum, unit) => sum + unit.cargo, 0);
    const paid = state.buildings.reduce((sum, building) => sum + BUILDING_DEFINITIONS[building.type].cost[resource], 0);
    assert.ok(Math.abs(initial - stock - bank - cargo - paid) < 1e-6,
      `${resource} equals remaining stock, banks, cargo and paid construction`);
  }
}
function depleted(snapshot) {
  for (const team of [0, 1]) {
    const sheep = nodeAt(snapshot, `sheep-${team}`);
    assert.equal(sheep.stock, 0); assert.equal(sheep.wildlifeState, 'depleted');
    if (!reproduceOnly) {
      assert.equal(nodeAt(snapshot, `timber-${team}`).stock, 0);
      assert.equal(nodeAt(snapshot, `living-sheep-${team}`).stock, 2);
      assert.equal(nodeAt(snapshot, `living-sheep-${team}`).wildlifeState, 'alive');
    }
  }
}

try {
  await fixture.start();
  let clients = [await fixture.connect(0), await fixture.connect(1)];
  const sessions = clients.map(client => client.welcome.player.sessionToken);
  clients[0].send({ type: 'publishMap', map, persist: true });
  await clients[0].wait(message => message.type === 'mapPublished' && message.mapId === map.id);
  await clients[1].wait(message => message.type === 'mapChange' && message.map.id === map.id);
  const workers = clients.map((client, team) => client.latest.units.filter(row => row[1] === team && row[5] === 'worker').map(row => row[0]));
  const build = (team, kind, site, ids = [workers[team][0]]) => command(clients[team], {
    type: 'build', buildingType: kind, ids, x: site.x, z: site.z,
  }, /BUILD REJECTED|STOREHOUSE PLACED|PALISADE LINE PLACED/);
  const initial = await fixture.checkpoint(snapshot => snapshot.mapDefinition.id === map.id);
  for (const team of [0, 1]) {
    assert.match((await build(team, 'storehouse', map.resourceNodes[team])).message, /RESOURCE NODE IN FOOTPRINT/);
    if (!reproduceOnly) assert.match((await build(team, 'palisade-wall', map.resourceNodes[2 + team], [workers[team][1]])).message, /SPACE BLOCKED/);
  }
  const rejected = await fixture.checkpoint(snapshot => snapshot.sequence > initial.sequence);
  conserved(rejected); assert.equal(rejected.state.buildings.length, 0);
  assert.deepEqual(rejected.state.teamWood, [map.startingResources.wood, map.startingResources.wood]);
  for (const team of [0, 1]) await command(clients[team], {
    type: 'gather', ids: [workers[team][0]], nodeId: `sheep-${team}`,
  }, /GATHER ORDER/);
  const foodDelivered = await fixture.checkpoint(snapshot => snapshot.state.teamFood.every(food => food === 0.5)
    && snapshot.state.units.every(unit => unit.cargo === 0));
  conserved(foodDelivered);
  if (reproduceOnly) {
    const notices = [];
    for (const team of [0, 1]) notices.push((await build(team, 'storehouse', map.resourceNodes[team])).message);
    console.log(JSON.stringify({ scenario: 'original depleted invisible sheep construction site',
      originalBuild: 'ae88e0ff0c93deddfd7f7e08433293e531f39fe7', map: map.id,
      depletedStock: [0, 0], foodBanks: foodDelivered.state.teamFood, placementNotices: notices }));
  } else {
    for (const team of [0, 1]) await command(clients[team], {
      type: 'gather', ids: [workers[team][1]], nodeId: `timber-${team}`,
    }, /GATHER ORDER/);
    const cleared = await fixture.checkpoint(snapshot => snapshot.state.teamWood.every(wood => wood === map.startingResources.wood + 0.5)
      && snapshot.state.units.every(unit => unit.cargo === 0));
    conserved(cleared); depleted(cleared);
    await fixture.stop(); await fixture.start();
    clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
    assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint));
    const recovered = await fixture.checkpoint(snapshot => snapshot.sequence > cleared.sequence);
    conserved(recovered); depleted(recovered);
    for (const team of [0, 1]) {
      assert.match((await build(team, 'storehouse', map.resourceNodes[team])).message, /STOREHOUSE PLACED/);
      assert.match((await build(team, 'palisade-wall', map.resourceNodes[2 + team], [workers[team][1]])).message, /PALISADE LINE PLACED/);
    }
    const constructing = await fixture.checkpoint(snapshot => snapshot.state.buildings.length === 4
      && snapshot.state.buildings.every(building => building.progress > 0 && !building.complete));
    conserved(constructing); depleted(constructing);
    assert.deepEqual(constructing.state.teamWood, [0.5, 0.5], 'each paid building is debited exactly once');
    const duplicateDebit = structuredClone(constructing); duplicateDebit.state.teamWood[0] -= 0.5;
    assert.throws(() => conserved(duplicateDebit), /wood equals/);
    await fixture.stop(); await fixture.start();
    clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
    assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint));
    const completed = await fixture.checkpoint(snapshot => snapshot.sequence > constructing.sequence
      && snapshot.state.buildings.length === 4 && snapshot.state.buildings.every(building => building.complete));
    conserved(completed); depleted(completed);
    assert.deepEqual(completed.state.teamFood, [0.5, 0.5]);
    assert.deepEqual(completed.state.teamWood, [0.5, 0.5]);
    for (const team of [0, 1]) {
      assert.match((await build(team, 'house', map.resourceNodes[team])).message, /SPACE BLOCKED/);
      assert.match((await build(team, 'storehouse', map.resourceNodes[4 + team])).message, /RESOURCE NODE IN FOOTPRINT/);
      await command(clients[team], { type: 'gather', ids: [workers[team][0]], nodeId: `sheep-${team}` }, /RESOURCE NODE EMPTY/);
    }
    await fixture.stop(); await fixture.start();
    clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
    assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint));
    const stable = await fixture.checkpoint(snapshot => snapshot.sequence > completed.sequence);
    conserved(stable); depleted(stable); assert.deepEqual(stable.state.teamWood, [0.5, 0.5]);
    clients[0].send({ type: 'reset' });
    const rematch = await fixture.checkpoint(snapshot => snapshot.sequence > stable.sequence && snapshot.state.buildings.length === 0
      && snapshot.state.teamFood.every(food => food === 0) && snapshot.state.resourceNodes.every(node => node.stock > 0));
    conserved(rematch);
    assert.deepEqual(rematch.state.teamWood, [map.startingResources.wood, map.startingResources.wood]);
    for (const team of [0, 1]) {
      assert.match((await build(team, 'storehouse', map.resourceNodes[team])).message, /RESOURCE NODE IN FOOTPRINT/);
      assert.match((await build(team, 'palisade-wall', map.resourceNodes[2 + team], [workers[team][1]])).message, /SPACE BLOCKED/);
    }
    // A saved zero is trusted only after the complete resource table validates.
    // A restored positive resource may never coexist with a building footprint.
    for (const kind of ['positive-overlap', 'duplicate-resource', 'missing-resource']) {
      await fixture.stop();
      const invalid = structuredClone(stable);
      if (kind === 'positive-overlap') Object.assign(nodeAt(invalid, 'sheep-0'), { stock: 0.5, wildlifeState: 'alive' });
      else if (kind === 'duplicate-resource') invalid.state.resourceNodes[1] = { ...invalid.state.resourceNodes[0] };
      else invalid.state.resourceNodes.pop();
      const rejectedBefore = (await readdir(fixture.directory)).filter(name => name.startsWith('match.json.rejected-')).length;
      await writeFile(fixture.checkpointPath, JSON.stringify(invalid));
      await fixture.start();
      const fresh = await fixture.connect(0);
      assert.equal(fresh.welcome.recoveredFromCheckpoint, false, `${kind} checkpoint rejects`);
      assert.notEqual(fresh.welcome.matchId, invalid.matchId);
      const rejectedAfter = (await readdir(fixture.directory)).filter(name => name.startsWith('match.json.rejected-')).length;
      assert.equal(rejectedAfter, rejectedBefore + 1, 'contradictory save is preserved before a fresh match');
    }
    console.log(JSON.stringify({ scenario: 'depleted resource construction sites', map: map.id,
      bothSeatLivingSitesProtected: true, bothSeatSheepAndWoodSitesReused: true,
      depletedRecoveryAndMidConstructionRecovery: true, singleDebitAndResourceConservation: true,
      occupiedSitesAndUntouchedSheepProtected: true, staleGatherRejected: true, rematchRestoresResourceExclusion: true,
      positiveOverlapAndMalformedResourceCheckpointsRejected: true,
      buildings: completed.state.buildings.map(building => ({ team: building.team, type: building.type })),
      foodBanks: stable.state.teamFood, woodBanks: stable.state.teamWood }));
  }
} finally { await fixture.dispose(); }
