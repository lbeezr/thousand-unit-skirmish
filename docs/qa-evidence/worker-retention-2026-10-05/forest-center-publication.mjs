// Read-only publication witness: synthetic route pressure, actual forest
// final-approach bodies. Not an admitted XL match or productive work journey.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { activeWorkIntent, createForestGatherWorkIntent, FOREST_GATHER_SOURCE_KIND } from '../../../src/work-intent.mjs';
import { preflightXlCheckpointRoutes, XL_CHECKPOINT_ROUTE_MAX_ENTRIES as QUOTA } from '../../../src/server/checkpoint-route-budget.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const source = readFileSync(new URL('../../../server.mjs', import.meta.url), 'utf8');
const names = ['forestOpenAccessCells', 'updateForestWorkerEconomy'];
const bodies = Object.fromEntries(names.map(name => {
  const start = source.indexOf(`function ${name}(`), end = source.indexOf('\nfunction ', start + 1);
  assert.ok(start > 0 && end > start, name);
  return [name, source.slice(start, end)];
}));

function witness(width, height, beforeEntries) {
  const cell = (x, z) => Math.floor(z + height / 2) * width + Math.floor(x + width / 2);
  const point = c => ({ x: c % width - width / 2 + .5, z: Math.floor(c / width) - height / 2 + .5 });
  const current = cell(.1, .01), tree = current + 1, center = point(current);
  const forestCellMask = new Uint8Array(width * height), forestWoodRemaining = new Float64Array(width * height);
  forestCellMask[tree] = 1; forestWoodRemaining[tree] = 100;
  const actor = { id: 0, generation: 9, orderRevision: 7, hp: 100, team: 0,
    kind: 'worker', movementDomain: 'land', x: center.x - .4, z: center.z - .49, cargo: 5, cargoType: 'wood',
    gatherPhase: 'to-node', gatherForestCell: tree, gatherNodeId: null,
    workIntent: createForestGatherWorkIntent(9, point(tree)),
    path: [], pathIndex: 0, attackMoveResumePath: null, moveGoalCell: current,
    moveGoalPoint: null, movePlanningPending: false, queuedWaypoints: [{ x: 4.25, z: .75 }] };
  const units = [actor], nodes = new Map();
  for (let remaining = beforeEntries; remaining > 0;) {
    const length = Math.min(remaining, width * height);
    units.push({ hp: 0, path: Array(length).fill(current), pathIndex: length, attackMoveResumePath: null });
    remaining -= length;
  }
  const context = vm.createContext({ MAP_WIDTH: width, MAP_HEIGHT: height, CELL_COUNT: width * height,
    cellIndex: (column, row) => row * width + column, worldToCell: cell, cellToWorld: point,
    isWalkable: c => c >= 0 && c < width * height && c !== tree,
    forestCellMask, forestWoodRemaining, activeWorkIntent, FOREST_GATHER_SOURCE_KIND, workerEconomyRouteScope: null,
    cellVisibleToTeam: () => true, WORKER_INTERACTION_RANGE: 1.4, WORKER_CARRY_CAPACITY: 10 });
  vm.runInContext(names.map(name => bodies[name]).join('\n'), context);
  const before = structuredClone(actor), beforeJob = JSON.stringify(actor.workIntent);
  const distanceBefore = Math.hypot(point(tree).x - actor.x, point(tree).z - actor.z);
  const distanceAtCenter = Math.hypot(point(tree).x - point(current).x, point(tree).z - point(current).z);
  assert.ok(distanceBefore > 1.4 && distanceAtCenter <= 1.4, 'existing legal center approach is productive-range capable');
  const continuations = new Set();
  context.updateForestWorkerEconomy(actor, continuations);
  assert.deepEqual(Array.from(actor.path), [current]);
  assert.equal(actor.pathIndex, 0); assert.equal(actor.moveGoalCell, current);
  for (const key of Object.keys(before).filter(k => !['path', 'pathIndex'].includes(k))) {
    assert.deepEqual(JSON.parse(JSON.stringify(actor[key])), JSON.parse(JSON.stringify(before[key])), key);
  }
  assert.equal(JSON.stringify(actor.workIntent), beforeJob);
  assert.equal(forestWoodRemaining[tree], 100); assert.equal(continuations.size, 0);
  const after = units.reduce((sum, unit) => sum + unit.path.length + (unit.attackMoveResumePath?.length ?? 0), 0);
  let checkpointLeaf;
  try {
    const result = preflightXlCheckpointRoutes({ width, height }, { units, resourceNodes: nodes },
      { maxUnits: 2000, maxResourceNodes: 128 });
    checkpointLeaf = result ? 'accepted' : 'legacy-bypass';
  } catch (error) {
    assert.match(error.message, /exceeds aggregate cell entries/); checkpointLeaf = 'aggregate-refused';
  }
  assert.equal(after, beforeEntries + 1);
  assert.equal(checkpointLeaf, width > 256 || height > 256 ? 'aggregate-refused' : 'legacy-bypass');
  return { width, height, before: beforeEntries, after, quota: QUOTA, checkpointLeaf,
    writer: 'updateForestWorkerEconomy exhausted-route access-cell center publication',
    destination: current, tree, distanceBefore, distanceAtCenter,
    unchangedJobCargoQueueRevisionGenerationAndPose: true, unchangedStock: true,
    routeSelectorOrFlowHelperCalled: false };
}

const cases = [[320, 160, QUOTA], [160, 320, QUOTA], [320, 320, QUOTA], [16, 17, 0]]
  .map(([width, height, pressure]) => witness(width, height, pressure));
const report = { sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()),
  inputSha256: Object.fromEntries(names.map(name => [name, createHash('sha256').update(bodies[name]).digest('hex')])),
  scope: 'Actual forest access-cell/final-approach bodies and real active work intent with controlled visibility/walkability and synthetic saved-field pressure. Shows a positive publication bypassing the shared flow helper; no route selector is invoked. No complete checkpoint, paid work lifecycle, movement execution, native XL admission, timing, served or rendered claim.',
  cases };
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ source: report.sourceRevision, dirty: report.sourceDirty, cases: cases.length,
  aggregateOvershoots: cases.filter(c => c.after > QUOTA).length }));
