import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { productionAction } from '../src/rules/production-actions.mjs';
import { UNIT_DEFINITIONS, TECHNOLOGY_DEFINITIONS } from '../src/gameplay-definitions.mjs';
const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const start = source.indexOf('function enqueueBuildingUnit(');
const end = source.indexOf('function trainInfantry(', start);
function fixture(team) {
  const building = { id: 1, team, type: 'fixture', complete: true, queue: 0, productionQueue: [], trainingRemaining: 0 };
  const notices = [];
  const context = vm.createContext({ UNIT_DEFINITIONS,
    BUILDING_DEFINITIONS: { fixture: { products: ['infantry', 'archer'] } },
    buildingsById: new Map([[1, building]]), MAX_BUILDING_QUEUE: 5, MAX_TEAM_ROSTER: 1000, MAX_UNITS: 2000,
    teamUpgrades: [{}, {}], teamFood: [500, 500], teamWood: [500, 500], aliveCounts: () => [10, 10],
    queuedUnitsForTeam: () => building.queue, queuedUnitsTotal: () => building.queue,
    canReservePopulation: () => true, findProductionSpawnCell: () => 1, dirty: false,
    sendOrderNotice: (_, __, message) => notices.push(message),
  });
  context.productionAction = (building, kind, state) => productionAction(building, kind, state,
    { units: context.UNIT_DEFINITIONS, buildings: context.BUILDING_DEFINITIONS, technologies: TECHNOLOGY_DEFINITIONS });
  context.productionContextForTeam = (seat) => ({ team: seat, food: context.teamFood[seat], wood: context.teamWood[seat],
    upgrades: context.teamUpgrades[seat], populationAvailable: 1000, seatUnits: 10, seatReservedUnits: building.queue,
    totalUnits: 20, totalReservedUnits: building.queue, seatLimit: 1000, totalLimit: 2000, queueLimit: 5 });
  vm.runInContext(source.slice(start, end), context);
  return { context, building, notices, train(kind, playerTeam = team) {
    context.trainUnit({ team: playerTeam }, { buildingId: 1, kind });
  } };
}
for (const team of [0, 1]) test(`mixed production reserves costs once and preserves FIFO for seat ${team}`, () => {
  const f = fixture(team);
  f.train('infantry'); f.train('archer');
  assert.deepEqual([...f.building.productionQueue], ['infantry', 'archer']);
  assert.equal(f.building.queue, 2);
  assert.equal(f.building.trainingRemaining, UNIT_DEFINITIONS.infantry.trainSeconds);
  assert.equal(f.context.teamFood[team], 425);
  assert.equal(f.context.teamWood[team], 455);
  f.train('worker'); f.train('archer', 1 - team); f.train('__proto__');
  assert.equal(f.building.queue, 2, 'invalid products and enemy commands cannot reserve resources');
  f.context.teamFood[team] = 0;
  f.train('archer');
  assert.equal(f.building.queue, 2);
  assert.match(f.notices.at(-1), /NEED 25 FOOD/);
  f.context.teamFood[team] = 500;
  f.train('archer'); f.train('infantry'); f.train('archer'); f.train('infantry');
  assert.equal(f.building.queue, 5);
  assert.match(f.notices.at(-1), /QUEUE FULL/);
});

for (const team of [0, 1]) test(`authoritative training rejects unmet prerequisites before spending for seat ${team}`, () => {
  const f = fixture(team);
  f.context.UNIT_DEFINITIONS = structuredClone(UNIT_DEFINITIONS);
  f.context.UNIT_DEFINITIONS.infantry.requires = ['infantry-attack'];
  f.train('infantry');
  assert.match(f.notices.at(-1), /REQUIRES INFANTRY FORGING/);
  assert.equal(f.building.queue, 0); assert.equal(f.context.teamFood[team], 500);
  f.context.teamUpgrades[team].infantryAttack = true;
  f.train('infantry');
  assert.equal(f.building.queue, 1); assert.equal(f.context.teamFood[team], 450);
});
