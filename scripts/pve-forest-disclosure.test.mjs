import assert from 'node:assert/strict';
import test from 'node:test';
import { toOpponentObservation, createDeterministicPolicy } from '../src/pve-opponent.mjs';

const map = { id: 'forest-disclosure', width: 16, height: 16, resourceNodes: [],
  obstacles: [{ column: 4, row: 4, width: 4, height: 1, material: 'forest' },
    { column: 5, row: 4, width: 1, height: 1, material: 'forest' }] };
const state = (team, stocks = []) => {
  const mask = Buffer.alloc(64); for (const [column, value] of [[4, 0], [5, 1], [6, 2], [7, 2]]) {
    const cell = 4 * 16 + column; mask[cell >> 2] |= value << ((cell & 3) * 2);
  }
  return { type: 'state', fogOfWar: true, mapId: map.id, tick: 30,
    visibility: { columns: 16, rows: 16, data: mask.toString('base64') }, forestStocks: stocks,
    food: [0, 0], wood: [0, 0], units: [[team, team, -2.5, -2.5, 100, 'worker', 0, '', 1, 'idle']], resourceNodes: [] };
};

for (const team of [0, 1]) test(`seat ${team}: forest addresses/stock need current sight; hidden changes cannot influence policy`, () => {
  const input = state(team, [[71, 0]]), view = toOpponentObservation(input, team, map);
  assert.deepEqual(view.forestCells, [{ cell: 70, x: -1.5, z: -3.5, stock: 6 }]);
  assert.deepEqual(view.resourceNodes, [], 'forest addresses remain distinct from node IDs/model proposals');
  for (const hiddenStock of [0, 1, 5]) {
    const changed = state(team, [[68, hiddenStock], [69, hiddenStock], [71, 0]]);
    assert.deepEqual(toOpponentObservation(changed, team, map), view);
  }
  const order = createDeterministicPolicy(20260925).next(view);
  assert.deepEqual(order, [{ type: 'gather', ids: [team], forestCell: 70 }]);
  assert.deepEqual(createDeterministicPolicy(20260925).next({ ...view, forestCells: [] }), []);
  assert.deepEqual(createDeterministicPolicy(20260925).next({ ...view, resourceNodes: [{ id: 'ordinary', type: 'wood', stock: 10, x: 5, z: 5 }] }),
    [{ type: 'gather', ids: [team], nodeId: 'ordinary' }], 'ordinary-node policy preference stays intact');
});

test('current disclosed partial forest stock projects exactly; empty/malformed stock and legacy missing table do not invent work', () => {
  for (const stock of [0, -1, 7, null]) assert.deepEqual(toOpponentObservation(state(0, [[70, stock], [71, 0]]), 0, map).forestCells, []);
  assert.equal(toOpponentObservation(state(0, [[70, 2.5], [71, 0]]), 0, map).forestCells[0].stock, 2.5);
  const legacy = state(0); delete legacy.forestStocks;
  assert.deepEqual(toOpponentObservation(legacy, 0, map).forestCells, []);
});
