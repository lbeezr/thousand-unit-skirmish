import assert from 'node:assert/strict';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { pathingBaselineMap } from './pathing-baseline-cases.mjs';
import { canTraverseStaticBodySegment, LAND_CLEARANCE_PROFILE } from '../src/unit-movement.mjs';

// Commands and observations only. No pose, route, intent, HP or planner mutation.
export async function constructionEndpointContract({ team, direction, parkOrder = null }) {
  const map = { ...pathingBaselineMap({ group: 4 }), id: 'construction-endpoint-contract', obstacles: [] };
  let fixture = await createPathingReplayFixture(map, { traceLandSteps: true });
  const runtimeServerSha256 = fixture.sourceSha256;
  let r = fixture.replay;
  const commands = [];
  const command = (seat, payload) => {
    commands.push({ tick: r.tick, seat, ...structuredClone(payload) });
    return r.order(seat, payload);
  };
  let substeps = 0;
  let contacts = 0;
  let originalPointReached = false;
  let builderId, soldierId;
  const step = () => {
    r.step();
    for (const s of r.landSteps.filter(s => s.id === builderId || s.id === soldierId)) {
      substeps++;
      if (s.id === soldierId && s.to.x === 4.5 && s.to.z === .5) originalPointReached = true;
      assert.ok(canTraverseStaticBodySegment(s.from, s.to,
        LAND_CLEARANCE_PROFILE.radiusByKind[s.kind], map.width, map.height, r.isWalkable),
      `static contact: ${JSON.stringify(s)}`);
      const other = s.neighbours.find(u => u.id === (s.id === builderId ? soldierId : builderId));
      if (other && Math.hypot(s.to.x - other.x, s.to.z - other.z) < .4 - 1e-9) contacts++;
    }
  };
  const intent = u => ({ goal: u.moveGoalCell, point: structuredClone(u.moveGoalPoint),
    queue: structuredClone(u.queuedWaypoints), generation: u.generation, revision: u.orderRevision });
  try {
    for (const seat of [0, 1]) {
      command(seat, { type: 'stop', ids: r.units.filter(u => u.team === seat).map(u => u.id) });
      command(seat, { type: 'setStance', stance: 'noAttack',
        ids: r.units.filter(u => u.team === seat && u.kind === 'infantry').map(u => u.id) });
    }
    builderId = r.units.find(u => u.team === team && u.kind === 'worker').id;
    soldierId = r.units.find(u => u.team === team && u.kind === 'infantry').id;
    const order = (id, type, fields = {}) => command(team,
      { type, ids: [id], unitGenerations: [r.units[id].generation], ...fields });
    order(builderId, 'move', { x: 2.5, z: .5 });
    order(soldierId, 'move', { x: -20.5, z: .5 }); r.drain();
    for (let n = 0; n < 700 && [builderId, soldierId].some(id => {
      const u = r.units[id]; return u.movePlanningPending || u.pathIndex < u.path.length;
    }); n++) step();
    assert.deepEqual([r.units[builderId].x, r.units[builderId].z,
      r.units[soldierId].x, r.units[soldierId].z], [2.5, .5, -20.5, .5]);
    const untouched = () => r.units.filter(u => u.id !== builderId && u.id !== soldierId)
      .map(u => ({ id: u.id, x: u.x, z: u.z, target: u.buildingTargetId, revision: u.orderRevision }));
    const otherActors = untouched(), hp = r.units.map(u => u.hp), wood = r.wood[team];
    const build = () => {
      order(builderId, 'build', { buildingType: 'house', x: 6.5, z: .5 });
      assert.equal(r.buildings.length, 1, 'the selected Worker admits one paid site');
      assert.equal(r.wood[team], wood - 75);
      assert.equal(r.units[builderId].buildingTargetId, r.buildings[0].id);
      r.drain();
    };
    const move = () => {
      order(soldierId, 'move', { x: 4.5, z: .5 });
      order(soldierId, 'move', { x: -8.5, z: 8.5, queue: true }); r.drain();
    };
    if (direction === 'military-first') { move(); build(); }
    else {
      assert.equal(direction, 'builder-first'); build();
      for (let n = 0; n < 700 && !r.buildings[0].complete; n++) step();
      assert.ok(r.buildings[0].complete); move();
    }
    const accepted = intent(r.units[soldierId]);
    assert.deepEqual([accepted.point.x, accepted.point.z, accepted.point.arrivalPolicy], [4.5, .5, 'exact']);
    assert.equal(accepted.queue.length, 1);
    for (let n = 0; n < 700; n++) step();
    assert.ok(r.buildings[0].complete);
    assert.deepEqual([r.units[builderId].x, r.units[builderId].z,
      r.units[builderId].buildingTargetId], [4.5, .5, null]);
    if (parkOrder) order(builderId, parkOrder);
    const parked = { x: r.units[builderId].x, z: r.units[builderId].z,
      holding: r.units[builderId].holdingPosition, revision: r.units[builderId].orderRevision };
    const blocked = { tick: r.tick, builder: parked,
      soldier: { x: r.units[soldierId].x, z: r.units[soldierId].z },
      gap: Math.hypot(r.units[soldierId].x - 4.5, r.units[soldierId].z - .5) };
    assert.deepEqual(intent(r.units[soldierId]), accepted, 'occupancy neither arrives nor changes accepted intent');
    assert.ok(blocked.gap >= .4);
    assert.ok(r.units[soldierId].pathIndex < r.units[soldierId].path.length);
    assert.deepEqual(untouched(), otherActors, 'no unselected Worker is recruited or displaced');
    const saved = r.checkpoint(); assert.ok(r.validate(structuredClone(saved)));
    await fixture.dispose();
    fixture = await createPathingReplayFixture(map, { traceLandSteps: true }); r = fixture.replay;
    assert.equal(fixture.sourceSha256, runtimeServerSha256);
    assert.ok(r.validate(structuredClone(saved))); r.restore(structuredClone(saved));
    for (let n = 0; n < 100; n++) step();
    assert.deepEqual(intent(r.units[soldierId]), accepted, 'a separate cold instance retains the blocked exact point and queue');
    assert.deepEqual({ x: r.units[builderId].x, z: r.units[builderId].z,
      holding: r.units[builderId].holdingPosition, revision: r.units[builderId].orderRevision }, parked);
    // Only this accepted, selected-builder command opens the original endpoint.
    order(builderId, 'move', { x: 2.5, z: 8.5 }); r.drain();
    assert.deepEqual(intent(r.units[soldierId]), accepted, 'builder departure does not rewrite military intent');
    let reachedFirst = false;
    for (let n = 0; n < 700; n++) {
      const hadQueue = r.units[soldierId].queuedWaypoints.length > 0;
      step(); const u = r.units[soldierId];
      if (hadQueue && u.queuedWaypoints.length === 0) {
        reachedFirst = true;
        assert.ok(Math.hypot(u.x - 4.5, u.z - .5) <= .12,
          'the queue advances only at the original exact endpoint (at most one tick of onward travel)');
      }
      if (!u.movePlanningPending && u.pathIndex === u.path.length) break;
    }
    const soldier = r.units[soldierId];
    assert.ok(reachedFirst); assert.ok(originalPointReached, 'an admitted physical substep reaches the original exact point');
    assert.equal(soldier.moveGoalCell, accepted.queue[0].destination);
    assert.deepEqual([soldier.x, soldier.z, soldier.queuedWaypoints.length], [-8.5, 8.5, 0]);
    assert.equal(soldier.pathIndex, soldier.path.length);
    assert.equal(contacts, 0); assert.deepEqual(r.units.map(u => u.hp), hp);
    assert.equal(r.wood[team], wood - 75, 'recovery and departure do not repay or refund the completed site');
    assert.deepEqual(untouched(), otherActors);
    return { team, direction, parkOrder, builderId, soldierId, runtimeServerSha256, accepted, blocked,
      completedTick: r.tick, paidWood: 75, substeps, contacts, originalPointReached, commands,
      coldRecovery: 'separate production module', originalQueuedEndpoint: { x: soldier.x, z: soldier.z } };
  } finally { await fixture.dispose(); }
}
