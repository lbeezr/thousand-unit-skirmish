import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { BROWSER_ENTRYPOINTS, BROWSER_PACKAGE_IMPORTS, RUNTIME_DOMAINS, RUNTIME_DOMAIN_HOSTS, checkRuntimeImports, moduleImports, readRuntimeSources, runtimeImportGraph, cyclicEdges } from './check-runtime-imports.mjs';

function check(files, options = {}) {
  return checkRuntimeImports(new Map(Object.entries(files)), {
    browserEntrypoints: [], serverEntrypoints: [], nodeOnlyModules: [], requireDomainCoverage: false, ...options,
  });
}

test('offline adapter compatibility preserves its four named exports and binding identity', async () => {
  const legacy = await import('../src/pve-model-proposal.mjs');
  const current = await import('../src/server/pve-model-proposal.mjs');
  const names = ['MODEL_PROPOSAL_LIMITS', 'MODEL_PROPOSAL_SCHEMA_VERSION',
    'attachModelProposalOpponent', 'parseModelProposal'];
  assert.deepEqual(Object.keys(legacy), names);
  assert.deepEqual(Object.keys(current), names);
  for (const name of names) assert.equal(legacy[name], current[name], name);
});

test('every shipped browser entry rejects both offline adapter paths', async () => {
  const sources = await readRuntimeSources(new URL('../', import.meta.url).pathname);
  for (const entry of BROWSER_ENTRYPOINTS) {
    for (const adapter of ['pve-model-proposal.mjs', 'server/pve-model-proposal.mjs']) {
      const changed = new Map(sources);
      changed.set(entry, `${sources.get(entry)}\nimport './${adapter}';`);
      assert.throws(() => checkRuntimeImports(changed), /browser reaches a Node-only adapter/,
        `${entry} -> ${adapter}`);
    }
  }
});

test('every shipped browser entry rejects private manifest and transport paths, including pure negotiation', async () => {
  const sources = await readRuntimeSources(new URL('../', import.meta.url).pathname);
  for (const entry of BROWSER_ENTRYPOINTS) {
    for (const privateModule of ['server/client-asset-paths.mjs',
      'networking/websocket-deflate-offer.mjs', 'networking/websocket-frame.mjs']) {
      const changed = new Map(sources);
      changed.set(entry, `${sources.get(entry)}\nimport('./${privateModule}');`);
      assert.throws(() => checkRuntimeImports(changed), /browser reaches a server-private module/,
        `${entry} -> ${privateModule}`);
    }
  }
});

test('unreferenced simulation and AI modules reject client, authoring, presentation and transport imports', () => {
  for (const root of ['formation-assignment', 'pve-regroup']) {
    for (const target of ['resource-format', 'scenario-authoring', 'terrain-height', 'networking/websocket-deflate-offer']) {
      const files = { [`src/${root}.mjs`]: `import './${target}.mjs';`, [`src/${target}.mjs`]: '' };
      assert.throws(() => check(files), /(?:simulation|ai) domain cannot reach (?:client|authoring|presentation|server) domain/,
        `${root} -> ${target}`);
    }
  }
});

test('unclassified intermediates cannot hide backward static, lazy or re-export edges', () => {
  for (const source of ["import './resource-format.mjs';",
    "export { label } from './resource-format.mjs';", "const later = () => import('./resource-format.mjs');"]) {
    assert.throws(() => check({
      'src/formation-assignment.mjs': "import './bridge.mjs';",
      'src/bridge.mjs': source,
      'src/resource-format.mjs': 'export const label = 1;',
    }), /src\/formation-assignment.mjs -> src\/bridge.mjs -> src\/resource-format.mjs: simulation domain cannot reach client domain/);
  }
});

test('HUD canonical helpers and compatibility entries stay outside authoritative domains and hosts', () => {
  for (const helper of ['resource-format', 'population-readout', 'objective-summary']) {
    const canonical = `src/client/hud/${helper}.mjs`;
    const legacy = `src/${helper}.mjs`;
    const helpers = {
      [canonical]: 'export const label = 1;',
      [legacy]: `export { label } from './client/hud/${helper}.mjs';`,
    };
    for (const root of ['src/gameplay-action-rules.mjs', 'src/rules/gameplay-action-rules.mjs',
      'src/base-lifecycle.mjs', 'src/rules/base-lifecycle.mjs', 'src/map-utils.mjs', 'src/formation-assignment.mjs']) {
      for (const target of [canonical, legacy]) {
        const relative = path.posix.relative(path.posix.dirname(root), target);
        assert.throws(() => check({ ...helpers, [root]: `import '${relative.startsWith('.') ? relative : `./${relative}`}';` }),
          /(?:rules|world|simulation) domain cannot reach client domain/, `${root} -> ${target}`);
      }
    }
    for (const target of [canonical, legacy]) {
      assert.throws(() => check({ ...helpers, 'server.mjs': `import './${target}';` },
        { serverEntrypoints: ['server.mjs'] }), /server host reaches client domain/, `server.mjs -> ${target}`);
    }
  }
});

test('HUD projections remain dependency-free leaves with one explicit compatibility edge', async () => {
  for (const helper of ['resource-format', 'population-readout', 'objective-summary']) {
    const canonical = `src/client/hud/${helper}.mjs`;
    const legacy = `src/${helper}.mjs`;
    assert.deepEqual(moduleImports(await readFile(new URL(`../${canonical}`, import.meta.url), 'utf8'), canonical), [], canonical);
    assert.deepEqual(moduleImports(await readFile(new URL(`../${legacy}`, import.meta.url), 'utf8'), legacy),
      [`./client/hud/${helper}.mjs`], legacy);
  }
});

test('canonical audio leaves and compatibility paths stay outside authority and server hosts', () => {
  for (const [helper, binding] of [['audio-decoded-cache', 'createDecodedAudioCache'],
    ['audio-shipped-response', 'readBoundedAudioResponse']]) {
    const canonical = `src/client/audio/${helper}.mjs`;
    const legacy = `src/${helper}.mjs`;
    const helpers = {
      [canonical]: `export const ${binding} = () => {};`,
      [legacy]: `export { ${binding} } from './client/audio/${helper}.mjs';`,
    };
    for (const root of ['src/rules/gameplay-action-rules.mjs', 'src/rules/base-lifecycle.mjs',
      'src/map-utils.mjs', 'src/simulation/movement/formation-assignment.mjs', 'src/pve-regroup.mjs']) {
      for (const target of [canonical, legacy]) {
        const relative = path.posix.relative(path.posix.dirname(root), target);
        assert.throws(() => check({ ...helpers, [root]: `import '${relative.startsWith('.') ? relative : `./${relative}`}';` }),
          /(?:rules|world|simulation|ai) domain cannot reach client domain/, `${root} -> ${target}`);
      }
    }
    for (const host of ['server.mjs', 'room-supervisor.mjs']) {
      for (const target of [canonical, legacy]) {
        assert.throws(() => check({ ...helpers, [host]: `import './${target}';` },
          { serverEntrypoints: [host] }), /server host reaches client domain/, `${host} -> ${target}`);
      }
    }
  }
});

test('canonical audio implementations remain dependency-free behind explicit legacy edges', async () => {
  for (const helper of ['audio-decoded-cache', 'audio-shipped-response']) {
    const canonical = `src/client/audio/${helper}.mjs`;
    const legacy = `src/${helper}.mjs`;
    assert.deepEqual(moduleImports(await readFile(new URL(`../${canonical}`, import.meta.url), 'utf8'), canonical), [], canonical);
    assert.deepEqual(moduleImports(await readFile(new URL(`../${legacy}`, import.meta.url), 'utf8'), legacy),
      [`./client/audio/${helper}.mjs`], legacy);
  }
});

test('the image-loading leaf stays outside authority and server hosts with no module dependencies', async () => {
  const target = 'src/presentation/assets/interactive-runtime-image.mjs';
  for (const root of ['src/rules/gameplay-action-rules.mjs', 'src/rules/base-lifecycle.mjs',
    'src/map-utils.mjs', 'src/simulation/movement/formation-assignment.mjs', 'src/pve-regroup.mjs']) {
    const relative = path.posix.relative(path.posix.dirname(root), target);
    assert.throws(() => check({ [target]: '',
      [root]: `import '${relative.startsWith('.') ? relative : `./${relative}`}';` }),
      /(?:rules|world|simulation|ai) domain cannot reach presentation domain/, `${root} -> ${target}`);
  }
  for (const host of ['server.mjs', 'room-supervisor.mjs']) {
    assert.throws(() => check({ [target]: '', [host]: `import './${target}';` },
      { serverEntrypoints: [host] }), /server host reaches presentation domain/, `${host} -> ${target}`);
  }
  assert.deepEqual(moduleImports(await readFile(new URL(`../${target}`, import.meta.url), 'utf8'), target), []);
});

test('rules and world cannot reach higher policy domains, including through unknown modules', () => {
  assert.throws(() => check({
    'src/gameplay-action-rules.mjs': "import './bridge.mjs';",
    'src/bridge.mjs': "export * from './elevation.mjs';", 'src/elevation.mjs': '',
  }), /rules domain cannot reach world domain/);
  assert.throws(() => check({
    'src/map-utils.mjs': "import './formation-assignment.mjs';", 'src/formation-assignment.mjs': '',
  }), /world domain cannot reach simulation domain/);
  assert.throws(() => check({
    'src/formation-assignment.mjs': "import './pve-regroup.mjs';", 'src/pve-regroup.mjs': '',
  }), /simulation domain cannot reach ai domain/);
});

test('lower domains reject rendering and Node packages even through declared adapters', () => {
  for (const specifier of ['three', 'node:crypto', 'crypto']) {
    assert.throws(() => check({
      'src/formation-assignment.mjs': "import './bridge.mjs';",
      'src/bridge.mjs': `import '${specifier}';`,
    }, { nodeOnlyModules: ['src/bridge.mjs'] }),
    /src\/formation-assignment.mjs -> src\/bridge.mjs -> (?:three|node:crypto|crypto): simulation domain cannot reach a host or rendering package/);
  }
});

test('portable disclosed helpers remain shared while acquiring UI dependencies fails', () => {
  const files = {
    'src/game-entry.mjs': "import './wildlife-client-state.mjs';",
    'src/pve-opponent.mjs': "import './wildlife-client-state.mjs';",
    'src/wildlife-client-state.mjs': 'export const readDisclosedWildlife = () => [];',
    'server.mjs': "import './src/pve-opponent.mjs'; import './src/worker-fishing-presentation.mjs';",
    'src/worker-fishing-presentation.mjs': "import './shore-fishing.mjs';",
    'src/shore-fishing.mjs': '',
  };
  const options = { browserEntrypoints: ['src/game-entry.mjs'], serverEntrypoints: ['server.mjs'] };
  assert.deepEqual(check(files, options).sharedModules, ['src/wildlife-client-state.mjs']);
  assert.throws(() => check({ ...files,
    'src/wildlife-client-state.mjs': "import './room-lobby-ui.mjs';", 'src/room-lobby-ui.mjs': '',
  }, options), /disclosed domain cannot reach client domain/);
  assert.throws(() => check({ ...files,
    'src/worker-fishing-presentation.mjs': "import './terrain-height.mjs';", 'src/terrain-height.mjs': '',
  }, options), /disclosed domain cannot reach presentation domain/);
});

test('server host closure rejects package-free UI, renderer state and editor modules', () => {
  for (const target of ['resource-format', 'terrain-height', 'scenario-authoring']) {
    assert.throws(() => check({ 'server.mjs': "import './src/bridge.mjs';",
      'src/bridge.mjs': `export * from './${target}.mjs';`, [`src/${target}.mjs`]: '',
    }, { serverEntrypoints: ['server.mjs'] }), /server host reaches (?:client|presentation|authoring) domain/);
  }
});

test('canonical authoring leaves retain the editor boundary through compatibility paths', () => {
  for (const name of ['scenario-authoring', 'map-resize']) {
    const canonical = `src/authoring/${name}.mjs`;
    const files = { [canonical]: '', [`src/${name}.mjs`]: `export { value } from './authoring/${name}.mjs';` };
    for (const entry of [canonical, `src/${name}.mjs`]) {
      assert.throws(() => check({ ...files, 'server.mjs': `import './${entry}';` },
        { serverEntrypoints: ['server.mjs'] }), /server host reaches authoring domain/);
      assert.throws(() => check({ ...files,
        'src/formation-assignment.mjs': `import '../${entry}';` }), /simulation domain cannot reach authoring domain/);
    }
  }
});

test('Map Studio form controller has no module dependencies and cannot enter authority or server closures', async () => {
  const target = 'src/authoring/map-studio-form-state.mjs';
  for (const root of ['src/rules/gameplay-action-rules.mjs', 'src/map-utils.mjs',
    'src/simulation/movement/formation-assignment.mjs', 'src/pve-regroup.mjs']) {
    const relative = path.posix.relative(path.posix.dirname(root), target);
    assert.throws(() => check({ [target]: '', [root]: `import '${relative.startsWith('.') ? relative : `./${relative}`}';` }),
      /(?:rules|world|simulation|ai) domain cannot reach authoring domain/);
  }
  for (const host of ['server.mjs', 'room-supervisor.mjs']) {
    assert.throws(() => check({ [target]: '', [host]: `import './${target}';` },
      { serverEntrypoints: [host] }), /server host reaches authoring domain/);
  }
  assert.deepEqual(moduleImports(await readFile(new URL(`../${target}`, import.meta.url), 'utf8'), target), []);
});

test('local draft persistence stays authoring-only despite its dependency-free storage interface', async () => {
  const target = 'src/authoring/map-studio-draft-store.mjs';
  for (const root of ['src/rules/gameplay-action-rules.mjs', 'src/map-utils.mjs',
    'src/simulation/movement/formation-assignment.mjs', 'src/pve-regroup.mjs']) {
    const relative = path.posix.relative(path.posix.dirname(root), target);
    assert.throws(() => check({ [target]: '', [root]: `import '${relative.startsWith('.') ? relative : `./${relative}`}';` }),
      /(?:rules|world|simulation|ai) domain cannot reach authoring domain/);
  }
  assert.throws(() => check({ [target]: '', 'server.mjs': `import './${target}';` },
    { serverEntrypoints: ['server.mjs'] }), /server host reaches authoring domain/);
  assert.deepEqual(moduleImports(await readFile(new URL(`../${target}`, import.meta.url), 'utf8'), target), []);
});

test('domain membership rejects duplicate ownership and supports exact canonical migration paths', () => {
  assert.throws(() => check({}, { runtimeDomains: { rules: ['src/a.mjs'], world: ['src/a.mjs'] } }),
    /duplicate runtime domain membership: src\/a.mjs/);
  assert.throws(() => check({}, { runtimeDomains: { client: ['server.mjs'] } }),
    /duplicate runtime domain membership: server.mjs/);
  const files = { 'src/formation-assignment.mjs': "export * from './simulation/movement/fixture-formation.mjs';",
    'src/simulation/movement/fixture-formation.mjs': "import '../../resource-format.mjs';", 'src/resource-format.mjs': '' };
  const options = { runtimeDomains: { ...RUNTIME_DOMAINS, simulation: [...RUNTIME_DOMAINS.simulation,
    'src/simulation/movement/fixture-formation.mjs'] } };
  assert.throws(() => check(files, options), /simulation domain cannot reach client domain/);
  assert.doesNotThrow(() => check({ ...files, 'src/simulation/movement/fixture-formation.mjs': '' }, options));
});

test('repository audits require new modules to have a reviewed responsibility', () => {
  const files = { 'src/new-module.mjs': 'export const value = 1;' };
  assert.throws(() => check(files, { requireDomainCoverage: true }),
    /src\/new-module.mjs: unclassified runtime module; declare its reviewed responsibility/);
  assert.doesNotThrow(() => check(files, { requireDomainCoverage: true,
    runtimeDomains: { ...RUNTIME_DOMAINS, rules: [...RUNTIME_DOMAINS.rules, 'src/new-module.mjs'] } }));
  assert.throws(() => check({ 'src/formation-assignment.mjs': "import './audio-event-profile.mjs';",
    'src/audio-event-profile.mjs': '',
  }), /simulation domain cannot reach audioProfile domain/);
});

test('actual responsibility inventory has no stale paths and retains the public audit result shape', async () => {
  const sources = await readRuntimeSources(new URL('../', import.meta.url).pathname);
  for (const filename of [...Object.values(RUNTIME_DOMAINS).flat(), ...Object.keys(RUNTIME_DOMAIN_HOSTS)]) {
    assert.ok(sources.has(filename), `stale domain membership: ${filename}`);
  }
  const result = checkRuntimeImports(sources);
  assert.deepEqual(Object.keys(result), ['modules', 'localEdges', 'browserModules', 'serverModules', 'sharedModules', 'cycleEdges']);
  assert.deepEqual(result.cycleEdges, []);
  assert.ok(result.sharedModules.includes('src/wildlife-client-state.mjs'));
  assert.ok(result.sharedModules.includes('src/worker-performing-action.mjs'));
});

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
