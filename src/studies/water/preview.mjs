import * as THREE from 'three';
import { buildWaterSurfaceGeometry } from '../../presentation/rendering/water/geometry.mjs';
import { createWaterSurfaceStudy } from '../../presentation/rendering/water/surface.mjs';
import { createShoreFishPlaceholder, updateShoreFishPlaceholder } from '../../shore-fishing-placeholder.mjs';
import { waterRaster } from '../../water-contours.mjs';

const ui = Object.fromEntries(['stage', 'status', 'quality', 'animate', 'time', 'reduced', 'fish', 'water', 'depleted']
  .map(id => [id, document.getElementById(id)]));
const definition = { id: 'water-surface-study', width: 18, height: 16, terrainSeed: 17,
  terrainBase: 'meadow', terrainPatches: [{ column: 6, row: 2, width: 1, height: 10, material: 'sand' }],
  obstacles: [], resourceNodes: [{ id: 'bank-fish', type: 'food', resourceVariant: 'shore-fish', x: -2.5, z: .5, stock: 22.5 }] };
for (let row = 2; row < 12; row++) for (let column = 7; column < 13; column++) {
  if ((column === 9 || column === 10) && (row === 6 || row === 7)) continue;
  definition.obstacles.push({ column, row, width: 1, height: 1, material: 'water' });
}
for (let row = 4; row < 6; row++) for (let column = 4; column < 7; column++) {
  definition.obstacles.push({ column, row, width: 1, height: 1, material: 'water' });
}
const raster = waterRaster(definition);
const wetCells = [...raster.keys()].filter(i => raster[i]);
const scenes = [new THREE.Scene(), new THREE.Scene()];
const bankMarkers = [];
for (const scene of scenes) {
  scene.background = new THREE.Color(0x34483e);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(18, 16), new THREE.MeshBasicMaterial({ color: 0x73806a }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.025;
  scene.add(ground);
  const bank = new THREE.Group(); bank.rotation.x = -Math.PI / 2; bank.position.set(-2.5, .05, .5);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.5, .55, 32), new THREE.MeshBasicMaterial({ color: 0xd1b278, side: THREE.DoubleSide }));
  const marker = createShoreFishPlaceholder(); bank.add(ring, marker); scene.add(bank);
  bankMarkers.push({ bank, marker });
}
const current = new THREE.Mesh(buildWaterSurfaceGeometry(definition),
  new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false }));
current.renderOrder = 5; scenes[0].add(current);
const motion = matchMedia('(prefers-reduced-motion: reduce)');
ui.reduced.checked = motion.matches;
let study, time = 12, animateStart = null, animateBase = 12;
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
catch { ui.status.textContent = 'WebGL could not start. No rendered preview is available.'; throw new Error('Water study requires WebGL'); }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.setAttribute('aria-label', 'Current and proposed water surfaces, identical shore and bank resource positions');
ui.stage.append(renderer.domElement);
const camera = new THREE.OrthographicCamera(-12, 12, 9, -9, .01, 100);
const elevation = 46 * Math.PI / 180;
camera.position.set(30 * Math.cos(elevation) / Math.sqrt(2), 30 * Math.sin(elevation), 30 * Math.cos(elevation) / Math.sqrt(2));
camera.lookAt(0, 0, 0);

function refreshFish() {
  const fish = study.userData.updateWaterStudyFish({
    resourceNodes: [{ ...definition.resourceNodes[0], stock: ui.depleted.checked ? 0 : 22.5 }],
    visibleResourceIds: ui.fish.checked ? ['bank-fish'] : [],
    visibleWaterCells: ui.water.checked ? wetCells : [],
  });
  for (const { bank, marker } of bankMarkers) {
    bank.visible = ui.fish.checked;
    updateShoreFishPlaceholder(marker, ui.depleted.checked ? 'depleted' : 'full');
  }
  const activity = ui.quality.value === 'low' ? 'Fish ripples off in simple quality'
    : ui.reduced.checked ? 'Fish ripples paused for reduced motion'
      : `${fish.length} visible fish-school ripple envelope${fish.length === 1 ? '' : 's'}`;
  ui.status.textContent = `${ui.quality.value === 'low' ? 'Simple static fallback' : 'Apparent depth and directional surface'} · ${activity} · identical blocked water and bank approach`;
}
function rebuild() {
  if (study) {
    scenes[1].remove(study);
    study.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
    for (const texture of study.userData.ownedGroundTextures || []) texture.dispose();
  }
  study = createWaterSurfaceStudy(definition, { quality: ui.quality.value,
    reducedMotion: ui.reduced.checked, getTime: () => time });
  scenes[1].add(study); refreshFish();
}
ui.quality.addEventListener('change', rebuild);
for (const key of ['fish', 'water', 'depleted']) ui[key].addEventListener('change', refreshFish);
ui.reduced.addEventListener('change', () => { study.userData.setWaterStudyMotion(ui.reduced.checked); refreshFish(); });
motion.addEventListener('change', event => {
  ui.reduced.checked = event.matches; study.userData.setWaterStudyMotion(event.matches); refreshFish();
});
ui.animate.addEventListener('change', () => { animateStart = null; animateBase = time; });
ui.time.addEventListener('input', () => { time = Number(ui.time.value); animateBase = time; animateStart = null; });
rebuild();
function frame(now) {
  if (ui.animate.checked && !ui.reduced.checked) {
    animateStart ??= now;
    time = (animateBase + (now - animateStart) / 1000) % 30;
    ui.time.value = String(time);
  } else { animateStart = null; animateBase = time; }
  const width = ui.stage.clientWidth, height = ui.stage.clientHeight, half = Math.floor(width / 2);
  renderer.setSize(width, height, false);
  const span = Math.max(10.5, 12 * height / half);
  camera.left = -span * half / height; camera.right = -camera.left;
  camera.top = span; camera.bottom = -span; camera.updateProjectionMatrix();
  renderer.setScissorTest(true);
  for (let i = 0; i < 2; i++) {
    renderer.setViewport(i * half, 0, half, height); renderer.setScissor(i * half, 0, half, height);
    renderer.render(scenes[i], camera);
  }
  document.documentElement.dataset.waterStudy = 'rendered';
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
