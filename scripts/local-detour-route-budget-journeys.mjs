import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createUnitRoutePublicationLedger, activeLandMovementBodyRadius, canTraverseUnitStep,
  canTraverseStaticBodySegment, createClearanceMoveGoalPoint } from '../src/unit-movement.mjs';
import { findStationaryWorkerDetour } from '../src/unit-obstacle-detour.mjs';
import { XL_CHECKPOINT_ROUTE_MAX_ENTRIES as QUOTA } from '../src/server/checkpoint-route-budget.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { clearWorkIntent } from '../src/work-intent.mjs';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';

const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const start = source.indexOf('  const blockedRouteRepairs = [];');
const endMarker = '  advanceQueuedWaypoints();';
const end = source.indexOf(endMarker, start);
assert.ok(start > 0 && end > start, 'production land physical phase boundaries');
const phase = source.slice(start, end + endMarker.length);
function body(name) {
  const from = source.indexOf(`function ${name}(`), to = source.indexOf('\nfunction ', from + 1);
  assert.ok(from > 0 && to > from, name);
  return source.slice(from, to);
}
const record = path => ({ hp: 0, kind: 'infantry', path, pathIndex: path.length,
  attackMoveResumePath: null, queuedWaypoints: [] });

// Metadata pressure is synthetic. The real local 5x5 proposal and production
// physical/queue bodies are consumed; this is not an admitted XL map/checkpoint.
function fixture({ width = 320, height = 320, total = 0, diagnostics = true } = {}) {
  const cell = (x, z) => Math.floor(z + height / 2) * width + Math.floor(x + width / 2);
  const point = c => ({ x: c % width - width / 2 + .5, z: Math.floor(c / width) - height / 2 + .5 });
  const levels = new Uint8Array(width * height), blocked = new Set();
  const isWalkable = c => c >= 0 && c < levels.length && !blocked.has(c);
  const path = [cell(-.5, -.5), cell(.5, -.5), cell(1.5, -.5)];
  const actor = { ...record(path), id: 0, hp: 100, team: 0, generation: 9, orderRevision: 7,
    kind: 'infantry', movementDomain: 'land', x: -.6, z: -.5, pathIndex: 0,
    moveGoalCell: path.at(-1), moveGoalPoint: null, movePlanningPending: false,
    attackTargetId: -1, attackBuildingTargetId: -1, holdingPosition: false,
    attackMove: false, persistentOrder: null, stanceCombat: false, stanceReturning: false,
    combatStance: 'noAttack', gatherPhase: '', gatherNodeId: null, gatherForestCell: -1,
    buildingTargetId: null, lastMoveTick: 0,
    queuedWaypoints: [{ destination: cell(2.5, -.5), attackMove: false,
      point: { requestedX: 2.25, requestedZ: -.25 } }] };
  const blocker = { ...record([]), id: 1, hp: 100, team: 0, kind: 'worker', x: -.5, z: -.5,
    holdingPosition: true, attackTargetId: -1, attackBuildingTargetId: -1 };
  const units = [actor, blocker], nodes = new Map();
  let remaining = total - actor.path.length, censusCalls = 0, proposals = 0;
  while (remaining > 0) {
    const entries = Math.min(remaining, levels.length);
    const unread = Array(entries);
    Object.defineProperty(unread, 0, { get() { throw new Error('census must not scan stored cells'); } });
    units.push(record(unread)); remaining -= entries;
  }
  const proposal = u => findStationaryWorkerDetour(u, blocker, width, levels, isWalkable, point, cell);
  const context = vm.createContext({ units, resourceNodeStates: nodes, UNIT_DEFINITIONS,
    MAP_WIDTH: width, MAP_HEIGHT: height, MAP_HALF_X: width / 2, MAP_HALF_Z: height / 2,
    MAX_UNITS: 2000, MAX_RESOURCE_NODES: 128, XL_CHECKPOINT_ROUTE_MAX_ENTRIES: QUOTA,
    tickDiagnosticSamples: diagnostics ? [] : null, landRouteRetentionTick: null,
    createUnitRoutePublicationLedger(...args) { censusCalls++; return createUnitRoutePublicationLedger(...args); },
    activeLandMovementBodyRadius, canTraverseUnitStep, canTraverseStaticBodySegment,
    STEP_SECONDS: 1 / 30, elevationLevelByCell: levels, worldToCell: cell, cellToWorld: point, isWalkable,
    tickNumber: 1, dirty: false, automaticPositionAllowed: () => true,
    enqueueRouteRepairs(repairs) { assert.equal(repairs.length, 0, 'capacity refusal must not enqueue a route repair'); },
    spreadInteractingUnits() {},
    getMoveVector(u, _distance, allowDetour) {
      if (!allowDetour || u !== actor) return null;
      proposals++; const detour = proposal(u); return detour ? { detour } : null;
    },
  });
  vm.runInContext(body('advanceQueuedWaypoints'), context);
  vm.runInContext(`function physicalPhase(){${phase}}`, context);
  return { actor, blocker, units, nodes, levels, blocked, point, cell, context, proposal,
    phase() { context.landRouteRetentionTick = null; context.physicalPhase(); context.tickNumber++; },
    get censusCalls() { return censusCalls; }, get proposals() { return proposals; } };
}
function protectCopies(f) {
  const path = f.actor.path;
  Object.defineProperty(path, 'slice', { value() { throw new Error('refusal must precede execution copy'); } });
  const detour = f.proposal(f.actor);
  assert.equal(detour.path.length - detour.replaceCount, 1, 'real local proposal grows by one');
  Object.defineProperty(detour.path, Symbol.iterator, { value() { throw new Error('refusal must not spread proposal'); } });
  f.context.getMoveVector = () => ({ detour });
}

test('local detour quota−1/quota/quota+1 admission precedes execution copying and preserves accepted travel', () => {
  for (const delta of [-1, 0, 1]) {
    const f = fixture({ total: QUOTA + delta }), previous = f.actor.path;
    const before = JSON.stringify(f.actor), parked = JSON.stringify(f.blocker);
    if (delta >= 0) protectCopies(f);
    f.phase();
    assert.equal(f.censusCalls, 1);
    assert.equal(JSON.stringify(f.blocker), parked);
    const report = f.context.landRouteRetentionTick;
    assert.equal(report.attempts, 1); assert.equal(report.fieldVisits, f.units.length);
    if (delta < 0) {
      assert.notEqual(f.actor.path, previous);
      assert.deepEqual(previous, [f.cell(-.5, -.5), f.cell(.5, -.5), f.cell(1.5, -.5)]);
      assert.equal(f.actor.path.at(-1), f.actor.moveGoalCell);
      assert.equal(report.published, 1); assert.equal(report.maxSavedEntries, QUOTA);
      assert.equal(report.maxStagedEntries, f.actor.path.length + 3 + 2);
    } else {
      assert.equal(f.actor.path, previous); assert.equal(JSON.stringify(f.actor), before);
      assert.equal(f.context.dirty, false); assert.equal(report.deferred, 1);
      assert.equal(report.aggregateLimitDeferrals, 1); assert.equal(report.maxStagedEntries, 0);
    }
  }
});

test('local detour path-entry admission counts consumed prefix and refuses N+1 growth on rectangular/square XL grids', () => {
  for (const [width, height] of [[320, 160], [160, 320], [320, 320]]) {
    for (const delta of [-1, 0]) {
      const f = fixture({ width, height }), original = f.actor.path;
      f.actor.path = Array(width * height + delta - 3).fill(original[0]).concat(original);
      f.actor.pathIndex = f.actor.path.length - 3;
      const old = f.actor.path, index = f.actor.pathIndex, queued = f.actor.queuedWaypoints;
      if (delta === 0) protectCopies(f);
      f.phase();
      assert.equal(f.actor.pathIndex, index); assert.equal(f.actor.queuedWaypoints, queued);
      assert.equal(f.actor.moveGoalCell, original.at(-1));
      if (delta < 0) {
        assert.equal(f.actor.path.length, width * height); assert.notEqual(f.actor.path, old);
        assert.deepEqual(f.actor.path.slice(0, index), old.slice(0, index));
        assert.equal(f.context.landRouteRetentionTick.published, 1);
      } else {
        assert.equal(f.actor.path, old); assert.equal(f.context.landRouteRetentionTick.pathLimitDeferrals, 1);
        assert.equal(f.context.landRouteRetentionTick.maxStagedEntries, 0);
      }
    }
  }
});

test('aliases/resume/herd fields remain charged; actual release admits the same route on the next phase without saved retry state', () => {
  const f = fixture(), shared = Array(65536);
  Object.defineProperty(shared, 0, { get() { throw new Error('no alias payload scan'); } });
  for (let i = 0; i < 5; i++) f.units.push({ ...record(shared), attackMoveResumePath: shared });
  for (let i = 0; i < 6; i++) f.nodes.set(i, { wildlifeHerd: { path: i === 5 ? Array(65533) : shared } });
  const before = JSON.stringify(f.actor), path = f.actor.path, queued = f.actor.queuedWaypoints;
  f.phase(); assert.equal(f.actor.path, path); assert.equal(JSON.stringify(f.actor), before);
  assert.equal(f.context.landRouteRetentionTick.maxSavedEntries, QUOTA);
  f.units[2].path = []; // Release one actual saved field, retaining its aliases.
  f.phase();
  assert.notEqual(f.actor.path, path); assert.equal(f.actor.path.at(-1), f.actor.moveGoalCell);
  assert.equal(f.actor.queuedWaypoints, queued); assert.equal(f.actor.orderRevision, 7);
  assert.equal(f.units[2].attackMoveResumePath, shared); assert.equal(f.units[3].path, shared);
  assert.equal(f.nodes.get(0).wildlifeHerd.path, shared);
  assert.equal(f.context.landRouteRetentionTick.published, 1); assert.equal(f.censusCalls, 2);
  assert.equal(f.context.landRouteRetentionTick.fieldVisits, 18);
  assert.equal(Object.keys(f.actor).some(key => /budget|defer|retry/i.test(key)), false);
});

test('one synchronous phase charges every published assignee and uses one bounded metadata census', () => {
  const f = fixture({ total: QUOTA - 1 }), shared = f.actor.path;
  const second = { ...f.actor, id: f.units.length, path: shared, queuedWaypoints: [] };
  f.units.push(second);
  f.units[2].path.length -= shared.length;
  f.context.getMoveVector = (u, _distance, allowDetour) => {
    if (!allowDetour || (u !== f.actor && u !== second)) return null;
    const detour = f.proposal(u); return detour ? { detour } : null;
  };
  f.phase();
  assert.equal(f.censusCalls, 1); assert.notEqual(f.actor.path, shared); assert.equal(second.path, shared);
  assert.deepEqual(shared, [f.cell(-.5, -.5), f.cell(.5, -.5), f.cell(1.5, -.5)]);
  assert.equal(f.context.landRouteRetentionTick.attempts, 2);
  assert.equal(f.context.landRouteRetentionTick.published, 1); assert.equal(f.context.landRouteRetentionTick.deferred, 1);
  assert.equal(f.context.landRouteRetentionTick.maxSavedEntries, QUOTA);
});

test('a same-phase route clear conservatively releases capacity at the next census and retains the later actor', () => {
  const f = fixture({ total: QUOTA }), clearing = { ...f.actor, id: 88, x: -5.5,
    path: [f.cell(-4.5, -.5)], queuedWaypoints: [], attackTargetId: 1 };
  f.units.unshift(clearing); f.units[3].path.length--;
  f.blocked.add(clearing.path[0]);
  f.context.getMoveVector = (u, _distance, allowDetour) => {
    if (u === clearing) return { target: f.point(clearing.path[0]), reachedWaypoint: true, stepDistance: .1 };
    if (u !== f.actor || !allowDetour) return null;
    const detour = f.proposal(u); return detour ? { detour } : null;
  };
  const old = f.actor.path; f.phase();
  assert.equal(clearing.path.length, 0); assert.equal(f.actor.path, old);
  assert.equal(f.context.landRouteRetentionTick.aggregateLimitDeferrals, 1);
  f.phase(); assert.notEqual(f.actor.path, old); assert.equal(f.context.landRouteRetentionTick.published, 1);
});

test('capacity refusal keeps all land-domain intents, active points and queued objectives unchanged', () => {
  for (const intent of [
    {}, { persistentOrder: { type: 'follow', targetId: 1, targetGeneration: 1 } },
    { attackMove: true, persistentOrder: { type: 'patrol', start: 1, end: 2, leg: 1 } },
    { attackMove: true }, { attackTargetId: 1 }, { attackBuildingTargetId: 1 }, { stanceReturning: true },
    ...['to-node', 'to-base', 'return-to-node'].map(gatherPhase => ({ kind: 'worker', gatherNodeId: 'food', gatherPhase })),
    { kind: 'worker', buildingTargetId: 3 }, { kind: 'worker', buildingTargetId: 3, repairing: true },
  ]) {
    const f = fixture({ total: QUOTA }); Object.assign(f.actor, intent);
    f.actor.moveGoalPoint = createClearanceMoveGoalPoint(f.actor, 1.25, -.25, f.actor.moveGoalCell, 320, 320, () => true);
    const before = JSON.stringify(f.actor), old = f.actor.path, point = f.actor.moveGoalPoint, queue = f.actor.queuedWaypoints;
    f.phase(); assert.equal(JSON.stringify(f.actor), before);
    assert.equal(f.actor.path, old); assert.equal(f.actor.moveGoalPoint, point); assert.equal(f.actor.queuedWaypoints, queue);
    assert.equal(f.context.landRouteRetentionTick.deferred, 1);
  }
});

test('maximum actor/node census stays at 4128 visits and opt-out diagnostics leave movement decisions identical', () => {
  const f = fixture({ total: QUOTA });
  while (f.units.length < 2000) f.units.push(record([]));
  for (const u of f.units) u.attackMoveResumePath = [];
  for (let i = 0; i < 128; i++) f.nodes.set(i, { wildlifeHerd: { path: [] } });
  f.phase(); assert.equal(f.context.landRouteRetentionTick.fieldVisits, 4128); assert.equal(f.censusCalls, 1);
  for (const total of [QUOTA - 1, QUOTA]) {
    const on = fixture({ total }), off = fixture({ total, diagnostics: false });
    on.phase(); off.phase(); assert.equal(JSON.stringify(on.actor), JSON.stringify(off.actor));
    assert.equal(off.context.landRouteRetentionTick, null);
  }
});

test('invalid saved envelope refuses before local execution copy instead of dropping accepted intent', () => {
  const f = fixture(); f.units.push({ ...record([]), attackMoveResumePath: undefined });
  protectCopies(f); const old = f.actor.path, before = JSON.stringify(f.actor);
  f.phase(); assert.equal(f.actor.path, old); assert.equal(JSON.stringify(f.actor), before);
  assert.equal(f.context.landRouteRetentionTick.invalidEnvelopeDeferrals, 1);
  assert.equal(f.context.landRouteRetentionTick.maxStagedEntries, 0);
});

test('actual Stop/Hold cancels a refused detour; Stop of another actor releases capacity for existing travel', () => {
  for (const type of ['stop', 'holdPosition', 'release-other']) {
    const f = fixture({ total: QUOTA });
    const other = f.units[2]; Object.assign(other, { id: 2, team: 0, hp: 100, holdingPosition: true });
    Object.assign(f.context, { clearWorkIntent, automaticTargetRejections: new WeakMap(),
      militaryCombatant: u => u.kind !== 'worker', sendOrderNotice() {},
      commandUnits: command => command.ids.map(id => f.units[id]) });
    vm.runInContext(['cancelGatherOrder', 'clearAttackMoveOrder', 'assignStationaryOrder'].map(body).join('\n'), f.context);
    f.phase(); assert.equal(f.context.landRouteRetentionTick.deferred, 1);
    const old = f.actor.path;
    f.context.assignStationaryOrder({ team: 0 }, { type: type === 'release-other' ? 'stop' : type,
      ids: [type === 'release-other' ? 2 : 0] });
    const cancelled = JSON.stringify(f.actor); f.phase();
    if (type === 'release-other') {
      assert.notEqual(f.actor.path, old); assert.equal(f.context.landRouteRetentionTick.published, 1);
      assert.equal(f.actor.orderRevision, 7); assert.equal(f.actor.queuedWaypoints.length, 1);
    } else {
      assert.equal(JSON.stringify(f.actor), cancelled); assert.equal(f.actor.orderRevision, 8);
      assert.equal(f.actor.moveGoalCell, -1); assert.equal(f.actor.queuedWaypoints.length, 0);
      assert.equal(f.context.landRouteRetentionTick.attempts, 0);
    }
  }
});

test('existing whole-tick diagnostic exposes bounded scalar retention outcomes and drops them on early return', () => {
  const f = fixture({ total: QUOTA }), samples = []; let clock = 0;
  Object.assign(f.context, { performance: { now: () => ++clock }, process: { cpuUsage: () => ({ user: 0, system: 0 }) },
    lastSimulationTickStartedAt: null, TICK_RATE: 30, recordTickStartLag() {}, serviceMovePlanningForTick() {},
    simulateTick: () => f.phase(), workerPerformingActions: { finishStep: () => false, beginStep() {} },
    compatibleWorkerPerformingAction() {}, visionMasksUpdatedTick: 0, recordSeparationWorkSample() {},
    takeMoveStartBroadcastRequest: () => false, STATE_EVERY_TICKS: 100, MATCH_CHECKPOINT_INTERVAL_TICKS: 100,
    recordTickDuration(_duration, diagnostic) { samples.push(diagnostic); },
    simulationDeadlineMs: 1000, TICK_INTERVAL_MS: 1000 / 30,
    advanceTickDeadline: () => ({ skippedTickSlots: 0, nextDeadlineMs: 1000 }), scheduleSimulationTick() {},
  });
  vm.runInContext(body('runSimulationTick'), f.context); f.context.runSimulationTick();
  const first = samples[0].landRouteRetention;
  assert.equal(first.deferred, 1); assert.equal(first.maxStagedEntries, 0);
  assert.ok(Object.values(first).every(Number.isSafeInteger), 'no route/unit references in the diagnostic');
  f.units[2].path = []; f.context.runSimulationTick();
  assert.equal(samples[1].landRouteRetention.published, 1); assert.equal(first.published, 0);
  Object.assign(f.context, { SEPARATION_DIAGNOSTICS_ENABLED: false, pregame: { phase: 'lobby' } });
  vm.runInContext(body('simulateTick'), f.context); f.context.runSimulationTick();
  assert.equal(f.context.landRouteRetentionTick, null);
  assert.equal(samples[2].landRouteRetention, undefined);
});

test('legacy grids retain the same local proposal without reading saved-route payloads or diagnostics', () => {
  for (const [width, height] of [[16, 17], [160, 160], [256, 256]]) {
    const f = fixture({ width, height });
    const unread = Array(width * height + 1); Object.defineProperty(unread, 0, { get() { throw new Error('legacy route census'); } });
    f.units.push(record(unread));
    const proposal = f.proposal(f.actor), before = f.actor.path;
    f.phase();
    assert.deepEqual(f.actor.path, proposal.path.concat(before.slice(proposal.replaceCount)));
    assert.equal(f.context.landRouteRetentionTick, null);
  }
});

process.env.RTS_MAP = 'maps/open-field.json';
process.env.RTS_GAME_MODE = 'pvp';
process.env.RTS_PREGAME = '0';
process.env.RTS_TICK_DIAGNOSTICS = '1';
delete process.env.RTS_MATCH_STATE_PATH;
for (const [width, height] of [[16, 17], [160, 160], [256, 256]]) for (const team of [0, 1]) {
  test(`${width}x${height}, seat ${team}: actual parked-Worker detour retains queued fractional travel through cold recovery`, async () => {
    const map = { id: `detour-${width}-${height}`, name: 'DETOUR COMPATIBILITY', width, height,
      terrainSeed: 881, fogOfWar: false, startingArmySize: 12,
      spawnPoints: [{ team: 0, x: -5.5, z: -5.5 }, { team: 1, x: 5.5, z: 5.5 }],
      resourceNodes: [], obstacles: [], triggers: [], scenarioEvents: [] };
    const original = await createPathingReplayFixture(map, { traceLandSteps: true });
    let recovered;
    try {
      const r = original.replay;
      for (const seat of [0, 1]) r.order(seat, { type: 'stop', ids: r.units.filter(u => u.team === seat).map(u => u.id) });
      const actor = r.units.find(u => u.team === team && u.kind === 'infantry');
      const blocker = r.units.find(u => u.team === team && u.kind === 'worker');
      // Arrange clear native poses; route/queue acceptance and execution are real.
      actor.x = -.6; actor.z = -.5; blocker.x = -.5; blocker.z = -.5;
      r.order(team, { type: 'holdPosition', ids: [blocker.id], unitGenerations: [blocker.generation] });
      const parked = { x: blocker.x, z: blocker.z, revision: blocker.orderRevision };
      const order = extra => r.order(team, { type: 'move', ids: [actor.id], unitGenerations: [actor.generation], ...extra });
      order({ x: 1.25, z: -.25 }); r.drain();
      const selected = actor.path, tail = selected.at(-1), goal = actor.moveGoalCell;
      order({ queue: true, x: 2.25, z: -1.25 });
      const queued = structuredClone(actor.queuedWaypoints[0]), revision = actor.orderRevision;
      r.step();
      assert.equal(r.diagnostic.landRouteRetention, undefined, 'legacy ticks omit XL retention diagnostics');
      assert.notEqual(actor.path, selected, 'real executor publishes a copied local detour');
      assert.equal(actor.path.at(-1), tail); assert.equal(actor.moveGoalCell, goal);
      assert.equal(actor.orderRevision, revision); assert.deepEqual(actor.queuedWaypoints[0], queued);
      assert.deepEqual({ x: blocker.x, z: blocker.z, revision: blocker.orderRevision }, parked);
      const saved = JSON.parse(JSON.stringify(r.checkpoint())); assert.ok(r.validate(saved));
      recovered = await createPathingReplayFixture(map, { traceLandSteps: true });
      recovered.replay.restore(saved);
      const next = recovered.replay, current = next.units[actor.id]; let arrivedFirst = false;
      for (let tick = 0; tick < 600; tick++) {
        next.step();
        for (const step of next.landSteps.filter(s => s.id === actor.id)) {
          assert.ok(canTraverseStaticBodySegment(step.from, step.to, .22, width, height, next.isWalkable, { allowEscape: true }));
          assert.ok(canTraverseUnitStep(next.cell(step.from.x, step.from.z), next.cell(step.to.x, step.to.z), width, next.levels, next.isWalkable));
        }
        if (Math.hypot(current.x - 1.25, current.z + .25) < .02) arrivedFirst = true;
        if (!current.movePlanningPending && current.queuedWaypoints.length === 0 && current.pathIndex === current.path.length) break;
      }
      assert.ok(arrivedFirst); assert.equal(current.moveGoalCell, queued.destination);
      assert.equal(current.queuedWaypoints.length, 0); assert.equal(current.pathIndex, current.path.length);
      assert.ok(Math.hypot(current.x - 2.25, current.z + 1.25) < .02);
      const restoredBlocker = next.units[blocker.id];
      assert.deepEqual({ x: restoredBlocker.x, z: restoredBlocker.z, revision: restoredBlocker.orderRevision }, parked);
    } finally { await recovered?.dispose(); await original.dispose(); }
  });
}
