import { UNIT_DEFINITIONS } from '../../../gameplay-definitions.mjs';

export const PVE_HOME_DEFENSE_LIMITS = Object.freeze({ radius: 12, units: 4, retryTicks: 300, maxRetryTicks: 1800, recentCombatTicks: 120 });
const key = unit => `${unit.id}:${unit.generation}`;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** A bounded detachment reacts only to observed military threats to owned assets. */
export function createHomeDefensePolicy() {
  const orders = new Map(), limits = PVE_HOME_DEFENSE_LIMITS;
  return {
    next(observation, soldiers) {
      const eligible = soldiers.filter(unit => unit.team === observation.team && unit.hp > 0 && unit.kind !== 'worker'
        && !UNIT_DEFINITIONS[unit.kind]?.tags.some(tag => ['scout', 'siege'].includes(tag))
        && UNIT_DEFINITIONS[unit.kind]?.capabilities.includes('attack'));
      const assets = [...observation.units.friendly.filter(unit => unit.team === observation.team && unit.hp > 0 && unit.kind === 'worker'),
        ...(observation.buildings?.friendly || []).filter(building => building.team === observation.team && building.hp > 0)];
      const threats = observation.units.visibleEnemies.filter(unit => unit.team !== observation.team && unit.hp > 0 && unit.kind !== 'worker'
        && UNIT_DEFINITIONS[unit.kind]?.capabilities.includes('attack')).map(unit => ({ unit,
        distance: Math.min(...assets.map(asset => distance(unit, asset))) })).filter(threat => threat.distance <= limits.radius)
        .sort((a, b) => a.distance - b.distance || a.unit.id - b.unit.id);
      const threat = threats[0]?.unit;
      if (!threat) {
        const released = eligible.filter(unit => orders.has(key(unit)));
        orders.clear();
        return { units: [], commands: [], released };
      }
      // Keep surviving responders on the job; replacement slots are chosen by
      // observed distance and identity, rather than swapping marching units.
      const selected = eligible.filter(unit => orders.has(key(unit))).sort((a, b) => a.id - b.id);
      selected.push(...eligible.filter(unit => !orders.has(key(unit))).sort((a, b) => distance(a, threat) - distance(b, threat) || a.id - b.id)
        .slice(0, Math.max(0, limits.units - selected.length)));
      selected.sort((a, b) => a.id - b.id);
      const active = new Set(selected.map(key));
      for (const identity of orders.keys()) if (!active.has(identity)) orders.delete(identity);
      const issued = [];
      for (const unit of selected) {
        const previous = orders.get(key(unit)), tick = observation.tick;
        const fighting = unit.focusedCount > 0 || (unit.lastAttack && tick - unit.lastAttack.tick >= 0
          && tick - unit.lastAttack.tick < limits.recentCombatTicks);
        const progressing = previous && distance(unit, previous) >= 0.5;
        const arrived = previous && distance(unit, previous.point) <= 2 && distance(threat, previous.point) < 4;
        if (previous && (progressing || fighting || arrived || tick < previous.sinceTick)) {
          previous.x = unit.x; previous.z = unit.z; previous.sinceTick = tick; previous.retryTicks = limits.retryTicks;
        }
        const changed = previous && (previous.pending || previous.target !== key(threat) || distance(threat, previous.point) >= 4);
        const stalled = previous && tick - previous.sinceTick >= previous.retryTicks;
        if (!previous || !fighting && (changed || stalled)) {
          orders.set(key(unit), { target: key(threat), pending: fighting, point: { x: threat.x, z: threat.z }, x: unit.x, z: unit.z,
            sinceTick: tick, retryTicks: stalled && !changed ? Math.min(previous.retryTicks * 2, limits.maxRetryTicks) : limits.retryTicks });
          if (!fighting) issued.push(unit);
        }
      }
      return { units: selected, released: [], commands: issued.length ? [{ type: 'attackMove', ids: issued.map(unit => unit.id),
        unitGenerations: issued.map(unit => unit.generation), x: threat.x, z: threat.z }] : [] };
    },
  };
}
