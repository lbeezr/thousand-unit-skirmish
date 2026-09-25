import assert from 'node:assert/strict';
import {
  UNIT_LOD_ROLE_BITS, UNIT_LOD_ROLES, shouldUpdateUnitFullDetailTint,
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

process.stdout.write('Unit LOD state scenario passed: stable roles write one role batch, transitions clear old slots, and full-detail tints skip low-detail mode.\n');
