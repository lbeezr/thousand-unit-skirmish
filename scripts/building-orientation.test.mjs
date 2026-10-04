import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { ROTATABLE_BUILDINGS, buildingCanRotate, validBuildingOrientation, turnBuildingOrientation,
  orderedBuildingExitCells, buildingEntranceDirection } from '../src/building-orientation.mjs';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';

const map = { id: 'orientation-guard', name: 'Orientation guard', width: 64, height: 64,
  terrainSeed: 19, fogOfWar: false, startingArmySize: 24, startingResources: { food: 1000, wood: 1000 },
  spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
  obstacles: [{ column: 30, row: 42, width: 3, height: 3, material: 'stone' }],
  resourceNodes: [], triggers: [], scenarioEvents: [] };

test('only approved square families admit four integer facings; unsupported geometry stays fixed', () => {
  for (const type of ROTATABLE_BUILDINGS) {
    assert.equal(buildingCanRotate(type, BUILDING_DEFINITIONS), true);
    for (let orientation = 0; orientation < 4; orientation++) assert.equal(validBuildingOrientation(type, orientation, BUILDING_DEFINITIONS), true);
    for (const bad of [null, -1, 4, 1.5, '1', NaN, Infinity, {}, []]) assert.equal(validBuildingOrientation(type, bad, BUILDING_DEFINITIONS), false);
    assert.equal(validBuildingOrientation(type, undefined, BUILDING_DEFINITIONS), true);
  }
  for (const type of ['farm', 'mill', 'dock', 'palisade-wall', 'palisade-gate']) {
    assert.equal(buildingCanRotate(type, BUILDING_DEFINITIONS), false);
    assert.equal(validBuildingOrientation(type, 1, BUILDING_DEFINITIONS), false);
  }
  for (const footprint of [[3, 5], { width: 3, depth: 5 }, [[0, 0], [1, 0]], 2])
    assert.equal(buildingCanRotate('house', { house: { footprint } }), false);
  assert.equal(turnBuildingOrientation(0, -1), 3);
  assert.equal(turnBuildingOrientation(3, 1), 0);
});

test('rotated threshold ranks legal exits with stable cell tie breaks', () => {
  const width = 20, footprint = [];
  for (let row = 9; row <= 11; row++) for (let column = 9; column <= 11; column++) footprint.push(row * width + column);
  const cells = [];
  for (let row = 8; row <= 12; row++) for (let column = 8; column <= 12; column++)
    if (row === 8 || row === 12 || column === 8 || column === 12) cells.push(row * width + column);
  for (let orientation = 0; orientation < 4; orientation++) {
    const building = { x: 0.5, z: 0.5, footprint, orientation };
    const ordered = orderedBuildingExitCells(building, cells, width, width);
    const [dx, dz] = buildingEntranceDirection(orientation);
    assert.equal(ordered[0], (10 + dz * 2) * width + 10 + dx * 2);
    assert.deepEqual(orderedBuildingExitCells(building, [...cells].reverse(), width, width), ordered);
    assert.deepEqual(new Set(ordered), new Set(cells));
    const blockedFront = ordered.filter(cell => cell !== ordered[0]);
    assert.ok(orderedBuildingExitCells(building, blockedFront, width, width).every(cell => blockedFront.includes(cell)));
  }
});

test('real authority rejects malformed facing/collisions without cost or occupancy changes and validates saved facing', async () => {
  const fixture = await createPathingReplayFixture(map), { replay } = fixture;
  try {
    const ids = replay.units.filter(u => u.team === 0 && u.kind === 'worker').map(u => u.id);
    const command = { type: 'build', ids, buildingType: 'house', x: -10.5, z: 10.5 };
    const before = replay.checkpoint();
    for (const orientation of [null, -1, 4, 1.5, '1', false]) {
      assert.match(replay.order(0, { ...command, orientation }).at(-1).message, /INVALID BUILDING ORIENTATION/);
      assert.deepEqual(replay.wood, before.state.teamWood);
      assert.equal(replay.buildings.length, 0);
      assert.equal(replay.navigationRevision, 0);
    }
    assert.match(replay.order(0, { ...command, x: -0.5, orientation: 3 }).at(-1).message, /SPACE BLOCKED/);
    assert.deepEqual(replay.wood, before.state.teamWood);
    assert.match(replay.order(0, { ...command, orientation: 3 }).at(-1).message, /PLACED/);
    assert.equal(replay.buildings[0].orientation, 3);
    assert.equal(replay.buildings[0].footprint.length, 9);
    assert.equal(replay.wood[0], before.state.teamWood[0] - BUILDING_DEFINITIONS.house.cost.wood);
    replay.drain();
    const saved = replay.checkpoint();
    replay.validate(saved);
    replay.restore(structuredClone(saved));
    assert.equal(replay.snapshot(0).buildings[0].orientation, 3);
    for (const bad of [null, '3', 4, -1, 0.5]) {
      const corrupt = structuredClone(saved); corrupt.state.buildings[0].orientation = bad;
      assert.throws(() => replay.validate(corrupt), /invalid building record/);
    }
    const legacy = structuredClone(saved); delete legacy.state.buildings[0].orientation;
    replay.restore(legacy);
    assert.equal(replay.snapshot(0).buildings[0].orientation, 0);
    assert.match(replay.order(0, { ...command, orientation: 2 }).at(-1).message, /SPACE BLOCKED/);
    assert.equal(replay.buildings.length, 1);
  } finally { await fixture.dispose(); }
});

test('a remote ramp cannot turn an oriented producer threshold into a cliff drop', async () => {
  const raised = { ...map, id: 'orientation-ledge', obstacles: [], elevationPatches: [
    { column: 0, row: 0, width: 32, height: 64, level: 2 },
    { column: 32, row: 48, width: 1, height: 3, level: 1 },
  ] };
  const fixture = await createPathingReplayFixture(raised), { replay } = fixture;
  try {
    const ids = replay.units.filter(u => u.team === 0 && u.kind === 'worker').map(u => u.id);
    assert.match(replay.order(0, { type: 'build', ids, buildingType: 'barracks', orientation: 1, x: -1.5, z: -10.5 }).at(-1).message, /PLACED/);
    replay.drain();
    const building = replay.buildings[0]; building.complete = true; building.progress = 1;
    const before = replay.units.length;
    assert.match(replay.order(0, { type: 'trainUnit', kind: 'infantry', buildingId: building.id }).at(-1).message, /QUEUED/);
    building.trainingRemaining = 0.01;
    replay.step();
    const born = replay.units[before]; assert.ok(born);
    assert.equal(replay.levels[replay.cell(born.x, born.z)], 2, 'never spawn below the cliff merely because a far ramp joins components');
    assert.ok(born.x < 0);
  } finally { await fixture.dispose(); }
});

test('producer with no locally legal threshold rejects training without debiting either bank', async () => {
  const isolated = { ...map, id: 'orientation-no-exit', obstacles: [], elevationPatches: [
    { column: 20, row: 41, width: 3, height: 3, level: 2 },
  ] };
  const fixture = await createPathingReplayFixture(isolated), { replay } = fixture;
  try {
    const ids = replay.units.filter(u => u.team === 0 && u.kind === 'worker').map(u => u.id);
    assert.match(replay.order(0, { type: 'build', ids, buildingType: 'barracks', orientation: 0, x: -10.5, z: 10.5 }).at(-1).message, /PLACED/);
    replay.drain(); const building = replay.buildings[0]; building.complete = true; building.progress = 1;
    const balance = [replay.food[0], replay.wood[0]];
    assert.match(replay.order(0, { type: 'trainUnit', kind: 'infantry', buildingId: building.id }).at(-1).message, /NO SPAWN ROOM/);
    assert.deepEqual([replay.food[0], replay.wood[0]], balance); assert.equal(building.queue, 0);
  } finally { await fixture.dispose(); }
});
