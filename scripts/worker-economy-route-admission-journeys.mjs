import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as movement from '../src/unit-movement.mjs';
import * as workIntent from '../src/work-intent.mjs';
import { forestGatherGroups, visibleForestCandidates } from '../src/forest-gather-group.mjs';
import { shortcutFlatUnitPath, canTraverseFlatUnitSegment } from '../src/unit-path-line.mjs';
import { activeWallBuildOrder } from '../src/wall-build-order.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { creditResourceBalance } from '../src/economy-ledger.mjs';
import { preflightXlCheckpointRoutes, XL_CHECKPOINT_ROUTE_MAX_ENTRIES as QUOTA } from '../src/server/checkpoint-route-budget.mjs';

const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
function body(name) {
  const start = source.indexOf(`function ${name}(`), end = source.indexOf('\nfunction ', start + 1);
  assert.ok(start > 0 && end > start, name); return source.slice(start, end);
}
const names = ['workerFlowPath', 'applyWorkerFlowRoute', 'publishWorkerEconomyRoute',
  'updateWorkerEconomyWithRouteAdmission', 'routeWorkerToDropoff', 'workerAtDropoff', 'routeWorker',
  'forestOpenAccessCells', 'routeForestWorker', 'updateForestWorkerEconomy', 'updateWorkerEconomy',
  'forestGroupTarget', 'continueForestGroupGathering', 'continueAreaGathering',
  'ensureGatherWorkIntent', 'depositWorkerCargo', 'stopGathering', 'cancelGatherOrder',
  'clearAttackMoveOrder', 'assignStationaryOrder', 'pendingMoveAssignmentsByUnit', 'enqueueRouteRepairs',
  'applyPlannedMoveAssignment', 'completeMovePlanningJob', 'processMovePlanningSlice',
  'scheduleNextMovePlanning', 'serviceMovePlanningForTick'];
const record = path => ({ hp: 0, kind: 'infantry', path, pathIndex: path.length, attackMoveResumePath: null });
const entries = f => f.units.reduce((n, u) => n + u.path.length + (u.attackMoveResumePath?.length ?? 0), 0);
const phaseStart = source.indexOf('  const blockedRouteRepairs = [];');
const phaseEnd = source.indexOf('  advanceQueuedWaypoints();', phaseStart);
assert.ok(phaseStart > 0 && phaseEnd > phaseStart);
const physicalPhase = source.slice(phaseStart, phaseEnd);
const restoreStart = source.indexOf('  const pendingRepairs = [];', source.indexOf('function restoreMatchCheckpoint('));
const restoreEnd = source.indexOf('  dirty = true;\n}', restoreStart);
assert.ok(restoreStart > 0 && restoreEnd > restoreStart);
const recoveryTail = source.slice(restoreStart, restoreEnd);

// Synthetic XL route pressure and controlled flow/A* selection; real economy,
// publication, repair/service and checkpoint-leaf bodies. Not native XL saves.
function fixture({ width = 320, height = 320, total = 0, weighted = false, count = 1,
  oldLength = 0, resumeLength = 0, team = 0, turns = 1 } = {}) {
  const cell = (x, z) => Math.floor(z + height / 2) * width + Math.floor(x + width / 2);
  const point = c => ({ x: c % width - width / 2 + .5, z: Math.floor(c / width) - height / 2 + .5 });
  const start = cell(.5, .5), raw = Array.from({ length: 5 }, (_, i) => start + i + 1);
  const longer = [...raw, raw.at(-1) + 1], levels = new Uint8Array(width * height);
  if (weighted) for (const c of raw.slice(2)) levels[c] = 1;
  const actors = Array.from({ length: count }, (_, id) => ({ ...record(Array(oldLength).fill(start)), id,
    hp: 35, generation: 9, orderRevision: 7, team, kind: 'worker', movementDomain: 'land', ...point(start),
    attackMoveResumePath: resumeLength ? Array(resumeLength).fill(start) : null,
    cargo: 10, cargoType: 'food', workIntent: null, gatherPhase: 'to-base', gatherNodeId: null,
    gatherForestCell: -1, dropoffBuildingId: 10, dropoffNavigationRevision: 3,
    moveGoalCell: start, moveGoalPoint: null, movePlanningPending: false, queuedWaypoints: [],
    attackMove: false, attackTargetId: -1, attackBuildingTargetId: -1, buildingTargetId: null }));
  const units = [...actors], nodes = new Map();
  for (let remaining = total - count * (oldLength + resumeLength); remaining > 0;) {
    const length = Math.min(remaining, levels.length), path = Array(length);
    Object.defineProperty(path, 0, { get() { throw new Error('no pressure payload scan'); } });
    units.push(record(path)); remaining -= length;
  }
  const fields = [{ goal: longer.at(-1), goals: new Set([raw.at(-1), longer.at(-1)]), path: raw },
    { goal: longer.at(-1), goals: new Set([longer.at(-1)]), path: longer }];
  const candidates = [{ id: 10, goals: [...fields[0].goals] }, { id: 11, goals: [...fields[1].goals] }];
  const callbacks = [], censuses = [], selections = [], notices = [], searches = [], samples = [];
  const forestCellMask = new Uint8Array(levels.length), forestWoodRemaining = new Float64Array(levels.length);
  const context = vm.createContext({ ...movement, ...workIntent, shortcutFlatUnitPath, canTraverseFlatUnitSegment,
    activeWallBuildOrder, UNIT_DEFINITIONS, creditResourceBalance, visibleForestCandidates,
    MAP_WIDTH: width, MAP_HEIGHT: height, MAP_HALF_X: width / 2, MAP_HALF_Z: height / 2, CELL_COUNT: levels.length,
    MAX_UNITS: 2000, MAX_RESOURCE_NODES: 128, XL_CHECKPOINT_ROUTE_MAX_ENTRIES: QUOTA,
    units, resourceNodeStates: nodes, elevationLevelByCell: levels, forestCellMask, forestWoodRemaining,
    cellIndex: (column, row) => row * width + column, worldToCell: cell, cellToWorld: point,
    isWalkable: c => c >= 0 && c < levels.length && !forestCellMask[c],
    WALK_SPEED: 4, STEP_SECONDS: 1 / 30, WORKER_INTERACTION_RANGE: 1.4, WORKER_CARRY_CAPACITY: 10,
    GATHER_RATE: 2, workerFoodGatherMultiplier: () => 1, teamUpgrades: [{}, {}],
    movePlanningEpoch: 0, navigationRevision: 4, dirty: false, workerEconomyRouteScope: null,
    automaticTargetRejections: new WeakMap(), workerPerformingActions: { record() {} },
    commandUnits: command => command.ids.map(id => units[id]),
    unitHasCapability: (u, capability) => u.kind === 'worker' && capability === 'gather', militaryCombatant: () => false,
    economyResources: () => ['food', 'wood', 'stone'], matchEconomyProfileId: () => 'classic',
    sendOrderNotice: (_p, _c, message) => notices.push(message), broadcastGameplayNotice() {},
    nearestOpenCell: c => c, walkableComponents: new Int32Array(levels.length), workerDropoffCandidates: () => candidates,
    getAttackFlowFieldForGoals: (_goals, key) => key.includes(':10:') ? fields[0] : fields[1],
    getAttackFlowField: () => fields[0], pathFromAttackFlow: (_start, field) => field.path.slice(),
    buildingsById: new Map([[10, { id: 10, team, complete: true, ...point(raw.at(-1)) }]]),
    acceptsProfileDropoff: () => true, distanceToBuildingEdge: (u, b) => Math.hypot(u.x - b.x, u.z - b.z),
    teamFood: [100, 100], teamWood: [100, 100], teamStone: [0, 0],
    cellVisibleToTeam: () => true, forestStockChangedCells: new Set(), pendingForestClears: new Set(),
    flushPendingForestClears() {}, harvestNodeById: id => nodes.get(id),
    activateWildlifeHarvest: () => false, markWildlifeDepleted() {},
    activeMovePlanningJob: null, movePlanningQueue: [], nextMoveOrderId: 1, tickNumber: 0,
    MOVE_PLANNING_SLICE_BUDGET_MS: 5, MOVE_PLANNING_MAX_WORK_ITEMS_PER_SLICE: 8,
    MOVE_PLANNING_MAX_EXPANDED_CELLS_PER_SLICE: 4096, MOVE_PLANNING_TURNS_PER_TICK: turns,
    TICK_RATE: 30, ATTACK_MOVE_SCAN_INTERVAL_TICKS: 15, SHARED_MOVE_PATHS: true,
    pendingMoveStartBroadcasts: new Set(), movePlanningServiceTick: null,
    performance: { now: () => 0 }, setImmediate: callback => callbacks.push(callback),
    findPathAStar(from, destination, diagnostics) {
      searches.push(destination); diagnostics.searchCount++; diagnostics.expandedCells += 5;
      return Array.from({ length: Math.max(0, destination - from) }, (_, i) => from + i + 1);
    },
    recordMovePlanningSample: sample => samples.push(sample),
    console: { error(message, error) { throw new Error(message, { cause: error }); } },
    tickDiagnosticSamples: null, landRouteRetentionTick: null, automaticPositionAllowed: () => true,
    spreadInteractingUnits() {},
    getMoveVector(u, distance) {
      const target = point(u.path[u.pathIndex]), dx = target.x - u.x, dz = target.z - u.z;
      const length = Math.hypot(dx, dz);
      return { target, x: dx / length, z: dz / length, stepDistance: Math.min(distance, length), reachedWaypoint: length <= distance };
    },
  });
  context.createUnitRoutePublicationLedger = (...args) => {
    const ledger = movement.createUnitRoutePublicationLedger(...args); censuses.push(ledger); return ledger;
  };
  vm.runInContext(names.map(body).join('\n') + `\nfunction physicalPhase(){${physicalPhase}}\nfunction recoverPendingTail(){${recoveryTail}}`, context);
  const apply = context.applyWorkerFlowRoute;
  context.applyWorkerFlowRoute = (...args) => {
    const result = apply(...args);
    selections.push({ selected: result.selectedGoalCell, originalLength: result.originalPathLength,
      originalCost: result.originalCost, status: result.status, outcome: result.publicationOutcome });
    return result;
  };
  const f = { actors, units, nodes, context, raw, fields, start, point, cell, levels,
    censuses, selections, callbacks, notices, searches, samples, forestCellMask, forestWoodRemaining,
    economy: () => context.updateWorkerEconomyWithRouteAdmission(),
    physical() {
      const before = actors.map(u => ({ x: u.x, z: u.z })); context.physicalPhase();
      for (const [i, u] of actors.entries()) assert.ok(movement.canTraverseStaticBodySegment(before[i], u, .18,
        width, height, context.isWalkable), 'every actual physical displacement retains Worker clearance');
    },
    drain() { let bound = 0; while (callbacks.length) { assert.ok(++bound <= 8, 'no capacity callback busy-loop'); callbacks.shift()(); } },
    tick() { context.tickNumber++; context.serviceMovePlanningForTick(context.tickNumber); f.drain(); },
    release() { units.at(-1).path = []; },
    checkpointLeaf() {
      return preflightXlCheckpointRoutes({ width, height }, { resourceNodes: nodes,
        units: units.map(u => u.hp > 0 ? u : { ...u, path: Array(u.path.length).fill(start) }) },
      { maxUnits: 2000, maxResourceNodes: 128 });
    },
    forestActor(u = actors[0]) {
      const current = start + 10, tree = current + 1, center = point(current);
      Object.assign(u, { x: center.x - .4, z: center.z - .49, cargo: 5, cargoType: 'wood',
        gatherPhase: 'to-node', gatherForestCell: tree, gatherNodeId: null,
        workIntent: workIntent.createForestGatherWorkIntent(u.generation, point(tree)),
        path: [], pathIndex: 0, moveGoalCell: current, movePlanningPending: false });
      forestCellMask[tree] = 1; forestWoodRemaining[tree] = 100;
      context.forestWorkGroups = forestGatherGroups(forestCellMask, width);
      return { current, tree, job: structuredClone(u.workIntent) };
    },
  };
  assert.equal(entries(f), total); return f;
}

function offAccessForestResume({ team, turns, queued, total, visible = true }) {
  const f = fixture({ team, turns, total }), u = f.actors[0], forest = f.forestActor();
  Object.assign(u, f.point(f.start), { gatherPhase: 'to-base', dropoffNavigationRevision: 4,
    dropoffBuildingId: 10, moveGoalCell: f.start });
  Object.assign(f.context.buildingsById.get(10), f.point(f.start));
  // Controlled disclosure: an invisible remembered tree at the drop-off
  // becomes visible during the real physical approach. No hidden target choice.
  f.context.cellVisibleToTeam = () => visible
    || Math.hypot(u.x - f.point(forest.tree).x, u.z - f.point(forest.tree).z) <= 3;
  // This optional queued+work-intent combination is a synthetic accepted-state
  // control. An ordinary Shift Move clears workIntent and is tested elsewhere.
  if (queued) u.queuedWaypoints.push({ destination: forest.current + 4, attackMove: false, point: null });
  const original = f.context.getAttackFlowFieldForGoals;
  f.forestSelections = 0;
  f.context.getAttackFlowFieldForGoals = (goals, key) => {
    if (!key.startsWith('forest:')) return original(goals, key);
    f.forestSelections++;
    return { goal: forest.tree + 1, goals: new Set(goals),
      path: Array.from({ length: forest.current - f.start }, (_, i) => f.start + i + 1) };
  };
  return { f, u, forest };
}

for (const team of [0, 1]) for (const turns of [1, 2]) for (const queued of [false, true])
test(`seat ${team}, scheduler ${turns}, queued-state ${queued}: off-access forest resume retains its job and selected repair`, () => {
  for (const visible of [false, true]) for (const total of [0, QUOTA]) {
    const { f, u, forest } = offAccessForestResume({ team, turns, queued, total, visible });
    f.economy(); f.drain();
    const revision = u.orderRevision, job = structuredClone(u.workIntent), queue = structuredClone(u.queuedWaypoints);
    const pending = f.context.pendingMoveAssignmentsByUnit().get(u.id);
    assert.equal(f.context.teamWood[team], 105); assert.equal(u.cargo, 0);
    assert.equal(u.gatherPhase, 'to-node'); assert.equal(u.moveGoalCell, forest.current);
    assert.equal(u.movePlanningPending, total === QUOTA); assert.equal(f.forestSelections, 1);
    assert.equal(revision, total === QUOTA ? 9 : 8);
    for (let i = 0; i < 4; i++) { f.tick(); f.economy(); }
    assert.equal(u.orderRevision, revision, 'pending off-access leg is not a failed arrival');
    assert.deepEqual(u.workIntent, job); assert.deepEqual(u.queuedWaypoints, queue);
    assert.equal(u.gatherPhase, 'to-node'); assert.equal(u.moveGoalCell, forest.current);
    assert.equal(f.forestSelections, 1, 'waiting does not rerun forest selection');
    assert.equal(f.context.teamWood[team], 105, 'the completed deposit is credited once');
    if (total === QUOTA) {
      assert.equal(f.context.pendingMoveAssignmentsByUnit().get(u.id), pending);
      assert.equal(u.path.length, 0); assert.ok(f.checkpointLeaf()); f.release(); f.tick();
      assert.equal(u.movePlanningPending, false); assert.equal(u.path.at(-1), forest.current);
      for (let i = 0; i < 180 && u.cargo === 0; i++) { f.tick(); f.physical(); f.economy(); }
      assert.equal(u.gatherPhase, 'gathering'); assert.ok(u.cargo > 0);
      assert.deepEqual(u.workIntent, job); assert.deepEqual(u.queuedWaypoints, queue);
      assert.equal(f.context.teamWood[team], 105);
      assert.ok(Math.abs(f.forestWoodRemaining[forest.tree] + u.cargo + f.context.teamWood[team] - 205) < 1e-8);
      assert.ok(entries(f) <= QUOTA);
    }
  }
});

test('completed off-access forest failure retains the original queued/unqueued continuation policy', () => {
  for (const queued of [false, true]) {
    const { f, u, forest } = offAccessForestResume({ team: 0, turns: 1, queued, total: QUOTA });
    Object.assign(u, { cargo: 0, gatherPhase: 'to-node', movePlanningPending: false });
    f.economy();
    if (queued) {
      assert.equal(u.workIntent, null); assert.equal(u.gatherPhase, '');
      assert.equal(u.queuedWaypoints.length, 1); assert.equal(u.movePlanningPending, false);
      assert.equal(f.forestSelections, 0);
    } else {
      assert.ok(u.workIntent); assert.equal(u.gatherPhase, 'to-node');
      assert.equal(u.moveGoalCell, forest.current); assert.equal(u.movePlanningPending, true);
      assert.equal(f.forestSelections, 2, 'actual failed arrival still selects and routes through original continuation');
    }
    assert.equal(f.context.teamWood[0], 100);
  }
});

for (const [width, height] of [[320, 160], [160, 320], [320, 320]]) {
  test(`Worker economy ${width}x${height}: stale navigation retains raw selection under quota deferral`, () => {
    for (const weighted of [false, true]) for (const free of [0, 1, 5]) {
      const f = fixture({ width, height, weighted, total: QUOTA - free }), u = f.actors[0]; f.economy();
      const fits = free >= (weighted ? 5 : 1), selected = f.selections[0];
      assert.equal(selected.selected, f.raw.at(-1)); assert.notEqual(selected.selected, f.fields[0].goal);
      assert.equal(selected.originalLength, 5);
      assert.equal(selected.originalCost, movement.unitRoutePathCost(f.start, f.raw, width, f.levels));
      assert.equal(selected.status, fits ? 'ready' : 'deferred');
      assert.equal(u.dropoffBuildingId, 10, 'original raw length five beats six before reduction');
      assert.equal(u.dropoffNavigationRevision, 4); assert.equal(u.moveGoalCell, f.raw.at(-1));
      assert.equal(u.cargo, 10); assert.equal(u.cargoType, 'food'); assert.equal(u.gatherPhase, 'to-base');
      assert.equal(u.movePlanningPending, !fits); assert.ok(entries(f) <= QUOTA); assert.ok(f.checkpointLeaf());
      assert.equal(f.censuses.length, 1); assert.equal(f.context.workerEconomyRouteScope, null);
      if (!fits) {
        const pending = f.context.pendingMoveAssignmentsByUnit().get(u.id);
        assert.equal(pending.destination, f.raw.at(-1), 'explicit retry survives already-refreshed dropoff navigation');
        assert.equal(pending.path.length, 0); assert.equal(u.path.length, 0);
      }
    }
  });
  test(`Worker economy ${width}x${height}: forest center refusal preserves job/cargo/stock and one pending repair`, () => {
    const f = fixture({ width, height, total: QUOTA }), u = f.actors[0], forest = f.forestActor();
    u.queuedWaypoints.push({ destination: forest.current + 4, attackMove: false, point: null });
    f.economy(); f.drain(); const revision = u.orderRevision, pending = f.context.pendingMoveAssignmentsByUnit().get(u.id);
    assert.equal(pending.destination, forest.current); assert.equal(u.movePlanningPending, true);
    assert.equal(entries(f), QUOTA); assert.ok(f.checkpointLeaf());
    for (let i = 0; i < 6; i++) f.economy();
    assert.equal(u.orderRevision, revision); assert.equal(f.context.pendingMoveAssignmentsByUnit().get(u.id), pending);
    assert.equal(f.censuses.length, 1, 'waiting center does not repeat the census or repair');
    assert.equal(u.path.length, 0); assert.deepEqual(u.workIntent, forest.job);
    assert.equal(u.cargo, 5); assert.equal(u.cargoType, 'wood'); assert.equal(f.forestWoodRemaining[forest.tree], 100);
    assert.equal(u.queuedWaypoints.length, 1); assert.equal(f.context.workerEconomyRouteScope, null);
  });
}

test('mixed flow and center writers share one census in either stable actor order', () => {
  for (const forestFirst of [false, true]) {
    const f = fixture({ total: QUOTA - 1, count: 2 });
    f.forestActor(f.actors[forestFirst ? 0 : 1]); f.economy();
    assert.equal(f.censuses.length, 1); assert.equal(entries(f), QUOTA);
    assert.equal(f.actors.filter(u => u.path.length === 1).length, 1);
    assert.equal(f.actors.filter(u => u.movePlanningPending).length, 1);
    assert.ok(f.checkpointLeaf());
  }
});

test('active-only replacement does not credit a retained resume alias', () => {
  const f = fixture({ total: QUOTA, oldLength: 3, resumeLength: 3 }), u = f.actors[0];
  u.attackMoveResumePath = u.path; const alias = u.path; f.economy();
  assert.equal(entries(f), QUOTA - 2); assert.equal(u.attackMoveResumePath, alias);
  assert.equal(f.selections[0].status, 'ready'); assert.equal(u.movePlanningPending, false);
  assert.ok(f.checkpointLeaf());
});

for (const team of [0, 1]) for (const turns of [1, 2])
test(`seat ${team}, scheduler ${turns}: explicit selected-goal retry reserves fresh capacity and deposits once`, () => {
  const f = fixture({ total: QUOTA, team, turns }), u = f.actors[0]; f.economy(); f.drain();
  const destination = u.moveGoalCell, revision = u.orderRevision; f.economy();
  assert.equal(u.orderRevision, revision); assert.equal(f.context.teamFood[team], 100); assert.equal(u.cargo, 10);
  f.release(); f.tick(); assert.equal(u.movePlanningPending, false); assert.equal(u.path.at(-1), destination);
  assert.ok(entries(f) <= QUOTA); assert.ok(f.censuses.length >= 2, 'asynchronous publication takes a fresh reservation');
  for (let i = 0; i < 120 && u.cargo > 0; i++) { f.tick(); f.physical(); f.economy(); }
  assert.equal(u.movePlanningPending, false); f.economy();
  assert.equal(f.context.teamFood[team], 110); assert.equal(u.cargo, 0); assert.equal(u.gatherPhase, '');
});

test('pending forest flow keeps its selected tail instead of replacing it with the current access center', () => {
  const f = fixture({ total: QUOTA }), u = f.actors[0], forest = f.forestActor();
  u.movePlanningPending = true; u.moveGoalCell = forest.current - 1;
  const before = structuredClone(u); f.economy();
  assert.deepEqual(u, before); assert.equal(f.censuses.length, 0);
});

for (const team of [0, 1]) for (const turns of [1, 2])
test(`seat ${team}, scheduler ${turns}: cold pending center recovers into safe productive forest work`, () => {
  let f = fixture({ total: QUOTA, team, turns }), u = f.actors[0];
  f.forestActor(); f.economy(); f.drain();
  const saved = structuredClone(u), bytes = JSON.stringify(saved);
  // Fresh VM and actual restore-tail contract; metadata pressure is synthetic,
  // so this is explicitly separate from complete native checkpoint acceptance.
  f = fixture({ total: QUOTA, team, turns }); u = f.actors[0]; const forest = f.forestActor();
  Object.assign(u, structuredClone(saved)); f.context.recoverPendingTail(); f.drain();
  assert.equal(JSON.stringify(saved), bytes); assert.deepEqual(u.workIntent, saved.workIntent);
  assert.equal(u.moveGoalCell, forest.current); assert.equal(u.cargo, 5);
  f.release(); f.tick();
  for (let i = 0; i < 20 && u.cargo === 5; i++) { f.physical(); f.economy(); }
  assert.equal(u.gatherPhase, 'gathering'); assert.ok(u.cargo > 5);
  assert.equal(u.cargo + f.forestWoodRemaining[forest.tree], 105);
  assert.deepEqual(u.workIntent, saved.workIntent); assert.equal(u.movePlanningPending, false);
  assert.equal(f.context.workerEconomyRouteScope, null);
});

test('navigation changes during the operation keep explicit repair and acquire the current planner revision', () => {
  const f = fixture({ total: QUOTA }), u = f.actors[0];
  f.context.flushPendingForestClears = () => { f.context.navigationRevision++; };
  f.economy(); f.drain(); assert.equal(u.dropoffNavigationRevision, 4);
  assert.equal(f.context.navigationRevision, 5); assert.equal(u.moveGoalCell, f.raw.at(-1));
  f.release(); f.tick(); assert.equal(u.movePlanningPending, false);
  assert.equal(u.path.at(-1), f.raw.at(-1)); assert.ok(entries(f) <= QUOTA);
});

test('scope unwinds in finally and only current accepted actors reach repair handoff', () => {
  for (const mutation of ['stop', 'generation', 'replacement', 'epoch', 'throw']) {
    const f = fixture({ total: QUOTA }), u = f.actors[0];
    f.context.flushPendingForestClears = () => {
      if (mutation === 'stop') f.context.assignStationaryOrder({ team: 0 }, { type: 'stop', ids: [u.id] });
      else if (mutation === 'generation') u.generation++;
      else if (mutation === 'replacement') f.units[0] = { ...u, generation: 10, path: [], movePlanningPending: false };
      else if (mutation === 'epoch') f.context.movePlanningEpoch++;
      else throw new Error('controlled economy failure');
    };
    if (mutation === 'throw') assert.throws(f.economy, /controlled economy failure/); else f.economy();
    assert.equal(f.context.workerEconomyRouteScope, null);
    assert.equal(f.context.pendingMoveAssignmentsByUnit().size, mutation === 'throw' ? 1 : 0);
    assert.equal(u.cargo, 10); assert.equal(entries(f), QUOTA);
  }
});

test('idle XL economy is census-free; legacy route publication preserves its original bypass', () => {
  const idle = fixture({ total: QUOTA }); idle.actors[0].gatherPhase = ''; idle.economy();
  assert.equal(idle.censuses.length, 0); assert.equal(idle.context.workerEconomyRouteScope, null);
  for (const [width, height] of [[16, 17], [160, 160], [256, 256]]) {
    const f = fixture({ width, height }); f.economy();
    assert.equal(f.censuses.length, 0); assert.equal(f.actors[0].path.at(-1), f.raw.at(-1));
    assert.equal(f.actors[0].movePlanningPending, false); assert.equal(f.checkpointLeaf(), null);
  }
});
