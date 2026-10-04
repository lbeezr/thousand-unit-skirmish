import assert from 'node:assert/strict';
import test from 'node:test';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { activeMoveGoalPoint, canTraverseUnitStep } from '../src/unit-movement.mjs';

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
test(`seat ${team}: crowded fractional corner ${queued ? 'queued' : 'ordinary'} arrival stays legal ${restore ? 'with pending repair recovery' : 'through repair'}`, async () => {
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
    r.step(); move(r, u, .001, .001);
    assert.deepEqual(u.path, [1568]);
    if (queued) move(r, u, 5.23, 4.71, true);
    const initialRevision = u.orderRevision;
    let sawRepair = false, finished = false, recovered = false;
    for (let tick = 0; tick < 1800 && !finished; tick++) {
      const before = { x: u.x, z: u.z, cell: r.cell(u.x, u.z) }, hp = u.hp;
      r.step();
      assert.ok(canTraverseUnitStep(before.cell, r.cell(u.x, u.z), map.width, r.levels, r.isWalkable),
        `actual terminal step ${JSON.stringify(before)} -> (${u.x},${u.z})`);
      assert.equal(u.hp, hp);
      if (u.orderRevision > initialRevision && u.moveGoalPoint.requestedX === .001) {
        sawRepair = true;
        assert.deepEqual([u.moveGoalPoint.requestedX, u.moveGoalPoint.requestedZ], [.001, .001]);
        if (queued) assert.deepEqual([u.queuedWaypoints[0].point.requestedX, u.queuedWaypoints[0].point.requestedZ], [5.23, 4.71]);
        if (restore && !recovered && u.movePlanningPending) {
          const saved = r.checkpoint(); assert.ok(r.validate(saved)); r.restore(saved);
          u = r.units[id]; parked = parkedIds.map(id => r.units[id]); recovered = true;
          assert.deepEqual([u.moveGoalPoint.requestedX, u.moveGoalPoint.requestedZ], [.001, .001]);
        }
      }
      if (queued ? !u.queuedWaypoints.length : !u.movePlanningPending && u.pathIndex === u.path.length) {
        finished = true;
        assert.deepEqual([u.x, u.z], [.001, .001], 'repair must finish the point before completion or queue handoff');
      }
    }
    assert.ok(sawRepair, 'the unsafe terminal step enters the existing route repair');
    assert.ok(finished, 'refusing the snap cannot strand the order');
    if (restore) assert.ok(recovered, 'capture witnesses the pending repair');
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
    assert.equal(u.path.length, 2); assert.equal(u.path[0], u.path[1]);
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
      p => p.x = Infinity, p => p.x += .01, p => p.requestedZ = NaN, p => p.extra = 1]) {
      const invalid = structuredClone(saved); mutate(invalid.state.units[u.id].moveGoalPoint);
      assert.throws(() => r.validate(invalid), /invalid unit route/);
    }
    for (const mutate of [p => p.version++, p => p.generation++, p => p.cell++, p => p.x = NaN]) {
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
