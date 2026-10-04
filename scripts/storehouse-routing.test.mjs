import { economyServerBindings, economyServerFunctions } from './economy-server-fixture.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const functions = source.slice(source.indexOf('function workerDropoffCandidates('), source.indexOf('function routeWorker(unit,'));
for (const team of [0, 1]) test(`drop-off choice measures reachable routes and preserves cargo for seat ${team}`, () => {
  const unit = { team, x: 0, z: 0, cargo: 10, cargoType: 'wood' };
  const building = (id, owner, complete, goals) => ({ id, team: owner, complete, type: 'storehouse', x: id, z: 0, footprint: goals });
  const context = vm.createContext({ ...economyServerBindings(), BUILDING_DEFINITIONS, navigationRevision: 4,
    spawnByTeam: [{ x: 1, z: 0 }, { x: 1, z: 0 }],
    buildings: [building(2, team, true, [2]), building(3, team, true, [3]),
      building(4, 1 - team, true, [4]), building(5, team, false, [5]), building(6, team, true, [6])],
    worldToCell: (x) => x, nearestOpenCell: (cell) => cell, buildingAccessCells: (cells) => cells,
    walkableComponents: [0, 0, 0, 0, 0, 0, 1],
    getAttackFlowFieldForGoals: (goals) => ({ goal: goals[0], goals: new Set(goals) }),
    pathFromAttackFlow: (_, field) => Array(field.goal === 1 ? 20 : field.goal === 2 ? 10 : 4).fill(field.goal),
  });
  context.allMatchBuildings = () => context.buildings;
  vm.runInContext(economyServerFunctions + functions, context);
  context.routeWorkerToDropoff(unit);
  assert.equal(unit.dropoffBuildingId, 3, 'a shorter reachable route wins over a closer building across a long detour');
  assert.equal(unit.path.length, 4); assert.equal(unit.cargo, 10);
  assert.equal(unit.dropoffNavigationRevision, 4);
  context.walkableComponents.fill(1, 1);
  context.routeWorkerToDropoff(unit);
  assert.equal(unit.moveGoalCell, -1, 'no reachable drop-off waits without depositing');
  assert.equal(unit.cargo, 10);
});
