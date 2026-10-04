import assert from 'node:assert/strict';
import test from 'node:test';
import { frontierBuildingPreviewUrl, frontierBuildingManifestUrl } from '../src/frontier-building-preview.mjs';

const families = ['town-center', 'house', 'storehouse', 'stable', 'workshop', 'watchtower', 'barracks', 'archery-range', 'mill', 'farm', 'dock'];

test('ordinary match URLs bind all eleven authored families without a preview flag', () => {
  for (const mode of [undefined, null, '']) {
    for (const type of families) assert.equal(frontierBuildingManifestUrl(type, mode), frontierBuildingPreviewUrl(type, '1'));
    for (const type of ['palisade', 'palisade-gate', 'constructor']) {
      assert.equal(frontierBuildingManifestUrl(type, mode), null);
    }
  }
  for (const type of families) assert.equal(frontierBuildingManifestUrl(type, '0'), null, 'explicit comparison opt-out remains available');
});

test('the named Town Center preview never requests another family', () => {
  const url = frontierBuildingPreviewUrl('town-center', 'town-center');
  assert.ok(url.endsWith('/frontier-civilization-scale-pilot-v1/town-center-complete-renderer.json'));
  for (const type of [...families.slice(1), 'barracks', 'archery-range']) {
    assert.equal(frontierBuildingPreviewUrl(type, 'town-center'), null);
  }
});

test('default, disabled and unknown previews leave all buildings on existing art', () => {
  for (const mode of [undefined, null, '', '0', 'true', '../town-center', 'constructor']) {
    for (const type of [...families, 'barracks', 'archery-range', 'constructor']) {
      assert.equal(frontierBuildingPreviewUrl(type, mode), null);
    }
  }
});

test('full-checkout comparison and other named previews retain their bindings', () => {
  for (const type of families) {
    const url = frontierBuildingPreviewUrl(type, '1');
    assert.ok(url.endsWith(`/${type}-complete-renderer.json`));
    assert.equal(frontierBuildingPreviewUrl(type, type), url);
    assert.equal(frontierBuildingPreviewUrl(type, 'other'), null);
  }
  for (const type of ['constructor', '../house']) {
    assert.equal(frontierBuildingPreviewUrl(type, '1'), null);
  }
});
