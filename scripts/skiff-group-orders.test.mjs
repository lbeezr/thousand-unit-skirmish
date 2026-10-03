import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createWaterUnitRuntime, waterUnitOccupiedCells } from '../src/water-unit-runtime.mjs';
import { createSkiffFishingContext } from '../src/skiff-fishing.mjs';
import { planSkiffGroupMove, planSkiffGroupFishing, planSkiffGroupReturn, SKIFF_GROUP_ORDER_LIMIT } from '../src/skiff-group-orders.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';

function fixture(stock = 31) {
  const map = { width: 64, height: 64, spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
    obstacles: [18, 43].map(column => ({ column, row: 42, width: 6, height: 8, material: 'water' })),
    resourceNodes: [0, 1].map(team => ({ id: `fish-${team}`, type: 'food', resourceVariant: 'shore-fish',
      x: team ? 15.5 : -9.5, z: 9.5, stock })) };
  const water = createWaterUnitRuntime(map), fishing = createSkiffFishingContext(map, water);
  const buildings = [0, 1].map(team => ({ id: team + 1, type: 'dock', team, hp: 1200, complete: true,
    x: team ? 12.5 : -12.5, z: 8.5 }));
  const units = [0, 1].flatMap(team => [0, 1, 2].map(index => ({ ...water.graph.pointAt((46 + (index === 2 ? 2 : 0)) * 64 + (team ? 44 : 19) + (index === 1 ? 1 : 0)),
    id: team * 3 + index, team, kind: 'skiff', movementDomain: 'water', hp: 120,
    cargo: 0, cargoType: null, gatherNodeId: null, gatherForestCell: -1, gatherPhase: '', dropoffBuildingId: null,
    path: [], pathIndex: 0, moveGoalCell: -1, waterMoveBlocked: false, holdingPosition: false, repathTimer: 0, orderRevision: 1 })));
  const world = { units, buildings, nodes: new Map(map.resourceNodes.map(node => [node.id, structuredClone(node)])), teamFood: [1000, 1000] };
  const stop = unit => { unit.path = []; unit.pathIndex = 0; unit.moveGoalCell = -1; unit.gatherPhase = ''; unit.gatherNodeId = null; unit.dropoffBuildingId = null; unit.waterMoveBlocked = false; };
  function apply(plan, economy = false) {
    assert.equal(plan.status, 'found');
    for (const { unit, route, phase, nodeId } of plan.assignments) {
      stop(unit);
      if (economy) fishing.start(unit, nodeId, phase, route);
      else { unit.path = route.cells; unit.moveGoalCell = route.cells.at(-1); }
    }
  }
  const tick = () => { water.advance(world.units, 1 / 30, () => UNIT_DEFINITIONS.skiff.combat.moveSpeed); fishing.update(world, 1 / 30); };
  const safe = () => {
    const occupied = new Set();
    for (const unit of world.units) {
      assert.ok(water.validRoute(unit)); assert.ok(fishing.validState(unit, world.nodes, world.buildings));
      for (const cell of waterUnitOccupiedCells(water.graph, unit)) { assert.ok(!occupied.has(cell)); occupied.add(cell); }
    }
    for (const team of [0, 1]) assert.ok(Math.abs(world.nodes.get(`fish-${team}`).stock + world.units.filter(unit => unit.team === team)
      .reduce((sum, unit) => sum + unit.cargo, 0) + world.teamFood[team] - 1000 - stock) < 1e-8);
  };
  return { map, water, fishing, world, units, buildings, apply, stop, tick, safe };
}

for (const team of [0, 1]) test(`seat ${team}: group Move assigns distinct destinations to exact selected IDs and recovers routes`, () => {
  const f = fixture(), selected = f.units.slice(team * 3, team * 3 + 2), unselected = f.units[team * 3 + 2];
  const before = structuredClone(f.units), point = f.water.graph.pointAt(46 * 64 + (team ? 46 : 21));
  const plan = planSkiffGroupMove(f.water, [...selected].reverse(), point.x, point.z, f.units);
  assert.deepEqual(f.units, before, 'planning never replaces an order');
  assert.deepEqual(plan.assignments.map(({ unit }) => unit.id), selected.map(unit => unit.id));
  const goals = plan.assignments.map(({ route }) => route.cells.at(-1)); assert.equal(new Set(goals).size, 2);
  selected[0].cargo = .005; selected[0].cargoType = 'food'; f.world.nodes.get(`fish-${team}`).stock -= .005;
  f.apply(plan); for (let i = 0; i < 6; i++) f.tick();
  f.world.units = structuredClone(f.units); // persisted per-boat paths/goals/cargo are sufficient
  for (let i = 0; i < 250; i++) { f.tick(); f.safe(); }
  for (let i = 0; i < selected.length; i++) {
    const unit = f.world.units[selected[i].id]; assert.equal(unit.path.length, 0);
    assert.deepEqual({ x: unit.x, z: unit.z }, f.water.graph.pointAt(goals[i]));
  }
  assert.equal(f.world.units[selected[0].id].cargo, .005); assert.deepEqual(f.world.units[unselected.id], before[unselected.id]);
});

test('group Move rejects a mixed, oversized, disconnected or crowded group atomically', () => {
  const f = fixture(), point = f.water.graph.pointAt(46 * 64 + 21), before = structuredClone(f.units);
  for (const selection of [[f.units[0], { ...f.units[1], kind: 'worker', movementDomain: undefined }],
    [f.units[0], f.units[3]], Array.from({ length: SKIFF_GROUP_ORDER_LIMIT + 1 }, (_, id) => ({ ...f.units[0], id }))]) {
    assert.notEqual(planSkiffGroupMove(f.water, selection, point.x, point.z, f.units).status, 'found');
  }
  assert.equal(planSkiffGroupMove(f.water, [f.units[0]], 0, 0, f.units).status, 'invalid-endpoints');
  assert.equal(planSkiffGroupMove(f.water, [f.units[0]], f.units[1].x, f.units[1].z, f.units).status, 'no-distinct-routes');
  assert.deepEqual(f.units, before);
});

test('both seats group-fish distinct approaches and preserve one finite stock through automatic delivery/restart', () => {
  const f = fixture(), before = structuredClone(f.units);
  for (const team of [0, 1]) {
    const selected = f.units.slice(team * 3, team * 3 + 2);
    const plan = planSkiffGroupFishing(f.fishing, selected, f.world.nodes.get(`fish-${team}`), f.buildings, f.units);
    assert.equal(plan.status, 'found'); assert.equal(new Set(plan.assignments.map(({ route }) => route.cells.at(-1))).size, 2);
    f.apply(plan, true);
  }
  let restarted = false;
  for (let i = 0; i < 2300; i++) {
    f.tick(); f.safe();
    if (!restarted && f.world.units.some(unit => unit.gatherPhase === 'to-base')) { f.world.units = structuredClone(f.world.units); restarted = true; }
  }
  assert.ok(restarted);
  assert.deepEqual(f.world.teamFood, [1031, 1031]);
  for (const team of [0, 1]) {
    assert.equal(f.world.nodes.get(`fish-${team}`).stock, 0);
    assert.deepEqual(f.world.units[team * 3 + 2], before[team * 3 + 2]);
  }
});

test('group Return cargo reaches distinct owned berth cells, deposits each fractional load once and leaves unselected orders intact', () => {
  const f = fixture(), selected = [f.units[0], f.units[1]], before = structuredClone(f.units[2]);
  selected.forEach((unit, index) => { unit.cargo = index ? 4.25 : .005; unit.cargoType = 'food'; f.world.nodes.get('fish-0').stock -= unit.cargo; });
  const plan = planSkiffGroupReturn(f.fishing, selected, f.buildings, f.units);
  assert.equal(plan.status, 'found'); const goals = plan.assignments.map(({ route }) => route.cells.at(-1)); assert.equal(new Set(goals).size, 2);
  assert.ok(goals.every(cell => f.fishing.dockCells(f.buildings[0]).includes(cell)));
  f.apply(plan, true); f.world.units = structuredClone(f.units);
  for (let i = 0; i < 400; i++) { f.tick(); f.safe(); }
  assert.equal(f.world.teamFood[0], 1004.255); assert.deepEqual(f.world.units[2], before);
  assert.ok(f.world.units.slice(0, 2).every(unit => unit.cargo === 0 && unit.gatherPhase === '' && unit.gatherNodeId === null));
  for (let i = 0; i < 2; i++) assert.deepEqual({ x: f.world.units[i].x, z: f.world.units[i].z }, f.water.graph.pointAt(goals[i]));
});

test('cargo credits only at the assigned berth, never a different berth traversed en route', () => {
  const f = fixture(), unit = f.units[0];
  Object.assign(unit, f.water.graph.pointAt(44 * 64 + 20), { cargo: 5, cargoType: 'food' });
  f.world.nodes.get('fish-0').stock -= 5;
  f.fishing.start(unit, null, 'to-base', { cells: [44 * 64 + 20, 44 * 64 + 19, 43 * 64 + 19], buildingId: 1 });
  f.water.advance(f.units, 1 / 2.4, () => 2.4); f.fishing.update(f.world, 0);
  assert.equal(f.world.teamFood[0], 1000); assert.equal(unit.cargo, 5); f.safe();
  f.water.advance(f.units, 1 / 2.4, () => 2.4); f.fishing.update(f.world, 0);
  assert.equal(f.world.teamFood[0], 1005); assert.equal(unit.cargo, 0); f.safe();
});

test('insufficient distinct fish or Dock targets preserve every existing order and cargo', () => {
  const f = fixture(), selected = f.units.slice(0, 3), before = structuredClone(f.units);
  assert.notEqual(planSkiffGroupFishing(f.fishing, selected, f.world.nodes.get('fish-0'), f.buildings, f.units).status, 'found');
  assert.deepEqual(f.units, before);
  selected[0].cargo = 1; selected[0].cargoType = 'food';
  assert.notEqual(planSkiffGroupReturn(f.fishing, selected, [{ ...f.buildings[0], team: 1 }], f.units).status, 'found');
  assert.equal(selected[0].cargo, 1); assert.equal(selected[0].gatherPhase, '');
});

test('a future destination is reserved, parking on transit paths is refused, and the current occupant can sail away', () => {
  const f = fixture(), a = f.units[0], b = f.units[1], point = f.water.graph.pointAt(46 * 64 + 21);
  b.path = [46 * 64 + 20, 46 * 64 + 21, 46 * 64 + 22]; b.moveGoalCell = 46 * 64 + 22;
  assert.equal(f.water.planReserved(a, point.x, point.z, f.units).status, 'invalid-endpoints');
  b.path = [46 * 64 + 20, 46 * 64 + 19]; b.moveGoalCell = 46 * 64 + 19;
  assert.equal(f.water.planReserved(a, point.x, point.z, f.units).status, 'found');
});

test('actual client group Move, Gather and Return cargo send only the selected boat IDs', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'), sent = [];
  const extract = (start, end) => source.slice(source.indexOf(`function ${start}(`), source.indexOf(end, source.indexOf(`function ${start}(`)));
  const units = [0, 1, 2].map(id => ({ id, kind: 'skiff', cargo: id < 2 ? .005 : 0 }));
  const context = vm.createContext({ units, localTeam: 0, matchWinner: -1, selectedIds: () => [0, 1], selectedWaterUnits: () => true,
    isShoreFish: () => true, showToast: message => { throw new Error(message); },
    sendTrackedOrder: command => { sent.push(JSON.parse(JSON.stringify(command))); return true; },
    persistentTargetMode: null, attackMoveMode: false, ui: { formationSelect: { value: 'box' } },
    moveMarker: { position: { set() {} }, material: { color: { setHex() {} } }, scale: { setScalar() {} } },
    groundHeight: () => 0, setTapOrderArmed() {}, setAttackMoveMode() {}, updateCommandUI() {},
  });
  vm.runInContext(extract('issueMove', '\nfunction issueBuildingRallyPoint(')
    + extract('issueGather', '\nfunction issueForestGather(')
    + extract('issueReturnCargo', "\nfor (const button of document.querySelectorAll('[data-return-cargo]'))"), context);
  context.issueMove({ x: 1, z: 2 }, false, true); context.issueGather({ id: 'fish' }); context.issueReturnCargo();
  assert.deepEqual(sent.map(command => command.type), ['move', 'gather', 'returnCargo']);
  assert.ok(sent.every(command => JSON.stringify(command.ids) === '[0,1]'));
});
