import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const server = readFileSync(path.join(root, 'server.mjs'), 'utf8');
const clientAllowlist = server.match(/const publicClientAsset = \[([\s\S]*?)\]\.includes\(relative\);/);
assert.ok(clientAllowlist, 'server static client asset allowlist should be declared');
const allowed = new Set([...clientAllowlist[1].matchAll(/'([^']+)'/g)].map((match) => match[1]));
const environmentModule = server.match(/const publicEnvironmentModule = relative === '([^']+)'/)?.[1];
assert.ok(environmentModule, 'server should explicitly allow the environment renderer module');

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

process.stdout.write(`Client asset allowlist scenario passed: ${visited.size} imported client modules are served.\n`);
