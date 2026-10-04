import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';

const map = JSON.parse(await readFile(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url), 'utf8'));

async function order(replay, team, command) {
  const notices = await replay.order(team, command);
  assert.ok(!notices.some(notice => /REJECTED|FAILED|UNREACHABLE/.test(notice.message || '')), JSON.stringify(notices));
  replay.drain();
}

for (const mode of ['authored', 'skirmish']) for (const team of [0, 1]) {
  test(`${mode} seat ${team}: off-cadence outgoing/returning Worker restores full fog and authority`, async () => {
    const fixture = await createPveHeadlessFixture(map, { matchModeId: mode, matchModeVersion: 1 });
    const replay = fixture.replay;
    try {
      const worker = replay.observe(team).units.find(unit => unit[5] === 'worker');
      const home = map.spawnPoints.find(point => point.team === team);
      const comparisons = [0, 0, 0];
      let lastCadenceCell = null;
      for (const z of [home.z + 26, home.z]) {
        await order(replay, team, { type: 'move', ids: [worker[0]], x: home.x, z });
        for (let step = 0; step < 900; step++) {
          replay.step();
          const tick = replay.observe(team).tick;
          const unit = replay.observe(team).units.find(value => value[0] === worker[0]);
          const cell = Math.floor(unit[3] + map.height / 2) * map.width + Math.floor(unit[2] + map.width / 2);
          if (tick % 3 === 0) { lastCadenceCell = cell; continue; }
          if (lastCadenceCell === null || cell === lastCadenceCell) continue;
          // Exercise observation-first and checkpoint-first consumers.
          let before, checkpoint;
          if ((comparisons[1] + comparisons[2]) % 2 === 1) {
            checkpoint = replay.checkpoint();
            before = [replay.observe(0), replay.observe(1)];
          } else {
            before = [replay.observe(0), replay.observe(1)];
            checkpoint = replay.checkpoint();
          }
          replay.restore(checkpoint);
          for (const seat of [0, 1]) assertRecoveredWorkerObservation(replay.observe(seat), before[seat]);
          comparisons[tick % 3]++;
        }
      }
      assert.ok(comparisons[1] > 0 && comparisons[2] > 0, `must sample both off-cadence ticks: ${comparisons}`);
      console.log(JSON.stringify({ mode, team, comparisons }));
    } finally { await fixture.dispose(); }
  });
}

for (const team of [0, 1]) test(`seat ${team}: paid foundation changes vision between ticks and restores exactly`, async () => {
  const fixture = await createPveHeadlessFixture(map, { matchModeId: 'skirmish', matchModeVersion: 1 });
  const replay = fixture.replay;
  try {
    const before = replay.observe(team);
    const worker = before.units.find(unit => unit[5] === 'worker');
    const home = map.spawnPoints.find(point => point.team === team);
    await order(replay, team, { type: 'build', ids: [worker[0]], buildingType: 'house',
      x: home.x + (team === 0 ? 8 : -8), z: home.z + 8 });
    const placed = replay.observe(team);
    assert.equal(placed.tick, before.tick, 'command changes geometry without a simulation tick');
    assert.ok(placed.wood[team] < before.wood[team], 'foundation is actually paid');
    assert.ok(placed.buildings.some(building => building.type === 'house' && !building.complete));
    assert.notEqual(placed.visibility.data, before.visibility.data, 'foundation adds actual sight');
    const observations = [replay.observe(0), replay.observe(1)];
    replay.restore(replay.checkpoint());
    for (const seat of [0, 1]) assertRecoveredWorkerObservation(replay.observe(seat), observations[seat]);
  } finally { await fixture.dispose(); }
});
