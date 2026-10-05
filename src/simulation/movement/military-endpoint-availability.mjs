import { activeMoveGoalPoint, validMoveGoalPoint, LAND_CLEARANCE_PROFILE } from '../../unit-movement.mjs';

export const MILITARY_ENDPOINT_QUERY_VISIT_LIMIT = 64;
const EPSILON = 1e-9;
const finitePoint = point => point && Number.isFinite(point.x) && Number.isFinite(point.z);
const teamIndex = team => team === 0 || team === 1;

// Reserve only ordinary land military intent. Combat/persistent destinations
// need their own target policies; physical body admission remains separate.
function ordinaryMilitaryIntent(unit) {
  return unit.hp > 0 && unit.kind !== 'worker' && unit.movementDomain !== 'water'
    && !unit.holdingPosition && !unit.attackMove && !unit.stanceCombat && !unit.stanceReturning
    && !unit.persistentOrder && !(unit.attackTargetId >= 0) && !(unit.attackBuildingTargetId >= 0)
    && unit.gatherNodeId == null && !(unit.gatherForestCell >= 0)
    && !unit.gatherPhase && unit.buildingTargetId == null;
}

// One command/one synchronous construction phase only. Accepted pending goals
// are already durable on units before planning; no job or route payload scan.
// The consumer rebuilds this snapshot after another operation or cold restore.
export function createOrdinaryMilitaryEndpointAvailability(input) {
  const { units, width, height, maxUnits } = input ?? {};
  const diagnostics = { censusSlots: 0, endpoints: 0, queries: 0, bucketVisits: 0,
    endpointVisits: 0, deferredQueries: 0 };
  const buckets = new Map(), incompleteTeams = new Set();
  const validInput = Array.isArray(units) && Number.isSafeInteger(maxUnits) && maxUnits > 0
    && units.length <= maxUnits && Number.isSafeInteger(width) && width > 0
    && Number.isSafeInteger(height) && height > 0 && Number.isSafeInteger(2 * width * height);
  let incomplete = !validInput;
  const key = (team, column, row) => team * width * height + row * width + column;
  if (validInput) {
    for (let index = 0; index < units.length; index++) {
      diagnostics.censusSlots++;
      const unit = units[index];
      if (!unit || !Number.isFinite(unit.hp)) { incomplete = true; continue; }
      if (!ordinaryMilitaryIntent(unit) || unit.moveGoalCell === -1) continue;
      if (!teamIndex(unit.team)) { incomplete = true; continue; }
      const radius = LAND_CLEARANCE_PROFILE.radiusByKind[unit.kind];
      if (unit.id !== index || !Number.isSafeInteger(unit.generation) || unit.generation < 0
        || !Number.isSafeInteger(unit.orderRevision) || unit.orderRevision < 0
        || !Number.isFinite(radius) || !(radius > 0 && radius <= .5)
        || !Number.isInteger(unit.moveGoalCell) || unit.moveGoalCell < 0 || unit.moveGoalCell >= width * height) {
        incompleteTeams.add(unit.team); continue;
      }
      let position;
      if (unit.moveGoalPoint != null) {
        position = activeMoveGoalPoint(unit);
        // A stale point must never silently acquire a cell-center reservation.
        if (!position || !validMoveGoalPoint(position, unit, width, height)) {
          incompleteTeams.add(unit.team); continue;
        }
      } else {
        position = { x: unit.moveGoalCell % width - width / 2 + .5,
          z: Math.floor(unit.moveGoalCell / width) - height / 2 + .5 };
      }
      const column = Math.floor(position.x + width / 2), row = Math.floor(position.z + height / 2);
      const bucketKey = key(unit.team, column, row), bucket = buckets.get(bucketKey) ?? [];
      bucket.push({ x: position.x, z: position.z, radius });
      buckets.set(bucketKey, bucket);
      diagnostics.endpoints++;
    }
  }

  function check(input) {
    const { team, position, radius } = input ?? {};
    diagnostics.queries++;
    let visited = 0;
    const result = status => {
      if (status === 'deferred') diagnostics.deferredQueries++;
      return { status, visited };
    };
    if (incomplete || incompleteTeams.has(team) || !teamIndex(team) || !finitePoint(position)
      || !(Number.isFinite(radius) && radius > 0 && radius <= .5)
      || Math.abs(position.x) >= width / 2 || Math.abs(position.z) >= height / 2) return result('deferred');
    // Authored land radii are <=.35; query radii <=.5. A 3x3 neighborhood
    // covers the entire required circle. Count empty buckets as well as bodies.
    const column = Math.floor(position.x + width / 2), row = Math.floor(position.z + height / 2);
    for (let z = Math.max(0, row - 1); z <= Math.min(height - 1, row + 1); z++) {
      for (let x = Math.max(0, column - 1); x <= Math.min(width - 1, column + 1); x++) {
        diagnostics.bucketVisits++;
        for (const endpoint of buckets.get(key(team, x, z)) ?? []) {
          if (visited === MILITARY_ENDPOINT_QUERY_VISIT_LIMIT) return result('deferred');
          visited++; diagnostics.endpointVisits++;
          if (Math.hypot(position.x - endpoint.x, position.z - endpoint.z)
            < radius + endpoint.radius - EPSILON) return result('blocked');
        }
      }
    }
    return result('available');
  }
  return { check, diagnostics };
}
