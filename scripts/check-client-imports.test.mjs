import assert from 'node:assert/strict';
import test from 'node:test';
import { checkClientImports } from './browser/check-client-imports.mjs';

function fixture(files) {
  const requests = [];
  return {
    requests,
    async fetchImpl(url, options) {
      assert.equal(url.origin, 'https://game.example');
      assert.equal(options.headers.authorization, 'Basic fixture');
      assert.equal(options.redirect, 'error');
      requests.push(url.pathname);
      const file = files[url.pathname];
      return new Response(file?.body ?? 'missing', {
        status: file?.status ?? (file ? 200 : 404),
        headers: { 'content-type': file?.mime || 'text/javascript' },
      });
    },
  };
}

async function audit(files) {
  const server = fixture(files);
  const checks = await checkClientImports('https://game.example', {
    authorization: 'Basic fixture', fetchImpl: server.fetchImpl,
  });
  return { checks, requests: server.requests };
}

test('transitive imports, exports, Three alias and cycles are checked once', async () => {
  const { checks, requests } = await audit({
    '/src/main.js': { body: "import './helper.mjs'; import * as THREE from 'three';" },
    '/src/helper.mjs': { body: "export { value } from './nested.mjs';" },
    '/src/nested.mjs': { body: "import './helper.mjs'; export const value = 1;" },
    '/vendor/three.module.js': { body: "export { Core } from './three.core.js';" },
    '/vendor/three.core.js': { body: 'export const Core = 1;' },
  });
  assert.equal(new Set(requests).size, 5);
  assert.equal(requests.length, 5);
  assert.equal(checks.length, 5);
});

test('a missing transitive helper fails with its public path', async () => {
  await assert.rejects(audit({
    '/src/main.js': { body: "import './resource-format.mjs';" },
  }), /browser import \/src\/resource-format.mjs must be served/);
});

test('HTML fallback is rejected even with HTTP 200', async () => {
  await assert.rejects(audit({
    '/src/main.js': { body: '<html>Login</html>', mime: 'text/html' },
  }), /must have JavaScript MIME/);
});

test('a cross-origin import is rejected before credentials can be sent', async () => {
  await assert.rejects(audit({
    '/src/main.js': { body: "import '//other.example/private.mjs';" },
  }), /must stay on the game origin/);
});


test('an empty successful module is not accepted as a loaded client', async () => {
  await assert.rejects(audit({ '/src/main.js': { body: '' } }), /must not be empty/);
});

test('entrypoint audits include lazy game imports and reject cross-origin dynamic imports', async () => {
  const server = fixture({ '/src/entry.mjs': { body: "await import('./main.js');" }, '/src/main.js': { body: 'export const ready = true;' } });
  const checks = await checkClientImports('https://game.example', { authorization: 'Basic fixture', fetchImpl: server.fetchImpl, entrypoints: ['/src/entry.mjs'] });
  assert.deepEqual(checks.map(row => row.path), ['/src/entry.mjs', '/src/main.js']);
  await assert.rejects(audit({ '/src/main.js': { body: "import('https://other.example/game.js');" } }), /must stay on the game origin/);
});

test('comments, strings, templates and regular expressions cannot invent served imports', async () => {
  const { requests } = await audit({ '/src/main.js': { body: `
    // import './ghost.mjs';
    /* export * from './comment.mjs'; */
    const text = "import './string.mjs'";
    const template = \`import('./template.mjs')\`;
    const expression = /import 'regex.mjs'/;
    export { text, template, expression };
  ` } });
  assert.deepEqual(requests, ['/src/main.js']);
});

test('compact imports and re-exports expose missing transitive modules', async () => {
  await assert.rejects(audit({
    '/src/main.js': { body: "import{value}from'./helper.mjs';" },
    '/src/helper.mjs': { body: "export{value}from'./missing.mjs';" },
  }), /browser import \/src\/missing.mjs must be served/);
  await assert.rejects(audit({ '/src/main.js': { body: "export*from'./missing.mjs';" } }),
    /browser import \/src\/missing.mjs must be served/);
});

test('escaped specifiers are decoded before URL resolution', async () => {
  const { requests } = await audit({
    '/src/main.js': { body: String.raw`import './hel\u0070er.mjs';` },
    '/src/helper.mjs': { body: 'export const value = 1;' },
  });
  assert.deepEqual(requests, ['/src/main.js', '/src/helper.mjs']);
});

test('computed imports fail with their public path instead of hiding edges', async () => {
  for (const body of ["const name = './missing.mjs'; import(name);", "import(`./${name}.mjs`);"]) {
    await assert.rejects(audit({ '/src/main.js': { body } }),
      /\/src\/main.js:1: runtime imports must use literal specifiers/);
  }
});

test('invalid JavaScript fails with the served public path', async () => {
  await assert.rejects(audit({ '/src/main.js': { body: 'export const = 1;' } }),
    /\/src\/main.js: Unexpected token/);
});

test('lazy Three imports use the same alias as static imports', async () => {
  const { requests } = await audit({
    '/src/main.js': { body: "import('three'); import * as THREE from 'three';" },
    '/vendor/three.module.js': { body: "export*from'./three.core.js';" },
    '/vendor/three.core.js': { body: 'export const Core = 1;' },
  });
  assert.deepEqual(requests, ['/src/main.js', '/vendor/three.module.js', '/vendor/three.core.js']);
});

test('unmapped bare lazy specifiers fail before any dependency request', async () => {
  for (const specifier of ['unmapped-package', '@scope/package', 'three/addons/helper.js', '.hidden.mjs']) {
    const server = fixture({ '/src/main.js': { body: `import('${specifier}');` },
      '/src/unmapped-package': { body: 'export const fake = true;' } });
    await assert.rejects(checkClientImports('https://game.example', {
      authorization: 'Basic fixture', fetchImpl: server.fetchImpl,
    }), /unmapped browser import .* in \/src\/main.js/);
    assert.deepEqual(server.requests, ['/src/main.js']);
  }
});

test('relative, rooted and absolute same-origin lazy URLs retain their served paths', async () => {
  const { requests } = await audit({
    '/src/main.js': { body: "import('../src/helper.mjs'); import('/src/helper.mjs'); import('https://game.example/src/helper.mjs');" },
    '/src/helper.mjs': { body: 'export const ready = true;' },
  });
  assert.deepEqual(requests, ['/src/main.js', '/src/helper.mjs']);
});
