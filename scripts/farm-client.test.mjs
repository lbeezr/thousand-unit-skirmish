import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { farmHarvestNode } from '../src/farm-harvest.mjs';
import { selectInspectableWildlife } from '../src/wildlife-client-state.mjs';
import { isShoreFish } from '../src/shore-fishing.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import * as THREE from 'three';
import { constructionTargetingFixture } from './construction-targeting-fixture.mjs';
import { farmSelectionFacts } from '../src/selection-portrait.mjs';
import { battlefieldCursor } from '../src/battlefield-cursor.mjs';
import { createDeterministicPolicy, toOpponentObservation } from '../src/pve-opponent.mjs';
import { constructionCostForProfile } from '../src/economy-profile.mjs';
import { formatResourceRequirement } from '../src/resource-format.mjs';
import { setHudActionAvailability, isHudActionUnavailable } from '../src/hud-layout.mjs';
const lifecycleBindings = { constructionCostForProfile, formatResourceRequirement, setHudActionAvailability,
  isHudActionUnavailable, latestWood: [500, 500], mapDefinition: {} };
function lifecycleButton() {
  const attributes = new Map();
  return { dataset: {}, setAttribute(name, value) { attributes.set(name, value); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    addEventListener(type, callback) { this.click = callback; } };
}
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
  Object.assign(context, { ...lifecycleBindings, BUILDING_DEFINITIONS, ui: { buildingLifecycleActions: container }, selectedBuildingId: farm.id,
    latestTeamResearch: [{}, {}], getBuildingQueueLength: () => 0,
    document: { createElement: lifecycleButton }, matchWinner: -1, selectedWorkerIds: () => [],
    teamUnits: [[], []] });
  vm.runInContext(fn('updateBuildingLifecycleActions'), context);
  context.updateBuildingLifecycleActions(); assert.equal(container.children.length, 0, 'productive Farm cannot be cleared/refunded');
  farm.harvestStock = 0; context.updateBuildingLifecycleActions();
  assert.match(container.children[0].textContent, /Replant · 60 wood/);
  assert.match(container.children[1].textContent, /Clear exhausted Farm · no refund/);
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
    selectInspectableWildlife, latestWildlifeView: null,
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
  assert.equal(f.context.pickResourceNodeAt(body.x, body.y, { inspectableWildlifeOnly: true }), null);
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

for (const team of [0, 1]) test(`seat ${team} Farm hover names only visible food and the available Worker action`, () => {
  const farm = { id: 10, team, type: 'farm', x: 0, z: 0, hp: 600, complete: true, harvestStock: 125 };
  const f = constructionTargetingFixture({ team, buildings: [farm], selection: [0],
    units: [{ id: 0, team, kind: 'worker', hp: 100, generation: 1 }] });
  f.buildingVisuals.get(farm.id).group.add(new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), new THREE.MeshBasicMaterial()));
  const body = f.screenAt(1.2, 0);
  Object.assign(f.context, { farmSelectionFacts, battlefieldCursor, farmHarvestNode, isShoreFish,
    mapDefinition: { resourceNodes: [], fogOfWar: false }, screenPoint: new THREE.Vector3(), groundHeight: () => 0,
    selectedWildlife: () => null, pan: null, spaceDown: false, drag: null, movedPointer: false,
    cursorPointer: { x: body.x + 10, y: body.y + 20 }, cursorShift: false, tapOrderArmed: false,
    ui: {}, buildingSupportsRally: () => false,
    setBattlefieldCursor: mode => { f.context.cursorMode = mode; } });
  vm.runInContext([fn('pickResourceNodeAt'), fn('syncBattlefieldCursor')].join('\n'), f.context);
  f.context.syncBattlefieldCursor(); assert.equal(f.context.cursorMode, 'gather');
  assert.match(f.context.renderer.domElement.title, /Food plot.*125 \/ 200.*Select Workers.*right-click.*harvest/);
  farm.harvestStock = 0; f.context.syncBattlefieldCursor();
  assert.equal(f.context.cursorMode, 'unavailable');
  assert.match(f.context.renderer.domElement.title, /0 \/ 200.*Exhausted.*Clear exhausted Farm/);
  f.context.pickHarvestableTreeAt = () => ({ forestCell: 42 }); f.context.syncBattlefieldCursor();
  assert.equal(f.context.cursorMode, 'gather-wood', 'existing visible tree target keeps context-order priority');
  assert.equal(f.context.renderer.domElement.title, '');
  f.context.pickHarvestableTreeAt = () => null;
  farm.complete = false; f.context.syncBattlefieldCursor();
  assert.equal(f.context.cursorMode, 'build-valid');
  assert.match(f.context.renderer.domElement.title, /under construction.*no food available yet.*finish construction/);
  farm.complete = true; farm.team = 1 - team; f.context.syncBattlefieldCursor();
  assert.equal(f.context.cursorMode, 'unavailable');
  assert.equal(f.context.renderer.domElement.title, 'Enemy Farm · Your Workers cannot harvest this plot.');
  assert.doesNotMatch(f.context.renderer.domElement.title, /remaining|200|125/);
  farm.team = team; farm.harvestStock = 125; f.selected.clear(); f.context.syncBattlefieldCursor();
  assert.equal(f.context.cursorMode, 'select'); assert.match(f.context.renderer.domElement.title, /Select Workers/);
  f.buildingVisuals.get(farm.id).group.visible = false; f.context.syncBattlefieldCursor();
  assert.equal(f.context.renderer.domElement.title, '', 'hidden and unrelated targets clear stale Farm help');
});

for (const team of [0, 1]) test(`seat ${team} unfinished Farm hover mirrors actual serialized construction and movement modes`, () => {
  for (const [mode, flags, cursor, type] of [
    ['context', {}, 'build-valid', 'build'],
    ['armed context', { tapOrderArmed: true }, 'build-valid', 'build'],
    ['queued Move', { cursorShift: true }, 'move-queued', 'move'],
    ['explicit Move', { persistentTargetMode: 'move' }, 'move', 'move'],
    ['Patrol', { persistentTargetMode: 'patrol' }, 'move', 'patrol'],
    ['Follow without leader', { persistentTargetMode: 'follow' }, 'unavailable', undefined],
    ['attack-move', { attackMoveMode: true }, 'attack-move', 'attackMove'],
  ]) {
    const farm = { id: 10, team, type: 'farm', x: 0, z: 0, hp: 300, complete: false, harvestStock: 0 };
    const f = constructionTargetingFixture({ team, buildings: [farm], selection: [0, 1],
      units: [{ id: 0, team, kind: 'worker', hp: 100, generation: 5 },
        { id: 1, team, kind: 'infantry', hp: 100, generation: 6 }],
      ...(process.env.FARM_CLIENT_SOURCE ? { sourcePath: process.env.FARM_CLIENT_SOURCE } : {}) });
    f.buildingVisuals.get(farm.id).group.add(new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), new THREE.MeshBasicMaterial()));
    const body = f.screenAt(1.2, 0);
    Object.assign(f.context, { farmSelectionFacts, battlefieldCursor, farmHarvestNode, isShoreFish,
      mapDefinition: { resourceNodes: [], fogOfWar: false }, screenPoint: new THREE.Vector3(), groundHeight: () => 0,
      selectedWildlife: () => null, pan: null, spaceDown: false, drag: null, movedPointer: false,
      cursorPointer: { x: body.x + 10, y: body.y + 20 }, cursorShift: false, tapOrderArmed: false,
      ui: { formationSelect: { value: 'box' } }, buildingSupportsRally: () => false,
      moveMarker: { position: { set() {} }, material: { color: { setHex() {} } }, scale: { setScalar() {} } },
      moveMarkerAge: 0, setBattlefieldCursor: value => { f.context.cursorMode = value; }, ...flags });
    vm.runInContext([fn('pickResourceNodeAt'), fn('syncBattlefieldCursor'), fn('issueMove')].join('\n'), f.context);
    f.context.syncBattlefieldCursor(); assert.equal(f.context.cursorMode, cursor, mode);
    const title = f.context.renderer.domElement.title;
    if (type === 'build') assert.match(title, /finish construction/, mode);
    else assert.doesNotMatch(title, /finish construction|harvest\./, mode);
    f.clickAt(1.2, 0, Boolean(flags.cursorShift));
    assert.equal(f.payloads[0]?.type, type, `${mode}: hover must match the actual dispatched command`);
    if (type) {
      assert.deepEqual(f.payloads[0].ids, type === 'build' ? [0] : [0, 1]);
      assert.deepEqual(f.payloads[0].unitGenerations, type === 'build' ? [5] : [5, 6]);
    }
    if (flags.cursorShift) assert.equal(f.payloads[0].queue, true);
  }
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

for (const team of [0, 1]) test(`seat ${team} explicitly selected Workers survive plot selection and Replant serializes only that selection`, () => {
  const farm = { id: 10, type: 'farm', team, complete: true, hp: 600, harvestStock: 0 };
  const units = [{ id: 0, team, kind: 'worker', hp: 100, generation: 7 },
    { id: 1, team, kind: 'infantry', hp: 100, generation: 8 },
    { id: 2, team: 1-team, kind: 'worker', hp: 100, generation: 9 }];
  const f = constructionTargetingFixture({ team, units, selection: [0, 1, 2], buildings: [farm] });
  const statuses = [], submitted = [];
  const container = {dataset:{},children:[],replaceChildren(){this.children=[];},append(button){this.children.push(button);}};
  Object.assign(f.context, {...lifecycleBindings,ui:{buildingLifecycleActions:container},latestTeamResearch:[{},{}],
    getBuildingQueueLength:()=>0, document:{createElement:lifecycleButton},
    teamUnits:[[],[]],clearWildlifeSelection(){},clearActiveControlGroup(){},syncSelectionMesh(){},
    updateSelectionUI(){},updateBuildingSelectionVisual(){},window:{matchMedia:()=>({matches:false})},
    currentOrderToken:700,beginOrderStatus:(...args)=>{submitted.push(args);return 700;},
    finishOrderStatus:(...args)=>statuses.push(args)});
  vm.runInContext([fn('selectBuilding'),fn('updateBuildingLifecycleActions'),fn('applyOrderNotice')].join('\n'),f.context);
  f.context.selectBuilding(farm);
  assert.deepEqual([...f.selected],[0],'exhausted owned plot retains only explicitly selected living friendly Workers');
  f.context.updateBuildingLifecycleActions();
  assert.equal(container.children[0].textContent,'Replant · 60 wood');
  assert.equal(container.children[1].textContent,'Clear exhausted Farm · no refund');
  container.children[0].click();
  assert.deepEqual(submitted,[['REPLANT · 60 WOOD',1,'WORKERS']]);
  assert.equal(f.payloads[0].type,'replantFarm');
  assert.equal(f.payloads[0].buildingId,10);
  assert.deepEqual(f.payloads[0].ids,[0]);
  assert.deepEqual(f.payloads[0].unitGenerations,[7]);
  assert.equal(f.context.applyOrderNotice(699,'REPLANT REJECTED · NEED 60 WOOD'),false,'stale affordability feedback cannot finish the current order');
  assert.deepEqual(statuses,[]);
  assert.equal(f.context.applyOrderNotice(700,'REPLANT REJECTED · NEED 60 WOOD'),true);
  assert.deepEqual(statuses,[[700,'REPLANT REJECTED · NEED 60 WOOD','failed']]);
  assert.equal(farm.harvestStock,0,'rejection leaves the selected plot exhausted');
  assert.deepEqual([...f.selected],[0],'rejection preserves the explicitly selected Worker');
  assert.equal(f.context.applyOrderNotice(700,'FARM REPLANTED · 60 WOOD · 1 WORKERS · HARVEST AFTER CONSTRUCTION'),true);
  assert.deepEqual(statuses.at(-1),[700,'FARM REPLANTED · 60 WOOD · 1 WORKERS · HARVEST AFTER CONSTRUCTION','applied']);
  f.selected.clear(); container.children[0].click();
  assert.equal(f.payloads.length,1,'no selected Worker sends no order');
  assert.match(container.children[0].textContent,/Select living Workers.*exhausted plot/);
  assert.equal(container.children[0].getAttribute('aria-disabled'),'true');
  assert.equal(submitted.length,1,'no selected Worker starts no tracked order');
  farm.harvestStock=1; f.selected.add(0); f.context.selectBuilding(farm);
  assert.equal(f.selected.size,0,'productive plot retains ordinary exclusive building selection');
});
