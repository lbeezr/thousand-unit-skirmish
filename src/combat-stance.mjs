export const COMBAT_STANCES = Object.freeze(['aggressive', 'defensive', 'standGround', 'noAttack']);

export function militaryCombatant(unit, definition) {
  return unit.kind !== 'worker' && definition?.capabilities.includes('attack');
}

export function combatStancePolicy(stance, range) {
  if (stance === 'noAttack') return { acquire: 0, leash: 0, travel: 0, returns: false };
  if (stance === 'standGround') return { acquire: range, leash: range, travel: 0, returns: false };
  if (stance === 'defensive') return { acquire: Math.max(3, range), leash: 3 + range, travel: 3, returns: true };
  return { acquire: 4.8, leash: 8, travel: 8, returns: false };
}

export function initializeCombatStance(unit, definition, legacy = false) {
  const eligible = militaryCombatant(unit, definition);
  unit.combatStance = eligible ? (legacy
    ? unit.holdingPosition ? 'standGround'
      : unit.attackMove || unit.attackTargetId >= 0 || unit.attackBuildingTargetId >= 0 ? 'aggressive' : 'noAttack'
    : 'aggressive') : null;
  unit.stanceAnchorX = unit.x;
  unit.stanceAnchorZ = unit.z;
  unit.stanceCombat = false;
  unit.stanceReturning = false;
  return unit;
}

export function validCombatStanceState(unit, definition) {
  return (militaryCombatant(unit, definition) ? COMBAT_STANCES.includes(unit.combatStance) : unit.combatStance === null)
    && Number.isFinite(unit.stanceAnchorX) && Number.isFinite(unit.stanceAnchorZ)
    && typeof unit.stanceCombat === 'boolean' && typeof unit.stanceReturning === 'boolean'
    && (militaryCombatant(unit, definition) || (!unit.stanceCombat && !unit.stanceReturning))
    && (!unit.stanceCombat || (unit.attackMove && unit.combatStance !== 'noAttack'))
    && (!unit.stanceReturning || (unit.stanceCombat && unit.combatStance === 'defensive'
      && unit.attackTargetId < 0 && unit.attackBuildingTargetId < 0));
}

export function migrateCombatStanceCheckpoint(snapshot, definitions) {
  if (snapshot?.schemaVersion === 23 && Array.isArray(snapshot.state?.units)) {
    for (const unit of snapshot.state.units) if (unit && definitions[unit.kind]) {
      initializeCombatStance(unit, definitions[unit.kind], true);
    }
    snapshot.schemaVersion = 24;
  }
  return snapshot;
}
