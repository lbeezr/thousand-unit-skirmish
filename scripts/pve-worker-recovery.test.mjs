import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeterministicPolicy, toOpponentObservation } from '../src/pve-opponent.mjs';
import { createPveHeadlessFixture } from './pve-headless-fixture.mjs';
import { createProductionPolicy, PVE_PRODUCTION_LIMITS as limits } from '../src/pve-production.mjs';
import { productionAction } from '../src/production-actions.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';

process.env.RTS_MAP = 'maps/open-field.json';
process.env.RTS_GAME_MODE = 'pvp';
process.env.RTS_PREGAME = '0';
delete process.env.RTS_MATCH_STATE_PATH;

async function runLossRecovery(team, seed) {
  const x = team === 0 ? -28 : 28;
  const map = { id: 'pve-worker-loss-replay', name: 'Worker Loss Replay', width: 80, height: 64,
    terrainSeed: 19, fogOfWar: true, startingArmySize: 24,
    startingResources: { food: 100, wood: 0 },
    spawnPoints: [{ team: 0, x: -28, z: 0 }, { team: 1, x: 28, z: 0 }], obstacles: [],
    resourceNodes: [{ id: 'home-wood', type: 'wood', x, z: 5.5, stock: 1000 }],
    triggers: [], scenarioEvents: [] };
  const fixture = await createPveHeadlessFixture(map), r = fixture.replay;
  try {
    // A validated casualty checkpoint: all four Workers lost; both bounded
    // Riders and Siege Engines survive with four Infantry, using 14 population.
    const loss = r.checkpoint();
    const militaryKinds = ['rider', 'rider', 'siege-engine', 'siege-engine', 'infantry', 'infantry', 'infantry', 'infantry'];
    let militaryIndex = 0;
    for (const unit of loss.state.units.filter(unit => unit.team === team)) {
      if (unit.kind === 'worker') unit.hp = 0;
      else {
        unit.kind = militaryKinds[militaryIndex++];
        unit.hp = UNIT_DEFINITIONS[unit.kind].combat.maxHp;
      }
    }
    loss.state.teamUpgrades[team].militaryTier2 = true;
    loss.state.teamUpgrades[team].siegeEngineering = true;
    r.restore(loss);
    const first = toOpponentObservation(r.observe(team), team, map);
    assert.deepEqual(first.population, { used: 14, reserved: 0, capacity: 15, available: 1 });
    const center = first.buildings.friendly.find(building => building.home);
    assert.equal(center.productionOptions.find(option => option.kind === 'worker').available, true,
      'the authoritative producer permits the one-population Worker');
    assert.equal(first.units.friendly.filter(unit => unit.hp > 0).length, 8);
    assert.equal(first.units.visibleEnemies.length, 0, 'enemy opening remains hidden');
    const policy = createDeterministicPolicy(seed), shadow = createDeterministicPolicy(seed);
    const trace = [];
    let queuedAt = null, spawnedAt = null, depositedAt = null;
    for (let tick = 0; tick <= 2400; tick++) {
      if (r.observe(team).tick % 30 === 0) {
        const observation = toOpponentObservation(r.observe(team), team, map);
        const commands = policy.next(observation);
        assert.deepEqual(commands, shadow.next(observation), 'same observations replay identical decisions');
        for (const command of commands) {
          const notices = await r.order(team, command);
          assert.ok(!notices.some(notice => /REJECTED|FAILED/.test(notice.message || '')), JSON.stringify(notices));
          trace.push({ tick: observation.tick, command });
          if (command.type === 'trainUnit' && command.kind === 'worker') queuedAt ??= observation.tick;
        }
      }
      const state = r.observe(team);
      if (state.units.some(unit => unit[1] === team && unit[4] > 0 && unit[5] === 'worker')) spawnedAt ??= state.tick;
      if (state.wood[team] > 0) { depositedAt = state.tick; break; }
      r.step();
    }
    assert.equal(queuedAt, 300, 'replacement must use its affordable last slot after the normal opening delay');
    assert.ok(spawnedAt !== null, 'paid authoritative training produces a Worker');
    assert.ok(depositedAt !== null, 'replacement resumes gathering and makes an authoritative deposit');
    assert.equal(trace.filter(({command}) => command.kind === 'worker').length, 1, 'one paid replacement fits the slot');
    assert.ok(trace.some(({command}) => command.type === 'gather' && command.nodeId === 'home-wood'));
    assert.equal(r.observe(team).food[team], 50, 'Worker price preserves the food reserve');
    assert.equal(r.observe(team).population[team].used, 15);
    const recovered = r.checkpoint();
    const before = r.observe(team);
    r.restore(recovered);
    assert.deepEqual(r.observe(team), before, 'recovered Worker, bank, fog and population survive validated checkpoint restore');
    return { team, seed, queuedAt, spawnedAt, depositedAt, wood: before.wood[team], trace };
  } finally { await fixture.dispose(); }
}

for (const team of [0, 1]) for (const seed of [0, 20260925, 0xffff_ffff]) {
  test(`seat ${team}, seed ${seed}: replace lost Workers using the last population slot`, async () => {
    const result = await runLossRecovery(team, seed);
    assert.deepEqual(await runLossRecovery(team, seed), result, 'complete fixed-tick match replays identically');
    console.log(JSON.stringify(result));
  });
}

function budgetFixture(team) {
  const x = team ? 28 : -28;
  return { team, tick: 0, fogOfWar: false, map: { width: 80, height: 64 },
    resources: { food: 100, wood: 0 }, population: { used: 14, reserved: 0, capacity: 15, available: 1 },
    units: { friendly: Array.from({ length: 9 }, (_, id) => ({ id, team, generation: 1, hp: 100,
      x, z: 0, kind: id < 3 ? 'worker' : id < 8 ? 'rider' : 'infantry', task: id < 3 ? 'idle' : null, cargo: 0 })), visibleEnemies: [] },
    buildings: { friendly: [{ id: 1_000_000_000 + team, team, type: 'town-center', home: true,
      complete: true, hp: 2400, x, z: 0, queue: 0, productionBlocked: false }], visibleEnemies: [] },
    workerProduction: { queue: 0 }, objectives: [], resourceNodes: [] };
}

function refreshWorkerOption(state) {
  for (const building of state.buildings.friendly) {
    building.productionOptions = [productionAction(building, 'worker', {
      team: state.team, upgrades: {}, matchOver: false, queueLimit: 8,
      seatUnits: state.units.friendly.length, seatReservedUnits: state.workerProduction.queue,
      seatLimit: 1000, totalUnits: state.units.friendly.length, totalReservedUnits: state.workerProduction.queue,
      totalLimit: 2000, populationAvailable: state.population.available,
      food: state.resources.food, wood: state.resources.wood,
    })];
  }
}

for (const team of [0, 1]) for (const seed of [0, 20260925, 0xffff_ffff]) {
  test(`seat ${team}, seed ${seed}: Worker priority retains authoritative budgets and retry guards`, () => {
    const state = budgetFixture(team);
    refreshWorkerOption(state);
    const policy = createProductionPolicy(seed);
    assert.deepEqual(policy.next(state), []);
    assert.deepEqual(policy.next({ ...state, tick: 299 }), []);
    const expected = [{ type: 'trainUnit', kind: 'worker', buildingId: state.buildings.friendly[0].id }];
    assert.deepEqual(policy.next({ ...state, tick: 300 }), expected, 'a depleted three-Worker economy also uses its last slot');
    assert.deepEqual(policy.next({ ...state, tick: 300 }), []);
    assert.deepEqual(policy.next({ ...state, tick: 449 }), []);
    assert.deepEqual(policy.next({ ...state, tick: 450 }), expected, 'unconfirmed recruitment uses existing backoff');
    assert.deepEqual(policy.next({ ...state, tick: 749 }), []);
    assert.deepEqual(policy.next({ ...state, tick: 750 }), expected);

    for (const [label, mutate] of [
      ['food reserve', s => { s.resources.food = 99; }],
      ['full population', s => { s.population = { used: 15, reserved: 0, capacity: 15, available: 0 }; }],
      ['queued population', s => { s.population = { used: 14, reserved: 1, capacity: 15, available: 0 }; }],
      ['safety ceiling', s => { s.population = { used: 1000, reserved: 0, capacity: 1000, available: 0 }; }],
      ['busy producer', s => { s.buildings.friendly[0].queue = 1; s.workerProduction.queue = 1; }],
      ['blocked exit', s => { s.buildings.friendly[0].productionBlocked = true; }],
      ['destroyed producer', s => { s.buildings.friendly = []; }],
      ['unfinished producer', s => { s.buildings.friendly[0].complete = false; }],
      ['foreign producer', s => { s.buildings.friendly[0].team = 1 - team; }],
      ['four living Workers', s => { s.units.friendly.push({ ...s.units.friendly[0], id: 99 }); }],
      ['policy roster limit', s => { while (s.units.friendly.length < limits.roster) s.units.friendly.push({ ...s.units.friendly[8], id: 100 + s.units.friendly.length }); }],
    ]) {
      const guarded = budgetFixture(team);
      mutate(guarded); refreshWorkerOption(guarded);
      const constrained = createProductionPolicy(seed); constrained.next(guarded);
      assert.deepEqual(constrained.next({ ...guarded, tick: 300 }), [], label);
    }
    for (const available of [1, 2]) {
      const defended = budgetFixture(team); defended.population.available = available;
      defended.population.capacity = defended.population.used + available;
      defended.buildings.visibleEnemies = [{ id: 90, team: 1 - team, type: 'watchtower', hp: 1200, x: 0, z: 0 }];
      refreshWorkerOption(defended);
      const counter = createProductionPolicy(seed); counter.next(defended);
      assert.deepEqual(counter.next({ ...defended, tick: 300 }), expected, 'three-population siege demand also leaves room for Worker recovery');
    }
    const capped = budgetFixture(team); capped.resources.wood = 100;
    capped.population = { used: 15, reserved: 0, capacity: 15, available: 0 };
    refreshWorkerOption(capped);
    const expansion = createProductionPolicy(seed); expansion.next(capped);
    assert.equal(expansion.next({ ...capped, tick: 300 })[0]?.buildingType, 'house', 'a truly full population still expands before training');
  });
}
