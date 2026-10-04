import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { ROTATABLE_BUILDINGS } from '../src/building-orientation.mjs';
import { createBuildingPlacementPreview } from '../src/building-placement-preview.mjs';
import { createCapturedBuildingSprite, updateCapturedBuildingSprite, disposeCapturedBuildingSprite } from '../src/captured-building-art.mjs';
import { frontierBuildingManifestUrl } from '../src/frontier-building-preview.mjs';
import { buildingSpriteUrl } from '../src/building-sprites.mjs';

test('all approved final images share exact facing/scale/anchor/texture with their translucent placement preview', async () => {
  const previous = { fetch: globalThis.fetch, Image: globalThis.Image, document: globalThis.document };
  globalThis.fetch = async url => new Response(await readFile(fileURLToPath(url)));
  globalThis.Image = class { width = 1024; height = 1024; naturalWidth = 1024; naturalHeight = 1024; async decode() {} };
  globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {} }) }) };
  const camera = new THREE.OrthographicCamera(-20, 20, 20, -20, .1, 300);
  camera.position.set(80, 112, 80); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const preview = createBuildingPlacementPreview(), finals = [];
  const settle = async check => {
    for (let i = 0; i < 1000; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 1)); }
    assert.fail('verified final image did not settle');
  };
  try {
    for (const teamColor of [0x5aa7d7, 0xdb8664]) for (const type of ROTATABLE_BUILDINGS) for (let orientation = 0; orientation < 4; orientation++) {
      const placement = { x: -10.5, z: 10.5, valid: true };
      preview.update({ type, size: type === 'town-center' ? 5 : 3, orientation, teamColor, camera, placement, height: 1.6 });
      const final = createCapturedBuildingSprite({ manifestUrl: frontierBuildingManifestUrl(type), teamColor });
      const group = new THREE.Group(); group.position.copy(preview.group.position); group.add(final); finals.push(final);
      updateCapturedBuildingSprite(final, camera, { complete: true, hp: 100, maxHp: 100, orientation });
      await settle(() => preview.sprite.visible && final.visible);
      assert.equal(preview.sprite.userData.capturedBuildingArt.requestKey.split(':')[1], String((1 - orientation * 2 + 8) % 8));
      assert.equal(preview.sprite.material.map, final.material.map, 'same verified image lease');
      assert.deepEqual(preview.sprite.scale.toArray(), final.scale.toArray());
      assert.deepEqual(preview.sprite.center.toArray(), final.center.toArray());
      assert.deepEqual(preview.sprite.position.toArray(), final.position.toArray());
      assert.deepEqual(preview.group.position.toArray(), [-10.5, 1.6, 10.5]);
      assert.deepEqual(preview.group.scale.toArray(), [1, 1, 1], 'do not stretch the 5-cell civic image');
      assert.equal(preview.sprite.material.opacity, 0.5);
      assert.equal(preview.sprite.material.depthWrite, false);
      assert.equal(preview.sprite.userData.capturedBuildingArt.bodyDepth.visible, false, 'ghost cannot occlude real units');
      assert.equal(final.userData.capturedBuildingArt.bodyDepth.visible, true);
      const hits = []; preview.sprite.raycast(null, hits); assert.deepEqual(hits, [], 'preview cannot become a selection target');
      const texture = final.material.map;
      preview.update({ type, size: type === 'town-center' ? 5 : 3, orientation, teamColor, camera, placement: { ...placement, valid: false }, height: 1.6 });
      assert.equal(preview.footprint.material.color.getHex(), 0xe7836d);
      assert.equal(preview.sprite.material.map, texture, 'blocked state keeps the truthful final asset');
      disposeCapturedBuildingSprite(final); finals.pop();
    }
    preview.reset(); assert.equal(preview.group.visible, false); assert.equal(preview.sprite, null);
    preview.update({ type: 'house', size: 3, orientation: 1, camera, placement: { x: 0.5, z: 0.5, valid: true }, height: 0 });
    const canceled = preview.sprite; preview.reset(); await new Promise(setImmediate);
    assert.equal(canceled.visible, false); assert.equal(canceled.userData.capturedBuildingArt.disposed, true);
    assert.equal(preview.group.visible, false);
    preview.update({ type: 'farm', size: 3, orientation: 0, camera, placement: { x: 0.5, z: 0.5, valid: true }, height: 0 });
    assert.equal(preview.sprite, null, 'no invented final art for a family without an approved pack');
    assert.equal(preview.entrance.visible, false);
    for (const type of ['barracks', 'archery-range']) {
      assert.equal(buildingSpriteUrl({ type, team: 0, complete: false, orientation: 1 }), null, 'single-view fallback must yield to rotated construction geometry');
      assert.ok(buildingSpriteUrl({ type, team: 0, complete: false, orientation: 0 }));
    }
  } finally {
    preview.dispose(); for (const final of finals) disposeCapturedBuildingSprite(final);
    Object.assign(globalThis, previous);
  }
});
