import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { wallCellAt, WallPlacementGesture, previewWallPlacement, wallPlacementFeedback } from '../src/wall-placement.mjs';
import { createWallPlacementGhost } from '../src/wall-placement-ghost.mjs';

const cell = (column, row) => ({ column, row });
const world = (column, row) => ({ x: column - 4 + 0.5, z: row - 4 + 0.5 });
const context = { width: 8, height: 8, points: [cell(1, 1), cell(3, 2)], team: 0, workers: 1,
  segmentCost: { food: 0, wood: 15 }, balance: { food: 0, wood: 60 } };
const preview = overrides => previewWallPlacement({ ...context, ...overrides });

test('world grid conversion leaves off-map coordinates unclamped', () => {
  assert.deepEqual(wallCellAt({ x: -4.1, z: 4 }, 8, 8), cell(-1, 8));
  assert.equal(wallCellAt(null, 8, 8), null);
  const result = preview({ points: [cell(1, 1), cell(8, 1)] });
  assert.equal(result.valid, false); assert.equal(result.preview, null);
});

test('elbow preview and cost come from one deterministic whole-line plan', () => {
  const column = preview(), row = preview({ axisOrder: 'row-first' });
  assert.equal(column.valid, true); assert.equal(column.preview.newCount, 4);
  assert.deepEqual(column.preview.cost, { food: 0, wood: 60 });
  assert.deepEqual(column.preview.cells, [9, 10, 11, 19]);
  assert.deepEqual(row.preview.cells, [9, 17, 18, 19]);
  assert.match(wallPlacementFeedback(column, { dragging: true }), /RELEASE TO PLACE · 4 NEW · 60 WOOD/);
});

test('compatible friendly segments are reused free; enemy walls and full building footprints block', () => {
  const buildings = [{ ...world(2, 1), type: 'palisade-wall', team: 0, footprint: 1 }];
  const result = preview({ buildings, balance: { food: 0, wood: 45 } });
  assert.equal(result.valid, true); assert.equal(result.preview.reusedCount, 1);
  assert.equal(result.preview.cost.wood, 45); assert.match(wallPlacementFeedback(result), /REUSED FREE/);
  assert.equal(preview({ buildings: [{ ...buildings[0], team: 1 }] }).valid, false);
  assert.equal(preview({ buildings: [{ ...world(4, 1), type: 'town-center', team: 0, footprint: 3 }] }).valid, false);
});

test('terrain, undisclosed forest, resources, objectives and live visible units reject the whole line', () => {
  const obstacle = { column: 2, row: 1, width: 1, height: 1, material: 'forest' };
  for (const overrides of [
    { obstacles: [obstacle] }, { resourceNodes: [world(2, 1)] },
    { triggers: [{ zone: { ...cell(2, 1), width: 1, height: 1 } }] },
    { units: [{ ...world(2, 1), hp: 100 }] },
  ]) { const result = preview(overrides); assert.equal(result.valid, false); assert.equal(result.plan, null); assert.equal(result.preview.cost.wood, 60); }
  assert.equal(preview({ obstacles: [obstacle], forestStocks: new Map([[10, 0]]) }).valid, true);
  for (const unit of [{ ...world(2, 1), hp: 0 }, { ...world(2, 1), hp: 100, visible: false }]) {
    assert.equal(preview({ units: [unit] }).valid, true);
  }
});

test('fractional bank checks and worker requirements cannot authorize a partial line', () => {
  const result = preview({ balance: { food: 0, wood: 59.99 } });
  assert.equal(result.valid, false); assert.equal(result.plan, null);
  assert.match(wallPlacementFeedback(result), /BLOCKED · NEED 60 WOOD · 4 NEW · 60 WOOD/);
  assert.equal(preview({ workers: 0 }).valid, false);
  assert.equal(preview({ team: null }).valid, false);
  assert.match(wallPlacementFeedback(preview(), { pending: true }), /WAITING FOR CONFIRMATION/);
});

test('only disclosed exact-zero node stock releases a wall site', () => {
  const resourceNodes = [{ id: 'food', ...world(2, 1), stock: 10 }];
  for (const stock of [undefined, 0.01, 10, NaN, -1]) {
    assert.equal(preview({ resourceNodes, resourceStocks: new Map([['food', stock]]) }).valid, false);
  }
  assert.equal(preview({ resourceNodes, resourceStocks: new Map([['food', 0]]) }).valid, true);
});

test('pointer ownership, copied endpoints, cancellation and exactly one finish', () => {
  const gesture = new WallPlacementGesture(), anchor = cell(1, 1);
  assert.equal(gesture.begin(1, anchor), true); anchor.column = 7;
  assert.equal(gesture.begin(2, cell(2, 2)), false);
  assert.equal(gesture.move(2, cell(7, 7)), false);
  assert.equal(gesture.finish(2, cell(7, 7), true), null);
  assert.deepEqual(gesture.finish(1, cell(3, 2), true), [cell(1, 1), cell(3, 2)]);
  assert.equal(gesture.finish(1, cell(3, 2), true), null);
  gesture.begin(1, cell(1, 1)); assert.equal(gesture.finish(1, cell(3, 2), false), null);
  gesture.begin(1, cell(1, 1)); assert.equal(gesture.finish(1, null, true), null);
  assert.equal(gesture.anchor, null);
});

test('ghost includes the entire elbow and clears on cancellation', () => {
  const ghost = createWallPlacementGhost(), result = preview();
  ghost.update(result.preview, { valid: true, halfX: 4, halfZ: 4, groundHeight: () => 2 });
  assert.equal(ghost.tiles.count, 4); assert.equal(ghost.timber.count, 10); assert.equal(ghost.group.visible, true);
  for (let i = 0; i < ghost.tiles.count; i++) {
    const matrix = new THREE.Matrix4(); ghost.tiles.getMatrixAt(i, matrix);
    assert.equal(matrix.elements[13], Math.fround(2.06));
  }
  ghost.update(null, {}); assert.equal(ghost.group.visible, false); assert.equal(ghost.tiles.count, 0);
});

test('all sixteen ghost connection masks fit center pivots and cell-edge seams', () => {
  const ghost = createWallPlacementGhost(), directions = ['north', 'east', 'south', 'west'];
  for (let mask = 0; mask < 16; mask++) {
    ghost.update({ pieces: [{ column: 0, row: 0, existing: false,
      connections: directions.filter((_, i) => mask & 1 << i) }] }, { valid: true, halfX: 0.5, halfZ: 0.5, groundHeight: () => 0 });
    for (let i = 0; i < ghost.timber.count; i++) {
      const matrix = new THREE.Matrix4(); ghost.timber.getMatrixAt(i, matrix);
      const bounds = new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5)).applyMatrix4(matrix);
      assert.ok(bounds.min.x >= -0.500001 && bounds.max.x <= 0.500001);
      assert.ok(bounds.min.z >= -0.500001 && bounds.max.z <= 0.500001);
      assert.ok(bounds.min.y >= -0.000001 && bounds.max.y <= 1.400001);
    }
  }
});

test('largest two-point drag stays inside the fixed instance capacity', () => {
  const result = preview({ width: 256, height: 256, points: [cell(0, 0), cell(255, 255)], balance: { food: 0, wood: 10000 } });
  const ghost = createWallPlacementGhost();
  ghost.update(result.preview, { valid: true, halfX: 128, halfZ: 128, groundHeight: () => 0 });
  assert.equal(ghost.tiles.count, 511); assert.equal(ghost.timber.count, 1531);
  assert.ok(ghost.timber.count <= ghost.timber.instanceMatrix.count);
});
