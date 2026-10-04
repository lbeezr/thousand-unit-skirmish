import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { matureSettlementPlan, settlementLayout } from './mature-settlement-scenario.mjs';
import { BUILDING_DEFINITIONS as B, TECHNOLOGY_DEFINITIONS as T } from '../src/gameplay-definitions.mjs';
import { buildElevationGrid, validateElevationPatches } from '../src/map-utils.mjs';
import { terrainHeightField } from '../src/terrain-height.mjs';

// Two documentation fixtures enter the real publishMap boundary. No art viewer,
// checkpoint mutation, browser screenshot or native acceptance is claimed.
const families = ['town-center', 'house', 'storehouse', 'stable', 'workshop', 'watchtower', 'barracks', 'archery-range'];
const pads = matureSettlementPlan.pads.filter(([type], index, rows) => families.includes(type)
  && rows.findIndex(row => row[0] === type) === index);
assert.equal(pads.length, 8);
const cost = pads.reduce((sum, [type]) => ({ food: sum.food + B[type].cost.food,
  wood: sum.wood + B[type].cost.wood }), { ...T['military-tier-2'].cost });
assert.deepEqual(cost, { food: 350, wood: 1650 });
settlementLayout(); // Original superset's footprint/reachability assertion.
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 15_000 });
try {
  await fixture.start();
  const clients = [await fixture.connect(0), await fixture.connect(1)];
  for (const [filename, raised] of [['acceptance-map-flat.json', false], ['acceptance-map-raised-fog.json', true]]) {
    const bytes = await readFile(new URL(`../docs/qa-evidence/default-frontier-buildings-2026-10-03/${filename}`, import.meta.url));
    const map = JSON.parse(bytes);
    assert.equal(map.width, 64); assert.equal(map.height, 64);
    assert.equal(map.startingArmySize, 24); assert.deepEqual(map.startingResources, { food: 2000, wood: 3000 });
    assert.equal(map.fogOfWar, raised);
    assert.equal(validateElevationPatches(map.width, map.height, map.elevationPatches), null);
    const levels = buildElevationGrid(map.width, map.height, map.elevationPatches);
    const height = terrainHeightField(map);
    for (const team of [0, 1]) for (const [type, leftX, z] of pads) {
      const x = team ? -leftX : leftX, column = Math.floor(x + 32), row = Math.floor(z + 32);
      const side = B[type].footprint, half = Math.floor(side / 2), expectedLevel = raised && type === 'town-center' ? 2 : 0;
      const soil = map.terrainPatches.find(p => p.column === column - half && p.row === row - half);
      assert.deepEqual(soil, { column: column - half, row: row - half, width: side, height: side, material: 'dirt' });
      for (let dz = -half; dz <= half; dz++) for (let dx = -half; dx <= half; dx++) {
        assert.equal(levels[(row + dz) * map.width + column + dx], expectedLevel, `${type} has a legal level footprint`);
      }
      assert.ok(Math.abs(height.sample(x, z) - expectedLevel * .8) < 1e-6, `${type} ground anchor`);
    }
    const after = clients.map(client => client.messages.length);
    clients[0].send({ type: 'publishMap', map });
    await Promise.all(clients.map((client, team) => client.wait(message => message.type === 'mapChange'
      && message.state.mapId === map.id, `actual ${filename} admission for seat ${team}`, after[team])));
    for (const [team, client] of clients.entries()) {
      assert.equal(client.latest.mapId, map.id);
      assert.equal(client.latest.food[team], 2000); assert.equal(client.latest.wood[team], 3000);
      assert.equal(client.latest.units.filter(row => row[1] === team).length, 12);
      assert.equal(client.latest.homeTownCenters.find(row => row.team === team).x, team ? 23.5 : -23.5);
    }
    console.log(JSON.stringify({ file: filename, sha256: createHash('sha256').update(bytes).digest('hex'),
      admitted: true, legalPads: 16, fogOfWar: raised, paidTownCenterHeight: raised ? 1.6 : 0,
      visualAcceptance: 'pending' }));
  }
} finally { await fixture.dispose(); }
