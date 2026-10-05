import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createNeutralWildlifeRenderer } from '../src/neutral-wildlife-renderer.mjs';
import { decodeRgba8 } from './sprite-pixel-bounds.mjs';
import { wildlifeControlsFixture, controlsState, visibilityFor } from './wildlife-client-controls-fixture.mjs';

const root = new URL('../assets/wildlife/bellweather-sheep-static-v1/', import.meta.url);
const atlas = decodeRgba8(await readFile(new URL('sheep-atlas-runtime.png', root)));

// Decode the approved public PNG for CPU input/geometry checks. No GPU frame.
function publicArtLoader(t) {
  const originals = { fetch: globalThis.fetch, Image: globalThis.Image, OffscreenCanvas: globalThis.OffscreenCanvas };
  globalThis.fetch = async input => {
    const url = new URL(input);
    if (url.protocol === 'blob:') return originals.fetch(url);
    assert.ok(url.href.startsWith(root.href));
    return new Response(await readFile(url));
  };
  globalThis.Image = class {
    async decode() { this.width = atlas.width; this.height = atlas.height; }
  };
  globalThis.OffscreenCanvas = class {
    getContext() {
      let pixel;
      return { clearRect() {}, drawImage(_image, x, y) {
        pixel = atlas.pixels.slice((y * atlas.width + x) * 4, (y * atlas.width + x + 1) * 4);
      }, getImageData() { return { data: pixel }; } };
    }
  };
  t.after(() => Object.assign(globalThis, originals));
}

for (const team of [0, 1]) test(`seat ${team}: approved Sheep body clicks beyond the root radius inspect and gather at ordinary maximum zoom`, async t => {
  publicArtLoader(t);
  const f = await wildlifeControlsFixture(team); t.after(() => f.close());
  const renderer = createNeutralWildlifeRenderer({ THREE, scene: f.w.scene, groundHeight: () => 0 });
  t.after(() => renderer.dispose());
  renderer.reset(f.map.resourceNodes, f.map); await renderer.ready();
  f.w.wildlifeRenderer = renderer;
  const node = f.map.resourceNodes[team];
  const rect = { left: 40, top: 20, width: 2560, height: 1440 };
  f.canvas.getBoundingClientRect = () => rect;
  const camera = f.w.camera;
  camera.left = -43 * rect.width / rect.height / 2; camera.right = -camera.left;
  camera.top = 43 / 2; camera.bottom = -camera.top; camera.zoom = 2.3;
  camera.position.set(node.x + 4.9618, 7.1247, node.z + 4.9618); camera.up.set(0, 1, 0);
  camera.lookAt(node.x, 0, node.z); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const screen = point => {
    const p = point.clone().project(camera);
    return { x: rect.left + (p.x * .5 + .5) * rect.width, y: rect.top + (-p.y * .5 + .5) * rect.height };
  };
  const click = point => {
    f.pointer(f.canvas, 'pointerdown', point); f.pointer(f.canvas, 'pointerup', point);
  };
  f.receive(controlsState(f.map));
  renderer.update(camera);
  assert.equal(renderer.diagnostics().artStatus, 'ready');
  const group = f.w.scene.children.find(item => item.userData.wildlifeNodeId === node.id && item.children.length === 3);
  const mesh = group.children[2]; group.updateWorldMatrix(true, true);
  const uv = mesh.geometry.getAttribute('uv'), pivot = screen(new THREE.Vector3(node.x, .22, node.z));
  // Choose an actual opaque source pixel, farthest from the current root.
  let body, distance = 0;
  for (let y = 0; y < 512; y += 4) for (let x = 0; x < 512; x += 4) {
    const u = uv.getX(0) + (uv.getX(1) - uv.getX(0)) * (x + .5) / 512;
    const v = uv.getY(0) + (uv.getY(2) - uv.getY(0)) * (y + .5) / 512;
    if (atlas.pixels[(Math.floor(v * atlas.height) * atlas.width + Math.floor(u * atlas.width)) * 4 + 3] < 240) continue;
    const point = screen(mesh.localToWorld(new THREE.Vector3((x + .5) / 512 - .5, .5 - (y + .5) / 512, 0)));
    const d = Math.hypot(point.x - pivot.x, point.y - pivot.y);
    if (d > distance) { body = point; distance = d; }
  }
  assert.ok(distance > 26, 'approved body pixel lies outside the production root radius at supported zoom');
  click(body);
  assert.equal(f.w.selectedWildlifeId, node.id, 'body click selects the actual owned Sheep');
  assert.match(f.w.document.querySelector('[data-context-summary]').textContent, /100 food · Herd/);
  for (const owner of [null, 1 - team]) {
    const state = controlsState(f.map);
    state.resourceNodes[team].wildlifeTeam = owner;
    f.receive(state); click(body); assert.equal(f.w.selectedWildlifeId, null, 'body inspection cannot claim a foreign/neutral live Sheep');
  }
  f.receive(controlsState(f.map));
  // The transparent canvas gutter must not make a much larger clickable square.
  const gutter = screen(mesh.localToWorld(new THREE.Vector3(-.49, .49, 0)));
  click(gutter); assert.equal(f.w.selectedWildlifeId, null);
  f.w.selectWorkers();
  const worker = f.w.teamUnits[team].find(unit => unit.kind === 'worker');
  const count = f.sent.length;
  f.pointer(f.canvas, 'pointerdown', { ...body, button: 2 });
  assert.equal(f.sent.length, count + 1);
  assert.equal(f.sent.at(-1).type, 'gather'); assert.equal(f.sent.at(-1).nodeId, node.id);
  assert.deepEqual(f.sent.at(-1).ids, [worker.id]);
  const relocated = controlsState(f.map);
  relocated.resourceNodes[team].x += 4;
  f.receive(relocated); click(body);
  assert.equal(f.w.selectedWildlifeId, null, 'a snapshot arriving before a render frame cannot pick the vacated body');
  f.receive(controlsState(f.map, { visibility: visibilityFor(f.map, [node]) }));
  click(body); assert.equal(f.w.selectedWildlifeId, null, 'fog hides the current body immediately');
  for (const hidden of [[], controlsState(f.map).resourceNodes.map(row => ({ ...row, stock: 0, wildlifeState: 'depleted', wildlifeActivity: undefined }))]) {
    f.receive(controlsState(f.map, { resourceNodes: hidden }));
    click(body); assert.equal(f.w.selectedWildlifeId, null);
  }
});
