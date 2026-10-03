import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORKER_PORTRAITS, BARRACKS_PORTRAIT } from '../src/selection-portrait.mjs';
import { buildingSpriteUrl } from '../src/building-sprites.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const server = readFileSync(path.join(root, 'server.mjs'), 'utf8');
const environmentArt = readFileSync(path.join(root, 'src/environment-art.mjs'), 'utf8');
const clientAllowlist = server.match(/const publicClientAsset = \[([\s\S]*?)\]\.includes\(relative\);/);
assert.ok(clientAllowlist, 'server static client asset allowlist should be declared');
const allowed = new Set([...clientAllowlist[1].matchAll(/'([^']+)'/g)].map((match) => match[1]));
const uiAllowlist = server.match(/const publicUiAsset = \[([\s\S]*?)\]\.includes\(relative\);/);
assert.ok(uiAllowlist, 'server UI asset allowlist should be declared');
const allowedUi = new Set([...uiAllowlist[1].matchAll(/'([^']+)'/g)].map((match) => match[1]));
const environmentModule = server.match(/const publicEnvironmentModule = relative === '([^']+)'/)?.[1];
assert.ok(environmentModule, 'server should explicitly allow the environment renderer module');
assert.ok(allowed.has('src/water-surface-geometry.mjs'), 'water geometry module should be statically served');
const spriteNames = environmentArt.match(/const spriteNames = \[([\s\S]*?)\];/);
assert.ok(spriteNames, 'environment renderer should declare its environment sprite families');
const servedEnvironmentAssets = server.match(/const publicEnvironmentAsset = ([\s\S]*?);\n  const publicInteractiveEnvironmentAsset/);
assert.ok(servedEnvironmentAssets, 'server should explicitly allow environment sprites');
const allowedEnvironmentNames = new Set([...servedEnvironmentAssets[1].matchAll(/'([^']+)'/g)]
  .map((match) => match[1]));
const rendererSpriteNames = new Set([...spriteNames[1].matchAll(/'([^']+)'/g)]
  .map((match) => match[1]));
rendererSpriteNames.add('oak');
rendererSpriteNames.add('berries');
for (const name of rendererSpriteNames) {
  assert.ok(allowedEnvironmentNames.has(name), `environment sprite ${name} is loaded by the renderer but missing from the server asset allowlist`);
}

const entryModules = [...html.matchAll(/<script\s+type="module"\s+src="\.\/([^\"]+)"/g)]
  .map((match) => match[1]);
assert.ok(entryModules.length > 0, 'HTML should declare at least one client module entry point');

const visited = new Set();
const pending = [...entryModules];
const importPattern = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)['"]([^'"]+)['"]/g;
while (pending.length > 0) {
  const modulePath = path.posix.normalize(pending.pop());
  if (visited.has(modulePath)) continue;
  visited.add(modulePath);
  assert.ok(allowed.has(modulePath) || modulePath === environmentModule,
    `client module ${modulePath} is imported but missing from the server static allowlist`);
  const source = readFileSync(path.join(root, modulePath), 'utf8');
  for (const [, specifier] of source.matchAll(importPattern)) {
    if (!specifier.startsWith('.')) continue;
    const dependency = path.posix.normalize(path.posix.join(path.posix.dirname(modulePath), specifier));
    assert.ok(dependency.startsWith('src/'), `unexpected client module path: ${dependency}`);
    assert.ok(statSync(path.join(root, dependency)).isFile(), `client import is missing: ${dependency}`);
    pending.push(dependency);
  }
}

for (const resource of ['index.html', 'style.css', 'vendor/three.module.js', 'vendor/three.core.js']) {
  assert.ok(allowed.has(resource), `required client resource is missing from the server static allowlist: ${resource}`);
}
for (const resource of [
  'assets/ui/preview.html', 'assets/ui/cursors/manifest.json',
  'assets/ui/cursors/select.png', 'assets/ui/cursors/box-select.png',
  'assets/ui/cursors/move.png', 'assets/ui/cursors/attack-move.png',
  'assets/ui/cursors/gather.png', 'assets/ui/cursors/build-valid.png',
  'assets/ui/cursors/build-blocked.png', 'assets/ui/icons/wood.svg',
  'assets/ui/icons/food.svg', 'assets/ui/icons/move.svg',
  'assets/ui/icons/attack.svg', 'assets/ui/icons/gather.svg', 'assets/ui/icons/build.svg',
  'assets/ui/portraits/human-worker-source.png', 'assets/ui/portraits/boughward-worker-source.png',
]) {
  assert.ok(allowedUi.has(resource), `UI asset is missing from the server allowlist: ${resource}`);
}
assert.match(server, /'\.svg': 'image\/svg\+xml'/, 'SVG icons need the correct response MIME type');
for (const resource of allowedUi) {
  assert.ok(statSync(path.join(root, resource)).isFile(), `allowlisted UI asset is missing: ${resource}`);
}
for (const [role, source, sha256] of [
  ['human', 'docs/art-direction/human-vaelora-sprites-v1/source/Idle/facings.png', '323071be89e1fc6e181ec4c7b946d28048043380b4faaa285f368e6efe1c54ad'],
  ['boughward-worker', 'docs/art-direction/boughward-roster-v1/extracted/worker/00.png', '7296c0b24ad61c02b65bfc9d6d88c8f46391bfa1efbaeba2e4c2615de07f9aa6'],
]) {
  const portrait = WORKER_PORTRAITS[role], resource = portrait.asset.slice(1);
  assert.ok(allowedUi.has(resource), `portrait must be served: ${resource}`);
  const image = readFileSync(path.join(root, resource));
  assert.equal(createHash('sha256').update(image).digest('hex'), sha256, 'portrait reuses inspected source bytes');
  assert.deepEqual(image, readFileSync(path.join(root, source)), 'no new image or atlas face enlargement');
  assert.equal(image.readUInt32BE(16), portrait.sourceWidth);
  assert.ok(portrait.cropX >= 0 && portrait.cropY >= 0 && portrait.cropSize > 0);
  assert.ok(portrait.cropX + portrait.cropSize <= portrait.sourceWidth);
  assert.ok(portrait.cropY + portrait.cropSize <= image.readUInt32BE(20));
}
const barracksRoot = 'assets/buildings/barracks-sprite-test-v1';
const barracksProvenance = readFileSync(path.join(root, barracksRoot, 'PROVENANCE.md'), 'utf8');
const barracksHashes = new Map([...barracksProvenance.matchAll(/`runtime\/([^`]+)`\s*\|\s*`([a-f0-9]{64})`/g)]
  .map(([, name, hash]) => [name, hash]));
assert.equal(barracksHashes.size, 10, 'both teams retain all five existing Barracks frames');
const barracksGrid = JSON.parse(readFileSync(path.join(root, barracksRoot, 'sprite-grid.json'), 'utf8'));
assert.equal(BARRACKS_PORTRAIT.sourceWidth, barracksGrid.spriteFrame.pixels[0]);
for (const team of [0, 1]) for (const state of [
  { complete: false, progress: 0 }, { complete: false, progress: 0.5 },
  { complete: true, hp: 1800 }, { complete: true, hp: 900 }, { complete: true, hp: 300 },
]) {
  const resource = buildingSpriteUrl({ type: 'barracks', team, maxHp: 1800, ...state }).slice(2);
  const bytes = readFileSync(path.join(root, resource));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), barracksHashes.get(path.basename(resource)),
    'Barracks thumbnail uses the retained shipped source');
}
const menuStyle = readFileSync(path.join(root, 'src/game-menu.css'), 'utf8');
assert.ok(allowed.has('src/game-menu.css'), 'entry menu stylesheet must be served');
const menuSources = new Set([
  WORKER_PORTRAITS.human.asset,
  `/${buildingSpriteUrl({ type: 'barracks', team: 0, complete: true, hp: 1800, maxHp: 1800 }).slice(2)}`,
]);
for (const [, asset] of menuStyle.matchAll(/url\(['"]([^'"]+)['"]\)/g)) {
  assert.ok(menuSources.has(asset), `menu art must reuse a verified shipped source: ${asset}`);
  assert.ok(statSync(path.join(root, asset.slice(1))).isFile(), `menu art is missing: ${asset}`);
}
const cursorManifest = JSON.parse(readFileSync(path.join(root, 'assets/ui/cursors/manifest.json'), 'utf8'));
const style = readFileSync(path.join(root, 'style.css'), 'utf8');
for (const [state, cursor] of Object.entries(cursorManifest.cursors)) {
  assert.ok(allowedUi.has(cursor.runtime), `runtime cursor is not allowlisted: ${cursor.runtime}`);
  const image = readFileSync(path.join(root, cursor.runtime));
  assert.deepEqual([image.readUInt32BE(16), image.readUInt32BE(20)], cursorManifest.cursorSize,
    `runtime cursor must match manifest dimensions: ${cursor.runtime}`);
  const [hotspotX, hotspotY] = cursor.hotspot;
  assert.ok(cursorManifest.cursorSize.every((n) => n > 0 && n <= 64));
  assert.ok(Number.isInteger(hotspotX) && hotspotX >= 0 && hotspotX < cursorManifest.cursorSize[0]);
  assert.ok(Number.isInteger(hotspotY) && hotspotY >= 0 && hotspotY < cursorManifest.cursorSize[1]);
  assert.ok(style.includes(`--cursor-${state}: url('/${cursor.runtime}') ${hotspotX} ${hotspotY}, ${cursor.fallback}`),
    `CSS cursor hotspot and fallback must match the manifest for ${state}`);
}
for (const icon of cursorManifest.icons.paths) {
  assert.ok(allowedUi.has(icon), `runtime icon is not allowlisted: ${icon}`);
}

process.stdout.write(`Client asset allowlist scenario passed: ${visited.size} imported client modules are served.\n`);
