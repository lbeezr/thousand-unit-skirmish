import { validCompletionTrigger } from '../scenario-regions.mjs';
import { scenarioEventSourceIds } from '../world/scenario-event-chain.mjs';

function assertSnapshot(condition, message) {
  if (!condition) throw new Error(`Invalid match checkpoint: ${message}`);
}

// Saved scenario state only. The host retains the ordered envelope, other
// state domains, result/clock checks, activation and restore policy.
export function validateCheckpointScenarioState(definition, state, { maxUnits: MAX_UNITS }) {
  const finite = (value) => Number.isFinite(value);
  const integerIn = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  assertSnapshot(Array.isArray(state.triggerStates) && state.triggerStates.length === definition.triggers.length,
    'invalid trigger states');
  const triggerIds = new Set();
  for (const trigger of state.triggerStates) {
    const triggerDefinition = definition.triggers.find((item) => item.id === trigger?.id);
    assertSnapshot(triggerDefinition && !triggerIds.has(trigger.id)
      && integerIn(trigger.owner, -1, 1) && integerIn(trigger.progressTeam, -1, 1)
      && finite(trigger.progress) && trigger.progress >= 0 && trigger.progress <= triggerDefinition.captureSeconds
      && Array.isArray(trigger.unitCounts) && trigger.unitCounts.length === 2
      && trigger.unitCounts.every((count) => integerIn(count, 0, MAX_UNITS)), 'invalid trigger state');
    triggerIds.add(trigger.id);
  }
  assertSnapshot(Array.isArray(state.scenarioEventStates)
    && state.scenarioEventStates.length === definition.scenarioEvents.length, 'invalid scenario event states');
  const eventIds = new Set();
  for (const event of state.scenarioEventStates) {
    const eventDefinition = definition.scenarioEvents.find((item) => item.id === event?.id);
    assertSnapshot(eventDefinition && !eventIds.has(event.id)
      && typeof event.fired === 'boolean', 'invalid scenario event state');
    if (eventDefinition.repeatCount !== undefined) {
      const awaitingActivation = ['capture', 'event', 'region-entry', 'construction-complete', 'research-complete'].includes(eventDefinition.trigger?.type)
        && event.activatedAtSeconds === null;
      assertSnapshot(Number.isInteger(event.fireCount)
        && event.fireCount >= 0 && event.fireCount <= eventDefinition.repeatCount + 1
        && event.fired === (event.fireCount >= eventDefinition.repeatCount + 1)
        && (event.nextFireAtSeconds === null
          || (finite(event.nextFireAtSeconds) && event.nextFireAtSeconds >= 0))
        && (event.fired || awaitingActivation
          ? event.nextFireAtSeconds === null : event.nextFireAtSeconds !== null),
      'invalid repeating scenario event state');
    } else {
      assertSnapshot(event.fireCount === undefined && event.nextFireAtSeconds === undefined,
        'unexpected repeating scenario event state');
    }
    if (['capture', 'event', 'region-entry', 'construction-complete', 'research-complete'].includes(eventDefinition.trigger?.type)) {
      assertSnapshot((event.activatedAtSeconds === null
        || (finite(event.activatedAtSeconds) && event.activatedAtSeconds >= 0
          && event.activatedAtSeconds <= state.matchElapsedSeconds))
        && integerIn(event.triggeredByTeam, -1, 1)
        && (event.activatedAtSeconds === null
          ? event.triggeredByTeam === -1
          : ['capture', 'region-entry', 'construction-complete', 'research-complete'].includes(eventDefinition.trigger.type)
            ? event.triggeredByTeam >= 0 : integerIn(event.triggeredByTeam, -1, 1))
        && (!event.fired || event.activatedAtSeconds !== null), 'invalid triggered scenario event state');
      if ((eventDefinition.trigger.type === 'region-entry' || validCompletionTrigger(eventDefinition.trigger)) && event.activatedAtSeconds !== null) {
        assertSnapshot(eventDefinition.trigger.team === 'either'
          || event.triggeredByTeam === Number(eventDefinition.trigger.team),
        'invalid region event entering team');
      }
      if (eventDefinition.trigger.type === 'event') {
        const sourceIds = scenarioEventSourceIds(eventDefinition.trigger);
        const sourceStates = sourceIds.map((sourceId) => (
          state.scenarioEventStates.find((item) => item.id === sourceId)
        ));
        const joined = sourceIds.length > 1;
        const commonSourceTeam = sourceStates[0]?.triggeredByTeam ?? -1;
        const inheritedTeam = sourceStates.every((sourceState) => (
          (sourceState?.triggeredByTeam ?? -1) === commonSourceTeam
        )) ? commonSourceTeam : -1;
        assertSnapshot(sourceStates.length === sourceIds.length
          && (event.activatedAtSeconds === null
            ? (joined || !sourceStates[0]?.fired) && !event.fired && event.triggeredByTeam === -1
            : sourceStates.every((sourceState) => sourceState?.fired)
              && event.triggeredByTeam === inheritedTeam),
        'invalid chained scenario event state');
      }
      if (eventDefinition.repeatCount !== undefined) {
        assertSnapshot((event.activatedAtSeconds === null
          ? event.fireCount === 0 && event.nextFireAtSeconds === null
          : event.nextFireAtSeconds === null || event.nextFireAtSeconds >= event.activatedAtSeconds),
        'invalid repeating triggered scenario event schedule');
      }
    }
    eventIds.add(event.id);
  }
  const savedVictoryHold = state.victoryHoldState ?? { activeTeams: [false, false], progressSeconds: [0, 0] };
  const holdDuration = definition.victoryHoldSeconds ?? 0;
  assertSnapshot(holdDuration === 0 || state.victoryHoldState !== undefined,
    'missing victory hold state');
  assertSnapshot(Array.isArray(savedVictoryHold.activeTeams) && savedVictoryHold.activeTeams.length === 2
    && savedVictoryHold.activeTeams.every((active) => typeof active === 'boolean')
    && Array.isArray(savedVictoryHold.progressSeconds) && savedVictoryHold.progressSeconds.length === 2
    && savedVictoryHold.progressSeconds.every((seconds, team) => finite(seconds)
      && seconds >= 0 && seconds <= holdDuration
      && (savedVictoryHold.activeTeams[team] || seconds === 0))
    && (savedVictoryHold.triggerIds === undefined
      || (Array.isArray(savedVictoryHold.triggerIds) && savedVictoryHold.triggerIds.length === 2
        && savedVictoryHold.triggerIds.every((id, team) => id === null
          || (savedVictoryHold.activeTeams[team]
            && definition.triggers.some((trigger) => trigger.id === id && trigger.victory === true))))),
  'invalid victory hold state');
}
