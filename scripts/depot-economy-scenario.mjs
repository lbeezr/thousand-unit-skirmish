import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { BUILDING_DEFINITIONS, GAMEPLAY_RULESET_REVISION } from '../src/gameplay-definitions.mjs';
import { DEPOT_CASES, DEPOT_LAYOUTS, DEPOT_STRATEGIES, depotCaseId, depotMap, depotPlot,
  depotCost, assertDepotLedger, summarizeDepotFrames, compareDepotResults } from './depot-economy-analysis.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const source = await readFile(path.join(ROOT, 'server.mjs'), 'utf8');
const constant = name => {
  const match = source.match(new RegExp(`const ${name} = ([0-9.]+);`));
  assert.ok(match, `measurement requires a literal ${name} contract`); return Number(match[1]);
};
const tickRate = constant('TICK_RATE');
const contract = { tickRate, gatherRate: constant('GATHER_RATE'), carryCapacity: constant('WORKER_CARRY_CAPACITY'),
  interactionRange: constant('WORKER_INTERACTION_RANGE') };

export async function measureDepotCase(spec, { windowSeconds = 60 } = {}) {
  const map = depotMap(spec), cost = depotCost(spec.strategy);
  const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 150_000 });
  let clients, token = 1;
  const command = (team, value, success) => clients[team].command({ ...value, clientOrderToken: token++ }, success);
  const frames = [];
  try {
    await fixture.start(); clients = [await fixture.connect(0), await fixture.connect(1)];
    clients[0].send({ type: 'publishMap', map });
    await Promise.all(clients.map(client => client.wait(message => message.type === 'mapChange' && message.state.mapId === map.id)));
    const workerIds = clients.map((client, team) => client.latest.units.filter(unit => unit[1] === team && unit[5] === 'worker').map(unit => unit[0]));
    const setup = [0, 1].map(team => ({ team, builders: spec.strategy === 'home' ? 0 : 4, commandTick: clients[team].latest.tick }));
    if (spec.strategy !== 'home') {
      for (const team of [0, 1]) await command(team, { type: 'build', buildingType: spec.strategy,
        ids: workerIds[team], ...depotPlot(spec.layout, team) }, /PLACED · WORKERS BUILDING/);
      for (const team of [0, 1]) {
        const completed = await clients[team].state(state => state.buildings.some(building => building.team === team
          && building.type === spec.strategy && building.complete), 'paid depot completes');
        setup[team].completedTick = completed.tick;
      }
    } else for (const seat of setup) seat.completedTick = seat.commandTick;
    for (const seat of setup) {
      seat.elapsedSeconds = (seat.completedTick - seat.commandTick) / tickRate;
      seat.reservedBuilderWorkerSeconds = seat.builders * seat.elapsedSeconds;
    }
    const paid = await fixture.checkpoint(snapshot => snapshot.mapDefinition.id === map.id
      && snapshot.state.teamFood.every(food => food === map.startingResources.food - cost.food)
      && snapshot.state.teamWood.every(wood => wood === map.startingResources.wood - cost.wood));
    assertDepotLedger(paid, map, cost);
    const ids = workerIds.map(rows => [...rows.slice(0, spec.foodWorkers).map(id => ({ id, type: 'food' })),
      { id: rows[3], type: 'wood' }]);
    for (const team of [0, 1]) {
      const unused = workerIds[team].filter(id => !ids[team].some(row => row.id === id));
      if (unused.length) await command(team, { type: 'move', ids: unused, x: team ? 26.5 : -26.5, z: -20.5 }, /MOVE ORDER/);
      for (const type of ['food', 'wood']) {
        const node = map.resourceNodes.find(row => row.id === `${type}-${team}`);
        await command(team, { type: 'move', ids: ids[team].filter(row => row.type === type).map(row => row.id), x: node.x, z: node.z }, /MOVE ORDER/);
      }
    }
    await fixture.checkpoint(snapshot => ids.every((rows, team) => rows.every(({ id, type }) => {
      const unit = snapshot.state.units[id], node = map.resourceNodes.find(row => row.id === `${type}-${team}`);
      return !unit.movePlanningPending && unit.pathIndex >= unit.path.length && Math.hypot(unit.x - node.x, unit.z - node.z) < 3;
    })));
    // Capture real, ordinary network snapshots at their simulation ticks.
    const observer = event => {
      const state = JSON.parse(event.data);
      if (state.type !== 'state' || state.mapId !== map.id) return;
      frames.push({ tick: state.tick, food: state.food, wood: state.wood,
        units: state.units.filter(unit => ids.flat().some(row => row.id === unit[0])).map(unit => unit.slice(0, 10)) });
    };
    clients[0].socket.addEventListener('message', observer);
    for (const team of [0, 1]) for (const type of ['food', 'wood']) await command(team,
      { type: 'gather', ids: ids[team].filter(row => row.type === type).map(row => row.id), nodeId: `${type}-${team}` }, /GATHER ORDER/);
    // Exclude initial positioning and the first delivery from the steady window.
    const delivered = new Set(); let deliveryCursor = 1;
    const hasFirstDelivery = () => {
      for (let index = deliveryCursor; index < frames.length; index++) {
        const a = frames[index - 1], b = frames[index];
        for (const unit of b.units) {
          const previous = a.units.find(row => row[0] === unit[0]);
          if (previous && previous[6] - unit[6] > contract.carryCapacity / 2) delivered.add(unit[0]);
        }
      }
      deliveryCursor = Math.max(1, frames.length);
      return ids.flat().every(row => delivered.has(row.id));
    };
    const warm = await clients[0].state(() => hasFirstDelivery(), 'every gatherer delivers a first full cargo');
    const endTick = warm.tick + windowSeconds * tickRate;
    await clients[0].state(state => state.tick >= endTick, 'full tick-based steady delivery window');
    const active = await fixture.checkpoint(snapshot => snapshot.state.tickNumber >= endTick);
    assertDepotLedger(active, map, cost);
    const seats = summarizeDepotFrames(frames, ids, warm.tick, endTick, tickRate, contract.carryCapacity);
    for (const seat of seats) {
      assert.ok(seat.workers.every(worker => worker.cycles.length > 0), 'every worker completes a repeat trip');
      seat.dropoffTargets = ids[seat.team].map(({ id, type }) => ({ id, type,
        buildingId: active.state.units[id].dropoffBuildingId,
        buildingType: active.state.buildings.find(building => building.id === active.state.units[id].dropoffBuildingId)?.type ?? 'home-town-center' }));
      if (spec.strategy === 'mill') assert.equal(seat.dropoffTargets.find(row => row.type === 'wood').buildingType, 'home-town-center');
    }
    for (const team of [0, 1]) await command(team, { type: 'stop', ids: workerIds[team] }, /STOP ORDER/);
    const stopped = await fixture.checkpoint(snapshot => workerIds.flat().every(id => snapshot.state.units[id].gatherPhase === ''));
    assertDepotLedger(stopped, map, cost);
    clients[0].socket.removeEventListener('message', observer);
    return { ...spec, caseId: depotCaseId(spec), cost, setup,
      definition: spec.strategy === 'home' ? { incrementalCost: false, footprint: 5 } : BUILDING_DEFINITIONS[spec.strategy],
      map, mapSha256: createHash('sha256').update(JSON.stringify(map)).digest('hex'),
      contract, windowSeconds, sampleCount: frames.length, seats,
      accounting: { paidBank: { food: paid.state.teamFood, wood: paid.state.teamWood },
        stoppedBank: { food: stopped.state.teamFood, wood: stopped.state.teamWood },
        stoppedNodes: stopped.state.resourceNodes.map(({ id, type, stock }) => ({ id, type, stock })),
        stoppedCargo: stopped.state.units.filter(unit => unit.cargo > 0).map(({ id, team, cargo, cargoType }) => ({ id, team, cargo, cargoType })),
        stockCargoBankConserved: true, injectedBanksOrCargo: false } };
  } finally { await fixture.dispose(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const outputArg = args.find(arg => arg.startsWith('--output='));
  const caseArg = args.find(arg => arg.startsWith('--case='));
  const smoke = args.includes('--smoke');
  assert.ok(args.every(arg => arg === outputArg || arg === caseArg || arg === '--smoke'), 'Usage: --output=NEW_DIRECTORY --case=LAYOUT/STRATEGY/1_OR_3 or --smoke');
  assert.ok(!(smoke && caseArg), 'smoke and explicit case are mutually exclusive');
  let cases = DEPOT_CASES;
  if (smoke) cases = [{ layout: 'remote-food', strategy: 'mill', foodWorkers: 3 }];
  if (caseArg) {
    const [layout, strategy, count, extra] = caseArg.slice(7).split('/');
    assert.ok(DEPOT_LAYOUTS.includes(layout) && DEPOT_STRATEGIES.includes(strategy) && ['1', '3'].includes(count) && !extra, 'known case');
    cases = [{ layout, strategy, foodWorkers: Number(count) }];
  }
  const output = outputArg ? path.resolve(outputArg.slice(9)) : null;
  if (output) {
    try { await stat(output); throw new Error(`Output already exists: ${output}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    await mkdir(output, { recursive: true });
  }
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const sourceStatus = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const sourceDirty = sourceStatus !== '';
  const results = new Array(cases.length); let next = 0, failed = false;
  // Independent rooms; this measures simulation ticks and economy, not host speed.
  const rooms = await Promise.allSettled(Array.from({ length: Math.min(4, cases.length) }, async () => {
    while (next < cases.length && !failed) {
      const index = next++, spec = cases[index];
      console.log(JSON.stringify({ stage: 'start', caseId: depotCaseId(spec) }));
      let measurement;
      try { measurement = await measureDepotCase(spec, { windowSeconds: smoke ? 20 : 60 }); }
      catch (error) { failed = true; throw error; }
      const result = { sourceRevision, sourceDirty, rulesetRevision: GAMEPLAY_RULESET_REVISION,
        evidenceType: 'authoritative-server-simulation', ...measurement };
      results[index] = result;
      if (output) await writeFile(path.join(output, `${result.caseId}.json`), JSON.stringify(result, null, 2) + '\n');
      console.log(JSON.stringify({ stage: 'complete', caseId: result.caseId, rates: result.seats.map(seat => seat.depositedPerMinute) }));
    }
  }));
  const errors = rooms.filter(room => room.status === 'rejected').map(room => room.reason);
  if (errors.length) throw new AggregateError(errors, 'Depot study failed; all active rooms were cleaned up');
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(), sourceRevision,
    'freeze the source revision during measurement');
  assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim(), sourceStatus,
    'freeze the working tree during measurement');
  const report = { version: 1, evidenceType: 'authoritative-server-simulation', humanMatches: 0,
    sourceRevision, sourceDirty, rulesetRevision: GAMEPLAY_RULESET_REVISION, nodeVersion: process.version,
    cases: results, comparisons: !smoke && !caseArg ? compareDepotResults(results) : [],
    limits: ['Uncontested flat maps; no raids, depletion, player decisions or native rendering.',
      'Positions/cargo are wire samples at 0.1-second resolution; final conservation uses authoritative checkpoint values.',
      'Deposited rates use each case\'s declared finite window; cycle means describe sampled repeated trips.',
      'Wood premium repayment excludes construction opportunity and does not convert food to wood.'] };
  if (output) await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ stage: 'passed', cases: results.length, sourceRevision, sourceDirty, output }));
}
