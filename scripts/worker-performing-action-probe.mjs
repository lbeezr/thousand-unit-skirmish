// Dated current-wire probe, not a producer or an animation heuristic.
// Run before agreeing the explicit per-Worker performingAction contract.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { buildingRepairStep } from '../src/base-lifecycle.mjs';
import { headingToTarget } from '../src/unit-heading.mjs';
import { activeState } from '../src/unit-sprite-runtime.mjs';

const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const snapshots = source.slice(source.indexOf('function snapshotUnits('), source.indexOf('function aliveCounts('));
const economy = source.slice(source.indexOf('function updateWorkerEconomy('), source.indexOf('\nfunction ', source.indexOf('function updateWorkerEconomy(') + 1));
const buildingStart = source.indexOf('function updateBuildingAndProduction(');
const construction = source.slice(buildingStart, source.indexOf('\n  for (const building of buildings) {', buildingStart)) + '\n}\n';

function worker(id = 0) {
  return { id, team: 0, x: 0, z: 0, hp: 100, kind: 'worker', generation: 1,
    cargo: 0, cargoType: null, gatherPhase: '', gatherForestCell: -1, gatherNodeId: null,
    buildingTargetId: null, repairing: false, attackTargetId: -1, attackBuildingTargetId: -1,
    lastAttackTick: -1, holdingPosition: false, persistentOrder: null, path: [], pathIndex: 0,
    movePlanningPending: false, attackMove: false, orderRevision: 0, walking: false };
}

function fixture() {
  const unit = worker();
  const node = { id: 'berries', x: 0, z: 0, type: 'food', stock: 10 };
  const near = { id: 1, type: 'house', x: 0, z: 0, hp: 100, complete: false, progress: 0 };
  const far = { ...near, id: 2, x: 20 };
  const context = vm.createContext({ units: [unit], mapDefinition: { fogOfWar: false },
    BUILDING_DEFINITIONS, BUILDER_INTERACTION_RANGE: 1.4, WORKER_INTERACTION_RANGE: 1.4,
    WORKER_CARRY_CAPACITY: 10, GATHER_RATE: 2, STEP_SECONDS: 1 / 30,
    tickNumber: 3, STATE_EVERY_TICKS: 3, teamWood: [100, 100], dirty: false,
    buildingsById: new Map([[1, near], [2, far]]), resourceNodeStates: new Map([['berries', node]]),
    harvestNodeById: id => id === 'berries' ? node : null,
    cellVisibleToTeam: () => true, worldToCell: () => 0, cellToWorld: () => ({ x: 0, z: 0 }),
    headingToTarget, workerFishingPresentation: () => null,
    unitHasCapability: () => true, activateWildlifeHarvest: () => false,
    markWildlifeDepleted() {}, broadcastGameplayNotice() {}, flushPendingForestClears() {},
    updateWallBuildOrders() {}, buildingRepairStep,
    buildingRulesFor: type => BUILDING_DEFINITIONS[type],
    stopGathering(u) { u.gatherNodeId = null; u.gatherForestCell = -1; u.gatherPhase = ''; },
    routeWorker(u, phase) { u.gatherPhase = phase; }, workerAtDropoff: () => false,
  });
  vm.runInContext(snapshots + economy + construction, context);
  return { unit, node, near, far, context,
    row: () => Array.from(context.snapshotUnits(null)[0]),
    state: () => activeState({ ...unit, task: context.workerTaskStatus(unit) }, 1000),
    economy: () => context.updateWorkerEconomy(),
    construction: () => context.updateBuildingAndProduction() };
}

const checks = [];
function record(name, f, before, productive) {
  checks.push({ name, productive, cargoDelta: f.unit.cargo - before.cargo,
    progressDelta: f.near.progress - before.progress, hpDelta: f.near.hp - before.hp,
    task: f.row()[9], audioExecution: f.row()[14] ?? null, currentSpriteState: f.state() });
}
function baseline(f) { return { cargo: f.unit.cargo, progress: f.near.progress, hp: f.near.hp }; }

for (const [name, setup, productive] of [
  ['arrival', f => { f.unit.gatherPhase = 'to-node'; }, true],
  ['blocked-approach', f => { f.unit.gatherPhase = 'to-node'; f.node.x = 20; }, false],
  ['queued-task', f => { f.unit.gatherPhase = 'to-node'; f.unit.movePlanningPending = true; f.node.x = 20; }, false],
  ['retained-gather-phase-out-of-reach', f => { f.unit.gatherPhase = 'gathering'; f.node.x = 20; }, false],
  ['resource-depleted', f => { f.unit.gatherPhase = 'gathering'; f.node.stock = 0; }, false],
  ['capacity-full', f => { f.unit.gatherPhase = 'gathering'; f.unit.cargo = 10; f.unit.cargoType = 'food'; }, false],
]) {
  const f = fixture(); f.unit.gatherNodeId = 'berries'; setup(f);
  const before = baseline(f); f.economy();
  assert.equal(f.unit.cargo > before.cargo, productive, name);
  record(name, f, before, productive);
}

{
  const f = fixture(); f.unit.gatherNodeId = 'berries'; f.unit.gatherPhase = 'to-node';
  f.economy(); assert.ok(f.unit.cargo > 0);
  f.context.stopGathering(f.unit); const stopped = baseline(f); f.economy();
  assert.equal(f.unit.cargo, stopped.cargo); assert.equal(f.state(), 'idle');
  record('simulated-target-clear', f, stopped, false);
  f.unit.gatherNodeId = 'berries'; f.unit.gatherPhase = 'to-node';
  const resumed = baseline(f); f.economy(); assert.ok(f.unit.cargo > resumed.cargo);
  record('simulated-target-reassignment-arrival', f, resumed, true);
}

for (const [name, setup, productive] of [
  ['build-arrival', () => {}, true],
  ['build-wait', f => { f.unit.buildingTargetId = 2; }, false],
  ['repair-arrival', f => { f.unit.repairing = true; f.near.complete = true; }, true],
  ['repair-out-of-reach', f => { f.unit.repairing = true; f.near.complete = true; f.unit.x = 20; }, false],
  ['repair-no-wood', f => { f.unit.repairing = true; f.near.complete = true; f.context.teamWood[0] = 0; }, false],
]) {
  const f = fixture(); f.unit.buildingTargetId = 1; setup(f);
  const before = baseline(f); f.construction();
  assert.equal(f.near.progress > before.progress || f.near.hp > before.hp, productive, name);
  record(name, f, before, productive);
}

// Per-building progress cannot reveal which assigned Worker performed the work.
// Swapping assignments between overlapping Workers leaves all wire rows and
// resulting building progress identical, while swapping the actual performer.
function indistinguishableBuilds(swap) {
  const f = fixture(), second = worker(1); f.context.units.push(second);
  f.unit.buildingTargetId = swap ? 2 : 1; second.buildingTargetId = swap ? 1 : 2;
  f.construction();
  return { rows: Array.from(f.context.snapshotUnits(null), row => Array.from(row)),
    progress: [f.near.progress, f.far.progress], performer: swap ? 1 : 0 };
}
const first = indistinguishableBuilds(false), swapped = indistinguishableBuilds(true);
assert.deepEqual(first.rows, swapped.rows);
assert.deepEqual(first.progress, swapped.progress);
assert.notEqual(first.performer, swapped.performer);

// A productive repair dirties state, but the retained assignment does not do so
// after the available wood is exhausted. Clearing a future transient receipt
// must therefore also request delivery; otherwise the last positive can persist.
const exhaustedRepair = fixture();
exhaustedRepair.unit.buildingTargetId = 1;
exhaustedRepair.unit.repairing = true;
exhaustedRepair.near.complete = true;
exhaustedRepair.context.teamWood[0] = buildingRepairStep(exhaustedRepair.near, 100, 1 / 30).wood;
const productiveRepairHp = exhaustedRepair.near.hp;
exhaustedRepair.construction();
assert.ok(exhaustedRepair.near.hp > productiveRepairHp);
assert.equal(exhaustedRepair.context.teamWood[0], 0);
assert.equal(exhaustedRepair.context.dirty, true);
const repairExhaustionBroadcast = [];
for (const tick of [4, 5, 6]) {
  exhaustedRepair.context.tickNumber = tick;
  exhaustedRepair.context.dirty = false;
  const before = baseline(exhaustedRepair);
  exhaustedRepair.construction();
  assert.equal(exhaustedRepair.near.hp, before.hp);
  assert.equal(exhaustedRepair.context.dirty, false);
  repairExhaustionBroadcast.push({ tick, hpDelta: exhaustedRepair.near.hp - before.hp,
    task: exhaustedRepair.row()[9], dirty: exhaustedRepair.context.dirty });
}

const report = { scope: 'current-wire-authoritative-progress-probe',
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  checks, constructionAmbiguity: { rowsAndProgressIdentical: true, performers: [first.performer, swapped.performer] },
  repairExhaustionBroadcast,
  gap: 'Row 9 describes intent; row 14 lacks construction and can report gather outside reach. No per-Worker positive-progress receipt exists.',
  limits: ['actual server functions exercised in a deterministic VM; no network, GPU or deployed claim',
    'target clear/reassignment is simulated; actual Stop commands, order-revision invalidation and routes are not exercised',
    'dated diagnostic; not registered as a permanent CI assertion of incorrect presentation'] };
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
