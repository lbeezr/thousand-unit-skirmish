import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { preflightXlCheckpointRoutes, XL_CHECKPOINT_ROUTE_MAX_ENTRIES as budget,
  XL_CHECKPOINT_ROUTE_SLOT_BYTES } from '../src/server/checkpoint-route-budget.mjs';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';

const limits = { maxUnits: 2000, maxResourceNodes: 128 };
const xl = { width: 320, height: 320 }, cells = 102400;
const actor = (path = [], resume = null) => ({ path, attackMoveResumePath: resume });
const state = (units = [], resourceNodes = []) => ({ units, resourceNodes });
const check = (value, definition = xl) => preflightXlCheckpointRoutes(definition, value, limits);

function fullBudgetState(extra = 0) {
  const units = Array.from({ length: 5 }, () => actor(Array(cells).fill(cells - 1), Array(cells).fill(0)));
  return state(units, [{ wildlifeHerd: { path: Array(budget - 10 * cells + extra).fill(100000) } }]);
}

test('XL aggregate boundary counts active/resume/wildlife paths without altering them', () => {
  for (const extra of [-1, 0, 1]) {
    const value = fullBudgetState(extra), before = structuredClone(value);
    if (extra > 0) assert.throws(() => check(value), /exceeds aggregate cell entries/);
    else {
      const report = check(value);
      assert.equal(report.routeEntries, budget + extra);
      assert.equal(report.validatedEntries, budget + extra);
      assert.equal(report.routeArrays, 11);
      assert.equal(report.auxiliaryPathReferences, 11);
      assert.equal(report.routeSlotPayloadBytesUpper, (budget + extra) * XL_CHECKPOINT_ROUTE_SLOT_BYTES);
    }
    assert.deepEqual(value, before);
  }
});

test('oversized aggregate rejects metadata before reading any accepted-length path cells', () => {
  const unread = Array(cells);
  Object.defineProperty(unread, 0, { get() { throw new Error('unexpected index read'); } });
  const value = state(Array.from({ length: 11 }, () => actor(unread)));
  assert.throws(() => check(value), /exceeds aggregate cell entries/);
});

test('oversized single path rejects before scanning its cells', () => {
  const unread = Array(cells + 1);
  Object.defineProperty(unread, 0, { get() { throw new Error('unexpected index read'); } });
  assert.throws(() => check(state([actor(unread)])), /invalid path length/);
});

test('full record envelope has at most 4128 path references and includes live Map herds', () => {
  const units = Array.from({ length: limits.maxUnits }, () => actor([], []));
  const nodes = Array.from({ length: limits.maxResourceNodes }, () => ({ wildlifeHerd: { path: [] } }));
  const saved = check(state(units, nodes)), live = check(state(units, new Map(nodes.map((n, i) => [i, n]))));
  assert.deepEqual(saved, live);
  assert.equal(saved.routeArrays, 4128); assert.equal(saved.validatedEntries, 0);
  assert.throws(() => check(state([...units, actor()], nodes)), /invalid unit table/);
  assert.throws(() => check(state(units, [...nodes, {}])), /invalid resource table/);
  assert.throws(() => check(state(units, new Map(Array.from({ length: 129 }, (_, i) => [i, {}])))), /invalid resource table/);
});

test('1000 actors with two 467-cell flank routes plus all herd records fit the proposed envelope', () => {
  const value = state(Array.from({ length: 1000 }, () => actor(Array(467).fill(0), Array(467).fill(cells - 1))),
    Array.from({ length: 128 }, () => ({ wildlifeHerd: { path: Array(64).fill(99999) } })));
  assert.equal(check(value).routeEntries, 942192);
  // Cell validity/retention only: repeated cells do not model a real match path.
});

for (const [label, path] of [
  ['negative', [-1]], ['outside', [cells]], ['fraction', [.5]], ['string', ['1']],
  ['null', [null]], ['undefined', [undefined]], ['NaN', [NaN]], ['infinite', [Infinity]],
  ['sparse', Array(1)], ['typed array', new Uint32Array([1])], ['not array', {}],
]) for (const role of ['active', 'resume', 'wildlife']) test(`XL ${role} rejects ${label} route`, () => {
  const value = role === 'wildlife' ? state([], [{ wildlifeHerd: { path } }])
    : state([role === 'active' ? actor(path) : actor([], path)]);
  assert.throws(() => check(value), /XL route budget invalid (cell index|path length)/);
});

for (const value of [null, {}, state(null), state([], null), state(Array(1)), state([], Array(1)),
  state([null]), state([[]]), state([{ path: [], attackMoveResumePath: undefined }]), state([], [null]),
  state([], [{ wildlifeHerd: 1 }]), state([], [{ wildlifeHerd: [] }]),
  state([], [{ wildlifeHerd: {} }])]) test('XL malformed tables/herds cannot bypass bounded preflight', () => {
  assert.throws(() => check(value), /XL route budget invalid/);
});

test('both XL rectangular orientations use their own cell range; invalid/legacy dimensions defer unchanged', () => {
  for (const definition of [{ width: 320, height: 160 }, { width: 160, height: 320 },
    { width: 257, height: 256 }, { width: 256, height: 257 }]) {
    const count = definition.width * definition.height;
    assert.equal(check(state([actor([count - 1, 0])]), definition).cellCount, count);
    assert.throws(() => check(state([actor([count])]), definition), /invalid cell index/);
  }
  const unread = new Proxy({}, { get() { throw new Error('legacy state must not be read'); } });
  for (const definition of [null, {}, { width: 256, height: 256 }, { width: 160, height: 160 },
    { width: 321, height: 320 }, { width: 320, height: 0 }, { width: 320.5, height: 320 }])
    assert.equal(check(unread, definition), null);
});

test('actual capture body rejects oversized XL routes before vision refresh or path copying', async () => {
  const source = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('\nfunction captureMatchCheckpoint(');
  assert.ok(start > 0);
  const body = source.slice(start, source.indexOf('\nfunction ', start + 1));
  const unread = Array(cells);
  Object.defineProperty(unread, 0, { get() { throw new Error('unexpected route copy'); } });
  const capture = runInNewContext(`(${body})`, {
    preflightXlCheckpointRoutes, authoredMapDefinition: xl,
    units: Array.from({ length: 11 }, () => actor(unread)), resourceNodeStates: new Map(),
    MAX_UNITS: limits.maxUnits, MAX_RESOURCE_NODES: limits.maxResourceNodes,
    ensureVisionMasks() { throw new Error('unexpected vision allocation'); },
  });
  assert.throws(() => capture(1, 1), /exceeds aggregate cell entries/);
});

test('actual restore rejects malformed/oversized XL before activation and keeps ordinary320 gate closed', async () => {
  const map = { id: 'checkpoint-budget-regression', name: 'Checkpoint budget regression', width: 256, height: 256,
    terrainSeed: 881, fogOfWar: true, obstacles: [], resourceNodes: [],
    spawnPoints: [{ team: 0, x: -20.5, z: .5 }, { team: 1, x: 20.5, z: .5 }],
    startingArmySize: 24, startingResources: { food: 150, wood: 250 }, triggers: [], scenarioEvents: [] };
  const fixture = await createPveHeadlessFixture(map);
  try {
    const valid = fixture.replay.checkpoint(), before = [fixture.replay.observe(0), fixture.replay.observe(1)];
    for (const [label, change, expected] of [
      ['aggregate', s => { s.state.units.forEach(u => { u.path = Array(cells).fill(0); }); }, /exceeds aggregate cell entries/],
      ['malformed', s => { s.state.units[0].attackMoveResumePath = [cells]; }, /invalid cell index/],
      ['under budget', () => {}, /width and height must be integers between 16 and 256/],
    ]) {
      const candidate = structuredClone(valid);
      Object.assign(candidate.mapDefinition, xl); change(candidate);
      const unchanged = structuredClone(candidate);
      assert.throws(() => fixture.replay.restore(candidate), expected, label);
      assert.deepEqual(candidate, unchanged, `${label}: no input changes`);
      for (const seat of [0, 1]) assertRecoveredWorkerObservation(fixture.replay.observe(seat), before[seat]);
    }
    // Formerly accepted <=256 leaf envelope must not inherit the XL limit.
    valid.state.units.forEach(u => { u.path = Array(65536).fill(65535); });
    assert.ok(valid.state.units.reduce((n, u) => n + u.path.length, 0) > budget);
    fixture.replay.restore(valid);
    const recovered = fixture.replay.checkpoint();
    assert.equal(recovered.schemaVersion, valid.schemaVersion);
    assert.deepEqual(recovered.mapDefinition, valid.mapDefinition);
    assert.deepEqual(recovered.state.units, valid.state.units);
    const resumed = [fixture.replay.observe(0), fixture.replay.observe(1)];
    fixture.replay.restore(recovered);
    for (const seat of [0, 1]) assertRecoveredWorkerObservation(fixture.replay.observe(seat), resumed[seat]);
    const invalid = structuredClone(valid); invalid.state.units[0].path = [65536];
    assert.throws(() => fixture.replay.restore(invalid), /invalid unit route 0/);
  } finally { await fixture.dispose(); }
});
