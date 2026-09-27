// Only summarize living friendlies: never turn inspected or stale IDs into commands.
export function selectionContext(units, ids, team, building = null) {
  const living = [...ids].map((id) => units[id]).filter((unit) => unit && unit.hp > 0 && unit.team === team);
  const counts = { worker: 0, infantry: 0, archer: 0 };
  const cargo = { food: 0, wood: 0 };
  for (const unit of living) {
    if (unit.kind in counts) counts[unit.kind]++;
    if (unit.kind === 'worker' && unit.cargoType in cargo) cargo[unit.cargoType] += Math.max(0, unit.cargo || 0);
  }
  const friendlyBuilding = building?.team === team ? building : null;
  const kind = friendlyBuilding ? 'building' : !living.length ? 'none'
    : counts.worker === living.length ? 'workers' : counts.worker ? 'mixed' : 'military';
  return { kind, counts, cargo, total: living.length, building: friendlyBuilding };
}
