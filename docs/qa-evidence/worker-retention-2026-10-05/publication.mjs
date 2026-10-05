// Read-only writer characterization. Pressure fields are synthetic metadata,
// not legitimate planner routes, complete XL saves, admitted matches or pixels.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import * as movement from '../../../src/unit-movement.mjs';
import { shortcutFlatUnitPath } from '../../../src/unit-path-line.mjs';
import { clearWorkIntent } from '../../../src/work-intent.mjs';
import { preflightXlCheckpointRoutes, XL_CHECKPOINT_ROUTE_MAX_ENTRIES as QUOTA } from '../../../src/server/checkpoint-route-budget.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const source = readFileSync(new URL('../../../server.mjs', import.meta.url), 'utf8');
const names = ['workerFlowPath', 'applyWorkerFlowRoute', 'routeWorkerToDropoff', 'assignReturnCargo', 'clearAttackMoveOrder'];
function body(name) {
  const start = source.indexOf(`function ${name}(`), end = source.indexOf('\nfunction ', start + 1);
  assert.ok(start > 0 && end > start, name); return source.slice(start, end);
}
const bodies = Object.fromEntries(names.map(name => [name, body(name)]));
const savedEntries = (units, nodes) => units.reduce((sum, u) => sum + u.path.length + (u.attackMoveResumePath?.length ?? 0), 0)
  + [...nodes.values()].reduce((sum, n) => sum + (n.wildlifeHerd?.path.length ?? 0), 0);
const record = path => ({ hp: 0, path, pathIndex: path.length, attackMoveResumePath: null });

function fixture(width, height, mode, beforeEntries, count = 1, oldLength = 0) {
  const cell = (x, z) => Math.floor(z + height / 2) * width + Math.floor(x + width / 2);
  const point = c => ({ x: c % width - width / 2 + .5, z: Math.floor(c / width) - height / 2 + .5 });
  const start = cell(.5, .5), raw = Array.from({ length: 5 }, (_, i) => start + i + 1);
  const longer = [...raw, raw.at(-1) + 1], levels = new Uint8Array(width * height);
  if (mode === 'weighted') for (const c of raw.slice(2)) levels[c] = 1;
  const actors = Array.from({ length: count }, (_, id) => ({ ...record(Array(oldLength).fill(start)), id,
    generation: 9, orderRevision: 7, hp: 100, team: 0, kind: 'worker', movementDomain: 'land',
    x: point(start).x, z: point(start).z, cargo: 10, cargoType: 'food', workIntent: null,
    moveGoalCell: -1, moveGoalPoint: null, queuedWaypoints: [], attackMove: false,
    attackTargetId: -1, attackBuildingTargetId: -1, buildingTargetId: null,
    gatherPhase: '', gatherNodeId: null, gatherForestCell: -1 }));
  const units = [...actors], nodes = new Map(); let remaining = beforeEntries - count * oldLength;
  while (remaining > 0) {
    const entries = Math.min(remaining, width * height);
    units.push(record(Array(entries).fill(start))); remaining -= entries;
  }
  const fields = [
    { goal: longer.at(-1), goals: new Set([raw.at(-1), longer.at(-1)]), path: raw },
    { goal: longer.at(-1), goals: new Set([longer.at(-1)]), path: longer },
  ];
  const candidates = [{ id: 10, goals: [...fields[0].goals] }, { id: 11, goals: [...fields[1].goals] }];
  const notices = [], publications = [];
  const context = vm.createContext({ ...movement, shortcutFlatUnitPath, clearWorkIntent,
    MAP_WIDTH: width, MAP_HEIGHT: height, MAP_HALF_X: width / 2, MAP_HALF_Z: height / 2,
    units, resourceNodeStates: nodes, elevationLevelByCell: levels,
    worldToCell: cell, cellToWorld: point, isWalkable: c => c >= 0 && c < levels.length,
    WALK_SPEED: 4, STEP_SECONDS: 1 / 30, WORKER_INTERACTION_RANGE: 1.4,
    movePlanningEpoch: 0, navigationRevision: 4, dirty: false, automaticTargetRejections: new WeakMap(),
    commandUnits: command => command.ids.map(id => units[id]),
    unitHasCapability: (u, capability) => u.kind === 'worker' && capability === 'gather',
    economyResources: () => ['food', 'wood'], matchEconomyProfileId: () => 'classic',
    sendOrderNotice: (_p, _c, message) => notices.push(message),
    nearestOpenCell: c => c, walkableComponents: new Int32Array(width * height),
    workerDropoffCandidates: () => candidates,
    getAttackFlowFieldForGoals: (_goals, key) => key.includes(':10:') ? fields[0] : fields[1],
    pathFromAttackFlow: (_start, field) => field.path.slice(), distanceToBuildingEdge: () => Infinity,
  });
  vm.runInContext(names.map(name => bodies[name]).join('\n'), context);
  const apply = context.applyWorkerFlowRoute;
  context.applyWorkerFlowRoute = (...args) => {
    const result = apply(...args);
    publications.push({ liveActor: units[args[0].id] === args[0], revision: args[0].orderRevision,
      selectedGoal: result.selectedGoalCell, originalLength: result.originalPathLength,
      originalCost: result.originalCost, executionLength: result.path.length, status: result.status });
    return result;
  };
  assert.equal(savedEntries(units, nodes), beforeEntries);
  return { actors, units, nodes, context, raw, fields, start, levels, notices, publications, width, height };
}

function outcome(f, command) {
  const before = savedEntries(f.units, f.nodes), cargo = f.actors.reduce((sum, u) => sum + u.cargo, 0);
  if (command === 'Return') f.context.assignReturnCargo({ team: 0 }, { type: 'returnCargo', ids: f.actors.map(u => u.id) });
  else f.context.routeWorkerToDropoff(f.actors[0]);
  const after = savedEntries(f.units, f.nodes);
  const expectedCost = movement.unitRoutePathCost(f.start, f.raw, f.width, f.levels);
  for (const p of f.publications) {
    assert.equal(p.selectedGoal, f.raw.at(-1)); assert.notEqual(p.selectedGoal, f.fields[0].goal);
    assert.equal(p.originalLength, 5); assert.equal(p.originalCost, expectedCost); assert.equal(p.status, 'ready');
  }
  for (const actor of f.actors) {
    assert.equal(actor.dropoffBuildingId, 10, 'original raw length five beats six before reduction');
    assert.equal(actor.moveGoalCell, f.raw.at(-1)); assert.equal(actor.path.at(-1), f.raw.at(-1));
    assert.equal(actor.cargo, 10); assert.equal(actor.cargoType, 'food');
  }
  assert.equal(f.actors.reduce((sum, u) => sum + u.cargo, 0), cargo);
  let checkpointLeaf;
  try {
    const result = preflightXlCheckpointRoutes({ width: f.width, height: f.height },
      { units: f.units, resourceNodes: f.nodes }, { maxUnits: 2000, maxResourceNodes: 128 });
    checkpointLeaf = result ? 'accepted' : 'legacy-bypass';
  } catch (error) {
    assert.match(error.message, /exceeds aggregate cell entries/); checkpointLeaf = 'aggregate-refused';
  }
  return { width: f.width, height: f.height, command, count: f.actors.length, before, after,
    quota: QUOTA, exceedsQuota: after > QUOTA, checkpointLeaf,
    selectedTailPreserved: true, originalScorePreserved: true, cargoPreserved: true,
    publications: f.publications, notices: f.notices };
}

const cases = [];
for (const [width, height] of [[320, 160], [160, 320], [320, 320]]) {
  for (const mode of ['flat', 'weighted']) for (const before of [QUOTA - 5, QUOTA - 1, QUOTA]) {
    const result = outcome(fixture(width, height, mode, before), 'flow');
    assert.equal(result.exceedsQuota, before + (mode === 'flat' ? 1 : 5) > QUOTA);
    cases.push({ mode, ...result });
  }
  const returns = outcome(fixture(width, height, 'flat', QUOTA, 2), 'Return');
  assert.ok(returns.publications.every(p => !p.liveActor), 'real Return selects on clones before live copy');
  assert.equal(returns.after, QUOTA + 2); cases.push({ mode: 'flat', ...returns });
  const replacement = outcome(fixture(width, height, 'flat', QUOTA, 1, 3), 'flow');
  assert.equal(replacement.after, QUOTA - 2); cases.push({ mode: 'flat-replacement', ...replacement });
}
for (const [width, height] of [[16, 17], [160, 160], [256, 256]]) {
  const result = outcome(fixture(width, height, 'flat', 0), 'flow');
  assert.equal(result.checkpointLeaf, 'legacy-bypass'); cases.push({ mode: 'legacy', ...result });
}
const report = { sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()),
  inputSha256: Object.fromEntries(names.map(name => [name, createHash('sha256').update(bodies[name]).digest('hex')])),
  scope: 'Unchanged production Worker route/reduction/drop-off/land Return bodies with controlled selectors and synthetic saved-field pressure; real checkpoint route leaf only. No full checkpoint, ordinary XL admission, CPU capacity, served or rendered claim.',
  cases };
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ source: report.sourceRevision, dirty: report.sourceDirty, cases: cases.length,
  aggregateOvershoots: cases.filter(c => c.exceedsQuota).length,
  cloneReturnOvershoots: cases.filter(c => c.command === 'Return' && c.exceedsQuota).length,
  replacementControls: cases.filter(c => c.mode === 'flat-replacement').length }));
