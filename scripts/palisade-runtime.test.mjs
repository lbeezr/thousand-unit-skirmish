import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { activeWallBuildOrder } from '../src/wall-build-order.mjs';
import { palisadeConnections } from '../src/palisade-profile.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { clearWorkIntent, createConstructionWorkIntent } from '../src/work-intent.mjs';
import { createClearanceMoveGoalPoint } from '../src/unit-movement.mjs';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const renderer = source.slice(source.indexOf('function createPalisadeVisual('), source.indexOf('function createArcheryRangeVisual('));

test('wall sequence belongs to the current living Worker generation and order revision', () => {
  const order = { ids: [1, 2, 3], generation: 7, revision: 12 };
  const unit = { hp: 100, generation: 7, orderRevision: 12, wallBuildOrder: order };
  assert.equal(activeWallBuildOrder(unit), order);
  for (const override of [{ hp: 0 }, { generation: 8 }, { orderRevision: 13 }, { wallBuildOrder: null }]) {
    assert.equal(activeWallBuildOrder({ ...unit, ...override }), null);
  }
  assert.deepEqual(order.ids, [1, 2, 3]);
});

test('provisional palisade geometry matches every cardinal mask, center pivot and edge seam', () => {
  assert.ok(renderer.startsWith('function createPalisadeVisual('));
  const context = vm.createContext({ THREE, scene: new THREE.Scene(), TEAM_HEX: [0x123456, 0xabcdef],
    groundHeight: () => 0, createBuildingHealthIndicator: () => ({ group: new THREE.Group() }),
    createBuildingCombatFeedback: () => ({ targetRing: new THREE.Group(), impactFlash: new THREE.Group() }),
    updateBuildingHealthIndicator() {} });
  vm.runInContext(renderer, context);
  const directions = [['north', 0, -1], ['east', 1, 0], ['south', 0, 1], ['west', -1, 0]];
  for (let mask = 0; mask < 16; mask++) {
    const cells = new Set([40, ...directions.flatMap(([, dx, dz], i) => mask & (1 << i) ? [40 + dx + dz * 9] : [])]);
    const connections = palisadeConnections(40, 9, 9, cells);
    assert.deepEqual(connections, directions.filter((_, i) => mask & (1 << i)).map(([name]) => name));
    const row = { type: 'palisade-wall', team: mask % 2, x: 0.5, z: 1.5, progress: 1, complete: true, connections };
    const visual = context.createPalisadeVisual(row);
    assert.deepEqual(visual.group.position.toArray(), [0.5, 0, 1.5]);
    assert.equal(BUILDING_DEFINITIONS[row.type].footprint, 1);
    for (const [name, arm] of Object.entries(visual.arms)) {
      assert.equal(arm.visible, connections.includes(name));
      const bounds = new THREE.Box3().setFromObject(arm);
      assert.ok(bounds.min.x >= -0.5 && bounds.max.x <= 0.5 && bounds.min.z >= -0.5 && bounds.max.z <= 0.5);
      if (name === 'north') assert.equal(bounds.min.z, -0.5);
      if (name === 'east') assert.equal(bounds.max.x, 0.5);
      if (name === 'south') assert.equal(bounds.max.z, 0.5);
      if (name === 'west') assert.equal(bounds.min.x, -0.5);
    }
    context.updatePalisadeVisual(visual, { ...row, progress: 0.25, connections: [] });
    assert.equal(visual.walls.scale.y, 0.25);
    assert.ok(Object.values(visual.arms).every(arm => !arm.visible), 'removed neighbors disappear on the next snapshot');
  }
  assert.deepEqual(palisadeConnections(8, 9, 9, new Set([8, 9])), [], 'rows never wrap across the map edge');
});

for (const type of ['move', 'attackMove']) test(`accepted queued ${type} interrupts wall work in the segment-completion window`, () => {
  const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  const movement = server.slice(server.indexOf('function assignFormationMove('), server.indexOf('function assignPatrolOrder('));
  const unit = { id: 0, team: 0, hp: 100, generation: 3, orderRevision: 7, kind: 'worker',
    buildingTargetId: null, wallBuildOrder: { ids: [1, 2], generation: 3, revision: 7 },
    queuedWaypoints: [], persistentOrder: null, gatherNodeId: null, gatherForestCell: -1,
    movePlanningPending: true, path: [8, 9], pathIndex: 0, attackTargetId: -1, attackBuildingTargetId: -1, attackMove: false,
    x: 0, z: 0, workIntent: createConstructionWorkIntent(3, [1, 2], { minX: 0, maxX: 2, minZ: 0, maxZ: 2 }) };
  const context = vm.createContext({ clearWorkIntent, createClearanceMoveGoalPoint, isWalkable: () => true, performance, MAP_WIDTH: 16, MAP_HEIGHT: 16, MAX_QUEUED_WAYPOINTS: 16, dirty: false,
    commandUnits: () => [unit], unitHasCapability: () => true, worldToCell: () => 22,
    nearestOpenCell: cell => cell, walkableComponents: new Int32Array(256), buildingsById: new Map(),
    buildFormationSlots: () => ({ slots: [22] }), orderUnitsForFormation: units => units,
    findAvailableCellNear: cell => cell, sendOrderNotice() {} });
  vm.runInContext(movement, context);
  context.assignFormationMove({ team: 0 }, { type, ids: [0], x: 1, z: 1, queue: true });
  assert.equal(unit.wallBuildOrder, null, 'queued player intent must prevent the automatic next-segment Move');
  assert.equal(unit.workIntent, null, 'accepted external queue clears durable construction intent');
  assert.deepEqual(unit.queuedWaypoints.map(entry => ({ destination: entry.destination, attackMove: entry.attackMove })),
    [{ destination: 22, attackMove: type === 'attackMove' }]);
  assert.equal(unit.orderRevision, 7, 'ordinary queued-move semantics preserve the current route revision');
  const retained = { ids: [1, 2], generation: 3, revision: 7 };
  const retainedIntent = createConstructionWorkIntent(3, [1, 2], { minX: 0, maxX: 2, minZ: 0, maxZ: 2 });
  unit.workIntent = retainedIntent;
  unit.wallBuildOrder = retained; unit.queuedWaypoints = Array.from({ length: 16 }, () => ({ destination: 22, attackMove: false }));
  context.assignFormationMove({ team: 0 }, { type, ids: [0], x: 1, z: 1, queue: true });
  assert.equal(unit.wallBuildOrder, retained, 'a rejected full queue must not interrupt the work');
  assert.equal(unit.workIntent, retainedIntent, 'rejected full queue preserves durable construction intent');
});
