import assert from 'node:assert/strict';
import { moduleImportGroups } from './module-imports.mjs';

// Audit served modules, so deployment/packaging omissions cannot hide behind
// source-file checks. This follows static/re-export/literal lazy imports,
// not runtime asset requests.
export async function checkClientImports(base, { authorization, fetchImpl = fetch, entrypoints = ['/src/main.js'] } = {}) {
  const origin = new URL(base).origin;
  const pending = [...entrypoints];
  const visited = new Set();
  const checks = [];
  while (pending.length) {
    const modulePath = pending.pop();
    if (visited.has(modulePath)) continue;
    visited.add(modulePath);
    const url = new URL(modulePath, origin);
    assert.equal(url.origin, origin, `browser import must stay on the game origin: ${modulePath}`);
    const response = await fetchImpl(url, {
      headers: authorization ? { authorization } : {},
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, 200, `browser import ${modulePath} must be served`);
    assert.match(response.headers.get('content-type') || '', /(?:java|ecma)script/i,
      `browser import ${modulePath} must have JavaScript MIME`);
    const source = await response.text();
    assert.ok(source.trim(), `browser import ${modulePath} must not be empty`);
    checks.push({ path: modulePath, status: response.status });
    const { staticImports, dynamicImports } = moduleImportGroups(source, modulePath);
    for (const specifier of staticImports) {
      const dependency = specifier === 'three' ? '/vendor/three.module.js'
        : specifier.startsWith('.') ? new URL(specifier, url).pathname
          : specifier.startsWith('/') ? specifier : null;
      assert.ok(dependency, `unmapped browser import ${specifier} in ${modulePath}`);
      pending.push(dependency);
    }
    for (const specifier of dynamicImports) {
      const dependency = new URL(specifier === 'three' ? '/vendor/three.module.js' : specifier, url);
      assert.equal(dependency.origin, origin, `dynamic browser import must stay on the game origin: ${specifier}`);
      pending.push(dependency.pathname);
    }
  }
  return checks;
}
