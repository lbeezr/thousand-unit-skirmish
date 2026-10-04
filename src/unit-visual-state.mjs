import { compatibleWorkerWorkAction } from './worker-work-presentation.mjs';

export function unitActionPoseAllowed(hp, defeatStartedAt) {
  return hp > 0 && !(defeatStartedAt > 0);
}
export function unitWorkerActionPose(kind, visible, task, performingAction, walking) {
  if (kind !== 'worker' || visible === false || walking) return 'none';
  const work = compatibleWorkerWorkAction(task, performingAction);
  if (work === 'build' || work === 'repair') return 'construction';
  if (work === 'gather-wood') return 'chopping';
  if (work === 'gather-food') return 'berry-gathering';
  return work === 'gather-stone' ? 'gathering' : 'none';
}
export function unitCargoVisualState(kind, hp, visible, cargo, cargoType) {
  if (kind !== 'worker' || !(hp > 0) || visible === false
    || !Number.isFinite(cargo) || cargo <= 0) return 'none';
  return ['wood', 'food', 'stone'].includes(cargoType) ? cargoType : 'unknown';
}
