import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const configPath = path.join(root, 'tsconfig.check-js.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
assert.equal(config.error, undefined);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
assert.deepEqual(parsed.errors, []);
const describe = diagnostics => diagnostics.map(diagnostic =>
  `TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);

test('the narrow checked JavaScript boundary has zero errors', () => {
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  assert.deepEqual(describe(ts.getPreEmitDiagnostics(program)), []);
});

// Compile these consumers in memory; invalid calls never execute and need no suppressions.
const cases = [
  { name: 'missing wood-cell identity', code: 2741,
    source: 'forestAgeFactors([{ x: 1, z: 2 }]);' },
  { name: 'string cell identity', code: 2322,
    source: "forestAgeFactors([{ cell: '7', x: 1, z: 2 }]);" },
  { name: 'wrong coordinate field', code: 2353,
    source: 'forestAgeFactors([{ cell: 7, x: 1, y: 2 }]);' },
  { name: 'nonnumeric world coordinate', code: 2322,
    source: "forestAgeFactors([{ cell: 7, x: '1', z: 2 }]);" },
  { name: 'nonnumeric seed', code: 2345,
    source: "forestAgeFactors([], '93002');" },
  { name: 'nonnumeric radius', code: 2345,
    source: "forestAgeFactors([], 93002, '1.6');" },
  { name: 'factor lookup with a string cell key', code: 2345,
    source: "forestAgeFactors([]).get('7');" },
  { name: 'unchecked missing factor', code: 2532,
    source: 'forestAgeFactors([]).get(7).toFixed(2);' },
  { name: 'factor stored as text', code: 2345,
    source: "forestAgeFactors([]).set(7, '1.05');" },
  { name: 'mutation of a caller-owned point', code: 2540,
    source: "/** @type {import('../../src/forest-age-composition.mjs').CanopyPoint} */ const point = {cell: 7, x: 1, z: 2}; point.cell = 8;" },
  { name: 'string map width', code: 2322,
    source: "forestHabitatDepth({width: '9', height: 9});" },
  { name: 'missing map height', code: 2345,
    source: 'forestHabitatDepth({width: 9});' },
  { name: 'missing rectangle row', code: 2741,
    source: 'forestHabitatDepth({width: 9, height: 9, obstacles: [{column: 1, width: 7, height: 7}]});' },
  { name: 'misspelled rectangle coordinate', code: 2353,
    source: 'forestHabitatDepth({width: 9, height: 9, obstacles: [{column: 1, row: 1, width: 7, height: 7, x: 1}]});' },
  { name: 'unregistered obstacle material', code: 2322,
    source: "forestHabitatDepth({width: 9, height: 9, obstacles: [{column: 1, row: 1, width: 7, height: 7, material: 'wood'}]});" },
  { name: 'depth grid confused with a Map', code: 2339,
    source: 'forestHabitatDepth({width: 9, height: 9}).get(7);' },
  { name: 'string canopy depth', code: 2345,
    source: "forestCanopyFactor('1');" },
  { name: 'string margin coordinate', code: 2345,
    source: "forestMarginCanopyFactor(1, '4', 4);" },
  { name: 'string species coordinate', code: 2345,
    source: "underboughForestSpecies('4', 4);" },
  { name: 'string species seed', code: 2345,
    source: "underboughForestSpecies(4, 4, '93002');" },
  { name: 'string species habitat depth', code: 2345,
    source: "underboughForestSpecies(4, 4, 93002, '1');" },
  { name: 'string grove spacing', code: 2345,
    source: "underboughForestSpecies(4, 4, 93002, 1, '6');" },
  { name: 'misspelled species identity', code: 2820,
    source: "/** @type {import('../../src/forest-composition.mjs').UnderboughForestSpecies} */ const typo = 'underbough-brambel';" },
  { name: 'string resource stock', code: 2345,
    source: "resourceVisualStage('66', 100);" },
  { name: 'string starting stock', code: 2345,
    source: "resourceVisualStage(66, '100');" },
  { name: 'misspelled resource scale stage', code: 2345,
    source: "resourceVisualScale('ful');" },
  { name: 'resource stage treated as numeric scale', code: 2551,
    source: 'resourceVisualStage(66, 100).toFixed(2);' },
  { name: 'unknown value inserted into filtered transition output', code: 2345,
    source: "resourceVisualTransitionStages('unknown', 'full').push('unknown');" },
  { name: 'numeric value inserted into filtered transition output', code: 2345,
    source: "resourceVisualTransitionStages('unknown', 'full').push(1);" },
  { name: 'mutation of canonical resource stages', code: 2339,
    source: "RESOURCE_VISUAL_STAGES.push('full');" },
  { name: 'resource stage confused with an unrelated species ID', code: 2322,
    source: "/** @type {import('../../src/forest-composition.mjs').UnderboughForestSpecies} */ const wrongKind = resourceVisualStage(66, 100);" },
  { name: 'string paint-mask width', code: 2322,
    source: "buildTerrainBlendMasks({width: '4', height: 4}, ['meadow'], 'meadow');" },
  { name: 'missing paint-mask height', code: 2345,
    source: "buildTerrainBlendMasks({width: 4}, ['meadow'], 'meadow');" },
  { name: 'missing paint rectangle row', code: 2741,
    source: "buildTerrainBlendMasks({width: 4, height: 4, terrainPatches: [{column: 0, width: 2, height: 4, material: 'sand'}]}, ['meadow', 'sand'], 'meadow');" },
  { name: 'misspelled paint rectangle coordinate', code: 2353,
    source: "buildTerrainBlendMasks({width: 4, height: 4, terrainPatches: [{column: 0, row: 0, width: 2, height: 4, material: 'sand', x: 0}]}, ['meadow', 'sand'], 'meadow');" },
  { name: 'numeric paint material identity', code: 2322,
    source: "buildTerrainBlendMasks({width: 4, height: 4, terrainPatches: [{column: 0, row: 0, width: 2, height: 4, material: 1}]}, ['meadow'], 'meadow');" },
  { name: 'numeric material catalog entry', code: 2322,
    source: "buildTerrainBlendMasks({width: 4, height: 4}, [1], 'meadow');" },
  { name: 'string organic-edge flag', code: 2345,
    source: "buildTerrainBlendMasks({width: 4, height: 4}, ['meadow'], 'meadow', 'false');" },
  { name: 'string terrain seed', code: 2322,
    source: "buildForestGroundMask({width: 4, height: 4, terrainSeed: '42'});" },
  { name: 'float buffer confused with RGBA bytes', code: 2322,
    source: "/** @type {import('../../src/terrain-blend.mjs').TerrainBlendMask} */ const wrongPixels = {material: 'sand', width: 8, height: 8, pixels: new Float32Array(256)};" },
  { name: 'text mask dimension', code: 2322,
    source: "/** @type {import('../../src/terrain-blend.mjs').TerrainBlendMask} */ const wrongDimension = {material: 'sand', width: '8', height: 8, pixels: new Uint8Array(256)};" },
  { name: 'unguarded absent forest ground mask', code: 2531,
    source: 'buildForestGroundMask({width: 4, height: 4}).pixels.subarray(0, 4);' },
  { name: 'mutation of caller-owned paint rectangle', code: 2540,
    source: "/** @type {import('../../src/terrain-blend.mjs').TerrainPaintPatch} */ const patch = {column: 0, row: 0, width: 2, height: 4, material: 'sand'}; patch.row = 1;" },
];
const fixturePath = path.join(root, 'scripts/type-contracts/canopy-invalid.mjs');
const fixtureImports = [
  "import { forestAgeFactors } from '../../src/forest-age-composition.mjs';",
  "import { forestHabitatDepth, forestCanopyFactor, forestMarginCanopyFactor } from '../../src/forest-habitat.mjs';",
  "import { underboughForestSpecies } from '../../src/forest-composition.mjs';",
  "import { RESOURCE_VISUAL_STAGES, resourceVisualScale, resourceVisualStage, resourceVisualTransitionStages } from '../../src/resource-visual-state.mjs';",
  "import { buildTerrainBlendMasks, buildForestGroundMask } from '../../src/terrain-blend.mjs';",
];
const fixtureSource = [
  ...fixtureImports,
  ...cases.map(item => item.source),
].join('\n');
const host = ts.createCompilerHost(parsed.options);
const getSourceFile = host.getSourceFile.bind(host);
host.getSourceFile = (fileName, languageVersion, ...args) => fileName === fixturePath
  ? ts.createSourceFile(fileName, fixtureSource, languageVersion, true, ts.ScriptKind.JS)
  : getSourceFile(fileName, languageVersion, ...args);
const negativeProgram = ts.createProgram([...parsed.fileNames, fixturePath], parsed.options, host);
const diagnostics = ts.getPreEmitDiagnostics(negativeProgram);

test('negative fixtures produce only the expected contract failures', () => {
  assert.equal(diagnostics.length, cases.length, describe(diagnostics).join('\n'));
  assert.ok(diagnostics.every(diagnostic => diagnostic.file?.fileName === fixturePath));
});
for (const [index, item] of cases.entries()) {
  test(`the checker rejects ${item.name}`, () => {
    const onLine = diagnostics.filter(diagnostic => diagnostic.file?.fileName === fixturePath
      && diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line === index + fixtureImports.length);
    assert.deepEqual(onLine.map(diagnostic => diagnostic.code), [item.code], describe(onLine).join('\n'));
  });
}
