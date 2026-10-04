import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createResourceNodeState, activateWildlifeHarvest, markWildlifeDepleted } from '../src/wildlife-state.mjs';
import { migrateWildlifeMotionCheckpoint, sameWildlifeCell, wildlifeCell, wildlifeStepUnoccupied,
  stepWildlifeMotion, validWildlifeMotion, SHEEP_WANDER_SPEED } from '../src/wildlife-motion.mjs';

const definition = { id: 'meadow-sheep', type: 'food', stock: 130, x: .5, z: .5, wildlifeSpecies: 'bellweather-sheep' };
const map = { width: 8, height: 8, resourceNodes: [definition] };
const legal = (from, to) => sameWildlifeCell(to, definition, map);
function advance(node, ticks, canStep = legal) {
  for (let tick = 0; tick < ticks; tick++) stepWildlifeMotion(node, definition, { canStep });
}

test('continuous bounded motion conserves food and replays exact mid-leg checkpoints', () => {
  const node = createResourceNodeState(definition);
  let moved = false, saved;
  for (let tick = 0; tick < 1500; tick++) {
    const before = { x: node.x, z: node.z };
    stepWildlifeMotion(node, definition, { canStep: legal });
    const distance = Math.hypot(node.x - before.x, node.z - before.z);
    assert.ok(distance <= SHEEP_WANDER_SPEED / 30 + 1e-10);
    assert.equal(validWildlifeMotion(node, definition), true);
    assert.equal(sameWildlifeCell(node, definition, map), true);
    assert.equal(node.stock, 130);
    moved ||= distance > 0;
    if (!saved && node.wildlifeMotion.activity === 'wandering') saved = structuredClone(node);
  }
  assert.equal(moved, true);
  const resumed = structuredClone(saved), uninterrupted = structuredClone(saved);
  advance(uninterrupted, 900); advance(resumed, 900);
  assert.deepEqual(resumed, uninterrupted);
});

test('pending Gather holds position/progress; cancellation resumes; carcass/depleted stay frozen', () => {
  const node = createResourceNodeState(definition);
  advance(node, 240);
  const before = structuredClone(node);
  for (let tick = 0; tick < 100; tick++) stepWildlifeMotion(node, definition, { paused: true, canStep: legal });
  assert.equal(node.x, before.x); assert.equal(node.z, before.z);
  assert.equal(node.wildlifeMotion.sequence, before.wildlifeMotion.sequence);
  assert.equal(node.wildlifeMotion.waitTicks, before.wildlifeMotion.waitTicks);
  assert.equal(node.wildlifeMotion.activity, 'idle');
  advance(node, 500);
  assert.notDeepEqual(node.wildlifeMotion, before.wildlifeMotion);
  activateWildlifeHarvest(node);
  const carcass = structuredClone(node); advance(node, 900); assert.deepEqual(node, carcass);
  assert.equal(validWildlifeMotion(node, definition), true);
  node.stock = 0; markWildlifeDepleted(node);
  const depleted = structuredClone(node); advance(node, 900); assert.deepEqual(node, depleted);
});

test('land step guard cannot enter blocked terrain, cross a cell, or sweep through an actor', () => {
  const node = createResourceNodeState(definition);
  advance(node, 1200, () => false);
  assert.equal(node.x, definition.x); assert.equal(node.z, definition.z); assert.equal(node.stock, 130);
  assert.equal(sameWildlifeCell({ x: -.001, z: .5 }, definition, map), false);
  assert.equal(wildlifeCell({ x: -4.001, z: 0 }, map), -1, 'unclamped map edge');
  assert.equal(wildlifeCell({ x: 4, z: 0 }, map), -1, 'half-open map edge');
  const from = { x: 0, z: 0 }, to = { x: .006, z: 0 };
  assert.equal(wildlifeStepUnoccupied(from, to, [{ x: .003, z: .449 }]), false, 'swept segment');
  assert.equal(wildlifeStepUnoccupied(from, to, [{ x: .003, z: .451 }]), true);
});

test('only exact stationary schema23 state migrates; malformed motion cannot repair stock', () => {
  const legacyNode = createResourceNodeState(definition); delete legacyNode.wildlifeMotion;
  legacyNode.wildlifeState = 'carcass'; legacyNode.stock = 42.5;
  const legacy = { schemaVersion: 23, mapDefinition: map, state: { resourceNodes: [legacyNode], teamFood: [151, 152] } };
  const rejected = structuredClone(legacy); rejected.state.resourceNodes[0].x += .001;
  const unchanged = structuredClone(rejected);
  assert.equal(migrateWildlifeMotionCheckpoint(rejected), false); assert.deepEqual(rejected, unchanged);
  assert.equal(migrateWildlifeMotionCheckpoint(legacy), true); assert.equal(legacy.schemaVersion, 24);
  assert.deepEqual(legacy.state.teamFood, [151, 152]); assert.equal(legacy.state.resourceNodes[0].stock, 42.5);
  assert.equal(validWildlifeMotion(legacy.state.resourceNodes[0], definition), true);
  for (const patch of [{ targetX: Infinity }, { waitTicks: -1 }, { sequence: 2 ** 32 }, { heading: -1 },
    { activity: 'wandering' }, { targetZ: 1.1 }]) {
    const corrupt = structuredClone(legacy.state.resourceNodes[0]); Object.assign(corrupt.wildlifeMotion, patch);
    assert.equal(validWildlifeMotion(corrupt, definition), false);
  }
});

test('actual checkpoint capture copies private motion before deferred serialization', () => {
  const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  const capture = source.slice(source.indexOf('function captureMatchCheckpoint('), source.indexOf('function assertSnapshot('));
  const node = createResourceNodeState(definition);
  let visionChecks = 0;
  const defaults = { MATCH_CHECKPOINT_SCHEMA_VERSION: 25, MATCH_RULES_VERSION: 6,
    sessions: new Map(), resourceNodeStates: new Map([[node.id, node]]), units: [], buildings: [],
    teamUpgrades: [{}, {}], teamResearch: [null, null], workerProduction: [{}, {}], homeTownCenters: [{}, {}],
    triggerStates: new Map(), scenarioEventStates: new Map(), victoryHoldState: { activeTeams: [], progressSeconds: [], triggerIds: [] },
    visibleCellsByTeam: [[], []], exploredCellsByTeam: [[], []], forestStockEntries: () => [], mapDefinition: map,
    authoredMapDefinition: map, matchMode: { matchModeId: 'authored', matchModeVersion: 1 },
    matchMapHash: () => 'map', matchEconomyProfileId: () => 'profile', economyRulesetRevision: () => 'rules',
    privateProductionView: () => ({}), pregame: null,
    ensureVisionMasks: () => { visionChecks++; } };
  Object.assign(defaults, { Buffer, unitGenerationCounters: [], teamFood: [0, 0], teamWood: [0, 0], teamStone: [0, 0],
    DEFAULT_FACTION_ID: 'default', matchId: 'room', tickNumber: 10, currentArmySize: 0, nextBuildingId: 1,
    forestEpoch: 0, matchElapsedSeconds: 0, scenarioClockStarted: true, matchWinner: -1,
    matchWinnerTriggerId: null, matchWinnerReason: '', nextPlayerId: 1, navigationRevision: 0, nextMoveOrderId: 1 });
  const context = vm.createContext(defaults); vm.runInContext(capture, context);
  const saved = context.captureMatchCheckpoint(1, 1000), savedNode = saved.state.resourceNodes[0];
  assert.equal(visionChecks, 1, 'checkpoint capture refreshes vision before copying private state');
  node.x += .01; node.wildlifeMotion.waitTicks--;
  assert.notEqual(savedNode.x, node.x); assert.notEqual(savedNode.wildlifeMotion.waitTicks, node.wildlifeMotion.waitTicks);
});


test('off-center meadow anchors never persist a goal across the resource-cell edge', () => {
  const offCenter = { ...definition, x: .85, z: .85 }, node = createResourceNodeState(offCenter);
  for (let tick = 0; tick < 1800; tick++) {
    stepWildlifeMotion(node, offCenter, { canStep: (from, to) => sameWildlifeCell(to, offCenter, map) });
    assert.equal(sameWildlifeCell(node, offCenter, map), true);
    assert.equal(sameWildlifeCell({ x: node.wildlifeMotion.targetX, z: node.wildlifeMotion.targetZ }, offCenter, map), true);
    assert.equal(validWildlifeMotion(node, offCenter), true);
  }
});
