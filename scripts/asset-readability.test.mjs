import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { productionReadabilityStatus, buildingReadabilityStatus, mountAssetReadability } from '../src/asset-readability.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root));
const registry = JSON.parse(await read('docs/asset-adoption-registry.json'));
const town = registry.records.find(row => row.id === 'frontier-town-center');
const manifests = [JSON.parse(await read(town.manifest))];
const contract = JSON.parse(await read('docs/art-direction/human-roster-v1/infantry-production-contract.json'));
const footManifest = JSON.parse(await read(contract.manifest));

test('catalog consumes the existing sidecar pins, style and missing cells independently of descriptions', async () => {
  const before = productionReadabilityStatus(contract, footManifest, 'v3');
  assert.equal(before.requiredCells, 32); assert.equal(before.declaredAuthoredCells, 11);
  assert.equal(before.declaredMissingCells.length, 21); assert.equal(before.readability, 'unverified');
  for (const file of contract.identity.approvedRuntimeFiles) {
    assert.equal(createHash('sha256').update(await read(file.path)).digest('hex'), file.sha256);
  }
  const changed = structuredClone(contract), manifest = structuredClone(footManifest);
  changed.description = 'Changed production copy'; manifest.description = 'Changed game description';
  assert.deepEqual(productionReadabilityStatus(changed, manifest, 'v3'), before);
  assert.equal(productionReadabilityStatus(contract, footManifest, 'v4').defaultVersionMatches, false);
});

test('changed approved runtime metadata and private or unsupported sidecar scope are rejected', () => {
  const changed = structuredClone(footManifest);
  changed.files.find(file => contract.identity.approvedRuntimeFiles[0].path.endsWith(`/${file.path}`)).sha256 = 'a'.repeat(64);
  assert.throws(() => productionReadabilityStatus(contract, changed, 'v3'), /approved runtime pins/);
  const privateContract = structuredClone(contract); privateContract.publication.state = 'private';
  assert.throws(() => productionReadabilityStatus(privateContract, footManifest, 'v3'), /existing public/);
  const wrongPath = structuredClone(contract); wrongPath.identity.approvedRuntimeFiles[0].path = 'private/pose.png';
  assert.throws(() => productionReadabilityStatus(wrongPath, footManifest, 'v3'), /approved runtime pins/);
});

test('runtime observations preserve source coverage and cannot claim readability or accept a different live manifest', () => {
  const status = buildingReadabilityStatus({ record: town, manifest: manifests[0], observedManifest: `/${town.manifest}`,
    observedManifestData: manifests[0], spriteVisible: true });
  assert.equal(status.views, 8); assert.equal(status.defaultBinding, true);
  assert.equal(status.states.filter(row => row.authored).length, 1);
  assert.equal(status.readability, 'unverified');
  const different = structuredClone(manifests[0]); different.completeState.views[0].sha256 = 'b'.repeat(64);
  assert.equal(buildingReadabilityStatus({ record: town, manifest: manifests[0], observedManifest: `/${town.manifest}`,
    observedManifestData: different, spriteVisible: true }).defaultBinding, false);
  assert.equal(buildingReadabilityStatus({ record: town, manifest: manifests[0], observedManifest: `/${town.manifest}` }).defaultBinding, false);
});

async function fixture({ changeResponse, manifest = manifests[0] } = {}) {
  const dom = new JSDOM(await read('index.html'));
  const focusCalls = [], document = dom.window.document;
  const observation = { point: { x: 3, z: 5 }, manifestPath: `/${town.manifest}`, manifest,
    spriteVisible: true, footRuntimeVersion: 'v3', mapId: 'fixture', zoom: 0.91, width: 1280, height: 720, dpr: 1 };
  const review = mountAssetReadability({ document, getObservation: () => observation, focus: value => focusCalls.push(value),
    fetchImpl: async url => {
      let bytes = await read(url.slice(1));
      if (changeResponse) bytes = changeResponse(url, bytes);
      return new Response(bytes);
    } });
  await review.ready;
  return { dom, document, review, focusCalls, observation };
}

test('catalog consumes existing normal controls, preserves live state, and only camera buttons invoke the supplied hook', async () => {
  const f = await fixture();
  try {
    const before = structuredClone(f.observation), root = f.document.querySelector('#asset-readability');
    f.review.update(1000);
    assert.equal(f.review.snapshot.building.defaultBinding, true);
    assert.equal(f.review.snapshot.building.readability, 'unverified');
    assert.equal(f.review.snapshot.production.declaredMissingCells.length, 21);
    assert.equal(f.review.snapshot.icon.productionContract, 'not-recorded');
    const images = [...root.querySelectorAll('img')];
    assert.deepEqual(images.map(image => [image.width, image.height]), [[16, 16], [20, 20], [24, 24]]);
    for (const image of images) { assert.equal(image.getAttribute('src'), '/assets/ui/icons/actions/follow.svg'); assert.equal(image.alt, ''); }
    assert.equal(root.querySelector('[data-persistent-order], [data-context-proxy]'), null, 'samples cannot dispatch gameplay commands');
    const buttons = [...root.querySelectorAll('button')];
    buttons.find(button => button.textContent.includes('normal')).click();
    buttons.find(button => button.textContent.includes('strategic')).click();
    assert.deepEqual(f.focusCalls, [0.91, 0.48]);
    buttons.find(button => button.textContent.includes('Grayscale')).click();
    assert.equal(root.querySelector('img').parentNode.parentNode.style.filter, 'grayscale(1)');
    assert.deepEqual(f.observation, before, 'catalog neither changes the received state nor regenerates art');
    let gameplayKey = false; f.document.addEventListener('keydown', () => { gameplayKey = true; });
    buttons[1].dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key: 'p', bubbles: true }));
    assert.equal(gameplayKey, false);
    buttons[0].click(); assert.equal(f.document.querySelector('#asset-readability'), null);
  } finally { f.review.dispose(); f.dom.window.close(); }
});

test('changed served Infantry is blocked by existing pins; missing world state disables camera controls', async () => {
  const broken = await fixture({ changeResponse: (url, bytes) => url.endsWith('infantry-atlas-runtime.png') ? Buffer.from('changed') : bytes });
  try {
    const root = broken.document.querySelector('#asset-readability');
    assert.match(root.textContent, /Served Infantry pixels differ/);
    broken.review.update(1000); assert.equal(broken.review.snapshot.production, null);
    assert.equal(root.querySelectorAll('img').length, 3, 'optional foot audit does not replace/disable existing icon samples');
  } finally { broken.review.dispose(); broken.dom.window.close(); }
  const absent = await fixture();
  try {
    absent.observation.point = null; absent.observation.manifest = null; absent.observation.spriteVisible = false;
    absent.review.update(1000);
    for (const button of absent.document.querySelectorAll('#asset-readability button')) {
      if (button.textContent.includes('Find Town Center')) assert.equal(button.disabled, true);
    }
    assert.equal(absent.review.snapshot.building.defaultBinding, false);
  } finally { absent.review.dispose(); absent.dom.window.close(); }
});
