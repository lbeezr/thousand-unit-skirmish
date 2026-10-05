import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createFiniteRoomFixture } from './crowd-finite-retreat-diagnostic.mjs';
import { configureLandBodyReplay } from './land-body-clearance-fixture.mjs';
import { sweptStaticBodyContacts, sweptBodyPairMargin } from './land-body-clearance.mjs';
import { LAND_CLEARANCE_PROFILE, canTraverseUnitStep } from '../src/unit-movement.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const intent = u => JSON.stringify([u.id, u.generation, u.x, u.z, u.hp, u.orderRevision, u.moveGoalCell,
  u.moveGoalPoint, u.pathIndex, u.path, u.queuedWaypoints, u.holdingPosition, u.persistentOrder,
  u.combatStance, u.gatherPhase, u.gatherNodeId, u.gatherForestCell, u.buildingTargetId, u.workIntent]);

export async function runFrontierTrial({ input, frontierIds = [77, 81, 87, 110], mode, ticks = 48, serviceAccounting = false, probeModuleUrl }) {
  assert.ok(Number.isInteger(ticks) && ticks >= 24 && ticks <= 120);
  assert.ok(frontierIds.length >= 2 && frontierIds.length <= 4 && new Set(frontierIds).size === frontierIds.length);
  configureLandBodyReplay();
  const point = c => ({ x: c % input.mapDefinition.width - input.mapDefinition.width / 2 + .5,
    z: Math.floor(c / input.mapDefinition.width) - input.mapDefinition.height / 2 + .5 });
  const origin = u => ({ id: u.id, x: u.x, z: u.z, raw: point(u.path[u.pathIndex] ?? u.moveGoalCell),
    generation: u.generation, orderRevision: u.orderRevision, pathIndex: u.pathIndex,
    pathSha256: hash(u.path), pathLength: u.path.length, goal: u.moveGoalCell,
    goalPoint: u.moveGoalPoint ?? null, queue: u.queuedWaypoints.map(q => q.destination) });
  const origins = frontierIds.map(id => origin(input.state.units[id]));
  const serviceOrigins = serviceAccounting ? input.state.units
    .filter(u => u.team === input.state.units[110].team && u.kind === 'infantry').map(origin) : undefined;
  const fixture = await createFiniteRoomFixture(input.mapDefinition,
    { mode, ownerId: 110, angle: -90, startTick: input.state.tickNumber + 1, origins, serviceOrigins },
    { probeModuleUrl: probeModuleUrl ?? new URL(serviceAccounting ? './crowd-service-admission-probe.mjs'
      : './crowd-dependency-frontier-probe.mjs', import.meta.url).href });
  const r = fixture.replay;
  try {
    assert.ok(r.validate(structuredClone(input))); r.restore(structuredClone(input));
    const selected = r.units.filter(u => u.team === r.units[110].team && u.kind === 'infantry');
    const selectedIds = new Set(selected.map(u => u.id));
    const allOrigins = new Map(selected.map(u => [u.id, origin(u)]));
    const inactive = r.units.filter(u => !selectedIds.has(u.id)).map(intent);
    const trace = createHash('sha256'), samples = [{ tick: 0, actors: selected.map(u => ({ id: u.id,
      rawProgress: 0, generation: u.generation, revision: u.orderRevision, pathIndex: u.pathIndex,
      pathSha256: hash(u.path), goal: u.moveGoalCell, queue: u.queuedWaypoints.map(q => q.destination) })) }], affected = new Set(frontierIds);
    let selectedSubsteps = 0, staticContacts = 0, pairContacts = 0;
    const remaining = (u, o) => Math.hypot(u.x - o.raw.x, u.z - o.raw.z);
    for (let tick = 1; tick <= ticks; tick++) {
      r.step();
      r.observeFiniteRoomSteps(r.landSteps);
      const report = r.finiteRoomReport;
      const owners = new Set([110, report.second?.events.find(e => e.type === 'start')?.id]);
      for (const step of r.landSteps.filter(s => selectedIds.has(s.id))) {
        selectedSubsteps++;
        const radius = LAND_CLEARANCE_PROFILE.radiusByKind[step.kind];
        const physical = sweptStaticBodyContacts(step.from, step.to, radius, input.mapDefinition.width,
          input.mapDefinition.height, r.isWalkable);
        staticContacts += Number(physical.contacts.length > 0);
        assert.ok(canTraverseUnitStep(r.cell(step.from.x, step.from.z), r.cell(step.to.x, step.to.z),
          input.mapDefinition.width, r.levels, r.isWalkable), 'executed cell/elevation admission');
        let contact = false;
        for (const other of step.neighbours) {
          contact ||= sweptBodyPairMargin(step, radius, other, LAND_CLEARANCE_PROFILE.radiusByKind[other.kind]) < -1e-9;
          if (owners.has(step.id) && selectedIds.has(other.id)) affected.add(other.id);
        }
        pairContacts += Number(contact);
      }
      assert.deepEqual(r.units.filter(u => !selectedIds.has(u.id)).map(intent), inactive);
      trace.update(JSON.stringify(r.units) + '\n');
      if (tick <= 15 || tick % 24 === 0 || tick === ticks - 24 || tick === ticks) samples.push({ tick,
        actors: selected.map(u => {
          const o = allOrigins.get(u.id);
          return { id: u.id, rawProgress: remaining(o, o) - remaining(u, o), generation: u.generation,
            revision: u.orderRevision, pathIndex: u.pathIndex, goal: u.moveGoalCell,
            pathSha256: hash(u.path), queue: u.queuedWaypoints.map(q => q.destination) };
        }) });
    }
    assert.equal(staticContacts, 0); assert.equal(pairContacts, 0);
    return { mode, ticks, frontierIds, inputSha256: hash(input), baseSourceSha256: fixture.baseSourceSha256,
      traceSha256: trace.digest('hex'), selectedSubsteps, staticContacts, pairContacts,
      inactiveActorsPreserved: inactive.length, affectedIds: [...affected].sort((a, b) => a - b),
      initialActors: [...allOrigins.values()], samples, probe: r.finiteRoomReport };
  } finally { await fixture.dispose(); }
}

export function compareFrontierTrials(baseline, candidate, { threshold = .15, lossTolerance = .01 } = {}) {
  assert.equal(candidate.inputSha256, baseline.inputSha256); assert.equal(candidate.ticks, baseline.ticks);
  const final = trial => new Map(trial.samples.at(-1).actors.map(a => [a.id, a]));
  const before = final(baseline), after = final(candidate);
  const initial = new Map(candidate.initialActors.map(a => [a.id, a]));
  const prior = new Map(candidate.samples.find(s => s.tick === candidate.ticks - 24)?.actors.map(a => [a.id, a]) ?? []);
  const affected = [...new Set([...baseline.affectedIds, ...candidate.affectedIds])].sort((a, b) => a - b);
  const actors = affected.map(id => {
    const b = before.get(id), a = after.get(id), o = initial.get(id);
    return { id, progress: a.rawProgress, delta: a.rawProgress - b.rawProgress,
      last24Progress: prior.has(id) ? a.rawProgress - prior.get(id).rawProgress : null,
      routeRetained: a.generation === o.generation && a.revision === o.orderRevision && a.pathIndex === o.pathIndex
        && a.pathSha256 === o.pathSha256 && a.pathSha256 === b.pathSha256
        && a.goal === o.goal && JSON.stringify(a.queue) === JSON.stringify(o.queue)
        && a.generation === b.generation && a.revision === b.revision
        && a.pathIndex === b.pathIndex && a.goal === b.goal && JSON.stringify(a.queue) === JSON.stringify(b.queue) };
  });
  return { mode: candidate.mode, affectedCount: actors.length, frontier: actors.filter(a => candidate.frontierIds.includes(a.id)),
    harmed: actors.filter(a => a.delta < -lossTolerance), stalled: actors.filter(a => a.progress < threshold || !(a.last24Progress >= threshold)),
    routeChanged: actors.filter(a => !a.routeRetained),
    qualified: actors.every(a => a.routeRetained && a.delta >= -lossTolerance
      && a.progress >= threshold && a.last24Progress >= threshold), threshold, lossTolerance };
}

async function main() {
  const options = Object.fromEntries(process.argv.slice(2).map(arg => {
    const i = arg.indexOf('='); assert.ok(i > 2, 'use --name=value'); return [arg.slice(2, i), arg.slice(i + 1)];
  }));
  assert.ok(options.input, '--input=LOCAL_CHECKPOINT required; no artifact/archive downloads');
  const input = JSON.parse(await readFile(options.input, 'utf8')), ticks = Number(options.ticks ?? 48);
  const runs = [];
  for (const mode of ['baseline', 'single', 'frontier']) {
    const a = await runFrontierTrial({ input, mode, ticks }), b = await runFrontierTrial({ input, mode, ticks });
    assert.equal(a.traceSha256, b.traceSha256, `${mode} full-unit deterministic repeat`);
    assert.equal(hash(a.probe), hash(b.probe), `${mode} exact coordinator repeat`);
    runs.push(a);
  }
  console.log(JSON.stringify({ limits: ['cold retained serial-pose comparison; no warm native completion',
    'finite two-maneuver diagnostic; deterministic ranking does not prove starvation freedom'],
    comparisons: runs.slice(1).map(r => compareFrontierTrials(runs[0], r)), runs }, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(error => { console.error(error); process.exitCode = 1; });
