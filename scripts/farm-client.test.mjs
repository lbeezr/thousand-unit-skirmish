import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { farmHarvestNode } from '../src/farm-harvest.mjs';
import { isShoreFish } from '../src/shore-fishing.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import * as THREE from 'three';
import { constructionTargetingFixture } from './construction-targeting-fixture.mjs';
import { createDeterministicPolicy, toOpponentObservation } from '../src/pve-opponent.mjs';
const main = readFileSync(process.env.FARM_CLIENT_SOURCE || new URL('../src/main.js', import.meta.url), 'utf8');
function fn(name) {
  const start = main.indexOf(`function ${name}(`), end = main.indexOf('\nfunction ', start + 1);
  return main.slice(start, end);
}

for (const team of [0, 1]) test(`seat ${team} can target its completed Farm and clear only exhaustion`, () => {
  const farm = { id: 10, type: 'farm', team, complete: true, hp: 600, x: 0, z: 0, harvestStock: 200 };
  const context = vm.createContext({ localTeam: team, mapDefinition: { resourceNodes: [], fogOfWar: false },
    latestBuildings: [farm], farmHarvestNode, isShoreFish, renderer: { domElement: { getBoundingClientRect: () => ({ width: 100, height: 100 }) } },
    pickBuildingAt: () => null,
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

for (const team of [0, 1]) test(`seat ${team} harvests the Farm body through the normal context order`, () => {
  const units = [
    { id: 0, team, kind: 'worker', hp: 100, generation: 7 },
    { id: 1, team, kind: 'infantry', hp: 100, generation: 8 },
    { id: 2, team: 1 - team, kind: 'worker', hp: 100, generation: 9 },
    { id: 3, team, kind: 'worker', hp: 0, generation: 10 },
  ];
  const farm = { id: 10, team, type: 'farm', x: 0, z: 0, hp: 600,
    complete: true, progress: 1, harvestStock: 200 };
  const f = constructionTargetingFixture({ team, units, selection: [0, 1, 2, 3], buildings: [farm],
    ...(process.env.FARM_CLIENT_SOURCE ? { sourcePath: process.env.FARM_CLIENT_SOURCE } : {}) });
  Object.assign(f.context, { farmHarvestNode, isShoreFish, mapDefinition: { resourceNodes: [], fogOfWar: false },
    selectOwnedWildlife: () => null, latestWildlifeView: null,
    screenPoint: new THREE.Vector3(), groundHeight: () => 0 });
  f.buildingVisuals.get(farm.id).group.add(new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3),
    new THREE.MeshBasicMaterial()));
  vm.runInContext([fn('pickResourceNodeAt'), fn('issueGather')].join('\n'), f.context);
  const body = f.screenAt(1.2, 0), base = f.screenAt(0, 0);
  assert.ok(Math.hypot(body.x - base.x, body.y - base.y) > 26, 'body hit lies outside the old point target');
  f.clickAt(1.2, 0);
  assert.equal(f.payloads[0]?.type, 'gather', 'clicking visible Farm body must gather rather than Move');
  assert.equal(f.payloads[0].nodeId, 'farm:10');
  assert.deepEqual(f.payloads[0].ids, [0]);
  assert.deepEqual(f.payloads[0].unitGenerations, [7]);
  assert.deepEqual([...f.selected], [0, 1, 2, 3], 'ordering preserves the selection');
  assert.equal(f.context.pickResourceNodeAt(body.x, body.y, { ownedWildlifeOnly: true }), null);
  farm.harvestStock = 0;
  assert.equal(f.context.pickResourceNodeAt(body.x, body.y)?.stock, 0, 'exhaustion remains an explicit server refusal');
  farm.complete = false;
  assert.equal(f.context.pickResourceNodeAt(body.x, body.y), null);
  f.payloads.length = 0; f.clickAt(1.2, 0);
  assert.equal(f.payloads[0]?.type, 'build', 'unfinished Farm still resumes construction');
  farm.complete = true; farm.team = 1 - team;
  assert.equal(f.context.pickResourceNodeAt(body.x, body.y), null, 'enemy Farm cannot supply food');
  farm.team = team; f.buildingVisuals.get(farm.id).group.visible = false;
  assert.equal(f.context.pickResourceNodeAt(body.x, body.y, { visibleOnly: true }), null, 'hidden body cannot be targeted');
});

for (const team of [0, 1]) test(`deterministic seat ${team} observes and harvests owned Farms without stealing`, () => {
  const buildings = [0, 1].map(owner => ({ id: 10 + owner, type: 'farm', team: owner, complete: true,
    progress: 1, hp: 600, x: owner ? 4 : -4, z: 0, harvestStock: 200 }));
  const state = { type: 'state', mapId: 'farm-observation', tick: 100, fogOfWar: false,
    food: [0, 0], wood: [0, 0], units: [[0, team, 0, 0, 100, 'worker', 0, null, 1, 'idle']],
    buildings, resourceNodes: buildings.map(farmHarvestNode),
    workerProduction: [null, null], teamResearch: [{}, {}], objectives: [] };
  const map = { id: state.mapId, width: 32, height: 32, resourceNodes: [], spawnPoints: [{ team: 0, x: -10, z: 0 }, { team: 1, x: 10, z: 0 }] };
  const observation = toOpponentObservation(state, team, map);
  assert.deepEqual(observation.resourceNodes.map(node => node.id), [`farm:${10 + team}`]);
  const policy = createDeterministicPolicy(19);
  const orders = policy.next(observation);
  assert.ok(orders.some(order => order.type === 'gather' && order.nodeId === `farm:${10 + team}`));
  state.fogOfWar = true;
  state.visibility = { columns: 32, rows: 32, data: Buffer.alloc(32 * 32 / 4).toString('base64') };
  const neutral = { id: 'hidden-neutral-food', type: 'food', stock: 200, x: 8, z: 8 };
  map.resourceNodes.push(neutral); state.resourceNodes.push(neutral);
  const fogged = toOpponentObservation(state, team, map);
  assert.deepEqual(fogged.resourceNodes.map(node => node.id), [`farm:${10 + team}`],
    'owned building remains usable under fog, while neutral and enemy food stay hidden');
  assert.ok(createDeterministicPolicy(19).next(fogged).some(order =>
    order.type === 'gather' && order.nodeId === `farm:${10 + team}`));
  const mask = Buffer.alloc(32 * 32 / 4);
  const neutralCell = (neutral.z + 16) * 32 + neutral.x + 16;
  mask[neutralCell >> 2] |= 2 << ((neutralCell & 3) * 2);
  state.visibility.data = mask.toString('base64');
  assert.deepEqual(toOpponentObservation(state, team, map).resourceNodes.map(node => node.id),
    [`farm:${10 + team}`, neutral.id], 'a visible authored food source is admitted through the map adapter');
});
