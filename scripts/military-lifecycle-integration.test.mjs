import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {mkdtemp, mkdir, readFile, writeFile, rm, readdir, access, symlink} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {MILITARY_ROOT, MILITARY_HTTP_ASSET_PATH, MILITARY_FAMILIES, MILITARY_STATES, militaryTransferFiles,
  verifyMilitaryTransfer, prepareMilitaryIntegration, militaryPackagingOverlay} from './prepare-military-lifecycle-integration.mjs';
import {preserveAdmittedLifecycle} from './build-frontier-complete-manifests.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function chunk(type, data) {
  const payload = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of payload) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const size = Buffer.alloc(4), checksum = Buffer.alloc(4);
  size.writeUInt32BE(data.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([size, payload, checksum]);
}
// Synthetic test pixels are isolated in temporary directories, never game art.
function syntheticPng(seed) {
  const header = Buffer.alloc(13); header.writeUInt32BE(1024); header.writeUInt32BE(1024, 4);
  header[8] = 8; header[9] = 6;
  const rows = Buffer.alloc((4096 + 1) * 1024);
  for (let y = 500; y < 504; y++) for (let x = 500; x < 504; x++) {
    const start = y * 4097 + 1 + x * 4; rows[start] = seed; rows[start + 3] = 255;
  }
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
async function fixture(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'military-integration-test-'));
  const bundleRoot = path.join(directory, 'bundle'), outputRoot = path.join(directory, 'overlay');
  const manifests = new Map();
  try {
    await mkdir(path.join(bundleRoot, MILITARY_ROOT, 'runtime'), {recursive: true});
    for (const family of MILITARY_FAMILIES) {
      const manifest = JSON.parse(await readFile(path.join(root, MILITARY_ROOT, `${family}-complete-renderer.json`), 'utf8'));
      manifest.stateOrder = ['foundation', 'frame', 'complete', 'damaged', 'critical'];
      manifest.states = [];
      for (const [stateIndex, state] of MILITARY_STATES.entries()) {
        const views = [];
        for (let index = 0; index < 8; index++) {
          const png = syntheticPng(1 + stateIndex * 8 + index);
          const relative = `runtime/${family}-${state}-view-0${index}.png`;
          await writeFile(path.join(bundleRoot, MILITARY_ROOT, relative), png);
          views.push({index, azimuthDegrees: index * 45, path: relative, sha256: hash(png), bytes: png.length});
        }
        manifest.states.push({state, views});
      }
      manifests.set(family, manifest);
      await writeFile(path.join(bundleRoot, MILITARY_ROOT, `${family}-complete-renderer.json`), JSON.stringify(manifest));
    }
    await run({repoRoot: root, bundleRoot, outputRoot, manifests, directory});
  } finally { await rm(directory, {recursive: true, force: true}); }
}
async function saveManifest(context, family = 'barracks') {
  await writeFile(path.join(context.bundleRoot, MILITARY_ROOT, `${family}-complete-renderer.json`), JSON.stringify(context.manifests.get(family)));
}

test('exact transfer plan excludes all Complete copies, authoring sources and galleries', () => {
  const files = militaryTransferFiles(); assert.equal(files.length, 66); assert.equal(new Set(files).size, 66);
  assert.equal(files.filter(file => file.endsWith('.png')).length, 64);
  assert.ok(files.every(file => !file.includes('/source/') && !file.includes('/captures/')));
  const result = spawnSync(process.execPath, ['scripts/prepare-military-lifecycle-integration.mjs', '--plan'], {cwd: root, encoding: 'utf8'});
  assert.equal(result.status, 0); assert.deepEqual(JSON.parse(result.stdout).files, files);
});

test('verified synthetic transfer creates an exact local overlay and preserves all 16 Complete references', async () => {
  await fixture(async context => {
    const receipt = await prepareMilitaryIntegration(context);
    assert.equal(receipt.files.length, 69); assert.equal(receipt.completeHashes.length, 16);
    for (const file of militaryTransferFiles()) assert.deepEqual(await readFile(path.join(context.outputRoot, file)), await readFile(path.join(context.bundleRoot, file)));
    const docker = await readFile(path.join(context.outputRoot, 'Dockerfile'), 'utf8');
    const ignore = await readFile(path.join(context.outputRoot, '.dockerignore'), 'utf8');
    const server = await readFile(path.join(context.outputRoot, MILITARY_HTTP_ASSET_PATH), 'utf8');
    assert.deepEqual(militaryPackagingOverlay({dockerfile: docker, dockerignore: ignore, server}),
      {Dockerfile: docker, '.dockerignore': ignore, [MILITARY_HTTP_ASSET_PATH]: server}, 'exact admitted packaging is reused without duplicate paths');
    assert.throws(() => militaryPackagingOverlay({dockerfile: docker.replace('barracks-foundation-view-00.png', 'barracks-foundation-view-08.png'), dockerignore: ignore, server}), /Existing lifecycle Docker paths/);
    assert.throws(() => militaryPackagingOverlay({dockerfile: docker, dockerignore: ignore.replace('!assets/buildings/frontier-civilization-military-models-v1/runtime/barracks-foundation-view-00.png', ''), server}), /Existing lifecycle context paths/);
    for (const changed of [server.replace('critical)-view-0[0-7]', 'critical)-view-0[0-9]'),
      server.replace('critical)-view-0[0-7]\\.png', 'critical)-view-0[0-7]\\.png|runtime\\/private\\.png')]) {
      assert.throws(() => militaryPackagingOverlay({dockerfile: docker, dockerignore: ignore, server: changed}), /Existing military HTTP branch/);
    }
    for (const file of militaryTransferFiles().filter(file => file.endsWith('.png'))) {
      assert.ok(docker.includes(file)); assert.ok(ignore.split('\n').includes('!' + file));
    }
    const route = server.match(/const publicFrontierCompleteAsset = (\/\^.*\$\/).test\(relative\);/);
    assert.ok(route); const regex = new RegExp(route[1].slice(1, -1));
    for (const file of militaryTransferFiles()) assert.ok(regex.test(file), file);
    for (const suffix of ['source/capture_barracks_lifecycle.py', 'runtime/barracks-complete-view-00.png',
      'runtime/barracks-destroyed-view-00.png', 'runtime/barracks-frame-view-08.png', 'runtime/../source/private.png']) assert.equal(regex.test(`${MILITARY_ROOT}/${suffix}`), false);
    assert.match(receipt.evidence, /real-game acceptance remain separate/);
    assert.deepEqual((await readdir(context.outputRoot)).sort(), ['.dockerignore', 'Dockerfile', 'assets', 'integration-receipt.json', 'src']);
  });
});

test('Complete generator retains admitted lifecycle bytes and rejects registration/reference drift', async () => {
  await fixture(async context => {
    const existing = context.manifests.get('barracks');
    const generated = JSON.parse(await readFile(path.join(root, MILITARY_ROOT, 'barracks-complete-renderer.json'), 'utf8'));
    assert.equal(preserveAdmittedLifecycle(generated, existing), existing);
    for (const mutate of [m => {m.camera.elevationDegrees = 45;}, m => {m.completeState.views[0].sha256 = 'f'.repeat(64);},
      m => {m.stateOrder.pop();}]) {
      const invalid = structuredClone(existing); mutate(invalid); assert.throws(() => preserveAdmittedLifecycle(generated, invalid));
    }
    assert.equal(preserveAdmittedLifecycle(generated, generated), generated);
    const partial = structuredClone(existing); partial.stateOrder.pop(); partial.states.pop();
    assert.equal(preserveAdmittedLifecycle(generated, partial), partial, 'incremental admitted states are preserved too');
  });
});

test('transfer rejects private extras and symlinks before creating any overlay', async () => {
  await fixture(async context => {
    const privateFile = path.join(context.bundleRoot, MILITARY_ROOT, 'private.blend');
    await writeFile(privateFile, 'private');
    await assert.rejects(prepareMilitaryIntegration(context), /exactly two manifests/);
    await assert.rejects(access(context.outputRoot));
    await rm(privateFile);
    await symlink(path.join(root, 'package.json'), privateFile);
    await assert.rejects(prepareMilitaryIntegration(context), /regular files/);
    await assert.rejects(access(context.outputRoot));
  });
});

test('transfer rejects missing files, hashes, private paths, masks, thresholds and camera/Complete changes', async () => {
  await fixture(async context => {
    const original = structuredClone(context.manifests.get('barracks'));
    for (const mutate of [m => {m.camera.anchorPixelFromTopLeft[1] += 1;},
      m => {m.completeState.views[0].sha256 = 'f'.repeat(64);},
      m => {m.states[0].views[0].path = 'source/private.png';},
      m => {m.states[0].views[0].sha256 = 'f'.repeat(64);},
      m => {m.states[0].views[0].bytes++;},
      m => {m.states[0].views[0].teamMaskPath = 'source/mask.png'; m.states[0].views[0].teamMaskSha256 = 'f'.repeat(64);},
      m => {m.stateMapping = {health: {criticalAtOrBelow: .33}};}]) {
      const manifest = structuredClone(original); mutate(manifest); context.manifests.set('barracks', manifest); await saveManifest(context);
      await assert.rejects(prepareMilitaryIntegration(context)); await assert.rejects(access(context.outputRoot));
    }
    context.manifests.set('barracks', original); await saveManifest(context);
    await rm(path.join(context.bundleRoot, militaryTransferFiles().find(file => file.endsWith('.png'))));
    await assert.rejects(verifyMilitaryTransfer(context), /exactly two manifests/);
  });
});

test('overlay refuses to overwrite source, transfer or existing output and rejects changed packaging markers', async () => {
  await fixture(async context => {
    await assert.rejects(prepareMilitaryIntegration({...context, outputRoot: context.bundleRoot}), /outside source/);
    await mkdir(context.outputRoot);
    await assert.rejects(prepareMilitaryIntegration(context), /already exists/);
    const [dockerfile, dockerignore, server] = await Promise.all(['Dockerfile', '.dockerignore', MILITARY_HTTP_ASSET_PATH].map(file => readFile(path.join(root, file), 'utf8')));
    assert.throws(() => militaryPackagingOverlay({dockerfile: '', dockerignore, server}), /Docker marker/);
    assert.throws(() => militaryPackagingOverlay({dockerfile, dockerignore, server: ''}), /HTTP marker/);
  });
});

test('symlinked output ancestors cannot route the overlay back into source or transfer', async () => {
  await fixture(async context => {
    const alias = path.join(context.directory, 'aliased-transfer');
    await symlink(context.bundleRoot, alias);
    await assert.rejects(prepareMilitaryIntegration({...context, outputRoot: path.join(alias, 'overlay')}), /symlinked ancestor/);
    await assert.rejects(access(path.join(context.bundleRoot, 'overlay')));
  });
});

test('valid PNG private text/EXIF chunks are rejected before output even when their hashes agree', async () => {
  await fixture(async context => {
    const manifest = context.manifests.get('barracks'), view = manifest.states[0].views[0];
    const file = path.join(context.bundleRoot, MILITARY_ROOT, view.path), original = await readFile(file);
    for (const type of ['tEXt', 'zTXt', 'iTXt', 'eXIf']) {
      const png = Buffer.concat([original.subarray(0, -12), chunk(type, Buffer.from('private scene path')), original.subarray(-12)]);
      await writeFile(file, png); view.sha256 = hash(png); view.bytes = png.length; await saveManifest(context);
      await assert.rejects(prepareMilitaryIntegration(context), /private text\/EXIF metadata/);
      await assert.rejects(access(context.outputRoot));
    }
  });
});
