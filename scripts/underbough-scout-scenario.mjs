// Authoritative paid Scout role evidence; no checkpoint injection or browser claim.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { createReconnaissancePolicy } from '../src/simulation/ai/policies/reconnaissance.mjs';
import { toOpponentObservation } from '../src/pve-opponent.mjs';
import { townCenterFootprintCells } from '../src/town-center-spawn.mjs';
import { BUILDING_DEFINITIONS, UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';

const map = JSON.parse(await readFile(new URL('../maps/underbough-rootways.json', import.meta.url), 'utf8'));
const fixture = await createFortifiedFixture({ mapPath: 'maps/underbough-rootways.json', timeoutMs: 90000 });
let clients, token = 1;
const own = (client, team, kind) => client.latest.units.filter(u => u[1] === team && u[4] > 0 && u[5] === kind);
async function order(client, type, ids, extra = {}, notice = /ORDER/) {
  const result = await client.command({ type, ids, unitGenerations: ids.map(id => client.latest.units.find(u => u[0] === id)?.[8]),
    ...extra, clientOrderToken: token++ }, new RegExp(`${notice.source}|REJECTED`));
  assert.match(result.message, notice, `${type}: ${result.message}`);
  return result;
}
function explored(state) {
  const bytes = Buffer.from(state.visibility.data, 'base64');
  let cells = 0;
  for (let cell = 0; cell < map.width * map.height; cell++) if ((bytes[cell >> 2] >> ((cell & 3) * 2)) & 3) cells++;
  return cells;
}
const results = [];
try {
  await fixture.start(); clients = [await fixture.connect(0), await fixture.connect(1)];
  for (const team of [0, 1]) {
    if (team) {
      const generation = own(clients[0], 0, 'worker')[0][8];
      clients[0].send({ type: 'reset' });
      await Promise.all(clients.map(c => c.state(s => s.units[0]?.[8] !== generation && s.armySize === 24, 'fresh Rootways')));
    }
    const scouts = [];
    await Promise.all(clients.map(async (c, seat) => {
      assert.equal(c.latest.mapId, map.id);
      await order(c, 'holdPosition', own(c, seat, 'infantry').map(u => u[0]), {}, /HOLD POSITION ORDER/);
      const workers = own(c, seat, 'worker').map(u => u[0]);
      const before = { food: c.latest.food[seat], wood: c.latest.wood[seat] };
      await order(c, 'build', workers.slice(2), { buildingType: 'stable', x: seat ? 24.5 : -24.5, z: -3.5 }, /BUILD ORDER/);
      await c.state(s => s.buildings.some(b => b.team === seat && b.type === 'stable' && b.complete), 'paid Stable completion');
      const stable = c.latest.buildings.find(b => b.team === seat && b.type === 'stable');
      assert.equal(c.latest.wood[seat], before.wood - BUILDING_DEFINITIONS.stable.cost.wood);
      assert.equal(c.latest.food[seat], before.food);
      await order(c, 'trainUnit', [], { kind: 'scout', buildingId: stable.id }, /SCOUT QUEUED/);
      await fixture.checkpoint(s => s.state.teamFood[seat] === before.food - UNIT_DEFINITIONS.scout.cost.food
        && s.state.teamWood[seat] === before.wood - BUILDING_DEFINITIONS.stable.cost.wood - UNIT_DEFINITIONS.scout.cost.wood);
      await c.state(s => s.units.some(u => u[1] === seat && u[5] === 'scout'), 'paid Scout produced');
      scouts[seat] = own(c, seat, 'scout')[0][0];
    }));
    const client = clients[team], before = explored(client.latest);
    const opening = client.latest.units.find(u => u[0] === scouts[team]);
    const firstObservation = toOpponentObservation(client.latest, team, map);
    assert.deepEqual(createReconnaissancePolicy(42).next(firstObservation), createReconnaissancePolicy(42).next(firstObservation));
    const policy = createReconnaissancePolicy(42), commands = [];
    let lastTick = -Infinity, discovered = false, retreat = null, reachedHome = false, resumed = false;
    async function step() {
      const state = client.latest;
      // Idle snapshots coalesce; use only the persisted clock, never private tactical data.
      const clock = (await fixture.checkpoint()).state.tickNumber;
      if (clock - lastTick >= 30) {
        lastTick = clock;
        const observation = toOpponentObservation({ ...state, tick: clock }, team, map);
        const scout = observation.units.friendly.find(u => u.id === scouts[team]);
        assert.ok(scout?.hp > 0, 'Scout survives reconnaissance');
        const visibleThreat = observation.units.visibleEnemies.some(u => u.hp > 0 && Math.hypot(u.x - scout.x, u.z - scout.z) < 9);
        const decision = policy.next(observation);
        assert.deepEqual(decision.ids, [scout.id]);
        assert.ok(decision.commands.length <= 1);
        assert.deepEqual(policy.next(observation).commands, [], 'same observation cannot repeat its order');
        for (const command of decision.commands) {
          assert.deepEqual(command.ids, [scout.id]);
          assert.deepEqual(command.unitGenerations, [scout.generation]);
          await order(client, command.type, command.ids, { x: command.x, z: command.z }, /MOVE ORDER/);
          commands.push({ tick: clock, x: command.x, z: command.z });
          if (visibleThreat) {
            const home = observation.buildings.friendly.find(b => b.type === 'town-center' && b.home);
            const edge = Math.ceil(BUILDING_DEFINITIONS['town-center'].footprint / 2);
            assert.equal(Math.max(Math.abs(command.x - home.x), Math.abs(command.z - home.z)), edge);
            const cell = Math.floor(command.z + map.height / 2) * map.width + Math.floor(command.x + map.width / 2);
            assert.ok(!townCenterFootprintCells(map.spawnPoints, team, map.width, map.height).includes(cell),
              'retreat destination lies outside the authoritative home footprint');
            retreat = command;
          } else if (retreat && Math.hypot(scout.x - retreat.x, scout.z - retreat.z) < 1) {
            assert.notDeepEqual([command.x, command.z], [retreat.x, retreat.z]);
            resumed = true;
          }
        }
        discovered ||= explored(state) > before && Math.hypot(scout.x - opening[2], scout.z - opening[3]) > 4;
        reachedHome = retreat && Math.hypot(scout.x - retreat.x, scout.z - retreat.z) < 1 && resumed;
      }
    }
    let deadline = Date.now() + 45000;
    while (Date.now() < deadline && !discovered) {
      await step();
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.ok(discovered, JSON.stringify({ team, commands }));
    await order(client, 'stop', [scouts[team]], {}, /STOP ORDER/);
    const point = client.latest.units.find(u => u[0] === scouts[team]);
    await order(clients[1 - team], 'move', [scouts[1 - team]], { x: point[2], z: point[3] }, /MOVE ORDER/);
    await client.state(state => state.units.some(u => u[1] !== team && u[4] > 0
      && Math.hypot(u[2] - point[2], u[3] - point[3]) < 9), 'scripted threat becomes visible');
    await order(clients[1 - team], 'stop', [scouts[1 - team]], {}, /STOP ORDER/);
    deadline = Date.now() + 45000;
    while (Date.now() < deadline && !reachedHome) {
      await step();
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.ok(retreat && reachedHome, JSON.stringify({ team, commands, retreat }));
    assert.ok(explored(client.latest) > before);
    results.push({ map: map.id, openingUnits: 24, team, discovered: explored(client.latest) - before,
      constructionWood: BUILDING_DEFINITIONS.stable.cost.wood, productionCost: UNIT_DEFINITIONS.scout.cost,
      commands, retreat, resumed });
    console.log(JSON.stringify(results.at(-1)));
  }
} finally { await fixture.dispose(); }
