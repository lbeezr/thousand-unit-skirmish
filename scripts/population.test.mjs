import assert from 'node:assert/strict';
import test from 'node:test';
import { teamPopulation } from '../src/population.mjs';

test('public population compatibility preserves the sole canonical named binding', async () => {
  const legacy = await import('../src/population.mjs');
  const current = await import('../src/rules/population.mjs');
  assert.deepEqual(Object.keys(legacy), ['teamPopulation']);
  assert.deepEqual(Object.keys(current), ['teamPopulation']);
  assert.equal(legacy.teamPopulation, current.teamPopulation);
});

function fixture() {
  return { openingArmySize: 24, units: Array.from({ length: 12 }, () => ({ team: 0, kind: 'infantry', hp: 100 })),
    buildings: [{ team: 0, type: 'barracks', complete: true, productionQueue: ['infantry', 'spearman', 'infantry'] }],
    workerProduction: [{ queue: 0 }, { queue: 0 }] };
}
test('population reserves the whole FIFO and only completed friendly Houses add capacity', () => {
  const state = fixture();
  assert.deepEqual(teamPopulation(state, 0), { used: 12, reserved: 3, capacity: 15, available: 0 });
  const house = { team: 0, type: 'house', complete: false, productionQueue: [] };
  state.buildings.push(house, { ...house, team: 1, complete: true });
  assert.equal(teamPopulation(state, 0).capacity, 15);
  house.complete = true;
  assert.deepEqual(teamPopulation(state, 0), { used: 12, reserved: 3, capacity: 23, available: 8 });
  state.workerProduction[0].queue = 4;
  assert.equal(teamPopulation(state, 0).available, 4);
  state.buildings.splice(state.buildings.indexOf(house), 1);
  assert.deepEqual(teamPopulation(state, 0), { used: 12, reserved: 7, capacity: 15, available: 0 });
  assert.equal(state.units.length, 12, 'capacity loss never deletes living units or paid reservations');
  state.units[0].hp = 0;
  assert.equal(teamPopulation(state, 0).used, 11);
});
test('explicit large-army fixtures retain safety capacity and Houses cannot exceed it', () => {
  const state = fixture(); state.openingArmySize = 2000;
  state.buildings.push({ team: 0, type: 'house', complete: true, productionQueue: [] });
  assert.equal(teamPopulation(state, 0).capacity, 1000);
});
