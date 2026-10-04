import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createSkiffFishingContext } from '../src/skiff-fishing.mjs';
import { createWaterUnitRuntime } from '../src/water-unit-runtime.mjs';
import { waterRaster } from '../src/water-contours.mjs';
import { GAMEPLAY_DEFINITIONS, UNIT_DEFINITIONS, validateGameplayDefinitions, gameplayRulesetRevision } from '../src/gameplay-definitions.mjs';
import { selectionContext } from '../src/selection-context.mjs';

function fixture(stock = 12.1) {
  const map = { width: 64, height: 64, spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
    obstacles: [18, 43].map(column => ({ column, row: 42, width: 6, height: 8, material: 'water' })),
    resourceNodes: [0, 1].map(team => ({ id: `fish-${team}`, type: 'food', resourceVariant: 'shore-fish',
      x: team ? 15.5 : -9.5, z: 9.5, stock })) };
  const water = createWaterUnitRuntime(map), fish = createSkiffFishingContext(map, water);
  const buildings = [0, 1].map(team => ({ id: team + 1, type: 'dock', team, hp: 1200, complete: true,
    x: team ? 12.5 : -12.5, z: 8.5 }));
  const units = buildings.map(building => ({ ...water.graph.pointAt(fish.dockCell(building)), id: building.team,
    team: building.team, kind: 'skiff', movementDomain: 'water', hp: 120,
    cargo: 0, cargoType: null, gatherNodeId: null, gatherForestCell: -1, gatherPhase: '', dropoffBuildingId: null,
    path: [], pathIndex: 0, moveGoalCell: -1, waterMoveBlocked: false, holdingPosition: false, repathTimer: 0, orderRevision: 0 }));
  const world = { units, nodes: new Map(map.resourceNodes.map(node => [node.id, structuredClone(node)])), buildings, teamFood: [1000, 1000] };
  const tick = (seconds = 1 / 30) => { water.advance(world.units, seconds, () => UNIT_DEFINITIONS.skiff.combat.moveSpeed); fish.update(world, seconds); };
  const start = team => { const unit = world.units[team], node = world.nodes.get(`fish-${team}`);
    const route = fish.fishRoute(unit, node, world.units); assert.ok(route); fish.start(unit, node.id, 'to-node', route); };
  const conserved = team => world.nodes.get(`fish-${team}`).stock + world.units[team].cargo + world.teamFood[team] - 1000;
  return { map, water, fish, world, tick, start, conserved };
}
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
function stop(unit) {
  unit.gatherNodeId = null; unit.gatherPhase = ''; unit.dropoffBuildingId = null;
  unit.path = []; unit.pathIndex = 0; unit.moveGoalCell = -1; unit.waterMoveBlocked = false;
}

test('fish banks remain dry land; boats derive a reachable approach beside the same water visual', () => {
  const f = fixture(), before = structuredClone(f.map), wet = waterRaster(f.map);
  for (const team of [0, 1]) {
    const node = f.world.nodes.get(`fish-${team}`), site = f.fish.siteAt(node.id), route = f.fish.fishRoute(f.world.units[team], node, f.world.units);
    assert.equal(wet[f.water.graph.cellAt(site.land.x, site.land.z)], 0);
    assert.equal(wet[f.water.graph.cellAt(site.water.x, site.water.z)], 1);
    assert.equal(f.water.graph.isNavigable(f.water.graph.cellAt(site.water.x, site.water.z)), false, 'shore margin remains outside hull clearance');
    const approach = f.water.graph.pointAt(route.cells.at(-1));
    assert.ok(Math.hypot(approach.x - site.water.x, approach.z - site.water.z) <= Math.SQRT2);
    assert.equal(f.fish.fishRoute(f.world.units[team], f.world.nodes.get(`fish-${1 - team}`), f.world.units), null);
  }
  assert.deepEqual(f.map, before);
});

test('both seats fill, drop food at owned Docks, resume, and exhaust finite stock without regrowth', () => {
  const f = fixture(); f.start(0); f.start(1); let full = false, resumed = false;
  for (let i = 0; i < 1600; i++) {
    f.tick();
    for (const team of [0, 1]) {
      const unit = f.world.units[team]; close(f.conserved(team), 12.1);
      assert.ok(f.water.validRoute(unit)); assert.ok(f.fish.validState(unit, f.world.nodes, f.world.buildings));
      full ||= unit.cargo === 10 && unit.gatherPhase === 'to-base';
      resumed ||= f.world.teamFood[team] === 1010 && unit.gatherPhase === 'to-node';
    }
  }
  assert.ok(full); assert.ok(resumed);
  for (const team of [0, 1]) {
    close(f.world.teamFood[team], 1012.1); assert.equal(f.world.nodes.get(`fish-${team}`).stock, 0);
    assert.equal(f.world.units[team].cargo, 0); assert.equal(f.world.units[team].gatherPhase, '');
  }
});

test('both shipped pilot pond corners have a safe fishing approach from the documented Dock sites', () => {
  const map = JSON.parse(readFileSync(new URL('../maps/shore-fishing.json', import.meta.url)));
  const before = structuredClone(map), water = createWaterUnitRuntime(map), fish = createSkiffFishingContext(map, water);
  for (const team of [0, 1]) {
    const dock = { id: team + 1, type: 'dock', team, hp: 1200, complete: true, x: team ? 4.5 : -4.5, z: 8.5 };
    const berth = fish.dockCell(dock); assert.ok(berth >= 0);
    const unit = { ...water.graph.pointAt(berth), team, hp: 120, movementDomain: 'water' };
    const node = map.resourceNodes.find(node => node.id === (team ? 'ember-food' : 'azure-food'));
    const route = fish.fishRoute(unit, node, [unit]); assert.ok(route);
    const approach = water.graph.pointAt(route.cells.at(-1)), visual = fish.siteAt(node.id).water;
    assert.equal(Math.hypot(approach.x - visual.x, approach.z - visual.z), Math.SQRT2);
    assert.ok(fish.deliveryRoute({ ...unit, ...approach }, [dock], []));
    for (let i = 1; i < route.cells.length; i++) {
      const a = water.graph.pointAt(route.cells[i - 1]), b = water.graph.pointAt(route.cells[i]);
      assert.equal(Math.abs(a.x - b.x) + Math.abs(a.z - b.z), 1, 'movement remains cardinal');
    }
  }
  assert.deepEqual(map, before);
});

test('Stop and checkpoint retain tiny fractional cargo; manual Return cargo delivers once without resuming', () => {
  const f = fixture(.1); f.start(0);
  for (let i = 0; i < 500 && f.world.units[0].cargo === 0; i++) f.tick(.005);
  const unit = f.world.units[0]; assert.ok(unit.cargo > 0 && unit.cargo < .01); stop(unit);
  const cargo = unit.cargo, stock = f.world.nodes.get('fish-0').stock;
  f.world.units[0] = structuredClone(unit);
  assert.ok(f.fish.validState(f.world.units[0], f.world.nodes, f.world.buildings));
  for (let i = 0; i < 100; i++) f.tick();
  assert.equal(f.world.units[0].cargo, cargo); assert.equal(f.world.nodes.get('fish-0').stock, stock);
  assert.equal(f.world.teamFood[0], 1000);
  const route = f.fish.deliveryRoute(f.world.units[0], f.world.buildings, f.world.units);
  f.fish.start(f.world.units[0], null, 'to-base', route);
  for (let i = 0; i < 150; i++) f.tick();
  close(f.world.teamFood[0], 1000 + cargo); assert.equal(f.world.units[0].cargo, 0);
  assert.equal(f.world.nodes.get('fish-0').stock, stock); assert.equal(f.world.units[0].gatherPhase, '');
  close(f.conserved(0), .1);
});

test('blocked, destroyed, unfinished, foreign and land drop-offs never bank boat food remotely', () => {
  const f = fixture(10); const unit = f.world.units[0]; f.start(0);
  while (unit.gatherPhase !== 'gathering') f.tick();
  const blockers = f.fish.dockCells(f.world.buildings[0]).map((cell, index) => ({ ...structuredClone(unit), id: 2 + index, team: 1, ...f.water.graph.pointAt(cell), gatherPhase: '' }));
  f.world.units.push(...blockers);
  for (let i = 0; i < 400; i++) f.tick();
  assert.equal(unit.cargo, 10); assert.equal(f.world.teamFood[0], 1000);
  assert.equal(unit.gatherPhase, 'to-base'); assert.equal(unit.path.length, 0);
  const dock = f.world.buildings[0];
  for (const patch of [{ complete: false }, { team: 1 }, { type: 'mill' }, { hp: 0 }]) {
    const changed = { ...dock, ...patch }; assert.equal(f.fish.deliveryRoute(unit, [changed], [unit]), null);
  }
  // A target destroyed during the one-second retry wait must clear even without a moving route.
  unit.dropoffBuildingId = dock.id; unit.repathTimer = 1; f.world.buildings.shift(); f.tick();
  assert.equal(unit.dropoffBuildingId, null); assert.ok(f.fish.validState(unit, f.world.nodes, f.world.buildings));
  for (let i = 0; i < 100; i++) f.tick();
  assert.equal(unit.cargo, 10); assert.equal(f.world.teamFood[0], 1000);
  for (const blocker of blockers) blocker.hp = 0; f.world.buildings.push(dock);
  for (let i = 0; i < 200; i++) f.tick();
  assert.equal(unit.cargo, 0); assert.equal(f.world.teamFood[0], 1010); close(f.conserved(0), 10);
});

test('an external shore Worker consumes the authoritative stock, leaving only the remainder to the boat', () => {
  const f = fixture(10); f.start(0); const node = f.world.nodes.get('fish-0');
  node.stock -= 7; // The land Worker economy writes this same Map, not a boat inventory.
  for (let i = 0; i < 400; i++) f.tick();
  assert.equal(node.stock, 0); assert.equal(f.world.teamFood[0], 1003); assert.equal(f.world.units[0].cargo, 0);
});

test('checkpoint fishing intent rejects foreign Dock, wrong cargo, wrong source and off-approach harvesting', () => {
  const f = fixture(), original = f.world.units[0]; f.start(0);
  for (const mutate of [unit => { unit.cargo = 1; unit.cargoType = 'wood'; },
    unit => { unit.cargo = 10.01; unit.cargoType = 'food'; }, unit => { unit.gatherNodeId = 'missing'; },
    unit => { unit.gatherNodeId = 'fish-1'; }, unit => { unit.dropoffBuildingId = 2; },
    unit => { unit.gatherPhase = 'gathering'; }, unit => { unit.holdingPosition = true; }]) {
    const invalid = structuredClone(original); mutate(invalid); assert.equal(f.fish.validState(invalid, f.world.nodes, f.world.buildings), false);
  }
});

test('provisional fishing tuning is bounded and part of the ruleset; boats never become Worker build controls', async () => {
  const base = await gameplayRulesetRevision(GAMEPLAY_DEFINITIONS);
  const changed = structuredClone(GAMEPLAY_DEFINITIONS); changed.units.skiff.fishing.gatherRate = 2;
  assert.notEqual(await gameplayRulesetRevision(changed), base);
  for (const fishing of [null, {}, { gatherRate: 0, carryCapacity: 10 }, { gatherRate: 1, carryCapacity: 11 },
    { gatherRate: 1, carryCapacity: 10, regrowth: true }]) {
    const invalid = structuredClone(GAMEPLAY_DEFINITIONS); invalid.units.skiff.fishing = fishing;
    assert.throws(() => validateGameplayDefinitions(invalid));
  }
  const f = fixture(), unit = f.world.units[0]; unit.cargo = .005; unit.cargoType = 'food';
  const selected = selectionContext(f.world.units, [0], 0);
  assert.equal(selected.kind, 'boats'); assert.equal(selected.counts.worker, 0); assert.equal(selected.cargo.food, .005);
});
