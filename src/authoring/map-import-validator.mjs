import { UNIT_DEFINITIONS, TECHNOLOGY_DEFINITIONS } from '../gameplay-definitions.mjs';
import { economyResources } from '../economy-profile.mjs';
import { validateMapAudioReference } from '../world/map-audio-reference.mjs';
import { validateMapRegion } from '../regions.mjs';
import { TERRAIN_MATERIALS } from '../terrain-materials.mjs';
import { validWildlifeNodeDefinition } from '../wildlife-state.mjs';
import { findInvalidResourceVariant } from '../shore-fishing.mjs';
import { validateScenarioRegions, validRegionEntryTrigger, validCompletionTrigger } from '../scenario-regions.mjs';
import { buildElevationGrid, findInvalidCapturePrerequisite, findInvalidScenarioEventChain,
  findUnreachableCaptureZone, findUnreachableResourceNode, validateElevationPatches } from '../map-utils.mjs';

// Portable-map validation only. The host supplies its existing authoring policy;
// dialog lifecycle, draft preflight, file reading and server authority stay outside.
export function createMapImportValidator({
  maxPerTeam: MAX_PER_TEAM, maxResourceNodes: MAX_MAP_RESOURCE_NODES,
  maxTriggers: MAX_MAP_TRIGGERS, maxScenarioEvents: MAX_MAP_SCENARIO_EVENTS,
  maxScenarioEventRepeats: MAX_SCENARIO_EVENT_REPEATS,
  minScenarioEventRepeatSeconds: MIN_SCENARIO_EVENT_REPEAT_SECONDS,
  maxObjectiveFoodReward: MAX_OBJECTIVE_FOOD_REWARD,
  maxTriggerUnitReward: MAX_TRIGGER_UNIT_REWARD, obstacleMaterials: EDITOR_MATERIALS,
}) {
  return function validateImportedMap(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON must contain a map object.');
    const definition = JSON.parse(JSON.stringify(value));
    const allowedResources = economyResources(definition.economyProfileId);
    validateMapAudioReference(definition.audio);
    definition.victoryMode ??= 'any';
    definition.fogOfWar ??= false;
    if (typeof definition.fogOfWar !== 'boolean') {
      throw new Error('Fog of war must be enabled or disabled.');
    }
    if (!['any', 'all'].includes(definition.victoryMode)) {
      throw new Error('Victory rule must be set to capture any or hold all marked zones.');
    }
    if (definition.victoryHoldSeconds !== undefined
      && (!Number.isFinite(definition.victoryHoldSeconds) || definition.victoryHoldSeconds < 0
        || (definition.victoryHoldSeconds > 0 && definition.victoryHoldSeconds < 0.5)
        || definition.victoryHoldSeconds > 3600)) {
      throw new Error('Victory hold must be 0 or 0.5 to 3,600 seconds.');
    }
    if (definition.startingResources !== undefined) {
      const resources = definition.startingResources;
      if (!resources || typeof resources !== 'object' || Array.isArray(resources)
        || Object.keys(resources).some((key) => !['food', 'wood'].includes(key))
        || (resources.food !== undefined && (!Number.isInteger(resources.food)
          || resources.food < 0 || resources.food > 100_000))
        || (resources.wood !== undefined && (!Number.isInteger(resources.wood)
          || resources.wood < 0 || resources.wood > 100_000))) {
        throw new Error('Starting food and wood must be whole numbers from 0 to 100,000.');
      }
    }
    if (definition.startingArmySize !== undefined
      && (!Number.isInteger(definition.startingArmySize)
        || definition.startingArmySize < 8 || definition.startingArmySize > 2000
        || definition.startingArmySize % 2 !== 0)) {
      throw new Error('Starting army must be an even total from 8 to 2,000 units.');
    }
    if (definition.summary !== undefined
      && (typeof definition.summary !== 'string' || definition.summary.length > 120)) {
      throw new Error('Scenario brief must be 120 characters or fewer.');
    }
    if (typeof definition.id !== 'string' || definition.id.length > 48
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(definition.id)) {
      throw new Error('Map ID must use lowercase letters, numbers, and hyphens.');
    }
    if (typeof definition.name !== 'string' || !definition.name.trim() || definition.name.length > 48) {
      throw new Error('Map name must be between 1 and 48 characters.');
    }
    if (!Number.isInteger(definition.width) || !Number.isInteger(definition.height)
      || definition.width < 16 || definition.height < 16 || definition.width > 256 || definition.height > 256) {
      throw new Error('Map width and height must be whole numbers between 16 and 256.');
    }
    validateMapRegion(definition.region);
    const invalidElevationPatches = validateElevationPatches(
      definition.width, definition.height, definition.elevationPatches,
    );
    if (invalidElevationPatches) {
      const reason = invalidElevationPatches.reason === 'limit' ? 'more than 4,096 patches'
        : invalidElevationPatches.reason === 'overlap' ? 'overlapping patches'
          : invalidElevationPatches.reason === 'level' ? 'a level outside 0–2'
            : invalidElevationPatches.reason === 'bounds' ? 'a patch outside the map grid'
              : 'an invalid patch list';
      throw new Error(`Map has invalid elevation patches: ${reason}.`);
    }
    if (definition.terrainBase !== undefined && !TERRAIN_MATERIALS.includes(definition.terrainBase)) {
      throw new Error('Map has an invalid base ground material.');
    }
    const terrainPatches = definition.terrainPatches ?? [];
    if (!Array.isArray(terrainPatches) || terrainPatches.length > 4096) {
      throw new Error('Map must contain at most 4,096 ground paint patches.');
    }
    const paintedCells = new Uint8Array(definition.width * definition.height);
    for (const patch of terrainPatches) {
      const { column, row, width, height, material } = patch || {};
      if (![column, row, width, height].every(Number.isInteger)
        || column < 0 || row < 0 || width < 1 || height < 1
        || column + width > definition.width || row + height > definition.height
        || !TERRAIN_MATERIALS.includes(material)) {
        throw new Error('Map has a ground paint patch outside its grid or with an invalid material.');
      }
      for (let paintedRow = row; paintedRow < row + height; paintedRow++) {
        for (let paintedColumn = column; paintedColumn < column + width; paintedColumn++) {
          const index = paintedRow * definition.width + paintedColumn;
          if (paintedCells[index]) throw new Error('Map has overlapping ground paint patches.');
          paintedCells[index] = 1;
        }
      }
    }
    if (!Array.isArray(definition.obstacles) || definition.obstacles.length > 4096) {
      throw new Error('Map must contain at most 4,096 terrain blocks.');
    }
    const blockedCells = new Uint8Array(definition.width * definition.height);
    for (const obstacle of definition.obstacles) {
      const { column, row, width, height } = obstacle || {};
      if (![column, row, width, height].every(Number.isInteger)
        || column < 0 || row < 0 || width < 1 || height < 1
        || column + width > definition.width || row + height > definition.height
        || (obstacle?.material !== undefined && !EDITOR_MATERIALS.includes(obstacle.material))
        || (obstacle?.elevation !== undefined && (!Number.isFinite(obstacle.elevation) || obstacle.elevation <= 0))) {
        throw new Error('Map has a terrain block outside its grid or with invalid dimensions.');
      }
      for (let row = obstacle.row; row < obstacle.row + obstacle.height; row++) {
        for (let column = obstacle.column; column < obstacle.column + obstacle.width; column++) {
          const index = row * definition.width + column;
          if (blockedCells[index]) throw new Error('Map has overlapping terrain blocks.');
          blockedCells[index] = 1;
        }
      }
    }
    if (!Array.isArray(definition.spawnPoints) || definition.spawnPoints.length !== 2) {
      throw new Error('Map needs one spawn point for each team.');
    }
    const teams = new Set();
    for (const spawn of definition.spawnPoints) {
      if (!spawn || ![0, 1].includes(spawn.team) || teams.has(spawn.team)
        || !Number.isFinite(spawn.x) || !Number.isFinite(spawn.z)
        || Math.abs(spawn.x) >= definition.width / 2 || Math.abs(spawn.z) >= definition.height / 2) {
        throw new Error('Map needs one valid, in-bounds spawn point for each team.');
      }
      teams.add(spawn.team);
      const column = Math.floor(spawn.x + definition.width / 2);
      const row = Math.floor(spawn.z + definition.height / 2);
      if (blockedCells[row * definition.width + column]) {
        throw new Error(`Team ${spawn.team} spawn is on blocked terrain.`);
      }
    }
    definition.resourceNodes ??= [];
    if (!Array.isArray(definition.resourceNodes) || definition.resourceNodes.length > MAX_MAP_RESOURCE_NODES) {
      throw new Error(`Map may contain at most ${MAX_MAP_RESOURCE_NODES} resource nodes.`);
    }
    const resourceIds = new Set();
    for (const node of definition.resourceNodes) {
      if (!node || typeof node.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(node.id)
        || resourceIds.has(node.id) || !allowedResources.includes(node.type)
        || !Number.isFinite(node.x) || !Number.isFinite(node.z)
        || Math.abs(node.x) >= definition.width / 2 || Math.abs(node.z) >= definition.height / 2
        || !Number.isFinite(node.stock) || node.stock <= 0 || !validWildlifeNodeDefinition(node)) {
        throw new Error('Map has an invalid, duplicate, out-of-bounds or unsupported resource node.');
      }
      resourceIds.add(node.id);
      const column = Math.floor(node.x + definition.width / 2);
      const row = Math.floor(node.z + definition.height / 2);
      if (blockedCells[row * definition.width + column]) throw new Error(`Resource node ${node.id} is on blocked terrain.`);
    }
    const elevationLevels = (definition.elevationPatches || []).some((patch) => patch.level > 0)
      ? buildElevationGrid(definition.width, definition.height, definition.elevationPatches) : null;
    const invalidVariant = findInvalidResourceVariant(definition);
    if (invalidVariant) throw new Error(`Resource node ${invalidVariant.nodeId}: ${invalidVariant.reason}.`);
    const unreachableNode = findUnreachableResourceNode(
      definition.width, definition.height, blockedCells, definition.spawnPoints, definition.resourceNodes,
      elevationLevels,
    );
    if (unreachableNode) {
      throw new Error(`Resource node ${unreachableNode.nodeId} must be reachable from both team spawns.`);
    }
    definition.triggers ??= [];
    if (!Array.isArray(definition.triggers) || definition.triggers.length > MAX_MAP_TRIGGERS) {
      throw new Error(`Map may contain at most ${MAX_MAP_TRIGGERS} scenario triggers.`);
    }
    const triggerIds = new Set();
    for (const trigger of definition.triggers) {
      const zone = trigger?.zone;
      if (typeof trigger?.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trigger.id)
        || triggerIds.has(trigger.id) || trigger.type !== 'capture-zone'
        || typeof trigger.name !== 'string' || !trigger.name.trim() || !zone
        || ![zone.column, zone.row, zone.width, zone.height].every(Number.isInteger)
        || zone.column < 0 || zone.row < 0 || zone.width < 1 || zone.height < 1
        || zone.column + zone.width > definition.width || zone.row + zone.height > definition.height
        || !Number.isInteger(trigger.requiredUnits) || trigger.requiredUnits < 1 || trigger.requiredUnits > MAX_PER_TEAM
        || !Number.isFinite(trigger.captureSeconds) || trigger.captureSeconds < 0.5 || trigger.captureSeconds > 60
        || (trigger.foodReward !== undefined && (!Number.isInteger(trigger.foodReward)
          || trigger.foodReward < 0 || trigger.foodReward > MAX_OBJECTIVE_FOOD_REWARD))
        || (trigger.woodReward !== undefined && (!Number.isInteger(trigger.woodReward)
          || trigger.woodReward < 0 || trigger.woodReward > MAX_OBJECTIVE_FOOD_REWARD))
        || (trigger.unitCount !== undefined && (!Number.isInteger(trigger.unitCount)
          || trigger.unitCount < 0 || trigger.unitCount > MAX_TRIGGER_UNIT_REWARD))
        || (trigger.unitKind !== undefined && (!Object.hasOwn(UNIT_DEFINITIONS, trigger.unitKind) || UNIT_DEFINITIONS[trigger.unitKind].movementDomain === 'water'))
        || (trigger.requires !== undefined && (typeof trigger.requires !== 'string'
          || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trigger.requires)))
        || (trigger.requiresAll !== undefined && (trigger.requires !== undefined
          || !Array.isArray(trigger.requiresAll) || trigger.requiresAll.length < 2 || trigger.requiresAll.length > 31
          || trigger.requiresAll.some((id) => typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))))
        || (trigger.victory !== undefined && typeof trigger.victory !== 'boolean')
        || (trigger.message !== undefined && (typeof trigger.message !== 'string' || trigger.message.length > 120))) {
        throw new Error('Map contains an invalid capture-zone trigger.');
      }
      triggerIds.add(trigger.id);
      let hasWalkableCell = false;
      for (let row = zone.row; row < zone.row + zone.height && !hasWalkableCell; row++) {
        for (let column = zone.column; column < zone.column + zone.width; column++) {
          if (!blockedCells[row * definition.width + column]) { hasWalkableCell = true; break; }
        }
      }
      if (!hasWalkableCell) throw new Error(`Capture zone ${trigger.id} covers no walkable cells.`);
    }
    if ((definition.victoryHoldSeconds ?? 0) > 0
      && !definition.triggers.some((trigger) => trigger.victory === true)) {
      throw new Error('A victory hold timer requires at least one marked victory zone.');
    }
    const invalidPrerequisite = findInvalidCapturePrerequisite(definition.triggers);
    if (invalidPrerequisite) {
      const detail = invalidPrerequisite.reason === 'missing'
        ? `requires missing capture zone ${invalidPrerequisite.requires}`
        : invalidPrerequisite.reason === 'self' ? 'cannot require itself'
          : invalidPrerequisite.reason === 'duplicate' ? 'lists the same prerequisite more than once'
            : invalidPrerequisite.reason === 'cycle' ? 'creates a prerequisite cycle'
              : 'creates an invalid prerequisite graph';
      throw new Error(`Capture zone ${invalidPrerequisite.triggerId} ${detail}.`);
    }
    if (definition.timedVictory !== undefined) {
      const rule = definition.timedVictory;
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)
        || !Number.isFinite(rule.afterSeconds) || rule.afterSeconds < 0.5 || rule.afterSeconds > 3600
        || typeof rule.objectiveId !== 'string'
        || !definition.triggers.some((trigger) => trigger.id === rule.objectiveId)) {
        throw new Error('Deadline victory must have a time from 0.5 to 3,600 seconds and a valid capture zone.');
      }
    }
    const unreachableTrigger = findUnreachableCaptureZone(
      definition.width, definition.height, blockedCells, definition.spawnPoints, definition.triggers,
      elevationLevels,
    );
    if (unreachableTrigger) {
      throw new Error(`Capture zone ${unreachableTrigger.triggerId} is unreachable from team ${unreachableTrigger.team}.`);
    }
    const regions = validateScenarioRegions(definition);
    definition.scenarioEvents ??= [];
    if (!Array.isArray(definition.scenarioEvents) || definition.scenarioEvents.length > MAX_MAP_SCENARIO_EVENTS) {
      throw new Error(`Map may contain at most ${MAX_MAP_SCENARIO_EVENTS} scenario events.`);
    }
    const allowsVictoryZoneCaptureDrops = (definition.victoryMode === 'all'
      && definition.triggers.filter((trigger) => trigger.victory === true).length >= 2)
      || (definition.victoryHoldSeconds ?? 0) > 0;
    const scenarioEventIds = new Set();
    for (const event of definition.scenarioEvents) {
      const eventTrigger = event?.trigger;
      const captureTriggered = eventTrigger?.type === 'capture';
      const eventTriggered = eventTrigger?.type === 'event';
      const validCaptureTrigger = captureTriggered
        && typeof eventTrigger === 'object' && !Array.isArray(eventTrigger)
        && Object.keys(eventTrigger).every((key) => ['type', 'objectiveId', 'occurrence'].includes(key))
        && typeof eventTrigger.objectiveId === 'string'
        && (eventTrigger.occurrence === undefined
          || ['first', 'recapture'].includes(eventTrigger.occurrence))
        && definition.triggers.some((trigger) => trigger.id === eventTrigger.objectiveId
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
      if (['construction-complete', 'research-complete'].includes(eventTrigger?.type) && !validCompletionTrigger(eventTrigger)) throw new Error(`Event ${event.id}: choose a registered ${eventTrigger.type === 'construction-complete' ? 'buildingType' : 'technologyId'} and team.`);
      if (eventTrigger?.type === 'region-entry' && !regions.some(r => r.id === eventTrigger.regionId)) throw new Error(`Event ${event.id}: trigger.regionId must reference an existing named region.`);
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
        || !Number.isInteger(event.foodReward) || event.foodReward < 0 || event.foodReward > MAX_OBJECTIVE_FOOD_REWARD
        || (event.woodReward !== undefined && (!Number.isInteger(event.woodReward)
          || event.woodReward < 0 || event.woodReward > MAX_OBJECTIVE_FOOD_REWARD))
        || (event.unitCount !== undefined && (!Number.isInteger(event.unitCount)
          || event.unitCount < 0 || event.unitCount > 25))
        || (event.unitKind !== undefined && (!Object.hasOwn(UNIT_DEFINITIONS, event.unitKind) || UNIT_DEFINITIONS[event.unitKind].movementDomain === 'water'))
        || (event.technologyReward !== undefined
          && !Object.hasOwn(TECHNOLOGY_DEFINITIONS, event.technologyReward))
        || (event.message !== undefined && (typeof event.message !== 'string' || event.message.length > 120))
        || (event.foodReward === 0 && (event.woodReward ?? 0) === 0
          && (event.unitCount ?? 0) === 0 && !event.technologyReward && !event.message?.trim())) {
        throw new Error('Map contains an invalid timed supply event.');
      }
      scenarioEventIds.add(event.id);
    }
    const invalidEventChain = findInvalidScenarioEventChain(definition.scenarioEvents);
    if (invalidEventChain) {
      const detail = invalidEventChain.reason === 'missing'
        ? `references missing scenario event ${invalidEventChain.sourceId}`
        : invalidEventChain.reason === 'cycle' ? 'creates a scenario event cycle'
          : invalidEventChain.reason === 'duplicate' ? 'lists the same source event more than once'
          : 'uses the capturing team without a capture-triggered event in its chain';
      throw new Error(`Scenario event ${invalidEventChain.eventId} ${detail}.`);
    }
    if (!Number.isInteger(definition.terrainSeed)) definition.terrainSeed = 1;
    return definition;
  };
}
