import { resolveEconomyProfileId, economyResources } from '../economy-profile.mjs';
import { validateMapAudioReference } from '../world/map-audio-reference.mjs';
import { validateMapRegion } from '../regions.mjs';
import { TERRAIN_MATERIALS } from '../terrain-materials.mjs';
import { UNIT_DEFINITIONS } from '../gameplay-definitions.mjs';
import { buildElevationGrid, findUnreachableCaptureZone, findUnreachableResourceNode,
  validateElevationPatches } from '../map-utils.mjs';
import { findInvalidCapturePrerequisite } from '../world/capture-prerequisites.mjs';
import { findInvalidScenarioEventChain } from '../world/scenario-event-chain.mjs';
import { findInvalidResourceVariant } from '../shore-fishing.mjs';
import { validCompletionTrigger, validRegionEntryTrigger, validateScenarioRegions } from '../scenario-regions.mjs';
import { validWildlifeNodeDefinition } from '../wildlife-state.mjs';

// Authoritative map validation only. Catalog, activation, mode, storage and
// running match state remain in their existing callers; all policy comes from the host.
export function createMapDefinitionValidator({
  maxUnits: MAX_UNITS, maxMapObstacles: MAX_MAP_OBSTACLES,
  maxResourceNodes: MAX_RESOURCE_NODES, maxObjectiveFoodReward: MAX_OBJECTIVE_FOOD_REWARD,
  maxMapScenarioEvents: MAX_MAP_SCENARIO_EVENTS, maxScenarioEventRepeats: MAX_SCENARIO_EVENT_REPEATS,
  minScenarioEventRepeatSeconds: MIN_SCENARIO_EVENT_REPEAT_SECONDS, researchRulesFor,
}) {
  return function validateMapDefinition(definition, filename) {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      throw new Error(`Map ${filename} must contain a JSON object.`);
    }
    resolveEconomyProfileId(definition.economyProfileId);
    validateMapAudioReference(definition.audio);
    validateMapRegion(definition.region);
    definition.victoryMode ??= 'any';
    if (!['any', 'all'].includes(definition.victoryMode)) {
      throw new Error(`Map ${filename} victoryMode must be "any" or "all".`);
    }
    if (definition.startingArmySize !== undefined
      && (!Number.isInteger(definition.startingArmySize)
        || definition.startingArmySize < 8
        || definition.startingArmySize > MAX_UNITS
        || definition.startingArmySize % 2 !== 0)) {
      throw new Error(`Map ${filename} startingArmySize must be an even total from 8 to ${MAX_UNITS}.`);
    }
    if (definition.startingResources !== undefined) {
      const resources = definition.startingResources;
      if (!resources || typeof resources !== 'object' || Array.isArray(resources)
        || Object.keys(resources).some((key) => !['food', 'wood'].includes(key))
        || (resources.food !== undefined && (!Number.isInteger(resources.food)
          || resources.food < 0 || resources.food > 100_000))
        || (resources.wood !== undefined && (!Number.isInteger(resources.wood)
          || resources.wood < 0 || resources.wood > 100_000))) {
        throw new Error(`Map ${filename} has invalid starting food or wood.`);
      }
    }
    definition.fogOfWar ??= false;
    if (typeof definition.fogOfWar !== 'boolean') {
      throw new Error(`Map ${filename} fogOfWar must be a boolean.`);
    }
    if (typeof definition.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(definition.id)) {
      throw new Error(`Map ${filename} needs a lowercase hyphenated id.`);
    }
    if (typeof definition.name !== 'string' || !definition.name.trim() || definition.name.length > 48) {
      throw new Error(`Map ${filename} needs a display name.`);
    }
    if (definition.summary !== undefined
      && (typeof definition.summary !== 'string' || definition.summary.length > 120)) {
      throw new Error(`Map ${filename} scenario brief must be 120 characters or fewer.`);
    }
    if (!Number.isInteger(definition.width) || !Number.isInteger(definition.height)
      || definition.width < 16 || definition.height < 16
      || definition.width > 256 || definition.height > 256) {
      throw new Error(`Map ${filename} width and height must be integers between 16 and 256.`);
    }
    const invalidElevationPatches = validateElevationPatches(
      definition.width, definition.height, definition.elevationPatches,
    );
    if (invalidElevationPatches) {
      const detail = invalidElevationPatches.patchIndex === undefined
        ? `reason ${invalidElevationPatches.reason}`
        : `patch ${invalidElevationPatches.patchIndex} ${invalidElevationPatches.reason}`;
      throw new Error(`Map ${filename} has invalid elevation patches: ${detail}.`);
    }
    const elevationLevels = buildElevationGrid(
      definition.width, definition.height, definition.elevationPatches,
    );
    const terrainMaterials = TERRAIN_MATERIALS;
    if (definition.terrainBase !== undefined && !terrainMaterials.includes(definition.terrainBase)) {
      throw new Error(`Map ${filename} has an invalid base terrain material.`);
    }
    const terrainPatches = definition.terrainPatches ?? [];
    if (!Array.isArray(terrainPatches) || terrainPatches.length > 4096) {
      throw new Error(`Map ${filename} has too many terrain paint patches.`);
    }
    const paintedCells = new Uint8Array(definition.width * definition.height);
    for (const patch of terrainPatches) {
      const { column, row, width, height, material } = patch || {};
      if (![column, row, width, height].every(Number.isInteger)
        || column < 0 || row < 0 || width < 1 || height < 1
        || column + width > definition.width || row + height > definition.height
        || !terrainMaterials.includes(material)) {
        throw new Error(`Map ${filename} has an invalid terrain paint patch.`);
      }
      for (let paintedRow = row; paintedRow < row + height; paintedRow++) {
        for (let paintedColumn = column; paintedColumn < column + width; paintedColumn++) {
          const index = paintedRow * definition.width + paintedColumn;
          if (paintedCells[index]) throw new Error(`Map ${filename} has overlapping terrain paint patches.`);
          paintedCells[index] = 1;
        }
      }
    }
    if (!Array.isArray(definition.obstacles) || definition.obstacles.length > MAX_MAP_OBSTACLES
      || !Array.isArray(definition.spawnPoints)) {
      throw new Error(`Map ${filename} must define obstacle and spawnPoints arrays.`);
    }
    const teams = new Set();
    const obstacleCells = new Uint8Array(definition.width * definition.height);
    for (const spawn of definition.spawnPoints) {
      if (!spawn || ![0, 1].includes(spawn.team) || teams.has(spawn.team)
        || !Number.isFinite(spawn.x) || !Number.isFinite(spawn.z)) {
        throw new Error(`Map ${filename} needs exactly one finite spawn point for teams 0 and 1.`);
      }
      teams.add(spawn.team);
      if (Math.abs(spawn.x) >= definition.width / 2 || Math.abs(spawn.z) >= definition.height / 2) {
        throw new Error(`Map ${filename} has a spawn point outside the playfield.`);
      }
    }
    if (teams.size !== 2) throw new Error(`Map ${filename} needs exactly one spawn point for teams 0 and 1.`);
    for (const obstacle of definition.obstacles) {
      const { column, row, width, height } = obstacle || {};
      if (![column, row, width, height].every(Number.isInteger)
        || column < 0 || row < 0 || width < 1 || height < 1
        || column + width > definition.width || row + height > definition.height
        || (obstacle?.material !== undefined && !['stone', 'forest', 'water'].includes(obstacle.material))
        || (obstacle?.elevation !== undefined && (!Number.isFinite(obstacle.elevation) || obstacle.elevation <= 0))) {
        throw new Error(`Map ${filename} has an obstacle outside the grid or with invalid dimensions.`);
      }
      for (let row = obstacle.row; row < obstacle.row + obstacle.height; row++) {
        for (let column = obstacle.column; column < obstacle.column + obstacle.width; column++) {
          const index = row * definition.width + column;
          if (obstacleCells[index]) throw new Error(`Map ${filename} has overlapping terrain blocks.`);
          obstacleCells[index] = 1;
        }
      }
    }
    for (const spawn of definition.spawnPoints) {
      const column = Math.floor(spawn.x + definition.width / 2);
      const row = Math.floor(spawn.z + definition.height / 2);
      if (obstacleCells[row * definition.width + column]) {
        throw new Error(`Map ${filename} team ${spawn.team} spawn must be on an open cell.`);
      }
    }
    const triggers = definition.triggers ?? [];
    if (!Array.isArray(triggers) || triggers.length > 32) {
      throw new Error(`Map ${filename} triggers must be an array with at most 32 entries.`);
    }
    const triggerIds = new Set();
    for (const trigger of triggers) {
      const zone = trigger?.zone;
      if (typeof trigger?.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trigger.id)
        || triggerIds.has(trigger.id) || typeof trigger.name !== 'string' || !trigger.name.trim()
        || trigger.type !== 'capture-zone' || !zone
        || ![zone.column, zone.row, zone.width, zone.height].every(Number.isInteger)
        || zone.column < 0 || zone.row < 0 || zone.width < 1 || zone.height < 1
        || zone.column + zone.width > definition.width || zone.row + zone.height > definition.height
        || !Number.isInteger(trigger.requiredUnits) || trigger.requiredUnits < 1 || trigger.requiredUnits > MAX_UNITS / 2
        || !Number.isFinite(trigger.captureSeconds) || trigger.captureSeconds < 0.5 || trigger.captureSeconds > 60
        || (trigger.foodReward !== undefined && (!Number.isInteger(trigger.foodReward)
          || trigger.foodReward < 0 || trigger.foodReward > MAX_OBJECTIVE_FOOD_REWARD))
        || (trigger.woodReward !== undefined && (!Number.isInteger(trigger.woodReward)
          || trigger.woodReward < 0 || trigger.woodReward > MAX_OBJECTIVE_FOOD_REWARD))
        || (trigger.unitCount !== undefined && (!Number.isInteger(trigger.unitCount)
          || trigger.unitCount < 0 || trigger.unitCount > 25))
        || (trigger.unitKind !== undefined && (!Object.hasOwn(UNIT_DEFINITIONS, trigger.unitKind) || UNIT_DEFINITIONS[trigger.unitKind].movementDomain === 'water'))
        || (trigger.requires !== undefined && (typeof trigger.requires !== 'string'
          || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trigger.requires)))
        || (trigger.requiresAll !== undefined && (trigger.requires !== undefined
          || !Array.isArray(trigger.requiresAll) || trigger.requiresAll.length < 2 || trigger.requiresAll.length > 31
          || trigger.requiresAll.some((id) => typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))))
        || (trigger.victory !== undefined && typeof trigger.victory !== 'boolean')
        || (trigger.message !== undefined && (typeof trigger.message !== 'string' || trigger.message.length > 120))) {
        throw new Error(`Map ${filename} has an invalid scenario trigger.`);
      }
      triggerIds.add(trigger.id);
      let hasWalkableCell = false;
      for (let row = zone.row; row < zone.row + zone.height && !hasWalkableCell; row++) {
        for (let column = zone.column; column < zone.column + zone.width; column++) {
          if (!obstacleCells[row * definition.width + column]) { hasWalkableCell = true; break; }
        }
      }
      if (!hasWalkableCell) throw new Error(`Map ${filename} trigger ${trigger.id} covers no walkable cells.`);
    }
    if (definition.victoryHoldSeconds !== undefined
      && (!Number.isFinite(definition.victoryHoldSeconds) || definition.victoryHoldSeconds < 0
        || (definition.victoryHoldSeconds > 0 && definition.victoryHoldSeconds < 0.5)
        || definition.victoryHoldSeconds > 3600
        || (definition.victoryHoldSeconds > 0 && !triggers.some((trigger) => trigger.victory === true)))) {
      throw new Error(`Map ${filename} has an invalid victory hold duration or no marked victory zones.`);
    }
    const invalidPrerequisite = findInvalidCapturePrerequisite(triggers);
    if (invalidPrerequisite) {
      const detail = invalidPrerequisite.reason === 'missing'
        ? `requires missing capture zone ${invalidPrerequisite.requires}`
        : invalidPrerequisite.reason === 'self' ? 'cannot require itself'
          : invalidPrerequisite.reason === 'duplicate' ? 'lists the same prerequisite more than once'
            : invalidPrerequisite.reason === 'cycle' ? 'creates a prerequisite cycle'
              : 'creates an invalid prerequisite graph';
      throw new Error(`Map ${filename} capture zone ${invalidPrerequisite.triggerId} ${detail}.`);
    }
    const unreachableTrigger = findUnreachableCaptureZone(
      definition.width, definition.height, obstacleCells, definition.spawnPoints, triggers, elevationLevels,
    );
    if (unreachableTrigger) {
      throw new Error(`Map ${filename} capture zone ${unreachableTrigger.triggerId} is unreachable from team ${unreachableTrigger.team}.`);
    }
    if (definition.timedVictory !== undefined) {
      const rule = definition.timedVictory;
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)
        || !Number.isFinite(rule.afterSeconds) || rule.afterSeconds < 0.5 || rule.afterSeconds > 3600
        || typeof rule.objectiveId !== 'string'
        || !triggers.some((trigger) => trigger.id === rule.objectiveId)) {
        throw new Error(`Map ${filename} has an invalid timed victory rule.`);
      }
    }
    const regions = validateScenarioRegions(definition);
    const scenarioEvents = definition.scenarioEvents ?? [];
    if (!Array.isArray(scenarioEvents) || scenarioEvents.length > MAX_MAP_SCENARIO_EVENTS) {
      throw new Error(`Map ${filename} scenarioEvents must be an array with at most ${MAX_MAP_SCENARIO_EVENTS} entries.`);
    }
    const allowsVictoryZoneCaptureDrops = (definition.victoryMode === 'all'
      && triggers.filter((trigger) => trigger.victory === true).length >= 2)
      || (definition.victoryHoldSeconds ?? 0) > 0;
    const scenarioEventIds = new Set();
    for (const event of scenarioEvents) {
      const eventTrigger = event?.trigger;
      const captureTriggered = eventTrigger?.type === 'capture';
      const eventTriggered = eventTrigger?.type === 'event';
      const validCaptureTrigger = captureTriggered
        && typeof eventTrigger === 'object' && !Array.isArray(eventTrigger)
        && Object.keys(eventTrigger).every((key) => ['type', 'objectiveId', 'occurrence'].includes(key))
        && typeof eventTrigger.objectiveId === 'string'
        && (eventTrigger.occurrence === undefined
          || ['first', 'recapture'].includes(eventTrigger.occurrence))
        && triggers.some((trigger) => trigger.id === eventTrigger.objectiveId
          && (trigger.victory !== true || allowsVictoryZoneCaptureDrops));
      const validEventChain = eventTriggered
        && typeof eventTrigger === 'object' && !Array.isArray(eventTrigger)
        && Object.keys(eventTrigger).every((key) => ['type', 'eventId', 'eventIds'].includes(key))
        && !(Object.hasOwn(eventTrigger, 'eventId') && Object.hasOwn(eventTrigger, 'eventIds'))
        && (typeof eventTrigger.eventId === 'string'
          ? /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(eventTrigger.eventId)
          : Array.isArray(eventTrigger.eventIds) && eventTrigger.eventIds.length >= 2
            && eventTrigger.eventIds.length <= MAX_MAP_SCENARIO_EVENTS - 1
            && eventTrigger.eventIds.every((id) => typeof id === 'string'
              && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)));
      if (['construction-complete', 'research-complete'].includes(eventTrigger?.type) && !validCompletionTrigger(eventTrigger)) {
        throw new Error(`Event ${event.id}: trigger.${eventTrigger.type === 'construction-complete' ? 'buildingType' : 'technologyId'} must be a registered ID and trigger.team must be 0, 1 or either.`);
      }
      if (eventTrigger?.type === 'region-entry' && !regions.some(region => region.id === eventTrigger.regionId)) {
        throw new Error(`Event ${event.id}: invalid timed supply event trigger.regionId; choose an existing named region.`);
      }
      const validEventTrigger = eventTrigger === undefined || validCaptureTrigger || validEventChain || validRegionEntryTrigger(eventTrigger, regions) || validCompletionTrigger(eventTrigger);
      if (typeof event?.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(event.id)
        || scenarioEventIds.has(event.id) || event.type !== 'timed-supply'
        || typeof event.name !== 'string' || !event.name.trim() || event.name.length > 48
        || !Number.isFinite(event.afterSeconds) || event.afterSeconds < 0.5 || event.afterSeconds > 3600
        || ((event.repeatCount === undefined) !== (event.repeatEverySeconds === undefined))
        || (event.repeatCount !== undefined && (!Number.isInteger(event.repeatCount)
          || event.repeatCount < 1 || event.repeatCount > MAX_SCENARIO_EVENT_REPEATS
          || !Number.isFinite(event.repeatEverySeconds)
          || event.repeatEverySeconds < MIN_SCENARIO_EVENT_REPEAT_SECONDS
          || event.repeatEverySeconds > 3600))
        || !validEventTrigger
        || (!['0', '1', 'both'].includes(event.team)
          && !(event.team === 'capturing' && (captureTriggered || eventTriggered)))
        || !Number.isInteger(event.foodReward) || event.foodReward < 0
        || event.foodReward > MAX_OBJECTIVE_FOOD_REWARD
        || (event.woodReward !== undefined && (!Number.isInteger(event.woodReward)
          || event.woodReward < 0 || event.woodReward > MAX_OBJECTIVE_FOOD_REWARD))
        || (event.unitCount !== undefined && (!Number.isInteger(event.unitCount)
          || event.unitCount < 0 || event.unitCount > 25))
        || (event.unitKind !== undefined && (!Object.hasOwn(UNIT_DEFINITIONS, event.unitKind) || UNIT_DEFINITIONS[event.unitKind].movementDomain === 'water'))
        || (event.technologyReward !== undefined && (typeof event.technologyReward !== 'string'
          || !researchRulesFor(event.technologyReward)))
        || (event.message !== undefined && (typeof event.message !== 'string' || event.message.length > 120))
        || (event.foodReward === 0 && (event.woodReward ?? 0) === 0
          && (event.unitCount ?? 0) === 0 && !event.technologyReward && !event.message?.trim())) {
        throw new Error(`Map ${filename} has an invalid timed supply event.`);
      }
      scenarioEventIds.add(event.id);
    }
    const invalidEventChain = findInvalidScenarioEventChain(scenarioEvents);
    if (invalidEventChain) {
      const detail = invalidEventChain.reason === 'missing'
        ? `references missing scenario event ${invalidEventChain.sourceId}`
        : invalidEventChain.reason === 'cycle' ? 'creates a scenario event cycle'
          : invalidEventChain.reason === 'duplicate' ? 'lists the same source event more than once'
          : 'uses the capturing team without a capture-triggered event in its chain';
      throw new Error(`Map ${filename} scenario event ${invalidEventChain.eventId} ${detail}.`);
    }
    const resourceNodes = definition.resourceNodes ?? [];
    if (!Array.isArray(resourceNodes) || resourceNodes.length > MAX_RESOURCE_NODES) {
      throw new Error(`Map ${filename} resourceNodes must be an array with at most ${MAX_RESOURCE_NODES} entries.`);
    }
    const resourceNodeIds = new Set();
    for (const node of resourceNodes) {
      if (typeof node?.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(node.id)
        || resourceNodeIds.has(node.id) || !economyResources(definition.economyProfileId).includes(node.type)
        || !Number.isFinite(node.x) || !Number.isFinite(node.z)
        || Math.abs(node.x) >= definition.width / 2 || Math.abs(node.z) >= definition.height / 2
        || !Number.isFinite(node.stock) || node.stock <= 0 || !validWildlifeNodeDefinition(node)) {
        throw new Error(`Map ${filename} has an invalid or duplicate resource node (wildlife requires food and bellweather-sheep; lifecycle is runtime-only).`);
      }
      resourceNodeIds.add(node.id);
      const column = Math.floor(node.x + definition.width / 2);
      const row = Math.floor(node.z + definition.height / 2);
      if (obstacleCells[row * definition.width + column]) {
        throw new Error(`Map ${filename} resource node ${node.id} must be on an open cell.`);
      }
    }
    const invalidVariant = findInvalidResourceVariant(definition);
    if (invalidVariant) {
      throw new Error(`Map ${filename} resource node ${invalidVariant.nodeId}: ${invalidVariant.reason}.`);
    }
    const unreachableNode = findUnreachableResourceNode(
      definition.width, definition.height, obstacleCells, definition.spawnPoints, resourceNodes, elevationLevels,
    );
    if (unreachableNode) {
      throw new Error(`Map ${filename} resource node ${unreachableNode.nodeId} must be reachable from both team spawns.`);
    }
    return {
      ...definition,
      terrainSeed: Number.isInteger(definition.terrainSeed) ? definition.terrainSeed : 1,
      triggers,
      scenarioEvents,
      ...(definition.regions === undefined ? {} : { regions }),
      resourceNodes,
    };
  };
}
