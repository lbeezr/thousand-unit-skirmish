export function scenarioEventSourceIds(trigger) {
  if (trigger?.type !== 'event') return [];
  if (Array.isArray(trigger.eventIds)) return trigger.eventIds;
  return typeof trigger.eventId === 'string' ? [trigger.eventId] : [];
}

export function findInvalidScenarioEventChain(events) {
  const byId = new Map(events.map((event) => [event?.id, event]));
  const dependencies = new Map();
  for (const event of events) {
    if (event?.trigger?.type !== 'event') continue;
    const sourceIds = scenarioEventSourceIds(event.trigger);
    if (Object.hasOwn(event.trigger, 'eventId') && Object.hasOwn(event.trigger, 'eventIds')) {
      return { eventId: event.id, reason: 'shape' };
    }
    if (Object.hasOwn(event.trigger, 'eventIds')
      && (!Array.isArray(event.trigger.eventIds) || sourceIds.length < 2 || sourceIds.length > 31)) {
      return { eventId: event.id, reason: 'shape' };
    }
    if (!Object.hasOwn(event.trigger, 'eventIds') && sourceIds.length !== 1) {
      return { eventId: event.id, reason: 'shape' };
    }
    if (new Set(sourceIds).size !== sourceIds.length) {
      return { eventId: event.id, reason: 'duplicate' };
    }
    for (const sourceId of sourceIds) {
      if (typeof sourceId !== 'string' || !byId.has(sourceId)) {
        return { eventId: event.id, sourceId, reason: 'missing' };
      }
    }
    dependencies.set(event.id, sourceIds);
  }

  const visiting = new Set();
  const visited = new Set();
  function hasCycle(id) {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const sourceId of dependencies.get(id) || []) {
      if (hasCycle(sourceId)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }
  for (const event of events) {
    if (hasCycle(event.id)) return { eventId: event.id, reason: 'cycle' };
  }

  const captureRootCache = new Map();
  function captureRootEventId(id) {
    if (captureRootCache.has(id)) return captureRootCache.get(id);
    const event = byId.get(id);
    let captureRootId = event?.trigger?.type === 'capture' ? event.id : null;
    if (event?.trigger?.type === 'event') {
      const roots = (dependencies.get(id) || []).map(captureRootEventId);
      if (roots.length > 0 && roots[0] && roots.every((rootId) => rootId === roots[0])) {
        captureRootId = roots[0];
      }
    }
    captureRootCache.set(id, captureRootId);
    return captureRootId;
  }
  for (const event of events) {
    if (event?.team === 'capturing' && !captureRootEventId(event.id)) {
      return { eventId: event.id, reason: 'capturing-team-without-capture-root' };
    }
  }
  return null;
}
