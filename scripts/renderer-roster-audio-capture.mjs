// Public staging, fresh disposable browser context, ordinary Map Studio import
// and paid gameplay. Native output capture is evidence, never a listening pass.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_GAME_AUDIO_REFERENCE } from '../src/audio-shipped-catalog.mjs';
import { BUILDING_DEFINITIONS as B, TECHNOLOGY_DEFINITIONS as T } from '../src/gameplay-definitions.mjs';
import { UNIT_DEFINITIONS as U } from '../src/gameplay-definitions.mjs';
import { installInteractionAudioProbe, interactionTargetPoint, validateAudioObservation } from './renderer-interaction-audio-scenario.mjs';
import { installCatalogImportObserver } from './renderer-building-catalog-scenario.mjs';
import { clickNovicePoint } from './renderer-qualification-novice.mjs';
import { buildingPad, paidUnitPlan, recordingCoverage, rosterMap, rosterPlan, validateStagingOrigin } from './renderer-roster-audio-plan.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const stateExpression = 'window.__rtsInteractionAudioSnapshot()';
const sourcePaths = ['src/main.js', 'src/audio.mjs', 'src/audio-policy.mjs', 'src/audio-shipped-catalog.mjs',
  'src/audio-shipped-loader.mjs', 'src/client/audio/shipped-audio-worker-client.mjs', 'src/client/audio/shipped-audio-worker.mjs'];
const manifestPath = `assets/audio/runtime/${DEFAULT_GAME_AUDIO_REFERENCE.packId}/${DEFAULT_GAME_AUDIO_REFERENCE.version}/manifest.json`;

// Deliberately no access to protected /health, cookies, tokens or auth headers.
// These public bytes bind evidence to checkout files, not to a deployment SHA
// or clean-release digest. The owner records those identities separately.
export async function identifyPublicAudioSource(origin, revision, { fetcher = fetch, read = file => readFile(new URL(`../${file}`, import.meta.url)) } = {}) {
  validateStagingOrigin(origin); assert.match(revision, /^[a-f0-9]{40}$/);
  const files = [];
  async function verify(file, expected, maxBytes = 2000000) {
    assert.match(file, /^[a-zA-Z0-9/_-]+\.(?:mjs|js|json|mp3|wav|ogg)$/);
    const response = await fetcher(`${origin}/${file}`, { redirect: 'error', signal: AbortSignal.timeout(15000), credentials: 'omit' });
    assert.equal(response.status, 200, 'public source unavailable');
    const chunks = []; let size = 0;
    for await (const chunk of response.body) { size += chunk.length; assert.ok(size <= maxBytes, 'public source size bound'); chunks.push(chunk); }
    const bytes = Buffer.concat(chunks), sha256 = hash(bytes);
    assert.equal(sha256, expected, 'served public source differs from checkout');
    files.push({ path: `/${file}`, bytes: bytes.length, sha256 }); return bytes;
  }
  for (const file of sourcePaths) await verify(file, hash(await read(file)));
  const bytes = await verify(manifestPath, DEFAULT_GAME_AUDIO_REFERENCE.sha256);
  const manifest = JSON.parse(bytes), rows = Object.values(manifest.downloads);
  assert.ok(rows.length > 0 && rows.length <= 128);
  // Four bounded requests, mirroring shipped loading; never a request per frame.
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < rows.length) {
      const row = rows[next++];
      assert.match(row.path, /^\/assets\/audio\/[a-zA-Z0-9/_-]+\.(?:mp3|wav|ogg)$/);
      await verify(row.path.slice(1), row.sha256, row.bytes);
    }
  }));
  return { manifest, identity: { expectedRevision: revision, identityScope: 'exact-public-file-hashes',
    deployedRevision: null, releaseDigest: null, files: files.sort((a, b) => a.path.localeCompare(b.path)) } };
}

// Select a real visible enabled control, accounting for the HUD's aria-disabled
// contract and duplicated hidden legacy controls. Returned text is never logged.
export function rosterControlPoint(selector) {
  for (const element of document.querySelectorAll(selector)) {
    if (element.disabled || element.getAttribute('aria-disabled') === 'true' || element.closest('[hidden]')) continue;
    const r = element.getBoundingClientRect(); if (!r.width || !r.height) continue;
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const after = element.getBoundingClientRect(), x = after.x + after.width / 2, y = after.y + after.height / 2;
    if (element.contains(document.elementFromPoint(x, y))) return { x, y };
  }
  return null;
}
const controlExpression = selector => `(${rosterControlPoint.toString()})(${JSON.stringify(selector)})`;
export async function rosterControl(page, selector, timeoutMs = 20000) {
  const point = await page.wait(controlExpression(selector), 'visible enabled public control', timeoutMs);
  await clickNovicePoint(page, point);
}
async function key(page, value) {
  const code = value === 'Escape' ? 'Escape' : `Key${value.toUpperCase()}`;
  await page.cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', key: value, code });
  await page.cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', key: value, code });
}
async function target(page, kind, id) {
  return page.wait(`(${interactionTargetPoint.toString()})(${JSON.stringify(kind)},${JSON.stringify(id)})`, 'exact visible ordinary target');
}
async function project(page, point) {
  return page.wait(`window.__rtsInteractionAudioProject(${point.x},${point.z})`, 'visible world point');
}
export async function enterRosterRoom(page, origin, map, mapFile, mapBytes) {
  validateStagingOrigin(origin);
  assert.equal(await page.cdp.evaluate('location.href'), 'about:blank', 'fresh isolated context required');
  await page.cdp.call('Page.addScriptToEvaluateOnNewDocument', { source: `window.__rtsCaptureDiagnostics=true;
    (${installInteractionAudioProbe.toString()})();(${installCatalogImportObserver.toString()})()` });
  await page.cdp.call('Page.navigate', { url: `${origin}/` });
  await page.wait('document.documentElement?.dataset.entry === "menu" && document.querySelector("#menu-studio")?.disabled === false', 'ordinary menu');
  await rosterControl(page, '#menu-studio');
  await page.wait('document.documentElement?.dataset.entry === "game" && document.querySelector("#map-studio")?.open', 'new owned studio room', 35000);
  const { root } = await page.cdp.call('DOM.getDocument');
  const { nodeId } = await page.cdp.call('DOM.querySelector', { nodeId: root.nodeId, selector: '#studio-import-file' });
  assert.ok(Number.isInteger(nodeId) && nodeId > 0);
  await page.cdp.call('DOM.setFileInputFiles', { nodeId, files: [mapFile] });
  const imported = await page.wait(`window.__rtsCatalogMapImport?.ok && document.querySelector('#studio-id')?.value === ${JSON.stringify(map.id)} && window.__rtsCatalogMapImport`, 'ordinary authored map import');
  assert.equal(imported.sha256, hash(mapBytes)); assert.equal(imported.bytes, mapBytes.length);
  await rosterControl(page, '#studio-publish');
  await page.wait(`!document.querySelector('#map-studio')?.open && ${stateExpression}?.mapId === ${JSON.stringify(map.id)} && ${stateExpression}.team === 0`, 'ordinary Save & Play applies map', 35000);
  await rosterControl(page, '#camera-fit-map');
  return { method: 'menu-studio-file-import-save-and-play', mapId: map.id, mapSha256: hash(mapBytes),
    room: 'fresh-owned-public-room', recovery: 'normal-server-checkpoint', credentialsRetained: false };
}

export async function persistRosterRecording({ report, directory, key: cue, output, allowedHashes, persist }) {
  // Preserve bounded native output before any subsequent CDP call. Invalid
  // receipts remain diagnostic-only, and cannot satisfy planned coverage.
  const { base64, ...metadata } = output;
  report.lastOutput = { key: cue, ...metadata }; await persist();
  if (typeof base64 === 'string' && base64.length < 1000000) {
    const bytes = Buffer.from(base64, 'base64');
    if (bytes.length > 1000 && bytes.subarray(0, 4).equals(Buffer.from('1a45dfa3', 'hex'))) {
      const file = `${cue}.webm`;
      await writeFile(path.join(directory, file), bytes, { flag: 'wx' });
      report.lastOutput.file = file; report.lastOutput.sha256 = hash(bytes); await persist();
    }
  }
  const verified = validateAudioObservation(output, allowedHashes);
  report.recordings.push({ key: cue, file: report.lastOutput.file, sha256: verified.sha256,
    sourceSha256: verified.sourceSha256, validated: true, ...metadata });
  delete report.lastOutput; await persist();
}

function screenshotView() {
  return { origin: location.origin, width: innerWidth, height: innerHeight, scale: devicePixelRatio,
    boot: document.documentElement?.dataset.boot, entry: document.documentElement?.dataset.entry,
    mapId: window.__rtsInteractionAudioSnapshot?.().mapId, requestedMapId: document.querySelector('#map-select')?.value,
    connection: document.querySelector('#network-status')?.textContent };
}
export function validateRosterFrame(view, mapId, base64) {
  validateStagingOrigin(view.origin);
  assert.equal(view.boot, 'ready'); assert.equal(view.entry, 'game');
  assert.equal(view.mapId, mapId); assert.equal(view.requestedMapId, mapId);
  assert.ok(['ROOM LIVE', 'WAITING FOR PLAYER 2'].includes(view.connection), 'synced ordinary game required');
  assert.equal(view.width, 1280); assert.equal(view.height, 720); assert.equal(view.scale, 1);
  assert.ok(typeof base64 === 'string' && base64.length < 14000000);
  const bytes = Buffer.from(base64, 'base64');
  assert.ok(bytes.length > 1000 && bytes.toString('base64') === base64
    && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')));
  let offset = 8, data = false, end = false;
  while (offset + 12 <= bytes.length) {
    const size = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8);
    assert.ok(size <= bytes.length - offset - 12);
    if (offset === 8) { assert.equal(type, 'IHDR'); assert.equal(size, 13); assert.equal(bytes.readUInt32BE(offset + 8), 1280); assert.equal(bytes.readUInt32BE(offset + 12), 720); }
    else assert.notEqual(type, 'IHDR');
    if (type === 'IDAT' && size) data = true;
    offset += size + 12;
    if (type === 'IEND') { end = size === 0 && offset === bytes.length; break; }
  }
  assert.ok(data && end, 'complete native PNG required'); return bytes;
}

export async function captureRosterSubset({ page, origin, revision, subset, directory, manifest, identity, signal }) {
  const startedAt = Date.now();
  const plan = rosterPlan(subset), map = rosterMap(subset), mapBytes = Buffer.from(JSON.stringify(map, null, 2) + '\n');
  const bindings = manifest.pack.profiles.find(profile => profile.id === 'interactions').bindings;
  const report = { schemaVersion: 1, subset, status: 'failed', source: identity, expectedRevision: revision,
    mapId: map.id, maxDurationMs: plan.timeoutMs, recordings: [], paidSteps: [], issues: [], coverage: null };
  const reportFile = path.join(directory, 'roster-audio.json');
  const persist = async () => {
    report.elapsedMs = Date.now() - startedAt;
    report.coverage = recordingCoverage(Object.keys(bindings), plan.keys, report.recordings);
    await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
  };
  await writeFile(reportFile, '{}\n', { flag: 'wx' }); await persist();
  const mapFile = path.join(directory, 'authored-map.json'); await writeFile(mapFile, mapBytes, { flag: 'wx' });
  let stage = 'ordinary-entry';
  const check = () => signal?.throwIfAborted();
  const state = () => { check(); return page.cdp.evaluate(stateExpression); };
  const select = async (kind, id) => { check(); await clickNovicePoint(page, await target(page, kind, id)); };
  const findBuilding = type => page.wait(`${stateExpression}.buildings.find(b => b.type === ${JSON.stringify(type)} && b.complete)`, 'paid complete building', 60000);
  async function record(cue, action) {
    check(); stage = cue;
    const before = (await state()).inspector.decisions.filter(d => d.key === cue && d.outcome === 'sample scheduled').length;
    const allowed = bindings[cue].variants.map(v => manifest.downloads[v.sourceId].sha256);
    await page.cdp.evaluate(`window.__rtsInteractionAudio.begin(${JSON.stringify(allowed)})`);
    await action();
    stage = `${cue}-output`;
    await page.wait('Boolean(window.__rtsInteractionAudio.recording?.result)', 'native output finalized', 45000);
    const output = await page.cdp.evaluate('window.__rtsInteractionAudio.finish()');
    await persistRosterRecording({ report, directory, key: cue, output, allowedHashes: allowed, persist });
    const decisions = (await state()).inspector.decisions;
    assert.ok(decisions.filter(d => d.key === cue && d.outcome === 'sample scheduled').length > before, 'actual ordinary action schedules this cue');
    report.recordings.at(-1).ordinaryActionObserved = true; await persist();
  }
  async function research(id, type) {
    check(); stage = `research-${id}`;
    const building = await findBuilding(type); await select('building', building.id);
    await rosterControl(page, '[data-building-action="research"]');
    await rosterControl(page, `[data-context-research-options] [data-technology="${id}"]`);
    await page.wait(`Array.from(document.querySelectorAll('[data-context-research-options] [data-technology="${id}"]')).some(e => e.textContent.includes('ALREADY COMPLETED'))`, 'paid research completes', 55000);
    report.paidSteps.push({ research: id, building: type }); await persist();
  }
  const completedResearch = new Set();
  async function ensureResearch(id) {
    if (completedResearch.has(id)) return;
    for (const parent of T[id].requires ?? []) await ensureResearch(parent);
    await research(id, T[id].building); completedResearch.add(id);
  }
  async function build(type) {
    check(); stage = `build-${type}`;
    for (const id of B[type].requires ?? []) await ensureResearch(id);
    if (await page.cdp.evaluate('document.querySelector("#command-deck").hidden')) await rosterControl(page, '#dock-toggle');
    await rosterControl(page, '#dock-tab-economy'); await rosterControl(page, '#select-workers');
    await rosterControl(page, '#dock-toggle');
    await rosterControl(page, '[data-worker-action="build"]');
    await rosterControl(page, `[data-worker-build="${type}"]`);
    const point = await project(page, buildingPad(type));
    await page.cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await page.wait('window.__rtsBuildingPlacementSnapshot?.active && window.__rtsBuildingPlacementSnapshot.valid', 'ordinary valid paid site');
    await clickNovicePoint(page, point);
    const building = await findBuilding(type);
    report.paidSteps.push({ build: type, id: building.id, complete: true }); await persist(); return building;
  }
  try {
    report.entry = await enterRosterRoom(page, origin, map, mapFile, mapBytes); await persist();
    stage = 'default-audio-ready';
    await page.wait(`${stateExpression}.inspector.bindings.length === ${Object.keys(bindings).length} && ${stateExpression}.inspector.bindings.every(b => b.sources.every(s => s.available))`, 'all default samples available', 35000);
    const opening = await state(), unlock = opening.units.find(unit => unit.kind === 'worker' && unit.point);
    assert.ok(unlock); await select('unit', unlock.id);
    await page.wait(`${stateExpression}.status === 'running' && window.__rtsInteractionAudio.stream`, 'gesture unlocks native output');
    // Real cooldown, not clock acceleration or a synthetic audio action.
    await new Promise(resolve => setTimeout(resolve, 3500));
    if (plan.workerJobs) {
      await record('unit.worker.build', () => build('farm'));
      const worker = (await state()).units.find(unit => unit.kind === 'worker');
      await select('unit', worker.id);
      const gatherNode = async id => {
        const node = await page.cdp.evaluate(`window.__rtsEnvironmentStateSnapshot.resourceNodes.find(n => n.id === ${JSON.stringify(id)})`);
        assert.ok(node); await clickNovicePoint(page, await project(page, node), 'right');
      };
      await record('unit.worker.gather.food', () => gatherNode('s0-food'));
      await page.wait(controlExpression('[data-worker-action="return"]'), 'real cargo enables Worker Return', 30000);
      await record('unit.worker.return-cargo', () => rosterControl(page, '[data-worker-action="return"]'));
      await record('unit.worker.gather.farm', async () => {
        await clickNovicePoint(page, await target(page, 'building', (await findBuilding('farm')).id), 'right');
      });
      await record('unit.worker.gather.fish', () => gatherNode('audio-fish'));
      await record('unit.worker.gather.stone', () => gatherNode('audio-stone'));
      // Ordinary gathering activates a live Sheep when the Worker arrives;
      // only a subsequent order to its disclosed carcass gets this job cue.
      await gatherNode('audio-sheep');
      await page.wait('window.__rtsEnvironmentStateSnapshot.resourceNodes.some(n => n.id === "audio-sheep" && n.wildlifeState === "carcass" && n.stock > 0)', 'ordinary harvest creates disclosed carcass', 45000);
      await key(page, 's');
      await record('unit.worker.gather.sheep-carcass', () => gatherNode('audio-sheep'));
    } else if (plan.kind) {
      let trainedUnitId = null;
      for (const step of paidUnitPlan(plan.kind)) {
        if (step.build) await build(step.build);
        if (step.research) await ensureResearch(step.research);
        if (step.train) {
          stage = `train-${step.train}`;
          const producer = await findBuilding(step.at); await select('building', producer.id);
          const priorIds = (await state()).units.map(unit => unit.id);
          const queue = () => rosterControl(page, `[data-context-products] [data-product="${step.train}"]`);
          // Fast queues are armed before clicking. Siege's 30-second queue is
          // observed partway through, within the unchanged 30-second arm bound.
          if (U[step.train].trainSeconds >= 30) {
            await queue();
            await page.wait(`(() => { const e=document.querySelector('[data-building-progress]'); return e && !e.hidden && e.value >= .25 && e.value < .9; })()`, 'ordinary paid training advances', 40000);
          }
          await record(`unit.${step.train}.ready`, async () => {
            if (U[step.train].trainSeconds < 30) await queue();
            const trained = await page.wait(`${stateExpression}.units.find(u => u.kind === ${JSON.stringify(step.train)} && !${JSON.stringify(priorIds)}.includes(u.id))`, 'paid trained unit appears', 35000);
            trainedUnitId = trained.id;
          });
          report.paidSteps.push({ train: step.train, producer: step.at }); await persist();
        }
      }
      const unit = (await state()).units.find(row => row.id === trainedUnitId && row.kind === plan.kind);
      assert.ok(unit, 'the actual owned roster unit is required');
      const town = await findBuilding('town-center'); await select('building', town.id);
      await new Promise(resolve => setTimeout(resolve, 3500));
      await record(`unit.${plan.kind}.select`, () => select('unit', unit.id));
      const ground = plan.kind === 'skiff' ? { x: -11.5, z: 14.5 } : { x: -17.5, z: 5.5 };
      const order = async (hotkey, point) => { if (hotkey) await key(page, hotkey); await clickNovicePoint(page, await project(page, point), 'right'); };
      await record(`unit.${plan.kind}.move`, () => order(null, ground));
      await record(`unit.${plan.kind}.stop`, () => key(page, 's'));
      await record(`unit.${plan.kind}.hold`, () => key(page, 'h'));
      if (plan.kind !== 'skiff') {
        await record(`unit.${plan.kind}.patrol`, () => order('p', { x: -13.5, z: 5.5 }));
        await record(`unit.${plan.kind}.follow`, async () => {
          const friend = (await state()).units.find(row => row.id !== unit.id && row.point);
          assert.ok(friend); await key(page, 'f'); await clickNovicePoint(page, await target(page, 'unit', friend.id), 'right');
        });
        await record(`unit.${plan.kind}.attack`, () => order('m', ground));
      }
      if (plan.kind === 'worker') await record('unit.worker.gather.wood', () => order(null, map.resourceNodes.find(node => node.id === 's0-wood')));
      if (plan.kind === 'skiff') {
        await record('unit.skiff.gather.food', () => order(null, map.resourceNodes.find(node => node.id === 'audio-fish')));
        await page.wait(controlExpression('[data-return-cargo]'), 'actual Skiff food cargo enables Return', 25000);
        await record('unit.skiff.return-cargo', () => rosterControl(page, '[data-return-cargo]'));
      }
    } else {
      for (const type of plan.buildings) {
        const building = type === 'town-center' ? await findBuilding(type) : await build(type);
        await record(`building.${type}.select`, () => select('building', building.id));
      }
    }
    stage = 'ordinary-frame'; check();
    const expression = `(${screenshotView.toString()})()`;
    const before = await page.cdp.evaluate(expression);
    const screenshot = await page.cdp.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const after = await page.cdp.evaluate(expression);
    const bytes = validateRosterFrame(before, map.id, screenshot.data);
    validateRosterFrame(after, map.id, screenshot.data);
    await writeFile(path.join(directory, 'ordinary-game.png'), bytes, { flag: 'wx' });
    report.frame = { file: 'ordinary-game.png', sha256: hash(bytes), width: 1280, height: 720, visualReview: 'pending' };
    assert.equal(recordingCoverage(Object.keys(bindings), plan.keys, report.recordings).missingPlannedKeys.length, 0);
    report.status = 'captured-needs-listening';
  } catch (error) {
    report.issues.push({ stage, code: signal?.aborted ? 'subset-deadline' : /timeout/i.test(error?.message) ? 'wait-timeout' : 'capture-contract-failed' });
    try {
      report.diagnostic = await page.cdp.evaluate(`(() => { const s=window.__rtsInteractionAudioSnapshot?.(), p=window.__rtsInteractionAudio;
        return { boot:document.documentElement?.dataset.boot ?? null, mapId:s?.mapId ?? null, audioStatus:s?.status ?? null,
        bindingCount:s?.inspector.bindings.length ?? 0, decisions:s?.inspector.decisions.slice(-12) ?? [],
        nativeStarts:p?.starts.slice(-12) ?? [], faults:p?.faults ?? [], recordingPhase:p?.recording?.phase ?? null }; })()`);
    } catch { report.diagnostic = { unavailable: true }; }
  }
  await persist(); return report;
}
