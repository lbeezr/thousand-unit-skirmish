// Registered version-1 case. The shared runner owns source qualification,
// browser/server lifetime, capture receipts and cleanup; imports start no work.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCaptureContext } from './renderer-capture-context.mjs';
import { checkServedBuildIdentity } from './check-served-build-identity.mjs';
import { CATALOG_BARRACKS_MAP, catalogBarracksBeforeScript, clickControl,
  loadCatalogRuntime, runCatalogBarracksScenario } from './catalog-barracks-scenario.mjs';

export const id = 'building-catalog';
export const contextVersion = 1;
export const CATALOG_MAP_FILE = fileURLToPath(new URL('../docs/qa-evidence/default-frontier-buildings-2026-10-03/acceptance-map-flat.json', import.meta.url));
export const CATALOG_CHECKPOINTS = Object.freeze([
  'catalog-ordinary-color', 'catalog-ordinary-gray', 'catalog-strategic-color', 'catalog-strategic-gray',
  'barracks-paid-construction', 'barracks-complete-selected-ordinary', 'barracks-complete-selected-strategic',
]);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

// Capture the actual chosen file before the ordinary target handler clears the
// input. Retain only size/hash, never the file contents, name, path or URL.
export function installCatalogImportObserver() {
  window.__rtsCatalogMapImport = null;
  document.addEventListener('change', async event => {
    if (event.target?.id !== 'studio-import-file') return;
    const file = event.target.files?.[0];
    if (!file || file.size > 900000) return;
    window.__rtsCatalogMapImport = { ok: false };
    try {
      const bytes = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const sha256 = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
      window.__rtsCatalogMapImport = { ok: true, bytes: bytes.byteLength, sha256 };
    } catch { window.__rtsCatalogMapImport = { ok: false }; }
  }, true);
}

export async function enterCatalogRoom({ page, origin, source }, { read = readFile, click = clickControl } = {}) {
  const bytes = await read(CATALOG_MAP_FILE), mapSha256 = hash(bytes);
  assert.equal(JSON.parse(bytes).id, CATALOG_BARRACKS_MAP, 'the existing authored fixture is required');
  assert.equal(await page.cdp.evaluate('location.href'), 'about:blank', 'catalog entry requires the shared fresh page');
  await page.cdp.call('Page.addScriptToEvaluateOnNewDocument', {
    source: `${catalogBarracksBeforeScript()};(${installCatalogImportObserver.toString()})()`,
  });
  await page.cdp.call('Page.navigate', { url: `${origin}/` });
  await page.wait("document.documentElement.dataset.entry==='menu' && !document.querySelector('#menu-studio')?.disabled", 'ordinary Map Studio menu');
  await click(page, '#menu-studio');
  await page.wait("document.documentElement.dataset.entry==='game' && document.querySelector('#map-studio')?.open", 'ordinary owned studio room', 30000);
  const { root } = await page.cdp.call('DOM.getDocument');
  const { nodeId } = await page.cdp.call('DOM.querySelector', { nodeId: root.nodeId, selector: '#studio-import-file' });
  assert.ok(Number.isInteger(nodeId) && nodeId > 0, 'the real studio file input is required');
  await page.cdp.call('DOM.setFileInputFiles', { nodeId, files: [CATALOG_MAP_FILE] });
  const imported = await page.wait(`window.__rtsCatalogMapImport?.ok && document.querySelector('#studio-id')?.value===${JSON.stringify(CATALOG_BARRACKS_MAP)} && window.__rtsCatalogMapImport`, 'ordinary fixture file import');
  assert.equal(imported.sha256, mapSha256, 'actual imported file must match the existing fixture');
  assert.equal(imported.bytes, bytes.length, 'actual imported file size must match');
  await click(page, '#studio-publish');
  await page.wait(`!document.querySelector('#map-studio')?.open && window.__rtsEnvironmentAssetStatus?.ready && window.__rtsCatalogBarracksCapture?.snapshot?.mapId===${JSON.stringify(CATALOG_BARRACKS_MAP)} && window.__rtsCatalogBarracksCapture.snapshot.team===0 && window.__rtsCatalogBarracksCapture.snapshot.bank.wood===3000 && window.__rtsCatalogBarracksCapture.snapshot.bank.food===2000`, 'ordinary Save & Play applied fixture', 30000);
  return { ordinaryEntry: true, sourceRevision: source.revision, mapId: CATALOG_BARRACKS_MAP, mapSha256 };
}

export async function run(candidate, { identify = checkServedBuildIdentity, load = loadCatalogRuntime,
  enter = enterCatalogRoom, execute = runCatalogBarracksScenario } = {}) {
  const context = validateCaptureContext(candidate);
  const { page, origin, source, capture, evidenceDirectory } = context;
  const report = { schemaVersion: 1, adapterId: id, source: { revision: source.revision, digest: source.digest }, status: 'failed',
    readability: 'unverified', paidBarracksAcceptance: 'open', checkpoints: [], issues: [] };
  let stage = 'served-identity';
  try {
    const identity = await identify(origin, { sourceRevision: source.revision, digest: source.digest });
    assert.equal(identity.ok, true, 'served identity must match the qualified source and release');
    assert.equal(identity.served.sourceDirty, false, 'the served release must be clean');
    stage = 'default-runtime';
    const runtime = await load(origin);
    stage = 'ordinary-entry';
    const entryEvidence = await enter(context);
    report.entry = entryEvidence;
    stage = 'catalog-and-paid-barracks';
    const result = await execute({ page, source, runtime, outputDirectory: evidenceDirectory, entryEvidence, team: 0 }, {
      capture: async options => {
        assert.equal(options.page, page, 'catalog captures require its actual owned page');
        assert.equal(options.mapId, CATALOG_BARRACKS_MAP, 'catalog captures require the applied fixture');
        assert.equal(options.checkpoint, CATALOG_CHECKPOINTS[report.checkpoints.length], 'all seven checkpoints must stay ordered');
        const receipt = await capture(options);
        assert.equal(receipt.manifest.source.revision, source.revision, 'shared capture must retain the source');
        assert.equal(receipt.manifest.scene.mapId, options.mapId, 'shared capture must retain the applied map');
        assert.equal(receipt.manifest.scene.checkpoint, options.checkpoint, 'shared capture must retain the checkpoint');
        assert.equal(receipt.directory, path.join(evidenceDirectory, options.checkpoint), 'shared capture must retain its owned directory');
        report.checkpoints.push({ checkpoint: options.checkpoint, image: receipt.manifest.image });
        return receipt;
      },
    });
    assert.equal(result.status, 'captured-needs-review', 'failed owner sequence must fail the shared case');
    assert.equal(result.readability, 'unverified'); assert.equal(result.paidBarracksAcceptance, 'open');
    assert.deepEqual(result.frames.map(frame => frame.checkpoint), CATALOG_CHECKPOINTS, 'owner sequence must retain all seven frames');
    assert.equal(report.checkpoints.length, 7, 'all frames require actual shared capture receipts');
    report.status = 'captured-needs-review';
  } catch {
    report.issues.push({ stage, code: 'building-catalog-contract-failed' });
  }
  await writeFile(path.join(evidenceDirectory, 'building-catalog-entry.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  const captured = report.status === 'captured-needs-review';
  return { status: captured ? 'passed' : 'failed', checks: [
    { id: 'catalog-source-bound-seven-captures', passed: captured },
    { id: 'catalog-and-paid-barracks-owner-contract', passed: captured },
  ] };
}
