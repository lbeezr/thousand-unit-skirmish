import './vision-coverage-cache.test.mjs';
import './map-grid-cost-audit.test.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';
import { readFile } from 'node:fs/promises';
import { visionFixture, fogClientFixture, fogCode } from './forest-fringe-fixture.mjs';
import { exploredForestFringe } from '../src/forest-fringe.mjs';
import './forest-fringe-native-cases.mjs';

const map = {
  id: 'fog-forest-boundary', name: 'Fog Forest Boundary',
  width: 160, height: 160, startingArmySize: 8,
  startingResources: { wood: 0 }, fogOfWar: true,
  spawnPoints: [{ team: 0, x: -60, z: 0 }, { team: 1, x: 60, z: 0 }],
  obstacles: [{ column: 25, row: 80, width: 1, height: 1, material: 'forest' }],
  resourceNodes: [], triggers: [], scenarioEvents: [],
};
const forestCell = 80 * map.width + 25;

function unitCell(unit) {
  return Math.floor(unit.z + map.height / 2) * map.width + Math.floor(unit.x + map.width / 2);
}

const grove = { width: 64, height: 64, obstacles: [
  { column: 27, row: 27, width: 11, height: 11, material: 'forest' },
] };
const bearings = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];

for (const team of [0, 1]) for (const [dx, dz] of bearings) {
  test(`seat ${team}: forest approach ${dx},${dz} discovers one remembered layer with unchanged LOS`, () => {
    const changed = visionFixture(grove), original = visionFixture(grove, { original: true });
    const col = 32 + 8 * dx, row = 32 + 8 * dz;
    changed.mark(team, col, row); original.mark(team, col, row);
    assert.deepEqual(changed.context.visibleCellsByTeam, original.context.visibleCellsByTeam);
    const first = (32 + 5 * dz) * 64 + 32 + 5 * dx;
    const fringe = (32 + 4 * dz) * 64 + 32 + 4 * dx;
    const deep = (32 + 3 * dz) * 64 + 32 + 3 * dx;
    assert.equal(changed.context.visibleCellsByTeam[team][first], 1);
    assert.equal(original.context.exploredCellsByTeam[team][fringe], 0, 'reported black interior reproduces in deployed LOS');
    assert.equal(changed.context.visibleCellsByTeam[team][fringe], 0);
    assert.equal(changed.context.exploredCellsByTeam[team][fringe], 1);
    assert.equal(changed.context.exploredCellsByTeam[team][deep], 0, 'fringe cannot recursively explore the grove');
    changed.clearCurrent(); changed.mark(team, 5, 5);
    assert.equal(changed.context.exploredCellsByTeam[team][fringe], 1, 'terrain remains discovered after retreat');
    assert.equal(changed.context.exploredCellsByTeam[1 - team][fringe], 0, 'other seat has independent discovery');
  });
}

for (const team of [0, 1]) test(`seat ${team}: legal Worker approach and retreat across all eight forest bearings`, async () => {
  for (const [index, [dx, dz]] of bearings.entries()) {
    const terrain = { ...grove, id: `forest-bearing-${team}-${index}`, name: 'Forest bearing replay',
      terrainSeed: [93025, 17, 42][index % 3], fogOfWar: true, startingArmySize: 8,
      spawnPoints: [0, 1].map(seat => ({ team: seat,
        x: (seat === team ? 1 : -1) * dx * 22 + .5,
        z: (seat === team ? 1 : -1) * dz * 22 + .5 })), resourceNodes: [], triggers: [], scenarioEvents: [] };
    const fixture = await createPveHeadlessFixture(terrain, { matchModeId: 'authored', matchModeVersion: 1 });
    try {
      const r = fixture.replay, worker = r.observe(team).units.find(unit => unit[1] === team && unit[5] === 'worker')[0];
      const fringe = (32 + 4 * dz) * 64 + 32 + 4 * dx;
      assert.equal(fogCode(r.observe(team), fringe), 0, 'home has not discovered the forest interior');
      for (const distance of [8, 22]) {
        const x = dx * distance + .5, z = dz * distance + .5;
        const notices = await r.order(team, { type: 'move', ids: [worker], x, z });
        assert.ok(notices.some(notice => /MOVE/.test(notice.message)), JSON.stringify(notices));
        let arrived = false;
        for (let tick = 0; tick < 800; tick++) {
          r.step();
          const unit = r.observe(team).units.find(unit => unit[0] === worker);
          if (Math.hypot(unit[2] - x, unit[3] - z) < .1) { arrived = true; break; }
        }
        assert.ok(arrived, `Worker must arrive at ${dx},${dz} distance ${distance}`);
        assert.equal(fogCode(r.observe(team), fringe), 1, 'forest fringe is remembered rather than currently visible');
        assert.ok(r.observe(team).units.every(unit => unit[1] === team), 'opposite home remains private');
      }
      const before = [r.observe(0), r.observe(1)];
      r.restore(r.checkpoint());
      for (const seat of [0, 1]) assertRecoveredWorkerObservation(r.observe(seat), before[seat]);
    } finally { await fixture.dispose(); }
  }
});

test('fringe preserves deployed LOS on seeded Terraced Vale sources, sight roles and elevated/boundary cells', async () => {
  const terrain = JSON.parse(await readFile(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url)));
  for (const seed of [93025, 17, 42]) {
    const changed = visionFixture(terrain), original = visionFixture(terrain, { original: true });
    assert.ok(changed.context.elevationLevelByCell.some(level => level > 0), 'Terraced Vale fixture must include actual high ground');
    let random = seed;
    for (let index = 0; index < 64; index++) {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const col = random % terrain.width;
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const row = random % terrain.height;
      for (const sight of [7, 8, 11]) {
        changed.clearCurrent(); original.clearCurrent();
        changed.mark(index % 2, col, row, sight); original.mark(index % 2, col, row, sight);
        assert.deepEqual(changed.context.visibleCellsByTeam, original.context.visibleCellsByTeam);
        const team = index % 2, radius = sight + Number(changed.context.elevationLevelByCell[row * terrain.width + col] > 0);
        const covered = changed.context.visionCoverageBySourceCell.get(row * terrain.width + col, sight);
        for (const cell of covered.fringe) {
          assert.equal(changed.context.forestCellMask[cell], 1);
          assert.equal(changed.context.visibleCellsByTeam[team][cell], 0);
          assert.ok((cell % terrain.width - col) ** 2 + (Math.floor(cell / terrain.width) - row) ** 2 <= radius ** 2);
        }
      }
    }
  }
});

test('map bounds never wrap a fringe between rows; rock and building occlusion do not discover forest', () => {
  assert.deepEqual(Array.from(exploredForestFringe([15], [16], new Uint8Array(256).fill(1), 16)), []);
  for (const [col, row] of [[0, 0], [15, 0], [0, 15], [15, 15]]) {
    const terrain = { width: 16, height: 16, obstacles: [
      { column: col ? 11 : 1, row: row ? 11 : 1, width: 4, height: 4, material: 'forest' },
    ] };
    const changed = visionFixture(terrain), original = visionFixture(terrain, { original: true });
    changed.mark(0, col, row); original.mark(0, col, row);
    assert.deepEqual(changed.context.visibleCellsByTeam, original.context.visibleCellsByTeam);
    for (const cell of changed.context.visionCoverageBySourceCell.get(row * 16 + col, 8).fringe) {
      assert.ok(cell >= 0 && cell < 256);
      assert.ok([...original.context.visibleCellsByTeam[0].keys()].some(other =>
        original.context.visibleCellsByTeam[0][other] && changed.context.forestCellMask[other]
        && Math.abs(other % 16 - cell % 16) <= 1 && Math.abs(Math.floor(other / 16) - Math.floor(cell / 16)) <= 1));
    }
  }
  for (const blocker of ['stone', 'building']) {
    const terrain = { width: 64, height: 64, obstacles: [
      { column: 32, row: 20, width: 4, height: 24, material: 'forest' },
      ...(blocker === 'stone' ? [{ column: 31, row: 20, width: 1, height: 24, material: 'stone' }] : []),
    ] };
    const f = visionFixture(terrain);
    if (blocker === 'building') for (let row = 20; row < 44; row++) f.context.buildingBlocked[row * 64 + 31] = 1;
    f.mark(0, 30, 32, 8);
    assert.equal(f.context.exploredCellsByTeam[0][32 * 64 + 33], 0);
  }
});

test('production fog consumer uses remembered alpha and retains last-disclosed stock when rows are omitted', () => {
  const map = { width: 4, height: 4, resourceNodes: [], fogOfWar: true };
  const f = fogClientFixture(map);
  const codes = [0, 1, 2, 0, ...Array(12).fill(0)], packed = Buffer.alloc(4);
  codes.forEach((code, cell) => { packed[cell >> 2] |= code << ((cell & 3) * 2); });
  const state = { fogOfWar: true, forestEpoch: 10,
    visibility: { columns: 4, rows: 4, data: packed.toString('base64') }, forestStocks: [[2, 1]] };
  f.apply(state);
  assert.deepEqual(Array.from(f.context.latestFogCells), codes);
  assert.deepEqual([0, 1, 2].map(cell => f.context.minimapFogImage.data[cell * 4 + 3]), [255, 154, 0]);
  assert.deepEqual([0, 1, 2].map(cell => f.context.fogTexture.image.data[((3 - Math.floor(cell / 4)) * 4 + cell % 4) * 4 + 3]), [255, 154, 0]);
  f.apply({ ...state, forestStocks: [] });
  assert.equal(f.context.latestForestStocks.get(2), 1, 'hidden omissions preserve last-known scenery');
  assert.deepEqual(f.stockWrites, [[2, 1]], 'no offscreen depletion is invented');
  f.apply({ ...state, forestEpoch: 11, forestStocks: [] });
  assert.equal(f.context.latestForestStocks.size, 0, 'new match clears old stock memory');
  assert.deepEqual(f.stockWrites, [[2, 1], [2, 6]]);
});

async function order(replay, command, expectedNotice) {
  const notices = await replay.order(0, command);
  assert.ok(notices.some(notice => expectedNotice.test(notice.message || '')), JSON.stringify(notices));
  assert.ok(!notices.some(notice => /REJECTED|FAILED|UNREACHABLE/.test(notice.message || '')), JSON.stringify(notices));
  replay.drain();
}

test('legal clearing invalidates warmed positive fringe coverage for stationary sources', async () => {
  const terrain = { ...map, id: 'fog-fringe-cache-clearing', obstacles: [
    { column: 25, row: 64, width: 3, height: 32, material: 'forest' },
  ] };
  const fixture = await createPveHeadlessFixture(terrain, { matchModeId: 'authored', matchModeVersion: 1 });
  const replay = fixture.replay, fringe = forestCell + 1, deep = forestCell + 2;
  try {
    const initial = replay.observe(0);
    const workers = initial.units.filter(unit => unit[1] === 0 && unit[5] === 'worker');
    const gatherer = workers[0][0], stationary = workers[1];
    assert.equal(fogCode(initial, fringe), 1, 'positive fringe is warmed before geometry changes');
    assert.equal(fogCode(initial, deep), 0);
    await order(replay, { type: 'gather', ids: [gatherer], forestCell }, /^GATHER ORDER/);
    let cleared = false;
    for (let tick = 0; tick < 400; tick++) {
      replay.step();
      if (replay.checkpoint().state.forestStocks.some(([cell, stock]) => cell === forestCell && stock === 0)) {
        cleared = true; break;
      }
    }
    assert.ok(cleared, 'player-command gathering clears the first blocker');
    const after = replay.observe(0), observer = after.units.find(unit => unit[0] === stationary[0]);
    assert.deepEqual(observer.slice(2, 4), stationary.slice(2, 4), 'existing source remains stationary');
    assert.equal(fogCode(after, fringe), 2, 'clearing replaces cached fringe with direct sight');
    assert.equal(fogCode(after, deep), 1, 'new second layer remains explored-only');
    const beforeRestore = [after, replay.observe(1)];
    replay.restore(replay.checkpoint());
    for (const team of [0, 1]) assertRecoveredWorkerObservation(replay.observe(team), beforeRestore[team]);
  } finally { await fixture.dispose(); }
});

for (const delay of [0, 2]) {
  test(`forest clears before a later Worker cell crossing: off-cadence ${delay === 0 ? 2 : 1} restores exactly`, async () => {
    const fixture = await createPveHeadlessFixture(map, { matchModeId: 'authored', matchModeVersion: 1 });
    const replay = fixture.replay;
    try {
      const ownWorkers = replay.observe(0).units.filter(unit => unit[1] === 0 && unit[5] === 'worker');
      const gatherer = ownWorkers[0][0], mover = ownWorkers[1][0];
      for (let tick = 0; tick < delay; tick++) replay.step();
      await order(replay, { type: 'gather', ids: [gatherer], forestCell }, /^GATHER ORDER/);
      // Legal timing makes the second Worker cross a vision-source cell on the
      // depletion tick, after updateWorkerEconomy's mid-step vision refresh.
      for (let tick = 0; tick < 6; tick++) replay.step();
      await order(replay, { type: 'move', ids: [mover], x: ownWorkers[1][2], z: 35.5 }, /^PLANNING MOVE|^MOVE ORDER/);

      let previous = replay.checkpoint(), cleared = null;
      for (let tick = 0; tick < 400; tick++) {
        replay.step();
        const checkpoint = replay.checkpoint();
        if (checkpoint.state.forestStocks.some(([cell, stock]) => cell === forestCell && stock === 0)) {
          cleared = checkpoint;
          break;
        }
        previous = checkpoint;
      }
      assert.ok(cleared, 'legal gathering must deplete the tree');
      assert.equal(cleared.state.tickNumber, previous.state.tickNumber + 1);
      assert.equal(cleared.state.tickNumber % 3, delay === 0 ? 2 : 1, 'depletion must be outside the periodic refresh');
      assert.notEqual(unitCell(cleared.state.units[mover]), unitCell(previous.state.units[mover]),
        'another Worker must cross a vision-source cell later in the depletion tick');
      assert.ok(previous.state.forestStocks.some(([cell, stock]) => cell === forestCell && stock > 0));
      const earnedWood = cleared.state.teamWood[0] + cleared.state.units
        .filter(unit => unit.team === 0 && unit.cargoType === 'wood').reduce((sum, unit) => sum + unit.cargo, 0);
      assert.ok(Math.abs(earnedWood - 6) < 1e-5, 'six wood is earned by gathering, without a resource grant');

      // Keep fog and every authoritative observation field strict. The shared
      // helper clears only the documented transient Worker presentation receipt.
      const before = [replay.observe(0), replay.observe(1)];
      if (delay === 2) cleared = replay.checkpoint();
      replay.restore(cleared);
      for (const team of [0, 1]) assertRecoveredWorkerObservation(replay.observe(team), before[team]);

      for (let tick = 0; tick < 400 && replay.observe(0).wood[0] < 6; tick++) replay.step();
      assert.ok(Math.abs(replay.observe(0).wood[0] - 6) < 1e-5, 'recovery preserves the earned cargo through deposit');
      console.log(JSON.stringify({ forestCell, delay, depletionTick: cleared.state.tickNumber,
        beforeCell: unitCell(previous.state.units[mover]), afterCell: unitCell(cleared.state.units[mover]) }));
    } finally { await fixture.dispose(); }
  });
}
