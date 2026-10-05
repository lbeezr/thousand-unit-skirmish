import test from 'node:test';
import { constructionNextLegJourney, constructionNextLegRepairJourney } from './construction-next-leg-journeys.mjs';
for (const team of [0, 1]) {
  for (const cold of ['none', 'working', 'completed', 'egress']) {
    test(`seat ${team}: claimed last-site parking preserves work and clears through ${cold} cold recovery`, async () => {
      await constructionNextLegJourney(team, { cold });
    });
  }
  for (const interruption of ['stop', 'holdPosition', 'queuedMove']) {
    test(`seat ${team}: ${interruption} supersedes completion egress through cold recovery`, async () => {
      await constructionNextLegJourney(team, { interruption });
    });
  }
}

// Controlled host boundary for the exceptional all-candidates-unavailable case.
// The real-command journeys above establish movement, payment and recovery;
// this fixture proves retry cadence and release without inventing a planner.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { decideActiveConstructionParking } from '../src/simulation/movement/military-endpoint-availability.mjs';
for (const status of ['claimed', 'deferred']) test(`${status} completion wait retains last intent, bounds searches and admits independent release`, () => {
  const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  const source = server.slice(server.indexOf('const constructionParkingRetries ='), server.indexOf('function currentConstructionAccessRetry('));
  const remembered = { siteIds: [1], area: { minX: 0, maxX: 4, minZ: 0, maxZ: 4 } };
  const unit = { generation: 7, orderRevision: 2, team: 0, buildingTargetId: 1,
    pathIndex: 0, path: [], moveGoalCell: -1, movePlanningPending: false, x: .5, z: .5,
    wallBuildOrder: { ids: [1], generation: 7, revision: 2 }, workIntent: remembered };
  let searches = 0, next = status;
  const c = vm.createContext({ constructionMovementActive: () => true, palisadeConstructionIntent: () => remembered,
    unfinishedConstructionSites: () => [], buildingsById: new Map(), LAND_CLEARANCE_PROFILE: { radiusByKind: { worker: .18 } },
    canTraverseStaticBodySegment: () => true, MAP_WIDTH: 64, MAP_HEIGHT: 48, isWalkable: () => true,
    decideActiveConstructionParking, movePlanningEpoch: 0, navigationRevision: 1, tickNumber: 0, TICK_RATE: 30,
    nearestOpenCell: c => c, worldToCell: () => 0, walkableComponents: [1], cellToWorld: () => ({ x: .5, z: .5 }),
    findAvailableCellNear: () => { searches++; return -1; },
    enqueueRouteRepairs: () => assert.fail('unavailable endpoint cannot invent a route') });
  vm.runInContext(source, c);
  const finish = () => c.finishActiveConstructionParking(unit, { id: 1 }, () => ({ check: () => ({ status: 'available' }) }), () => next);
  const before = structuredClone(unit);
  for (let i = 0; i < 90; i++) { c.tickNumber = i; assert.equal(finish(), false); }
  assert.equal(searches, 3); assert.deepEqual(unit, before, 'no false pending, cleanup, pose or intent change while sealed');
  next = 'available'; assert.equal(finish(), true, 'fresh next-head release admits current pose immediately');
  assert.equal(unit.buildingTargetId, null); assert.equal(searches, 3);
});

for (const team of [0, 1]) for (const cold of [false, true]) {
  test(`seat ${team}: full repair retains then clears completion outside reach, cold=${cold}`, async () => {
    await constructionNextLegRepairJourney(team, { cold });
  });
}
