import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {decodeRgba8, measureFrameAlpha} from './sprite-pixel-bounds.mjs';
import {createCapturedBuildingSprite, disposeCapturedBuildingSprite} from '../src/captured-building-art.mjs';

// Decode the admitted art and exercise the runtime alpha raycast. No WebGL/game-frame claim.
test('all 80 military state frames retain padded alpha and pick visible pixels at three zooms', async () => {
  const root = new URL('../assets/buildings/frontier-civilization-military-models-v1/', import.meta.url);
  const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, .1, 20);
  camera.position.set(0, 0, 5); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const ray = new THREE.Raycaster();
  let frames = 0;
  for (const family of ['barracks', 'archery-range']) {
    const manifest = JSON.parse(await readFile(new URL(`${family}-complete-renderer.json`, root)));
    assert.deepEqual(manifest.stateOrder, ['foundation', 'frame', 'complete', 'damaged', 'critical']);
    for (const state of [manifest.completeState, ...manifest.states]) for (const view of state.views) {
      const bytes = await readFile(new URL(view.path, root));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), view.sha256);
      const image = decodeRgba8(bytes), bounds = measureFrameAlpha(image, {x: 0, y: 0, width: 1024, height: 1024});
      assert.ok(bounds && bounds.x > 1 && bounds.y > 1 && bounds.x + bounds.width < 1023 && bounds.y + bounds.height < 1023);
      const opaque = image.pixels.findIndex((value, index) => index % 4 === 3 && value === 255);
      assert.ok(opaque >= 0);
      const pixel = Math.floor(opaque / 4), column = pixel % image.width, row = Math.floor(pixel / image.width);
      const sprite = createCapturedBuildingSprite();
      const texture = new THREE.Texture({data: image.pixels, width: image.width, height: image.height});
      sprite.material.map = texture; sprite.visible = true; sprite.scale.set(8, 8, 1); sprite.updateMatrixWorld();
      try {
        for (const zoom of [.5, 1, 2]) {
          camera.zoom = zoom; camera.updateProjectionMatrix();
          for (const [x, y, expected] of [[column, row, 1], [0, 0, 0]]) {
            const target = new THREE.Vector3((x + .5) / 1024 * 8 - 4, 4 - (y + .5) / 1024 * 8, 0).project(camera);
            ray.setFromCamera(new THREE.Vector2(target.x, target.y), camera);
            const hits = []; sprite.raycast(ray, hits);
            assert.equal(hits.length, expected, `${family}/${state.state}/${view.index}: zoom ${zoom}, pixel ${x},${y}`);
          }
        }
      } finally {texture.dispose(); disposeCapturedBuildingSprite(sprite);}
      frames++;
    }
  }
  assert.equal(frames, 80);
});
