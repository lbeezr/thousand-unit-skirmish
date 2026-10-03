import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILDING_DEFINITIONS as B, TECHNOLOGY_DEFINITIONS as T, UNIT_DEFINITIONS as U } from '../src/gameplay-definitions.mjs';
import { matureSettlementPlan as plan, settlementLayout, assertSettlementLedger } from './mature-settlement-scenario.mjs';

test('the inspection fixture uses the current paid roster, prerequisites and connected layout', () => {
  assert.equal(plan.map.startingArmySize, 24, 'total opening army, twelve per seat');
  assert.deepEqual(settlementLayout(), { blockedCells: 264, connectedFreeCells: 3832 });
  assert.deepEqual([...new Set(plan.pads.map(([type]) => type))].sort(), Object.keys(B).sort(),
    'the live settlement plan constructs every registered building');
  assert.deepEqual([...plan.upgrades].sort(), Object.keys(T).sort());
  assert.ok(plan.upgrades.indexOf('military-tier-2') < plan.upgrades.indexOf('siege-engineering'));
  assert.ok(plan.pads.findIndex(([type]) => type === 'workshop') > plan.pads.findIndex(([type]) => type === 'town-center'));
  const costs = [...plan.pads.map(([type]) => B[type].cost), ...plan.upgrades.map(id => T[id].cost),
    ...plan.products.map(([type, kind]) => {
      assert.ok(B[type === 'home' ? 'town-center' : type].products.includes(kind));
      return U[kind].cost;
    })];
  assert.deepEqual(costs.reduce((sum, cost) => ({ food: sum.food + cost.food, wood: sum.wood + cost.wood }), { food: 0, wood: 0 }),
    { food: 1385, wood: 2720 });
  assert.equal(15 + plan.pads.reduce((sum, [type]) => sum + (B[type].populationCapacity || 0), 0), 44);
  assert.equal(12 + plan.products.reduce((sum, [, kind]) => sum + U[kind].population, 0), 23);
});

test('paid-bank proof rejects duplicate credit, lost cargo and replenished stock', () => {
  const spent = [{ food: 1385, wood: 2720 }, { food: 1385, wood: 2720 }];
  const saved = { state: { teamFood: [621, 615], teamWood: [280, 280],
    resourceNodes: plan.map.resourceNodes.map(node => ({ ...node, stock: node.id === 's0-food' ? 190 : 200 })),
    units: [{ team: 0, cargoType: 'food', cargo: 4 }],
  } };
  assertSettlementLedger(saved, spent);
  const credited = structuredClone(saved); credited.state.teamFood[0]++;
  assert.throws(() => assertSettlementLedger(credited, spent), /bank equals paid ledger plus deposits/);
  const lost = structuredClone(saved); lost.state.units[0].cargo = 0;
  assert.throws(() => assertSettlementLedger(lost, spent), /bank equals paid ledger plus deposits/);
  const replenished = structuredClone(saved); replenished.state.resourceNodes[0].stock = 200;
  assert.throws(() => assertSettlementLedger(replenished, spent), /bank equals paid ledger plus deposits/);
});
