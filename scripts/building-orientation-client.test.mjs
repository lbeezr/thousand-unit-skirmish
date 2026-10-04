import test from 'node:test';
import assert from 'node:assert/strict';
import { constructionClientFixture } from './construction-client-fixture.mjs';
const units = [{ id: 0, team: 0, hp: 100, kind: 'worker', generation: 12 }];
const setup = () => constructionClientFixture({ units, selection: [0] });

test('real placement functions serialize the chosen facing once and freeze it while pending', () => {
  const f = setup(); f.context.beginBuildPlacement('house');
  assert.equal(f.context.buildPlacementOrientation, 0);
  f.context.rotateBuildPlacement(-1); assert.equal(f.context.buildPlacementOrientation, 3);
  f.context.submitBuildPlacement(10, 20);
  assert.deepEqual(f.payloads[0], { type: 'build', buildingType: 'house', ids: [0], x: -16.5, z: 10.5,
    orientation: 3, unitGenerations: [12], clientOrderToken: 1 });
  assert.equal(f.context.buildPlacementPending, true);
  f.context.rotateBuildPlacement(1); f.context.submitBuildPlacement(20, 30);
  assert.equal(f.context.buildPlacementOrientation, 3); assert.equal(f.payloads.length, 1);
  f.context.cancelBuildPlacement(false);
  assert.equal(f.context.buildPlacementActive, false); assert.equal(f.context.pendingBuildingPlacement, null);
  assert.equal(f.context.placementGhost.visible, false);
  f.context.beginBuildPlacement('house'); assert.equal(f.context.buildPlacementOrientation, 0);
});

test('UI capture, invalid sites and fixed-facing types cannot emit a rotated paid request', () => {
  const f = setup(); f.context.beginBuildPlacement('house');
  f.context.wallPointerCell = () => null;
  f.context.submitBuildPlacement(0, 0); assert.equal(f.payloads.length, 0);
  f.context.wallPointerCell = () => ({ column: 1, row: 1 });
  f.context.buildPlacementAt = () => ({ valid: false, blockedReason: 'Existing building' });
  f.context.submitBuildPlacement(0, 0); assert.equal(f.payloads.length, 0);
  f.context.beginBuildPlacement('farm'); f.context.rotateBuildPlacement(1);
  assert.equal(f.context.buildPlacementOrientation, 0); assert.equal(f.context.buildPlacementPending, false);
});
