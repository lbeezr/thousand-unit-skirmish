import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createReconnaissancePolicy } from '../src/pve-reconnaissance.mjs';
import { createDeterministicPolicy } from '../src/pve-opponent.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { townCenterFootprintCells } from '../src/town-center-spawn.mjs';
import { replayRememberedScoutRing } from './pve-recon-ring-case.mjs';

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

function rememberedRing(side) {
  const state = fixture(); state.map = { width: side, height: side };
  const mask = Buffer.alloc(side * side / 4, 0x55); // remembered, not currently visible
  const revealUnknown = (x, z) => {
    const cell = Math.floor(z + side / 2) * side + Math.floor(x + side / 2);
    mask[cell >> 2] &= ~(3 << ((cell & 3) * 2));
    state.visibility.data = mask.toString('base64');
  };
  state.visibility = { columns: side, rows: side, data: mask.toString('base64') };
  state.objectives = [];
  return { state, revealUnknown };
}

for (const side of [80, 160]) test(`${side}-cell internal/Tiny map preserves the qualified local-only Scout policy`, () => {
  const { state, revealUnknown } = rememberedRing(side); revealUnknown(side / 2 - 3.5, side / 2 - 3.5);
  const policy = createReconnaissancePolicy(42);
  for (let tick = 0; tick <= 600; tick += 30) assert.deepEqual(policy.next({ ...state, tick }), { ids: [4], commands: [] });
});

test('larger-map Scout covers a distant unknown coarse cell after remembered-ring exhaustion', () => {
  const { state, revealUnknown } = rememberedRing(224); revealUnknown(108.5, 108.5);
  const policy = createReconnaissancePolicy(42), shadow = createReconnaissancePolicy(42);
  let acquired = null;
  for (let tick = 0; tick <= 390 && !acquired; tick += 30) {
    const view = { ...state, tick }, result = policy.next(view);
    assert.deepEqual(result, shadow.next(structuredClone(view)));
    acquired = result.commands[0];
  }
  assert.ok(acquired, 'bounded cursor rotation cannot permanently idle beside remembered ground');
  assert.deepEqual([acquired.x, acquired.z], [108.5, 108.5]);
  assert.deepEqual(acquired.ids, [4]); assert.deepEqual(acquired.unitGenerations, [7]);
});

test('larger-map distant fallback avoids disclosed threats and leaves fully explored ground idle', () => {
  const { state, revealUnknown } = rememberedRing(224);
  assert.deepEqual(createReconnaissancePolicy(42).next(state), { ids: [4], commands: [] });
  revealUnknown(108.5, 108.5);
  state.units.visibleEnemies = [{ id: 20, team: 1, kind: 'infantry', hp: 100, x: 108.5, z: 108.5 }];
  const policy = createReconnaissancePolicy(42);
  for (let tick = 0; tick <= 390; tick += 30) assert.deepEqual(policy.next({ ...state, tick }), { ids: [4], commands: [] },
    'the only unknown goal is within the disclosed threat exclusion');
  state.units.visibleEnemies[0].x = state.units.friendly[0].x + 2;
  state.units.visibleEnemies[0].z = state.units.friendly[0].z;
  const retreat = policy.next({ ...state, tick: 420 }).commands[0];
  assert.ok(retreat); assert.notDeepEqual([retreat.x, retreat.z], [108.5, 108.5], 'nearby danger keeps retreat priority');
});

test('native Medium remembered ring: both seats discover new ground warm/cold versus idle-Scout control', async () => {
  const warm = await replayRememberedScoutRing(), repeat = await replayRememberedScoutRing();
  const cold = await replayRememberedScoutRing({ cold: true }), coldRepeat = await replayRememberedScoutRing({ cold: true });
  const disabled = await replayRememberedScoutRing({ disableScout: true });
  assert.deepEqual(repeat, warm, 'every command/notice, full sampled peer view and final checkpoint repeats');
  assert.deepEqual(coldRepeat, cold, 'fresh-policy/fresh-fixture replay repeats without editing the checkpoint');
  assert.equal(cold.restartedAt, 108900);
  for (const team of [0, 1]) {
    const control = disabled.seats[team];
    assert.equal(control.scoutDisplacement, 0); assert.equal(control.scoutOrders.length, 0);
    for (const branch of [warm, cold]) {
      const result = branch.seats[team];
      assert.ok(result.scoutDisplacement > 5 && result.scoutOrders.length > 0, 'the same living native Scout resumes exploration');
      assert.ok(result.newCells > control.newCells, 'native fog disclosure exceeds the control; planned goals alone cannot pass');
    }
  }
  if (process.env.RTS_PVE_RECON_RING_EVIDENCE_DIR) await writeFile(path.join(process.env.RTS_PVE_RECON_RING_EVIDENCE_DIR,
    'native-recon-ring.json'), JSON.stringify({ warm, cold, disabled }));
  console.log(JSON.stringify({ windowSeconds: 60, seats: warm.seats.map((seat, team) => ({ team,
    warmNewCells: seat.newCells, coldNewCells: cold.seats[team].newCells, disabledNewCells: disabled.seats[team].newCells,
    warmScoutDisplacement: seat.scoutDisplacement, coldScoutDisplacement: cold.seats[team].scoutDisplacement,
    finalWood: seat.resources.wood })), winner: warm.final.state.matchWinner }));
});
