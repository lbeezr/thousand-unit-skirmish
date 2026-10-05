import { readdir, readFile } from 'node:fs/promises';
import { isBuiltin } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { moduleImports } from './module-imports.mjs';

// Preserve the existing audit helper's public import path.
export { moduleImports } from './module-imports.mjs';

// Entry modules loaded by the five shipped HTML pages. main.js is reached lazily.
export const BROWSER_ENTRYPOINTS = [
  'src/game-entry.mjs', 'src/audio-studio.mjs', 'src/audio-zones.mjs',
  'src/environment-review.mjs', 'src/water-study-preview.mjs',
];
// Native ESM package imports are scoped to each HTML document's import map.
export const BROWSER_PACKAGE_IMPORTS = {
  'src/game-entry.mjs': ['three'],
  'src/audio-studio.mjs': [],
  'src/audio-zones.mjs': [],
  'src/environment-review.mjs': ['three'],
  'src/water-study-preview.mjs': ['three'],
};
export const SERVER_ENTRYPOINTS = ['room-supervisor.mjs', 'server.mjs'];
// These are Node adapters, not cycle exceptions. Keep them out of browser closures.
export const NODE_ONLY_MODULES = [
  'src/server/build-identity.mjs', // Reads only the private generated release declaration.
  'src/room-launch-options.mjs', // Node crypto-backed launch seeds.
  'src/pve-model-proposal.mjs', // Compatibility entry for the offline Node adapter.
  'src/server/pve-model-proposal.mjs', // Offline Node model-request implementation.
  'src/networking/websocket-frame.mjs', // Server-only Node Buffer wire encoding.
];

// Responsibilities of existing modules, independent of their current flat paths.
// Update exact memberships with each reviewed migration (including its shim).
// Repository audits require membership for every module; partial fixture graphs
// may disable coverage but still traverse every edge. This is not a DOM/global audit.
export const RUNTIME_DOMAINS = Object.freeze(Object.fromEntries(Object.entries({
  rules: [
    'rules/base-lifecycle', 'rules/gameplay-action-rules',
    'bannerfall-rules', 'base-lifecycle', 'combat-rules', 'economy-ledger',
    'economy-profile', 'farm-harvest', 'gameplay-action-rules', 'gameplay-definitions',
    'match-modes', 'palisade-gate', 'palisade-profile', 'population',
    'production-actions', 'pve-match', 'research-actions',
  ],
  world: [
    'building-orientation', 'dock-placement', 'elevation', 'map-size-policy', 'map-utils', 'regions',
    'world/map-audio-reference',
    'practice-entry-catalog', 'scenario-regions', 'shore-fishing', 'shore-fishing-placement', 'terrain-materials',
    'town-center-spawn', 'unit-heading', 'water-contours', 'water-route-graph',
  ],
  simulation: [
    'combat-movement', 'combat-stance', 'confluence-opening-compat', 'construction-work-intent', 'economy-checkpoint',
    'forest-fringe', 'forest-gather-group', 'formation-assignment', 'gather-work-area', 'match-mode-checkpoint',
    'simulation/movement/formation-assignment',
    'millrace-sheep', 'skiff-fishing', 'skiff-group-orders', 'skiff-waypoints',
    'snapshot-private-production', 'terraced-vale-sheep', 'unit-movement',
    'server/voluntary-endings',
    'server/worker-food-tools', // Productive food labor and exact prior-content recovery; no route planning.
    'unit-obstacle-detour', 'unit-path-line', 'wall-build-order',
    'wall-construction-draft', 'wall-line-planner', 'water-unit-runtime',
    'wildlife-claims', 'wildlife-heading', 'wildlife-herding', 'wildlife-motion',
    'wildlife-state', 'work-intent', 'worker-performing-action',
  ],
  ai: [
    'pve-home-defense', 'pve-objective-rotation', 'pve-opponent', 'pve-production',
    'pve-reconnaissance', 'pve-regroup', 'pve-skirmish-targets',
  ],
  // Portable disclosed-row/action projections, despite misleading file names.
  // The authoritative Worker receipt journal itself belongs to simulation.
  disclosed: ['wildlife-client-state', 'worker-fishing-presentation', 'worker-work-presentation'],
  presentation: [
    'presentation/assets/interactive-runtime-image',
    'building-production-cue', 'building-sprites', 'building-visual-state',
    'camera-controls', 'captured-building-art', 'environment-art', 'asset-readability', 'catalog-barracks-observation',
    'environment-instance-picking',
    'environment-plant-assets', 'forest-age-composition', 'forest-composition',
    'forest-habitat', 'gameplay-presentation', 'garden-vegetation', 'meadow-vegetation',
    'neutral-wildlife-renderer', 'oak-depletion-atlas-runtime',
    'painted-material-atlas', 'painted-material-atlas-runtime', 'palisade-gate-visual', 'palisade-construction-ground',
    'podvine-low-pack', 'podvine-view-pack', 'podvine-worked-pack',
    'regional-ground-kits', 'resource-visual-state', 'sheep-static-preview',
    'shore-bank-shade', 'shore-fishing-placeholder', 'shore-vegetation',
    'sunbloom-crown-pack', 'sunbloom-low-pack', 'sunbloom-view-pack', 'sunbloom-worked-pack',
    'terrain-atmosphere', 'terrain-blend', 'terrain-cliff-faces', 'terrain-height', 'terrain-texture-sampling',
    'unit-lod-state', 'unit-sprite-runtime', 'unit-visual-state', 'veilcap-view-pack',
    'veilcap-worked-pack', 'wall-placement-ghost', 'water-study-fish-binding',
    'water-study-state', 'water-surface-geometry', 'water-surface-study',
    'worker-fishing-contact',
  ],
  client: [
    'client/hud/match-recap', 'client/hud/match-decisions',
    'client/hud/resource-format', 'client/hud/population-readout', 'client/hud/objective-summary',
    'client/audio/audio-decoded-cache', 'client/audio/audio-shipped-response',
    'audio', 'audio-assets', 'audio-composer', 'audio-composition',
    'audio-composition-player', 'audio-decoded-cache', 'audio-library-store',
    'audio-library-ui', 'audio-policy', 'audio-recognition-check',
    'audio-shipped-catalog', 'audio-shipped-loader', 'audio-shipped-response',
    'audio-studio', 'audio-zones', 'battlefield-cursor', 'browser-state-recovery', 'combat-stance-ui',
    'economy-client', 'environment-pilot', 'environment-review',
    'building-placement-preview', 'building-rotation-controls', 'frontier-building-preview', 'game-entry', 'game-entry-session', 'hud-layout',
    'match-mode-controls', 'navigation-settings', 'objective-summary',
    'order-feedback', 'population-readout', 'practice-entry-controls', 'pve-entry',
    'resource-format', 'room-lobby-chat-ui', 'room-lobby-ui', 'room-presence',
    'selection-context', 'selection-portrait', 'unit-selection', 'wall-placement',
    'water-study-preview',
  ],
  authoring: [
    'authoring/scenario-authoring', 'authoring/map-resize',
    'authoring/map-studio-form-state',
    'landscape-authoring', 'map-resize', 'map-studio-viewport',
    'resource-brush-authoring', 'resource-brush-controls', 'resource-cluster-authoring',
    'scenario-authoring', 'settlement-authoring', 'terrain-authoring',
  ],
  server: [
    'networking/websocket-deflate-offer', 'networking/websocket-frame',
    'pve-model-proposal', 'room-launch-options', 'room-lobby-chat', 'room-pregame',
    'server/build-identity', 'server/client-asset-paths', 'server/pve-model-proposal',
    'server/vision-coverage-cache', 'server/checkpoint-route-budget',
  ],
  // Legacy map-validation entry also exports playback policy. Preserve existing
  // host consumers while new lower-domain consumers use the world validator.
  audioProfile: ['audio-event-profile'],
}).map(([domain, names]) => [domain, Object.freeze(names.map(name => `src/${name}.mjs`))])));

// main is the mixed browser composition root, not a lower-domain dependency.
export const RUNTIME_DOMAIN_HOSTS = Object.freeze({
  'src/main.js': 'client', 'building-map.js': 'authoring',
  'origin-policy.mjs': 'server', 'simulation-scheduler.mjs': 'server',
  'room-supervisor.mjs': 'server', 'server.mjs': 'server',
});

const DOMAIN_DEPENDENCIES = {
  rules: ['rules'],
  world: ['rules', 'world'],
  simulation: ['rules', 'world', 'simulation', 'disclosed'],
  ai: ['rules', 'world', 'simulation', 'disclosed', 'ai'],
  disclosed: ['rules', 'world', 'simulation', 'disclosed'],
};

function runtimeDomainMembership(domains, hosts) {
  const membership = new Map(Object.entries(hosts));
  for (const [domain, filenames] of Object.entries(domains)) {
    for (const filename of filenames) {
      if (membership.has(filename)) throw new Error(`duplicate runtime domain membership: ${filename}`);
      membership.set(filename, domain);
    }
  }
  return membership;
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
  browserPackageImports = BROWSER_PACKAGE_IMPORTS,
  serverEntrypoints = SERVER_ENTRYPOINTS,
  nodeOnlyModules = NODE_ONLY_MODULES,
  runtimeDomains = RUNTIME_DOMAINS,
  runtimeDomainHosts = RUNTIME_DOMAIN_HOSTS,
  requireDomainCoverage = true,
  cycleBaseline = [],
} = {}) {
  const graph = runtimeImportGraph(sources);
  const browser = dependencyPaths(graph, browserEntrypoints);
  const server = dependencyPaths(graph, serverEntrypoints);
  const domains = runtimeDomainMembership(runtimeDomains, runtimeDomainHosts);
  const errors = [];
  for (const [filename, { external }] of graph) {
    if (requireDomainCoverage && !domains.has(filename)) {
      errors.push(`${filename}: unclassified runtime module; declare its reviewed responsibility`);
    }
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
      if (domains.get(filename) === 'server') errors.push(`${chain}: browser reaches a server-private module`);
    }
    if (server.has(filename)) {
      const chain = server.get(filename).join(' -> ');
      if (browserEntrypoints.includes(filename) || filename === 'src/main.js') {
        errors.push(`${chain}: server reaches a browser entrypoint`);
      }
      if (external.includes('three')) errors.push(`${chain} -> three: server rules cannot depend on rendering`);
      if (['client', 'presentation', 'authoring'].includes(domains.get(filename))) {
        errors.push(`${chain}: server host reaches ${domains.get(filename)} domain`);
      }
    }
  }
  // Check every classified lower-domain module, even outside host closures.
  // Traverse unknown intermediates, re-exports and lazy imports as real edges.
  for (const [entrypoint, domain] of domains) {
    const allowed = DOMAIN_DEPENDENCIES[domain];
    if (!allowed || !graph.has(entrypoint)) continue;
    for (const [filename, chain] of dependencyPaths(graph, [entrypoint])) {
      const dependencyDomain = domains.get(filename);
      if (dependencyDomain && !allowed.includes(dependencyDomain)) {
        errors.push(`${chain.join(' -> ')}: ${domain} domain cannot reach ${dependencyDomain} domain`);
      }
      for (const specifier of graph.get(filename).external) {
        if (isBuiltin(specifier) || specifier === 'three') {
          errors.push(`${chain.join(' -> ')} -> ${specifier}: ${domain} domain cannot reach a host or rendering package`);
        }
      }
    }
  }
  // A module shared by two pages must satisfy both import maps, even if the
  // combined browser traversal reached it first through the Three-mapped page.
  for (const entrypoint of browserEntrypoints) {
    const mapped = browserPackageImports[entrypoint] ?? [];
    for (const [filename, chain] of dependencyPaths(graph, [entrypoint])) {
      for (const specifier of graph.get(filename).external) {
        if (isBuiltin(specifier) || !mapped.includes(specifier)) {
          errors.push(`${chain.join(' -> ')} -> ${specifier}: unsupported browser import for ${entrypoint}`);
        }
      }
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
