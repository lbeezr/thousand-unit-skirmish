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

// Accepted focused building-target Attack. The building footprint and weapon
// policy keep their selected goal; only travel uses the shared military body.
export function focusedBuildingAttackMovementActive(unit) {
  return militaryCombatant(unit, UNIT_DEFINITIONS[unit.kind]) === true && unit.hp > 0
    && unit.movementDomain !== 'water' && !unit.attackMove && !unit.holdingPosition
    && Number.isSafeInteger(unit.attackBuildingTargetId) && unit.attackBuildingTargetId >= 0
    && !(unit.attackTargetId >= 0) && !unit.stanceCombat && !unit.stanceReturning
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

// Automatic Aggressive/Defensive unit pursuit keeps combat's selected range
// route and fixed anchor. Return, stationary stances and persistent orders
// retain their policies; this only selects the shared military land body.
export function stanceAcquiredMovementActive(unit) {
  return unit.stanceCombat === true && unit.attackMove === true && !unit.stanceReturning
    && ['aggressive', 'defensive'].includes(unit.combatStance)
    && militaryCombatant(unit, UNIT_DEFINITIONS[unit.kind]) === true && unit.hp > 0
    && unit.movementDomain !== 'water' && !unit.holdingPosition
    && Number.isSafeInteger(unit.attackTargetId) && unit.attackTargetId >= 0
    && !(unit.attackBuildingTargetId >= 0) && !unit.persistentOrder
    && unit.gatherNodeId == null && !(unit.gatherForestCell >= 0) && !unit.gatherPhase
    && (unit.buildingTargetId == null || unit.buildingTargetId < 0);
}

// Persistent Patrol's target-free travel/continuation. The existing controller
// chooses each leg's cell; acquired pursuit and Follow have separate predicates.
export function patrolTravelMovementActive(unit) {
  return unit.persistentOrder?.type === 'patrol'
    && militaryCombatant(unit, UNIT_DEFINITIONS[unit.kind]) === true && unit.hp > 0
    && unit.movementDomain !== 'water' && !unit.holdingPosition
    && !(unit.attackTargetId >= 0) && !(unit.attackBuildingTargetId >= 0)
    && !unit.stanceCombat && !unit.stanceReturning
    && unit.gatherNodeId == null && !(unit.gatherForestCell >= 0) && !unit.gatherPhase
    && (unit.buildingTargetId == null || unit.buildingTargetId < 0);
}

// Friendly Follow's target-free catch-up. The existing persistent controller
// owns leader generation, offset, deadband and replanning; publication is shared.
export function followTravelMovementActive(unit) {
  return unit.persistentOrder?.type === 'follow'
    && militaryCombatant(unit, UNIT_DEFINITIONS[unit.kind]) === true && unit.hp > 0
    && unit.movementDomain !== 'water' && !unit.holdingPosition && !unit.attackMove
    && !(unit.attackTargetId >= 0) && !(unit.attackBuildingTargetId >= 0)
    && !unit.stanceCombat && !unit.stanceReturning
    && unit.gatherNodeId == null && !(unit.gatherForestCell >= 0) && !unit.gatherPhase
    && (unit.buildingTargetId == null || unit.buildingTargetId < 0);
}

// Explicit Worker Follow replaces productive work while retaining carried
// cargo. Its original leader/offset controller uses the shared Worker body.
export function workerFollowTravelMovementActive(unit) {
  return unit.kind === 'worker' && unit.persistentOrder?.type === 'follow' && unit.hp > 0
    && unit.movementDomain !== 'water' && !unit.holdingPosition && !unit.attackMove
    && !(unit.attackTargetId >= 0) && !(unit.attackBuildingTargetId >= 0)
    && !unit.stanceCombat && !unit.stanceReturning
    && unit.gatherNodeId == null && !(unit.gatherForestCell >= 0) && !unit.gatherPhase
    && (unit.buildingTargetId == null || unit.buildingTargetId < 0);
}

// Patrol cancellation retains its target-free AttackMove objective. Derive
// the Worker body from that same existing intent, including direct objectives;
// acquired pursuit and productive work retain their separate policies.
export function workerPatrolObjectiveMovementActive(unit) {
  return unit.kind === 'worker' && unit.hp > 0
    && (unit.persistentOrder?.type === 'patrol' || (unit.attackMove === true && !unit.persistentOrder))
    && unit.movementDomain !== 'water' && !unit.holdingPosition
    && !(unit.attackTargetId >= 0) && !(unit.attackBuildingTargetId >= 0)
    && !unit.stanceCombat && !unit.stanceReturning
    && unit.gatherNodeId == null && !(unit.gatherForestCell >= 0) && !unit.gatherPhase
    && (unit.buildingTargetId == null || unit.buildingTargetId < 0);
}

// Patrol's acquired unit-target leg uses its original acquisition anchor and
// bounded approach. Automatic stance and friendly Follow remain separate.
export function patrolAcquiredMovementActive(unit) {
  return unit.persistentOrder?.type === 'patrol' && unit.attackMove === true
    && militaryCombatant(unit, UNIT_DEFINITIONS[unit.kind]) === true && unit.hp > 0
    && unit.movementDomain !== 'water' && !unit.holdingPosition
    && Number.isSafeInteger(unit.attackTargetId) && unit.attackTargetId >= 0
    && !(unit.attackBuildingTargetId >= 0) && !unit.stanceCombat && !unit.stanceReturning
    && unit.gatherNodeId == null && !(unit.gatherForestCell >= 0) && !unit.gatherPhase
    && (unit.buildingTargetId == null || unit.buildingTargetId < 0);
}
