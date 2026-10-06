import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { canTraverseCrowdBodySegment } from '../src/unit-crowd-steering.mjs';
import { canTraverseStaticBodySegment, LAND_CLEARANCE_PROFILE } from '../src/unit-movement.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { combatDamage } from '../src/combat-rules.mjs';

// Original eight real-command witnesses; observe unchanged production bodies.
// No pose/HP/route/checkpoint mutation or neighbor/admission override.
export async function observeWorkerPatrolAcquiredBodyPairs({ team, cold, ending }) {
  assert.ok([0, 1].includes(team)); assert.ok(['kill', 'loss'].includes(ending));
  process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp'; process.env.RTS_PREGAME = '0';
  process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '1'; delete process.env.RTS_MATCH_STATE_PATH;
  const map = { id: 'worker-patrol-acquired-pairs', name: 'Acquired Worker Patrol body pairs',
    width: 64, height: 48, terrainSeed: 881, fogOfWar: false, startingArmySize: 16,
    startingResources: { food: 800, wood: 2000 },
    spawnPoints: [{ team: 0, x: -20, z: -16 }, { team: 1, x: 20, z: 16 }],
    resourceNodes: [], triggers: [], scenarioEvents: [],
    obstacles: [{ column: 33, row: 25, width: 1, height: 1, material: 'stone' }] };
  const observation = { traceLandSteps: true, tracePatrolAcquiredSteps: true, traceActorIds: [0, 8] };
  let f = await createPathingReplayFixture(map, observation), r = f.replay;
  const id = r.units.find(u => u.team === team && u.kind === 'worker').id;
  const targetId = r.units.find(u => u.team !== team && u.kind === 'worker').id;
  const parkedId = r.units.find(u => u.team === team && u.kind === 'infantry').id;
  const actor = () => r.units[id], target = () => r.units[targetId];
  const result = { team, cold, ending, actor: id, target: targetId, parked: parkedId, orders: [],
    acquiredSteps: 0, strictStaticFailures: 0, pairAdmissionFailures: 0, newPairContacts: 0,
    samples: [], reasons: {}, acquiredWaits: 0, firstWait: null, lastVector: null, hits: 0, restored: false };
  function command(selected, type, fields = {}) {
    const seat = r.units[selected].team, packet = { type, ids: [selected], unitGenerations: [r.units[selected].generation], ...fields };
    const notices = r.order(seat, packet); assert.ok(notices.length && notices.every(n => !/FAILED|REJECTED/.test(n.message)));
    result.orders.push({ tick: r.tick, seat, ...packet });
  }
  let parkedPose, unchanged;
  function step() {
    const hp = target().hp, distance = Math.hypot(actor().x - target().x, actor().z - target().z);
    r.step();
    if (actor().attackTargetId === targetId) {
      const vector = r.actorTrace.findLast(s => s.id === id && s.type === 'vector');
      if (vector) result.lastVector = vector;
      if (vector?.result?.waitingForCrowd) {
        result.acquiredWaits++;
        result.firstWait ??= vector;
      }
    }
    for (const s of r.landSteps.filter(s => s.id === id && s.patrolAcquired)) {
      result.acquiredSteps++; result.reasons[s.reason] = (result.reasons[s.reason] ?? 0) + 1; assert.equal(s.attackTargetId, targetId); assert.equal(s.bodyRadius, .18);
      assert.ok(s.neighbours.length <= 64); assert.ok(Math.hypot(s.to.x - s.from.x, s.to.z - s.from.z) <= .25 + 1e-9);
      const staticAllowed = canTraverseStaticBodySegment(s.from, s.to, .18, 64, 48, r.isWalkable);
      result.strictStaticFailures += Number(!staticAllowed);
      const offenders = s.neighbours.filter(n => !canTraverseCrowdBodySegment(s.from, s.to, .18, [n], { allowEscape: true }));
      assert.equal(canTraverseCrowdBodySegment(s.from, s.to, .18, s.neighbours, { allowEscape: true }),
        offenders.length === 0, 'aggregate oracle agrees with individual live bodies');
      const newContacts = offenders.filter(n => Math.hypot(s.from.x - n.x, s.from.z - n.z)
        >= .18 + LAND_CLEARANCE_PROFILE.radiusByKind[n.kind] - 1e-9);
      result.pairAdmissionFailures += Number(offenders.length > 0); result.newPairContacts += newContacts.length;
      if (offenders.length && result.samples.length < 8) result.samples.push({ tick: s.tick, revision: s.revision,
        from: s.from, to: s.to, reason: s.reason, bodyRadius: s.bodyRadius, staticAllowed,
        patrol: s.patrol, anchor: s.anchor, offenders: offenders.map(n => ({ ...n, newContact: newContacts.includes(n) })) });
    }
    if (parkedPose) assert.deepEqual([r.units[parkedId].x, r.units[parkedId].z], parkedPose, 'parked actor stays immovable');
    if (target().hp < hp) {
      assert.ok(distance <= UNIT_DEFINITIONS.worker.combat.range + 1e-8);
      assert.equal(hp - target().hp, Math.min(hp, combatDamage(UNIT_DEFINITIONS.worker, UNIT_DEFINITIONS.worker)));
      result.hits++;
    }
  }
  function until(condition, bound) { for (let i = 0; i < bound && !condition(); i++) step(); assert.ok(condition(), 'original policy bound ' + bound); }
  async function restore() {
    const saved = r.checkpoint(); assert.ok(r.validate(structuredClone(saved)));
    const before = structuredClone(saved.state.units[id]);
    await f.dispose(); f = await createPathingReplayFixture(map, observation); r = f.replay;
    assert.ok(r.validate(structuredClone(saved))); r.restore(structuredClone(saved));
    for (const key of ['generation','orderRevision','moveGoalCell','attackTargetId','attackMoveAnchorX','attackMoveAnchorZ',
      'attackMoveResumePath','attackMoveResumePathIndex','persistentOrder','queuedWaypoints','combatStance','cargo','workIntent']) assert.deepEqual(actor()[key], before[key], key);
    result.restored = true;
  }
  try {
    for (const seat of [0,1]) {
      r.order(seat, { type: 'stop', ids: r.units.filter(u => u.team === seat).map(u => u.id) });
      r.order(seat, { type: 'setStance', stance: 'noAttack', ids: r.units.filter(u => u.team === seat && u.kind === 'infantry').map(u => u.id) });
    }
    command(id, 'move', { x: .79, z: .95 }); command(targetId, 'move', { x: 5.5, z: .5 });
    command(parkedId, 'move', { x: 2.5, z: .5 });
    until(() => [actor(),target(),r.units[parkedId]].every(u => !u.movePlanningPending && u.pathIndex === u.path.length), 1000);
    command(targetId, 'stop'); command(parkedId, 'stop'); parkedPose = [r.units[parkedId].x, r.units[parkedId].z];
    assert.deepEqual(parkedPose, [2.5, .5]);
    unchanged = r.units.filter(u => ![id,targetId].includes(u.id)).map(u => [u.id,u.x,u.z,u.orderRevision,u.hp,u.cargo]);
    command(id, 'patrol', { x: 6.5, z: .5 }); const order = structuredClone(actor().persistentOrder);
    until(() => actor().attackTargetId === targetId, 1000); const goal = actor().moveGoalCell;
    const anchor = [actor().attackMoveAnchorX,actor().attackMoveAnchorZ];
    if (cold) await restore();
    if (ending === 'loss') {
      command(targetId, 'move', { x: 24.5, z: 16.5 }); until(() => actor().attackTargetId < 0, 1200);
      assert.ok(target().hp > 0); assert.equal(actor().moveGoalCell,goal); assert.equal(actor().path.at(-1),goal);
      assert.equal(actor().attackMoveResumePath,null); assert.deepEqual([actor().attackMoveAnchorX,actor().attackMoveAnchorZ],anchor); await restore();
    } else {
      until(() => target().hp <= 0, 1600); assert.ok(result.hits > 0); until(() => actor().attackTargetId < 0, 1000);
      let switches=0, leg=actor().persistentOrder.leg;
      until(() => { const next=actor().persistentOrder.leg; if(next!==leg){switches++;leg=next;} return switches>=2; },1800);
    }
    assert.deepEqual([actor().persistentOrder.start,actor().persistentOrder.end],[order.start,order.end]);
    assert.equal(actor().hp,100); assert.equal(actor().combatStance,null);
    assert.deepEqual(r.units.filter(u => ![id,targetId].includes(u.id)).map(u => [u.id,u.x,u.z,u.orderRevision,u.hp,u.cargo]),unchanged);
    assert.ok(result.acquiredSteps > 0); result.policy='passed original kill/loss/continuation/recovery bounds';
    return result;
  } catch (error) {
    result.failure = { message: error.message, tick: r.tick,
      actor: structuredClone(actor()), target: structuredClone(target()),
      parked: structuredClone(r.units[parkedId]) };
    error.observation = result;
    throw error;
  } finally { await f.dispose(); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    sourceDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()),
    serverSha256: createHash('sha256').update(await readFile(new URL('../server.mjs', import.meta.url))).digest('hex'),
    adapterSha256: createHash('sha256').update(await readFile(new URL('./pathing-replay-fixture.mjs', import.meta.url))).digest('hex'),
    records: [], status: 'running',
    limits: ['eight original both-seat warm/fresh-module acquired kill/loss cases with a commanded parked Infantry',
      'live serial pre-write neighbors; no pose/HP/path/target/checkpoint modifications or body admission override',
      'same-cell combat observations counted separately; no construction/wall/native-substep/package/render claim'] };
  for (const team of [0, 1]) for (const cold of [false, true]) for (const ending of ['kill', 'loss']) {
    try { report.records.push(await observeWorkerPatrolAcquiredBodyPairs({ team, cold, ending })); }
    catch (error) {
      report.records.push(error.observation ?? { team, cold, ending, failure: { message: error.stack } });
    }
  }
  report.status = report.records.some(r => r.failure) ? 'failed-policy-or-harness'
    : report.records.every(r => r.pairAdmissionFailures === 0 && r.newPairContacts === 0
      && r.strictStaticFailures === 0) ? 'passed' : 'failed-body-pair-qualification';
  if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  if (report.status !== 'passed') process.exitCode = 1;
}
