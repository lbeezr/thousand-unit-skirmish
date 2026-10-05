import assert from 'node:assert/strict';
import test from 'node:test';
import { focusedBuildingAttackMovementActive } from '../src/combat-movement.mjs';
import { UNIT_DEFINITIONS, BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { combatDamage } from '../src/combat-rules.mjs';
import { activeLandMovementBodyRadius, canTraverseStaticBodySegment, LAND_CLEARANCE_PROFILE } from '../src/unit-movement.mjs';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';

test('focused building Attack clearance follows explicit military intent, including noAttack', () => {
  const unit = { kind: 'infantry', hp: 100, attackTargetId: -1, attackBuildingTargetId: 0,
    combatStance: 'noAttack', gatherNodeId: null, gatherForestCell: -1, buildingTargetId: null };
  assert.equal(focusedBuildingAttackMovementActive(unit), true);
  for (const [kind, radius] of Object.entries(LAND_CLEARANCE_PROFILE.radiusByKind)) {
    assert.equal(activeLandMovementBodyRadius({ ...unit, kind }), kind === 'worker' ? 0 : radius);
  }
  for (const override of [{ kind: 'worker' }, { kind: 'sheep' }, { kind: 'skiff' }, { kind: 'unknown' },
    { hp: 0 }, { movementDomain: 'water' }, { attackBuildingTargetId: -1 }, { attackBuildingTargetId: undefined },
    { attackBuildingTargetId: '0' }, { attackBuildingTargetId: .5 }, { attackTargetId: 0 },
    { attackMove: true }, { holdingPosition: true }, { stanceCombat: true }, { stanceReturning: true },
    { persistentOrder: { type: 'patrol' } }, { persistentOrder: { type: 'follow' } },
    { gatherNodeId: 'berries' }, { gatherForestCell: 0 }, { gatherPhase: 'to-base' }, { buildingTargetId: 0 }]) {
    assert.equal(focusedBuildingAttackMovementActive({ ...unit, ...override }), false, JSON.stringify(override));
  }
});

async function journey(team, kind, buildingType, action, { unfinished = false } = {}) {
  process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp';
  process.env.RTS_PREGAME = '0'; process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '0'; delete process.env.RTS_MATCH_STATE_PATH;
  const map = { id: 'focused-building-attack-journey', name: 'Focused Building Attack Journey', width: 64, height: 48,
    terrainSeed: 881, fogOfWar: false, startingArmySize: 16, startingResources: { food: 800, wood: 2000 },
    spawnPoints: [{ team: 0, x: -20, z: -16 }, { team: 1, x: 20, z: 16 }],
    resourceNodes: [], triggers: [], scenarioEvents: [],
    obstacles: [{ column: 33, row: 25, width: 1, height: 1, material: 'stone' }] };
  const fixture = await createPathingReplayFixture(map, { traceLandSteps: true, traceRouteRejoins: true }), r = fixture.replay;
  try {
    const command = (id, type, fields = {}) => r.order(r.units[id].team,
      { type, ids: [id], unitGenerations: [r.units[id].generation], ...fields });
    for (const seat of [0, 1]) {
      const units = r.units.filter(u => u.team === seat);
      r.order(seat, { type: 'stop', ids: units.map(u => u.id) });
      r.order(seat, { type: 'setStance', stance: 'noAttack', ids: units.filter(u => u.kind !== 'worker').map(u => u.id) });
    }
    if (kind === 'archer') {
      const builder = r.units.find(u => u.team === team && u.kind === 'worker'), sign = team ? 1 : -1;
      command(builder.id, 'build', { buildingType: 'archery-range', x: sign * 25.5, z: sign * 16.5 }); r.drain();
      const home = r.buildings.find(b => b.team === team && b.type === 'archery-range'); assert.ok(home);
      for (let t = 0; t < 1500 && !home.complete; t++) r.step(); assert.ok(home.complete);
      assert.ok(r.order(team, { type: 'trainUnit', buildingId: home.id, kind }).some(n => /ARCHER QUEUED/.test(n.message)));
      for (let t = 0; t < 500 && !r.units.some(u => u.team === team && u.kind === kind); t++) r.step();
      const archer = r.units.find(u => u.team === team && u.kind === kind); assert.ok(archer);
      command(archer.id, 'stop'); command(archer.id, 'setStance', { stance: 'noAttack' });
    }
    const builderId = r.units.find(u => u.team !== team && u.kind === 'worker').id, wood = r.wood[1 - team];
    command(builderId, 'build', { buildingType, x: buildingType === 'house' ? 8.5 : 6.5, z: .5 }); r.drain();
    const site = r.buildings.find(b => b.team !== team && b.type === buildingType); assert.ok(site);
    assert.ok(r.wood[1 - team] < wood, 'the target uses a real paid footprint');
    if (!unfinished) { for (let t = 0; t < 1600 && !site.complete; t++) r.step(); assert.ok(site.complete); }
    command(builderId, 'stop'); command(builderId, 'move', { x: 20.5, z: -16.5 }); r.drain();
    for (let t = 0; t < 800 && r.units[builderId].pathIndex < r.units[builderId].path.length; t++) r.step();
    const id = r.units.find(u => u.team === team && u.kind === kind).id, targetId = site.id;
    const actor = () => r.units[id], target = () => r.buildings.find(b => b.id === targetId);
    command(id, 'move', { x: .75, z: .95 }); r.drain();
    for (let t = 0; t < 800 && actor().pathIndex < actor().path.length; t++) r.step();
    assert.deepEqual([actor().x, actor().z], [.75, .95]);
    const paidWood = [...r.wood], footprint = [...target().footprint];
    const untouched = r.units.filter(u => u.id !== id).map(u => [u.id, u.orderRevision, u.hp]);
    const radius = LAND_CLEARANCE_PROFILE.radiusByKind[kind]; let receipts = 0, steps = 0;
    const clear = (a, b) => canTraverseStaticBodySegment(a, b, radius, 64, 48, r.isWalkable);
    const attack = () => command(id, 'attackBuilding', { buildingId: targetId });
    const step = () => {
      const position = { x: actor().x, z: actor().z }, hp = target()?.hp ?? 0;
      const distance = target() ? r.buildingDistance(position, targetId) : Infinity;
      r.step();
      for (const s of r.landSteps.filter(s => s.id === id)) {
        assert.ok(clear(s.from, s.to), `unsafe building approach ${JSON.stringify(s)}`); steps++;
      }
      const afterHp = target()?.hp ?? 0;
      if (afterHp < hp) {
        receipts++;
        assert.ok(distance <= UNIT_DEFINITIONS[kind].combat.range, 'damage uses the original footprint-edge range');
        assert.ok(Math.abs(hp - afterHp - Math.min(hp, combatDamage(UNIT_DEFINITIONS[kind], BUILDING_DEFINITIONS[buildingType]))) < 1e-9,
          'productive structure damage keeps the original armor and minimum hit');
      }
      if (target()) assert.deepEqual(target().footprint, footprint);
    };
    const recover = () => { const saved = r.checkpoint(); assert.ok(r.validate(structuredClone(saved))); r.restore(structuredClone(saved)); };
    const damage = () => { for (let t = 0; t < 200 && !receipts; t++) step(); assert.ok(receipts > 0); };
    const changes = await action({ r, id, builderId, targetId, actor, target, command, attack, step, clear, recover, damage,
      counts: () => ({ receipts, steps }), footprint });
    assert.deepEqual(r.units.filter(u => u.id !== id && u.id !== changes?.commandedBuilder).map(u => [u.id, u.orderRevision, u.hp]),
      untouched.filter(u => u[0] !== changes?.commandedBuilder),
      'focused selection cannot recruit or damage the parked roster');
    if (!unfinished) assert.deepEqual(r.wood, changes?.paidBalance ?? paidWood, 'attack and recovery cannot charge/refund the paid target');
  } finally { await fixture.dispose(); }
}

for (const team of [0, 1]) for (const kind of ['infantry', 'archer']) for (const buildingType of ['palisade-wall', 'house']) {
  for (const phase of ['accepted', 'travel', 'firing']) test(`seat ${team}: ${kind} attacks paid ${buildingType} through ${phase} recovery`, async () => {
    await journey(team, kind, buildingType, ({ r, id, actor, target, attack, step, clear, recover, damage, counts }) => {
      const revision = actor().orderRevision;
      assert.ok(attack().some(n => /ATTACK BUILDING ORDER/.test(n.message)));
      const join = r.routeRejoins.filter(j => j.id === id).at(-1); assert.ok(join);
      const selectedGoal = kind === 'infantry' ? (buildingType === 'house' ? 1574 : 1573)
        : (buildingType === 'house' ? 1570 : 1569);
      assert.deepEqual(join.selected, Array.from({ length: selectedGoal - 1568 }, (_, i) => 1569 + i),
        'range-selected suffix matches the retained unchanged-runtime command witness');
      assert.equal(join.rejoin, 'prefixed'); assert.deepEqual(join.path, [r.cell(.75, .95), ...join.selected]);
      assert.deepEqual(actor().path, join.path); assert.equal(actor().moveGoalCell, join.selected.at(-1));
      assert.ok(clear(actor(), r.point(actor().path[0])));
      const goal = actor().moveGoalCell; assert.equal(actor().orderRevision, revision + 1);
      assert.equal(activeLandMovementBodyRadius(actor()), LAND_CLEARANCE_PROFILE.radiusByKind[kind]);
      if (phase === 'travel') { step(); step(); }
      if (phase === 'firing') damage();
      recover(); const before = target().hp;
      for (let t = 0; t < 150; t++) step();
      assert.ok(target().hp < before); assert.ok(counts().receipts > 0); assert.ok(counts().steps > 0);
      assert.equal(actor().attackBuildingTargetId, target().id); assert.equal(actor().attackTargetId, -1);
      assert.equal(actor().moveGoalCell, goal); assert.equal(actor().orderRevision, revision + 1);
      assert.equal(actor().combatStance, 'noAttack'); assert.equal(actor().attackMove, false);
    });
  });
}

for (const team of [0, 1]) {
  test(`seat ${team}: building Attack supersedes a pending Move without stale publication`, async () => {
    await journey(team, 'infantry', 'palisade-wall', ({ r, id, actor, command, attack, damage }) => {
      command(id, 'move', { x: -4.5, z: -3.5 }); assert.ok(actor().movePlanningPending);
      attack(); const goal = actor().moveGoalCell, revision = actor().orderRevision;
      r.drain(); assert.equal(actor().moveGoalCell, goal); assert.equal(actor().orderRevision, revision);
      assert.equal(actor().movePlanningPending, false); damage();
    });
  });
  test(`seat ${team}: a real paid obstruction replans building travel through recovery`, async () => {
    await journey(team, 'infantry', 'palisade-wall', ({ r, actor, target, command, attack, step, recover, damage }) => {
      attack(); step(); step(); const navigation = r.navigationRevision;
      const builder = r.units.find(u => u.team === team && u.kind === 'worker'), wood = r.wood[team];
      assert.ok(command(builder.id, 'build', { buildingType: 'palisade-wall', x: 2.5, z: .5 }).some(n => /PLACED|BUILD ORDER/.test(n.message)));
      assert.ok(r.navigationRevision > navigation); assert.ok(r.wood[team] < wood);
      command(builder.id, 'stop'); const site = r.buildings.find(b => b.team === team && b.type === 'palisade-wall'); assert.ok(site);
      const paidBalance = [...r.wood]; recover(); damage();
      assert.equal(actor().attackBuildingTargetId, target().id); assert.ok(r.buildings.some(b => b.id === site.id));
      return { commandedBuilder: builder.id, paidBalance };
    });
  });
  test(`seat ${team}: cold building repath preserves the selected suffix and goal`, async () => {
    await journey(team, 'infantry', 'palisade-wall', ({ r, id, actor, attack, step, damage }) => {
      attack(); const selected = [...r.routeRejoins.filter(j => j.id === id).at(-1).selected];
      const goal = actor().moveGoalCell, revision = actor().orderRevision;
      const saved = r.checkpoint(); Object.assign(saved.state.units[id], { path: [], pathIndex: 0, repathTimer: 0, lastAttackCell: -1 });
      assert.ok(r.validate(structuredClone(saved))); r.restore(structuredClone(saved)); step();
      const join = r.routeRejoins.filter(j => j.id === id).at(-1); assert.equal(join.rejoin, 'prefixed');
      assert.deepEqual(join.selected, selected); assert.deepEqual(join.path, [r.cell(.75, .95), ...selected]);
      assert.equal(actor().moveGoalCell, goal); assert.equal(actor().orderRevision, revision); damage();
    });
  });
  for (const phase of ['admission', 'repath']) test(`seat ${team}: unsafe inherited body position rejects ${phase} without losing building intent`, async () => {
    await journey(team, 'infantry', 'palisade-wall', ({ r, id, actor, target, attack, recover }) => {
      if (phase === 'repath') attack();
      const saved = r.checkpoint(); Object.assign(saved.state.units[id], { x: .91, path: [], pathIndex: 0, repathTimer: 0, lastAttackCell: -1 });
      assert.ok(r.validate(structuredClone(saved))); r.restore(structuredClone(saved));
      if (phase === 'admission') attack(); else r.step();
      const goal = actor().moveGoalCell, revision = actor().orderRevision, hp = target().hp;
      assert.deepEqual(actor().path, []); recover();
      for (let t = 0; t < 30; t++) {
        r.step(); assert.deepEqual(actor().path, []); assert.deepEqual([actor().x, actor().z], [.91, .95]);
        assert.equal(actor().attackBuildingTargetId, target().id); assert.equal(actor().moveGoalCell, goal);
        assert.equal(actor().orderRevision, revision); assert.deepEqual(r.landSteps.filter(s => s.id === id), []);
      }
      assert.equal(target().hp, hp);
    });
  });
  for (const replacement of ['stop', 'holdPosition', 'move']) test(`seat ${team}: ${replacement} cancels building travel through recovery`, async () => {
    await journey(team, 'infantry', 'palisade-wall', ({ r, id, actor, target, command, attack, step, recover }) => {
      attack(); step(); step(); command(id, replacement, replacement === 'move' ? { x: -3.5, z: -3.5 } : {});
      r.drain(); recover(); const hp = target().hp, position = [actor().x, actor().z];
      for (let t = 0; t < 180; t++) step();
      assert.equal(actor().attackBuildingTargetId, -1); assert.equal(target().hp, hp);
      if (replacement === 'move') assert.ok(Math.hypot(actor().x + 3.5, actor().z + 3.5) < .001);
      else assert.deepEqual([actor().x, actor().z], position);
    });
  });
  test(`seat ${team}: building cancellation activates the saved queued point exactly once`, async () => {
    await journey(team, 'infantry', 'palisade-wall', ({ r, id, actor, target, targetId, command, attack, step, recover, damage }) => {
      attack(); command(id, 'move', { x: -3.5, z: -3.5, queue: true }); recover(); damage();
      assert.ok(r.order(1 - team, { type: 'cancelConstruction', buildingId: targetId }).some(n => /CONSTRUCTION CANCELLED/.test(n.message)));
      assert.equal(target(), undefined); recover();
      for (let t = 0; t < 300; t++) step();
      assert.equal(actor().attackBuildingTargetId, -1); assert.equal(actor().queuedWaypoints.length, 0);
      assert.equal(actor().movePlanningPending, false); assert.ok(Math.hypot(actor().x + 3.5, actor().z + 3.5) < .001);
      const revision = actor().orderRevision; for (let t = 0; t < 30; t++) step(); assert.equal(actor().orderRevision, revision);
    }, { unfinished: true });
  });
  test(`seat ${team}: real structure destruction resumes the queued Move after firing recovery`, async () => {
    await journey(team, 'infantry', 'palisade-wall', ({ r, id, actor, target, command, attack, step, recover, damage }) => {
      attack(); command(id, 'move', { x: -3.5, z: -3.5, queue: true }); damage(); recover();
      for (let t = 0; t < 6000 && target(); t++) step(); assert.equal(target(), undefined);
      for (let t = 0; t < 300; t++) step();
      assert.equal(actor().attackBuildingTargetId, -1); assert.equal(actor().queuedWaypoints.length, 0);
      assert.ok(Math.hypot(actor().x + 3.5, actor().z + 3.5) < .001);
    });
  });
  test(`seat ${team}: already in-range building Attack keeps empty travel and productive damage`, async () => {
    await journey(team, 'infantry', 'palisade-wall', ({ r, id, actor, command, attack, damage }) => {
      command(id, 'move', { x: 5.5, z: .5 }); r.drain();
      for (let t = 0; t < 150 && actor().pathIndex < actor().path.length; t++) r.step();
      attack(); assert.deepEqual(actor().path, []); const position = [actor().x, actor().z];
      damage(); assert.deepEqual([actor().x, actor().z], position);
    });
  });
  test(`seat ${team}: rejected Worker, foreign, stale and invalid-target selections leave intent untouched`, async () => {
    await journey(team, 'infantry', 'palisade-wall', ({ r, id, actor, targetId, attack }) => {
      attack(); const before = structuredClone(actor());
      const worker = r.units.find(u => u.team === team && u.kind === 'worker');
      const foreign = r.units.find(u => u.team !== team && u.kind === 'infantry');
      for (const command of [
        { ids: [worker.id], buildingId: targetId }, { ids: [foreign.id], buildingId: targetId },
        { ids: [id], unitGenerations: [actor().generation + 1], buildingId: targetId },
        { ids: [id], buildingId: 99999 },
      ]) { assert.ok(r.order(team, { type: 'attackBuilding', ...command }).some(n => /REJECTED/.test(n.message))); }
      assert.deepEqual(actor(), before);
    });
  });
}
