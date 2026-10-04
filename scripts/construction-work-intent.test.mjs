import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { activeWallBuildOrder } from '../src/wall-build-order.mjs';
import { isPalisade } from '../src/palisade-gate.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { activeWorkIntent, createConstructionWorkIntent, clearWorkIntent } from '../src/work-intent.mjs';
import { constructionWorkArea, constructionAssignment, unfinishedConstructionSites, validConstructionWorkArea } from '../src/construction-work-intent.mjs';

const map = { width: 64, height: 64 };
const wall = (id, x, z = .5, overrides = {}) => ({ id, x, z, type: 'palisade-wall', team: 0, hp: 300, complete: false, ...overrides });
const lookup = sites => new Map(sites.map(site => [site.id, site]));
const intent = sites => ({ version: 1, kind: 'construction', generation: 17,
  siteIds: sites.map(site => site.id), area: constructionWorkArea(sites, map) });

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
  const unit = { id: 0, team: 0, generation: 7, hp: 100, orderRevision: 12, wallBuildOrder: order,
    workIntent: createConstructionWorkIntent(7, order.ids, constructionWorkArea(sites, map)),
    buildingTargetId: null, path: [3, 4], pathIndex: 0, movePlanningPending: true, moveGoalCell: 4, x: -10.5, z: .5 };
  let searches = 0, reachable = false;
  const c = vm.createContext({ units: [unit], activeWallBuildOrder, activeWorkIntent, clearWorkIntent,
    constructionWorkArea, unfinishedConstructionSites, BUILDING_DEFINITIONS, BUILDER_INTERACTION_RANGE: 1.4,
    isPalisade, buildingsById: lookup(sites), mapDefinition: map, navigationRevision: 1, tickNumber: 0, TICK_RATE: 30,
    nearestOpenCell: cell => cell, worldToCell: () => 3, MAP_WIDTH: 64, movePlanningServiceTick: null, dirty: false,
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
  c.applyPlannedMoveAssignment({ preserveAssignmentBuildingTarget: true }, assignment);
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
