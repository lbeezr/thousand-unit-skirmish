import assert from 'node:assert/strict';
import test from 'node:test';
import { stanceAcquiredMovementActive } from '../src/combat-movement.mjs';
import { activeLandMovementBodyRadius, canTraverseStaticBodySegment, LAND_CLEARANCE_PROFILE } from '../src/unit-movement.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { combatStancePolicy } from '../src/combat-stance.mjs';
import { combatDamage } from '../src/combat-rules.mjs';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';

test('automatic pursuit body derives from acquired Aggressive/Defensive military intent only', () => {
  const unit = { kind: 'infantry', hp: 100, attackMove: true, stanceCombat: true, stanceReturning: false,
    combatStance: 'defensive', attackTargetId: 7, attackBuildingTargetId: -1, buildingTargetId: null,
    gatherNodeId: null, gatherForestCell: -1 };
  assert.equal(stanceAcquiredMovementActive(unit), true);
  for (const [kind, radius] of Object.entries(LAND_CLEARANCE_PROFILE.radiusByKind))
    assert.equal(activeLandMovementBodyRadius({ ...unit, kind }), kind === 'worker' ? 0 : radius);
  for (const override of [{ kind: 'worker' }, { kind: 'skiff' }, { kind: 'sheep' }, { kind: 'unknown' },
    { hp: 0 }, { movementDomain: 'water' }, { attackMove: false }, { stanceCombat: false },
    { stanceReturning: true }, { combatStance: 'standGround' }, { combatStance: 'noAttack' },
    { combatStance: undefined }, { holdingPosition: true }, { attackTargetId: -1 }, { attackTargetId: undefined },
    { attackTargetId: 1.5 }, { attackTargetId: '7' }, { attackBuildingTargetId: 0 },
    { persistentOrder: { type: 'patrol' } }, { persistentOrder: { type: 'follow' } },
    { gatherNodeId: 'berry' }, { gatherForestCell: 0 }, { gatherPhase: 'to-base' }, { buildingTargetId: 0 }])
    assert.equal(stanceAcquiredMovementActive({ ...unit, ...override }), false, JSON.stringify(override));
});

async function journey(team, stance, action, { kind = 'infantry', plannerTurns = 0, targetPoint, actorPoint } = {}) {
  process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp'; process.env.RTS_PREGAME = '0';
  process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = String(plannerTurns); delete process.env.RTS_MATCH_STATE_PATH;
  const map = { id: 'automatic-stance-pursuit-journey', name: 'Automatic Stance Pursuit Journey',
    width: 64, height: 48, terrainSeed: 881, fogOfWar: true, startingArmySize: 16,
    startingResources: { food: 800, wood: 2500 },
    spawnPoints: [{ team: 0, x: -20, z: -16 }, { team: 1, x: 20, z: 16 }],
    resourceNodes: [], triggers: [], scenarioEvents: [],
    obstacles: [{ column: 33, row: 25, width: 1, height: 1, material: 'stone' }] };
  const fixture = await createPathingReplayFixture(map, { traceLandSteps: true, traceRouteRejoins: true });
  let r = fixture.replay, cold;
  try {
    for (const seat of [0, 1]) r.order(seat, { type: 'stop', ids: r.units.filter(u => u.team === seat).map(u => u.id) });
    const command = (id, type, fields = {}) => r.order(r.units[id].team,
      { type, ids: [id], unitGenerations: [r.units[id].generation], ...fields });
    if (kind === 'archer') {
      const worker = r.units.find(u => u.team === team && u.kind === 'worker'), sign = team ? 1 : -1;
      assert.ok(command(worker.id, 'build', { buildingType: 'archery-range', x: sign * 25.5, z: sign * 16.5 }).some(n => /PLACED/.test(n.message)));
      r.drain(); const home = r.buildings.find(b => b.team === team && b.type === 'archery-range'); assert.ok(home);
      for (let t = 0; t < 1500 && !home.complete; t++) r.step(); assert.ok(home.complete);
      assert.ok(r.order(team, { type: 'trainUnit', buildingId: home.id, kind }).some(n => /ARCHER QUEUED/.test(n.message)));
      for (let t = 0; t < 500 && !r.units.some(u => u.team === team && u.kind === kind); t++) r.step();
      const archer = r.units.find(u => u.team === team && u.kind === kind); assert.ok(archer); command(archer.id, 'stop');
    }
    const id = r.units.find(u => u.team === team && u.kind === kind).id;
    const targetId = r.units.find(u => u.team !== team && u.kind === 'worker').id;
    const actor = () => r.units[id], target = () => r.units[targetId];
    const origin = actorPoint ?? { x: .75, z: .95 };
    command(id, 'move', origin);
    command(targetId, 'move', targetPoint ?? (kind === 'archer'
      ? { x: stance === 'defensive' ? 5.15 : 5.45, z: .95 } : { x: 2.5, z: .5 }));
    r.drain();
    for (let t = 0; t < 800 && [actor(), target()].some(u => u.movePlanningPending || u.pathIndex < u.path.length); t++) r.step();
    assert.deepEqual([actor().x, actor().z], [origin.x, origin.z]);
    assert.ok(r.snapshot(team).units.some(u => u[0] === targetId), 'real vision reveals the automatically acquired target');
    const others = r.units.filter(u => u.id !== id && u.id !== targetId).map(u => [u.id, u.orderRevision, u.hp]);
    const radius = LAND_CLEARANCE_PROFILE.radiusByKind[kind], range = UNIT_DEFINITIONS[kind].combat.range;
    const clear = (from, to) => canTraverseStaticBodySegment(from, to, radius, 64, 48, r.isWalkable);
    assert.ok(clear(actor(), actor()));
    let receipts = 0, steps = 0, lastDamageTick = null;
    const step = () => {
      const before = structuredClone(actor()), victim = structuredClone(target()); r.step();
      if (stanceAcquiredMovementActive(before) || stanceAcquiredMovementActive(actor())) {
        for (const s of r.landSteps.filter(s => s.id === id)) {
          assert.ok(clear(s.from, s.to), `unsafe automatic pursuit step ${JSON.stringify(s)}`); steps++;
          assert.ok(Math.hypot(s.to.x - actor().attackMoveAnchorX, s.to.z - actor().attackMoveAnchorZ)
            <= combatStancePolicy(stance, range).travel + 1e-9, 'original automatic travel bound');
        }
      }
      if (target().hp < victim.hp) {
        receipts++;
        assert.ok(Math.hypot(before.x - victim.x, before.z - victim.z) <= range, 'damage retains actual weapon reach');
        assert.equal(victim.hp - target().hp, Math.min(victim.hp, combatDamage(UNIT_DEFINITIONS[kind], UNIT_DEFINITIONS.worker)));
        if (lastDamageTick !== null) assert.ok(actor().lastAttackTick - lastDamageTick >= UNIT_DEFINITIONS[kind].combat.period * 30 - 1e-9,
          'travel/recovery cannot accelerate the original attack cooldown');
        lastDamageTick = actor().lastAttackTick;
      }
    };
    const until = (condition, limit = 1600) => { for (let t = 0; t < limit && !condition(); t++) step(); assert.ok(condition(), 'bounded actual-command condition'); };
    const recover = async (separate = false) => {
      const saved = JSON.parse(JSON.stringify(r.checkpoint())); assert.ok(r.validate(structuredClone(saved)));
      if (separate) { await cold?.dispose(); cold = await createPathingReplayFixture(map, { traceLandSteps: true, traceRouteRejoins: true }); r = cold.replay; }
      r.restore(saved);
      for (const key of ['combatStance', 'stanceAnchorX', 'stanceAnchorZ', 'attackMoveAnchorX', 'attackMoveAnchorZ',
        'stanceCombat', 'stanceReturning', 'attackTargetId', 'attackCooldown', 'moveGoalCell'])
        assert.deepEqual(actor()[key], saved.state.units[id][key], `cold recovery preserves ${key}`);
      return saved;
    };
    assert.ok(command(id, 'setStance', { stance }).some(n => /STANCE ORDER/.test(n.message)));
    const revision = actor().orderRevision, goal = actor().moveGoalCell;
    const acquire = () => {
      const selected = r.automaticAttackApproach(id, targetId).path;
      until(() => actor().attackTargetId === targetId, 90);
      assert.equal(actor().stanceCombat, true); assert.equal(actor().stanceReturning, false);
      assert.deepEqual([actor().stanceAnchorX, actor().stanceAnchorZ], [origin.x, origin.z]);
      assert.deepEqual([actor().attackMoveAnchorX, actor().attackMoveAnchorZ], [origin.x, origin.z]);
      assert.equal(actor().orderRevision, revision); assert.equal(actor().moveGoalCell, goal);
      if (['aggressive', 'defensive'].includes(stance)) {
        const join = r.routeRejoins.find(j => j.id === id); assert.ok(join, 'the actual acquired publication consumes shared rejoin');
        assert.deepEqual(join.selected, selected); assert.equal(join.radius, radius);
        const prefix = join.path.length - selected.length;
        assert.ok(prefix === 0 || prefix === 1); assert.deepEqual(join.path.slice(prefix), selected);
        if (prefix) assert.equal(join.path[0], r.cell(origin.x, origin.z));
        assert.deepEqual(actor().path, join.path);
      }
    };
    const finish = () => {
      until(() => target().hp === 0);
      if (stance === 'defensive') {
        until(() => !actor().stanceReturning && !actor().movePlanningPending && actor().pathIndex >= actor().path.length);
        const point = r.point(r.cell(origin.x, origin.z));
        assert.ok(Math.hypot(actor().x - point.x, actor().z - point.z) < .02, 'unchanged return endpoint is the original anchor cell center');
      }
    };
    const changed = await action({ r: () => r, id, targetId, actor, target, command, step, until, recover, acquire, finish,
      clear, radius, range, goal, revision, origin, receipts: () => receipts, steps: () => steps }) ?? [];
    assert.deepEqual(r.units.filter(u => u.id !== id && u.id !== targetId && !changed.includes(u.id)).map(u => [u.id, u.orderRevision, u.hp]),
      others.filter(u => !changed.includes(u[0])), 'automatic stance recruits no unselected army');
  } finally { await cold?.dispose(); await fixture.dispose(); }
}

for (const team of [0, 1]) for (const stance of ['aggressive', 'defensive']) for (const kind of ['infantry', 'archer']) for (const phase of ['accepted', 'acquired', 'damage']) {
  test(`seat ${team}: automatic ${stance} ${kind} preserves range, anchors and cooldown through ${phase} recovery`, async () => {
    await journey(team, stance, async ({ acquire, recover, finish, until, receipts, actor, origin }) => {
      if (phase !== 'accepted') acquire();
      if (phase === 'damage') until(() => receipts() > 0);
      await recover(); finish(); assert.ok(receipts() > 0);
      assert.deepEqual([actor().stanceAnchorX, actor().stanceAnchorZ], [origin.x, origin.z]);
    }, { kind });
  });
}

for (const team of [0, 1]) for (const stance of ['aggressive', 'defensive']) for (const turns of [0, 1]) {
  test(`seat ${team}: actual planner mode ${turns} automatic ${stance} pursuit completes after a cold module`, async () => {
    await journey(team, stance, async ({ acquire, recover, finish }) => { acquire(); await recover(true); finish(); }, { plannerTurns: turns });
  });
}

for (const team of [0, 1]) for (const stance of ['aggressive', 'defensive']) for (const replacement of ['stop', 'holdPosition', 'move', 'queuedMove', 'noAttack', 'standGround']) {
  test(`seat ${team}: ${replacement} supersedes automatic ${stance} pursuit without stale recovery damage`, async () => {
    await journey(team, stance, async ({ actor, target, command, id, acquire, recover, step, until }) => {
      acquire(); const hp = target().hp;
      if (replacement === 'noAttack' || replacement === 'standGround') command(id, 'setStance', { stance: replacement });
      else command(id, replacement === 'queuedMove' ? 'move' : replacement,
        replacement === 'move' || replacement === 'queuedMove' ? { x: -3.5, z: -3.5, queue: replacement === 'queuedMove' } : {});
      const pose = [actor().x, actor().z]; await recover(true);
      if (replacement === 'move' || replacement === 'queuedMove') {
        until(() => !actor().movePlanningPending && actor().queuedWaypoints.length === 0 && Math.hypot(actor().x + 3.5, actor().z + 3.5) < .001);
        assert.equal(target().hp, replacement === 'queuedMove' ? 0 : hp);
        if (replacement === 'queuedMove') assert.equal(actor().stanceReturning, false, 'saved queued Move takes priority over Defensive return');
      } else {
        for (let t = 0; t < 90; t++) step(); assert.deepEqual([actor().x, actor().z], pose); assert.equal(target().hp, hp);
      }
      assert.equal(actor().attackTargetId, -1); assert.equal(stanceAcquiredMovementActive(actor()), false);
    });
  });
}

for (const team of [0, 1]) for (const stance of ['aggressive', 'defensive']) for (const kind of ['infantry', 'archer']) {
  test(`seat ${team}: moving target invokes automatic ${stance} ${kind} repath with the retained suffix`, async () => {
    await journey(team, stance, async ({ r, id, targetId, actor, command, acquire, step, recover, finish, origin }) => {
      acquire(); command(targetId, 'move', { x: kind === 'archer' ? 6.5 : 3.5, z: -.5 });
      let repaths = 0;
      for (let t = 0; t < 160 && !repaths; t++) {
        step();
        for (const join of r().routeRejoins.filter(j => j.id === id)) {
          repaths++; const prefix = join.path.length - join.selected.length;
          assert.ok(prefix === 0 || prefix === 1); assert.deepEqual(join.path.slice(prefix), join.selected);
        }
        assert.deepEqual([actor().stanceAnchorX, actor().stanceAnchorZ], [origin.x, origin.z]);
      }
      assert.ok(repaths > 0); await recover(true); finish();
    }, { kind });
  });
}

for (const team of [0, 1]) for (const stance of ['aggressive', 'defensive']) {
  test(`seat ${team}: automatic ${stance} target leaves the original leash without sliding its anchor`, async () => {
    await journey(team, stance, async ({ actor, target, targetId, command, acquire, until, recover, origin, step }) => {
      acquire(); command(targetId, 'move', { x: 14.5, z: .5 }); until(() => actor().attackTargetId < 0, 400);
      assert.ok(target().hp > 0); assert.deepEqual([actor().stanceAnchorX, actor().stanceAnchorZ], [origin.x, origin.z]);
      await recover(true); for (let t = 0; t < 120; t++) step();
      assert.equal(actor().attackTargetId, -1); assert.equal(actor().stanceReturning, false);
    });
  });
  test(`seat ${team}: automatic ${stance} overlap rejects its prefix without admitting movement or inventing damage`, async () => {
    await journey(team, stance, async ({ r, id, actor, target, recover, step }) => {
      const saved = r().checkpoint(); saved.state.units[id].x = .91;
      assert.ok(r().validate(structuredClone(saved))); r().restore(saved);
      r().step(); const join = r().routeRejoins.find(j => j.id === id); assert.ok(join); assert.equal(join.rejoin, 'rejected');
      const pose = [actor().x, actor().z], hp = target().hp; await recover(true);
      for (let t = 0; t < 30; t++) { step(); assert.deepEqual(actor().path, []); }
      assert.deepEqual([actor().x, actor().z], pose); assert.equal(target().hp, hp); assert.ok(actor().attackTargetId >= 0);
    });
  });
  test(`seat ${team}: paid wall repairs automatic ${stance} pursuit with the original target and fixed anchor`, async () => {
    await journey(team, stance, async ({ r, actor, command, acquire, recover, finish, origin }) => {
      acquire(); const builder = r().units.find(u => u.team === team && u.kind === 'worker');
      const wood = r().wood[team], nav = r().navigationRevision;
      assert.ok(command(builder.id, 'build', { buildingType: 'palisade-wall', x: 1.5, z: .5 }).some(n => /PLACED/.test(n.message)));
      command(builder.id, 'stop'); assert.ok(r().wood[team] < wood); assert.ok(r().navigationRevision > nav);
      const paid = r().wood[team]; await recover(true); finish(); assert.equal(r().wood[team], paid);
      assert.deepEqual([actor().stanceAnchorX, actor().stanceAnchorZ], [origin.x, origin.z]); return [builder.id];
    });
  });
}

for (const team of [0, 1]) {
  test(`seat ${team}: automatic Defensive repath rejects a clear prefix outside the unchanged travel bound`, async () => {
    await journey(team, 'defensive', async ({ r, id, actor, target, acquire, recover, step, clear }) => {
      acquire(); const saved = r().checkpoint();
      // Validator-accepted legacy recovery control. No gameplay policy is
      // changed: current pose and selected firing point satisfy travel, but
      // the otherwise body-clear current-cell center lies outside it.
      Object.assign(saved.state.units[id], { x: .75, z: .95, stanceAnchorX: 3.55, stanceAnchorZ: .95,
        attackMoveAnchorX: 3.55, attackMoveAnchorZ: .95, path: [], pathIndex: 0, repathTimer: 0, lastAttackCell: -1 });
      assert.ok(r().validate(structuredClone(saved))); r().restore(saved);
      assert.ok(clear(actor(), r().point(r().cell(actor().x, actor().z))));
      assert.ok(Math.hypot(actor().x - 3.55, actor().z - .95) <= 3);
      assert.ok(Math.hypot(.5 - 3.55, .5 - .95) > 3);
      assert.equal(r().automaticAttackApproach(id, target().id, true).reachable, true);
      step(); const join = r().routeRejoins.find(j => j.id === id); assert.ok(join); assert.equal(join.rejoin, 'rejected');
      const pose = [actor().x, actor().z], hp = target().hp; await recover(true);
      for (let t = 0; t < 30; t++) step();
      assert.deepEqual([actor().x, actor().z], pose); assert.equal(target().hp, hp);
      assert.deepEqual([actor().stanceAnchorX, actor().stanceAnchorZ], [3.55, .95]);
    });
  });
  for (const stance of ['standGround', 'noAttack']) test(`seat ${team}: out-of-range ${stance} remains stationary and passive through recovery`, async () => {
    await journey(team, stance, async ({ actor, target, recover, step, origin }) => {
      for (let t = 0; t < 30; t++) step(); await recover(true); for (let t = 0; t < 90; t++) step();
      assert.deepEqual([actor().x, actor().z], [origin.x, origin.z]); assert.equal(target().hp, 100);
      assert.equal(stanceAcquiredMovementActive(actor()), false);
    });
  });
  for (const kind of ['infantry', 'archer']) test(`seat ${team}: in-range StandGround ${kind} retains empty travel and productive firing through recovery`, async () => {
    await journey(team, 'standGround', async ({ actor, acquire, recover, finish, origin }) => {
      acquire(); assert.deepEqual(actor().path, []); await recover(true); finish();
      assert.deepEqual([actor().x, actor().z], [origin.x, origin.z]); assert.equal(stanceAcquiredMovementActive(actor()), false);
    }, { kind, targetPoint: { x: 1.75, z: .95 } });
  });
  test(`seat ${team}: same-cell in-range automatic Infantry fires without a speculative closure step`, async () => {
    await journey(team, 'aggressive', async ({ actor, acquire, recover, finish, until, receipts }) => {
      acquire(); assert.deepEqual(actor().path, []);
      until(() => receipts() > 0); await recover(true); finish(); assert.ok(receipts() > 0);
      // Existing interaction separation may change pose during close combat. This control proves productive empty-route firing, not zero body
      // separation or a new same-cell closure algorithm.
    }, { actorPoint: { x: .25, z: .5 }, targetPoint: { x: .75, z: .5 } });
  });
}
