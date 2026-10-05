export function capturePrerequisiteIds(trigger) {
  if (Array.isArray(trigger?.requiresAll)) return trigger.requiresAll;
  return trigger?.requires === undefined ? [] : [trigger.requires];
}

export function findInvalidCapturePrerequisite(triggers) {
  const byId = new Map(triggers.map((trigger) => [trigger?.id, trigger]));
  const dependencies = new Map();
  for (const trigger of triggers) {
    if (trigger?.requires !== undefined && trigger?.requiresAll !== undefined) {
      return { triggerId: trigger.id, reason: 'both' };
    }
    if (trigger?.requiresAll !== undefined
      && (!Array.isArray(trigger.requiresAll) || trigger.requiresAll.length < 2 || trigger.requiresAll.length > 31)) {
      return { triggerId: trigger.id, reason: 'shape' };
    }
    const prerequisiteIds = capturePrerequisiteIds(trigger);
    if (new Set(prerequisiteIds).size !== prerequisiteIds.length) {
      return { triggerId: trigger.id, reason: 'duplicate' };
    }
    dependencies.set(trigger.id, prerequisiteIds);
    for (const prerequisiteId of prerequisiteIds) {
      if (prerequisiteId === trigger.id) return { triggerId: trigger.id, reason: 'self' };
      if (typeof prerequisiteId !== 'string' || !byId.has(prerequisiteId)) {
        return { triggerId: trigger.id, requires: prerequisiteId, reason: 'missing' };
      }
    }
  }

  const visiting = new Set();
  const visited = new Set();
  function hasCycle(id) {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const prerequisiteId of dependencies.get(id) || []) {
      if (hasCycle(prerequisiteId)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }

  for (const trigger of triggers) {
    if (hasCycle(trigger.id)) return { triggerId: trigger.id, reason: 'cycle' };
  }
  return null;
}
