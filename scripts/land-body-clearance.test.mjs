import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { LAND_BODY_STUDY, pointSegmentDistanceSquared, segmentRectangleDistanceSquared,
  sweptStaticBodyContacts, sweptBodyPairMargin } from './land-body-clearance.mjs';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { canTraverseUnitStep } from '../src/unit-movement.mjs';
import { LAND_BODY_CASES, configureLandBodyReplay, runLandBodyCase } from './land-body-clearance-fixture.mjs';

const rectangle = { minX: 0, minZ: 0, maxX: 1, maxZ: 1 };
test('capsule rectangle distance handles crossing, tangent, parallel, reversed and stationary segments', () => {
  for (const [a, b, expected] of [
    [{ x: -1, z: .5 }, { x: 2, z: .5 }, 0],
    [{ x: -1, z: 1 }, { x: 2, z: 1 }, 0],
    [{ x: -1, z: 1.3 }, { x: 2, z: 1.3 }, .09],
    [{ x: -.3, z: -.4 }, { x: -.3, z: -.4 }, .25],
    [{ x: 1.2, z: -.5 }, { x: 1.2, z: 1.5 }, .04],
  ]) {
    assert.ok(Math.abs(segmentRectangleDistanceSquared(a, b, rectangle) - expected) < 1e-12);
    assert.ok(Math.abs(segmentRectangleDistanceSquared(b, a, rectangle) - expected) < 1e-12);
  }
  assert.equal(pointSegmentDistanceSquared({ x: 2, z: 0 }, { x: 0, z: 0 }, { x: 1, z: 0 }), 1);
});
test('a positive body overlaps a blocked neighbouring tile despite a legal center step', () => {
  const width = 8, height = 8, blocked = 35;
  const from = { x: .08, z: .12 }, to = { x: .001, z: .001 };
  const levels = new Uint8Array(width * height), walkable = cell => cell !== blocked;
  const cell = p => Math.floor(p.z + 4) * width + Math.floor(p.x + 4);
  assert.ok(canTraverseUnitStep(cell(from), cell(to), width, levels, walkable));
  const result = sweptStaticBodyContacts(from, to, .22, width, height, walkable);
  assert.equal(result.contacts.length, 1); assert.equal(result.contacts[0].cell, blocked);
  assert.ok(Math.abs(result.contacts[0].margin + .219) < 1e-12);
  assert.equal(sweptStaticBodyContacts(from, to, 0, width, height, walkable).contacts.length, 0,
    'zero-area control is separate from the production cell-step legality predicate');
});
test('sweep catches a corner penetration between clear endpoints and preserves tangency', () => {
  const a = { x: -.07, z: .095 }, b = { x: .095, z: -.07 }, radius = .04;
  assert.ok(Math.sqrt(segmentRectangleDistanceSquared(a, a, rectangle)) > radius);
  assert.ok(Math.sqrt(segmentRectangleDistanceSquared(b, b, rectangle)) > radius);
  const blocked = 36, walkable = cell => cell !== blocked;
  assert.equal(sweptStaticBodyContacts(a, b, radius, 8, 8, walkable).contacts.length, 1);
  assert.equal(sweptStaticBodyContacts({ x: -.1, z: -.22 }, { x: .1, z: -.22 }, .22, 8, 8, walkable).contacts.length, 0);
});
test('one-cell corridor admits each candidate static circle, but two opposing bodies need their own policy', () => {
  const width = 8, walkable = cell => Math.floor(cell / width) === 4;
  for (const radius of Object.values(LAND_BODY_STUDY.radiusByKind))
    assert.equal(sweptStaticBodyContacts({ x: -.1, z: .5 }, { x: .1, z: .5 }, radius, 8, 8, walkable).contacts.length, 0);
  assert.ok(sweptBodyPairMargin({ from: { x: -.1, z: .5 }, to: { x: .1, z: .5 } }, .22,
    { x: .15, z: .5 }, .28) < 0);
});
test('grid/map bounds and a rectangular planned320 short-step probe remain bounded', () => {
  const result = sweptStaticBodyContacts({ x: 159.9, z: 0 }, { x: 159.95, z: 0 }, .22, 320, 256, () => true);
  assert.equal(result.contacts.length, 1); assert.equal(result.contacts[0].cell, null);
  assert.ok(result.queries <= 25);
  for (const [radius, width, height] of [[NaN, 8, 8], [-.1, 8, 8], [.51, 8, 8], [.22, 0, 8], [.22, 8, 1.1]])
    assert.throws(() => sweptStaticBodyContacts({ x: 0, z: 0 }, { x: .1, z: 0 }, radius, width, height, () => true));
  assert.throws(() => sweptStaticBodyContacts({ x: 0, z: 0 }, { x: 1, z: 1 }, .22, 8, 8, () => true), /short authoritative/);
  assert.throws(() => segmentRectangleDistanceSquared({ x: NaN, z: 0 }, { x: 0, z: 0 }, rectangle), /finite/);
});

process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp'; process.env.RTS_PREGAME = '0';
delete process.env.RTS_MATCH_STATE_PATH;
const map = { id: 'land-step-observation', name: 'LAND STEP OBSERVATION', width: 64, height: 48,
  terrainSeed: 881, fogOfWar: true, startingArmySize: 16,
  spawnPoints: [{ team: 0, x: -20, z: -16 }, { team: 1, x: 20, z: 16 }],
  resourceNodes: [], obstacles: [], triggers: [], scenarioEvents: [] };
test('opt-in private substep observation preserves exact accepted movement and actor identities', async () => {
  const baseline = await createPathingReplayFixture(map), traced = await createPathingReplayFixture(map, { traceLandSteps: true });
  try {
    const initial = baseline.replay.checkpoint();
    for (const f of [baseline, traced]) {
      f.replay.restore(structuredClone(initial));
      const u = f.replay.units.find(u => u.team === 0 && u.kind === 'infantry');
      f.replay.order(0, { type: 'stop', ids: [u.id], unitGenerations: [u.generation] });
      f.replay.order(0, { type: 'move', ids: [u.id], unitGenerations: [u.generation], x: -9.31, z: -4.77 }); f.replay.drain();
    }
    for (let tick = 0; tick < 160; tick++) {
      const before = new Map(traced.replay.units.map(u => [u.id, { x: u.x, z: u.z }]));
      baseline.replay.step(); traced.replay.step();
      assert.deepEqual(traced.replay.units, baseline.replay.units, 'observer does not normalize or change authority');
      const steps = traced.replay.landSteps;
      for (const step of steps) {
        assert.deepEqual(step.from, before.get(step.id)); before.set(step.id, step.to);
        assert.equal(step.generation, traced.replay.units[step.id].generation);
      }
      for (const u of traced.replay.units) assert.deepEqual(before.get(u.id), { x: u.x, z: u.z }, 'all selected movement is covered');
      if (steps.length) {
        steps[0].from.x++; steps[0].neighbours[0].x++;
        assert.notEqual(steps[0].from.x, traced.replay.landSteps[0].from.x, 'trace getter detaches points and neighbours');
      }
      assert.equal(baseline.replay.landSteps.length, 0);
    }
  } finally { await baseline.dispose(); await traced.dispose(); }
});

for (const spec of LAND_BODY_CASES) test(`${spec.id}: complete real substeps repeat from the unchanged validated input`, async () => {
  configureLandBodyReplay(); let initialCheckpoint;
  const first = await runLandBodyCase(spec, { captureInput: input => { initialCheckpoint = input; } });
  const second = await runLandBodyCase(spec, { initialCheckpoint });
  assert.deepEqual(second, first, 'raw observations include actual generations/revisions and serial neighbour positions');
  assert.equal(first.arrived, spec.scene === 'corner' ? 0 : first.actors.length,
    'occupied parked endpoints wait; physically passable opposing routes complete');
  assert.equal(first.invalidCenterSubsteps, 0); assert.equal(first.unobservedPositionMutations, 0);
  assert.equal(first.healthLoss, 0); assert.ok(first.maxStaticQueries <= 25);
  assert.equal(first.navigationRevision, 0);
  if (spec.scene === 'corner') assert.equal(first.selectedSubsteps, 0, 'occupied endpoint consumes no movement');
  else assert.ok(first.selectedSubsteps > 0);
  for (const actor of first.actors) {
    assert.equal(actor.finalGoalCell, actor.goalCell);
    assert.equal(actor.pending, false);
    if (spec.scene === 'corner') {
      assert.equal(actor.arrivalTick, null); assert.equal(actor.finalRevision, actor.initialRevision);
      assert.ok(actor.pathIndex < actor.pathLength);
    } else {
      assert.ok(actor.arrivalTick <= 1800); assert.equal(actor.pathIndex, actor.pathLength);
      assert.ok(Math.hypot(actor.x - actor.goal.x, actor.z - actor.goal.z) < .02);
    }
  }
  assert.equal(first.staticContactSteps, 0); assert.equal(first.pairContactSteps, 0);
  if (spec.scene === 'forest') for (const actor of first.actors) assert.ok(actor.crossedTick > 0);
});

test('study retains finite-deadline unfinished actors instead of labeling pending routes as arrival', async () => {
  const run = await runLandBodyCase(LAND_BODY_CASES[2], { maxTicks: 1 });
  assert.equal(run.arrived, 0); assert.equal(run.ticks, 1);
  assert.ok(run.actors.every(u => u.arrivalTick === null && u.pathIndex < u.pathLength));
});

test('retained pre-technology corner input keeps its identity under occupied-endpoint body admission', async () => {
  const record = JSON.parse(gunzipSync(await readFile(new URL('../docs/qa-evidence/ordinary-move-static-clearance-2026-10-04/substeps.json.gz', import.meta.url)))).records[0];
  const run = await runLandBodyCase(LAND_BODY_CASES[0], { initialCheckpoint: record.initialCheckpoint });
  const { sourceSha256: priorSource, ...prior } = record.runs[0];
  const { sourceSha256: currentSource, ...current } = run;
  assert.notEqual(currentSource, priorSource, 'the new content migration is a different exact production source');
  assert.equal(current.initialCheckpointSha256, prior.initialCheckpointSha256);
  assert.deepEqual(current.commands, prior.commands);
  assert.equal(current.navigationMaskSha256, prior.navigationMaskSha256);
  assert.equal(current.arrived, 0, 'historical overlapping endpoint is no longer penetrated');
  assert.equal(current.pairContactSteps, 0); assert.equal(current.staticContactSteps, 0);
  assert.equal(current.actors[0].generation, prior.actors[0].generation);
});
