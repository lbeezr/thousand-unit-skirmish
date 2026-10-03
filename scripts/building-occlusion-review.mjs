import * as THREE from 'three';
import { attachBuildingSprite, buildingSpriteUrl } from '../src/building-sprites.mjs';
import { createUnitSpriteRuntime } from '../src/unit-sprite-runtime.mjs';
import { setActiveTerrain, groundHeight } from '../src/terrain-height.mjs';
import { CAMERA_VIEW_DIRECTION } from '../src/camera-controls.mjs';
import { crowdedBuildingSpecs, detailBuildingSpecs, OCCLUSION_VIEWPORT, summarizeSamples } from './building-occlusion-fixture.mjs';
import { createGpuSampler, readGpuIdentity } from './building-occlusion-metrics.mjs';

const canvas = document.querySelector('#scene'), status = document.querySelector('#status');
window.addEventListener('error', event => { status.textContent = `Fixture startup/runtime failed: ${event.message}`; });
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
const { width, height, baseFrustum } = OCCLUSION_VIEWPORT;
const teamHex = [0x5aa7d7, 0xe67a5e], frames = new Map();
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
const gl = renderer.getContext(), identity = readGpuIdentity(gl, navigator.userAgent);
const camera = new THREE.OrthographicCamera(); camera.near = .1; camera.far = 300;
let receipt = null, active = null, bodyDraws = 0;

function loadFrame(url) {
  if (frames.has(url)) return frames.get(url);
  const entry = {};
  entry.ready = new Promise(resolve => {
    entry.texture = new THREE.TextureLoader().load(new URL(url.replace(/^\.\//, '/'), location.origin).href,
      () => resolve(true), undefined, () => resolve(false));
  });
  entry.texture.colorSpace = THREE.SRGBColorSpace; entry.texture.userData.sharedBuildingSprite = true;
  frames.set(url, entry); return entry;
}

function setCamera({ zoom = .91, direction = CAMERA_VIEW_DIRECTION, span = baseFrustum, target = [0, 0, 0] } = {}) {
  camera.left = -span * width / height / 2; camera.right = -camera.left;
  camera.top = span / 2; camera.bottom = -camera.top; camera.zoom = zoom;
  camera.position.copy(new THREE.Vector3(...direction).normalize().multiplyScalar(125)).add(new THREE.Vector3(...target));
  camera.lookAt(...target); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  if (active?.actors) {
    for (const unit of active.units) active.actors.update(unit, 1000, 1);
    for (let team = 0; team < 2; team++) active.actors.markTeamDirty(team);
  }
}

function setMode(mode, scene = active.scene) {
  scene.traverse(object => { if (object.userData.buildingBodyDepth) object.visible = mode === 'candidate'; });
}

function draw(scene = active.scene) {
  if (document.hidden) throw new Error('Tab became hidden; discard this comparison and rerun visibly');
  if (gl.isContextLost()) throw new Error('WebGL context lost; no native completion claim');
  bodyDraws = 0; renderer.render(scene, camera);
  return { calls: renderer.info.render.calls, bodyDraws, triangles: renderer.info.render.triangles,
    textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, programs: renderer.info.programs.length };
}

function addBuilding(scene, spec) {
  const group = new THREE.Group(); group.position.set(spec.x, groundHeight(spec.x, spec.z), spec.z);
  attachBuildingSprite(group, [], spec, undefined, loadFrame); scene.add(group);
  const depth = group.children.find(child => child.userData.buildingBodyDepth);
  depth.onBeforeRender = () => { bodyDraws++; };
  return { group, depth, color: group.children.find(child => child.isSprite), spec };
}

function makeGround(scene, definition, field) {
  const points = [];
  for (let row = 0; row < definition.height; row++) for (let column = 0; column < definition.width; column++) {
    const h = field.corners(column, row), x = column - definition.width / 2, z = row - definition.height / 2;
    for (const index of [0, 1, 3, 0, 3, 2]) points.push(x + index % 2, h[index], z + Math.floor(index / 2));
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x859175, side: THREE.DoubleSide })));
}

async function buildScene(specs, detailed = false, unitCount = 512) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x859175);
  const definition = { width: detailed ? 24 : 128, height: detailed ? 24 : 128,
    elevationPatches: detailed ? [{ column: 12, row: 0, width: 12, height: 24, level: 3 }] : [] };
  const field = setActiveTerrain(definition); makeGround(scene, definition, field);
  const buildings = specs.map(spec => addBuilding(scene, spec));
  if (!(await Promise.all([...frames.values()].map(entry => entry.ready))).every(Boolean)) throw new Error('Building frame load failed');
  // Resolve the controller callbacks before checking their visibility.
  await Promise.resolve();
  if (buildings.some(entry => !entry.depth.visible || !entry.color.visible)) throw new Error('Building pass did not become ready');
  const capacity = Math.ceil(unitCount / 2), units = [];
  const actors = createUnitSpriteRuntime({ THREE, scene, capacity, teamHex, cameraQuaternion: camera.quaternion,
    roles: ['human', 'boughward-worker'], roleSpriteVersions: { human: 'v3' },
    approximateActionDirections: true, teamCivilizations: ['human', 'boughward'] });
  if (!await actors.ready) throw new Error('Shipped Worker atlas failed; no substitute actor permitted');
  const ownedTextures = new Set();
  scene.traverse(object => {
    if (!object.isInstancedMesh) return;
    ownedTextures.add(object.material.map);
    const compile = object.material.onBeforeCompile;
    object.material.onBeforeCompile = (shader, renderer) => {
      compile(shader, renderer); ownedTextures.add(shader.uniforms.unitTeamMask.value);
    };
  });
  for (let team = 0; team < 2; team++) actors.setCount(team, capacity);
  actors.setVisible(true);
  const along = new THREE.Vector3(CAMERA_VIEW_DIRECTION[0], 0, CAMERA_VIEW_DIRECTION[2]).normalize();
  const right = new THREE.Vector3(along.z, 0, -along.x);
  for (let i = 0; i < unitCount; i++) {
    const b = specs[Math.floor(i / 2) % specs.length], front = i % 2 === 1;
    const lane = Math.floor(i / (2 * specs.length)), lanes = Math.ceil(unitCount / (2 * specs.length));
    const point = new THREE.Vector3(b.x, 0, b.z).addScaledVector(along, (front ? 1 : -1) * (1.3 + (lane % 2) * .12))
      .addScaledVector(right, (front ? .65 : -.65) + (lane - (lanes - 1) / 2) * .3);
    units.push({ id: i, slot: Math.floor(i / 2), team: i % 2, kind: 'worker', hp: 100, angle: 0,
      renderX: point.x, renderZ: point.z, task: 'idle', walking: false, attackStartedAt: 0 });
  }
  return { scene, buildings, actors, units, specs, ownedTextures };
}

function disposeScene(value) {
  if (!value) return;
  const geometries = new Set(), materials = new Set();
  value.scene.traverse(object => {
    object.userData.buildingSprite?.dispose();
    if (object.isInstancedMesh) object.dispose();
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) materials.add(object.material);
  });
  for (const material of materials) material.dispose();
  // Three Sprite uses one module-shared geometry; keep it alive across fixture scenes.
  const shared = value.buildings[0]?.color.geometry;
  for (const geometry of geometries) if (geometry !== shared) geometry.dispose();
  for (const texture of value.ownedTextures || []) texture.dispose();
  value.scene.clear();
}

function image(scene = active.scene) { draw(scene); return canvas.toDataURL('image/png'); }
function pixel(scene, point) {
  draw(scene);
  const p = point.clone().project(camera), rgba = new Uint8Array(4);
  const x = Math.min(canvas.width - 1, Math.max(0, Math.floor((p.x * .5 + .5) * canvas.width)));
  const y = Math.min(canvas.height - 1, Math.max(0, Math.floor((p.y * .5 + .5) * canvas.height)));
  gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
  return Array.from(rgba);
}

function sourceSamples(texture) {
  const c = document.createElement('canvas'), im = texture.image; c.width = im.width; c.height = im.height;
  const context = c.getContext('2d', { willReadFrequently: true }); context.drawImage(im, 0, 0);
  const pixels = context.getImageData(0, 0, c.width, c.height).data;
  const alpha = (x, y) => pixels[(y * c.width + x) * 4 + 3];
  const find = (start, end, predicate) => {
    for (let y = Math.floor(start * c.height); y < end * c.height; y++) for (let x = 4; x < c.width - 4; x++) {
      if (predicate(x, y)) return { u: (x + .5) / c.width, v: (y + .5) / c.height, alpha: alpha(x, y) };
    }
    throw new Error('No stable source alpha probe found');
  };
  const neighborhood = (x, y, accept) => [-1, 0, 1].every(dy => [-1, 0, 1].every(dx => accept(alpha(x + dx, y + dy))));
  return { roof: find(.1, .5, (x, y) => neighborhood(x, y, a => a >= 250)),
    margin: { u: .02, v: .02, alpha: alpha(Math.floor(c.width * .02), Math.floor(c.height * .02)) },
    soft: find(.7, .95, (x, y) => alpha(x, y) >= 21 && alpha(x, y) <= 100) };
}

async function nativePixelChecks() {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x859175);
  const spec = { type: 'barracks', team: 0, complete: true, x: 0, z: 0 }, b = addBuilding(scene, spec);
  try {
    await loadFrame(buildingSpriteUrl(spec)).ready; await Promise.resolve();
    const samples = sourceSamples(b.color.material.map), results = [];
    if (samples.margin.alpha !== 0) throw new Error('Source margin probe is not transparent');
    const probe = new THREE.Mesh(new THREE.PlaneGeometry(.07, .07), new THREE.MeshBasicMaterial({
      color: 0xff00ff, transparent: true, depthTest: true, depthWrite: false, toneMapped: false }));
    probe.renderOrder = 1.1; scene.add(probe);
    for (const elevation of [0, 2.4]) for (const direction of [CAMERA_VIEW_DIRECTION, [-.78, 1.12, .78], [1, 3, 1]]) {
      b.group.position.y = elevation; setCamera({ direction, span: 8, target: [0, elevation, 0] });
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      const toward = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
      for (const [name, source, front] of [['roof-behind', samples.roof, false], ['roof-front', samples.roof, true],
        ['transparent-margin-behind', samples.margin, false], ['soft-alpha-edge-behind', samples.soft, false]]) {
        const root = b.group.position.clone().add(b.color.position);
        const offset = (1 - source.v - b.color.center.y) * b.color.scale.y;
        const point = root.addScaledVector(right, (source.u - b.color.center.x) * b.color.scale.x).addScaledVector(up, offset);
        if (offset < 0) point.addScaledVector(toward, -offset * up.y / toward.y);
        probe.position.copy(point).addScaledVector(toward, front ? .25 : -.25); probe.quaternion.copy(camera.quaternion);
        // Center this source sample on a native pixel to avoid a subpixel edge
        // selection becoming a different texel. Only the diagnostic camera moves.
        const projected = point.clone().project(camera);
        const px = (projected.x * .5 + .5) * canvas.width, py = (projected.y * .5 + .5) * canvas.height;
        camera.position.addScaledVector(right, (px - Math.floor(px) - .5) * (camera.right - camera.left) / camera.zoom / canvas.width)
          .addScaledVector(up, (py - Math.floor(py) - .5) * (camera.top - camera.bottom) / camera.zoom / canvas.height);
        camera.updateMatrixWorld();
        const readings = {};
        for (const mode of ['baseline', 'candidate']) { setMode(mode, scene); readings[mode] = pixel(scene, probe.position); }
        const magenta = rgba => rgba[0] > 240 && rgba[1] < 20 && rgba[2] > 240;
        const expectedCandidate = name !== 'roof-behind';
        results.push({ name, elevation, direction, source, cameraPosition: camera.position.toArray(), ...readings,
          passed: magenta(readings.baseline) && magenta(readings.candidate) === expectedCandidate });
      }
    }
    return results;
  } finally { disposeScene({ scene, buildings: [b] }); }
}

async function benchmark(mode) {
  setMode(mode);
  const cpu = [], intervals = [], gpu = createGpuSampler(gl), draws = [];
  let previous = null;
  try {
    for (let i = 0; i < 120; i++) {
      const timestamp = await frame();
      if (previous !== null) intervals.push(timestamp - previous); previous = timestamp;
      gpu.begin(); const start = performance.now();
      let counters; try { counters = draw(); } finally { gpu.end(); }
      cpu.push(performance.now() - start); draws.push(counters); gpu.poll();
    }
    const deadline = performance.now() + 3000;
    while (gpu.pendingCount && performance.now() < deadline) { await frame(); gpu.poll(); }
  } finally { gpu.dispose(); }
  if (draws.some(value => JSON.stringify(value) !== JSON.stringify(draws[0]))) throw new Error('Unstable draw/asset/program counts during sample');
  return { mode, samples: 120, counters: draws[0], cpuSubmissionMs: summarizeSamples(cpu), frameIntervalMs: summarizeSamples(intervals),
    gpu: { available: gpu.available, elapsedMs: summarizeSamples(gpu.values), dropped: gpu.dropped, invalidated: gpu.invalidated,
      complete: gpu.available && gpu.values.length === 120 && gpu.dropped === 0 && gpu.invalidated === 0 } };
}

async function run() {
  document.querySelector('#run').disabled = true; document.querySelector('#save').disabled = true;
  receipt = null; window.buildingOcclusionQA = null;
  let startupError = null;
  try {
    disposeScene(active); active = null;
    const response = await fetch('/qa-config.json');
    if (!response.ok) throw new Error(`Fixture configuration HTTP ${response.status}`);
    const config = await response.json();
    const dpr = document.querySelector('#dpr').value === '1' ? 1 : Math.min(devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(dpr); renderer.setSize(width, height, false);
    receipt = { schema: 'building-occlusion-native-qa-v1', recordedAt: new Date().toISOString(), status: 'running',
      config, identity, viewport: { width, height, dpr, pixelWidth: canvas.width, pixelHeight: canvas.height },
      controls: { frozenSpriteTimeMs: 1000, workerFacingAngle: 0, warmupFramesPerMode: 120, samplesPerBlock: 120,
        order: ['baseline', 'candidate', 'candidate', 'baseline'], bodyAlphaTest: .9, colorAlphaTest: .08 },
      pixelChecks: [], performance: [], views: [], errors: [],
      limits: ['Renderer-only synthetic stress scene; no simulation/HUD/resource/LOD workload.',
        'CPU submission time and RAF intervals are not GPU completion or display latency.',
        'GPU timings require complete non-disjoint native query blocks; software renderers do not prove hardware cost.',
        'Changed camera angles keep the original single-view artwork; they are depth stress tests, not newly authored views.',
        'Picking here checks Three raycast intersections, not snapshot-owned gameplay selection.'] };
    if (config.sourceDirty) throw new Error('Use a clean isolated checkout before native comparison');
    if (config.threeRevision !== THREE.REVISION) throw new Error('Installed Three differs from the fixture source receipt');
    status.textContent = 'Checking native roof, foreground, transparent margin and low-alpha edge pixels…';
    setCamera(); receipt.pixelChecks = await nativePixelChecks();
    for (const count of [32, 128]) {
      active = await buildScene(crowdedBuildingSpecs(count));
      for (const zoom of [.91, .48]) {
        setCamera({ zoom });
        status.textContent = `Warming ${count} buildings / 512 Workers at zoom ${zoom}…`;
        for (const mode of ['baseline', 'candidate']) { setMode(mode); for (let i = 0; i < 120; i++) { await frame(); draw(); } }
        const blocks = [];
        for (const mode of receipt.controls.order) {
          status.textContent = `Sampling ${count} buildings at zoom ${zoom}: ${mode}…`; blocks.push(await benchmark(mode));
        }
        const baseline = blocks[0].counters, candidate = blocks[1].counters;
        const checks = { drawDeltaMatchesBodySubmissions: candidate.calls - baseline.calls === candidate.bodyDraws,
          baselineHasNoBodyDraw: baseline.bodyDraws === 0, noExtraTextures: baseline.textures === candidate.textures,
          noExtraGeometryBuffers: baseline.geometries === candidate.geometries,
          sameWarmPrograms: baseline.programs === candidate.programs,
          allStrategicBuildingsHaveDepth: zoom !== .48 || candidate.bodyDraws === count };
        const entry = { count, workerCount: active.units.length, zoom, direction: CAMERA_VIEW_DIRECTION, blocks,
          measuredAdditionalDraws: candidate.calls - baseline.calls, checks };
        entry.hardwareGpuMedianDeltaMs = identity.hardwareIdentified && blocks.every(block => block.gpu.complete)
          ? ((blocks[1].gpu.elapsedMs.median + blocks[2].gpu.elapsedMs.median)
            - (blocks[0].gpu.elapsedMs.median + blocks[3].gpu.elapsedMs.median)) / 2 : null;
        for (const mode of ['baseline', 'candidate']) { setMode(mode); entry[`${mode}Png`] = image(); }
        receipt.performance.push(entry);
      }
      disposeScene(active); active = null;
    }
    // Deliberately beyond server admission: prove the renderer does not drop item 129.
    active = await buildScene(crowdedBuildingSpecs(129)); setCamera({ zoom: .48 }); setMode('candidate');
    receipt.rendererOnly129 = { ...draw(), expectedBodyDraws: 129, passed: bodyDraws === 129 };
    disposeScene(active); active = null;
    active = await buildScene(detailBuildingSpecs(), true, 8);
    for (const [name, direction, zoom] of [['default', CAMERA_VIEW_DIRECTION, .91], ['strategic', CAMERA_VIEW_DIRECTION, .48],
      ['other-azimuth', [-.78, 1.12, .78], .91], ['steeper', [1, 3, 1], .91]]) {
      setCamera({ direction, zoom, span: 20, target: [0, 1.2, 0] });
      const view = { name, direction, zoom, levelHeights: [0, 2.4] };
      const hits = {};
      for (const mode of ['baseline', 'candidate']) {
        setMode(mode); view[`${mode}Png`] = image();
        active.scene.updateMatrixWorld(true);
        const raycaster = new THREE.Raycaster(), right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
        hits[mode] = active.buildings.flatMap(b => [[.5, .4], [.02, .02]].map(([u, v]) => {
          const point = b.color.getWorldPosition(new THREE.Vector3())
            .addScaledVector(right, (u - b.color.center.x) * b.color.scale.x)
            .addScaledVector(up, (1 - v - b.color.center.y) * b.color.scale.y).project(camera);
          raycaster.setFromCamera(new THREE.Vector2(point.x, point.y), camera);
          return raycaster.intersectObjects(active.buildings.map(entry => entry.group), true).map(hit => hit.object.uuid);
        }));
      }
      view.picking = { probes: hits.baseline.length, everyProbeHitsExistingColorSprite: hits.baseline.every(probe => probe.length > 0),
        hitsUnchanged: JSON.stringify(hits.baseline) === JSON.stringify(hits.candidate) }; receipt.views.push(view);
    }
    setMode('candidate'); const b = active.buildings[0];
    const before = draw(); b.group.visible = false; const hidden = draw(); b.group.visible = true; const revealed = draw();
    receipt.fogGroup = { before, hidden, revealed, passed: before.bodyDraws - hidden.bodyDraws === 1
      && before.calls - hidden.calls === 2 && revealed.bodyDraws === before.bodyDraws && revealed.calls === before.calls };
    const success = receipt.pixelChecks.every(result => result.passed) && receipt.performance.every(entry => Object.values(entry.checks).every(Boolean))
      && receipt.rendererOnly129.passed && receipt.views.every(view => Object.values(view.picking).every(Boolean)) && receipt.fogGroup.passed;
    receipt.status = success ? 'checks-passed-human-review-pending' : 'checks-failed';
    receipt.hardwareGpuTimingComplete = identity.hardwareIdentified && receipt.performance.every(entry => entry.blocks.every(block => block.gpu.complete));
    status.textContent = `${receipt.status}. GPU timing complete: ${receipt.hardwareGpuTimingComplete}. Save the full paired evidence and inspect the PNGs.`;
  } catch (error) {
    startupError = String(error.message);
    if (receipt) { receipt.status = 'incomplete'; receipt.errors.push(startupError); }
    status.textContent = `Incomplete: ${startupError}`;
  } finally {
    document.querySelector('#result').textContent = receipt ? JSON.stringify({ ...receipt,
      performance: receipt.performance.map(({ baselinePng, candidatePng, ...entry }) => entry),
      views: receipt.views.map(({ baselinePng, candidatePng, ...entry }) => entry) }, null, 2)
      : JSON.stringify({ status: 'startup-failed', errors: [startupError] }, null, 2);
    // Keep a completed iteration available until its download is requested.
    document.querySelector('#run').disabled = Boolean(receipt); document.querySelector('#save').disabled = !receipt;
    window.buildingOcclusionQA = receipt;
  }
}

document.querySelector('#run').addEventListener('click', () => run());
document.querySelector('#save').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(receipt)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `building-occlusion-${receipt.config.sourceRevision.slice(0, 8)}-${Date.now()}.json`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  document.querySelector('#run').disabled = false;
});
