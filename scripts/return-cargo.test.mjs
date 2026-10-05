import { economyServerBindings, economyServerFunctions, workerFlowRouteBindings } from './economy-server-fixture.mjs';
import './land-return-admission-journeys.mjs';
import { browserRecoveryBindings } from './browser-recovery-fixture.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { BUILDING_DEFINITIONS, UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { hasGameplayCapability } from '../src/combat-rules.mjs';
import { creditResourceBalance } from '../src/economy-ledger.mjs';

const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
function fn(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const end = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, end < 0 ? undefined : end);
}
function worker(team, overrides = {}) {
  return { id: 0, team, kind: 'worker', generation: 3, hp: 35, x: 0, z: 0,
    cargo: 0.5, cargoType: 'food', orderRevision: 2, queuedWaypoints: [9],
    path: [9], pathIndex: 0, moveGoalCell: 9, movePlanningPending: true,
    gatherNodeId: 'exhausted-sheep', gatherForestCell: -1, gatherPhase: '',
    buildingTargetId: 9, repairing: true, attackTargetId: 8, attackBuildingTargetId: 7,
    holdingPosition: true, persistentOrder: { type: 'patrol' }, attackMove: true,
    ...overrides };
}

for (const team of [0, 1]) test(`seat ${team} snapshots keep every positive cargo load actionable`, () => {
  for (const cargoType of ['food', 'wood']) {
    for (const [cargo, expected] of [[0, 0], [Number.MIN_VALUE, Number.MIN_VALUE],
      [0.000001, 0.000001], [0.004, 0.004], [0.004999, 0.004999], [0.005, 0.01],
      [0.5, 0.5], [7.253, 7.25], [10, 10]]) {
      const unit = worker(team, { cargo, cargoType: cargo ? cargoType : null });
      const authority = vm.createContext({ workerPerformingAction: () => null, ...economyServerBindings(), units: [unit], mapDefinition: { fogOfWar: true },
        workerTaskStatus: () => 'idle', workerAudioExecution: () => null,
        workerGatherHeading: () => null, workerFishingPresentation: () => null,
        resourceNodeStates: new Map(), cellVisibleToTeam: () => false, worldToCell: () => 0 });
      vm.runInContext(fn(server, 'snapshotUnits'), authority);
      const own = JSON.parse(JSON.stringify(authority.snapshotUnits(team)))[0];
      assert.equal(own[6], expected);
      assert.equal(own[7], cargo ? cargoType : null);
      assert.equal(authority.snapshotUnits(1 - team).length, 0, 'hidden foreign cargo remains undisclosed');
      const sent = [], toasts = [];
      const clientContext = vm.createContext({ ...economyServerBindings(), localTeam: team, matchWinner: -1,
        units: [{ ...unit, cargo: own[6], cargoType: own[7] }], selectedIds: () => [0],
        sendTrackedOrder: command => { sent.push(JSON.parse(JSON.stringify(command))); return true; },
        showToast: message => toasts.push(message), setTapOrderArmed() {}, setAttackMoveMode() {} });
      const start = client.indexOf('function issueReturnCargo(');
      const end = client.indexOf("for (const button of document.querySelectorAll('[data-return-cargo]'))", start);
      vm.runInContext(client.slice(start, end), clientContext);
      clientContext.issueReturnCargo();
      if (cargo > 0) {
        assert.deepEqual(sent, [{ type: 'returnCargo', ids: [0] }]);
        assert.deepEqual(toasts, []);
      } else {
        assert.deepEqual(sent, []); assert.deepEqual(toasts, ['SELECT YOUR CARRYING WORKERS OR SKIFF']);
      }
    }
  }
});
function authority(team, overrides = {}) {
  const unit = worker(team, overrides);
  const buildings = [
    { id: 1, team, complete: true, type: 'town-center', footprint: [1] },
    { id: 2, team: 1 - team, complete: true, type: 'town-center', footprint: [2] },
    { id: 3, team, complete: false, type: 'storehouse', footprint: [3] },
    { id: 4, team, complete: true, type: 'barracks', footprint: [4] },
  ];
  const notices = [];
  const context = vm.createContext({ ...economyServerBindings(), ...workerFlowRouteBindings(), units: [unit], MAX_UNITS: 1000, dirty: false,
    BUILDING_DEFINITIONS, navigationRevision: 4, WORKER_INTERACTION_RANGE: 1.5,
    allMatchBuildings: () => buildings, buildingsById: new Map(buildings.map(b => [b.id, b])),
    worldToCell: x => x, nearestOpenCell: cell => cell, buildingAccessCells: cells => cells,
    walkableComponents: [0, 0, 0, 0, 0],
    getAttackFlowFieldForGoals: goals => ({ goal: goals[0], goals: new Set(goals) }),
    pathFromAttackFlow: (_, field) => [field.goal], distanceToBuildingEdge: () => 0,
    unitHasCapability: (u, capability) => hasGameplayCapability(UNIT_DEFINITIONS[u.kind], capability),
    sendOrderNotice: (_, command, message) => notices.push({ token: command.clientOrderToken, message }),
    teamFood: [0, 0], teamWood: [0, 0], resourceNodeStates: new Map(),
    creditResourceBalance, flushPendingForestClears() {},
  });
  const names = ['commandUnitAt', 'commandUnits', 'clearAttackMoveOrder',
    'workerDropoffCandidates', 'workerFlowPath', 'applyWorkerFlowRoute', 'routeWorkerToDropoff', 'workerAtDropoff',
    'assignReturnCargo', 'stopGathering', 'ensureGatherWorkIntent', 'updateWorkerEconomy', 'workerTaskStatus'];
  vm.runInContext(economyServerFunctions + names.map(name => fn(server, name)).join('\n'), context);
  const order = extra => context.assignReturnCargo({ team }, {
    type: 'returnCargo', ids: [0], unitGenerations: [unit.generation], clientOrderToken: 100, ...extra,
  });
  return { context, unit, buildings, notices, order };
}

for (const team of [0, 1]) {
  for(const loss of ['destroyed','unreachable'])test(`seat ${team}: queued delivery waits through ${loss} drop-off and deposits before one planning job`,()=>{
    const {context,unit,buildings,order}=authority(team);
    Object.assign(context,{tickNumber:20,ATTACK_MOVE_SCAN_INTERVAL_TICKS:6,nextMoveOrderId:1,
      movePlanningEpoch:0,performance:{now:()=>0},SHARED_MOVE_PATHS:true,
      movePlanningQueue:[],scheduleNextMovePlanning(){}});
    vm.runInContext(fn(server,'advanceQueuedWaypoints'),context);
    order();unit.queuedWaypoints=[{destination:4,attackMove:true}];
    const dropoff=buildings[0];
    if(loss==='destroyed'){buildings.shift();context.buildingsById.delete(dropoff.id);}
    else context.walkableComponents[1]=1;
    context.navigationRevision++;
    for(let i=0;i<3;i++){context.updateWorkerEconomy();context.advanceQueuedWaypoints();}
    assert.equal(unit.cargo,.5);assert.equal(context.teamFood[team],0);
    assert.equal(unit.gatherPhase,'to-base');assert.equal(unit.queuedWaypoints.length,1);
    assert.equal(unit.moveGoalCell,-1);assert.equal(context.movePlanningQueue.length,0);
    if(loss==='destroyed'){
      const replacement={...dropoff,id:5};buildings.unshift(replacement);context.buildingsById.set(5,replacement);
    }
    context.walkableComponents[1]=0;context.navigationRevision++;
    context.updateWorkerEconomy();
    unit.x=1;unit.pathIndex=unit.path.length;
    context.advanceQueuedWaypoints();
    assert.equal(unit.queuedWaypoints.length,1,'arrival alone cannot release the delivery queue');
    assert.equal(unit.cargo,.5);assert.equal(context.movePlanningQueue.length,0);
    context.updateWorkerEconomy();context.advanceQueuedWaypoints();
    assert.equal(context.teamFood[team],.5);assert.equal(unit.cargo,0);assert.equal(unit.gatherPhase,'');
    assert.equal(unit.queuedWaypoints.length,0);assert.equal(unit.moveGoalCell,4);assert.equal(unit.attackMove,true);
    assert.equal(context.movePlanningQueue.length,1);
    context.updateWorkerEconomy();context.advanceQueuedWaypoints();
    assert.equal(context.teamFood[team],.5);assert.equal(context.movePlanningQueue.length,1,'no duplicate queued planning');
  });
  test(`seat ${team} returns existing food/wood once and cancels previous intent`, () => {
    for (const [cargoType, cargo] of [['food', 0.5], ['wood', 7.25]]) {
      const { context, unit, order, notices } = authority(team, { cargoType, cargo });
      order({ ids: [0, 0], unitGenerations: [3, 3] });
      assert.match(notices.at(-1).message, /RETURN CARGO ORDER · 1 WORKERS/);
      assert.equal(unit.orderRevision, 3);
      assert.equal(unit.movePlanningPending, false);
      assert.equal(unit.persistentOrder, null); assert.equal(unit.holdingPosition, false);
      assert.equal(unit.buildingTargetId, null); assert.equal(unit.attackTargetId, -1);
      assert.equal(unit.queuedWaypoints.length, 0);
      assert.equal(unit.gatherNodeId, null); assert.equal(unit.gatherForestCell, -1);
      assert.equal(unit.gatherPhase, 'to-base'); assert.equal(context.workerTaskStatus(unit), 'returning');
      assert.equal(unit.dropoffBuildingId, 1, 'only completed owned compatible drop-offs qualify');
      assert.equal(unit.cargo, cargo, 'orders never credit or discard cargo');
      context.updateWorkerEconomy(); context.updateWorkerEconomy();
      assert.equal((cargoType === 'food' ? context.teamFood : context.teamWood)[team], cargo);
      assert.equal(unit.cargo, 0); assert.equal(unit.cargoType, null);
      assert.equal(unit.gatherPhase, ''); assert.equal(context.workerTaskStatus(unit), 'idle');
      order(); context.updateWorkerEconomy();
      assert.match(notices.at(-1).message, /RETURN CARGO REJECTED/);
      assert.equal((cargoType === 'food' ? context.teamFood : context.teamWood)[team], cargo);
    }
  });
  test(`seat ${team} rejects invalid cargo orders without replacing prior orders`, () => {
    const cases = [
      [{ hp: 0 }, {}], [{ team: 1 - team }, {}], [{ kind: 'infantry' }, {}],
      [{ cargo: 0, cargoType: null }, {}], [{ cargoType: 'gold' }, {}],
      [{}, { unitGenerations: [2] }], [{}, { ids: [999] }],
      [{}, { nodeId: 'exhausted-sheep' }], [{}, { forestCell: 0 }],
    ];
    for (const [overrides, command] of cases) {
      const { context, unit, order, notices } = authority(team, overrides);
      const before = structuredClone(unit);
      order(command);
      assert.match(notices.at(-1).message, /RETURN CARGO REJECTED/);
      assert.deepEqual(unit, before); assert.equal(context.dirty, false);
    }
  });
  test(`seat ${team} preserves cargo across blocked and destroyed drop-offs`, () => {
    const { context, unit, buildings, order, notices } = authority(team);
    context.walkableComponents[1] = 1;
    const before = structuredClone(unit); order();
    assert.match(notices.at(-1).message, /NO CARRYING WORKERS WITH A REACHABLE DROP-OFF/);
    assert.deepEqual(unit, before, 'route prevalidation cannot clobber the current order');
    context.walkableComponents[1] = 0; order();
    buildings[0].complete = false;
    context.updateWorkerEconomy();
    assert.equal(unit.cargo, 0.5); assert.equal(context.teamFood[team], 0);
    assert.equal(unit.moveGoalCell, -1);
    buildings[0].complete = true; context.navigationRevision++;
    context.updateWorkerEconomy();
    assert.equal(unit.cargo, 0.5, 'rerouting does not credit before arrival');
    context.updateWorkerEconomy();
    assert.equal(context.teamFood[team], 0.5); assert.equal(unit.cargo, 0);
  });
}

test('Return cargo control sends only living friendly carrying workers with generation metadata', () => {
  const sent = [], status = [];
  const context = vm.createContext({ ...economyServerBindings(), ...browserRecoveryBindings(), localTeam: 0, matchWinner: -1, currentOrderToken: 100,
    selected: new Set([0, 1, 2, 3, 4]), persistentTargetMode: 'follow',
    units: [worker(0), worker(1), worker(0, { hp: 0 }), worker(0, { cargo: 0 }), worker(0, { kind: 'infantry' })],
    socket: { readyState: 1, send: text => sent.push(JSON.parse(text)) }, WebSocket: { OPEN: 1 },
    TextEncoder, showToast: message => status.push(message), audio: { playEvent() {} },
    setTapOrderArmed() {}, setAttackMoveMode() {},
    finishOrderStatus: (...args) => status.push(args),
  });
  context.sendTrackedOrder = command => context.sendCommand({ ...command, clientOrderToken: 100 });
  // issueReturnCargo sits before top-level event listeners; exclude those from this harness.
  const issue = client.slice(client.indexOf('function issueReturnCargo('), client.indexOf("for (const button of document.querySelectorAll('[data-return-cargo]'))"));
  vm.runInContext([fn(client, 'selectedIds'), fn(client, 'sendCommand'), issue, fn(client, 'applyOrderNotice')].join('\n'), context);
  context.issueReturnCargo();
  assert.deepEqual(sent, [{ type: 'returnCargo', ids: [0], clientOrderToken: 100, unitGenerations: [3] }]);
  assert.equal(context.persistentTargetMode, null);
  context.applyOrderNotice(100, 'RETURN CARGO ORDER · 1 WORKERS');
  assert.deepEqual(status.at(-1), [100, 'RETURN CARGO ORDER · 1 WORKERS', 'applied']);
  context.localTeam = null; context.issueReturnCargo(); assert.equal(sent.length, 1);
  context.localTeam = 0; context.matchWinner = 0; context.issueReturnCargo(); assert.equal(sent.length, 1);
});
