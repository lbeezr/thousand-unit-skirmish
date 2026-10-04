import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {validateBuildingLifecycle} from './validate-building-lifecycle.mjs';

const states = ['foundation', 'frame', 'complete', 'damaged', 'critical'];
const hash = 'a'.repeat(64);
function fixture(order = states) {
  const entry = state => ({state, views: Array.from({length: 8}, (_, index) => ({index,
    azimuthDegrees: index * 45, path: `${state}-${index}.webp`, sha256: hash,
    teamMaskPath: `mask-${state}-${index}.png`, teamMaskSha256: hash}))});
  return {schema: 'thousand-unit-skirmish.building-lifecycle-reference.v1', asset: 'town-center',
    camera: {projection: 'orthographic', framePixels: [1024, 1024], pixelsPerWorldUnit: 128,
      anchorPixelFromTopLeft: [512, 647.153], azimuthDegrees: Array.from({length: 8}, (_, i) => i * 45)},
    stateOrder: [...order], completeState: entry('complete'), states: order.filter(s => s !== 'complete').map(entry)};
}
const strict = {requireLifecycle: true, requireTeamMasks: true};
function rejects(mutations, options = {}) {
  for (const mutate of mutations) { const manifest = fixture(); mutate(manifest); assert.throws(() => validateBuildingLifecycle(manifest, options)); }
}

test('full synthetic lifecycle covers forty color/mask references independent of array order', () => {
  const manifest = fixture();
  manifest.states.reverse(); manifest.states[0].views.reverse();
  assert.deepEqual(validateBuildingLifecycle(manifest, strict), {asset: 'town-center', states,
    viewsPerState: 8, teamMaskedViews: 40});
});

test('intentional Complete-only sources pass declared coverage but fail full admission', () => {
  const manifest = fixture(['complete']);
  for (const view of manifest.completeState.views) { delete view.teamMaskPath; delete view.teamMaskSha256; }
  assert.equal(validateBuildingLifecycle(manifest).teamMaskedViews, 0);
  assert.throws(() => validateBuildingLifecycle(manifest, {requireLifecycle: true}), /Missing lifecycle states: foundation, frame, damaged, critical/);
  assert.throws(() => validateBuildingLifecycle(manifest, {requireTeamMasks: true}), /Missing team mask/);
});

test('declared states cannot omit entries, repeat identities or hide undeclared coverage', () => {
  rejects([
    m => { m.stateOrder.push('complete'); }, m => { m.stateOrder[0] = 'ruins'; },
    m => { m.stateOrder = m.stateOrder.filter(s => s !== 'complete'); },
    m => { m.states.pop(); }, m => { m.states[0].state = 'complete'; },
    m => { m.states[0].state = 'ruins'; }, m => { m.states[0] = null; },
    m => { m.completeState.state = 'foundation'; }, m => { m.states = null; },
  ]);
});

test('each declared state must cover the shared directions exactly once', () => {
  rejects([
    m => { m.states[0].views.pop(); }, m => { m.states[0].views[1].index = 0; },
    m => { m.completeState.views[0].index = 8; }, m => { m.completeState.views[0].index = 0.5; },
    m => { m.states[0].views[0].azimuthDegrees = 45; }, m => { m.states[0].views[0] = null; },
  ]);
});

test('shared canvas, density and anchor metadata must be usable', () => {
  rejects([
    m => { m.schema = 'other'; }, m => { m.camera.projection = 'perspective'; },
    m => { m.camera.framePixels = [1024]; }, m => { m.camera.framePixels[0] = 0; },
    m => { m.camera.framePixels[0] = 0.5; }, m => { m.camera.pixelsPerWorldUnit = NaN; },
    m => { m.camera.pixelsPerWorldUnit = 0; }, m => { m.camera.anchorPixelFromTopLeft[0] = -1; },
    m => { m.camera.anchorPixelFromTopLeft[1] = 1025; }, m => { m.camera.anchorPixelFromTopLeft[0] = Infinity; },
    m => { m.camera.azimuthDegrees[0] = 360; }, m => { m.camera.azimuthDegrees[0] = 45; },
    m => { m.camera.azimuthDegrees = []; },
  ]);
});

test('frame and mask digests must be explicit, paired and valid', () => {
  rejects([
    m => { m.completeState.views[0].path = ''; }, m => { m.states[0].views[0].sha256 = 'invalid'; },
    m => { delete m.states[0].views[0].teamMaskPath; }, m => { delete m.states[0].views[0].teamMaskSha256; },
    m => { m.states[0].views[0].teamMaskPath = ''; }, m => { m.states[0].views[0].teamMaskSha256 = 'invalid'; },
  ]);
  rejects([m => { delete m.states[0].views[0].teamMaskPath; delete m.states[0].views[0].teamMaskSha256; }], strict);
});

test('existing different-design runtime coverage stays distinct from Frontier readiness', async () => {
  const read = file => readFile(new URL(`../assets/buildings/${file}`, import.meta.url), 'utf8').then(JSON.parse);
  const frontier = await read('frontier-civilization-scale-pilot-v1/town-center-complete-renderer.json');
  assert.equal(validateBuildingLifecycle(frontier).teamMaskedViews, 0);
  assert.throws(() => validateBuildingLifecycle(frontier, strict), /Missing lifecycle states/);
  const runtime = await read('town-center-lifecycle-meshy-v1/lifecycle-grid.json');
  assert.equal(validateBuildingLifecycle(runtime, strict).teamMaskedViews, 40);
});

test('CLI reports metadata only and returns failure for incomplete full admission', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'building-lifecycle-test-'));
  const file = path.join(directory, 'candidate manifest.json');
  const script = new URL('./validate-building-lifecycle.mjs', import.meta.url);
  const run = (...args) => spawnSync(process.execPath, [fileURLToPath(script), file, ...args], {encoding: 'utf8'});
  try {
    await writeFile(file, JSON.stringify(fixture(['complete'])));
    const partial = run(); assert.equal(partial.status, 0); assert.match(JSON.parse(partial.stdout).evidence, /Metadata only/);
    const failed = run('--require-lifecycle'); assert.equal(failed.status, 1); assert.match(failed.stderr, /Missing lifecycle states/);
    await writeFile(file, JSON.stringify(fixture()));
    assert.equal(run('--require-lifecycle', '--require-team-masks').status, 0);
    assert.equal(run('--unknown').status, 1);
  } finally { await rm(directory, {recursive: true, force: true}); }
});


test('Farm exhaustion requires complete, damage and critical entries and stays Farm-specific', () => {
  const order = [...states, 'exhausted', 'exhausted-damaged', 'exhausted-critical'];
  const manifest = fixture(order); manifest.asset = 'farm';
  manifest.stateMapping = {harvest: {exhaustedStates: {complete: 'exhausted', damaged: 'exhausted-damaged', critical: 'exhausted-critical'}}};
  assert.equal(validateBuildingLifecycle(manifest, strict).states.length, 8);
  for (const mutate of [m => {m.asset = 'mill';}, m => {delete m.stateMapping;},
    m => {m.stateMapping.harvest.exhaustedStates.critical = 'complete';},
    m => {m.stateOrder.pop(); m.states.pop();}]) {
    const invalid = structuredClone(manifest); mutate(invalid);
    assert.throws(() => validateBuildingLifecycle(invalid, strict));
  }
});
