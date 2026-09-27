import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dockerignore = readFileSync(path.join(root, '.dockerignore'), 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));
const dockerfile = readFileSync(path.join(root, 'Dockerfile'), 'utf8');
const server = readFileSync(path.join(root, 'server.mjs'), 'utf8');
const uiAllowlist = server.match(/const publicUiAsset = \[([\s\S]*?)\]\.includes\(relative\);/);
assert.ok(uiAllowlist, 'server should declare a UI asset allowlist');
const assets = [...uiAllowlist[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
assert.ok(assets.length > 0, 'server UI asset allowlist should not be empty');

const parentAssetException = dockerignore.indexOf('!assets/');
const uiDirectoryException = dockerignore.indexOf('!assets/ui/');
const uiDescendantsException = dockerignore.indexOf('!assets/ui/**');
assert.ok(parentAssetException >= 0, 'Docker context should allow the assets directory');
assert.ok(uiDirectoryException > parentAssetException, 'Docker context should allow assets/ui after assets/');
assert.ok(uiDescendantsException > uiDirectoryException, 'Docker context should allow all assets/ui descendants');
assert.match(
  dockerfile,
  /^COPY --chown=node:node assets\/ui\/ \.\/assets\/ui\/\s*$/m,
  'Docker image should copy the UI asset directory',
);

const directlyReferencedAssets = new Set();
const assetReference = /(?:^|\/)assets\/ui\/[A-Za-z0-9._/-]+\.(?:svg|png|html|json)/g;
for (const sourceFile of ['index.html', 'style.css', 'src/main.js']) {
  const source = readFileSync(path.join(root, sourceFile), 'utf8');
  for (const match of source.matchAll(assetReference)) {
    directlyReferencedAssets.add(match[0].replace(/^\//, ''));
  }
}
if (/\/assets\/ui\/icons\/\$\{[^}]+\}\.svg/.test(readFileSync(path.join(root, 'src/main.js'), 'utf8'))) {
  for (const asset of assets) {
    if (asset.startsWith('assets/ui/icons/') && asset.endsWith('.svg')) directlyReferencedAssets.add(asset);
  }
}
for (const asset of directlyReferencedAssets) {
  assert.ok(assets.includes(asset), 'referenced UI asset must be in the server allowlist: ' + asset);
}
for (const asset of assets) {
  assert.ok(statSync(path.join(root, asset)).isFile(), 'allowlisted UI asset must exist: ' + asset);
}

process.stdout.write('Docker UI assets context scenario passed: ' + assets.length + ' allowlisted UI assets are included.\n');
