import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { VisionCoverageCache } from '../src/server/vision-coverage-cache.mjs';
import { economyServerBindings, economyServerFunctions } from './economy-server-fixture.mjs';
import { BUILDING_DEFINITIONS, missingGameplayPrerequisites } from '../src/gameplay-definitions.mjs';
import { STONE_ECONOMY_PROFILE_ID as STONE, DEFAULT_ECONOMY_PROFILE_ID as BASE } from '../src/economy-profile.mjs';
import { constructionAssignment, constructionWorkArea } from '../src/construction-work-intent.mjs';
import { isPalisade } from '../src/palisade-gate.mjs';

const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
function fn(name) {
  const start = source.indexOf(`function ${name}(`), end = source.indexOf('\nfunction ', start + 1);
  assert.ok(start >= 0 && end > start); return source.slice(start, end);
}
// Real paid-command bodies; geometry is a simple reachable, vacant test site.
function fixture(team, profile = STONE, { acceptAssignment = true } = {}) {
  const notices = [], worker = { id: 0, team, kind: 'worker', hp: 35, x: -4.5, z: 0.5,
    generation: 1, orderRevision: 0, buildingTargetId: null, workIntent: null, wallBuildOrder: null,
    cargo: 0, cargoType: null, gatherNodeId: null, gatherForestCell: -1, gatherPhase: '' };
  const context = vm.createContext({ ...economyServerBindings(profile), BUILDING_DEFINITIONS,
    VisionCoverageCache, visionCoverageGeneration: 0,
    constructionAssignment, constructionWorkArea, isPalisade, palisadeConstructionRetries: new WeakMap(),
    teamFood: [300.25, 300.25], teamWood: [600.125, 600.125], teamStone: [50, 50],
    teamUpgrades: [{}, {}], units: [worker], buildings: [], buildingsById: new Map(),
    MAX_BUILDINGS: 128, MAP_WIDTH: 16, MAP_HEIGHT: 16, MAP_HALF_X: 8, MAP_HALF_Z: 8, CELL_COUNT: 256,
    blocked: new Uint8Array(256), buildingBlocked: new Uint8Array(256), townCenterBlocked: new Uint8Array(256),
    walkableComponents: new Int32Array(256), spawnByTeam: [{ x: -6.5, z: 0.5 }, { x: 6.5, z: 0.5 }],
    worldToCell: (x, z) => Math.floor(z + 8) * 16 + Math.floor(x + 8),
    cellToWorld: cell => ({ x: cell % 16 - 7.5, z: Math.floor(cell / 16) - 7.5 }),
    nearestOpenCell: cell => cell, buildingFootprint: () => [184], buildingAccessCells: () => [183],
    isResourceCell: () => false, commandUnits: () => [worker], unitHasCapability: () => true,
    missingGameplayPrerequisites, buildingRulesFor: type => BUILDING_DEFINITIONS[type],
    rebuildWalkableComponents() {}, captureBuildingConnectivity() {},
    canPlaceBuildingWithoutDisconnectingEntities: () => true, activeMoveRoutesRemainConnected: () => true,
    nextBuildingId: 1, navigationRevision: 0, visionCoverageBySourceCell: null, attackFlowFields: new Map(),
    replanPathsBlockedBy() {}, dirty: false,
    // Model only synchronous route admission; construction helpers use real server bodies.
    assignFormationMove(_, __, targetId) {
      if (!acceptAssignment) return;
      worker.orderRevision++; worker.buildingTargetId = targetId;
    },
    sendOrderNotice: (_, __, message) => notices.push(message), rejectBuild: (_, message) => notices.push(message),
    mapDefinition: { width: 16, height: 16, economyProfileId: profile, triggers: [] },
    destroyBuilding(building) { context.buildingsById.delete(building.id); context.buildings.splice(context.buildings.indexOf(building), 1); },
  });
  vm.runInContext(economyServerFunctions + ['invalidateVisionCoverage', 'palisadeConstructionIntent', 'preparePalisadeBuilderAssignments',
    'finishPalisadeBuilderAssignments', 'buildBuilding', 'cancelConstruction'].map(fn).join('\n'), context);
  const build = type => context.buildBuilding({ team }, { ids: [0], buildingType: type, x: 0.5, z: 3.5 });
  return { context, notices, worker, build };
}

for (const team of [0, 1]) {
  test(`seat ${team}: paid construction installs a generation-bound intent for the accepted builder`, () => {
    const { context: c, worker, build } = fixture(team);
    c.palisadeConstructionRetries.set(worker, { attempts: 3 });
    build('watchtower');
    assert.equal(worker.orderRevision, 1); assert.equal(worker.buildingTargetId, 1);
    assert.deepEqual(worker.workIntent, { version: 1, kind: 'construction', generation: 1,
      siteIds: [1], area: { minX: -3, maxX: 4, minZ: 0, maxZ: 7 } });
    assert.equal(c.validWorkIntent(worker.workIntent, worker, c.mapDefinition,
      { buildings: c.buildings, nextBuildingId: c.nextBuildingId }), true);
    assert.equal(worker.wallBuildOrder, null);
    assert.equal(c.palisadeConstructionRetries.has(worker), false);
    assert.deepEqual([c.teamFood[team], c.teamWood[team], c.teamStone[team]], [250.25, 450.125, 0]);
  });
  test(`seat ${team}: an unassigned builder keeps its prior intent after paid site admission`, () => {
    const { context: c, worker, build } = fixture(team, STONE, { acceptAssignment: false });
    const previous = c.createGatherWorkIntent(worker.generation, worker);
    const retry = { attempts: 3 };
    worker.workIntent = previous; c.palisadeConstructionRetries.set(worker, retry);
    build('watchtower');
    assert.equal(c.buildings.length, 1); assert.equal(c.nextBuildingId, 2);
    assert.equal(worker.orderRevision, 0); assert.equal(worker.buildingTargetId, null);
    assert.equal(worker.workIntent, previous); assert.equal(worker.wallBuildOrder, null);
    assert.equal(c.palisadeConstructionRetries.get(worker), retry);
    assert.deepEqual([c.teamFood[team], c.teamWood[team], c.teamStone[team]], [250.25, 450.125, 0]);
  });
  test(`seat ${team}: fractional Stone shortfall leaves every bank, ID and site unchanged`, () => {
    const { context: c, build, notices } = fixture(team); c.teamStone[team] = 49.9999;
    const banks = [c.teamFood.slice(), c.teamWood.slice(), c.teamStone.slice()];
    build('watchtower'); assert.match(notices.at(-1), /50 STONE/);
    assert.deepEqual([c.teamFood, c.teamWood, c.teamStone], banks);
    assert.equal(c.nextBuildingId, 1); assert.equal(c.buildings.length, 0); assert.equal(c.buildingsById.size, 0);
    assert.ok(c.buildingBlocked.every(value => value === 0)); assert.equal(c.navigationRevision, 0);
    assert.equal(c.dirty, false);
  });
  test(`seat ${team}: missing typed banks reject before tentative occupancy or a partial payment`, () => {
    for (const resource of ['Food', 'Wood', 'Stone']) {
      const { context: c, build } = fixture(team); c[`team${resource}`][team] = undefined;
      const before = [c.teamFood.slice(), c.teamWood.slice(), c.teamStone.slice()];
      assert.throws(() => build('watchtower'), /Invalid economy balance/);
      assert.deepEqual([c.teamFood, c.teamWood, c.teamStone], before);
      assert.equal(c.nextBuildingId, 1); assert.equal(c.buildings.length, 0);
      assert.ok(c.buildingBlocked.every(value => value === 0));
    }
  });
  test(`seat ${team}: Watchtower payment and partial cancellation conserve all three resources once`, () => {
    const { context: c, build } = fixture(team); build('watchtower');
    assert.equal(c.buildings.length, 1); const tower = c.buildings[0];
    assert.deepEqual([c.teamFood[team], c.teamWood[team], c.teamStone[team]], [250.25, 450.125, 0]);
    tower.progress = 0.25;
    c.cancelConstruction({ team: 1 - team }, { buildingId: tower.id }); assert.equal(c.buildings.length, 1);
    c.cancelConstruction({ team }, { buildingId: tower.id });
    assert.deepEqual([c.teamFood[team], c.teamWood[team], c.teamStone[team]], [287.75, 562.625, 37.5]);
    c.cancelConstruction({ team }, { buildingId: tower.id });
    assert.deepEqual([c.teamFood[team], c.teamWood[team], c.teamStone[team]], [287.75, 562.625, 37.5]);
    assert.equal(c.buildings.length, 0); assert.equal(c.buildingsById.size, 0);
    assert.equal(c.teamStone[1 - team], 50);
  });
  test(`seat ${team}: completed defense cannot refund and baseline defense never spends Stone`, () => {
    const stone = fixture(team); stone.build('watchtower');
    stone.context.buildings[0].complete = true; stone.context.buildings[0].progress = 1;
    stone.context.cancelConstruction({ team }, { buildingId: 1 });
    assert.equal(stone.context.teamStone[team], 0); assert.equal(stone.context.buildings.length, 1);
    const base = fixture(team, BASE); base.context.teamStone = [0, 0]; base.build('watchtower');
    assert.equal(base.context.buildings.length, 1); assert.equal(base.context.teamStone[team], 0);
    assert.deepEqual([base.context.teamFood[team], base.context.teamWood[team]], [250.25, 450.125]);
  });
  test(`seat ${team}: typed cargo credits its own bank once and rejects unsupported fallback deposits`, () => {
    for (const type of ['food', 'wood', 'stone']) {
      const { context: c, worker } = fixture(team);
      const key = `team${type[0].toUpperCase()}${type.slice(1)}`;
      const before = [c.teamFood[team], c.teamWood[team], c.teamStone[team]];
      worker.cargo = 10 / 3; worker.cargoType = type;
      c.depositWorkerCargo(worker); c.depositWorkerCargo(worker);
      assert.equal(c[key][team], before[['food', 'wood', 'stone'].indexOf(type)] + 10 / 3);
      assert.equal(worker.cargo, 0); assert.equal(worker.cargoType, null);
      for (const other of ['food', 'wood', 'stone'].filter(resource => resource !== type)) {
        assert.equal(c[`team${other[0].toUpperCase()}${other.slice(1)}`][team], before[['food', 'wood', 'stone'].indexOf(other)]);
      }
    }
    for (const [profile, type] of [[BASE, 'stone'], [STONE, 'gold'], [STONE, 'copper']]) {
      const { context: c, worker } = fixture(team, profile); worker.cargo = 3.125; worker.cargoType = type;
      const before = [c.teamFood.slice(), c.teamWood.slice(), c.teamStone.slice()];
      assert.throws(() => c.depositWorkerCargo(worker), /Unsupported Worker cargo/);
      assert.equal(worker.cargo, 3.125); assert.equal(worker.cargoType, type);
      assert.deepEqual([c.teamFood, c.teamWood, c.teamStone], before);
    }
  });
}
