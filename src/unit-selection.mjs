import { UNIT_DEFINITIONS } from './gameplay-definitions.mjs';

const SAME_UNIT_DOUBLE_CLICK_MS = 360;
const UNIT_PICK_REPEAT_WINDOW_MS = 1200;
const UNIT_PICK_POSITION_TOLERANCE_PX = 18;

export function livingUnitIdsOfKind(units, team, kind) {
  if (typeof kind !== 'string') return [];
  return livingUnitIdsOfKinds(units, team, [kind]);
}

export function livingUnitIdsOfKinds(units, team, kinds) {
  if (!Array.isArray(units) || ![0, 1].includes(team)
    || !Array.isArray(kinds) || !kinds.every((kind) => typeof kind === 'string')) return [];
  const selectedKinds = new Set(kinds);
  const ids = [];
  for (const unit of units) {
    if (unit && Number.isInteger(unit.id) && unit.id >= 0
      && unit.team === team && selectedKinds.has(unit.kind) && unit.hp > 0) ids.push(unit.id);
  }
  return ids;
}

export function summarizeUnitComposition(units, unitIds, team) {
  const composition = Object.fromEntries(Object.keys(UNIT_DEFINITIONS).map((kind) => [kind, 0]));
  if (!Array.isArray(units) || !unitIds || typeof unitIds[Symbol.iterator] !== 'function'
    || ![0, 1].includes(team)) return composition;
  for (const id of unitIds) {
    if (!Number.isInteger(id) || id < 0) continue;
    const unit = units[id];
    if (!unit || unit.hp <= 0 || unit.team !== team) continue;
    if (Object.hasOwn(composition, unit.kind)) composition[unit.kind]++;
  }
  return composition;
}

export function visibleLivingUnitIdsOfKind(units, team, kind, isOnScreen = () => true) {
  if (!Array.isArray(units) || ![0, 1].includes(team) || typeof kind !== 'string'
    || typeof isOnScreen !== 'function') return [];
  const ids = [];
  for (const unit of units) {
    if (unit && Number.isInteger(unit.id) && unit.id >= 0
      && unit.team === team && unit.kind === kind && unit.hp > 0
      && unit.visible !== false && isOnScreen(unit)) ids.push(unit.id);
  }
  return ids;
}

export function selectUnitIdsInScreenRect(
  units, team, start, end, projectUnit, radiusForUnit = () => 0,
) {
  const empty = { ids: [], mode: 'window', bounds: null };
  if (!Array.isArray(units) || ![0, 1].includes(team)
    || !start || !Number.isFinite(start.x) || !Number.isFinite(start.y)
    || !end || !Number.isFinite(end.x) || !Number.isFinite(end.y)
    || typeof projectUnit !== 'function' || typeof radiusForUnit !== 'function') return empty;

  const mode = end.x < start.x ? 'crossing' : 'window';
  const bounds = {
    left: Math.min(start.x, end.x),
    right: Math.max(start.x, end.x),
    top: Math.min(start.y, end.y),
    bottom: Math.max(start.y, end.y),
  };
  const ids = [];
  for (const unit of units) {
    if (!unit || !Number.isInteger(unit.id) || unit.id < 0
      || !(unit.hp > 0) || unit.team !== team) continue;
    const point = projectUnit(unit);
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const enclosed = point.x >= bounds.left && point.x <= bounds.right
      && point.y >= bounds.top && point.y <= bounds.bottom;
    if (enclosed) {
      ids.push(unit.id);
      continue;
    }
    if (mode !== 'crossing') continue;
    const radius = radiusForUnit(unit, point);
    if (!Number.isFinite(radius) || radius <= 0) continue;
    const dx = Math.max(0, bounds.left - point.x, point.x - bounds.right);
    const dy = Math.max(0, bounds.top - point.y, point.y - bounds.bottom);
    if (dx * dx + dy * dy <= radius * radius) ids.push(unit.id);
  }
  return { ids, mode, bounds };
}

export function isSameUnitDoubleClick(
  previous, unitId, x, y, now,
  maxIntervalMs = SAME_UNIT_DOUBLE_CLICK_MS,
  maxDistance = UNIT_PICK_POSITION_TOLERANCE_PX,
) {
  if (!previous || previous.id !== unitId || !Number.isFinite(previous.at)
    || !Number.isFinite(previous.x) || !Number.isFinite(previous.y)
    || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(now)) return false;
  const elapsed = now - previous.at;
  const dx = x - previous.x;
  const dy = y - previous.y;
  return elapsed >= 0 && elapsed <= maxIntervalMs && dx * dx + dy * dy <= maxDistance * maxDistance;
}

export function chooseUnitPickCandidate(candidates, previous, x, y, now) {
  const ranked = (Array.isArray(candidates) ? candidates : [])
    .filter((candidate) => candidate && Number.isInteger(candidate.id) && candidate.id >= 0
      && Number.isFinite(candidate.distanceSquared) && candidate.distanceSquared >= 0
      && Number.isFinite(candidate.depth))
    .slice()
    .sort((left, right) => left.distanceSquared - right.distanceSquared
      // Projected depth is in WebGL NDC: smaller values are closer to the camera.
      || left.depth - right.depth
      || left.id - right.id);
  if (ranked.length === 0 || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(now)) {
    return { id: null, stackIndex: 0, stackCount: 0, cycled: false, state: null };
  }

  let selectedIndex = 0;
  let cycled = false;
  if (previous && Number.isInteger(previous.id) && Number.isFinite(previous.x)
    && Number.isFinite(previous.y) && Number.isFinite(previous.at)) {
    const previousIndex = ranked.findIndex((candidate) => candidate.id === previous.id);
    const elapsed = now - previous.at;
    const dx = x - previous.x;
    const dy = y - previous.y;
    const samePickArea = dx * dx + dy * dy <= UNIT_PICK_POSITION_TOLERANCE_PX ** 2;
    if (previousIndex >= 0 && elapsed >= 0 && samePickArea) {
      if (elapsed <= SAME_UNIT_DOUBLE_CLICK_MS) {
        // Keep the same unit for the ordinary double-click-to-select-type gesture.
        selectedIndex = previousIndex;
      } else if (elapsed <= UNIT_PICK_REPEAT_WINDOW_MS && ranked.length > 1) {
        selectedIndex = (previousIndex + 1) % ranked.length;
        cycled = true;
      }
    }
  }

  const candidate = ranked[selectedIndex];
  return {
    id: candidate.id,
    stackIndex: selectedIndex + 1,
    stackCount: ranked.length,
    cycled,
    state: { id: candidate.id, x, y, at: now },
  };
}

export function livingIdleWorkerIds(units, team) {
  if (!Array.isArray(units) || ![0, 1].includes(team)) return [];
  const ids = [];
  for (const unit of units) {
    if (unit && Number.isInteger(unit.id) && unit.id >= 0
      && unit.team === team && unit.kind === 'worker' && unit.hp > 0 && unit.task === 'idle') {
      ids.push(unit.id);
    }
  }
  return ids;
}
