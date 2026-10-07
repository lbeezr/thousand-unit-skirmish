import { LAND_CLEARANCE_PROFILE, workerEconomyBodyRadius } from './unit-movement.mjs';

export const WORKER_PERIMETER_LIMITS = Object.freeze({ cells: 32, checks: 256, visits: 64 });
const EPSILON = 1e-9;
const integer = value => Number.isSafeInteger(value) && value >= 0;

// One synchronous economy operation, with no physical writes. Bodies include
// every registered land kind, regardless of order/activation/team. Claims are
// preferences only; the existing executor still admits every actual step.
export function createWorkerPerimeterAccess({ units, width, height, maxUnits, epoch,
  navigationRevision, current }) {
  const bodies = new Map(), claims = new Map(), byActor = new Map();
  const diagnostics = { censusSlots: 0, checks: 0, visits: 0, deferred: 0 };
  let closed = false, incomplete = !(Array.isArray(units) && integer(maxUnits) && maxUnits > 0
    && maxUnits <= 2000 && units.length <= maxUnits && integer(width) && width > 0 && integer(height) && height > 0
    && integer(epoch) && integer(navigationRevision) && typeof current === 'function');
  const rosterLength = units?.length;
  const key = (x, z) => `${Math.floor(x + width / 2)}:${Math.floor(z + height / 2)}`;
  const validActor = unit => unit && units[unit.id] === unit && integer(unit.id)
    && integer(unit.generation) && unit.generation > 0 && integer(unit.orderRevision)
    && [0, 1].includes(unit.team) && Number.isFinite(unit.x) && Number.isFinite(unit.z);
  const eligible = unit => workerEconomyBodyRadius(unit) > 0 && integer(unit.moveGoalCell)
    && unit.moveGoalCell < width * height && (unit.gatherPhase === 'to-base'
      ? unit.dropoffBuildingId != null && unit.dropoffNavigationRevision === navigationRevision
      : unit.gatherPhase === 'to-node' && /^farm:[1-9][0-9]*$/.test(unit.gatherNodeId));
  const point = cell => ({ x: cell % width - width / 2 + .5,
    z: Math.floor(cell / width) - height / 2 + .5 });
  const add = (index, record) => {
    record.key = key(record.x, record.z);
    const bucket = index.get(record.key) ?? new Set(); bucket.add(record); index.set(record.key, bucket);
  };
  const removeClaim = unit => {
    const record = byActor.get(unit);
    if (!record) return;
    const bucket = claims.get(record.key); bucket.delete(record);
    if (!bucket.size) claims.delete(record.key);
    byActor.delete(unit);
  };
  const claimFresh = record => validActor(record.unit) && record.unit.generation === record.generation
    && record.unit.orderRevision === record.revision && record.unit.hp > 0
    && record.unit.movementDomain !== 'water' && (record.preview
      || eligible(record.unit) && record.unit.moveGoalCell === record.cell);
  const putClaim = (unit, cell, preview) => {
    removeClaim(unit);
    const record = { unit, generation: unit.generation, revision: unit.orderRevision,
      team: unit.team, radius: LAND_CLEARANCE_PROFILE.radiusByKind.worker, cell, preview, ...point(cell) };
    add(claims, record); byActor.set(unit, record); return record;
  };
  let prepared = false;
  function prepare() {
    if (prepared) return;
    prepared = true;
    for (const unit of units) {
      diagnostics.censusSlots++;
      if (!unit || !Number.isFinite(unit.hp)) { incomplete = true; continue; }
      if (unit.hp <= 0 || unit.movementDomain === 'water') continue;
      const radius = LAND_CLEARANCE_PROFILE.radiusByKind[unit.kind];
      if (!validActor(unit) || !(radius > 0 && radius <= .5)) { incomplete = true; continue; }
      add(bodies, { unit, generation: unit.generation, kind: unit.kind, x: unit.x, z: unit.z, radius });
      if (eligible(unit)) putClaim(unit, unit.moveGoalCell, false);
    }
  }
  const fresh = () => {
    if (closed || incomplete || units.length !== rosterLength) return false;
    const state = current();
    if (!state || state.epoch !== epoch || state.navigationRevision !== navigationRevision) return false;
    // Idle economy ticks pay no roster census. The first actual perimeter
    // selection freezes physical poses; this operation never moves bodies.
    prepare(); return !incomplete;
  };
  const binding = actor => {
    const unit = units?.[actor?.id];
    return validActor(unit) && unit.hp > 0 && unit.kind === 'worker' && unit.movementDomain !== 'water'
      && actor.kind === unit.kind && actor.team === unit.team && actor.x === unit.x && actor.z === unit.z
      && actor.generation === unit.generation && actor.orderRevision === unit.orderRevision ? unit : null;
  };
  const deferred = () => { diagnostics.deferred++; return { status: 'deferred', goals: [] }; };

  function select(actor, cells) {
    const own = binding(actor);
    if (!fresh() || !own || !Array.isArray(cells) || cells.length > WORKER_PERIMETER_LIMITS.cells)
      return deferred();
    const goals = [...new Set(cells)];
    if (goals.some(cell => !integer(cell) || cell >= width * height)
      || diagnostics.checks + goals.length > WORKER_PERIMETER_LIMITS.checks) return deferred();
    const available = [], shared = [];
    for (const cell of goals) {
      diagnostics.checks++;
      const position = point(cell), column = Math.floor(position.x + width / 2), row = Math.floor(position.z + height / 2);
      let visits = 0, blocked = false, claimed = false;
      // Registered radii sum to <=.68: these nine tile buckets cover every
      // possible overlap. Count both body and claim records toward one limit.
      for (const [index, physical] of [[bodies, true], [claims, false]]) {
        for (let z = row - 1; z <= row + 1; z++) for (let x = column - 1; x <= column + 1; x++) {
          for (const record of index.get(`${x}:${z}`) ?? []) {
            if (visits === WORKER_PERIMETER_LIMITS.visits) return deferred();
            visits++; diagnostics.visits++;
            if (physical) {
              if (!validActor(record.unit) || record.unit.generation !== record.generation || record.unit.kind !== record.kind
                || record.unit.x !== record.x || record.unit.z !== record.z) return deferred();
              if (record.unit.hp <= 0 || record.unit.movementDomain === 'water' || record.unit === own) continue;
            } else if (record.unit === own || record.team !== own.team || !claimFresh(record)) continue;
            if (Math.hypot(position.x - record.x, position.z - record.z)
              < LAND_CLEARANCE_PROFILE.radiusByKind.worker + record.radius - EPSILON) {
              if (physical) blocked = true; else claimed = true;
            }
          }
        }
        if (blocked) break;
      }
      if (!blocked) (claimed ? shared : available).push(cell);
    }
    return { status: available.length || shared.length ? 'ready' : 'blocked',
      goals: available.length ? available : shared };
  }
  return { select, diagnostics,
    preview(actor, cell) {
      const own = binding(actor);
      if (!fresh() || !own || !integer(cell) || cell >= width * height) return null;
      return putClaim(own, cell, true);
    },
    cancel(token) {
      if (!token || byActor.get(token.unit) !== token) return;
      removeClaim(token.unit);
      if (fresh() && validActor(token.unit) && eligible(token.unit)) putClaim(token.unit, token.unit.moveGoalCell, false);
    },
    commit(actor) {
      const own = binding(actor);
      if (!fresh() || !own) return;
      removeClaim(own);
      if (eligible(own)) putClaim(own, own.moveGoalCell, false);
    },
    close() { closed = true; bodies.clear(); claims.clear(); byActor.clear(); },
  };
}
