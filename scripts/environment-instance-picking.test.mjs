import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';
import { createEnvironmentInstancePicker, imageAlphaPixels } from '../src/environment-instance-picking.mjs';
import { groundHeight, setActiveTerrain } from '../src/terrain-height.mjs';
import { resourceVisualStage, RESOURCE_VISUAL_STAGES } from '../src/resource-visual-state.mjs';
import { CAMERA_VIEW_DIRECTION } from '../src/camera-controls.mjs';
import { decodeRgba8 } from './sprite-pixel-bounds.mjs';

const root = new URL('../', import.meta.url);
const main = await readFile(new URL('src/main.js', root), 'utf8');
function functionSource(name) {
  const start = main.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return main.slice(start, main.indexOf('\n}', start + 1) + 2);
}
const picker = createEnvironmentInstancePicker();
function image(width, height, alphaAt = () => 255) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data[(y * width + x) * 4 + 3] = alphaAt(x, y);
  return { width, height, data };
}
function quad(pixels, z = 0) {
  const map = new THREE.Texture(pixels);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide, transparent: true, alphaTest: .08 });
  const mesh = new THREE.InstancedMesh(geometry, material, 1);
  mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 0, z));
  return mesh;
}
function rayAt(x = 0, y = 0) { return new THREE.Raycaster(new THREE.Vector3(x, y, 5), new THREE.Vector3(0, 0, -1)); }

test('visible alpha chooses the foreground tree identity, transparent pixels expose the tree behind', () => {
  const back = { forestCell: 12, mesh: quad(image(8, 8)), index: 0 };
  const front = { node: { id: 'existing-wood' }, mesh: quad(image(8, 8, x => x < 4 ? 0 : 255), 1), index: 0 };
  assert.equal(picker(rayAt(-.5), [back, front]), back);
  assert.equal(picker(rayAt(.5), [back, front]), front);
  assert.equal(picker(rayAt(2), [back, front]), null);
  assert.equal(front.node.id, 'existing-wood');
});

test('inactive, hidden, invalid and camera-clipped instances are not harvestable art', () => {
  const mesh = quad(image(2, 2)), candidate = { forestCell: 0, mesh, index: 0 };
  assert.equal(picker(rayAt(), [candidate]), candidate);
  for (const index of [-1, 1, .5]) assert.equal(picker(rayAt(), [{ ...candidate, index }]), null);
  mesh.setMatrixAt(0, new THREE.Matrix4().makeScale(0, 0, 0));
  assert.equal(picker(rayAt(), [candidate]), null);
  mesh.setMatrixAt(0, new THREE.Matrix4());
  const parent = new THREE.Group(); parent.add(mesh); parent.visible = false;
  assert.equal(picker(rayAt(), [candidate]), null);
  parent.visible = true; mesh.material.visible = false;
  assert.equal(picker(rayAt(), [candidate]), null);
  mesh.material.visible = true;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 3);
  camera.position.z = 5; camera.updateMatrixWorld();
  const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(), camera);
  assert.equal(picker(ray, [candidate]), null, 'geometry behind far plane must not win');
});

for (const attribute of ['environmentAtlasRect', 'resourceViewRect', 'plantViewRect']) {
  test(`${attribute} samples the current instanced cell, including horizontal flips`, () => {
    const mesh = quad(image(8, 8, (x, y) => x >= 4 && y < 4 ? 255 : 0));
    const rect = new THREE.InstancedBufferAttribute(new Float32Array([.5, .5, .5, .5]), 4);
    mesh.geometry.setAttribute(attribute, rect);
    const candidate = { forestCell: 17, mesh, index: 0 };
    assert.equal(picker(rayAt(), [candidate]), candidate);
    mesh.setMatrixAt(0, new THREE.Matrix4().makeScale(-1, 1, 1));
    assert.equal(picker(rayAt(.4), [candidate]), candidate);
    rect.setXYZW(0, 0, 0, .5, .5);
    assert.equal(picker(rayAt(), [candidate]), null, 'a different lifecycle atlas cell has different alpha');
  });
}

test('stock atlas map offset/repeat, alphaTest, replacement image and parent transforms are current', () => {
  const mesh = quad(image(8, 8, x => x >= 4 ? 255 : 0));
  const candidate = { forestCell: 2, mesh, index: 0 };
  mesh.material.map.repeat.set(.5, 1); mesh.material.map.offset.set(.5, 0);
  assert.equal(picker(rayAt(), [candidate]), candidate);
  mesh.material.map.offset.x = 0;
  assert.equal(picker(rayAt(), [candidate]), null);
  mesh.material.map.image = image(8, 8, () => 15);
  assert.equal(picker(rayAt(), [candidate]), null);
  mesh.material.map.image = image(8, 8);
  const parent = new THREE.Group(); parent.position.x = 3; parent.add(mesh);
  assert.equal(picker(rayAt(), [candidate]), null);
  assert.equal(picker(rayAt(3), [candidate]), candidate);
  const unloaded = { width: 8, height: 8, complete: false };
  assert.equal(imageAlphaPixels(unloaded), null);
  mesh.material.map.image = unloaded;
  assert.equal(picker(rayAt(3), [candidate]), null);
});

test('canonical actual crown pixels issue existing forest/node Gather IDs and respect stock, fog and map lifetime', async () => {
  const previous = { fetch: globalThis.fetch, document: globalThis.document, Image: globalThis.Image, location: globalThis.location, warn: console.warn };
  class ImageMock {
    width = 640; height = 640; listeners = new Map();
    addEventListener(name, fn) { this.listeners.set(name, fn); }
    removeEventListener(name) { this.listeners.delete(name); }
    set src(value) { this.url = String(value); queueMicrotask(() => this.listeners.get('load')?.call(this)); }
  }
  globalThis.document = { createElementNS() { return new ImageMock(); } };
  globalThis.Image = ImageMock;
  globalThis.location = { search: '' };
  globalThis.fetch = async url => {
    try { return new Response(await readFile(new URL(url, root))); }
    catch { return new Response('', { status: 404 }); }
  };
  console.warn = () => {};
  try {
    const art = await import('../src/environment-art.mjs');
    await art.resourceStateAssetsReady;
    const definition = JSON.parse(await readFile(new URL('maps/veyrholds-terraced-vale.json', root)));
    const originalMap = JSON.stringify(definition);
    setActiveTerrain(definition);
    const objects = [], slots = art.addObstacleEnvironmentSprites(definition, 80, 80, mesh => objects.push(mesh));
    const cells = new Set();
    for (const block of definition.obstacles.filter(o => o.material === 'forest')) {
      for (let row = block.row; row < block.row + block.height; row++) for (let col = block.column; col < block.column + block.width; col++) cells.add(row * 160 + col);
    }
    assert.equal(cells.size, 3162); assert.equal(slots.size, cells.size);
    assert.deepEqual(new Set(slots.keys()), cells, 'all canonical families already have exactly one authoritative cell');
    const families = [...new Set([...slots.values()].map(slot => slot.family))].sort();
    assert.deepEqual(families, ['field-maple', 'hazel-thicket', 'oak', 'silver-birch', 'veyrholds-highpine']);
    assert.equal(objects.filter(o => o.userData.forestUnderstory).length, 2, 'decorative ridge grass/suncrest have no independent resource ID');
    const camera = new THREE.OrthographicCamera(-43 * 1280 / 720 / 2, 43 * 1280 / 720 / 2, 43 / 2, -43 / 2, .1, 300);
    const renderer = { domElement: { getBoundingClientRect: () => ({ left: 11, top: 23, width: 1280, height: 720 }) } };
    const commands = [], latestForestStocks = new Map(), latestResourceStocks = new Map();
    const context = vm.createContext({ THREE, camera, renderer, raycaster: new THREE.Raycaster(), pointerNdc: new THREE.Vector2(),
      screenPoint: new THREE.Vector3(), groundHeight, localTeam: 0, forestTreeSlots: new Map(), latestForestStocks, latestResourceStocks,
      mapDefinition: { ...definition, fogOfWar: false }, latestFogCells: new Uint8Array(160 * 160).fill(2),
      MAP_WIDTH: 160, MAP_HEIGHT: 160, resourceVisualStage, pickEnvironmentInstance: picker,
      woodTreeMeshes: new Map(), woodTreeNodeStages: new Map(), woodTreeNodeSlots: new Map(),
      selectedWildlifeId: null, selectedBuildingId: null, selectedWaterUnits: () => false,
      persistentTargetMode: null, attackMoveMode: false, pickAt: () => null, pickBuildingAt: () => null,
      selectedWorkerIds: () => ['worker-1'], selectedIds: () => ['worker-1'], units: { 'worker-1': { kind: 'worker' } },
      BUILDING_DEFINITIONS: {}, setAttackMoveMode() {}, showToast() {},
      sendTrackedOrder: command => { commands.push(JSON.parse(JSON.stringify(command))); return true; },
      pickResourceNodeAt: () => null, worldAt: () => ({ x: 0, z: 0 }), issueMove: () => commands.push({ type: 'move' }),
    });
    for (const name of ['pickForestCellAt', 'pickHarvestableTreeAt', 'issueForestGather', 'issueGather', 'issueContextOrder']) vm.runInContext(functionSource(name), context);
    const samples = [], matrix = new THREE.Matrix4();
    for (const family of families) {
      const [cell, slot] = [...slots].find(([, entry]) => entry.family === family);
      const file = family === 'veyrholds-highpine' ? 'frontier-v1/veyrholds-lifecycle-atlas.png'
        : family === 'oak' ? `frontier-meshy-fixed-camera-v3/oak/references/frames/color/view-${slot.mesh.material.map.image.url.match(/oak-(\d+)/)?.[1] || '00'}.png`
          : `frontier-v1/${family}.png`;
      const decoded = decodeRgba8(await readFile(new URL(`assets/environment/${file}`, root)));
      const pixels = { width: decoded.width, height: decoded.height, data: decoded.pixels };
      slot.mesh.material.map.image = pixels;
      const rect = slot.mesh.geometry.getAttribute('environmentAtlasRect') || slot.mesh.geometry.getAttribute('resourceViewRect');
      const uvRect = rect ? [rect.getX(slot.index), rect.getY(slot.index), rect.getZ(slot.index), rect.getW(slot.index)] : [0, 0, 1, 1];
      let u, v;
      // Find an actual opaque upper-crown texel; geometry corners are often transparent.
      for (let y = 0; y < decoded.height && u === undefined; y++) for (let x = 0; x < decoded.width; x++) {
        if (decoded.pixels[(y * decoded.width + x) * 4 + 3] < 240) continue;
        const candidateU = ((x + .5) / decoded.width - uvRect[0]) / uvRect[2];
        const candidateV = (1 - (y + .5) / decoded.height - uvRect[1]) / uvRect[3];
        if (candidateU > .2 && candidateU < .8 && candidateV > (family === 'oak' ? .45 : .72) && candidateV < .94) { u = candidateU; v = candidateV; break; }
      }
      assert.ok(u !== undefined, `${family} actual opaque crown pixel`);
      const position = slot.mesh.geometry.attributes.position, uv = slot.mesh.geometry.attributes.uv;
      const local = new THREE.Vector3();
      // PlaneGeometry is affine in UV even when its root registration is translated.
      const p00 = new THREE.Vector3(), du = new THREE.Vector3(), dv = new THREE.Vector3();
      const i00 = [...Array(uv.count).keys()].find(i => uv.getX(i) === 0 && uv.getY(i) === 0);
      const i10 = [...Array(uv.count).keys()].find(i => uv.getX(i) === 1 && uv.getY(i) === 0);
      const i01 = [...Array(uv.count).keys()].find(i => uv.getX(i) === 0 && uv.getY(i) === 1);
      p00.fromBufferAttribute(position, i00); du.fromBufferAttribute(position, i10).sub(p00); dv.fromBufferAttribute(position, i01).sub(p00);
      slot.mesh.getMatrixAt(slot.index, matrix); local.copy(p00).addScaledVector(du, u).addScaledVector(dv, v).applyMatrix4(matrix);
      const target = new THREE.Vector3(slot.x, groundHeight(slot.x, slot.z), slot.z);
      camera.position.copy(target).add(new THREE.Vector3(...CAMERA_VIEW_DIRECTION).normalize().multiplyScalar(110));
      camera.lookAt(target); camera.zoom = 3; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      context.forestTreeSlots = new Map([[cell, slot]]);
      const projected = local.clone().project(camera), x = (projected.x + 1) * 640, y = (1 - projected.y) * 360;
      const oldTarget = context.pickForestCellAt(x, y);
      assert.equal(context.pickHarvestableTreeAt(x, y)?.forestCell, cell, `${family} crown maps to its actual cell`);
      context.issueContextOrder(x + 11, y + 23);
      assert.deepEqual(commands.at(-1), { type: 'gather', ids: ['worker-1'], forestCell: cell });
      latestForestStocks.set(cell, 0);
      assert.equal(context.pickHarvestableTreeAt(x, y), null, 'depleted canopy cannot recreate stock');
      latestForestStocks.delete(cell); context.mapDefinition.fogOfWar = true; context.latestFogCells[cell] = 1;
      assert.equal(context.pickHarvestableTreeAt(x, y), null, 'remembered forest cannot expose current art target');
      context.latestFogCells[cell] = 2; context.mapDefinition.fogOfWar = false;
      // A rematch/map rebuild uses the new identity; cached alpha must not retain old IDs.
      context.forestTreeSlots = new Map([[cell + 1, slot]]);
      assert.equal(context.pickHarvestableTreeAt(x, y)?.forestCell, cell + 1);
      samples.push({ family, cell, x, y, oldTarget });
    }
    // Real ordinary-node factory and normal command path share nodeId, not forest wood.
    const node = definition.resourceNodes.find(n => n.type === 'wood');
    const trees = art.createWoodResourceInstances(definition, 'full', [{ x: node.x, z: node.z, scale: .85 }]);
    const decoded = decodeRgba8(await readFile(new URL('assets/environment/frontier-v1/veyrholds-lifecycle-atlas.png', root)));
    trees.material.map.image = { width: decoded.width, height: decoded.height, data: decoded.pixels };
    context.forestTreeSlots = new Map(); context.mapDefinition.resourceNodes = [node];
    context.woodTreeMeshes = new Map([['full', trees]]); context.woodTreeNodeStages = new Map([[node.id, 'full']]); context.woodTreeNodeSlots = new Map([[node.id, [{ index: 0 }]]]);
    camera.position.set(node.x + 62, groundHeight(node.x, node.z) + 88, node.z + 62); camera.lookAt(node.x, groundHeight(node.x, node.z), node.z); camera.updateMatrixWorld();
    let nodeHit;
    for (let y = 250; y < 440 && !nodeHit; y += 2) for (let x = 570; x < 710; x += 2) if (context.pickHarvestableTreeAt(x, y)?.node === node) { nodeHit = { x, y }; break; }
    assert.ok(nodeHit, 'actual regional wood node pixels');
    context.issueContextOrder(nodeHit.x + 11, nodeHit.y + 23);
    assert.deepEqual(commands.at(-1), { type: 'gather', ids: ['worker-1'], nodeId: node.id });
    latestResourceStocks.set(node.id, 0); assert.equal(context.pickHarvestableTreeAt(nodeHit.x, nodeHit.y), null);
    assert.equal(JSON.stringify(definition), originalMap, 'picking cannot change authored stock or resources');
    assert.equal(cells.size * 6, 18972);
    assert.equal(definition.resourceNodes.filter(n => n.type === 'wood').reduce((sum, n) => sum + n.stock, 0), 7950);
    assert.equal(RESOURCE_VISUAL_STAGES.length, 4);
    assert.equal(samples.length, 5);
    assert.ok(samples.filter(sample => sample.oldTarget === null).length >= 3, 'actual crown pixels reproduce root-circle misses; short thickets can remain within the old circle');
  } finally {
    for (const key of ['fetch', 'document', 'Image', 'location']) if (previous[key] === undefined) delete globalThis[key]; else globalThis[key] = previous[key];
    console.warn = previous.warn;
  }
});
