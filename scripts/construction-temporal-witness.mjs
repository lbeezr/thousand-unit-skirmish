import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pathingBaselineMap } from './pathing-baseline-cases.mjs';
import { createTemporalObserver } from './construction-temporal-observer.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
export const TEMPORAL_WITNESS_POLICY = Object.freeze({ team: 1, actorId: 75, group: 64,
  recoveryAge: 120, beforeTicks: 30, afterTicks: 30, originalDeadline: 2700, terrainSeed: 881 });
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');

// This command is deliberately opt-in, one scenario/one source/one actor. The
// ordinary test imports the retained public input; it never starts this run.
export async function captureConstructionTemporalWitness(output) {
  Object.assign(process.env, { RTS_MAP: 'maps/open-field.json', RTS_GAME_MODE: 'pvp', RTS_PREGAME: '0',
    RTS_MOVE_PLANNING_TURNS_PER_TICK: '0', RTS_TICK_DIAGNOSTICS: '1', RTS_SEPARATION_DIAGNOSTICS: '1' });
  delete process.env.RTS_MATCH_STATE_PATH;
  const policy = TEMPORAL_WITNESS_POLICY, map = pathingBaselineMap({ group: policy.group });
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const files = ['server.mjs','src/unit-crowd-steering.mjs','src/unit-movement.mjs','src/crowd-wait-lease.mjs',
    'src/crowd-parked-contour.mjs','src/construction-work-intent.mjs','scripts/pathing-replay-fixture.mjs',
    'scripts/pathing-baseline-cases.mjs','scripts/construction-temporal-observer.mjs',
    'scripts/construction-temporal-witness.mjs'];
  const source = { head: git('rev-parse','HEAD'), mainAtLaunch: git('rev-parse','origin/main'),
    trackedDirty: Boolean(git('status','--porcelain','--untracked-files=no')),
    sha256: Object.fromEntries(await Promise.all(files.map(async name =>
      [name, hash(await readFile(new URL(`../${name}`, import.meta.url), 'utf8'))]))) };
  assert.equal(source.trackedDirty, false, 'identify a committed harness before the single run');
  const report = { schema: 1, runId: `queued-wall-${source.mainAtLaunch.slice(0,8)}-${new Date().toISOString()}`,
    startedAt: new Date().toISOString(), node: process.version, source, policy, map, mapSha256: hash(map),
    status: 'starting', commands: [], trigger: null, history: [],
    limits: ['new current-source evidence; not reconstruction of any lost historical run',
      'canonical planning drain between real fixed ticks; no native scheduling, deployment or render claim',
      'only actor75 and its actual relevant live query/controller observations; no room checkpoint or secrets',
      'selector .02 best-distance credit age; actual committed travel is recorded independently',
      '2700 remains the original journey ceiling; first interval capture does not establish arrival acceptance'] };
  // Reserve the run receipt before creating the production fixture. A second
  // invocation cannot silently replace this evidence or regenerate this run.
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ launch: report.runId, source, policy, mapSha256: report.mapSha256 }));
  let fixture;
  try {
    fixture = await createTemporalObserver(map, { actorId: policy.actorId });
    const r = fixture.replay, observer = fixture.observed;
    const unit = r.units[policy.actorId];
    assert.equal(unit.team, policy.team); assert.equal(unit.kind, 'infantry');
    r.observeMovement(policy.team, [policy.actorId]);
    const order = (team, command) => {
      const notices = r.order(team, command); r.drain();
      report.commands.push({ tick: r.tick, team, command, notices }); return notices;
    };
    for (const team of [0,1]) {
      const army = r.units.filter(u => u.team === team && u.kind === 'infantry');
      assert.ok(order(team, { type:'setStance', ids:army.map(u=>u.id),
        unitGenerations:army.map(u=>u.generation), stance:'noAttack' }).some(n=>n.message.startsWith('STANCE ORDER')));
    }
    const army = r.units.filter(u => u.team === policy.team && u.kind === 'infantry'), ids = army.map(u=>u.id);
    assert.equal(army.length,64);
    order(policy.team,{type:'move',ids,x:-8.5,z:.5});
    order(policy.team,{type:'move',ids,x:16.5,z:.5,queue:true});
    assert.equal(new Set(army.map(u=>u.queuedWaypoints[0].destination)).size,64);
    report.initialActor = observer.replayActor(unit);
    report.initialActorSha256 = hash(report.initialActor);
    assert.ok(Array.from(r.levels).every(level=>level===0),'recorded geometry has zero elevation');
    const rows = [];
    while (r.tick < policy.originalDeadline && (!report.trigger || r.tick < report.trigger.tick + policy.afterTicks)) {
      if (r.tick === 15) {
        const worker = r.units.find(u=>u.team===policy.team&&u.kind==='worker'), beforeWood=r.wood[policy.team];
        assert.ok(order(policy.team,{type:'buildWall',ids:[worker.id],unitGenerations:[worker.generation],
          points:[{column:61,row:32},{column:67,row:32}]}).some(n=>n.message.startsWith('PALISADE LINE PLACED')));
        assert.equal(r.buildings.length,7);
        assert.equal(r.wood[policy.team],beforeWood-7*BUILDING_DEFINITIONS['palisade-wall'].cost.wood);
      }
      const before = observer.replayActor(unit); r.step();
      const frames = observer.drainReplayFrames();
      assert.ok(frames.every(frame=>frame.actor.id===policy.actorId),'single selected actor');
      const after = observer.replayActor(unit);
      const row = { tick:r.tick, navigationRevision:r.navigationRevision, before, after, frames,
        admissions:r.movementObservations(), substeps:r.landSteps.map(({neighbours,...step})=>step),
        blockedCells:r.buildings.flatMap(b=>b.footprint),
        wallProgress:r.buildings.map(b=>({id:b.id,progress:b.progress,complete:b.complete})) };
      rows.push(row);
      for (const frame of frames) {
        const age = frame.selection?.noProgressTicks;
        if (!report.trigger && age >= policy.recoveryAge && !unit.movePlanningPending && unit.pathIndex < unit.path.length) {
          report.trigger = { tick:r.tick, serialCall:frames.indexOf(frame), age,
            start:frame.afterState.lastProgressTick, generation:unit.generation, revision:unit.orderRevision,
            navigationRevision:r.navigationRevision, pathIndex:unit.pathIndex,
            selectedResult:frame.result };
          console.log(JSON.stringify({ trigger:report.trigger, retainedRows:rows.length }));
        }
      }
      const earliest = report.trigger ? report.trigger.start-policy.beforeTicks : r.tick-policy.recoveryAge-policy.beforeTicks;
      while(rows.length && rows[0].tick < earliest) rows.shift();
      // Save incrementally. A failed final summary cannot erase the temporal
      // observations, unlike the explicitly lost older report.
      if (r.tick % 30 === 0 || report.trigger) {
        report.status = 'capturing'; report.lastTick=r.tick; report.history=rows;
        await writeFile(output,JSON.stringify(report)+'\n');
      }
    }
    report.status = report.trigger ? 'captured' : 'no-qualifying-interval';
    report.lastTick = r.tick; report.history = rows; report.finishedAt = new Date().toISOString();
    report.finalActor = observer.replayActor(unit);
    await writeFile(output,JSON.stringify(report)+'\n');
    console.log(JSON.stringify({ completed:report.runId,status:report.status,tick:report.lastTick,
      rows:rows.length,trigger:report.trigger,sha256:hash(report),output }));
    return report;
  } catch (error) {
    report.status='failed'; report.error=String(error.stack??error);
    await writeFile(output,JSON.stringify(report)+'\n'); throw error;
  } finally { if(fixture) await fixture.dispose(); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv[2],'--capture','use explicit --capture OUTPUT; normal tests never start this reproduction');
  assert.ok(process.argv[3]); await captureConstructionTemporalWitness(process.argv[3]);
}
