import assert from 'node:assert/strict';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { armyAttackMap } from './army-attack-continuation-case.mjs';

// Ordinary paid production and commands. No actor, vision, position or HP patches.
export async function createStanceCase({ team = 0, kind = 'infantry', targets = [[2.5, .5], [2.5, 2.5]], obstacle = false, reveal = false, fog = true } = {}) {
  const map = armyAttackMap(), side = team ? -1 : 1;
  map.fogOfWar = fog;
  if (obstacle) map.obstacles = [{ column: 33, row: 31, width: 1, height: 3, material: 'stone' }];
  const fixture = await createPathingReplayFixture(map), r = fixture.replay, orders = [];
  const workers = seat => r.units.filter(u => u.team === seat && u.kind === 'worker');
  function order(seat, command, expected = /ORDER|PLACED|QUEUED/) {
    const notices = r.order(seat, command); r.drain();
    assert.ok(notices.some(n => expected.test(n.message)), JSON.stringify(notices));
    orders.push({ seat, tick: r.tick, command, notices });
    return notices;
  }
  function until(check, label, limit = 2000) {
    const start = r.tick;
    while (!check() && r.tick - start < limit) r.step();
    assert.ok(check(), label);
  }
  try {
    assert.ok(r.units.filter(u => u.kind !== 'worker').every(u => u.combatStance === 'aggressive'));
    for (const seat of [0, 1]) order(seat, { type: 'setStance', stance: 'noAttack',
      ids: r.units.filter(u => u.team === seat && u.kind !== 'worker').map(u => u.id) });
    if (kind === 'archer') {
      order(team, { type: 'build', buildingType: 'archery-range', ids: workers(team).map(u => u.id),
        x: -20.5 * side, z: -8.5 });
      until(() => r.buildings.every(b => b.complete), 'paid Range completes');
      order(team, { type: 'trainUnit', kind, buildingId: r.buildings[0].id });
      until(() => r.units.some(u => u.team === team && u.kind === kind), 'paid Archer spawns');
    }
    const unit = r.units.find(u => u.team === team && u.kind === kind);
    if (kind === 'archer') assert.equal(unit.combatStance, 'aggressive');
    order(team, { type: 'setStance', ids: [unit.id], stance: 'noAttack' });
    order(team, { type: 'move', ids: [unit.id], x: .5 * side, z: .5 });
    const enemies = workers(1 - team).slice(0, targets.length);
    for (const [i, enemy] of enemies.entries()) order(1 - team,
      { type: 'move', ids: [enemy.id], x: targets[i][0] * side, z: targets[i][1] });
    const observer = reveal ? workers(team)[0] : null;
    if (observer) order(team, { type: 'move', ids: [observer.id], x: 9.5 * side, z: 2.5 });
    until(() => [unit, ...enemies, ...(observer ? [observer] : [])].every(u => !u.movePlanningPending && u.pathIndex === u.path.length && u.hp > 0), 'actors arrive');
    for (let i = 0; i < 6; i++) r.step();
    assert.ok(enemies.every(e => r.snapshot(team).units.some(row => row[0] === e.id)), 'normal vision reveals targets');
    const origin = { x: unit.x, z: unit.z };
    return { fixture, r, unit, enemies, origin, team, side, orders, order, until,
      stance(value) { order(team, { type: 'setStance', ids: [unit.id], unitGenerations: [unit.generation], stance: value }); },
      step(count) { for (let i = 0; i < count; i++) r.step(); },
      dispose: () => fixture.dispose() };
  } catch (error) { await fixture.dispose(); throw error; }
}
