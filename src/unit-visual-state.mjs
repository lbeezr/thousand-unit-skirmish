export function unitActionPoseAllowed(hp, defeatStartedAt) {
  return hp > 0 && !(defeatStartedAt > 0);
}
export function unitWorkerActionPose(kind, visible, task, cargoType, walking) {
  if (kind !== 'worker' || visible === false || walking) return 'none';
  if (task === 'building') return 'construction';
  if (task !== 'gathering') return 'none';
  if (cargoType === 'wood') return 'chopping';
  if (cargoType === 'food') return 'berry-gathering';
  return 'gathering';
}
export function unitCargoVisualState(kind, hp, visible, cargo, cargoType) {
  if (kind !== 'worker' || !(hp > 0) || visible === false
    || !Number.isFinite(cargo) || cargo <= 0) return 'none';
  return cargoType === 'wood' || cargoType === 'food' ? cargoType : 'unknown';
}
