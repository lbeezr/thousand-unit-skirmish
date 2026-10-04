// Paired ordinary economy openings on unmodified Millrace. Construction time,
// travel and first deliveries are included; no balance multiplier is applied.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { captureDepotSources, assertDepotSourcesUnchanged } from './depot-source-snapshot.mjs';
import { summarizeDepotFrames } from './depot-economy-analysis.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { farmHarvestNodeId } from '../src/farm-harvest.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const mapPath = 'maps/bellweather-millrace.json';
const map = JSON.parse(await readFile(path.join(ROOT, mapPath), 'utf8'));
const server = await readFile(path.join(ROOT, 'server.mjs'), 'utf8');
const constant = name => {
  const match = server.match(new RegExp(`const ${name} = ([0-9.]+);`));
  assert.ok(match, `measurement requires literal ${name}`); return Number(match[1]);
};
const contract = { tickRate: constant('TICK_RATE'), gatherRate: constant('GATHER_RATE'),
  carryCapacity: constant('WORKER_CARRY_CAPACITY') };
const near = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-5, `${message}: ${a} versus ${b}`);

export async function measureFarmFoodPair(farmTeam, { workerCount = 3, windowSeconds = 60 } = {}) {
  // Keep the declared opening windows before Millrace's timed supply rewards.
  assert.ok([0, 1].includes(farmTeam) && [1, 3].includes(workerCount) && [20, 60].includes(windowSeconds),
    'paired opening supports only 20-second smoke or 60-second measurements');
  const room = await createFortifiedFixture({ mapPath, timeoutMs: 90_000 });
  const frames = [[], []], observers = [];
  let clients, token = 1;
  const command = async (team, payload, expected) => {
    const notice = await clients[team].command({ ...payload, clientOrderToken: token++ }, /./);
    assert.match(notice.message, expected); return notice;
  };
  try {
    await room.start(); clients = [await room.connect(0), await room.connect(1)];
    for (const team of [0, 1]) {
      assert.equal(clients[team].welcome.map.id, map.id);
      await command(team, { type: 'stop', ids: clients[team].latest.units.filter(unit => unit[1] === team).map(unit => unit[0]) }, /STOP ORDER/);
    }
    const initial = await room.checkpoint();
    assert.deepEqual(initial.mapDefinition.resourceNodes, map.resourceNodes);
    assert.deepEqual(initial.state.teamFood, [map.startingResources.food, map.startingResources.food]);
    assert.deepEqual(initial.state.teamWood, [map.startingResources.wood, map.startingResources.wood]);
    const ids = clients.map((client, team) => client.latest.units.filter(unit => unit[1] === team && unit[5] === 'worker').slice(0, workerCount).map(unit => unit[0]));
    assert.ok(ids.every(rows => rows.length === workerCount));
    const startTick = Math.max(...clients.map(client => client.latest.tick));
    const endTick = startTick + windowSeconds * contract.tickRate;
    const capture = (team, state) => frames[team].push({ tick: state.tick, food: state.food, wood: state.wood,
      units: state.units.filter(unit => ids[team].includes(unit[0])).map(unit => unit.slice(0, 10)) });
    for (const team of [0, 1]) {
      capture(team, clients[team].latest);
      const observer = event => {
        const state = JSON.parse(event.data);
        if (state.type === 'state' && state.mapId === map.id) capture(team, state);
      };
      observers.push(observer); clients[team].socket.addEventListener('message', observer);
    }
    const neutralTeam = 1 - farmTeam, spawn = map.spawnPoints.find(point => point.team === neutralTeam);
    const neutral = map.resourceNodes.filter(node => node.type === 'food' && node.wildlifeSpecies === undefined)
      .sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z))[0];
    const home = map.spawnPoints.find(point => point.team === farmTeam);
    const plot = { x: home.x + (farmTeam ? 4 : -4), z: home.z + 6 };
    const setup = [0, 1].map(team => ({ team, strategy: team === farmTeam ? 'paid-farm' : 'nearby-neutral-food',
      workerCount, sourceId: team === farmTeam ? null : neutral.id, commandTick: clients[team].latest.tick }));
    // Each opening gets the same Worker budget from the common start. Farm
    // builders become harvesters only after actual paid construction completes.
    await command(farmTeam, { type: 'build', buildingType: 'farm', ids: ids[farmTeam], ...plot }, /PLACED · WORKERS BUILDING|PLANNING BUILD/);
    await command(neutralTeam, { type: 'gather', ids: ids[neutralTeam], nodeId: neutral.id }, /GATHER ORDER/);
    const complete = await clients[farmTeam].state(state => state.buildings.some(building => building.team === farmTeam
      && building.type === 'farm' && building.complete), 'ordinary paid Farm construction');
    const farm = complete.buildings.find(building => building.team === farmTeam && building.type === 'farm');
    setup[farmTeam].completedTick = complete.tick;
    setup[farmTeam].elapsedBuildSeconds = (complete.tick - setup[farmTeam].commandTick) / contract.tickRate;
    setup[farmTeam].reservedBuilderWorkerSeconds = workerCount * setup[farmTeam].elapsedBuildSeconds;
    setup[farmTeam].sourceId = farmHarvestNodeId(farm.id);
    setup[farmTeam].plot = { x: farm.x, z: farm.z };
    assert.equal(farm.harvestStock, BUILDING_DEFINITIONS.farm.harvest.stock);
    near(complete.wood[farmTeam], map.startingResources.wood - BUILDING_DEFINITIONS.farm.cost.wood, 'ordinary Farm debit');
    await command(farmTeam, { type: 'gather', ids: ids[farmTeam], nodeId: setup[farmTeam].sourceId }, /GATHER ORDER/);
    await Promise.all(clients.map(client => client.state(state => state.tick >= endTick, 'full tick-based opening window')));
    const summaries = [0, 1].map(team => {
      const allocation = [[], []]; allocation[team] = ids[team].map(id => ({ id, type: 'food' }));
      // Every seat uses its own authorized fog-filtered observations.
      const seat = summarizeDepotFrames(frames[team], allocation, startTick, endTick, contract.tickRate, contract.carryCapacity)[team];
      return { ...setup[team], startTick: seat.startTick, endTick: seat.endTick, seconds: seat.seconds,
        depositedFood: seat.deposited.food, foodPerMinute: seat.depositedPerMinute.food,
        sampleCount: frames[team].filter(frame => frame.tick >= seat.startTick && frame.tick <= seat.endTick).length,
        workers: seat.workers };
    });
    for (const team of [0, 1]) await command(team, { type: 'stop', ids: ids[team] }, /STOP ORDER/);
    const stopped = await room.checkpoint(snapshot => ids.flat().every(id => snapshot.state.units[id].gatherPhase === ''));
    assert.deepEqual(stopped.mapDefinition.resourceNodes, map.resourceNodes);
    const initialFood = map.resourceNodes.reduce((sum, node) => sum + (node.type === 'food' ? node.stock : 0), 0)
      + 2 * map.startingResources.food + BUILDING_DEFINITIONS.farm.harvest.stock;
    const finalFood = stopped.state.resourceNodes.reduce((sum, node) => sum + (node.type === 'food' ? node.stock : 0), 0)
      + stopped.state.units.reduce((sum, unit) => sum + (unit.cargoType === 'food' ? unit.cargo : 0), 0)
      + stopped.state.teamFood.reduce((sum, balance) => sum + balance, 0)
      + stopped.state.buildings.find(building => building.id === farm.id).harvestStock;
    near(finalFood, initialFood, 'authored stock + crop + bank + real cargo conserved');
    for (const team of [0, 1]) {
      near(stopped.state.teamWood[team], map.startingResources.wood - (team === farmTeam ? BUILDING_DEFINITIONS.farm.cost.wood : 0), 'only Farm consumes wood');
      const cargo = ids[team].reduce((sum, id) => sum + stopped.state.units[id].cargo, 0);
      const consumed = team === farmTeam ? BUILDING_DEFINITIONS.farm.harvest.stock - stopped.state.buildings.find(building => building.id === farm.id).harvestStock
        : neutral.stock - stopped.state.resourceNodes.find(node => node.id === neutral.id).stock;
      near(stopped.state.teamFood[team] - map.startingResources.food + cargo, consumed, 'seat source draw equals delivered food plus carried food');
      summaries[team].stopped = { tick: stopped.state.tickNumber, deliveredFood: stopped.state.teamFood[team] - map.startingResources.food,
        foodCargo: cargo, sourceConsumed: consumed, sourceStock: (team === farmTeam ? BUILDING_DEFINITIONS.farm.harvest.stock : neutral.stock) - consumed };
    }
    for (const team of [0, 1]) {
      const hasCargo = ids[team].some(id => stopped.state.units[id].cargo > 0);
      await command(team, { type: 'returnCargo', ids: ids[team] }, hasCargo ? /RETURN CARGO ORDER/ : /RETURN CARGO REJECTED/);
    }
    const returned = await room.checkpoint(snapshot => ids.flat().every(id => snapshot.state.units[id].cargo === 0));
    for (const team of [0, 1]) {
      near(returned.state.teamFood[team] - map.startingResources.food, summaries[team].stopped.sourceConsumed, 'final real cargo return credits food exactly once');
      summaries[team].finalReturnedFood = returned.state.teamFood[team] - map.startingResources.food;
    }
    return { farmTeam, workerCount, nominalWindowSeconds: windowSeconds, startTick, endTick,
      mapPath, mapId: map.id, dimensions: [map.width, map.height], matchMode: clients[0].latest.matchModeId,
      contract, farmDefinition: BUILDING_DEFINITIONS.farm, neutral: { id: neutral.id, x: neutral.x, z: neutral.z, stock: neutral.stock },
      summaries, accounting: { stockCargoBankConserved: true, injectedState: false }, frames };
  } finally {
    for (const team of [0, 1]) if (clients?.[team] && observers[team]) clients[team].socket.removeEventListener('message', observers[team]);
    await room.dispose();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), outputArg = args.find(arg => arg.startsWith('--output=')), workerArg = args.find(arg => arg.startsWith('--workers='));
  const smoke = args.includes('--smoke'), workerCount = workerArg ? Number(workerArg.slice(10)) : 3;
  assert.ok(args.every(arg => arg === outputArg || arg === workerArg || arg === '--smoke') && [1, 3].includes(workerCount),
    'Usage: [--workers=1|3] [--smoke] [--output=NEW_DIRECTORY]');
  const output = outputArg ? path.resolve(outputArg.slice(9)) : null;
  if (output) await mkdir(output);
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const sourceDirty = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim() !== '';
  const options = { outputDirectory: output }, sources = await captureDepotSources(ROOT, options);
  const settled = await Promise.allSettled([0, 1].map(team => measureFarmFoodPair(team, { workerCount, windowSeconds: smoke ? 20 : 60 })));
  await assertDepotSourcesUnchanged(ROOT, sources, options);
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(), sourceRevision, 'measurement source stays fixed');
  const failures = settled.filter(result => result.status === 'rejected');
  if (failures.length) throw new AggregateError(failures.map(result => result.reason), 'Paired food measurement failed; all rooms disposed');
  const cases = settled.map(result => result.value);
  if (output) for (const result of cases) for (const team of [0, 1]) {
    await writeFile(path.join(output, `farm-seat-${result.farmTeam}-observer-${team}.json`), JSON.stringify(result.frames[team]) + '\n');
  }
  const report = { sourceRevision, sourceDirty, sourceContentSha256: sources.sourceContentSha256, nodeVersion: process.version,
    evidenceType: 'native-authoritative-paired-openings', humanMatches: 0, smoke,
    cases: cases.map(({ frames, ...result }) => result),
    limits: ['Uncontested shipped 80x72 Millrace; this does not establish the developing 160x160 gameplay floor.',
      'Equal Workers, reversed seats, real starting stocks. Farm construction and first travel/deliveries remain in the opening window.',
      'Cargo and positions are wire samples. Exact conservation uses stopped checkpoints; later returns are separate from timed deposits.',
      'Stationary no-cargo-increase time includes building/waiting; it is not a claim of idle Worker time.',
      'No food-to-wood exchange rate, tuning, renderer, deployed revision or human balance acceptance is inferred.'] };
  if (output) {
    await writeFile(path.join(output, 'source-inputs.json'), JSON.stringify(sources, null, 2) + '\n');
    await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify({ stage: 'passed', sourceRevision, sourceDirty, workerCount, smoke,
    cases: report.cases.map(result => ({ farmTeam: result.farmTeam, summaries: result.summaries.map(({ team, strategy, seconds, depositedFood, foodPerMinute }) =>
      ({ team, strategy, seconds, depositedFood, foodPerMinute })) })), output }));
}
