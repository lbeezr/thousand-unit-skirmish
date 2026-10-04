import assert from 'node:assert/strict';
import test from 'node:test';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { configureForestGapReplay, FOREST_GAPS, forestGapMap, forestInventory, observeForestRouteProgress, runForestGap, runForestPlug } from './forest-gap-fixture.mjs';

configureForestGapReplay();
test('pending empty repair is not zero distance; publication refreshes the progress reference', () => {
  const r = { point: cell => ({ x: cell, z: 0 }) };
  const u = { x: 0, z: 0, path: [20], pathIndex: 0, moveGoalCell: 20, orderRevision: 1, movePlanningPending: false };
  const p = { routeKey: JSON.stringify([20, [20]]), orderRevision: 1, bestRemainingDistance: 20, lastProgress: 0, publishedRouteChanges: 0 };
  Object.assign(u, { path: [], movePlanningPending: true, orderRevision: 2 });
  assert.equal(observeForestRouteProgress(r, u, p, 30), false);
  assert.equal(p.bestRemainingDistance, 20); assert.equal(p.lastProgress, 0, 'pending wait remains observable');
  Object.assign(u, { path: [10, 20], movePlanningPending: false });
  observeForestRouteProgress(r, u, p, 31);
  assert.equal(p.lastProgress, 31); assert.equal(p.bestRemainingDistance, 20); assert.equal(p.publishedRouteChanges, 1);
  u.x = 1;
  assert.equal(observeForestRouteProgress(r, u, p, 32), true); assert.equal(p.lastProgress, 32);
  u.path = [5, 20];
  observeForestRouteProgress(r, u, p, 33);
  assert.equal(p.publishedRouteChanges, 2, 'same-revision waypoint repairs also refresh the published reference');
});
test('authored gaps retain flat rectangular geometry, bypasses and explicit wood differences', async () => {
  for (const gap of FOREST_GAPS) {
    const map = forestGapMap({ gap }), fixture = await createPathingReplayFixture(map), r = fixture.replay;
    try {
      assert.deepEqual([map.width, map.height, map.terrainSeed], [64, 48, 881]);
      assert.ok(r.levels.every(level => level === 0));
      assert.equal(r.units.filter(u => u.kind === 'infantry' && u.team === 0).length, 16);
      assert.equal(r.units.filter(u => u.kind === 'infantry' && u.team === 1).length, 16);
      for (let row = 0; row < 48; row++) for (let column = 28; column < 36; column++) {
        assert.equal(r.isWalkable(row * 64 + column), row < 4 || row >= 44 || row >= 24 && row < 24 + gap,
          `gap${gap}, cell${column},${row}`);
      }
      const inventory = forestInventory(map);
      assert.equal(inventory.forestCells, 320 - 8 * gap);
      assert.equal(inventory.totalForestWood, 1920 - 48 * gap);
      assert.equal(inventory.woodDifferenceFromClosedBelt, 0 - 48 * gap);
    } finally { await fixture.dispose(); }
  }
  assert.equal(forestInventory(forestGapMap({ gap: 1, plug: true })).totalForestWood, 1878);
  assert.throws(() => forestGapMap({ gap: 3 })); assert.throws(() => forestGapMap({ group: 2000 }));
  assert.throws(() => forestGapMap({ gap: 2, plug: true }));
});

function complete(result, count) {
  assert.equal(result.invalidSteps, 0); assert.equal(result.arrived, count); assert.equal(result.crossed, count);
  assert.equal(result.uniqueGoals, count); assert.equal(result.goalsUnchanged, true);
  assert.equal(result.reformedAtAssignedGoals, true); assert.equal(result.freeExit, true);
  assert.equal(result.stalled.length, 0);
  assert.ok(result.firstCrossingTick > 0 && result.lastCrossingTick >= result.firstCrossingTick);
}
for (const team of [0, 1]) test(`seat${team}: a closed belt bypasses; a one-cell opening crosses and reforms`, async () => {
  const closed = await runForestGap({ gap: 0, group: 16, team, formation: 'box' });
  const open = await runForestGap({ gap: 1, group: 16, team, formation: 'box' });
  complete(closed, 16); complete(open, 16);
  assert.equal(closed.observedBypass, 16); assert.equal(open.observedBypass, 0);
  assert.ok(open.planned.meanLength < closed.planned.meanLength);
  assert.ok(open.crossings.every(u => u.crossingRow === 24));
});
for (const team of [0, 1]) for (const formation of ['line', 'column']) test(`seat${team}: ${formation} filters through a one-cell gap and keeps assigned slots`, async () => {
  complete(await runForestGap({ gap: 1, group: 16, team, formation }), 16);
});
for (const team of [0, 1]) for (const group of [1, 64]) test(`seat${team}: bounded${group}-Infantry gap traffic completes without illegal steps`, async () => {
  complete(await runForestGap({ gap: 1, group, team, formation: 'box' }), group);
});
test('repetition restores the same validated actor identities rather than normalizing generation fields', async () => {
  const spec = { gap: 1, group: 16, team: 0, formation: 'box' }; let input;
  const first = await runForestGap(spec, { captureInput: checkpoint => { input = checkpoint; } });
  const retained = structuredClone(input), repeated = await runForestGap(spec, { initialCheckpoint: input });
  assert.deepEqual(input, retained); assert.deepEqual(repeated, first);
  const changed = structuredClone(input); changed.mapDefinition.terrainSeed++;
  await assert.rejects(runForestGap(spec, { initialCheckpoint: changed }), /same canonical map/);
});
for (const team of [0, 1]) test(`seat${team}: normal plug harvesting opens navigation and preserves loaded checkpoint Wood exactly once`, async () => {
  const result = await runForestPlug(team);
  assert.equal(result.before.gapRoutes, 0); assert.equal(result.before.northBypass + result.before.southBypass, 16);
  complete(result.after, 16); assert.equal(result.after.planned.gapRoutes, 16);
  assert.ok(result.after.planned.meanLength < result.before.meanLength);
  assert.equal(result.harvest.bankedWood, 12); assert.equal(result.harvest.revisionBefore, 0); assert.equal(result.harvest.revisionAfter, 2);
  assert.equal(result.harvest.restoredBankedWood, 12); assert.equal(result.harvest.restoredZeroCargo, true);
  assert.equal(result.harvest.conservedThroughDepletion, true);
  assert.equal(result.harvest.woodAtPlugClear - result.harvest.woodBefore + result.harvest.cargoAtPlugClear, 12);
  assert.equal(result.harvest.exactLoadedContinuation, true); assert.ok(result.harvest.loadedCargo > 0);
  assert.equal(result.harvest.initialTarget, 23 * 64 + (team ? 32 : 30));
  assert.deepEqual(result.harvest.clearedCells, [result.harvest.initialTarget, 1567]);
});
