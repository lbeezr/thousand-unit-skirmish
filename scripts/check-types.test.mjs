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
];
const fixturePath = path.join(root, 'scripts/type-contracts/canopy-invalid.mjs');
const fixtureSource = [
  "import { forestAgeFactors } from '../../src/forest-age-composition.mjs';",
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
      && diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line === index + 1);
    assert.deepEqual(onLine.map(diagnostic => diagnostic.code), [item.code], describe(onLine).join('\n'));
  });
}
