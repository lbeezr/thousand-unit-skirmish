import assert from 'node:assert/strict';
import test from 'node:test';
import { UNIT_DEFINITIONS, BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { unitPresentation, UNIT_PRESENTATION_PROFILES, validateUnitPresentationBindings, buildingPresentation, BUILDING_PRESENTATION_PROFILES, validateBuildingPresentationBindings } from '../src/gameplay-presentation.mjs';

test('current roster resolves declared procedural appearances without changing rules', () => {
  const rules = JSON.stringify(UNIT_DEFINITIONS);
  for (const kind of Object.keys(UNIT_DEFINITIONS)) {
    assert.equal(unitPresentation(kind), UNIT_PRESENTATION_PROFILES[UNIT_DEFINITIONS[kind].presentation]);
    assert.ok(Object.isFrozen(unitPresentation(kind)));
  }
  assert.equal(JSON.stringify(UNIT_DEFINITIONS), rules);
  const variant = { soldier: { presentation: 'unit.archer' } };
  assert.equal(validateUnitPresentationBindings(variant), UNIT_PRESENTATION_PROFILES);
});
test('missing bindings and unsupported animation backends fail usefully', () => {
  assert.throws(() => validateUnitPresentationBindings({ soldier: { presentation: 'missing' } }), /missing: soldier/);
  assert.throws(() => validateUnitPresentationBindings({ soldier: { presentation: 'animated' } }, {
    animated: { backend: 'skeletal', role: 'infantry' },
  }), /Unsupported presentation binding animated: soldier/);
  assert.throws(() => unitPresentation('missing'), /Unknown unit presentation/);
  assert.throws(() => validateUnitPresentationBindings({ soldier: { presentation: 'invalid' } }, {
    invalid: { backend: 'procedural', role: 'infantry', headTint: 0, bodyTint: 0, bodyTintWeight: NaN },
  }), /Invalid presentation colors/);
});

test('building profiles support content variants with explicit renderer capabilities', () => {
  for (const [id, definition] of Object.entries(BUILDING_DEFINITIONS)) {
    assert.equal(buildingPresentation(id), BUILDING_PRESENTATION_PROFILES[definition.presentation]);
  }
  assert.equal(validateBuildingPresentationBindings({ storehouse: { presentation: 'building.house' } }), BUILDING_PRESENTATION_PROFILES);
  assert.throws(() => validateBuildingPresentationBindings({ tower: { presentation: 'missing' } }), /Unsupported building presentation/);
  assert.throws(() => buildingPresentation('missing'), /Unknown building presentation/);
});
