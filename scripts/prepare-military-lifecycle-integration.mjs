import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lstat, mkdir, readFile, readdir, realpath, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {validateBuildingLifecycle} from './validate-building-lifecycle.mjs';
import {decodeRgba8, measureFrameAlpha} from './sprite-pixel-bounds.mjs';

export const MILITARY_ROOT = 'assets/buildings/frontier-civilization-military-models-v1';
export const MILITARY_HTTP_ASSET_PATH = 'src/server/client-static-assets.mjs';
export const MILITARY_FAMILIES = Object.freeze(['barracks', 'archery-range']);
export const MILITARY_STATES = Object.freeze(['foundation', 'frame', 'damaged', 'critical']);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function checkRuntimePng(bytes) {
  assert.ok(bytes.length <= 16 * 1024 * 1024 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'Invalid runtime PNG');
  let offset = 8, ended = false, header = false;
  while (offset < bytes.length) {
    assert.ok(offset + 12 <= bytes.length, 'Truncated runtime PNG chunk');
    const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8);
    assert.ok(offset + 12 + length <= bytes.length, 'Truncated runtime PNG chunk data');
    assert.ok(!['tEXt', 'zTXt', 'iTXt', 'eXIf'].includes(type), 'Runtime PNG contains private text/EXIF metadata');
    if (type === 'IHDR') {
      assert.ok(!header && offset === 8 && length === 13, 'Invalid PNG header'); header = true;
      assert.equal(bytes.readUInt32BE(offset + 8), 1024); assert.equal(bytes.readUInt32BE(offset + 12), 1024);
      assert.equal(bytes[offset + 16], 8); assert.equal(bytes[offset + 17], 6);
      assert.equal(bytes[offset + 18], 0); assert.equal(bytes[offset + 19], 0); assert.equal(bytes[offset + 20], 0);
    }
    offset += length + 12;
    if (type === 'IEND') { assert.equal(length, 0); ended = true; break; }
  }
  assert.ok(header && ended && offset === bytes.length, 'Runtime PNG has missing end or trailing metadata');
}

async function rejectSymlinkedAncestors(output) {
  for (let ancestor = output; ; ancestor = path.dirname(ancestor)) {
    try { assert.ok(!(await lstat(ancestor)).isSymbolicLink(), 'Overlay output has a symlinked ancestor'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (path.dirname(ancestor) === ancestor) break;
  }
}

export function militaryTransferFiles() {
  return MILITARY_FAMILIES.flatMap(family => [
    `${MILITARY_ROOT}/${family}-complete-renderer.json`,
    ...MILITARY_STATES.flatMap(state => Array.from({length: 8}, (_, index) =>
      `${MILITARY_ROOT}/runtime/${family}-${state}-view-0${index}.png`)),
  ]).sort();
}

async function filesUnder(root, prefix = '') {
  const files = [];
  for (const item of await readdir(path.join(root, prefix), {withFileTypes: true})) {
    const relative = prefix ? `${prefix}/${item.name}` : item.name;
    assert.ok(!item.isSymbolicLink(), `Transfer must contain regular files: ${relative}`);
    if (item.isDirectory()) files.push(...await filesUnder(root, relative));
    else { assert.ok(item.isFile(), `Transfer must contain regular files: ${relative}`); files.push(relative); }
  }
  return files.sort();
}

// Pure text preparation. No glob admission and no changes to a render layer.
export function militaryPackagingOverlay({dockerfile, dockerignore, server}) {
  const assets = militaryTransferFiles().filter(file => file.endsWith('.png'));
  const runtime = `${MILITARY_ROOT}/runtime/`;
  const marker = `COPY --chown=node:node ${MILITARY_ROOT}/archery-range-complete-renderer.json ./${MILITARY_ROOT}/`;
  assert.equal(dockerfile.split(marker).length, 2, 'Expected one current military Docker marker');
  const additions = MILITARY_FAMILIES.map(family =>
    `COPY --chown=node:node ${assets.filter(file => file.includes(`/runtime/${family}-`)).join(' ')} ./${runtime}`).join('\n');
  const existingDocker = dockerfile.split('\n').filter(line => line.includes(runtime));
  if (existingDocker.length) assert.deepEqual(existingDocker, additions.split('\n'), 'Existing lifecycle Docker paths differ from the exact transfer');
  const ignoreAdditions = [`!${runtime}`, ...assets.map(file => `!${file}`)];
  const existingIgnore = dockerignore.split('\n').filter(line => line.includes(runtime));
  if (existingIgnore.length) assert.deepEqual(existingIgnore, ignoreAdditions, 'Existing lifecycle context paths differ from the exact transfer');
  const oldRoute = 'captures\\/(?:barracks|archery-range)-complete-view-0[0-7]\\.png';
  assert.equal(server.split(oldRoute).length, 2, 'Expected one current military HTTP marker');
  const newRoute = `${oldRoute}|runtime\\/(?:barracks|archery-range)-(?:foundation|frame|damaged|critical)-view-0[0-7]\\.png`;
  const publicRoute = server.match(/const publicFrontierCompleteAsset = (\/\^.*\$\/)\.test\(relative\);/);
  const militaryPrefix = 'frontier-civilization-military-models-v1\\/(?:(?:barracks|archery-range)-complete-renderer\\.json|';
  assert.ok(publicRoute && publicRoute[1].split(militaryPrefix).length === 2, 'Expected one exact military HTTP branch');
  const militaryBranch = publicRoute[1].slice(publicRoute[1].indexOf(militaryPrefix), -3);
  assert.ok([`${militaryPrefix}${oldRoute})`, `${militaryPrefix}${newRoute})`].includes(militaryBranch), 'Existing military HTTP branch differs from the exact transfer');
  return {
    Dockerfile: existingDocker.length ? dockerfile : dockerfile.replace(marker, `${marker}\n${additions}`),
    '.dockerignore': existingIgnore.length ? dockerignore : `${dockerignore.trimEnd()}\n${ignoreAdditions.join('\n')}\n`,
    [MILITARY_HTTP_ASSET_PATH]: server.includes(newRoute) ? server : server.replace(oldRoute, newRoute),
  };
}

export async function verifyMilitaryTransfer({repoRoot, bundleRoot}) {
  assert.ok((await lstat(bundleRoot)).isDirectory(), 'Transfer root must be a real directory');
  const expected = militaryTransferFiles();
  assert.deepEqual(await filesUnder(bundleRoot), expected, 'Transfer must contain exactly two manifests and 64 lifecycle PNGs; no private sources');
  const bytes = new Map();
  for (const file of expected) bytes.set(file, await readFile(path.join(bundleRoot, file)));
  const completeHashes = [];
  for (const family of MILITARY_FAMILIES) {
    const manifestFile = `${MILITARY_ROOT}/${family}-complete-renderer.json`;
    const current = JSON.parse(await readFile(path.join(repoRoot, manifestFile), 'utf8'));
    const candidate = JSON.parse(bytes.get(manifestFile).toString('utf8'));
    validateBuildingLifecycle(candidate, {requireLifecycle: true});
    assert.equal(candidate.asset, family);
    assert.deepEqual([...candidate.stateOrder].sort(), ['complete', ...MILITARY_STATES].sort());
    assert.deepEqual(candidate.camera, current.camera, `${family}: preserve current registration`);
    assert.deepEqual(candidate.completeState, current.completeState, `${family}: preserve approved Complete references`);
    assert.equal(candidate.camera.elevationDegrees, 46);
    assert.deepEqual(candidate.camera.framePixels, [1024, 1024]);
    assert.equal(candidate.camera.pixelsPerWorldUnit, 128);
    assert.deepEqual(candidate.camera.azimuthDegrees, Array.from({length: 8}, (_, i) => i * 45));
    for (const [section, key, value] of [['construction', 'foundationAtOrBelow', .275],
      ['health', 'damagedAtOrBelow', .6], ['health', 'criticalAtOrBelow', .3]]) {
      const declared = candidate.stateMapping?.[section]?.[key];
      assert.ok(declared === undefined || declared === value, `${family}: unexpected ${key}`);
    }
    assert.equal(candidate.stateMapping?.harvest, undefined, 'Military states must not inherit Farm exhaustion');
    const completePixels = new Set();
    for (const view of current.completeState.views) {
      const file = `${MILITARY_ROOT}/${view.path}`;
      assert.equal(view.path, `captures/${family}-complete-view-0${view.index}.png`);
      const complete = await readFile(path.join(repoRoot, file));
      assert.equal(hash(complete), view.sha256, `${file}: current Complete hash differs`);
      completePixels.add(hash(decodeRgba8(complete).pixels));
      completeHashes.push({path: file, sha256: view.sha256});
    }
    const unique = new Map();
    for (const state of candidate.states) for (const view of state.views) {
      const expectedPath = `runtime/${family}-${state.state}-view-0${view.index}.png`;
      assert.equal(view.path, expectedPath, 'Only the exact state/direction runtime path is admitted');
      assert.equal(view.teamMaskPath, undefined, 'Retain live team standards; masks are outside this batch');
      const image = bytes.get(`${MILITARY_ROOT}/${view.path}`);
      assert.equal(image.length, view.bytes, `${view.path}: length differs`);
      assert.equal(hash(image), view.sha256, `${view.path}: hash differs`);
      checkRuntimePng(image);
      const decoded = decodeRgba8(image);
      assert.equal(decoded.width, 1024); assert.equal(decoded.height, 1024);
      const bounds = measureFrameAlpha(decoded, {x: 0, y: 0, width: 1024, height: 1024});
      assert.ok(bounds && bounds.x >= 2 && bounds.y >= 2
        && bounds.x + bounds.width <= 1022 && bounds.y + bounds.height <= 1022, `${view.path}: empty or clipped alpha`);
      // A repeated Complete capture cannot masquerade as produced lifecycle art.
      const rgba = hash(decoded.pixels);
      const heading = unique.get(view.index) ?? new Set();
      assert.ok(!heading.has(rgba), `${view.path}: duplicate state pixels at this heading`);
      heading.add(rgba); unique.set(view.index, heading);
      assert.ok(!completePixels.has(rgba), `${view.path}: Complete pixels copied into a lifecycle state`);
      for (const complete of current.completeState.views) assert.notEqual(view.sha256, complete.sha256, 'Complete copied into a lifecycle state');
    }
  }
  return {bytes, completeHashes};
}

export async function prepareMilitaryIntegration({repoRoot, bundleRoot, outputRoot}) {
  const output = path.resolve(outputRoot), repo = await realpath(repoRoot), bundle = await realpath(bundleRoot);
  await rejectSymlinkedAncestors(output);
  for (const root of [repo, bundle]) assert.ok(output !== root && !output.startsWith(root + path.sep), 'Overlay must be outside source/transfer roots');
  try { await lstat(output); throw new Error('Overlay output already exists; choose a new path'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  // All input and packaging validation completes before the first output write.
  const verified = await verifyMilitaryTransfer({repoRoot: repo, bundleRoot: bundle});
  const [dockerfile, dockerignore, server] = await Promise.all(['Dockerfile', '.dockerignore', MILITARY_HTTP_ASSET_PATH]
    .map(file => readFile(path.join(repo, file), 'utf8')));
  const config = militaryPackagingOverlay({dockerfile, dockerignore, server});
  const entries = [...verified.bytes, ...Object.entries(config).map(([name, text]) => [name, Buffer.from(text)])];
  for (const [file, bytes] of entries) {
    await mkdir(path.dirname(path.join(output, file)), {recursive: true});
    await writeFile(path.join(output, file), bytes);
  }
  const receipt = {files: entries.map(([file, bytes]) => ({path: file, sha256: hash(bytes)})),
    completeHashes: verified.completeHashes, evidence: 'Local transfer/hash/registration overlay only; reviewed-batch identity, clean release, deployment and real-game acceptance remain separate.'};
  await writeFile(path.join(output, 'integration-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--plan') {
    console.log(JSON.stringify({files: militaryTransferFiles(), preserve: 'All 16 existing Complete PNGs; private sources stay private', configs: ['Dockerfile', '.dockerignore', MILITARY_HTTP_ASSET_PATH], evidence: 'Transfer plan only; no assets produced or delivered'}, null, 2));
    return;
  }
  assert.ok(args.length === 4 && args[0] === '--bundle' && args[2] === '--output',
    'Usage: node scripts/prepare-military-lifecycle-integration.mjs --plan | --bundle DIR --output NEW_DIR');
  const repoRoot = fileURLToPath(new URL('../', import.meta.url));
  console.log(JSON.stringify(await prepareMilitaryIntegration({repoRoot, bundleRoot: args[1], outputRoot: args[3]}), null, 2));
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
