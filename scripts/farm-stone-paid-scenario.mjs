// Normal shipped maps, actual commands and untouched checkpoints. No bank,
// cargo, crop, node, position or schema fixture is written by this scenario.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { captureDepotSources, assertDepotSourcesUnchanged } from './depot-source-snapshot.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { constructionCostForProfile, resolveEconomyProfileId, STONE_ECONOMY_PROFILE_ID } from '../src/economy-profile.mjs';
import { farmHarvestNodeId } from '../src/farm-harvest.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const maps = ['maps/stone-defense-field.json', 'maps/bellweather-millrace.json'];
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-5,
  `${message}: ${actual} versus ${expected}`);
const sum = (rows, value) => rows.reduce((total, row) => total + value(row), 0);

export async function verifyPaidFarmStone(mapPath) {
  const map = JSON.parse(await readFile(path.join(ROOT, mapPath), 'utf8'));
  const profile = resolveEconomyProfileId(map.economyProfileId), stone = profile === STONE_ECONOMY_PROFILE_ID;
  const room = await createFortifiedFixture({ mapPath, timeoutMs: 90_000 });
  const spent = [0, 1].map(() => ({ food: 0, wood: 0, stone: 0 }));
  const completedFarms = new Set(), records = [];
  let clients, workers, tokens, nextToken = 1;
  const command = async (team, payload, expected) => {
    const notice = await clients[team].command({ ...payload, clientOrderToken: nextToken++ }, /./);
    assert.match(notice.message, expected); return notice;
  };
  const saved = async () => JSON.parse(await readFile(room.checkpointPath, 'utf8'));
  const own = (snapshot, team, type) => snapshot.state.buildings.find(building => building.team === team && building.type === type);
  const ownStone = team => map.resourceNodes.filter(node => node.type === 'stone' && (team ? node.x > 0 : node.x < 0));
  const plot = (team, type) => {
    const sign = team ? 1 : -1, home = Math.abs(map.spawnPoints.find(spawn => spawn.team === team).x);
    return type === 'farm' ? { x: sign * (home + 3.5), z: 14.5 }
      : type === 'mill' ? { x: sign * (home + 1.5), z: 8.5 }
        : type === 'cancel-farm' ? { x: sign * (home + 3.5), z: -14.5 }
          : { x: sign * (home - 9.5), z: -12.5 };
  };
  function record(stage, snapshot) {
    assert.deepEqual(snapshot.mapDefinition.resourceNodes, map.resourceNodes, 'authored resources are never rewritten');
    for (const farm of snapshot.state.buildings.filter(building => building.type === 'farm' && building.complete)) completedFarms.add(farm.id);
    for (const type of ['food', 'wood', ...(stone ? ['stone'] : [])]) {
      const supplied = sum(map.resourceNodes.filter(node => node.type === type), node => node.stock)
        + 2 * (map.startingResources[type] || 0) + (type === 'food' ? completedFarms.size * BUILDING_DEFINITIONS.farm.harvest.stock : 0);
      const remaining = sum(snapshot.state.resourceNodes.filter(node => node.type === type), node => node.stock)
        + sum(snapshot.state.units.filter(unit => unit.cargoType === type), unit => unit.cargo)
        + sum(snapshot.state[type === 'food' ? 'teamFood' : type === 'wood' ? 'teamWood' : 'teamStone'], balance => balance)
        + (type === 'food' ? sum(snapshot.state.buildings.filter(building => building.type === 'farm'), building => building.harvestStock) : 0)
        + sum(spent, cost => cost[type]);
      near(remaining, supplied, `${stage}: ${type} stock + cargo + bank + net paid cost`);
    }
    if (stone) for (const team of [0, 1]) {
      const ids = new Set(ownStone(team).map(node => node.id));
      near(sum(snapshot.state.resourceNodes.filter(node => ids.has(node.id)), node => node.stock)
        + sum(snapshot.state.units.filter(unit => unit.team === team && unit.cargoType === 'stone'), unit => unit.cargo)
        + snapshot.state.teamStone[team] + spent[team].stone, sum(ownStone(team), node => node.stock), `${stage}: seat ${team} Stone`);
    }
    records.push({ stage, tick: snapshot.state.tickNumber, banks: { food: snapshot.state.teamFood,
      wood: snapshot.state.teamWood, ...(stone ? { stone: snapshot.state.teamStone } : {}) }, netPaid: structuredClone(spent),
    buildings: snapshot.state.buildings.map(({ id, team, type, complete, progress, harvestStock }) => ({ id, team, type, complete, progress, harvestStock })),
    cargo: snapshot.state.units.filter(unit => unit.cargo > 0).map(({ id, team, generation, cargo, cargoType, gatherNodeId, gatherPhase, dropoffBuildingId }) =>
      ({ id, team, generation, cargo, cargoType, gatherNodeId, gatherPhase, dropoffBuildingId })) });
    console.log(JSON.stringify({ map: map.id, stage, conserved: true }));
  }
  async function stopWorkers() {
    for (const team of [0, 1]) await command(team, { type: 'stop', ids: workers[team] }, /STOP ORDER/);
    return room.checkpoint(snapshot => workers.flat().every(id => snapshot.state.units[id].gatherPhase === ''
      && snapshot.state.units[id].buildingTargetId === null));
  }
  async function build(type) {
    for (const team of [0, 1]) {
      await command(team, { type: 'build', buildingType: type, ids: workers[team], ...plot(team, type) }, /PLACED · WORKERS BUILDING|PLANNING BUILD/);
      const cost = constructionCostForProfile(type, profile);
      for (const resource of Object.keys(cost)) spent[team][resource] += cost[resource];
    }
    return room.checkpoint(snapshot => [0, 1].every(team => own(snapshot, team, type)?.complete));
  }
  async function recover(stage) {
    await stopWorkers(); await room.stop(); const retained = await saved(); record(`${stage}-before`, retained);
    await room.start(); clients = [await room.connect(0, tokens[0]), await room.connect(1, tokens[1])];
    assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint));
    const resumed = await room.checkpoint(snapshot => snapshot.sequence > retained.sequence);
    assert.equal(resumed.matchId, retained.matchId); assert.equal(resumed.mapHash, retained.mapHash);
    for (const field of ['teamFood', 'teamWood', 'teamStone']) assert.deepEqual(resumed.state[field], retained.state[field], field);
    // Tower cooldowns legitimately elapse before the next checkpoint poll.
    const paidBuildings = snapshot => snapshot.state.buildings.map(({ attackCooldown, ...building }) => building);
    assert.deepEqual(paidBuildings(resumed), paidBuildings(retained), 'all paid building state apart from elapsed attack cooldown');
    // Checkpoint polling advances simulation time after restore. Millrace's
    // living Sheep may legitimately move; economic node identity/stock persist.
    const stocks = snapshot => snapshot.state.resourceNodes.map(({ id, type, stock }) => ({ id, type, stock }));
    assert.deepEqual(stocks(resumed), stocks(retained), 'authored node identity and stock survive cold recovery');
    assert.deepEqual(resumed.state.units.map(({ id, generation, cargo, cargoType }) => ({ id, generation, cargo, cargoType })),
      retained.state.units.map(({ id, generation, cargo, cargoType }) => ({ id, generation, cargo, cargoType })));
    record(`${stage}-after`, resumed); return resumed;
  }
  try {
    await room.start(); clients = [await room.connect(0), await room.connect(1)];
    tokens = clients.map(client => client.welcome.player.sessionToken);
    workers = clients.map((client, team) => client.latest.units.filter(unit => unit[1] === team && unit[5] === 'worker').map(unit => unit[0]));
    for (const team of [0, 1]) {
      assert.equal(clients[team].welcome.map.id, map.id);
      await command(team, { type: 'stop', ids: clients[team].latest.units.filter(unit => unit[1] === team).map(unit => unit[0]) }, /STOP ORDER/);
    }
    const initial = await room.checkpoint(); record('authored-start', initial);
    assert.deepEqual(initial.state.teamFood, [map.startingResources.food, map.startingResources.food]);
    assert.deepEqual(initial.state.teamWood, [map.startingResources.wood, map.startingResources.wood]);
    assert.deepEqual(initial.state.teamStone, [0, 0]);
    if (stone) {
      for (const team of [0, 1]) await command(team, { type: 'build', buildingType: 'watchtower', ids: workers[team], ...plot(team, 'watchtower') }, /NEED .*50 STONE/);
      const rejected = await room.checkpoint();
      assert.deepEqual(rejected.state.buildings, initial.state.buildings);
      assert.deepEqual(rejected.state.teamFood, initial.state.teamFood); assert.deepEqual(rejected.state.teamWood, initial.state.teamWood);
      record('unpaid-tower-rejected', rejected);
    }
    const planted = await build('farm'); record('paid-farm-complete', planted);
    const farmIds = [0, 1].map(team => own(planted, team, 'farm').id);
    for (const team of [0, 1]) {
      assert.equal(own(planted, team, 'farm').harvestStock, 200);
      await command(team, { type: 'gather', ids: [workers[team][0]], nodeId: farmHarvestNodeId(farmIds[1 - team]) }, /FARM BELONGS TO THE OTHER TEAM/);
      await command(team, { type: 'cancelConstruction', buildingId: farmIds[team] }, /CANCEL REJECTED/);
    }
    if (stone) {
      record('paid-food-only-mill', await build('mill'));
      for (const team of [0, 1]) await command(team, { type: 'gather', ids: workers[team], nodeId: ownStone(team)[0].id }, /GATHER ORDER/);
      await room.checkpoint(snapshot => snapshot.state.teamStone.every(balance => balance >= 50));
      await stopWorkers();
      for (const team of [0, 1]) await command(team, { type: 'returnCargo', ids: workers[team] }, /RETURN CARGO/);
      record('natural-stone-banked', await room.checkpoint(snapshot => snapshot.state.units.every(unit => unit.cargo === 0)));
    }
    const defended = await build('watchtower'); record('paid-farm-tower-coexist', defended);
    for (const team of [0, 1]) {
      near(defended.state.teamFood[team], map.startingResources.food - 50, 'Watchtower food payment');
      near(defended.state.teamWood[team], map.startingResources.wood - 60 - 150 - (stone ? 75 : 0), 'Farm/Mill/Watchtower wood payments');
    }
    if (!stone) {
      assert.ok(clients.every(client => client.latest.stone === undefined), 'baseline does not disclose a Stone bank');
      record('baseline-cold-recovery', await recover('baseline'));
      return { mapPath, mapId: map.id, dimensions: [map.width, map.height], economyProfileId: profile, records };
    }
    // Freeze a genuinely partly built Farm before proportional cancellation.
    const canceledIds = [];
    for (const team of [0, 1]) {
      await command(team, { type: 'build', buildingType: 'farm', ids: [workers[team][0]], ...plot(team, 'cancel-farm') }, /PLACED · WORKERS BUILDING|PLANNING BUILD/);
      spent[team].wood += 60;
    }
    await room.checkpoint(snapshot => [0, 1].every(team => snapshot.state.buildings.some(building => building.team === team
      && building.type === 'farm' && building.id !== farmIds[team] && building.progress > 0 && !building.complete)));
    const frozen = await stopWorkers(); record('partly-built-farm-frozen', frozen);
    for (const team of [0, 1]) {
      const farm = frozen.state.buildings.find(building => building.team === team && building.type === 'farm' && building.id !== farmIds[team]);
      assert.ok(farm.progress > 0 && farm.progress < 1); assert.equal(farm.harvestStock, 0);
      canceledIds.push(farm.id);
      await command(1 - team, { type: 'cancelConstruction', buildingId: farm.id }, /CANCEL REJECTED/);
      await command(team, { type: 'cancelConstruction', buildingId: farm.id }, /CONSTRUCTION CANCELLED/);
      spent[team].wood -= Math.round(60 * (1 - farm.progress) * 1e6) / 1e6;
    }
    const refunded = await room.checkpoint(snapshot => canceledIds.every(id => !snapshot.state.buildings.some(building => building.id === id)));
    for (const team of [0, 1]) {
      near(refunded.state.teamWood[team], map.startingResources.wood - spent[team].wood, 'frozen proportional refund');
      await command(team, { type: 'cancelConstruction', buildingId: canceledIds[team] }, /CANCEL REJECTED/);
    }
    record('no-crop-proportional-refund', refunded);
    for (const team of [0, 1]) await command(team, { type: 'gather', ids: [workers[team][0]], nodeId: ownStone(team)[1].id }, /GATHER ORDER/);
    await room.checkpoint(snapshot => workers.every(ids => snapshot.state.units[ids[0]].cargoType === 'stone' && snapshot.state.units[ids[0]].cargo > 0));
    const carrying = await recover('real-stone-cargo');
    const targetBanks = [0, 1].map(team => carrying.state.teamStone[team] + carrying.state.units[workers[team][0]].cargo);
    for (const team of [0, 1]) await command(team, { type: 'gather', ids: [workers[team][0]], nodeId: farmHarvestNodeId(farmIds[team]) }, /GATHER ORDER/);
    const returning = await room.checkpoint(snapshot => workers.every((ids, team) => snapshot.state.units[ids[0]].gatherNodeId === farmHarvestNodeId(farmIds[team])
      && snapshot.state.units[ids[0]].gatherPhase === 'to-base' && snapshot.state.units[ids[0]].cargoType === 'stone'));
    for (const team of [0, 1]) assert.notEqual(returning.state.units[workers[team][0]].dropoffBuildingId, own(returning, team, 'mill').id,
      'Stone return cannot use the nearby food-only Mill');
    record('farm-order-preserves-stone-return', returning);
    await room.checkpoint(snapshot => workers.every((ids, team) => snapshot.state.units[ids[0]].cargoType === 'food'
      && snapshot.state.units[ids[0]].cargo > 0 && Math.abs(snapshot.state.teamStone[team] - targetBanks[team]) < 1e-5));
    const foodCargo = await stopWorkers(); record('stone-delivered-before-farm-food', foodCargo);
    for (const team of [0, 1]) {
      near(foodCargo.state.teamStone[team], targetBanks[team], 'exact retained Stone deposited');
      await command(team, { type: 'returnCargo', ids: [workers[team][0]] }, /RETURN CARGO ORDER/);
    }
    const deposited = await room.checkpoint(snapshot => workers.every(ids => snapshot.state.units[ids[0]].cargo === 0));
    for (const team of [0, 1]) {
      const worker = deposited.state.units[workers[team][0]];
      assert.equal(worker.dropoffBuildingId, own(deposited, team, 'mill').id, 'Farm food chooses the nearer friendly Mill');
      near(deposited.state.teamFood[team], foodCargo.state.teamFood[team] + foodCargo.state.units[workers[team][0]].cargo, 'exact Farm food deposited');
      assert.equal(own(deposited, team, 'farm').harvestStock, own(foodCargo, team, 'farm').harvestStock);
      await command(team, { type: 'returnCargo', ids: [workers[team][0]] }, /RETURN CARGO REJECTED/);
    }
    record('farm-food-delivered-to-mill-once', deposited);
    await recover('mixed-paid-idle');
    return { mapPath, mapId: map.id, dimensions: [map.width, map.height], economyProfileId: profile, records };
  } finally { await room.dispose(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), outputArg = args.find(arg => arg.startsWith('--output='));
  assert.ok(args.every(arg => arg === outputArg), 'Usage: node scripts/farm-stone-paid-scenario.mjs [--output=NEW_DIRECTORY]');
  const output = outputArg ? path.resolve(outputArg.slice(9)) : null;
  if (output) await mkdir(output); // Do not overwrite earlier evidence.
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const sourceDirty = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim() !== '';
  const options = { outputDirectory: output }, sources = await captureDepotSources(ROOT, options);
  const settled = await Promise.allSettled(maps.map(verifyPaidFarmStone));
  await assertDepotSourcesUnchanged(ROOT, sources, options);
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(), sourceRevision, 'source revision stays fixed');
  const failures = settled.filter(result => result.status === 'rejected');
  if (failures.length) throw new AggregateError(failures.map(result => result.reason), 'Paid Farm/Stone scenario failed; rooms disposed');
  const report = { sourceRevision, sourceDirty, sourceContentSha256: sources.sourceContentSha256, nodeVersion: process.version,
    evidenceType: 'native-authoritative-commands', injectedState: false, humanMatches: 0,
    cases: settled.map(result => result.value),
    limits: ['Shipped 64x64 Stone laboratory and 80x72 Millrace are dated regression maps, not the developing 160x160 gameplay floor.',
      'No rendering, deployed revision, contested balance or human acceptance is inferred.'] };
  if (output) await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ stage: 'passed', cases: report.cases.length, sourceRevision, sourceDirty, output }));
}
