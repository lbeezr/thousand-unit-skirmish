import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { canTraverseStaticBodySegment, LAND_CLEARANCE_PROFILE } from '../src/unit-movement.mjs';
process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp';
process.env.RTS_PREGAME = '0'; process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '0'; delete process.env.RTS_MATCH_STATE_PATH;
const map = { id: 'patrol-acquired-probe', name: 'Acquired Patrol Probe', width: 64, height: 48,
  terrainSeed: 881, fogOfWar: false, startingArmySize: 16, startingResources: { food: 500, wood: 1000 },
  spawnPoints: [{ team: 0, x: -20, z: -16 }, { team: 1, x: 20, z: 16 }],
  resourceNodes: [], triggers: [], scenarioEvents: [],
  obstacles: [{ column: 33, row: 25, width: 1, height: 1, material: 'stone' }] };
const records = [];
for (const team of [0, 1]) for (const kind of ['infantry', 'archer']) {
  const fixture = await createPathingReplayFixture(map, { traceLandSteps: true }), r = fixture.replay;
  try {
    const command = (id, type, fields = {}) => r.order(r.units[id].team,
      { type, ids: [id], unitGenerations: [r.units[id].generation], ...fields });
    for (const seat of [0, 1]) { const units = r.units.filter(u => u.team === seat);
      r.order(seat, { type: 'stop', ids: units.map(u => u.id) });
      r.order(seat, { type: 'setStance', stance: 'noAttack', ids: units.filter(u => u.kind !== 'worker').map(u => u.id) }); }
    if (kind === 'archer') {
      const worker = r.units.find(u => u.team === team && u.kind === 'worker'), sign = team ? 1 : -1;
      command(worker.id, 'build', { buildingType: 'archery-range', x: sign * 25.5, z: sign * 16.5 }); r.drain();
      const home = r.buildings.find(b => b.team === team && b.type === 'archery-range'); assert.ok(home);
      for (let t = 0; t < 1500 && !home.complete; t++) r.step(); assert.ok(home.complete);
      assert.ok(r.order(team, { type: 'trainUnit', buildingId: home.id, kind }).some(n => /ARCHER QUEUED/.test(n.message)));
      for (let t = 0; t < 500 && !r.units.some(u => u.team === team && u.kind === kind); t++) r.step();
      const archer = r.units.find(u => u.team === team && u.kind === kind); command(archer.id, 'stop'); command(archer.id, 'setStance', { stance: 'noAttack' });
    }
    const id = r.units.find(u => u.team === team && u.kind === kind).id;
    const targetId = r.units.find(u => u.team !== team && u.kind === 'worker').id;
    command(id, 'move', { x: .75, z: .95 });
    command(targetId, 'move', kind === 'archer' ? { x: 5.45, z: .95 } : { x: 2.25, z: .95 }); r.drain();
    for (let t = 0; t < 800 && [r.units[id], r.units[targetId]].some(u => u.pathIndex < u.path.length); t++) r.step();
    assert.deepEqual([r.units[id].x, r.units[id].z], [.75, .95]);
    const notices = command(id, 'patrol', { x: 6.5, z: .5 }); r.drain(); command(id, 'setStance', { stance: 'aggressive' });
    const original = structuredClone(r.units[id].persistentOrder); let contacts = 0, steps = 0, killedAt = null, first;
    for (let t = 0; t < 600 && killedAt === null; t++) {
      r.step(); for (const s of r.landSteps.filter(s => s.id === id)) {
        steps++; if (!canTraverseStaticBodySegment(s.from, s.to, LAND_CLEARANCE_PROFILE.radiusByKind[kind], 64, 48, r.isWalkable)) {
          contacts++; first ??= { from: s.from, to: s.to, reason: s.reason };
        }
      }
      if (r.units[targetId].hp === 0) killedAt = t;
    }
    records.push({ team, kind, id, targetId, notices, original, contacts, steps, first, killedAt,
      anchor: [r.units[id].attackMoveAnchorX, r.units[id].attackMoveAnchorZ],
      currentLeg: r.units[id].persistentOrder.leg, hp: r.units[id].hp });
  } finally { await fixture.dispose(); }
}
console.log(JSON.stringify({ source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '', records }));
