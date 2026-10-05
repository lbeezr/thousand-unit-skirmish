import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';
import { createDeterministicPolicy, toOpponentObservation } from '../src/pve-opponent.mjs';
import { assertTinySearchCompletion } from './pve-tiny-failure-evidence.mjs';

export const TINY_POLICY_IDENTITY = { matchModeId: 'skirmish', matchModeVersion: 1 };
// Native identity is explicit: authored elimination can test the configured
// policy while registry admission is pending, without claiming native Skirmish.
export async function replayTinySearch(seeds, nativeIdentity, initial = null) {
  const map = JSON.parse(await readFile(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url)));
  assert.equal(map.width, 160); assert.equal(map.height, 160);
  assert.ok(map.triggers.every(post => !post.victory));
  assert.equal(map.victoryHoldSeconds, undefined); assert.equal(map.timedVictory, undefined);
  const fixture = await createPveHeadlessFixture(map, nativeIdentity), r = fixture.replay, trace = [];
  const lastDecisionViews = [null, null];
  const metrics = [0, 1].map(() => ({ producerPurchase: null, producerComplete: null,
    buildingAssault: null, maxMilitary: 8, maxWorkers: 4, spentFood: 0, spentWood: 0 }));
  const view = team => toOpponentObservation(r.observe(team), team, map);
  try {
    if (initial) r.restore(initial); else initial = r.checkpoint();
    assert.equal(initial.matchModeId, nativeIdentity.matchModeId);
    assert.equal(initial.matchModeVersion, nativeIdentity.matchModeVersion);
    assert.deepEqual(initial.state.teamFood, [150, 150]);
    assert.deepEqual(initial.state.teamWood, [250, 250]);
    assert.equal(initial.state.units.filter(unit => unit.hp > 0).length, 24);
    for (const team of [0, 1]) {
      assert.equal(view(team).units.visibleEnemies.length, 0, 'opening enemy army remains hidden');
      assert.equal(view(team).buildings.visibleEnemies.length, 0);
      const state = r.observe(team), changed = structuredClone(state), enemy = 1 - team;
      changed.food[enemy] = 100000; changed.wood[enemy] = 100000;
      changed.units.push([10000, enemy, enemy ? 57.5 : -57.5, .5, 100, 'worker', 0, '', 1]);
      const a = toOpponentObservation(state, team, map), b = toOpponentObservation(changed, team, map);
      assert.deepEqual(a, b, 'hidden banks and entities cannot change the policy observation');
      assert.deepEqual(createDeterministicPolicy(seeds[team], TINY_POLICY_IDENTITY).next(a),
        createDeterministicPolicy(seeds[team], TINY_POLICY_IDENTITY).next(b));
    }
    let policies = seeds.map(seed => createDeterministicPolicy(seed, TINY_POLICY_IDENTITY));
    for (let step = 0; step < 108000; step++) {
      if (step % 30 === 0) {
        if (step === 18000) {
          r.drain(); const before = [r.observe(0), r.observe(1)], checkpoint = r.checkpoint();
          r.restore(checkpoint);
          for (const team of [0, 1]) assertRecoveredWorkerObservation(r.observe(team), before[team]);
          policies = seeds.map(seed => createDeterministicPolicy(seed, TINY_POLICY_IDENTITY));
          trace.push({ tick: r.observe(0).tick, restart: true });
        }
        for (const team of [0, 1]) {
          const observation = view(team), metric = metrics[team];
          lastDecisionViews[team] = structuredClone(observation);
          const living = observation.units.friendly.filter(unit => unit.hp > 0);
          metric.maxMilitary = Math.max(metric.maxMilitary, living.filter(unit => unit.kind !== 'worker').length);
          metric.maxWorkers = Math.max(metric.maxWorkers, living.filter(unit => unit.kind === 'worker').length);
          if (observation.buildings.friendly.some(building => building.type === 'barracks' && building.complete)) {
            metric.producerComplete ??= observation.tick;
          }
          for (const command of policies[team].next(observation)) {
            if (command.type === 'attackBuilding') {
              assert.ok(observation.buildings.visibleEnemies.some(building => building.id === command.buildingId));
              metric.buildingAssault ??= observation.tick;
            }
            if (command.type === 'build' && command.buildingType === 'barracks') metric.producerPurchase ??= observation.tick;
            const before = r.observe(team), notices = await r.order(team, command); r.drain();
            assert.ok(!notices.some(notice => /REJECTED|FAILED|UNREACHABLE/.test(notice.message || '')), JSON.stringify({ command, notices }));
            const after = r.observe(team);
            metric.spentFood += before.food[team] - after.food[team];
            metric.spentWood += before.wood[team] - after.wood[team];
            trace.push({ tick: observation.tick, team, command, notices });
          }
        }
        if (r.observe(0).winner !== -1) break;
      }
      r.step();
    }
    const final = r.checkpoint();
    assertTinySearchCompletion({ initial, final, trace, metrics, lastDecisionViews,
      seeds, nativeIdentity, policyIdentity: TINY_POLICY_IDENTITY });
    assert.equal(final.state.matchWinnerReason, 'elimination');
    for (const metric of metrics) {
      assert.ok(metric.producerPurchase !== null && metric.producerComplete !== null);
      assert.ok(metric.spentFood > 0 && metric.spentWood >= 175, 'native commands debit production costs');
    }
    const terminal = { seconds: r.observe(0).tick / 30, winner: final.state.matchWinner,
      reason: final.state.matchWinnerReason };
    r.prepare(map, nativeIdentity);
    const rematch = r.checkpoint();
    assert.equal(rematch.state.matchWinner, -1);
    assert.equal(r.observe(0).tick, terminal.seconds * 30, 'native rematch retains the monotonic simulation tick');
    assert.equal(rematch.state.units.filter(unit => unit.hp > 0).length, 24);
    assert.deepEqual(rematch.state.teamFood, [150, 150]); assert.deepEqual(rematch.state.teamWood, [250, 250]);
    assert.equal(rematch.matchModeId, nativeIdentity.matchModeId);
    assert.equal(rematch.matchModeVersion, nativeIdentity.matchModeVersion);
    for (const team of [0, 1]) assert.equal(view(team).units.visibleEnemies.length, 0, 'native reset clears terminal enemy sight');
    return { initial, result: { nativeIdentity, policyIdentity: TINY_POLICY_IDENTITY, seeds,
      terminal, metrics, trace, final, rematch } };
  } finally { await fixture.dispose(); }
}
