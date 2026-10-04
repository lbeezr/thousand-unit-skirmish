// Joint CPU invocation through the actual shared CI loader/runner. Qualifier,
// pages and screenshot bytes are synthetic: this is never a rendered-game pass.
// Missing shared CI #331 modules fail import; there is no skip/fallback adapter.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { loadCaptureCases, runFeatureBatch } from './renderer-feature-capture.mjs';
import { ROUTE_MAP_ID } from './renderer-worker-route-scenario.mjs';

const revision = 'a'.repeat(40), releaseDigest = `sha256:${'b'.repeat(64)}`;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function png(mark) {
  const bytes = Buffer.alloc(12000); Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes);
  bytes.write('IHDR', 12); bytes.writeUInt32BE(1280, 16); bytes.writeUInt32BE(720, 20);
  bytes[bytes.length - 1] = mark; return bytes;
}

function pageFixture() {
  const visits = [], commands = [], acquisitions = [], failures = [];
  let tick = 1, frameNumber = 0, active = false, trace = [];
  const worker = { id: 0, team: 0, generation: 7, x: -70.5, z: -2.5, cargo: 0, cargoType: null, task: 'idle', action: null };
  const initial = { tick, team: 0, food: 150, workers: [worker, { ...worker, id: 1, x: -72.5 }],
    nodes: [{ id: 's0-home-food', stock: 650 }], dropoffs: [{ id: 1000000000, type: 'town-center', x: -73.5, z: 0.5 }] };
  let current = structuredClone(initial);
  const phases = {
    'manual departure': { x: -70, z: -1.9, task: 'moving' },
    'manual midpoint': { x: -69, z: 0, task: 'moving' },
    'return to identical settled start': {},
    'gather departure': { x: -70, z: -1.9, task: 'gathering' },
    'gather midpoint': { x: -69, z: 0, task: 'gathering' },
    'productive Food harvest': { x: -65.4, z: 5.45, task: 'gathering', cargo: 0.5, cargoType: 'food', action: 'gather-food', stock: 649.5 },
    'full-load automatic return': { x: -65.7, z: 4.9, task: 'returning', cargo: 10, cargoType: 'food', stock: 640 },
    'automatic return midpoint': { x: -67, z: 3.9, task: 'returning', cargo: 10, cargoType: 'food', stock: 640 },
    'one deposit and automatic resume': { x: -70, z: 1.8, task: 'gathering', stock: 640, food: 160 },
    'resume midpoint': { x: -68.4, z: 3.2, task: 'gathering', stock: 640, food: 160 },
    'productive resumed Food harvest': { x: -65.4, z: 5.45, task: 'gathering', cargo: 0.5, cargoType: 'food', action: 'gather-food', stock: 639.5, food: 160 },
    'manual Stop wins': { x: -65.4, z: 5.45, cargo: 0.5, cargoType: 'food', stock: 639.5, food: 160 },
  };
  function page(team) {
    const value = { cdp: {
      async call(method, params) {
        if (method === 'Page.navigate') { assert.equal(params.url, 'http://127.0.0.1:4321/'); visits.push({ team, url: '/' }); }
        else assert.equal(method, 'Page.addScriptToEvaluateOnNewDocument');
        return {};
      },
      async evaluate(expression) {
        if (expression === "new URL(location.href).searchParams.get('room')") return 'p'.repeat(32);
        if (expression === "document.querySelector('#lobby-match-mode').value") return 'skirmish@1';
        if (expression === 'window.__workerRoutes.team') return team;
        if (expression === 'window.__workerRoutes.latest') return structuredClone(current);
        if (expression.startsWith('window.__workerRoutes.workerId=')) { active = true; return 0; }
        if (expression.startsWith('window.__workerRoutes.latest?.workers.find')) return structuredClone(current.workers[0]);
        if (expression.startsWith('window.__rtsEnvironmentCaptureCommand(')) {
          const payload = JSON.parse(expression.slice('window.__rtsEnvironmentCaptureCommand('.length, -1));
          assert.deepEqual(payload.ids, [0]); assert.ok(['move', 'gather', 'stop'].includes(payload.type));
          commands.push(payload); return true;
        }
        if (expression.startsWith('window.__rtsQualification.request(')) {
          const number = ++frameNumber;
          return { number, time: number * 100, version: 'WebGL 2.0', contextLost: false, glError: 0,
            pixels: Array.from({ length: 48 }, (_, i) => [i, 20, 40, 255]).flat(), canvasWidth: 1280, canvasHeight: 720,
            canvasPng: png(number).toString('base64'), state: structuredClone(current) };
        }
        if (expression.startsWith('({samples:window.__workerRoutes.samples')) return { samples: structuredClone(trace), droppedSamples: 0 };
        assert.ok(expression.includes('document.querySelector'), 'fixture must execute a normal UI step'); return true;
      },
    },
    async wait(expression, label) {
      if (team === 0 && Object.hasOwn(phases, label)) {
        const { stock = 650, food = 150, ...changes } = phases[label];
        current = structuredClone(initial); current.tick = ++tick; current.food = food;
        current.workers[0] = { ...worker, ...changes }; current.nodes[0].stock = stock;
        assert.equal(vm.runInNewContext(expression, { window: { __workerRoutes: { latest: current } } }), true,
          `CPU phase fixture must satisfy the actual scenario wait: ${label}`);
        if (active) trace.push(structuredClone(current));
      }
      return true;
    },
    dispose: async () => { throw new Error('adapter must leave disposal with its caller'); },
    };
    acquisitions.push(value); return value;
  }
  return { primary: page(0), guest: () => page(1), visits, commands, acquisitions, failures };
}

async function jointRun(directory, { captureFailure = false, wrongSource = false } = {}) {
  const fixture = pageFixture(); let captures = 0;
  const batch = await runFeatureBatch('unused-cpu-pack.json', directory, 'worker-routes', {
    qualify: async (_packFile, out, { captureCase }) => {
      await mkdir(out, { recursive: true });
      try {
        const status = await captureCase.run({ page: fixture.primary, openPage: async () => fixture.guest(),
          origin: 'http://127.0.0.1:4321', pack: { sourceRevision: revision, digest: releaseDigest }, browserVersion: { product: 'CPU fixture' } });
        return { status, source: { revision, dirty: false }, release: { digest: releaseDigest } };
      } catch (error) { fixture.failures.push(error); return { status: 'failed' }; }
    },
    checkpoint: async ({ page, revision: sourceRevision, mapId, checkpoint, outputDirectory }) => {
      assert.ok(fixture.acquisitions.includes(page)); assert.equal(mapId, ROUTE_MAP_ID); captures++;
      if (captureFailure) throw new Error('synthetic checkpoint failure');
      const directory = path.join(outputDirectory, checkpoint); await mkdir(directory);
      const bytes = png(captures + 20); await writeFile(path.join(directory, 'color.png'), bytes);
      return { directory, manifest: { source: { revision: wrongSource ? 'c'.repeat(40) : sourceRevision },
        scene: { mapId, checkpoint }, viewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
        image: { file: 'color.png', sha256: hash(bytes), width: 1280, height: 720, bytes: bytes.length } } };
    },
  });
  return { batch, fixture, captures };
}

test('actual shared default loader imports the owned version1 Worker adapter', async () => {
  const loaded = await loadCaptureCases('worker-routes');
  assert.deepEqual(loaded.issues, []); assert.equal(loaded.adapters.length, 1);
  assert.equal(loaded.adapters[0].id, 'worker-routes'); assert.equal(loaded.adapters[0].contextVersion, 1);
  assert.equal(typeof loaded.adapters[0].run, 'function');
});

test('actual shared invoker runs normal-room owner adapter, callbacks and bounded sanitized receipts', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'rts-worker-routes-joint-'));
  try {
    const { batch, fixture, captures } = await jointRun(directory);
    assert.deepEqual(fixture.failures, []); assert.equal(batch.status, 'passed'); assert.equal(batch.contextVersion, 1);
    assert.equal(captures, 11); assert.deepEqual(fixture.visits, [{ team: 0, url: '/' }, { team: 1, url: '/' }]);
    assert.equal(fixture.acquisitions.length, 2); assert.equal(batch.cases[0].result.checks.length, 8);
    const summary = JSON.parse(await readFile(path.join(directory, 'worker-routes/manual-stop/worker-route-summary.json'), 'utf8'));
    assert.deepEqual(summary.source, { revision, digest: releaseDigest }); assert.equal(summary.scene.mapId, ROUTE_MAP_ID);
    assert.equal(summary.conservation.bankedFood, 10); assert.equal(summary.conservation.finalFoodCargo, 0.5);
    assert.ok(summary.frames.every(f => f.pngSha256 && f.canvasSha256));
    assert.doesNotMatch(JSON.stringify(summary), /pppppppppppppppppppppppppppppppp|sessionToken|socket|invite|room=/);
    assert.deepEqual(fixture.commands.map(c => c.type), ['move', 'move', 'gather', 'stop']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('shared capture failures and source mismatch remain failures through the real adapter', async () => {
  for (const options of [{ captureFailure: true }, { wrongSource: true }]) {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'rts-worker-routes-joint-reject-'));
    try {
      const { batch, fixture, captures } = await jointRun(directory, options);
      assert.equal(batch.status, 'failed'); assert.equal(captures, 1); assert.equal(fixture.failures.length, 1);
      assert.equal(batch.cases[0].result.status, 'failed');
    } finally { await rm(directory, { recursive: true, force: true }); }
  }
});
