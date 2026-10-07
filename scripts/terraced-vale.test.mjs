import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { generateTerracedVale } from './generate-terraced-vale.mjs';
import { auditMap, searchGrid } from './map-scale-audit.mjs';
import { buildElevationGrid } from '../src/map-utils.mjs';
import { townCenterFootprintCells } from '../src/town-center-spawn.mjs';

const map = JSON.parse(await readFile(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url)));
const levels = buildElevationGrid(map.width, map.height, map.elevationPatches);
const blocked = new Uint8Array(map.width * map.height);
for (const rect of map.obstacles) for (let row = rect.row; row < rect.row + rect.height; row++)
  for (let column = rect.column; column < rect.column + rect.width; column++) {
    assert.equal(blocked[row * map.width + column], 0); blocked[row * map.width + column] = 1;
  }
const sceneryBlocked = blocked.slice();
for (const team of [0, 1]) for (const cell of townCenterFootprintCells(map.spawnPoints, team, 160, 160)) blocked[cell] = 1;
const report = auditMap(map, { forestWoodPerCell: 6, defaultArmySize: 24, maxBuildings: 128 });
const cell = p => Math.floor(p.z + 80) * 160 + Math.floor(p.x + 80);

test('one deterministic Tiny map uses ordinary opening, fog and existing regional audio', async () => {
  assert.deepEqual(await generateTerracedVale(), map);
  assert.equal(map.width, 160); assert.equal(map.height, 160); assert.equal(map.region, 'veyrholds');
  assert.equal(map.startingArmySize, 24); assert.deepEqual(map.startingResources, { food: 150, wood: 250 });
  assert.equal(map.fogOfWar, true); assert.match(map.summary, /^Tiny · 160/);
  const manifest = await readFile(new URL(`../assets/audio/runtime/${map.audio.packId}/${map.audio.version}/manifest.json`, import.meta.url));
  assert.equal(createHash('sha256').update(manifest).digest('hex'), map.audio.sha256);
});

test('base route reaches the 50–60-second Worker target without a forest-clearing shortcut', () => {
  assert.equal(report.travel.minimumElevationCostRoute.worldLength, 133);
  assert.ok(report.travel.minimumElevationCostRoute.nominalTravelSeconds.worker >= 50);
  assert.ok(report.travel.minimumElevationCostRoute.nominalTravelSeconds.worker <= 60);
  assert.equal(report.travel.allForestClearedRoute.worldLength, 133);
  assert.ok(report.geometry.initialWalkableFraction > 0.8);
  for (const count of report.geometry.reachableCellsBySeat) assert.equal(count, report.geometry.initialWalkableCells);
});

test('each broad pass and each elevated flank provides an independent complete base route', () => {
  for (const [first, last, expected] of [[57, 71, 133], [89, 103, 133], [35, 42, 191], [118, 125, 191]]) {
    const mask = blocked.slice();
    for (let row = 0; row < 160; row++) if (row < first || row > last) mask[row * 160 + 79] = 1;
    const route = searchGrid(160, 160, mask, levels, cell(map.spawnPoints[0]), false);
    assert.equal(route.distance[cell(map.spawnPoints[1])], expected);
  }
  assert.deepEqual(new Set(levels), new Set([0, 1, 2]));
});

test('41×41 home campuses and initial Town Centers stay flat and free of static obstacles', () => {
  for (const column of [22, 137]) for (let y = 60; y <= 100; y++) for (let x = column - 20; x <= column + 20; x++) {
    assert.equal(levels[y * 160 + x], 1);
    assert.equal(map.obstacles.some(o => x >= o.column && x < o.column + o.width && y >= o.row && y < o.row + o.height), false);
  }
  for (const seat of report.buildingSpace.cityTemplate.staticGreedyFlatPadFitsBySeat)
    assert.equal(seat.placedBuildings, 30, 'static city geometry is required independently of native paid build proof');
});

test('both expansion campuses admit a flat 5×5 Town Center plus free circulation ring', () => {
  const nodes = new Set(map.resourceNodes.map(cell));
  for (const [cx, cy] of [[40, 58], [63, 112], [119, 58], [96, 112]]) {
    const targetLevel = levels[cy * 160 + cx];
    for (let row = cy - 3; row <= cy + 3; row++) for (let column = cx - 3; column <= cx + 3; column++) {
      const index = row * 160 + column;
      assert.equal(blocked[index], 0); assert.equal(nodes.has(index), false); assert.equal(levels[index], targetLevel);
    }
  }
});

test('mirrored seats have equal stock, home access and two progressively farther expansion pockets', () => {
  for (let y = 0; y < 160; y++) for (let x = 0; x < 80; x++) {
    assert.equal(levels[y * 160 + x], levels[y * 160 + 159 - x]);
    assert.equal(sceneryBlocked[y * 160 + x], sceneryBlocked[y * 160 + 159 - x]);
  }
  assert.deepEqual(report.economy.ordinaryNodeStockTotals, { food: 6100, wood: 7950 });
  for (const node of report.economy.resources.filter(n => n.id.startsWith('s0-'))) {
    const mirror = report.economy.resources.find(n => n.id === node.id.replace('s0-', 's1-'));
    assert.equal(node.stock, mirror.stock);
    assert.deepEqual(node.shortestCostRouteWorldLengths, [...mirror.shortestCostRouteWorldLengths].reverse());
    const route = node.shortestCostRouteWorldLengths[0];
    assert.ok(node.id.includes('home') ? (/-wood-[12]$/.test(node.id) ? route >= 12 && route <= 18 : route === 12) : node.id.includes('terrace') ? route >= 30 && route <= 45 : route >= 65 && route <= 90);
  }
});

test('authored default already has elimination and bonus-only objectives, with no timeout win', () => {
  assert.ok(map.triggers.every(trigger => trigger.victory === false));
  assert.equal(map.victoryHoldSeconds, undefined); assert.equal(map.timedVictory, undefined);
  assert.equal(map.scenarioEvents.length, 0);
  for (const objective of report.travel.objectives) for (const route of objective.travelBySeat) assert.ok(route);
});

test('opening groves retain anchors/budgets and provide two reachable registered continuations', async () => {
  const { priorTerracedValeGroves, TERRACED_VALE_PRE_GROVE_MAP_HASH } = await import('../src/terraced-vale-sheep.mjs');
  const { nearbyWoodSources, woodWorkArea } = await import('../src/gather-work-area.mjs');
  const prior = priorTerracedValeGroves(map);
  assert.equal(createHash('sha256').update(JSON.stringify(prior)).digest('base64url'), TERRACED_VALE_PRE_GROVE_MAP_HASH);
  assert.equal(map.resourceNodes.length, 16); assert.equal(prior.resourceNodes.length, 12);
  assert.deepEqual({ ...map, resourceNodes: prior.resourceNodes }, prior, 'geometry, forest, terrain, rules and food are unchanged');
  for (const team of [0, 1]) {
    const anchor = map.resourceNodes.find(node => node.id === `s${team}-home-wood`);
    const old = prior.resourceNodes.find(node => node.id === anchor.id);
    assert.deepEqual({ ...anchor, stock: old.stock }, old);
    const candidates = nearbyWoodSources(woodWorkArea(anchor), anchor, map.resourceNodes.filter(node => node.id !== anchor.id));
    assert.equal(candidates.length, 2);
    assert.equal(anchor.stock + candidates.reduce((sum, node) => sum + node.stock, 0), 975);
    for (const node of candidates) {
      assert.equal(node.stock, 325);
      assert.ok(Math.hypot(node.x - anchor.x, node.z - anchor.z) <= 4);
      assert.equal(blocked[cell(node)], 0); assert.equal(levels[cell(node)], levels[cell(anchor)]);
      assert.ok(map.spawnPoints.every(spawn => Math.max(Math.abs(node.x - spawn.x), Math.abs(node.z - spawn.z)) > 6));
      for (const team of [0, 1]) assert.ok(searchGrid(160, 160, blocked, levels, cell(map.spawnPoints[team]), false).distance[cell(node)] >= 0);
    }
  }
});

test('historical Tiny admission is exact and does not mutate either definition', async () => {
  const { priorTerracedValeGroves, isHistoricalTerracedValeDefinition } = await import('../src/terraced-vale-sheep.mjs');
  const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('base64url');
  const prior = priorTerracedValeGroves(map), before = structuredClone(prior);
  assert.equal(isHistoricalTerracedValeDefinition(prior, map, hash), true);
  assert.equal(isHistoricalTerracedValeDefinition(map, map, hash), false);
  assert.deepEqual(prior, before);
  for (const mutate of [
    m => { m.terrainSeed++; }, m => { m.resourceNodes[0].stock++; },
    m => { m.resourceNodes.at(-1).x++; }, m => { m.resourceNodes.at(-1).stock++; },
    m => { m.resourceNodes[1].stock++; }, m => { m.resourceNodes.push({ ...m.resourceNodes[0] }); },
    m => { m.startingResources.wood++; }, m => { m.spawnPoints[0].x++; },
  ]) {
    const shipped = structuredClone(map); mutate(shipped); const original = structuredClone(shipped);
    assert.equal(isHistoricalTerracedValeDefinition(prior, shipped, hash), false);
    assert.deepEqual(shipped, original);
  }
  const altered = structuredClone(prior); altered.resourceNodes[1].stock--;
  assert.equal(isHistoricalTerracedValeDefinition(altered, map, hash), false);
});

test('valid old paid Houses at new satellite sites recover with exact old geometry and stock', async () => {
  const { priorTerracedValeGroves } = await import('../src/terraced-vale-sheep.mjs');
  const { createPathingReplayFixture } = await import('./pathing-replay-fixture.mjs');
  for (const site of map.resourceNodes.filter(node => /-home-wood-[12]$/.test(node.id))) {
    const fixture = await createPathingReplayFixture(priorTerracedValeGroves(map));
    try {
      const r = fixture.replay, team = site.id.startsWith('s1') ? 1 : 0;
      const worker = r.units.find(row => row.team === team && row.kind === 'worker');
      const notices = r.order(team, { type: 'build', buildingType: 'house', ids: [worker.id],
        unitGenerations: [worker.generation], x: site.x, z: site.z }); r.drain();
      assert.ok(notices.some(row => /HOUSE PLACED/.test(row.message)), JSON.stringify(notices));
      const paid = r.checkpoint(); assert.equal(paid.state.teamWood[team], 175);
      assert.equal(r.validate(structuredClone(paid)).definition.id, map.id);
      r.restore(structuredClone(paid)); const recovered = r.checkpoint();
      assert.deepEqual(recovered.mapDefinition, paid.mapDefinition); assert.equal(recovered.mapHash, paid.mapHash);
      for (const key of ['resourceNodes', 'buildings', 'units', 'teamWood', 'teamFood']) assert.deepEqual(recovered.state[key], paid.state[key]);
    } finally { await fixture.dispose(); }
  }
});

test('ordinary default both-seat wood jobs naturally exhaust the whole grove and recover', { timeout: 90_000 }, async () => {
  const { runTerracedValeGroveScenario } = await import('./terraced-vale-groves-scenario.mjs');
  await runTerracedValeGroveScenario();
});
