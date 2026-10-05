import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { canTraverseStaticBodySegment, LAND_CLEARANCE_PROFILE } from '../src/unit-movement.mjs';
process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp';
process.env.RTS_PREGAME = '0'; process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '0'; delete process.env.RTS_MATCH_STATE_PATH;
const map = { id: 'focused-building-attack-probe', name: 'Focused Building Attack Probe', width: 64, height: 48,
  terrainSeed: 881, fogOfWar: false, startingArmySize: 16, startingResources: { food: 800, wood: 2000 },
  spawnPoints: [{ team: 0, x: -20, z: -16 }, { team: 1, x: 20, z: 16 }],
  resourceNodes: [], triggers: [], scenarioEvents: [],
  obstacles: [{ column: 33, row: 25, width: 1, height: 1, material: 'stone' }] };
const records = [];
for (const team of [0, 1]) for (const kind of ['infantry', 'archer']) for (const buildingType of ['palisade-wall', 'house']) {
  const fixture = await createPathingReplayFixture(map, { traceLandSteps: true }), r = fixture.replay;
  try {
    const command = (id, type, fields = {}) => r.order(r.units[id].team,
      { type, ids: [id], unitGenerations: [r.units[id].generation], ...fields });
    for (const seat of [0, 1]) { const units = r.units.filter(u => u.team === seat);
      r.order(seat, { type: 'stop', ids: units.map(u => u.id) });
      r.order(seat, { type: 'setStance', stance: 'noAttack', ids: units.filter(u => u.kind !== 'worker').map(u => u.id) }); }
    if (kind === 'archer') {
      const builder = r.units.find(u => u.team === team && u.kind === 'worker'), sign = team ? 1 : -1;
      command(builder.id, 'build', { buildingType: 'archery-range', x: sign * 25.5, z: sign * 16.5 }); r.drain();
      const home = r.buildings.find(b => b.team === team && b.type === 'archery-range'); assert.ok(home);
      for (let t = 0; t < 1500 && !home.complete; t++) r.step(); assert.ok(home.complete);
      assert.ok(r.order(team, { type: 'trainUnit', buildingId: home.id, kind }).some(n => /ARCHER QUEUED/.test(n.message)));
      for (let t = 0; t < 500 && !r.units.some(u => u.team === team && u.kind === kind); t++) r.step();
      const archer = r.units.find(u => u.team === team && u.kind === kind); command(archer.id, 'stop'); command(archer.id, 'setStance', { stance: 'noAttack' });
    }
    const builder = r.units.find(u => u.team !== team && u.kind === 'worker'), wood = r.wood[1 - team];
    const point = { x: buildingType === 'house' ? 8.5 : 6.5, z: .5 };
    command(builder.id, 'build', { buildingType, ...point }); r.drain();
    const target = r.buildings.find(b => b.team !== team && b.type === buildingType); assert.ok(target);
    assert.ok(r.wood[1 - team] < wood);
    for (let t = 0; t < 1600 && !target.complete; t++) r.step(); assert.ok(target.complete);
    command(builder.id, 'stop'); command(builder.id, 'move', { x: 20.5, z: -16.5 }); r.drain();
    for (let t = 0; t < 800 && builder.pathIndex < builder.path.length; t++) r.step();
    const id = r.units.find(u => u.team === team && u.kind === kind).id;
    command(id, 'move', { x: .75, z: .95 }); r.drain();
    for (let t = 0; t < 800 && r.units[id].pathIndex < r.units[id].path.length; t++) r.step();
    assert.deepEqual([r.units[id].x, r.units[id].z], [.75, .95]);
    const notices = command(id, 'attackBuilding', { buildingId: target.id });
    assert.ok(notices.some(n => /ATTACK BUILDING ORDER/.test(n.message)));
    const initial = { position: { x: r.units[id].x, z: r.units[id].z }, path: [...r.units[id].path],
      goal: r.units[id].moveGoalCell, revision: r.units[id].orderRevision,
      targetId: target.id, footprint: [...target.footprint], hp: target.hp };
    let contacts = 0, steps = 0, firstDamage = null, first;
    for (let t = 0; t < 500; t++) {
      const hp = target.hp; r.step(); if (target.hp < hp) firstDamage ??= t;
      for (const s of r.landSteps.filter(s => s.id === id)) {
        steps++; if (!canTraverseStaticBodySegment(s.from, s.to, LAND_CLEARANCE_PROFILE.radiusByKind[kind], 64, 48, r.isWalkable)) {
          contacts++; first ??= { from: s.from, to: s.to, reason: s.reason };
        }
      }
    }
    records.push({ team, kind, buildingType, id, notices, initial, contacts, steps, first, firstDamage,
      hpAfter500: target.hp, final: { x: r.units[id].x, z: r.units[id].z,
        goal: r.units[id].moveGoalCell, targetId: r.units[id].attackBuildingTargetId, revision: r.units[id].orderRevision } });
  } finally { await fixture.dispose(); }
}
console.log(JSON.stringify({ source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '', records }));
