import { economyClientBindings } from './economy-client-fixture.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { UNIT_DEFINITIONS, BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { unitPresentation } from '../src/gameplay-presentation.mjs';
import { productionAction } from '../src/production-actions.mjs';
import { unfinishedRefund } from '../src/base-lifecycle.mjs';
import { teamPopulation } from '../src/population.mjs';

const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const extract = (source, start, end) => source.slice(source.indexOf(`function ${start}(`), source.indexOf(`function ${end}(`));
for (const team of [0, 1]) test(`Skiff paid admission and head/tail cancellation preserve the shared ledger for seat ${team}`, () => {
  const building = { id: 1, team, type: 'dock', complete: true, productionQueue: [], queue: 0, trainingRemaining: 0, productionBlocked: false };
  let available = 1; const notices = [];
  const context = vm.createContext({ ...economyClientBindings(), UNIT_DEFINITIONS, BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS, productionAction, unfinishedRefund, MAX_BUILDING_QUEUE: 5,
    buildingsById: new Map([[1, building]]), teamWood: [100, 100], teamFood: [100, 100], dirty: false,
    workerProduction: [{ queue: 0 }, { queue: 0 }], teamResearch: [null, null],
    productionContextForTeam: seat => ({ team: seat, populationAvailable: available, upgrades: {}, food: 100, wood: context.teamWood[seat],
      seatUnits: 1, seatReservedUnits: building.queue, totalUnits: 2, totalReservedUnits: building.queue,
      seatLimit: 1000, totalLimit: 2000, queueLimit: 5, matchOver: false }),
    findProductionSpawnCell: () => 1, sendOrderNotice: (_, __, message) => notices.push(message),
  });
  vm.runInContext(extract(server, 'enqueueBuildingUnit', 'trainInfantry') + extract(server, 'creditRefund', 'buildingFootprint'), context);
  context.trainUnit({ team: 1 - team }, { buildingId: 1, kind: 'skiff' });
  assert.deepEqual(context.teamWood, [100, 100]); assert.equal(building.queue, 0);
  available = 0; context.trainUnit({ team }, { buildingId: 1, kind: 'skiff' });
  assert.match(notices.at(-1), /POPULATION FULL/); assert.equal(context.teamWood[team], 100);
  available = 1; context.trainUnit({ team }, { buildingId: 1, kind: 'skiff' });
  assert.equal(context.teamWood[team], 25); assert.equal(context.teamFood[team], 100); assert.equal(building.queue, 1);
  building.trainingRemaining = 4;
  context.cancelTraining({ team }, { buildingId: 1, queueIndex: 0 });
  assert.equal(context.teamWood[team], 55); assert.equal(building.queue, 0); assert.equal(building.trainingRemaining, 0);
  context.cancelTraining({ team }, { buildingId: 1, queueIndex: 0 }); assert.equal(context.teamWood[team], 55, 'replay cannot refund twice');
  building.productionQueue = ['skiff', 'skiff']; building.queue = 2; building.trainingRemaining = 4;
  context.cancelTraining({ team }, { buildingId: 1, queueIndex: 1 });
  assert.equal(context.teamWood[team], 130); assert.equal(building.queue, 1); assert.equal(building.trainingRemaining, 4);
});

test('unarmed boats and boat-only queues cannot indefinitely hold elimination open', () => {
  const context = vm.createContext({ ...economyClientBindings(), UNIT_DEFINITIONS, BUILDING_DEFINITIONS, MAX_TEAM_ROSTER: 1000, MAX_UNITS: 2000,
    units: [{ team: 0, hp: 120, kind: 'skiff', movementDomain: 'water' }, { team: 1, hp: 100, kind: 'infantry' }],
    buildings: [{ type: 'dock', team: 0, complete: true, queue: 1, productionQueue: ['skiff'] }],
    workerProduction: [{ queue: 0 }, { queue: 0 }], teamWood: [1000, 1000], teamFood: [0, 0], teamUpgrades: [{}, {}],
    WORKER_FOOD_COST: 50, currentArmySize: 8, teamPopulation, findTownCenterProductionSpawnCell: () => -1,
    findProductionSpawnCell: () => 1, missingGameplayPrerequisites: () => [],
  });
  vm.runInContext(extract(server, 'aliveCounts', 'markVisionFrom').split('const visionRaysByRadius')[0]
    + extract(server, 'queuedUnitsForTeam', 'canReservePopulation'), context);
  assert.deepEqual([...context.eliminationAliveCounts()], [0, 1]);
  assert.equal(context.canTeamStillFieldUnits(0, [0, 1]), false);
  context.workerProduction[0].queue = 1; assert.equal(context.canTeamStillFieldUnits(0, [0, 1]), true);
  context.workerProduction[0].queue = 0; context.buildings[0].queue = 0; context.buildings[0].productionQueue = [];
  context.units = [...Array.from({ length: 15 }, () => ({ team: 0, hp: 120, kind: 'skiff', movementDomain: 'water' })), { team: 1, hp: 100, kind: 'infantry' }];
  context.teamFood[0] = 50; context.findTownCenterProductionSpawnCell = () => 1;
  assert.equal(context.populationForTeam(0).available, 0);
  assert.equal(context.canTeamStillFieldUnits(0, [0, 1]), false, 'boats consuming all population do not promise an impossible Worker');
  context.units[0].hp = 0; assert.equal(context.canTeamStillFieldUnits(0, [0, 1]), true);
});

test('foreign Dock/Skiff probes retain ordinary ownership rejections before domain-specific hints', () => {
  const notices = [];
  const context = vm.createContext({ ...economyClientBindings(), BUILDING_DEFINITIONS, buildingsById: new Map([[1, { team: 1, type: 'dock' }]]),
    units: [{ id: 0, team: 1, hp: 120, generation: 3, movementDomain: 'water' }],
    commandUnits: () => [], sendOrderNotice: (_, __, message) => notices.push(message),
  });
  vm.runInContext(extract(server, 'setBuildingRallyPoint', 'routeProducedUnitToBuildingRally')
    + extract(server, 'assignFollowOrder', 'updatePersistentOrders'), context);
  context.setBuildingRallyPoint({ team: 0 }, { buildingId: 1 }); assert.match(notices.at(-1), /SELECT YOUR PRODUCTION BUILDING/);
  context.assignFollowOrder({ team: 0 }, { ids: [], targetId: 0, targetGeneration: 3 }); assert.match(notices.at(-1), /LIVING FRIENDLY TARGET REQUIRED/);
  context.assignFollowOrder({ team: 1 }, { ids: [], targetId: 0, targetGeneration: 2 }); assert.match(notices.at(-1), /LIVING FRIENDLY TARGET REQUIRED/);
  context.setBuildingRallyPoint({ team: 1 }, { buildingId: 1 }); assert.match(notices.at(-1), /MOVE THE SKIFF AFTER SPAWN/);
  context.assignFollowOrder({ team: 1 }, { ids: [], targetId: 0, targetGeneration: 3 }); assert.match(notices.at(-1), /SKIFF SUPPORTS MOVE AND STOP/);
});

for (const team of [0, 1]) test(`Dock/Skiff command controls state their usable actions for seat ${team}`, () => {
  const buttons = ['patrol', 'follow'].map(type => ({ dataset: { persistentOrder: type }, classList: { toggle() {} }, setAttribute() {} }));
  const context = vm.createContext({ ...economyClientBindings(), UNIT_DEFINITIONS, BUILDING_DEFINITIONS, localTeam: team, latestBuildings: [{ id: 7, team, type: 'dock' }],
    selectedBuildingId: 7, units: [{ kind: 'skiff' }], selectedIds: () => [0],
    ui: { commandHint: {}, buildingCommandDetails: {}, attackMoveToggle: { classList: { toggle() {} }, setAttribute() {} }, formationSelect: {} },
    persistentTargetMode: null, attackMoveMode: false, tapOrderArmed: false, matchWinner: -1,
    window: { matchMedia: () => ({ matches: false }) }, document: { querySelectorAll: () => buttons },
    buildingLabel: () => 'Dock', updateStationaryOrderControls() {}, updateBuildingResearchControls() {},
    syncBattlefieldCursor() {}, updateContextualCommands() {},
  });
  vm.runInContext(extract(client, 'buildingSupportsRally', 'appendUnitFromState'), context);
  assert.equal(context.buildingSupportsRally('dock'), false); assert.equal(context.buildingSupportsRally('barracks'), true);
  context.updateCommandUI(); assert.match(context.ui.commandHint.textContent, /Train a Skiff \(placeholder\)/);
  assert.equal(context.ui.buildingCommandDetails.hidden, true);
  context.selectedBuildingId = null; context.attackMoveMode = true; context.persistentTargetMode = 'patrol'; context.updateCommandUI();
  assert.equal(context.attackMoveMode, false); assert.equal(context.persistentTargetMode, null);
  assert.match(context.ui.commandHint.textContent, /Select one Skiff/); assert.equal(context.ui.attackMoveToggle.disabled, true);
  assert.ok(buttons.every(button => button.disabled)); assert.equal(context.ui.formationSelect.disabled, true);
});

test('Skiff right-click admits a shore fish source, otherwise water Move, without combat/follow picking', () => {
  const calls = [], toasts = [];
  let fish = null;
  const context = vm.createContext({ ...economyClientBindings(), selectedBuildingId: null, selectedWaterUnits: () => true,
    persistentTargetMode: 'follow', worldAt: () => ({ x: 4.5, z: 6.5 }),
    issueMove: (...args) => calls.push(args),
    issueGather: node => calls.push(node), pickResourceNodeAt: () => fish, showToast: message => toasts.push(message),
    isShoreFish: node => node?.resourceVariant === 'shore-fish',
    renderer: { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0 }) } },
  });
  vm.runInContext(extract(client, 'issueContextOrder', 'buildPlacementAt'), context);
  context.issueContextOrder(10, 20);
  assert.deepEqual(calls, [[{ x: 4.5, z: 6.5 }, false, true]]);
  fish = { id: 'fish', resourceVariant: 'shore-fish' }; context.issueContextOrder(10, 20);
  assert.equal(calls.at(-1), fish);
  context.issueContextOrder(10, 20, true); assert.equal(calls.length, 2);
  assert.match(toasts.at(-1), /QUEUED FISHING IS UNAVAILABLE/);
});

test('queued Skiff fishing preserves the actual server order and cargo before route planning', () => {
  const unit = { id: 0, kind: 'skiff', movementDomain: 'water', cargo: 3, path: [14, 15], gatherNodeId: 'fish', gatherPhase: 'to-base' };
  const before = structuredClone(unit), notices = [];
  const context = vm.createContext({ ...economyClientBindings(), sendOrderNotice: (_, __, message) => notices.push(message) });
  vm.runInContext(extract(server, 'assignSkiffGather', 'assignGather'), context);
  context.assignSkiffGather({ team: 0 }, { queue: true, nodeId: 'fish', ids: [0] }, [unit]);
  assert.match(notices.at(-1), /QUEUED FISHING IS UNAVAILABLE/); assert.deepEqual(unit, before);
});

test('actual transform uses a procedural water placeholder and clears it when the slot becomes land', () => {
  const matrices = new Map(), mesh = { setMatrixAt: (slot, matrix) => matrices.set(slot, matrix.clone()) };
  let lodScale = -1;
  const context = vm.createContext({ ...economyClientBindings(), THREE, UNIT_DEFINITIONS, unitPresentation, boatMeshes: [mesh, mesh], unitArtMeshes: [[mesh, mesh]],
    dummy: new THREE.Object3D(), facing: new THREE.Quaternion(), worldUp: new THREE.Vector3(0, 1, 0),
    castPreview: false, unitSpritePreviewActive: false, unitLowDetailActive: false,
    SPAWN_POSE_MS: 600, DEFEAT_POSE_MS: 600, updateUnitHealthVisual() {}, updateUnitLodTransform: (_, scale) => { lodScale = scale; }, updateUnitFocusVisual() {}, updateUnitCargoCueColor() {},
  });
  vm.runInContext(extract(client, 'updateUnitTransform', 'setArmySize'), context);
  for (const team of [0, 1]) {
    const unit = { kind: 'skiff', team, slot: team, renderX: 4.5, renderZ: 6.5, hp: 120, scale: 1, angle: 0, spawnStartedAt: 0, defeatStartedAt: 0 };
    context.unitLowDetailActive = false;
    context.updateUnitTransform(unit, 1000);
    const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
    matrices.get(team).decompose(position, rotation, scale);
    assert.deepEqual(position.toArray(), [4.5, .16, 6.5]); assert.deepEqual(scale.toArray(), [1, 1, 1]);
    assert.equal(lodScale, 0);
    context.unitLowDetailActive = true; context.updateUnitTransform(unit, 1000);
    matrices.get(team).decompose(position, rotation, scale); assert.deepEqual(scale.toArray(), [0, 0, 0]);
    assert.equal(lodScale, 1, 'the Skiff remains visible as an existing siege marker when full-detail meshes are hidden');
    unit.kind = 'worker'; context.updateUnitTransform(unit, 1000);
    matrices.get(team).decompose(position, rotation, scale); assert.deepEqual(scale.toArray(), [0, 0, 0]);
  }
});
