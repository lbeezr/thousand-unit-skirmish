import test from 'node:test';
import assert from 'node:assert/strict';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { pathingBaselineMap } from './pathing-baseline-cases.mjs';
import { canTraverseCrowdBodySegment } from '../src/unit-crowd-steering.mjs';

for (const team of [0, 1]) for (const cold of [false, true]) {
  test(`seat ${team}: paid construction crosses parked starting bodies safely, cold=${cold}`, async () => {
    process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp'; process.env.RTS_PREGAME = '0';
    process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '0'; delete process.env.RTS_MATCH_STATE_PATH;
    const map = { ...pathingBaselineMap({ group: 16 }), id: 'construction-body-admission', obstacles: [] };
    let f = await createPathingReplayFixture(map, { traceLandSteps: true }), r = f.replay;
    try {
      for (const seat of [0, 1]) {
        r.order(seat, { type: 'stop', ids: r.units.filter(u => u.team === seat).map(u => u.id) });
        r.order(seat, { type: 'setStance', stance: 'noAttack',
          ids: r.units.filter(u => u.team === seat && u.kind === 'infantry').map(u => u.id) });
      }
      const id = r.units.find(u => u.team === team && u.kind === 'worker').id;
      const parked = structuredClone(r.units.filter(u => u.id !== id));
      r.order(team, { type: 'build', ids: [id], unitGenerations: [r.units[id].generation],
        buildingType: 'house', x: 6.5, z: .5 }); r.drain();
      const siteId = r.buildings[0].id; let substeps = 0;
      for (let tick = 0; tick < 1000 && !r.buildings.find(b => b.id === siteId).complete; tick++) {
        r.step();
        for (const s of r.landSteps.filter(s => s.id === id)) {
          substeps++;
          assert.ok(canTraverseCrowdBodySegment(s.from, s.to, .18, parked, { allowEscape: true }),
            `unsafe construction step: ${JSON.stringify(s)}`);
        }
        for (const other of parked) {
          assert.deepEqual({ x: r.units[other.id].x, z: r.units[other.id].z }, { x: other.x, z: other.z });
        }
        if (cold && tick === 30) {
          const saved = r.checkpoint(); assert.ok(r.validate(structuredClone(saved)));
          await f.dispose(); f = await createPathingReplayFixture(map, { traceLandSteps: true }); r = f.replay;
          assert.ok(r.validate(structuredClone(saved))); r.restore(structuredClone(saved)); r.drain();
        }
      }
      assert.ok(r.buildings.find(b => b.id === siteId).complete, 'body avoidance must retain productive completion');
      assert.ok(substeps > 300); assert.equal(r.wood[team], 425);
      assert.ok(r.validate(structuredClone(r.checkpoint())));
    } finally { await f.dispose(); }
  });
}
