// Diagnostic success requires actual arrival, including empty-path outcomes.
export function arrivedAtMoveGoal(unit, goal) {
  return !unit.movePlanningPending && unit.pathIndex === unit.path.length
    && unit.moveGoalCell >= 0 && Math.hypot(unit.x - goal.x, unit.z - goal.z) < .02;
}
