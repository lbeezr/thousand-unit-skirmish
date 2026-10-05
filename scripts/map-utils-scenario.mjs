import assert from 'node:assert/strict';
import {
  buildElevationGrid, capturePrerequisiteIds, findInvalidCapturePrerequisite,
  findUnreachableCaptureZone, findUnreachableResourceNode, validateElevationPatches,
} from '../src/map-utils.mjs';
import * as legacyMapUtils from '../src/map-utils.mjs';
import { scenarioEventSourceIds, findInvalidScenarioEventChain } from '../src/world/scenario-event-chain.mjs';
import * as eventChain from '../src/world/scenario-event-chain.mjs';
import {
  canTraverseElevation, elevationPathCost, hasElevation,
} from '../src/elevation.mjs';

const width = 8;
const height = 8;
const spawnPoints = [
  { team: 0, x: -3.5, z: -3.5 },
  { team: 1, x: 3.5, z: 3.5 },
];
const zone = { column: 1, row: 3, width: 1, height: 1 };
const triggers = [{ id: 'west-objective', zone }];

const dividedMap = new Uint8Array(width * height);
for (let row = 0; row < height; row++) dividedMap[row * width + 3] = 1;
assert.deepEqual(
  findUnreachableCaptureZone(width, height, dividedMap, spawnPoints, triggers),
  { triggerId: 'west-objective', team: 1 },
  'a full-height wall should identify the team isolated from a capture zone',
);
assert.deepEqual(
  findUnreachableResourceNode(width, height, dividedMap, spawnPoints, [{ id: 'west-berries', x: -2.5, z: -0.5 }]),
  { nodeId: 'west-berries', team: 1 },
  'resource reachability should keep using the shared walkable components',
);

const passMap = new Uint8Array(width * height);
for (let row = 0; row < height; row++) {
  if (row !== 3) passMap[row * width + 3] = 1;
}
assert.equal(
  findUnreachableCaptureZone(width, height, passMap, spawnPoints, triggers),
  null,
  'a one-cell pass should connect both teams to the capture zone',
);
assert.equal(
  findUnreachableResourceNode(width, height, passMap, spawnPoints, [{ id: 'west-berries', x: -2.5, z: -0.5 }]),
  null,
  'the pass should preserve access to resources on either side',
);

assert.equal(validateElevationPatches(width, height, undefined), null,
  'older maps without authored elevation should stay flat');
assert.equal(validateElevationPatches(width, height, []), null,
  'an empty elevation patch list should describe flat ground');
assert.equal(validateElevationPatches(width, height, [
  { column: 2, row: 2, width: 2, height: 1, level: 1 },
  { column: 4, row: 2, width: 1, height: 1, level: 2 },
]), null, 'in-bounds non-overlapping rectangles at levels 0–2 should be accepted');
const elevationGrid = buildElevationGrid(width, height, [
  { column: 2, row: 2, width: 2, height: 1, level: 1 },
  { column: 4, row: 2, width: 1, height: 1, level: 2 },
]);
assert.deepEqual([...elevationGrid.slice(2 * width, 2 * width + 6)], [0, 0, 1, 1, 2, 0],
  'rectangle patches should expand to a flat-by-default cell grid');
assert.ok([...buildElevationGrid(width, height, undefined)].every(level => level === 0),
  'missing elevation data should build an all-zero flat grid');
for (const [patches, reason, label] of [
  [[{ column: 0, row: 0, width: 1, height: 1, level: -1 }], 'level', 'negative level'],
  [[{ column: 0, row: 0, width: 1, height: 1, level: 3 }], 'level', 'level above two'],
  [[{ column: 0, row: 0, width: 1, height: 1, level: 1.5 }], 'level', 'fractional level'],
  [[{ column: 7, row: 0, width: 2, height: 1, level: 1 }], 'bounds', 'patch outside map'],
  [[
    { column: 1, row: 1, width: 2, height: 1, level: 1 },
    { column: 2, row: 1, width: 2, height: 1, level: 2 },
  ], 'overlap', 'overlapping patches'],
  [null, 'shape', 'null patch list'],
  [Array.from({ length: 4097 }, () => ({ column: 0, row: 0, width: 1, height: 1, level: 1 })),
    'limit', 'patch limit'],
]) {
  assert.equal(validateElevationPatches(width, height, patches)?.reason, reason,
    `${label} should be rejected`);
}

const slopeLevels = buildElevationGrid(width, height, [
  { column: 3, row: 0, width: 1, height, level: 1 },
]);
assert.equal(hasElevation(slopeLevels), true, 'authored elevation should build a non-flat cell grid');
assert.equal(canTraverseElevation(slopeLevels, 2 * width + 3, 2 * width + 4), true,
  'one-level changes should remain traversable');
assert.equal(elevationPathCost(slopeLevels, 2 * width + 2, 2 * width + 3), 115,
  'moving uphill should add the prototype path weight');
assert.equal(elevationPathCost(slopeLevels, 2 * width + 3, 2 * width + 2), 100,
  'moving downhill should use the base path weight');
assert.equal(findUnreachableCaptureZone(width, height, passMap, spawnPoints, triggers, slopeLevels), null,
  'a one-level ridge should preserve objective reachability from both spawns');

const cliffLevels = buildElevationGrid(width, height, [
  { column: 3, row: 0, width: 1, height, level: 2 },
]);
assert.equal(canTraverseElevation(cliffLevels, 2 * width + 2, 2 * width + 3), false,
  'a two-level edge should be a cliff');
assert.deepEqual(
  findUnreachableResourceNode(width, height, passMap, spawnPoints,
    [{ id: 'west-berries', x: -2.5, z: -0.5 }], cliffLevels),
  { nodeId: 'west-berries', team: 1 },
  'resource reachability should account for a cliff that splits walkable terrain',
);
assert.deepEqual(
  findUnreachableCaptureZone(width, height, passMap, spawnPoints, triggers, cliffLevels),
  { triggerId: 'west-objective', team: 1 },
  'objective reachability should account for a cliff that splits walkable terrain',
);
assert.throws(() => buildElevationGrid(width, height, [
  { column: 1, row: 1, width: 2, height: 1, level: 1 },
  { column: 2, row: 1, width: 1, height: 1, level: 2 },
]), /Invalid elevation patches: overlap/, 'overlapping elevation patches should be rejected');

const gateGraph = [
  { id: 'north-gate' },
  { id: 'south-gate' },
  { id: 'central-gate', requiresAll: ['north-gate', 'south-gate'] },
  { id: 'final-gate', requires: 'central-gate' },
];
assert.equal(findInvalidCapturePrerequisite(gateGraph), null,
  'a branching multi-prerequisite chain should be valid');
assert.deepEqual(capturePrerequisiteIds(gateGraph[2]), ['north-gate', 'south-gate'],
  'the shared prerequisite reader should preserve AND-gate order');
assert.deepEqual(capturePrerequisiteIds(gateGraph[3]), ['central-gate'],
  'a legacy single prerequisite should normalize to one ID');
assert.deepEqual(capturePrerequisiteIds(gateGraph[0]), [],
  'an ungated zone should normalize to no prerequisite IDs');

for (const [triggers, reason, label] of [
  [[{ id: 'gate', requiresAll: ['north', 'missing'] }, { id: 'north' }], 'missing', 'missing multi-gate link'],
  [[{ id: 'gate', requiresAll: ['north', 'gate'] }, { id: 'north' }], 'self', 'self multi-gate link'],
  [[{ id: 'gate', requiresAll: ['north', 'north'] }, { id: 'north' }], 'duplicate', 'duplicate gate link'],
  [[{ id: 'north', requires: 'gate' }, { id: 'gate', requiresAll: ['north', 'south'] }, { id: 'south' }], 'cycle', 'cycle crossing a multi-gate link'],
  [[{ id: 'gate', requires: 'north', requiresAll: ['north', 'south'] }, { id: 'north' }, { id: 'south' }], 'both', 'mixed legacy and multi-gate fields'],
  [[{ id: 'gate', requiresAll: ['north'] }, { id: 'north' }], 'shape', 'one-item multi-gate list'],
]) {
  assert.equal(findInvalidCapturePrerequisite(triggers)?.reason, reason, `${label} should be rejected`);
}

const joinedEvents = [
  { id: 'capture-root', trigger: { type: 'capture', objectiveId: 'west-objective' } },
  { id: 'branch-west', trigger: { type: 'event', eventId: 'capture-root' } },
  { id: 'branch-east', trigger: { type: 'event', eventId: 'capture-root' } },
  { id: 'join', trigger: { type: 'event', eventIds: ['branch-west', 'branch-east'] }, team: 'capturing' },
];
assert.equal(findInvalidScenarioEventChain(joinedEvents), null,
  'parallel branches from one capture-root event may join and keep capturing-team provenance');
assert.deepEqual(scenarioEventSourceIds(joinedEvents[3].trigger), ['branch-west', 'branch-east'],
  'the shared event-source reader should preserve all join dependencies');
for (const [events, reason, label] of [
  [[{ id: 'join', trigger: { type: 'event', eventIds: ['known', 'missing'] } }, { id: 'known' }], 'missing', 'missing joined source'],
  [[{ id: 'join', trigger: { type: 'event', eventIds: ['known', 'known'] } }, { id: 'known' }], 'duplicate', 'duplicate joined source'],
  [[
    { id: 'join', trigger: { type: 'event', eventIds: ['branch', 'clock'] } },
    { id: 'branch', trigger: { type: 'event', eventId: 'join' } }, { id: 'clock' },
  ], 'cycle', 'cycle crossing an all-of join'],
  [[
    { id: 'root-a', trigger: { type: 'capture', objectiveId: 'west-objective' } },
    { id: 'root-b', trigger: { type: 'capture', objectiveId: 'east-objective' } },
    { id: 'join', trigger: { type: 'event', eventIds: ['root-a', 'root-b'] }, team: 'capturing' },
  ], 'capturing-team-without-capture-root', 'ambiguous capturing-team join'],
]) {
  assert.equal(findInvalidScenarioEventChain(events)?.reason, reason, `${label} should be rejected`);
}

assert.deepEqual(Object.keys(legacyMapUtils), [
  'MAX_ELEVATION_PATCHES', 'buildElevationGrid', 'capturePrerequisiteIds',
  'findInvalidCapturePrerequisite', 'findInvalidScenarioEventChain', 'findUnreachableCaptureZone',
  'findUnreachableFoodNode', 'findUnreachableResourceNode', 'scenarioEventSourceIds', 'validateElevationPatches',
]);
assert.deepEqual(Object.keys(eventChain), ['findInvalidScenarioEventChain', 'scenarioEventSourceIds']);
for (const name of Object.keys(eventChain)) assert.equal(legacyMapUtils[name], eventChain[name], name);
assert.equal(legacyMapUtils.findUnreachableFoodNode, legacyMapUtils.findUnreachableResourceNode);
assert.equal(scenarioEventSourceIds(joinedEvents[3].trigger), joinedEvents[3].trigger.eventIds,
  'ordered all-of dependencies retain their original array identity');
assert.deepEqual(scenarioEventSourceIds(null), []);
assert.deepEqual(scenarioEventSourceIds({ type: 'capture', eventIds: ['ignored'] }), []);
assert.deepEqual(scenarioEventSourceIds({ type: 'event', eventId: 'legacy' }), ['legacy']);

const sourceEvents = Array.from({ length: 32 }, (_, index) => ({ id: `clock-${index}`, trigger: { type: 'time' } }));
assert.equal(findInvalidScenarioEventChain([...sourceEvents,
  { id: 'join', trigger: { type: 'event', eventIds: sourceEvents.slice(0, 31).map(event => event.id) } }]), null,
  '31 ordered sources are accepted at the existing format limit');
for (const trigger of [
  { type: 'event', eventId: undefined, eventIds: ['clock-0', 'clock-1'] },
  { type: 'event', eventIds: [] }, { type: 'event', eventIds: ['clock-0'] },
  { type: 'event', eventIds: sourceEvents.map(event => event.id) },
  { type: 'event', eventIds: 'clock-0' }, { type: 'event' },
]) {
  assert.deepEqual(findInvalidScenarioEventChain([...sourceEvents, { id: 'join', trigger }]),
    { eventId: 'join', reason: 'shape' }, 'mixed own fields and invalid source counts keep their exact shape rejection');
}
assert.deepEqual(findInvalidScenarioEventChain([
  { id: 'first', trigger: { type: 'event', eventIds: ['missing', 'missing'] } },
  { id: 'second', trigger: { type: 'event' } },
]), { eventId: 'first', reason: 'duplicate' }, 'input order and duplicate-before-missing rejection remain stable');
assert.deepEqual(findInvalidScenarioEventChain([
  { id: 'join', trigger: { type: 'event', eventIds: [7, 'missing'] } },
]), { eventId: 'join', sourceId: 7, reason: 'missing' }, 'the first invalid source retains its original value');

const immutableEvents = structuredClone(joinedEvents);
for (const event of immutableEvents) {
  if (event.trigger.eventIds) Object.freeze(event.trigger.eventIds);
  Object.freeze(event.trigger); Object.freeze(event);
}
Object.freeze(immutableEvents);
assert.equal(findInvalidScenarioEventChain(immutableEvents), null, 'validation accepts immutable authored input');
assert.deepEqual(immutableEvents, joinedEvents, 'validation does not rewrite event dependencies or provenance');

console.log('Map connectivity, elevation patches, capture prerequisites, and scenario-event dependency utilities passed.');
