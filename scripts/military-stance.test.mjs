import assert from 'node:assert/strict';
import test from 'node:test';
import { createStanceCase } from './military-stance-case.mjs';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { armyAttackMap } from './army-attack-continuation-case.mjs';

for (const schemaVersion of [23, 24]) {
  test(`schema ${schemaVersion}: stance migration composes with wildlife and retains routes and food`, async () => {
    const map = armyAttackMap();
    map.resourceNodes = [{ id: 'migration-sheep', type: 'food', x: -20.5, z: .5,
      stock: 100, wildlifeSpecies: 'bellweather-sheep' }];
    const fixture = await createPathingReplayFixture(map), r = fixture.replay;
    try {
      const unit = r.units.find(u => u.team === 0 && u.kind === 'infantry');
      const worker = r.units.find(u => u.team === 0 && u.kind === 'worker');
      r.order(0, { type: 'move', ids: [unit.id], x: 18.5, z: 7.5 });
      r.order(0, { type: 'gather', ids: [worker.id], nodeId: 'migration-sheep' });
      r.drain(); for (let i = 0; i < 180; i++) r.step();
      const legacy = r.checkpoint(), route = structuredClone(legacy.state.units[unit.id]);
      const resources = structuredClone(legacy.state.resourceNodes), food = [...legacy.state.teamFood];
      assert.ok(route.pathIndex < route.path.length, 'ordinary Move remains in flight');
      legacy.schemaVersion = schemaVersion;
      for (const u of legacy.state.units) for (const field of ['combatStance', 'stanceAnchorX', 'stanceAnchorZ', 'stanceCombat', 'stanceReturning']) delete u[field];
      for (const node of legacy.state.resourceNodes) delete node.wildlifeTeam;
      if (schemaVersion === 23) for (const node of legacy.state.resourceNodes) {
        delete node.x; delete node.z; delete node.wildlifeMotion;
      }
      r.restore(legacy); const recovered = r.checkpoint();
      assert.equal(recovered.schemaVersion, 26); r.validate(structuredClone(recovered));
      const restored = recovered.state.units[unit.id];
      for (const field of ['x', 'z', 'hp', 'path', 'pathIndex', 'moveGoalCell']) assert.deepEqual(restored[field], route[field]);
      assert.deepEqual(recovered.state.teamFood, food);
      assert.equal(recovered.state.resourceNodes[0].stock, resources[0].stock);
      assert.equal(recovered.state.resourceNodes[0].wildlifeTeam, null, 'legacy Sheep migrate as neutral');
      if (schemaVersion === 24) assert.deepEqual(recovered.state.resourceNodes,
        resources.map(node => ({ ...node, wildlifeTeam: null })), 'live motion and stock are preserved while ownership starts neutral');
      assert.equal(restored.combatStance, 'noAttack');
    } finally { await fixture.dispose(); }
  });
}

test('schema25: claims migration preserves existing stances, routes, economy and Sheep pose in actual replay', async () => {
  const map = armyAttackMap();
  map.resourceNodes = [
    { id: 'migration-sheep', type: 'food', x: -20.5, z: .5, stock: 100, wildlifeSpecies: 'bellweather-sheep' },
    { id: 'roaming-sheep', type: 'food', x: -12.5, z: -10.5, stock: 130, wildlifeSpecies: 'bellweather-sheep' },
  ];
  const fixture = await createPathingReplayFixture(map), r = fixture.replay;
  try {
    const mover = r.units.find(unit => unit.team === 0 && unit.kind === 'infantry');
    const holder = r.units.find(unit => unit.team === 1 && unit.kind === 'infantry');
    const worker = r.units.find(unit => unit.team === 0 && unit.kind === 'worker');
    r.order(0, { type: 'setStance', ids: [mover.id], stance: 'defensive' });
    r.order(1, { type: 'setStance', ids: [holder.id], stance: 'standGround' });
    r.order(0, { type: 'move', ids: [mover.id], x: 18.5, z: 7.5 });
    r.order(0, { type: 'move', ids: [mover.id], x: 18.5, z: 12.5, queue: true });
    r.order(0, { type: 'gather', ids: [worker.id], nodeId: 'migration-sheep' });
    r.drain();
    for (let ticks = 0; ticks < 300; ticks++) {
      r.step();
      const roaming = r.resources.get('roaming-sheep');
      if (worker.cargo > 0 && roaming.wildlifeMotion.activity === 'wandering'
        && Math.hypot(roaming.x + 12.5, roaming.z + 10.5) > .02) break;
    }
    const original = r.checkpoint(), legacy = structuredClone(original);
    const route = original.state.units[mover.id], roaming = original.state.resourceNodes.find(node => node.id === 'roaming-sheep');
    assert.equal(original.schemaVersion, 26);
    assert.equal(route.combatStance, 'defensive');
    assert.ok(route.pathIndex < route.path.length && route.queuedWaypoints.length === 1, 'accepted queued Move is still in flight');
    assert.equal(original.state.units[holder.id].combatStance, 'standGround');
    assert.ok(original.state.units[worker.id].cargo > 0, 'real Gather has transferred food into cargo');
    assert.equal(roaming.wildlifeMotion.activity, 'wandering');
    assert.ok(Math.hypot(roaming.x + 12.5, roaming.z + 10.5) > .02, 'untouched Sheep has a non-anchor live pose');
    legacy.schemaVersion = 25;
    for (const node of legacy.state.resourceNodes) delete node.wildlifeTeam;
    r.restore(structuredClone(legacy));
    const recovered = r.checkpoint();
    assert.equal(recovered.schemaVersion, 26);
    r.validate(structuredClone(recovered));
    assert.deepEqual(recovered.state.units, original.state.units, 'existing stance, anchors, routes, queued Move and cargo survive unchanged');
    for (const field of ['teamFood', 'teamWood', 'teamStone', 'workerProduction', 'buildings']) {
      assert.deepEqual(recovered.state[field], original.state[field], `${field} survives without charging, refunding or crediting food`);
    }
    assert.deepEqual(recovered.state.resourceNodes, original.state.resourceNodes.map(node => ({ ...node, wildlifeTeam: null })),
      'schema25 initializes only neutral ownership, preserving partial stock and live motion position/goal/wait');

    // Compare the migrated save with the same state already encoded as schema26.
    // Both drivers execute intact production functions for the same fixed ticks.
    const current = structuredClone(original);
    for (const node of current.state.resourceNodes) node.wildlifeTeam = null;
    r.restore(current);
    for (let tick = 0; tick < 60; tick++) r.step();
    const expected = r.checkpoint();
    r.restore(structuredClone(legacy));
    for (let tick = 0; tick < 60; tick++) r.step();
    assert.deepEqual(r.checkpoint().state, expected.state, 'schema25 and schema26 recover to identical ongoing stance, route, food and pose state');
  } finally { await fixture.dispose(); }
});

for (const team of [0, 1]) {
  for (const kind of ['infantry', 'archer']) for (const stance of ['aggressive', 'defensive', 'standGround', 'noAttack']) {
    test(`seat ${team}: idle ${kind} ${stance} responds under fire according to stance`, async () => {
      const c = await createStanceCase({ team, kind, targets: kind === 'archer' ? [[4.5, .5], [4.5, 2.5]] : undefined });
      try {
        c.stance(stance);
        const attacker = c.enemies[0];
        c.order(1 - team, { type: 'attack', ids: [attacker.id], targetId: c.unit.id,
          targetGeneration: c.unit.generation });
        let maxTravel = 0;
        for (let i = 0; i < 1100; i++) {
          c.r.step(); maxTravel = Math.max(maxTravel, Math.hypot(c.unit.x - c.origin.x, c.unit.z - c.origin.z));
        }
        if (stance === 'noAttack') {
          assert.equal(attacker.hp, 100); assert.equal(c.unit.hp, 0);
        } else {
          assert.equal(attacker.hp, 0); assert.ok(c.unit.hp > 0);
          if (stance !== 'standGround' || kind === 'archer') assert.equal(c.enemies[1].hp, 0, 'next target takes real damage');
        }
        if (stance === 'standGround' || stance === 'noAttack') assert.equal(maxTravel, 0);
        if (stance === 'defensive') assert.ok(maxTravel <= 3 + 1e-6);
      } finally { await c.dispose(); }
    });
  }
  test(`seat ${team}: No Attack permits a focused click, then stays passive`, async () => {
    const c = await createStanceCase({ team });
    try {
      c.order(team, { type: 'attack', ids: [c.unit.id], targetId: c.enemies[0].id });
      c.until(() => c.enemies[0].hp === 0, 'explicit focused target dies'); c.step(300);
      assert.equal(c.enemies[1].hp, 100); assert.equal(c.unit.attackTargetId, -1);
      assert.equal(c.unit.combatStance, 'noAttack');
    } finally { await c.dispose(); }
  });
  test(`seat ${team}: Stand Ground refuses out-of-range explicit targets`, async () => {
    const c = await createStanceCase({ team });
    try {
      c.stance('standGround');
      const notices = c.r.order(team, { type: 'attack', ids: [c.unit.id], targetId: c.enemies[0].id });
      assert.match(notices[0].message, /REJECTED/); c.step(180);
      assert.deepEqual({ x: c.unit.x, z: c.unit.z }, c.origin);
      assert.equal(c.enemies[0].hp, 100);
    } finally { await c.dispose(); }
  });
  test(`seat ${team}: Defensive Archer keeps weapon reach while stationary`, async () => {
    const c = await createStanceCase({ team, kind: 'archer', targets: [[4.5, .5]] });
    try {
      c.stance('defensive'); c.until(() => c.enemies[0].hp === 0, 'target four cells away dies');
      assert.deepEqual({ x: c.unit.x, z: c.unit.z }, c.origin);
    } finally { await c.dispose(); }
  });
  test(`seat ${team}: Stop/Hold mappings and Follow internal cancellation preserve intent`, async () => {
    const c = await createStanceCase({ team });
    try {
      c.stance('defensive');
      const leader = c.r.units.find(u => u.team === team && u.kind === 'worker');
      c.order(team, { type: 'follow', ids: [c.unit.id], targetId: leader.id, targetGeneration: leader.generation });
      assert.equal(c.unit.combatStance, 'defensive'); assert.equal(c.unit.persistentOrder.type, 'follow');
      c.order(team, { type: 'stop', ids: [c.unit.id] });
      assert.equal(c.unit.combatStance, 'noAttack'); c.step(20); assert.equal(c.unit.attackTargetId, -1);
      c.order(team, { type: 'holdPosition', ids: [c.unit.id] });
      assert.equal(c.unit.combatStance, 'standGround'); assert.equal(c.unit.holdingPosition, true);
      c.stance('aggressive'); assert.equal(c.unit.holdingPosition, false);
      c.until(() => c.enemies[0].hp < 100, 'new stance releases military Hold');
    } finally { await c.dispose(); }
  });
  test(`seat ${team}: stance validation, generation, mixed workers and private snapshots`, async () => {
    const c = await createStanceCase({ team });
    try {
      const worker = c.r.units.find(u => u.team === team && u.kind === 'worker');
      const enemy = c.r.units.find(u => u.team !== team && u.kind === 'infantry');
      for (const command of [
        { ids: [c.unit.id], stance: 'invalid' },
        { ids: [c.unit.id], unitGenerations: [c.unit.generation + 1], stance: 'aggressive' },
        { ids: [worker.id, enemy.id], stance: 'aggressive' },
      ]) assert.match(c.r.order(team, { type: 'setStance', ...command })[0].message, /REJECTED/);
      c.order(team, { type: 'setStance', ids: [worker.id, c.unit.id], stance: 'defensive' });
      assert.equal(worker.combatStance, null); assert.equal(c.unit.combatStance, 'defensive');
      assert.ok(c.r.snapshot(team).unitStances.some(row => row[0] === c.unit.id && row[1] === c.unit.generation && row[2] === 'defensive'));
      assert.ok(c.r.snapshot(team).unitStances.every(row => c.r.units[row[0]].team === team));
      assert.ok(c.r.snapshot(1 - team).unitStances.every(row => row[0] !== c.unit.id));
    } finally { await c.dispose(); }
  });
  test(`seat ${team}: Defensive pursuit stays within three cells and schema25 preserves its active return`, async () => {
    const c = await createStanceCase({ team, targets: [[2.5, .5]] });
    try {
      c.stance('defensive'); c.until(() => c.unit.attackTargetId >= 0, 'local target acquired');
      c.order(1 - team, { type: 'move', ids: [c.enemies[0].id], x: 10.5 * c.side, z: .5 });
      let maxTravel = 0, saved = null;
      for (let i = 0; i < 450; i++) {
        c.r.step(); maxTravel = Math.max(maxTravel, Math.hypot(c.unit.x - c.origin.x, c.unit.z - c.origin.z));
        if (!saved && c.unit.stanceReturning && c.unit.pathIndex < c.unit.path.length) saved = c.r.checkpoint();
      }
      assert.ok(maxTravel > .5 && maxTravel <= 3 + 1e-6); assert.ok(saved, 'checkpoint catches automatic return');
      assert.ok(Math.hypot(c.unit.x - c.origin.x, c.unit.z - c.origin.z) < .02);
      c.r.restore(saved); c.r.drain();
      const legacy = structuredClone(saved); legacy.schemaVersion = 25;
      for (const node of legacy.state.resourceNodes) delete node.wildlifeTeam;
      c.r.restore(legacy);
      const migrated = c.r.checkpoint(), original = saved.state.units[c.unit.id];
      assert.equal(migrated.schemaVersion, 26);
      assert.equal(original.stanceCombat, true); assert.equal(original.stanceReturning, true);
      const restored = c.r.units[c.unit.id];
      for (const field of ['combatStance', 'stanceAnchorX', 'stanceAnchorZ', 'stanceCombat', 'stanceReturning',
        'x', 'z', 'path', 'pathIndex', 'moveGoalCell', 'attackMove', 'attackMoveResumePath', 'attackMoveResumePathIndex']) {
        assert.deepEqual(restored[field], original[field], `schema25 claims migration preserves active return ${field}`);
      }
      assert.deepEqual(migrated.state.teamFood, saved.state.teamFood);
      assert.deepEqual(migrated.state.teamWood, saved.state.teamWood);
      assert.deepEqual(migrated.state.resourceNodes, saved.state.resourceNodes.map(node => ({ ...node, wildlifeTeam: null })));
      assert.equal(restored.combatStance, 'defensive');
      assert.equal(restored.stanceReturning, true);
      c.r.drain();
      c.until(() => !restored.stanceReturning && !restored.movePlanningPending, 'persisted return finishes');
      assert.ok(Math.hypot(restored.x - c.origin.x, restored.z - c.origin.z) < .02);
    } finally { await c.dispose(); }
  });
  test(`seat ${team}: No Attack/Stand Ground stance changes stop automatic pursuit immediately`, async () => {
    for (const stance of ['noAttack', 'standGround']) {
      const c = await createStanceCase({ team, targets: [[4.5, .5]] });
      try {
        c.stance('aggressive'); c.until(() => c.unit.x !== c.origin.x, 'automatic chase starts');
        c.stance(stance); const position = [c.unit.x, c.unit.z]; c.step(180);
        assert.deepEqual([c.unit.x, c.unit.z], position); assert.equal(c.enemies[0].hp, 100);
      } finally { await c.dispose(); }
    }
  });
  test(`seat ${team}: queued Move retreat takes precedence and activates stance only after final arrival`, async () => {
    const c = await createStanceCase({ team });
    try {
      c.stance('aggressive');
      c.order(team, { type: 'move', ids: [c.unit.id], x: -6.5 * c.side, z: .5 });
      c.order(team, { type: 'move', ids: [c.unit.id], x: -12.5 * c.side, z: -8.5, queue: true });
      const goal = c.unit.queuedWaypoints[0].destination;
      c.until(() => {
        assert.equal(c.unit.attackTargetId, -1); assert.ok(c.enemies.every(e => e.hp === 100));
        return !c.unit.movePlanningPending && c.unit.pathIndex === c.unit.path.length && !c.unit.queuedWaypoints.length;
      }, 'every queued retreat leg arrives');
      assert.equal(c.unit.moveGoalCell, goal); c.step(12);
      assert.equal(c.unit.stanceAnchorX, c.r.point(goal).x); assert.equal(c.unit.stanceAnchorZ, c.r.point(goal).z);
    } finally { await c.dispose(); }
  });
  test(`seat ${team}: Aggressive successive kills retain a fixed anchor and reject enemies beyond the leash`, async () => {
    const c = await createStanceCase({ team, targets: [[4.5, .5], [7.5, .5], [10.5, .5]], reveal: true });
    try {
      const observer = c.r.units.find(u => u.team === team && u.kind === 'worker');
      c.order(team, { type: 'move', ids: [observer.id], x: 9.5 * c.side, z: 2.5 });
      c.until(() => observer.pathIndex === observer.path.length, 'observer reveals boundary enemies'); c.step(6);
      c.stance('aggressive'); let maxTravel = 0;
      for (let i = 0; i < 1200; i++) {
        c.r.step(); maxTravel = Math.max(maxTravel, Math.hypot(c.unit.x - c.origin.x, c.unit.z - c.origin.z));
      }
      assert.deepEqual(c.enemies.map(e => e.hp), [0, 0, 100]);
      assert.equal(c.unit.stanceAnchorX, c.origin.x); assert.equal(c.unit.stanceAnchorZ, c.origin.z);
      assert.ok(maxTravel <= 8 + 1e-6);
    } finally { await c.dispose(); }
  });
  test(`seat ${team}: stance checkpoint validation and legacy idle/Hold migration`, async () => {
    const c = await createStanceCase({ team });
    try {
      c.stance('defensive'); c.step(1); const snapshot = c.r.checkpoint();
      assert.equal(snapshot.schemaVersion, 26); c.r.validate(structuredClone(snapshot));
      for (const mutation of [u => { u.combatStance = 'omniscient'; }, u => { u.stanceAnchorX = Infinity; },
        u => { u.stanceReturning = true; u.combatStance = 'aggressive'; }]) {
        const invalid = structuredClone(snapshot); mutation(invalid.state.units[c.unit.id]);
        assert.throws(() => c.r.validate(invalid), /combat stance/);
      }
      c.order(team, { type: 'stop', ids: [c.unit.id] }); const legacy = c.r.checkpoint(); legacy.schemaVersion = 23;
      for (const u of legacy.state.units) for (const field of ['combatStance', 'stanceAnchorX', 'stanceAnchorZ', 'stanceCombat', 'stanceReturning']) delete u[field];
      for (const node of legacy.state.resourceNodes) delete node.wildlifeTeam;
      for (const schemaVersion of [23, 24]) {
        const previous = structuredClone(legacy); previous.schemaVersion = schemaVersion;
        c.r.restore(structuredClone(previous)); assert.equal(c.r.units[c.unit.id].combatStance, 'noAttack');
        assert.equal(c.r.checkpoint().schemaVersion, 26);
        previous.state.units[c.unit.id].holdingPosition = true;
        c.r.restore(previous); assert.equal(c.r.units[c.unit.id].combatStance, 'standGround');
      }
    } finally { await c.dispose(); }
  });
  test(`seat ${team}: No Attack suppresses opportunity targets during attack-move, Patrol and Follow`, async () => {
    for (const type of ['attackMove', 'patrol', 'follow']) {
      const c = await createStanceCase({ team });
      try {
        const leader = c.r.units.find(u => u.team === team && u.kind === 'worker');
        const command = type === 'follow' ? { type, targetId: leader.id, targetGeneration: leader.generation }
          : { type, x: 5.5 * c.side, z: .5 };
        c.order(team, { ...command, ids: [c.unit.id] }); c.step(180);
        assert.ok(c.enemies.every(e => e.hp === 100)); assert.equal(c.unit.attackTargetId, -1);
        assert.equal(c.unit.combatStance, 'noAttack');
      } finally { await c.dispose(); }
    }
  });
  test(`seat ${team}: stance remains private with fog disabled`, async () => {
    const c = await createStanceCase({ team, fog: false });
    try {
      assert.ok(c.r.snapshot(team).unitStances.every(row => c.r.units[row[0]].team === team));
      assert.equal(c.r.snapshot(null).unitStances.length, c.r.units.filter(u => u.kind !== 'worker').length);
    } finally { await c.dispose(); }
  });
  test(`seat ${team}: Defensive skips a closer route outside its leash and attacks the reachable alternative`, async () => {
    const c = await createStanceCase({ team, reveal: true, targets: [[2.5, .5], [-2.5, .5]],
      obstacle: { column: team ? 30 : 33, row: 28, width: 1, height: 9, material: 'stone' } });
    try {
      c.stance('defensive'); let maxTravel = 0;
      for (let i = 0; i < 1000; i++) {
        c.r.step(); maxTravel = Math.max(maxTravel, Math.hypot(c.unit.x - c.origin.x, c.unit.z - c.origin.z));
      }
      assert.deepEqual(c.enemies.map(e => e.hp), [100, 0]); assert.ok(maxTravel <= 3 + 1e-6);
      assert.ok(Math.hypot(c.unit.x - c.origin.x, c.unit.z - c.origin.z) < .02);
    } finally { await c.dispose(); }
  });
  for (const hold of [false, true]) test(`seat ${team}: ${hold ? 'Hold' : 'Stand Ground'} remains fixed while a friendly Worker shares its cell`, async () => {
    const c = await createStanceCase({ team, targets: [[1.5, .5]] });
    try {
      const worker = c.r.units.find(u => u.team === team && u.kind === 'worker');
      c.order(team, { type: 'move', ids: [worker.id], x: .5 * c.side, z: .5 });
      c.until(() => !worker.movePlanningPending && worker.pathIndex === worker.path.length, 'friendly Worker arrives');
      if (hold) c.order(team, { type: 'holdPosition', ids: [c.unit.id] });
      else c.stance('standGround');
      for (let i = 0; i < 30; i++) { c.r.step(); assert.deepEqual({ x: c.unit.x, z: c.unit.z }, c.origin); }
      assert.ok(c.enemies[0].hp < 100, 'stationary fighter still deals authoritative damage');
    } finally { await c.dispose(); }
  });
  test(`seat ${team}: a paid wall blocking Defensive return ends planning and keeps local defense active`, async () => {
    const c = await createStanceCase({ team });
    try {
      c.stance('defensive'); c.until(() => c.unit.attackTargetId >= 0, 'Defensive acquires bait');
      c.order(1 - team, { type: 'move', ids: [c.enemies[0].id], x: 4.5 * c.side, z: .5 });
      c.until(() => c.unit.x * c.side > 2, 'fighter passes later wall site');
      const worker = c.r.units.find(u => u.team === team && u.kind === 'worker');
      c.order(team, { type: 'buildWall', ids: [worker.id],
        points: [{ column: team ? 30 : 33, row: 28 }, { column: team ? 30 : 33, row: 36 }] }, /PALISADE LINE PLACED/);
      c.order(1 - team, { type: 'move', ids: [c.enemies[0].id], x: 10.5 * c.side, z: .5 });
      c.step(180); assert.equal(c.unit.stanceReturning, false); assert.equal(c.unit.movePlanningPending, false);
      assert.equal(c.unit.stanceAnchorX, c.origin.x); assert.equal(c.unit.stanceAnchorZ, c.origin.z);
      c.order(1 - team, { type: 'move', ids: [c.enemies[1].id], x: 2.5 * c.side, z: .5 });
      c.until(() => c.enemies[1].hp < 100, 'unit still defends locally after failed return');
      assert.ok(Math.hypot(c.unit.x - c.origin.x, c.unit.z - c.origin.z) <= 3 + 1e-6);
      const saved = c.r.checkpoint(); c.r.restore(saved); c.r.drain();
      assert.equal(c.r.units[c.unit.id].combatStance, 'defensive');
    } finally { await c.dispose(); }
  });
}
