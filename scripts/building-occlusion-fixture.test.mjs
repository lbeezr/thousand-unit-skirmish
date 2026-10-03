import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { buildingSpriteUrl } from '../src/building-sprites.mjs';
import { crowdedBuildingSpecs, detailBuildingSpecs, summarizeSamples } from './building-occlusion-fixture.mjs';
import { createGpuSampler, readGpuIdentity } from './building-occlusion-metrics.mjs';
import { createBuildingOcclusionReviewServer } from './serve-building-occlusion-review.mjs';
import { extractBuildingOcclusionEvidence } from './extract-building-occlusion-evidence.mjs';

test('crowded fixture covers all 20 unchanged frames, unique pads and the renderer-only 129th building', () => {
  for (const count of [32, 128, 129]) {
    const specs = crowdedBuildingSpecs(count);
    assert.equal(specs.length, count);
    assert.equal(new Set(specs.map(spec => `${spec.x},${spec.z}`)).size, count);
    assert.equal(new Set(specs.map(buildingSpriteUrl)).size, 20);
    assert.ok(specs.every(spec => Math.abs(spec.x) < 64 && Math.abs(spec.z) < 64));
  }
  assert.equal(detailBuildingSpecs().length, 4);
  assert.throws(() => crowdedBuildingSpecs(130));
  assert.throws(() => crowdedBuildingSpecs(0));
  assert.equal(summarizeSamples([]), null, 'missing GPU timing cannot become zero milliseconds');
  assert.deepEqual(summarizeSamples([1, 2, 3, 4, 5]), { count: 5, median: 3, p95: 5, min: 1, max: 5 });
  assert.throws(() => summarizeSamples([NaN]));
});

test('GPU query sampling drops disjoint/unavailable results and deletes pending queries', () => {
  let id = 0, disjoint = false, ready = false;
  const deleted = [], extension = { TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2, QUERY_COUNTER_BITS_EXT: 5 };
  const gl = { QUERY_RESULT_AVAILABLE: 3, QUERY_RESULT: 4, getExtension: () => extension,
    createQuery: () => ++id, beginQuery() {}, endQuery() {}, deleteQuery: query => deleted.push(query),
    getQuery: () => 64,
    getParameter: () => disjoint, getQueryParameter: (_query, field) => field === 3 ? ready : 2e6 };
  const gpu = createGpuSampler(gl);
  gpu.begin(); gpu.end(); gpu.poll(); assert.equal(gpu.values.length, 0);
  ready = true; gpu.poll(); assert.deepEqual(gpu.values, [2]);
  gpu.begin(); gpu.end(); disjoint = true; gpu.poll();
  assert.deepEqual(gpu.values, [], 'disjoint invalidates prior measured samples too');
  assert.equal(gpu.invalidated, 2); assert.equal(gpu.pendingCount, 0);
  disjoint = false; ready = false; gpu.begin(); gpu.end(); gpu.dispose();
  assert.equal(gpu.dropped, 1); assert.deepEqual(deleted, [1, 2, 3]);
  const absent = createGpuSampler({ getExtension: () => null });
  absent.begin(); absent.end(); absent.poll(); absent.dispose();
  assert.equal(absent.available, false); assert.deepEqual(absent.values, []);
  const noCounter = createGpuSampler({ ...gl, getQuery: () => 0 });
  assert.equal(noCounter.available, false, 'an exposed extension without a usable elapsed counter cannot claim GPU timing');
});

test('unknown or masked GPU identity cannot become hardware evidence just by completing a query', () => {
  const identity = (name, exposed) => readGpuIdentity({ VERSION: 1, VENDOR: 2, RENDERER: 3,
    getExtension: () => exposed ? { UNMASKED_VENDOR_WEBGL: 4, UNMASKED_RENDERER_WEBGL: 5 } : null,
    getParameter: field => field === 1 ? 'WebGL 2' : [3, 5].includes(field) ? name : 'vendor' }, 'QA browser');
  assert.equal(identity('WebKit WebGL', false).hardwareIdentified, false);
  assert.equal(identity('Apple M2', false).hardwareIdentified, false, 'masked identity alone does not satisfy the provenance gate');
  assert.equal(identity('ANGLE Metal Renderer: Apple M2', true).hardwareIdentified, true);
  assert.equal(identity('ANGLE (Google, SwiftShader Device)', true).hardwareIdentified, false);
  assert.equal(identity('unknown', true).hardwareIdentified, false);
});

test('a failed configuration fetch clears stale evidence and restores the fixture without enabling Save', async () => {
  const source = await readFile(new URL('./building-occlusion-review.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('async function run()');
  const method = source.slice(start, source.indexOf('\ndocument.querySelector', start));
  const controls = { '#run': { disabled: false }, '#save': { disabled: false }, '#result': {} };
  const context = vm.createContext({ document: { querySelector: key => controls[key] }, window: {},
    receipt: { stale: true }, active: null, disposeScene() {}, status: {},
    fetch: async () => { throw new Error('controlled config failure'); } });
  vm.runInContext(method, context); await context.run();
  assert.equal(controls['#run'].disabled, false); assert.equal(controls['#save'].disabled, true);
  assert.equal(context.receipt, null); assert.equal(context.window.buildingOcclusionQA, null);
  assert.match(context.status.textContent, /controlled config failure/);
  assert.equal(JSON.parse(controls['#result'].textContent).status, 'startup-failed');
});

test('local QA HTTP serves the complete hashed import/asset set and rejects unrelated paths and writes', async () => {
  const server = await createBuildingOcclusionReviewServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const config = await (await fetch(`${base}/qa-config.json`)).json();
    assert.match(config.sourceRevision, /^[a-f0-9]{40}$/); assert.equal(config.authoritativeBuildingLimit, 128);
    for (const item of config.sourceHashes) {
      const response = await fetch(`${base}${item.url}`);
      assert.equal(response.status, 200, item.file);
      assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), item.sha256);
      const mime = response.headers.get('content-type');
      assert.ok(mime, item.file);
      if (item.file.endsWith('.png')) assert.equal(mime, 'image/png');
      if (item.file.endsWith('.mjs')) assert.equal(mime, 'text/javascript');
    }
    for (const name of ['/vendor/three.module.js', '/vendor/three.core.js', '/']) assert.equal((await fetch(base + name)).status, 200);
    for (const name of ['/.git/config', '/server.mjs', '/package.json', '/scripts/ci.mjs']) assert.equal((await fetch(base + name)).status, 404);
    assert.equal((await fetch(base, { method: 'POST', body: 'ignored' })).status, 405);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('evidence extraction preserves exact paired bytes and refuses overwriting an earlier iteration', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tus-occlusion-extraction-'));
  try {
    // Only packaging is tested here. This header fixture is not a decoded PNG or native evidence.
    const png = Buffer.alloc(33); Buffer.from('89504e470d0a1a0a', 'hex').copy(png); png.write('IHDR', 12);
    png.writeUInt32BE(1280, 16); png.writeUInt32BE(720, 20);
    const data = `data:image/png;base64,${png.toString('base64')}`;
    const record = { schema: 'building-occlusion-native-qa-v1', config: { sourceRevision: 'a'.repeat(40) },
      status: 'checks-failed', viewport: { pixelWidth: 1280, pixelHeight: 720 },
      performance: [{ baselinePng: data, candidatePng: data }], views: [] };
    const input = path.join(root, 'input.json'), output = path.join(root, 'iteration');
    await writeFile(input, JSON.stringify(record));
    const result = await extractBuildingOcclusionEvidence(input, output);
    assert.equal(result.rasters.length, 2); assert.equal(result.reportedHardwareGpuTimingComplete, false);
    assert.deepEqual(await readFile(path.join(output, 'performance-0-baseline.png')), png);
    assert.deepEqual(await readFile(path.join(output, 'receipt.json')), await readFile(input));
    await assert.rejects(extractBuildingOcclusionEvidence(input, output), /EEXIST/);
    record.performance[0].candidatePng = data.replace('data:image/png', 'data:image/svg+xml');
    await writeFile(input, JSON.stringify(record));
    await assert.rejects(extractBuildingOcclusionEvidence(input, path.join(root, 'invalid')), /Missing paired PNG/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
