import { economyServerBindings, economyServerFunctions } from './economy-server-fixture.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { UNIT_DEFINITIONS, BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import * as baseLifecycle from '../src/rules/base-lifecycle.mjs';
import * as legacyBaseLifecycle from '../src/base-lifecycle.mjs';
const { unfinishedRefund, buildingRepairStep } = baseLifecycle;

test('canonical base lifecycle retains exactly the two legacy export bindings', () => {
  const names = ['buildingRepairStep', 'unfinishedRefund'];
  assert.deepEqual(Object.keys(baseLifecycle), names);
  assert.deepEqual(Object.keys(legacyBaseLifecycle), names);
  for (const name of names) assert.equal(baseLifecycle[name], legacyBaseLifecycle[name], name);
});
test('unfinished work refunds only its unconsumed fraction and repairs spend only restored HP', () => {
  assert.deepEqual(unfinishedRefund({ food: 60, wood: 20 }, 6, 12), { food: 30, wood: 10 });
  assert.deepEqual(unfinishedRefund({ food: 60, wood: 20 }, 0, 12), { food: 0, wood: 0 });
  const half = { type: 'barracks', hp: 900 };
  const repair = buildingRepairStep(half, 100, 100);
  assert.equal(repair.hp, 900); assert.equal(repair.wood, 26.25);
  assert.deepEqual(buildingRepairStep(half, 0, 1), { hp: 0, wood: 0 });
  const limited = buildingRepairStep(half, 1, 10);
  assert.equal(limited.wood, 1); assert.ok(limited.hp > 0 && limited.hp < 40);
  assert.deepEqual(buildingRepairStep({ type: 'barracks', hp: 1800 }, 100, 1), { hp: 0, wood: 0 });
});
const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const functions = source.slice(source.indexOf('function creditRefund('), source.indexOf('function buildingFootprint('));
for (const team of [0, 1]) test(`cancellations release exactly one reservation and reject foreign/replayed requests for seat ${team}`, () => {
  const building = { id: 1, team, type: 'barracks', complete: true, queue: 3, productionQueue: ['spearman', 'infantry', 'spearman'], trainingRemaining: 6 };
  const house = { id: 2, team, type: 'house', complete: false, progress: 0.5 };
  const messages = [];
  const context = vm.createContext({ ...economyServerBindings(), UNIT_DEFINITIONS, BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS, unfinishedRefund,
    buildingsById: new Map([[1, building], [2, house]]), teamFood: [100, 100], teamWood: [100, 100], dirty: false,
    teamResearch: [null, null], workerProduction: [{ queue: 2, trainingRemaining: 12.5 }, { queue: 2, trainingRemaining: 12.5 }],
    sendOrderNotice: (_, __, message) => messages.push(message), destroyBuilding: (row) => context.buildingsById.delete(row.id),
  });
  vm.runInContext(economyServerFunctions + functions, context);
  context.cancelTraining({ team: 1 - team }, { buildingId: 1 }); assert.equal(building.queue, 3);
  context.cancelTraining({ team }, { buildingId: 1 });
  assert.deepEqual([...building.productionQueue], ['spearman', 'infantry']); assert.equal(context.teamFood[team], 160); assert.equal(context.teamWood[team], 120);
  context.cancelTraining({ team }, { buildingId: 1, queueIndex: 0 });
  assert.deepEqual([...building.productionQueue], ['infantry']); assert.equal(building.trainingRemaining, 12);
  assert.equal(context.teamFood[team], 190); assert.equal(context.teamWood[team], 130);
  context.cancelTraining({ team }, { buildingId: 1, queueIndex: 9 }); assert.equal(context.teamFood[team], 190);
  context.cancelTraining({ team }, { kind: 'worker' }); assert.equal(context.workerProduction[team].queue, 1); assert.equal(context.teamFood[team], 240);
  context.cancelTraining({ team }, { kind: 'worker', queueIndex: 0 }); assert.equal(context.workerProduction[team].queue, 0); assert.equal(context.teamFood[team], 265);
  context.cancelConstruction({ team }, { buildingId: 2 }); assert.equal(context.teamWood[team], 167.5);
  context.cancelConstruction({ team }, { buildingId: 2 }); assert.equal(context.teamWood[team], 167.5, 'repeated cancellation refunds nothing');
  context.teamResearch[team] = { type: 'infantry-attack', buildingId: 1, remaining: 12.5 };
  context.cancelResearch({ team: 1 - team }, { buildingId: 1 }); assert.ok(context.teamResearch[team]);
  context.cancelResearch({ team }, { buildingId: 1 }); assert.equal(context.teamResearch[team], null);
  assert.equal(context.teamFood[team], 315); assert.equal(context.teamWood[team], 205);
  context.cancelResearch({ team }, { buildingId: 1 }); assert.equal(context.teamFood[team], 315);
});

for (const team of [0, 1]) test(`seat ${team}: guarded queue slots refund exactly once across all producers`, () => {
  const messages = [];
  const context = vm.createContext({ ...economyServerBindings(), UNIT_DEFINITIONS, BUILDING_DEFINITIONS,
    TECHNOLOGY_DEFINITIONS, unfinishedRefund, buildingsById: new Map(), teamFood: [100, 100], teamWood: [100, 100],
    dirty: false, workerProduction: [{ queue: 3, trainingRemaining: 12.5 }, { queue: 3, trainingRemaining: 12.5 }],
    sendOrderNotice: (_, __, message) => messages.push(message) });
  vm.runInContext(economyServerFunctions + functions, context);
  let id = 100;
  for (const rule of Object.values(BUILDING_DEFINITIONS).filter(rule => rule.products.length)) {
    for (const home of rule.id === 'town-center' ? [true, false] : [false]) {
      const kinds = [rule.products[0], rule.products.at(-1), rule.products[0]];
      const building = { id: id++, type: rule.id, team, complete: true, home, queue: 3,
        productionQueue: [...kinds], trainingRemaining: UNIT_DEFINITIONS[kinds[0]].trainSeconds / 2 };
      const production = home ? context.workerProduction[team] : building;
      Object.assign(production, { queue: 3, trainingRemaining: UNIT_DEFINITIONS[kinds[0]].trainSeconds / 2 });
      context.buildingsById.set(building.id, building);
      const command = { buildingId: building.id, queueIndex: 1, expectedQueue: [...kinds] };
      const before = [context.teamFood[team], context.teamWood[team]];
      context.cancelTraining({ team: 1 - team }, command);
      assert.equal(production.queue, 3, `${rule.id}: opponent cannot cancel`);
      for (const expectedQueue of [null, {}, [], kinds.slice(1), [...kinds, kinds[0]], ['unknown', ...kinds.slice(1)]]) {
        context.cancelTraining({ team }, { ...command, expectedQueue });
        assert.equal(production.queue, 3); assert.match(messages.at(-1), /QUEUE CHANGED/);
        assert.deepEqual([context.teamFood[team], context.teamWood[team]], before);
      }
      context.cancelTraining({ team }, command);
      const cost = UNIT_DEFINITIONS[kinds[1]].cost;
      assert.equal(production.queue, 2);
      if (!home) assert.deepEqual([...building.productionQueue], [kinds[0], kinds[2]]);
      assert.deepEqual([context.teamFood[team], context.teamWood[team]], [before[0] + cost.food, before[1] + cost.wood]);
      context.cancelTraining({ team }, command);
      assert.equal(production.queue, 2, 'replayed slot cannot cancel its replacement');
      assert.deepEqual([context.teamFood[team], context.teamWood[team]], [before[0] + cost.food, before[1] + cost.wood]);
      const headCost = UNIT_DEFINITIONS[kinds[0]].cost;
      context.cancelTraining({ team }, { buildingId: building.id, queueIndex: 0, expectedQueue: [kinds[0], kinds[2]] });
      assert.equal(production.queue, 1);
      assert.deepEqual([context.teamFood[team], context.teamWood[team]],
        [before[0] + cost.food + headCost.food / 2, before[1] + cost.wood + headCost.wood / 2]);
      production.trainingRemaining = 0; production.productionBlocked = true;
      context.cancelTraining({ team }, { buildingId: building.id, queueIndex: 0, expectedQueue: [kinds[2]] });
      assert.equal(production.queue, 0); assert.equal(production.productionBlocked, false);
      assert.deepEqual([context.teamFood[team], context.teamWood[team]],
        [before[0] + cost.food + headCost.food / 2, before[1] + cost.wood + headCost.wood / 2], 'finished blocked head refunds nothing');
    }
  }
});
