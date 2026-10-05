import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { canTraverseStaticBodySegment, LAND_CLEARANCE_PROFILE } from '../src/unit-movement.mjs';
process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp';
process.env.RTS_PREGAME = '0'; process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '0'; delete process.env.RTS_MATCH_STATE_PATH;
const map = { id: 'follow-travel-probe', name: 'Follow Travel Probe', width: 64, height: 48,
  terrainSeed: 881, fogOfWar: false, startingArmySize: 16, startingResources: { food: 800, wood: 2000 },
  spawnPoints: [{ team: 0, x: -20, z: -16 }, { team: 1, x: 20, z: 16 }],
  resourceNodes: [], triggers: [], scenarioEvents: [],
  obstacles: [{ column: 33, row: 25, width: 1, height: 1, material: 'stone' }] };
const records = [];
for (const team of [0, 1]) for (const kind of ['infantry', 'archer']) {
  const fixture = await createPathingReplayFixture(map, { traceLandSteps: true, traceRouteRejoins: true }), r = fixture.replay;
  try {
    const command = (id, type, fields = {}) => r.order(r.units[id].team,
      { type, ids: [id], unitGenerations: [r.units[id].generation], ...fields });
    for (const seat of [0, 1]) {
      const units = r.units.filter(u => u.team === seat); r.order(seat, { type: 'stop', ids: units.map(u => u.id) });
      r.order(seat, { type: 'setStance', stance: 'noAttack', ids: units.filter(u => u.kind !== 'worker').map(u => u.id) });
    }
    if (kind === 'archer') {
      const builder = r.units.find(u => u.team === team && u.kind === 'worker'), sign = team ? 1 : -1;
      command(builder.id, 'build', { buildingType: 'archery-range', x: sign * 25.5, z: sign * 16.5 }); r.drain();
      const home = r.buildings.find(b => b.team === team && b.type === 'archery-range'); assert.ok(home);
      for (let t = 0; t < 1500 && !home.complete; t++) r.step(); assert.ok(home.complete);
      assert.ok(r.order(team, { type: 'trainUnit', buildingId: home.id, kind }).some(n => /ARCHER QUEUED/.test(n.message)));
      for (let t = 0; t < 500 && !r.units.some(u => u.team === team && u.kind === kind); t++) r.step();
      const archer = r.units.find(u => u.team === team && u.kind === kind); command(archer.id, 'stop'); command(archer.id, 'setStance', { stance: 'noAttack' });
    }
    const id = r.units.find(u => u.team === team && u.kind === kind).id;
    const leader = r.units.find(u => u.team === team && u.kind === 'worker');
    command(leader.id, 'move', { x: 6.5, z: .5 }); command(id, 'move', { x: .75, z: .95 }); r.drain();
    for (let t = 0; t < 800 && [r.units[id], leader].some(u => u.pathIndex < u.path.length); t++) r.step();
    assert.deepEqual([r.units[id].x, r.units[id].z], [.75, .95]);
    const notices = command(id, 'follow', { targetId: leader.id, targetGeneration: leader.generation });
    assert.ok(notices.some(n => /FOLLOW ORDER/.test(n.message)));
    let contacts = 0, steps = 0, stoppedTick, first, pendingGoal, selected, published, rejoin;
    for (let t = 0; t < 600; t++) {
      r.step(); pendingGoal ??= r.units[id].movePlanningPending ? r.units[id].moveGoalCell : undefined;
      const join = r.routeRejoins.find(j => j.id === id);
      if (join && !selected) { selected = join.selected; published = join.path; rejoin = join.rejoin; }
      for (const s of r.landSteps.filter(s => s.id === id)) {
        steps++; if (!canTraverseStaticBodySegment(s.from, s.to, LAND_CLEARANCE_PROFILE.radiusByKind[kind], 64, 48, r.isWalkable)) {
          contacts++; first ??= { from: s.from, to: s.to, reason: s.reason };
        }
      }
      if (Math.hypot(leader.x - r.units[id].x, leader.z - r.units[id].z) <= 4
        && !r.units[id].movePlanningPending && r.units[id].path.length === 0) stoppedTick ??= t;
    }
    const u = r.units[id]; records.push({ team, kind, id, leaderId: leader.id, leaderGeneration: leader.generation, notices,
      contacts, steps, first, pendingGoal, selected, published, rejoin, stoppedTick,
      final: { x: u.x, z: u.z, goal: u.moveGoalCell, revision: u.orderRevision,
        hp: u.hp, persistentOrder: structuredClone(u.persistentOrder), distance: Math.hypot(leader.x - u.x, leader.z - u.z) } });
  } finally { await fixture.dispose(); }
}
console.log(JSON.stringify({ source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '', records }));
