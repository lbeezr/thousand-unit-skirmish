import assert from 'node:assert/strict';
import test from 'node:test';
import { patrolAcquiredMovementActive } from '../src/combat-movement.mjs';
import { activeLandMovementBodyRadius, canTraverseStaticBodySegment, LAND_CLEARANCE_PROFILE } from '../src/unit-movement.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { combatStancePolicy } from '../src/combat-stance.mjs';
import { combatDamage } from '../src/combat-rules.mjs';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';

test('acquired Patrol selects the shared military body while excluding automatic stance, Follow and target-free legs', () => {
  const unit = { kind: 'infantry', hp: 100, attackMove: true, attackTargetId: 7,
    attackBuildingTargetId: -1, buildingTargetId: null, combatStance: 'aggressive',
    gatherNodeId: null, gatherForestCell: -1, path: [], persistentOrder: { type: 'patrol' } };
  for (const [kind, radius] of Object.entries(LAND_CLEARANCE_PROFILE.radiusByKind)) {
    assert.equal(activeLandMovementBodyRadius({ ...unit, kind }), kind === 'worker' ? 0 : radius);
  }
  assert.equal(patrolAcquiredMovementActive(unit), true);
  for (const override of [{ kind: 'worker' }, { kind: 'skiff' }, { kind: 'sheep' }, { kind: 'unknown' },
    { hp: 0 }, { movementDomain: 'water' }, { attackMove: false }, { attackMove: undefined },
    { holdingPosition: true }, { attackTargetId: -1 }, { attackTargetId: undefined },
    { attackTargetId: 1.5 }, { attackTargetId: '7' }, { attackBuildingTargetId: 0 },
    { stanceCombat: true }, { stanceReturning: true }, { persistentOrder: null },
    { persistentOrder: { type: 'follow' } }, { gatherNodeId: 'berry' }, { gatherForestCell: 0 },
    { gatherPhase: 'to-base' }, { buildingTargetId: 0 }]) {
    assert.equal(patrolAcquiredMovementActive({ ...unit, ...override }), false, JSON.stringify(override));
  }
});

async function journey(team, kind, action, { stance = 'aggressive', targetPoint } = {}) {
  process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp';
  process.env.RTS_PREGAME = '0'; process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '0';
  delete process.env.RTS_MATCH_STATE_PATH;
  const map = { id: 'patrol-acquired-journey', name: 'Acquired Patrol Journey',
    width: 64, height: 48, terrainSeed: 881, fogOfWar: false, startingArmySize: 16,
    startingResources: { food: 500, wood: 1000 },
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
      const worker = r.units.find(u => u.team === team && u.kind === 'worker'), sign = team ? 1 : -1;
      command(worker.id, 'build', { buildingType: 'archery-range', x: sign * 25.5, z: sign * 16.5 }); r.drain();
      const home = r.buildings.find(b => b.team === team && b.type === 'archery-range'); assert.ok(home);
      for (let t = 0; t < 1500 && !home.complete; t++) r.step(); assert.ok(home.complete);
      assert.ok(r.order(team, { type: 'trainUnit', buildingId: home.id, kind }).some(n => /ARCHER QUEUED/.test(n.message)));
      for (let t = 0; t < 500 && !r.units.some(u => u.team === team && u.kind === kind); t++) r.step();
      const archer = r.units.find(u => u.team === team && u.kind === kind); assert.ok(archer);
      command(archer.id, 'stop'); command(archer.id, 'setStance', { stance: 'noAttack' });
    }
    const id = r.units.find(u => u.team === team && u.kind === kind).id;
    const targetId = r.units.find(u => u.team !== team && u.kind === 'worker').id;
    const actor = () => r.units[id], target = () => r.units[targetId];
    command(id, 'move', { x: .75, z: .95 });
    command(targetId, 'move', targetPoint ?? (kind === 'archer' ? { x: 5.45, z: .95 } : { x: 2.25, z: .95 })); r.drain();
    for (let t = 0; t < 800 && (actor().pathIndex < actor().path.length || target().pathIndex < target().path.length); t++) r.step();
    assert.deepEqual({ x: actor().x, z: actor().z }, { x: .75, z: .95 });
    const radius = LAND_CLEARANCE_PROFILE.radiusByKind[kind], range = UNIT_DEFINITIONS[kind].combat.range;
    const clear = (from, to) => canTraverseStaticBodySegment(from, to, radius, map.width, map.height, r.isWalkable);
    assert.ok(clear(actor(), actor()));
    const others = r.units.filter(u => u.id !== id && u.id !== targetId).map(u => [u.id, u.orderRevision]);
    const notices = command(id, 'patrol', { x: 6.5, z: .5 });
    assert.ok(notices.some(n => /PATROL/.test(n.message))); assert.equal(actor().attackMove, true); r.drain();
    // Real stance command makes acquisition due immediately, before the safe
    // objective prefix can conceal the acquired publisher's fractional join.
    command(id, 'setStance', { stance });
    const goal = actor().moveGoalCell, revision = actor().orderRevision;
    const originalPath = [...actor().path], originalIndex = actor().pathIndex;
    const patrolOrder = structuredClone(actor().persistentOrder);
    let receipts = 0, steps = 0;
    const step = () => {
      const before = structuredClone(actor()), hp = target().hp;
      r.step();
      if (actor().persistentOrder) {
        assert.equal(actor().persistentOrder.start, patrolOrder.start);
        assert.equal(actor().persistentOrder.end, patrolOrder.end);
        if (before.attackTargetId >= 0 && actor().attackTargetId >= 0)
          assert.equal(actor().persistentOrder.leg, patrolOrder.leg, 'acquired combat never switches the saved Patrol leg');
      }
      for (const s of r.landSteps.filter(s => s.id === id)) {
        assert.ok(clear(s.from, s.to), `unsafe acquired/objective ${s.reason}: ${JSON.stringify(s)}`); steps++;
        if (actor().attackTargetId >= 0) {
          const anchor = { x: actor().attackMoveAnchorX, z: actor().attackMoveAnchorZ };
          assert.ok(Math.hypot(s.to.x - anchor.x, s.to.z - anchor.z) <= combatStancePolicy(actor().combatStance, range).travel + 1e-9,
            'every admitted pursuit substep retains the original automatic travel bound');
        }
      }
      if (target().hp < hp) {
        receipts++; assert.ok(Math.hypot(before.x - target().x, before.z - target().z) <= range, 'actual damage retains weapon range');
        assert.equal(hp - target().hp, Math.min(hp, combatDamage(UNIT_DEFINITIONS[kind], UNIT_DEFINITIONS.worker)));
      }
    };
    const recover = () => { const saved = r.checkpoint(); assert.ok(r.validate(structuredClone(saved))); r.restore(structuredClone(saved)); };
    const acquire = () => {
      const selected = r.automaticAttackApproach(id, targetId).path, position = { x: actor().x, z: actor().z };
      step(); assert.equal(actor().attackTargetId, targetId); assert.equal(activeLandMovementBodyRadius(actor()), radius);
      assert.deepEqual(actor().attackMoveResumePath, originalPath); assert.equal(actor().attackMoveResumePathIndex, originalIndex);
      assert.deepEqual([actor().attackMoveAnchorX, actor().attackMoveAnchorZ], [position.x, position.z]);
      const join = r.routeRejoins.find(j => j.id === id); assert.ok(join);
      assert.deepEqual(join.selected, selected, 'existing range/stance-selected route is the rejoin input');
      assert.equal(join.rejoin, 'prefixed'); assert.deepEqual(join.path, [r.cell(position.x, position.z), ...selected]);
      assert.deepEqual(actor().path, join.path, 'complete selected suffix survives actual acquisition publication');
      assert.equal(actor().moveGoalCell, goal); assert.equal(actor().orderRevision, revision);
    };
    const cycle = () => {
      let switches = 0;
      for (let t = 0; t < 500 && switches < 2; t++) {
        const leg = actor().persistentOrder.leg; step();
        if (actor().persistentOrder.leg !== leg) switches++;
      }
      assert.equal(switches, 2, 'same endpoint cycle continues after the target-free resumed leg');
      assert.equal(actor().persistentOrder.start, patrolOrder.start);
      assert.equal(actor().persistentOrder.end, patrolOrder.end);
    };
    const finish = (point = { x: 6.5, z: .5 }) => {
      for (let t = 0; t < 800 && (actor().movePlanningPending || actor().attackTargetId >= 0
        || actor().pathIndex < actor().path.length || Math.hypot(actor().x - point.x, actor().z - point.z) > .001); t++) step();
      assert.ok(Math.hypot(actor().x - point.x, actor().z - point.z) < .001, 'bounded retained objective arrival');
      assert.ok(!actor().movePlanningPending && actor().pathIndex >= actor().path.length && actor().attackTargetId < 0);
    };
    await action({ r, id, targetId, actor, target, command, step, recover, acquire, finish, goal, revision, radius, clear,
      receipts: () => receipts, steps: () => steps, originalPath, originalIndex, patrolOrder, cycle });
    assert.deepEqual(r.units.filter(u => u.id !== id && u.id !== targetId).map(u => [u.id, u.orderRevision]), others);
  } finally { await fixture.dispose(); }
}

for (const team of [0, 1]) for (const kind of ['infantry', 'archer']) for (const phase of ['acquired', 'damage', 'resumed']) {
  test(`seat ${team}: ${kind} acquired Patrol preserves selected route/damage/objective through ${phase} recovery`, async () => {
    await journey(team, kind, ({ actor, target, step, acquire, recover, finish, goal, revision, receipts, steps, originalPath, originalIndex, cycle }) => {
      acquire(); const anchor = [actor().attackMoveAnchorX, actor().attackMoveAnchorZ];
      if (phase === 'acquired') recover();
      if (phase === 'damage') { for (let t = 0; t < 200 && !receipts(); t++) step(); assert.ok(receipts() > 0); recover(); }
      if (phase === 'resumed') {
        for (let t = 0; t < 600 && actor().attackTargetId >= 0; t++) step();
        assert.equal(target().hp, 0); assert.deepEqual(actor().path, originalPath); assert.equal(actor().pathIndex, originalIndex);
        assert.equal(actor().attackMoveResumePath, null); recover();
      }
      finish(); assert.equal(target().hp, 0); assert.ok(receipts() > 0 && steps() > 0);
      assert.equal(actor().moveGoalCell, goal); assert.equal(actor().orderRevision, revision);
      assert.deepEqual([actor().attackMoveAnchorX, actor().attackMoveAnchorZ], anchor); assert.equal(actor().attackMove, true); cycle();
    });
  });
}

for (const team of [0, 1]) for (const replacement of ['stop', 'holdPosition', 'move', 'queuedMove', 'noAttack']) {
  test(`seat ${team}: ${replacement} during acquired pursuit survives recovery without stale target or damage`, async () => {
    await journey(team, 'infantry', ({ r, id, actor, target, command, acquire, recover, step, finish }) => {
      acquire(); const hp = target().hp;
      if (replacement === 'move') {
        command(id, 'move', { x: -3.5, z: -3.5 }); assert.equal(actor().persistentOrder, null);
        recover(); finish({ x: -3.5, z: -3.5 }); assert.equal(target().hp, hp); assert.equal(actor().attackMove, false);
      } else if (replacement === 'queuedMove') {
        command(id, 'move', { x: -3.5, z: -3.5, queue: true }); assert.equal(actor().queuedWaypoints.length, 1); assert.equal(actor().persistentOrder, null);
        recover(); finish({ x: -3.5, z: -3.5 }); assert.equal(target().hp, 0); assert.equal(actor().attackMove, false);
      } else if (replacement === 'noAttack') {
        command(id, 'setStance', { stance: 'noAttack' }); assert.equal(actor().attackTargetId, -1);
        recover(); finish(); assert.equal(target().hp, hp); assert.equal(actor().attackMove, true);
      } else {
        command(id, replacement); const pose = { x: actor().x, z: actor().z }, revision = actor().orderRevision;
        recover(); for (let t = 0; t < 80; t++) step();
        assert.deepEqual({ x: actor().x, z: actor().z }, pose); assert.equal(actor().orderRevision, revision);
        assert.equal(actor().attackMove, false); assert.equal(actor().attackTargetId, -1); assert.equal(actor().attackMoveResumePath, null);
        assert.equal(target().hp, hp); assert.equal(actor().path.length, 0);
      }
      assert.equal(patrolAcquiredMovementActive(actor()), false);
    });
  });
}

for (const team of [0, 1]) test(`seat ${team}: moving target repath preserves bounded selected route and fixed anchor through recovery`, async () => {
  await journey(team, 'infantry', ({ r, id, targetId, actor, target, command, acquire, step, recover, finish, goal, revision }) => {
    acquire(); const anchor = [actor().attackMoveAnchorX, actor().attackMoveAnchorZ];
    command(targetId, 'move', { x: 5.5, z: -.5 }); r.drain(); let repaths = 0;
    for (let t = 0; t < 100 && target().hp > 0; t++) {
      step();
      for (const join of r.routeRejoins.filter(j => j.id === id)) {
        repaths++; const prefix = join.path.length - join.selected.length;
        assert.ok(prefix === 0 || prefix === 1); assert.deepEqual(join.path.slice(prefix), join.selected);
        if (prefix) assert.equal(join.path[0], r.cell(join.position.x, join.position.z));
        assert.equal(join.radius, LAND_CLEARANCE_PROFILE.radiusByKind.infantry);
      }
      assert.deepEqual([actor().attackMoveAnchorX, actor().attackMoveAnchorZ], anchor);
      assert.equal(actor().moveGoalCell, goal); assert.equal(actor().orderRevision, revision);
      if (repaths) break;
    }
    assert.ok(repaths > 0, 'actual moved target invokes acquired repath'); recover(); finish(); assert.equal(target().hp, 0);
  });
});

for (const team of [0, 1]) test(`seat ${team}: target leaves fixed leash and saved objective resumes through recovery`, async () => {
  await journey(team, 'infantry', ({ id, targetId, actor, target, command, acquire, step, recover, finish, goal, revision }) => {
    acquire(); const hp = target().hp, anchor = [actor().attackMoveAnchorX, actor().attackMoveAnchorZ];
    command(targetId, 'move', { x: 14.5, z: .5 });
    for (let t = 0; t < 300 && actor().attackTargetId >= 0; t++) step();
    assert.equal(actor().attackTargetId, -1); assert.ok(target().hp > 0 && target().hp <= hp);
    assert.deepEqual([actor().attackMoveAnchorX, actor().attackMoveAnchorZ], anchor);
    recover(); finish(); assert.equal(actor().moveGoalCell, goal); assert.ok(actor().orderRevision - revision <= 1);
  });
});

for (const team of [0, 1]) test(`seat ${team}: defensive repath rejects a static-safe prefix outside the unchanged anchor travel bound`, async () => {
  await journey(team, 'infantry', ({ r, id, actor, target, acquire, recover, step, radius, clear, goal, revision }) => {
    acquire();
    // Controlled valid legacy checkpoint: current pose is body-clear and
    // within travel; selected east firing point is within travel, but the
    // otherwise body-clear current-cell center is outside that fixed circle.
    const saved = r.checkpoint(), u = saved.state.units[id];
    Object.assign(u, { x: .75, z: .95, combatStance: 'defensive', attackMoveAnchorX: 3.55,
      attackMoveAnchorZ: .95, path: [], pathIndex: 0, repathTimer: 0, lastAttackCell: -1 });
    assert.ok(r.validate(structuredClone(saved))); r.restore(structuredClone(saved));
    const center = r.point(r.cell(actor().x, actor().z));
    assert.ok(clear(actor(), center)); assert.ok(Math.hypot(actor().x - 3.55, actor().z - .95) <= 3);
    assert.ok(Math.hypot(center.x - 3.55, center.z - .95) > 3);
    assert.equal(r.automaticAttackApproach(id, target().id, true).reachable, true);
    step(); const join = r.routeRejoins.find(j => j.id === id); assert.ok(join);
    assert.equal(join.rejoin, 'rejected', 'actual shared adapter enforces unchanged automaticPositionAllowed on its prefix');
    assert.equal(join.radius, radius); assert.equal(actor().path.length, 0); assert.equal(actor().attackTargetId, target().id);
    const pose = { x: actor().x, z: actor().z }, hp = target().hp; recover();
    for (let t = 0; t < 30; t++) step();
    assert.deepEqual({ x: actor().x, z: actor().z }, pose); assert.equal(target().hp, hp);
    assert.equal(actor().moveGoalCell, goal); assert.equal(actor().orderRevision, revision);
    assert.deepEqual([actor().attackMoveAnchorX, actor().attackMoveAnchorZ], [3.55, .95]);
  });
});

for (const team of [0, 1]) test(`seat ${team}: in-range Stand Ground acquisition retains empty route and real firing through recovery`, async () => {
  await journey(team, 'infantry', ({ r, id, actor, target, step, recover, finish, receipts }) => {
    const pose = { x: actor().x, z: actor().z };
    step(); assert.equal(actor().attackTargetId, target().id); assert.deepEqual(actor().path, []);
    const join = r.routeRejoins.find(j => j.id === id); assert.ok(join);
    assert.equal(join.rejoin, 'unchanged'); assert.deepEqual(join.selected, []); assert.deepEqual(join.path, []);
    assert.deepEqual({ x: actor().x, z: actor().z }, pose); recover();
    for (let t = 0; t < 100 && !receipts(); t++) step(); assert.ok(receipts() > 0);
    assert.deepEqual({ x: actor().x, z: actor().z }, pose); finish(); assert.equal(target().hp, 0);
  }, { stance: 'standGround', targetPoint: { x: 1.9, z: .5 } });
});

for (const team of [0, 1]) test(`seat ${team}: inherited overlap rejects acquired prefix without unsafe fallback or invented damage`, async () => {
  await journey(team, 'infantry', ({ r, id, targetId, actor, target, command, step, recover, goal, revision, receipts }) => {
    // This finite, validator-accepted prior-checkpoint overlap is a rejection
    // control, not an assertion that legacy placement/separation is qualified.
    const saved = r.checkpoint(); saved.state.units[id].x = .91;
    assert.ok(r.validate(structuredClone(saved))); r.restore(structuredClone(saved));
    r.step(); const join = r.routeRejoins.find(j => j.id === id); assert.ok(join);
    assert.equal(join.rejoin, 'rejected'); assert.equal(actor().attackTargetId, targetId); assert.deepEqual(actor().path, []);
    const pose = { x: actor().x, z: actor().z }, hp = target().hp; recover();
    for (let t = 0; t < 30; t++) {
      r.step(); assert.deepEqual(r.landSteps.filter(s => s.id === id), []);
      assert.deepEqual(actor().path, []); assert.equal(actor().attackTargetId, targetId);
      assert.equal(actor().moveGoalCell, goal); assert.equal(actor().orderRevision, revision);
    }
    assert.deepEqual({ x: actor().x, z: actor().z }, pose); assert.equal(target().hp, hp);
    command(targetId, 'move', { x: 2.18, z: .95 }); r.drain();
    for (let t = 0; t < 100 && !receipts(); t++) step();
    assert.ok(receipts() > 0, 'unchanged in-range firing remains productive');
    assert.deepEqual({ x: actor().x, z: actor().z }, pose);
  });
});
