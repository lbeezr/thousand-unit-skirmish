import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { townCenterFootprintCells } from '../src/town-center-spawn.mjs';
import { DEPOT_CASES, DEPOT_LAYOUTS, DEPOT_STRATEGIES, depotMap, depotPlot, depotCost,
  assertDepotLedger, summarizeDepotFrames, compareDepotResults } from './depot-economy-analysis.mjs';

test('depot comparisons use mirrored, distinct placements and legal current footprints', () => {
  assert.equal(DEPOT_CASES.length, 14);
  for (const layout of DEPOT_LAYOUTS) for (const strategy of DEPOT_STRATEGIES) {
    const map = depotMap({ layout });
    assert.equal(map.startingArmySize, 8, 'four real initial Workers per seat');
    assert.deepEqual(map.scenarioEvents, [], 'no income grants enter the comparison');
    const blocked = new Set([0, 1].flatMap(team => townCenterFootprintCells(map.spawnPoints, team, 64, 64)));
    for (const team of [0, 1]) {
      const plot = depotPlot(layout, team);
      const half = Math.floor(BUILDING_DEFINITIONS[strategy === 'home' ? 'mill' : strategy].footprint / 2);
      if (strategy !== 'home') for (let dz = -half; dz <= half; dz++) for (let dx = -half; dx <= half; dx++) {
        const cell = (Math.floor(plot.z + 32) + dz) * 64 + Math.floor(plot.x + 32) + dx;
        assert.ok(!blocked.has(cell), 'paid depot does not overlap a home center'); blocked.add(cell);
      }
      for (const type of ['food', 'wood']) {
        const node = map.resourceNodes.find(row => row.id === `${type}-${team}`);
        const opposite = map.resourceNodes.find(row => row.id === `${type}-${1 - team}`);
        assert.equal(node.x, -opposite.x); assert.equal(node.z, opposite.z);
        assert.ok(!blocked.has(Math.floor(node.z + 32) * 64 + Math.floor(node.x + 32)), 'resources remain outside footprints');
      }
    }
    assert.deepEqual(depotCost(strategy), strategy === 'home' ? { food: 0, wood: 0 } : BUILDING_DEFINITIONS[strategy].cost);
  }
  const solo = depotMap({ layout: 'remote-food' }), mixed = depotMap({ layout: 'remote-mixed' });
  assert.deepEqual(solo.resourceNodes.filter(node => node.type === 'food'), mixed.resourceNodes.filter(node => node.type === 'food'));
  assert.notDeepEqual(solo.resourceNodes.filter(node => node.type === 'wood'), mixed.resourceNodes.filter(node => node.type === 'wood'));
});

test('per-seat measurement accounting rejects duplicated credit, lost cargo and invented supply', () => {
  const map = depotMap({ layout: 'remote-mixed' }), cost = depotCost('mill');
  const snapshot = { state: { teamFood: [510, 500], teamWood: [925, 925],
    resourceNodes: map.resourceNodes.map(node => ({ ...node, stock: node.id === 'food-0' ? 9985 : 10000 })),
    units: [{ id: 0, team: 0, cargoType: 'food', cargo: 5 }] } };
  assertDepotLedger(snapshot, map, cost);
  const credited = structuredClone(snapshot); credited.state.teamFood[0]++;
  assert.throws(() => assertDepotLedger(credited, map, cost), /supply minus paid costs/);
  const lost = structuredClone(snapshot); lost.state.units[0].cargo = 0;
  assert.throws(() => assertDepotLedger(lost, map, cost), /supply minus paid costs/);
  const replenished = structuredClone(snapshot); replenished.state.resourceNodes[0].stock++;
  assert.throws(() => assertDepotLedger(replenished, map, cost), /supply minus paid costs/);
  const stolen = structuredClone(snapshot); stolen.state.teamFood[0]--; stolen.state.teamFood[1]++;
  assert.throws(() => assertDepotLedger(stolen, map, cost), /supply minus paid costs/);
});

test('synthetic samples calculate tick-based deposits/cycles and do not double-count activity', () => {
  const sample = (tick, food, cargo, x) => ({ tick, food: [food, food], wood: [0, 0],
    units: [0, 1].map(team => [team, team, x, 0, 35, 'worker', cargo, cargo ? 'food' : null, 1, 'gathering']) });
  const frames = [sample(0, 0, 0, 0), sample(300, 0, 10, 2), sample(360, 10, 0, 3),
    sample(600, 10, 10, 4), sample(660, 20, 0, 4)];
  const result = summarizeDepotFrames(frames, [0, 1].map(id => [{ id, type: 'food' }]), 300, 660, 30, 10);
  for (const seat of result) {
    assert.equal(seat.seconds, 12); assert.equal(seat.deposited.food, 20);
    assert.equal(seat.depositedPerMinute.food, 100);
    assert.equal(seat.workers[0].meanCycleSeconds, 10);
    assert.equal(seat.fullCycleEquivalentDepositedPerMinute.food, 60);
    assert.equal(seat.workers[0].walkedWorldUnits, 2);
    assert.equal(seat.workers[0].sampledStationaryNoCargoIncreaseSeconds, 2);
  }
  assert.throws(() => summarizeDepotFrames(frames, [[{ id: 0, type: 'food' }], []], 300, 700, 30, 10), /complete declared measurement window/);
});

test('wood premium repayment uses extra wood alone and requires the exact baseline', () => {
  const result = (strategy, food, wood) => ({ strategy, layout: 'remote-mixed', foodWorkers: 3,
    cost: depotCost(strategy), seats: [0, 1].map(team => ({ team, depositedPerMinute: { food, wood } })) });
  const rows = compareDepotResults([result('home', 60, 30), result('mill', 90, 30), result('storehouse', 90, 60)]);
  assert.equal(rows[0].seats[0].extraFoodPerMinute, 30);
  assert.equal(rows[0].seats[0].woodPremiumRepaymentMinutesVsMill, null);
  assert.equal(rows[1].seats[0].woodPremiumRepaymentMinutesVsMill, 25 / 30);
  assert.equal(rows[1].seats[0].foodWoodExchangeRateAssumed, false);
  assert.equal(rows[1].seats[0].repaymentIncludesConstructionOpportunity, false);
  assert.equal(compareDepotResults([result('home', 60, 30), result('mill', 90, 30), result('storehouse', 200, 30)])[1]
    .seats[0].woodPremiumRepaymentMinutesVsMill, null, 'extra food cannot repay a wood premium by itself');
  const missing = result('mill', 90, 30); missing.foodWorkers = 1;
  assert.throws(() => compareDepotResults([result('home', 60, 30), missing]), /exact home-only/);
});
