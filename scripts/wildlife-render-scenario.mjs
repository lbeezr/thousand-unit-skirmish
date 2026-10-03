import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { decodeRgba8 } from './sprite-pixel-bounds.mjs';
import { createNeutralWildlifeRenderer } from '../src/neutral-wildlife-renderer.mjs';
import { createStaticSheepRuntime } from '../src/sheep-static-preview.mjs';

// Real worker HTTP/WS paths and Three meshes; PNG decoding is CPU-only, not WebGL evidence.
const map = JSON.parse(await readFile(new URL('../docs/qa-evidence/sheep-eight-view-default-2026-10-03/game-map.json', import.meta.url)));
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 40_000 });
const OriginalImage = globalThis.Image;
let renderer;
try {
  await fixture.start();
  const base = `http://127.0.0.1:${fixture.port}/`;
  const approved = ['src/neutral-wildlife-renderer.mjs', 'src/wildlife-state.mjs', 'src/wildlife-motion.mjs', 'src/sheep-static-preview.mjs',
    'assets/wildlife/bellweather-sheep-static-v1/static-preview-binding.json',
    'assets/wildlife/bellweather-sheep-static-v1/sprite-atlas-pack-v1.json',
    'assets/wildlife/bellweather-sheep-static-v1/sheep-atlas-runtime.png'];
  for (const relative of approved) assert.equal((await fetch(new URL(relative, base))).status, 200, relative);
  for (const relative of ['source/sheep-yaw-000.png', 'source/sheep-yaw-315.png', 'source/capture-contract.json',
    'source-records.json', 'source-admission.json', 'sheep-atlas-source.png', 'original.glb']) {
    assert.equal((await fetch(new URL(`assets/wildlife/bellweather-sheep-static-v1/${relative}`, base))).status, 404, relative);
  }
  const main = await (await fetch(new URL('src/main.js', base))).text();
  assert.match(main, /import \{ createNeutralWildlifeRenderer \} from '\.\/neutral-wildlife-renderer\.mjs'/);
  assert.match(main, /wildlifeRenderer\.reset\(definition\.resourceNodes/);
  assert.match(main, /wildlifeRenderer\.reconcile\(state\.resourceNodes/);
  assert.match(main, /wildlifeRenderer\.update\(camera\)/);
  globalThis.Image = class {
    async decode() {
      const image = decodeRgba8(Buffer.from(await (await fetch(this.src)).arrayBuffer()));
      this.width = image.width; this.height = image.height;
    }
  };
  const scene = new THREE.Scene();
  renderer = createNeutralWildlifeRenderer({ THREE, scene, groundHeight: () => 0,
    loadArt: options => createStaticSheepRuntime({ ...options,
      bindingUrl: new URL('assets/wildlife/bellweather-sheep-static-v1/static-preview-binding.json', base).href }),
  });
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, .1, 100);
  camera.position.set(.78, 1.12, .78).normalize().multiplyScalar(20);
  camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  let client = await fixture.connect(0);
  for (const wildlifeNoseYawDegrees of [-1, 360, null]) {
    const invalid = structuredClone(map);
    invalid.resourceNodes[0].wildlifeNoseYawDegrees = wildlifeNoseYawDegrees;
    const before = client.messages.length;
    client.send({ type: 'publishMap', map: invalid, persist: true });
    assert.match((await client.wait(message => message.type === 'mapRejected', 'invalid pose rejected', before)).message, /invalid.*resource node/);
    assert.equal(client.latest.mapId, 'open-field', 'invalid pose cannot replace a running map');
  }
  const after = client.messages.length;
  client.send({ type: 'publishMap', map, persist: true });
  await client.wait(message => message.type === 'mapPublished', 'typed sheep map accepted', after);
  const changed = await client.wait(message => message.type === 'mapChange' && message.map.id === map.id, 'typed sheep map loaded', after);
  renderer.reset(changed.map.resourceNodes); await renderer.ready();
  const represent = state => {
    // The server omits wildlife outside current seat visibility, independently
    // exercised below; the production client also checks its current fog cells.
    renderer.reconcile(state.resourceNodes, () => true); renderer.update(camera);
    return renderer.diagnostics();
  };
  const alive = represent(changed.state);
  assert.equal(alive.artStatus, 'ready');
  assert.deepEqual(alive.nodes.find(node => node.id === 'visible-sheep'),
    { id: 'visible-sheep', state: 'alive', mode: 'static-illustration', visible: true });
  assert.equal(alive.nodes.find(node => node.id === 'hidden-sheep').visible, false);
  assert.equal(alive.nodes.some(node => node.id === 'ordinary-berries'), false);
  const group = scene.children.find(group => group.userData.wildlifeNodeId === 'visible-sheep');
  assert.equal(group.children[2].visible, true, 'verified atlas is attached to the live scene');
  assert.ok(group.children[2].material.map.image.width === 2048);
  const northCompanion = scene.children.find(group => group.userData.wildlifeNodeId === 'north-companion');
  assert.equal(northCompanion.children[2].geometry, group.children[2].geometry, 'same pose shares immutable geometry');
  assert.equal(alive.nodes.find(node => node.id === 'east-pose').mode, 'static-illustration');
  const eastGroup = scene.children.find(group => group.userData.wildlifeNodeId === 'east-pose');
  assert.equal(eastGroup.children[0].rotation.y, Math.PI / 2);
  const meshes = map.resourceNodes.filter(node => node.wildlifeNoseYawDegrees !== undefined).map(node => {
    assert.equal(alive.nodes.find(row => row.id === node.id).mode, 'static-illustration', node.id);
    return scene.children.find(group => group.userData.wildlifeNodeId === node.id).children[2];
  });
  assert.equal(new Set(meshes.map(mesh => mesh.geometry)).size, 8, 'every admitted direction has independent UVs');
  assert.equal(new Set(meshes.map(mesh => mesh.material)).size, 1, 'all directions share the verified color atlas');
  const savedPose = await fixture.checkpoint(saved => saved.mapDefinition.id === map.id);
  assert.equal(savedPose.mapDefinition.resourceNodes.find(node => node.id === 'east-pose').wildlifeNoseYawDegrees, 90);
  assert.ok(savedPose.state.resourceNodes.every(node => node.wildlifeNoseYawDegrees === undefined), 'static pose belongs to authored map data');
  const worker = client.latest.units.find(unit => unit[1] === 0 && unit[5] === 'worker')[0];
  await client.command({ type: 'gather', ids: [worker], nodeId: 'visible-sheep', clientOrderToken: 1 }, /GATHER ORDER/);
  const carcassState = await client.state(state => state.resourceNodes.some(node => node.id === 'visible-sheep'
    && node.wildlifeState === 'carcass'), 'gather reaches sheep');
  assert.equal(represent(carcassState).nodes.find(node => node.id === 'visible-sheep').mode, 'food-cache-marker');
  assert.equal(group.children[2].visible, false, 'live illustration is suppressed on harvest activation');
  const depletedState = await client.state(state => state.resourceNodes.some(node => node.id === 'visible-sheep'
    && node.wildlifeState === 'depleted'), 'gather exhausts sheep');
  assert.equal(represent(depletedState).nodes.find(node => node.id === 'visible-sheep').visible, false);
  assert.equal(renderer.isAvailable('visible-sheep'), false);
  await fixture.checkpoint(saved => saved.state.resourceNodes.some(node => node.id === 'visible-sheep' && node.wildlifeState === 'depleted'));
  const sessionToken = client.welcome.player.sessionToken;
  await fixture.stop(); await fixture.start();
  client = await fixture.connect(0, sessionToken);
  assert.equal(client.welcome.recoveredFromCheckpoint, true);
  assert.equal(client.welcome.map.resourceNodes.find(node => node.id === 'east-pose').wildlifeNoseYawDegrees, 90);
  renderer.reset(client.welcome.map.resourceNodes);
  const recovered = represent(client.welcome.state);
  assert.equal(recovered.nodes.find(node => node.id === 'visible-sheep').visible, false);
  assert.equal(recovered.nodes.find(node => node.id === 'east-pose').mode, 'static-illustration');
  const beforeReset = client.messages.length;
  client.send({ type: 'reset' });
  const restoredState = await client.wait(state => state.type === 'state'
    && state.resourceNodes.some(node => node.id === 'visible-sheep' && node.wildlifeState === 'alive'),
  'rematch restores authored sheep', beforeReset);
  assert.equal(represent(restoredState).nodes.find(node => node.id === 'visible-sheep').mode, 'static-illustration');
  console.log(JSON.stringify({ scenario: 'neutral wildlife live render binding', productionHttpPaths: approved.length,
    nonRuntimePathsRejected: 7, verifiedPublicAtlasLoaded: true, realSnapshotAliveCarcassDepletedRematch: true,
    hiddenWildlifeSuppressed: true, ordinaryFoodUnchanged: true, staticPosePublishedAndRecovered: true,
    allEightAuthoredDirectionsAttached: true, sameDirectionSharesGeometry: true, invalidPosesRejected: 3, webglCapture: false }));
} finally {
  renderer?.dispose(); globalThis.Image = OriginalImage; await fixture.dispose();
}
