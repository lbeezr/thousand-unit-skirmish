import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { armyAttackMap } from './army-attack-continuation-case.mjs';

export async function runUnqueuedFogLossCase(team) {
  const fixture = await createPathingReplayFixture(armyAttackMap());
  const r = fixture.replay, side = team ? -1 : 1;
  const workers = seat => r.units.filter(u => u.team === seat && u.kind === 'worker');
  const trace = createHash('sha256'), orders = [];
  const order = (seat, command, expected) => {
    const notices = r.order(seat, command);
    r.drain();
    assert.ok(notices.some(n => expected.test(n.message)), JSON.stringify(notices));
    orders.push({ tick: r.tick, seat, command, notices });
  };
  const until = (check, description, limit = 2200) => {
    const start = r.tick;
    while (!check() && r.tick - start < limit) r.step();
    assert.ok(check(), description);
  };
  try {
    for (const seat of [0, 1]) order(seat, { type: 'setStance', stance: 'noAttack',
      ids: r.units.filter(u => u.team === seat && u.kind !== 'worker').map(u => u.id) }, /STANCE ORDER/);
    order(team, { type: 'build', buildingType: 'archery-range', ids: workers(team).map(u => u.id),
      x: team ? 20.5 : -20.5, z: -8.5 }, /PLACED/);
    until(() => r.buildings.every(b => b.complete), 'paid range completes');
    order(team, { type: 'trainUnit', buildingId: r.buildings[0].id, kind: 'archer' }, /QUEUED/);
    until(() => r.units.some(u => u.kind === 'archer'), 'paid Archer spawns');
    const archer = r.units.find(u => u.kind === 'archer');
    order(team, { type: 'setStance', ids: [archer.id], stance: 'noAttack' }, /STANCE ORDER/);
    const focused = workers(1 - team)[0], nearby = workers(1 - team)[1], observer = workers(team)[0];
    order(team, { type: 'move', ids: [archer.id], x: -20.5 * side, z: -14.5 }, /MOVE ORDER/);
    order(team, { type: 'move', ids: [observer.id], x: -2.5 * side, z: .5 }, /MOVE ORDER/);
    order(1 - team, { type: 'move', ids: [focused.id], x: .5 * side, z: .5 }, /MOVE ORDER/);
    order(1 - team, { type: 'move', ids: [nearby.id], x: -18.5 * side, z: -14.5 }, /MOVE ORDER/);
    until(() => [archer, focused, nearby, observer].every(u => !u.movePlanningPending
      && u.pathIndex === u.path.length), 'actors arrive by ordinary movement');
    for (let i = 0; i < 6; i++) r.step();
    assert.ok([focused, nearby].every(u => r.snapshot(team).units.some(row => row[0] === u.id)),
      'both targets visible at focused Attack admission');
    order(team, { type: 'setStance', ids: [archer.id], stance: 'aggressive' }, /STANCE ORDER/);
    order(team, { type: 'attack', ids: [archer.id], unitGenerations: [archer.generation],
      targetId: focused.id, targetGeneration: focused.generation }, /ATTACK ORDER/);
    assert.equal(archer.attackTargetId, focused.id, 'clicked target receives priority');
    order(team, { type: 'move', ids: [observer.id], x: -20.5 * side, z: .5 }, /MOVE ORDER/);
    const start = r.tick;
    let fogLossTick = null, nearbyAcquiredTick = null;
    for (let i = 0; i < 400; i++) {
      r.step();
      assert.equal(archer.queuedWaypoints.length, 0, 'this case has no queued continuation');
      const visible = r.snapshot(team).units.some(row => row[0] === focused.id);
      if (!visible && fogLossTick === null) fogLossTick = r.tick - start;
      if (archer.attackTargetId === nearby.id && nearbyAcquiredTick === null) {
        nearbyAcquiredTick = r.tick - start;
      }
      trace.update(JSON.stringify([r.tick, archer.x, archer.z, archer.attackTargetId,
        archer.attackMove, focused.hp, nearby.hp, visible]) + '\n');
    }
    assert.notEqual(fogLossTick, null, 'focused target loses ordinary friendly vision');
    assert.notEqual(nearbyAcquiredTick, null, 'unqueued military Attack acquires a nearby visible enemy after fog loss');
    assert.ok(nearbyAcquiredTick >= fogLossTick && nearbyAcquiredTick <= fogLossTick + 30,
      'local combat continuation is prompt');
    assert.equal(focused.hp, 100, 'hidden focused target never takes damage');
    assert.ok(nearby.hp < 100, 'nearby visible target takes real damage without another Attack');
    return { team, sourceSha256: fixture.sourceSha256, fogLossTick, nearbyAcquiredTick,
      focusedHp: focused.hp, nearbyHp: nearby.hp, traceSha256: trace.digest('hex'), orders };
  } finally { await fixture.dispose(); }
}
