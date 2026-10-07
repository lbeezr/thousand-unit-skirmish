import { OPPONENT_OBSERVATION_SCHEMA_VERSION, toOpponentObservation } from './simulation/ai/opponent-observation.mjs';
export { OPPONENT_OBSERVATION_SCHEMA_VERSION, toOpponentObservation } from './simulation/ai/opponent-observation.mjs';
import { createReconnaissancePolicy } from './pve-reconnaissance.mjs';
import { createHomeDefensePolicy } from './pve-home-defense.mjs';
import { createRegroupPolicy } from './pve-regroup.mjs';
import { createSkirmishTargetPolicy } from './pve-skirmish-targets.mjs';
import { matchModeDefinition, normalizeMatchMode } from './match-modes.mjs';
import { createObjectiveRotationPolicy } from './pve-objective-rotation.mjs';
import { TECHNOLOGY_DEFINITIONS, BUILDING_DEFINITIONS } from './gameplay-definitions.mjs';
/**
 * Team-visible adapter and deterministic opening policy for an ordinary RTS
 * WebSocket player. The server assigns the seat and remains authoritative for
 * every command. See docs/gameplay-command-observation-contract.md for DTO v1.
 */

import { createProductionPolicy } from './pve-production.mjs';

export const DEFAULT_OPPONENT_SEED = 20260925;
export const DEFAULT_OPPONENT_DECISION_INTERVAL_MS = 1_000;

const RESOURCE_TYPES = ['food', 'wood'];
const GATHER_ORDER_RETRY_TICKS = 20;
// At the authoritative 30 Hz simulation rate: 10 seconds, capped at 60.
const TACTICAL_STALL_TICKS = 300;
const TACTICAL_MAX_RETRY_TICKS = 1_800;
const TACTICAL_RECENT_COMBAT_TICKS = 120;

function validTeam(team) {
  return Number.isInteger(team) && (team === 0 || team === 1);
}

function seededIndex(seed, team, stream, length) {
  let value = (seed >>> 0) ^ Math.imul(team + 1, 0x9e3779b1) ^ Math.imul(stream + 1, 0x85ebca6b);
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) % length;
}

function isPristineMatchState(state, team, map) {
  if (!state || state.type !== 'state' || state.winner !== -1
    || !Number.isInteger(state.armySize) || state.armySize < 2 || state.armySize % 2 !== 0
    || !Array.isArray(state.buildings) || state.buildings.length !== 0) return false;

  let observation;
  try {
    observation = toOpponentObservation(state, team, map);
  } catch {
    return false;
  }

  const teamSize = state.armySize / 2;
  if (observation.units.friendly.length !== teamSize
    || observation.units.friendly.some((unit, slot) => (
      unit.id !== team * teamSize + slot
      || unit.kind !== (slot < 4 ? 'worker' : 'infantry')
      || unit.hp !== 100
      || unit.cargo !== 0
      || (slot < 4 && unit.task !== 'idle')
    ))) return false;

  const startingResources = map?.startingResources ?? {};
  if (observation.resources.food !== (startingResources.food ?? 0)
    || observation.resources.wood !== (startingResources.wood ?? 0)) return false;

  const production = observation.workerProduction;
  if (!production || production.queue !== 0 || production.trainingRemaining !== 0
    || production.productionBlocked) return false;

  const research = observation.research;
  if (!research || Object.values(TECHNOLOGY_DEFINITIONS).some(technology => research[technology.upgradeKey]) || research.active !== null) return false;

  const mapResources = new Map((Array.isArray(map?.resourceNodes) ? map.resourceNodes : [])
    .filter((node) => typeof node?.id === 'string')
    .map((node) => [node.id, node.stock]));
  if (observation.resourceNodes.some((node) => mapResources.get(node.id) !== node.stock)) return false;
  if (observation.objectives.some((objective) => (
    objective.owner !== -1
      || (Object.hasOwn(objective, 'progressTeam') && objective.progressTeam !== -1)
      || (Object.hasOwn(objective, 'progress') && objective.progress !== 0)
  ))) return false;
  return true;
}

function nearestResource(nodes, worker) {
  return [...nodes].sort((left, right) => (
    ((left.x - worker.x) ** 2 + (left.z - worker.z) ** 2)
      - ((right.x - worker.x) ** 2 + (right.z - worker.z) ** 2)
    || left.id.localeCompare(right.id)
  ))[0] || null;
}

function objectiveWorldPoint(objective, map) {
  const zone = objective?.zone;
  if (!Number.isInteger(map?.width) || map.width < 1
    || !Number.isInteger(map?.height) || map.height < 1
    || !Number.isInteger(zone?.column) || !Number.isInteger(zone?.row)
    || !Number.isInteger(zone?.width) || zone.width < 1
    || !Number.isInteger(zone?.height) || zone.height < 1
    || zone.column < 0 || zone.row < 0
    || zone.column + zone.width > map.width || zone.row + zone.height > map.height) return null;
  return {
    x: zone.column + zone.width / 2 - map.width / 2,
    z: zone.row + zone.height / 2 - map.height / 2,
  };
}

function objectivePrerequisitesMet(objective, team) {
  const ids = Array.isArray(objective?.requiresAll) ? objective.requiresAll
    : typeof objective?.requires === 'string' ? [objective.requires] : [];
  if (ids.length === 0) return true;
  const owners = Array.isArray(objective.requiredOwners) ? objective.requiredOwners
    : typeof objective.requires === 'string' ? [objective.requiredOwner] : [];
  return owners.length === ids.length && owners.every((owner) => owner === team);
}

function rankedObjectives(objectives, team, soldiers, map, lostObjectiveIds) {
  if (soldiers.length === 0) return [];
  const armyCenter = soldiers.reduce((center, unit) => ({
    x: center.x + unit.x / soldiers.length,
    z: center.z + unit.z / soldiers.length,
  }), { x: 0, z: 0 });
  const enemyTeam = 1 - team;
  const candidates = objectives.flatMap((objective) => {
    if (typeof objective?.id !== 'string'
      || !Number.isInteger(objective.owner)
      || objective.owner === team
      || ![-1, enemyTeam].includes(objective.owner)
      || !objectivePrerequisitesMet(objective, team)) return [];
    const point = objectiveWorldPoint(objective, map);
    if (!point) return [];
    const recentlyLost = lostObjectiveIds.has(objective.id);
    const priority = recentlyLost ? 0
      : objective.victory === true ? (objective.owner === enemyTeam ? 1 : 2)
        : (objective.owner === enemyTeam ? 3 : 4);
    return [{
      id: objective.id,
      point,
      priority,
      distance: (point.x - armyCenter.x) ** 2 + (point.z - armyCenter.z) ** 2,
    }];
  });
  return candidates.sort((left, right) => (
    left.priority - right.priority
      || left.distance - right.distance
      || left.id.localeCompare(right.id)
  ));
}

/** Create a deterministic economy-and-tactics policy for an ordinary player seat. */
export function createDeterministicPolicy(seed = DEFAULT_OPPONENT_SEED, matchMode = {}) {
  if (!Number.isSafeInteger(seed)) throw new TypeError('Opponent seed must be a safe integer.');
  const strategy = matchModeDefinition(matchMode).aiStrategyId;
  const normalizedSeed = seed >>> 0;
  const productionPolicy = createProductionPolicy(normalizedSeed);
  const reconnaissancePolicy = createReconnaissancePolicy(normalizedSeed);
  const homeDefensePolicy = createHomeDefensePolicy();
  const regroupPolicy = createRegroupPolicy();
  const skirmishPolicy = strategy === 'base-elimination' ? createSkirmishTargetPolicy(normalizedSeed) : null;
  const objectiveRotationPolicy = createObjectiveRotationPolicy();
  const gatherAssignments = new Map();
  const objectiveOwners = new Map();
  const lostObjectiveIds = new Set();
  let tacticalObjectiveId = null;
  let fallbackTacticsStarted = false;
  let previousDecisionGatherOnly = false;
  let tacticalWatch = null;
  let defenseRegroupId = null;
  const orderedSoldiers = new Set();
  const soldierKey = (unit) => `${unit.id}:${unit.generation}`;
  const recordOrderedSoldiers = (soldiers) => soldiers.forEach((unit) => orderedSoldiers.add(soldierKey(unit)));

  function watchTacticalOrder(soldiers, point, tick, retry = false) {
    if (!tacticalWatch || tacticalWatch.point.x !== point.x || tacticalWatch.point.z !== point.z) {
      tacticalWatch = { point, units: new Map() };
    }
    for (const unit of soldiers) {
      const key = soldierKey(unit);
      const previous = tacticalWatch.units.get(key);
      tacticalWatch.units.set(key, {
        sinceTick: tick,
        retryTicks: retry && previous
          ? Math.min(previous.retryTicks * 2, TACTICAL_MAX_RETRY_TICKS)
          : TACTICAL_STALL_TICKS,
        x: unit.x, z: unit.z,
      });
    }
  }

  // Watch each issued unit independently: an arrived soldier must not hide a
  // stranded reinforcement, and a retry must not interrupt arrived/fighting units.
  function stalledTacticalSoldiers(observation, soldiers, zone = null) {
    if (!tacticalWatch || soldiers.length === 0) return [];
    const tick = observation.tick;
    const liveKeys = new Set(soldiers.map(soldierKey));
    for (const key of tacticalWatch.units.keys()) {
      if (!liveKeys.has(key)) tacticalWatch.units.delete(key);
    }
    return soldiers.filter((unit) => {
      const previous = tacticalWatch.units.get(soldierKey(unit));
      if (!previous) return false;
      const column = Math.floor(unit.x + observation.map.width / 2);
      const row = Math.floor(unit.z + observation.map.height / 2);
      const atDestination = zone
        ? column >= zone.column && column < zone.column + zone.width
          && row >= zone.row && row < zone.row + zone.height
        : Math.hypot(unit.x - tacticalWatch.point.x, unit.z - tacticalWatch.point.z) <= 2;
      const progressing = Math.hypot(unit.x - previous.x, unit.z - previous.z) >= 0.5;
      const fighting = unit.focusedCount > 0
        || (unit.lastAttack && tick - unit.lastAttack.tick >= 0
          && tick - unit.lastAttack.tick < TACTICAL_RECENT_COMBAT_TICKS);
      if (atDestination || progressing || fighting || tick < previous.sinceTick) {
        watchTacticalOrder([unit], tacticalWatch.point, tick);
        return false;
      }
      return tick - previous.sinceTick >= previous.retryTicks;
    });
  }

  function recordObjectiveOwnership(observation) {
    const objectives = Array.isArray(observation.objectives) ? observation.objectives : [];
    const observedIds = new Set();
    for (const objective of objectives) {
      if (typeof objective?.id !== 'string' || !Number.isInteger(objective.owner)) continue;
      observedIds.add(objective.id);
      const previousOwner = objectiveOwners.get(objective.id);
      if (previousOwner === observation.team && objective.owner !== observation.team) {
        lostObjectiveIds.add(objective.id);
      } else if (objective.owner === observation.team) {
        lostObjectiveIds.delete(objective.id);
      }
      objectiveOwners.set(objective.id, objective.owner);
    }
    for (const id of objectiveOwners.keys()) {
      if (!observedIds.has(id)) {
        objectiveOwners.delete(id);
        lostObjectiveIds.delete(id);
      }
    }
  }

  function nextGatherCommands(observation) {
    const reserved = productionPolicy.reservedBuilder();
    const workers = observation.units.friendly
      .filter((unit) => unit.kind === 'worker' && unit.hp > 0
        && !(reserved && unit.id === reserved.id && unit.generation === reserved.generation))
      .sort((left, right) => left.id - right.id);
    const liveKeys = new Set(workers.map((worker) => `${worker.id}:${worker.generation}`));
    for (const key of gatherAssignments.keys()) {
      if (!liveKeys.has(key)) gatherAssignments.delete(key);
    }

    const nodesByType = { food: [], wood: [] };
    const sources = [...observation.resourceNodes];
    // Keep ordinary-node preferences; forest is the missing Wood fallback.
    if (!sources.some(node => node.type === 'wood' && node.stock > 0)) {
      for (const tree of observation.forestCells || []) sources.push({ ...tree,
        id: `forest:${tree.cell}`, type: 'wood', forestCell: tree.cell });
    }
    for (const node of sources) {
      if (RESOURCE_TYPES.includes(node.type) && node.stock > 0
        && Number.isFinite(node.x) && Number.isFinite(node.z)) {
        nodesByType[node.type].push(node);
      }
    }
    for (const nodes of Object.values(nodesByType)) {
      nodes.sort((left, right) => left.id.localeCompare(right.id));
    }
    if (workers.length === 0 || RESOURCE_TYPES.every((type) => nodesByType[type].length === 0)) return [];

    const tick = Number.isSafeInteger(observation.tick) ? observation.tick : 0;
    const observedNodesById = new Map(sources.map((node) => [node.id, node]));
    const availableNodeIds = new Set(RESOURCE_TYPES.flatMap((type) => nodesByType[type].map((node) => node.id)));
    const typeLoads = { food: 0, wood: 0 };
    const nodeLoads = new Map();
    const isGathering = (worker) => worker.task === 'gathering' || worker.task === 'returning';
    const isGatherOrderPending = (assignment) => {
      if (!assignment || !Number.isSafeInteger(assignment.pendingSinceTick)) return false;
      const observedNode = observedNodesById.get(assignment.nodeId);
      if (observedNode && observedNode.stock <= 0) return false;
      return tick - assignment.pendingSinceTick < GATHER_ORDER_RETRY_TICKS;
    };
    const addLoad = (assignment) => {
      if (!RESOURCE_TYPES.includes(assignment.type)) return;
      typeLoads[assignment.type]++;
      if (availableNodeIds.has(assignment.nodeId)) {
        nodeLoads.set(assignment.nodeId, (nodeLoads.get(assignment.nodeId) || 0) + 1);
      }
    };

    for (const worker of workers) {
      const key = `${worker.id}:${worker.generation}`;
      const assignment = gatherAssignments.get(key);
      if (isGathering(worker)) {
        if (assignment) {
          assignment.pendingSinceTick = null;
          addLoad(assignment);
        } else if (RESOURCE_TYPES.includes(worker.cargoType)) {
          typeLoads[worker.cargoType]++;
        }
        continue;
      }
      if (worker.task !== 'idle') {
        gatherAssignments.delete(key);
        continue;
      }
      if (isGatherOrderPending(assignment)) addLoad(assignment);
    }

    const commandsByNode = new Map();
    const chosenNodeByType = new Map();
    for (const worker of workers) {
      if (worker.task !== 'idle') continue;
      const key = `${worker.id}:${worker.generation}`;
      const previous = gatherAssignments.get(key);
      if (isGatherOrderPending(previous)) continue;

      const availableTypes = RESOURCE_TYPES.filter((type) => nodesByType[type].length > 0);
      const preferredType = availableTypes.includes(previous?.type) ? previous.type : null;
      let type = preferredType;
      if (!type) {
        const leastLoad = Math.min(...availableTypes.map((candidate) => typeLoads[candidate]));
        const leastLoadedTypes = availableTypes.filter((candidate) => typeLoads[candidate] === leastLoad);
        type = leastLoadedTypes[seededIndex(normalizedSeed, observation.team, worker.id, leastLoadedTypes.length)];
      }

      const previousNode = previous && nodesByType[type].find((node) => node.id === previous.nodeId);
      let node = previousNode || chosenNodeByType.get(type);
      if (!node) {
        const leastNodeLoad = Math.min(...nodesByType[type].map((candidate) => nodeLoads.get(candidate.id) || 0));
        const leastLoadedNodes = nodesByType[type]
          .filter((candidate) => (nodeLoads.get(candidate.id) || 0) === leastNodeLoad);
        node = nearestResource(leastLoadedNodes, worker);
        chosenNodeByType.set(type, node);
      }
      if (!node) continue;

      gatherAssignments.set(key, { type, nodeId: node.id, pendingSinceTick: tick });
      addLoad({ type, nodeId: node.id });
      const ids = commandsByNode.get(node.id) || [];
      ids.push(worker.id);
      commandsByNode.set(node.id, ids);
    }

    return [...commandsByNode.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([nodeId, ids]) => ({
        type: 'gather',
        ids: ids.sort((left, right) => left - right),
        ...(Number.isInteger(observedNodesById.get(nodeId)?.forestCell)
          ? { forestCell: observedNodesById.get(nodeId).forestCell } : { nodeId }),
      }));
  }

  const siegeBuildingOrders = new Map();

  function nextOrders(observation, reconnaissanceIds = new Set()) {
    if (observation?.schemaVersion !== OPPONENT_OBSERVATION_SCHEMA_VERSION
      || !validTeam(observation.team)) throw new TypeError('Policy requires opponent observation schema v1.');

    recordObjectiveOwnership(observation);
    const gathering = nextGatherCommands(observation);
    const allSoldiers = observation.units.friendly
      .filter(unit => unit.kind !== 'worker' && unit.hp > 0 && !reconnaissanceIds.has(unit.id)).sort((a, b) => a.id - b.id);
    const homeDefense = homeDefensePolicy.next(observation, allSoldiers);
    const regroup = regroupPolicy.next(observation, allSoldiers, homeDefense.units);
    // Keep the opening economy first, but do not let rejected gather orders
    // consume every decision (the retry window is shorter than a normal turn).
    if (gathering.length > 0 && !previousDecisionGatherOnly && homeDefense.units.length === 0 && homeDefense.released.length === 0 && regroup.units.length === 0) {
      previousDecisionGatherOnly = true;
      return gathering;
    }
    previousDecisionGatherOnly = false;

    const siegeUnits = observation.units.friendly.filter(unit => unit.hp > 0 && unit.kind === 'siege-engine').sort((a, b) => a.id - b.id).slice(0, 2);
    const defense = (observation.buildings?.visibleEnemies || []).filter(building => building.hp > 0
      && BUILDING_DEFINITIONS[building.type]?.tags.includes('defense')).slice(0, 64)
      .sort((left, right) => {
        const distance = building => siegeUnits.reduce((sum, unit) => sum + (unit.x - building.x) ** 2 + (unit.z - building.z) ** 2, 0);
        return distance(left) - distance(right) || left.id - right.id;
      })[0];
    const activeSiege = defense ? siegeUnits : [];
    const activeKeys = new Set(activeSiege.map(soldierKey));
    for (const key of siegeBuildingOrders.keys()) if (!activeKeys.has(key)) siegeBuildingOrders.delete(key);
    const unassigned = activeSiege.filter(unit => {
      const order = siegeBuildingOrders.get(soldierKey(unit));
      if (!order || order.buildingId !== defense.id) return true;
      if (Math.hypot(unit.x - order.x, unit.z - order.z) > 0.25 || (unit.lastAttack?.tick ?? -1) > order.attackTick) {
        order.x = unit.x; order.z = unit.z; order.attackTick = unit.lastAttack?.tick ?? -1; order.progressTick = observation.tick;
      }
      return observation.tick - order.progressTick >= TACTICAL_STALL_TICKS;
    });
    const siegeOrders = unassigned.length ? [{ type: 'attackBuilding', ids: unassigned.map(unit => unit.id),
      unitGenerations: unassigned.map(unit => unit.generation), buildingId: defense.id }] : [];
    for (const unit of unassigned) siegeBuildingOrders.set(soldierKey(unit), { buildingId: defense.id, x: unit.x, z: unit.z,
      attackTick: unit.lastAttack?.tick ?? -1, progressTick: observation.tick });
    const availableSoldiers = allSoldiers.filter(unit => !activeKeys.has(soldierKey(unit)));
    const defending = new Set(homeDefense.units.map(soldierKey));
    const rallying = new Set(regroup.units.map(soldierKey));
    for (const identity of defending) orderedSoldiers.delete(identity);
    for (const identity of rallying) orderedSoldiers.delete(identity);
    const soldiers = availableSoldiers.filter(unit => !defending.has(soldierKey(unit)) && !rallying.has(soldierKey(unit)));
    const supportOrders = [...gathering, ...siegeOrders, ...homeDefense.commands, ...regroup.commands];
    if (skirmishPolicy) return [...supportOrders, ...skirmishPolicy.next(observation, soldiers)];
    const liveSoldiers = new Set(soldiers.map(soldierKey));
    for (const key of orderedSoldiers) if (!liveSoldiers.has(key)) orderedSoldiers.delete(key);
    const reinforcements = soldiers.filter((unit) => !orderedSoldiers.has(soldierKey(unit)));
    const objectives = Array.isArray(observation.objectives) ? observation.objectives : [];
    const target = objectiveRotationPolicy.next(observation, soldiers, rankedObjectives(
      objectives, observation.team, soldiers, observation.map, lostObjectiveIds,
    ));
    if (target) {
      defenseRegroupId = null;
      const mustReissue = target.id !== tacticalObjectiveId || lostObjectiveIds.has(target.id);
      tacticalObjectiveId = target.id;
      const stalled = mustReissue ? [] : stalledTacticalSoldiers(
        observation, soldiers, objectives.find((objective) => objective.id === target.id)?.zone,
      );
      if (mustReissue || stalled.length > 0 || reinforcements.length > 0) {
        const retryKeys = new Set(stalled.map(soldierKey));
        const ordered = mustReissue ? soldiers
          : soldiers.filter((unit) => retryKeys.has(soldierKey(unit)) || !orderedSoldiers.has(soldierKey(unit)));
        watchTacticalOrder(ordered, target.point, observation.tick, stalled.length > 0);
        recordOrderedSoldiers(ordered);
        lostObjectiveIds.delete(target.id);
        return [...supportOrders, {
          type: 'attackMove',
          ids: ordered.map((unit) => unit.id),
          x: target.point.x,
          z: target.point.z,
        }];
      }
      return supportOrders;
    }

    tacticalObjectiveId = null;
    if (objectives.length > 0 || soldiers.length === 0) {
      if (soldiers.length === 0) fallbackTacticsStarted = false;
      // When every objective is owned, released defenders regroup at the
      // nearest public owned watch instead of remaining idle beside the raid.
      const released = homeDefense.released;
      const owned = objectives.filter(objective => objective.owner === observation.team && (released.length || objective.id === defenseRegroupId))
        .map(objective => ({ id: objective.id, point: objectiveWorldPoint(objective, observation.map) })).filter(goal => goal.point)
        .sort((a, b) => released.reduce((sum, unit) => sum + Math.hypot(unit.x - a.point.x, unit.z - a.point.z)
          - Math.hypot(unit.x - b.point.x, unit.z - b.point.z), 0) || a.id.localeCompare(b.id))[0];
      if (owned) {
        defenseRegroupId = owned.id;
        const stalled = stalledTacticalSoldiers(observation, soldiers, objectives.find(objective => objective.id === owned.id)?.zone);
        const returning = new Set([...released, ...stalled].map(soldierKey));
        const regroup = soldiers.filter(unit => returning.has(soldierKey(unit)));
        if (regroup.length) {
          watchTacticalOrder(regroup, owned.point, observation.tick, stalled.length > 0);
          recordOrderedSoldiers(regroup);
          return [...supportOrders, { type: 'attackMove', ids: regroup.map(unit => unit.id),
            unitGenerations: regroup.map(unit => unit.generation), ...owned.point }];
        }
      } else { tacticalWatch = null; defenseRegroupId = null; }
      return supportOrders;
    }
    if (fallbackTacticsStarted) {
      const stalled = stalledTacticalSoldiers(observation, soldiers);
      if (stalled.length === 0 && reinforcements.length === 0) return supportOrders;
      const point = tacticalWatch.point;
      const retryKeys = new Set(stalled.map(soldierKey));
      const ordered = soldiers.filter((unit) => retryKeys.has(soldierKey(unit)) || !orderedSoldiers.has(soldierKey(unit)));
      watchTacticalOrder(ordered, point, observation.tick, stalled.length > 0);
      recordOrderedSoldiers(ordered);
      return [...supportOrders, { type: 'attackMove', ids: ordered.map((unit) => unit.id), ...point }];
    }

    const visibleTarget = homeDefense.units.length ? null : observation.units.visibleEnemies
      .filter((unit) => unit.hp > 0)
      .sort((left, right) => left.id - right.id)[0];
    fallbackTacticsStarted = true;
    recordOrderedSoldiers(soldiers);
    watchTacticalOrder(soldiers, { x: visibleTarget?.x ?? 0, z: visibleTarget?.z ?? 0 }, observation.tick);
    return [...supportOrders, {
      type: 'attackMove',
      ids: soldiers.map((unit) => unit.id),
      x: visibleTarget?.x ?? 0,
      z: visibleTarget?.z ?? 0,
    }];

  }

  return {
    next(observation) {
      const reconnaissance = reconnaissancePolicy.next(observation);
      const orders = nextOrders(observation, new Set(reconnaissance.ids));
      const production = productionPolicy.next(observation);
      const builders = new Set(production.filter((command) => ['build', 'repairBuilding'].includes(command.type)).flatMap((command) => command.ids));
      const compatibleOrders = orders.map((command) => command.type === 'gather'
        ? { ...command, ids: command.ids.filter((id) => !builders.has(id)) } : command)
        .filter((command) => !Array.isArray(command.ids) || command.ids.length > 0);
      return [...reconnaissance.commands, ...compatibleOrders, ...production];
    },
  };
}

/**
 * Attach the deterministic policy to a normal WebSocket player. The server's
 * welcome message supplies the assigned team; no seat is passed in commands.
 */
export function attachDeterministicOpponent(socket, {
  seed = DEFAULT_OPPONENT_SEED,
  decisionIntervalMs = DEFAULT_OPPONENT_DECISION_INTERVAL_MS,
  onCommand = () => {},
  onError = () => {},
} = {}) {
  if (!socket || typeof socket.send !== 'function' || typeof socket.addEventListener !== 'function') {
    throw new TypeError('Opponent needs a WebSocket-compatible player connection.');
  }
  if (!Number.isSafeInteger(seed)) throw new TypeError('Opponent seed must be a safe integer.');
  if (!Number.isInteger(decisionIntervalMs) || decisionIntervalMs < 100 || decisionIntervalMs > 60_000) {
    throw new TypeError('Opponent decision interval must be from 100 to 60000 milliseconds.');
  }

  let team = null;
  let map = null;
  let latestState = null;
  let finished = false;
  let socketClosed = false;
  let disposed = false;
  let nextClientOrderToken = 1;
  let reportedNoSeat = false;
  let timer = null;
  let matchMode = normalizeMatchMode();
  let policy = createDeterministicPolicy(seed, matchMode);
  let invalidMatchMode = false;
  let previousWinner = null;
  let hostResetPending = false;

  const resetForNewMatch = (identity = matchMode) => {
    matchMode = identity;
    policy = createDeterministicPolicy(seed, matchMode);
    invalidMatchMode = false;
    finished = false;
    hostResetPending = false;
  };

  const handleMessage = async (event) => {
    let message;
    try {
      const data = typeof event?.data === 'string' ? event.data
        : typeof event?.data?.text === 'function' ? await event.data.text()
          : String(event?.data ?? '');
      message = JSON.parse(data);
    } catch {
      return;
    }

    // Welcome/map-change identify a fresh setup. State identity is authoritative
    // after recovery, but unchanged snapshots must preserve private policy watches.
    if (message.type === 'welcome' || message.type === 'mapChange' || message.type === 'state') {
      const carriesIdentity = value => value && (Object.hasOwn(value, 'matchModeId')
        || Object.hasOwn(value, 'matchModeVersion'));
      const freshSetup = message.type !== 'state';
      if (freshSetup || carriesIdentity(message)) {
        try {
          const identity = normalizeMatchMode(carriesIdentity(message) ? message : message.state ?? {});
          if (freshSetup || identity.matchModeId !== matchMode.matchModeId
            || identity.matchModeVersion !== matchMode.matchModeVersion) resetForNewMatch(identity);
        } catch (error) {
          invalidMatchMode = true;
          onError(error instanceof Error ? error : new Error(String(error)));
          return;
        }
      }
    }

    if (message.type === 'welcome') {
      team = validTeam(message.player?.team) ? message.player.team : null;
      map = message.map && typeof message.map === 'object' ? message.map : null;
      latestState = message.state?.type === 'state' ? message.state : null;
      previousWinner = Number.isInteger(latestState?.winner) ? latestState.winner : null;
      if (team === null && !reportedNoSeat) {
        reportedNoSeat = true;
        onError(new Error('The server assigned this connection as a spectator; no bot seat is available.'));
      }
    } else if (message.type === 'mapChange') {
      map = message.map && typeof message.map === 'object' ? message.map : map;
      latestState = message.state?.type === 'state' ? message.state : latestState;
      previousWinner = Number.isInteger(latestState?.winner) ? latestState.winner : null;
    } else if (message.type === 'notice'
      && typeof message.message === 'string' && message.message.startsWith('BATTLEFIELD RESET')) {
      hostResetPending = true;
    } else if (message.type === 'state') {
      latestState = message;
      const winner = Number.isInteger(message.winner) ? message.winner : null;
      const winnerCleared = previousWinner !== null && previousWinner >= 0 && winner === -1;
      const hostResetConfirmed = hostResetPending && team !== null
        && isPristineMatchState(message, team, map);
      hostResetPending = false;
      previousWinner = winner;
      if (!invalidMatchMode && (winnerCleared || hostResetConfirmed)) resetForNewMatch();
    } else if (message.type === 'victory') {
      finished = true;
    }
  };

  const handleClose = () => {
    socketClosed = true;
    if (timer) clearInterval(timer);
  };
  socket.addEventListener('message', handleMessage);
  socket.addEventListener('close', handleClose);
  timer = setInterval(() => {
    if (socketClosed || disposed || finished || invalidMatchMode || team === null || !latestState || socket.readyState !== 1) return;
    let observation;
    try {
      observation = toOpponentObservation(latestState, team, map);
      const commands = policy.next(observation);
      for (const command of commands) {
        const outbound = { ...command, clientOrderToken: nextClientOrderToken++ };
        socket.send(JSON.stringify(outbound));
        onCommand({ team, command: outbound, observation });
      }
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)));
      finished = true;
    }
  }, decisionIntervalMs);

  return {
    get team() { return team; },
    get seed() { return seed; },
    close() {
      if (disposed) return;
      disposed = true;
      if (timer) clearInterval(timer);
      socket.removeEventListener?.('message', handleMessage);
      socket.removeEventListener?.('close', handleClose);
    },
  };
}
