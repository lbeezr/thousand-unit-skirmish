export const UNIT_LOD_ROLES = Object.freeze(['worker', 'infantry', 'archer']);
export const UNIT_LOD_ROLE_BITS = Object.freeze({ worker: 1, infantry: 2, archer: 4 });
const ALL_UNIT_LOD_ROLE_BITS = UNIT_LOD_ROLES.reduce((mask, role) => mask | UNIT_LOD_ROLE_BITS[role], 0);

export function unitLodRoleMatrixUpdateMask(previousRole, currentRole) {
  const currentBit = UNIT_LOD_ROLE_BITS[currentRole] || 0;
  if (!currentBit) return 0;
  const previousBit = UNIT_LOD_ROLE_BITS[previousRole] || 0;
  return previousBit ? previousBit | currentBit : ALL_UNIT_LOD_ROLE_BITS;
}

export function shouldUpdateUnitFullDetailTint(lowDetailActive) {
  return !lowDetailActive;
}

export function shouldUpdateUnitTransformForFrame(
  lowDetailActive, transformChanged, fullDetailAnimationDue,
) {
  return transformChanged || (!lowDetailActive && fullDetailAnimationDue);
}
