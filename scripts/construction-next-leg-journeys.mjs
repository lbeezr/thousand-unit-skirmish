import assert from 'node:assert/strict';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { constructionMovementActive } from '../src/construction-work-intent.mjs';
import { canTraverseStaticBodySegment, LAND_CLEARANCE_PROFILE } from '../src/unit-movement.mjs';
import { createNextQueuedMilitaryEndpointClaims } from '../src/simulation/movement/military-endpoint-availability.mjs';

// Public-source maps, accepted commands and fresh in-process checkpoints only.
// No actor, destination, queue, route, cost or completion-state injection.
export async function constructionNextLegJourney(team, { cold = 'none', interruption = null } = {}) {
  process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp';
  process.env.RTS_PREGAME = '0'; process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '0';
  delete process.env.RTS_MATCH_STATE_PATH;
  const map = { id: 'construction-next-leg', name: 'Construction next-leg contract', width: 64, height: 48,
    terrainSeed: 881, fogOfWar: false, startingArmySize: 16, startingResources: { food: 500, wood: 500 },
    spawnPoints: [{ team: 0, x: -20, z: -16 }, { team: 1, x: 20, z: 16 }],
    resourceNodes: [], triggers: [], scenarioEvents: [], obstacles: [] };
  let fixture = await createPathingReplayFixture(map, { traceLandSteps: true }), r = fixture.replay;
  try {
    for (const seat of [0, 1]) {
      const own = r.units.filter(u => u.team === seat);
      r.order(seat, { type: 'stop', ids: own.map(u => u.id) });
      r.order(seat, { type: 'setStance', stance: 'noAttack', ids: own.filter(u => u.kind === 'infantry').map(u => u.id) });
    }
    const id = r.units.find(u => u.team === team && u.kind === 'worker').id;
    const armyId = r.units.find(u => u.team === team && u.kind === 'infantry').id;
    const worker = () => r.units[id], army = () => r.units[armyId];
    const order = (actor, type, fields = {}) => {
      const notices = r.order(team, { type, ids: [actor], unitGenerations: [r.units[actor].generation], ...fields });
      assert.ok(notices.length && notices.every(n => !/REJECTED|FAILED/.test(n.message)), JSON.stringify(notices));
      r.drain();
    };
    order(id, 'move', { x: 2.5, z: 1.5 });
    for (let i = 0; i < 700 && worker().pathIndex < worker().path.length; i++) r.step();
    assert.deepEqual({ x: worker().x, z: worker().z }, { x: 2.5, z: 1.5 });
    order(armyId, 'move', { x: -28.5, z: 18.5 });
    order(armyId, 'move', { x: 2.5, z: 1.5, queue: true });
    const queue = structuredClone(army().queuedWaypoints[0]);
    assert.deepEqual(r.point(queue.destination), { x: 2.5, z: 1.5 });
    const beforeWood = r.wood[team];
    order(id, 'buildWall', { points: [{ column: 35, row: 24 }, { column: 35, row: 24 }] });
    assert.equal(r.buildings.length, 1);
    const siteId = r.buildings[0].id, site = () => r.buildings.find(b => b.id === siteId);
    const remembered = structuredClone(worker().workIntent), paidWood = r.wood[team];
    assert.equal(beforeWood - paidWood, 15);
    const otherWorkers = r.units.filter(u => u.kind === 'worker' && u.id !== id).map(u => [u.id,u.orderRevision,u.x,u.z]);
    let recovered = false, steps = 0, completedTick = null, parkedTick = null;
    const restore = async () => {
      const checkpoint = r.checkpoint(); assert.ok(r.validate(structuredClone(checkpoint)));
      await fixture.dispose();
      fixture = await createPathingReplayFixture(map, { traceLandSteps: true }); r = fixture.replay;
      assert.ok(r.validate(structuredClone(checkpoint))); r.restore(structuredClone(checkpoint)); recovered = true;
      assert.deepEqual(worker().workIntent, remembered);
      assert.deepEqual(army().queuedWaypoints[0], queue);
      assert.equal(worker().buildingTargetId, siteId); assert.equal(r.wood[team], paidWood);
    };
    if (cold === 'working') await restore();
    const step = () => {
      const active = constructionMovementActive(worker()); r.step();
      if (active) for (const s of r.landSteps.filter(s => s.id === id)) {
        steps++;
        assert.ok(canTraverseStaticBodySegment(s.from, s.to, LAND_CLEARANCE_PROFILE.radiusByKind.worker,
          map.width, map.height, r.isWalkable), `unsafe completed-job egress ${s.reason}`);
      }
      assert.equal(r.wood[team], paidWood, 'completion/egress/recovery never repays or refunds');
      assert.deepEqual(r.units.filter(u => u.kind === 'worker' && u.id !== id)
        .map(u => [u.id,u.orderRevision,u.x,u.z]), otherWorkers, 'selected Worker only');
    };
    while (!site().complete && r.tick < 1200) step();
    assert.ok(site().complete); completedTick = r.tick;
    assert.equal(worker().buildingTargetId, siteId, 'last completed site still owns active egress');
    assert.deepEqual(worker().workIntent, remembered);
    assert.equal(army().queuedWaypoints[0].destination, queue.destination, 'claim precedes completion');
    const scope = Object.freeze({ tick: r.tick, navigationRevision: r.navigationRevision, epoch: 0 });
    const claims = createNextQueuedMilitaryEndpointClaims({ units: r.units, width: map.width, height: map.height,
      maxUnits: 2000, maxQueuedWaypoints: 8, isWalkable: r.isWalkable, scope });
    try { assert.equal(claims.check({ scope, team, position: worker(), radius: .18 }).status, 'claimed'); }
    finally { claims.close(); }
    if (cold === 'completed') await restore();
    if (cold === 'egress' || interruption) {
      step(); step(); assert.ok(worker().pathIndex < worker().path.length || worker().movePlanningPending);
      if (cold === 'egress') await restore();
    }
    if (interruption) {
      order(id, interruption === 'queuedMove' ? 'move' : interruption,
        interruption === 'queuedMove' ? { x: 8.5, z: 8.5, queue: true } : {});
      const revision = worker().orderRevision;
      assert.equal(worker().buildingTargetId, null); assert.equal(worker().workIntent, null);
      const checkpoint = r.checkpoint(); assert.ok(r.validate(structuredClone(checkpoint)));
      await fixture.dispose();
      fixture = await createPathingReplayFixture(map, { traceLandSteps: true }); r = fixture.replay;
      assert.ok(r.validate(structuredClone(checkpoint))); r.restore(structuredClone(checkpoint));
      for (let i = 0; i < 180; i++) step();
      assert.equal(worker().orderRevision, revision, 'superseded parking retry never replaces the new order');
      assert.equal(worker().buildingTargetId, null); assert.equal(worker().workIntent, null);
      assert.ok(site().complete, 'completed paid footprint survives replacement');
      if (interruption === 'queuedMove') assert.deepEqual({ x: worker().x, z: worker().z }, { x: 8.5, z: 8.5 });
      return { team, cold, interruption, completedTick, steps, paidWood: beforeWood - paidWood };
    }
    while ((worker().buildingTargetId !== null || worker().workIntent || worker().wallBuildOrder) && r.tick < completedTick + 180) step();
    assert.equal(worker().buildingTargetId, null); assert.equal(worker().workIntent, null); assert.equal(worker().wallBuildOrder, null);
    assert.ok(steps > 0, 'own executor actually admitted the completion egress'); parkedTick = r.tick;
    const parked = { x: worker().x, z: worker().z, revision: worker().orderRevision };
    assert.ok(Math.hypot(parked.x - 2.5, parked.z - 1.5) >= .4);
    while (r.tick < completedTick + 1000) {
      step(); assert.deepEqual({ x: worker().x, z: worker().z, revision: worker().orderRevision }, parked,
        'later military activation never shoves the idle builder');
      if (army().queuedWaypoints.length) assert.deepEqual(army().queuedWaypoints[0], queue);
      else assert.equal(army().moveGoalCell, queue.destination);
    }
    assert.equal(army().queuedWaypoints.length, 0);
    assert.deepEqual({ x: army().x, z: army().z }, { x: 2.5, z: 1.5 });
    assert.equal(recovered, cold !== 'none');
    return { team, cold, completedTick, parkedTick, parked, steps, paidWood: beforeWood - paidWood,
      exactReturn: queue.destination, militaryArrived: true };
  } finally { await fixture.dispose(); }
}

export async function constructionNextLegRepairJourney(team, { cold = false } = {}) {
  process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp';
  process.env.RTS_PREGAME = '0'; process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '0';
  delete process.env.RTS_MATCH_STATE_PATH;
  const map = { id: 'repair-next-leg', name: 'Repair next-leg egress', width: 64, height: 48,
    terrainSeed: 881, fogOfWar: false, startingArmySize: 40, startingResources: { food: 500, wood: 500 },
    spawnPoints: [{ team: 0, x: -20, z: -16 }, { team: 1, x: 20, z: 16 }],
    resourceNodes: [], triggers: [], scenarioEvents: [], obstacles: [] };
  let f = await createPathingReplayFixture(map, { traceLandSteps: true }), r = f.replay;
  try {
    for (const seat of [0, 1]) {
      const own = r.units.filter(u => u.team === seat);
      r.order(seat, { type: 'stop', ids: own.map(u => u.id) });
      r.order(seat, { type: 'setStance', stance: 'noAttack', ids: own.filter(u => u.kind === 'infantry').map(u => u.id) });
    }
    const id = r.units.find(u => u.team === team && u.kind === 'worker').id;
    const enemy = r.units.find(u => u.team !== team && u.kind === 'infantry').id;
    const army = r.units.filter(u => u.team === team && u.kind === 'infantry');
    const worker = () => r.units[id];
    const order = (seat, actor, type, fields = {}) => {
      const notices = r.order(seat, { type, ids: [actor], unitGenerations: [r.units[actor].generation], ...fields });
      assert.ok(notices.length && notices.every(n => !/REJECTED|FAILED/.test(n.message)), JSON.stringify(notices)); r.drain();
    };
    order(team, id, 'move', { x: 2.5, z: 1.5 });
    for (let n = 0; n < 700 && worker().pathIndex < worker().path.length; n++) r.step();
    order(team, id, 'buildWall', { points: [{ column: 35, row: 24 }, { column: 35, row: 24 }] });
    const siteId = r.buildings[0].id, site = () => r.buildings.find(b => b.id === siteId);
    for (let n = 0; n < 700 && (!site().complete || worker().buildingTargetId !== null); n++) r.step();
    assert.ok(site().complete); assert.equal(worker().buildingTargetId, null);
    order(1 - team, enemy, 'attackBuilding', { buildingId: siteId });
    for (let n = 0; n < 700 && site().hp === 300; n++) r.step();
    assert.ok(site().hp < 300, 'real enemy command produces repair work');
    order(1 - team, enemy, 'stop'); order(1 - team, enemy, 'move', { x: 26.5, z: -20.5 });
    let i = 0;
    const queued = [];
    // Claim every radius-one candidate around the productive pose. The existing
    // radius-eight selector must choose its own escape outside repair reach.
    for (let z = .5; z <= 2.5; z++) for (let x = 1.5; x <= 3.5; x++) {
      if (x === 3.5 && z === .5) continue; // Paid footprint, not a walkable claim.
      const actor = army[i++];
      order(team, actor.id, 'move', { x: -28.5, z: 18.5 });
      order(team, actor.id, 'move', { x, z, queue: true });
      queued.push([actor.id, structuredClone(r.units[actor.id].queuedWaypoints[0])]);
    }
    const hp = site().hp, wood = r.wood[team];
    order(team, id, 'repairBuilding', { buildingId: siteId });
    for (let n = 0; n < 180 && site().hp < 300; n++) r.step();
    assert.equal(site().hp, 300); assert.equal(worker().buildingTargetId, siteId);
    assert.equal(worker().repairing, true);
    const expectedCost = (300 - hp) / 300 * 10;
    assert.ok(Math.abs(wood - r.wood[team] - expectedCost) < 1e-9);
    const paidWood = r.wood[team];
    if (cold) {
      const checkpoint = r.checkpoint(); assert.ok(r.validate(structuredClone(checkpoint)));
      await f.dispose(); f = await createPathingReplayFixture(map, { traceLandSteps: true }); r = f.replay;
      assert.ok(r.validate(structuredClone(checkpoint))); r.restore(structuredClone(checkpoint));
      assert.equal(worker().repairing, true);
    }
    let outsideReach = false, steps = 0;
    for (let n = 0; n < 180 && worker().buildingTargetId !== null; n++) {
      r.step(); outsideReach ||= r.buildingDistance(worker(), siteId) > 1.4;
      for (const s of r.landSteps.filter(s => s.id === id)) {
        steps++; assert.ok(canTraverseStaticBodySegment(s.from, s.to, .18, map.width, map.height, r.isWalkable));
      }
      assert.equal(r.wood[team], paidWood, 'full repair egress charges no extra wood');
      for (const [actorId, accepted] of queued) assert.deepEqual(r.units[actorId].queuedWaypoints[0], accepted);
    }
    assert.ok(outsideReach && steps > 0, 'actual executor leaves repair reach');
    assert.equal(worker().buildingTargetId, null, 'full repair completion must clear outside work reach');
    assert.equal(worker().repairing, false);
    assert.ok(r.validate(structuredClone(r.checkpoint())));
  } finally { await f.dispose(); }
}
