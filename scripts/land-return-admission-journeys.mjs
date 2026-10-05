import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as movement from '../src/unit-movement.mjs';
import { shortcutFlatUnitPath, canTraverseFlatUnitSegment } from '../src/unit-path-line.mjs';
import { clearWorkIntent, clearGatherWorkIntent } from '../src/work-intent.mjs';
import { activeWallBuildOrder } from '../src/wall-build-order.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { creditResourceBalance } from '../src/economy-ledger.mjs';
import { preflightXlCheckpointRoutes, XL_CHECKPOINT_ROUTE_MAX_ENTRIES as QUOTA } from '../src/server/checkpoint-route-budget.mjs';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';

const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
function body(name) {
  const start = source.indexOf(`function ${name}(`), end = source.indexOf('\nfunction ', start + 1);
  assert.ok(start > 0 && end > start, name);
  return source.slice(start, end);
}
const names = ['workerFlowPath', 'applyWorkerFlowRoute', 'routeWorkerToDropoff', 'assignReturnCargo',
  'clearAttackMoveOrder', 'cancelGatherOrder', 'assignStationaryOrder', 'pendingMoveAssignmentsByUnit',
  'enqueueRouteRepairs', 'applyPlannedMoveAssignment', 'completeMovePlanningJob', 'processMovePlanningSlice',
  'scheduleNextMovePlanning', 'serviceMovePlanningForTick', 'workerAtDropoff', 'ensureGatherWorkIntent',
  'depositWorkerCargo', 'stopGathering', 'updateWorkerEconomy', 'advanceQueuedWaypoints'];
const phaseStart = source.indexOf('  const blockedRouteRepairs = [];');
const phaseEnd = source.indexOf('  advanceQueuedWaypoints();', phaseStart);
assert.ok(phaseStart > 0 && phaseEnd > phaseStart);
const physicalPhase = source.slice(phaseStart, phaseEnd + '  advanceQueuedWaypoints();'.length);
const restoreStart = source.indexOf('  const pendingRepairs = [];', source.indexOf('function restoreMatchCheckpoint('));
const restoreEnd = source.indexOf('  dirty = true;\n}', restoreStart);
assert.ok(restoreStart > 0 && restoreEnd > restoreStart);
const recoveryTail = source.slice(restoreStart, restoreEnd);
const savedEntries = f => f.units.reduce((sum, u) => sum + u.path.length + (u.attackMoveResumePath?.length ?? 0), 0)
  + [...f.nodes.values()].reduce((sum, n) => sum + (n.wildlifeHerd?.path.length ?? 0), 0);
const record = path => ({ hp: 0, kind: 'infantry', path, pathIndex: path.length,
  attackMoveResumePath: null, queuedWaypoints: [] });

// These XL fields are synthetic metadata pressure, not valid planner routes,
// complete native XL saves or ordinary320 admission. Production selection,
// command, queue, publication, recovery-tail, physical and deposit bodies run
// unchanged; selectors and A* are controlled, with real geometry contracts.
function fixture({ width = 320, height = 320, total = 0, count = 1, team = 0,
  weighted = false, oldLength = 0, resumeLength = 0, turns = 1 } = {}) {
  const cell = (x, z) => Math.floor(z + height / 2) * width + Math.floor(x + width / 2);
  const point = c => ({ x: c % width - width / 2 + .5, z: Math.floor(c / width) - height / 2 + .5 });
  const start = cell(.5, .5), raw = Array.from({ length: 5 }, (_, i) => start + i + 1);
  const longer = [...raw, raw.at(-1) + 1], levels = new Uint8Array(width * height);
  if (weighted) for (const c of raw.slice(2)) levels[c] = 1;
  const actors = Array.from({ length: count }, (_, id) => ({ ...record(Array(oldLength).fill(start)), id,
    hp: 35, generation: 9, orderRevision: 7, team, kind: 'worker', movementDomain: 'land', ...point(start),
    attackMoveResumePath: resumeLength ? Array(resumeLength).fill(start) : null,
    cargo: 10, cargoType: 'food', workIntent: null, moveGoalCell: -1, moveGoalPoint: null,
    movePlanningPending: false, attackMove: false, attackTargetId: -1, attackBuildingTargetId: -1,
    buildingTargetId: null, gatherPhase: '', gatherNodeId: null, gatherForestCell: -1 }));
  const units = [...actors], nodes = new Map();
  let remaining = total - count * (oldLength + resumeLength);
  while (remaining > 0) {
    const entries = Math.min(remaining, levels.length), unread = Array(entries);
    Object.defineProperty(unread, 0, { get() { throw new Error('no pressure payload scans'); } });
    units.push(record(unread)); remaining -= entries;
  }
  const fields = [
    { goal: longer.at(-1), goals: new Set([raw.at(-1), longer.at(-1)]), path: raw },
    { goal: longer.at(-1), goals: new Set([longer.at(-1)]), path: longer },
  ];
  const candidates = [{ id: 10, goals: [...fields[0].goals] }, { id: 11, goals: [...fields[1].goals] }];
  const notices = [], selections = [], callbacks = [], samples = [], searches = [];
  const context = vm.createContext({ ...movement, shortcutFlatUnitPath, canTraverseFlatUnitSegment,
    clearWorkIntent, clearGatherWorkIntent, activeWallBuildOrder, UNIT_DEFINITIONS, creditResourceBalance,
    MAP_WIDTH: width, MAP_HEIGHT: height, MAP_HALF_X: width / 2, MAP_HALF_Z: height / 2, CELL_COUNT: levels.length,
    MAX_UNITS: 2000, MAX_RESOURCE_NODES: 128, XL_CHECKPOINT_ROUTE_MAX_ENTRIES: QUOTA,
    units, resourceNodeStates: nodes, elevationLevelByCell: levels,
    worldToCell: cell, cellToWorld: point, isWalkable: c => c >= 0 && c < levels.length,
    WALK_SPEED: 4, STEP_SECONDS: 1 / 30, WORKER_INTERACTION_RANGE: 1.4,
    movePlanningEpoch: 0, navigationRevision: 4, dirty: false, automaticTargetRejections: new WeakMap(),
    commandUnits: command => command.ids.map(id => units[id]),
    unitHasCapability: (u, capability) => u.kind === 'worker' && capability === 'gather',
    militaryCombatant: () => false, economyResources: () => ['food', 'wood'], matchEconomyProfileId: () => 'classic',
    sendOrderNotice: (_p, _c, message) => notices.push(message),
    nearestOpenCell: c => c, walkableComponents: new Int32Array(levels.length), workerDropoffCandidates: () => candidates,
    getAttackFlowFieldForGoals: (_goals, key) => key.includes(':10:') ? fields[0] : fields[1],
    pathFromAttackFlow: (_start, field) => field.path.slice(),
    buildingsById: new Map([[10, { id: 10, team, complete: true, ...point(raw.at(-1)) }]]),
    acceptsProfileDropoff: () => true,
    distanceToBuildingEdge: (u, b) => Math.hypot(u.x - b.x, u.z - b.z),
    teamFood: [100, 100], teamWood: [100, 100], teamStone: [0, 0],
    activeMovePlanningJob: null, movePlanningQueue: [], nextMoveOrderId: 1, tickNumber: 0,
    MOVE_PLANNING_SLICE_BUDGET_MS: 5, MOVE_PLANNING_MAX_WORK_ITEMS_PER_SLICE: 8,
    MOVE_PLANNING_MAX_EXPANDED_CELLS_PER_SLICE: 4096, MOVE_PLANNING_TURNS_PER_TICK: turns,
    TICK_RATE: 30, ATTACK_MOVE_SCAN_INTERVAL_TICKS: 15, SHARED_MOVE_PATHS: true,
    pendingMoveStartBroadcasts: new Set(), movePlanningServiceTick: null,
    performance: { now: () => 0 }, setImmediate: callback => callbacks.push(callback),
    findPathAStar(from, destination, diagnostics) {
      searches.push(destination); diagnostics.searchCount++; diagnostics.expandedCells += 5;
      const path = [];
      for (let c = from; c < destination; c++) path.push(c + 1);
      return path;
    },
    recordMovePlanningSample: sample => samples.push(sample),
    console: { error(message, error) { throw new Error(message, { cause: error }); } },
    tickDiagnosticSamples: null, landRouteRetentionTick: null, workerEconomyRouteScope: null, automaticPositionAllowed: () => true,
    spreadInteractingUnits() {}, flushPendingForestClears() {},
    getMoveVector(u, distance) {
      const target = point(u.path[u.pathIndex]), dx = target.x - u.x, dz = target.z - u.z;
      const length = Math.hypot(dx, dz);
      return { target, x: dx / length, z: dz / length, stepDistance: Math.min(distance, length), reachedWaypoint: length <= distance };
    },
  });
  vm.runInContext(names.map(body).join('\n') + `\nfunction physicalPhase(){${physicalPhase}}\nfunction recoverPendingTail(){${recoveryTail}}`, context);
  const apply = context.applyWorkerFlowRoute;
  context.applyWorkerFlowRoute = (...args) => {
    const result = apply(...args);
    selections.push({ live: units[args[0].id] === args[0], selected: result.selectedGoalCell,
      rawLength: result.originalPathLength, cost: result.originalCost, reducedLength: result.path.length,
      saved: savedEntries({ units, nodes }) });
    return result;
  };
  const f = { actors, units, nodes, context, raw, fields, start, point, cell, levels, selections, notices, callbacks, samples, searches,
    order() { context.assignReturnCargo({ team }, { type: 'returnCargo', ids: actors.map(u => u.id) }); },
    drain() { let bound = 0; while (callbacks.length) { assert.ok(++bound <= 8, 'no capacity callback busy-loop'); callbacks.shift()(); } },
    tick() { const next = context.tickNumber + 1; context.serviceMovePlanningForTick(next); context.tickNumber = next; f.drain(); },
    release() { units.at(-1).path = []; },
    checkpointLeaf() {
      // The checkpoint leaf validates cell values; substitute readable copies
      // for census sentinels. This still asserts full stored field lengths.
      const readable = units.map(u => u.hp > 0 ? u : { ...u,
        path: Array(u.path.length).fill(start),
        attackMoveResumePath: u.attackMoveResumePath === null ? null : Array(u.attackMoveResumePath.length).fill(start) });
      return preflightXlCheckpointRoutes({ width, height }, { units: readable, resourceNodes: nodes },
        { maxUnits: 2000, maxResourceNodes: 128 });
    },
  };
  assert.equal(savedEntries(f), total);
  return f;
}

for (const [width, height] of [[320, 160], [160, 320], [320, 320]])
test(`land Return ${width}x${height}: quota edges preserve raw scoring, selected tail and weighted cost`, () => {
  for (const weighted of [false, true]) for (const free of [5, 1, 0]) {
    const f = fixture({ width, height, weighted, total: QUOTA - free }); f.order();
    const u = f.actors[0], fits = free >= (weighted ? 5 : 1), selection = f.selections[0];
    assert.equal(selection.live, false); assert.equal(selection.rawLength, 5);
    assert.equal(selection.selected, f.raw.at(-1)); assert.notEqual(selection.selected, f.fields[0].goal);
    assert.equal(selection.cost, movement.unitRoutePathCost(f.start, f.raw, width, f.levels));
    assert.equal(u.dropoffBuildingId, 10, 'raw five beats raw six before both flat routes reduce to one');
    assert.equal(u.moveGoalCell, f.raw.at(-1)); assert.equal(u.movePlanningPending, !fits);
    assert.deepEqual(Array.from(u.path), fits ? (weighted ? f.raw : [f.raw.at(-1)]) : []);
    assert.equal(u.gatherPhase, 'to-base'); assert.equal(u.cargo, 10); assert.equal(u.cargoType, 'food');
    assert.ok(savedEntries(f) <= QUOTA); assert.ok(f.checkpointLeaf());
    assert.equal(f.notices.some(n => n.includes('WAITING FOR ROUTE CAPACITY')), !fits);
  }
});

test('Return credits exactly the live active and cleared resume fields, including serialized aliases', () => {
  for (const alias of [false, true]) {
    const f = fixture({ total: QUOTA, oldLength: 3, resumeLength: 3 }), u = f.actors[0];
    if (alias) u.attackMoveResumePath = u.path;
    const shared = u.path, other = f.units.at(-1); other.attackMoveResumePath = shared;
    other.path = other.path.slice(3); // Add a retained alias without changing total.
    f.order(); assert.equal(savedEntries(f), QUOTA - 5);
    assert.equal(u.attackMoveResumePath, null); assert.equal(u.movePlanningPending, false);
    assert.equal(other.attackMoveResumePath, shared); assert.deepEqual(Array.from(u.path), [f.raw.at(-1)]);
    assert.ok(f.checkpointLeaf());
  }
});

test('shared ledger keeps active-only replacement by default and requires explicit cleared-resume credit', () => {
  const f = fixture({ total: QUOTA, resumeLength: 3 }), u = f.actors[0];
  const ledger = movement.createUnitRoutePublicationLedger(320, 320, f.units, f.nodes,
    { maxUnits: 2000, maxResourceNodes: 128, maxEntries: QUOTA });
  assert.equal(ledger.check(u, 1).reason, 'aggregate-entry-limit');
  assert.equal(ledger.check(u, 1, { clearResume: true }).prospectiveEntries, QUOTA - 2);
  assert.equal(ledger.commit(u, 1, { clearResume: true }).status, 'ready');
  u.path = [f.raw.at(-1)]; u.attackMoveResumePath = null;
  assert.equal(ledger.check(u, 2).prospectiveEntries, QUOTA - 1);
  assert.equal(savedEntries(f), QUOTA - 2);
});

test('XL streams each selected clone before selecting the next actor and shares actual saved capacity', () => {
  const f = fixture({ total: QUOTA - 1, count: 24 }); f.order();
  assert.equal(f.selections.length, 24); assert.ok(f.selections.every(s => !s.live && s.saved <= QUOTA));
  assert.equal(f.selections[0].saved, QUOTA - 1); assert.equal(f.selections[1].saved, QUOTA);
  assert.equal(f.actors.filter(u => u.path.length).length, 1);
  assert.equal(f.actors.filter(u => u.movePlanningPending).length, 23);
  assert.equal(savedEntries(f), QUOTA); assert.ok(f.checkpointLeaf());
  const jobs = [...f.context.movePlanningQueue, ...(f.context.activeMovePlanningJob ? [f.context.activeMovePlanningJob] : [])];
  assert.equal(jobs.flatMap(j => j.assignments).length, 23);
  assert.ok(jobs.flatMap(j => j.assignments).every(a => a.path.length === 0), 'no selected payload retained in waiting jobs');
});

test('per-path N+1 reduction/prefix result defers before linking any selected payload', () => {
  const f = fixture(), u = f.actors[0], apply = f.context.applyWorkerFlowRoute;
  f.context.applyWorkerFlowRoute = (...args) => {
    const result = apply(...args), rejected = Array(f.levels.length + 1);
    Object.defineProperty(rejected, Symbol.iterator, { value() { throw new Error('no refused payload copy'); } });
    args[0].path = rejected;
    return result;
  };
  f.order(); assert.equal(u.path.length, 0); assert.equal(u.moveGoalCell, f.raw.at(-1));
  assert.equal(u.movePlanningPending, true); assert.equal(u.cargo, 10);
  assert.ok(f.checkpointLeaf());
});

for (const team of [0, 1]) for (const turns of [0, 1])
test(`seat ${team}, scheduler ${turns}: capacity refusal/retry/cold recovery conserves cargo and guards queued travel`, () => {
  let f = fixture({ team, turns, total: QUOTA }), u = f.actors[0]; f.order(); f.drain();
  const goal = u.moveGoalCell, revision = u.orderRevision;
  u.queuedWaypoints.push({ destination: goal + 2, attackMove: false, point: null });
  f.context.updateWorkerEconomy(); f.context.physicalPhase();
  assert.equal(u.x, .5); assert.equal(u.cargo, 10); assert.equal(f.context.teamFood[team], 100);
  assert.equal(u.queuedWaypoints.length, 1); assert.equal(u.moveGoalCell, goal);
  for (let tick = 0; tick < 3; tick++) f.tick();
  assert.equal(u.movePlanningPending, true); assert.equal(u.orderRevision, revision);
  assert.equal(f.callbacks.length, 0); assert.equal(f.notices.filter(n => n.includes('WAITING')).length, 1);
  const savedActor = JSON.parse(JSON.stringify(u));
  f = fixture({ team, turns, total: QUOTA }); u = f.actors[0]; Object.assign(u, savedActor);
  f.context.recoverPendingTail(); f.drain();
  assert.equal(u.moveGoalCell, goal); assert.equal(u.gatherPhase, 'to-base'); assert.equal(u.cargo, 10);
  assert.equal(u.queuedWaypoints.length, 1); assert.equal(u.movePlanningPending, true);
  f.release(); f.tick();
  assert.equal(u.movePlanningPending, false); assert.equal(u.path.at(-1), goal);
  assert.equal(u.dropoffBuildingId, 10); assert.equal(u.cargo, 10); assert.ok(f.checkpointLeaf());
  for (let tick = 0; tick < 100 && u.cargo > 0; tick++) {
    const before = { x: u.x, z: u.z };
    f.context.physicalPhase(); f.context.updateWorkerEconomy();
    assert.ok(movement.canTraverseStaticBodySegment(before, u, .18, 320, 320, f.context.isWalkable, { allowEscape: true }));
    assert.equal(u.cargo + f.context.teamFood[team], 110);
  }
  assert.equal(u.cargo, 0); assert.equal(f.context.teamFood[team], 110); assert.equal(u.gatherPhase, '');
  assert.equal(u.queuedWaypoints.length, 1, 'delivery finishes before later waypoint promotion');
  f.context.advanceQueuedWaypoints(); f.tick();
  assert.equal(u.moveGoalCell, goal + 2); assert.equal(u.queuedWaypoints.length, 0);
  assert.equal(f.context.teamFood[1 - team], 100); assert.ok(f.checkpointLeaf());
});

test('Stop, Hold, dead/recycled actors and match replacement supersede deferred Return without stale publication', () => {
  for (const cancel of ['stop', 'holdPosition', 'dead', 'recycled', 'epoch']) {
    const f = fixture({ total: QUOTA }), u = f.actors[0]; f.order(); f.tick();
    if (cancel === 'stop' || cancel === 'holdPosition') {
      f.context.assignStationaryOrder({ team: 0 }, { type: cancel, ids: [0] });
    } else if (cancel === 'dead') u.hp = 0;
    else if (cancel === 'recycled') f.units[0] = { ...u, generation: 10, path: [f.start], movePlanningPending: false };
    else f.context.movePlanningEpoch++;
    const before = JSON.stringify(f.units[0]); f.release(); f.tick(); f.drain();
    assert.equal(JSON.stringify(f.units[0]), before, cancel); assert.equal(u.cargo, 10);
    assert.equal(f.context.teamFood[0], 100); assert.ok(f.checkpointLeaf());
  }
});

test('unreachable Return leaves old work/order/cargo intact and legacy dimensions keep bulk publication', () => {
  const unreachable = fixture({ oldLength: 3, total: 3 }), u = unreachable.actors[0];
  unreachable.context.getAttackFlowFieldForGoals = () => null;
  const before = JSON.stringify(u); unreachable.order(); assert.equal(JSON.stringify(u), before);
  assert.match(unreachable.notices[0], /REJECTED/);
  for (const [width, height] of [[16, 17], [160, 160], [256, 256]]) {
    const f = fixture({ width, height, count: 2 }); f.order();
    assert.ok(f.selections.every(s => s.saved === 0), 'legacy selects all clones before copying');
    assert.equal(f.actors.every(a => !a.movePlanningPending && a.path.length === 1), true);
    assert.equal(f.checkpointLeaf(), null);
  }
});

process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp'; process.env.RTS_PREGAME = '0';
delete process.env.RTS_MATCH_STATE_PATH;
for (const team of [0, 1]) test(`seat ${team}: genuine land Return, full cold checkpoint and queued fractional arrival conserve finite Food`, async () => {
  const map = { id: 'land-return-admission', name: 'LAND RETURN ADMISSION', width: 160, height: 160,
    fogOfWar: false, startingArmySize: 8, startingResources: { food: 100, wood: 100 },
    spawnPoints: [{ team: 0, x: -32, z: -24 }, { team: 1, x: 32, z: 24 }],
    resourceNodes: [{ id: 'food', type: 'food', x: 13.5, z: 11.5, stock: 24 }], obstacles: [], triggers: [], scenarioEvents: [] };
  let f = await createPathingReplayFixture(map, { traceLandSteps: true }), r = f.replay;
  try {
    let u = r.units.find(a => a.kind === 'worker' && a.team === team);
    r.order(team, { type: 'gather', ids: [u.id], unitGenerations: [u.generation], nodeId: 'food' }); r.drain();
    for (let tick = 0; tick < 2000 && u.cargo < 1; tick++) r.step();
    assert.ok(u.cargo >= 1); r.order(team, { type: 'stop', ids: [u.id], unitGenerations: [u.generation] });
    const cargo = u.cargo, id = u.id;
    const notices = r.order(team, { type: 'returnCargo', ids: [id], unitGenerations: [u.generation] });
    assert.ok(notices.some(n => /RETURN CARGO ORDER/.test(n.message)));
    r.order(team, { type: 'move', queue: true, ids: [id], unitGenerations: [u.generation], x: .25, z: -.25 });
    const saved = r.checkpoint(); assert.ok(r.validate(saved));
    await f.dispose(); f = await createPathingReplayFixture(map, { traceLandSteps: true }); r = f.replay;
    r.restore(saved); u = r.units[id];
    assert.equal(u.cargo, cargo); assert.equal(u.gatherPhase, 'to-base'); assert.equal(u.queuedWaypoints.length, 1);
    let delivered = false;
    for (let tick = 0; tick < 2500; tick++) {
      r.step();
      for (const s of r.landSteps.filter(s => s.id === id))
        assert.ok(movement.canTraverseStaticBodySegment(s.from, s.to, .18, 160, 160, r.isWalkable, { allowEscape: true }));
      assert.ok(Math.abs(r.resources.get('food').stock + u.cargo + r.food[team] - 100 - 24) < 1e-7);
      if (u.cargo === 0) delivered = true;
      if (delivered && u.queuedWaypoints.length === 0 && !u.movePlanningPending && u.pathIndex === u.path.length) break;
    }
    assert.ok(delivered); assert.ok(Math.abs(r.food[team] - 100 - cargo) < 1e-8);
    assert.ok(Math.hypot(u.x - .25, u.z + .25) < .02); assert.equal(r.food[1 - team], 100);
  } finally { await f.dispose(); }
});
