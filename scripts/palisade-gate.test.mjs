import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { BUILDING_DEFINITIONS, GAMEPLAY_RULESET_REVISION } from '../src/gameplay-definitions.mjs';
import { buildingBlocksMovement, isPalisade, planGateTransition, validGateState } from '../src/palisade-gate.mjs';
import { createGateTimbers, updateGateTimbers } from '../src/palisade-gate-visual.mjs';
import { previewWallPlacement } from '../src/wall-placement.mjs';

const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const handler = server.slice(server.indexOf('function setGateOpen('), server.indexOf('function findProductionSpawnCell('));
const lifecycle = client.slice(client.indexOf('function updateBuildingLifecycleActions('), client.indexOf('function updateRosterBuildingOptions('));
const gateRow = overrides => ({ id: 1, team: 0, type: 'palisade-gate', hp: 300, complete: true,
  gateOpen: false, footprint: [4], ...overrides });

test('gate reuses explicit Palisade tuning and adds no price or currency', () => {
  const gate = BUILDING_DEFINITIONS['palisade-gate'], wall = BUILDING_DEFINITIONS['palisade-wall'];
  assert.deepEqual(gate.cost, wall.cost);
  for (const field of ['buildSeconds', 'maxHp', 'footprint']) assert.equal(gate[field], wall[field]);
  assert.equal(gate.footprint, 1); assert.deepEqual(gate.products, []);
  assert.ok(isPalisade(gate.id));
});

test('manual owner operation, global movement and strict recovered gate state', () => {
  for (const team of [0, 1]) {
    const building = gateRow({ team }), saved = structuredClone(building);
    for (const bad of [{ team: 1 - team }, { team: null }, { open: 'true' },
      { building: { ...building, complete: false } }, { building: { ...building, hp: 0 } }]) {
      assert.equal(planGateTransition({ building, team, open: true, ...bad }).status, 'rejected');
    }
    assert.deepEqual(planGateTransition({ building, team, open: true }), { status: 'ready', open: true });
    assert.equal(buildingBlocksMovement(building), true);
    assert.equal(buildingBlocksMovement({ ...building, gateOpen: true }), false);
    assert.equal(buildingBlocksMovement({ ...building, gateOpen: true, complete: false }), true);
    assert.deepEqual(building, saved);
  }
  for (const bad of [{ gateOpen: undefined }, { gateOpen: 1 }, { gateOpen: true, complete: false }]) {
    assert.equal(validGateState(gateRow(bad)), false);
  }
  assert.equal(validGateState(gateRow()), true);
  assert.equal(validGateState(gateRow({ gateOpen: true })), true);
  assert.equal(validGateState({ type: 'house' }), true);
  assert.equal(validGateState({ type: 'house', gateOpen: false }), false);
});

function runtime(building = gateRow({ gateOpen: true })) {
  const notices = [], mask = new Uint8Array(9); mask[4] = buildingBlocksMovement(building) ? 1 : 0;
  const context = vm.createContext({ planGateTransition, buildingsById: new Map([[1, building]]), units: [],
    buildingBlocked: mask, CELL_COUNT: 9, walkableComponents: new Int32Array(9), navigationRevision: 10,
    dirty: false, attackFlowFields: { clear() { context.cacheClears++; } }, cacheClears: 0, replans: 0,
    worldToCell: (x, z) => z * 3 + x, captureBuildingConnectivity: () => new Map(),
    rebuildWalkableComponents() { context.componentBuilds++; }, componentBuilds: 0,
    canPlaceBuildingWithoutDisconnectingEntities() { assert.equal(mask[4], 1); return context.entitiesConnected; },
    entitiesConnected: true, activeMoveRoutesRemainConnected() { return context.routesConnected; }, routesConnected: true,
    replanPathsBlockedBy(cells) { assert.deepEqual(cells, [4]); context.replans++; },
    sendOrderNotice: (_, command, notice) => notices.push({ token: command.clientOrderToken, notice }),
  });
  vm.runInContext(handler, context);
  return { context, building, mask, notices, command(open, team = 0) { context.setGateOpen({ team }, { buildingId: 1, open, clientOrderToken: 77 }); } };
}

test('actual handler commits once, rejects occupied or disconnected closing, and preserves unrelated orders', () => {
  const r = runtime(); const unit = { hp: 100, x: 1, z: 1, team: 1, orderRevision: 8, path: [4, 5] };
  r.context.units = [unit]; const saved = structuredClone(unit);
  r.command(false); assert.match(r.notices.at(-1).notice, /UNITS IN GATE/);
  assert.deepEqual(unit, saved); assert.equal(r.mask[4], 0); assert.equal(r.context.navigationRevision, 10);
  r.context.units = [];
  for (const field of ['entitiesConnected', 'routesConnected']) {
    r.context[field] = false; r.command(false); r.context[field] = true;
    assert.match(r.notices.at(-1).notice, /WOULD BLOCK A ROUTE/);
    assert.equal(r.mask[4], 0); assert.equal(r.building.gateOpen, true);
    assert.equal(r.context.navigationRevision, 10); assert.equal(r.context.cacheClears, 0);
  }
  r.command(false); assert.equal(r.mask[4], 1); assert.equal(r.building.gateOpen, false);
  assert.equal(r.context.navigationRevision, 11); assert.equal(r.context.cacheClears, 1); assert.equal(r.context.replans, 1);
  r.command(false); assert.match(r.notices.at(-1).notice, /ALREADY CLOSED/); assert.equal(r.context.navigationRevision, 11);
  r.command(true, 1); assert.match(r.notices.at(-1).notice, /SELECT YOUR GATE/); assert.equal(r.mask[4], 1);
  r.command(true); assert.equal(r.mask[4], 0); assert.equal(r.context.navigationRevision, 12);
  assert.equal(r.context.replans, 1, 'opening preserves routes and unit orders');
  r.command(true); assert.equal(r.context.navigationRevision, 12); assert.equal(r.notices.at(-1).token, 77);
});

test('a thrown closing assessment restores the original mask without committing state', () => {
  const r = runtime(); r.context.activeMoveRoutesRemainConnected = () => { throw new Error('assessment'); };
  assert.throws(() => r.command(false), /assessment/);
  assert.equal(r.mask[4], 0); assert.equal(r.building.gateOpen, true);
  assert.equal(r.context.navigationRevision, 10); assert.equal(r.context.dirty, false);
});

test('friendly open/closed gates join a free reused wall line; foreign gates reserve occupancy', () => {
  for (const gateOpen of [false, true]) {
    const args = { width: 9, height: 9, team: 0, workers: 1, points: [{ column: 4, row: 4 }, { column: 5, row: 4 }],
      segmentCost: { food: 0, wood: 15 }, balance: { food: 0, wood: 15 },
      buildings: [{ ...gateRow({ gateOpen }), x: 0, z: 0, footprint: 1 }] };
    const result = previewWallPlacement(args); assert.equal(result.valid, true);
    assert.equal(result.preview.reusedCount, 1); assert.equal(result.preview.newCount, 1);
    assert.equal(result.preview.cost.wood, 15);
    assert.equal(previewWallPlacement({ ...args, team: 1 }).valid, false);
  }
});

test('procedural gate leaves stay in one cell and visibly clear the center in both axes', () => {
  for (const connections of [[], ['east', 'west'], ['north', 'south']]) {
    const gate = createGateTimbers(THREE, new THREE.MeshBasicMaterial());
    for (const gateOpen of [false, true]) {
      updateGateTimbers(gate, { connections, gateOpen }); gate.group.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(gate.group);
      for (const axis of ['x', 'z']) assert.ok(bounds.min[axis] >= -0.500001 && bounds.max[axis] <= 0.500001);
      assert.ok(bounds.max.y <= 1.400001);
      for (const { hinge, side } of gate.leaves) assert.equal(hinge.rotation.y, gateOpen ? side * Math.PI / 2 : 0);
    }
  }
});

for (const team of [0, 1]) test(`actual gate button uses current state and preserves focus for seat ${team}`, () => {
  const commands = [], building = gateRow({ team });
  const container = { dataset: {}, children: [], replaceChildren() { this.children = []; }, append(button) { this.children.push(button); } };
  const c = vm.createContext({ ui: { buildingLifecycleActions: container }, document: {
    createElement: () => ({ dataset: {}, addEventListener(_, cb) { this.click = cb; } }),
  }, localTeam: team, selectedBuildingId: 1, latestBuildings: [building], matchWinner: -1,
  latestTeamResearch: [{}, {}], latestWorkerProduction: [{}, {}], teamUnits: [[], []], getBuildingQueueLength: () => 0,
  sendCommand: command => commands.push(JSON.parse(JSON.stringify(command))),
  });
  vm.runInContext(lifecycle, c); c.updateBuildingLifecycleActions(); const button = container.children[0];
  assert.match(button.textContent, /Open gate.*both teams may pass/); button.click();
  assert.deepEqual(commands[0], { type: 'setGateOpen', buildingId: 1, open: true });
  // Snapshots replace rows; the callback must not retain the old closed object.
  c.latestBuildings = [{ ...building, gateOpen: true }]; c.updateBuildingLifecycleActions();
  assert.equal(container.children[0], button); assert.match(button.textContent, /Close gate/); button.click();
  assert.deepEqual(commands[1], { type: 'setGateOpen', buildingId: 1, open: false });
  c.matchWinner = 0; c.updateBuildingLifecycleActions(); assert.equal(button.disabled, true); button.click(); assert.equal(commands.length, 2);
  c.latestBuildings = [{ ...building, team: 1 - team }]; c.updateBuildingLifecycleActions(); assert.equal(container.children.length, 0);
});

test('only the exact preceding gate-free ruleset migrates; forged gate fields remain incompatible', () => {
  const migration = server.slice(server.indexOf('function migrateMatchCheckpoint('), server.indexOf('async function drainMatchCheckpointWrites'));
  const c = vm.createContext({ MATCH_CHECKPOINT_SCHEMA_VERSION: 22, MATCH_RULES_VERSION: 6, GAMEPLAY_RULESET_REVISION });
  vm.runInContext(migration, c);
  for (const prior of ['v1:c8a30de45cf9bfa527046662d022a0dc2cb28efc3ddd8b24521c5992eae328c2',
    'v1:fe00d0541953e6ed6d2c4e121789dd26fa6a962abce9ab8b4de1f067064ad801',
    'v1:d85f5a09decc0d0ade81803ab289b52ec5a08e84ff5a1771e85401d4c3611eab']) {
    for (const buildings of [[], [gateRow()], [{ type: 'house', gateOpen: false }]]) {
      const snapshot = { schemaVersion: 22, rulesVersion: 6, rulesetRevision: prior, state: { buildings } };
      // Pre-palisade migration also requires a unit array; avoid unit migration here.
      if (prior.includes('d85f')) snapshot.state.units = [];
      c.migrateMatchCheckpoint(snapshot);
      assert.equal(snapshot.rulesetRevision, buildings.length ? prior : GAMEPLAY_RULESET_REVISION);
    }
  }
});
