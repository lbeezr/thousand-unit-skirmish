import { activeMoveGoalPoint, validMoveGoalPoint, createClearanceMoveGoalPoint, LAND_CLEARANCE_PROFILE } from '../../unit-movement.mjs';

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
      if (unit.id !== index || !Number.isInteger(unit.generation) || unit.generation < 1 || unit.generation > 0xffffffff
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

// Separate opt-in preference for an ACTIVE builder's final parking pose. This
// does not reserve routes, veto productive work, relocate goals or move actors.
// One newly frozen scope belongs to one synchronous operation; close in finally.
// Military intent/roster/navigation must remain stable throughout that operation.
// Local guards detect changed encountered claims, not new claims in other buckets.
export function createNextQueuedMilitaryEndpointClaims(input) {
  const { units, width, height, maxUnits, maxQueuedWaypoints, isWalkable, scope } = input ?? {};
  const diagnostics = { censusSlots: 0, censusHeadReads: 0, freshnessHeadReads: 0, claims: 0, staticProbes: 0,
    relocationPending: 0, queries: 0, bucketVisits: 0, endpointVisits: 0, deferredQueries: 0 };
  const buckets = new Map(), incompleteTeams = new Set();
  let closed = false;
  const validScope = scope && Object.isFrozen(scope)
    && ['tick', 'navigationRevision', 'epoch'].every(key => Number.isSafeInteger(scope[key]) && scope[key] >= 0);
  const validInput = validScope && Array.isArray(units) && Number.isSafeInteger(maxUnits) && maxUnits > 0
    && units.length <= maxUnits && Number.isSafeInteger(width) && width > 0
    && Number.isSafeInteger(height) && height > 0 && Number.isSafeInteger(2 * width * height)
    && Number.isSafeInteger(maxQueuedWaypoints) && maxQueuedWaypoints > 0 && maxQueuedWaypoints <= 8
    && typeof isWalkable === 'function';
  const rosterLength = units?.length;
  let incomplete = !validInput;
  const key = (team, column, row) => team * width * height + row * width + column;
  const pointFields = ['version', 'generation', 'revision', 'requestedX', 'requestedZ', 'cell', 'x', 'z',
    'clearanceProfile', 'arrivalPolicy'];
  const walkable = cell => { diagnostics.staticProbes++; return isWalkable(cell); };
  if (validInput) for (let index = 0; index < units.length; index++) {
    diagnostics.censusSlots++;
    const unit = units[index];
    if (!unit || !Number.isFinite(unit.hp)) { incomplete = true; continue; }
    if (!ordinaryMilitaryIntent(unit) || unit.moveGoalCell === -1) continue;
    if (!teamIndex(unit.team)) { incomplete = true; continue; }
    const radius = LAND_CLEARANCE_PROFILE.radiusByKind[unit.kind], queue = unit.queuedWaypoints;
    if (unit.id !== index || !Number.isInteger(unit.generation) || unit.generation < 1 || unit.generation > 0xffffffff
      || !Number.isSafeInteger(unit.orderRevision) || unit.orderRevision < 0
      || !Number.isInteger(unit.moveGoalCell) || unit.moveGoalCell < 0 || unit.moveGoalCell >= width * height
      || !(Number.isFinite(radius) && radius > 0 && radius <= .5)
      || !Array.isArray(queue) || queue.length > maxQueuedWaypoints) {
      incompleteTeams.add(unit.team); continue;
    }
    if (!queue.length) continue;
    diagnostics.censusHeadReads++;
    const next = queue[0];
    if (!next || !Number.isInteger(next.destination) || next.destination < 0 || next.destination >= width * height
      || typeof next.attackMove !== 'boolean' || (next.attackMove && next.point != null)) {
      incompleteTeams.add(unit.team); continue;
    }
    if (next.attackMove) continue; // Target/range policy is outside ordinary parking claims.
    if (!validMoveGoalPoint(next.point, unit, width, height, { destination: next.destination, queued: true })) {
      incompleteTeams.add(unit.team); continue;
    }
    if (!walkable(next.destination)) {
      diagnostics.relocationPending++; continue; // The host must first select its replacement endpoint.
    }
    // Match the host's existing activation projection at this navigation revision.
    const position = next.point
      ? createClearanceMoveGoalPoint(unit, next.point.requestedX, next.point.requestedZ,
        next.destination, width, height, walkable)
      : { x: next.destination % width - width / 2 + .5,
        z: Math.floor(next.destination / width) - height / 2 + .5 };
    const claim = { x: position.x, z: position.z, radius, unit, queue, next,
      generation: unit.generation, revision: unit.orderRevision, kind: unit.kind, team: unit.team,
      goal: unit.moveGoalCell, queueLength: queue.length, destination: next.destination,
      point: next.point, pointValues: next.point && pointFields.map(field => next.point[field]),
      pointKeyCount: next.point && Object.keys(next.point).length };
    const bucketKey = key(unit.team, Math.floor(position.x + width / 2), Math.floor(position.z + height / 2));
    const bucket = buckets.get(bucketKey) ?? [];
    bucket.push(claim); buckets.set(bucketKey, bucket); diagnostics.claims++;
  }
  const currentHead = queue => { diagnostics.freshnessHeadReads++; return queue[0]; };
  const fresh = claim => {
    const unit = claim.unit, next = claim.next;
    return units[unit.id] === unit && unit.generation === claim.generation && unit.orderRevision === claim.revision
      && unit.kind === claim.kind && unit.team === claim.team && ordinaryMilitaryIntent(unit)
      && unit.moveGoalCell === claim.goal && unit.queuedWaypoints === claim.queue
      && claim.queue.length === claim.queueLength && currentHead(claim.queue) === next
      && next.destination === claim.destination && next.attackMove === false && next.point === claim.point
      && (!next.point || (Object.keys(next.point).length === claim.pointKeyCount
        && pointFields.every((field, index) => next.point[field] === claim.pointValues[index])));
  };
  function check({ scope: currentScope, team, position, radius } = {}) {
    diagnostics.queries++;
    let visited = 0;
    const result = status => {
      if (status === 'deferred') diagnostics.deferredQueries++;
      return { status, visited };
    };
    if (closed || incomplete || currentScope !== scope || units.length !== rosterLength
      || incompleteTeams.has(team) || !teamIndex(team) || !finitePoint(position)
      || !(Number.isFinite(radius) && radius > 0 && radius <= .5)
      || Math.abs(position.x) >= width / 2 || Math.abs(position.z) >= height / 2) return result('deferred');
    const column = Math.floor(position.x + width / 2), row = Math.floor(position.z + height / 2);
    for (let z = Math.max(0, row - 1); z <= Math.min(height - 1, row + 1); z++) {
      for (let x = Math.max(0, column - 1); x <= Math.min(width - 1, column + 1); x++) {
        diagnostics.bucketVisits++;
        for (const claim of buckets.get(key(team, x, z)) ?? []) {
          if (visited === MILITARY_ENDPOINT_QUERY_VISIT_LIMIT) return result('deferred');
          visited++; diagnostics.endpointVisits++;
          if (!fresh(claim)) return result('deferred');
          if (Math.hypot(position.x - claim.x, position.z - claim.z) < radius + claim.radius - EPSILON)
            return result('claimed');
        }
      }
    }
    return result('available');
  }
  return { check, diagnostics, close() { closed = true; buckets.clear(); } };
}

// Apply only at final parking, after the caller's existing physical/current-goal
// admissions. Work/rates/payment proceed independently. Escape uses only the
// active builder's own admitted continuation; no claim grants motion authority.
export function decideActiveConstructionParking({ activeConstruction, currentStatus, nextStatus, escapeAvailable = false } = {}) {
  if (activeConstruction !== true) return 'inactive';
  if (currentStatus === 'available' && nextStatus === 'available') return 'park';
  if (['available', 'blocked', 'deferred'].includes(currentStatus)
    && ['available', 'claimed', 'deferred'].includes(nextStatus) && escapeAvailable === true) return 'escape';
  return 'wait'; // Retain active completion/escape intent and use the caller's bounded retry.
}
