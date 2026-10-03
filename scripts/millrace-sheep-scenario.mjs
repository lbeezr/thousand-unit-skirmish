import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { decodeRgba8 } from './sprite-pixel-bounds.mjs';
import { createNeutralWildlifeRenderer } from '../src/neutral-wildlife-renderer.mjs';
import { createStaticSheepRuntime } from '../src/sheep-static-preview.mjs';
import { MILLRACE_SHEEP_IDS, MILLRACE_PRE_SHEEP_MAP_HASH } from '../src/millrace-sheep.mjs';

// No map publication, stock injection or preview option: use the worker's default.
const fixture = await createFortifiedFixture({ mapPath: null, timeoutMs: 45_000 });
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('base64url');
const stripIdentity = nodes => nodes.map(({ wildlifeSpecies, wildlifeState, wildlifeMotion, ...node }) => node);
const savedNode = (saved, id) => saved.state.resourceNodes.find(node => node.id === id);
const originalImage = globalThis.Image;
let renderer, token = 1;
const command = (client, value, pattern) => client.command({ ...value, clientOrderToken: token++ }, pattern);
function conserved(saved) {
  const stock = saved.state.resourceNodes.filter(node => node.type === 'food').reduce((sum, node) => sum + node.stock, 0);
  const bank = saved.state.teamFood.reduce((sum, food) => sum + food, 0);
  const cargo = saved.state.units.filter(unit => unit.cargoType === 'food').reduce((sum, unit) => sum + unit.cargo, 0);
  assert.ok(Math.abs(stock + bank + cargo - 3100) < 1e-6, '2,800 authored food plus 300 starting bank remains conserved');
}
function checkOpening(client, team) {
  assert.equal(client.welcome.map.id, 'bellweather-millrace');
  assert.ok(client.welcome.maps.some(map => map.id === 'bellweather-millrace' && /Millrace/.test(map.name)));
  const row = client.welcome.state.resourceNodes.find(node => node.id === `s${team}-0-1`);
  assert.equal(row.wildlifeSpecies, 'bellweather-sheep'); assert.equal(row.wildlifeState, 'alive');
  assert.equal(row.stock, 130, 'a home Sheep is visible without scouting or a lab switch');
}
try {
  await fixture.start();
  let clients = [await fixture.connect(0), await fixture.connect(1)];
  clients.forEach(checkOpening);
  const sessions = clients.map(client => client.welcome.player.sessionToken);
  const matchId = clients[0].welcome.matchId;
  const workers = clients.map((client, team) => client.latest.units.find(row => row[1] === team && row[5] === 'worker')[0]);
  const base = `http://127.0.0.1:${fixture.port}/`;
  globalThis.Image = class {
    async decode() {
      const response = await fetch(this.src); assert.equal(response.status, 200);
      const png = decodeRgba8(Buffer.from(await response.arrayBuffer()));
      this.width = png.width; this.height = png.height;
    }
  };
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-50, 50, 50, -50, .1, 200);
  camera.position.set(50, 75, 50); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  renderer = createNeutralWildlifeRenderer({ THREE, scene, groundHeight: () => 0,
    loadArt: options => createStaticSheepRuntime({ ...options,
      bindingUrl: new URL('assets/wildlife/bellweather-sheep-static-v1/static-preview-binding.json', base).href }),
  });
  renderer.reset(clients[0].welcome.map.resourceNodes); await renderer.ready();
  for (const team of [0, 1]) {
    renderer.reconcile(clients[team].welcome.state.resourceNodes, () => true);
    renderer.update(camera);
    const opening = renderer.diagnostics();
    assert.equal(opening.artStatus, 'ready');
    const sheep = opening.nodes.find(node => node.id === `s${team}-0-1`);
    assert.equal(sheep.visible, true); assert.equal(sheep.mode, 'static-illustration');
    const group = scene.children.find(group => group.userData.wildlifeNodeId === sheep.id);
    assert.equal(group.visible, true);
    assert.ok(group.children.some(mesh => mesh.isMesh && mesh.visible && mesh.material?.map?.image?.width === 2048 && mesh.material.map.image.height === 1024),
      'each seat\'s visible opening Sheep has an actual attached textured illustration mesh');
  }
  for (const team of [0, 1]) await command(clients[team], {
    type: 'gather', ids: [workers[team]], nodeId: `s${team}-0-1`,
  }, /GATHER ORDER/);
  await fixture.checkpoint(saved => workers.every((id, team) => saved.state.units.find(unit => unit.id === id)?.cargo >= 1
    && savedNode(saved, `s${team}-0-1`).wildlifeState === 'carcass'));
  for (const team of [0, 1]) await command(clients[team], { type: 'stop', ids: [workers[team]] }, /STOP ORDER/);
  const partial = await fixture.checkpoint(saved => workers.every(id => {
    const unit = saved.state.units.find(unit => unit.id === id);
    return unit?.cargo > 0 && unit.gatherPhase === '';
  }));
  conserved(partial);
  // The exact previous map/state format can represent this same naturally
  // harvested stock and cargo. Restore its stationary positions and remove
  // runtime motion/identity, preserving the naturally produced economy.
  const legacy = structuredClone(partial);
  legacy.mapDefinition.resourceNodes = stripIdentity(legacy.mapDefinition.resourceNodes);
  legacy.state.resourceNodes = stripIdentity(legacy.state.resourceNodes).map(node => {
    const authored = legacy.mapDefinition.resourceNodes.find(row => row.id === node.id);
    return { ...node, x: authored.x, z: authored.z };
  });
  legacy.schemaVersion = 23;
  legacy.mapHash = hash(legacy.mapDefinition);
  assert.equal(legacy.mapHash, MILLRACE_PRE_SHEEP_MAP_HASH);
  await fixture.stop(); await writeFile(fixture.checkpointPath, JSON.stringify(legacy)); await fixture.start();
  clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint && client.welcome.matchId === matchId));
  const recovered = await fixture.checkpoint(saved => saved.sequence > legacy.sequence);
  conserved(recovered);
  assert.equal(recovered.mapHash, hash(clients[0].welcome.map));
  for (const id of MILLRACE_SHEEP_IDS) {
    const old = savedNode(legacy, id), row = savedNode(recovered, id);
    assert.equal(row.stock, old.stock); assert.equal(row.wildlifeSpecies, 'bellweather-sheep');
    assert.equal(row.wildlifeState, id.endsWith('-1') ? 'carcass' : 'alive');
  }
  for (const id of workers) {
    assert.equal(recovered.state.units.find(unit => unit.id === id).cargo, legacy.state.units.find(unit => unit.id === id).cargo);
  }
  for (const team of [0, 1]) await command(clients[team], { type: 'returnCargo', ids: [workers[team]] }, /RETURN CARGO ORDER/);
  const delivered = await fixture.checkpoint(saved => workers.every(id => saved.state.units.find(unit => unit.id === id)?.cargo === 0));
  conserved(delivered);
  for (const team of [0, 1]) {
    const carried = legacy.state.units.find(unit => unit.id === workers[team]).cargo;
    assert.ok(Math.abs(delivered.state.teamFood[team] - 150 - carried) < 1e-6);
  }
  await fixture.stop(); await fixture.start();
  clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint && client.welcome.matchId === matchId));
  const stable = await fixture.checkpoint(saved => saved.sequence > delivered.sequence);
  conserved(stable); assert.deepEqual(stable.state.teamFood, delivered.state.teamFood, 'restart does not duplicate delivered food');
  clients[0].send({ type: 'reset' });
  const rematch = await fixture.checkpoint(saved => saved.sequence > stable.sequence && saved.state.teamFood.every(food => food === 150)
    && MILLRACE_SHEEP_IDS.every(id => savedNode(saved, id).wildlifeState === 'alive' && savedNode(saved, id).stock === 130));
  conserved(rematch);
  for (const team of [0, 1]) await clients[team].state(state => state.resourceNodes.some(node => node.id === `s${team}-0-1`
    && node.wildlifeState === 'alive' && node.stock === 130), 'normal-map rematch Sheep visible');
  // Correctly hashed unrelated old map edits still reject instead of migrating.
  await fixture.stop();
  const invalid = structuredClone(legacy); invalid.mapDefinition.terrainSeed++;
  invalid.mapHash = hash(invalid.mapDefinition);
  await writeFile(fixture.checkpointPath, JSON.stringify(invalid)); await fixture.start();
  const fresh = await fixture.connect(0);
  assert.equal(fresh.welcome.recoveredFromCheckpoint, false); assert.notEqual(fresh.welcome.matchId, matchId);
  checkOpening(fresh, 0);
  assert.equal((await readdir(fixture.directory)).filter(name => name.startsWith('match.json.rejected-')).length, 1);
  console.log(JSON.stringify({ scenario: 'normal default Millrace Sheep', map: 'Bellweather · Millrace', sheep: 6, foodStock: 2800,
    bothSeatOpeningVisibleAndStaticArtReady: true, bothSeatNaturalHarvestAndReturnCargo: true,
    exactLegacyMapStockCargoAndIdentityPreserved: true, currentRestartCreditsOnce: true,
    rematchRestoresSixSheep: true, unrelatedMapDriftRejectedAndArchived: true,
    deliveredBanks: delivered.state.teamFood, nativeWebGLAppearance: false }));
} finally {
  renderer?.dispose(); globalThis.Image = originalImage; await fixture.dispose();
}
