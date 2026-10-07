import { economyClientBindings } from './economy-client-fixture.mjs';
import { wildlifeClientBindings, wildlifeClientFunctionSource } from './wildlife-client-fixture-bindings.mjs';
import { economyServerBindings, economyServerFunctions, workerFlowRouteBindings, workerPerimeterServerFunctions } from './economy-server-fixture.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { BUILDING_DEFINITIONS, FACTION_DEFINITIONS, UNIT_DEFINITIONS, TECHNOLOGY_DEFINITIONS, GAMEPLAY_RULESET_REVISION } from '../src/gameplay-definitions.mjs';
import { hasGameplayCapability } from '../src/combat-rules.mjs';
import { creditResourceBalance } from '../src/economy-ledger.mjs';
import { buildingPresentation } from '../src/gameplay-presentation.mjs';
import { frontierBuildingPreviewUrl } from '../src/frontier-building-preview.mjs';

const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const routing = server.slice(server.indexOf('function workerDropoffCandidates('), server.indexOf('function routeWorker(unit,'));
const client = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const commandUI = client.slice(client.indexOf('function buildingSupportsRally('), client.indexOf('function syncTargetOrderUI('));
function serverFunction(name) {
  const start = server.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const end = server.indexOf('\nfunction ', start + 1);
  return server.slice(start, end < 0 ? undefined : end);
}

test('Mill is a cheaper food-only Frontier depot with authored default art and an existing procedural fallback', () => {
  assert.ok(FACTION_DEFINITIONS.frontier.buildings.includes('mill'));
  assert.deepEqual(BUILDING_DEFINITIONS.mill.dropoff, ['food']);
  assert.deepEqual(BUILDING_DEFINITIONS.mill.products, []);
  assert.equal(BUILDING_DEFINITIONS.mill.populationCapacity, undefined);
  assert.ok(BUILDING_DEFINITIONS.mill.cost.wood < BUILDING_DEFINITIONS.storehouse.cost.wood);
  assert.ok(BUILDING_DEFINITIONS.mill.buildSeconds < BUILDING_DEFINITIONS.storehouse.buildSeconds);
  assert.ok(BUILDING_DEFINITIONS.mill.maxHp < BUILDING_DEFINITIONS.storehouse.maxHp);
  assert.deepEqual(buildingPresentation('mill'), { backend: 'procedural', role: 'house' });
  assert.ok(frontierBuildingPreviewUrl('mill', '1').endsWith('/frontier-economy-models-v1/mill-complete-renderer.json'));
});

test('pre-Mill content pins cannot claim a Mill that their definitions never contained', () => {
  const context = vm.createContext({ ...economyClientBindings(), ...economyServerBindings(), MATCH_CHECKPOINT_SCHEMA_VERSION: 22, MATCH_RULES_VERSION: 6,
    GAMEPLAY_RULESET_REVISION });
  vm.runInContext(serverFunction('migrateMatchCheckpoint'), context);
  for (const rulesetRevision of [
    'v1:d85f5a09decc0d0ade81803ab289b52ec5a08e84ff5a1771e85401d4c3611eab',
    'v1:fe00d0541953e6ed6d2c4e121789dd26fa6a962abce9ab8b4de1f067064ad801',
  ]) {
    const snapshot = { schemaVersion: 22, rulesVersion: 6, rulesetRevision,
      state: { buildings: [{ type: 'mill' }], units: [] } };
    assert.equal(context.migrateMatchCheckpoint(snapshot).rulesetRevision, rulesetRevision,
      'unsupported content remains incompatible with the current restore validator');
  }
});

for (const team of [0, 1]) test(`Mill routing filters resource, completion, ownership and reachability for seat ${team}`, () => {
  const building = (id, owner, complete, type = 'mill') => ({ id, team: owner, complete, type, x: id, z: 0, footprint: [id] });
  const buildings = [building(1, team, true, 'town-center'), building(2, team, true),
    building(3, team, true, 'storehouse'), building(4, 1 - team, true),
    building(5, team, false), building(6, team, true)];
  const context = vm.createContext({ ...economyClientBindings(), ...economyServerBindings(), ...workerFlowRouteBindings(), BUILDING_DEFINITIONS, navigationRevision: 4, WORKER_INTERACTION_RANGE: 1.2,
    allMatchBuildings: () => buildings, buildingsById: new Map(buildings.map(row => [row.id, row])),
    worldToCell: x => x, nearestOpenCell: cell => cell, buildingAccessCells: cells => cells,
    walkableComponents: [0, 0, 0, 0, 0, 0, 1],
    getAttackFlowFieldForGoals: goals => ({ goal: goals[0], goals: new Set(goals) }),
    pathFromAttackFlow: (_, field) => Array(field.goal === 1 ? 20 : field.goal === 2 ? 2 : 8).fill(field.goal),
    distanceToBuildingEdge: () => 0,
  });
  vm.runInContext(economyServerFunctions + workerPerimeterServerFunctions + routing, context);
  const unit = { team, x: 0, z: 0, cargo: 10, cargoType: 'food', orderRevision: 0 };
  context.routeWorkerToDropoff(unit);
  assert.equal(unit.dropoffBuildingId, 2, 'the nearest reachable completed friendly Mill accepts food');
  assert.ok(!context.workerDropoffCandidates(unit).some(row => [4, 5].includes(row.id)));
  assert.equal(context.workerAtDropoff(unit), true);
  unit.cargoType = 'wood';
  assert.equal(context.workerAtDropoff(unit), false, 'cached Mill destinations must recheck cargo type');
  assert.equal(unit.dropoffBuildingId, 3, 'wood uses the Storehouse instead of any Mill');
  assert.equal(unit.cargo, 10);
  unit.cargoType = 'food'; context.routeWorkerToDropoff(unit);
  buildings.splice(buildings.findIndex(row => row.id === 2), 1); context.buildingsById.delete(2);
  assert.equal(context.workerAtDropoff(unit), false);
  assert.equal(unit.dropoffBuildingId, 3, 'a destroyed Mill reroutes food to the existing Storehouse');
  assert.equal(unit.cargo, 10, 'invalid destinations never consume cargo');
});

for (const team of [0, 1]) test(`Return cargo uses Mill for food and rejects wood when only Mill is available for seat ${team}`, () => {
  const unit = { id: 0, team, kind: 'worker', hp: 35, generation: 3, x: 0, z: 0,
    cargo: 0.5, cargoType: 'food', orderRevision: 2, queuedWaypoints: [], path: [],
    gatherNodeId: null, gatherForestCell: -1, gatherPhase: '', moveGoalCell: -1 };
  const building = { id: 1, team, complete: true, type: 'mill', footprint: [1] };
  const notices = [];
  const context = vm.createContext({ ...economyClientBindings(), ...economyServerBindings(), ...workerFlowRouteBindings(), units: [unit], MAX_UNITS: 1000, dirty: false,
    BUILDING_DEFINITIONS, navigationRevision: 4, WORKER_INTERACTION_RANGE: 1.2,
    allMatchBuildings: () => [building], buildingsById: new Map([[1, building]]),
    worldToCell: x => x, nearestOpenCell: cell => cell, buildingAccessCells: cells => cells,
    walkableComponents: [0, 0], getAttackFlowFieldForGoals: goals => ({ goal: goals[0], goals: new Set(goals) }),
    pathFromAttackFlow: (_, field) => [field.goal], distanceToBuildingEdge: () => 0,
    unitHasCapability: (worker, capability) => hasGameplayCapability(UNIT_DEFINITIONS[worker.kind], capability),
    sendOrderNotice: (_, command, message) => notices.push(message),
    teamFood: [0, 0], teamWood: [0, 0], resourceNodeStates: new Map(),
    creditResourceBalance, flushPendingForestClears() {},
  });
  vm.runInContext(economyServerFunctions + workerPerimeterServerFunctions + ['commandUnitAt', 'commandUnits', 'clearAttackMoveOrder',
    'workerDropoffCandidates', 'workerFlowPath', 'applyWorkerFlowRoute', 'routeWorkerToDropoff', 'workerAtDropoff', 'assignReturnCargo',
    'stopGathering', 'ensureGatherWorkIntent', 'updateWorkerEconomy'].map(serverFunction).join('\n'), context);
  const order = () => context.assignReturnCargo({ team }, { type: 'returnCargo', ids: [0], unitGenerations: [3] });
  order();
  assert.match(notices.at(-1), /RETURN CARGO ORDER/);
  assert.equal(unit.dropoffBuildingId, 1);
  assert.equal(unit.gatherNodeId, null, 'returning food does not need a surviving source');
  context.updateWorkerEconomy(); context.updateWorkerEconomy();
  assert.equal(context.teamFood[team], 0.5);
  assert.equal(unit.cargo, 0);
  Object.assign(unit, { cargo: 7.25, cargoType: 'wood' }); context.dirty = false;
  const before = structuredClone(unit);
  order(); context.updateWorkerEconomy();
  assert.match(notices.at(-1), /RETURN CARGO REJECTED · NO CARRYING WORKERS WITH A REACHABLE DROP-OFF/);
  assert.deepEqual(structuredClone(unit), before, 'wood rejection preserves cargo and previous intent');
  assert.equal(context.teamWood[team], 0);
  assert.equal(context.dirty, false);
});

for (const team of [0, 1]) test(`selected depot hints describe registered resources for seat ${team}`, () => {
  const context = vm.createContext({ ...economyClientBindings(), ...wildlifeClientBindings(), ...economyServerBindings(), BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS, localTeam: team, selectedBuildingId: 7,
    latestBuildings: [], ui: { commandHint: {}, commandTitle: {} }, persistentTargetMode: null,
    tapOrderArmed: false, attackMoveMode: false, window: { matchMedia: () => ({ matches: false }) },
    document: new JSDOM().window.document, buildingLabel: type => BUILDING_DEFINITIONS[type].label,
    updateStationaryOrderControls() {}, updateBuildingResearchControls() {}, syncTargetOrderUI() {},
    syncBattlefieldCursor() {}, updateContextualCommands() {},
  });
  vm.runInContext(wildlifeClientFunctionSource(client) + commandUI, context);
  for (const [type, resources] of [['mill', 'food'], ['storehouse', 'food and wood']]) {
    context.latestBuildings = [{ id: 7, team, type, complete: true }];
    context.updateCommandUI();
    assert.equal(context.ui.commandHint.textContent, `Workers deposit ${resources} here when complete.`);
    assert.match(context.ui.commandTitle.textContent, new RegExp(BUILDING_DEFINITIONS[type].label));
  }
});
