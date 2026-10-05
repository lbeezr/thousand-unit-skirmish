import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after } from 'node:test';
import { auditAssetAdoption } from './audit-asset-adoption.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(await readFile(path.join(root, 'docs/asset-adoption-registry.json')));
const release = JSON.parse(execFileSync(process.execPath, ['scripts/pack-railway-release.mjs', '--allow-dirty'],
  { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));
after(() => rm(release.directory, { recursive: true, force: true }));
const audit = (changes = {}) => auditAssetAdoption({ registry: structuredClone(registry), releaseFiles: release.files, ...changes });
const mainWithBuildingMode = async mode => (await readFile(path.join(root, 'src/main.js'), 'utf8')).replace(
  "const frontierBuildingsPreview = roomPageUrl.searchParams.get('frontierBuildingsPreview');",
  `const frontierBuildingsPreview = '${mode}';`);

test('actual selectors report adoption without making experiments permanent', async () => {
  const report = await audit();
  assert.equal(report.results.length, registry.records.length);
  for (const row of report.results) {
    if (row.defaultBound) assert.equal(row.releaseIncluded, true);
    else assert.ok(row.exception.nextAction);
  }
  assert.equal(report.results.find(row => row.id === 'bellweather-sheep').defaultBound, true);
  assert.equal(report.results.find(row => row.id === 'human-worker-fishing-SE').defaultBound, true);
  for (const id of ['frontier-barracks', 'frontier-archery-range']) {
    assert.equal(report.results.find(row => row.id === id).defaultBound, true);
  }
  assert.match(report.inGameVerification, /not established/);
});

test('removing an approved default atlas from the actual pack inventory fails', async () => {
  await assert.rejects(audit({ releaseFiles: release.files.filter(file => !file.endsWith('sheep-atlas-runtime.png')) }),
    /default runtime dependency omitted from release/);
});

test('a runtime capture missing its required digest cannot be called usable', async () => {
  const record = registry.records.find(row => row.id === 'frontier-town-center');
  const manifest = JSON.parse(await readFile(path.join(root, record.manifest)));
  delete manifest.completeState.views[0].sha256;
  await assert.rejects(audit({ registry: { ...registry, records: [record] }, loadManifest: async () => manifest }),
    /runtime dependency digest required/);
});

test('painted ground guard rejects a missing authored mip and a disconnected default binding', async () => {
  await assert.rejects(audit({ releaseFiles: release.files.filter(file => !file.endsWith('frontier-painted-material-atlas-mip-5.webp')) }),
    /frontier-painted-material-atlas-v1: default runtime dependency omitted from release/);
  const environment = (await readFile(path.join(root, 'src/environment-art.mjs'), 'utf8')).replace(
    'if (painted) return painted;', 'if (false) return painted;');
  await assert.rejects(audit({ environment }), /frontier-painted-material-atlas-v1: approved runtime asset is not default-bound/);
});

test('oak depletion guard rejects lost default sampling and a missing authored mip', async () => {
  await assert.rejects(audit({ releaseFiles: release.files.filter(file => !file.endsWith('oak-depletion-mip-5.webp')) }),
    /frontier-oak-depletion-atlas-v1: default runtime dependency omitted from release/);
  const environment = (await readFile(path.join(root, 'src/environment-art.mjs'), 'utf8')).replace(
    'const oakDepletion = await loadOakDepletionAtlas()', 'const oakDepletion = await Promise.resolve(null)');
  await assert.rejects(audit({ environment }), /frontier-oak-depletion-atlas-v1: approved runtime asset is not default-bound/);
});

test('painted scree guard rejects a disconnected terrace-face consumer', async () => {
  const source = await readFile(path.join(root, 'src/environment-art.mjs'), 'utf8');
  for (const [from, to] of [["texture: base === 'scree' ? groundTexture('scree', definition) : null", 'texture: null'],
    ['if (cliffFaces) meshes.push(cliffFaces)', 'if (false) meshes.push(cliffFaces)']]) {
    await assert.rejects(audit({ environment: source.replace(from, to) }), /scree cliff faces/);
  }
});

test('a default Worker downgrade cannot silently strand the approved fishing manifest', async () => {
  const main = (await readFile(path.join(root, 'src/main.js'), 'utf8')).replace("{ human: 'v3', infantry:", "{ human: 'v2', infantry:");
  await assert.rejects(audit({ main }), /human-worker-fishing-SE: approved runtime asset is not default-bound/);
});

test('normal constructor must consume approved roles and versions', async () => {
  const main = await readFile(path.join(root, 'src/main.js'), 'utf8');
  for (const [from, to] of [
    ['roles: unitSpritePreviewRoles,', 'roles: [],'],
    ['roleSpriteVersions: unitSpritePreviewVersions,', "roleSpriteVersions: { human: 'v2' },"],
  ]) await assert.rejects(audit({ main: main.replace(from, to) }),
    /human-worker-fishing-SE: approved runtime asset is not default-bound/);
});

test('an unbound approved family needs an explicit integration owner and exit action', async () => {
  const changed = structuredClone(registry);
  changed.records = [changed.records.find(row => row.id === 'frontier-stable')];
  delete changed.records[0].exception;
  await assert.rejects(audit({ registry: changed, main: await mainWithBuildingMode('0') }),
    /frontier-stable: approved runtime asset is not default-bound/);
  const ownerless = structuredClone(registry);
  ownerless.records[0].owner = '';
  await assert.rejects(audit({ registry: ownerless }), /integration owner required/);
  const noExit = structuredClone(registry);
  noExit.records = [{ ...noExit.records.find(row => row.id === 'frontier-stable'),
    exception: { reason: 'Test experiment', evidence: 'docs/asset-adoption-checklist.md' } }];
  await assert.rejects(audit({ registry: noExit }), /exception nextAction required/);
});

test('enabling a default family cannot use its exception to conceal omitted release files', async () => {
  const record = { ...registry.records.find(row => row.id === 'frontier-stable'),
    exception: { reason: 'Test experiment', nextAction: 'Verify and remove exception',
      evidence: 'docs/asset-adoption-checklist.md' } };
  await assert.rejects(audit({ registry: { ...registry, records: [record] }, main: await mainWithBuildingMode('stable'),
    releaseFiles: release.files.filter(file => file !== record.manifest) }),
  /frontier-stable: default runtime dependency omitted from release/);
});

test('normal Spearman constructor rejects an omitted role, wrong version and swapped civilization', async () => {
  const main = await readFile(path.join(root, 'src/main.js'), 'utf8');
  const record = registry.records.find(row => row.id === 'human-spearman-default');
  const selected = { ...registry, records: [record] };
  assert.equal((await audit({ registry: selected })).results[0].defaultBound, true);
  for (const [from, to] of [
    ["['human', 'infantry', 'spearman', 'archer'", "['human', 'infantry', 'archer'"],
    ["spearman: 'v1', archer:", "spearman: 'v2', archer:"],
    ["teamCivilizations: humanRosterPreview ? ['human', 'boughward'] : null,", "teamCivilizations: ['boughward', 'human'],"],
  ]) {
    assert.ok(main.includes(from), 'negative control must mutate the actual constructor input');
    await assert.rejects(audit({ registry: selected, main: main.replace(from, to) }),
      /human-spearman-default: approved runtime asset is not default-bound/);
  }
});

test('registered Spearman atlas, mask and manifest must reach the actual release inventory', async () => {
  const record = registry.records.find(row => row.id === 'human-spearman-default');
  const selected = { ...registry, records: [record] };
  for (const file of ['sprite-atlas-pack-v1.json', 'spearman-atlas-runtime.png', 'team-accent-mask.png']) {
    const target = path.join(path.dirname(record.manifest), file);
    assert.ok(release.files.includes(target), 'negative control removes an actual packaged dependency');
    await assert.rejects(audit({ registry: selected, releaseFiles: release.files.filter(file => file !== target) }),
      /human-spearman-default: default runtime dependency omitted from release/);
  }
  const manifest = JSON.parse(await readFile(path.join(root, record.manifest)));
  manifest.files = manifest.files.filter(file => file.usage !== 'team-mask');
  await assert.rejects(audit({ registry: selected, loadManifest: async () => manifest }),
    /declared runtime atlas and team mask required/);
});
