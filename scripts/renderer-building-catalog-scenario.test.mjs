import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { id, contextVersion, run, enterCatalogRoom, installCatalogImportObserver,
  CATALOG_CHECKPOINTS, CATALOG_MAP_FILE } from './renderer-building-catalog-scenario.mjs';
import { CATALOG_BARRACKS_MAP, CATALOG_BARRACKS_MANIFEST, loadCatalogRuntime } from './catalog-barracks-scenario.mjs';
import { CAPTURE_CASES, loadCaptureCases, validateCaseResult } from './renderer-feature-capture.mjs';
import { validateCaptureAdapter } from './renderer-capture-context.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const mapBytes = await readFile(CATALOG_MAP_FILE);
const source = Object.freeze({ revision: 'a'.repeat(40), digest: `sha256:${'b'.repeat(64)}`, privateExtra: 'excluded-private-value' });
const entry = { ordinaryEntry: true, sourceRevision: source.revision, mapId: CATALOG_BARRACKS_MAP, mapSha256: hash(mapBytes) };
const manifestBytes = await readFile(new URL(`../${CATALOG_BARRACKS_MANIFEST}`, import.meta.url));
const manifest = JSON.parse(manifestBytes), view = manifest.completeState.views.find(row => row.index === 1);
const viewPath = path.posix.join(path.posix.dirname(CATALOG_BARRACKS_MANIFEST), view.path);
const viewBytes = await readFile(new URL(`../${viewPath}`, import.meta.url));
const runtime = { manifest, manifestSha256: hash(manifestBytes), defaultView: { manifest: CATALOG_BARRACKS_MANIFEST, path: viewPath, sha256: view.sha256 } };

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'rts-building-wrapper-test-'));
  const calls = [], captures = [];
  const page = { cdp: {
    evaluate: async expression => { calls.push(['evaluate', expression]); return 'about:blank'; },
    call: async (method, params) => {
      calls.push([method, params]);
      return method === 'DOM.getDocument' ? { root: { nodeId: 1 } }
        : method === 'DOM.querySelector' ? { nodeId: 2 } : {};
    },
  }, wait: async (expression, description) => {
    calls.push(['wait', expression, description]);
    return description === 'ordinary fixture file import' ? { ok: true, bytes: mapBytes.length, sha256: hash(mapBytes) } : true;
  } };
  const context = Object.freeze({ version: 1, page, openPage: async () => { assert.fail('case needs no extra page'); },
    origin: 'http://127.0.0.1:4321', source, evidenceDirectory: directory,
    capture: async ({ page: selectedPage, mapId, checkpoint }) => {
      assert.equal(selectedPage, page); captures.push(checkpoint);
      return { directory: path.join(directory, checkpoint), manifest: {
        source: { revision: source.revision, dirty: false }, scene: { mapId, checkpoint },
        image: { file: 'color.png', sha256: 'c'.repeat(64) },
      } };
    } });
  const execute = async (options, { capture }) => {
    assert.equal(options.page, page); assert.equal(options.source, source); assert.equal(options.runtime, runtime);
    assert.deepEqual(options.entryEvidence, entry); assert.equal(options.outputDirectory, directory);
    assert.equal('pack' in options, false); assert.equal('browserVersion' in options, false);
    for (const checkpoint of CATALOG_CHECKPOINTS) await capture({ page, mapId: CATALOG_BARRACKS_MAP, checkpoint });
    return { status: 'captured-needs-review', readability: 'unverified', paidBarracksAcceptance: 'open',
      frames: CATALOG_CHECKPOINTS.map(checkpoint => ({ checkpoint })) };
  };
  const dependencies = {
    identify: async (origin, expected) => {
      assert.equal(origin, context.origin); assert.deepEqual(expected, { sourceRevision: source.revision, digest: source.digest });
      return { ok: true, served: { sourceDirty: false } };
    }, load: async origin => { assert.equal(origin, context.origin); return runtime; },
    enter: candidate => enterCatalogRoom(candidate, { click: async (_, selector) => calls.push(['click', selector]) }), execute,
  };
  return { context, dependencies, page, calls, captures, directory,
    dispose: () => rm(directory, { recursive: true, force: true }) };
}

test('actual registered exports and all four owner imports load without launching work', async () => {
  assert.equal(id, 'building-catalog'); assert.equal(contextVersion, 1);
  assert.equal(CAPTURE_CASES[id], './renderer-building-catalog-scenario.mjs');
  const loaded = await loadCaptureCases('all');
  assert.deepEqual(loaded.issues, []); assert.deepEqual(loaded.adapters.map(adapter => adapter.id), Object.keys(CAPTURE_CASES));
  validateCaptureAdapter(await import('./renderer-building-catalog-scenario.mjs'), id);
});

test('version-1 wrapper uses actual studio input sequence and seven source-bound shared captures', async () => {
  const f = await fixture();
  try {
    const result = await run(f.context, f.dependencies);
    assert.equal(result.status, 'passed'); assert.ok(result.checks.every(check => check.passed));
    assert.deepEqual(f.captures, CATALOG_CHECKPOINTS); validateCaseResult(result, f.captures);
    assert.deepEqual(f.calls.filter(([method]) => method === 'click').map(([, selector]) => selector), ['#menu-studio', '#studio-publish']);
    const upload = f.calls.find(([method]) => method === 'DOM.setFileInputFiles');
    assert.deepEqual(upload[1], { nodeId: 2, files: [CATALOG_MAP_FILE] });
    assert.deepEqual(f.calls.find(([method]) => method === 'Page.navigate')[1], { url: `${f.context.origin}/` });
    const before = f.calls.find(([method]) => method === 'Page.addScriptToEvaluateOnNewDocument')[1].source;
    assert.match(before, /installRoomFlags/); assert.match(before, /installCatalogImportObserver/);
    const evidence = JSON.parse(await readFile(path.join(f.directory, 'building-catalog-entry.json')));
    assert.equal(evidence.status, 'captured-needs-review'); assert.equal(evidence.readability, 'unverified');
    assert.equal(evidence.paidBarracksAcceptance, 'open'); assert.deepEqual(evidence.entry, entry);
    assert.deepEqual(evidence.source, { revision: source.revision, digest: source.digest });
    assert.doesNotMatch(JSON.stringify(evidence), /excluded-private-value|room=|file:\/\//);
  } finally { await f.dispose(); }
});

test('invalid context rejects before identity, browser or artifact work', async () => {
  const f = await fixture();
  try {
    for (const changed of [{ ...f.context, version: 2 }, { ...f.context, origin: 'https://private.invalid' },
      { ...f.context, source: { ...source } }, { ...f.context, capture: undefined }, { ...f.context, evidenceDirectory: '../private' }]) {
      await assert.rejects(run(changed, { identify() { assert.fail('invalid context read identity'); } }));
    }
    assert.deepEqual(f.calls, []); assert.deepEqual(await readdir(f.directory), []);
  } finally { await f.dispose(); }
});

test('mismatched or dirty served identity fails before ordinary navigation or capture', async () => {
  for (const identity of [{ ok: false }, { ok: true, served: { sourceDirty: true } }, { ok: true, served: { sourceDirty: null } }]) {
    const f = await fixture();
    try {
      const result = await run(f.context, { ...f.dependencies, identify: async () => identity });
      assert.equal(result.status, 'failed'); assert.deepEqual(f.calls, []); assert.deepEqual(f.captures, []);
      const evidence = JSON.parse(await readFile(path.join(f.directory, 'building-catalog-entry.json')));
      assert.deepEqual(evidence.issues, [{ stage: 'served-identity', code: 'building-catalog-contract-failed' }]);
    } finally { await f.dispose(); }
  }
});

test('verified public defaults reject changed manifests, changed pixels, absent assets and remote origins', async () => {
  for (const defect of [null, 'manifest', 'view', 'missing']) {
    const fetchImpl = async url => {
      const relative = new URL(url).pathname.slice(1);
      return new Response(defect === 'manifest' && relative === CATALOG_BARRACKS_MANIFEST ? 'changed'
        : defect === 'view' && relative === viewPath ? 'changed'
        : relative === CATALOG_BARRACKS_MANIFEST ? manifestBytes : viewBytes, { status: defect === 'missing' ? 404 : 200 });
    };
    if (defect) await assert.rejects(loadCatalogRuntime('http://127.0.0.1:4321', { fetchImpl }));
    else assert.deepEqual(await loadCatalogRuntime('http://127.0.0.1:4321', { fetchImpl }), runtime);
  }
  await assert.rejects(loadCatalogRuntime('https://private.invalid', { fetchImpl() { assert.fail('remote origin fetched'); } }));
});

test('literal passive import observer retains actual bytes before native handler clears input', async () => {
  const window = {}; let listener;
  vm.runInNewContext(`(${installCatalogImportObserver.toString()})()`, { window, crypto: webcrypto, Uint8Array,
    document: { addEventListener(type, callback, capture) { assert.equal(type, 'change'); assert.equal(capture, true); listener = callback; } } });
  await listener({ target: { id: 'another-input', files: [] } }); assert.equal(window.__rtsCatalogMapImport, null);
  const target = { id: 'studio-import-file', files: [{ size: mapBytes.length,
    arrayBuffer: async () => Uint8Array.from(mapBytes).buffer }] };
  const pending = listener({ target }); target.files = []; await pending;
  assert.equal(window.__rtsCatalogMapImport.sha256, hash(mapBytes)); assert.equal(window.__rtsCatalogMapImport.bytes, mapBytes.length);
  assert.equal(Object.keys(window.__rtsCatalogMapImport).sort().join(','), 'bytes,ok,sha256');
  await listener({ target: { id: 'studio-import-file', files: [{ size: 1, arrayBuffer: async () => { throw Error('private-file-name'); } }] } });
  assert.equal(window.__rtsCatalogMapImport.ok, false); assert.doesNotMatch(JSON.stringify(window), /private-file-name/);
});

test('ordinary entry rejects a reused page or substituted uploaded bytes before publish', async () => {
  for (const defect of ['page', 'file', 'node']) {
    const f = await fixture();
    try {
      if (defect === 'page') f.page.cdp.evaluate = async () => 'http://127.0.0.1:4321/?room=private';
      if (defect === 'file') f.page.wait = async (_, label) => label === 'ordinary fixture file import'
        ? { ok: true, bytes: mapBytes.length, sha256: '0'.repeat(64) } : true;
      if (defect === 'node') f.page.cdp.call = async method => method === 'DOM.getDocument' ? { root: { nodeId: 1 } } : { nodeId: 0 };
      await assert.rejects(enterCatalogRoom(f.context, { click: async (_, selector) => f.calls.push(['click', selector]) }));
      assert.equal(f.calls.some(([method, selector]) => method === 'click' && selector === '#studio-publish'), false);
    } finally { await f.dispose(); }
  }
});

test('returned owner failure and private capture errors fail the shared case, retaining reduced partial receipts', async () => {
  for (const defect of ['returned', 'capture', 'missing', 'reordered', 'approval']) {
    const f = await fixture();
    try {
      const execute = async (_, { capture }) => {
        if (defect === 'capture') throw Error('room=private-session');
        if (defect === 'reordered') await capture({ page: f.page, mapId: CATALOG_BARRACKS_MAP, checkpoint: CATALOG_CHECKPOINTS[1] });
        if (defect === 'returned') await capture({ page: f.page, mapId: CATALOG_BARRACKS_MAP, checkpoint: CATALOG_CHECKPOINTS[0] });
        if (defect === 'approval') await f.dependencies.execute(_, { capture });
        return { status: defect === 'returned' ? 'failed' : 'captured-needs-review', readability: defect === 'approval' ? 'approved' : 'unverified',
          paidBarracksAcceptance: 'open', frames: CATALOG_CHECKPOINTS.map(checkpoint => ({ checkpoint })) };
      };
      const result = await run(f.context, { ...f.dependencies, execute });
      assert.equal(result.status, 'failed'); assert.ok(result.checks.every(check => !check.passed));
      const evidence = JSON.parse(await readFile(path.join(f.directory, 'building-catalog-entry.json')));
      assert.equal(evidence.status, 'failed'); assert.doesNotMatch(JSON.stringify(evidence), /private-session/);
      if (defect === 'returned') assert.equal(evidence.checkpoints.length, 1);
      if (defect === 'reordered') assert.equal(f.captures.length, 0);
    } finally { await f.dispose(); }
  }
});

test('shared capture failures and mismatched receipts cannot pass the owner wrapper', async () => {
  for (const defect of ['failure', 'source', 'map', 'checkpoint', 'directory']) {
    const f = await fixture();
    try {
      const context = { ...f.context, capture: async options => {
        if (defect === 'failure') throw Error('private-shared-cdp-message');
        const receipt = await f.context.capture(options);
        if (defect === 'source') receipt.manifest.source.revision = '0'.repeat(40);
        if (defect === 'map') receipt.manifest.scene.mapId = 'open-field';
        if (defect === 'checkpoint') receipt.manifest.scene.checkpoint = 'other-checkpoint';
        if (defect === 'directory') receipt.directory = path.join(f.directory, 'other-case');
        return receipt;
      } };
      const result = await run(context, f.dependencies);
      assert.equal(result.status, 'failed');
      const evidence = await readFile(path.join(f.directory, 'building-catalog-entry.json'), 'utf8');
      assert.doesNotMatch(evidence, /private-shared-cdp-message/);
      assert.equal(JSON.parse(evidence).checkpoints.length, 0);
    } finally { await f.dispose(); }
  }
});
