// Additional ordinary journeys over the existing forest-gap geometry and fixed-
// tick authority adapter. This is scoped physical acceptance, not a benchmark.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { forestGapMap, observeForestRouteProgress } from './forest-gap-fixture.mjs';
import { configureLandBodyReplay } from './land-body-clearance-fixture.mjs';
import { sweptStaticBodyContacts, sweptBodyPairMargin } from './land-body-clearance.mjs';
import { activeMoveGoalPoint, LAND_CLEARANCE_PROFILE } from '../src/unit-movement.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const done = (u, goal) => !u.movePlanningPending && !u.queuedWaypoints.length
  && u.pathIndex === u.path.length && Math.hypot(u.x - goal.x, u.z - goal.z) < .02;
const command = (r, team, actors, type, extra = {}) => {
  const packet = { type, ids: actors.map(u => u.id), unitGenerations: actors.map(u => u.generation), ...extra };
  const notices = r.order(team, packet); r.drain();
  assert.ok(!notices.some(n => /REJECTED|FAILED|UNREACHABLE/.test(n.message)), JSON.stringify(notices));
  return { tick: r.tick, team, packet, notices };
};

export async function runCrowdPassageJourney({ scene = 'bridge', group = 1, ownerTeam = 0,
  maxTicks = 900, initialCheckpoint = null, captureInput, interrupt = false, mirror = false, recoverAt = null } = {}) {
  assert.ok(['bridge', 'gate'].includes(scene) && [1, 16].includes(group));
  configureLandBodyReplay();
  const map = forestGapMap({ gap: 1, group });
  map.id = `crowd-${scene}-${group}-seat-${ownerTeam}`;
  map.name = 'CROWD PASSAGE JOURNEY';
  if (scene === 'bridge') map.obstacles = map.obstacles.map(o => ({ ...o, material: 'water' }));
  const f = await createPathingReplayFixture(map, { traceLandSteps: true }), r = f.replay;
  try {
    const setup = [];
    for (const team of [0, 1]) {
      const own = r.units.filter(u => u.team === team);
      setup.push(command(r, team, own, 'stop'));
      setup.push(command(r, team, own.filter(u => u.kind !== 'worker'), 'setStance', { stance: 'noAttack' }));
    }
    let actors = r.units.filter(u => u.kind === 'infantry');
    for (const team of [0, 1]) r.units.filter(u => u.kind === 'infantry' && u.team === team)
      .forEach((u, i) => Object.assign(u, { x: (team ? 11.5 : -11.5) + Math.floor(i / 4) * (team ? 1.2 : -1.2),
        z: group === 1 ? .5 : .5 + (i % 4 - 1.5) * 1.2 }));
    if (mirror) for (const actor of actors) actor.x = -actor.x;
    let gateReceipt = null;
    if (scene === 'gate') {
      let worker = r.units.find(u => u.kind === 'worker' && u.team === ownerTeam);
      worker.x = ownerTeam ? 6.5 : -6.5; worker.z = .5;
      const placed = r.checkpoint(); assert.ok(r.validate(placed)); r.restore(placed);
      worker = r.units.find(u => u.kind === 'worker' && u.team === ownerTeam);
      const before = r.wood[ownerTeam];
      setup.push(command(r, ownerTeam, [worker], 'build', { buildingType: 'palisade-gate', x: .5, z: .5 }));
      const gate = r.buildings.at(-1);
      assert.equal(gate.type, 'palisade-gate');
      for (let tick = 0; tick < 900 && !gate.complete; tick++) r.step();
      assert.ok(gate.complete, 'named Worker completes a normally paid gate');
      assert.equal(r.wood[ownerTeam], before - BUILDING_DEFINITIONS['palisade-gate'].cost.wood);
      setup.push(command(r, ownerTeam, [worker], 'move', { x: ownerTeam ? 22.5 : -22.5, z: -16.5 }));
      for (let tick = 0; tick < 900 && worker.pathIndex < worker.path.length; tick++) r.step();
      assert.equal(worker.pathIndex, worker.path.length, JSON.stringify({ x: worker.x, z: worker.z,
        target: r.point(worker.path[worker.pathIndex]), goal: worker.moveGoalCell, same: worker === r.units[worker.id],
        hold: worker.holdingPosition, point: activeMoveGoalPoint(worker), path: worker.path.slice(Math.max(0, worker.pathIndex - 1), worker.pathIndex + 2),
        near: r.units.filter(u => u !== worker && Math.hypot(u.x - worker.x, u.z - worker.z) < 2).map(u => ({ id: u.id, x: u.x, z: u.z })) }));
      setup.push(command(r, ownerTeam, [worker], 'stop'));
      const notices = r.order(ownerTeam, { type: 'setGateOpen', buildingId: gate.id, open: true });
      assert.ok(notices.some(n => n.message.startsWith('GATE OPEN')));
      gateReceipt = { id: gate.id, team: ownerTeam, woodDebit: before - r.wood[ownerTeam], complete: true, open: gate.gateOpen };
    }
    const staged = r.checkpoint(); assert.ok(r.validate(structuredClone(staged))); r.restore(staged);
    if (initialCheckpoint) {
      assert.deepEqual(initialCheckpoint.mapDefinition, r.checkpoint().mapDefinition);
      assert.ok(r.validate(structuredClone(initialCheckpoint))); r.restore(structuredClone(initialCheckpoint));
    }
    const input = initialCheckpoint ?? r.checkpoint(); captureInput?.(structuredClone(input));
    actors = r.units.filter(u => u.kind === 'infantry');
    const actorIds = new Set(actors.map(u => u.id));
    const parked = r.units.filter(u => !actorIds.has(u.id)).map(u => structuredClone(u));
    const health = actors.map(u => u.hp), commands = [];
    const destinationX = team => (team ? -12.5 : 12.5) * (mirror ? -1 : 1);
    for (const team of [0, 1]) commands.push(command(r, team, actors.filter(u => u.team === team), 'move',
      { x: destinationX(team), z: .5, formation: 'box' }));
    let states = actors.map(u => ({ id: u.id, generation: u.generation, team: u.team, goalCell: u.moveGoalCell,
      goal: { ...(activeMoveGoalPoint(u) ?? r.point(u.moveGoalCell)) }, initialRevision: u.orderRevision,
      arrivalTick: null, crossingTick: null, maxNoProgressTicks: 0, lastProgress: 0,
      bestRemainingDistance: Infinity, routeKey: '', orderRevision: u.orderRevision, publishedRouteChanges: 0 }));
    const trace = createHash('sha256'), navRevision = r.navigationRevision;
    let staticContacts = 0, pairContacts = 0, worstStaticMargin = null, worstPairMargin = null, selectedSubsteps = 0, ticks = 0;
    const observations = [];
    for (let tick = 1; tick <= maxTicks; tick++) {
      if (recoverAt === tick) {
        const saved = r.checkpoint(); assert.ok(r.validate(structuredClone(saved))); r.restore(saved); r.drain();
        actors = actors.map(u => r.units.find(v => v.id === u.id));
      }
      if (interrupt && tick === 40) {
        for (const team of [0, 1]) commands.push(command(r, team, actors.filter(u => u.team === team), 'stop'));
        const stopped = structuredClone(actors); r.step();
        assert.deepEqual(actors, stopped, 'Stop supersedes movement without moving accepted stationary actors');
        for (const team of [0, 1]) {
          const own = actors.filter(u => u.team === team);
          commands.push(command(r, team, own, 'move', { x: destinationX(team), z: .5, formation: 'box' }));
        }
        states.forEach((s, i) => Object.assign(s, { goalCell: actors[i].moveGoalCell,
          goal: { ...(activeMoveGoalPoint(actors[i]) ?? r.point(actors[i].moveGoalCell)) } }));
      }
      r.step(); ticks = tick;
      assert.equal(r.navigationRevision, navRevision);
      for (const step of r.landSteps.filter(s => actorIds.has(s.id))) {
        selectedSubsteps++;
        const radius = LAND_CLEARANCE_PROFILE.radiusByKind[step.kind];
        const physical = sweptStaticBodyContacts(step.from, step.to, radius, map.width, map.height, r.isWalkable);
        staticContacts += Number(physical.contacts.length > 0);
        for (const contact of physical.contacts) worstStaticMargin = Math.min(worstStaticMargin ?? Infinity, contact.margin);
        const contacts = [];
        for (const other of step.neighbours) {
          const margin = sweptBodyPairMargin(step, radius, other, LAND_CLEARANCE_PROFILE.radiusByKind[other.kind]);
          worstPairMargin = Math.min(worstPairMargin ?? Infinity, margin);
          if (margin < -1e-9) contacts.push({ id: other.id, margin });
        }
        pairContacts += Number(contacts.length > 0);
        observations.push({ ...step, staticContacts: physical.contacts, pairContacts: contacts });
      }
      assert.deepEqual(r.units.filter(u => !actorIds.has(u.id)), parked, 'parked actors retain full durable state and position');
      for (const [i, u] of actors.entries()) {
        const s = states[i]; assert.equal(u.hp, health[i]); assert.equal(u.generation, s.generation);
        observeForestRouteProgress(r, u, s, tick);
        if (s.arrivalTick === null && done(u, s.goal)) s.arrivalTick = tick;
        if (s.arrivalTick === null) s.maxNoProgressTicks = Math.max(s.maxNoProgressTicks, tick - s.lastProgress);
        const forwardX = u.x * (mirror ? -1 : 1);
        if (s.crossingTick === null && (u.team ? forwardX < -4 : forwardX >= 4)) s.crossingTick = tick;
      }
      trace.update(JSON.stringify(r.units) + '\n');
      if (states.every(s => s.arrivalTick !== null)) break;
    }
    return { scene, group, ownerTeam, mirror, recoverAt, maxTicks, inputSha256: hash(input), sourceSha256: f.sourceSha256,
      setup, gateReceipt, commands, navRevision, ticks, selectedSubsteps, staticContacts, pairContacts,
      worstStaticMargin, worstPairMargin, states, arrived: states.filter(s => s.arrivalTick !== null).length,
      unfinished: states.filter(s => s.arrivalTick === null), traceSha256: trace.digest('hex'), observations, actorRoutes: actors.map(u => ({id:u.id,x:u.x,z:u.z,pathIndex:u.pathIndex,path:u.path.slice(Math.max(0,u.pathIndex-1),u.pathIndex+3).map(c=>r.point(c))})) };
  } finally { await f.dispose(); }
}
