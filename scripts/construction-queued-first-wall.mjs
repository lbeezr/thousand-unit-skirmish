import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { pathingBaselineMap } from './pathing-baseline-cases.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { createOrdinaryMilitaryEndpointAvailability } from '../src/simulation/movement/military-endpoint-availability.mjs';

// One existing paid queued-wall workload. Commands and own-actor observations;
// no checkpoint, unit/route mutation, deadline extension or destination repair.
export async function runConstructionQueuedFirstWall() {
  process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp';
  process.env.RTS_PREGAME = '0'; process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '0';
  delete process.env.RTS_MATCH_STATE_PATH;
  const map = pathingBaselineMap({ group: 64 });
  const fixture = await createPathingReplayFixture(map), r = fixture.replay;
  try {
    for (const team of [0, 1]) {
      const own = r.units.filter(u => u.team === team && u.kind === 'infantry');
      assert.ok(r.order(team, { type: 'setStance', stance: 'noAttack', ids: own.map(u => u.id),
        unitGenerations: own.map(u => u.generation) }).some(n => n.message.startsWith('STANCE ORDER')));
    }
    const team = 1, army = r.units.filter(u => u.team === team && u.kind === 'infantry');
    const worker = r.units.find(u => u.team === team && u.kind === 'worker'), actor = r.units[120];
    assert.equal(worker.id, 68); assert.equal(actor.team, team); assert.equal(actor.kind, 'infantry');
    const ids = army.map(u => u.id), orders = [];
    const order = command => {
      const notices = r.order(team, command);
      assert.ok(notices.every(n => !/REJECTED|FAILED/.test(n.message)), JSON.stringify(notices));
      orders.push({ tick: r.tick, type: command.type, selectedCount: command.ids?.length ?? 0,
        queue: command.queue === true, x: command.x, z: command.z, points: command.points,
        notices: notices.map(n => n.message) }); r.drain(); return notices;
    };
    order({ type: 'move', ids, x: -8.5, z: .5 });
    const firstGoals = army.map(u => u.moveGoalCell);
    order({ type: 'move', ids, x: 16.5, z: .5, queue: true });
    const requested = army.map(u => u.queuedWaypoints[0].destination);
    assert.equal(new Set(requested).size, 64);
    const acceptedReturn = structuredClone(actor.queuedWaypoints[0]);
    assert.equal(acceptedReturn.destination, 3234);
    const returnPoint = r.point(acceptedReturn.destination);
    assert.deepEqual(returnPoint, { x: 18.5, z: 1.5 });
    const query = position => createOrdinaryMilitaryEndpointAvailability({ units: r.units,
      width: map.width, height: map.height, maxUnits: 2000 })
      .check({ team, position, radius: .18 });
    const pose = u => ({ id: u.id, x: u.x, z: u.z, generation: u.generation,
      revision: u.orderRevision, goal: u.moveGoalCell, pathIndex: u.pathIndex,
      pathLength: u.path.length, planningPending: u.movePlanningPending,
      buildingTargetId: u.buildingTargetId, queuedDestination: u.queuedWaypoints[0]?.destination ?? null });
    const events = [], add = (kind, extra = {}) => events.push({ kind, tick: r.tick,
      worker: pose(worker), military: pose(actor), availabilityAtReturn: query(returnPoint), ...extra });
    add('return-accepted-as-future');
    const futureAvailability = query(returnPoint);
    for (let i = 0; i < 15; i++) r.step();
    const beforeWood = r.wood[team], beforeNav = r.navigationRevision;
    const points = [{ column: 61, row: 32 }, { column: 67, row: 32 }];
    order({ type: 'buildWall', ids: [worker.id], unitGenerations: [worker.generation], points });
    assert.equal(r.buildings.length, 7); assert.equal(r.navigationRevision, beforeNav + 1);
    assert.equal(r.wood[team], beforeWood - 7 * BUILDING_DEFINITIONS['palisade-wall'].cost.wood);
    assert.deepEqual(r.units.filter(u => u.buildingTargetId !== null).map(u => u.id), [worker.id]);
    assert.deepEqual(army.map(u => u.moveGoalCell), firstGoals);
    assert.deepEqual(army.map(u => u.queuedWaypoints[0].destination), requested);
    add('paid-wall-command', { woodBefore: beforeWood, woodAfter: r.wood[team] });
    const sites = r.buildings.slice(), completions = [];
    let returnActivationTick = null, finalWorkTick = null, finalWorkBeforeTick = null, parkingTick = null, parkedIntent = null;
    let workTargetClearTick = null, allSitesCompleteTick = null, currentAvailability = null;
    const intent = u => ({ x: u.x, z: u.z, generation: u.generation, revision: u.orderRevision,
      goal: u.moveGoalCell, path: [...u.path], pathIndex: u.pathIndex,
      queue: structuredClone(u.queuedWaypoints), holding: u.holdingPosition,
      buildingTargetId: u.buildingTargetId, wallBuildOrder: structuredClone(u.wallBuildOrder),
      workIntent: structuredClone(u.workIntent) });
    const untouchedWorkers = r.units.filter(u => u.kind === 'worker' && u.id !== worker.id);
    const untouchedBefore = untouchedWorkers.map(intent);
    const trace = createHash('sha256');
    const done = u => !u.queuedWaypoints.length && !u.movePlanningPending && u.pathIndex === u.path.length
      && Math.hypot(u.x - r.point(u.moveGoalCell).x, u.z - r.point(u.moveGoalCell).z) < .02;
    while (r.tick < 2700) {
      const progress = sites.map(b => b.progress), queued = actor.queuedWaypoints.length;
      const hadTarget = worker.buildingTargetId !== null;
      const beforeTick = { tick: r.tick, worker: pose(worker), military: pose(actor) };
      r.step();
      for (let i = 0; i < sites.length; i++) if (sites[i].progress > progress[i]) {
        finalWorkTick = r.tick; finalWorkBeforeTick = beforeTick;
        if (sites[i].complete && progress[i] < 1) {
          completions.push({ id: sites[i].id, tick: r.tick, x: sites[i].x, z: sites[i].z });
          add('site-completed', { siteId: sites[i].id, siteProgress: sites[i].progress });
        }
      }
      if (hadTarget && worker.buildingTargetId === null) {
        workTargetClearTick = r.tick; add('work-target-cleared');
      }
      if (allSitesCompleteTick === null && sites.every(b => b.complete)) {
        allSitesCompleteTick = r.tick; add('all-sites-complete');
      }
      if (queued && !actor.queuedWaypoints.length) {
        returnActivationTick = r.tick;
        assert.equal(actor.moveGoalCell, acceptedReturn.destination, 'walkable accepted return is exact');
        currentAvailability = query(returnPoint); add('return-activated');
      }
      if (parkingTick === null && sites.every(b => b.complete) && worker.buildingTargetId === null
        && !worker.movePlanningPending && worker.pathIndex === worker.path.length) {
        parkingTick = r.tick; add('builder-parked');
        // Work-intent cleanup occurs at the next unchanged construction phase.
      }
      if (parkingTick !== null && !worker.wallBuildOrder && !worker.workIntent && !parkedIntent) {
        parkedIntent = intent(worker); add('parked-intent-settled');
      }
      if (parkedIntent) assert.deepEqual(intent(worker), parkedIntent, 'subsequent military intent never shoves the idle builder');
      assert.deepEqual(untouchedWorkers.map(intent), untouchedBefore, 'construction stays selected-Worker-only');
      assert.ok(army.every(u => u.hp === 100));
      if (actor.queuedWaypoints.length) assert.deepEqual(actor.queuedWaypoints[0], acceptedReturn,
        'full accepted queue record survives until original activation');
      else assert.equal(actor.moveGoalCell, acceptedReturn.destination, 'no accepted return replacement');
      trace.update(JSON.stringify([r.tick,pose(worker),pose(actor),sites.map(b => b.progress)]) + '\n');
    }
    assert.equal(r.wood[team], beforeWood - 7 * BUILDING_DEFINITIONS['palisade-wall'].cost.wood,
      'paid wall costs once and receives no invented refund');
    assert.ok(parkingTick !== null && finalWorkTick !== null && returnActivationTick !== null);
    assert.ok(parkedIntent); assert.equal(completions.length, 7);
    add('original-deadline', { arrived: army.filter(done).length, total: army.length });
    return { status: 'chronology-observed', sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      sourceDirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '',
      sourceServerSha256: fixture.sourceSha256, map: { id: map.id, width: map.width, height: map.height },
      orders, workerId: worker.id, actorId: actor.id, returnPoint, acceptedReturnCell: acceptedReturn.destination,
      futureAvailability, currentAvailability, finalWorkTick, finalWorkBeforeTick, workTargetClearTick, allSitesCompleteTick,
      parkingTick, returnActivationTick, parkingPrecedesActivation: parkingTick < returnActivationTick,
      workerParkedAtReturn: worker.x === returnPoint.x && worker.z === returnPoint.z,
      originalDeadlineTick: r.tick, militaryArrived: done(actor), formationArrived: army.filter(done).length,
      workerIdleIntentPreserved: true, militaryExactGoalAndQueuePreserved: true, paidWood: beforeWood - r.wood[team],
      completions, events, traceSha256: trace.digest('hex'),
      limits: ['one public-source real-command fixed-tick fixture; no native transport, cold checkpoint transfer, render or full-batch claim',
        'future query observations are fresh uses of the production pure helper; no injected construction policy'] };
  } finally { await fixture.dispose(); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const output = process.argv[2];
  if (!output || process.argv.length !== 3) throw new Error('Usage: node scripts/construction-queued-first-wall.mjs OUTPUT.json');
  const result = await runConstructionQueuedFirstWall();
  await writeFile(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ parkingTick: result.parkingTick, finalWorkTick: result.finalWorkTick,
    returnActivationTick: result.returnActivationTick, workerParkedAtReturn: result.workerParkedAtReturn,
    future: result.futureAvailability.status, current: result.currentAvailability.status,
    formationArrived: result.formationArrived, trace: result.traceSha256 }));
}
