import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createUnitRouteResult } from '../src/unit-movement.mjs';
import { workerFlowRouteBindings } from './economy-server-fixture.mjs';
import { activeWallBuildOrder } from '../src/wall-build-order.mjs';
import { isPalisade } from '../src/palisade-gate.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { activeWorkIntent, createConstructionWorkIntent, clearWorkIntent } from '../src/work-intent.mjs';
import { constructionMovementActive, constructionWorkArea, constructionAssignment, unfinishedConstructionSites, validConstructionWorkArea } from '../src/construction-work-intent.mjs';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { canTraverseStaticBodySegment, LAND_CLEARANCE_PROFILE } from '../src/unit-movement.mjs';
import { constructionEndpointContract } from './construction-endpoint-contract.mjs';
import { createOrdinaryMilitaryEndpointAvailability } from '../src/simulation/movement/military-endpoint-availability.mjs';
import { constructionAccessJourney, constructionWorkPoseJourney, constructionRepairAccessJourney } from './construction-access-journeys.mjs';

for (const team of [0, 1]) for (const cold of [false, true]) {
  test(`seat ${team}: actual construction work pose is checked before approach exhaustion, cold=${cold}`, async () => {
    await constructionWorkPoseJourney(team, { cold });
  });
  test(`seat ${team}: cooperative completion retains another builder's safe approach until legal parking, cold=${cold}`, async () => {
    await constructionWorkPoseJourney(team, { cold, cooperative: true });
  });
}

for (const team of [0, 1]) for (const scenario of ['initial-reservation', 'late-reservation']) {
  for (const cold of [false, true]) test(`seat ${team}: ${scenario} retains paid construction, then releases at unchanged navigation, cold=${cold}`, async () => {
    await constructionAccessJourney(team, scenario, { cold });
  });
}
for (const team of [0, 1]) for (const scenario of ['stop', 'holdPosition', 'queuedMove', 'cancelConstruction']) {
  test(`seat ${team}: ${scenario} supersedes dynamically blocked paid work without stale retry`, async () => {
    await constructionAccessJourney(team, scenario, { cold: true });
  });
}
for (const team of [0, 1]) {
  test(`seat ${team}: real repair retains its paid target through occupied access and cold release`, async () => {
    await constructionRepairAccessJourney(team);
  });
  test(`seat ${team}: deferred endpoint availability retains paid work through cold restore and release`, async () => {
    await constructionAccessJourney(team, 'query-deferred', { cold: true });
  });
  test(`seat ${team}: real-tick planning retains blocked construction and resumes its safe replacement`, async () => {
    await constructionAccessJourney(team, 'initial-reservation', { cold: true, planningTurns: 1 });
  });
}

for (const team of [0, 1]) for (const direction of ['military-first', 'builder-first']) {
  test(`seat ${team}: ${direction} ${direction === 'military-first' ? 'prevents a new endpoint conflict' : 'retains the parked builder and blocked exact point'} through cold recovery`, async () => {
    await constructionEndpointContract({ team, direction });
  });
}
for (const team of [0, 1]) for (const parkOrder of ['stop', 'holdPosition']) {
  test(`seat ${team}: builder ${parkOrder} keeps military exact arrival pending until selected departure`, async () => {
    await constructionEndpointContract({ team, direction: 'builder-first', parkOrder });
  });
}

const map = { width: 64, height: 64 };
const wall = (id, x, z = .5, overrides = {}) => ({ id, x, z, type: 'palisade-wall', team: 0, hp: 300, complete: false, ...overrides });
const lookup = sites => new Map(sites.map(site => [site.id, site]));
const intent = sites => ({ version: 1, kind: 'construction', generation: 17,
  siteIds: sites.map(site => site.id), area: constructionWorkArea(sites, map) });

test('construction clearance derives only from the active land Worker build or repair order', () => {
  const worker = { kind: 'worker', hp: 100, movementDomain: 'land', buildingTargetId: 1,
    attackTargetId: -1, attackBuildingTargetId: -1, gatherNodeId: null, gatherForestCell: -1, gatherPhase: '' };
  assert.ok(constructionMovementActive(worker));
  assert.ok(constructionMovementActive({ ...worker, repairing: true }));
  for (const replacement of [{ hp: 0 }, { kind: 'infantry' }, { movementDomain: 'water' },
    { holdingPosition: true }, { attackMove: true }, { stanceCombat: true }, { stanceReturning: true },
    { persistentOrder: { type: 'patrol' } }, { attackTargetId: 2 }, { attackBuildingTargetId: 2 },
    { gatherNodeId: 'berries' }, { gatherForestCell: 17 }, { gatherPhase: 'to-base' },
    { buildingTargetId: null }, { buildingTargetId: -1 }, { buildingTargetId: undefined },
    { buildingTargetId: 1.5 }, { buildingTargetId: '1' }]) {
    assert.equal(constructionMovementActive({ ...worker, ...replacement }), false, JSON.stringify(replacement));
  }
});

// Real command bodies and every admitted physical substep; no injected route or
// alternate planner. Fixed ticks do not stand in for process/browser acceptance.
async function constructionJourney(team, action) {
  process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp';
  process.env.RTS_PREGAME = '0'; process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '0';
  delete process.env.RTS_MATCH_STATE_PATH;
  const definition = { id: 'construction-clearance-journey', name: 'Construction Clearance Journey',
    width: 64, height: 48, terrainSeed: 881, fogOfWar: false, startingArmySize: 16,
    startingResources: { food: 500, wood: 1000 },
    spawnPoints: [{ team: 0, x: -20, z: -16 }, { team: 1, x: 20, z: 16 }],
    resourceNodes: [], triggers: [], scenarioEvents: [],
    obstacles: [{ column: 33, row: 25, width: 1, height: 1, material: 'stone' }] };
  const fixture = await createPathingReplayFixture(definition, { traceLandSteps: true }), r = fixture.replay;
  try {
    for (const seat of [0, 1]) {
      const actors = r.units.filter(u => u.team === seat);
      r.order(seat, { type: 'stop', ids: actors.map(u => u.id) });
      r.order(seat, { type: 'setStance', stance: 'noAttack', ids: actors.filter(u => u.kind !== 'worker').map(u => u.id) });
    }
    const id = r.units.find(u => u.team === team && u.kind === 'worker').id;
    const command = (type, fields = {}) => r.order(team, { type, ids: [id],
      unitGenerations: [r.units[id].generation], ...fields });
    command('move', { x: .79, z: .95 }); r.drain();
    for (let tick = 0; tick < 700 && r.units[id].pathIndex < r.units[id].path.length; tick++) r.step();
    assert.deepEqual({ x: r.units[id].x, z: r.units[id].z }, { x: .79, z: .95 });
    assert.ok(canTraverseStaticBodySegment(r.units[id], r.units[id], LAND_CLEARANCE_PROFILE.radiusByKind.worker,
      definition.width, definition.height, r.isWalkable), 'command-only start is body clear');
    const untouched = r.units.filter(u => u.id !== id).map(u => [u.id, u.orderRevision, u.buildingTargetId]);
    assert.ok(command('build', { buildingType: 'house', x: 6.5, z: .5 }).some(n => /PLANNING BUILD/.test(n.message)));
    const site = r.buildings.find(b => b.team === team), paidWood = r.wood[team];
    assert.ok(site); assert.equal(paidWood, 925);
    const durableIntent = structuredClone(r.units[id].workIntent);
    const step = () => {
      r.step();
      for (const s of r.landSteps.filter(s => s.id === id)) assert.ok(canTraverseStaticBodySegment(s.from, s.to,
        LAND_CLEARANCE_PROFILE.radiusByKind.worker, definition.width, definition.height, r.isWalkable),
      `unsafe construction ${s.reason}: ${JSON.stringify({ from: s.from, to: s.to })}`);
    };
    const explicitlyCommanded = await action({ r, id, siteId: site.id, command, step, durableIntent, paidWood }) ?? [];
    assert.deepEqual(r.units.filter(u => u.id !== id && !explicitlyCommanded.includes(u.id))
      .map(u => [u.id, u.orderRevision, u.buildingTargetId]), untouched.filter(([other]) => !explicitlyCommanded.includes(other)),
      'construction never recruits an unselected Worker or changes another order');
  } finally { await fixture.dispose(); }
}

for (const team of [0, 1]) test(`seat ${team}: a new paid footprint repairs the construction route without replacing remembered work`, async () => {
  await constructionJourney(team, async ({ r, id, siteId, step, durableIntent, paidWood }) => {
    r.drain(); step(); step();
    const other = r.units.find(u => u.team === 1 - team && u.kind === 'worker');
    const beforeNavigation = r.navigationRevision;
    const notices = r.order(other.team, { type: 'build', ids: [other.id], unitGenerations: [other.generation],
      buildingType: 'palisade-wall', x: 2.5, z: .5 });
    assert.ok(notices.some(n => /PLANNING BUILD|PLANNING WALL BUILD/.test(n.message)), JSON.stringify(notices));
    assert.ok(r.navigationRevision > beforeNavigation);
    const saved = r.checkpoint(); assert.ok(r.validate(structuredClone(saved))); r.restore(structuredClone(saved));
    assert.deepEqual(r.units[id].workIntent, durableIntent);
    assert.equal(r.units[id].buildingTargetId, siteId);
    for (let tick = 0; tick < 650 && !r.buildings.find(b => b.id === siteId).complete; tick++) step();
    assert.ok(r.buildings.find(b => b.id === siteId).complete);
    assert.equal(r.wood[team], paidWood, 'repair/recovery never repays the original site');
    return [other.id];
  });
});

for (const team of [0, 1]) for (const recoverAt of ['none', 'pending', 'active', 'working']) {
  test(`seat ${team}: paid construction safely approaches and works through ${recoverAt} recovery`, async () => {
    await constructionJourney(team, async ({ r, id, siteId, step, durableIntent, paidWood }) => {
      if (recoverAt !== 'pending') r.drain();
      if (recoverAt === 'active') { step(); step(); assert.ok(r.units[id].pathIndex < r.units[id].path.length); }
      if (recoverAt === 'working') {
        for (let tick = 0; tick < 100 && !r.buildings.find(b => b.id === siteId).progress; tick++) step();
        assert.ok(r.buildings.find(b => b.id === siteId).progress > 0);
      }
      if (recoverAt !== 'none') {
        const saved = r.checkpoint(); assert.ok(r.validate(structuredClone(saved)));
        r.restore(structuredClone(saved));
        assert.deepEqual(r.units[id].workIntent, durableIntent);
        assert.equal(r.units[id].buildingTargetId, siteId);
        assert.equal(r.wood[team], paidWood, 'recovery never pays twice');
      }
      let receipts = 0;
      for (let tick = 0; tick < 650 && !r.buildings.find(b => b.id === siteId).complete; tick++) {
        const before = r.buildings.find(b => b.id === siteId).progress; step();
        const site = r.buildings.find(b => b.id === siteId);
        if (site.progress > before) {
          receipts++;
          const worker = r.units[id], half = BUILDING_DEFINITIONS[site.type].footprint / 2;
          assert.ok(Math.hypot(Math.max(0, Math.abs(worker.x - site.x) - half),
            Math.max(0, Math.abs(worker.z - site.z) - half)) <= 1.4, 'productive work requires unchanged legal edge reach');
          if (!site.complete) assert.equal(r.snapshot(team).units.find(row => row[0] === id)[17], 'build',
            'receipt describes actual productive work; completion clears the active target');
        }
      }
      assert.ok(r.buildings.find(b => b.id === siteId).complete, 'safe approach must still finish paid work');
      assert.ok(receipts > 0); assert.equal(r.wood[team], paidWood);
      assert.equal(r.units[id].buildingTargetId, null);
    });
  });
}

for (const team of [0, 1]) for (const interruption of ['stop', 'cancelConstruction', 'queuedMove']) {
  test(`seat ${team}: ${interruption} supersedes pending construction without stale work or a second payment`, async () => {
    await constructionJourney(team, async ({ r, id, siteId, command, step, paidWood }) => {
      if (interruption === 'queuedMove') command('move', { x: -3.5, z: -3.5, queue: true });
      else command(interruption, { buildingId: siteId });
      r.drain();
      assert.equal(r.units[id].buildingTargetId, null);
      assert.equal(r.units[id].workIntent, null);
      for (let tick = 0; tick < 10; tick++) step();
      const saved = r.checkpoint(); assert.ok(r.validate(structuredClone(saved))); r.restore(structuredClone(saved));
      for (let tick = 0; tick < 60; tick++) step();
      const site = r.buildings.find(b => b.id === siteId);
      if (interruption === 'cancelConstruction') {
        assert.equal(site, undefined); assert.equal(r.wood[team], 1000, 'unused paid site refunds exactly once');
      } else {
        assert.equal(site.progress, 0); assert.equal(r.wood[team], paidWood, 'interruption retains its paid footprint');
      }
      assert.equal(r.units[id].buildingTargetId, null);
      assert.equal(r.units[id].workIntent, null, 'cold recovery does not silently reacquire superseded work');
    });
  });
}

test('fixed construction area follows all paid footprints plus two world units, clipped to map', () => {
  assert.deepEqual(constructionWorkArea([wall(1, .5), wall(2, 2.5, 1.5)], map),
    { minX: -2, maxX: 5, minZ: -2, maxZ: 4 });
  assert.deepEqual(constructionWorkArea([wall(1, -31.5, 31.5)], map),
    { minX: -32, maxX: -29, minZ: 29, maxZ: 32 });
  assert.deepEqual(constructionWorkArea([wall(1, .5, .5, { type: 'house' })], map),
    { minX: -3, maxX: 4, minZ: -3, maxZ: 4 });
});

test('accepted new line or non-construction job replacement remembers only explicit admitted IDs', () => {
  const prior = intent([wall(1, .5)]), sites = [wall(9, 10.5), wall(8, 11.5)];
  const before = structuredClone(prior);
  for (const current of [prior, { kind: 'gather', anchor: { x: .5, z: .5 } }, null]) {
    assert.deepEqual(constructionAssignment(current, sites, 0, lookup(sites), map),
      { siteIds: [9, 8], area: { minX: 8, maxX: 14, minZ: -2, maxZ: 3 } });
  }
  assert.deepEqual(prior, before);
});

for (const team of [0, 1]) test(`seat ${team}: explicit adjoining gate gets first priority without changing area or recruiting sites`, () => {
  const sites = [wall(1, .5, .5, { team }), wall(2, 1.5, .5, { team }), wall(3, 2.5, .5, { team })];
  const prior = intent(sites), gate = wall(4, 3.5, .5, { team, type: 'palisade-gate' });
  const unrelated = wall(5, 2.5, 1.5, { team });
  const before = structuredClone(prior);
  const result = constructionAssignment(prior, [gate], team, lookup([...sites, gate, unrelated]), map);
  assert.deepEqual(result.siteIds, [4, 1, 2, 3]); assert.deepEqual(result.area, prior.area);
  assert.deepEqual(prior, before); assert.notEqual(result.area, prior.area);
  const repeated = constructionAssignment({ ...prior, siteIds: result.siteIds }, [gate], team, lookup([...sites, gate]), map);
  assert.deepEqual(repeated.siteIds, [4, 1, 2, 3], 'resuming the same priority gate never duplicates a paid identity');
});

test('gate beside a completed original line cell retains remaining remembered walls in the fixed area', () => {
  const sites = [wall(1, .5), wall(2, 1.5), wall(3, 2.5)], prior = intent(sites);
  const gate = wall(4, -.5, .5, { type: 'palisade-gate' });
  const result = constructionAssignment(prior, [gate], 0,
    lookup([{ ...sites[0], complete: true }, sites[1], sites[2], gate]), map);
  assert.deepEqual(result, { siteIds: [4, 2, 3], area: prior.area });
});

test('outside, nonadjoining, foreign adjacency and unrelated House work replace prior construction', () => {
  const site = wall(1, .5), prior = intent([site]);
  for (const gate of [wall(4, 4.5, .5, { type: 'palisade-gate' }), wall(4, .5, 2.5, { type: 'palisade-gate' })]) {
    const result = constructionAssignment(prior, [gate], 0, lookup([site, gate]), map);
    assert.deepEqual(result, { siteIds: [4], area: constructionWorkArea([gate], map) });
  }
  const gate = wall(4, 1.5, .5, { type: 'palisade-gate' }), foreign = { ...site, team: 1 };
  assert.deepEqual(constructionAssignment(prior, [gate], 0, lookup([foreign, gate]), map).siteIds, [4]);
  const detachedGate = wall(4, .5, 2.5, { type: 'palisade-gate' });
  assert.deepEqual(constructionAssignment(prior, [detachedGate], 0,
    lookup([site, detachedGate, wall(5, .5, 1.5)]), map).siteIds, [4], 'an unassigned neighboring wall cannot extend the job');
  const house = wall(1, .5, .5, { type: 'house' }), houseIntent = intent([house]);
  assert.deepEqual(constructionAssignment(houseIntent, [gate], 0, lookup([house, gate, wall(5, 2.5)]), map).siteIds, [4]);
});

test('reacquisition prunes completed, destroyed, foreign, outside and zero-HP IDs; only explicit remembered work survives', () => {
  const sites = [wall(1, .5), wall(2, 1.5), wall(3, 2.5), wall(4, 3.5), wall(5, 4.5)];
  const prior = intent(sites), before = structuredClone(prior);
  const validGate = wall(6, 2.5, .5, { type: 'palisade-gate' });
  const rows = lookup([{ ...sites[0], complete: true }, { ...sites[2], team: 1 }, { ...sites[3], hp: 0 },
    { ...sites[4], x: 20.5 }, validGate, wall(7, .5)]);
  assert.deepEqual(unfinishedConstructionSites({ ...prior, siteIds: [...prior.siteIds, 6] }, 0, rows).map(site => site.id), [6]);
  assert.deepEqual(prior, before); assert.deepEqual(unfinishedConstructionSites({ kind: 'gather' }, 0, rows), []);
});

test('gate priority and pruning preserve the source area through successive completions', () => {
  const sites = [wall(1, .5), wall(2, 1.5)], prior = intent(sites);
  const first = wall(3, 2.5, .5, { type: 'palisade-gate' }), second = wall(4, 3.5, .5, { type: 'palisade-gate' });
  const one = constructionAssignment(prior, [first], 0, lookup([...sites, first]), map);
  const two = constructionAssignment({ ...prior, ...one }, [second], 0, lookup([...sites, { ...first, complete: true }, second]), map);
  assert.deepEqual(two.siteIds, [4, 1, 2]); assert.deepEqual(two.area, prior.area);
  two.area.minX = -32; assert.equal(prior.area.minX, -2, 'each installation gets an independent area copy');
});

test('checkpoint bounds reject malformed, nonfinite, inverted, outside or site-excluding areas', () => {
  const sites = [wall(1, .5)], area = constructionWorkArea(sites, map);
  assert.equal(validConstructionWorkArea(area, map, sites), true);
  for (const invalid of [null, {}, { ...area, extra: 1 }, { ...area, minX: NaN }, { ...area, maxZ: Infinity },
    { ...area, minX: -33 }, { ...area, maxZ: 33 }, { ...area, minX: area.maxX + 1 }, { ...area, minZ: area.maxZ + 1 },
    { ...area, minX: 1 }]) assert.equal(validConstructionWorkArea(invalid, map, sites), false);
});

function sequenceFixture(sites = [wall(1, .5, .5, { footprint: [5] })]) {
  const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  const intentSource = server.slice(server.indexOf('function palisadeConstructionIntent('), server.indexOf('function preparePalisadeBuilderAssignments('));
  const sequenceSource = server.slice(server.indexOf('const palisadeConstructionRetries ='), server.indexOf('function updateBuildingAndProduction('));
  const distanceSource = server.slice(server.indexOf('function distanceToBuildingEdge('), server.indexOf('function destroyBuilding('));
  const applySource = server.slice(server.indexOf('function applyPlannedMoveAssignment('), server.indexOf('function takeMoveStartBroadcastRequest('));
  const order = { ids: sites.map(site => site.id), generation: 7, revision: 12 };
  const unit = { id: 0, team: 0, kind: 'worker', generation: 7, hp: 100, orderRevision: 12, wallBuildOrder: order,
    workIntent: createConstructionWorkIntent(7, order.ids, constructionWorkArea(sites, map)),
    buildingTargetId: null, path: [3, 4], pathIndex: 0, movePlanningPending: true, moveGoalCell: 4, x: -10.5, z: .5 };
  let searches = 0, reachable = false;
  const c = vm.createContext({ ...workerFlowRouteBindings(), units: [unit], activeWallBuildOrder, activeWorkIntent, clearWorkIntent,
    createOrdinaryMilitaryEndpointAvailability, constructionMovementActive, canTraverseStaticBodySegment, LAND_CLEARANCE_PROFILE,
    MAX_UNITS: 2000, movePlanningEpoch: 0, isWalkable: () => true,
    constructionWorkArea, unfinishedConstructionSites, BUILDING_DEFINITIONS, BUILDER_INTERACTION_RANGE: 1.4,
    isPalisade, buildingsById: lookup(sites), mapDefinition: map, navigationRevision: 1, tickNumber: 0, TICK_RATE: 30,
    nearestOpenCell: cell => cell, worldToCell: () => 3, MAP_WIDTH: 64, MAP_HEIGHT: 64, MAP_HALF_X: 32, MAP_HALF_Z: 32,
    elevationLevelByCell: new Uint8Array(64 * 64), movePlanningServiceTick: null, dirty: false,
    buildingAccessCells: () => [4], findBuildingAttackApproachCell: () => { searches++; return reachable ? { goal: 4 } : null; },
    cellToWorld: () => ({ x: .5, z: -.5 }), assignFormationMove: (_player, command, target) => {
      assert.deepEqual(Array.from(command.ids), [unit.id]); unit.orderRevision++; unit.buildingTargetId = target; unit.movePlanningPending = true;
    } });
  vm.runInContext(intentSource + sequenceSource + distanceSource + applySource, c);
  return { c, unit, order, sites, get searches() { return searches; }, set reachable(value) { reachable = value; } };
}

test('actual construction sequence bounds unreachable retries, invalidates stale routes and resumes after topology changes', () => {
  const f = sequenceFixture(), { c, unit, order, sites: [site] } = f;
  for (let tick = 0; tick <= 300; tick++) { c.tickNumber = tick; c.updateWallBuildOrders(); }
  assert.equal(f.searches, 3, 'three attempts, at most once per second, then wait for topology change');
  assert.equal(activeWallBuildOrder(unit), order); assert.deepEqual(order.ids, [1]);
  assert.deepEqual(unit.workIntent.area, constructionWorkArea([site], map));
  assert.equal(unit.path.length, 0); assert.equal(unit.movePlanningPending, false); assert.equal(unit.moveGoalCell, -1);
  c.navigationRevision++; c.updateWallBuildOrders(); assert.equal(f.searches, 4);
  f.reachable = true; c.navigationRevision++; c.updateWallBuildOrders();
  assert.equal(f.searches, 5); assert.equal(unit.buildingTargetId, site.id); assert.equal(activeWallBuildOrder(unit), order);
  site.complete = true; c.updateWallBuildOrders(); assert.equal(unit.wallBuildOrder, null);
  assert.equal(unit.workIntent, null);
});

test('actual failed route retains a target, then construction reacquires it without replacing active routes or in-range work', () => {
  const f = sequenceFixture(), { c, unit } = f;
  const assignment = { unit, revision: unit.orderRevision, destination: 4, path: [], buildingTargetId: 1 };
  assignment.routeResult = createUnitRouteResult({ unit, revision: assignment.revision, epoch: 0, navigationRevision: c.navigationRevision, startCell: 3, path: [] });
  c.applyPlannedMoveAssignment({ epoch: 0, preserveAssignmentBuildingTarget: true }, assignment);
  assert.equal(assignment.routeOutcome.routeFailure, true); assert.equal(unit.buildingTargetId, 1);
  f.reachable = true; c.updateWallBuildOrders(); assert.equal(f.searches, 1);
  for (let tick = 1; tick < 90; tick++) { c.tickNumber = tick; c.updateWallBuildOrders(); }
  assert.equal(f.searches, 1, 'pending route stays active');
  unit.movePlanningPending = false; unit.path = [4]; unit.pathIndex = 0; c.updateWallBuildOrders();
  assert.equal(f.searches, 1, 'nonempty active route stays active');
  unit.pathIndex = 1; unit.x = .5; c.updateWallBuildOrders(); assert.equal(f.searches, 1, 'in-range builder keeps working');
});

test('a newly remembered target gets its own retry budget after another builder completes the blocked head', () => {
  const f = sequenceFixture([wall(1, .5, .5, { footprint: [5] }), wall(2, 1.5, .5, { footprint: [6] })]);
  const { c, unit } = f, area = structuredClone(unit.workIntent.area);
  for (let tick = 0; tick <= 100; tick++) { c.tickNumber = tick; c.updateWallBuildOrders(); }
  assert.equal(f.searches, 3);
  f.sites[0].complete = true; f.reachable = true; c.updateWallBuildOrders();
  assert.equal(f.searches, 4, 'new site can be reached without an unrelated topology change');
  assert.equal(unit.buildingTargetId, 2); assert.deepEqual(unit.workIntent.siteIds, [2]);
  assert.deepEqual(unit.workIntent.area, area); assert.equal(c.navigationRevision, 1);
});

test('repeated actual empty route failures consume the bounded budget even when an approach is always found', () => {
  const f = sequenceFixture(), { c, unit } = f;
  f.reachable = true;
  for (let tick = 0; tick < 120; tick++) {
    c.tickNumber = tick; c.updateWallBuildOrders();
    if (unit.movePlanningPending) {
      const assignment = { unit, revision: unit.orderRevision, destination: 4, path: [], buildingTargetId: 1 };
      assignment.routeResult = createUnitRouteResult({ unit, revision: assignment.revision, epoch: 0, navigationRevision: c.navigationRevision, startCell: 3, path: [] });
      c.applyPlannedMoveAssignment({ epoch: 0, preserveAssignmentBuildingTarget: true }, assignment);
      assert.equal(assignment.routeOutcome.routeFailure, true);
    }
  }
  assert.equal(f.searches, 3, 'three automatic routes, rather than one every tick');
  assert.deepEqual(unit.workIntent.siteIds, [1]); assert.equal(unit.buildingTargetId, 1);
  c.navigationRevision++; c.updateWallBuildOrders(); assert.equal(f.searches, 4);
});

test('automatic endpoint occupancy preserves the spent static construction budget; explicit admission resets it', () => {
  const f = sequenceFixture(), { c, unit, sites: [site] } = f;
  for (let tick = 0; tick <= 100; tick++) { c.tickNumber = tick; c.updateWallBuildOrders(); }
  const retry = () => vm.runInContext('palisadeConstructionRetries.get(units[0])', c);
  assert.equal(f.searches, 3); assert.equal(retry().attempts, 3);
  const area = structuredClone(unit.workIntent.area);
  Object.assign(unit, { queuedWaypoints: [], gatherNodeId: null, gatherForestCell: -1 });
  // Controlled occupancy drives the actual automatic update and admission bodies.
  // No planner/search is needed while every otherwise legal access is blocked.
  Object.assign(c, { performance, commandUnits: () => [unit], sendOrderNotice() {},
    unitHasCapability: () => true, cancelGatherOrder() {}, clearGatherWorkIntent() {},
    ATTACK_MOVE_SCAN_INTERVAL_TICKS: 15, CELL_COUNT: 4096, walkableComponents: new Int32Array(4096),
    createOrdinaryMilitaryEndpointAvailability: () => ({ check: () => ({ status: 'blocked', visited: 1 }) }) });
  const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  const admission = server.slice(server.indexOf('function nearestBuilderAccessCell('),
    server.indexOf('// Persistent intent rides'));
  vm.runInContext(admission, c);
  c.tickNumber = 101; c.updateWallBuildOrders();
  assert.equal(retry().accessBlocked, true); assert.equal(retry().attempts, 3);
  assert.equal(retry().siteId, site.id); assert.equal(retry().navigationRevision, 1);
  assert.equal(unit.buildingTargetId, site.id); assert.equal(unit.movePlanningPending, false);
  assert.equal(unit.moveGoalCell, -1); assert.deepEqual(unit.workIntent.area, area);
  const automaticRevision = unit.orderRevision;
  for (let tick = 102; tick <= 200; tick++) { c.tickNumber = tick; c.updateWallBuildOrders(); }
  assert.equal(f.searches, 3); assert.equal(retry().attempts, 3);
  assert.equal(unit.orderRevision, automaticRevision);
  c.assignFormationMove({ team: unit.team, sendJson() {} }, {
    type: 'move', ids: [unit.id], unitGenerations: [unit.generation], x: .5, z: -.5,
  }, site.id, 'BUILD ORDER');
  assert.equal(unit.orderRevision, automaticRevision + 1);
  assert.equal(retry().accessBlocked, true); assert.equal(retry().attempts, 0);
  assert.equal(retry().navigationRevision, 1); assert.equal(unit.buildingTargetId, site.id);
  assert.deepEqual(unit.workIntent.area, area);
});
