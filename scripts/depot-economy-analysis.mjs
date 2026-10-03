import assert from 'node:assert/strict';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';

export const DEPOT_STRATEGIES = ['home', 'mill', 'storehouse', 'town-center'];
export const DEPOT_LAYOUTS = ['near-home', 'remote-food', 'remote-mixed'];
export const DEPOT_CASES = [
  ...DEPOT_LAYOUTS.flatMap(layout => DEPOT_STRATEGIES.map(strategy => ({ layout, strategy, foodWorkers: 3 }))),
  ...['home', 'mill'].map(strategy => ({ layout: 'remote-food', strategy, foodWorkers: 1 })),
];
export const depotCaseId = ({ layout, strategy, foodWorkers }) => `${layout}_${strategy}_${foodWorkers}`;
export function depotMap({ layout }) {
  assert.ok(DEPOT_LAYOUTS.includes(layout), 'known placement fixture');
  const near = layout === 'near-home';
  return { id: `depot-economy-${layout}`, name: `Depot economy: ${layout}`, width: 64, height: 64,
    terrainSeed: 19, fogOfWar: false, startingArmySize: 8,
    startingResources: { food: 500, wood: 1000 },
    spawnPoints: [{ team: 0, x: -24.5, z: 0.5 }, { team: 1, x: 24.5, z: 0.5 }],
    obstacles: [], triggers: [], scenarioEvents: [],
    resourceNodes: [0, 1].flatMap(team => ['food', 'wood'].map(type => {
      const homeWood = type === 'wood' && layout === 'remote-food';
      return { id: `${type}-${team}`, type, stock: 10000,
        x: (team ? 1 : -1) * (near || homeWood ? 24.5 : 8.5),
        z: near ? (type === 'food' ? 5.5 : 9.5) : homeWood ? 5.5 : (type === 'food' ? 16.5 : 20.5) };
    })) };
}
export function depotPlot(layout, team) {
  return { x: (team ? 1 : -1) * (layout === 'near-home' ? 20.5 : 12.5),
    z: layout === 'near-home' ? 7.5 : 18.5 };
}
export function depotCost(strategy) {
  assert.ok(DEPOT_STRATEGIES.includes(strategy));
  return strategy === 'home' ? { food: 0, wood: 0 } : BUILDING_DEFINITIONS[strategy].cost;
}
export function assertDepotLedger(snapshot, map, spending) {
  for (const team of [0, 1]) for (const type of ['food', 'wood']) {
    const initial = map.resourceNodes.filter(node => node.id.endsWith(`-${team}`) && node.type === type)
      .reduce((sum, node) => sum + node.stock, 0);
    const stock = snapshot.state.resourceNodes.filter(node => node.id.endsWith(`-${team}`) && node.type === type)
      .reduce((sum, node) => sum + node.stock, 0);
    const cargo = snapshot.state.units.filter(unit => unit.team === team && unit.cargoType === type)
      .reduce((sum, unit) => sum + unit.cargo, 0);
    const bank = snapshot.state[type === 'food' ? 'teamFood' : 'teamWood'][team];
    assert.ok(Math.abs(initial + map.startingResources[type] - spending[type] - stock - cargo - bank) < 1e-5,
      `seat ${team} ${type}: stock + cargo + bank must equal supply minus paid costs`);
  }
}

// Snapshot intervals are used for cycle/position sampling, never wall-clock time.
export function summarizeDepotFrames(frames, ids, startTick, endTick, tickRate, carryCapacity) {
  assert.ok(tickRate > 0 && carryCapacity > 0 && endTick > startTick);
  const first = frames.find(frame => frame.tick >= startTick);
  const last = frames.find(frame => frame.tick >= endTick);
  assert.ok(first && last, 'the complete declared measurement window is present');
  const seconds = (last.tick - first.tick) / tickRate;
  return [0, 1].map(team => {
    const workers = ids[team].map(({ id, type }) => {
      const samples = frames.filter(frame => frame.tick >= first.tick && frame.tick <= last.tick);
      let walked = 0, movingSeconds = 0, harvestSeconds = 0, returningSeconds = 0, stationaryNoHarvestSeconds = 0;
      for (let index = 1; index < samples.length; index++) {
        const before = samples[index - 1], after = samples[index];
        const a = before.units.find(unit => unit[0] === id), b = after.units.find(unit => unit[0] === id);
        assert.ok(a && b, 'assigned gatherer remains alive and visible');
        const dt = (after.tick - before.tick) / tickRate;
        const distance = Math.hypot(b[2] - a[2], b[3] - a[3]);
        walked += distance;
        if (distance > 0.025) movingSeconds += dt;
        if (b[6] > a[6] && b[7] === type) harvestSeconds += dt;
        if (a[9] === 'returning') returningSeconds += dt;
        if (distance <= 0.025 && !(b[6] > a[6] && b[7] === type)) stationaryNoHarvestSeconds += dt;
      }
      const deposits = [];
      for (let index = 1; index < frames.length; index++) {
        const before = frames[index - 1], after = frames[index];
        if (after.tick > last.tick) break;
        const a = before.units.find(unit => unit[0] === id), b = after.units.find(unit => unit[0] === id);
        if (a && b && a[7] === type && a[6] - b[6] > carryCapacity / 2) deposits.push(after.tick);
      }
      const cycles = deposits.slice(1).map((tick, index) => ({
        endTick: tick, seconds: (tick - deposits[index]) / tickRate,
      })).filter(cycle => cycle.endTick > first.tick);
      const cycleSeconds = cycles.length ? cycles.reduce((sum, cycle) => sum + cycle.seconds, 0) / cycles.length : null;
      return { id, type, deposits, cycles, meanCycleSeconds: cycleSeconds, walkedWorldUnits: walked,
        sampledMovingSeconds: movingSeconds, sampledHarvestSeconds: harvestSeconds,
        sampledReturningSeconds: returningSeconds,
        sampledStationaryNoCargoIncreaseSeconds: stationaryNoHarvestSeconds };
    });
    return { team, seconds, startTick: first.tick, endTick: last.tick,
      deposited: Object.fromEntries(['food', 'wood'].map(type => [type, last[type][team] - first[type][team]])),
      depositedPerMinute: Object.fromEntries(['food', 'wood'].map(type => [type, (last[type][team] - first[type][team]) * 60 / seconds])),
      fullCycleEquivalentDepositedPerMinute: Object.fromEntries(['food', 'wood'].map(type => [type,
        workers.filter(worker => worker.type === type && worker.meanCycleSeconds > 0)
          .reduce((sum, worker) => sum + carryCapacity * 60 / worker.meanCycleSeconds, 0)])),
      workers };
  });
}

export function compareDepotResults(results) {
  return results.filter(result => result.strategy !== 'home').map(result => {
    const baseline = results.find(row => row.layout === result.layout && row.foodWorkers === result.foodWorkers && row.strategy === 'home');
    assert.ok(baseline, 'comparison requires its exact home-only allocation/layout');
    const mill = results.find(row => row.layout === result.layout && row.foodWorkers === result.foodWorkers && row.strategy === 'mill');
    return { caseId: depotCaseId(result), seats: result.seats.map((seat, team) => {
      const extraFoodPerMinute = seat.depositedPerMinute.food - baseline.seats[team].depositedPerMinute.food;
      const extraWoodPerMinute = seat.depositedPerMinute.wood - baseline.seats[team].depositedPerMinute.wood;
      const woodGainVsMill = mill ? seat.depositedPerMinute.wood - mill.seats[team].depositedPerMinute.wood : null;
      const premium = mill ? result.cost.wood - mill.cost.wood : null;
      const cycleWoodGainVsMill = mill && seat.fullCycleEquivalentDepositedPerMinute && mill.seats[team].fullCycleEquivalentDepositedPerMinute
        ? seat.fullCycleEquivalentDepositedPerMinute.wood - mill.seats[team].fullCycleEquivalentDepositedPerMinute.wood : null;
      return { team, extraFoodPerMinute, extraWoodPerMinute,
        // This is only repayment of the additional WOOD price from extra WOOD income.
        woodPremiumRepaymentMinutesVsMill: premium > 0 && woodGainVsMill > 0 ? premium / woodGainVsMill : null,
        cycleBasedWoodPremiumRepaymentMinutesVsMill: premium > 0 && cycleWoodGainVsMill > 0 ? premium / cycleWoodGainVsMill : null,
        repaymentIncludesConstructionOpportunity: false, foodWoodExchangeRateAssumed: false };
    }) };
  });
}
