import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { UNIT_DEFINITIONS, BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { unfinishedRefund, buildingRepairStep } from '../src/base-lifecycle.mjs';
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
  const context = vm.createContext({ UNIT_DEFINITIONS, BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS, unfinishedRefund,
    buildingsById: new Map([[1, building], [2, house]]), teamFood: [100, 100], teamWood: [100, 100], dirty: false,
    teamResearch: [null, null], workerProduction: [{ queue: 2, trainingRemaining: 12.5 }, { queue: 2, trainingRemaining: 12.5 }],
    sendOrderNotice: (_, __, message) => messages.push(message), destroyBuilding: (row) => context.buildingsById.delete(row.id),
  });
  vm.runInContext(functions, context);
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
