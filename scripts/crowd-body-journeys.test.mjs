import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { LAND_BODY_CASES, runLandBodyCase, configureLandBodyReplay } from './land-body-clearance-fixture.mjs';
import { runCrowdPassageJourney } from './crowd-body-journeys.mjs';
import { forestGapMap } from './forest-gap-fixture.mjs';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { pathingBaselineMap } from './pathing-baseline-cases.mjs';
import { canTraverseCrowdBodySegment } from '../src/unit-crowd-steering.mjs';
import { canTraverseStaticBodySegment, LAND_CLEARANCE_PROFILE } from '../src/unit-movement.mjs';
import { sweptBodyPairMargin } from './land-body-clearance.mjs';

test('paid-obstruction followers leave the reproduced choke deadlock within the original 1000 ticks', async () => {
  configureLandBodyReplay();
  const map = pathingBaselineMap({ group: 64, kind: 'dynamic-goal' });
  const f = await createPathingReplayFixture(map, { traceLandSteps: true }), r = f.replay;
  try {
    const army = r.units.filter(u => u.team === 0 && u.kind === 'infantry');
    const ids = new Set(army.map(u => u.id)), tail = army.slice(0, 3), tailIds = new Set(tail.map(u => u.id));
    const worker = r.units.find(u => u.team === 0 && u.kind === 'worker');
    r.order(0, { type: 'move', ids: [...ids], x: 16.5, z: .5 }); r.drain();
    for (let tick = 0; tick < 15; tick++) r.step();
    const intent = tail.map(u => ({ generation: u.generation, revision: u.orderRevision,
      goal: u.moveGoalCell, queue: structuredClone(u.queuedWaypoints) }));
    const inactive = r.units.filter(u => !ids.has(u.id) && u !== worker);
    const poses = inactive.map(u => ({ x: u.x, z: u.z, hp: u.hp, generation: u.generation,
      revision: u.orderRevision, goal: u.moveGoalCell, queue: structuredClone(u.queuedWaypoints) }));
    const notices = r.order(0, { type: 'build', ids: [worker.id], buildingType: 'house', x: 16.5, z: .5 }); r.drain();
    assert.ok(notices.some(n => n.message.startsWith('BUILD ORDER')), JSON.stringify(notices));
    let observed = 0;
    // Preserve the registered paid-obstruction journey's commands, roster and
    // pending-aware deadline. This slice proves progress past the original
    // choke deadlock; the unchanged full arrival assertions remain separate.
    for (let tick = 0; tick < 1000 && army.some(u => u.movePlanningPending || u.pathIndex < u.path.length); tick++) {
      r.step();
      for (const step of r.landSteps.filter(s => tailIds.has(s.id))) {
        observed++;
        assert.ok(canTraverseStaticBodySegment(step.from, step.to, .22, map.width, map.height, r.isWalkable));
        // The separately controlled builder can enter an actor's body before
        // this write. Preserve the existing monotone inherited-contact escape;
        // every previously clear pair must still have a clear swept segment.
        const nearby = step.neighbours.filter(other => {
          const radius = LAND_CLEARANCE_PROFILE.radiusByKind[other.kind];
          assert.ok(Number.isFinite(radius));
          const inherited = Math.hypot(step.from.x - other.x, step.from.z - other.z) < .22 + radius - 1e-9;
          if (!inherited) assert.ok(sweptBodyPairMargin(step, .22, other, radius) >= -1e-9);
          return Math.hypot(step.from.x - other.x, step.from.z - other.z) <= .25 + .22 + radius;
        });
        assert.ok(canTraverseCrowdBodySegment(step.from, step.to, .22, nearby, { allowEscape: true }));
      }
      assert.deepEqual(inactive.map(u => ({ x: u.x, z: u.z, hp: u.hp, generation: u.generation,
        revision: u.orderRevision, goal: u.moveGoalCell, queue: structuredClone(u.queuedWaypoints) })), poses);
    }
    assert.ok(observed > 0, 'physical evidence observes the actual server position writes');
    for (let i = 0; i < tail.length; i++) {
      const u = tail[i];
      assert.ok(u.x > 1.22, 'each original stalled actor crosses completely beyond the wall');
      assert.equal(u.generation, intent[i].generation); assert.equal(u.moveGoalCell, intent[i].goal);
      assert.deepEqual(u.queuedWaypoints, intent[i].queue);
      assert.ok(u.orderRevision - intent[i].revision <= 10, 'existing static repairs remain bounded');
    }
  } finally { await f.dispose(); }
});

const retained = JSON.parse(gunzipSync(await readFile(new URL(
  '../docs/qa-evidence/ordinary-move-static-clearance-2026-10-04/substeps.json.gz', import.meta.url))));
for (const spec of LAND_BODY_CASES.filter(s => s.scene === 'forest'))
  test(`${spec.id}: retained physical input now arrives without terrain/body penetration`, async () => {
    const record = retained.records.find(r => r.id === spec.id);
    const run = await runLandBodyCase(spec, { initialCheckpoint: record.initialCheckpoint, maxTicks: 900 });
    assert.equal(run.initialCheckpointSha256, record.runs[0].initialCheckpointSha256);
    assert.equal(run.navigationMaskSha256, record.runs[0].navigationMaskSha256);
    assert.equal(run.arrived, run.actors.length); assert.equal(run.staticContactSteps, 0);
    assert.equal(run.pairContactSteps, 0); assert.equal(run.unobservedPositionMutations, 0);
    assert.ok(run.actors.every(u => u.crossedTick > 0
      && u.finalRevision - u.initialRevision <= 10 && u.finalGoalCell === u.goalCell),
    'bounded existing static repair retains each selected destination');
    const last = team => Math.max(...run.actors.filter(u => u.team === team).map(u => u.arrivalTick));
    assert.ok(Math.abs(last(0) - last(1)) <= 150, 'both seats receive bounded passage service');
  });

for (const scene of ['bridge', 'gate']) for (const mirror of [false, true])
  test(`${scene}: two real 16-unit Moves repeat with exact goals, mirror=${mirror}`, async () => {
    let initialCheckpoint;
    const options = { scene, group: 16, ownerTeam: Number(mirror), mirror };
    const first = await runCrowdPassageJourney({ ...options, captureInput: p => { initialCheckpoint = p; } });
    const second = await runCrowdPassageJourney({ ...options, initialCheckpoint });
    const { setup: firstSetup, ...a } = first, { setup: secondSetup, ...b } = second;
    assert.deepEqual(b, a, 'exact retained input, serial sweeps, revisions and accepted goals repeat');
    assert.equal(first.arrived, 32); assert.equal(first.staticContacts, 0); assert.equal(first.pairContacts, 0);
    assert.ok(first.states.every(s => s.crossingTick > 0 && s.maxNoProgressTicks <= 360
      && s.orderRevision - s.initialRevision <= 10 && s.publishedRouteChanges <= 11),
    'bounded progress and static route repairs, including the initial publication');
    const last = team => Math.max(...first.states.filter(s => s.team === team).map(s => s.arrivalTick));
    assert.ok(Math.abs(last(0) - last(1)) <= 150, 'seat identity does not starve the later serial side');
    if (scene === 'gate') assert.deepEqual(first.gateReceipt,
      { id: first.gateReceipt.id, team: Number(mirror), woodDebit: 15, complete: true, open: true });
  });

for (const team of [0, 1]) test(`paid gate seat ${team}: Stop replacement and mid-journey checkpoint resume stay physical`, async () => {
  const run = await runCrowdPassageJourney({ scene: 'gate', ownerTeam: team, mirror: Boolean(team),
    group: 1, interrupt: true, recoverAt: 100 });
  assert.equal(run.arrived, 2); assert.equal(run.staticContacts, 0); assert.equal(run.pairContacts, 0);
  assert.ok(run.states.every(s => s.crossingTick > 0 && s.maxNoProgressTicks <= 120));
  assert.ok(run.commands.filter(c => c.packet.type === 'stop').length === 2);
});

for (const team of [0, 1]) test(`seat ${team}: occupied queued endpoint resumes after the parked actor receives its own Move`, async () => {
  const map = forestGapMap({ group: 1 }), f = await createPathingReplayFixture(map, { traceLandSteps: true }), r = f.replay;
  try {
    for (const seat of [0, 1]) {
      const own = r.units.filter(u => u.team === seat);
      r.order(seat, { type: 'stop', ids: own.map(u => u.id), unitGenerations: own.map(u => u.generation) });
      r.order(seat, { type: 'setStance', stance: 'noAttack', ids: own.filter(u => u.kind !== 'worker').map(u => u.id) });
    }
    let mover = r.units.find(u => u.kind === 'infantry' && u.team === team);
    let parked = r.units.find(u => u.kind === 'infantry' && u.team !== team);
    Object.assign(mover, { x: -8.5, z: .5 }); Object.assign(parked, { x: -6.5, z: .5 });
    const placed = r.checkpoint(); assert.ok(r.validate(placed)); r.restore(placed);
    mover = r.units[mover.id]; parked = r.units[parked.id];
    const send = (u, x, z, queue = false) => {
      const notices = r.order(u.team, { type: 'move', ids: [u.id], unitGenerations: [u.generation], x, z, queue }); r.drain();
      assert.ok(notices.some(n => /MOVE ORDER|WAYPOINT|PLANNING MOVE/.test(n.message)));
    };
    send(mover, -6.5, .5); send(mover, -5.5, 2.5, true);
    const revision = mover.orderRevision, retainedPath = [...mover.path], immutable = structuredClone(parked);
    for (let tick = 0; tick < 60; tick++) {
      r.step(); assert.deepEqual(parked, immutable); assert.equal(mover.orderRevision, revision);
      assert.deepEqual(mover.path, retainedPath); assert.equal(mover.queuedWaypoints.length, 1);
      assert.ok(Math.hypot(mover.x - parked.x, mover.z - parked.z) >= .44 - 1e-9);
    }
    send(parked, -6.5, -2.5);
    let handedOff = false;
    for (let tick = 0; tick < 360; tick++) {
      const queued = mover.queuedWaypoints.length; r.step();
      for (const step of r.landSteps) {
        assert.ok(canTraverseStaticBodySegment(step.from, step.to, .22, map.width, map.height, r.isWalkable));
        assert.ok(canTraverseCrowdBodySegment(step.from, step.to, .22, step.neighbours));
      }
      if (queued && !mover.queuedWaypoints.length) {
        assert.deepEqual([mover.x, mover.z], [-6.5, .5]); handedOff = true;
      }
      if (handedOff && mover.pathIndex === mover.path.length && parked.pathIndex === parked.path.length) break;
    }
    assert.ok(handedOff); assert.deepEqual([mover.x, mover.z], [-5.5, 2.5]);
    assert.deepEqual([parked.x, parked.z], [-6.5, -2.5]);
  } finally { await f.dispose(); }
});
