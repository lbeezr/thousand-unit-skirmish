import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { activeMoveGoalPoint, canTraverseUnitStep, canTraverseStaticBodySegment, LAND_CLEARANCE_PROFILE,
  createMoveGoalPoint } from '../src/unit-movement.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';

process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_PREGAME = '0';
delete process.env.RTS_MATCH_STATE_PATH;
const map = { id: 'fractional-move', name: 'FRACTIONAL MOVE', width: 64, height: 48,
  terrainSeed: 881, fogOfWar: true, startingArmySize: 16,
  startingResources: { food: 500, wood: 500 },
  spawnPoints: [{ team: 0, x: -20, z: -16 }, { team: 1, x: 20, z: 16 }],
  resourceNodes: [], obstacles: [], triggers: [], scenarioEvents: [] };
function quiet(r) {
  for (const team of [0, 1]) r.order(team, { type: 'setStance', stance: 'noAttack',
    ids: r.units.filter(u => u.team === team && u.kind === 'infantry').map(u => u.id) });
}
function move(r, u, x, z, queue = false, drain = true) {
  const notices = r.order(u.team, { type: 'move', ids: [u.id], unitGenerations: [u.generation], x, z, queue });
  if (drain) r.drain();
  assert.ok(notices.some(n => /MOVE ORDER|WAYPOINT|PLANNING MOVE/.test(n.message)), JSON.stringify(notices));
}
function arrive(r, u, limit = 1800) {
  for (let tick = 0; tick < limit; tick++) {
    const point = activeMoveGoalPoint(u);
    if (point && !u.movePlanningPending && u.pathIndex === u.path.length && !u.queuedWaypoints.length
      && Math.hypot(u.x - point.x, u.z - point.z) < .02) return;
    const from = r.cell(u.x, u.z), hp = u.hp; r.step();
    assert.ok(canTraverseUnitStep(from, r.cell(u.x, u.z), map.width, r.levels, r.isWalkable));
    assert.equal(u.hp, hp, 'combat cannot masquerade as a movement timeout');
  }
  assert.fail('fractional endpoint did not arrive');
}

for (const team of [0, 1]) for (const queued of [false, true]) for (const restore of [false, true])
test(`seat ${team}: crowded fractional corner ${queued ? 'queued' : 'ordinary'} arrival has static clearance ${restore ? 'with pending plan recovery' : 'with live authority'}`, async () => {
  const scene = { ...map, obstacles: [{ column: 31, row: 24, width: 1, height: 1, material: 'stone' }] };
  const f = await createPathingReplayFixture(scene), r = f.replay;
  try {
    quiet(r);
    let [u, ...parked] = r.units.filter(u => u.team === team && u.kind === 'infantry');
    const id = u.id, parkedIds = parked.map(u => u.id);
    const positions = [[.8575186714436859, .39964494945621115],
      [.06577922105789186, .24368512597866354], [.18835976794362064, .23038947279565025],
      [.47737181931734085, .742100709164515]];
    for (const [i, actor] of [u, ...parked].entries()) {
      r.order(team, { type: 'stop', ids: [actor.id], unitGenerations: [actor.generation] });
      Object.assign(actor, { x: positions[i][0], z: positions[i][1] });
    }
    r.step(); move(r, u, .001, .001, false, !restore);
    const goal = { x: u.moveGoalPoint.x, z: u.moveGoalPoint.z };
    assert.deepEqual(goal, { x: .22, z: .22 });
    if (queued) move(r, u, 5.23, 4.71, true, !restore);
    if (restore) {
      assert.ok(u.movePlanningPending); const saved = r.checkpoint(); assert.ok(r.validate(saved)); r.restore(saved);
      u = r.units[id]; parked = parkedIds.map(id => r.units[id]);
    }
    r.drain(); assert.deepEqual(u.path, [1568]);
    let finished = false;
    for (let tick = 0; tick < 1800 && !finished; tick++) {
      const before = { x: u.x, z: u.z, cell: r.cell(u.x, u.z) }, hp = u.hp;
      r.step();
      assert.ok(canTraverseUnitStep(before.cell, r.cell(u.x, u.z), map.width, r.levels, r.isWalkable),
        `actual terminal step ${JSON.stringify(before)} -> (${u.x},${u.z})`);
      assert.equal(u.hp, hp);
      assert.ok(canTraverseStaticBodySegment(before, u, .22, map.width, map.height, r.isWalkable), 'crowd deflection cannot penetrate the stone');
      if (u.moveGoalPoint?.requestedX === .001) {
        assert.deepEqual([u.moveGoalPoint.requestedX, u.moveGoalPoint.requestedZ], [.001, .001]);
        if (queued) assert.deepEqual([u.queuedWaypoints[0].point.requestedX, u.queuedWaypoints[0].point.requestedZ], [5.23, 4.71]);
      }
      if (queued ? !u.queuedWaypoints.length : !u.movePlanningPending && u.pathIndex === u.path.length) {
        finished = true;
        assert.deepEqual([u.x, u.z], [goal.x, goal.z], 'finish the legal point before completion or queue handoff');
      }
    }
    assert.ok(finished, 'refusing the snap cannot strand the order');
    if (queued) { arrive(r, u); assert.deepEqual([u.x, u.z], [5.23, 4.71]); }
    for (const [i, actor] of parked.entries())
      assert.deepEqual([actor.x, actor.z], positions[i + 1], 'parked Infantry remain fixed');
  } finally { await f.dispose(); }
});

for (const team of [0, 1]) for (const kind of ['worker', 'infantry'])
  test(`seat ${team} ${kind}: exact fractional Move and same-cell approach execute real commands`, async () => {
    const f = await createPathingReplayFixture(map), r = f.replay;
    try {
      quiet(r); const u = r.units.find(u => u.team === team && u.kind === kind);
      Object.assign(u, { x: -8.27, z: -.19 }); r.step();
      move(r, u, 10.31, 3.77); assert.equal(u.path.length, 1);
      assert.deepEqual([u.moveGoalPoint.requestedX, u.moveGoalPoint.requestedZ], [10.31, 3.77]);
      arrive(r, u); assert.deepEqual([u.x, u.z], [10.31, 3.77]);
      move(r, u, 10.89, 3.12); assert.equal(u.path.length, 1, 'cell membership is not physical arrival');
      assert.equal(r.cell(10.31, 3.77), u.moveGoalCell); arrive(r, u);
      assert.deepEqual([u.x, u.z], [10.89, 3.12]);
      const revision = u.orderRevision; for (let tick = 0; tick < 20; tick++) r.step();
      assert.deepEqual([u.x, u.z, u.orderRevision], [10.89, 3.12, revision]);
    } finally { await f.dispose(); }
  });

for (const team of [0, 1]) test(`seat ${team}: queued Move waits for the exact first point`, async () => {
  const f = await createPathingReplayFixture(map), r = f.replay;
  try {
    quiet(r); const u = r.units.find(u => u.team === team && u.kind === 'infantry');
    Object.assign(u, { x: .11, z: .12 }); r.step();
    move(r, u, .89, .88); const revision = u.orderRevision;
    move(r, u, 5.23, 4.71, true);
    for (let tick = 0; tick < 60 && u.orderRevision === revision; tick++) r.step();
    assert.equal(u.orderRevision, revision + 1);
    assert.deepEqual([u.x, u.z], [.89, .88], 'the queue cannot skip the final fractional approach');
    assert.deepEqual([u.moveGoalPoint.requestedX, u.moveGoalPoint.requestedZ], [5.23, 4.71]);
    arrive(r, u); assert.deepEqual([u.x, u.z], [5.23, 4.71]);
  } finally { await f.dispose(); }
});

for (const team of [0, 1]) test(`seat ${team}: normal defensive idle takes ownership only after exact Move completion`, async () => {
  const f = await createPathingReplayFixture(map), r = f.replay;
  try {
    const u = r.units.find(u => u.team === team && u.kind === 'infantry');
    Object.assign(u, { x: -8.27, z: -.19 }); r.step(); move(r, u, 10.31, 3.77);
    const hp = u.hp;
    for (let tick = 0; tick < 1800 && (u.movePlanningPending || u.pathIndex < u.path.length); tick++) r.step();
    assert.deepEqual([u.x, u.z], [10.31, 3.77]); assert.equal(u.hp, hp);
    for (let tick = 0; tick < 20; tick++) r.step();
    assert.deepEqual([u.x, u.z], [10.31, 3.77]);
    assert.ok(u.stanceCombat && u.attackMove, 'the existing idle combat policy remains active');
    assert.equal(activeMoveGoalPoint(u), null);
    const saved = r.checkpoint(); assert.equal(saved.state.units[u.id].moveGoalPoint, null);
    assert.ok(r.validate(saved)); r.restore(saved);
    assert.deepEqual([r.units[u.id].x, r.units[u.id].z], [10.31, 3.77]);
  } finally { await f.dispose(); }
});

for (const team of [0, 1]) for (const phase of ['pending', 'active', 'idle'])
  test(`seat ${team}: ${phase} point and queued intent recover without losing coordinates`, async () => {
    const f = await createPathingReplayFixture(map), r = f.replay;
    try {
      quiet(r); let u = r.units.find(u => u.team === team && u.kind === 'infantry'); const id = u.id;
      Object.assign(u, { x: -8.27, z: -.19 }); r.step();
      move(r, u, 8.31, 4.77, false, false); move(r, u, -4.61, 5.23, true, false);
      if (phase !== 'pending') { r.drain(); for (let tick = 0; tick < 17; tick++) r.step(); }
      if (phase === 'idle') arrive(r, u);
      const saved = r.checkpoint(), record = saved.state.units[id]; assert.ok(r.validate(saved));
      const originalX = record.moveGoalPoint.x; record.moveGoalPoint.x += .01;
      assert.equal(u.moveGoalPoint.x, originalX, 'capture detaches the active goal'); record.moveGoalPoint.x = originalX;
      if (record.queuedWaypoints.length) {
        const point = record.queuedWaypoints[0].point, requested = point.requestedX; point.requestedX++;
        assert.equal(u.queuedWaypoints[0].point.requestedX, requested); point.requestedX = requested;
      }
      r.restore(saved); u = r.units[id]; arrive(r, u);
      assert.deepEqual([u.x, u.z], [-4.61, 5.23]);
      assert.equal(u.generation, record.generation); assert.equal(u.queuedWaypoints.length, 0);
      r.order(team, { type: 'stop', ids: [id], unitGenerations: [u.generation] });
      const stopped = [u.x, u.z]; for (let tick = 0; tick < 20; tick++) r.step();
      assert.deepEqual([u.x, u.z], stopped); assert.equal(activeMoveGoalPoint(u), null);
      move(r, u, 7.19, 2.83); move(r, u, -5.17, 3.41); arrive(r, u);
      assert.deepEqual([u.x, u.z], [-5.17, 3.41], 'replacement supersedes the prior endpoint');
    } finally { await f.dispose(); }
  });

for (const team of [0, 1]) test(`seat ${team}: blocked endpoint reprojects while retaining requested intent`, async () => {
  const f = await createPathingReplayFixture(map), r = f.replay;
  try {
    quiet(r); const u = r.units.find(u => u.team === team && u.kind === 'infantry');
    Object.assign(u, { x: -8.27, z: -.19 }); r.step(); move(r, u, .31, .27);
    const builder = r.units.find(u => u.team === team && u.kind === 'worker');
    const notices = r.order(team, { type: 'build', ids: [builder.id], buildingType: 'house', x: .5, z: .5 });
    r.drain(); assert.ok(notices.some(n => /^BUILD ORDER/.test(n.message)));
    assert.deepEqual([u.moveGoalPoint.requestedX, u.moveGoalPoint.requestedZ], [.31, .27]);
    const projected = r.point(u.moveGoalCell);
    assert.deepEqual([u.moveGoalPoint.x, u.moveGoalPoint.z], [projected.x, projected.z]);
    assert.ok(r.isWalkable(u.moveGoalCell)); arrive(r, u);
    assert.deepEqual([u.x, u.z], [projected.x, projected.z]);
  } finally { await f.dispose(); }
});

for (const team of [0, 1]) test(`seat ${team}: unsafe exact-point shortcut retains the safe center approach`, async () => {
  const scene = { ...map, obstacles: [{ column: 31, row: 24, width: 1, height: 1, material: 'stone' }] };
  const f = await createPathingReplayFixture(scene), r = f.replay;
  try {
    quiet(r); const u = r.units.find(u => u.team === team && u.kind === 'infantry');
    Object.assign(u, { x: -2.5, z: -.5 }); r.step(); move(r, u, 4.01, .99);
    assert.ok(u.path.length > 1, 'a center-only ray that grazes the stone must retain legal cardinal legs');
    arrive(r, u); assert.deepEqual([u.x, u.z], [4.01, .99]);
  } finally { await f.dispose(); }
});

for (const team of [0, 1]) test(`seat ${team}: raised final cell retains its weighted approach then reaches the fractional point`, async () => {
  const scene = { ...map, elevationPatches: [{ column: 36, row: 24, width: 1, height: 1, level: 1 }] };
  const f = await createPathingReplayFixture(scene), r = f.replay;
  try {
    quiet(r); const u = r.units.find(u => u.team === team && u.kind === 'infantry');
    Object.assign(u, { x: -2.5, z: -.5 }); r.step(); move(r, u, 4.01, .99);
    assert.ok(u.path.length > 2, 'weighted routing is retained');
    assert.equal(u.path.at(-1), u.path.at(-2), 'the raised goal center precedes its fractional leg');
    assert.equal(u.path.at(-1), u.moveGoalCell); arrive(r, u);
    assert.deepEqual([u.x, u.z], [4.01, .99]);
  } finally { await f.dispose(); }
});

test('finite off-map clicks retain requested intent and clamp arrival to existing map bounds', async () => {
  const f = await createPathingReplayFixture(map), r = f.replay;
  try {
    quiet(r); const u = r.units.find(u => u.team === 0 && u.kind === 'infantry');
    Object.assign(u, { x: 23.11, z: 15.27 }); r.step(); move(r, u, 1000.31, 999.27);
    assert.deepEqual([u.moveGoalPoint.requestedX, u.moveGoalPoint.requestedZ], [1000.31, 999.27]);
    assert.deepEqual([u.moveGoalPoint.x, u.moveGoalPoint.z], [31.5, 23.5]);
    assert.ok(r.validate(r.checkpoint())); arrive(r, u);
    assert.deepEqual([u.x, u.z], [31.5, 23.5]);
  } finally { await f.dispose(); }
});

test('versioned goal payloads reject malformed/foreign identities and old saves retain center semantics', async () => {
  const f = await createPathingReplayFixture(map), r = f.replay;
  try {
    quiet(r); const u = r.units.find(u => u.team === 0 && u.kind === 'infantry');
    move(r, u, 7.31, 4.77); move(r, u, -4.61, 5.23, true);
    const saved = r.checkpoint();
    for (const mutate of [p => p.version++, p => p.generation++, p => p.revision++, p => p.cell++,
      p => p.x = Infinity, p => p.x += .01, p => p.requestedZ = NaN, p => p.extra = 1,
      p => p.clearanceProfile = 'unknown', p => p.arrivalPolicy = 'unknown']) {
      const invalid = structuredClone(saved); mutate(invalid.state.units[u.id].moveGoalPoint);
      assert.throws(() => r.validate(invalid), /invalid unit route/);
    }
    for (const mutate of [p => p.version++, p => p.generation++, p => p.cell++, p => p.x = NaN,
      p => p.clearanceProfile = 'unknown', p => p.arrivalPolicy = 'unknown']) {
      const invalid = structuredClone(saved); mutate(invalid.state.units[u.id].queuedWaypoints[0].point);
      assert.throws(() => r.validate(invalid), /invalid unit route/);
    }
    const legacy = structuredClone(saved); delete legacy.state.units[u.id].moveGoalPoint;
    delete legacy.state.units[u.id].queuedWaypoints[0].point;
    assert.ok(r.validate(legacy)); r.restore(legacy); const old = r.units[u.id];
    for (let tick = 0; tick < 1800 && (old.movePlanningPending || old.pathIndex < old.path.length || old.queuedWaypoints.length); tick++) r.step();
    const center = r.point(old.moveGoalCell);
    assert.deepEqual([old.x, old.z], [center.x, center.z]);
    assert.equal(old.moveGoalPoint, null);
  } finally { await f.dispose(); }
});

for (const team of [0, 1]) for (const [kind, radius] of Object.entries(LAND_CLEARANCE_PROFILE.radiusByKind))
test(`seat ${team} ${kind}: real Move projects an unsafe circle, recovers the queue and keeps every admitted sweep clear`, async () => {
  const scene = { ...map, obstacles: [{ column: 31, row: 24, width: 1, height: 1, material: 'stone' }] };
  const f = await createPathingReplayFixture(scene, { traceLandSteps: true }), r = f.replay;
  try {
    quiet(r); let u = r.units.find(u => u.team === team && u.kind === (kind === 'worker' ? 'worker' : 'infantry'));
    Object.assign(u, { kind, hp: UNIT_DEFINITIONS[kind].combat.maxHp, x: .85, z: .65 }); r.step();
    move(r, u, .001, .001, false, false); move(r, u, 6.31, 3.77, true, false);
    assert.equal(u.moveGoalPoint.version, 2); assert.equal(u.moveGoalPoint.clearanceProfile, LAND_CLEARANCE_PROFILE.id);
    assert.equal(u.moveGoalPoint.arrivalPolicy, 'cell-inset'); assert.deepEqual([u.moveGoalPoint.x, u.moveGoalPoint.z], [radius, radius]);
    const id = u.id, generation = u.generation, saved = r.checkpoint(); assert.ok(r.validate(saved)); r.restore(saved); u = r.units[id];
    let handoff = false;
    for (let tick = 0; tick < 1800; tick++) {
      const queued = u.queuedWaypoints.length; r.step(); assert.equal(u.generation, generation);
      for (const step of r.landSteps.filter(s => s.id === id))
        assert.ok(canTraverseStaticBodySegment(step.from, step.to, radius, map.width, map.height, r.isWalkable));
      if (queued && !u.queuedWaypoints.length) {
        assert.deepEqual([u.x, u.z], [radius, radius]); handoff = true;
      }
      if (!u.movePlanningPending && !u.queuedWaypoints.length && u.pathIndex === u.path.length) break;
    }
    assert.ok(handoff); assert.deepEqual([u.x, u.z], [6.31, 3.77]);
    assert.equal(u.hp, UNIT_DEFINITIONS[kind].combat.maxHp);
    assert.ok(r.validate(r.checkpoint()));
  } finally { await f.dispose(); }
});

test('legacy v1 exact point remains readable and an overlapping final approach repairs into explicit v2 clearance', async () => {
  const scene = { ...map, obstacles: [{ column: 31, row: 24, width: 1, height: 1, material: 'stone' }] };
  const f = await createPathingReplayFixture(scene, { traceLandSteps: true }), r = f.replay;
  try {
    quiet(r); let u = r.units.find(u => u.team === 0 && u.kind === 'infantry');
    Object.assign(u, { x: .85, z: .65 }); r.step(); move(r, u, .001, .001);
    const saved = r.checkpoint(), record = saved.state.units[u.id];
    record.moveGoalPoint = createMoveGoalPoint(record, .001, .001, record.moveGoalCell, map.width, map.height);
    assert.ok(r.validate(saved)); r.restore(saved); u = r.units[u.id]; assert.equal(u.moveGoalPoint.version, 1);
    let upgraded = false;
    for (let tick = 0; tick < 1800; tick++) {
      r.step(); upgraded ||= u.moveGoalPoint?.version === 2;
      for (const s of r.landSteps.filter(s => s.id === u.id))
        assert.ok(canTraverseStaticBodySegment(s.from, s.to, .22, map.width, map.height, r.isWalkable));
      if (!u.movePlanningPending && u.pathIndex === u.path.length) break;
    }
    assert.ok(upgraded); assert.deepEqual([u.x, u.z], [.22, .22]);
    assert.deepEqual([u.moveGoalPoint.requestedX, u.moveGoalPoint.requestedZ], [.001, .001]);
  } finally { await f.dispose(); }
});

for (const team of [0, 1]) test(`seat ${team}: a paid adjacent wall changes clearance and repair preserves the requested point/queue`, async () => {
  const f = await createPathingReplayFixture(map, { traceLandSteps: true }), r = f.replay;
  try {
    quiet(r); const u = r.units.find(u => u.team === team && u.kind === 'infantry');
    Object.assign(u, { x: 8.85, z: .65 }); r.step(); move(r, u, .001, .001); move(r, u, 6.31, 3.77, true);
    assert.equal(u.moveGoalPoint.arrivalPolicy, 'exact');
    for (let tick = 0; tick < 10; tick++) r.step();
    const worker = r.units.find(u => u.team === team && u.kind === 'worker'), wood = r.wood[team];
    const notices = r.order(team, { type: 'build', ids: [worker.id], unitGenerations: [worker.generation],
      buildingType: 'palisade-wall', x: -.5, z: .5 }); r.drain();
    assert.ok(notices.some(n => /WALL BUILD ORDER/.test(n.message)), JSON.stringify(notices));
    assert.ok(r.wood[team] < wood); assert.equal(r.isWalkable(1567), false);
    let projected = false, handedOff = false;
    for (let tick = 0; tick < 1800; tick++) {
      const queued = u.queuedWaypoints.length; r.step();
      for (const s of r.landSteps.filter(s => s.id === u.id))
        assert.ok(canTraverseStaticBodySegment(s.from, s.to, .22, map.width, map.height, r.isWalkable));
      if (u.moveGoalPoint?.arrivalPolicy === 'cell-inset') {
        projected = true; assert.deepEqual([u.moveGoalPoint.requestedX, u.moveGoalPoint.requestedZ], [.001, .001]);
      }
      if (queued && !u.queuedWaypoints.length) { handedOff = true; assert.deepEqual([u.x, u.z], [.22, .22]); }
      if (!u.movePlanningPending && !u.queuedWaypoints.length && u.pathIndex === u.path.length) break;
    }
    assert.ok(projected && handedOff); assert.deepEqual([u.x, u.z], [6.31, 3.77]);
    assert.equal(u.hp, UNIT_DEFINITIONS.infantry.combat.maxHp); assert.ok(r.validate(r.checkpoint()));
  } finally { await f.dispose(); }
});

for (const team of [0, 1]) test(`seat ${team}: an old overlapped pose escapes through real Move without deeper penetration or lost intent`, async () => {
  const scene = { ...map, obstacles: [{ column: 31, row: 24, width: 1, height: 1, material: 'stone' }] };
  const f = await createPathingReplayFixture(scene, { traceLandSteps: true }), r = f.replay;
  try {
    quiet(r); let u = r.units.find(u => u.team === team && u.kind === 'infantry');
    Object.assign(u, { x: .001, z: .001 }); const id = u.id;
    const old = r.checkpoint(); assert.ok(r.validate(old)); r.restore(old); u = r.units[id];
    move(r, u, .001, .001); const revision = u.orderRevision; let observedEscape = false;
    for (let tick = 0; tick < 90 && (u.movePlanningPending || u.pathIndex < u.path.length); tick++) {
      r.step();
      for (const s of r.landSteps.filter(s => s.id === id)) {
        assert.ok(canTraverseStaticBodySegment(s.from, s.to, .22, map.width, map.height, r.isWalkable, { allowEscape: true }));
        if (!canTraverseStaticBodySegment(s.from, s.to, .22, map.width, map.height, r.isWalkable)) {
          observedEscape = true;
          assert.ok(s.to.x >= s.from.x, 'the inherited left-wall overlap never gets deeper during escape');
        }
      }
    }
    assert.ok(observedEscape); assert.deepEqual([u.x, u.z], [.22, .22]);
    assert.equal(u.orderRevision, revision, 'escape does not manufacture replacement orders or a repair loop');
    assert.deepEqual([u.moveGoalPoint.requestedX, u.moveGoalPoint.requestedZ], [.001, .001]);
  } finally { await f.dispose(); }
});

for (const team of [0, 1]) test(`seat ${team}: native accepted v2 queued projection survives real process restart`, async () => {
  const f = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 30000 });
  let clients, tokens, token = 6100;
  const connect = async () => {
    await f.start(); clients = [await f.connect(0, tokens?.[0]), await f.connect(1, tokens?.[1])];
    tokens ??= clients.map(c => c.welcome.player.sessionToken);
  };
  const command = (value, expression) => clients[team].command({ ...value, clientOrderToken: token++ }, expression);
  try {
    await connect(); const scene = { ...map, id: `native-static-clearance-${team}`, fogOfWar: false,
      obstacles: [{ column: 31, row: 24, width: 1, height: 1, material: 'stone' }] };
    const after = clients[0].messages.length; clients[0].send({ type: 'publishMap', map: scene });
    await clients[0].wait(m => m.type === 'mapChange' && m.state.mapId === scene.id, 'native clearance map', after);
    const initial = await f.checkpoint(s => s.mapDefinition.id === scene.id);
    const actor = initial.state.units.find(u => u.team === team && u.kind === 'infantry'), id = actor.id, generation = actor.generation;
    await command({ type: 'setStance', ids: [id], unitGenerations: [generation], stance: 'noAttack' }, /STANCE/);
    await command({ type: 'stop', ids: [id], unitGenerations: [generation] }, /STOP/);
    await f.stop(); const placed = JSON.parse(await readFile(f.checkpointPath, 'utf8'));
    Object.assign(placed.state.units[id], { x: .85, z: .65 }); // Trusted setup; actual startup validates it.
    await writeFile(f.checkpointPath, JSON.stringify(placed)); await connect();
    await command({ type: 'move', ids: [id], unitGenerations: [generation], x: 8.31, z: 4.77 }, /MOVE ORDER/);
    await command({ type: 'move', ids: [id], unitGenerations: [generation], x: .001, z: .001, queue: true }, /WAYPOINT QUEUED/);
    const pending = await f.checkpoint(s => s.state.units[id].queuedWaypoints.length === 1);
    assert.equal(pending.state.units[id].moveGoalPoint.version, 2);
    assert.equal(pending.state.units[id].queuedWaypoints[0].point.arrivalPolicy, 'cell-inset');
    await f.stop(); await connect();
    const finished = await f.checkpoint(s => {
      const u = s.state.units[id];
      return u.queuedWaypoints.length === 0 && !u.movePlanningPending && u.pathIndex === u.path.length
        && u.x === .22 && u.z === .22;
    });
    const u = finished.state.units[id]; assert.equal(u.generation, generation);
    assert.deepEqual([u.moveGoalPoint.requestedX, u.moveGoalPoint.requestedZ], [.001, .001]);
    assert.equal(u.moveGoalPoint.clearanceProfile, LAND_CLEARANCE_PROFILE.id);
    assert.equal(u.hp, actor.hp); assert.ok(finished.state.tickNumber >= pending.state.tickNumber);
    const visible = await clients[team].state(s => s.units.some(row => row[0] === id && row[2] === .22 && row[3] === .22), 'native projected arrival');
    assert.equal(visible.units.find(row => row[0] === id)[8], generation);
  } finally { await f.dispose(); }
});
