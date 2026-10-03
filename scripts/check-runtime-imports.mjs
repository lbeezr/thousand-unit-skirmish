import { readdir, readFile } from 'node:fs/promises';
import { isBuiltin } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

// Entry modules loaded by the five shipped HTML pages. main.js is reached lazily.
export const BROWSER_ENTRYPOINTS = [
  'src/game-entry.mjs', 'src/audio-studio.mjs', 'src/audio-zones.mjs',
  'src/environment-review.mjs', 'src/water-study-preview.mjs',
];
export const SERVER_ENTRYPOINTS = ['room-supervisor.mjs', 'server.mjs'];
// These are Node adapters, not cycle exceptions. Keep them out of browser closures.
export const NODE_ONLY_MODULES = ['src/room-launch-options.mjs', 'src/pve-model-proposal.mjs'];

export function moduleImports(source, filename) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const imports = new Set();
  function visit(node) {
    if (!node?.type) return;
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type)
      && node.source) {
      // Computed imports hide dependency edges. Add a literal import or an explicit
      // dispatch table instead of silently leaving an edge out of this check.
      if (node.source.type !== 'Literal' || typeof node.source.value !== 'string') {
        throw new Error(`${filename}:${node.loc.start.line}: runtime imports must use literal specifiers`);
      }
      imports.add(node.source.value);
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(visit);
      else if (child?.type) visit(child);
    }
  }
  visit(ast);
  return [...imports].sort();
}

export async function readRuntimeSources(root) {
  const sources = new Map();
  async function collect(directory, recursive) {
    for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
      const filename = path.posix.join(directory, entry.name);
      if (entry.isDirectory() && recursive) await collect(filename, true);
      else if (entry.isFile() && /\.(?:js|mjs)$/.test(filename)) {
        sources.set(filename, await readFile(path.join(root, filename), 'utf8'));
      }
    }
  }
  await collect('.', false);
  await collect('src', true);
  return sources;
}

export function runtimeImportGraph(sources) {
  const graph = new Map();
  for (const [filename, source] of [...sources].sort(([a], [b]) => a.localeCompare(b))) {
    const imports = moduleImports(source, filename);
    const local = [];
    for (const specifier of imports.filter(value => value.startsWith('.'))) {
      const dependency = path.posix.normalize(path.posix.join(path.posix.dirname(filename), specifier));
      if (filename.startsWith('src/') && !dependency.startsWith('src/')) {
        throw new Error(`${filename} -> ${dependency}: src modules cannot import runtime hosts or tooling`);
      }
      if (!sources.has(dependency)) throw new Error(`${filename} -> ${dependency}: missing runtime module`);
      local.push(dependency);
    }
    graph.set(filename, { local: [...new Set(local)].sort(), external: imports.filter(value => !value.startsWith('.')) });
  }
  return graph;
}

// Every internal edge in a nontrivial strongly connected component is cyclic.
// Comparing edges (not just component membership) also catches new cycles among
// modules that already participated in an older cycle.
export function cyclicEdges(graph) {
  const indices = new Map(), low = new Map(), active = new Set(), stack = [], components = [];
  let index = 0;
  function visit(filename) {
    indices.set(filename, index); low.set(filename, index++);
    stack.push(filename); active.add(filename);
    for (const dependency of graph.get(filename).local) {
      if (!indices.has(dependency)) {
        visit(dependency);
        low.set(filename, Math.min(low.get(filename), low.get(dependency)));
      } else if (active.has(dependency)) low.set(filename, Math.min(low.get(filename), indices.get(dependency)));
    }
    if (low.get(filename) === indices.get(filename)) {
      const component = new Set();
      let member;
      do { member = stack.pop(); active.delete(member); component.add(member); } while (member !== filename);
      components.push(component);
    }
  }
  for (const filename of graph.keys()) if (!indices.has(filename)) visit(filename);
  const edges = [];
  for (const component of components) {
    for (const from of component) for (const to of graph.get(from).local) {
      if (component.has(to) && (component.size > 1 || from === to)) edges.push({ from, to });
    }
  }
  return edges.sort((a, b) => edgeKey(a).localeCompare(edgeKey(b)));
}

function edgeKey({ from, to }) { return `${from} -> ${to}`; }

function dependencyPaths(graph, entrypoints) {
  const paths = new Map();
  const pending = entrypoints.map(filename => [filename]);
  for (let index = 0; index < pending.length; index++) {
    const chain = pending[index], filename = chain.at(-1);
    if (paths.has(filename)) continue;
    if (!graph.has(filename)) throw new Error(`missing runtime entrypoint: ${filename}`);
    paths.set(filename, chain);
    for (const dependency of graph.get(filename).local) pending.push([...chain, dependency]);
  }
  return paths;
}

export function checkRuntimeImports(sources, {
  browserEntrypoints = BROWSER_ENTRYPOINTS,
  serverEntrypoints = SERVER_ENTRYPOINTS,
  nodeOnlyModules = NODE_ONLY_MODULES,
  cycleBaseline = [],
} = {}) {
  const graph = runtimeImportGraph(sources);
  const browser = dependencyPaths(graph, browserEntrypoints);
  const server = dependencyPaths(graph, serverEntrypoints);
  const errors = [];
  for (const [filename, { external }] of graph) {
    for (const specifier of external) {
      if (!isBuiltin(specifier) && specifier !== 'three') {
        errors.push(`${filename} -> ${specifier}: unresolved runtime import (use a relative module, Node builtin or mapped three)`);
      }
    }
    if (filename.startsWith('src/') && !nodeOnlyModules.includes(filename) && external.some(isBuiltin)) {
      errors.push(`${filename}: Node builtins belong in a declared Node adapter`);
    }
    if (browser.has(filename)) {
      const chain = browser.get(filename).join(' -> ');
      if (nodeOnlyModules.includes(filename)) errors.push(`${chain}: browser reaches a Node-only adapter`);
      for (const specifier of external) {
        if (specifier !== 'three') errors.push(`${chain} -> ${specifier}: unsupported browser import (only three is mapped)`);
      }
    }
    if (server.has(filename)) {
      const chain = server.get(filename).join(' -> ');
      if (browserEntrypoints.includes(filename) || filename === 'src/main.js') {
        errors.push(`${chain}: server reaches a browser entrypoint`);
      }
      if (external.includes('three')) errors.push(`${chain} -> three: server rules cannot depend on rendering`);
    }
  }
  const cycles = cyclicEdges(graph);
  const actual = new Set(cycles.map(edgeKey)), baseline = new Set(cycleBaseline.map(edgeKey));
  if (baseline.size !== cycleBaseline.length) errors.push('duplicate cyclic edges in runtime import baseline');
  for (const edge of actual) if (!baseline.has(edge)) errors.push(`new cyclic edge: ${edge}`);
  for (const edge of baseline) if (!actual.has(edge)) errors.push(`stale cyclic edge: ${edge}; remove it from the baseline`);
  if (errors.length) throw new Error(errors.join('\n'));
  return {
    modules: graph.size,
    localEdges: [...graph.values()].reduce((sum, node) => sum + node.local.length, 0),
    browserModules: browser.size,
    serverModules: server.size,
    sharedModules: [...browser.keys()].filter(filename => server.has(filename)).sort(),
    cycleEdges: cycles,
  };
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw new Error('Usage: node scripts/check-runtime-imports.mjs');
  const baseline = JSON.parse(await readFile(path.join(root, 'scripts/fixtures/runtime-import-baseline.json'), 'utf8'));
  if (baseline.schemaVersion !== 1 || !Array.isArray(baseline.cycleEdges)) throw new Error('Invalid runtime import baseline');
  console.log(JSON.stringify(checkRuntimeImports(await readRuntimeSources(root), { cycleBaseline: baseline.cycleEdges }), null, 2));
}
