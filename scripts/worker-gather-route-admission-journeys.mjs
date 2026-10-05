import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { workerRouteAdmissionFixture } from './worker-economy-route-admission-journeys.mjs';
import { unitRoutePathCost } from '../src/unit-movement.mjs';
import * as gatherArea from '../src/gather-work-area.mjs';
import { XL_CHECKPOINT_ROUTE_MAX_ENTRIES as QUOTA } from '../src/server/checkpoint-route-budget.mjs';

const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
function body(name) {
  const start = source.indexOf(`function ${name}(`), end = source.indexOf('\nfunction ', start + 1);
  assert.ok(start > 0 && end > start, name); return source.slice(start, end);
}
const dispatchSource = process.env.WORKER_GATHER_DISPATCH_SOURCE
  ? readFileSync(process.env.WORKER_GATHER_DISPATCH_SOURCE, 'utf8') : source;
const dispatch = dispatchSource.split('\n').filter(line => line.includes("if (command.type === 'gather')"));
assert.equal(dispatch.length, 1, 'consume the sole production Gather dispatch');
const entries = f => f.units.reduce((sum, u) => sum + u.path.length + (u.attackMoveResumePath?.length ?? 0), 0);

// Actual command, selection, publication, repair, service, economy and physical
// bodies. Only flow/A* and visibility are controlled; XL pressure is synthetic.
function fixture(options = {}) {
  const f = workerRouteAdmissionFixture(options), c = f.context;
  c.spawnByTeam = [f.point(f.start), f.point(f.start)];
  c.isShoreFish = () => false;
  Object.assign(c, gatherArea);
  vm.runInContext(body('commandUnitAt') + '\n' + body('commandUnits')
    + `\nfunction dispatchGather(player,command){${dispatch[0]}}`, c);
  for (const u of f.actors) Object.assign(u, { cargo: 0, cargoType: null, gatherPhase: '',
    gatherNodeId: null, gatherForestCell: -1, workIntent: null });
  const node = { id: 'selected-food', type: 'food', stock: 100, ...f.point(f.raw.at(-1)) };
  f.nodes.set(node.id, node);
  f.node = node;
  f.command = (extra = {}) => c.dispatchGather({ team: f.actors[0].team }, {
    type: 'gather', ids: f.actors.map(u => u.id), unitGenerations: f.actors.map(u => u.generation),
    nodeId: node.id, ...extra });
  f.forest = () => {
    const forest = f.forestActor();
    for (const u of f.actors) Object.assign(u, f.point(f.start), { cargo: 0, cargoType: null,
      gatherPhase: '', gatherForestCell: -1, workIntent: null });
    const original = c.getAttackFlowFieldForGoals;
    f.forestRaw = Array.from({ length: forest.current - f.start }, (_, i) => f.start + i + 1);
    c.getAttackFlowFieldForGoals = (goals, key) => key.startsWith('forest:')
      ? { goal: forest.tree + 1, goals: new Set(goals), path: f.forestRaw } : original(goals, key);
    f.forestTarget = forest;
    f.command = (extra = {}) => c.dispatchGather({ team: f.actors[0].team }, {
      type: 'gather', ids: f.actors.map(u => u.id), unitGenerations: f.actors.map(u => u.generation),
      forestCell: forest.tree, ...extra });
    return forest;
  };
  return f;
}

for (const [width, height] of [[320, 160], [160, 320], [320, 320]])
for (const team of [0, 1]) for (const weighted of [false, true])
test(`${width}x${height}, seat ${team}, weighted ${weighted}: manual Gather batch retains selected jobs within saved quota`, () => {
  const f = fixture({ width, height, team, weighted, count: 4, total: QUOTA }), c = f.context;
  const foreign = { ...f.actors[0], id: f.units.length, team: 1 - team, path: [], queuedWaypoints: [], cargo: 7,
    cargoType: 'wood', gatherPhase: '', workIntent: null };
  f.units.push(foreign); const beforeForeign = structuredClone(foreign);
  for (const u of f.actors) u.queuedWaypoints.push({ destination: f.start + 20, attackMove: false, point: null });
  f.command({ ids: [...f.actors.map(u => u.id), foreign.id, 0, 1],
    unitGenerations: [...f.actors.map(u => u.generation), foreign.generation, f.actors[0].generation, -1] });
  assert.equal(entries(f), QUOTA); assert.ok(f.checkpointLeaf());
  assert.equal(f.censuses.length, 1, 'one lazy operation census for all recipients');
  assert.equal(c.workerEconomyRouteScope, null);
  assert.equal(c.movePlanningQueue.length + Number(Boolean(c.activeMovePlanningJob)), 1);
  assert.equal(c.activeMovePlanningJob.mode, 'worker-gather-command-capacity');
  assert.equal(c.pendingMoveAssignmentsByUnit().size, 4);
  assert.deepEqual(foreign, beforeForeign); assert.equal(f.node.stock, 100);
  assert.ok(f.notices.some(message => message === 'GATHER ORDER · 4 WORKERS'));
  for (const u of f.actors) {
    assert.equal(u.gatherNodeId, f.node.id); assert.equal(u.gatherPhase, 'to-node');
    assert.equal(u.moveGoalCell, f.raw.at(-1)); assert.notEqual(u.moveGoalCell, f.fields[0].goal);
    assert.equal(u.cargo, 0); assert.equal(u.movePlanningPending, true); assert.equal(u.path.length, 0);
    assert.equal(u.workIntent.resource, 'food'); assert.equal(u.queuedWaypoints.length, 0,
      'new manual Gather retains the original replacement/queue-clearing policy');
  }
  for (const result of f.selections) {
    assert.equal(result.selected, f.raw.at(-1)); assert.equal(result.originalLength, 5);
    assert.equal(result.originalCost, unitRoutePathCost(f.start, f.raw, width, f.levels));
    assert.equal(result.status, 'deferred');
  }
  f.drain();
  assert.equal(c.pendingMoveAssignmentsByUnit().size, 4); assert.equal(entries(f), QUOTA);
});

for (const team of [0, 1]) for (const turns of [0, 1, 2])
test(`seat ${team}, scheduler ${turns}: refused Gather retries its selected goal and deposits finite Food once`, () => {
  const f = fixture({ team, turns, total: QUOTA }), u = f.actors[0];
  f.node.stock = .004; f.command(); f.drain();
  const goal = u.moveGoalCell, revision = u.orderRevision, job = structuredClone(u.workIntent);
  for (let i = 0; i < 4; i++) { f.tick(); f.economy(); }
  assert.equal(u.orderRevision, revision); assert.equal(u.moveGoalCell, goal);
  assert.deepEqual(u.workIntent, job); assert.equal(f.node.stock, .004); assert.equal(u.movePlanningPending, true);
  f.release();
  for (let i = 0; i < 160 && f.context.teamFood[team] === 100; i++) { f.tick(); f.physical(); f.economy(); }
  assert.equal(f.node.stock, 0); assert.equal(u.cargo, 0); assert.equal(f.context.teamFood[team], 100.004);
  assert.equal(u.movePlanningPending, false); assert.ok(entries(f) <= QUOTA);
  for (let i = 0; i < 4; i++) f.economy();
  assert.equal(f.context.teamFood[team], 100.004, 'no repeat deposit from a completed deferred leg');
});

for (const [width, height] of [[320, 160], [160, 320], [320, 320]]) for (const team of [0, 1])
for (const weighted of [false, true])
test(`${width}x${height}, seat ${team}, weighted ${weighted}: actual forest delegation retains its selected visible frontier while pending`, () => {
  const f = fixture({ width, height, team, weighted, count: 4, total: QUOTA }), forest = f.forest();
  f.command(); f.drain();
  assert.equal(f.censuses.length, 1); assert.equal(entries(f), QUOTA); assert.ok(f.checkpointLeaf());
  for (const u of f.actors) {
    assert.equal(u.gatherForestCell, forest.tree); assert.equal(u.gatherNodeId, null);
    assert.equal(u.workIntent.sourceKind, 'forest-group'); assert.equal(u.moveGoalCell, forest.current);
    assert.equal(u.movePlanningPending, true); assert.equal(u.path.length, 0);
  }
  const jobs = f.actors.map(u => JSON.stringify(u.workIntent)), revisions = f.actors.map(u => u.orderRevision);
  for (let i = 0; i < 4; i++) { f.tick(); f.economy(); }
  assert.deepEqual(f.actors.map(u => u.orderRevision), revisions, 'off-access pending routes do not reselect');
  assert.deepEqual(f.actors.map(u => JSON.stringify(u.workIntent)), jobs);
  assert.equal(f.forestWoodRemaining[forest.tree], 100);
  for (const result of f.selections) {
    assert.equal(result.selected, forest.current); assert.equal(result.originalLength, f.forestRaw.length);
    assert.equal(result.originalCost, unitRoutePathCost(f.start, f.forestRaw, width, f.levels));
  }
});

for (const team of [0, 1]) for (const turns of [0, 1])
test(`seat ${team}, scheduler ${turns}: forest command resumes productive physical work after release and cold metadata recovery`, () => {
  const f = fixture({ team, turns, total: QUOTA }), forest = f.forest(), u = f.actors[0];
  f.command(); f.drain();
  const saved = structuredClone(u), cold = fixture({ team, turns, total: QUOTA });
  const coldForest = cold.forest();
  Object.assign(cold.actors[0], saved); cold.context.recoverPendingTail(); cold.drain();
  assert.equal(cold.actors[0].moveGoalCell, forest.current);
  assert.deepEqual(cold.actors[0].workIntent, saved.workIntent);
  cold.release();
  for (let i = 0; i < 160 && cold.actors[0].cargo === 0; i++) { cold.tick(); cold.physical(); cold.economy(); }
  assert.equal(cold.actors[0].gatherPhase, 'gathering'); assert.ok(cold.actors[0].cargo > 0);
  assert.equal(cold.actors[0].cargo + cold.forestWoodRemaining[coldForest.tree], 100);
  assert.deepEqual(cold.actors[0].workIntent, saved.workIntent);
});

test('rejected/stale commands and naval delegation remain census-free without touching another domain', () => {
  const f = fixture({ total: QUOTA }), u = f.actors[0], before = structuredClone(u);
  f.command({ unitGenerations: [-1] }); f.command({ nodeId: 'missing' });
  assert.deepEqual(u, before); assert.equal(f.censuses.length, 0);
  u.movementDomain = 'water'; u.kind = 'skiff';
  const water = structuredClone(u); let delegated = 0;
  f.context.assignSkiffGather = (_p, _c, selected) => { delegated++; assert.equal(selected[0], u); };
  f.command(); assert.equal(delegated, 1); assert.deepEqual(u, water);
  assert.equal(f.censuses.length, 0); assert.equal(f.context.workerEconomyRouteScope, null);
});

for (const team of [0, 1]) test(`seat ${team}: Farm Gather retains its owned multi-goal approach without acquiring plain-Food area intent`, () => {
  const f = fixture({ team, weighted: true, count: 4, total: QUOTA }), c = f.context;
  Object.assign(f.node, { sourceBuildingId: 20, team });
  const footprint = f.start + 6;
  c.buildingsById.set(20, { id: 20, team, complete: true, footprint: [footprint], ...f.point(footprint) });
  const walkable = c.isWalkable;
  c.isWalkable = cell => cell !== footprint && walkable(cell);
  vm.runInContext(body('buildingAccessCells'), c);
  const original = c.getAttackFlowFieldForGoals;
  c.getAttackFlowFieldForGoals = (goals, key) => key.startsWith('farm:')
    ? { goal: f.start + 7, goals: new Set(goals), path: f.raw } : original(goals, key);
  f.command(); f.drain();
  assert.equal(f.censuses.length, 1); assert.equal(entries(f), QUOTA);
  for (const u of f.actors) {
    assert.equal(u.gatherNodeId, f.node.id); assert.equal(u.gatherPhase, 'to-node');
    assert.equal(u.moveGoalCell, f.raw.at(-1)); assert.notEqual(u.moveGoalCell, f.start + 7);
    assert.equal(u.workIntent, null); assert.equal(u.movePlanningPending, true); assert.equal(u.path.length, 0);
  }
  assert.equal(f.node.stock, 100);
});

test('separate Gather operations take fresh censuses, and scope return/failure never leaks into the next command', () => {
  const f = fixture({ total: QUOTA }); f.command(); f.drain();
  f.command(); f.drain(); assert.equal(f.censuses.length, 2);
  assert.equal(f.context.workerEconomyRouteScope, null);
  assert.equal(f.context.withWorkerRouteAdmission(() => 37, 'control'), 37);
  assert.throws(() => f.context.withWorkerRouteAdmission(() => { throw new Error('controlled failure'); }, 'control'), /controlled failure/);
  assert.equal(f.context.workerEconomyRouteScope, null);
});

for (const team of [0, 1]) for (const forest of [false, true])
test(`seat ${team}, forest ${forest}: accepted Gather with other typed cargo keeps its chosen drop-off and remembered new work`, () => {
  const f = fixture({ team, weighted: true, total: QUOTA }), u = f.actors[0];
  if (forest) f.forest();
  Object.assign(u, { cargo: 7.25, cargoType: forest ? 'food' : 'wood' });
  f.command(); f.drain();
  assert.equal(u.cargo, 7.25); assert.equal(u.cargoType, forest ? 'food' : 'wood');
  assert.equal(u.gatherPhase, 'to-base'); assert.equal(u.dropoffBuildingId, 10);
  assert.equal(u.dropoffNavigationRevision, f.context.navigationRevision);
  assert.equal(u.moveGoalCell, f.raw.at(-1)); assert.notEqual(u.moveGoalCell, f.fields[0].goal);
  assert.equal(u.movePlanningPending, true); assert.equal(u.path.length, 0);
  assert.equal(u.workIntent.resource, forest ? 'wood' : 'food');
  assert.equal(u.gatherNodeId, forest ? null : f.node.id);
  assert.equal(u.gatherForestCell, forest ? f.forestTarget.tree : -1);
  assert.equal(entries(f), QUOTA); assert.equal(f.node.stock, 100);
});

for (const turns of [0, 1])
test(`scheduler ${turns}: replaced active/resume aliases get fresh conservative-release credit`, () => {
  const f = fixture({ turns, total: QUOTA, weighted: true, count: 4, oldLength: 3, resumeLength: 3 });
  for (const u of f.actors) u.attackMoveResumePath = u.path;
  f.command();
  assert.equal(f.censuses.length, 1); assert.ok(entries(f) <= QUOTA); assert.ok(f.checkpointLeaf());
  assert.ok(f.actors.some(u => u.movePlanningPending), 'later cleared resume fields keep conservative charge until service');
  f.drain(); f.tick();
  assert.ok(f.actors.every(u => !u.movePlanningPending && u.path.length === 5));
  assert.equal(entries(f), QUOTA - 4); assert.ok(f.checkpointLeaf());
  assert.ok(f.actors.every(u => u.attackMoveResumePath === null && u.gatherNodeId === f.node.id));
});

for (const [width, height] of [[16, 17], [160, 160], [256, 256]]) for (const forest of [false, true])
test(`${width}x${height}, forest ${forest}: unchanged legacy Gather execution and replacement policy`, () => {
  const f = fixture({ width, height, count: 4 }); if (forest) f.forest();
  for (const u of f.actors) u.queuedWaypoints.push({ destination: f.start + 20, attackMove: false, point: null });
  f.command();
  assert.equal(f.censuses.length, 0); assert.equal(f.context.workerEconomyRouteScope, null);
  for (const u of f.actors) {
    assert.equal(u.movePlanningPending, false); assert.ok(u.path.length > 0); assert.equal(u.queuedWaypoints.length, 0);
    assert.equal(u.path.at(-1), forest ? f.forestTarget.current : f.raw.at(-1));
  }
});
