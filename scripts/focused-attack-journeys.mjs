import assert from 'node:assert/strict';
import test from 'node:test';
import { focusedUnitAttackMovementActive } from '../src/combat-movement.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { combatDamage } from '../src/combat-rules.mjs';
import { activeLandMovementBodyRadius, canTraverseStaticBodySegment, canTraverseUnitStep, LAND_CLEARANCE_PROFILE } from '../src/unit-movement.mjs';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';

function assertSelectedRoutePreserved(published, selected, currentCell) {
  const prefixLength = published.length - selected.length;
  assert.ok(prefixLength === 0 || (selected.length > 0 && prefixLength === 1), 'only a necessary current-cell rejoin may be added');
  if (prefixLength) assert.equal(published[0], currentCell);
  assert.deepEqual(published.slice(prefixLength), selected, 'the entire selected route survives publication unchanged');
}

test('focused Attack clearance derives from explicit military unit-target intent, including noAttack', () => {
  const unit = { kind: 'infantry', hp: 100, attackMove: false, attackTargetId: 7,
    attackBuildingTargetId: -1, buildingTargetId: null, combatStance: 'noAttack',
    gatherNodeId: null, gatherForestCell: -1, path: [] };
  assert.equal(focusedUnitAttackMovementActive(unit), true);
  for (const [kind, radius] of Object.entries(LAND_CLEARANCE_PROFILE.radiusByKind)) {
    assert.equal(activeLandMovementBodyRadius({ ...unit, kind }), kind === 'worker' ? 0 : radius);
  }
  for (const override of [{ kind: 'worker' }, { kind: 'skiff' }, { kind: 'sheep' }, { kind: 'unknown' },
    { hp: 0 }, { movementDomain: 'water' }, { attackTargetId: -1 }, { attackTargetId: undefined },
    { attackTargetId: 1.5 }, { attackTargetId: '7' }, { attackBuildingTargetId: 0 },
    { attackMove: true }, { holdingPosition: true }, { stanceCombat: true }, { stanceReturning: true },
    { persistentOrder: { type: 'patrol' } }, { persistentOrder: { type: 'follow' } },
    { gatherNodeId: 'berries' }, { gatherForestCell: 0 }, { gatherPhase: 'to-base' }, { buildingTargetId: 0 }]) {
    assert.equal(focusedUnitAttackMovementActive({ ...unit, ...override }), false, JSON.stringify(override));
  }
});

async function journey(team, kind, action) {
  process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp';
  process.env.RTS_PREGAME = '0'; process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '0';
  delete process.env.RTS_MATCH_STATE_PATH;
  const map = { id: 'focused-attack-journey', name: 'Focused Attack Journey',
    width: 64, height: 48, terrainSeed: 881, fogOfWar: false, startingArmySize: 16,
    startingResources: { food: 500, wood: 1000 },
    spawnPoints: [{ team: 0, x: -20, z: -16 }, { team: 1, x: 20, z: 16 }],
    resourceNodes: [], triggers: [], scenarioEvents: [],
    obstacles: [{ column: 33, row: 25, width: 1, height: 1, material: 'stone' }] };
  const fixture = await createPathingReplayFixture(map, { traceLandSteps: true }), r = fixture.replay;
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
      const notices = r.order(team, { type: 'trainUnit', buildingId: home.id, kind: 'archer' });
      assert.ok(notices.some(n => /ARCHER QUEUED/.test(n.message)));
      for (let t = 0; t < 500 && !r.units.some(u => u.team === team && u.kind === 'archer'); t++) r.step();
      const archer = r.units.find(u => u.team === team && u.kind === 'archer'); assert.ok(archer);
      command(archer.id, 'stop'); command(archer.id, 'setStance', { stance: 'noAttack' });
    }
    const id = r.units.find(u => u.team === team && u.kind === kind).id;
    const targetId = r.units.find(u => u.team !== team && u.kind === 'worker').id;
    const actor = () => r.units[id], target = () => r.units[targetId];
    const point = kind === 'archer' ? { x: 6.5, z: .5 } : { x: 2.25, z: .95 };
    command(targetId, 'move', point); r.drain();
    for (let t = 0; t < 800 && target().pathIndex < target().path.length; t++) r.step();
    assert.ok(Math.hypot(target().x - point.x, target().z - point.z) < .001);
    command(id, 'move', { x: .75, z: .95 }); r.drain();
    for (let t = 0; t < 800 && actor().pathIndex < actor().path.length; t++) r.step();
    assert.deepEqual({ x: actor().x, z: actor().z }, { x: .75, z: .95 });
    const radius = LAND_CLEARANCE_PROFILE.radiusByKind[kind];
    const clear = (a, b) => canTraverseStaticBodySegment(a, b, radius, map.width, map.height, r.isWalkable);
    assert.ok(clear(actor(), actor()));
    const untouched = r.units.filter(u => ![id, targetId].includes(u.id)).map(u => [u.id, u.orderRevision, u.hp]);
    const attack = () => command(id, 'attack', { targetId, targetGeneration: target().generation });
    let receipts = 0, steps = 0;
    const step = (options) => {
      const before = { x: actor().x, z: actor().z }, beforeTarget = { x: target().x, z: target().z }, hp = target().hp;
      r.step(options);
      for (const s of r.landSteps.filter(s => s.id === id)) {
        assert.notEqual(s.reason, 'same-cell-combat', 'this slice deliberately does not exercise same-cell closure');
        assert.ok(clear(s.from, s.to), `unsafe focused ${s.reason}: ${JSON.stringify(s)}`); steps++;
      }
      if (target().hp < hp) {
        receipts++;
        assert.ok(Math.hypot(before.x - beforeTarget.x, before.z - beforeTarget.z) <= UNIT_DEFINITIONS[kind].combat.range,
          'damage requires the unchanged weapon range');
        assert.equal(hp - target().hp, Math.min(hp, combatDamage(UNIT_DEFINITIONS[kind], UNIT_DEFINITIONS.worker)),
          'actual productive damage retains existing armor and damage rules');
      }
    };
    const recover = () => {
      const saved = r.checkpoint(); assert.ok(r.validate(structuredClone(saved))); r.restore(structuredClone(saved));
    };
    const finish = (limit = 1000) => {
      for (let t = 0; t < limit && target().hp > 0; t++) step();
      assert.equal(target().hp, 0, 'accepted focused pursuit must produce a bounded actual kill');
      assert.ok(receipts > 0); assert.equal(actor().attackTargetId, -1);
      assert.equal(actor().attackMove, false, 'noAttack focused target loss does not invent automatic pursuit');
      assert.equal(actor().path.length, 0);
    };
    await action({ r, id, targetId, actor, target, command, attack, clear, step, recover, finish,
      radius, counts: () => ({ receipts, steps }), point });
    assert.deepEqual(r.units.filter(u => ![id, targetId].includes(u.id)).map(u => [u.id, u.orderRevision, u.hp]), untouched,
      'focused Attack cannot recruit or damage the parked roster');
  } finally { await fixture.dispose(); }
}

for (const team of [0, 1]) for (const kind of ['infantry', 'archer']) for (const recovery of ['none', 'accepted', 'active', 'damage']) {
  test(`seat ${team}: explicit noAttack ${kind} keeps its full selected route and kills through ${recovery} recovery`, async () => {
    await journey(team, kind, ({ r, id, targetId, actor, target, attack, clear, step, recover, finish, radius, counts }) => {
      const revision = actor().orderRevision;
      const selected = r.attackApproach(id, targetId), startCell = r.cell(actor().x, actor().z);
      assert.ok(selected.reachable);
      assert.ok(attack().some(n => /ATTACK ORDER/.test(n.message)));
      assertSelectedRoutePreserved(actor().path, selected.path, startCell);
      assert.ok(clear(actor(), r.point(actor().path[0])), 'accepted publication must already have a body-clear first approach');
      const acceptedRevision = actor().orderRevision, goal = actor().moveGoalCell;
      assert.equal(acceptedRevision, revision + 1); assert.equal(goal, r.cell(target().x, target().z));
      assert.equal(actor().path.at(-1), goal, 'full selected focused route is retained, including ranged target-cell tail');
      assert.equal(actor().movePlanningPending, false); assert.equal(activeLandMovementBodyRadius(actor()), radius);
      if (recovery === 'active') { step(); step(); }
      if (recovery === 'damage') {
        for (let t = 0; t < 100 && !counts().receipts; t++) step();
        assert.ok(counts().receipts > 0, 'damage recovery requires an actual productive receipt before checkpointing');
      }
      if (recovery !== 'none') { recover(); assert.equal(actor().attackTargetId, target().id); }
      finish(); assert.ok(counts().steps > 0);
      assert.equal(actor().orderRevision, acceptedRevision, 'repath/recovery keeps accepted focused order identity');
      assert.equal(actor().moveGoalCell, goal, 'rejoin/repath must not replace durable moveGoalCell');
      assert.equal(actor().combatStance, 'noAttack');
    });
  });
}

for (const team of [0, 1]) test(`seat ${team}: focused Attack supersedes pending Move without stale publication`, async () => {
  await journey(team, 'infantry', ({ r, id, actor, command, attack, finish }) => {
    command(id, 'move', { x: -4.5, z: -3.5 }); assert.ok(actor().movePlanningPending);
    const revision = actor().orderRevision; attack();
    const goal = actor().moveGoalCell; assert.equal(actor().orderRevision, revision + 1);
    r.drain(); assert.equal(actor().moveGoalCell, goal); assert.equal(actor().movePlanningPending, false); finish();
  });
});

for (const team of [0, 1]) test(`seat ${team}: moving-target repath retains the deliberately selected legal waypoint and durable goal`, async () => {
  await journey(team, 'infantry', ({ r, id, targetId, actor, target, command, attack, clear, step, finish }) => {
    attack(); const goal = actor().moveGoalCell, revision = actor().orderRevision;
    step(); step(); command(targetId, 'move', { x: 8.5, z: -3.5 }); r.drain();
    let witnessed = 0;
    for (let t = 0; t < 300 && target().hp > 0; t++) {
      const next = actor().path[actor().pathIndex], cell = r.cell(actor().x, actor().z);
      const targetCell = r.cell(target().x, target().z), priorTargetCell = actor().lastAttackCell;
      const retained = actor().pathIndex < actor().path.length && canTraverseUnitStep(cell, next, 64, r.levels, r.isWalkable);
      const selected = r.attackApproach(id, targetId, true);
      const before = { x: actor().x, z: actor().z };
      step();
      if (actor().attackTargetId === targetId && actor().lastAttackCell !== priorTargetCell && retained) {
        witnessed++;
        assert.ok(actor().path.slice(0, 2).includes(next), 'rejoin can prefix but cannot discard the intentional retained waypoint');
        assertSelectedRoutePreserved(actor().path, selected.path, cell);
        assert.ok(clear(before, r.point(actor().path[0])), 'repath publication has a body-clear first approach from the actual fractional start');
        assert.equal(actor().path.at(-1), targetCell, 'repath still publishes the full target-selected route');
      }
      assert.equal(actor().moveGoalCell, goal); assert.equal(actor().orderRevision, revision);
    }
    assert.ok(witnessed > 0, 'real moving-target journey must exercise continuation publication'); finish();
  });
});

for (const team of [0, 1]) for (const phase of ['accepted', 'active']) for (const replacement of ['stop', 'holdPosition', 'queuedMove']) {
  test(`seat ${team}: ${replacement} survives ${phase} focused pursuit recovery without stale continuation`, async () => {
    await journey(team, 'infantry', ({ r, id, actor, command, attack, step, recover, finish }) => {
      attack(); if (phase === 'active') { step(); step(); }
      if (replacement === 'queuedMove') {
        command(id, 'move', { x: -3.5, z: -3.5, queue: true }); recover(); finish();
        for (let t = 0; t < 400 && (actor().movePlanningPending || actor().pathIndex < actor().path.length); t++) step();
        assert.ok(Math.hypot(actor().x + 3.5, actor().z + 3.5) < .001);
        assert.equal(actor().queuedWaypoints.length, 0);
      } else {
        command(id, replacement); const position = { x: actor().x, z: actor().z }; recover();
        for (let t = 0; t < 50; t++) step();
        assert.deepEqual({ x: actor().x, z: actor().z }, position);
        assert.equal(actor().attackTargetId, -1); assert.equal(actor().attackMove, false);
        assert.equal(actor().attackMoveResumePath, null); assert.equal(actor().path.length, 0);
      }
    });
  });
}

for (const team of [0, 1]) test(`seat ${team}: an already in-range explicit Attack publishes the existing empty route and real damage`, async () => {
  await journey(team, 'infantry', ({ r, targetId, actor, target, command, attack, step, finish, counts }) => {
    command(targetId, 'move', { x: .75, z: -.2 }); r.drain();
    for (let t = 0; t < 100 && target().pathIndex < target().path.length; t++) r.step();
    assert.ok(Math.hypot(actor().x - target().x, actor().z - target().z) <= UNIT_DEFINITIONS.infantry.combat.range);
    attack(); assert.deepEqual(actor().path, []);
    for (let t = 0; t < 30 && !counts().receipts; t++) step();
    assert.equal(counts().receipts, 1); finish();
  });
});

for (const team of [0, 1]) test(`seat ${team}: actual focused Worker Attack keeps its existing policy`, async () => {
  await journey(team, 'worker', ({ r, id, actor, target, attack }) => {
    assert.ok(attack().some(n => /ATTACK ORDER/.test(n.message)));
    assert.equal(focusedUnitAttackMovementActive(actor()), false);
    assert.equal(activeLandMovementBodyRadius(actor()), 0);
    const path = [...actor().path]; assert.equal(path.at(-1), r.cell(target().x, target().z));
    for (let t = 0; t < 20; t++) {
      r.step(); assert.equal(focusedUnitAttackMovementActive(actor()), false);
      assert.equal(activeLandMovementBodyRadius(actor()), 0);
    }
  });
});

for (const team of [0, 1]) test(`seat ${team}: actual AttackMove-acquired pursuit keeps the automatic policy`, async () => {
  await journey(team, 'infantry', ({ r, id, actor, target, command }) => {
    command(id, 'setStance', { stance: 'aggressive' }); command(id, 'attackMove', { x: 6.5, z: .5 }); r.drain();
    for (let t = 0; t < 20 && actor().attackTargetId < 0; t++) r.step();
    assert.equal(actor().attackTargetId, target().id); assert.ok(actor().attackMoveResumePath);
    assert.equal(focusedUnitAttackMovementActive(actor()), false);
    assert.equal(activeLandMovementBodyRadius(actor()), 0);
  });
});

for (const team of [0, 1]) test(`seat ${team}: actual building-target Attack remains outside focused unit adoption`, async () => {
  await journey(team, 'infantry', ({ r, id, targetId, actor, command }) => {
    command(targetId, 'build', { buildingType: 'house', x: 6.5, z: .5 }); r.drain();
    const site = r.buildings.find(b => b.team !== team && b.type === 'house'); assert.ok(site);
    assert.ok(command(id, 'attackBuilding', { buildingId: site.id }).some(n => /ATTACK BUILDING ORDER/.test(n.message)));
    assert.equal(actor().attackTargetId, -1); assert.equal(actor().attackBuildingTargetId, site.id);
    assert.equal(focusedUnitAttackMovementActive(actor()), false); assert.equal(activeLandMovementBodyRadius(actor()), 0);
    for (let t = 0; t < 20; t++) { r.step(); assert.equal(focusedUnitAttackMovementActive(actor()), false); }
  });
});

for (const team of [0, 1]) test(`seat ${team}: a paid footprint repairs focused pursuit without replacing its durable target goal`, async () => {
  await journey(team, 'infantry', ({ r, targetId, actor, target, command, attack, step, recover, finish }) => {
    command(targetId, 'move', { x: 6.5, z: .5 }); r.drain();
    for (let t = 0; t < 100 && target().pathIndex < target().path.length; t++) r.step();
    attack(); const goal = actor().moveGoalCell, navigation = r.navigationRevision;
    step(); step(); command(targetId, 'build', { buildingType: 'palisade-wall', x: 2.5, z: .5 });
    assert.ok(r.navigationRevision > navigation);
    const site = r.buildings.find(b => b.team !== team && b.type === 'palisade-wall'); assert.ok(site);
    const paidWood = r.wood[1 - team]; recover(); finish();
    assert.equal(actor().moveGoalCell, goal); assert.equal(r.wood[1 - team], paidWood);
    assert.ok(r.buildings.some(b => b.id === site.id), 'the paid footprint survives its builder target loss');
  });
});

for (const team of [0, 1]) test(`seat ${team}: rejected prefix retains focused intent through recovery without publishing unsafe travel`, async () => {
  await journey(team, 'infantry', ({ r, id, targetId, actor, target, command, attack, clear, recover, finish }) => {
    // A prior point-only checkpoint can have a finite position whose new body
    // overlaps the neighboring stone. This is a rejection control, not a claim
    // that this slice repairs legacy placement or stationary separation.
    const legacy = r.checkpoint(); legacy.state.units[id].x = .91;
    assert.ok(r.validate(structuredClone(legacy))); r.restore(structuredClone(legacy));
    assert.equal(clear(actor(), actor()), false);
    assert.ok(attack().some(n => /ATTACK ORDER/.test(n.message)));
    const revision = actor().orderRevision, goal = actor().moveGoalCell;
    const position = { x: actor().x, z: actor().z }, hp = target().hp;
    assert.deepEqual(actor().path, [], 'a rejected prefix does not publish the original unsafe route');
    recover();
    for (let t = 0; t < 30; t++) {
      r.step(); assert.deepEqual(actor().path, []); assert.equal(actor().attackTargetId, targetId);
      assert.equal(actor().orderRevision, revision); assert.equal(actor().moveGoalCell, goal);
      assert.deepEqual(r.landSteps.filter(s => s.id === id), []);
      assert.deepEqual({ x: actor().x, z: actor().z }, position);
    }
    assert.equal(target().hp, hp, 'rejection cannot invent out-of-range damage');
    command(targetId, 'move', { x: 2.18, z: .95 }); r.drain(); finish();
    assert.deepEqual({ x: actor().x, z: actor().z }, position, 'unchanged in-range firing can still complete without travel');
    assert.equal(actor().orderRevision, revision); assert.equal(actor().moveGoalCell, goal);
  });
});
