import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { canTraverseStaticBodySegment, activeLandMovementBodyRadius } from '../src/unit-movement.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { combatDamage } from '../src/combat-rules.mjs';

// Characterization, not a safety pass. Observe the actual pre-write acquired
// state; no positions/HP/routes/targets/checkpoint fields are injected.
export async function observeWorkerPatrolAcquired({ team, ending, nearStone, cold }) {
  process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp';
  process.env.RTS_PREGAME = '0'; process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '1';
  delete process.env.RTS_MATCH_STATE_PATH;
  const map = { id: 'worker-patrol-acquired-clearance', name: 'Worker Patrol acquired clearance',
    width: 64, height: 48, terrainSeed: 881, fogOfWar: false, startingArmySize: 16,
    startingResources: { food: 800, wood: 2000 },
    spawnPoints: [{ team: 0, x: -20, z: -16 }, { team: 1, x: 20, z: 16 }],
    resourceNodes: [], triggers: [], scenarioEvents: [],
    obstacles: [{ column: 33, row: 25, width: 1, height: 1, material: 'stone' }] };
  let f = await createPathingReplayFixture(map, { traceLandSteps: true, tracePatrolAcquiredSteps: true }), r = f.replay;
  const id = r.units.find(u => u.team === team && u.kind === 'worker').id;
  const targetId = r.units.find(u => u.team !== team && u.kind === 'worker').id;
  const actor = () => r.units[id], target = () => r.units[targetId];
  const orders = [], samples = [], trace = createHash('sha256');
  let acquiredSteps = 0, unsafeSteps = 0, newContacts = 0, hits = 0, restored = false;
  const clear = (from, to) => canTraverseStaticBodySegment(from, to, .18, map.width, map.height, r.isWalkable);
  const command = (actorId, type, fields = {}) => {
    const seat = r.units[actorId].team;
    const command = { type, ids: [actorId], unitGenerations: [r.units[actorId].generation], ...fields };
    const notices = r.order(seat, command);
    assert.ok(notices.length && notices.every(n => !/REJECTED|FAILED/.test(n.message)), JSON.stringify(notices));
    orders.push({ tick: r.tick, seat, ...command });
  };
  const step = () => {
    const hp = target().hp, distance = Math.hypot(actor().x - target().x, actor().z - target().z);
    r.step();
    for (const s of r.landSteps.filter(s => s.id === id && s.patrolAcquired)) {
      assert.equal(s.attackTargetId, targetId); acquiredSteps++;
      const unsafe = !clear(s.from, s.to), contact = clear(s.from, s.from) && !clear(s.to, s.to);
      unsafeSteps += Number(unsafe); newContacts += Number(contact);
      const own = { tick: s.tick, revision: s.revision, from: s.from, to: s.to, reason: s.reason,
        bodyRadius: s.bodyRadius, patrol: s.patrol, stance: s.stance, anchor: s.anchor, unsafe, contact };
      trace.update(JSON.stringify(own) + '\n');
      if ((unsafe || contact) && samples.length < 8) samples.push(own);
    }
    if (target().hp < hp) {
      assert.ok(distance <= UNIT_DEFINITIONS.worker.combat.range + 1e-8, 'original productive reach');
      assert.equal(hp - target().hp, Math.min(hp, combatDamage(UNIT_DEFINITIONS.worker, UNIT_DEFINITIONS.worker)));
      hits++;
    }
  };
  const until = (condition, bound = 1000) => {
    for (let i = 0; i < bound && !condition(); i++) step();
    assert.ok(condition(), `original policy condition unmet after ${bound} ticks`);
  };
  const restore = async () => {
    const before = { goal: actor().moveGoalCell, order: structuredClone(actor().persistentOrder),
      target: actor().attackTargetId, anchor: [actor().attackMoveAnchorX, actor().attackMoveAnchorZ],
      resume: structuredClone(actor().attackMoveResumePath), resumeIndex: actor().attackMoveResumePathIndex,
      generation: actor().generation, revision: actor().orderRevision, queue: structuredClone(actor().queuedWaypoints),
      cargo: actor().cargo, work: structuredClone(actor().workIntent), stance: actor().combatStance };
    const saved = r.checkpoint(); assert.ok(r.validate(structuredClone(saved)));
    await f.dispose(); f = await createPathingReplayFixture(map, { traceLandSteps: true, tracePatrolAcquiredSteps: true }); r = f.replay;
    assert.ok(r.validate(structuredClone(saved))); r.restore(structuredClone(saved));
    assert.deepEqual({ goal: actor().moveGoalCell, order: actor().persistentOrder, target: actor().attackTargetId,
      anchor: [actor().attackMoveAnchorX, actor().attackMoveAnchorZ], resume: actor().attackMoveResumePath,
      resumeIndex: actor().attackMoveResumePathIndex, generation: actor().generation, revision: actor().orderRevision,
      queue: actor().queuedWaypoints, cargo: actor().cargo, work: actor().workIntent, stance: actor().combatStance }, before);
    restored = true;
  };
  try {
    for (const seat of [0, 1]) {
      const own = r.units.filter(u => u.team === seat);
      r.order(seat, { type: 'stop', ids: own.map(u => u.id) });
      r.order(seat, { type: 'setStance', stance: 'noAttack', ids: own.filter(u => u.kind === 'infantry').map(u => u.id) });
    }
    command(id, 'move', nearStone ? { x: .79, z: .95 } : { x: -8.5, z: -5.5 });
    command(targetId, 'move', nearStone ? { x: 5.5, z: .5 } : { x: -5.5, z: -4.5 });
    until(() => [actor(),target()].every(u => !u.movePlanningPending && u.pathIndex >= u.path.length));
    command(targetId, 'stop'); assert.ok(clear(actor(), actor()));
    const untouched = r.units.filter(u => ![id,targetId].includes(u.id))
      .map(u => [u.id,u.orderRevision,u.hp,u.cargo,u.x,u.z]);
    command(id, 'patrol', { x: 6.5, z: .5 });
    const patrol = structuredClone(actor().persistentOrder);
    until(() => actor().attackTargetId === targetId);
    assert.equal(actor().combatStance, null); assert.equal(actor().attackMove, true);
    const anchor = [actor().attackMoveAnchorX, actor().attackMoveAnchorZ], goal = actor().moveGoalCell;
    if (cold) await restore();
    if (ending === 'loss') {
      command(targetId, 'move', { x: 24.5, z: 16.5 });
      until(() => actor().attackTargetId < 0, 1200);
      assert.ok(target().hp > 0); assert.equal(actor().moveGoalCell, goal);
      assert.equal(actor().path.at(-1), goal); assert.equal(actor().attackMoveResumePath, null);
      assert.deepEqual([actor().attackMoveAnchorX, actor().attackMoveAnchorZ], anchor);
      await restore(); assert.equal(actor().attackTargetId, -1);
    } else {
      until(() => target().hp <= 0, 1600); assert.ok(hits > 0);
      until(() => actor().attackTargetId < 0);
      let switches = 0, leg = actor().persistentOrder.leg;
      until(() => { const next = actor().persistentOrder.leg; if (next !== leg) { switches++; leg = next; } return switches >= 2; }, 1800);
    }
    assert.deepEqual([actor().persistentOrder.start,actor().persistentOrder.end], [patrol.start,patrol.end]);
    assert.equal(activeLandMovementBodyRadius(actor()), .18); assert.equal(actor().hp, 100);
    assert.deepEqual(r.units.filter(u => ![id,targetId].includes(u.id)).map(u => [u.id,u.orderRevision,u.hp,u.cargo,u.x,u.z]), untouched);
    assert.ok(acquiredSteps > 0, 'observe actual acquired substeps, not only target-free travel');
    return { team, ending, nearStone, cold, orders, acquiredSteps, unsafeSteps, newContacts, hits,
      restored, patrolCells: [patrol.start,patrol.end], samples, traceSha256: trace.digest('hex'),
      outcome: 'original policy/retention conditions met; clearance measured separately' };
  } finally { await f.dispose(); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 3, 'Usage: node scripts/worker-patrol-acquired-clearance.mjs OUTPUT.json');
  const records = [];
  for (const team of [0,1]) for (const nearStone of [false,true]) for (const ending of ['kill','loss']) {
    records.push(await observeWorkerPatrolAcquired({ team, nearStone, ending, cold: true }));
  }
  const server = await readFile(new URL('../server.mjs', import.meta.url));
  await writeFile(process.argv[2], JSON.stringify({ source: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    dirty: execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim() !== '',
    serverSha256: createHash('sha256').update(server).digest('hex'), records,
    limits: ['eight public-source Patrol-only command journeys, no synthetic state/route/HP patches',
      'fresh-server fixed-tick recovery; native process, full suite and rendered acceptance OPEN',
      'all acquired steps classified at actual pre-write state; diagnostic exit0 is not clearance acceptance'] },null,2)+'\n');
  console.log(JSON.stringify(records.map(({team,nearStone,ending,acquiredSteps,unsafeSteps,newContacts})=>({team,nearStone,ending,acquiredSteps,unsafeSteps,newContacts}))));
}
