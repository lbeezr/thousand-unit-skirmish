import { militaryCombatant } from './combat-stance.mjs';
import { UNIT_DEFINITIONS } from './gameplay-definitions.mjs';

// Explicit AttackMove objective travel, including pending planning. Target
// pursuit and automatic stance/persistent continuations retain their policies.
export function attackMoveObjectiveMovementActive(unit) {
  return unit.attackMove === true && militaryCombatant(unit, UNIT_DEFINITIONS[unit.kind]) === true && unit.hp > 0
    && unit.movementDomain !== 'water' && !unit.holdingPosition
    && !(unit.attackTargetId >= 0) && !(unit.attackBuildingTargetId >= 0)
    && !unit.stanceCombat && !unit.stanceReturning && !unit.persistentOrder
    && unit.gatherNodeId == null && !(unit.gatherForestCell >= 0) && !unit.gatherPhase
    && (unit.buildingTargetId == null || unit.buildingTargetId < 0);
}

// Accepted focused unit-target Attack. The target/weapon policy chooses the
// route; this predicate only selects the shared land body for its execution.
export function focusedUnitAttackMovementActive(unit) {
  return militaryCombatant(unit, UNIT_DEFINITIONS[unit.kind]) === true && unit.hp > 0
    && unit.movementDomain !== 'water' && !unit.attackMove && !unit.holdingPosition
    && Number.isSafeInteger(unit.attackTargetId) && unit.attackTargetId >= 0
    && !(unit.attackBuildingTargetId >= 0) && !unit.stanceCombat && !unit.stanceReturning
    && !unit.persistentOrder && unit.gatherNodeId == null && !(unit.gatherForestCell >= 0)
    && !unit.gatherPhase && (unit.buildingTargetId == null || unit.buildingTargetId < 0);
}

// Explicit AttackMove's acquired unit-target leg, under its existing anchor
// and stance bounds. Automatic stance and persistent orders remain separate.
export function attackMoveAcquiredMovementActive(unit) {
  return unit.attackMove === true && militaryCombatant(unit, UNIT_DEFINITIONS[unit.kind]) === true && unit.hp > 0
    && unit.movementDomain !== 'water' && !unit.holdingPosition
    && Number.isSafeInteger(unit.attackTargetId) && unit.attackTargetId >= 0
    && !(unit.attackBuildingTargetId >= 0) && !unit.stanceCombat && !unit.stanceReturning
    && !unit.persistentOrder && unit.gatherNodeId == null && !(unit.gatherForestCell >= 0)
    && !unit.gatherPhase && (unit.buildingTargetId == null || unit.buildingTargetId < 0);
}
