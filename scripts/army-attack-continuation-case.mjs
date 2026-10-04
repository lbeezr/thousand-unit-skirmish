import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';

export function armyAttackMap() {
  return { id: 'army-attack-continuation', name: 'Army attack continuation', width: 64, height: 64,
    terrainSeed: 19, fogOfWar: true, startingArmySize: 24, startingResources: { food: 1000, wood: 1000 },
    spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
    obstacles: [], resourceNodes: [], triggers: [], scenarioEvents: [] };
}

// Paid production and ordinary accepted commands; no unit positions, kinds,
// damage, visibility or target state are patched by this reproducer.
export async function runArmyAttackCase({ team = 0, kind = 'archer', group = 1,
  type = 'attack', interrupt = null, observe = false, obstacle = false, stance = 'aggressive' } = {}) {
  const map = armyAttackMap();
  if (obstacle) map.obstacles = [{ column: 30, row: 30, width: 1, height: 3, material: 'stone' }];
  const fixture = await createPathingReplayFixture(map), r = fixture.replay;
  const orders = [], trace = createHash('sha256');
  const side = team ? -1 : 1;
  const workers = seat => r.units.filter(u => u.team === seat && u.kind === 'worker');
  const until = (check, description, limit = 1800) => {
    const start = r.tick;
    while (!check() && r.tick - start < limit) r.step();
    assert.ok(check(), description);
  };
  const order = (seat, command, expected) => {
    const notices = r.order(seat, command); r.drain();
    assert.ok(notices.some(n => expected.test(n.message)), JSON.stringify(notices));
    orders.push({ tick: r.tick, seat, command, notices });
  };
  try {
    for (const seat of [0, 1]) order(seat, { type: 'setStance', stance: 'noAttack',
      ids: r.units.filter(u => u.team === seat && u.kind !== 'worker').map(u => u.id) }, /STANCE ORDER/);
    if (kind === 'archer') {
      order(team, { type: 'build', buildingType: 'archery-range', ids: workers(team).map(u => u.id),
        x: team ? 20.5 : -20.5, z: -8.5 }, /RANGE PLACED/);
      until(() => r.buildings.every(b => b.complete), 'paid range completes');
      const building = r.buildings.find(b => b.type === 'archery-range');
      for (let i = 0; i < group; i++) order(team,
        { type: 'trainUnit', buildingId: building.id, kind }, /QUEUED/);
      until(() => r.units.filter(u => u.team === team && u.kind === kind).length === group,
        'paid archers spawn');
    }
    const attackers = r.units.filter(u => u.team === team && u.kind === kind).slice(0, group);
    assert.equal(attackers.length, group);
    order(team, { type: 'setStance', ids: attackers.map(u => u.id), stance: 'noAttack' }, /STANCE ORDER/);
    const targets = workers(1 - team).slice(0, 2);
    for (const [i, target] of targets.entries()) order(1 - team,
      { type: 'move', ids: [target.id], x: .5 * side, z: .5 + i * 2 }, /MOVE ORDER/);
    order(team, { type: 'move', ids: attackers.map(u => u.id),
      x: (kind === 'archer' ? -3.5 : -4.5) * side, z: .5 }, /MOVE ORDER/);
    const observer = obstacle ? workers(team)[0] : null;
    if (observer) order(team, { type: 'move', ids: [observer.id], x: 1.5 * side, z: 3.5 }, /MOVE ORDER/);
    until(() => [...targets, ...attackers].every(u => !u.movePlanningPending && u.pathIndex === u.path.length),
      'both groups reach their commanded positions');
    if (observer) until(() => !observer.movePlanningPending && observer.pathIndex === observer.path.length,
      'friendly observer reveals targets beyond the obstacle');
    // Vision refreshes on the normal state cadence, as it does in the live worker.
    for (let i = 0; i < 6; i++) r.step();
    assert.ok(targets.every(t => r.snapshot(team).units.some(row => row[0] === t.id)), 'both targets visible');
    const distant = workers(1 - team).find(u => !targets.includes(u));
    assert.ok(distant && !r.snapshot(team).units.some(row => row[0] === distant.id));
    order(team, { type: 'setStance', ids: attackers.map(u => u.id), stance }, /STANCE ORDER/);
    const startTick = r.tick, destination = { x: 7.5 * side, z: .5 };
    if (type === 'attack') order(team, { type, ids: attackers.map(u => u.id),
      unitGenerations: attackers.map(u => u.generation), targetId: targets[0].id,
      targetGeneration: targets[0].generation }, /ATTACK ORDER/);
    else if (type === 'attackMove') order(team,
      { type, ids: attackers.map(u => u.id), ...destination }, /ATTACK MOVE ORDER/);
    else if (type === 'holdPosition' || type === 'stop') order(team,
      { type, ids: attackers.map(u => u.id) }, /ORDER/);
    assert.ok(['attack', 'attackMove', 'idle', 'stop', 'holdPosition'].includes(type));
    const originalGoals = attackers.map(u => u.moveGoalCell);
    let firstDeath = null, secondHit = null, secondDeath = null, interruptedAt = null, interruptPosition = null;
    for (let i = 0; i < 1200; i++) {
      r.step();
      if (type === 'attack' && targets[0].hp > 0 && !interruptedAt) {
        assert.ok(attackers.every(u => u.attackTargetId === targets[0].id), 'clicked target retains priority');
        assert.equal(targets[1].hp, 100, 'second target waits for the focused target');
      }
      if (targets[0].hp === 0 && firstDeath === null) firstDeath = r.tick - startTick;
      if (targets[1].hp < 100 && secondHit === null) secondHit = r.tick - startTick;
      if (targets[1].hp === 0 && secondDeath === null) secondDeath = r.tick - startTick;
      if (interrupt && targets[0].hp < 100 && interruptedAt === null) {
        const command = interrupt === 'move' ? { type: 'move', ids: attackers.map(u => u.id), x: -12.5 * side, z: -8.5 }
          : { type: interrupt, ids: attackers.map(u => u.id) };
        order(team, command, /ORDER/); interruptedAt = r.tick - startTick;
        interruptPosition = attackers.map(u => [u.x, u.z]);
      }
      if (interruptedAt !== null && interrupt === 'stop') {
        assert.deepEqual(attackers.map(u => [u.x, u.z]), interruptPosition);
        assert.ok(attackers.every(u => u.attackTargetId < 0 && !u.attackMove));
      }
      trace.update(JSON.stringify([attackers.map(u => [u.x, u.z, u.attackTargetId, u.lastAttackTick, u.attackMove]),
        targets.map(u => u.hp)]) + '\n');
      if (secondDeath !== null && type !== 'attackMove') break;
    }
    const arrived = attackers.every((u, i) => u.pathIndex === u.path.length && !u.movePlanningPending
      && Math.hypot(u.x - r.point(originalGoals[i]).x, u.z - r.point(originalGoals[i]).z) < .02);
    const result = { team, kind, group, type, interrupt, obstacle, sourceSha256: fixture.sourceSha256,
      ticks: r.tick - startTick, firstDeath, secondHit, secondDeath, interruptedAt,
      targetHp: targets.map(u => u.hp), attackers: attackers.map(u => ({ id: u.id, x: u.x, z: u.z,
        hp: u.hp, attackTargetId: u.attackTargetId, attackMove: u.attackMove })),
      arrived, orders, traceSha256: trace.digest('hex') };
    assert.equal(distant.hp, 100, 'hidden distant enemy is never damaged');
    if (!observe && !interrupt && ['attack', 'attackMove'].includes(type)) {
      assert.deepEqual(result.targetHp, [0, 0], JSON.stringify(result));
      if (type === 'attackMove') assert.equal(arrived, true, 'attack-move resumes its ground destination');
    }
    if (interrupt === 'move') assert.ok(attackers.every(u => u.attackTargetId < 0 && !u.movePlanningPending && u.pathIndex === u.path.length));
    return result;
  } finally { await fixture.dispose(); }
}
