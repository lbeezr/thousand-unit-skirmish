import { UNIT_DEFINITIONS } from '../../../gameplay-definitions.mjs';

export const PVE_REGROUP_LIMITS = Object.freeze({ units: 5, maxWaitTicks: 3600, retryTicks: 300 });
const key = unit => `${unit.id}:${unit.generation}`;

/** Rebuild one small combat group after a wipeout, using only owned state. */
export function createRegroupPolicy() {
  const limits = PVE_REGROUP_LIMITS, ordered = new Map(), preservingCombat = new Set();
  let previousCount = null, active = false, point = null, deadline = null;
  return {
    next(observation, soldiers, defenders = []) {
      const combat = soldiers.filter(unit => unit.team === observation.team && unit.hp > 0
        && unit.kind !== 'worker'
        && UNIT_DEFINITIONS[unit.kind]?.capabilities.includes('attack')
        && !UNIT_DEFINITIONS[unit.kind]?.tags.some(tag => ['scout', 'siege'].includes(tag)));
      // A restored opponent has no loss history. An owned producer/foundation
      // and small current army provide a bounded recovery opening instead.
      const recoveringOnResume = previousCount === null && observation.tick > 0 && combat.length < limits.units
        && observation.buildings?.friendly.some(building => building.team === observation.team && building.hp > 0
          && building.type === 'barracks');
      if (previousCount > 0 && combat.length === 0 || recoveringOnResume) {
        active = true; point = null; deadline = null; ordered.clear(); preservingCombat.clear();
      }
      previousCount = combat.length;
      const fighting = unit => unit.focusedCount > 0 || (unit.lastAttack && observation.tick - unit.lastAttack.tick >= 0
        && observation.tick - unit.lastAttack.tick < 120);
      const protectedUnits = combat.filter(unit => preservingCombat.has(key(unit)) && fighting(unit));
      const protectedKeys = new Set(protectedUnits.map(key));
      for (const identity of preservingCombat) if (!protectedKeys.has(identity)) preservingCombat.delete(identity);
      if (!active) return { units: protectedUnits, commands: [] };
      const defending = new Set(defenders.map(key));
      const waiting = combat.filter(unit => !defending.has(key(unit))).sort((a, b) => a.id - b.id);
      if (waiting.length === 0) return { units: [], commands: [] };
      point ??= { x: waiting[0].x, z: waiting[0].z };
      deadline ??= observation.tick + limits.maxWaitTicks;
      if (waiting.length >= limits.units || observation.tick >= deadline) {
        active = false; point = null; deadline = null; ordered.clear();
        const busy = waiting.filter(fighting);
        for (const unit of busy) preservingCombat.add(key(unit));
        return { units: busy, commands: [] };
      }
      const liveKeys = new Set(waiting.map(key));
      for (const identity of ordered.keys()) if (!liveKeys.has(identity)) ordered.delete(identity);
      const issued = waiting.filter(unit => {
        const previous = ordered.get(key(unit));
        if (fighting(unit)) return false;
        const arrived = Math.hypot(unit.x - point.x, unit.z - point.z) <= 2;
        const progressing = previous && Math.hypot(unit.x - previous.x, unit.z - previous.z) >= 0.5;
        if (previous && (arrived || progressing || observation.tick < previous.tick)) {
          ordered.set(key(unit), { x: unit.x, z: unit.z, tick: observation.tick });
          return false;
        }
        if (!previous || observation.tick - previous.tick >= limits.retryTicks) {
          ordered.set(key(unit), { x: unit.x, z: unit.z, tick: observation.tick });
          return true;
        }
        return false;
      });
      return { units: waiting, commands: issued.length ? [{ type: 'move', ids: issued.map(unit => unit.id),
        unitGenerations: issued.map(unit => unit.generation), ...point }] : [] };
    },
  };
}
