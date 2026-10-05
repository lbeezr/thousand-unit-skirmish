import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createProductionPolicy } from '../src/pve-production.mjs';
import { loadLastInfantryLoss, replayLastInfantryRecovery } from './pve-last-infantry-case.mjs';

function fixture(team, food = 50) {
  return { team, tick: 0, map: { width: 160, height: 160 }, fogOfWar: true,
    resources: { food, wood: 0 }, population: { used: 0, reserved: 0, capacity: 15, available: 15 },
    units: { friendly: [], visibleEnemies: [] }, objectives: [], resourceNodes: [], workerProduction: { queue: 0 },
    buildings: { friendly: [{ id: 2, team, type: 'barracks', hp: 696, complete: true,
      queue: 0, productionBlocked: false, productionOptions: [{ kind: 'infantry', available: food >= 50 },
        { kind: 'spearman', available: false }] }], visibleEnemies: [] } };
}
const recruit = (policy, state) => { policy.next(state); return policy.next({ ...state, tick: 300 }); };

for (const team of [0, 1]) for (const seed of [0, 20260925, 0xffff_ffff]) {
  test(`seat ${team}, seed ${seed}: last Infantry price, reserve boundaries and retry budget`, () => {
    for (const food of [0, 49, 50, 59.99999999994134, 99, 100]) {
      const state = fixture(team, food), policy = createProductionPolicy(seed);
      assert.deepEqual(policy.next(state), []); assert.deepEqual(policy.next({ ...state, tick: 299 }), []);
      assert.deepEqual(policy.next({ ...state, tick: 300 }), food >= 50 ? [{ type: 'train', buildingId: 2 }] : []);
      assert.deepEqual(policy.next({ ...state, tick: 300 }), [], 'unchanged snapshot cannot immediately spend twice');
    }
    const state = fixture(team), policy = createProductionPolicy(seed), retries = [];
    for (let tick = 0; tick <= 3200; tick++) if (policy.next({ ...state, tick }).length) retries.push(tick);
    assert.deepEqual(retries, [300, 450, 750, 1350, 2250, 3150], 'unconfirmed requests retain capped backoff');
    state.units.friendly = [{ id: 1, generation: 1, team, kind: 'infantry', hp: 100 }];
    assert.deepEqual(policy.next({ ...state, tick: 5000 }), [], 'one living recruit restores the normal reserve');
  });
}

test('last Infantry recovery preserves Worker priority, queues and authoritative availability', () => {
  for (const team of [0, 1]) for (const [label, mutate] of [
    ['living Worker', s => { s.units.friendly.push({ id: 1, team, generation: 1, kind: 'worker', hp: 100, task: 'idle', cargo: 0 }); }],
    ['living military', s => { s.units.friendly.push({ id: 1, team, generation: 1, kind: 'infantry', hp: 100 }); }],
    ['Worker producer', s => { s.buildings.friendly.push({ id: 3, team, type: 'town-center', hp: 100, complete: true, queue: 0 }); }],
    ['Worker foundation', s => { s.buildings.friendly.push({ id: 3, team, type: 'town-center', hp: 100, complete: false, queue: 0 }); }],
    ['busy Worker producer', s => { s.buildings.friendly.push({ id: 3, team, type: 'town-center', hp: 100, complete: true, queue: 1 }); }],
    ['queued military', s => { s.buildings.friendly[0].queue = 1; }],
    ['other producer queue', s => { s.buildings.friendly.push({ id: 3, team, type: 'stable', hp: 100, complete: true, queue: 1 }); }],
    ['queued Worker', s => { s.workerProduction.queue = 1; }],
    ['blocked exit', s => { s.buildings.friendly[0].productionBlocked = true; }],
    ['unavailable option', s => { s.buildings.friendly[0].productionOptions[0].available = false; }],
    ['missing option', s => { delete s.buildings.friendly[0].productionOptions; }],
    ['unfinished Barracks', s => { s.buildings.friendly[0].complete = false; }],
    ['no capacity', s => { s.population.available = 0; }],
  ]) {
    const state = fixture(team); mutate(state);
    assert.deepEqual(recruit(createProductionPolicy(0), state), [], label);
  }
  for (const team of [0, 1]) {
    const state = fixture(team);
    state.buildings.friendly.push({ id: 3, team, type: 'town-center', hp: 100, complete: true, queue: 0,
      productionOptions: [{ kind: 'worker', available: true }] });
    assert.deepEqual(recruit(createProductionPolicy(0), state), [{ type: 'trainUnit', kind: 'worker', buildingId: 3 }]);
  }
});

for (const mode of ['authored', 'skirmish']) {
  test(`Tiny ${mode}, seat 0: retained real total loss, paid Infantry, cold queue and exact replay`, async () => {
    const input = await loadLastInfantryLoss(mode), team = input.team;
    const result = await replayLastInfantryRecovery(input);
    assert.deepEqual(await replayLastInfantryRecovery(input), result, 'full command ledger and checkpoint repeat exactly');
    if (process.env.RTS_PVE_LAST_INFANTRY_EVIDENCE_DIR) await writeFile(path.join(process.env.RTS_PVE_LAST_INFANTRY_EVIDENCE_DIR,
      `last-infantry-${mode}-${team}.json`), JSON.stringify({ input, result }));
    console.log(JSON.stringify({ mode, team, lossTick: input.loss.state.tickNumber, stages: result.stages,
      recoverySeconds: (result.stages.spawn - input.loss.state.tickNumber) / 30,
      paidFood: 50, rejectedCommands: 0, finalWinner: result.final.state.matchWinner, exactReplay: true }));
  });
}
