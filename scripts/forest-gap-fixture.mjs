// Bounded characterization through unchanged production bodies in the existing
// fixed-tick adapter. Cell occupancy and soft separation are not body clearance.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { arrivedAtMoveGoal } from './pathing-arrival.mjs';
import { canTraverseUnitStep } from '../src/unit-movement.mjs';
import { visitGridSegmentCells } from '../src/unit-path-line.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rounded = value => Number(value.toFixed(6));
export const FOREST_GAPS = [0, 1, 2, 4];
export function forestGapMap({ gap = 1, group = 16, plug = false } = {}) {
  assert.ok(FOREST_GAPS.includes(gap) && [1, 16, 64].includes(group));
  assert.ok(!plug || gap === 1);
  return { id: `forest-gap-${gap}-${group}${plug ? '-plug' : ''}`, name: 'FOREST GAP DIAGNOSTIC',
    width: 64, height: 48, terrainSeed: 881, fogOfWar: false,
    spawnPoints: [{ team: 0, x: -26, z: -12 }, { team: 1, x: 26, z: 12 }],
    startingArmySize: 2 * (group + 4), startingResources: { food: 500, wood: 500 },
    elevationPatches: [], resourceNodes: [], triggers: [], scenarioEvents: [],
    obstacles: [
      { id: 'forest-north', column: 28, row: 4, width: 8, height: 20, material: 'forest' },
      { id: 'forest-south', column: 28, row: 24 + gap, width: 8, height: 20 - gap, material: 'forest' },
      ...(plug ? [{ id: 'forest-plug', column: 31, row: 24, width: 1, height: 1, material: 'forest' }] : []),
    ] };
}
export function forestInventory(map) {
  const cells = new Set();
  for (const obstacle of map.obstacles) for (let row = obstacle.row; row < obstacle.row + obstacle.height; row++) {
    for (let column = obstacle.column; column < obstacle.column + obstacle.width; column++) cells.add(row * map.width + column);
  }
  return { forestCells: cells.size, woodPerCell: 6, totalForestWood: cells.size * 6,
    woodDifferenceFromClosedBelt: cells.size * 6 - 320 * 6 };
}
export const FOREST_GAP_CASES = FOREST_GAPS.flatMap(gap => [0, 1].flatMap(team => [
  ...['box', 'line', 'column'].map(formation => ({ gap, group: 16, team, formation })),
  ...[1, 64].map(group => ({ gap, group, team, formation: 'box' })),
]));
export function configureForestGapReplay() {
  process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp'; process.env.RTS_PREGAME = '0';
  process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '0';
  process.env.RTS_TICK_DIAGNOSTICS = '1'; process.env.RTS_SEPARATION_DIAGNOSTICS = '1';
  delete process.env.RTS_MATCH_STATE_PATH;
}
function order(r, team, actors, type, extra = {}) {
  const command = { type, ids: actors.map(u => u.id), unitGenerations: actors.map(u => u.generation), ...extra };
  const notices = r.order(team, command); r.drain();
  assert.ok(notices.some(n => /ORDER/.test(n.message)), JSON.stringify(notices));
  assert.ok(!notices.some(n => /REJECTED|FAILED|UNREACHABLE/.test(n.message)), JSON.stringify(notices));
  return { tick: r.tick, team, command, notices };
}
const done = (r, u) => arrivedAtMoveGoal(u, r.point(u.moveGoalCell));
function canonical(r) {
  return r.units.map(u => [u.id, u.generation, u.team, u.kind, u.x, u.z, u.hp,
    u.moveGoalCell, u.pathIndex, u.path, u.orderRevision, u.movePlanningPending, u.queuedWaypoints]);
}
async function stage(r, team, group, maxTicks) {
  const actors = r.units.filter(u => u.team === team && u.kind === 'infantry');
  assert.equal(actors.length, group);
  const command = order(r, team, actors, 'move', { x: team ? 12.5 : -12.5, z: .5, formation: 'box' });
  const started = r.tick;
  while (r.tick - started < maxTicks && !actors.every(u => done(r, u))) {
    const cells = actors.map(u => r.cell(u.x, u.z)); r.step();
    for (const [index, u] of actors.entries()) assert.ok(canTraverseUnitStep(cells[index], r.cell(u.x, u.z),
      64, r.levels, r.isWalkable), 'ordinary staging has no illegal steps');
  }
  assert.ok(actors.every(u => done(r, u)), 'ordinary staging Move completes before the bounded diagnostic');
  return { actors, command, ticks: r.tick - started };
}
function route(r, actors, map) {
  return actors.map(u => {
    let x = u.x, z = u.z, length = 0;
    const rows = new Set();
    for (const cell of u.path) {
      const p = r.point(cell); length += Math.hypot(p.x - x, p.z - z);
      assert.ok(visitGridSegmentCells(x + map.width / 2, z + map.height / 2,
        p.x + map.width / 2, p.z + map.height / 2, map.width, map.width * map.height, crossed => {
          if (crossed % map.width >= 28 && crossed % map.width < 36) rows.add(Math.floor(crossed / map.width));
        }));
      x = p.x; z = p.z;
    }
    return { id: u.id, goal: u.moveGoalCell, length: rounded(length), bandRows: [...rows].sort((a, b) => a - b),
      pathSha256: hash(u.path) };
  });
}
function summarizeRoutes(routes) {
  const lengths = routes.map(u => u.length);
  return { minLength: Math.min(...lengths), maxLength: Math.max(...lengths),
    meanLength: rounded(lengths.reduce((a, b) => a + b, 0) / lengths.length),
    northBypass: routes.filter(u => u.bandRows.some(row => row < 4)).length,
    southBypass: routes.filter(u => u.bandRows.some(row => row >= 44)).length,
    gapRoutes: routes.filter(u => u.bandRows.some(row => row >= 24 && row < 28)).length };
}
function remainingDistance(r, u) {
  let x = u.x, z = u.z, distance = 0;
  for (let index = u.pathIndex; index < u.path.length; index++) {
    const p = r.point(u.path[index]); distance += Math.hypot(p.x - x, p.z - z); x = p.x; z = p.z;
  }
  return distance;
}
function measureCrossing(r, actors, spec, map, maxTicks) {
  const issuedAt = r.tick, goals = actors.map(u => u.moveGoalCell), initialRoutes = route(r, actors, map);
  const state = actors.map(u => ({ id: u.id, previousX: u.x, previousZ: u.z, lastProgress: 0,
    distance: 0, bestRemainingDistance: remainingDistance(r, u), orderRevision: u.orderRevision, repairs: 0,
    maxNoProgressTicks: 0, queueNoProgressTicks: 0, enteredAt: null, crossedAt: null, crossingRow: null }));
  const trace = createHash('sha256'); let invalidSteps = 0, maxPending = 0;
  for (let tick = 1; tick <= maxTicks; tick++) {
    const cells = actors.map(u => r.cell(u.x, u.z));
    r.step(); trace.update(JSON.stringify(canonical(r)) + '\n');
    maxPending = Math.max(maxPending, actors.filter(u => u.movePlanningPending).length);
    for (const [index, u] of actors.entries()) {
      const p = state[index], cell = r.cell(u.x, u.z), column = cell % map.width;
      if (!canTraverseUnitStep(cells[index], cell, map.width, r.levels, r.isWalkable)) invalidSteps++;
      const distance = Math.hypot(u.x - p.previousX, u.z - p.previousZ); p.distance += distance;
      const remaining = remainingDistance(r, u);
      const progress = remaining < p.bestRemainingDistance - .05;
      if (u.orderRevision !== p.orderRevision || progress) {
        if (u.orderRevision !== p.orderRevision) p.repairs++;
        p.orderRevision = u.orderRevision; p.bestRemainingDistance = remaining; p.lastProgress = tick;
      }
      if (!done(r, u)) {
        const delay = tick - p.lastProgress; p.maxNoProgressTicks = Math.max(p.maxNoProgressTicks, delay);
        if (p.crossedAt === null && !progress) p.queueNoProgressTicks++;
      }
      if (p.enteredAt === null && (spec.team ? column <= 35 : column >= 28)) p.enteredAt = tick;
      if (p.crossedAt === null && (spec.team ? column < 28 : column >= 36)) {
        p.crossedAt = tick; p.crossingRow = Math.floor(cell / map.width);
      }
      p.previousX = u.x; p.previousZ = u.z;
    }
    if (actors.every(u => done(r, u))) break;
  }
  const stalled = actors.filter(u => !done(r, u)).map(u => ({ id: u.id, x: u.x, z: u.z, goal: u.moveGoalCell,
    pathIndex: u.pathIndex, pathLength: u.path.length, pending: u.movePlanningPending }));
  const crossings = state.map(({ previousX, previousZ, lastProgress, bestRemainingDistance, orderRevision, ...p }) => ({ ...p, distance: rounded(p.distance) }));
  const crossed = crossings.filter(p => p.crossedAt !== null);
  return { issuedAt, ticks: r.tick - issuedAt, traceSha256: trace.digest('hex'), initialRoutes,
    planned: summarizeRoutes(initialRoutes), crossings, invalidSteps, maxPending,
    firstCrossingTick: crossed.length ? Math.min(...crossed.map(p => p.crossedAt)) : null,
    lastCrossingTick: crossed.length === actors.length ? Math.max(...crossed.map(p => p.crossedAt)) : null,
    crossed: crossed.length, arrived: actors.length - stalled.length, stalled,
    goalsUnchanged: goals.every((cell, index) => actors[index].moveGoalCell === cell),
    uniqueGoals: new Set(actors.map(u => u.moveGoalCell)).size,
    reformedAtAssignedGoals: stalled.length === 0 && new Set(actors.map(u => u.moveGoalCell)).size === actors.length,
    freeExit: initialRoutes.every(u => r.isWalkable(u.goal) && (spec.team ? u.goal % map.width < 24 : u.goal % map.width >= 40)),
    maxNoProgressTicks: Math.max(...crossings.map(p => p.maxNoProgressTicks)),
    actorsWithNoProgress30Ticks: crossings.filter(p => p.maxNoProgressTicks >= 30).length,
    observedBypass: crossings.filter(p => p.crossingRow !== null && (p.crossingRow < 4 || p.crossingRow >= 44)).length };
}
function replayInput(r, initialCheckpoint, captureInput) {
  if (initialCheckpoint) {
    assert.deepEqual(initialCheckpoint.mapDefinition, r.checkpoint().mapDefinition, 'repeat uses the same canonical map');
    r.validate(initialCheckpoint); r.restore(structuredClone(initialCheckpoint));
  }
  captureInput?.(structuredClone(r.checkpoint()));
}
export async function runForestGap(spec, { maxTicks = 1800, initialCheckpoint = null, captureInput } = {}) {
  assert.ok([0, 1].includes(spec.team) && ['box', 'line', 'column'].includes(spec.formation));
  assert.ok(Number.isInteger(maxTicks) && maxTicks > 0 && maxTicks <= 2700);
  const map = forestGapMap(spec), fixture = await createPathingReplayFixture(map), r = fixture.replay;
  try {
    replayInput(r, initialCheckpoint, captureInput);
    const staged = await stage(r, spec.team, spec.group, maxTicks);
    const health = r.units.map(u => u.hp);
    const command = order(r, spec.team, staged.actors, 'move', { x: spec.team ? -12.5 : 12.5, z: .5, formation: spec.formation });
    const measured = measureCrossing(r, staged.actors, spec, map, maxTicks);
    assert.deepEqual(r.units.map(u => u.hp), health, 'combat cannot confound the forest route experiment');
    return { ...spec, mapSha256: hash(map), sourceSha256: fixture.sourceSha256, inventory: forestInventory(map),
      staging: { command: staged.command, ticks: staged.ticks }, command,
      navigationRevision: r.navigationRevision, ...measured };
  } finally { await fixture.dispose(); }
}

export async function runForestPlug(team, { maxTicks = 1800, initialCheckpoint = null, captureInput } = {}) {
  assert.ok([0, 1].includes(team) && Number.isInteger(maxTicks) && maxTicks > 0 && maxTicks <= 2700);
  const spec = { gap: 1, group: 16, team, formation: 'box' }, map = forestGapMap({ ...spec, plug: true });
  const fixture = await createPathingReplayFixture(map), r = fixture.replay; let restored = null;
  try {
    replayInput(r, initialCheckpoint, captureInput);
    const { actors } = await stage(r, team, 16, maxTicks);
    order(r, team, actors, 'move', { x: team ? -12.5 : 12.5, z: .5, formation: 'box' });
    const beforeRoutes = route(r, actors, map); order(r, team, actors, 'stop');
    const worker = r.units.find(u => u.team === team && u.kind === 'worker'), plugCell = 24 * 64 + 31;
    order(r, team, [worker], 'move', r.point(24 * 64 + (team ? 32 : 30)));
    for (let tick = 0; tick < maxTicks && !done(r, worker); tick++) r.step();
    assert.ok(done(r, worker));
    const woodBefore = r.wood[team], revisionBefore = r.navigationRevision;
    const gatherCommand = order(r, team, [worker], 'gather', { forestCell: plugCell });
    for (let tick = 0; tick < maxTicks && worker.cargo < 2; tick++) r.step();
    assert.ok(worker.cargo >= 2 && worker.cargo < 6, 'a genuinely loaded Worker checkpoint precedes depletion');
    const loaded = r.checkpoint(); r.validate(loaded);
    restored = await createPathingReplayFixture(map); restored.replay.restore(structuredClone(loaded));
    const rr = restored.replay, restoredWorker = rr.units.find(u => u.id === worker.id);
    assert.equal(restoredWorker.generation, worker.generation); assert.equal(restoredWorker.cargo, worker.cargo);
    const loadedCargo = worker.cargo, loadedTick = r.tick;
    const trace = createHash('sha256');
    for (let tick = 0; tick < maxTicks && !r.isWalkable(plugCell); tick++) {
      r.step(); rr.step();
      assert.deepEqual(rr.checkpoint().state.units, r.checkpoint().state.units, 'loaded checkpoint continuation retains authority without remapping');
      assert.deepEqual(rr.checkpoint().state.forestStocks, r.checkpoint().state.forestStocks);
      trace.update(JSON.stringify(r.checkpoint().state.units) + '\n');
    }
    assert.ok(r.isWalkable(plugCell) && rr.isWalkable(plugCell), 'normal harvest clears the plug');
    assert.ok(r.navigationRevision > revisionBefore); assert.equal(rr.navigationRevision, r.navigationRevision);
    order(r, team, [worker], 'stop'); order(r, team, [worker], 'returnCargo');
    for (let tick = 0; tick < maxTicks && worker.cargo > 0; tick++) r.step();
    assert.equal(worker.cargo, 0); assert.ok(Math.abs(r.wood[team] - woodBefore - 6) < .0001);
    const stock = r.checkpoint().state.forestStocks;
    assert.deepEqual(stock.filter(([, value]) => value < 6).map(([cell]) => cell), [plugCell], 'no other tree finances the deposit');
    order(r, team, actors, 'move', { x: team ? -12.5 : 12.5, z: .5, formation: 'box' });
    const crossing = measureCrossing(r, actors, spec, map, maxTicks);
    return { ...spec, plug: true, mapSha256: hash(map), sourceSha256: fixture.sourceSha256, inventory: forestInventory(map),
      beforeRoutes, before: summarizeRoutes(beforeRoutes), after: crossing,
      harvest: { gatherCommand, plugCell, loadedTick, loadedCargo: rounded(loadedCargo), restart: 'fresh fixed-tick adapter; checkpoint validator/restore',
        exactLoadedContinuation: true, continuationTraceSha256: trace.digest('hex'), revisionBefore, revisionAfter: r.navigationRevision,
        woodBefore, woodAfter: r.wood[team], bankedWood: rounded(r.wood[team] - woodBefore), clearedCells: [plugCell] } };
  } finally { if (restored) await restored.dispose(); await fixture.dispose(); }
}
