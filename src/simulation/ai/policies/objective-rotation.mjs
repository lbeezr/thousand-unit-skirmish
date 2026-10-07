export const PVE_OBJECTIVE_ROTATION_LIMITS = Object.freeze({ stallTicks: 1800,
  cooldownTicks: 3600, recentCombatTicks: 120, rememberedTargets: 4 });

/** Rotate stalled public capture goals; no terrain/path/rejection oracle is used. */
export function createObjectiveRotationPolicy() {
  const cooldowns = new Map();
  let watch = null, previousTick = null;
  return {
    next(observation, soldiers, rankedTargets) {
      const tick = observation.tick, limits = PVE_OBJECTIVE_ROTATION_LIMITS;
      if (previousTick !== null && tick < previousTick) { watch = null; cooldowns.clear(); }
      previousTick = tick;
      const eligible = new Set(rankedTargets.map(target => target.id));
      for (const [id, until] of cooldowns) if (!eligible.has(id) || tick >= until) cooldowns.delete(id);
      const available = rankedTargets.filter(target => !cooldowns.has(target.id));
      let target = (available.length ? available : rankedTargets)[0];
      if (!target || !soldiers.length) { watch = null; return target || null; }
      const distanceTo = goal => Math.min(...soldiers.map(unit => Math.hypot(unit.x - goal.point.x, unit.z - goal.point.z)));
      const progressing = goal => {
        const objective = observation.objectives.find(item => item.id === goal.id);
        const inside = soldiers.some(unit => {
          const column = Math.floor(unit.x + observation.map.width / 2), row = Math.floor(unit.z + observation.map.height / 2);
          const zone = objective?.zone;
          return zone && column >= zone.column && column < zone.column + zone.width
            && row >= zone.row && row < zone.row + zone.height;
        });
        const fighting = soldiers.some(unit => unit.focusedCount > 0 || (unit.lastAttack
          && tick - unit.lastAttack.tick >= 0 && tick - unit.lastAttack.tick < limits.recentCombatTicks));
        const capturing = objective?.progressTeam === observation.team && objective.progress > 0;
        const distance = distanceTo(goal);
        if (!inside && !fighting && !capturing && !(distance < watch.bestDistance - .5)) return false;
        watch.bestDistance = distance; watch.progressTick = tick;
        return true;
      };
      // Expiry makes the old goal available; it must not cancel healthy pressure
      // on the alternative, including the bounded window after a real approach.
      const current = watch?.rotated && rankedTargets.find(goal => goal.id === watch.id);
      if (current && current.id !== target.id && (progressing(current) || tick - watch.progressTick < limits.stallTicks)) target = current;
      if (!watch || watch.id !== target.id) {
        watch = { id: target.id, progressTick: tick, bestDistance: distanceTo(target), rotated: false };
        return target;
      }
      if (progressing(target)) return target;
      const alternative = available.find(candidate => candidate.id !== target.id);
      if (!alternative || tick - watch.progressTick < limits.stallTicks) return target;
      cooldowns.set(target.id, tick + limits.cooldownTicks);
      if (cooldowns.size > limits.rememberedTargets) cooldowns.delete(cooldowns.keys().next().value);
      watch = { id: alternative.id, progressTick: tick, bestDistance: distanceTo(alternative), rotated: true };
      return alternative;
    },
  };
}
