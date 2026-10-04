// Physical geometry study, not a production collision/avoidance implementation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { forestGapMap } from './forest-gap-fixture.mjs';
import { LAND_BODY_STUDY, sweptStaticBodyContacts, sweptBodyPairMargin } from './land-body-clearance.mjs';
import { activeMoveGoalPoint, canTraverseUnitStep } from '../src/unit-movement.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';

export const LAND_BODY_CASES = Object.freeze([
  { id: 'fractional-corner-seat-0', scene: 'corner', team: 0 },
  { id: 'fractional-corner-seat-1', scene: 'corner', team: 1 },
  { id: 'forest-opposing-infantry', scene: 'forest', group: 1 },
  { id: 'forest-opposing-scout-seat-0', scene: 'forest', group: 1, scoutTeam: 0 },
  { id: 'forest-opposing-scout-seat-1', scene: 'forest', group: 1, scoutTeam: 1 },
  { id: 'forest-opposing-box-16', scene: 'forest', group: 16 },
]);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const cornerPositions = [[.8575186714436859, .39964494945621115],
  [.06577922105789186, .24368512597866354], [.18835976794362064, .23038947279565025],
  [.47737181931734085, .742100709164515]];
function mapFor(spec) {
  if (spec.scene === 'forest') return forestGapMap({ gap: 1, group: spec.group });
  return { id: 'body-corner-study', name: 'BODY CORNER STUDY', width: 64, height: 48,
    terrainSeed: 881, fogOfWar: false, startingArmySize: 16,
    spawnPoints: [{ team: 0, x: -20, z: -16 }, { team: 1, x: 20, z: 16 }],
    resourceNodes: [], triggers: [], scenarioEvents: [],
    obstacles: [{ column: 31, row: 24, width: 1, height: 1, material: 'stone' }] };
}
export function configureLandBodyReplay() {
  process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp'; process.env.RTS_PREGAME = '0';
  process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '0'; delete process.env.RTS_MATCH_STATE_PATH;
}
function quiet(r) {
  for (const team of [0, 1]) {
    const actors = r.units.filter(u => u.team === team);
    r.order(team, { type: 'stop', ids: actors.map(u => u.id), unitGenerations: actors.map(u => u.generation) });
    r.order(team, { type: 'setStance', stance: 'noAttack', ids: actors.filter(u => u.kind !== 'worker').map(u => u.id) });
  }
}
function stage(r, spec) {
  quiet(r);
  if (spec.scene === 'corner') {
    const actors = r.units.filter(u => u.team === spec.team && u.kind === 'infantry');
    assert.equal(actors.length, cornerPositions.length);
    actors.forEach((u, i) => Object.assign(u, { x: cornerPositions[i][0], z: cornerPositions[i][1] }));
  } else {
    for (const team of [0, 1]) {
      const actors = r.units.filter(u => u.team === team && u.kind === 'infantry');
      actors.forEach((u, i) => Object.assign(u, { x: (team ? 11.5 : -11.5) + Math.floor(i / 4) * (team ? 1.2 : -1.2),
        z: spec.group === 1 ? .5 : .5 + (i % 4 - 1.5) * 1.2 }));
      if (spec.scoutTeam === team) Object.assign(actors[0], { kind: 'scout', hp: UNIT_DEFINITIONS.scout.combat.maxHp });
    }
  }
  // Trusted, validated diagnostic placement, not a paid production/spawn witness.
  const placed = r.checkpoint(); assert.ok(r.validate(placed)); r.restore(placed); r.step();
}
function selected(r, spec) {
  return spec.scene === 'corner' ? [r.units.find(u => u.team === spec.team && u.kind === 'infantry')]
    : r.units.filter(u => u.kind === 'infantry' || u.kind === 'scout');
}
function arrived(u, goal) {
  return !u.movePlanningPending && u.pathIndex === u.path.length && !u.queuedWaypoints.length
    && Math.hypot(u.x - goal.x, u.z - goal.z) < .02;
}
function contacts(r, map, step) {
  const radius = LAND_BODY_STUDY.radiusByKind[step.kind]; assert.ok(Number.isFinite(radius));
  const physical = sweptStaticBodyContacts(step.from, step.to, radius, map.width, map.height, r.isWalkable);
  const pairContacts = []; let pairMinimum = Infinity;
  for (const other of step.neighbours) {
    const otherRadius = LAND_BODY_STUDY.radiusByKind[other.kind]; assert.ok(Number.isFinite(otherRadius));
    const margin = sweptBodyPairMargin(step, radius, other, otherRadius);
    pairMinimum = Math.min(pairMinimum, margin);
    if (margin < -1e-9) pairContacts.push({ ...other, margin });
  }
  return { ...physical, pairContacts, pairMinimum: Number.isFinite(pairMinimum) ? pairMinimum : null };
}

export async function runLandBodyCase(spec, { maxTicks = 1800, initialCheckpoint = null, captureInput } = {}) {
  assert.ok(LAND_BODY_CASES.some(known => JSON.stringify(known) === JSON.stringify(spec)), 'known bounded study case required');
  assert.ok(Number.isInteger(maxTicks) && maxTicks >= 1 && maxTicks <= 2700);
  const map = mapFor(spec), f = await createPathingReplayFixture(map, { traceLandSteps: true }), r = f.replay;
  try {
    if (initialCheckpoint) {
      assert.deepEqual(initialCheckpoint.mapDefinition, r.checkpoint().mapDefinition);
      // Production content migrations may mutate their input; preserve the
      // retained checkpoint and its exact hash before validating/restoring.
      assert.ok(r.validate(structuredClone(initialCheckpoint))); r.restore(structuredClone(initialCheckpoint));
    } else stage(r, spec);
    // Hash the checkpoint actually supplied, including its original timestamps.
    // A fresh capture would give the same restored actors a different input hash.
    const input = initialCheckpoint ?? r.checkpoint(); captureInput?.(structuredClone(input));
    const actors = selected(r, spec), actorIds = new Set(actors.map(u => u.id));
    const hp = new Map(r.units.map(u => [u.id, u.hp])), navRevision = r.navigationRevision;
    const maskHash = () => hash(Array.from({ length: map.width * map.height }, (_, cell) => r.isWalkable(cell)));
    const navigationMaskSha256 = maskHash(), commands = [];
    const initialContacts = actors.map(u => ({ id: u.id, ...contacts(r, map, { kind: u.kind,
      from: { x: u.x, z: u.z }, to: { x: u.x, z: u.z }, neighbours: r.units.filter(v => v !== u && v.hp > 0) }) }));
    for (const team of [0, 1]) {
      const own = actors.filter(u => u.team === team); if (!own.length) continue;
      const command = { type: 'move', ids: own.map(u => u.id), unitGenerations: own.map(u => u.generation),
        x: spec.scene === 'corner' ? .001 : team ? -12.5 : 12.5,
        z: spec.scene === 'corner' ? .001 : .5, formation: 'box' };
      const notices = r.order(team, command); r.drain();
      assert.ok(notices.some(n => /MOVE ORDER|PLANNING MOVE/.test(n.message)), JSON.stringify(notices));
      assert.ok(!notices.some(n => /REJECTED|FAILED|UNREACHABLE/.test(n.message)), JSON.stringify(notices));
      commands.push({ team, command, notices });
    }
    const state = actors.map(u => ({ id: u.id, generation: u.generation, team: u.team, kind: u.kind,
      goal: { ...(activeMoveGoalPoint(u) ?? r.point(u.moveGoalCell)) }, goalCell: u.moveGoalCell,
      arrivalTick: null, crossedTick: null, noDisplacementTicks: 0, maxNoDisplacementTicks: 0,
      distance: 0, initialRevision: u.orderRevision }));
    const trace = createHash('sha256'), observations = [];
    let ticks = 0, observedSubsteps = 0, selectedSubsteps = 0, staticContactSteps = 0, pairContactSteps = 0,
      minimumStaticContactMargin = null, minimumPairMargin = null, maxStaticQueries = 0;
    for (let tick = 1; tick <= maxTicks; tick++) {
      const before = new Map(r.units.map(u => [u.id, { x: u.x, z: u.z }])); r.step(); ticks = tick;
      assert.equal(r.navigationRevision, navRevision, 'static study cannot use a post-cut occupancy mask');
      const steps = r.landSteps; observedSubsteps += steps.length; trace.update(JSON.stringify(steps) + '\n');
      trace.update(JSON.stringify(r.units.map(u => [u.id, u.generation, u.x, u.z, u.hp, u.orderRevision,
        u.moveGoalCell, u.pathIndex, u.path, u.movePlanningPending])) + '\n');
      const displacements = new Map();
      for (const step of steps) {
        assert.deepEqual(step.from, before.get(step.id), 'substeps chain from the actual pre-tick position');
        before.set(step.id, step.to); assert.equal(step.generation, r.units[step.id].generation);
        assert.equal(step.navigationRevision, navRevision);
        assert.ok(canTraverseUnitStep(r.cell(step.from.x, step.from.z), r.cell(step.to.x, step.to.z),
          map.width, r.levels, r.isWalkable), 'every admitted center substep obeys the production cell guard');
        if (!actorIds.has(step.id)) continue;
        selectedSubsteps++; const distance = Math.hypot(step.to.x - step.from.x, step.to.z - step.from.z);
        displacements.set(step.id, (displacements.get(step.id) ?? 0) + distance);
        const physical = contacts(r, map, step); maxStaticQueries = Math.max(maxStaticQueries, physical.queries);
        staticContactSteps += Number(physical.contacts.length > 0); pairContactSteps += Number(physical.pairContacts.length > 0);
        for (const c of physical.contacts) minimumStaticContactMargin = Math.min(minimumStaticContactMargin ?? Infinity, c.margin);
        if (physical.pairMinimum !== null) minimumPairMargin = Math.min(minimumPairMargin ?? Infinity, physical.pairMinimum);
        const { neighbours, ...segment } = step;
        observations.push({ ...segment, radius: LAND_BODY_STUDY.radiusByKind[step.kind],
          staticContacts: physical.contacts, pairContacts: physical.pairContacts });
      }
      for (const u of r.units) {
        assert.deepEqual(before.get(u.id), { x: u.x, z: u.z }, 'unobserved placement/clamp cannot enter the measured trace');
        assert.equal(u.hp, hp.get(u.id), 'combat cannot masquerade as a movement stall');
      }
      for (const [index, u] of actors.entries()) {
        const s = state[index], displacement = displacements.get(u.id) ?? 0; s.distance += displacement;
        if (s.arrivalTick === null && arrived(u, s.goal)) s.arrivalTick = tick;
        if (s.arrivalTick === null) {
          s.noDisplacementTicks = displacement > 1e-9 ? 0 : s.noDisplacementTicks + 1;
          s.maxNoDisplacementTicks = Math.max(s.maxNoDisplacementTicks, s.noDisplacementTicks);
        }
        if (spec.scene === 'forest' && s.crossedTick === null
          && (u.team ? u.x < -4 : u.x >= 4)) s.crossedTick = tick;
      }
      if (state.every(s => s.arrivalTick !== null)) break;
    }
    assert.equal(maskHash(), navigationMaskSha256);
    const finalActors = state.map((s, i) => ({ ...s, x: actors[i].x, z: actors[i].z,
      finalRevision: actors[i].orderRevision, finalGoalCell: actors[i].moveGoalCell,
      pending: actors[i].movePlanningPending, pathIndex: actors[i].pathIndex, pathLength: actors[i].path.length }));
    return { sourceSha256: f.sourceSha256, initialCheckpointSha256: hash(input), navigationMaskSha256,
      navigationRevision: navRevision, commands, initialContacts, ticks, observedSubsteps, selectedSubsteps,
      traceSha256: trace.digest('hex'), staticContactSteps, pairContactSteps,
      minimumStaticContactMargin, minimumPairMargin, maxStaticQueries,
      arrived: state.filter(s => s.arrivalTick !== null).length, actors: finalActors, observations,
      invalidCenterSubsteps: 0, unobservedPositionMutations: 0, healthLoss: 0 };
  } finally { await f.dispose(); }
}
