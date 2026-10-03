import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { BUILDING_DEFINITIONS as B, TECHNOLOGY_DEFINITIONS as T, UNIT_DEFINITIONS as U, GAMEPLAY_RULESET_REVISION } from '../src/gameplay-definitions.mjs';
import { townCenterFootprintCells } from '../src/town-center-spawn.mjs';

const pads = [
  ['house', -26.5, 12.5], ['house', -22.5, 12.5], ['house', -18.5, 12.5],
  ['storehouse', -25.5, 4.5], ['mill', -28.5, 18.5], ['barracks', -20.5, -6.5],
  ['archery-range', -25.5, -6.5], ['stable', -14.5, -6.5],
  ['watchtower', -9.5, -1.5], ['town-center', -10.5, 8.5], ['workshop', -14.5, 1.5],
  ['palisade-wall', -28.5, -14.5],
];
const products = [
  ['home', 'worker'], ['town-center', 'worker'], ['barracks', 'infantry'],
  ['barracks', 'spearman'], ['archery-range', 'archer'], ['stable', 'scout'],
  ['stable', 'rider'], ['workshop', 'siege-engine'],
];
const upgrades = ['military-tier-2', 'infantry-attack', 'archer-attack', 'military-armor', 'siege-engineering', 'mounted-attack'];
const map = { id: 'mature-settlement-audit', name: 'Mature Settlement Audit', width: 64, height: 64,
  terrainSeed: 19, fogOfWar: false, startingArmySize: 24, startingResources: { food: 2000, wood: 3000 },
  spawnPoints: [{ team: 0, x: -20.5, z: 0 }, { team: 1, x: 20.5, z: 0 }],
  obstacles: [], triggers: [], scenarioEvents: [],
  resourceNodes: [0, 1].flatMap(team => ['food', 'wood'].map((type, i) => ({
    id: `s${team}-${type}`, type, x: (team ? 1 : -1) * (18.5 + i * 4), z: 20.5, stock: 200,
  }))),
};
export const matureSettlementPlan = { map, pads, products, upgrades };
export function settlementLayout() {
  const blocked = new Set(), size = map.width * map.height;
  for (const team of [0, 1]) {
    for (const cell of townCenterFootprintCells(map.spawnPoints, team, map.width, map.height)) blocked.add(cell);
    for (const [type, leftX, z] of pads) {
      const cx = Math.floor((team ? -leftX : leftX) + map.width / 2), cz = Math.floor(z + map.height / 2);
      const half = Math.floor(B[type].footprint / 2);
      for (let row = cz - half; row <= cz + half; row++) for (let column = cx - half; column <= cx + half; column++) {
        assert.ok(column >= 0 && column < map.width && row >= 0 && row < map.height, 'footprint inside map');
        const cell = row * map.width + column;
        assert.ok(!blocked.has(cell), 'no overlapping footprints'); blocked.add(cell);
      }
    }
  }
  const first = [...Array(size).keys()].find(cell => !blocked.has(cell));
  const visited = new Set([first]), queue = [first];
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i], x = cell % map.width, z = Math.floor(cell / map.width);
    for (const [column, row] of [[x - 1, z], [x + 1, z], [x, z - 1], [x, z + 1]]) {
      const next = row * map.width + column;
      if (column < 0 || column >= map.width || row < 0 || row >= map.height || blocked.has(next) || visited.has(next)) continue;
      visited.add(next); queue.push(next);
    }
  }
  assert.equal(visited.size, size - blocked.size, 'all free ground connected');
  return { blockedCells: blocked.size, connectedFreeCells: visited.size };
}
const bank = (state, team) => ({ food: state.teamFood[team], wood: state.teamWood[team] });
export function assertSettlementLedger(saved, spent) {
  for (const team of [0, 1]) for (const resource of ['food', 'wood']) {
    const node = map.resourceNodes.find(n => n.id === `s${team}-${resource}`);
    const stock = saved.state.resourceNodes.find(n => n.id === node.id).stock;
    const cargo = saved.state.units.filter(u => u.team === team && u.cargoType === resource).reduce((n, u) => n + u.cargo, 0);
    const expected = map.startingResources[resource] - spent[team][resource] + node.stock - stock - cargo;
    assert.ok(Math.abs(bank(saved.state, team)[resource] - expected) < 1e-5, `team${team} ${resource} bank equals paid ledger plus deposits`);
  }
}
async function main() {
  const options = process.argv.slice(2), reverse = options.includes('--reverse-seats');
  const outputOption = options.find(arg => arg.startsWith('--output='));
  if (options.some(arg => arg !== '--reverse-seats' && arg !== outputOption)
    || options.filter(arg => arg.startsWith('--output=')).length > 1 || outputOption === '--output=') {
    throw new Error('Usage: node scripts/mature-settlement-scenario.mjs [--reverse-seats] [--output=NEW_DIRECTORY]');
  }
  const output = outputOption ? path.resolve(outputOption.slice('--output='.length)) : null;
  if (output) {
    try { await stat(output); throw new Error('Output directory already exists: ' + output); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const layout = settlementLayout(), teams = reverse ? [1, 0] : [0, 1];
  const spent = [{ food: 0, wood: 0 }, { food: 0, wood: 0 }], ledger = [];
  const locks = [Promise.resolve(), Promise.resolve()];
  const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 90_000 });
  let clients, tokens, order = 1;
  const started = Date.now();
  const log = message => console.log(JSON.stringify({ stage: message, elapsed: Math.round((Date.now() - started) / 1000) }));
  const assertLedger = saved => assertSettlementLedger(saved, spent);
  async function notice(team, command, success) {
    const client = clients[team], after = client.messages.length;
    client.send({ ...command, clientOrderToken: order++ });
    const reply = await client.wait(m => m.type === 'notice' && (success.test(m.message) || /REJECTED|BLOCKED|CAP REACHED/.test(m.message)), `${command.type} ${command.buildingType || command.upgrade || command.kind || ''}`, after);
    assert.match(reply.message, success);
  }
  function pay(team, command, definition, success) {
    const next = locks[team].then(async () => {
      await notice(team, command, success);
      for (const resource of ['food', 'wood']) spent[team][resource] += definition.cost[resource];
      const observed = await clients[team].state(s => s.food[team] === map.startingResources.food - spent[team].food
        && s.wood[team] === map.startingResources.wood - spent[team].wood, 'actual paid bank debit');
      ledger.push({ team, command: command.type, type: command.buildingType || command.upgrade || command.kind, cost: definition.cost,
        bank: { food: observed.food[team], wood: observed.wood[team] }, tick: observed.tick });
    });
    locks[team] = next; return next;
  }
  function producer(team, type) {
    return type === 'home' ? clients[team].latest.homeTownCenters.find(b => b.team === team)
      : clients[team].latest.buildings.find(b => b.team === team && b.type === type);
  }
  async function buildAll(team) {
    const ids = clients[team].latest.units.filter(u => u[1] === team && u[5] === 'worker').map(u => u[0]);
    for (const [type, leftX, z] of pads) {
      if (type === 'workshop') await fixture.checkpoint(s => s.state.teamUpgrades[team].militaryTier2);
      const x = team ? -leftX : leftX;
      await pay(team, { type: 'build', buildingType: type, ids, x, z }, B[type],
        type === 'palisade-wall' ? /PALISADE LINE PLACED/ : /PLACED · WORKERS BUILDING/);
      await clients[team].state(s => s.buildings.some(b => b.team === team && b.type === type && b.x === x && b.z === z && b.complete), `completed ${type}`);
      log(`team${team} ${type} complete`);
    }
  }
  async function research(team, upgrade, complete = true) {
    const definition = T[upgrade], type = definition.building === 'town-center' ? 'home' : definition.building;
    await clients[team].state(s => type === 'home' || s.buildings.some(b => b.team === team && b.type === type && b.complete), `research producer ${type}`);
    await pay(team, { type: 'researchUpgrade', upgrade, buildingId: producer(team, type).id }, definition, /STARTED/);
    if (complete) await fixture.checkpoint(s => s.state.teamUpgrades[team][definition.upgradeKey]);
    log(`team${team} ${upgrade} ${complete ? 'complete' : 'paid'}`);
  }
  function assertMature(saved) {
    assertLedger(saved);
    for (const team of [0, 1]) {
      const buildings = saved.state.buildings.filter(b => b.team === team);
      assert.equal(buildings.length, pads.length); assert.ok(buildings.every(b => b.complete));
      for (const type of Object.keys(B)) {
        const expected = pads.filter(([plannedType]) => plannedType === type).length;
        assert.equal(buildings.filter(b => b.type === type).length, expected,
          `team${team} ${type} count matches the paid fixture plan`);
      }
      for (const { upgradeKey } of Object.values(T)) assert.equal(saved.state.teamUpgrades[team][upgradeKey], true);
      assert.equal(saved.state.teamResearch[team], null);
      assert.equal(saved.state.units.filter(u => u.team === team).length, 20);
      for (const kind of Object.keys(U).filter(kind => U[kind].movementDomain !== 'water')) assert.ok(saved.state.units.some(u => u.team === team && u.kind === kind && u.hp > 0));
      assert.ok(buildings.every(b => !b.queue && !b.productionBlocked));
      assert.equal(saved.state.workerProduction[team].queue, 0);
      assert.deepEqual(spent[team], { food: 1385, wood: 2720 });
      assert.equal(clients[team].latest.population[team].capacity, 44);
      assert.equal(clients[team].latest.population[team].used, 23);
    }
  }
  try {
    await fixture.start(); clients = [await fixture.connect(0), await fixture.connect(1)];
    tokens = clients.map(c => c.welcome.player.sessionToken);
    clients[0].send({ type: 'publishMap', map });
    await Promise.all(clients.map(c => c.wait(m => m.type === 'mapChange' && m.state.mapId === map.id, 'fixture map published')));
    log('map admitted');
    // Independent construction and serialized per-seat research run at ordinary speed.
    await Promise.all(teams.flatMap(team => [buildAll(team), (async () => {
      for (const upgrade of upgrades.slice(0, -1)) await research(team, upgrade);
    })()]));
    log('buildings and first five technologies complete');
    // Put gatherers by their real nodes before starting the short paid queues.
    for (const team of teams) {
      const workers = clients[team].latest.units.filter(u => u[1] === team && u[5] === 'worker');
      for (const [i, type] of ['food', 'wood'].entries()) {
        const node = map.resourceNodes.find(n => n.id === `s${team}-${type}`), id = workers[i][0];
        await notice(team, { type: 'move', ids: [id], x: node.x, z: node.z }, /MOVE ORDER/);
        await clients[team].state(s => s.units.some(u => u[0] === id && Math.hypot(u[2] - node.x, u[3] - node.z) < 1.5), 'gatherer reaches node');
      }
    }
    await Promise.all(teams.map(async team => {
      await research(team, upgrades.at(-1), false);
      for (const [type, kind] of products) await pay(team,
        { type: 'trainUnit', buildingId: producer(team, type).id, kind }, U[kind], /QUEUED/);
    }));
    const queued = await fixture.checkpoint(s => s.state.teamResearch.every(Boolean)
      && s.state.workerProduction.every(p => p.queue === 1)
      && s.state.buildings.filter(b => B[b.type].products.length).every(b => b.queue > 0));
    assertLedger(queued);
    for (const team of teams) {
      const workers = clients[team].latest.units.filter(u => u[1] === team && u[5] === 'worker');
      for (const [i, type] of ['food', 'wood'].entries()) await notice(team,
        { type: 'gather', ids: [workers[i][0]], nodeId: `s${team}-${type}` }, /GATHER ORDER/);
    }
    await fixture.checkpoint(s => [0, 1].every(team => ['food', 'wood'].every(resource =>
      s.state.units.some(u => u.team === team && u.cargoType === resource && u.cargo > 0))));
    await fixture.stop();
    const before = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
    assertLedger(before);
    assert.ok(before.state.teamResearch.every(Boolean), 'restart has actual paid research in flight');
    assert.ok(before.state.workerProduction.every(p => p.queue > 0), 'restart has actual paid Worker queues');
    assert.ok([0, 1].every(team => ['food', 'wood'].every(resource =>
      before.state.units.some(u => u.team === team && u.cargoType === resource && u.cargo > 0))), 'both seats restart with both cargo types');
    log('restart with research, queues and cargo');
    await fixture.start(); clients = [await fixture.connect(0, tokens[0]), await fixture.connect(1, tokens[1])];
    for (const client of clients) {
      assert.equal(client.welcome.recoveredFromCheckpoint, true); assert.equal(client.welcome.matchId, before.matchId);
      assert.ok(client.latest.tick >= before.state.tickNumber);
    }
    const after = await fixture.checkpoint(s => s.sequence > before.sequence && s.state.tickNumber >= before.state.tickNumber);
    assertLedger(after);
    assert.deepEqual(after.state.units.map(u => [u.id, u.generation, u.team, u.kind]), before.state.units.map(u => [u.id, u.generation, u.team, u.kind]));
    assert.deepEqual(after.state.buildings.map(b => [b.id, b.team, b.type, b.productionQueue]), before.state.buildings.map(b => [b.id, b.team, b.type, b.productionQueue]));
    assert.deepEqual(after.state.teamUpgrades, before.state.teamUpgrades);
    assert.deepEqual(after.state.teamResearch.map(r => [r.type, r.buildingId]), before.state.teamResearch.map(r => [r.type, r.buildingId]));
    assert.ok(after.state.teamResearch.every((r, team) => r.remaining <= before.state.teamResearch[team].remaining));
    assert.ok(after.state.matchElapsedSeconds >= before.state.matchElapsedSeconds);
    assert.equal(after.state.scenarioClockStarted, before.state.scenarioClockStarted);
    assert.deepEqual(after.state.scenarioEventStates, before.state.scenarioEventStates);
    assert.deepEqual(after.state.triggerStates, before.state.triggerStates);
    assert.deepEqual(after.state.victoryHoldState, before.state.victoryHoldState);
    assert.equal(after.state.forestEpoch, before.state.forestEpoch);
    const matured = await fixture.checkpoint(s => s.state.teamResearch.every(r => r === null)
      && s.state.workerProduction.every(p => p.queue === 0) && s.state.buildings.every(b => b.queue === 0));
    assertMature(matured); log('all paid products exited');
    // Park all armies by their settlement, preserving live movement/production rules.
    for (const team of teams) await notice(team, { type: 'move', ids: clients[team].latest.units.filter(u => u[1] === team).map(u => u[0]), x: team ? 20.5 : -20.5, z: -16.5 }, /MOVE ORDER/);
    await clients[0].state(s => s.units.every(u => Math.abs(u[3] + 16.5) < 5), 'all mixed units exit settlement and move');
    await fixture.stop();
    const checkpointBytes = await readFile(fixture.checkpointPath), checkpoint = JSON.parse(checkpointBytes);
    assertMature(checkpoint);
    await fixture.start(); clients = [await fixture.connect(0, tokens[0]), await fixture.connect(1, tokens[1])];
    const afterReset = clients[0].messages.length;
    clients[0].send({ type: 'reset' });
    await clients[0].wait(m => m.type === 'notice' && m.message === 'BATTLEFIELD RESET', 'host reset', afterReset);
    const resetBroadcast = await clients[0].wait(m => m.type === 'state' && m.buildings.length === 0
      && m.units.length === map.startingArmySize, 'reset broadcast', afterReset);
    assert.equal(resetBroadcast.matchElapsedSeconds, 0); assert.equal(resetBroadcast.scenarioClockStarted, false);
    const reset = await fixture.checkpoint(s => s.state.buildings.length === 0 && s.state.units.length === map.startingArmySize);
    assert.equal(reset.mapDefinition.id, map.id);
    assert.deepEqual(reset.state.teamFood, [2000, 2000]); assert.deepEqual(reset.state.teamWood, [3000, 3000]);
    assert.ok(reset.state.teamUpgrades.every(up => Object.values(up).every(v => v === false)));
    assert.ok(reset.state.teamResearch.every(r => r === null)); assert.ok(reset.state.workerProduction.every(p => p.queue === 0));
    assert.ok(reset.state.units.every(u => u.cargo === 0));
    assert.deepEqual(reset.state.resourceNodes.map(n => n.stock), map.resourceNodes.map(n => n.stock));
    const result = { fixtureVersion: 1, map: map.id, rulesetRevision: GAMEPLAY_RULESET_REVISION,
      sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8' }).trim(),
      sourceDirty: execFileSync('git', ['status', '--porcelain'], { cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8' }).trim() !== '',
      reverseSeats: reverse, elapsedSeconds: (Date.now() - started) / 1000, layout, spent, ledger,
      restartCargo: before.state.units.reduce((n, u) => n + u.cargo, 0),
      paidConstruction: true, paidResearch: true, paidProductionExits: true, restoredQueuesResearchCargo: true,
      hostReset: true, visualQA: 'not captured', checkpointSha256: createHash('sha256').update(checkpointBytes).digest('hex') };
    if (output) {
      await mkdir(output);
      await writeFile(path.join(output, 'match.json'), checkpointBytes);
      await writeFile(path.join(output, 'manifest.json'), JSON.stringify(result, null, 2) + '\n');
      await writeFile(path.join(output, 'map.json'), JSON.stringify(map, null, 2) + '\n');
    }
    console.log(JSON.stringify({ ...result, ledger: `${ledger.length} actual paid commands` }));
  } finally { await fixture.dispose(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
