// World yaw: zero points along +Z; positive angles turn toward +X.
// Keep the last heading when a target overlaps the unit instead of turning on jitter.
export function headingToTarget(x, z, targetX, targetZ) {
  if (![x, z, targetX, targetZ].every(Number.isFinite)) return null;
  const dx = targetX - x;
  const dz = targetZ - z;
  return Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001 ? Math.atan2(dx, dz) : null;
}
