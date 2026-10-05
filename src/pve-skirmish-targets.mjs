import { BUILDING_DEFINITIONS, UNIT_DEFINITIONS } from './gameplay-definitions.mjs';
import { mapSizeIdentity } from './map-size-policy.mjs';

export const PVE_SKIRMISH_LIMITS = Object.freeze({ retryTicks: 300, maxRetryTicks: 1800,
  searchTicks: 1800, maxSearchTicks: 5400, searchCandidates: 64, recentCombatTicks: 120,
  contactMemoryTicks: 300, contactArrivalDistance: 2 });
const identity = unit => `${unit.id}:${unit.generation}`;
const landUnit = kind => UNIT_DEFINITIONS[kind] && UNIT_DEFINITIONS[kind].movementDomain !== 'water';
const fighting = (unit, tick) => unit.focusedCount > 0 || (unit.lastAttack
  && tick - unit.lastAttack.tick >= 0 && tick - unit.lastAttack.tick < PVE_SKIRMISH_LIMITS.recentCombatTicks);
const centerOf = units => units.reduce((point, unit) => ({
  x: point.x + unit.x / units.length, z: point.z + unit.z / units.length,
}), { x: 0, z: 0 });

/** Current sight only: public product definitions describe recovery, not enemy affordability. */
export function selectSkirmishTarget(observation, soldiers) {
  if (!soldiers.length) return null;
  const center = centerOf(soldiers), team = 1 - observation.team;
  const candidates = [];
  for (const building of observation.buildings?.visibleEnemies || []) {
    const definition = BUILDING_DEFINITIONS[building.type];
    if (building.team !== team || !(building.hp > 0) || !definition || building.type === 'dock') continue;
    const producer = definition.products.some(landUnit);
    candidates.push({ key: `building:${building.id}`, priority: producer ? (building.complete ? 0 : 2) : 3,
      type: 'attackBuilding', buildingId: building.id, x: building.x, z: building.z });
  }
  for (const unit of observation.units.visibleEnemies) {
    if (unit.team !== team || !(unit.hp > 0) || !landUnit(unit.kind)) continue;
    // A disclosed combatant already in range of this assault can kill it while
    // it attacks a producer. Clear that immediate threat before the building.
    const immediate = unit.kind !== 'worker' && UNIT_DEFINITIONS[unit.kind].capabilities.includes('attack')
      && soldiers.some(soldier => Math.hypot(unit.x - soldier.x, unit.z - soldier.z)
        <= UNIT_DEFINITIONS[unit.kind].combat.range);
    candidates.push({ key: `unit:${identity(unit)}`, priority: immediate ? -1 : 1, type: 'attack',
      targetId: unit.id, targetGeneration: unit.generation, x: unit.x, z: unit.z });
  }
  const distance = target => (target.x - center.x) ** 2 + (target.z - center.z) ** 2;
  return candidates.sort((a, b) => a.priority - b.priority || distance(a) - distance(b)
    || (a.buildingId ?? a.targetId) - (b.buildingId ?? b.targetId))[0] || null;
}

/** Bounded army search and generation-bound assault; caller reserves defense/scout/rally units. */
export function createSkirmishTargetPolicy(seed = 0) {
  const orders = new Map();
  let search = null, cursor = seed >>> 0, rotation = (seed >>> 0) % 8, coverageRemaining = 0;
  let contact = null, context = null, previousTick = null;
  const directions = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

  function searchTarget(observation, soldiers) {
    const width = observation.map?.width, height = observation.map?.height;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 4 || height < 4) return null;
    const center = centerOf(soldiers), tick = observation.tick;
    const bytes = observation.visibility?.data ? atob(observation.visibility.data) : '';
    const seen = point => {
      if (!observation.fogOfWar || !bytes) return 2;
      const cell = Math.floor(point.z + height / 2) * width + Math.floor(point.x + width / 2);
      return (bytes.charCodeAt(cell >> 2) >> ((cell & 3) * 2)) & 3;
    };
    // Only movement by the original generation-bound cohort refreshes progress.
    // New reinforcements and replacement identities cannot prolong a stuck goal.
    if (search) for (const unit of soldiers) {
      const previous = search.positions.get(identity(unit));
      if (previous && Math.hypot(unit.x - previous.x, unit.z - previous.z) >= .5) {
        search.progressTick = tick;
        search.positions.set(identity(unit), { x: unit.x, z: unit.z });
      }
    }
    const withinBound = search && tick >= search.tick && tick - search.tick < PVE_SKIRMISH_LIMITS.maxSearchTicks;
    const retained = withinBound && (tick - search.tick < PVE_SKIRMISH_LIMITS.searchTicks
      || search.longRoute && tick - search.progressTick < PVE_SKIRMISH_LIMITS.retryTicks);
    const expired = search && !retained && Math.hypot(center.x - search.x, center.z - search.z) > 2;
    // Forward sight can reveal a goal before the army arrives there.
    if (retained
      && (tick === search.tick || Math.hypot(center.x - search.x, center.z - search.z) > 2)) return search;
    const clamp = point => ({ x: Math.max(-width / 2 + 1.5, Math.min(width / 2 - 1.5, Math.floor(point.x) + .5)),
      z: Math.max(-height / 2 + 1.5, Math.min(height / 2 - 1.5, Math.floor(point.z) + .5)) });
    const candidates = [];
    // Sixteen nearby frontier probes; neither authored spawns nor raw terrain are inputs.
    const localRadii = expired ? [] : [10, 16];
    for (const radius of localRadii) for (let index = 0; index < 8; index++) {
      const [dx, dz] = directions[(index + rotation) % 8], length = Math.hypot(dx, dz);
      const point = clamp({ x: center.x + dx / length * radius, z: center.z + dz / length * radius });
      const visibility = seen(point);
      if (visibility === 2 || Math.hypot(point.x - center.x, point.z - center.z) < 2
        || (search && Math.hypot(point.x - search.x, point.z - search.z) < 1)) continue;
      candidates.push({ ...point, score: visibility * 100 + index });
    }
    rotation = (rotation + 1) % 8;
    let point, remembered, nextCursor = cursor;
    // Give global coverage first choice. A coprime stride
    // visits every coarse cell without spending its early turns on one map edge.
    const columns = Math.ceil(width / 8), rows = Math.ceil(height / 8), count = columns * rows;
    const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
    let stride = columns + 1;
    while (stride < count && gcd(stride, count) !== 1) stride++;
    if (stride >= count) stride = 1;
    // Native routes can stop near blocked terrain without revealing the goal.
    // After that deadline, give every coarse cell a turn before preferring new ground again.
    if (expired && search.unknownPreferred && seen(search) === 0) coverageRemaining = count;
    const covering = coverageRemaining > 0;
    for (let i = 0; !point && i < Math.min(count, PVE_SKIRMISH_LIMITS.searchCandidates); i++) {
      const cell = nextCursor % count;
      nextCursor = (cell + stride) % count;
      if (covering) coverageRemaining = Math.max(0, coverageRemaining - 1);
      const candidate = clamp({ x: cell % columns * 8 + 4 - width / 2,
        z: Math.floor(cell / columns) * 8 + 4 - height / 2 });
      const visibility = seen(candidate);
      if (visibility === 2 || Math.hypot(candidate.x - center.x, candidate.z - center.z) <= 2) continue;
      if (visibility === 0 || covering) point = candidate;
      else remembered ??= { point: candidate, cursor: nextCursor };
    }
    // Search new ground before revisiting remembered cells. Keep the original
    // cursor step on fallback so fully explored maps still get complete coverage.
    cursor = point ? nextCursor : remembered?.cursor ?? nextCursor;
    point ??= remembered?.point;
    point ??= candidates.sort((a, b) => a.score - b.score)[0];
    if (!point) { search = null; return null; }
    // Preserve the admitted Tiny policy; qualify longer-map journeys separately.
    // Short routes keep their deadline even if formation retries cause movement.
    const slowestSpeed = Math.min(...soldiers.map(unit => UNIT_DEFINITIONS[unit.kind].combat.moveSpeed));
    const tier = mapSizeIdentity({ width, height }).sizeTierId;
    const longRoute = tier !== 'tiny' && tier !== 'internal'
      && Math.hypot(point.x - center.x, point.z - center.z) / slowestSpeed * 30
      > PVE_SKIRMISH_LIMITS.searchTicks;
    search = { key: `search:${point.x}:${point.z}`, type: 'attackMove', x: point.x, z: point.z, tick, longRoute,
      unknownPreferred: !covering && seen(point) === 0, progressTick: tick,
      positions: new Map(soldiers.map(unit => [identity(unit), { x: unit.x, z: unit.z }])) };
    return search;
  }

  return {
    next(observation, availableSoldiers) {
      const currentContext = `${observation.team}:${observation.map?.id}:${observation.map?.width}:${observation.map?.height}`;
      if (context !== currentContext || previousTick !== null && observation.tick < previousTick) contact = null;
      context = currentContext; previousTick = observation.tick;
      const soldiers = availableSoldiers.filter(unit => unit.team === observation.team && unit.hp > 0
        && unit.kind !== 'worker' && landUnit(unit.kind)
        && UNIT_DEFINITIONS[unit.kind].capabilities.includes('attack')).sort((a, b) => a.id - b.id);
      const live = new Set(soldiers.map(identity));
      for (const key of orders.keys()) if (!live.has(key)) orders.delete(key);
      if (!soldiers.length) { search = null; contact = null; return []; }
      const visible = selectSkirmishTarget(observation, soldiers);
      const tiny = Number.isInteger(observation.map?.width) && observation.map.width > 0
        && Number.isInteger(observation.map?.height) && observation.map.height > 0
        && mapSizeIdentity(observation.map).sizeTierId === 'tiny';
      if (visible) {
        search = null;
        // Remember one public point, never a hidden enemy identity or movement.
        contact = tiny && visible.type === 'attack' ? { x: visible.x, z: visible.z,
          tick: observation.tick, cohort: new Set(soldiers.map(identity)) } : null;
      }
      const original = contact ? soldiers.filter(unit => contact.cohort.has(identity(unit))) : [];
      if (contact && (!tiny || observation.tick - contact.tick >= PVE_SKIRMISH_LIMITS.contactMemoryTicks
        || !original.length || !visible && original.some(unit => Math.hypot(unit.x - contact.x, unit.z - contact.z)
          <= PVE_SKIRMISH_LIMITS.contactArrivalDistance))) contact = null;
      const remembered = contact && !visible ? { key: `contact:${contact.tick}:${contact.x}:${contact.z}`,
        type: 'attackMove', x: contact.x, z: contact.z } : null;
      const target = visible || remembered || searchTarget(observation, soldiers);
      if (!target) { orders.clear(); return []; }
      const issued = [];
      for (const unit of soldiers) {
        const key = identity(unit), previous = orders.get(key), tick = observation.tick;
        if (fighting(unit, tick)) continue;
        const changed = !previous || previous.target !== target.key || tick < previous.tick;
        if (!changed && (Math.hypot(unit.x - previous.x, unit.z - previous.z) >= .5
          || (unit.lastAttack?.tick ?? -1) > previous.attackTick)) {
          previous.x = unit.x; previous.z = unit.z; previous.tick = tick;
          previous.attackTick = unit.lastAttack?.tick ?? -1; previous.retryTicks = PVE_SKIRMISH_LIMITS.retryTicks;
        }
        if (!changed && tick - previous.tick < previous.retryTicks) continue;
        orders.set(key, { target: target.key, x: unit.x, z: unit.z, tick,
          attackTick: unit.lastAttack?.tick ?? -1, retryTicks: changed ? PVE_SKIRMISH_LIMITS.retryTicks
            : Math.min(previous.retryTicks * 2, PVE_SKIRMISH_LIMITS.maxRetryTicks) });
        issued.push(unit);
      }
      if (!issued.length) return [];
      const command = { type: target.type, ids: issued.map(unit => unit.id), unitGenerations: issued.map(unit => unit.generation) };
      if (target.type === 'attackBuilding') command.buildingId = target.buildingId;
      else if (target.type === 'attack') { command.targetId = target.targetId; command.targetGeneration = target.targetGeneration; }
      else { command.x = target.x; command.z = target.z; }
      return [command];
    },
  };
}
