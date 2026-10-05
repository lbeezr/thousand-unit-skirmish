import assert from 'node:assert/strict';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { pathingBaselineMap } from './pathing-baseline-cases.mjs';
import { createOrdinaryMilitaryEndpointAvailability } from '../src/simulation/movement/military-endpoint-availability.mjs';
import { canTraverseStaticBodySegment, LAND_CLEARANCE_PROFILE } from '../src/unit-movement.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';

const accessPoints = [];
for (let z = -1.5; z <= 2.5; z++) for (let x = 4.5; x <= 8.5; x++) {
  if (z === -1.5 || z === 2.5 || x === 4.5 || x === 8.5) accessPoints.push({ x, z });
}

export async function constructionWorkPoseJourney(team, { cold = false, cooperative = false } = {}) {
  process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp'; process.env.RTS_PREGAME = '0';
  process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '0'; delete process.env.RTS_MATCH_STATE_PATH;
  const map = { ...pathingBaselineMap({ group: 4 }), id: 'construction-work-pose', obstacles: [] };
  let f = await createPathingReplayFixture(map, { traceLandSteps: true }), r = f.replay;
  const workers = r.units.filter(u => u.team === team && u.kind === 'worker').map(u => u.id);
  const first = workers[0], id = cooperative ? workers[1] : first;
  const soldierId = r.units.find(u => u.team === team && u.kind === 'infantry').id;
  const commands = []; let deniedTicks = 0, substeps = 0;
  const order = (actor, type, fields = {}) => {
    const command = { type, ids: [actor], unitGenerations: [r.units[actor].generation], ...fields };
    commands.push({ team, tick: r.tick, ...command }); return r.order(team, command);
  };
  const step = () => {
    r.step();
    for (const s of r.landSteps.filter(s => s.id === id)) {
      substeps++;
      assert.ok(canTraverseStaticBodySegment(s.from, s.to, .18, map.width, map.height, r.isWalkable));
    }
  };
  try {
    for (const seat of [0, 1]) {
      r.order(seat, { type: 'stop', ids: r.units.filter(u => u.team === seat).map(u => u.id) });
      r.order(seat, { type: 'setStance', stance: 'noAttack', ids: r.units.filter(u => u.team === seat && u.kind === 'infantry').map(u => u.id) });
    }
    order(first, 'move', { x: 2.5, z: .5 });
    if (cooperative) order(id, 'move', { x: 8.9, z: .5 });
    r.drain();
    for (let n = 0; n < 700 && workers.some(i => r.units[i].pathIndex < r.units[i].path.length); n++) step();
    order(first, 'build', { buildingType: 'house', x: 6.5, z: .5 }); r.drain();
    const siteId = r.buildings[0].id, site = () => r.buildings.find(b => b.id === siteId);
    const threshold = cooperative ? 1 - 1.5 / (30 * BUILDING_DEFINITIONS.house.buildSeconds) : 0;
    for (let n = 0; n < 700 && site().progress <= threshold && !site().complete; n++) step();
    if (cooperative) {
      // Use the last real productive tick, not an injected near-complete site.
      assert.ok(!site().complete && site().progress > .99);
      order(id, 'resumeConstruction', { buildingId: siteId }); r.drain();
    }
    const u = r.units[id], point = { x: u.x, z: u.z };
    assert.ok(r.buildingDistance(u, siteId) <= 1.4); assert.ok(u.pathIndex < u.path.length);
    const originalGoal = u.moveGoalCell, revision = u.orderRevision;
    order(soldierId, 'move', point); r.drain();
    if (cold) {
      const saved = r.checkpoint(); assert.ok(r.validate(structuredClone(saved)));
      await f.dispose(); f = await createPathingReplayFixture(map, { traceLandSteps: true }); r = f.replay;
      assert.ok(r.validate(structuredClone(saved))); r.restore(structuredClone(saved)); r.drain();
    }
    const resumedRevision = r.units[id].orderRevision;
    for (let n = 0; n < 20; n++) {
      const available = createOrdinaryMilitaryEndpointAvailability({ units: r.units, width: map.width, height: map.height, maxUnits: 2000 })
        .check({ team, position: r.units[id], radius: .18 }).status === 'available';
      const progress = site().progress; step();
      if (!available) {
        deniedTicks++;
        if (!cooperative) assert.equal(site().progress, progress, 'a safe assigned access cell cannot authorize unsafe current-pose work');
        if (cooperative && site().complete && Math.hypot(r.units[id].x - point.x, r.units[id].z - point.z) < .4 - 1e-9) {
          assert.equal(r.units[id].buildingTargetId, siteId, 'another builder completing the site cannot silently park this active worker');
        }
      }
      assert.equal(r.units[id].moveGoalCell, originalGoal, 'the existing safe approach is retained');
      assert.equal(r.units[id].orderRevision, resumedRevision);
    }
    assert.ok(deniedTicks > 0);
    for (let n = 0; n < 700 && (!site().complete || r.units[id].buildingTargetId !== null); n++) step();
    assert.ok(site().complete); assert.equal(r.units[id].buildingTargetId, null);
    assert.equal(r.wood[team], 425); assert.ok(Math.hypot(r.units[id].x - point.x, r.units[id].z - point.z) >= .4 - 1e-9);
    assert.ok(r.validate(structuredClone(r.checkpoint())));
    return { team, cold, cooperative, commands, deniedTicks, substeps, originalGoal, revision, resumedRevision,
      originalMilitaryPoint: point, finalWorkerPose: { x: r.units[id].x, z: r.units[id].z } };
  } finally { await f.dispose(); }
}
function orderIntent(u) {
  return { goal: u.moveGoalCell, point: structuredClone(u.moveGoalPoint), revision: u.orderRevision,
    queue: structuredClone(u.queuedWaypoints), generation: u.generation };
}

export async function constructionRepairAccessJourney(team) {
  process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp'; process.env.RTS_PREGAME = '0';
  process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '0'; delete process.env.RTS_MATCH_STATE_PATH;
  const map = { ...pathingBaselineMap({ group: 16 }), id: 'repair-access-journey', obstacles: [] };
  let f = await createPathingReplayFixture(map, { traceLandSteps: true, traceActorIds: [team * 20] }), r = f.replay;
  const id = r.units.find(u => u.team === team && u.kind === 'worker').id;
  const army = r.units.filter(u => u.team === team && u.kind === 'infantry').map(u => u.id);
  const enemy = r.units.find(u => u.team !== team && u.kind === 'infantry').id;
  const commands = []; let repairs = 0;
  const order = (seat, actor, type, fields = {}) => {
    const c = { type, ids: [actor], unitGenerations: [r.units[actor].generation], ...fields };
    commands.push({ tick: r.tick, seat, ...c }); return r.order(seat, c);
  };
  const step = () => {
    r.step(); repairs += r.actorTrace.filter(t => t.id === id && t.type === 'repair').length;
    for (const s of r.landSteps.filter(s => s.id === id)) assert.ok(canTraverseStaticBodySegment(s.from, s.to,
      .18, map.width, map.height, r.isWalkable));
  };
  try {
    for (const seat of [0, 1]) {
      r.order(seat, { type: 'stop', ids: r.units.filter(u => u.team === seat).map(u => u.id) });
      r.order(seat, { type: 'setStance', stance: 'noAttack', ids: r.units.filter(u => u.team === seat && u.kind === 'infantry').map(u => u.id) });
    }
    order(team, id, 'build', { buildingType: 'house', x: 6.5, z: .5 }); r.drain();
    const siteId = r.buildings[0].id, site = () => r.buildings.find(b => b.id === siteId);
    for (let n = 0; n < 1000 && !site().complete; n++) step(); assert.ok(site().complete);
    order(team, id, 'move', { x: 2.5, z: .5 }); r.drain();
    for (let n = 0; n < 200 && r.units[id].pathIndex < r.units[id].path.length; n++) step();
    order(1 - team, enemy, 'attackBuilding', { buildingId: siteId }); r.drain();
    for (let n = 0; n < 700 && site().hp === BUILDING_DEFINITIONS.house.maxHp; n++) step();
    assert.ok(site().hp < BUILDING_DEFINITIONS.house.maxHp, 'a real enemy attack creates repair work');
    order(1 - team, enemy, 'stop');
    accessPoints.forEach((p, i) => order(team, army[i], 'move', p));
    order(team, id, 'repairBuilding', { buildingId: siteId }); r.drain();
    assert.equal(r.units[id].repairing, true); assert.equal(r.units[id].moveGoalCell, -1);
    assert.equal(r.units[id].movePlanningPending, false); assert.equal(r.units[id].workIntent, null);
    const hp = site().hp, wood = r.wood[team], revision = r.units[id].orderRevision, nav = r.navigationRevision;
    const saved = r.checkpoint(); assert.ok(r.validate(structuredClone(saved)));
    await f.dispose(); f = await createPathingReplayFixture(map, { traceLandSteps: true, traceActorIds: [id] }); r = f.replay;
    assert.ok(r.validate(structuredClone(saved))); r.restore(structuredClone(saved)); r.drain();
    for (let n = 0; n < 120; n++) {
      step(); assert.equal(site().hp, hp); assert.equal(r.wood[team], wood);
      assert.equal(r.units[id].buildingTargetId, siteId); assert.equal(r.units[id].repairing, true);
      assert.equal(r.units[id].orderRevision, revision);
    }
    assert.equal(repairs, 0);
    order(team, army[0], 'move', { x: -16.5, z: -8.5 });
    for (let n = 0; n < 300 && r.units[id].repairing; n++) step();
    assert.equal(site().hp, BUILDING_DEFINITIONS.house.maxHp); assert.equal(r.units[id].repairing, false);
    assert.equal(r.units[id].buildingTargetId, null); assert.equal(r.navigationRevision, nav); assert.equal(repairs, 1);
    const expectedCost = (BUILDING_DEFINITIONS.house.maxHp - hp) / BUILDING_DEFINITIONS.house.maxHp
      * Math.max(10, BUILDING_DEFINITIONS.house.cost.wood * .3);
    assert.ok(Math.abs(wood - r.wood[team] - expectedCost) < 1e-9, 'repair charges only HP actually restored, once');
    return { team, commands, hpBeforeRepair: hp, expectedCost, woodAfterRepair: r.wood[team], revision, nav, repairs };
  } finally { await f.dispose(); }
}
export async function constructionAccessJourney(team, scenario, { cold = false, planningTurns = 0 } = {}) {
  process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp'; process.env.RTS_PREGAME = '0';
  process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = String(planningTurns); delete process.env.RTS_MATCH_STATE_PATH;
  const group = scenario === 'query-deferred' ? 80 : 16;
  const map = { ...pathingBaselineMap({ group }), id: 'construction-access-journey', obstacles: [] };
  let fixture = await createPathingReplayFixture(map, { traceLandSteps: true, traceActorIds: [team * (group + 4)] });
  let r = fixture.replay;
  const builderId = r.units.find(u => u.team === team && u.kind === 'worker').id;
  const infantryIds = r.units.filter(u => u.team === team && u.kind === 'infantry').map(u => u.id);
  const commands = [], repairs = [], positions = [];
  let substeps = 0;
  const unit = () => r.units[builderId];
  const command = (seat, type, fields = {}) => {
    commands.push({ tick: r.tick, seat, type, ...structuredClone(fields) });
    return r.order(seat, { type, ...fields });
  };
  const order = (id, type, fields = {}) => command(team, type,
    { ids: [id], unitGenerations: [r.units[id].generation], ...fields });
  const step = () => {
    r.step(); repairs.push(...r.actorTrace.filter(t => t.id === builderId && t.type === 'repair'));
    for (const s of r.landSteps.filter(s => s.id === builderId)) {
      substeps++;
      assert.ok(canTraverseStaticBodySegment(s.from, s.to, LAND_CLEARANCE_PROFILE.radiusByKind.worker,
        map.width, map.height, r.isWalkable), `unsafe builder substep: ${JSON.stringify(s)}`);
    }
  };
  const coldRestore = async () => {
    const saved = r.checkpoint(); assert.ok(r.validate(structuredClone(saved)));
    await fixture.dispose();
    fixture = await createPathingReplayFixture(map, { traceLandSteps: true, traceActorIds: [builderId] });
    r = fixture.replay; assert.ok(r.validate(structuredClone(saved))); r.restore(structuredClone(saved));
  };
  const reserveAccess = () => {
    if (scenario === 'query-deferred') {
      accessPoints.slice(1).forEach((p, i) => order(infantryIds[i], 'move', p));
      infantryIds.slice(15).forEach(id => order(id, 'move', { x: 3.51, z: -.51 }));
    } else accessPoints.forEach((p, i) => order(infantryIds[i], 'move', p));
  };
  try {
    for (const seat of [0, 1]) {
      command(seat, 'stop', { ids: r.units.filter(u => u.team === seat).map(u => u.id) });
      command(seat, 'setStance', { stance: 'noAttack', ids: r.units.filter(u => u.team === seat && u.kind === 'infantry').map(u => u.id) });
    }
    order(builderId, 'move', { x: scenario === 'late-reservation' ? -8.5 : 2.5,
      z: scenario === 'query-deferred' ? -1.5 : .5 }); r.drain();
    for (let n = 0; n < 700 && (unit().movePlanningPending || unit().pathIndex < unit().path.length); n++) step();
    const wood = r.wood[team], initialRevision = unit().orderRevision;
    const otherWorkers = () => r.units.filter(u => u.kind === 'worker' && u.id !== builderId)
      .map(u => ({ id: u.id, x: u.x, z: u.z, target: u.buildingTargetId, revision: u.orderRevision }));
    const untouched = otherWorkers();
    if (scenario !== 'late-reservation') reserveAccess();
    order(builderId, 'build', { buildingType: 'house', x: 6.5, z: .5 });
    assert.equal(r.buildings.length, 1); assert.equal(r.wood[team], wood - 75);
    const siteId = r.buildings[0].id, site = () => r.buildings.find(b => b.id === siteId);
    const savedIntent = structuredClone(unit().workIntent), nav = r.navigationRevision;
    assert.equal(unit().buildingTargetId, siteId); assert.equal(unit().orderRevision, initialRevision + 1);
    if (scenario === 'late-reservation') {
      r.drain(); assert.ok(unit().pathIndex < unit().path.length);
      reserveAccess(); step();
      assert.equal(unit().orderRevision, initialRevision + 2, 'the newly unsafe terminal route is invalidated once');
    }
    assert.equal(unit().moveGoalCell, -1); assert.equal(unit().movePlanningPending, false);
    if (scenario === 'query-deferred') assert.equal(createOrdinaryMilitaryEndpointAvailability({ units: r.units,
      width: map.width, height: map.height, maxUnits: 2000 }).check({ team, position: accessPoints[0], radius: .18 }).status,
    'deferred', '65 accepted neighboring endpoint queries exceed the existing local visit bound');
    assert.deepEqual(unit().path, []); assert.deepEqual(unit().workIntent, savedIntent);
    const acceptedRevision = unit().orderRevision, parkedStart = { x: unit().x, z: unit().z };
    r.drain();
    let military = infantryIds.map(id => orderIntent(r.units[id]));
    if (cold) {
      await coldRestore(); r.drain();
      const resumed = infantryIds.map(id => orderIntent(r.units[id]));
      assert.deepEqual(resumed.map(u => [u.goal, u.queue, u.generation, u.point?.x, u.point?.z]),
        military.map(u => [u.goal, u.queue, u.generation, u.point?.x, u.point?.z]),
      'ordinary cold route rebuilding preserves military endpoints and queued intent');
      military = resumed;
    }
    for (let n = 0; n < 360; n++) {
      step(); assert.equal(unit().orderRevision, acceptedRevision); assert.equal(unit().buildingTargetId, siteId);
      assert.deepEqual(unit().workIntent, savedIntent); assert.equal(unit().movePlanningPending, false);
      assert.deepEqual({ x: unit().x, z: unit().z }, parkedStart);
      assert.equal(site().progress, 0); assert.equal(r.navigationRevision, nav);
      assert.deepEqual(infantryIds.map(id => orderIntent(r.units[id])), military);
    }
    assert.equal(repairs.length, 0, 'occupied access never enters shared route repair or consumes static retries');
    const replace = ['stop', 'holdPosition', 'queuedMove', 'cancelConstruction'].includes(scenario);
    const releasedIds = scenario === 'query-deferred' ? infantryIds.slice(15) : [infantryIds[0]];
    if (replace) {
      if (scenario === 'cancelConstruction') command(team, 'cancelConstruction', { buildingId: siteId });
      else order(builderId, scenario === 'queuedMove' ? 'move' : scenario,
        scenario === 'queuedMove' ? { x: -8.5, z: 8.5, queue: true } : {});
      const revision = unit().orderRevision;
      releasedIds.forEach(id => order(id, 'move', { x: -16.5, z: -8.5 }));
      for (let n = 0; n < 200; n++) step();
      assert.equal(unit().buildingTargetId, null); assert.equal(unit().workIntent, null);
      assert.equal(unit().orderRevision, revision); assert.equal(repairs.length, 0);
      assert.equal(r.wood[team], scenario === 'cancelConstruction' ? wood : wood - 75);
      if (scenario !== 'cancelConstruction') assert.equal(site().progress, 0);
    } else {
      releasedIds.forEach(id => order(id, 'move', { x: -16.5, z: -8.5 }));
      const releasedAt = r.tick;
      for (let n = 0; n < 700 && !site().complete; n++) {
        step(); positions.push({ tick: r.tick, x: unit().x, z: unit().z, progress: site().progress });
      }
      assert.ok(site().complete, 'a released endpoint resumes paid work at unchanged navigation revision');
      assert.equal(r.navigationRevision, nav); assert.equal(r.wood[team], wood - 75);
      const unchangedIndices = infantryIds.map((id, i) => ({ id, i })).filter(({ id }) => !releasedIds.includes(id));
      assert.deepEqual(unchangedIndices.map(({ id }) => orderIntent(r.units[id]))
        .map(u => [u.goal, u.queue, u.generation, u.point?.x, u.point?.z]),
      unchangedIndices.map(({ i }) => military[i]).map(u => [u.goal, u.queue, u.generation, u.point?.x, u.point?.z]),
      'ordinary military route repairs may revise their route, but construction never replaces their endpoints or queue');
      assert.equal(repairs.length, 1, 'one guarded replacement after a safe cell becomes available');
      assert.ok(repairs[0].tick - releasedAt <= 30, 'at most one-second availability recheck');
      const endpoints = createOrdinaryMilitaryEndpointAvailability({ units: r.units, width: map.width, height: map.height, maxUnits: 2000 });
      assert.equal(endpoints.check({ team, position: unit(), radius: .18 }).status, 'available');
    }
    assert.deepEqual(otherWorkers(), untouched, 'only the explicitly selected Worker acts');
    assert.ok(r.validate(structuredClone(r.checkpoint())));
    return { team, scenario, cold, planningTurns, commands, substeps, repairs,
      siteId, savedIntent, nav, acceptedRevision, finalRevision: unit().orderRevision,
      finalPosition: { x: unit().x, z: unit().z }, siteComplete: site()?.complete ?? false, wood: r.wood[team] };
  } finally { await fixture.dispose(); }
}
