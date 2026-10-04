// The native scenario supplies untouched own-Worker rows and envelope fields.
// This checks CPU receipt/scheduling/atlas buffers, not a browser or GPU capture.
import assert from 'node:assert/strict';
import { createUnitPresentationClientFixture } from './unit-presentation-client-fixture.mjs';
import { activeState } from '../src/unit-sprite-runtime.mjs';

export async function createWorkerPresentationNativeFixture() {
  const fixtures = await Promise.all([0, 1].map(localTeam =>
    createUnitPresentationClientFixture({ localTeam, maxUnits: 2000 })));
  const evidence = [];
  const clocks = [1000, 1000];
  return {
    record(name, team, state, map, ids) {
      const fixture = fixtures[team], now = clocks[team];
      fixture.context.mapDefinition = map;
      const rows = state.units.filter(row => row[1] === team && row[5] === 'worker');
      fixture.apply(rows, { now, mapId: state.mapId, tick: state.tick,
        workerPerformingActionVersion: state.workerPerformingActionVersion,
        economyProfileId: state.economyProfileId, rulesetRevision: state.rulesetRevision,
        stone: state.stone, fogOfWar: state.fogOfWar });
      // Hold this actual received packet for 640 ms of controlled CPU time to
      // settle interpolation. This is not a real-time browser/network replay.
      // The next actual packet advances this clock independently of state.tick.
      for (let step = 1; step <= 40; step++) fixture.frame(now + step * 16, 0.016);
      clocks[team] = now + 641;
      const workers = ids.map(id => {
        const wire = rows.find(row => row[0] === id), unit = fixture.unit(id);
        assert.equal(unit.performingAction, wire[17], `${name}: actual receipt ${id}`);
        const presentation = activeState(unit, now + 640);
        assert.equal(unit.walking, false, `${name}: interpolation settled for ${id}`);
        if (wire[17] === null) assert.ok(!['gather', 'gather-fish', 'gather-stone', 'build', 'repair'].includes(presentation),
          `${name}: no invented work for ${id}`);
        else assert.equal(presentation, wire[17].startsWith('gather-')
          ? wire[17] === 'gather-stone' ? 'gather-stone' : wire[16] === 'shore-fish' ? 'gather-fish' : 'gather'
          : wire[17], `${name}: confirmed work selects its supported state for ${id}`);
        return { id, action: unit.performingAction, walking: unit.walking,
          state: presentation, frame: fixture.frameId(id), heading: unit.angle };
      });
      evidence.push({ name, team, tick: state.tick, heldPacketCpuMs: 640, workers });
    },
    evidence,
    dispose() { for (const fixture of fixtures) fixture.dispose(); },
  };
}
