import { UNIT_DEFINITIONS } from './gameplay-definitions.mjs';
import { sumTypedCargo } from './economy-client.mjs';

// Only summarize living friendlies: never turn inspected or stale IDs into commands.
export function selectionContext(units, ids, team, building = null, economyProfileId) {
  const living = [...ids].map((id) => units[id]).filter((unit) => unit && unit.hp > 0 && unit.team === team);
  const counts = Object.fromEntries(Object.keys(UNIT_DEFINITIONS).map((kind) => [kind, 0]));
  const cargo = sumTypedCargo(living.filter(unit => UNIT_DEFINITIONS[unit.kind]?.capabilities.includes('gather')), economyProfileId);
  let workerCount = 0;
  let boatCount = 0;
  for (const unit of living) {
    if (Object.hasOwn(counts, unit.kind)) counts[unit.kind]++;
    const gathers = UNIT_DEFINITIONS[unit.kind]?.capabilities.includes('gather');
    const water = UNIT_DEFINITIONS[unit.kind]?.movementDomain === 'water';
    if (water) boatCount++;
    if (gathers && !water) workerCount++;
  }
  const friendlyBuilding = building?.team === team ? building : null;
  const kind = friendlyBuilding ? 'building' : !living.length ? 'none'
    : boatCount === living.length ? 'boats' : boatCount ? 'mixed'
      : workerCount === living.length ? 'workers' : workerCount ? 'mixed' : 'military';
  return { kind, counts, cargo, total: living.length, building: friendlyBuilding };
}
