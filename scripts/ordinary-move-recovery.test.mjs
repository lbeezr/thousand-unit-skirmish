import assert from 'node:assert/strict';
import test from 'node:test';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { configureLandBodyReplay } from './land-body-clearance-fixture.mjs';
import { forestGapMap } from './forest-gap-fixture.mjs';
import { runCrowdPassageJourney } from './crowd-body-journeys.mjs';
import { canTraverseStaticBodySegment, LAND_CLEARANCE_PROFILE } from '../src/unit-movement.mjs';
import { sweptBodyPairMargin } from './land-body-clearance.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { selectCrowdStep, CROWD_PROPOSAL_LIMIT } from '../src/unit-crowd-steering.mjs';
import { beginOrdinaryMoveRecovery, ordinaryMoveRecoveryDecision,
  finalizeOrdinaryMoveProgress } from '../src/ordinary-move-recovery.mjs';

// New authored host control, not a replay of the held recovery-producer model.
// Two .35-radius bodies cannot pass in this closed one-tile corridor. All orders,
// recovery decisions, route publications and position writes use the actual host.
async function corridor() {
  configureLandBodyReplay();
  const map = forestGapMap({ group: 1 }); map.id = 'ordinary-recovery-closed-corridor';
  map.obstacles = [
    { id: 'north', column: 16, row: 20, width: 32, height: 4, material: 'stone' },
    { id: 'south', column: 16, row: 25, width: 32, height: 4, material: 'stone' },
    { id: 'west', column: 16, row: 24, width: 1, height: 1, material: 'stone' },
    { id: 'east', column: 47, row: 24, width: 1, height: 1, material: 'stone' },
  ];
  const fixture = await createPathingReplayFixture(map, { traceLandSteps: true });
  const r = fixture.replay;
  for (const team of [0, 1]) r.order(team, { type: 'stop', ids: r.units.filter(u => u.team === team).map(u => u.id) });
  for (const u of r.units.filter(u => u.kind === 'infantry')) {
    Object.assign(u, { kind: 'siege-engine', hp: UNIT_DEFINITIONS['siege-engine'].combat.maxHp,
      x: u.team ? 1.5 : -.5, z: .5 });
    r.order(u.team, { type: 'setStance', ids: [u.id], stance: 'noAttack' });
  }
  const placed = r.checkpoint(); assert.ok(r.validate(placed)); r.restore(placed);
  const actors = r.units.filter(u => u.kind === 'siege-engine');
  const ids = new Set(actors.map(u => u.id));
  const send = (u, x, queue = false) => {
    const notices = r.order(u.team, { type: 'move', ids: [u.id], unitGenerations: [u.generation], x, z: .5, queue });
    r.drain(); assert.ok(notices.some(n => /MOVE ORDER|WAYPOINT|PLANNING MOVE/.test(n.message)), JSON.stringify(notices));
  };
  for (const u of actors) send(u, u.team ? -10.5 : 10.5);
  const selected = team => r.units[actors.find(u => u.team === team).id];
  const step = () => {
    r.step();
    for (const s of r.landSteps.filter(s => ids.has(s.id))) {
      const radius = LAND_CLEARANCE_PROFILE.radiusByKind[s.kind];
      assert.ok(canTraverseStaticBodySegment(s.from, s.to, radius, map.width, map.height, r.isWalkable));
      for (const other of s.neighbours) assert.ok(sweptBodyPairMargin(s, radius, other,
        LAND_CLEARANCE_PROFILE.radiusByKind[other.kind]) >= -1e-9, 'every admitted sweep preserves body clearance');
    }
  };
  const done = (u, x) => !u.movePlanningPending && u.pathIndex === u.path.length
    && !u.queuedWaypoints.length && Math.hypot(u.x - x, u.z - .5) < .02;
  return { fixture, r, selected, send, step, done };
}

test('fourteen real 60-tick windows end in passage or explicit unresolved; queued intent stays live', async () => {
  const c = await corridor(), { r, selected, send, step, done } = c;
  try {
    const loser = selected(1); send(loser, -12.5, true);
    const intent = { revision: loser.ordinaryMoveRecovery.intentRevision, goal: loser.moveGoalCell,
      point: structuredClone(loser.moveGoalPoint), queue: structuredClone(loser.queuedWaypoints) };
    for (let cycle = 0; cycle < 14; cycle++) for (let tick = 0; tick < 60; tick++) step();
    assert.ok(done(selected(0), 10.5), 'reachable winning actor arrives rather than reporting unresolved as arrival');
    assert.equal(loser.ordinaryMoveRecovery.portals, 0);
    assert.equal(loser.ordinaryMoveRecovery.progressTick, 0);
    assert.equal(loser.ordinaryMoveRecovery.intentRevision, intent.revision);
    assert.equal(loser.moveGoalCell, intent.goal); assert.deepEqual(loser.moveGoalPoint, intent.point);
    assert.deepEqual(loser.queuedWaypoints, intent.queue); assert.ok(loser.pathIndex < loser.path.length);
    const own = r.snapshot(1).blockedMoves;
    assert.deepEqual(own, [[loser.id, loser.generation, 'temporarily-blocked', 'recovery-unresolved', loser.ordinaryMoveRecovery.blockedTick]]);
    assert.deepEqual(r.snapshot(0).blockedMoves, [], 'enemy blockers and their state are not published to the other seat');
    const broadcast = r.broadcastFrames();
    const decode = frame => JSON.parse(frame.subarray(frame[1] === 127 ? 10 : frame[1] === 126 ? 4 : 2).toString());
    assert.deepEqual(decode(broadcast.get(0)).blockedMoves, [], 'actual no-fog broadcast masks the enemy row');
    assert.deepEqual(decode(broadcast.get(1)).blockedMoves, own);
    assert.deepEqual(decode(broadcast.get(null)).blockedMoves, own, 'spectator preserves its full permitted view');
    assert.ok(loser.ordinaryMoveRecovery.episodes <= 3);
    const beforeEdit = structuredClone(loser.ordinaryMoveRecovery), beforeNav = r.navigationRevision;
    const worker = r.units.find(u => u.kind === 'worker' && u.team === 0);
    const notices = r.order(0, { type: 'buildWall', ids: [worker.id],
      points: [{ column: 10, row: 10 }, { column: 11, row: 10 }] }); r.drain();
    assert.ok(notices.some(n => n.message.startsWith('PALISADE LINE PLACED')));
    assert.ok(r.navigationRevision > beforeNav); step();
    assert.equal(loser.ordinaryMoveRecovery.progressTick, beforeEdit.progressTick);
    assert.equal(loser.ordinaryMoveRecovery.episodeTick, beforeEdit.episodeTick);
    assert.equal(loser.ordinaryMoveRecovery.episodes, beforeEdit.episodes);
    assert.deepEqual(loser.ordinaryMoveRecovery.dependency, beforeEdit.dependency);
    assert.equal(loser.ordinaryMoveRecovery.blockedTick, beforeEdit.blockedTick);
    assert.deepEqual([loser.ordinaryMoveRecovery.portal.x, loser.ordinaryMoveRecovery.portal.z],
      [beforeEdit.portal.x, beforeEdit.portal.z], 'irrelevant paid obstruction does not replace the task portal');
    for (const b of [...r.buildings]) {
      const removed = r.order(0, { type: 'cancelConstruction', buildingId: b.id });
      assert.ok(removed.some(n => n.message.startsWith('CONSTRUCTION CANCELLED')));
    }
    r.drain(); step();
    assert.equal(loser.ordinaryMoveRecovery.blockedTick, beforeEdit.blockedTick);
    const saved = r.checkpoint(), bytes = JSON.stringify(saved);
    assert.ok(r.validate(saved)); for (let tick = 0; tick < 15; tick++) step();
    assert.equal(JSON.stringify(saved), bytes, 'captured nested recovery state is immutable while the room continues');
    r.restore(saved); r.drain();
    assert.equal(selected(1).ordinaryMoveRecovery.progressTick, 0);
    assert.equal(selected(1).ordinaryMoveRecovery.blockedTick, loser.ordinaryMoveRecovery.blockedTick);
    assert.deepEqual(selected(1).queuedWaypoints, intent.queue);
    const restoredBytes = JSON.stringify(saved); step();
    assert.equal(JSON.stringify(saved), restoredBytes, 'restore does not retain mutable checkpoint aliases');
    // A real peer command clears the blocked dependency. No budget reset,
    // overlap exception, order drop or timeout extension is required to resume.
    send(selected(0), -13.5);
    for (let tick = 0; tick < 900 && (!done(selected(0), -13.5) || !done(selected(1), -12.5)); tick++) step();
    assert.ok(done(selected(0), -13.5)); assert.ok(done(selected(1), -12.5));
    assert.deepEqual(r.snapshot(1).blockedMoves, []);
  } finally { await c.fixture.dispose(); }
});

test('internal route repair/publication cannot renew task progress or hide unresolved', async () => {
  const c = await corridor(), { r, selected, step } = c;
  try {
    const actor = selected(1), intentRevision = actor.ordinaryMoveRecovery.intentRevision;
    let repairs = 0;
    for (let cycle = 0; cycle < 14; cycle++) {
      for (let tick = 0; tick < 60; tick++) step();
      if (actor.ordinaryMoveRecovery.portals || actor.pathIndex === actor.path.length) break;
      const before = structuredClone(actor.ordinaryMoveRecovery);
      r.repairRoutes([actor.id]); r.drain(); repairs++;
      assert.equal(actor.ordinaryMoveRecovery.intentRevision, intentRevision);
      assert.equal(actor.ordinaryMoveRecovery.progressTick, before.progressTick);
      assert.deepEqual(actor.ordinaryMoveRecovery.portal, before.portal);
      assert.equal(actor.ordinaryMoveRecovery.episodeTick, before.episodeTick);
    }
    assert.ok(repairs > 1); assert.ok(actor.orderRevision > intentRevision, 'actual internal publications change host revision');
    assert.ok(actor.ordinaryMoveRecovery.portals > 0 || r.snapshot(1).blockedMoves.some(row => row[0] === actor.id),
      'route churn alone cannot buy unlimited nonproductive episodes');
  } finally { await c.fixture.dispose(); }
});

test('incomplete crowd query becomes explicit unresolved and resumes observation only on query completion', async () => {
  configureLandBodyReplay();
  const map = { id: 'ordinary-recovery-dense-query', name: 'ORDINARY RECOVERY DENSE QUERY',
    width: 64, height: 48, terrainSeed: 881, fogOfWar: false, startingArmySize: 136,
    spawnPoints: [{ team: 0, x: -26, z: -12 }, { team: 1, x: 26, z: 12 }],
    startingResources: { food: 500, wood: 500 }, resourceNodes: [], triggers: [],
    scenarioEvents: [], obstacles: [] };
  const fixture = await createPathingReplayFixture(map, { traceLandSteps: true }), r = fixture.replay;
  try {
    for (const team of [0, 1]) {
      const ids = r.units.filter(u => u.team === team).map(u => u.id);
      r.order(team, { type: 'stop', ids }); r.order(team, { type: 'setStance', ids, stance: 'noAttack' });
    }
    // New authored non-overlapping placement, validated before accepting intent.
    const infantry = r.units.filter(u => u.kind === 'infantry'), sites = [];
    for (let row = -4; row <= 4; row++) for (let col = -4; col <= 4; col++)
      if ((col * .45) ** 2 + (row * .45) ** 2 <= 2.1 ** 2) sites.push({ x: .5 + col * .45, z: .5 + row * .45 });
    const center = sites.findIndex(p => p.x === .5 && p.z === .5);
    [sites[0], sites[center]] = [sites[center], sites[0]];
    assert.equal(sites.length, 69);
    for (let i = 0; i < sites.length; i++) {
      Object.assign(infantry[i], sites[i]);
      for (let j = i + 1; j < sites.length; j++) assert.ok(Math.hypot(sites[i].x - sites[j].x, sites[i].z - sites[j].z) >= .44 - 1e-9);
    }
    const placed = r.checkpoint(); assert.ok(r.validate(placed)); r.restore(placed);
    const actorId = infantry[0].id, actor = () => r.units[actorId], u = actor();
    r.order(u.team, { type: 'move', ids: [u.id], unitGenerations: [u.generation], x: 12.5, z: .5 }); r.drain();
    r.order(u.team, { type: 'move', ids: [u.id], unitGenerations: [u.generation], x: 14.5, z: .5, queue: true }); r.drain();
    const goalPoint = () => { const { revision, ...point } = actor().moveGoalPoint; return point; };
    const intent = { goal: u.moveGoalCell, point: goalPoint(),
      revision: u.ordinaryMoveRecovery.intentRevision, queue: structuredClone(u.queuedWaypoints) };
    r.step();
    assert.equal(u.ordinaryMoveRecovery.dependency.bodies, null, 'incomplete query never becomes a truncated blocker witness');
    const episodeTick = u.ordinaryMoveRecovery.episodeTick;
    const worker = r.units.find(v => v.kind === 'worker' && v.team === 0), nav = r.navigationRevision;
    const notices = r.order(0, { type: 'buildWall', ids: [worker.id],
      points: [{ column: 10, row: 10 }, { column: 11, row: 10 }] }); r.drain();
    assert.ok(notices.some(n => n.message.startsWith('PALISADE LINE PLACED'))); assert.ok(r.navigationRevision > nav);
    for (let cycle = 0; cycle < 14; cycle++) {
      for (let tick = 0; tick < 60; tick++) r.step();
      r.repairRoutes([u.id]); r.drain();
      assert.equal(u.ordinaryMoveRecovery.progressTick, 0); assert.equal(u.ordinaryMoveRecovery.episodeTick, episodeTick);
      assert.equal(u.ordinaryMoveRecovery.dependency.bodies, null);
      assert.deepEqual({ x: u.x, z: u.z }, { x: .5, z: .5 }, 'safe overflow wait does not admit an unverified body step');
    }
    assert.deepEqual({ goal: u.moveGoalCell, point: goalPoint(),
      revision: u.ordinaryMoveRecovery.intentRevision, queue: u.queuedWaypoints }, intent);
    assert.deepEqual(r.snapshot(u.team).blockedMoves,
      [[u.id, u.generation, 'temporarily-blocked', 'recovery-unresolved', u.ordinaryMoveRecovery.blockedTick]]);
    assert.equal(u.ordinaryMoveRecovery.episodes, 1);
    const saved = r.checkpoint(), bytes = JSON.stringify(saved); assert.ok(r.validate(saved));
    r.step(); assert.equal(JSON.stringify(saved), bytes); r.restore(saved); r.drain(); r.step();
    assert.equal(JSON.stringify(saved), bytes); assert.equal(actor().ordinaryMoveRecovery.episodeTick, episodeTick);
    assert.equal(actor().ordinaryMoveRecovery.dependency.bodies, null);
    // Own real commands move the outer bodies clear of the capped query. No
    // checkpoint edit, teleport, route publication or nav edit reopens it.
    for (const id of infantry.slice(1, sites.length).map(v => v.id)) {
      const peer = r.units[id], dx = peer.x - .5, dz = peer.z - .5, length = Math.hypot(dx, dz);
      r.order(peer.team, { type: 'move', ids: [id], unitGenerations: [peer.generation],
        x: .5 + dx / length * 12, z: .5 + dz / length * 12 });
    }
    r.drain(); let completedQuery = false;
    for (let tick = 0; tick < 180 && !completedQuery; tick++) {
      r.step();
      for (const s of r.landSteps.filter(s => s.id === actorId)) {
        assert.ok(canTraverseStaticBodySegment(s.from, s.to, .22, map.width, map.height, r.isWalkable));
        for (const other of s.neighbours) assert.ok(sweptBodyPairMargin(s, .22, other,
          LAND_CLEARANCE_PROFILE.radiusByKind[other.kind]) >= -1e-9);
      }
      completedQuery = Array.isArray(actor().ordinaryMoveRecovery.dependency?.bodies);
    }
    assert.ok(completedQuery, 'real peer departure restores completeness and a fresh bounded observation');
    assert.equal(actor().ordinaryMoveRecovery.episodes, 2);
    assert.ok(actor().ordinaryMoveRecovery.episodeTick > episodeTick);
    assert.equal(actor().ordinaryMoveRecovery.progressTick, 0, 'query completion is phase resumption, not task progress');
  } finally { await fixture.dispose(); }
});

test('Stop/reissue supersedes saved recovery; cold metadata is bounded and optional', async () => {
  const c = await corridor(), { r, selected, send, step } = c;
  try {
    for (let tick = 0; tick < 840; tick++) step();
    const actor = selected(1), revision = actor.ordinaryMoveRecovery.intentRevision;
    const saved = r.checkpoint(); assert.ok(r.validate(saved));
    for (const mutate of [
      s => { s.failedScenes = Array(4).fill('duplicate'); },
      s => { s.dependency.bodies.push(...s.dependency.bodies, ...s.dependency.bodies, ...s.dependency.bodies, ...s.dependency.bodies); },
      s => { s.portal.fromX = Infinity; },
      s => { s.blockedTick = s.episodeTick; },
    ]) {
      const bad = structuredClone(saved); mutate(bad.state.units[actor.id].ordinaryMoveRecovery);
      assert.throws(() => r.validate(bad), /ordinary movement recovery/);
    }
    const legacy = structuredClone(saved); for (const u of legacy.state.units) delete u.ordinaryMoveRecovery;
    assert.ok(r.validate(legacy), 'old saves remain readable without optional recovery metadata');
    r.restore(legacy); r.drain();
    const restored = selected(1);
    assert.equal(restored.ordinaryMoveRecovery.progressTick, r.tick,
      'legacy intent starts one new observation period without inventing historical progress');
    for (let tick = 0; tick < 840; tick++) step();
    assert.ok(r.snapshot(1).blockedMoves.some(row => row[0] === restored.id),
      `legacy active intent consumes the host contract after restore: ${JSON.stringify({ x: restored.x, z: restored.z,
        index: restored.pathIndex, length: restored.path.length, state: restored.ordinaryMoveRecovery })}`);
    r.restore(saved); r.drain();
    const current = selected(1);
    r.order(current.team, { type: 'stop', ids: [current.id] });
    assert.equal(current.ordinaryMoveRecovery, undefined); assert.deepEqual(r.snapshot(1).blockedMoves, []);
    send(current, 13.5);
    assert.ok(current.ordinaryMoveRecovery.intentRevision > revision);
    assert.equal(current.ordinaryMoveRecovery.progressTick, r.tick);
    assert.equal(current.ordinaryMoveRecovery.episodeTick, null);
    r.order(current.team, { type: 'attackMove', ids: [current.id], x: 13.5, z: .5 }); r.drain();
    assert.equal(current.ordinaryMoveRecovery, undefined, 'combat movement remains outside this adopter');
    const worker = r.units.find(u => u.kind === 'worker' && u.team === 0);
    send(worker, worker.x + 1); assert.equal(worker.ordinaryMoveRecovery, undefined);
  } finally { await c.fixture.dispose(); }
});

for (const team of [0, 1]) test(`reachable bridge seat ${team}: both actors cross and arrive within original 900 ticks`, async () => {
  const run = await runCrowdPassageJourney({ scene: 'bridge', group: 1, ownerTeam: team, mirror: Boolean(team) });
  assert.equal(run.arrived, 2); assert.equal(run.staticContacts, 0); assert.equal(run.pairContacts, 0);
  assert.ok(run.states.every(s => s.crossingTick > 0 && s.arrivalTick <= 900));
});

test('a crossed raw portal still budgets recovery at the retained waypoint without duplicate task credit', () => {
  const unit = { id: 0, generation: 1, orderRevision: 1, kind: 'infantry', buildingTargetId: null,
    moveGoalCell: 1, x: -1, z: .78 };
  const point = { x: 0, z: .5 }, direction = { x: 1, z: 0 };
  beginOrdinaryMoveRecovery(unit, 0);
  const decide = (tick, x, phase) => ordinaryMoveRecoveryDecision(unit,
    { x, z: 0, stepDistance: .06, recoveryPhase: phase }, { tick, navigationRevision: 0,
      point, direction, radius: .22 });
  decide(1, 1); const from = { x: unit.x, z: unit.z }; unit.x = .05;
  finalizeOrdinaryMoveProgress(unit, from, 1);
  assert.equal(unit.ordinaryMoveRecovery.portals, 1, 'route-aligned aperture admits the legal .28 lane offset');
  decide(2, -1, 'retreat'); const crossed = { x: unit.x, z: unit.z }; unit.x = -.01;
  finalizeOrdinaryMoveProgress(unit, crossed, 2);
  assert.equal(unit.ordinaryMoveRecovery.portals, 1); assert.equal(unit.ordinaryMoveRecovery.progressTick, 1);
  const result = decide(182, -1, 'retreat');
  assert.equal(result.move.ordinaryMoveOutcome, 'recovery-unresolved');
  assert.equal(unit.ordinaryMoveRecovery.episodeTick, 2, 'completed coordinate cannot disable the recovery consumer');
});

test('exhausted recovery uses only an already admitted surviving forward proposal without renewing history', () => {
  const actor = extra => ({ id: 20, generation: 1, orderRevision: 1, kind: 'infantry', hp: 100,
    x: 0, z: 0, path: [1, 2], pathIndex: 0, moveGoalCell: 2, buildingTargetId: null, ...extra });
  const unit = actor(), peer = actor({ id: 21, x: .5, z: .5 });
  const point = { x: 0, z: 3 }, checked = [];
  beginOrdinaryMoveRecovery(unit, 0);
  const options = { tick: 0, navigationRevision: 0, point, radius: .22, direction: { x: 0, z: 1 }, neighbors: [peer] };
  ordinaryMoveRecoveryDecision(unit, { waitingForCrowd: true, stepDistance: 0, recoveryPhase: 'wait' }, options);
  const preferred = selectCrowdStep({ unit, target: { x: 1, z: 0 }, progressTarget: point,
    stepDistance: .08, neighbors: [peer], tick: 180,
    canTraverse: to => { checked.push({ ...to }); return true; } });
  const to = move => ({ x: unit.x + move.x * move.stepDistance, z: unit.z + move.z * move.stepDistance });
  assert.ok(Math.hypot(to(preferred).x, to(preferred).z - 3) > 3,
    'unchanged target scoring can prefer a safe proposal away from the raw route');
  assert.ok(preferred.admittedForward);
  assert.ok(preferred.crowdControl.proposals <= CROWD_PROPOSAL_LIMIT);
  const calls = checked.length, before = structuredClone(unit.ordinaryMoveRecovery);
  const result = ordinaryMoveRecoveryDecision(unit, preferred, { ...options, tick: 180 });
  assert.equal(result.move.ordinaryMoveOutcome, 'forward-resumption');
  assert.ok(Math.hypot(to(result.move).x, to(result.move).z - 3) < 3);
  assert.ok(checked.some(p => Math.hypot(p.x - to(result.move).x, p.z - to(result.move).z) < 1e-9),
    'the alternative came from the same executed proposal stream');
  assert.equal(checked.length, calls, 'consumption does not run another admission predicate');
  assert.equal(unit.ordinaryMoveRecovery.progressTick, before.progressTick);
  assert.equal(unit.ordinaryMoveRecovery.episodeTick, before.episodeTick);
  assert.equal(unit.ordinaryMoveRecovery.episodes, before.episodes);
  assert.deepEqual(unit.ordinaryMoveRecovery.dependency, before.dependency);
  assert.deepEqual(unit.ordinaryMoveRecovery.failedScenes, ['[]']);
  assert.equal(result.move.admittedForward, undefined, 'the execution proposal consumes the optional alternative');
});

test('a priority-revoked forward proposal is unavailable to the exhausted consumer', () => {
  const actor = extra => ({ id: 20, generation: 1, orderRevision: 1, kind: 'infantry', hp: 100,
    x: 0, z: 0, path: [1, 2], pathIndex: 0, moveGoalCell: 2, buildingTargetId: null, ...extra });
  const unit = actor(), peer = actor({ id: 19, x: .5, z: .15, target: { x: -3, z: .15 } });
  const point = { x: 1, z: 0 }, config = { unit, target: point, progressTarget: point,
    travelDirection: { x: 1, z: 0 }, stepDistance: .08, neighbors: [peer], canTraverse: () => true };
  beginOrdinaryMoveRecovery(unit, 0);
  const options = { tick: 0, navigationRevision: 0, point, radius: .22, direction: { x: 1, z: 0 }, neighbors: [peer] };
  ordinaryMoveRecoveryDecision(unit, { waitingForCrowd: true, stepDistance: 0, recoveryPhase: 'wait' }, options);
  selectCrowdStep({ ...config, tick: 0 });
  const move = selectCrowdStep({ ...config, tick: 180 });
  assert.ok(move.waitingForCrowd || move.yieldingForCrowd, 'lower-ID opposing claimant retains existing priority');
  assert.equal(move.admittedForward, undefined);
  const result = ordinaryMoveRecoveryDecision(unit, move, { ...options, tick: 180 });
  assert.equal(result.move.ordinaryMoveOutcome, 'recovery-unresolved');
  assert.equal(unit.ordinaryMoveRecovery.progressTick, 0);
  assert.equal(unit.ordinaryMoveRecovery.episodes, 1);
});

test('an exclusive parked contour exposes no alternative despite admitted ordinary forward options', () => {
  const unit = { id: 20, generation: 1, orderRevision: 1, kind: 'infantry', hp: 100,
    x: 0, z: 0, path: [1, 2], pathIndex: 0, moveGoalCell: 2, buildingTargetId: null };
  const parked = { id: 21, generation: 1, orderRevision: 0, kind: 'worker', hp: 100,
    x: .41, z: 0, path: [], pathIndex: 0, moveGoalCell: -1 };
  beginOrdinaryMoveRecovery(unit, 0);
  const options = { unit, target: { x: 3, z: 0 }, progressTarget: { x: 3, z: 0 },
    stepDistance: .08, neighbors: [parked], canTraverse: () => true };
  selectCrowdStep({ ...options, tick: 0 });
  const move = selectCrowdStep({ ...options, tick: 100 });
  assert.equal(move.recoveryPhase, 'contour');
  assert.equal(move.admittedForward, undefined, 'the contour retains its exclusive policy result');
  assert.ok(move.crowdControl.proposals <= CROWD_PROPOSAL_LIMIT);
});

test('matching guarded projected-waypoint arrival is physical progress; publication and a zero write are not', () => {
  const unit = { id: 0, generation: 1, orderRevision: 1, kind: 'infantry', buildingTargetId: null,
    moveGoalCell: 1, x: -1, z: .78 };
  const point = { x: 0, z: .5 };
  beginOrdinaryMoveRecovery(unit, 0);
  ordinaryMoveRecoveryDecision(unit, { x: 1, z: 0, stepDistance: .06 },
    { tick: 1, navigationRevision: 0, point, direction: { x: 1, z: 0 }, radius: .22 });
  // Near-plane steering may have moved outside the aperture, then approached
  // the projected point from its side. Only the final admitted write earns it.
  const from = { x: -.01, z: .81 }; Object.assign(unit, { x: 0, z: .78 });
  finalizeOrdinaryMoveProgress(unit, from, 2, false, { x: 1, z: .5 });
  assert.equal(unit.ordinaryMoveRecovery.portals, 0, 'a different published raw waypoint grants no credit');
  finalizeOrdinaryMoveProgress(unit, { x: unit.x, z: unit.z }, 3, false, point);
  assert.equal(unit.ordinaryMoveRecovery.portals, 0, 'zero-motion index consumption grants no credit');
  finalizeOrdinaryMoveProgress(unit, from, 4, false, point);
  assert.equal(unit.ordinaryMoveRecovery.portals, 1); assert.equal(unit.ordinaryMoveRecovery.progressTick, 4);
});

test('real closure on a replacement route retires an obsolete aperture without renewing task or phase budget', () => {
  const unit = { id: 0, generation: 1, orderRevision: 1, kind: 'infantry', buildingTargetId: null,
    moveGoalCell: 1, x: -1, z: .5 };
  beginOrdinaryMoveRecovery(unit, 0);
  ordinaryMoveRecoveryDecision(unit, { x: -1, z: 0, stepDistance: .06, recoveryPhase: 'retreat' },
    { tick: 1, navigationRevision: 0, point: { x: 0, z: .5 }, direction: { x: 1, z: 0 }, radius: .22 });
  const before = structuredClone(unit.ordinaryMoveRecovery);
  Object.assign(unit, { x: 2, z: 1.5 });
  finalizeOrdinaryMoveProgress(unit, { x: 1.94, z: 1.5 }, 2, false, { x: 2, z: 1.5 });
  assert.equal(unit.ordinaryMoveRecovery.portal, null);
  assert.equal(unit.ordinaryMoveRecovery.progressTick, before.progressTick);
  assert.equal(unit.ordinaryMoveRecovery.episodeTick, before.episodeTick);
  assert.equal(unit.ordinaryMoveRecovery.episodes, before.episodes);
  assert.deepEqual(unit.ordinaryMoveRecovery.dependency, before.dependency);
});

test('an already occupied rejoin prefix retires on host consumption without task credit or a fresh recovery episode', () => {
  const unit = { id: 0, generation: 1, orderRevision: 1, kind: 'infantry', buildingTargetId: null,
    moveGoalCell: 1, x: .1, z: .5 }, point = { x: 0, z: .5 };
  beginOrdinaryMoveRecovery(unit, 0);
  ordinaryMoveRecoveryDecision(unit, { x: -1, z: 0, stepDistance: .06, recoveryPhase: 'retreat' },
    { tick: 1, navigationRevision: 0, point, direction: { x: 1, z: 0 }, radius: .22 });
  const before = structuredClone(unit.ordinaryMoveRecovery);
  finalizeOrdinaryMoveProgress(unit, { x: unit.x, z: unit.z }, 2, false, point);
  assert.equal(unit.ordinaryMoveRecovery.portal, null);
  assert.equal(unit.ordinaryMoveRecovery.progressTick, 0);
  assert.equal(unit.ordinaryMoveRecovery.episodeTick, before.episodeTick);
  assert.equal(unit.ordinaryMoveRecovery.episodes, 1);
});

test('a paid static obstruction rebases an invalid approach without inventing progress, then the reachable Move arrives', async () => {
  configureLandBodyReplay();
  const map = forestGapMap({ group: 1 }), fixture = await createPathingReplayFixture(map, { traceLandSteps: true });
  const r = fixture.replay;
  try {
    for (const team of [0, 1]) {
      const own = r.units.filter(u => u.team === team);
      r.order(team, { type: 'stop', ids: own.map(u => u.id) });
      r.order(team, { type: 'setStance', stance: 'noAttack', ids: own.filter(u => u.kind !== 'worker').map(u => u.id) });
    }
    const id = r.units.find(u => u.team === 0 && u.kind === 'infantry').id;
    const workerId = r.units.find(u => u.team === 0 && u.kind === 'worker').id;
    Object.assign(r.units[id], { x: -12.5, z: .5 }); Object.assign(r.units[workerId], { x: -6.5, z: -2.5 });
    const placed = r.checkpoint(); assert.ok(r.validate(placed)); r.restore(placed);
    const actor = r.units[id], worker = r.units[workerId];
    r.order(0, { type: 'move', ids: [id], x: -1.5, z: .5 }); r.drain(); r.step();
    const before = structuredClone(actor.ordinaryMoveRecovery), goal = actor.moveGoalCell, nav = r.navigationRevision;
    assert.ok(before.portal);
    const notices = r.order(0, { type: 'build', ids: [worker.id], buildingType: 'house', x: -6.5, z: .5 }); r.drain();
    assert.ok(notices.some(n => n.message.startsWith('BUILD ORDER'))); assert.ok(r.navigationRevision > nav);
    r.step(); r.drain(); r.step();
    assert.equal(actor.ordinaryMoveRecovery.intentRevision, before.intentRevision);
    assert.equal(actor.ordinaryMoveRecovery.progressTick, before.progressTick);
    assert.equal(actor.ordinaryMoveRecovery.portals, before.portals);
    assert.equal(actor.moveGoalCell, goal);
    assert.ok(actor.ordinaryMoveRecovery.portal.navigationRevision > before.portal.navigationRevision);
    assert.notDeepEqual([actor.ordinaryMoveRecovery.portal.x, actor.ordinaryMoveRecovery.portal.z],
      [before.portal.x, before.portal.z], 'actual invalidated approach selects a new phase portal');
    for (let tick = 0; tick < 900 && (actor.movePlanningPending || actor.pathIndex < actor.path.length); tick++) {
      r.step();
      for (const s of r.landSteps.filter(s => s.id === actor.id)) {
        assert.ok(canTraverseStaticBodySegment(s.from, s.to, .22, map.width, map.height, r.isWalkable));
        for (const other of s.neighbours) assert.ok(sweptBodyPairMargin(s, .22, other,
          LAND_CLEARANCE_PROFILE.radiusByKind[other.kind]) >= -1e-9);
      }
    }
    assert.deepEqual([actor.x, actor.z], [-1.5, .5]); assert.equal(actor.moveGoalCell, goal);
    assert.equal(actor.pathIndex, actor.path.length); assert.deepEqual(r.snapshot(0).blockedMoves, []);
  } finally { await fixture.dispose(); }
});
