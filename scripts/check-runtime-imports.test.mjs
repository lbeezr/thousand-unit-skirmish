import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { BROWSER_ENTRYPOINTS, BROWSER_PACKAGE_IMPORTS, checkRuntimeImports, moduleImports, readRuntimeSources, runtimeImportGraph, cyclicEdges } from './check-runtime-imports.mjs';

function check(files, options = {}) {
  return checkRuntimeImports(new Map(Object.entries(files)), {
    browserEntrypoints: [], serverEntrypoints: [], nodeOnlyModules: [], ...options,
  });
}

test('parse real imports, re-exports and nested lazy imports; ignore lookalike text', () => {
  assert.deepEqual(moduleImports(`
    // import './comment.mjs';
    /* export * from './comment-export.mjs'; */
    const text = "import './string.mjs'";
    const pattern = /import 'three'/;
    const template = \`import './template.mjs'\`;
    const object = { import() {} };
    import './effect.mjs';
    import { item } from './static.mjs';
    export { item } from './named.mjs';
    export * from './star.mjs';
    async function later() { return import('./lazy.mjs'); }
  `, 'fixture.mjs'), ['./effect.mjs', './lazy.mjs', './named.mjs', './star.mjs', './static.mjs']);
});

test('computed and interpolated imports cannot hide edges', () => {
  for (const source of ["import(name)", "import(`./${name}.mjs`)", "import('./' + name)"]) {
    assert.throws(() => moduleImports(source, 'src/lazy.mjs'), /src\/lazy.mjs:1: runtime imports must use literal specifiers/);
  }
});

test('normalized relative paths resolve; missing imports and tooling dependencies fail', () => {
  const result = check({ 'src/a.mjs': "import './nested/../b.mjs';", 'src/b.mjs': '' });
  assert.equal(result.localEdges, 1);
  assert.throws(() => check({ 'src/a.mjs': "import './missing.mjs'" }), /src\/a.mjs -> src\/missing.mjs: missing runtime module/);
  for (const source of ["import '../scripts/helper.mjs'", "export * from '../server.mjs'", "import('../scripts/helper.mjs')"]) {
    assert.throws(() => check({ 'src/a.mjs': source }), /src modules cannot import runtime hosts or tooling/);
  }
  assert.throws(() => check({ 'server.mjs': "import './scripts/helper.mjs'" }), /missing runtime module/);
});

test('runtime hosts and tooling cannot hide behind an absolute path or package alias', () => {
  for (const specifier of ['/server.mjs', '#server', 'file:///private.mjs', 'https://example.test/game.mjs']) {
    assert.throws(() => check({ 'src/a.mjs': `import '${specifier}'` }), /unresolved runtime import/);
  }
});

test('shared leaf modules can serve both runtimes; only three has a browser mapping', () => {
  const result = check({
    'src/client.mjs': "import './shared.mjs'; import 'three';",
    'src/shared.mjs': 'export const rule = 1;',
    'server.mjs': "import './src/shared.mjs'; import 'node:http';",
  }, { browserEntrypoints: ['src/client.mjs'], browserPackageImports: { 'src/client.mjs': ['three'] }, serverEntrypoints: ['server.mjs'] });
  assert.deepEqual(result.sharedModules, ['src/shared.mjs']);
  assert.equal(result.browserModules, 2);
  assert.equal(result.serverModules, 2);
  for (const specifier of ['three/addons/foo.js', 'acorn', 'node:fs', 'fs/promises']) {
    assert.throws(() => check({ 'src/client.mjs': `import '${specifier}'` }, {
      browserEntrypoints: ['src/client.mjs'],
    }), /unsupported browser import/);
  }
});

test('a shared helper must satisfy every entrypoint import map', () => {
  const files = {
    'src/game.mjs': "import './helper.mjs'", 'src/audio.mjs': "import('./helper.mjs')", 'src/helper.mjs': "import 'three'",
  };
  const options = { browserEntrypoints: ['src/game.mjs', 'src/audio.mjs'], browserPackageImports: { 'src/game.mjs': ['three'], 'src/audio.mjs': [] } };
  assert.throws(() => check(files, options), /src\/audio.mjs -> src\/helper.mjs -> three: unsupported browser import/);
  assert.doesNotThrow(() => check(files, { ...options, browserPackageImports: { 'src/game.mjs': ['three'], 'src/audio.mjs': ['three'] } }));
});

test('registered browser package policies match the five shipped HTML entrypoints', async () => {
  const registered = [];
  for (const filename of ['index.html', 'audio-studio.html', 'audio-zones.html', 'environment-review.html', 'water-study.html']) {
    const dom = new JSDOM(await readFile(new URL(`../${filename}`, import.meta.url), 'utf8'));
    try {
      const imports = {};
      for (const script of dom.window.document.querySelectorAll('script[type="importmap"]')) {
        Object.assign(imports, JSON.parse(script.textContent).imports);
      }
      for (const script of dom.window.document.querySelectorAll('script[type="module"][src]')) {
        const entrypoint = path.posix.normalize(script.getAttribute('src'));
        registered.push(entrypoint);
        assert.deepEqual(Object.keys(imports).sort(), BROWSER_PACKAGE_IMPORTS[entrypoint], `${filename}: package policy must match the document import map`);
        if (imports.three) assert.equal(path.posix.normalize(imports.three), 'vendor/three.module.js');
      }
    } finally { dom.window.close(); }
  }
  assert.deepEqual(registered.sort(), [...BROWSER_ENTRYPOINTS].sort());
});

test('browser closure rejects a transitive Node adapter with the full dependency path', () => {
  assert.throws(() => check({
    'src/client.mjs': "import('./shared.mjs')",
    'src/shared.mjs': "export * from './adapter.mjs'",
    'src/adapter.mjs': "import { randomBytes } from 'node:crypto'",
  }, { browserEntrypoints: ['src/client.mjs'], nodeOnlyModules: ['src/adapter.mjs'] }),
  /src\/client.mjs -> src\/shared.mjs -> src\/adapter.mjs: browser reaches a Node-only adapter/);
});

test('new Node dependencies require a deliberate adapter boundary, including unprefixed builtins', () => {
  for (const specifier of ['node:crypto', 'crypto']) {
    assert.throws(() => check({ 'src/rules.mjs': `import '${specifier}'` }), /Node builtins belong in a declared Node adapter/);
    assert.doesNotThrow(() => check({ 'src/adapter.mjs': `import '${specifier}'` }, { nodeOnlyModules: ['src/adapter.mjs'] }));
  }
});

test('server closure rejects rendering and browser boot dependencies transitively', () => {
  const files = { 'server.mjs': "import './src/rules.mjs'", 'src/rules.mjs': "import './renderer.mjs'", 'src/renderer.mjs': "import 'three'" };
  assert.throws(() => check(files, { serverEntrypoints: ['server.mjs'] }),
    /server.mjs -> src\/rules.mjs -> src\/renderer.mjs -> three: server rules cannot depend on rendering/);
  assert.throws(() => check({ 'server.mjs': "import './src/client.mjs'", 'src/client.mjs': '' }, {
    browserEntrypoints: ['src/client.mjs'], serverEntrypoints: ['server.mjs'],
  }), /server reaches a browser entrypoint/);
});

test('acyclic graph and explicit empty baseline pass; self, re-export and lazy cycles fail', () => {
  assert.deepEqual(check({ 'src/a.mjs': "import './b.mjs'", 'src/b.mjs': '' }).cycleEdges, []);
  assert.throws(() => check({ 'src/a.mjs': "import './a.mjs'" }), /new cyclic edge: src\/a.mjs -> src\/a.mjs/);
  assert.throws(() => check({ 'src/a.mjs': "export * from './b.mjs'", 'src/b.mjs': "import('./a.mjs')" }), /new cyclic edge/);
});

test('baseline accepts exactly existing cyclic edges; a new chord within the same component fails', () => {
  const files = {
    'src/a.mjs': "import './b.mjs'", 'src/b.mjs': "import './c.mjs'", 'src/c.mjs': "import './a.mjs'",
  };
  const cycleBaseline = cyclicEdges(runtimeImportGraph(new Map(Object.entries(files))));
  assert.deepEqual(cycleBaseline, [
    { from: 'src/a.mjs', to: 'src/b.mjs' }, { from: 'src/b.mjs', to: 'src/c.mjs' }, { from: 'src/c.mjs', to: 'src/a.mjs' },
  ]);
  assert.doesNotThrow(() => check(files, { cycleBaseline }));
  assert.throws(() => check({ ...files, 'src/a.mjs': "import './b.mjs'; import './c.mjs'" }, { cycleBaseline }),
    /new cyclic edge: src\/a.mjs -> src\/c.mjs/);
  assert.throws(() => check({ ...files, 'src/d.mjs': "import './d.mjs'" }, { cycleBaseline }),
    /new cyclic edge: src\/d.mjs -> src\/d.mjs/);
});

test('resolved cycles and duplicate baselines fail until the explicit ledger is cleaned up', () => {
  const edge = { from: 'src/a.mjs', to: 'src/a.mjs' };
  assert.throws(() => check({ 'src/a.mjs': '' }, { cycleBaseline: [edge] }), /stale cyclic edge/);
  assert.throws(() => check({ 'src/a.mjs': "import './a.mjs'" }, { cycleBaseline: [edge, edge] }), /duplicate cyclic edges/);
});

test('cycle inventory excludes one-way outgoing edges from cyclic components', () => {
  const files = { 'src/a.mjs': "import './b.mjs'; import './leaf.mjs'", 'src/b.mjs': "import './a.mjs'", 'src/leaf.mjs': '' };
  assert.deepEqual(cyclicEdges(runtimeImportGraph(new Map(Object.entries(files)))), [
    { from: 'src/a.mjs', to: 'src/b.mjs' }, { from: 'src/b.mjs', to: 'src/a.mjs' },
  ]);
});

test('source discovery includes new nested folders and unreferenced src modules', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rts-import-graph-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src/rules'), { recursive: true });
  await mkdir(path.join(root, 'scripts'));
  await writeFile(path.join(root, 'server.mjs'), "import './src/rules/a.mjs'");
  await writeFile(path.join(root, 'src/rules/a.mjs'), 'export const value = 1;');
  await writeFile(path.join(root, 'src/orphan.mjs'), "import './orphan.mjs'");
  await writeFile(path.join(root, 'src/style.css'), '');
  await writeFile(path.join(root, 'scripts/tool.mjs'), '');
  const sources = await readRuntimeSources(root);
  assert.deepEqual([...sources.keys()].sort(), ['server.mjs', 'src/orphan.mjs', 'src/rules/a.mjs']);
  assert.throws(() => checkRuntimeImports(sources, { browserEntrypoints: [], serverEntrypoints: ['server.mjs'] }), /new cyclic edge: src\/orphan.mjs/);
});
