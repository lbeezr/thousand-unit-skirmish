// Owned checkpoint sequence. The version-1 wrapper supplies ordinary entry,
// verified served metadata and the shared capture hook. No launch or dispatch.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { frontierBuildingManifestUrl } from '../src/frontier-building-preview.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const CATALOG_BARRACKS_MAP = 'frontier-buildings-acceptance-flat';
export const CATALOG_BARRACKS_FLAGS = Object.freeze({ rendererCapture: 'environment-state',
  assetReadability: '1', assetScenario: 'catalog-barracks' });
const mapSource = new URL('../docs/qa-evidence/default-frontier-buildings-2026-10-03/acceptance-map-flat.json', import.meta.url);
const manifestPath = type => `assets/${new URL(frontierBuildingManifestUrl(type)).pathname.split('/assets/').at(-1)}`;
export const CATALOG_BARRACKS_MANIFEST = manifestPath('barracks');
const observationExpression = `(${observeCatalogPage.toString()})()`;

function installRoomFlags(flags) {
  const url = new URL(location.href);
  if (!url.searchParams.has('room')) return false;
  for (const [key, value] of Object.entries(flags)) url.searchParams.set(key, value);
  history.replaceState(null, '', url.href);
  return true;
}

export function catalogBarracksBeforeScript() {
  // A menu document remains ordinary entry. Only the subsequently created room
  // document gets QA flags before main reads its URL; production entry is intact.
  return `(${installRoomFlags.toString()})(${JSON.stringify(CATALOG_BARRACKS_FLAGS)})`;
}

// Only bounded owned-seat/render/DOM facts leave the browser. No URLs or tokens.
export function observeCatalogPage() {
  const root = document.querySelector('#asset-readability');
  const previewKeys = ['frontierBuildingsPreview', 'humanRosterPreview', 'castPreview',
    'workerSpritePreview', 'unitSpritePreview', 'meshyInfantrySpritePreview', 'humanVaeloraPreview', 'humanAnimationPreview'];
  const params = new URL(location.href).searchParams;
  const visible = image => {
    const rect = image.parentElement.getBoundingClientRect(), imageRect = image.getBoundingClientRect();
    const clip = root.getBoundingClientRect();
    const fullyInside = rect.width > 0 && rect.height > 0
      && rect.left >= Math.max(0, clip.left + root.clientLeft)
      && rect.top >= Math.max(0, clip.top + root.clientTop)
      && rect.right <= Math.min(innerWidth, clip.left + root.clientLeft + root.clientWidth)
      && rect.bottom <= Math.min(innerHeight, clip.top + root.clientTop + root.clientHeight);
    const style = getComputedStyle(image);
    return fullyInside && style.visibility === 'visible' && Number(style.opacity) > 0
      && [[imageRect.left + 1, imageRect.top + 1], [imageRect.right - 1, imageRect.bottom - 1]]
        .every(([x, y]) => image.parentElement.contains(document.elementFromPoint(x, y)));
  };
  return { state: window.__rtsCatalogBarracksCapture?.snapshot,
    catalog: window.__rtsAssetReadabilitySnapshot,
    catalogVisible: Boolean(root?.isConnected),
    alternateAssets: previewKeys.some(key => params.has(key)),
    samples: [...(root?.querySelectorAll('img') || [])].map(image => ({
      width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height,
      source: image.getAttribute('src'), decoded: image.complete && image.naturalWidth > 0,
      label: image.parentElement.textContent, objectFit: image.style.objectFit, visible: visible(image) })),
    grayscale: root?.querySelector('img')?.parentElement.parentElement.style.filter === 'grayscale(1)',
  };
}

export function validateScenarioObservation(observation, { team, zoom, catalog = false, grayscale = false } = {}) {
  const state = observation?.state;
  assert.equal(observation?.alternateAssets, false, 'scenario must use ordinary asset defaults');
  assert.equal(state?.mapId, CATALOG_BARRACKS_MAP, 'the authored paid-acceptance map must be applied');
  assert.ok([0, 1].includes(team) && state.team === team, 'scenario must retain its owned seat');
  assert.ok(Number.isInteger(state.frame) && state.frame > 0 && Number.isFinite(state.renderedAt), 'post-render identity is required');
  assert.deepEqual(state.viewport, [1280, 720], 'scenario uses the qualified viewport');
  assert.equal(state.dpr, 1, 'scenario uses the qualified pixel ratio');
  assert.ok(Math.abs(state.zoom - zoom) < 1e-6, 'observed zoom must match the requested checkpoint');
  assert.ok(Number.isFinite(state.bank.food) && Number.isFinite(state.bank.wood), 'owned bank observation is required');
  if (catalog) {
    assert.equal(observation.catalogVisible, true, 'catalog must remain visible for its checkpoints');
    assert.equal(observation.grayscale, grayscale, 'icon comparison mode must match its checkpoint');
    assert.equal(observation.catalog?.building.defaultBinding, true, 'live Town Center must use the default render contract');
    assert.equal(observation.catalog?.building.spriteVisible, true, 'Town Center must have its verified loaded sprite');
    assert.equal(observation.catalog?.building.readability, 'unverified', 'automation does not approve readability');
    assert.equal(observation.catalog?.icon.readability, 'unverified', 'automation does not approve icon readability');
    assert.ok(Math.abs(observation.catalog.cameraZoom - zoom) < 1e-6, 'catalog observation must settle at the same zoom');
    assert.deepEqual(observation.samples.map(sample => [sample.width, sample.height]), [[16, 16], [20, 20], [24, 24]]);
    for (const sample of observation.samples) {
      assert.equal(sample.source, '/assets/ui/icons/actions/follow.svg');
      assert.equal(sample.decoded, true, 'live Follow samples must decode');
      assert.equal(sample.visible, true, 'complete glyph and label must be visible inside the panel and viewport');
      assert.equal(sample.objectFit, 'contain'); assert.equal(sample.label, `Follow ${sample.width}`);
    }
  } else assert.equal(observation.catalogVisible, false, 'paid gameplay checkpoints close the developer panel');
  return state;
}

export function validatePaidBarracks(before, after, { complete = false, manifest } = {}) {
  const baselineIds = new Set(before.buildings.map(row => row.id));
  const added = after.buildings.filter(row => row.type === 'barracks' && !baselineIds.has(row.id));
  assert.equal(added.length, 1, 'one new paid Barracks is required');
  const building = added[0];
  assert.equal(building.team, before.team, 'the new Barracks must belong to the paying seat');
  const site = { x: before.team === 0 ? -20.5 : 20.5, z: -6.5 };
  assert.ok(Math.hypot(building.x - site.x, building.z - site.z) < 0.01, 'Barracks must occupy the existing legal pad');
  assert.equal(before.bank.wood - after.bank.wood, BUILDING_DEFINITIONS.barracks.cost.wood, 'ordinary bank must pay the exact Barracks cost');
  assert.equal(before.bank.food - after.bank.food, BUILDING_DEFINITIONS.barracks.cost.food, 'ordinary food payment must match');
  assert.equal(building.complete, complete, 'the checkpoint must retain its real construction state');
  assert.equal(building.groupVisible, true, 'the normal building group must be visible');
  if (complete) {
    assert.equal(building.progress, 1); assert.ok(building.hp > building.maxHp * 0.6, 'healthy Complete art is required');
    assert.equal(building.capture.manifestPath, `/${manifestPath('barracks')}`);
    assert.match(building.capture.requestKey ?? '', /^complete:1:/, 'normal fixed camera must select view 01');
    assert.equal(building.capture.spriteVisible, true); assert.equal(building.capture.bodyDepthVisible, true);
    assert.equal(building.fallbackVisible, false, 'loaded Complete art must replace the retained fallback');
    const { framePixels, pixelsPerWorldUnit, anchorPixelFromTopLeft } = manifest.camera;
    assert.deepEqual(building.capture.scale, framePixels.map(value => value / pixelsPerWorldUnit));
    assert.deepEqual(building.capture.pivot, [anchorPixelFromTopLeft[0] / framePixels[0], 1 - anchorPixelFromTopLeft[1] / framePixels[1]]);
    const view = manifest.completeState.views.find(view => view.index === 1);
    assert.deepEqual(building.capture.view, { path: view.path, sha256: view.sha256 }, 'loaded default view must retain packed pins');
    assert.deepEqual(building.capture.texturePixels, framePixels, 'verified frame must decode its actual pixels');
  } else {
    assert.ok(building.progress >= 0 && building.progress < 1);
    assert.equal(building.capture.spriteVisible, false, 'new Complete-only art must yield during construction');
    assert.equal(building.fallbackVisible, true, 'existing construction fallback must remain visible');
  }
  return building;
}

function workersClearBarracks(state, ids, site) {
  return ids.length > 0 && ids.every(id => {
    const worker = state?.workers?.find(worker => worker.id === id);
    return worker && Number.isFinite(worker.x) && Number.isFinite(worker.z)
      && Math.hypot(worker.x - site.x, worker.z - site.z) > 2.5;
  });
}

export function workerClearanceExpression(ids, site) {
  // JSON objects preserve negative world coordinates without forming `x--20.5`.
  return `(${workersClearBarracks.toString()})(o.state, ${JSON.stringify(ids)}, ${JSON.stringify(site)})`;
}

async function clickPoint(page, point, button = 'left') {
  assert.ok(point && Number.isFinite(point.x) && Number.isFinite(point.y), 'a real screen projection is required');
  await page.cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  for (const type of ['mousePressed', 'mouseReleased']) await page.cdp.call('Input.dispatchMouseEvent', {
    type, x: point.x, y: point.y, button, clickCount: 1 });
}

export async function clickControl(page, selector, label = null) {
  await revealCatalogTarget(page, selector, label);
  const point = await page.cdp.evaluate(`(() => {
    return [...document.querySelectorAll(${JSON.stringify(selector)})].map(node => {
      if (node.disabled || !(${label === null ? 'true' : `node.textContent.includes(${JSON.stringify(label)})`})) return null;
      const rect = node.getBoundingClientRect(), x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      return rect.width > 0 && rect.height > 0 && node.contains(document.elementFromPoint(x, y)) ? {x,y} : null;
    }).find(Boolean) ?? null;
  })()`);
  await clickPoint(page, point);
}

async function revealCatalogTarget(page, selector, label = null) {
  const scroll = await page.cdp.evaluate(`(() => {
    const root = document.querySelector('#asset-readability');
    const node = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find(node => root?.contains(node) && (${label === null ? 'true' : `node.textContent.includes(${JSON.stringify(label)})`}));
    if (!node) return null;
    const target = (node.tagName === 'IMG' ? node.parentElement : node).getBoundingClientRect(), clip = root.getBoundingClientRect();
    return {x:clip.left+clip.width/2, y:clip.top+clip.height/2,
      deltaY:target.top+target.height/2-(clip.top+clip.height/2)};
  })()`);
  if (!scroll || Math.abs(scroll.deltaY) < 1) return;
  await page.cdp.call('Input.dispatchMouseEvent', { type: 'mouseWheel', ...scroll, deltaX: 0 });
  // Wait for normal overflow scrolling, without retrying a failed scenario.
  await page.wait(`(() => {
    const root=document.querySelector('#asset-readability');
    const node=[...document.querySelectorAll(${JSON.stringify(selector)})]
      .find(node=>root?.contains(node) && (${label === null ? 'true' : `node.textContent.includes(${JSON.stringify(label)})`}));
    if(!node)return false;const rect=(node.tagName==='IMG'?node.parentElement:node).getBoundingClientRect(),clip=root.getBoundingClientRect();
    return rect.top>=clip.top && rect.bottom<=clip.bottom;
  })()`, 'visible catalog scroll target');
}

async function projectGround(page, site) {
  return page.cdp.evaluate(`(() => {
    const point = window.__rtsCatalogBarracksCapture.project(${JSON.stringify(site)});
    return point && point.depth >= -1 && point.depth <= 1
      && document.elementFromPoint(point.x, point.y) === document.querySelector('#viewport canvas') ? point : null;
  })()`);
}

export async function loadCatalogRuntime(origin, { fetchImpl = fetch, read = readFile } = {}) {
  const url = new URL(origin);
  assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    && url.origin === origin, 'catalog assets require the owned loopback origin');
  const local = await read(new URL(`../${CATALOG_BARRACKS_MANIFEST}`, import.meta.url));
  const get = async relative => {
    const response = await fetchImpl(`${origin}/${relative}`, { redirect: 'error', signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 200, 'ordinary default asset must be served');
    return Buffer.from(await response.arrayBuffer());
  };
  const served = await get(CATALOG_BARRACKS_MANIFEST);
  assert.equal(hash(served), hash(local), 'served default manifest must match this clean source');
  const manifest = JSON.parse(served), view = manifest.completeState.views.find(row => row.index === 1);
  const viewPath = path.posix.join(path.posix.dirname(CATALOG_BARRACKS_MANIFEST), view.path);
  assert.equal(hash(await get(viewPath)), view.sha256, 'served Complete pixels must match the existing pin');
  return { manifest, manifestSha256: hash(served), defaultView: {
    manifest: CATALOG_BARRACKS_MANIFEST, path: viewPath, sha256: view.sha256 } };
}

export async function runCatalogBarracksScenario({ page, source, runtime, outputDirectory, entryEvidence, team = 0 } = {},
  { capture } = {}) {
  const report = { schemaVersion: 1, scope: 'catalog-and-paid-barracks', status: 'failed', frames: [],
    readability: 'unverified', paidBarracksAcceptance: 'open', issues: [] };
  let stage = 'context';
  try {
    assert.match(source?.revision ?? '', /^[a-f0-9]{40}$/, 'source revision is required');
    assert.match(source?.digest ?? '', /^sha256:[a-f0-9]{64}$/, 'qualified release digest is required');
    assert.equal(typeof capture, 'function', 'the shared source-bound capture hook is required');
    assert.ok(path.isAbsolute(outputDirectory), 'an isolated absolute output directory is required');
    const mapBytes = await readFile(mapSource);
    assert.equal(entryEvidence?.ordinaryEntry, true, 'HUD-owned ordinary entry evidence is required');
    assert.equal(entryEvidence.sourceRevision, source.revision); assert.equal(entryEvidence.mapId, CATALOG_BARRACKS_MAP);
    assert.equal(entryEvidence.mapSha256, hash(mapBytes), 'ordinary map import must match the existing fixture');
    report.source = { revision: source.revision, dirty: false }; report.release = { digest: source.digest };
    report.scenario = { team, mapId: CATALOG_BARRACKS_MAP, mapSha256: hash(mapBytes), entry: 'ordinary-ui' };
    const barracksManifest = runtime.manifest;
    const view = barracksManifest.completeState.views.find(view => view.index === 1);
    const viewPath = path.posix.join(path.posix.dirname(manifestPath('barracks')), view.path);
    assert.deepEqual(runtime.defaultView, { manifest: manifestPath('barracks'), path: viewPath, sha256: view.sha256 },
      'verified served default view must retain existing pins');
    report.defaultView = runtime.defaultView;
    await mkdir(outputDirectory, { recursive: true });
    const observe = () => page.cdp.evaluate(observationExpression);
    const wait = async (predicate, label, timeout = 20000) => page.wait(`(() => {const o=${observationExpression};return (${predicate}) ? o : null;})()`, label, timeout);
    const checkpoint = async (name, options, validate) => {
      const before = await observe(); validateScenarioObservation(before, { team, ...options }); validate?.(before.state);
      const bundle = await capture({ page, mapId: CATALOG_BARRACKS_MAP, checkpoint: name });
      assert.equal(bundle.manifest.source.revision, source.revision, 'shared capture must bind the source');
      assert.equal(bundle.manifest.scene.mapId, CATALOG_BARRACKS_MAP, 'shared capture must bind the applied map');
      assert.equal(bundle.manifest.scene.checkpoint, name, 'shared capture must retain its checkpoint');
      assert.equal(bundle.directory, path.join(outputDirectory, name), 'shared capture must use the owned checkpoint directory');
      const after = await observe(); validateScenarioObservation(after, { team, ...options }); validate?.(after.state);
      assert.ok(after.state.frame >= before.state.frame && after.state.renderedAt >= before.state.renderedAt, 'capture frame observations cannot rewind');
      const evidence = { checkpoint: name, image: bundle.manifest.image, before, after,
        correlation: 'post-render observations bracket the CDP screenshot; not a same-frame canvas claim' };
      await writeFile(path.join(bundle.directory, 'scenario.json'), `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
      report.frames.push({ checkpoint: name, image: bundle.manifest.image, frames: [before.state.frame, after.state.frame] });
    };
    stage = 'catalog';
    await wait('o.state && o.catalog?.building.spriteVisible && o.samples.length === 3 && o.samples.every(s=>s.decoded)', 'live default catalog');
    for (const zoom of [0.91, 0.48]) {
      await clickControl(page, '#asset-readability button', zoom === 0.91 ? 'normal' : 'strategic');
      await wait(`o.state?.zoom === ${zoom} && o.catalog?.cameraZoom === ${zoom}`, 'settled ordinary camera');
      for (const grayscale of [false, true]) {
        if ((await observe()).grayscale !== grayscale) await clickControl(page, '#asset-readability button', 'Grayscale');
        await revealCatalogTarget(page, '#asset-readability img');
        await checkpoint(`catalog-${zoom === 0.91 ? 'ordinary' : 'strategic'}-${grayscale ? 'gray' : 'color'}`,
          { zoom, catalog: true, grayscale });
      }
    }
    await clickControl(page, '#asset-readability button', 'normal');
    await wait('o.state?.zoom === 0.91 && o.catalog?.cameraZoom === 0.91', 'ordinary paid-build camera');
    await clickControl(page, '#asset-readability button', 'Close review');
    stage = 'paid-placement';
    const before = (await observe()).state; report.paymentBefore = before.bank;
    const workerIds = before.workers.map(worker => worker.id);
    assert.ok(workerIds.length > 0, 'the paid scenario requires living owned Workers');
    assert.ok(!before.buildings.some(row => row.type === 'barracks'), 'scenario starts without a paid Barracks');
    await clickControl(page, '[data-open-dock-tab="economy"], [data-context-panel="economy"]');
    await clickControl(page, '#select-workers');
    await wait('o.state?.selectedIds.length > 0 && o.state.workers.some(w=>o.state.selectedIds.includes(w.id))', 'ordinary Worker selection');
    await clickControl(page, '#build-barracks');
    const site = { x: team === 0 ? -20.5 : 20.5, z: -6.5 };
    await clickPoint(page, await projectGround(page, site));
    const placed = await wait('o.state?.buildings.some(b=>b.type==="barracks" && !b.complete)', 'paid Barracks construction', 30000);
    const building = validatePaidBarracks(before, placed.state); report.buildingId = building.id;
    await checkpoint('barracks-paid-construction', { zoom: 0.91 }, state => validatePaidBarracks(before, state));
    stage = 'healthy-complete';
    await wait(`o.state?.buildings.some(b=>b.id===${building.id} && b.complete && b.capture.spriteVisible)`, 'default Complete Barracks', 45000);
    await clickControl(page, '[data-open-dock-tab="economy"], [data-context-panel="economy"]');
    await clickControl(page, '#select-workers');
    await clickControl(page, '#dock-close');
    const away = { x: team === 0 ? -15.5 : 15.5, z: -3.5 };
    await clickPoint(page, await projectGround(page, away), 'right');
    await wait(workerClearanceExpression(workerIds, site), 'Workers clear the ordinary selection point', 30000);
    const complete = (await observe()).state;
    validatePaidBarracks(before, complete, { complete: true, manifest: barracksManifest });
    await clickPoint(page, complete.buildings.find(row => row.id === building.id).screen);
    await wait(`o.state?.selectedBuildingId===${building.id}`, 'ordinary Barracks selection');
    for (const type of ['keyDown', 'keyUp']) await page.cdp.call('Input.dispatchKeyEvent', { type, key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    await checkpoint('barracks-complete-selected-ordinary', { zoom: 0.91 }, state => {
      validatePaidBarracks(before, state, { complete: true, manifest: barracksManifest });
      assert.equal(state.selectedBuildingId, building.id);
    });
    const point = await projectGround(page, site); assert.ok(point, 'normal camera must keep the Barracks on canvas');
    await page.cdp.call('Input.dispatchMouseEvent', { type: 'mouseWheel', x: point.x, y: point.y,
      deltaX: 0, deltaY: Math.log(0.91 / 0.48) * 1000 });
    await wait('o.state && Math.abs(o.state.zoom-0.48)<1e-6', 'ordinary strategic wheel zoom');
    await checkpoint('barracks-complete-selected-strategic', { zoom: 0.48 }, state => {
      validatePaidBarracks(before, state, { complete: true, manifest: barracksManifest });
      assert.equal(state.selectedBuildingId, building.id);
    });
    assert.equal(report.frames.length, 7); report.status = 'captured-needs-review';
  } catch (error) {
    Object.defineProperty(report, 'cause', { value: error });
    report.issues.push({ stage, code: error instanceof assert.AssertionError ? 'contract-failed' : 'execution-failed',
      // Retain causes locally through the caller; artifact messages never echo CDP/session payloads.
      message: error instanceof assert.AssertionError ? error.message.split('\n')[0] : `Scenario failed during ${stage}` });
  }
  if (typeof outputDirectory === 'string' && path.isAbsolute(outputDirectory)) {
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(path.join(outputDirectory, 'catalog-barracks.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  }
  return report;
}
