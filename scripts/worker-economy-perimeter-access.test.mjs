import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createWorkerPerimeterAccess, WORKER_PERIMETER_LIMITS } from '../src/economy-perimeter-access.mjs';
import { LAND_CLEARANCE_PROFILE, pointSegmentDistanceSquared } from '../src/unit-movement.mjs';
import { workerPerimeterServerFunctions } from './economy-server-fixture.mjs';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';

const actor = (id, extra = {}) => ({ id, generation: 1, orderRevision: 0, hp: 35, team: 0,
  kind: 'worker', movementDomain: 'land', x: -5.5, z: -5.5, gatherPhase: '',
  gatherNodeId: null, gatherForestCell: -1, moveGoalCell: -1, ...extra });
const goal = 10 * 20 + 10; // (.5, .5)
function access(units, overrides = {}) {
  const state = { epoch: 0, navigationRevision: 0 };
  const scope = createWorkerPerimeterAccess({ units, width: 20, height: 20, maxUnits: 2000,
    ...state, current: () => state, ...overrides });
  return { scope, state };
}
for (const [kind, radius] of Object.entries(LAND_CLEARANCE_PROFILE.radiusByKind)) {
  for (const team of [0, 1]) test(`${kind}, seat ${team}: stopped land body uses its actual registered radius`, () => {
    const own = actor(0), peer = actor(1, { kind, team, x: .5 + .18 + radius - .001, z: .5 });
    const { scope } = access([own, peer]);
    assert.equal(scope.select(own, [goal]).status, 'blocked'); scope.close();
    peer.x += .002;
    const clear = access([own, peer]).scope;
    assert.equal(clear.select(own, [goal]).status, 'ready'); clear.close();
  });
}
test('live clone exclusion, planned claims, cancellation, replacement and scope invalidation', () => {
  const own = actor(0, { x: .5, z: .5 }), next = actor(1), units = [own, next];
  const { scope, state } = access(units);
  assert.deepEqual(scope.select({ ...own }, [goal]).goals, [goal], 'clone excludes exactly its corresponding live body');
  const preview = scope.preview(own, goal);
  assert.deepEqual(scope.select(next, [goal, goal + 2]).goals, [goal + 2]);
  scope.cancel(preview); scope.cancel(preview); scope.cancel(undefined);
  own.x = -5.5; // The next scope observes this deliberately synthetic pose change.
  scope.close();
  const second = access(units).scope;
  const staged = second.preview(own, goal);
  assert.deepEqual(second.select(next, [goal, goal + 2]).goals, [goal + 2]);
  own.orderRevision++;
  assert.equal(second.preview({ ...own, orderRevision: 0 }, goal), null);
  assert.deepEqual(second.select(next, [goal, goal + 2]).goals, [goal, goal + 2], 'stale preview cannot claim');
  second.cancel(staged);
  const token = second.preview(own, goal);
  Object.assign(own, { gatherPhase: 'to-base', cargo: 10, dropoffBuildingId: 1,
    dropoffNavigationRevision: 0, moveGoalCell: goal });
  own.orderRevision++; second.commit(own);
  second.cancel(token); // Old preview cannot remove the accepted revision's claim.
  assert.deepEqual(second.select(next, [goal, goal + 2]).goals, [goal + 2]);
  units[0] = actor(0, { generation: 2 });
  assert.equal(second.select(own, [goal]).status, 'deferred'); second.close();
  state.navigationRevision++;
  assert.equal(scope.select(next, [goal]).status, 'deferred');
  const invalidated = access(units); invalidated.state.epoch++;
  assert.equal(invalidated.scope.select(units[0], [goal]).status, 'deferred'); invalidated.scope.close();
});
test('64 visits, 256 checks, 32 cells and malformed rosters defer without availability', () => {
  assert.deepEqual(WORKER_PERIMETER_LIMITS, { cells: 32, checks: 256, visits: 64 });
  const own = actor(0), peers = Array.from({ length: 65 }, (_, i) => actor(i + 1, { x: 1.5, z: 1.5 }));
  const overloaded = access([own, ...peers]).scope;
  assert.equal(overloaded.select(own, [goal]).status, 'deferred');
  assert.equal(overloaded.diagnostics.visits, 64); overloaded.close();
  const bounded = access([own]).scope;
  assert.equal(bounded.diagnostics.censusSlots, 0, 'unused scopes remain census-free');
  for (let n = 0; n < 256; n++) assert.equal(bounded.select(own, [goal]).status, 'ready');
  assert.equal(bounded.select(own, [goal]).status, 'deferred');
  assert.equal(bounded.diagnostics.checks, 256); bounded.close();
  assert.equal(bounded.diagnostics.censusSlots, 1, 'one scope performs one bounded census');
  const perimeter = access([own]).scope;
  assert.equal(perimeter.select(own, Array.from({ length: 33 }, (_, n) => n)).status, 'deferred');
  assert.equal(perimeter.diagnostics.checks, 0); perimeter.close();
  for (const units of [[own, actor(1, { kind: 'unknown' })], [own, actor(9)], [own, actor(1, { x: NaN })]]) {
    const s = access(units).scope; assert.equal(s.select(own, [goal]).status, 'deferred'); s.close();
  }
  const tooMany = access([own], { maxUnits: 0 }).scope;
  assert.equal(tooMany.select(own, [goal]).status, 'deferred'); tooMany.close();
  const oversized = access([own], { maxUnits: 2001 }).scope;
  assert.equal(oversized.select(own, [goal]).status, 'deferred'); oversized.close();
});
test('no body-clear alternative and deferred budget retain static admission without claiming availability', () => {
  const own = actor(0), peer = actor(1, { x: .5, z: .5 }), { scope } = access([own, peer]);
  assert.deepEqual(scope.select(own, [goal]), { status: 'blocked', goals: [] });
  const context = vm.createContext({ workerPerimeterAccessScope: scope });
  vm.runInContext(workerPerimeterServerFunctions, context);
  assert.deepEqual(context.workerBuildingPerimeterGoals(own, [goal]), [goal]);
  scope.close();
  assert.deepEqual(scope.select(own, [goal]), { status: 'deferred', goals: [] });
  assert.deepEqual(context.workerBuildingPerimeterGoals(own, [goal]), [goal]);
});
test('water and dead bodies do not block; body mutation and navigation invalidate availability', () => {
  const own = actor(0), units = [own, actor(1, { x: .5, z: .5, movementDomain: 'water', kind: 'skiff' }),
    actor(2, { x: .5, z: .5, hp: 0 })];
  const { scope, state } = access(units);
  assert.equal(scope.select(own, [goal]).status, 'ready');
  state.navigationRevision++; assert.equal(scope.select(own, [goal]).status, 'deferred'); scope.close();
  const peer = actor(1, { x: 1.5, z: 1.5 }), fresh = access([own, peer]).scope;
  assert.equal(fresh.select(own, [goal]).status, 'ready');
  peer.x += .01; assert.equal(fresh.select(own, [goal]).status, 'deferred'); fresh.close();
});
test('fixed-key flow cache compares exact membership and retains the existing eight-field cap', () => {
  const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('function getAttackFlowFieldForGoals('), end = source.indexOf('\nfunction ', start + 1);
  let builds = 0;
  const context = vm.createContext({ attackFlowFields: new Map(), MAX_ATTACK_FLOW_FIELDS: 8,
    isWalkable: () => true, buildAttackFlowNextCells: goals => { builds++; return goals; } });
  vm.runInContext(workerPerimeterServerFunctions + source.slice(start, end), context);
  const first = context.workerPerimeterFlowField([1, 2], 'farm:1:0');
  assert.equal(context.workerPerimeterFlowField([2, 1, 1], 'farm:1:0'), first);
  assert.equal(builds, 1);
  const next = context.workerPerimeterFlowField([2, 3], 'farm:1:0');
  assert.notEqual(next, first); assert.deepEqual([...next.goals], [2, 3]);
  for (let n = 0; n < 300; n++) context.workerPerimeterFlowField([n, n + 1], 'farm:1:0');
  assert.equal(context.attackFlowFields.size, 1);
  for (let n = 0; n < 20; n++) context.workerPerimeterFlowField([n], `dropoff:0:${n}:0`);
  assert.equal(context.attackFlowFields.size, 8);
});

process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp';
process.env.RTS_PREGAME = '0'; process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '0';
delete process.env.RTS_MATCH_STATE_PATH;
const map = { id: 'paid-perimeter-selection', name: 'Paid perimeter selection', width: 64, height: 64,
  terrainSeed: 19, fogOfWar: true, startingArmySize: 8, startingResources: { food: 0, wood: 400 },
  spawnPoints: [{ team: 0, x: -22, z: 0 }, { team: 1, x: 22, z: 0 }],
  obstacles: [], resourceNodes: [], triggers: [], scenarioEvents: [] };
const DEADLINE = 2700;
async function paidJourney(team, mode) {
  const f = await createPathingReplayFixture(map, { traceLandSteps: true }), r = f.replay;
  const ids = Array.from({ length: 4 }, (_, n) => team * 4 + n), x = team ? 10.5 : -10.5;
  let writes = 0;
  function conserved() {
    const s = r.checkpoint().state, farm = s.buildings.find(b => b.team === team && b.type === 'farm');
    if (farm?.complete) assert.ok(Math.abs(farm.harvestStock + s.teamFood[team]
      + s.units.filter(u => u.team === team && u.cargoType === 'food').reduce((n, u) => n + u.cargo, 0) - 200) < 1e-7);
    return s;
  }
  function step() {
    r.step(); conserved();
    for (const write of r.landSteps.filter(w => w.kind === 'worker')) {
      writes++;
      for (const peer of write.neighbours) {
        const required = .18 + LAND_CLEARANCE_PROFILE.radiusByKind[peer.kind];
        const before = Math.hypot(write.from.x - peer.x, write.from.z - peer.z);
        const after = Math.hypot(write.to.x - peer.x, write.to.z - peer.z);
        const swept = Math.sqrt(pointSegmentDistanceSquared(peer, write.from, write.to));
        assert.ok(before >= required - 1e-9 ? swept >= required - 1e-9
          : swept >= before - 1e-9 && after >= before - 1e-9, 'every actual serial write retains strict body clearance');
      }
    }
  }
  function until(predicate, label) {
    let ticks = 0; for (; ticks < DEADLINE && !predicate(); ticks++) step();
    assert.ok(predicate(), `${label} within original ${DEADLINE}-tick window`); return ticks;
  }
  function order(type, selected, extra = {}, expected) {
    const notices = r.order(team, { type, ids: selected, unitGenerations: selected.map(id => r.units[id].generation), ...extra });
    if (expected) assert.match(notices.map(n => n.message).join('\n'), expected); r.drain();
  }
  function move(id, position) {
    order('move', [id], position, /PLANNING MOVE|MOVE ORDER/);
    until(() => !r.units[id].movePlanningPending && r.units[id].pathIndex >= r.units[id].path.length, 'normal Move arrival');
    assert.ok(Math.hypot(r.units[id].x - position.x, r.units[id].z - position.z) < 1e-7);
    order('stop', [id], {}, /STOP ORDER/);
  }
  try {
    order('build', [ids[0]], { buildingType: 'farm', x, z: .5 }, /FARM PLACED/);
    until(() => r.buildings.some(b => b.type === 'farm' && b.complete), 'paid Farm construction');
    order('build', [ids[1]], { buildingType: 'storehouse', x, z: 6.5 }, /STOREHOUSE PLACED/);
    until(() => r.buildings.some(b => b.type === 'storehouse' && b.complete), 'paid depot construction');
    const farmId = r.buildings.find(b => b.type === 'farm').id, depotId = r.buildings.find(b => b.type === 'storehouse').id;
    move(ids[1], { x: x + 8, z: 10.5 });
    const carriers = mode === 'batch' ? [ids[0], ids[3]] : [ids[0]];
    for (const id of carriers) {
      order('gather', [id], { nodeId: `farm:${farmId}` }, /GATHER ORDER/);
      until(() => r.units[id].cargo === 10, 'naturally earned full Food cargo');
      order('stop', [id], {}, /STOP ORDER/);
    }
    if (mode !== 'batch') move(ids[3], { x: x + 8, z: 12.5 });
    move(ids[0], { x: x + 2, z: 2.5 });
    if (mode === 'batch') {
      // Ordinary Worker Move has its own admission policy. Route setup around
      // the parked carrier instead of crossing that existing body.
      move(ids[3], { x: x + 3.5, z: -3.5 });
      move(ids[3], { x: x + 3.5, z: 2.5 });
    }
    move(ids[2], { x: x + 2, z: 4.5 });
    if (mode === 'late') move(ids[2], { x: x + 2, z: 5.5 });
    const before = conserved(); assert.equal(before.teamWood[team], 240);
    const crop = before.buildings.find(b => b.id === farmId).harvestStock;
    order('returnCargo', carriers, {}, /RETURN CARGO ORDER/);
    assert.ok(carriers.every(id => r.units[id].dropoffBuildingId === depotId));
    if (mode === 'late') {
      const retainedGoal = r.units[ids[0]].moveGoalCell;
      move(ids[2], r.point(retainedGoal));
      const cargo = r.units[ids[0]].cargo, bank = r.food[team], pose = [r.units[ids[0]].x, r.units[ids[0]].z];
      for (let n = 0; n < 300; n++) step();
      assert.equal(cargo, 10); assert.equal(r.units[ids[0]].cargo, cargo); assert.equal(r.food[team], bank);
      assert.equal(r.units[ids[0]].moveGoalCell, retainedGoal);
      assert.deepEqual([r.units[ids[0]].x, r.units[ids[0]].z], pose, 'late occupation remains the separately allocated retry case');
      order('move', [ids[2]], { x: x + 8, z: 15.5 }, /PLANNING MOVE|MOVE ORDER/);
      until(() => r.units[ids[0]].cargo === 0, 'normal blocker removal releases late occupied goal');
      assert.equal(r.food[team], 10); return;
    }
    if (mode === 'batch') assert.equal(new Set(carriers.map(id => r.units[id].moveGoalCell)).size, carriers.length,
      'prospective clones choose distinct available endpoints before live acceptance');
    assert.ok(carriers.every(id => Math.hypot(r.point(r.units[id].moveGoalCell).x - r.units[ids[2]].x,
      r.point(r.units[id].moveGoalCell).z - r.units[ids[2]].z) >= .36));
    order('gather', [ids[2]], { nodeId: `farm:${farmId}` }, /GATHER ORDER/);
    assert.notEqual(r.units[ids[2]].moveGoalCell, r.cell(r.units[ids[0]].x, r.units[ids[0]].z));
    const cp = r.checkpoint(); r.restore(structuredClone(cp));
    for (const key of ['units', 'buildings', 'teamFood', 'teamWood', 'resourceNodes'])
      assert.deepEqual(conserved()[key], cp.state[key], `cold recovery preserves ${key}`);
    const ticks = until(() => carriers.every(id => r.units[id].cargo === 0 && r.units[id].gatherPhase === '')
      && r.food[team] === carriers.length * 10 && r.units[ids[2]].cargo > 0, 'actual delivery and positive Farm grant');
    assert.ok(r.buildings.find(b => b.id === farmId).harvestStock < crop);
    assert.equal(r.units[ids[2]].gatherNodeId, `farm:${farmId}`);
    console.log(JSON.stringify({ team, mode, sourceSha256: f.sourceSha256, ticks, writes,
      delivered: r.food[team], positiveFarmGrant: true, contactViolations: 0 }));
  } finally { await f.dispose(); }
}
for (const team of [0, 1]) for (const mode of ['initial', 'batch', 'late'])
  test(`seat ${team}: paid ${mode} perimeter selection, strict contacts and conservation`, () => paidJourney(team, mode));
