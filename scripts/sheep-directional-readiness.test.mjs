import assert from 'node:assert/strict';
import test from 'node:test';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile, unlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import * as THREE from 'three';
import { CAMERA_VIEW_DIRECTION } from '../src/camera-controls.mjs';
import { normalizedDirection } from '../src/unit-sprite-runtime.mjs';
import { staticSheepFrame, sheepQuadPlacement } from '../src/sheep-static-preview.mjs';
import { auditSheepDirectionalReadiness, sheepCaptureContractErrors, sheepPackMetadataErrors,
  SHEEP_DIRECTIONS } from './sheep-directional-readiness.mjs';
import { decodeRgba8 } from './sprite-pixel-bounds.mjs';

const pack = new URL('../assets/wildlife/bellweather-sheep-public-reference-v1/', import.meta.url);
const publicContractPath = new URL('cloud-capture-contract.json', pack).pathname;
const contract = JSON.parse(await readFile(publicContractPath, 'utf8'));
const idle = { visible: true, moving: false, stateId: 'idle' };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

// Independent PNG/pack fixtures keep all read-only acceptance checks portable
// in the Node CI jobs. They contain rectangles, never invented animal frames.
function png(width, height, pixels) {
  function chunk(type, data) {
    const body = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const byte of body) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    const result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length); body.copy(result, 4);
    result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
    return result;
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const rows = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) pixels.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

async function geometryFixture(directory, output) {
  const fixtureContract = structuredClone(contract);
  fixtureContract.status = 'synthetic test fixtures; no Sheep pixels';
  const atlas = Buffer.alloc(2048 * 1024 * 4), records = [], frames = [], clips = [];
  await mkdir(path.join(output, 'source'), { recursive: true });
  for (const [index, direction] of SHEEP_DIRECTIONS.entries()) {
    const pixels = Buffer.alloc(512 * 512 * 4), view = fixtureContract.views[index];
    const box = { x: 96 + index, y: 80 + index, width: 225, height: 221 };
    const rect = { x: index % 4 * 512, y: Math.floor(index / 4) * 512, width: 512, height: 512 };
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const offset = (y * 512 + x) * 4;
      pixels[offset] = 20 + index * 20; pixels[offset + 1] = 100; pixels[offset + 2] = 180;
      pixels[offset + 3] = x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height ? 255 : 0;
      pixels.copy(atlas, ((rect.y + y) * 2048 + rect.x + x) * 4, offset, offset + 4);
    }
    const bytes = png(512, 512, pixels);
    await writeFile(path.join(directory, view.filename), bytes);
    await writeFile(path.join(output, 'source', view.filename), bytes);
    view.sha256 = digest(bytes); view.alpha_bbox_exclusive = [box.x, box.y, box.x + box.width, box.y + box.height];
    view.nonzero_alpha_pixels = box.width * box.height;
    records.push({ filename: view.filename, sha256: view.sha256, bytes: bytes.length, directionId: direction });
    frames.push({ id: `idle-${direction}`, canvasPx: { width: 512, height: 512 }, groundPivotPx: { x: 256, y: 256 },
      groundPivotStatus: 'unreviewed-estimate', alphaBoundsPx: box, fallbackRectPx: { pageId: 'sheep-color', rectPx: rect },
      frameRectsPx: [{ layerId: 'actor', pageId: 'sheep-color', rectPx: rect, offsetPx: { x: 0, y: 0 } }] });
    clips.push({ stateId: 'idle', directionId: direction, loop: false, sequence: [{ frameId: `idle-${direction}`, durationMs: 1000 }] });
  }
  const contractBytes = Buffer.from(JSON.stringify(fixtureContract));
  await writeFile(path.join(directory, 'synthetic-contract.json'), contractBytes);
  await writeFile(path.join(output, 'source/capture-contract.json'), contractBytes);
  const manifest = JSON.parse(await readFile(new URL('sprite-atlas-pack-v1.json', pack)));
  manifest.packId = 'bellweather-sheep-static-v1';
  manifest.provenance.source = 'Synthetic geometry test fixtures; not animal art';
  manifest.assets[0].frames = frames; manifest.assets[0].clips = clips;
  const [low, high] = contract.measurements.full_geometry_bounds_world;
  manifest.assets[0].artBoundsWorld = { min: low, max: high }; manifest.assets[0].heightWorld = high[1];
  manifest.pages[0].dimensionsPx = { width: 2048, height: 1024 };
  const pageBytes = png(2048, 1024, atlas);
  for (const file of manifest.files) {
    file.dimensionsPx = manifest.pages[0].dimensionsPx; file.sha256 = digest(pageBytes);
    await writeFile(path.join(output, file.path), pageBytes);
  }
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  await writeFile(path.join(output, 'sprite-atlas-pack-v1.json'), manifestBytes);
  const binding = JSON.parse(await readFile(new URL('static-preview-binding.json', pack)));
  Object.assign(binding, { packId: manifest.packId, directions: SHEEP_DIRECTIONS, cameraCalibrated: true,
    noseYawOnly: true, projectedPixelsPerWorldUnit: 256, headBodyOffsetDegrees: contract.normalization.face_vs_body_heading_degrees,
    source: 'source/capture-contract.json', manifestSha256: digest(manifestBytes) });
  await writeFile(path.join(output, 'static-preview-binding.json'), JSON.stringify(binding));
  await writeFile(path.join(output, 'source-records.json'), JSON.stringify({ originalViewsPreserved: true, records,
    captureContract: { path: 'source/capture-contract.json', sha256: digest(contractBytes), bytes: contractBytes.length } }));
}

test('approved public fallback has one readable view and cannot claim eight directions', async () => {
  const report = await auditSheepDirectionalReadiness(pack.pathname, publicContractPath);
  assert.equal(report.status, 'public-static-fallback-validated');
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.declaredDirections, ['north']);
  assert.deepEqual(report.unavailableDirections, SHEEP_DIRECTIONS.slice(1));
  assert.equal(report.sourceViewsVerified, 1);
  assert.equal(report.liveDirectionalIntegration, false);
  const manifest = JSON.parse(await readFile(new URL('sprite-atlas-pack-v1.json', pack)));
  const binding = JSON.parse(await readFile(new URL('static-preview-binding.json', pack)));
  for (const directionId of SHEEP_DIRECTIONS) {
    assert.equal(Boolean(staticSheepFrame(manifest, binding, { ...idle, directionId })), directionId === 'north');
  }
  assert.ok(sheepPackMetadataErrors(manifest, { ...binding, directions: SHEEP_DIRECTIONS }, contract).length);
  assert.match(sheepPackMetadataErrors(manifest, { ...binding, manifest: 'alternate.json' }, contract).join('\n'), /binding manifest/);
});

test('public fallback rejects replaced derived pixels, false alpha bounds and original records', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sheep-fallback-test-'));
  try {
    await cp(pack, directory, { recursive: true });
    const manifestPath = path.join(directory, 'sprite-atlas-pack-v1.json');
    const bindingPath = path.join(directory, 'static-preview-binding.json');
    const manifest = JSON.parse(await readFile(manifestPath));
    const binding = JSON.parse(await readFile(bindingPath));
    const writeManifest = async value => {
      const bytes = Buffer.from(JSON.stringify(value));
      await writeFile(manifestPath, bytes);
      await writeFile(bindingPath, JSON.stringify({ ...binding, manifestSha256: digest(bytes) }));
    };
    for (const file of manifest.files) {
      const image = decodeRgba8(await readFile(path.join(directory, file.path)));
      const mirrored = Buffer.alloc(image.pixels.length);
      for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
        mirrored.set(image.pixels.subarray((y * 512 + 511 - x) * 4, (y * 512 + 512 - x) * 4), (y * 512 + x) * 4);
      }
      const bytes = png(512, 512, mirrored);
      await writeFile(path.join(directory, file.path), bytes);
      file.sha256 = digest(bytes);
    }
    await writeManifest(manifest);
    assert.match((await auditSheepDirectionalReadiness(directory, publicContractPath)).errors.join('\n'), /differs from approved v1 pixels/,
      'valid package hashes cannot establish public fallback derivation');
    await cp(pack, directory, { recursive: true });
    const originalManifest = JSON.parse(await readFile(manifestPath));
    originalManifest.assets[0].frames[0].alphaBoundsPx.x++;
    await writeManifest(originalManifest);
    assert.match((await auditSheepDirectionalReadiness(directory, publicContractPath)).errors.join('\n'), /alpha bounds disagree/);
    await cp(pack, directory, { recursive: true });
    const recordsPath = path.join(directory, 'source-records.json');
    const records = JSON.parse(await readFile(recordsPath));
    for (const mutate of [value => { value.filename = 'unrelated.png'; }, value => { value.bytes++; }]) {
      const changed = structuredClone(records); mutate(changed.records[0]);
      await writeFile(recordsPath, JSON.stringify(changed));
      assert.match((await auditSheepDirectionalReadiness(directory, publicContractPath)).errors.join('\n'), /original digest\/identity/);
    }
    await cp(pack, directory, { recursive: true });
    await writeFile(bindingPath, JSON.stringify({ ...binding, manifest: 'missing.json' }));
    assert.match((await auditSheepDirectionalReadiness(directory, publicContractPath)).errors.join('\n'), /binding manifest/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('producer nose-yaw labels match the real fixed camera without a second body offset', () => {
  assert.deepEqual(sheepCaptureContractErrors(contract), []);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);
  camera.position.set(...CAMERA_VIEW_DIRECTION).multiplyScalar(10);
  camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const screenSigns = [[-1,-1], [0,-1], [1,-1], [1,0], [1,1], [0,1], [-1,1], [-1,0]];
  const sign = value => Math.abs(value) < 1e-9 ? 0 : Math.sign(value);
  for (const [index, direction] of SHEEP_DIRECTIONS.entries()) {
    const yaw = contract.views[index].world_yaw_degrees * Math.PI / 180;
    assert.equal(normalizedDirection(yaw), direction);
    const projected = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).project(camera);
    assert.deepEqual([sign(projected.x), sign(projected.y)], screenSigns[index]);
    // Turned-head geometry already encodes this offset. Adding it again selects
    // the next nose view rather than the intended one in all eight cases.
    assert.notEqual(normalizedDirection(yaw + contract.normalization.face_vs_body_heading_degrees * Math.PI / 180), direction);
  }
  for (const mutate of [
    value => { value.camera.projection = 'perspective'; },
    value => { value.camera.runtime_position[0] *= -1; },
    value => { value.camera.root_pixel_from_upper_left[0]++; },
    value => { value.camera.projected_pixels_per_world_unit = 512; },
    value => { value.views[0].screen_heading = 'up-right'; },
    value => { value.normalization.face_vs_body_heading_degrees = 0; },
    value => { value.renderSettings.contact_shadow_layer.color_capture_shadows = true; },
  ]) {
    const changed = structuredClone(contract); mutate(changed);
    assert.ok(sheepCaptureContractErrors(changed).length);
  }
});

test('eight synthetic geometry fixtures exercise registration and corrupted-source controls', async t => {
  // Temporary colored rectangles are test data, never Sheep art or published
  // frame substitutes. No real private frame pixels are present in this test.
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sheep-direction-test-'));
  const output = path.join(directory, 'pack');
  const fixtureContractPath = path.join(directory, 'synthetic-contract.json');
  try {
    await geometryFixture(directory, output);
    const runPacker = destination => spawnSync('python3', ['scripts/prepare-sheep-static-pack.py',
      '--cloud-views', directory, '--contract', fixtureContractPath, '--output', destination], { encoding: 'utf8' });
    const fixtureContract = JSON.parse(await readFile(fixtureContractPath));
    const manifest = JSON.parse(await readFile(path.join(output, 'sprite-atlas-pack-v1.json')));
    const binding = JSON.parse(await readFile(path.join(output, 'static-preview-binding.json')));
    const report = await auditSheepDirectionalReadiness(output, fixtureContractPath);
    assert.equal(report.status, 'directional-static-bytes-validated', report.errors.join('\n'));
    assert.equal(report.sourceViewsVerified, 8);
    assert.deepEqual(report.animations, []);
    assert.equal(report.publicationApproval, 'not established by this check');
    for (const [index, directionId] of SHEEP_DIRECTIONS.entries()) {
      const frame = staticSheepFrame(manifest, binding, { ...idle, directionId });
      assert.equal(frame.id, `idle-${directionId}`);
      const placed = sheepQuadPlacement(frame, binding.projectedPixelsPerWorldUnit);
      assert.deepEqual([placed.width, placed.height, placed.centerX, placed.centerY], [2, 2, 0, 0]);
      assert.deepEqual(frame.fallbackRectPx.rectPx, { x: index % 4 * 512, y: Math.floor(index / 4) * 512, width: 512, height: 512 });
      assert.deepEqual(sheepQuadPlacement({ ...frame, alphaBoundsPx: { x: 20, y: 30, width: 2, height: 3 } }, 256), placed);
      for (const stateId of ['walk', 'graze', 'dispatch', 'carcass', 'depleted']) {
        assert.equal(staticSheepFrame(manifest, binding, { ...idle, directionId, stateId }), null);
      }
    }
    for (const mutate of [
      value => { value.assets[0].frames[3].groundPivotPx.x++; },
      value => { value.assets[0].clips[2].sequence[0].frameId = 'idle-north'; },
      value => { value.assets[0].clips[0].loop = true; },
      value => { value.assets[0].frames[1].fallbackRectPx.rectPx.x = 0; },
    ]) {
      const changed = structuredClone(manifest); mutate(changed);
      assert.ok(sheepPackMetadataErrors(changed, binding, fixtureContract).length);
    }
    const originalPage = await readFile(path.join(output, 'sheep-atlas-source.png'));
    const decoded = decodeRgba8(originalPage), mirrored = Buffer.from(decoded.pixels);
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const from = (y * 2048 + 511 - x) * 4, to = (y * 2048 + x) * 4;
      mirrored.set(decoded.pixels.subarray(from, from + 4), to);
    }
    const mirroredPage = png(2048, 1024, mirrored), changedManifest = structuredClone(manifest);
    for (const file of changedManifest.files) {
      file.sha256 = digest(mirroredPage);
      await writeFile(path.join(output, file.path), mirroredPage);
    }
    const changedManifestBytes = Buffer.from(JSON.stringify(changedManifest));
    await writeFile(path.join(output, 'sprite-atlas-pack-v1.json'), changedManifestBytes);
    await writeFile(path.join(output, 'static-preview-binding.json'), JSON.stringify({ ...binding, manifestSha256: digest(changedManifestBytes) }));
    assert.match((await auditSheepDirectionalReadiness(output, fixtureContractPath)).errors.join('\n'), /mirrored a view/,
      'self-consistent output hashes cannot hide a mirrored original');
    for (const file of manifest.files) await writeFile(path.join(output, file.path), originalPage);
    await writeFile(path.join(output, 'sprite-atlas-pack-v1.json'), JSON.stringify(manifest));
    await writeFile(path.join(output, 'static-preview-binding.json'), JSON.stringify(binding));
    const redirectedManifest = structuredClone(manifest);
    const runtimeFile = redirectedManifest.files.find(file => file.id === redirectedManifest.pages[0].runtimeFileId);
    runtimeFile.path = 'alternate-runtime.png'; runtimeFile.sha256 = digest(mirroredPage);
    await writeFile(path.join(output, runtimeFile.path), mirroredPage);
    const redirectedManifestBytes = Buffer.from(JSON.stringify(redirectedManifest));
    await writeFile(path.join(output, 'sprite-atlas-pack-v1.json'), redirectedManifestBytes);
    await writeFile(path.join(output, 'static-preview-binding.json'), JSON.stringify({ ...binding, manifestSha256: digest(redirectedManifestBytes) }));
    assert.match((await auditSheepDirectionalReadiness(output, fixtureContractPath)).errors.join('\n'), /mirrored a view/,
      'audit must decode the runtime file the manifest actually references');
    await writeFile(path.join(output, 'sprite-atlas-pack-v1.json'), JSON.stringify(manifest));
    await writeFile(path.join(output, 'static-preview-binding.json'), JSON.stringify(binding));
    const original = await readFile(path.join(output, 'source/sheep-yaw-090.png'));
    await writeFile(path.join(output, 'source/sheep-yaw-090.png'), Buffer.concat([original, Buffer.from('corrupt')]));
    assert.match((await auditSheepDirectionalReadiness(output, fixtureContractPath)).errors.join('\n'), /original source digest/);
    await writeFile(path.join(output, 'source/sheep-yaw-090.png'), original);
    const recordsPath = path.join(output, 'source-records.json');
    const records = JSON.parse(await readFile(recordsPath));
    records.captureContract.sha256 = createHash('sha256').update('other contract').digest('hex');
    await writeFile(recordsPath, JSON.stringify(records));
    assert.match((await auditSheepDirectionalReadiness(output, fixtureContractPath)).errors.join('\n'), /consumed capture contract/);
    const hasPillow = spawnSync('python3', ['-c', 'import PIL'], { timeout: 5000 }).status === 0;
    await t.test('existing Python packer accepts originals and rejects a missing view before writes',
      { skip: hasPillow ? false : 'Optional Python packer needs Pillow; Node byte/anchor tests ran independently' }, async () => {
        const preparedOutput = path.join(directory, 'python-pack');
        const prepared = runPacker(preparedOutput);
        assert.equal(prepared.status, 0, prepared.stderr);
        assert.deepEqual((await auditSheepDirectionalReadiness(preparedOutput, fixtureContractPath)).errors, []);
        await unlink(path.join(directory, 'sheep-yaw-315.png'));
        const absentOutput = path.join(directory, 'missing-view-output');
        assert.notEqual(runPacker(absentOutput).status, 0);
        await assert.rejects(readFile(path.join(absentOutput, 'sprite-atlas-pack-v1.json')), /ENOENT/);
      });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
