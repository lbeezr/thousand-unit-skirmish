import test from 'node:test';
import assert from 'node:assert/strict';
import { observeWorkerPatrolAcquired } from './worker-patrol-acquired-clearance.mjs';
import { workerPatrolAcquiredMovementActive } from '../src/combat-movement.mjs';
import { activeLandMovementBodyRadius } from '../src/unit-movement.mjs';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { constructionMovementActive } from '../src/construction-work-intent.mjs';
import { LAND_CLEARANCE_PROFILE } from '../src/unit-movement.mjs';

const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const radiusStart = source.indexOf('function workerLocalBodyRadius(');
const radiusEnd = source.indexOf('\nfunction ', radiusStart + 1);
assert.ok(radiusStart >= 0 && radiusEnd > radiusStart);
const radiusContext = vm.createContext({ constructionMovementActive, workerPatrolAcquiredMovementActive,
  LAND_CLEARANCE_PROFILE });
vm.runInContext(source.slice(radiusStart, radiusEnd), radiusContext);

test('Worker acquired Patrol body excludes replaced intent, productive work and other combat callers', () => {
  const unit = { kind: 'worker', hp: 100, attackMove: true, persistentOrder: { type: 'patrol' },
    attackTargetId: 0, attackBuildingTargetId: -1, gatherNodeId: null, gatherForestCell: -1,
    buildingTargetId: null, cargo: .5, cargoType: 'food' };
  assert.equal(workerPatrolAcquiredMovementActive(unit), true);
  assert.equal(activeLandMovementBodyRadius(unit), .18);
  assert.equal(radiusContext.workerLocalBodyRadius(unit), .18, 'shared selection/admission seam consumes acquired Patrol');
  for (const override of [{ kind: 'infantry' }, { kind: 'sheep' }, { kind: 'skiff' }, { hp: 0 },
    { movementDomain: 'water' }, { holdingPosition: true }, { attackMove: false },
    { persistentOrder: null }, { persistentOrder: { type: 'follow' } },
    { attackTargetId: -1 }, { attackTargetId: 1.5 }, { attackTargetId: '0' },
    { attackBuildingTargetId: 0 }, { stanceCombat: true }, { stanceReturning: true },
    { gatherNodeId: 'food' }, { gatherForestCell: 0 }, { gatherPhase: 'to-base' }, { buildingTargetId: 0 }]) {
    assert.equal(workerPatrolAcquiredMovementActive({ ...unit, ...override }), false, JSON.stringify(override));
    // Construction remains its original independent activation term.
    const other = { ...unit, ...override };
    assert.equal(radiusContext.workerLocalBodyRadius(other), constructionMovementActive(other) ? .18 : 0,
      JSON.stringify(override));
  }
  assert.equal(activeLandMovementBodyRadius({ ...unit, persistentOrder: null }), 0,
    'direct acquired Worker AttackMove retains its separate contract');
});

for (const team of [0,1]) for (const ending of ['kill','loss'])
for (const planningTurns of [0,1]) for (const cold of [false,true]) {
  test(`seat ${team}, mode ${planningTurns}, cold ${cold}: acquired Worker Patrol ${ending} preserves policy and admits only clear substeps`, async () => {
    const result = await observeWorkerPatrolAcquired({ team, ending, planningTurns, nearStone: true, cold });
    assert.equal(result.unsafeSteps, 0, 'actual acquired substeps must respect the Worker static body');
    assert.equal(result.admissionRejectedSteps, 0);
    assert.equal(result.newContacts, 0);
    assert.deepEqual(result.acquiredBodyRadii, [.18]);
    assert.ok(result.acquiredRejoins > 0, 'actual acquired publisher/repath consumes the shared selected-route rejoin');
  });
}

for (const team of [0,1]) for (const ending of ['stop', 'holdPosition', 'move', 'queuedMove']) {
  test(`seat ${team}: ${ending} replaces acquired Worker Patrol through fresh recovery`, async () => {
    const result = await observeWorkerPatrolAcquired({ team, ending, nearStone: true, cold: true });
    assert.equal(result.unsafeSteps, 0); assert.equal(result.newContacts, 0);
    assert.deepEqual(result.acquiredBodyRadii, [.18]);
  });
}
