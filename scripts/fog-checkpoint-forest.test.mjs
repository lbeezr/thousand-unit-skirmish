import assert from 'node:assert/strict';
import test from 'node:test';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';

const map = {
  id: 'fog-forest-boundary', name: 'Fog Forest Boundary',
  width: 160, height: 160, startingArmySize: 8,
  startingResources: { wood: 0 }, fogOfWar: true,
  spawnPoints: [{ team: 0, x: -60, z: 0 }, { team: 1, x: 60, z: 0 }],
  obstacles: [{ column: 25, row: 80, width: 1, height: 1, material: 'forest' }],
  resourceNodes: [], triggers: [], scenarioEvents: [],
};
const forestCell = 80 * map.width + 25;

function unitCell(unit) {
  return Math.floor(unit.z + map.height / 2) * map.width + Math.floor(unit.x + map.width / 2);
}

async function order(replay, command, expectedNotice) {
  const notices = await replay.order(0, command);
  assert.ok(notices.some(notice => expectedNotice.test(notice.message || '')), JSON.stringify(notices));
  assert.ok(!notices.some(notice => /REJECTED|FAILED|UNREACHABLE/.test(notice.message || '')), JSON.stringify(notices));
  replay.drain();
}

for (const delay of [0, 2]) {
  test(`forest clears before a later Worker cell crossing: off-cadence ${delay === 0 ? 2 : 1} restores exactly`, async () => {
    const fixture = await createPveHeadlessFixture(map, { matchModeId: 'authored', matchModeVersion: 1 });
    const replay = fixture.replay;
    try {
      const ownWorkers = replay.observe(0).units.filter(unit => unit[1] === 0 && unit[5] === 'worker');
      const gatherer = ownWorkers[0][0], mover = ownWorkers[1][0];
      for (let tick = 0; tick < delay; tick++) replay.step();
      await order(replay, { type: 'gather', ids: [gatherer], forestCell }, /^GATHER ORDER/);
      // Legal timing makes the second Worker cross a vision-source cell on the
      // depletion tick, after updateWorkerEconomy's mid-step vision refresh.
      for (let tick = 0; tick < 6; tick++) replay.step();
      await order(replay, { type: 'move', ids: [mover], x: ownWorkers[1][2], z: 35.5 }, /^PLANNING MOVE|^MOVE ORDER/);

      let previous = replay.checkpoint(), cleared = null;
      for (let tick = 0; tick < 400; tick++) {
        replay.step();
        const checkpoint = replay.checkpoint();
        if (checkpoint.state.forestStocks.some(([cell, stock]) => cell === forestCell && stock === 0)) {
          cleared = checkpoint;
          break;
        }
        previous = checkpoint;
      }
      assert.ok(cleared, 'legal gathering must deplete the tree');
      assert.equal(cleared.state.tickNumber, previous.state.tickNumber + 1);
      assert.equal(cleared.state.tickNumber % 3, delay === 0 ? 2 : 1, 'depletion must be outside the periodic refresh');
      assert.notEqual(unitCell(cleared.state.units[mover]), unitCell(previous.state.units[mover]),
        'another Worker must cross a vision-source cell later in the depletion tick');
      assert.ok(previous.state.forestStocks.some(([cell, stock]) => cell === forestCell && stock > 0));
      const earnedWood = cleared.state.teamWood[0] + cleared.state.units
        .filter(unit => unit.team === 0 && unit.cargoType === 'wood').reduce((sum, unit) => sum + unit.cargo, 0);
      assert.ok(Math.abs(earnedWood - 6) < 1e-5, 'six wood is earned by gathering, without a resource grant');

      // Keep fog and every authoritative observation field strict. The shared
      // helper clears only the documented transient Worker presentation receipt.
      const before = [replay.observe(0), replay.observe(1)];
      if (delay === 2) cleared = replay.checkpoint();
      replay.restore(cleared);
      for (const team of [0, 1]) assertRecoveredWorkerObservation(replay.observe(team), before[team]);

      for (let tick = 0; tick < 400 && replay.observe(0).wood[0] < 6; tick++) replay.step();
      assert.ok(Math.abs(replay.observe(0).wood[0] - 6) < 1e-5, 'recovery preserves the earned cargo through deposit');
      console.log(JSON.stringify({ forestCell, delay, depletionTick: cleared.state.tickNumber,
        beforeCell: unitCell(previous.state.units[mover]), afterCell: unitCell(cleared.state.units[mover]) }));
    } finally { await fixture.dispose(); }
  });
}
