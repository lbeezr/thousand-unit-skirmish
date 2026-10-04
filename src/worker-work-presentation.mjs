import { WORKER_PERFORMING_ACTION_VERSION, WORKER_PERFORMING_ACTIONS } from './worker-performing-action.mjs';

export function compatibleWorkerWorkAction(task, action) {
  if (!WORKER_PERFORMING_ACTIONS.includes(action)) return null;
  if (action.startsWith('gather-')) return task === 'gathering' ? action : null;
  return (action === 'build' && task === 'building') || (action === 'repair' && task === 'repairing')
    ? action : null;
}

export function readWorkerPerformingAction(version, kind, hp, task, action) {
  if (version !== WORKER_PERFORMING_ACTION_VERSION || kind !== 'worker' || !(hp > 0)) return null;
  return compatibleWorkerWorkAction(task, action);
}

// The local field is populated only by version-aware snapshot receipt. Intent,
// cargo differences and presentation clocks never create confirmed activity.
export function workerWorkAction(unit) {
  if (unit.kind !== 'worker' || !(unit.hp > 0) || unit.visible === false) return null;
  return compatibleWorkerWorkAction(unit.task, unit.performingAction);
}

export function workerWorkResource(unit) {
  const action = workerWorkAction(unit);
  return action?.startsWith('gather-') ? action.slice('gather-'.length) : null;
}
