import assert from 'node:assert/strict';
import test from 'node:test';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';

test('same-tick capture reinforcements retain both seats\' authoritative fog through checkpoint restore', async () => {
  const map = {
    id: 'fog-scout-capture', name: 'Fog Scout Capture', width: 64, height: 64, terrainSeed: 41,
    startingArmySize: 8, fogOfWar: true, obstacles: [], resourceNodes: [],
    spawnPoints: [{ team: 0, x: -16, z: 0 }, { team: 1, x: 16, z: 0 }],
    triggers: [0, 1].map(team => ({
      id: `supply-${team}`, name: `Supply ${team}`, type: 'capture-zone',
      zone: { column: team === 0 ? 12 : 44, row: 28, width: 8, height: 8 },
      requiredUnits: 1, captureSeconds: 0.5, foodReward: 0,
      unitCount: 1, unitKind: 'scout', victory: false,
    })),
    scenarioEvents: [],
  };
  const fixture = await createPveHeadlessFixture(map);
  const { replay } = fixture;
  try {
    const initial = replay.checkpoint();
    // Legal authored captures deliver Scouts after this tick's ordinary vision
    // update. Their wider sight must be derived before either snapshot boundary.
    for (let tick = 0; tick < 15; tick++) replay.step();
    const before = [0, 1].map(team => replay.observe(team));
    const saved = replay.checkpoint();
    assert.equal(saved.state.tickNumber, 15);
    assert.deepEqual(saved.state.triggerStates.map(zone => zone.owner), [0, 1]);
    assert.equal(saved.state.units.length, 10);
    for (const team of [0, 1]) {
      assert.equal(saved.state.units.filter(unit => unit.team === team && unit.kind === 'scout').length, 1);
    }
    assert.deepEqual(saved.mapDefinition, initial.mapDefinition);
    assert.equal(saved.mapHash, initial.mapHash);
    assert.deepEqual([saved.schemaVersion, saved.rulesVersion], [initial.schemaVersion, initial.rulesVersion]);
    assert.deepEqual([saved.matchModeId, saved.matchModeVersion], ['authored', 1]);
    assert.equal(saved.state.matchWinner, -1, 'bonus captures do not change the defeat contract');
    replay.restore(saved);
    for (const team of [0, 1]) {
      assertRecoveredWorkerObservation(replay.observe(team), before[team],
        `seat ${team}: full observation equality after same-tick Scout delivery`);
    }
  } finally {
    await fixture.dispose();
  }
});
