import { workerEconomyBodyRadius } from './unit-movement.mjs';

export const WORKER_PERIMETER_RECOVERY_LIMITS = Object.freeze({ stalledTicks: 30,
  progress: .02, attempts: 8, cooldownTicks: 30, units: 2000 });

// Transient observations only. The host supplies a fresh owned economy target
// outside interaction range and performs bounded physical queries/publication.
export function createWorkerPerimeterRecovery() {
  const observations = new Map();
  let cursor = 0, lastTick = -1, epoch = -1, navigation = -1;
  const signature = (unit, target) => [unit.generation, unit.orderRevision,
    unit.gatherPhase, unit.gatherNodeId, unit.gatherForestCell, unit.cargoType,
    unit.cargo, unit.dropoffBuildingId, unit.moveGoalCell, target.building];
  const same = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);
  return {
    run({ units, tick, movePlanningEpoch, navigationRevision, targetFor, attempt }) {
      const result = { observed: 0, attempts: 0, repaired: 0 };
      if (!Array.isArray(units) || units.length > WORKER_PERIMETER_RECOVERY_LIMITS.units
        || !Number.isSafeInteger(tick) || tick < 0) return result;
      if (tick === lastTick && epoch === movePlanningEpoch && navigation === navigationRevision) return result;
      if (tick !== lastTick + 1 || epoch !== movePlanningEpoch || navigation !== navigationRevision) {
        observations.clear(); cursor = 0;
      }
      lastTick = tick; epoch = movePlanningEpoch; navigation = navigationRevision;
      const seen = new Set(), due = new Map();
      for (let index = 0; index < units.length; index++) {
        const unit = units[index];
        if (!unit || unit.id !== index || !workerEconomyBodyRadius(unit) || unit.movePlanningPending
          || !Array.isArray(unit.path) || !unit.path.length || unit.path.at(-1) !== unit.moveGoalCell
          || !Number.isFinite(unit.x) || !Number.isFinite(unit.z)) continue;
        const target = targetFor(unit);
        if (!target) continue;
        seen.add(unit); result.observed++;
        const identity = signature(unit, target);
        let observation = observations.get(unit);
        if (!observation || !same(observation.identity, identity)) {
          observation = { identity, x: unit.x, z: unit.z, stalled: 0, nextTick: tick };
          observations.set(unit, observation);
        } else if (Math.hypot(unit.x - observation.x, unit.z - observation.z)
          >= WORKER_PERIMETER_RECOVERY_LIMITS.progress) {
          observation.x = unit.x; observation.z = unit.z; observation.stalled = 0;
        } else observation.stalled = Math.min(WORKER_PERIMETER_RECOVERY_LIMITS.stalledTicks, observation.stalled + 1);
        if (observation.stalled >= WORKER_PERIMETER_RECOVERY_LIMITS.stalledTicks && tick >= observation.nextTick)
          due.set(index, { unit, target, observation });
      }
      for (const unit of observations.keys()) if (!seen.has(unit)) observations.delete(unit);
      // Advance even on occupied-with-no-alternative or budget deferral. A
      // permanently blocked early actor cannot monopolize the next tick.
      for (let count = 0, start = cursor % Math.max(1, units.length); count < units.length; count++) {
        const index = (start + count) % units.length, entry = due.get(index);
        if (!entry) continue;
        cursor = (index + 1) % units.length;
        entry.observation.nextTick = tick + WORKER_PERIMETER_RECOVERY_LIMITS.cooldownTicks;
        result.attempts++;
        if (attempt(entry.unit, entry.target)?.status === 'ready') result.repaired++;
        if (result.attempts === WORKER_PERIMETER_RECOVERY_LIMITS.attempts) break;
      }
      return result;
    },
  };
}
