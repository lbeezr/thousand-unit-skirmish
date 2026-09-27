import assert from 'node:assert/strict';
import {
  UNIT_LOD_ROLE_BITS, UNIT_LOD_ROLES, shouldUpdateUnitFocusMatrix,
  shouldUpdateUnitFullDetailTint, shouldUpdateUnitTransformForFrame,
  unitLodRoleMatrixUpdateMask,
} from '../src/unit-lod-state.mjs';

const allRoleBits = UNIT_LOD_ROLES.reduce((mask, role) => mask | UNIT_LOD_ROLE_BITS[role], 0);
assert.equal(unitLodRoleMatrixUpdateMask(null, 'worker'), allRoleBits,
  'first LOD activation must initialize the active role and clear unused role slots');
assert.equal(unitLodRoleMatrixUpdateMask('infantry', 'infantry'), UNIT_LOD_ROLE_BITS.infantry,
  'a stable role only needs its active role matrix rewritten');
assert.equal(unitLodRoleMatrixUpdateMask('worker', 'archer'),
  UNIT_LOD_ROLE_BITS.worker | UNIT_LOD_ROLE_BITS.archer,
  'a role change must clear the old role and write the new role');
assert.equal(unitLodRoleMatrixUpdateMask('unexpected', 'worker'), allRoleBits,
  'an unknown prior role must initialize all role slots safely');
assert.equal(unitLodRoleMatrixUpdateMask('worker', 'unexpected'), 0,
  'an invalid current role must not write an unknown batch');
assert.equal(shouldUpdateUnitFullDetailTint(true), false,
  'full-detail tints should not be written while role LOD is active');
assert.equal(shouldUpdateUnitFullDetailTint(false), true,
  'full-detail tints should be written when full-detail units are active');
assert.equal(shouldUpdateUnitTransformForFrame(true, false, true), false,
  'low-detail units should skip full-detail-only work, combat, and idle pose updates');
assert.equal(shouldUpdateUnitTransformForFrame(true, true, false), true,
  'low-detail units should still refresh when position, facing, spawn, or defeat changes');
assert.equal(shouldUpdateUnitTransformForFrame(false, false, true), true,
  'full-detail units should keep work, combat, and idle pose updates');
assert.equal(shouldUpdateUnitTransformForFrame(false, false, false), false,
  'unchanged units should not rewrite their transform batches');
assert.equal(shouldUpdateUnitFocusMatrix(false, false, false, 0, 0, 0, 0, 0, 0), true,
  'focus matrices should initialize once');
assert.equal(shouldUpdateUnitFocusMatrix(true, true, true, 4, 7, 1, 4, 7, 1), false,
  'a stable focused unit should not rewrite its focus matrix');
assert.equal(shouldUpdateUnitFocusMatrix(true, true, true, 4, 7, 1, 4, 7, 1.1), true,
  'a changed focus scale should rewrite the focus matrix');
assert.equal(shouldUpdateUnitFocusMatrix(true, true, true, 4, 7, 1, 4.5, 7, 1), true,
  'a moving focused unit should rewrite the focus matrix');
assert.equal(shouldUpdateUnitFocusMatrix(true, true, false, 4, 7, 1, 4, 7, 0), true,
  'a lost focus state should clear the focus matrix');
assert.equal(shouldUpdateUnitFocusMatrix(true, false, false, 4, 7, 0, 8, 9, 0), false,
  'unfocused units should not rewrite their invisible focus matrix while moving');

process.stdout.write('Unit LOD state scenario passed: stable roles write one role batch, transitions clear old slots, and LOD skips full-detail-only updates.\n');
