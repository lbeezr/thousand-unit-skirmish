import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { frontierBuildingManifestUrl, frontierBuildingPreviewUrl } from '../src/frontier-building-preview.mjs';
import { WILDLIFE_RENDER_REGISTRY } from '../src/neutral-wildlife-renderer.mjs';
import { activeState, spriteActionClip, spriteDirectory } from '../src/unit-sprite-runtime.mjs';
import { checkClientImports } from './check-client-imports.mjs';
import { groundTextureName, PAINTED_MATERIAL_ATLAS_MANIFEST, PAINTED_MATERIAL_NAMES,
  paintedMaterialAtlasDescriptor } from '../src/painted-material-atlas-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFile(path.join(root, relative));
const json = async relative => JSON.parse(await read(relative));
const relativeUrl = url => path.relative(root, fileURLToPath(url));

// Evaluate the real URL configuration with no art options. This intentionally
// fails on configuration refactors: update the probe alongside its consumer.
export function normalRoster(main) {
  const start = main.indexOf('const humanRosterPreview =');
  const end = main.indexOf('const ROOM_ID =', start);
  assert.ok(start >= 0 && end > start, 'normal roster configuration must be inspectable');
  return vm.runInNewContext(`${main.slice(start, end)}\n({ humanRosterPreview, castPreview, unitSpritePreviewRoles, unitSpritePreviewVersions })`,
    { roomPageUrl: new URL('http://audit.invalid/?room=normal-match') }, { timeout: 1000 });
}

function unitRuntimeOptions(main, roster) {
  const start = main.indexOf('const unitSpriteRuntime = createUnitSpriteRuntime({');
  const end = main.indexOf('\n});', start);
  assert.ok(start >= 0 && end > start, 'normal sprite runtime constructor must be inspectable');
  return vm.runInNewContext(`${main.slice(start, end + 4)}\nunitSpriteRuntime`, {
    ...roster, roomPageUrl: new URL('http://audit.invalid/?room=normal-match'),
    THREE: {}, scene: {}, MAX_PER_TEAM: 1, TEAM_HEX: [], camera: { quaternion: {} },
    workerFishingContactRuntime: {}, createUnitSpriteRuntime: options => options,
  }, { timeout: 1000 });
}

async function clientGraph() {
  const checks = await checkClientImports('http://audit.invalid', { fetchImpl: async url => {
    const relative = new URL(url).pathname.slice(1);
    const file = relative.startsWith('vendor/')
      ? `node_modules/three/build/${path.basename(relative)}` : relative;
    return new Response(await read(file), { headers: { 'content-type': 'text/javascript' } });
  } });
  return new Set(checks.map(item => item.path.slice(1)));
}

export async function auditAssetAdoption({ registry, releaseFiles, main = null, environment = null, loadManifest = json }) {
  assert.equal(registry.schemaVersion, 1);
  assert.ok(registry.scope?.trim() && registry.records?.length, 'state the bounded registry coverage');
  const graph = await clientGraph();
  main ??= (await read('src/main.js')).toString();
  const roster = normalRoster(main);
  const runtime = unitRuntimeOptions(main, roster);
  const packed = new Set(releaseFiles), ids = new Set(), results = [];
  for (const record of registry.records) {
    assert.ok(record.id && !ids.has(record.id), 'unique asset id required'); ids.add(record.id);
    assert.ok(record.owner?.trim(), `${record.id}: integration owner required`);
    if (record.exception) {
      for (const field of ['reason', 'nextAction', 'evidence']) {
        assert.ok(record.exception[field]?.trim(), `${record.id}: exception ${field} required`);
      }
      await read(record.exception.evidence);
    }
    const manifest = await loadManifest(record.manifest);
    const dependencies = [{ path: record.manifest, container: true }];
    let defaultBound = false, module;
    if (record.probe === 'painted-ground') {
      module = 'src/painted-material-atlas-runtime.mjs';
      assert.equal(relativeUrl(PAINTED_MATERIAL_ATLAS_MANIFEST), record.manifest);
      const descriptor = paintedMaterialAtlasDescriptor(manifest);
      environment ??= (await read('src/environment-art.mjs')).toString();
      assert.match(main, /createGroundSurfaces\(definition\)/, 'main must consume normal ground surfaces');
      assert.ok(graph.has('src/environment-art.mjs'), 'normal environment renderer must be reachable');
      defaultBound = /const paintedGrounds = await loadPaintedMaterialAtlas\(\)/.test(environment)
        && /const name = groundTextureName\(material, definition, variant,/.test(environment)
        && /const painted = paintedGrounds\?\.texture\(name\);\s*if \(painted\) return painted;/.test(environment)
        && PAINTED_MATERIAL_NAMES.every(name => descriptor.rects.has(groundTextureName(name, {}, false, '')));
      dependencies.push(...descriptor.mipFiles);
    } else if (record.probe === 'frontier-building') {
      module = 'src/frontier-building-preview.mjs';
      assert.match(main, /frontierBuildingManifestUrl\(building\.type, frontierBuildingsPreview\)/,
        'main must consume the building selector');
      const mode = vm.runInNewContext(main.match(/const frontierBuildingsPreview = ([^;]+);/)?.[1] || 'undefined',
        { roomPageUrl: new URL('http://audit.invalid/?room=normal-match') }, { timeout: 1000 });
      const normal = frontierBuildingManifestUrl(record.building, mode);
      const available = normal || frontierBuildingPreviewUrl(record.building, record.building);
      assert.ok(available, `${record.id}: registered Complete loader path required`);
      assert.equal(relativeUrl(available), record.manifest, `${record.id}: selector/manifest disagreement`);
      defaultBound = Boolean(normal);
      assert.equal(manifest.asset, record.building);
      assert.ok(manifest.completeState?.views?.length, `${record.id}: capture views required`);
      for (const state of [manifest.completeState, ...(manifest.states || [])]) {
        for (const view of state.views || []) {
          dependencies.push({ ...view, path: path.join(path.dirname(record.manifest), view.path) });
          if (view.teamMaskPath) dependencies.push({
            path: path.join(path.dirname(record.manifest), view.teamMaskPath), sha256: view.teamMaskSha256 });
        }
      }
    } else if (record.probe === 'sheep') {
      module = 'src/neutral-wildlife-renderer.mjs';
      assert.match(main, /^const wildlifeRenderer = createNeutralWildlifeRenderer\(/m,
        'normal main must instantiate the neutral renderer');
      const binding = WILDLIFE_RENDER_REGISTRY[record.id];
      defaultBound = binding?.alive === 'eight-view-static';
      assert.equal(relativeUrl(binding.bindingUrl), record.binding);
      const descriptor = await json(record.binding);
      assert.equal(path.join(path.dirname(record.binding), descriptor.manifest), record.manifest);
      assert.equal(createHash('sha256').update(await read(record.manifest)).digest('hex'), descriptor.manifestSha256);
      dependencies.push({ path: record.binding, container: true });
    } else if (record.probe === 'human-worker-fishing') {
      module = 'src/unit-sprite-runtime.mjs';
      defaultBound = runtime.castPreview && runtime.humanAppearancePreview
        && runtime.teamCivilizations?.[0] === 'human' && runtime.roles.includes('human')
        && `assets/units/${spriteDirectory('human', runtime.roleSpriteVersions.human)}/sprite-atlas-pack-v1.json` === record.manifest;
      const clips = new Map(manifest.assets[0].clips.map(clip => [`${clip.stateId}|${clip.directionId}`, clip]));
      const state = activeState({ kind: 'worker', hp: 100, task: 'gathering', workResourceVariant: 'shore-fish' }, 1000);
      assert.equal(state, 'gather-fish');
      assert.equal(spriteActionClip(clips, state, 'south-east', 'food', 'human')?.stateId, 'gather-fish');
    } else throw new Error(`${record.id}: unsupported default-binding probe ${record.probe}`);
    assert.ok(graph.has(module), `${record.id}: consumer not reachable from game entry`);
    for (const file of record.probe === 'painted-ground' ? [] : manifest.files || []) {
      if (['runtime', 'team-mask'].includes(file.usage)) dependencies.push({ ...file,
        path: path.join(path.dirname(record.manifest), file.path) });
    }
    const missing = [];
    for (const file of dependencies) {
      assert.ok(!path.isAbsolute(file.path) && !file.path.split(path.sep).includes('..'),
        `${record.id}: unsafe runtime dependency`);
      const bytes = await read(file.path);
      if (!file.container) {
        assert.match(file.sha256 || '', /^[a-f0-9]{64}$/i,
          `${record.id}: runtime dependency digest required ${file.path}`);
        assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256.toLowerCase(),
          `${record.id}: runtime hash ${file.path}`);
      }
      if (!packed.has(file.path)) missing.push(file.path);
    }
    assert.ok(defaultBound || record.exception, `${record.id}: approved runtime asset is not default-bound; owner-held exception required`);
    // An exception permits an explicit unbound experiment, never missing files
    // after the owner activates it in normal play.
    if (defaultBound) assert.deepEqual(missing, [], `${record.id}: default runtime dependency omitted from release`);
    results.push({ id: record.id, owner: record.owner, defaultBound, releaseIncluded: missing.length === 0,
      missing, status: defaultBound ? 'static-binding-and-package-checked' : 'incomplete-experiment',
      ...(defaultBound ? {} : { exception: record.exception }) });
  }
  return { scope: registry.scope, inGameVerification: 'not established by this static audit', results };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 2, 'Usage: node scripts/audit-asset-adoption.mjs');
  // Disposable local pack; no deploy, credentials, Docker build or provider job.
  const release = JSON.parse(execFileSync(process.execPath, ['scripts/pack-railway-release.mjs', '--allow-dirty'],
    { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));
  try {
    const report = await auditAssetAdoption({ registry: await json('docs/asset-adoption-registry.json'), releaseFiles: release.files });
    console.log(JSON.stringify({ sourceRevision: release.sourceRevision, sourceDirty: release.sourceDirty,
      releaseDigest: release.digest, ...report }, null, 2));
  } finally { await rm(release.directory, { recursive: true, force: true }); }
}
