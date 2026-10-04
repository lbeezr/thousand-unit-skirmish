import assert from 'node:assert/strict';
import test from 'node:test';
import { createPveHeadlessFixture } from './pve-headless-fixture.mjs';

// Trusted fractional-position checkpoints isolate the final flow-goal gap;
// all subsequent approach, harvesting and deposit use production simulation.
for (const team of [0, 1]) for (const [bearing, dx, dz] of [
  ['N', .49, -1.49], ['NE', 1.49, -1.49], ['E', 1.49, .49], ['SE', 1.49, 1.49],
  ['S', -.49, 1.49], ['SW', -1.49, 1.49], ['W', -1.49, -.49], ['NW', -1.49, -1.49],
]) test(`seat ${team}: forest final approach ${bearing} moves inside the unchanged harvest range`, async () => {
  const map = { id: 'forest-final-approach', name: 'Forest final approach', width: 64, height: 64,
    startingArmySize: 8, startingResources: { wood: 0, food: 0 }, fogOfWar: true,
    spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
    obstacles: [{ column: 32, row: 32, width: 1, height: 1, material: 'forest' }],
    resourceNodes: [], triggers: [], scenarioEvents: [] };
  const fixture = await createPveHeadlessFixture(map, { matchModeId: 'authored', matchModeVersion: 1 });
  const r = fixture.replay, cell = 32 * 64 + 32, id = team * 4;
  try {
    const seed = r.checkpoint(); Object.assign(seed.state.units[id], { x: .5 + dx, z: .5 + dz }); r.restore(seed);
    const untouched = r.checkpoint().state.units.filter(u => u.id !== id);
    const notices = await r.order(team, { type: 'gather', ids: [id], forestCell: cell }); r.drain();
    assert.ok(notices.some(n => /^GATHER ORDER/.test(n.message)), JSON.stringify(notices));
    const initial = r.checkpoint().state.units[id];
    assert.equal(initial.path.length, 0, 'current grid cell is already a flow goal');
    assert.ok(Math.hypot(initial.x - .5, initial.z - .5) > 1.5, 'actual position is outside range');
    for (let tick = 0; tick < 60; tick++) r.step();
    const state = r.checkpoint().state, worker = state.units[id];
    assert.ok(worker.cargo > 0, 'ordinary movement reaches productive work');
    assert.ok(Math.hypot(worker.x - .5, worker.z - .5) <= 1.5, 'range remains 1.5');
    assert.ok(Math.hypot(worker.x - initial.x, worker.z - initial.z) <= 4 * 2, 'bounded real movement');
    assert.deepEqual(state.units.filter(u => u.id !== id), untouched, 'unselected actors retain complete state');
    assert.ok(Math.abs(worker.cargo - (6 - state.forestStocks.find(([c]) => c === cell)[1])) < 1e-4);
    assert.equal(r.observe(1 - team).units.some(u => u[0] === id), false, 'hidden Worker remains private');
  } finally { await fixture.dispose(); }
});
