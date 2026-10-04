import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { runArmyAttackCase } from './army-attack-continuation-case.mjs';
import { runUnqueuedFogLossCase } from './army-attack-fog-case.mjs';
import { wildlifeClientBindings, wildlifeClientFunctionSource } from './wildlife-client-fixture-bindings.mjs';

for (const team of [0, 1]) {
  test(`seat ${team}: direct Attack loses fog target and engages only the nearby visible enemy`, async () => {
    await runUnqueuedFogLossCase(team);
  });
  for (const kind of ['infantry', 'archer']) for (const group of [1, 3]) for (const type of ['attack', 'attackMove']) {
    test(`seat ${team}: ${group} ${kind} ${type} kills two visible enemies without another click`, async () => {
      await runArmyAttackCase({ team, kind, group, type });
    });
  }
  for (const kind of ['infantry', 'archer']) test(`seat ${team}: ${kind} continues combat around a stone obstruction`, async () => {
    await runArmyAttackCase({ team, kind, obstacle: true });
  });
  for (const type of ['attack', 'attackMove']) for (const interrupt of ['stop', 'move']) {
    test(`seat ${team}: ${interrupt} replaces ${type} without resuming combat`, async () => {
      const result = await runArmyAttackCase({ team, type, interrupt });
      assert.equal(result.secondHit, null);
    });
  }
  test(`seat ${team}: held Archers reacquire within range and never move`, async () => {
    const result = await runArmyAttackCase({ team, type: 'holdPosition' });
    assert.deepEqual(result.targetHp, [0, 0]);
    assert.equal(result.attackers[0].x, (team ? 1 : -1) * 3.5);
    assert.equal(result.attackers[0].z, .5);
    assert.equal(result.attackers[0].attackMove, false);
  });
}

const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const clearSource = server.slice(server.indexOf('function clearAttackTarget('), server.indexOf('function processMovePlanningSlice('));
test('target loss preserves queued orders, held units and Workers; military without a queue continues locally', () => {
  for (const kind of ['infantry', 'archer', 'worker']) for (const held of [false, true]) for (const queued of [false, true]) {
    const unit = { kind, holdingPosition: held, x: 2.2, z: 3.3, attackTargetId: 9,
      attackBuildingTargetId: -1, attackMove: false, attackMoveRouteReady: false,
      path: [1, 2], pathIndex: 1, queuedWaypoints: queued ? [{ destination: 20, attackMove: false }] : [] };
    const context = vm.createContext({ unit, tickNumber: 45, dirty: false,
      unitHasCapability: () => true, nearestOpenCell: cell => cell, worldToCell: () => 17 });
    vm.runInContext(clearSource, context); context.clearAttackTarget(unit);
    assert.equal(unit.attackTargetId, -1);
    assert.equal(unit.attackBuildingTargetId, -1);
    assert.equal(unit.attackMove, kind !== 'worker' && !held && !queued);
    assert.equal(unit.queuedWaypoints.length, queued ? 1 : 0);
    assert.equal(unit.holdingPosition, held);
  }
});

const client = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
function slice(from, to) { return client.slice(client.indexOf(from), client.indexOf(to, client.indexOf(from) + from.length)); }
for (const team of [0, 1]) for (const control of ['keyboard', 'button']) for (const enemyClick of [false, true]) {
  test(`seat ${team}: ordinary ${control} attack-move arming and right-click ${enemyClick ? 'enemy' : 'ground'} emits an accepted order shape`, () => {
    const commands = [], handlers = {}, canvasHandlers = {}, enemy = { id: 9, team: 1 - team };
    const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0 }),
      addEventListener: (type, callback) => { canvasHandlers[type] = callback; } };
    const context = vm.createContext({ ...wildlifeClientBindings(), localTeam: team, matchWinner: -1, selectedBuildingId: null,
      attackMoveMode: false, persistentTargetMode: null, tapOrderArmed: false, buildPlacementActive: false,
      window: { addEventListener: (type, callback) => { handlers[type] = callback; }, matchMedia: () => ({ matches: false }) },
      document: { fullscreenElement: null }, appShell: {}, renderer: { domElement: canvas },
      ui: { formationSelect: { value: 'box' }, attackMoveToggle: { addEventListener: (type, cb) => { handlers[type] = cb; } } },
      moveMarker: { position: { set() {} }, material: { color: { setHex() {} } }, scale: { setScalar() {} } },
      moveMarkerAge: 0, selectedIds: () => [4, 5], selectedWaterUnits: () => false,
      sendTrackedOrder: command => { commands.push(JSON.parse(JSON.stringify(command))); return true; },
      showToast() {}, updateCommandUI() {}, groundHeight: () => 0,
      worldAt: () => ({ x: 6.5, z: .5 }), pickAt: () => enemyClick ? { unit: enemy } : null,
      pickBuildingAt: () => null, pickResourceNodeAt: () => null, pickForestCellAt: () => null,
      keyboardTargetIsEditing: () => false, wallPlacementKeydown: () => false,
      cameraNavigationKeydown: () => false, controlGroupIndexFromKey: () => null });
    vm.runInContext(wildlifeClientFunctionSource(client) + slice('function setAttackMoveMode(', 'function setTapOrderArmed(')
      + slice('function issueMove(', 'function issueBuildingRallyPoint(')
      + slice('function issueAttack(', 'function issueAttackBuilding(')
      + slice('function issueContextOrder(', 'function buildPlacementAt(')
      + slice("window.addEventListener('keydown', (event) => {\n  lastFriendlyUnitClick", "window.addEventListener('keydown', (event) => {\n  if (event.key === 'Shift')")
      + slice("renderer.domElement.addEventListener('pointerdown', (event) => {", "renderer.domElement.addEventListener('pointerleave'")
      + "ui.attackMoveToggle?.addEventListener('click', () => setAttackMoveMode(!attackMoveMode));", context);
    if (control === 'keyboard') handlers.keydown({ key: 'm', code: 'KeyM', preventDefault() {} });
    else handlers.click();
    assert.equal(context.attackMoveMode, true);
    canvasHandlers.pointerdown({ button: 2, clientX: 300, clientY: 200, shiftKey: false, preventDefault() {} });
    assert.deepEqual(commands, [enemyClick ? { type: 'attack', ids: [4, 5], targetId: 9 }
      : { type: 'attackMove', ids: [4, 5], x: 6.5, z: .5, formation: 'box' }]);
    assert.equal(context.attackMoveMode, false, 'arming is consumed after dispatch');
  });
}
