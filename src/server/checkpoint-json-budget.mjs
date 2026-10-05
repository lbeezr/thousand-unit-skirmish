import { XL_CHECKPOINT_ROUTE_LEGACY_SIDE, XL_CHECKPOINT_ROUTE_MAX_SIDE } from './checkpoint-route-budget.mjs';

// Whole JSON/state quotas, separate from the aggregate route-index quota.
export const XL_CHECKPOINT_JSON_LIMITS = Object.freeze({ bytes: 32 * 1024 * 1024,
  values: 4 * 1024 * 1024, containers: 256 * 1024, depth: 16,
  arrayEntries: 320 * 320, objectMembers: 128, stringUnits: 256 * 1024, numberUnits: 64 });

export function isXlCheckpointDefinition(definition) {
  return Number.isSafeInteger(definition?.width) && Number.isSafeInteger(definition?.height)
    && definition.width > 0 && definition.height > 0
    && definition.width <= XL_CHECKPOINT_ROUTE_MAX_SIDE && definition.height <= XL_CHECKPOINT_ROUTE_MAX_SIDE
    && (definition.width > XL_CHECKPOINT_ROUTE_LEGACY_SIDE || definition.height > XL_CHECKPOINT_ROUTE_LEGACY_SIDE);
}

export function rejectCheckpointBudget(reason) {
  const error = new Error(`Invalid match checkpoint: XL JSON budget ${reason}`);
  error.code = 'CHECKPOINT_REJECTED';
  throw error;
}

// Compact JSON UTF-8 byte accounting without allocating an escaped string.
function stringBytes(value) {
  let bytes = 2;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c === 34 || c === 92 || c === 8 || c === 9 || c === 10 || c === 12 || c === 13) bytes += 2;
    else if (c < 32) bytes += 6;
    else if (c < 128) bytes++;
    else if (c < 2048) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && value.charCodeAt(i + 1) >= 0xdc00 && value.charCodeAt(i + 1) <= 0xdfff) { bytes += 4; i++; }
    else if (c >= 0xd800 && c <= 0xdfff) bytes += 6;
    else bytes += 3;
  }
  return bytes;
}

// JSON-compatible, cycle-free state only. This is a volume guard, not a
// replacement for the complete authoritative semantic checkpoint validator.
export function inspectCheckpointJson(value) {
  const limits = XL_CHECKPOINT_JSON_LIMITS, ancestors = [];
  const report = { bytes: 0, values: 0, containers: 0, maxDepth: 0 };
  function add(bytes) {
    report.bytes += bytes;
    if (report.bytes > limits.bytes) rejectCheckpointBudget('exceeds compact byte quota');
  }
  function visit(item, depth) {
    if (++report.values > limits.values) rejectCheckpointBudget('exceeds value quota');
    if (item === null || item === undefined) { add(4); return; }
    if (typeof item === 'string') {
      if (item.length > limits.stringUnits) rejectCheckpointBudget('exceeds string quota');
      add(stringBytes(item)); return;
    }
    if (typeof item === 'boolean') { add(item ? 4 : 5); return; }
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) rejectCheckpointBudget('nonfinite number');
      add(String(item).length); return;
    }
    if (typeof item !== 'object' || typeof item.toJSON === 'function') rejectCheckpointBudget('unsupported JSON value');
    if (++report.containers > limits.containers) rejectCheckpointBudget('exceeds container quota');
    if (depth > limits.depth) rejectCheckpointBudget('exceeds depth quota');
    report.maxDepth = Math.max(report.maxDepth, depth);
    if (ancestors.includes(item)) rejectCheckpointBudget('cyclic state');
    ancestors.push(item); add(2);
    let members = 0;
    if (Array.isArray(item)) {
      if (item.length > limits.arrayEntries) rejectCheckpointBudget('exceeds array quota');
      const length = item.length;
      for (let i = 0; i < length; i++) {
        if (!Object.hasOwn(item, i)) rejectCheckpointBudget('sparse array');
        if (i) add(1); visit(item[i], depth + 1);
      }
    } else {
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null) rejectCheckpointBudget('unsupported object');
      for (const key in item) {
        if (!Object.hasOwn(item, key) || item[key] === undefined) continue;
        if (++members > limits.objectMembers) rejectCheckpointBudget('exceeds member quota');
        if (key.length > limits.objectMembers) rejectCheckpointBudget('exceeds key quota');
        if (members > 1) add(1); add(stringBytes(key) + 1);
        visit(item[key], depth + 1);
      }
    }
    ancestors.pop();
  }
  visit(value, 1);
  return report;
}

export function preflightXlCheckpointState(snapshot, recordLimits) {
  if (!isXlCheckpointDefinition(snapshot?.mapDefinition)) return null;
  const state = snapshot.state;
  for (const [key, max] of [['units', recordLimits.maxUnits], ['buildings', recordLimits.maxBuildings],
    ['resourceNodes', recordLimits.maxResourceNodes],
    ['forestStocks', snapshot.mapDefinition.width * snapshot.mapDefinition.height]]) {
    if (!Array.isArray(state?.[key]) || state[key].length > max) rejectCheckpointBudget(`invalid ${key} table`);
  }
  return inspectCheckpointJson(snapshot);
}

// No full DTO or route payload is copied to inspect the live clone-bearing
// fields. Array.from owns at most the already bounded128 resource references.
export function preflightXlCheckpointCloneInputs(definition, state, recordLimits) {
  if (!isXlCheckpointDefinition(definition)) return null;
  const { units, buildings, resourceNodes, bannerfall } = state;
  if (!Array.isArray(units) || units.length > recordLimits.maxUnits
    || !Array.isArray(buildings) || buildings.length > recordLimits.maxBuildings
    || !(resourceNodes instanceof Map) || resourceNodes.size > recordLimits.maxResourceNodes)
    rejectCheckpointBudget('invalid clone input tables');
  return inspectCheckpointJson({ mapDefinition: definition, units, buildings, resourceNodes: Array.from(resourceNodes.values()),
    ...(bannerfall ? { bannerfall } : {}) });
}
