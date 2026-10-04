import assert from 'node:assert/strict';
import test from 'node:test';
import { toOpponentObservation } from '../src/pve-opponent.mjs';

const sheep = { id: 'moving-food', type: 'food', wildlifeSpecies: 'bellweather-sheep', stock: 100, x: 2.5, z: -3.5 };
const map = { id: 'wildlife-disclosure', width: 16, height: 16, fogOfWar: true, resourceNodes: [sheep,
  { id: 'berries', type: 'food', stock: 200, x: 1.5, z: 1.5 }] };
const row = { ...sheep, x: -4.5, z: 3.5, wildlifeState: 'alive', wildlifeTeam: null,
  wildlifeHeading: 0, wildlifeActivity: 'wandering' };
const cell = point => Math.floor(point.z + 8) * 16 + Math.floor(point.x + 8);
function observation(team, rows, visible) {
  const bytes = Buffer.alloc(64);
  for (const [point, value] of visible) {
    const index = cell(point); bytes[index >> 2] |= value << ((index & 3) * 2);
  }
  return toOpponentObservation({ type: 'state', mapId: map.id, forestEpoch: 7, tick: 1,
    fogOfWar: true, visibility: { columns: 16, rows: 16, data: bytes.toString('base64') },
    food: [0, 0], wood: [0, 0], units: [], buildings: [], resourceNodes: rows }, team, map).resourceNodes;
}

for (const team of [0, 1]) test(`seat ${team}: opponent resources use current disclosed Sheep positions for every owner`, () => {
  for (const owner of [null, 0, 1]) {
    assert.deepEqual(observation(team, [{ ...row, wildlifeTeam: owner }], [[row, 2]]),
      [{ id: sheep.id, type: 'food', stock: 100, x: row.x, z: row.z }]);
    for (const sight of [0, 1]) assert.deepEqual(observation(team, [{ ...row, wildlifeTeam: owner }],
      [[sheep, 2], [row, sight]]), [], 'ownership and authored-cell sight cannot reveal current hidden food');
  }
  assert.deepEqual(observation(team, [], [[row, 2]]), []);
  const carcass = { ...row, wildlifeState: 'carcass', stock: 40 }; delete carcass.wildlifeActivity;
  assert.equal(observation(team, [carcass], [[row, 2]])[0].stock, 40);
  for (const malformed of [{ ...row, x: 8 }, { ...row, wildlifeTeam: team + 2 },
    { ...row, wildlifeHerd: { team } }, { ...row, stock: 50 }]) {
    assert.deepEqual(observation(team, [malformed], [[row, 2], [sheep, 2]]), []);
  }
  assert.deepEqual(observation(team, [row, row], [[row, 2]]), []);
});

test('ordinary food keeps its authored location; owned completed Farm resources keep their existing visibility exception', () => {
  const berries = map.resourceNodes[1];
  assert.deepEqual(observation(0, [{ id: berries.id, type: 'food', stock: 50, x: 7, z: 7 }], [[berries, 2]]),
    [{ id: berries.id, type: 'food', stock: 50, x: berries.x, z: berries.z }]);
  const buildings = [{ id: 12, team: 0, type: 'farm', complete: true, hp: 100, x: -3.5, z: -3.5 }];
  const result = toOpponentObservation({ type: 'state', mapId: map.id, forestEpoch: 7,
    fogOfWar: true, visibility: { columns: 16, rows: 16, data: Buffer.alloc(64).toString('base64') },
    food: [0, 0], wood: [0, 0], units: [], buildings,
    resourceNodes: [{ id: 'farm:12', type: 'food', stock: 50, sourceBuildingId: 12 }] }, 0, map).resourceNodes;
  assert.deepEqual(result, [{ id: 'farm:12', type: 'food', stock: 50, x: -3.5, z: -3.5 }]);
});
