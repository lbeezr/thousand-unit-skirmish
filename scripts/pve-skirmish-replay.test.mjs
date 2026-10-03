import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createPveHeadlessFixture } from './pve-headless-fixture.mjs';
import { createDeterministicPolicy, toOpponentObservation } from '../src/pve-opponent.mjs';

const identity = { matchModeId: 'skirmish', matchModeVersion: 1 };
async function assault(team, initial = null, configured = true) {
  const enemy = 1 - team, home = team ? 28 : -28, target = team ? 8 : -8;
  // An authored test map with reward-only rules exercises the policy configuration.
  // It does not advertise runtime Skirmish support or change a shipped map's hash.
  const map = { id: 'pve-skirmish-replay', name: 'Skirmish Paid Producer Regression',
    width: 80, height: 64, terrainSeed: 19, fogOfWar: true, startingArmySize: 24,
    startingResources: { food: 150, wood: 250 }, spawnPoints: [{ team, x: home, z: 0 },
      { team: enemy, x: -home, z: 0 }], obstacles: [],
    resourceNodes: [0, 1].flatMap(seat => [{ id: `food-${seat}`, type: 'food', x: seat ? 28 : -28, z: 6.5, stock: 1000 },
      { id: `wood-${seat}`, type: 'wood', x: seat ? 28 : -28, z: -6.5, stock: 1000 }]),
    triggers: [{ id: 'bonus', name: 'Bonus', type: 'capture-zone',
      zone: { column: target + 38, row: 30, width: 4, height: 4 }, requiredUnits: 5,
      captureSeconds: 9, foodReward: 0, woodReward: 0, unitCount: 0, unitKind: 'infantry', victory: false }], scenarioEvents: [] };
  const fixture = await createPveHeadlessFixture(map), r = fixture.replay;
  const trace = [], observation = seat => toOpponentObservation(r.observe(seat), seat, map);
  const order = async (seat, command) => {
    const notices = await r.order(seat, command); r.drain();
    assert.ok(!notices.some(n => /REJECTED|FAILED|UNREACHABLE/.test(n.message || '')), JSON.stringify(notices));
    trace.push({ tick: r.observe(team).tick, team: seat, command, notices });
  };
  const commandFor = (units, type, extra = {}) => ({ type, ids: units.map(u => u.id),
    unitGenerations: units.map(u => u.generation), ...extra });
  try {
    if (initial) r.restore(initial);
    else {
      for (const seat of [0, 1]) await order(seat, commandFor(observation(seat).units.friendly.filter(u => u.kind !== 'worker'), 'holdPosition'));
      const workers = observation(enemy).units.friendly.filter(u => u.kind === 'worker');
      await order(enemy, commandFor(workers, 'build', { buildingType: 'barracks', x: 0, z: 8 }));
      for (let i = 0; i < 3000 && !observation(enemy).buildings.friendly.some(b => b.type === 'barracks' && b.complete); i++) r.step();
      const barracks = observation(enemy).buildings.friendly.find(b => b.type === 'barracks' && b.complete);
      assert.ok(barracks, 'the opponent producer completes through ordinary paid construction');
      assert.equal(observation(enemy).resources.wood, 75);
      await order(enemy, { type: 'train', buildingId: barracks.id });
      await order(enemy, commandFor(workers, 'move', { x: -home, z: 6 }));
      for (let i = 0; i < 1200; i++) r.step();
      const recruited = observation(enemy).units.friendly.filter(u => u.kind !== 'worker');
      assert.equal(recruited.length, 9, 'one real paid land recruit keeps recovery possible');
      await order(enemy, commandFor(recruited, 'move', { x: -home, z: -8 }));
      for (let i = 0; i < 1200; i++) r.step();
      await order(enemy, commandFor(recruited, 'holdPosition'));
      await order(team, commandFor(observation(team).units.friendly.filter(u => u.kind !== 'worker'), 'attackMove', { x: target, z: 0 }));
      for (let i = 0; i < 3000 && observation(team).objectives[0].owner !== team; i++) r.step();
      assert.equal(observation(team).objectives[0].owner, team, 'the reward post was captured legally');
      assert.equal(r.observe(team).winner, -1, 'reward ownership does not end Skirmish');
      assert.ok(observation(team).buildings.visibleEnemies.some(b => b.type === 'barracks'), 'the paid target is actually visible');
      r.drain(); initial = r.checkpoint();
    }
    // Compare the common paid checkpoint onward; the first run alone has a prelude.
    trace.length = 0;
    let policy = createDeterministicPolicy(20260925, configured ? identity : {});
    let shadow = createDeterministicPolicy(20260925, configured ? identity : {});
    const startTick = r.observe(team).tick, spent = { food: 0, wood: 0 };
    const producer = observation(team).buildings.visibleEnemies.find(b => b.type === 'barracks');
    const originalHp = producer.hp;
    let firstAssault = null, damagedAt = null, destroyedAt = null, restartedAt = null;
    for (let i = 0; i <= 7200; i++) {
      if (i % 30 === 0) {
        const view = observation(team), commands = policy.next(view);
        assert.deepEqual(commands, shadow.next(structuredClone(view)));
        for (const command of commands) {
          if (command.type === 'attackBuilding' && command.buildingId === producer.id) firstAssault ??= view.tick;
          const before = observation(team).resources;
          await order(team, command);
          const after = observation(team).resources;
          for (const resource of ['food', 'wood']) spent[resource] += before[resource] - after[resource];
        }
        const current = r.checkpoint().state.buildings.find(b => b.id === producer.id && b.hp > 0);
        if (current && current.hp < originalHp) damagedAt ??= view.tick;
        if (!current) { destroyedAt = view.tick; break; }
        if (configured && damagedAt !== null && restartedAt === null) {
          r.drain(); const before = r.observe(team), checkpoint = r.checkpoint(); r.restore(checkpoint);
          assert.deepEqual(r.observe(team), before, 'restart preserves authoritative sight, banks, paths and damage');
          policy = createDeterministicPolicy(20260925, identity); shadow = createDeterministicPolicy(20260925, identity);
          restartedAt = view.tick; trace.push({ tick: view.tick, restart: true });
        }
      }
      r.step();
    }
    const final = r.checkpoint().state;
    for (const resource of ['food', 'wood']) {
      const stock = final.resourceNodes.find(node => node.id === `${resource}-${team}`).stock;
      const cargo = final.units.filter(u => u.team === team && u.hp > 0 && u.cargoType === resource).reduce((sum, u) => sum + u.cargo, 0);
      assert.ok(Math.abs(map.startingResources[resource] + 1000 - stock - cargo - spent[resource]
        - final[resource === 'food' ? 'teamFood' : 'teamWood'][team]) < 1e-5, 'all support construction/recruitment remains paid');
    }
    assert.equal(final.teamFood[enemy], 100); assert.equal(final.teamWood[enemy], 75);
    return { initial, result: { team, configured, startTick, originalHp, firstAssault, damagedAt, destroyedAt,
      restartedAt, winner: r.observe(team).winner, spent, trace, final } };
  } finally { await fixture.dispose(); }
}

for (const team of [0, 1]) test(`seat ${team}: paid producer assault after owned bonus, exact checkpoint replay and legacy control`, async () => {
  const first = await assault(team), replay = await assault(team, first.initial), legacy = await assault(team, first.initial, false);
  assert.deepEqual(replay.result, first.result, 'every resumed command, notice and terminal producer state replays exactly');
  assert.ok(first.result.firstAssault !== null && first.result.damagedAt !== null && first.result.destroyedAt !== null
    && first.result.restartedAt !== null, 'explicit Skirmish destroys the visible paid producer across restart');
  assert.equal(legacy.result.firstAssault, null);
  assert.equal(legacy.result.damagedAt, null, 'legacy remains idle after it owns the only post');
  if (process.env.RTS_PVE_SKIRMISH_EVIDENCE_DIR) await writeFile(path.join(process.env.RTS_PVE_SKIRMISH_EVIDENCE_DIR,
    `paid-producer-${team}.json`), JSON.stringify({ initial: first.initial, candidate: first.result, legacy: legacy.result }));
  const result = first.result;
  console.log(JSON.stringify({ team, firstAssaultSeconds: (result.firstAssault - result.startTick) / 30,
    damageSeconds: (result.damagedAt - result.startTick) / 30, destroyedSeconds: (result.destroyedAt - result.startTick) / 30,
    restartedSeconds: (result.restartedAt - result.startTick) / 30, legacyObservedSeconds: 240, winner: result.winner }));
});
