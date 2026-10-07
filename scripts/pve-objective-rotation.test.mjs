import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createObjectiveRotationPolicy, PVE_OBJECTIVE_ROTATION_LIMITS as limits } from '../src/simulation/ai/policies/objective-rotation.mjs';
import { replayPaidObstruction } from './pve-objective-rotation-case.mjs';

function fixture(team) {
  return { observation: { team, tick: 0, map: { width: 80, height: 64 }, objectives: [
    { id: 'a', zone: { column: 38, row: 30, width: 4, height: 4 }, progressTeam: -1, progress: 0 },
    { id: 'b', zone: { column: 48, row: 30, width: 4, height: 4 } }] },
  soldiers: [{ id: 1, team, generation: 1, hp: 100, x: -5, z: 0, focusedCount: 0, lastAttack: null }],
  targets: [{ id: 'a', point: { x: 0, z: 0 } }, { id: 'b', point: { x: 10, z: 0 } }] };
}
for (const team of [0, 1]) {
  test(`seat ${team}: oscillation and reinforcements cannot postpone an empty goal forever`, () => {
    const { observation: view, soldiers, targets } = fixture(team), policy = createObjectiveRotationPolicy();
    assert.equal(policy.next(view, soldiers, targets).id, 'a');
    for (let tick = 30; tick < limits.stallTicks; tick += 30) {
      view.tick = tick; soldiers[0].z = tick % 60 ? 1 : -1;
      assert.equal(policy.next(view, [...soldiers, { ...soldiers[0], id: 2, x: -20 }], targets).id, 'a');
    }
    view.tick = limits.stallTicks;
    assert.equal(policy.next(view, soldiers, targets).id, 'b');
    assert.equal(policy.next(view, soldiers, targets).id, 'b', 'duplicate decision is stable');
    view.tick = 0;
    assert.equal(policy.next(view, soldiers, targets).id, 'a', 'reset drops old-match cooldowns');
    view.tick = limits.stallTicks;
    assert.equal(policy.next(view, soldiers, targets).id, 'b');
    view.tick += limits.cooldownTicks;
    assert.equal(policy.next(view, soldiers, targets).id, 'a', 'temporary exclusion expires');
    assert.equal(policy.next(view, soldiers, [targets[0]]).id, 'a', 'the only eligible goal remains actionable');
    assert.equal(policy.next(view, [], []), null);
  });

  test(`seat ${team}: approach, capture, occupancy and combat protect healthy pressure`, () => {
    for (const progress of ['approach', 'inside', 'capture', 'focused', 'recent']) {
      const { observation: view, soldiers, targets } = fixture(team), policy = createObjectiveRotationPolicy();
      policy.next(view, soldiers, targets); view.tick = limits.stallTicks;
      if (progress === 'approach') soldiers[0].x = -4;
      if (progress === 'inside') soldiers[0].x = 0;
      if (progress === 'capture') { view.objectives[0].progressTeam = team; view.objectives[0].progress = .1; }
      if (progress === 'focused') soldiers[0].focusedCount = 1;
      if (progress === 'recent') soldiers[0].lastAttack = { tick: view.tick - 119 };
      assert.equal(policy.next(view, soldiers, targets).id, 'a', progress);
      view.tick += 30;
      assert.equal(policy.next(view, soldiers, targets).id, 'a');
    }
    const { observation: view, soldiers, targets } = fixture(team), single = createObjectiveRotationPolicy();
    single.next(view, soldiers, targets.slice(0, 1)); view.tick = limits.stallTicks * 10;
    assert.equal(single.next(view, soldiers, targets.slice(0, 1)).id, 'a');
    view.tick = 0; assert.equal(single.next(view, soldiers, targets).id, 'a', 'a reset cannot inherit an expired watch');
  });

  test(`seat ${team}: expired cooldown cannot override healthy alternative pressure`, () => {
    for (const progress of ['approach', 'inside', 'capture', 'focused', 'recent']) {
      const { observation: view, soldiers, targets } = fixture(team), policy = createObjectiveRotationPolicy();
      policy.next(view, soldiers, targets); view.tick = limits.stallTicks;
      assert.equal(policy.next(view, soldiers, targets).id, 'b');
      view.tick += limits.cooldownTicks;
      if (progress === 'approach') soldiers[0].x = 4;
      if (progress === 'inside') soldiers[0].x = 10;
      if (progress === 'capture') { view.objectives[1].progressTeam = team; view.objectives[1].progress = .1; }
      if (progress === 'focused') soldiers[0].focusedCount = 1;
      if (progress === 'recent') soldiers[0].lastAttack = { tick: view.tick - 119 };
      assert.equal(policy.next(view, soldiers, targets).id, 'b', progress);
      view.tick += 30;
      assert.equal(policy.next(view, soldiers, targets).id, 'b', 'expiry protection persists beyond one decision');
      assert.equal(policy.next(view, soldiers, [targets[0]]).id, 'a', 'a captured/ineligible goal cannot retain the army');
    }
  });

  test(`seat ${team}: paid wall obstruction rotates to reachable victory across checkpoint replay`, async () => {
    const first = await replayPaidObstruction(team), replay = await replayPaidObstruction(team, { initial: first.initial });
    assert.deepEqual(replay.result, first.result, 'every restarted authoritative command, notice and final state replays exactly');
    const result = first.result;
    assert.equal(result.winner, team);
    assert.ok(result.restartedAt !== null && result.alternativeAt !== null);
    assert.ok(result.endTick - result.startTick <= 5400, 'legal alternative pressure finishes within the bounded 180-second run');
    assert.deepEqual(result.owners, [{ id: 'blocked-watch', owner: -1 }, { id: 'open-watch', owner: team }]);
    if (process.env.RTS_PVE_ROTATION_EVIDENCE_DIR) await writeFile(path.join(process.env.RTS_PVE_ROTATION_EVIDENCE_DIR,
      `restarted-candidate-${team}.json`), JSON.stringify(first));
    console.log(JSON.stringify({ team, restartSeconds: (result.restartedAt - result.startTick) / 30,
      alternativeSeconds: (result.alternativeAt - result.startTick) / 30, victorySeconds: (result.endTick - result.startTick) / 30 }));
  });
}
