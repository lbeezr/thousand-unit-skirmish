import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { farmHarvestNode } from '../src/farm-harvest.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { createDeterministicPolicy, toOpponentObservation } from '../src/pve-opponent.mjs';
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
function fn(name) {
  const start = main.indexOf(`function ${name}(`), end = main.indexOf('\nfunction ', start + 1);
  return main.slice(start, end);
}

for (const team of [0, 1]) test(`seat ${team} can target its completed Farm and clear only exhaustion`, () => {
  const farm = { id: 10, type: 'farm', team, complete: true, hp: 600, x: 0, z: 0, harvestStock: 200 };
  const context = vm.createContext({ localTeam: team, mapDefinition: { resourceNodes: [], fogOfWar: false },
    latestBuildings: [farm], farmHarvestNode, renderer: { domElement: { getBoundingClientRect: () => ({ width: 100, height: 100 }) } },
    screenPoint: { x: 0, y: 0, set() { return this; }, project() { return this; } }, groundHeight: () => 0, camera: {} });
  vm.runInContext(fn('pickResourceNodeAt'), context);
  assert.equal(context.pickResourceNodeAt(50, 50).id, 'farm:10');
  farm.team = 1 - team; assert.equal(context.pickResourceNodeAt(50, 50), null);
  farm.team = team; farm.complete = false; assert.equal(context.pickResourceNodeAt(50, 50), null);
  farm.complete = true;
  const container = { dataset: {}, children: [], replaceChildren() { this.children = []; }, append(button) { this.children.push(button); } };
  Object.assign(context, { BUILDING_DEFINITIONS, ui: { buildingLifecycleActions: container }, selectedBuildingId: farm.id,
    latestTeamResearch: [{}, {}], getBuildingQueueLength: () => 0,
    document: { createElement: () => ({ dataset: {}, addEventListener() {} }) }, matchWinner: -1,
    teamUnits: [[], []] });
  vm.runInContext(fn('updateBuildingLifecycleActions'), context);
  context.updateBuildingLifecycleActions(); assert.equal(container.children.length, 0, 'productive Farm cannot be cleared/refunded');
  farm.harvestStock = 0; context.updateBuildingLifecycleActions();
  assert.match(container.children[0].textContent, /Clear exhausted Farm · no refund/);
});

for (const team of [0, 1]) test(`deterministic seat ${team} observes and harvests owned Farms without stealing`, () => {
  const buildings = [0, 1].map(owner => ({ id: 10 + owner, type: 'farm', team: owner, complete: true,
    progress: 1, hp: 600, x: owner ? 4 : -4, z: 0, harvestStock: 200 }));
  const state = { type: 'state', mapId: 'farm-observation', tick: 100, fogOfWar: false,
    food: [0, 0], wood: [0, 0], units: [[0, team, 0, 0, 100, 'worker', 0, null, 1, 'idle']],
    buildings, resourceNodes: buildings.map(farmHarvestNode),
    workerProduction: [null, null], teamResearch: [{}, {}], objectives: [] };
  const map = { id: state.mapId, width: 32, height: 32, resourceNodes: [], spawnPoints: [{ team: 0, x: -10, z: 0 }, { team: 1, x: 10, z: 0 }] };
  const observation = toOpponentObservation(state, team, { map });
  assert.deepEqual(observation.resourceNodes.map(node => node.id), [`farm:${10 + team}`]);
  const policy = createDeterministicPolicy(19);
  const orders = policy.next(observation);
  assert.ok(orders.some(order => order.type === 'gather' && order.nodeId === `farm:${10 + team}`));
});
