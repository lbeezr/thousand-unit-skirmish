import assert from 'node:assert/strict';
import test from 'node:test';
import { createProductionPolicy, PVE_PRODUCTION_LIMITS as limits } from '../src/pve-production.mjs';
import { createDeterministicPolicy, toOpponentObservation } from '../src/pve-opponent.mjs';
import { BUILDING_DEFINITIONS as B } from '../src/gameplay-definitions.mjs';
import { createPveHeadlessFixture } from './pve-headless-fixture.mjs';

function observation(team) {
  const x = team ? 28 : -28;
  return { schemaVersion: 1, team, tick: 0, fogOfWar: false, map: { id: 'builder-preparation', width: 80, height: 64 },
    resources: { food: 150, wood: 250 }, population: { available: 3, capacity: 15 },
    units: { friendly: Array.from({ length: 12 }, (_, index) => ({ id: team * 12 + index, team,
      generation: 31, hp: 100, kind: index < 4 ? 'worker' : 'infantry', x, z: index < 4 ? 0 : 3,
      task: index < 4 ? 'gathering' : null, cargo: index < 4 ? 7 : 0, cargoType: index % 2 ? 'wood' : 'food' })), visibleEnemies: [] },
    buildings: { friendly: [{ id: 100 + team, team, type: 'town-center', home: true,
      hp: 2400, complete: true, queue: 0, x, z: 0 }], visibleEnemies: [] },
    workerProduction: { queue: 0 }, objectives: [], resourceNodes: [
      { id: 'food', type: 'food', stock: 100, x, z: -8 }, { id: 'wood', type: 'wood', stock: 100, x, z: 8 }] };
}
const next = (policy, state, tick) => policy.next({ ...state, tick });
function opened(team) {
  const state = observation(team), policy = createProductionPolicy(0);
  assert.deepEqual(next(policy, state, 0), []);
  return { state, policy };
}

for (const team of [0, 1]) {
  test(`seat ${team}: one selected carrier, repeated observations, delivery and rejected placement`, () => {
    const { state, policy } = opened(team), before = structuredClone(state), worker = state.units.friendly[0];
    assert.deepEqual(next(policy, state, 299), [], 'the opening delay is unchanged');
    assert.deepEqual(next(policy, state, 300), [{ type: 'returnCargo', ids: [worker.id], unitGenerations: [worker.generation] }]);
    assert.deepEqual(state, before, 'selection changes no cargo, banks, work or other recipients');
    for (const tick of [300, 330, 449]) assert.deepEqual(next(policy, state, tick), [], 'unconfirmed Return does not spam');
    worker.task = 'returning';
    for (const tick of [450, 900, 3000]) assert.deepEqual(next(policy, state, tick), [], 'an observed Return is never reissued');
    worker.task = 'idle'; worker.cargo = 0;
    const build = next(policy, state, 3001)[0];
    assert.equal(build.buildingType, 'barracks'); assert.deepEqual(build.ids, [worker.id]);
    assert.deepEqual(build.unitGenerations, [worker.generation]);
    assert.deepEqual(policy.reservedBuilder(), { id: worker.id, generation: worker.generation });
    assert.deepEqual(next(policy, state, 3001), [], 'the same observation cannot purchase twice');
    assert.deepEqual(next(policy, state, 3150), [], 'rejected placement retains existing backoff');
    const retry = next(policy, state, 3151)[0];
    assert.deepEqual(retry.ids, [worker.id]);
    assert.notDeepEqual([retry.x, retry.z], [build.x, build.z], 'existing visible candidate rotation repairs placement rejection');
    state.buildings.friendly.push({ id: 90, team, type: 'barracks', hp: 1800, complete: false, queue: 0 });
    worker.task = 'building'; next(policy, state, 3152);
    assert.equal(policy.reservedBuilder(), null, 'observed paid construction ends preparation');
  });

  test(`seat ${team}: unreachable Return keeps cargo and the existing capped retry cadence`, () => {
    const { state, policy } = opened(team), before = structuredClone(state), attempts = [];
    // A rejected authoritative Return leaves this DTO unchanged: no reachable
    // dropoff can be inferred from the public building's existence alone.
    for (let tick = 1; tick <= 3200; tick++) {
      const commands = next(policy, state, tick);
      if (commands.length) {
        attempts.push(tick);
        assert.deepEqual(commands, [{ type: 'returnCargo', ids: [team * 12], unitGenerations: [31] }]);
      }
    }
    assert.deepEqual(attempts, [300, 450, 750, 1350, 2250, 3150]);
    assert.deepEqual(state, before, 'failed preparation never invents delivery or cancels another Worker');
  });

  test(`seat ${team}: death, slot reuse, lost dropoff and conflicting work release only the reservation`, () => {
    for (const [label, change, expectedId] of [
      ['death', s => { s.units.friendly[0].hp = 0; }, team * 12 + 1],
      ['slot reuse', s => { s.units.friendly[0].generation++; }, team * 12],
      ['lost dropoff', s => { s.buildings.friendly[0].hp = 0; }, null],
      ['other construction', s => { s.units.friendly[0].task = 'building'; }, null],
    ]) {
      const { state, policy } = opened(team); next(policy, state, 300); change(state);
      const before = structuredClone(state), commands = next(policy, state, 330);
      assert.deepEqual(state, before, label);
      if (expectedId === null) {
        assert.deepEqual(commands, [], label); assert.equal(policy.reservedBuilder(), null, label);
      } else {
        assert.deepEqual(commands[0]?.ids, [expectedId], label);
        assert.deepEqual(commands[0]?.unitGenerations, [state.units.friendly.find(u => u.id === expectedId).generation], label);
      }
    }
  });

  test(`seat ${team}: purchase/dropoff guards and existing replacement policy remain intact`, () => {
    for (const [label, change] of [
      ['wood reserve', s => { s.resources.wood = limits.barracksWoodCost + limits.woodReserve - 1; }],
      ['foreign dropoff', s => { s.buildings.friendly[0].team = 1 - team; }],
      ['unfinished dropoff', s => { s.buildings.friendly[0].complete = false; }],
      ['wrong cargo dropoff', s => { s.buildings.friendly[0].type = 'mill'; s.units.friendly.forEach(u => { u.cargoType = 'wood'; }); }],
      ['invisible footprint', s => { s.fogOfWar = true; s.visibility = { columns: 80, rows: 64, data: Buffer.alloc(80 * 64 / 4).toString('base64') }; }],
    ]) {
      const { state, policy } = opened(team); change(state);
      assert.deepEqual(next(policy, state, 300), [], label);
      assert.equal(policy.reservedBuilder(), null, label);
    }
    const { state, policy } = opened(team);
    state.buildings.friendly.push({ id: 90, team, type: 'barracks', hp: 1800, complete: true, queue: 0 });
    next(policy, state, 1); state.buildings.friendly.pop();
    assert.deepEqual(next(policy, state, 300), [], 'carrying replacement builders retain the existing producer-loss policy');
  });

  test(`seat ${team}: gather decisions leave the reserved recipient alone through Return/build rejection`, () => {
    const state = observation(team), policy = createDeterministicPolicy(0);
    next(policy, state, 0);
    const preparing = next(policy, state, 300).filter(c => c.type === 'returnCargo');
    assert.deepEqual(preparing, [{ type: 'returnCargo', ids: [team * 12], unitGenerations: [31] }]);
    state.units.friendly[0].task = 'idle'; // Rejected Return or an unresolved dropoff; cargo still belongs to this Worker.
    state.units.friendly[1].task = 'idle'; state.units.friendly[1].cargo = 0;
    for (const tick of [330, 360, 390]) {
      const commands = next(policy, state, tick);
      assert.ok(commands.filter(c => c.type === 'gather').every(c => !c.ids.includes(team * 12)));
      assert.ok(!commands.some(c => c.type === 'build'), 'do not replace the selected prepared actor with another gatherer');
      assert.ok(!commands.some(c => ['stop', 'cancelConstruction'].includes(c.type)));
    }
    state.units.friendly[0].cargo = 0;
    const build = next(policy, state, 420).find(c => c.type === 'build'); assert.deepEqual(build?.ids, [team * 12]);
    for (const tick of [420, 450, 540]) assert.ok(next(policy, state, tick).filter(c => c.type === 'gather')
      .every(c => !c.ids.includes(team * 12)), 'unconfirmed build cannot thrash back to Gather');
  });
}

for (const team of [0, 1]) test(`seat ${team}: authoritative unreachable Return rejects without altering cargo or other jobs`, async () => {
  const map = { id: 'unreachable-prepared-builder', name: 'Unreachable Prepared Builder', width: 80, height: 64,
    terrainSeed: 19, fogOfWar: false, startingArmySize: 8, startingResources: { food: 150, wood: 250 },
    spawnPoints: [{ team: 0, x: -28, z: 0 }, { team: 1, x: 28, z: 0 }],
    obstacles: [{ column: 34, row: 26, width: 12, height: 1, material: 'stone' },
      { column: 34, row: 37, width: 12, height: 1, material: 'stone' },
      { column: 34, row: 27, width: 1, height: 10, material: 'stone' },
      { column: 45, row: 27, width: 1, height: 10, material: 'stone' }], triggers: [], scenarioEvents: [],
    resourceNodes: [0, 1].map(seat => ({ id: `s${seat}-food`, type: 'food', stock: 1000,
      x: seat ? 28 : -28, z: 5.5 })) };
  const fixture = await createPveHeadlessFixture(map), r = fixture.replay;
  try {
    const view = () => toOpponentObservation(r.observe(team), team, map), policy = createProductionPolicy(0);
    policy.next(view());
    const ids = view().units.friendly.map(u => u.id);
    await r.order(team, { type: 'gather', ids, nodeId: `s${team}-food` });
    for (let tick = 0; tick < 300; tick++) r.step();
    const fault = r.checkpoint(), worker = fault.state.units[ids[0]];
    assert.ok(worker.cargo > 0 && worker.gatherPhase === 'gathering', 'the fixture first earns real cargo');
    // A validated fault checkpoint isolates the selected carrier from its
    // still-disclosed home dropoff. This is failure injection, not normal play.
    worker.x = 0.5; worker.z = 0.5;
    r.restore(fault);
    const command = policy.next(view())[0];
    assert.equal(command.type, 'returnCargo'); assert.deepEqual(command.ids, [worker.id]);
    const before = r.checkpoint().state, notices = await r.order(team, command), after = r.checkpoint().state;
    assert.ok(notices.some(n => /RETURN CARGO REJECTED.*REACHABLE DROP-OFF/.test(n.message ?? '')));
    for (const field of ['units', 'resourceNodes', 'teamFood', 'teamWood', 'buildings']) assert.deepEqual(after[field], before[field], field);
    assert.deepEqual(policy.next(view()), [], 'the same rejected observation does not duplicate Return');
  } finally { await fixture.dispose(); }
});

test('both seats: real selected Return, dropoff, paid Barracks and resource conservation', async () => {
  const map = { id: 'first-barracks-conservation', name: 'First Barracks Conservation', width: 80, height: 64,
    terrainSeed: 19, fogOfWar: false, startingArmySize: 24, startingResources: { food: 150, wood: 250 },
    spawnPoints: [{ team: 0, x: -28, z: 0 }, { team: 1, x: 28, z: 0 }], obstacles: [], triggers: [], scenarioEvents: [],
    resourceNodes: [0, 1].flatMap(team => ['food', 'wood'].map((type, index) => ({
      id: `s${team}-${type}`, type, stock: 1000, x: team ? 28 : -28, z: index ? 5.5 : -5.5 }))) };
  const fixture = await createPveHeadlessFixture(map), r = fixture.replay;
  try {
    const policies = [createProductionPolicy(0), createProductionPolicy(0)], paid = [false, false], returns = [0, 0];
    const view = team => toOpponentObservation(r.observe(team), team, map);
    for (const team of [0, 1]) {
      policies[team].next(view(team));
      const workers = view(team).units.friendly.filter(u => u.kind === 'worker');
      for (const [index, worker] of workers.entries()) await r.order(team, { type: 'gather', ids: [worker.id],
        nodeId: `s${team}-${index % 2 ? 'wood' : 'food'}` });
    }
    const conserved = () => {
      const s = r.checkpoint().state;
      for (const type of ['food', 'wood']) {
        const initial = 2 * map.startingResources[type] + map.resourceNodes.filter(n => n.type === type).reduce((v, n) => v + n.stock, 0);
        const current = s[type === 'food' ? 'teamFood' : 'teamWood'].reduce((v, n) => v + n, 0)
          + s.resourceNodes.filter(n => n.type === type).reduce((v, n) => v + n.stock, 0)
          + s.units.filter(u => u.cargoType === type).reduce((v, u) => v + u.cargo, 0)
          + s.buildings.filter(b => b.type === 'barracks').length * (B.barracks.cost[type] ?? 0);
        assert.ok(Math.abs(current - initial) < 1e-6, `${type}: bank + remaining stock + cargo + paid cost conserves`);
      }
    };
    for (let tick = 0; tick <= 2700; tick++) {
      if (tick % 30 === 0) for (const team of [0, 1]) if (!paid[team]) {
        const observed = view(team), commands = policies[team].next(observed);
        assert.deepEqual(policies[team].next(observed), [], 'the same AI observation never duplicates its production order');
        for (const command of commands) {
          const before = r.checkpoint().state, notices = await r.order(team, command); r.drain();
          assert.ok(!notices.some(n => /REJECTED|FAILED/.test(n.message ?? '')), JSON.stringify(notices));
          const after = r.checkpoint().state;
          if (command.type === 'returnCargo') {
            returns[team]++;
            assert.equal(command.ids.length, 1);
            assert.deepEqual(after.teamFood, before.teamFood); assert.deepEqual(after.teamWood, before.teamWood);
            assert.deepEqual(after.resourceNodes, before.resourceNodes);
            assert.deepEqual(after.units.filter(u => !command.ids.includes(u.id)), before.units.filter(u => !command.ids.includes(u.id)),
              'unrelated Worker jobs and every other actor are unchanged by selected Return');
            assert.deepEqual(after.units.map(u => [u.cargo, u.cargoType]), before.units.map(u => [u.cargo, u.cargoType]));
          } else {
            assert.equal(command.buildingType, 'barracks'); paid[team] = true;
            assert.equal(before.teamWood[team] - after.teamWood[team], B.barracks.cost.wood);
            assert.equal(before.units[command.ids[0]].cargo, 0, 'the selected builder has delivered real cargo');
          }
          conserved();
        }
      }
      if (tick % 30 === 0) conserved();
      if (paid.every(Boolean) && r.checkpoint().state.buildings.filter(b => b.type === 'barracks' && b.complete).length === 2) break;
      if (tick === 2700) assert.fail('both naturally paid Barracks must complete within the existing construction window');
      r.step();
    }
    assert.deepEqual(returns, [1, 1]); assert.deepEqual(paid, [true, true]); conserved();
  } finally { await fixture.dispose(); }
});
