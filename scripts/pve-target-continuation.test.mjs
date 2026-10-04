import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';
import { createDeterministicPolicy, toOpponentObservation } from '../src/pve-opponent.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';

process.env.RTS_MAP = 'maps/open-field.json';
process.env.RTS_GAME_MODE = 'pvp';
process.env.RTS_PREGAME = '0';
delete process.env.RTS_MATCH_STATE_PATH;

const identity = { matchModeId: 'skirmish', matchModeVersion: 1 };
const offensive = command => ['attack', 'attackBuilding', 'attackMove'].includes(command.type);
const commandFor = (units, type, extra = {}) => ({ type, ids: units.map(u => u.id),
  unitGenerations: units.map(u => u.generation), ...extra });

// Qualification of one capability, not a difficulty benchmark. The authored
// reward-only fixture uses the explicit Skirmish policy, without changing map
// admission, victory, banks, casualties or checkpoint contents.
async function continuation(team, initial = null, control = 'positive', cold = true) {
  const enemy = 1 - team, home = team ? 28 : -28, target = team ? 8 : -8;
  const map = { id: 'pve-target-continuation', name: 'Paid Target Continuation',
    width: 80, height: 64, terrainSeed: 19, fogOfWar: true, startingArmySize: 24,
    startingResources: { food: 150, wood: 250 },
    spawnPoints: [{ team, x: home, z: 0 }, { team: enemy, x: -home, z: 0 }], obstacles: [],
    resourceNodes: [0, 1].flatMap(seat => [{ id: `food-${seat}`, type: 'food', x: seat ? 28 : -28, z: 6.5, stock: 1000 },
      { id: `wood-${seat}`, type: 'wood', x: seat ? 28 : -28, z: -6.5, stock: 1000 }]),
    triggers: [{ id: 'bonus', name: 'Bonus', type: 'capture-zone',
      zone: { column: target + 38, row: 30, width: 4, height: 4 }, requiredUnits: 5,
      captureSeconds: 9, foodReward: 0, woodReward: 0, unitCount: 0, unitKind: 'infantry', victory: false }], scenarioEvents: [] };
  let fixture = await createPveHeadlessFixture(map), r = fixture.replay;
  let setup = null;
  const trace = [], observations = [], spent = [{ food: 0, wood: 0 }, { food: 0, wood: 0 }];
  const observation = seat => toOpponentObservation(r.observe(seat), seat, map);
  const order = async (seat, command) => {
    const before = observation(seat).resources;
    const notices = await r.order(seat, command); r.drain();
    assert.ok(!notices.some(n => /REJECTED|FAILED|UNREACHABLE/.test(n.message || '')), JSON.stringify(notices));
    const after = observation(seat).resources;
    for (const resource of ['food', 'wood']) spent[seat][resource] += before[resource] - after[resource];
    trace.push({ tick: r.observe(team).tick, team: seat, command, notices });
  };
  try {
    if (initial) r.restore(initial);
    else {
      for (const seat of [0, 1]) await order(seat, commandFor(observation(seat).units.friendly.filter(u => u.kind !== 'worker'), 'holdPosition'));
      const workers = observation(enemy).units.friendly.filter(u => u.kind === 'worker');
      await order(enemy, commandFor(workers, 'gather', { nodeId: `wood-${enemy}` }));
      for (let i = 0; i < 3600 && observation(enemy).resources.wood < 350; i++) r.step();
      assert.ok(observation(enemy).resources.wood >= 350, 'ordinary wood deposits fund two producers');
      for (const x of [0, -target]) {
        const expected = observation(enemy).buildings.friendly.filter(b => b.type === 'barracks').length + 1;
        await order(enemy, commandFor(workers, 'build', { buildingType: 'barracks', x, z: 8 }));
        for (let i = 0; i < 3000 && observation(enemy).buildings.friendly.filter(b => b.type === 'barracks' && b.complete).length < expected; i++) r.step();
        assert.equal(observation(enemy).buildings.friendly.filter(b => b.type === 'barracks' && b.complete).length, expected);
      }
      const barracks = observation(enemy).buildings.friendly.filter(b => b.type === 'barracks');
      await order(enemy, { type: 'train', buildingId: barracks[0].id });
      await order(enemy, commandFor(workers, 'move', { x: -home, z: 6 }));
      for (let i = 0; i < 1200; i++) r.step();
      const reserve = observation(enemy).units.friendly.filter(u => u.kind !== 'worker');
      assert.equal(reserve.length, 9, 'ordinary paid recruitment keeps the opponent alive');
      await order(enemy, commandFor(reserve, 'move', { x: -home, z: -8 }));
      for (let i = 0; i < 1200; i++) r.step();
      await order(enemy, commandFor(reserve, 'holdPosition'));
      const army = observation(team).units.friendly.filter(u => u.kind !== 'worker');
      await order(team, commandFor(army, 'attackMove', { x: target, z: 0 }));
      for (let i = 0; i < 3000 && observation(team).objectives[0].owner !== team; i++) r.step();
      assert.equal(observation(team).objectives[0].owner, team, 'ordinary capture leaves no neutral post to mask idle target acquisition');
      await order(team, commandFor(army, 'setStance', { stance: 'aggressive' }));
      r.drain(); initial = r.checkpoint();
      assert.equal(spent[enemy].wood, 2 * BUILDING_DEFINITIONS.barracks.cost.wood, 'both enemy producers are paid at the native price');
      assert.equal(spent[enemy].food, 50, 'the reserve recruit is paid');
      const wood = initial.state.teamWood[enemy]
        + initial.state.resourceNodes.find(n => n.id === `wood-${enemy}`).stock
        + initial.state.units.filter(u => u.team === enemy && u.cargoType === 'wood').reduce((sum, u) => sum + u.cargo, 0);
      assert.ok(Math.abs(wood + spent[enemy].wood - 1250) < 1e-5, 'opening wood bank, ordinary deposits and construction conserve resources');
    }
    // All branches start at the same legally obtained checkpoint and accounting
    // boundary. Controls retain the complete first assault and support economy.
    if (trace.length) setup = { trace: structuredClone(trace), spent: structuredClone(spent) };
    trace.length = 0; spent.forEach(bank => { bank.food = 0; bank.wood = 0; });
    const startTick = r.observe(team).tick;
    const producers = initial.state.buildings.filter(b => b.team === enemy && b.type === 'barracks');
    assert.equal(producers.length, 2); assert.ok(producers.every(b => b.complete && b.hp === BUILDING_DEFINITIONS.barracks.maxHp));
    const stages = { firstAssault: null, firstDestroyed: null, secondAssault: null, secondDamage: null, secondDestroyed: null, coldRestart: null };
    let firstId = null, secondId = null;
    let policy = createDeterministicPolicy(20260925, identity), shadow = createDeterministicPolicy(20260925, identity);
    for (let i = 0; i <= 7200; i++) {
      if (i % 30 === 0) {
        const state = r.checkpoint().state, tick = r.observe(team).tick;
        const first = state.buildings.find(b => b.id === firstId && b.hp > 0);
        const second = state.buildings.find(b => b.id === secondId && b.hp > 0);
        if (firstId !== null && !first && stages.firstDestroyed === null) {
          stages.firstDestroyed = tick;
          assert.ok(second && second.hp === producers.find(b => b.id === secondId).hp, 'the second producer survives the complete first assault undamaged');
          assert.ok(observation(team).buildings.visibleEnemies.some(b => b.id === secondId), 'the next producer is currently visible at the transition');
          if (cold) {
            r.drain(); const before = [r.observe(0), r.observe(1)], checkpoint = r.checkpoint();
            const fresh = await createPveHeadlessFixture(map); fresh.replay.restore(checkpoint);
            for (const seat of [0, 1]) assertRecoveredWorkerObservation(fresh.replay.observe(seat), before[seat], 'fresh fixture preserves both seats, fog, banks and combat state');
            await fixture.dispose(); fixture = fresh; r = fresh.replay;
            policy = createDeterministicPolicy(20260925, identity); shadow = createDeterministicPolicy(20260925, identity);
            stages.coldRestart = tick;
          }
        }
        if (secondId !== null && second && second.hp < producers.find(b => b.id === secondId).hp) stages.secondDamage ??= tick;
        if (secondId !== null && !second) { stages.secondDestroyed = tick; break; }
        const view = observation(team), emitted = policy.next(view);
        assert.deepEqual(emitted, shadow.next(structuredClone(view)));
        const commands = control === 'no-acquisition' && stages.firstDestroyed !== null
          ? emitted.filter(command => !offensive(command)) : emitted;
        for (const command of commands) {
          if (command.type === 'attackBuilding' && producers.some(b => b.id === command.buildingId)) {
            assert.ok(view.buildings.visibleEnemies.some(b => b.id === command.buildingId), 'target acquisition uses current disclosed sight');
            if (firstId === null) {
              firstId = command.buildingId; secondId = producers.find(b => b.id !== firstId).id;
              stages.firstAssault = view.tick;
            }
            if (command.buildingId === secondId) {
              assert.ok(stages.firstDestroyed !== null, 'the continuation target is acquired only after the first destruction');
              stages.secondAssault ??= view.tick;
            }
          }
          // The command-only control keeps the acquisition witness but withholds
          // delivery. Native HP, not a planned command, decides qualification.
          if (control === 'no-delivery' && stages.firstDestroyed !== null && offensive(command)) {
            trace.push({ tick: view.tick, suppressed: command });
          } else await order(team, command);
        }
        observations.push([r.observe(0), r.observe(1)]);
      }
      if (i < 7200) r.step();
    }
    const final = r.checkpoint();
    for (const seat of [0, 1]) for (const resource of ['food', 'wood']) {
      const value = state => state[resource === 'food' ? 'teamFood' : 'teamWood'][seat]
        + state.resourceNodes.filter(n => n.id === `${resource}-${seat}`).reduce((sum, n) => sum + n.stock, 0)
        + state.units.filter(u => u.team === seat && u.hp > 0 && u.cargoType === resource).reduce((sum, u) => sum + u.cargo, 0);
      assert.ok(Math.abs(value(initial.state) - value(final.state) - spent[seat][resource]) < 1e-5, 'native banks, stock, cargo and paid spending conserve resources');
    }
    return { initial, setup, result: { team, control, cold, startTick, firstId, secondId, stages, spent, trace, observations, final } };
  } finally { await fixture.dispose(); }
}

function qualifies(result) {
  const s = result.stages;
  return ['firstAssault', 'firstDestroyed', 'secondAssault', 'secondDamage', 'secondDestroyed'].every(key => s[key] !== null)
    && s.secondAssault >= s.firstDestroyed && s.secondDamage >= s.secondAssault && s.secondDestroyed >= s.secondDamage;
}

for (const team of [0, 1]) test(`seat ${team}: paid second-target continuation across cold recovery and incapable controls`, async () => {
  const positive = await continuation(team), repeat = await continuation(team, positive.initial);
  const warm = await continuation(team, positive.initial, 'positive', false);
  const noAcquisition = await continuation(team, positive.initial, 'no-acquisition');
  const noDelivery = await continuation(team, positive.initial, 'no-delivery');
  assert.deepEqual(repeat.result, positive.result, 'all decisions, notices, both-seat observations and final checkpoint exactly repeat');
  assert.ok(qualifies(positive.result), 'native destruction of both targets qualifies continuation');
  assert.ok(qualifies(warm.result), 'warm policy also continues; reset cannot manufacture the capability');
  assert.equal(positive.result.stages.coldRestart, positive.result.stages.firstDestroyed);
  for (const control of [noAcquisition, noDelivery]) {
    assert.equal(control.result.stages.firstDestroyed, positive.result.stages.firstDestroyed, 'the negative control really completes the same opening assault');
    const opening = result => result.trace.filter(row => row.tick < result.stages.firstDestroyed);
    assert.deepEqual(opening(control.result), opening(positive.result), 'all delivered commands and notices before the continuation are identical');
    assert.equal(control.result.stages.secondDamage, null); assert.equal(control.result.stages.secondDestroyed, null);
    assert.equal(qualifies(control.result), false, 'an incapable continuation cannot qualify');
  }
  assert.equal(noAcquisition.result.stages.secondAssault, null);
  assert.ok(noDelivery.result.stages.secondAssault !== null, 'an emitted order alone does not establish combat capability');
  if (process.env.RTS_PVE_CONTINUATION_EVIDENCE_DIR) await writeFile(path.join(process.env.RTS_PVE_CONTINUATION_EVIDENCE_DIR,
    `continuation-${team}.json`), JSON.stringify({ initial: positive.initial, setup: positive.setup, positive: positive.result, warm: warm.result,
      noAcquisition: noAcquisition.result, noDelivery: noDelivery.result }));
  console.log(JSON.stringify({ team, stagesSeconds: Object.fromEntries(Object.entries(positive.result.stages)
    .map(([key, tick]) => [key, (tick - positive.result.startTick) / 30])), controls: 'first target destroyed; second remains undamaged' }));
});
