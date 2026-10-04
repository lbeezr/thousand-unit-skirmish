// Real harvesting and movement on the authored map; checkpoints are read-only.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { BUILDING_DEFINITIONS, UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { buildElevationGrid } from '../src/map-utils.mjs';
import { canTraverseElevation } from '../src/elevation.mjs';
import { townCenterFootprintCells } from '../src/town-center-spawn.mjs';

const map = JSON.parse(await readFile(new URL('../maps/underbough-rootways.json', import.meta.url), 'utf8'));
const grove = map.triggers.find(t => t.id === 'post-2').zone;
const levels = buildElevationGrid(map.width, map.height, map.elevationPatches);
const belts = [[40, 41, 42, 43], [55, 54, 53, 52]].map(columns => columns.map(c => 36 * map.width + c));
const woodPerCell = 6;
const firstSupply = Math.min(...map.scenarioEvents.filter(e => e.type === 'timed-supply').map(e => e.afterSeconds));
const fixture = await createFortifiedFixture({ mapPath: 'maps/underbough-rootways.json', timeoutMs: 90000 });
let clients, token = 1, stage = 'startup';
const own = (client, team, kind) => client.latest.units.filter(u => u[1] === team && u[4] > 0 && u[5] === kind);
const cellOf = unit => Math.floor(unit[3] + map.height / 2) * map.width + Math.floor(unit[2] + map.width / 2);
const pointOf = cell => ({ x: cell % map.width - map.width / 2 + .5, z: Math.floor(cell / map.width) - map.height / 2 + .5 });
const stockAt = (state, cell) => state.forestStocks.find(([id]) => id === cell)?.[1] ?? woodPerCell;
const seatDraw = (state, team) => state.forestStocks.filter(([cell]) =>
  (cell % map.width < map.width / 2 ? 0 : 1) === team).reduce((sum, [, stock]) => sum + woodPerCell - stock, 0);
function visible(state, cell) {
  const bytes = Buffer.from(state.visibility.data, 'base64');
  return ((bytes[cell >> 2] >> ((cell & 3) * 2)) & 3) === 2;
}
function assertNoRewards(state) {
  assert.ok(state.matchElapsedSeconds < firstSupply, 'harvesting finishes before timed supplies');
  assert.ok(state.scenarioEventStates.every(e => !e.fired), 'no supply reward contributes wood');
  assert.ok(state.triggerStates.every(o => o.owner === -1), 'no capture reward contributes wood');
}
async function order(client, type, ids, extra = {}, notice = /ORDER/) {
  const result = await client.command({ type, ids,
    unitGenerations: ids.map(id => client.latest.units.find(u => u[0] === id)?.[8]),
    ...extra, clientOrderToken: token++ }, new RegExp(`${notice.source}|REJECTED|FOREST CELL (CLEARED|UNREACHABLE)|NO REACHABLE WORKERS`));
  assert.match(result.message, notice, `${type}: ${result.message}`);
  return result;
}

// Geometry is measured from actual cleared stocks and building footprints.
// This shortest orthogonal route is separate from the live traversal assertion.
function distanceToGrove(team, state) {
  const blocked = new Uint8Array(map.width * map.height);
  for (const o of map.obstacles) for (let r = o.row; r < o.row + o.height; r++) {
    for (let c = o.column; c < o.column + o.width; c++) blocked[r * map.width + c] = 1;
  }
  for (const [cell, stock] of state.forestStocks) if (stock === 0) blocked[cell] = 0;
  for (const seat of [0, 1]) for (const cell of townCenterFootprintCells(map.spawnPoints, seat, map.width, map.height)) blocked[cell] = 1;
  for (const b of state.buildings) if (b.hp > 0) for (const cell of b.footprint) blocked[cell] = 1;
  const spawn = map.spawnPoints.find(s => s.team === team);
  const start = Math.floor(spawn.z + map.height / 2) * map.width + Math.floor(spawn.x + map.width / 2);
  const distances = new Int32Array(blocked.length).fill(-1), queue = [start];
  distances[start] = 0;
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i], c = cell % map.width, r = Math.floor(cell / map.width);
    if (c >= grove.column && c < grove.column + grove.width && r >= grove.row && r < grove.row + grove.height) return distances[cell];
    for (const next of [c > 0 ? cell - 1 : -1, c + 1 < map.width ? cell + 1 : -1,
      r > 0 ? cell - map.width : -1, r + 1 < map.height ? cell + map.width : -1]) {
      if (next < 0 || blocked[next] || distances[next] >= 0 || !canTraverseElevation(levels, cell, next)) continue;
      distances[next] = distances[cell] + 1; queue.push(next);
    }
  }
  throw new Error(`seat ${team} cannot reach Supply Grove`);
}

const paidWorkers = [], results = [];
try {
  await fixture.start(); clients = [await fixture.connect(0), await fixture.connect(1)];
  stage = 'paid Worker and Storehouse';
  await Promise.all(clients.map(async (client, team) => {
    assert.equal(client.latest.mapId, map.id);
    assert.equal(client.latest.armySize, 24);
    await order(client, 'holdPosition', own(client, team, 'infantry').map(u => u[0]), {}, /HOLD POSITION ORDER/);
    const initialIds = new Set(own(client, team, 'worker').map(u => u[0]));
    const after = client.messages.length;
    const home = client.latest.homeTownCenters.find(b => b.team === team);
    // Home production notices have no clientOrderToken; scope the waiter to new messages.
    client.send({ type: 'trainUnit', kind: 'worker', buildingId: home.id });
    const queued = await client.wait(m => m.type === 'notice' && /WORKER QUEUED|REJECTED/.test(m.message), 'paid Worker queued', after);
    assert.match(queued.message, /WORKER QUEUED/);
    const placement = { x: team ? 10.5 : -10.5, z: -2.5 };
    await order(client, 'build', [...initialIds].slice(0, 2), { buildingType: 'storehouse', ...placement }, /STOREHOUSE PLACED/);
    const paid = await fixture.checkpoint(s => s.state.teamFood[team] === map.startingResources.food - UNIT_DEFINITIONS.worker.cost.food
      && s.state.teamWood[team] === map.startingResources.wood - BUILDING_DEFINITIONS.storehouse.cost.wood);
    assertNoRewards(paid.state);
    await client.state(s => s.buildings.some(b => b.team === team && b.type === 'storehouse' && b.complete)
      && s.units.some(u => u[1] === team && u[5] === 'worker' && !initialIds.has(u[0])), 'normal paid construction and production');
    const worker = own(client, team, 'worker').find(u => !initialIds.has(u[0]));
    paidWorkers[team] = { id: worker[0], generation: worker[8] };
    const outerCell = 36 * map.width + (team ? 56 : 39);
    await order(client, 'move', [worker[0]], pointOf(outerCell), /MOVE ORDER/);
    await client.state(s => s.units.some(u => u[0] === worker[0] && cellOf(u) === outerCell), 'Worker reaches visible belt edge');
  }));
  const baseline = (await fixture.checkpoint()).state;
  assertNoRewards(baseline);
  for (const team of [0, 1]) {
    assert.ok(belts[team].every(cell => stockAt(baseline, cell) === woodPerCell));
    assert.equal(distanceToGrove(team, baseline), 41);
  }

  stage = 'both-seat forest harvesting and deposits';
  await Promise.all(clients.map(async (client, team) => {
    for (const cell of belts[team]) {
      await client.state(s => visible(s, cell), 'next forest cell becomes currently visible');
      if (stockAt(client.latest, cell) === 0) continue;
      await order(client, 'gather', [paidWorkers[team].id], { forestCell: cell }, /GATHER ORDER/);
      await fixture.checkpoint(s => stockAt(s.state, cell) === 0);
      // This geometry proof explicitly controls each cut. Natural Wood jobs now
      // continue; Stop freezes any small draw on the next tree, Return banks it.
      await order(client, 'stop', [paidWorkers[team].id], {}, /STOP ORDER/);
      const stopped = (await fixture.checkpoint(s => {
        const worker = s.state.units.find(u => u.id === paidWorkers[team].id);
        return worker?.gatherPhase === '' && worker.workIntent === null;
      })).state;
      if (stopped.units.find(u => u.id === paidWorkers[team].id).cargo > 0) {
        await order(client, 'returnCargo', [paidWorkers[team].id], {}, /RETURN CARGO ORDER/);
      }
      const receipt = (await fixture.checkpoint(s => {
        const worker = s.state.units.find(u => u.id === paidWorkers[team].id);
        return s.state.matchElapsedSeconds >= firstSupply || stockAt(s.state, cell) === 0
          && worker?.cargo === 0 && worker.gatherPhase === '';
      })).state;
      assertNoRewards(receipt);
      assert.ok(Math.abs(receipt.teamWood[team] - baseline.teamWood[team] - seatDraw(receipt, team)) < 1e-4,
        'all Wood drawn, including partial continuation, is banked exactly once');
      assert.equal(receipt.teamFood[team], baseline.teamFood[team]);
      assert.equal(stockAt(receipt, cell), 0);
      // Idle rooms need not broadcast another tick after their final dirty
      // state. Wait for the actual deposit/clearing, not a later checkpoint tick.
      await client.state(s => stockAt(s, cell) === 0
        && Math.abs(s.wood[team] - receipt.teamWood[team]) < 1e-4, 'post-deposit bank and clearing');
    }
  }));
  const harvested = (await fixture.checkpoint()).state;
  assertNoRewards(harvested);
  assert.deepEqual(harvested.forestStocks.filter(([, stock]) => stock === 0).map(([cell]) => cell).sort((a, b) => a - b),
    belts.flat().sort((a, b) => a - b), 'only the intended belts are fully cleared');
  for (const team of [0, 1]) assert.equal(distanceToGrove(team, harvested), 30);

  stage = 'observed traversal through every harvested cell';
  await Promise.all(clients.map(async (client, team) => {
    const { id, generation } = paidWorkers[team], spawn = map.spawnPoints.find(s => s.team === team);
    const spawnCell = Math.floor(spawn.z + map.height / 2) * map.width + Math.floor(spawn.x + map.width / 2);
    await order(client, 'move', [id], spawn, /MOVE ORDER/);
    await client.state(s => s.units.some(u => u[0] === id && cellOf(u) === spawnCell), 'paid Worker returns to route start');
    const visited = [];
    const target = 36 * map.width + (team ? 51 : 44);
    const observe = ({ data }) => {
      const state = JSON.parse(data);
      if (state.type !== 'state') return;
      const worker = state.units.find(u => u[0] === id);
      if (worker && worker[4] > 0 && worker[8] === generation) {
        const cell = cellOf(worker);
        if (visited.at(-1) !== cell) visited.push(cell);
      }
    };
    client.socket.addEventListener('message', observe);
    try {
      await order(client, 'move', [id], pointOf(target), /MOVE ORDER/);
      const arrived = await client.state(s => s.units.some(u => u[0] === id && u[4] > 0 && u[8] === generation && cellOf(u) === target), 'same paid Worker reaches Supply Grove');
      assert.deepEqual(visited.filter(cell => belts[team].includes(cell)), belts[team], 'fresh unit positions cross the whole belt in order');
      results.push({ team, workerId: id, generation, workerFood: UNIT_DEFINITIONS.worker.cost.food,
        storehouseWood: BUILDING_DEFINITIONS.storehouse.cost.wood, harvestedWood: seatDraw(harvested, team),
        clearedBeltWood: 4 * woodPerCell,
        shortestGeometryMoves: { before: 41, after: 30 },
        observedBeltColumns: visited.filter(cell => belts[team].includes(cell)).map(cell => cell % map.width), arrivalTick: arrived.tick });
    } finally { client.socket.removeEventListener('message', observe); }
  }));

  stage = 'clean reset restores the forest';
  const previousGeneration = own(clients[0], 0, 'worker')[0][8];
  clients[0].send({ type: 'reset' });
  await Promise.all(clients.map(c => c.state(s => s.units[0]?.[8] !== previousGeneration && s.armySize === 24, 'fresh authored reset')));
  const reset = (await fixture.checkpoint(s => s.state.forestEpoch > harvested.forestEpoch)).state;
  assert.deepEqual(reset.forestStocks, []);
  assert.equal(reset.units.length, 24);
  assert.deepEqual(reset.buildings, []);
  assert.deepEqual(reset.teamFood, [150, 150]); assert.deepEqual(reset.teamWood, [250, 250]);
  assertNoRewards(reset);
  for (const team of [0, 1]) assert.equal(distanceToGrove(team, reset), 41);
  console.log(JSON.stringify({ map: map.id, openingUnits: 24, harvestingSeconds: harvested.matchElapsedSeconds,
    seats: results.sort((a, b) => a.team - b.team), resetRestoredForest: true,
    limitations: ['automated authoritative evidence', 'geometry moves are not travel time', 'no human playtest or 2000-unit claim'] }));
} catch (error) {
  throw new Error(`${stage}: ${error.message}`, { cause: error });
} finally { await fixture.dispose(); }
