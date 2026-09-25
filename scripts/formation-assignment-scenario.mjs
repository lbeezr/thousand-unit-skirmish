import assert from 'node:assert/strict';
import { orderUnitsForFormation } from '../src/formation-assignment.mjs';

function routeCrossings(units, destinations) {
  let count = 0;
  for (let left = 0; left < units.length; left++) {
    for (let right = left + 1; right < units.length; right++) {
      const a = units[left];
      const b = destinations[left];
      const c = units[right];
      const d = destinations[right];
      const first = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
      const second = (b.x - a.x) * (d.z - a.z) - (b.z - a.z) * (d.x - a.x);
      const third = (d.x - c.x) * (a.z - c.z) - (d.z - c.z) * (a.x - c.x);
      const fourth = (d.x - c.x) * (b.z - c.z) - (d.z - c.z) * (b.x - c.x);
      if (first * second < 0 && third * fourth < 0) count++;
    }
  }
  return count;
}

const formations = {
  box: { columns: 4, rows: 4, direction: { x: 0, z: 1 }, side: { x: 1, z: 0 } },
  line: { columns: 8, rows: 2, direction: { x: 1, z: 0 }, side: { x: 0, z: 1 } },
  column: { columns: 2, rows: 8, direction: { x: 1, z: 0 }, side: { x: 0, z: 1 } },
};
const units = Array.from({ length: 1000 }, (_, index) => {
  const column = index % 32;
  const row = Math.floor(index / 32);
  return {
    id: (index * 37) % 1000,
    x: column - 15.5,
    z: row - 15.5,
  };
});
const shuffled = [...units].sort((left, right) => ((left.id * 53) % 1009) - ((right.id * 53) % 1009));
const reversed = [...units].reverse();

for (const [formation, layout] of Object.entries(formations)) {
  const expected = orderUnitsForFormation(units, layout).map((unit) => unit.id);
  assert.deepEqual(orderUnitsForFormation(shuffled, layout).map((unit) => unit.id), expected,
    `${formation} slot assignments should ignore shuffled command ID order`);
  assert.deepEqual(orderUnitsForFormation(reversed, layout).map((unit) => unit.id), expected,
    `${formation} slot assignments should ignore reversed command ID order`);
  assert.equal(expected.length, 1000, `${formation} should preserve every selected unit`);
}

const crossingLayout = {
  columns: 4,
  rows: 1,
  direction: { x: 1, z: 0 },
  side: { x: 0, z: 1 },
};
const smallGroup = [
  { id: 0, x: -2, z: -1 },
  { id: 1, x: -2, z: 1 },
  { id: 2, x: -1, z: -1 },
  { id: 3, x: -1, z: 1 },
];
const slots = [-1.5, -0.5, 0.5, 1.5].map((z) => ({ x: 6, z }));
const submittedOrder = [smallGroup[3], smallGroup[0], smallGroup[2], smallGroup[1]];
const spatialOrder = orderUnitsForFormation(submittedOrder, crossingLayout);
const spatialRoutes = spatialOrder.map((unit, index) => ({ unit, destination: slots[index] }));
const submittedRoutes = submittedOrder.map((unit, index) => ({ unit, destination: slots[index] }));
const countCrossings = (routes) => routeCrossings(
  routes.map((route) => route.unit), routes.map((route) => route.destination),
);

assert.equal(countCrossings(spatialRoutes), 0,
  'a lateral line regroup should preserve neighboring unit order without crossing routes');
assert.ok(countCrossings(spatialRoutes) < countCrossings(submittedRoutes),
  'spatial pairing should remove crossings caused only by a shuffled command selection');

console.log('Formation-assignment scenario passed: 1,000-unit shuffled/reversed selections are order-invariant for box, line, and column, and spatial pairing removes avoidable line-route crossings.');
