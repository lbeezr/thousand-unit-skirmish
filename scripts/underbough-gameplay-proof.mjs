// Automated authoritative proof, not browser or human playtest evidence.
// Publish an authored 250-unit variant; never inject checkpoint economy/state.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { assertGatheringBeforeRewards } from './underbough-gathering-evidence.mjs';
import { BUILDING_DEFINITIONS, UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';

const winner = Number(process.argv[2] ?? 0);
assert.ok([0, 1].includes(winner), 'winner must be 0 or 1');
const map = JSON.parse(await readFile(new URL('../maps/underbough-rootways.json', import.meta.url)));
map.id = 'underbough-rootways-gameplay-proof';
map.startingArmySize = 250;
const fixture = await createFortifiedFixture({ mapPath: 'maps/underbough-rootways.json', timeoutMs: 120000 });
let clients, stage = 'startup', token = 1;
const own = (client, team, kind) => client.latest.units.filter(u => u[1] === team && u[4] > 0 && (!kind || u[5] === kind));
async function order(client, type, ids = [], extra = {}, notice = /ORDER/) {
  const result = await client.command({ type, ids, unitGenerations: ids.map(id => client.latest.units.find(u => u[0] === id)?.[8]),
    ...extra, clientOrderToken: token++ }, new RegExp(`${notice.source}|REJECTED`));
  assert.match(result.message, notice, `${type}: ${result.message}`);
  const tick = client.latest.tick;
  await client.state(s => s.tick > tick, `${type} fresh snapshot`);
  return result;
}
function settled() {
  const tick = Math.max(...clients.map(c => c.latest.tick));
  return fixture.checkpoint(s => s.state.tickNumber >= tick);
}
const evidence = { map: map.id, openingUnits: 250, winner, economy: [] };
try {
  await fixture.start();
  clients = [await fixture.connect(0), await fixture.connect(1)];
  const sessions = clients.map(c => c.welcome.player.sessionToken);
  clients[0].send({ type: 'publishMap', map });
  const published = await clients[0].wait(m => m.type === 'mapRejected' || m.type === 'mapChange', 'publish 250-unit Rootways');
  assert.notEqual(published.type, 'mapRejected', published.message);
  await clients[1].wait(m => m.type === 'mapChange', 'guest Rootways variant');
  const workers = clients.map((c, t) => own(c, t, 'worker').map(u => u[0]));
  for (const [team, c] of clients.entries()) {
    assert.equal(c.latest.armySize, 250);
    assert.equal(own(c, team).length, 125);
    assert.equal(workers[team].length, 4);
    await order(c, 'holdPosition', own(c, team, 'infantry').map(u => u[0]), {}, /HOLD POSITION ORDER/);
  }
  stage = 'both-seat banked gathering';
  await Promise.all(clients.map(async (c, team) => {
    for (const [index, type] of ['food', 'wood'].entries()) {
      await order(c, 'gather', [workers[team][index]], { nodeId: `s${team}-${index}` }, /GATHER ORDER/);
    }
    await c.state(s => s.food[team] > map.startingResources.food && s.wood[team] > map.startingResources.wood, 'gathered cargo reaches bank');
    await order(c, 'stop', workers[team], {}, /STOP ORDER/);
  }));
  const gathered = await settled();
  assertGatheringBeforeRewards(gathered.state, map);
  stage = 'paid house and Barracks construction';
  const barracks = [];
  await Promise.all(clients.map(async (c, team) => {
    const before = await settled();
    for (const [index, buildingType] of ['house', 'barracks'].entries()) {
      await order(c, 'build', workers[team].slice(2), { buildingType, x: team ? 24.5 : -24.5, z: index ? -3.5 : 3.5 }, /BUILD ORDER/);
      await c.state(s => s.buildings.some(b => b.team === team && b.type === buildingType && b.complete), `${buildingType} completion`);
    }
    const paid = await settled();
    const cost = BUILDING_DEFINITIONS.house.cost.wood + BUILDING_DEFINITIONS.barracks.cost.wood;
    assert.equal(paid.state.teamWood[team], before.state.teamWood[team] - cost);
    assert.equal(paid.state.teamFood[team], before.state.teamFood[team]);
    barracks[team] = c.latest.buildings.find(b => b.team === team && b.type === 'barracks');
    const initialIds = new Set(own(c, team).map(u => u[0]));
    await order(c, 'trainUnit', [], { kind: 'infantry', buildingId: barracks[team].id }, /INFANTRY QUEUED/);
    const queued = await fixture.checkpoint(s => s.state.teamFood[team] === paid.state.teamFood[team] - UNIT_DEFINITIONS.infantry.cost.food);
    assert.equal(queued.state.teamWood[team], paid.state.teamWood[team]);
    await c.state(s => s.units.some(u => u[1] === team && u[5] === 'infantry' && !initialIds.has(u[0])), 'paid infantry produced');
    evidence.economy[team] = { gatheredFood: gathered.state.teamFood[team] - map.startingResources.food,
      gatheredWood: gathered.state.teamWood[team] - map.startingResources.wood, constructionWood: cost,
      productionFood: UNIT_DEFINITIONS.infantry.cost.food };
  }));
  stage = 'both-seat reconnect and worker recovery';
  for (const team of [0, 1]) {
    const previous = clients[team];
    previous.socket.close();
    clients[team] = await fixture.connect(team, sessions[team]);
    assert.equal(clients[team].latest.mapId, map.id);
    assert.ok(clients[team].latest.buildings.some(b => b.id === barracks[team].id && b.complete));
    await order(clients[1 - team], 'holdPosition', own(clients[1 - team], 1 - team, 'infantry').map(u => u[0]), {}, /HOLD POSITION ORDER/);
  }
  const beforeRecovery = await settled();
  await fixture.stop(); await fixture.start();
  clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
  for (const [team, c] of clients.entries()) {
    assert.equal(c.latest.mapId, map.id);
    assert.equal(c.latest.food[team], beforeRecovery.state.teamFood[team]);
    assert.equal(c.latest.wood[team], beforeRecovery.state.teamWood[team]);
    assert.equal(own(c, team).length, 126);
    await order(c, 'holdPosition', own(c, team, 'infantry').map(u => u[0]), {}, /HOLD POSITION ORDER/);
  }
  stage = 'reachable authored objectives and capture-hold result';
  const army = own(clients[winner], winner, 'infantry').slice(-8).map(u => u[0]);
  for (const trigger of [map.triggers[2], map.triggers[winner], map.triggers[1 - winner]]) {
    const { column, row, width, height } = trigger.zone;
    await order(clients[winner], 'move', army, { x: column + width / 2 - map.width / 2, z: row + height / 2 - map.height / 2 }, /MOVE ORDER/);
    await clients[winner].state(s => s.objectives.find(o => o.id === trigger.id)?.owner === winner, `${trigger.name} reachable`);
  }
  await Promise.all(clients.map(c => c.state(s => s.winner === winner, 'both seats agree on result')));
  for (const c of clients) {
    assert.equal(c.latest.winnerReason, 'capture-hold');
    assert.ok(c.latest.objectives.filter(o => o.victory).every(o => o.owner === winner));
  }
  stage = 'clean rematch with usable orders';
  const generations = clients.map((c, t) => own(c, t, 'worker')[0][8]);
  clients[0].send({ type: 'reset' });
  await Promise.all(clients.map((c, t) => c.state(s => s.winner === -1 && s.armySize === 250
    && s.objectives.every(o => o.owner === -1) && s.units.find(u => u[0] === workers[t][0])?.[8] !== generations[t], 'fresh rematch')));
  const reset = await fixture.checkpoint(s => s.state.teamFood.every(n => n === map.startingResources.food)
    && s.state.teamWood.every(n => n === map.startingResources.wood));
  assert.equal(reset.state.units.length, 250);
  assert.equal(reset.state.buildings.length, 0, 'constructed buildings removed');
  assert.ok(reset.state.scenarioEventStates.every(e => !e.fired));
  await Promise.all(clients.map(async (c, team) => {
    await order(c, 'gather', [workers[team][0]], { nodeId: `s${team}-0` }, /GATHER ORDER/);
    await c.state(s => s.food[team] > map.startingResources.food, 'rematch gathering banks food');
    await order(c, 'stop', workers[team], {}, /STOP ORDER/);
  }));
  const rematch = await settled();
  assertGatheringBeforeRewards(rematch.state, map, [0, 1], ['food']);
  evidence.rematch = { seconds: rematch.state.matchElapsedSeconds,
    bankedFood: rematch.state.teamFood.map(n => n - map.startingResources.food) };
  console.log(JSON.stringify({ ...evidence, checks: ['paid gathering/building/production', 'both-seat reconnect',
    'checkpoint restart', 'reachable objectives', 'capture-hold result', 'clean rematch'],
    limitations: ['automated server evidence only', 'no human playtest or browser claim', 'no 2000-unit support claim'] }));
} catch (error) {
  throw new Error(`${stage}: ${error.message}`, { cause: error });
} finally { await fixture.dispose(); }
