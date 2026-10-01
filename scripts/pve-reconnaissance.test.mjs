import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createReconnaissancePolicy } from '../src/pve-reconnaissance.mjs';
import { createDeterministicPolicy } from '../src/pve-opponent.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { townCenterFootprintCells } from '../src/town-center-spawn.mjs';

function fixture(team = 0) {
  const x = team ? 20 : -20;
  return { schemaVersion: 1, team, tick: 0, map: { width: 80, height: 64 }, fogOfWar: true,
    visibility: { columns: 80, rows: 64, data: Buffer.alloc(1280).toString('base64') },
    resources: { food: 0, wood: 0 }, resourceNodes: [], workerProduction: { queue: 0 },
    objectives: [{ id: 'goal', owner: -1, victory: true, zone: { column: 38, row: 30, width: 4, height: 4 } }],
    units: { friendly: [{ id: 4, generation: 7, kind: 'scout', hp: 60, team, x, z: .5 },
      { id: 5, generation: 7, kind: 'infantry', hp: 100, team, x, z: 2.5 }], visibleEnemies: [] },
    buildings: { friendly: [{ id: 100, team, type: 'town-center', complete: true, hp: 2400, x, z: .5 }], visibleEnemies: [] } };
}

test('both seats explore deterministically without army orders overwriting the Scout', () => {
  for (const team of [0, 1]) {
    const state = fixture(team), twins = [createReconnaissancePolicy(42), createReconnaissancePolicy(42)];
    const orders = twins.map(policy => policy.next(state));
    assert.deepEqual(orders[0], orders[1]);
    assert.deepEqual(orders[0].ids, [4]);
    assert.equal(orders[0].commands[0].type, 'move');
    assert.deepEqual(orders[0].commands[0].unitGenerations, [7]);
    const commands = createDeterministicPolicy(42).next(state);
    assert.equal(commands.filter(command => command.ids?.includes(4)).length, 1);
    assert.ok(commands.some(command => command.ids?.includes(5)), 'frontline Infantry retains its army order');
  }
});

test('observed threats trigger retreat; repeated snapshots retain the same order', () => {
  const state = fixture(), policy = createReconnaissancePolicy(42);
  policy.next(state);
  state.units.friendly[0].x = -10;
  state.units.visibleEnemies.push({ id: 20, kind: 'infantry', hp: 100, x: -5, z: .5 });
  state.tick = 30;
  const retreat = policy.next(state).commands[0];
  assert.equal(retreat.x, -16.5, 'retreat to the home perimeter rather than its blocked center');
  assert.deepEqual(policy.next(state).commands, []);
  state.units.friendly[0].generation++;
  assert.deepEqual(policy.next(state).commands[0].unitGenerations, [8], 'a new entity generation gets a fresh order');
});

test('stalled exploration tries another bounded frontier after ten seconds', () => {
  const state = fixture(), policy = createReconnaissancePolicy(42);
  const first = policy.next(state).commands[0];
  state.tick = 299;
  assert.deepEqual(policy.next(state).commands, []);
  state.tick = 300;
  const retry = policy.next(state).commands[0];
  assert.notDeepEqual([retry.x, retry.z], [first.x, first.z]);
  assert.ok(Math.abs(retry.x) < 40 && Math.abs(retry.z) < 32);
});

test('fully explored fog avoids pointless new reconnaissance orders', () => {
  const state = fixture();
  state.visibility.data = Buffer.alloc(1280, 255).toString('base64');
  assert.deepEqual(createReconnaissancePolicy(42).next(state), { ids: [4], commands: [] });
});

const rootways = JSON.parse(await readFile(new URL('../maps/underbough-rootways.json', import.meta.url)));
for (const team of [0, 1]) for (const seed of [0, 20260925, 0xffff_ffff]) {
  test(`Rootways Scout finishes its retreat across a stationary threat boundary, seat ${team}, seed ${seed}`, () => {
    const state = fixture(team), direction = team ? 1 : -1;
    state.map = { width: rootways.width, height: rootways.height };
    state.visibility = { columns: rootways.width, rows: rootways.height,
      data: Buffer.alloc(rootways.width * rootways.height / 4).toString('base64') };
    state.objectives = rootways.triggers.map(trigger => ({ ...trigger, owner: -1 }));
    const scout = state.units.friendly[0], home = state.buildings.friendly[0];
    scout.x = direction * 10; home.x = direction * 36.5;
    state.units.visibleEnemies = [{ id: 24, team: 1 - team, kind: 'scout', hp: 60, x: direction * 1.1, z: .5 }];
    const policy = createReconnaissancePolicy(seed);
    const retreat = policy.next(state).commands[0];
    const edge = Math.ceil(BUILDING_DEFINITIONS['town-center'].footprint / 2);
    assert.deepEqual([retreat.x, retreat.z], [home.x - direction * edge, home.z]);
    const cell = Math.floor(retreat.z + rootways.height / 2) * rootways.width + Math.floor(retreat.x + rootways.width / 2);
    assert.ok(!townCenterFootprintCells(rootways.spawnPoints, team, rootways.width, rootways.height).includes(cell),
      'retreat target cannot be inside the authoritative home footprint');
    scout.x = direction * 10.2; state.tick = 30;
    assert.deepEqual(policy.next(state).commands, [], 'crossing nine cells must not reverse an active retreat');
    state.tick = 300;
    assert.deepEqual(policy.next(state).commands[0], retreat, 'a stalled retreat retries its destination');
    scout.x = retreat.x; scout.z = retreat.z; state.tick = 330;
    const resumed = policy.next(state).commands[0];
    assert.ok(resumed, 'reaching safety releases the Scout to explore');
    assert.notDeepEqual([resumed.x, resumed.z], [retreat.x, retreat.z]);
  });
}

test('a lost home preserves the active retreat destination; replacement Scouts have fresh intent', () => {
  const state = fixture(), scout = state.units.friendly[0];
  scout.x = -10;
  state.units.visibleEnemies = [{ id: 24, hp: 60, kind: 'scout', x: -1.1, z: .5 }];
  const policy = createReconnaissancePolicy(42), retreat = policy.next(state).commands[0];
  scout.x = -10.2; state.buildings.friendly = []; state.tick = 300;
  assert.deepEqual(policy.next(state).commands[0], retreat, 'without a home or nearby threat, retry the saved safe point');
  scout.generation++; state.tick = 330;
  const replacement = policy.next(state).commands[0];
  assert.deepEqual(replacement.unitGenerations, [scout.generation]);
  assert.notDeepEqual([replacement.x, replacement.z], [retreat.x, retreat.z], 'replacement cannot inherit the old retreat');
});
