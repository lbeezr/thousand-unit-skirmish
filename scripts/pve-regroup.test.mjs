import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegroupPolicy, PVE_REGROUP_LIMITS as limits } from '../src/pve-regroup.mjs';
import { createDeterministicPolicy, toOpponentObservation } from '../src/pve-opponent.mjs';
import { createPveHeadlessFixture } from './pve-headless-fixture.mjs';

process.env.RTS_MAP = 'maps/open-field.json';
process.env.RTS_GAME_MODE = 'pvp';
process.env.RTS_PREGAME = '0';
delete process.env.RTS_MATCH_STATE_PATH;

const unit = (team, id, overrides = {}) => ({ id, team, generation: 1, kind: 'infantry', hp: 100,
  x: team ? 24 : -24, z: 0, focusedCount: 0, lastAttack: null, ...overrides });
function observation(team) {
  return { schemaVersion: 1, team, tick: 0, map: { width: 80, height: 64 }, fogOfWar: false,
    units: { friendly: Array.from({ length: 8 }, (_, id) => unit(team, id)), visibleEnemies: [] },
    buildings: { friendly: [], visibleEnemies: [] }, resourceNodes: [],
    objectives: [{ id: 'watch', owner: -1, victory: true, zone: { column: 37, row: 29, width: 6, height: 6 } }] };
}

for (const team of [0, 1]) for (const seed of [0, 20260925, 0xffff_ffff]) {
  test(`seat ${team}, seed ${seed}: coherent recovery, bounded release and urgent defense`, () => {
    const state = observation(team), policy = createDeterministicPolicy(seed);
    assert.equal(policy.next(state)[0].ids.length, 8, 'the opening army advances normally');
    state.tick = 30; state.units.friendly = [];
    assert.deepEqual(policy.next(state), []);
    for (let count = 1; count < limits.units; count++) {
      state.tick = 30 + count * 30; state.units.friendly.push(unit(team, count + 10));
      const commands = policy.next(state);
      assert.ok(commands.some(c => c.type === 'move'));
      assert.ok(!commands.some(c => c.type === 'attackMove'), 'fresh replacements rally instead of advancing singly');
      assert.deepEqual(policy.next(state), [], 'identical observations cannot repeat a rally order');
    }
    state.tick += 30; state.units.friendly.push(unit(team, 20));
    const release = policy.next(state).find(c => c.type === 'attackMove');
    assert.equal(release.ids.length, limits.units, 'the recovered group advances together');

    const timed = observation(team), impatient = createDeterministicPolicy(seed);
    impatient.next(timed); timed.tick = 30; timed.units.friendly = []; impatient.next(timed);
    timed.tick = 60; timed.units.friendly = [unit(team, 21)]; impatient.next(timed);
    timed.tick = 60 + limits.maxWaitTicks - 1;
    assert.ok(!impatient.next(timed).some(c => c.type === 'attackMove'));
    timed.tick++;
    assert.equal(impatient.next(timed).find(c => c.type === 'attackMove').ids.length, 1,
      'a halted producer cannot hold its one available replacement forever');

    for (const count of [1, limits.units]) {
      const engaged = observation(team), preserving = createDeterministicPolicy(seed);
      preserving.next(engaged); engaged.tick = 30; engaged.units.friendly = []; preserving.next(engaged);
      engaged.tick = 60; engaged.units.friendly = [unit(team, 45)]; preserving.next(engaged);
      engaged.units.friendly[0].focusedCount = 1;
      engaged.units.friendly.push(...Array.from({ length: count - 1 }, (_, id) => unit(team, 46 + id)));
      engaged.tick = count === 1 ? 60 + limits.maxWaitTicks : 90;
      const released = preserving.next(engaged).find(c => c.type === 'attackMove');
      assert.ok(!released?.ids.includes(45), 'threshold and deadline release preserve a fighting member');
      if (count > 1) assert.equal(released.ids.length, count - 1, 'eligible members release on schedule');
      engaged.units.friendly[0].focusedCount = 0; engaged.units.friendly[0].lastAttack = { tick: engaged.tick };
      engaged.tick += 119;
      assert.ok(!preserving.next(engaged).some(c => c.type === 'attackMove' && c.ids.includes(45)));
      engaged.tick++;
      assert.ok(preserving.next(engaged).some(c => c.type === 'attackMove' && c.ids.includes(45)),
        'the released fighter joins objective pressure when combat protection ends');
    }

    const urgent = observation(team), defending = createDeterministicPolicy(seed);
    defending.next(urgent); urgent.tick = 30; urgent.units.friendly = []; defending.next(urgent);
    urgent.units.friendly = [unit(team, 30), unit(team, 31, { kind: 'worker', task: 'idle', cargo: 0 })];
    urgent.units.visibleEnemies = [unit(1 - team, 40, { x: team ? 20 : -20 })]; urgent.tick = 60;
    const response = defending.next(urgent);
    assert.ok(response.some(c => c.type === 'attackMove' && c.x === urgent.units.visibleEnemies[0].x),
      'a fresh replacement immediately answers a visible threat to an owned Worker');
    assert.ok(!response.some(c => c.type === 'move'), 'rally does not override home defense');
  });

  test(`seat ${team}, seed ${seed}: ownership, roles, generation, combat, retries and resumed economy`, () => {
    const state = observation(team), regroup = createRegroupPolicy();
    regroup.next(state, state.units.friendly); state.tick = 30; regroup.next(state, []);
    const replacement = unit(team, 50), other = unit(team, 51, { x: replacement.x + 8 });
    state.tick = 60;
    assert.equal(regroup.next(state, [replacement]).commands[0].unitGenerations[0], 1);
    state.tick = 90;
    assert.equal(regroup.next(state, [replacement, other]).commands[0].ids[0], other.id);
    for (const kind of ['scout', 'siege-engine', 'worker', 'unknown']) {
      const result = regroup.next(state, [replacement, other, ...Array.from({ length: 5 }, (_, id) => unit(team, id + 60, { kind }))]);
      assert.equal(result.units.length, 2, `${kind} does not satisfy the combat group`);
    }
    assert.equal(regroup.next(state, [replacement, other, ...Array.from({ length: 5 }, (_, id) => unit(1 - team, id + 70))]).units.length, 2);
    other.generation++;
    assert.equal(regroup.next(state, [replacement, other]).commands[0].unitGenerations[0], 2);
    other.focusedCount = 1; state.tick = 90 + limits.retryTicks;
    assert.deepEqual(regroup.next(state, [replacement, other]).commands, [], 'combat remains intact');
    other.focusedCount = 0; other.lastAttack = { tick: state.tick }; state.tick += 119;
    assert.deepEqual(regroup.next(state, [replacement, other]).commands, [], 'recent combat remains intact');
    state.tick++;
    assert.equal(regroup.next(state, [replacement, other]).commands[0].ids[0], other.id);
    other.x -= 1; state.tick += limits.retryTicks;
    assert.deepEqual(regroup.next(state, [replacement, other]).commands, [], 'movement resets a rally retry');

    const resumed = observation(team); resumed.tick = 900; resumed.units.friendly = [unit(team, 80)];
    const barracks = { id: 2, team, type: 'barracks', hp: 1800, complete: true, queue: 0, x: replacement.x, z: 6,
      productionOptions: [{ kind: 'infantry', available: true }] };
    for (const mutate of [b => { b.team = 1 - team; }, b => { b.hp = 0; }, b => { b.type = 'house'; }]) {
      const guarded = structuredClone(resumed); guarded.buildings.friendly = [structuredClone(barracks)]; mutate(guarded.buildings.friendly[0]);
      assert.deepEqual(createRegroupPolicy().next(guarded, guarded.units.friendly).units, [], 'only an established owned producer infers resumed recovery');
    }
    resumed.buildings.friendly = [barracks];
    assert.equal(createRegroupPolicy().next(resumed, resumed.units.friendly).units.length, 1);
    const foundation = structuredClone(resumed); foundation.buildings.friendly[0].complete = false;
    foundation.units.friendly = [];
    const pending = createRegroupPolicy(); pending.next(foundation, []);
    foundation.tick += 300; foundation.buildings.friendly[0].complete = true; foundation.units.friendly = [unit(team, 81)];
    assert.equal(pending.next(foundation, foundation.units.friendly).units.length, 1, 'restart during an empty-army paid foundation still regroups its first recruit');
    resumed.units.friendly.push(...Array.from({ length: 3 }, (_, id) => unit(team, 90 + id, { kind: 'worker', task: 'gathering', cargo: 0 })));
    resumed.resources = { food: 200, wood: 250 };
    resumed.population = { used: 5, reserved: 0, capacity: 15, available: 10 };
    resumed.buildings.friendly.push({ id: 1_000_000_000 + team, team, type: 'town-center', home: true, hp: 2400, complete: true, queue: 0,
      x: replacement.x, z: 0, productionOptions: [{ kind: 'worker', available: true }] });
    const producing = createDeterministicPolicy(seed); producing.next(resumed);
    resumed.tick += 300;
    assert.ok(producing.next(resumed).some(c => c.type === 'trainUnit' && c.kind === 'worker'),
      'paid Worker recovery remains active while combat replacements rally');
  });
}

async function recoveryReplay(team, initial) {
  const home = team ? 28 : -28, enemy = 1 - team;
  const map = { id: 'pve-regroup-replay', name: 'PvE Regroup Replay', width: 80, height: 64,
    terrainSeed: 19, fogOfWar: true, startingArmySize: 24, startingResources: { food: 150, wood: 250 },
    spawnPoints: [{ team, x: home, z: 0 }, { team: enemy, x: team ? -12 : 12, z: 0 }], obstacles: [],
    resourceNodes: [{ id: 'food', type: 'food', x: home, z: 6.5, stock: 2000 },
      { id: 'wood', type: 'wood', x: home, z: -6.5, stock: 2000 }],
    triggers: [{ id: 'watch', name: 'Watch', type: 'capture-zone', zone: { column: 37, row: 29, width: 6, height: 6 },
      requiredUnits: 5, captureSeconds: 9, foodReward: 0, woodReward: 0, unitCount: 0, unitKind: 'infantry', victory: false }], scenarioEvents: [] };
  const fixture = await createPveHeadlessFixture(map), r = fixture.replay;
  try {
    if (initial) r.restore(initial); initial ??= r.checkpoint();
    let policy = createDeterministicPolicy(20260925), shadow = createDeterministicPolicy(20260925);
    const trace = [], guards = toOpponentObservation(r.observe(enemy), enemy, map).units.friendly.filter(u => u.kind === 'infantry');
    const order = async (seat, command) => {
      const notices = await r.order(seat, command);
      assert.ok(!notices.some(n => /REJECTED|FAILED|UNREACHABLE/.test(n.message || '')), JSON.stringify(notices));
      trace.push({ tick: r.observe(team).tick, team: seat, command });
    };
    await order(enemy, { type: 'move', ids: guards.map(u => u.id), unitGenerations: guards.map(u => u.generation), x: 0, z: 0 });
    const opening = toOpponentObservation(r.observe(team), team, map);
    const openingCommands = policy.next(opening);
    assert.deepEqual(openingCommands, shadow.next(structuredClone(opening)));
    for (const command of openingCommands) await order(team, command);
    const exposed = opening.units.friendly.filter(u => u.kind === 'infantry');
    // A controlled loss prelude uses a normal Move through the public crossing,
    // with no attack-move cover. All deaths still occur in real combat.
    await order(team, { type: 'move', ids: exposed.map(u => u.id), unitGenerations: exposed.map(u => u.generation), x: -home / 2, z: 0 });
    let stopped = false, targetKey = null, wipedAt = null, firstAdvance = null, capturedAt = null, restoredAt = null;
    let maxReplacements = 0, spentFood = 0, spentWood = 0;
    for (let tick = 0; tick <= 18000; tick++) {
      if (r.observe(team).tick % 30 === 0) {
        let observation = toOpponentObservation(r.observe(team), team, map);
        const army = observation.units.friendly.filter(u => u.hp > 0 && u.kind !== 'worker' && u.kind !== 'scout');
        if (army.length === 0) wipedAt ??= observation.tick;
        if (wipedAt !== null) maxReplacements = Math.max(maxReplacements, army.length);
        if (wipedAt !== null && restoredAt === null && army.length >= 2 && army.length < limits.units) {
          r.drain(); const before = r.observe(team), checkpoint = r.checkpoint(); r.restore(checkpoint);
          assert.deepEqual(r.observe(team), before, 'restart preserves paid queues, rally paths, units, fog, cargo and banks');
          policy = createDeterministicPolicy(20260925); shadow = createDeterministicPolicy(20260925);
          restoredAt = observation.tick; trace.push({ tick: restoredAt, restart: true });
          observation = toOpponentObservation(r.observe(team), team, map);
        }
        const commands = wipedAt === null ? [] : policy.next(observation);
        if (wipedAt !== null) assert.deepEqual(commands, shadow.next(structuredClone(observation)));
        for (const command of commands) {
          if (wipedAt !== null && firstAdvance === null && command.type === 'attackMove' && command.x === 0 && command.z === 0) {
            firstAdvance = { tick: observation.tick, units: command.ids.length };
            assert.ok(command.ids.length >= limits.units, 'real paid replacements return as a capture-sized group');
          }
          const before = r.observe(team); await order(team, command); const after = r.observe(team);
          spentFood += before.food[team] - after.food[team]; spentWood += before.wood[team] - after.wood[team];
        }
        if (!stopped && observation.tick >= 180) {
          await order(enemy, { type: 'holdPosition', ids: guards.map(u => u.id), unitGenerations: guards.map(u => u.generation) }); stopped = true;
        }
        // An ordinary opposing seat focuses only attackers in its own sight.
        const enemyView = toOpponentObservation(r.observe(enemy), enemy, map);
        const target = enemyView.units.visibleEnemies.filter(u => u.hp > 0 && u.kind !== 'worker' && u.kind !== 'scout')
          .sort((a, b) => a.hp - b.hp || a.id - b.id)[0];
        const activeGuards = enemyView.units.friendly.filter(u => guards.some(g => g.id === u.id) && u.hp > 0);
        const nextTarget = target ? `${target.id}:${target.generation}` : null;
        if (activeGuards.length && nextTarget !== targetKey) {
          await order(enemy, { ids: activeGuards.map(u => u.id), unitGenerations: activeGuards.map(u => u.generation),
            ...(target ? { type: 'attack', targetId: target.id, targetGeneration: target.generation } : { type: 'holdPosition' }) });
          targetKey = nextTarget;
        }
        if (observation.objectives[0].owner === team && wipedAt !== null) { capturedAt = observation.tick; break; }
      }
      r.step();
    }
    assert.ok(wipedAt !== null && restoredAt !== null && firstAdvance !== null && capturedAt !== null,
      `real wipeout, resumed rally, group and retake must complete: ${JSON.stringify({ wipedAt, restoredAt, firstAdvance, capturedAt, maxReplacements })}`);
    const final = r.checkpoint().state, workers = final.units.filter(u => u.team === team && u.kind === 'worker' && u.hp > 0);
    assert.equal(workers.length, 4);
    for (const [resource, spent] of [['food', spentFood], ['wood', spentWood]]) {
      const cargo = workers.filter(u => u.cargoType === resource).reduce((sum, u) => sum + u.cargo, 0);
      const stock = final.resourceNodes.find(n => n.id === resource).stock;
      assert.ok(Math.abs(map.startingResources[resource] + 2000 - stock - cargo - spent
        - final[resource === 'food' ? 'teamFood' : 'teamWood'][team]) < 1e-5, 'all recovery recruitment and construction remain paid');
    }
    return { initial, result: { team, wipedAt, restoredAt, firstAdvance, capturedAt, maxReplacements,
      food: final.teamFood[team], wood: final.teamWood[team], spentFood, spentWood, trace } };
  } finally { await fixture.dispose(); }
}

for (const team of [0, 1]) test(`seat ${team}: real paid wipeout, checkpoint rally and objective retake`, async () => {
  const first = await recoveryReplay(team), second = await recoveryReplay(team, first.initial);
  assert.deepEqual(second.result, first.result, 'the entire restarted authoritative recovery replays identically');
  const { trace, ...evidence } = first.result; console.log(JSON.stringify(evidence));
});
