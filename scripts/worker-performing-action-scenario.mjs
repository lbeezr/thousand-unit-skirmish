// Real commands and WebSocket snapshots. Only the exhausted-repair setup uses
// a labeled damaged-building/wood checkpoint fixture; no animation is inferred.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { buildingRepairStep } from '../src/base-lifecycle.mjs';
import { createWorkerPresentationNativeFixture } from './worker-presentation-native-fixture.mjs';

const fixture = await createFortifiedFixture({ mapPath: 'maps/stone-defense-field.json', timeoutMs: 30_000 });
const row = (state, id) => state.units.find(unit => unit[0] === id);
const productive = (state, ids, action) => ids.some(id => row(state, id)?.[17] === action);
let clients, workers, tokens, orderToken = 1;
const evidence = [];
const presentation = process.argv.includes('--client-presentation')
  ? await createWorkerPresentationNativeFixture() : null;
async function command(team, payload, expected) {
  const notice = await clients[team].command({ ...payload, clientOrderToken: orderToken++ }, /./);
  assert.match(notice.message, expected);
}
async function stop(team, ids) {
  const tick = clients[team].latest.tick;
  await command(team, { type: 'stop', ids }, /STOP ORDER/);
  await clients[team].state(state => state.tick > tick && ids.every(id => row(state, id)[17] === null
    && row(state, id)[9] === 'idle'), 'Stop clears work');
}
async function reconnect() {
  await fixture.start();
  clients = [await fixture.connect(0, tokens[0]), await fixture.connect(1, tokens[1])];
  for (const client of clients) {
    assert.ok(client.welcome.recoveredFromCheckpoint);
    assert.equal(client.latest.workerPerformingActionVersion, 1);
  }
}
function record(name, team, state, ids) {
  assert.equal(state.workerPerformingActionVersion, 1);
  presentation?.record(name, team, state, clients[team].welcome.map, ids);
  evidence.push({ name, team, tick: state.tick, food: state.food[team], wood: state.wood[team],
    stone: state.stone[team], workers: ids.map(id => ({ id, generation: row(state, id)[8],
      task: row(state, id)[9], action: row(state, id)[17], cargo: row(state, id)[6] })) });
}
try {
  await fixture.start(); clients = [await fixture.connect(0), await fixture.connect(1)];
  tokens = clients.map(client => client.welcome.player.sessionToken);
  workers = clients.map((client, team) => client.latest.units.filter(unit => unit[1] === team
    && unit[5] === 'worker').map(unit => unit[0]));
  for (const team of [0, 1]) {
    await command(team, { type: 'stop', ids: clients[team].latest.units.filter(unit => unit[1] === team).map(unit => unit[0]) }, /STOP ORDER/);
    assert.ok(clients[team].latest.units.filter(unit => unit[5] !== 'worker').every(unit => unit[17] === undefined));
    const node = clients[team].welcome.map.resourceNodes.find(node => node.type === 'food'
      && (team ? node.x > 0 : node.x < 0));
    await command(team, { type: 'gather', ids: [workers[team][0]], nodeId: node.id }, /GATHER ORDER/);
    const traveling = await clients[team].state(state => row(state, workers[team][0])[9] === 'gathering'
      && row(state, workers[team][0])[17] === null, 'assigned gathering approach');
    record('gather approach waits', team, traveling, [workers[team][0]]);
    const harvest = await clients[team].state(state => productive(state, [workers[team][0]], 'gather-food'), 'actual node grant');
    assert.ok(row(harvest, workers[team][0])[6] > 0); record('node harvest', team, harvest, [workers[team][0]]);
    await stop(team, [workers[team][0]]);
    await command(team, { type: 'gather', ids: [workers[team][0]], nodeId: node.id }, /GATHER ORDER/);
    await clients[team].state(state => productive(state, [workers[team][0]], 'gather-food'), 'resumed grant');
    await stop(team, [workers[team][0]]);
    const stoneNode = clients[team].welcome.map.resourceNodes.find(node => node.type === 'stone'
      && (team ? node.x > 0 : node.x < 0));
    await command(team, { type: 'gather', ids: [workers[team][0]], nodeId: stoneNode.id }, /GATHER ORDER/);
    const stoneApproach = await clients[team].state(state => row(state, workers[team][0])[9] === 'gathering'
      && row(state, workers[team][0])[17] === null, 'assigned Stone approach');
    record('Stone approach waits', team, stoneApproach, [workers[team][0]]);
    const stone = await clients[team].state(state => productive(state, [workers[team][0]], 'gather-stone'), 'actual Stone grant');
    assert.equal(row(stone, workers[team][0])[7], 'stone');
    assert.ok(row(stone, workers[team][0])[6] > 0); record('Stone harvest', team, stone, [workers[team][0]]);
    await stop(team, [workers[team][0]]);
    record('Stone Stop clears', team, clients[team].latest, [workers[team][0]]);
    await command(team, { type: 'gather', ids: [workers[team][0]], nodeId: stoneNode.id }, /GATHER ORDER/);
    const stoneResumed = await clients[team].state(state => productive(state, [workers[team][0]], 'gather-stone'), 'resumed Stone grant');
    record('Stone resumed grant', team, stoneResumed, [workers[team][0]]);
    await stop(team, [workers[team][0]]);
    const builderIds = workers[team].slice(1);
    const wood = clients[team].latest.wood[team];
    await command(team, { type: 'build', buildingType: 'farm', ids: builderIds,
      x: (team ? 1 : -1) * 12.5, z: -8.5 }, /BUILD ORDER|PLANNING BUILD/);
    const approach = await clients[team].state(state => builderIds.every(id => row(state, id)[17] === null)
      && builderIds.some(id => row(state, id)[9] === 'building'), 'assigned build approach');
    assert.equal(approach.wood[team], wood - 60); record('paid Farm approach waits', team, approach, builderIds);
    const building = await clients[team].state(state => productive(state, builderIds, 'build'), 'positive Farm progress');
    record('build progress', team, building, builderIds); await stop(team, builderIds);
    const farm = clients[team].latest.buildings.find(building => building.team === team && building.type === 'farm');
    await command(team, { type: 'build', buildingId: farm.id, ids: builderIds }, /BUILD RESUME ORDER|CONSTRUCTION RESUMED|PLANNING BUILD/);
    await clients[team].state(state => productive(state, builderIds, 'build'), 'resumed construction');
    const completed = await clients[team].state(state => state.buildings.some(building => building.id === farm.id && building.complete)
      && builderIds.every(id => row(state, id)[17] === null), 'completion clears build action');
    assert.equal(completed.wood[team], wood - 60); record('Farm complete clears', team, completed, builderIds);
    await command(team, { type: 'gather', ids: [builderIds[0]], nodeId: `farm:${farm.id}` }, /GATHER ORDER/);
    const crop = await clients[team].state(state => productive(state, [builderIds[0]], 'gather-food'), 'native Farm grant');
    record('Farm harvest', team, crop, [builderIds[0]]); await stop(team, builderIds);
  }
  await fixture.stop(); const retained = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
  assert.ok(retained.state.units.every(unit => !Object.hasOwn(unit, 'performingAction')));
  assert.ok(!JSON.stringify(retained).includes('workerPerformingAction'), 'receipts are absent from persisted authority');
  await reconnect();
  for (const team of [0, 1]) {
    assert.ok(workers[team].every(id => row(clients[team].latest, id)[17] === null));
    assert.equal(clients[team].latest.wood[team], retained.state.teamWood[team]);
    assert.equal(clients[team].latest.stone[team], retained.state.teamStone[team]);
    record('idle recovery', team, clients[team].latest, workers[team]);
  }

  // Deliberately damaged real paid Farms and nine repair steps of wood, retaining
  // actual Worker locations/generations. These are regression setup values, not
  // claimed ordinary paid-match balance evidence. Commands, work and delivery run
  // through the unmodified native server after recovery.
  await fixture.stop(); const repairFixture = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
  const farms = [0, 1].map(team => repairFixture.state.buildings.find(building => building.type === 'farm' && building.team === team));
  for (const team of [0, 1]) {
    farms[team].hp = 100;
    repairFixture.state.teamWood[team] = 9 * buildingRepairStep(farms[team], 100, 1 / 30).wood;
  }
  await writeFile(fixture.checkpointPath, JSON.stringify(repairFixture)); await reconnect();
  for (const team of [0, 1]) {
    const ids = [workers[team][1]];
    await command(team, { type: 'repairBuilding', buildingId: farms[team].id, ids }, /REPAIR ORDER|PLANNING REPAIR/);
    const repairing = await clients[team].state(state => productive(state, ids, 'repair'), 'positive repair receipt');
    record('fixture positive repair', team, repairing, ids);
    const clear = await clients[team].state(state => state.tick > repairing.tick && row(state, ids[0])[9] === 'repairing'
      && row(state, ids[0])[17] === null && state.wood[team] === 0, 'no-input exhausted repair clear delivered');
    assert.ok(clear.buildings.find(building => building.id === farms[team].id).hp > 100);
    assert.ok(clear.buildings.find(building => building.id === farms[team].id).hp < BUILDING_DEFINITIONS.farm.maxHp);
    record('fixture no wood clear delivered without another order', team, clear, ids);
  }
  clients[0].send({ type: 'reset' });
  await Promise.all(clients.map(client => client.state(state => !state.buildings.length
    && state.units.filter(unit => unit[5] === 'worker').every(unit => unit[17] === null), 'rematch clears all receipts')));
  for (const team of [0, 1]) {
    assert.notEqual(row(clients[team].latest, workers[team][0])[8], retained.state.units[workers[team][0]].generation);
    record('rematch generation clears', team, clients[team].latest, workers[team]);
  }
  console.log(JSON.stringify({ contractVersion: 1, map: 'stone-defense-field', evidence,
    ...(presentation ? { clientPresentation: presentation.evidence } : {}),
    limits: [presentation ? 'real WebSocket rows through actual CPU client receipt/scheduling and shipped atlas buffers; no browser/GPU/deployed appearance claim'
      : 'native WebSocket producer checks; no renderer or deployed appearance claim',
      'exhausted repair uses explicitly seeded damaged Farms and nine repair steps of wood'] }, null, 2));
} finally { presentation?.dispose(); await fixture.dispose(); }
