import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeterministicPolicy, toOpponentObservation } from '../src/pve-opponent.mjs';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';
import { BUILDING_DEFINITIONS as B } from '../src/gameplay-definitions.mjs';
import { createProductionPolicy } from '../src/pve-production.mjs';
import { farmHarvestNodeId } from '../src/farm-harvest.mjs';

process.env.RTS_MAP = 'maps/open-field.json';
process.env.RTS_GAME_MODE = 'pvp';
process.env.RTS_PREGAME = '0';
delete process.env.RTS_MATCH_STATE_PATH;

async function starvationReplay(team, seed, initialCheckpoint) {
  // Test-only map: normal owned Town Centers and four Workers per seat, no
  // natural food or timber. Every crop and bank change must be paid and finite.
  const map = { id: 'pve-paid-farm-replay', name: 'Paid Farm Replay', width: 80, height: 64,
    terrainSeed: 19, fogOfWar: true, startingArmySize: 8,
    startingResources: { food: 0, wood: 400 },
    spawnPoints: [{ team: 0, x: -28, z: 0 }, { team: 1, x: 28, z: 0 }],
    obstacles: [], resourceNodes: [], triggers: [], scenarioEvents: [] };
  const fixture = await createPveHeadlessFixture(map), r = fixture.replay;
  try {
    if (initialCheckpoint) r.restore(initialCheckpoint);
    initialCheckpoint ??= r.checkpoint(); // Preserve generation identities across fresh server instances.
    let policy = createDeterministicPolicy(seed), shadow = createDeterministicPolicy(seed);
    const trace = [], completed = new Set(), planted = [], cleared = [], restarts = [];
    let spentFood = 0, spentWood = 0, firstDeposit = null, recoveredDeposit = null;
    const conserved = () => {
      const { state } = r.checkpoint();
      const farms = state.buildings.filter(b => b.team === team && b.type === 'farm' && b.hp > 0);
      assert.ok(farms.length <= 1, 'one living owned plot prevents planting spam');
      for (const farm of farms) {
        if (farm.complete) completed.add(farm.id);
        else assert.equal(farm.harvestStock, 0, 'unfinished paid foundation supplies no food');
      }
      const cargo = state.units.filter(u => u.team === team && u.cargoType === 'food').reduce((sum, u) => sum + u.cargo, 0);
      const stock = farms.reduce((sum, farm) => sum + farm.harvestStock, 0);
      assert.ok(Math.abs(state.teamFood[team] + cargo + stock + spentFood - completed.size * B.farm.harvest.stock) < 1e-5,
        'finite paid supply equals bank, cargo, remaining crop and actual spending');
      assert.ok(Math.abs(state.teamWood[team] + spentWood - map.startingResources.wood) < 1e-5,
        'all wood is conserved through real command debits; clearing gives no refund');
      return farms;
    };
    for (let tick = 0; tick <= 9000; tick++) {
      const before = r.observe(team);
      if (before.tick % 30 === 0) {
        const farms = conserved();
        const restart = !restarts.includes('foundation') && farms.some(f => !f.complete && f.progress > 0)
          ? 'foundation' : !restarts.includes('harvest-cargo') && farms.some(f => f.complete && f.harvestStock > 0 && f.harvestStock < B.farm.harvest.stock)
            && before.units.some(u => u[1] === team && u[6] > 0 && u[7] === 'food') ? 'harvest-cargo'
              : !restarts.includes('exhausted') && farms.some(f => f.complete && f.harvestStock === 0) ? 'exhausted' : null;
        if (restart) {
          const snapshot = r.checkpoint(); r.restore(snapshot);
          assertRecoveredWorkerObservation(r.observe(team), before, 'authoritative restart preserves crop, bank, cargo, fog and identities');
          policy = createDeterministicPolicy(seed); shadow = createDeterministicPolicy(seed);
          restarts.push(restart); trace.push({ tick: before.tick, restart });
        }
        const observation = toOpponentObservation(r.observe(team), team, map);
        const commands = policy.next(observation);
        assert.deepEqual(commands, shadow.next(observation), 'same seed and observations make identical decisions');
        if (before.tick === 300) assert.ok(commands.some(c => c.type === 'build' && c.buildingType === 'farm'),
          'zero food with affordable wood must plant after the normal opening delay');
        for (const command of commands) {
          const bank = r.observe(team);
          if (command.type === 'cancelConstruction') {
            const exhausted = farms.find(f => f.id === command.buildingId);
            assert.ok(exhausted?.complete && exhausted.harvestStock === 0, 'only an observed owned exhausted plot may be cleared');
          }
          const notices = await r.order(team, command);
          assert.ok(!notices.some(n => /REJECTED|FAILED|NOT FOUND|NODE EMPTY/.test(n.message || '')), JSON.stringify(notices));
          const after = r.observe(team);
          spentFood += bank.food[team] - after.food[team]; spentWood += bank.wood[team] - after.wood[team];
          trace.push({ tick: before.tick, command });
          if (command.buildingType === 'farm') {
            assert.equal(bank.wood[team] - after.wood[team], B.farm.cost.wood);
            assert.ok(after.wood[team] >= 25, 'paid crop retains the ordinary wood reserve');
            planted.push(before.tick);
          }
          if (command.type === 'cancelConstruction') {
            assert.equal(bank.wood[team], after.wood[team]); cleared.push(before.tick);
          }
        }
        conserved();
      }
      const state = r.observe(team), delivered = state.food[team] + spentFood;
      if (delivered > 0) firstDeposit ??= state.tick;
      if (delivered > B.farm.harvest.stock + 1e-5) { recoveredDeposit = state.tick; break; }
      r.step();
    }
    assert.ok(firstDeposit !== null && recoveredDeposit !== null, `paid first crop and fresh replant both deposit real food: ${JSON.stringify({ planted, cleared, restarts, food: r.observe(team).food[team], wood: r.observe(team).wood[team], spentFood, spentWood, trace: trace.filter(t => t.command?.type !== 'gather') })}`);
    assert.deepEqual(restarts, ['foundation', 'harvest-cargo', 'exhausted']);
    assert.equal(planted.length, 2); assert.equal(cleared.length, 1); assert.equal(completed.size, 2);
    assert.equal(r.observe(team).units.filter(u => u[1] === team && u[4] > 0 && u[5] === 'worker').length, 4);
    conserved();
    return { initialCheckpoint, result: { team, seed, planted, cleared, restarts, firstDeposit, recoveredDeposit,
      food: r.observe(team).food[team], wood: r.observe(team).wood[team], spentFood, spentWood, trace } };
  } finally { await fixture.dispose(); }
}

for (const team of [0, 1]) for (const seed of [0, 20260925, 0xffff_ffff]) {
  test(`seat ${team}, seed ${seed}: starvation, finite paid replant and checkpoint restart`, async () => {
    const first = await starvationReplay(team, seed);
    const second = await starvationReplay(team, seed, first.initialCheckpoint);
    assert.deepEqual(second.result, first.result, 'complete restarted authoritative matches replay identical traces and banks');
    const { trace, ...evidence } = first.result; console.log(JSON.stringify(evidence));
  });
}

function budgetObservation(team) {
  const x = team ? 28 : -28;
  return { team, tick: 0, fogOfWar: false, map: { width: 80, height: 64 },
    resources: { food: 0, wood: 85 }, population: { used: 4, reserved: 0, capacity: 15, available: 11 },
    units: { friendly: Array.from({ length: 4 }, (_, id) => ({ id, team, generation: 19 + id, hp: 100,
      x, z: 0, kind: 'worker', task: 'idle', cargo: 0 })), visibleEnemies: [] },
    buildings: { friendly: [
      { id: 1_000_000_000 + team, team, type: 'town-center', home: true, complete: true, hp: 2400, x, z: 0, queue: 0 },
      { id: 20, team, type: 'barracks', complete: true, hp: 1800, x, z: 12, queue: 0 },
    ], visibleEnemies: [] }, workerProduction: { queue: 0 }, objectives: [], resourceNodes: [] };
}

function addPlot(observation, { complete = true, stock = 0, id = 30, team = observation.team } = {}) {
  const farm = { id, team, type: 'farm', hp: 600, maxHp: 600, complete, progress: complete ? 1 : 0.2,
    x: observation.buildings.friendly[0].x, z: -6.5, queue: 0 };
  (team === observation.team ? observation.buildings.friendly : observation.buildings.visibleEnemies).push(farm);
  if (complete && team === observation.team && stock !== null) observation.resourceNodes.push({ id: farmHarvestNodeId(id), type: 'food', stock, x: farm.x, z: farm.z });
  return farm;
}

function openingDecision(observation, seed) {
  const policy = createProductionPolicy(seed);
  assert.deepEqual(policy.next(observation), []);
  return policy.next({ ...observation, tick: 300 });
}

for (const team of [0, 1]) for (const seed of [0, 20260925, 0xffff_ffff]) {
  test(`seat ${team}, seed ${seed}: Farm ownership, budgets, priorities and no-spam guards`, () => {
    const ordinary = budgetObservation(team), planting = openingDecision(ordinary, seed);
    assert.equal(planting[0]?.buildingType, 'farm', '60 wood plus 25 reserve permits one plot');
    assert.deepEqual(planting[0].ids, [0]); assert.deepEqual(planting[0].unitGenerations, [19]);
    assert.deepEqual(openingDecision(budgetObservation(team), seed), planting, 'same seed chooses the same visible site');
    for (const [label, mutate] of [
      ['one wood below reserve', s => { s.resources.wood = 84; }],
      ['healthy food bank', s => { s.resources.food = 100; }],
      ['productive natural food', s => { s.resourceNodes.push({ id: 'berries', type: 'food', stock: 1, x: 0, z: 20 }); }],
      ['productive owned crop', s => { addPlot(s, { stock: 1 }); }],
      ['unknown owned crop stock', s => { addPlot(s, { stock: null }); }],
      ['multiple living plots', s => { addPlot(s); addPlot(s, { id: 31 }); }],
      ['no food dropoff', s => { s.buildings.friendly.shift(); }],
      ['foreign food dropoff', s => { s.buildings.friendly[0].team = 1 - team; }],
      ['unfinished food dropoff', s => { s.buildings.friendly[0].complete = false; }],
      ['destroyed food dropoff', s => { s.buildings.friendly[0].hp = 0; }],
      ['no living Workers', s => { s.units.friendly.forEach(u => { u.hp = 0; }); }],
      ['busy Workers', s => { s.units.friendly.forEach(u => { u.task = 'building'; }); }],
      ['carrying Workers', s => { s.units.friendly.forEach(u => { u.cargo = 1; }); }],
      ['nearly full housing reserve', s => { s.population = { used: 13, reserved: 0, capacity: 15, available: 2 }; s.resources.wood = 159; }],
      ['full safety ceiling', s => { s.population = { used: 1000, reserved: 0, capacity: 1000, available: 0 }; }],
      ['explored footprint is not visible', s => { s.fogOfWar = true; s.visibility = { columns: 80, rows: 64, data: Buffer.alloc(80 * 64 / 4, 0x55).toString('base64') }; }],
    ]) {
      const guarded = budgetObservation(team); mutate(guarded);
      const commands = openingDecision(guarded, seed);
      assert.ok(!commands.some(c => c.buildingType === 'farm' || c.type === 'cancelConstruction'), label);
    }
    const nearFull = budgetObservation(team); nearFull.population = { used: 13, reserved: 0, capacity: 15, available: 2 }; nearFull.resources.wood = 160;
    assert.equal(openingDecision(nearFull, seed)[0]?.buildingType, 'farm', 'planting leaves the full 75+25 House budget');
    const threshold = budgetObservation(team); threshold.resources.food = 99;
    assert.equal(openingDecision(threshold, seed)[0]?.buildingType, 'farm');
    const house = budgetObservation(team); house.population = { used: 14, reserved: 0, capacity: 15, available: 1 }; house.resources.wood = 160;
    assert.equal(openingDecision(house, seed)[0]?.buildingType, 'house', 'urgent housing precedes planting');
    const recovery = budgetObservation(team); recovery.units.friendly.pop(); recovery.resources.food = 100;
    recovery.buildings.friendly[0].productionOptions = [{ kind: 'worker', available: true }]; addPlot(recovery, { complete: false });
    assert.equal(openingDecision(recovery, seed)[0]?.kind, 'worker', 'Worker recovery precedes resuming an existing paid plot');
    const foundation = budgetObservation(team); foundation.resources = { food: 500, wood: 0 }; addPlot(foundation, { complete: false });
    assert.deepEqual(openingDecision(foundation, seed), [{ type: 'build', buildingId: 30, ids: [0], unitGenerations: [19] }], 'resume a paid foundation without a second charge');
    const foreign = budgetObservation(team); addPlot(foreign, { team: 1 - team });
    assert.equal(openingDecision(foreign, seed)[0]?.buildingType, 'farm', 'foreign plots never become clearing targets');
    for (const exhausted of [false, true]) {
      const repeated = budgetObservation(team); if (exhausted) addPlot(repeated);
      const retry = createProductionPolicy(seed); retry.next(repeated);
      for (const tick of [300, 450, 750, 1350, 2250]) {
        const command = retry.next({ ...repeated, tick })[0];
        assert.equal(exhausted ? command?.type : command?.buildingType, exhausted ? 'cancelConstruction' : 'farm');
        assert.deepEqual(retry.next({ ...repeated, tick }), [], 'duplicate observation cannot repeat spending or clearing');
        assert.deepEqual(retry.next({ ...repeated, tick: tick + 149 }), [], 'unconfirmed orders retain bounded backoff');
      }
    }
    const exhausted = budgetObservation(team); addPlot(exhausted);
    const replant = createProductionPolicy(seed); replant.next(exhausted);
    assert.deepEqual(replant.next({ ...exhausted, tick: 300 }), [{ type: 'cancelConstruction', buildingId: 30 }]);
    exhausted.buildings.friendly.pop(); exhausted.resourceNodes = []; exhausted.resources.wood = 84;
    assert.deepEqual(replant.next({ ...exhausted, tick: 450 }), [], 'replacement rechecks the live bank after clearing');
    exhausted.resources.wood = 85;
    assert.equal(replant.next({ ...exhausted, tick: 480 })[0]?.buildingType, 'farm', 'fresh paid construction follows observed removal');
  });
}
