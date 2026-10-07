import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeterministicPolicy, toOpponentObservation } from '../src/pve-opponent.mjs';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';
import { createHomeDefensePolicy, PVE_HOME_DEFENSE_LIMITS } from '../src/simulation/ai/policies/home-defense.mjs';

process.env.RTS_MAP = 'maps/open-field.json';
process.env.RTS_GAME_MODE = 'pvp';
process.env.RTS_PREGAME = '0';
delete process.env.RTS_MATCH_STATE_PATH;

async function raidReplay(team, seed, targetType, initialCheckpoint) {
  const homeX = team ? 28 : -28, enemy = 1 - team;
  const map = { id: 'pve-visible-home-raid', name: 'Visible Home Raid', width: 80, height: 64,
    terrainSeed: 19, fogOfWar: true, startingArmySize: 24,
    startingResources: { food: 0, wood: 0 },
    spawnPoints: [{ team: 0, x: -28, z: 0 }, { team: 1, x: 28, z: 0 }],
    obstacles: [], resourceNodes: [{ id: 'home-food', type: 'food', x: homeX, z: 6.5, stock: 1000 }],
    triggers: [{ id: 'center-watch', name: 'Center Watch', type: 'capture-zone',
      zone: { column: 37, row: 29, width: 6, height: 6 }, requiredUnits: 5,
      captureSeconds: 9, foodReward: 0, woodReward: 0, unitCount: 0, unitKind: 'infantry', victory: false }],
    scenarioEvents: [] };
  const fixture = await createPveHeadlessFixture(map), r = fixture.replay;
  try {
    if (initialCheckpoint) r.restore(initialCheckpoint);
    initialCheckpoint ??= r.checkpoint();
    let policy = createDeterministicPolicy(seed), shadow = createDeterministicPolicy(seed);
    const initial = toOpponentObservation(r.observe(team), team, map);
    const workerIds = initial.units.friendly.filter(u => u.kind === 'worker').map(u => u.id);
    const soldierIds = initial.units.friendly.filter(u => u.kind === 'infantry').map(u => u.id);
    const raider = toOpponentObservation(r.observe(enemy), enemy, map).units.friendly.find(u => u.kind === 'infantry');
    assert.equal(initial.units.visibleEnemies.length, 0, 'the remote enemy opening is hidden');
    const trace = [], defenderIds = new Set();
    const order = async (seat, command) => {
      const notices = await r.order(seat, command);
      assert.ok(!notices.some(n => /REJECTED|FAILED|UNREACHABLE/.test(n.message || '')), JSON.stringify(notices));
      trace.push({ tick: r.observe(team).tick, team: seat, command });
    };
    // One ordinary starting Infantry raids via the flank with real queued
    // movement. No units, positions, hit points or resources are injected.
    for (const [index, point] of [{ x: -homeX, z: 16.5 }, { x: homeX + (team ? -6 : 6), z: 16.5 },
      { x: homeX + (team ? -1 : 1) * (targetType === 'workers' ? 6 : 1), z: targetType === 'workers' ? 6.5 : 3.5 }].entries()) {
      await order(enemy, { type: 'move', ids: [raider.id], unitGenerations: [raider.generation], ...point, queue: index > 0 });
    }
    let firstVisible = null, firstResponse = null, defeatedAt = null, returnedAt = null, resumedDeposit = null;
    const restarts = [];
    let bankAtDefeat = null, attackedTarget = null, homeHp = 2400;
    for (let tick = 0; tick <= 6000; tick++) {
      if (r.observe(team).tick % 30 === 0) {
        const observation = toOpponentObservation(r.observe(team), team, map);
        homeHp = Math.min(homeHp, observation.buildings.friendly.find(b => b.home)?.hp ?? 0);
        const visible = observation.units.visibleEnemies.find(u => u.id === raider.id && u.hp > 0);
        if (visible) firstVisible ??= observation.tick;
        const commands = policy.next(observation);
        assert.deepEqual(commands, shadow.next(observation), 'same observed history and seed reproduce every decision');
        for (const command of commands) {
          if (command.type === 'attackMove' && Math.hypot(command.x - homeX, command.z) < 16) {
            firstResponse ??= observation.tick;
            for (const id of command.ids) defenderIds.add(id);
          }
          await order(team, command);
        }
        // The raider can select a Worker only through its own fogged view.
        const enemyObservation = toOpponentObservation(r.observe(enemy), enemy, map);
        const livingRaider = enemyObservation.units.friendly.find(u => u.id === raider.id && u.hp > 0);
        if (livingRaider) {
          const target = targetType === 'workers'
            ? enemyObservation.units.visibleEnemies.filter(u => u.kind === 'worker' && u.hp > 0).sort((a, b) => a.id - b.id)[0]
            : enemyObservation.buildings.visibleEnemies.find(b => b.home && b.hp > 0);
          if (target && target.id !== attackedTarget) {
            await order(enemy, { ids: [raider.id], unitGenerations: [raider.generation], ...(targetType === 'workers'
              ? { type: 'attack', targetId: target.id, targetGeneration: target.generation }
              : { type: 'attackBuilding', buildingId: target.id }) });
            attackedTarget = target.id;
          }
        } else if (defeatedAt === null) { defeatedAt = observation.tick; bankAtDefeat = r.observe(team).food[team]; }
        const restart = firstResponse !== null && !restarts.some(event => event.stage === 'responding') && observation.tick >= firstResponse + 60
          ? 'responding' : defeatedAt !== null && !restarts.some(event => event.stage === 'regrouping') && observation.tick >= defeatedAt + 30 ? 'regrouping' : null;
        if (restart) {
          r.drain(); const snapshot = r.checkpoint(), before = r.observe(team); r.restore(snapshot);
          assertRecoveredWorkerObservation(r.observe(team), before, 'checkpoint preserves real raid, orders, casualties, cargo, bank and fog');
          policy = createDeterministicPolicy(seed); shadow = createDeterministicPolicy(seed);
          restarts.push({ tick: observation.tick, stage: restart }); trace.push({ tick: observation.tick, restart });
        }
        if (defeatedAt !== null) {
          const survivingDefenders = observation.units.friendly.filter(u => defenderIds.has(u.id) && u.hp > 0);
          if (survivingDefenders.length && survivingDefenders.every(u => Math.abs(u.x) <= 3 && Math.abs(u.z) <= 3)) returnedAt ??= observation.tick;
          if (r.observe(team).food[team] > bankAtDefeat + 1e-5) resumedDeposit ??= observation.tick;
          if (returnedAt !== null && resumedDeposit !== null) break;
        }
      }
      r.step();
    }
    const final = toOpponentObservation(r.observe(team), team, map);
    const survivingOpeningWorkers = final.units.friendly.filter(u => workerIds.includes(u.id) && u.hp > 0).length;
    assert.ok(firstVisible !== null && firstResponse !== null, `visible raid must recall objective troops: ${JSON.stringify({ firstVisible, firstResponse, defeatedAt, survivingOpeningWorkers, food: final.resources.food, defenderIds: [...defenderIds] })}`);
    assert.equal(firstResponse, firstVisible, 'visible economic threat receives the next normal decision');
    assert.ok(defenderIds.size <= 4, 'recall a bounded detachment and leave the rest at the objective');
    assert.ok(defeatedAt !== null && returnedAt !== null && resumedDeposit !== null, 'real defenders defeat the raid, return to the watch and economy deposits again');
    assert.ok(survivingOpeningWorkers >= 2, 'the starting Worker economy survives the raid');
    assert.ok(homeHp > 0 && attackedTarget !== null, `the raider issues a valid observed attack and the home survives: ${JSON.stringify({ homeHp, attackedTarget, defeatedAt, firstVisible, firstResponse, enemies: r.observe(enemy).homeTownCenters })}`);
    assert.deepEqual(restarts.map(event => event.stage), ['responding', 'regrouping']);
    assert.ok(soldierIds.filter(id => !defenderIds.has(id)).every(id => {
      const unit = final.units.friendly.find(u => u.id === id); return unit?.hp > 0 && Math.abs(unit.x) <= 3 && Math.abs(unit.z) <= 3;
    }), 'the rest of the opening army keeps the watch');
    return { initialCheckpoint, result: { team, seed, targetType, firstVisible, firstResponse, defeatedAt, returnedAt, resumedDeposit, homeHp,
      survivingOpeningWorkers, defenderIds: [...defenderIds].sort((a, b) => a - b), restarts, trace } };
  } finally { await fixture.dispose(); }
}

for (const team of [0, 1]) for (const seed of [0, 20260925, 0xffff_ffff]) for (const targetType of ['workers', 'building']) {
  test(`seat ${team}, seed ${seed}, ${targetType}: visible raid, bounded defense, checkpoint and objective recovery`, async () => {
    const first = await raidReplay(team, seed, targetType);
    const second = await raidReplay(team, seed, targetType, first.initialCheckpoint);
    assert.deepEqual(second.result, first.result, 'complete authoritative raid replays identical orders and recovery');
    const { trace, ...evidence } = first.result; console.log(JSON.stringify(evidence));
  });
}

function threatObservation(team) {
  const x = team ? 20 : -20;
  return { schemaVersion: 1, team, tick: 0, fogOfWar: false, map: { width: 64, height: 64 },
    resources: { food: 0, wood: 0 }, units: { friendly: [
      { id: 0, team, generation: 3, kind: 'worker', hp: 100, x, z: 0, task: 'idle', cargo: 0 },
      ...Array.from({ length: 8 }, (_, index) => ({ id: 4 + index, team, generation: 10 + index, kind: 'infantry', hp: 100,
        x: (team ? 1 : -1) * index / 4, z: 0, focusedCount: 0, lastAttack: null })),
    ], visibleEnemies: [{ id: 20, team: 1 - team, generation: 7, kind: 'infantry', hp: 100, x: x + (team ? -4 : 4), z: 0 }] },
    buildings: { friendly: [{ id: 100, team, type: 'town-center', home: true, complete: true, hp: 2400, x, z: 0, queue: 0 }], visibleEnemies: [] },
    resourceNodes: [{ id: 'food', type: 'food', stock: 100, x, z: 3 }],
    objectives: [{ id: 'watch', owner: team, zone: { column: 30, row: 30, width: 4, height: 4 } }] };
}
const combatUnits = observation => observation.units.friendly.filter(u => u.kind !== 'worker');

for (const team of [0, 1]) for (const seed of [0, 20260925, 0xffff_ffff]) {
  test(`seat ${team}, seed ${seed}: observed threats, bounded orders and regroup guards`, () => {
    const state = threatObservation(team), defense = createHomeDefensePolicy();
    const first = defense.next(state, combatUnits(state));
    assert.equal(first.units.length, PVE_HOME_DEFENSE_LIMITS.units);
    assert.equal(first.commands.length, 1);
    assert.deepEqual(first.commands[0].unitGenerations, first.units.map(u => u.generation));
    const selected = first.units.map(u => u.id).sort((a, b) => a - b);
    assert.deepEqual(defense.next(state, combatUnits(state)).commands, [], 'same snapshot does not repeat a command');
    for (const tick of [300, 900, 2100, 3900, 5700]) {
      assert.deepEqual(defense.next({ ...state, tick: tick - 1 }, combatUnits(state)).commands, []);
      assert.deepEqual(defense.next({ ...state, tick }, combatUnits(state)).commands[0]?.ids, selected, 'only stalled responders retry with capped backoff');
    }
    const progressing = createHomeDefensePolicy(); progressing.next(state, combatUnits(state));
    first.units.forEach(u => { u.x += 0.6; });
    assert.deepEqual(progressing.next({ ...state, tick: 300 }, combatUnits(state)).commands, [], 'movement suppresses a retry');
    first.units.forEach(u => { u.focusedCount = 1; });
    assert.deepEqual(progressing.next({ ...state, tick: 600 }, combatUnits(state)).commands, [], 'active combat is preserved');
    first.units.forEach(u => { u.focusedCount = 0; u.lastAttack = { tick: 600 }; });
    assert.deepEqual(progressing.next({ ...state, tick: 719 }, combatUnits(state)).commands, [], 'recent combat is preserved');
    const busy = threatObservation(team); combatUnits(busy).forEach(u => { u.focusedCount = 1; });
    const pending = createHomeDefensePolicy();
    assert.deepEqual(pending.next(busy, combatUnits(busy)).commands, [], 'initial combat is not interrupted');
    combatUnits(busy).forEach(u => { u.focusedCount = 0; });
    assert.equal(pending.next({ ...busy, tick: 30 }, combatUnits(busy)).commands[0].ids.length, 4, 'respond immediately when preserved combat ends');

    for (const [label, mutate] of [
      ['no visible threat', s => { s.units.visibleEnemies = []; }],
      ['distant threat', s => { s.units.visibleEnemies[0].x = 0; }],
      ['dead threat', s => { s.units.visibleEnemies[0].hp = 0; }],
      ['friendly threat entry', s => { s.units.visibleEnemies[0].team = team; }],
      ['civilian Worker', s => { s.units.visibleEnemies[0].kind = 'worker'; }],
      ['unarmed boat', s => { s.units.visibleEnemies[0].kind = 'skiff'; }],
      ['unknown kind', s => { s.units.visibleEnemies[0].kind = 'unknown'; }],
      ['no owned asset', s => { s.units.friendly[0].hp = 0; s.buildings.friendly = []; }],
      ['foreign assets', s => { s.units.friendly[0].team = 1 - team; s.buildings.friendly[0].team = 1 - team; }],
      ['foreign responders', s => { combatUnits(s).forEach(u => { u.team = 1 - team; }); }],
      ['Scout or siege detachment', s => { combatUnits(s).forEach((u, i) => { u.kind = i % 2 ? 'scout' : 'siege-engine'; }); }],
    ]) {
      const guarded = threatObservation(team); mutate(guarded);
      const result = createHomeDefensePolicy().next(guarded, combatUnits(guarded));
      assert.deepEqual(result.commands, [], label);
    }
    const buildingOnly = threatObservation(team); buildingOnly.units.friendly.shift();
    assert.equal(createHomeDefensePolicy().next(buildingOnly, combatUnits(buildingOnly)).commands.length, 1, 'owned buildings are independently protected');
    const replacement = threatObservation(team), replacing = createHomeDefensePolicy();
    const old = replacing.next(replacement, combatUnits(replacement)); old.units[0].hp = 0;
    const fresh = replacing.next({ ...replacement, tick: 30 }, combatUnits(replacement));
    assert.equal(fresh.units.length, 4); assert.equal(fresh.commands[0].ids.length, 1, 'replace a lost responder without ordering the other three again');
    fresh.units[0].generation++;
    assert.equal(replacing.next({ ...replacement, tick: 60 }, combatUnits(replacement)).commands[0].unitGenerations[0], fresh.units[0].generation,
      'a reused friendly slot gets its current generation');

    const complete = threatObservation(team), policy = createDeterministicPolicy(seed);
    const opening = policy.next(complete), recall = opening.find(c => c.type === 'attackMove');
    assert.ok(opening.some(c => c.type === 'gather'), 'gathering continues alongside defense');
    assert.equal(recall.ids.length, 4, 'a gather-only opening cannot delay a visible economic threat');
    for (const u of combatUnits(complete).filter(u => recall.ids.includes(u.id))) u.x = complete.units.visibleEnemies[0].x;
    complete.units.visibleEnemies = []; complete.units.friendly[0].task = 'gathering';
    const regroup = policy.next({ ...complete, tick: 30 }).find(c => c.type === 'attackMove');
    assert.deepEqual([...regroup.ids].sort((a, b) => a - b), [...recall.ids].sort((a, b) => a - b));
    assert.deepEqual({ x: regroup.x, z: regroup.z }, { x: 0, z: 0 }, 'release responders to the public owned objective');
    assert.deepEqual(policy.next({ ...complete, tick: 329 }), []);
    assert.deepEqual(policy.next({ ...complete, tick: 330 }).find(c => c.type === 'attackMove')?.ids, regroup.ids, 'a rejected regroup retains ordinary tactical retry');
    combatUnits(complete).filter(u => recall.ids.includes(u.id)).forEach(u => { u.x = 0; });
    assert.deepEqual(policy.next({ ...complete, tick: 360 }), [], 'regroup arrival stops orders');
    const fallback = threatObservation(team); fallback.objectives = []; fallback.resourceNodes = [];
    const fallbackOrders = createDeterministicPolicy(seed).next(fallback).filter(c => c.type === 'attackMove');
    assert.equal(fallbackOrders.find(c => c.x === fallback.units.visibleEnemies[0].x).ids.length, 4);
    assert.equal(fallbackOrders.find(c => c.x === 0).ids.length, 4, 'the fallback army keeps its center goal while the detachment defends');

    // Even a deliberately overinclusive peer snapshot cannot expose a hidden
    // raider: the existing fog adapter rechecks each enemy cell before policy.
    const fog = threatObservation(team), bytes = Buffer.alloc(64 * 64 / 4);
    const enemyUnit = fog.units.visibleEnemies[0], cell = 32 * 64 + Math.floor(enemyUnit.x + 32);
    const peer = { type: 'state', tick: 0, fogOfWar: true, food: [0, 0], wood: [0, 0], buildings: fog.buildings.friendly,
      units: [...fog.units.friendly, enemyUnit].map(u => [u.id, u.team, u.x, u.z, u.hp, u.kind, 0, '', u.generation, 'idle']),
      visibility: { columns: 64, rows: 64, data: bytes.toString('base64') } };
    for (const visibility of [0, 1, 2]) {
      bytes[cell >> 2] = visibility << ((cell & 3) * 2); peer.visibility.data = bytes.toString('base64');
      const observed = toOpponentObservation(peer, team, fog.map);
      assert.equal(createHomeDefensePolicy().next(observed, combatUnits(observed)).commands.length, visibility === 2 ? 1 : 0,
        'only currently visible enemies can trigger defense, never hidden or remembered cells');
    }
  });
}
