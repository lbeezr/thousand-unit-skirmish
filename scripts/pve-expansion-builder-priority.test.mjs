import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductionPolicy } from '../src/pve-production.mjs';
import { createDeterministicPolicy, toOpponentObservation } from '../src/pve-opponent.mjs';
import { BUILDING_DEFINITIONS as buildings } from '../src/gameplay-definitions.mjs';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';

function state(team = 0) {
  const x = team === 0 ? -28 : 28;
  return {
    schemaVersion: 1, team, tick: 0, map: { id: 'expansion-priority', width: 80, height: 64 },
    fogOfWar: false, resources: { food: 1000, wood: 2000 },
    units: { friendly: Array.from({ length: 8 }, (_, id) => ({ id, generation: 1, team,
      x, z: id < 4 ? 0 : 3, hp: 100, kind: id < 4 ? 'worker' : 'infantry',
      task: id < 4 ? 'gathering' : null, cargo: 0, cargoType: null })), visibleEnemies: [] },
    buildings: { friendly: [
      { id: 100, team, type: 'barracks', x, z: 8, hp: 1000, complete: true, queue: 0,
        productionOptions: [{ kind: 'infantry', available: true }, { kind: 'spearman', available: false }] },
      { id: 101, team, type: 'storehouse', x: x / 2, z: 8, hp: 1000, complete: true, queue: 0 },
      { id: 103, team, type: 'stable', x, z: -8, hp: 1000, complete: true, queue: 0 },
    ], visibleEnemies: [] },
    workerProduction: { queue: 0 }, resourceNodes: [{ id: 'remote', type: 'wood', x: x / 2, z: 0, stock: 1000 }], objectives: [],
  };
}
const worker = (s, id = 0) => s.units.friendly.find(u => u.id === id);
const expansion = commands => commands.find(c => c.type === 'build' && (c.buildingType === 'town-center' || c.buildingId === 102));
function ready(s, seed = 0) {
  const p = createProductionPolicy(seed); p.next(s); s.tick = 300; return p;
}
function delivery(p, s, id = 0) {
  Object.assign(worker(s, id), { task: 'returning', cargo: 10 }); s.tick += 30; p.next(s);
  Object.assign(worker(s, id), { task: 'gathering', cargo: 0 }); s.tick += 900;
}

for (const team of [0, 1]) for (const seed of [0, 20260925, 0xffff_ffff]) {
  test(`seat ${team}, seed ${seed}: idle priority, completed delivery fallback and deterministic immutable input`, () => {
    const s = state(team), p = ready(s, seed);
    worker(s, 3).task = 'idle';
    const before = structuredClone(s), commands = p.next(s);
    assert.deepEqual(expansion(commands)?.ids, [3], 'higher-ID idle beats new empty Gather');
    assert.deepEqual(s, before);
    assert.equal(expansion(p.next(s)), undefined, 'same decision does not purchase again');
    const a = state(team), b = structuredClone(a), pa = ready(a, seed), pb = ready(b, seed);
    delivery(pa, a); delivery(pb, b);
    assert.deepEqual(pa.next(a), pb.next(b));
    const replay = ready(state(team), seed); // Cold policy has no delivery evidence.
    assert.equal(expansion(replay.next({ ...a, tick: 300 })), undefined);
    assert.deepEqual(expansion(createDelivered(team, seed))?.ids, [0]);
  });
}
function createDelivered(team, seed) {
  const s = state(team), p = ready(s, seed); delivery(p, s); return p.next(s);
}

test('fresh Gather, cargo, repeated observations and elapsed time never invent completion', () => {
  const s = state(), p = ready(s);
  // Stable already exists so other producer work does not mask deferral.
  s.buildings.friendly.push({ id: 103, team: 0, type: 'stable', hp: 100, complete: true, queue: 0 });
  for (const tick of [300, 300, 900, 1800, 3600, 7200]) {
    s.tick = tick; assert.equal(expansion(p.next(s)), undefined);
  }
  worker(s).cargo = 10; p.next(s);
  worker(s).cargo = 0; p.next(s);
  s.tick += 30; assert.equal(expansion(p.next(s)), undefined, 'same-tick cargo changes cannot manufacture a receipt');
  worker(s).cargo = 5; s.tick += 30; p.next(s);
  worker(s).task = 'returning'; s.tick += 30;
  assert.equal(expansion(p.next(s)), undefined, 'a return in progress still carries cargo');
  worker(s).cargo = 0; worker(s).task = 'gathering'; s.tick += 900;
  assert.deepEqual(expansion(p.next(s))?.ids, [0]);
});

test('history updates during opening, backoff and active construction; new episodes and identities prune it', () => {
  for (const reset of ['generation', 'missing', 'dead', 'foreign', 'kind', 'idle', 'building', 'rewind']) {
    const s = state(), p = createProductionPolicy(0);
    worker(s).task = 'returning'; worker(s).cargo = 10; p.next(s);
    s.tick = 30; worker(s).task = 'gathering'; worker(s).cargo = 0; p.next(s);
    s.tick = 60;
    if (reset === 'generation') worker(s).generation++;
    if (reset === 'missing') s.units.friendly = s.units.friendly.filter(u => u.id !== 0);
    if (reset === 'dead') worker(s).hp = 0;
    if (reset === 'foreign') worker(s).team = 1;
    if (reset === 'kind') worker(s).kind = 'infantry';
    if (['idle', 'building'].includes(reset)) worker(s).task = reset;
    if (reset === 'rewind') s.tick = 0;
    p.next(s);
    if (reset === 'missing') s.units.friendly.unshift(structuredClone(state().units.friendly[0]));
    Object.assign(worker(s), { hp: 100, team: 0, kind: 'worker', task: 'gathering', cargo: 0 });
    s.tick = 300;
    assert.equal(expansion(p.next(s)), undefined, reset);
    s.tick = 1800; delivery(p, s);
    assert.deepEqual(expansion(p.next(s))?.ids, [0], `${reset}: new observed delivery restores eligibility`);
  }
  const s = state(), p = ready(s);
  // Training postpones the next production attempt, but observations of this
  // genuine delivery must still be retained while the attempt is deferred.
  assert.ok(p.next(s).some(c => ['train', 'trainUnit', 'build'].includes(c.type)));
  delivery(p, s); s.tick += 900;
  assert.deepEqual(expansion(p.next(s))?.ids, [0]);
});

test('cold policy forgets old completion, learns a future completion and resumes the paid foundation', () => {
  const s = state(), warm = ready(s); delivery(warm, s);
  const cold = ready(structuredClone(s));
  s.tick = 300; assert.equal(expansion(cold.next(s)), undefined);
  s.buildings.friendly.push({ id: 102, team: 0, type: 'town-center', hp: 100, complete: false, queue: 0, x: 0, z: 8 });
  s.tick = 1800; delivery(cold, s);
  assert.deepEqual(expansion(cold.next(s)), { type: 'build', ids: [0], unitGenerations: [1], buildingId: 102 });
});

test('delivery evidence survives active-production observations but not a same-tick interruption', () => {
  const s = state(), p = ready(s);
  s.buildings.friendly[0].queue = 1;
  Object.assign(worker(s), { task: 'returning', cargo: 10 }); p.next(s);
  s.tick = 330; Object.assign(worker(s), { task: 'gathering', cargo: 2 }); p.next(s);
  // A sampled return-to-Gather transition may already include new harvested
  // cargo; that completion is useful only once the Worker is empty again.
  s.tick = 360; worker(s, 1).task = 'building'; worker(s).cargo = 0; p.next(s);
  s.tick = 900; worker(s, 1).task = 'gathering'; s.buildings.friendly[0].queue = 0;
  assert.deepEqual(expansion(p.next(s))?.ids, [0]);
  worker(s).task = 'idle'; p.next(s);
  worker(s).task = 'gathering'; p.next(s);
  s.tick = 1800;
  assert.equal(expansion(p.next(s)), undefined, 'same-tick observed interruption conservatively clears the old episode');
});

test('deferring expansion preserves other production, urgent recovery and same-decision Gather exclusion', () => {
  const s = state(), p = ready(s);
  s.buildings.friendly.push({ id: 103, team: 0, type: 'stable', hp: 100, complete: true, queue: 0 });
  assert.deepEqual(p.next(s), [{ type: 'train', buildingId: 100 }]);
  const urgent = state(); urgent.population = { available: 0, capacity: 15 }; const recovery = ready(urgent);
  assert.equal(recovery.next(urgent)[0]?.buildingType, 'house', 'nearby recovery builder retains priority');
  const resumed = state(); worker(resumed, 3).task = 'idle';
  const policy = createDeterministicPolicy(20260925), shadow = createDeterministicPolicy(20260925);
  policy.next(resumed); shadow.next(structuredClone(resumed)); resumed.tick = 300;
  const commands = policy.next(resumed);
  assert.deepEqual(commands, shadow.next(structuredClone(resumed)));
  const build = expansion(commands); assert.deepEqual(build?.ids, [3]);
  assert.ok(commands.filter(c => c.type === 'gather').every(c => !c.ids.includes(3)));
});

process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp'; process.env.RTS_PREGAME = '0';
delete process.env.RTS_MATCH_STATE_PATH;
for (const team of [0, 1]) test(`seat ${team}: native paid normal expansion, conservation and cold replay`, async () => {
  const x = team === 0 ? -28 : 28;
  const map = { id: 'expansion-native', name: 'Expansion Native', width: 80, height: 64,
    terrainSeed: 19, fogOfWar: false, startingArmySize: 16, startingResources: { food: 1000, wood: 2000 },
    spawnPoints: [{ team: 0, x: -28, z: 0 }, { team: 1, x: 28, z: 0 }], obstacles: [],
    resourceNodes: [{ id: 'remote', type: 'wood', x: x / 5, z: 0, stock: 1000 }], triggers: [], scenarioEvents: [] };
  const fixture = await createPveHeadlessFixture(map), r = fixture.replay;
  try {
    const opening = r.checkpoint();
    const builder = r.observe(team).units.find(u => u[5] === 'worker' && u[1] === team);
    let spentWood = 0, spentFood = 0;
    for (const [type, point] of [['barracks', { x: x + (team ? -4 : 4), z: 8 }], ['storehouse', { x: x / 5, z: 8 }]]) {
      const notices = await r.order(team, { type: 'build', buildingType: type, ids: [builder[0]], unitGenerations: [builder[8]], ...point });
      assert.ok(!notices.some(n => /REJECTED|FAILED/.test(n.message || '')));
      spentWood += buildings[type].cost.wood; spentFood += buildings[type].cost.food;
      for (let i = 0; i < 2700 && !r.observe(team).buildings.some(b => b.type === type && b.complete); i++) r.step();
      assert.ok(r.observe(team).buildings.some(b => b.type === type && b.complete), `ordinary paid ${type} completes`);
    }
    const policy = createProductionPolicy(20260925), shadow = createProductionPolicy(20260925);
    policy.next(toOpponentObservation(r.observe(team), team, map)); shadow.next(toOpponentObservation(r.observe(team), team, map));
    for (let i = 0; i < 300; i++) r.step();
    const observation = toOpponentObservation(r.observe(team), team, map), commands = policy.next(observation);
    assert.deepEqual(commands, shadow.next(structuredClone(observation)));
    const build = expansion(commands); assert.ok(build, `normal native idle economy still expands: tasks=${observation.units.friendly.filter(u => u.kind === 'worker').map(u => u.task).join(',')}; commands=${commands.map(c => c.type).join(',')}`);
    assert.ok(!((await r.order(team, build)).some(n => /REJECTED|FAILED/.test(n.message || ''))));
    spentWood += buildings['town-center'].cost.wood; spentFood += buildings['town-center'].cost.food;
    const checkpoint = r.checkpoint(), before = r.observe(team);
    const finish = () => {
      for (let i = 0; i < 2700 && !r.observe(team).buildings.some(b => b.type === 'town-center' && !b.home && b.complete); i++) r.step();
      assert.equal(r.observe(team).buildings.filter(b => b.type === 'town-center' && !b.home && b.complete).length, 1);
      return r.checkpoint();
    };
    const final = finish();
    assert.equal(opening.state.teamWood[team] - final.state.teamWood[team], spentWood);
    assert.equal(opening.state.teamFood[team] - final.state.teamFood[team], spentFood);
    assert.deepEqual(final.state.resourceNodes, opening.state.resourceNodes, 'construction invents no harvested stock');
    assert.ok(final.state.units.filter(u => u.team === team).every(u => u.cargo === 0));
    r.restore(checkpoint); assertRecoveredWorkerObservation(r.observe(team), before);
    const restoredFinal = finish();
    assert.deepEqual(restoredFinal.state.teamFood, final.state.teamFood);
    assert.deepEqual(restoredFinal.state.teamWood, final.state.teamWood);
    assert.deepEqual(restoredFinal.state.resourceNodes, final.state.resourceNodes);
    assert.deepEqual(restoredFinal.state.buildings, final.state.buildings);
    assert.equal(restoredFinal.state.tickNumber, final.state.tickNumber);
    assert.ok(restoredFinal.state.units.filter(u => u.team === team).every(u => u.cargo === 0));
    // Restore legitimately allocates a new movement order revision for the
    // in-flight builder. Compare complete cold runs with the same cold input,
    // rather than deleting those authoritative fields to match a warm run.
    r.restore(checkpoint);
    assert.deepEqual(finish(), restoredFinal, 'complete native cold expansion replay is exact');
  } finally { await fixture.dispose(); }
});
