import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
function readConfig(name) {
  const configPath = path.join(root, name);
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, undefined, configPath);
  assert.deepEqual(parsed.errors, []);
  return parsed;
}
const parsed = readConfig('tsconfig.check-node.json');
const describe = diagnostics => diagnostics.map(diagnostic =>
  `TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);

test('the separately scoped Node boundary has zero errors', () => {
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  assert.deepEqual(describe(ts.getPreEmitDiagnostics(program)), []);
});

function fixtureDiagnostics(config, fixturePath, source) {
  const host = ts.createCompilerHost(config.options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, languageVersion, ...args) => fileName === fixturePath
    ? ts.createSourceFile(fileName, source, languageVersion, true, ts.ScriptKind.JS)
    : getSourceFile(fileName, languageVersion, ...args);
  return ts.getPreEmitDiagnostics(ts.createProgram([...config.fileNames, fixturePath], config.options, host));
}

// Invalid calls compile in memory only: no execution, type assertions or error suppressions.
const cases = [
  { name: 'string frame opcode', code: 2345,
    source: "encodeWebSocketFrame('1', new Uint8Array(1));" },
  { name: 'text mistaken for encoded bytes', code: 2345,
    source: "encodeWebSocketFrame(1, 'hello');" },
  { name: 'plain array mistaken for encoded bytes', code: 2345,
    source: 'encodeWebSocketFrame(1, [1, 2, 3]);' },
  { name: 'float payload mistaken for byte payload', code: 2345,
    source: 'encodeWebSocketFrame(1, new Float32Array(1));' },
  { name: 'null payload', code: 2345,
    source: 'encodeWebSocketFrame(1, null);' },
  { name: 'string compressed flag', code: 2345,
    source: "encodeWebSocketFrame(1, new Uint8Array(1), 'false');" },
  { name: 'string traffic byte count', code: 2345,
    source: "websocketFrameBytes('126');" },
  { name: 'frame Buffer mistaken for numeric length', code: 2339,
    source: 'encodeWebSocketFrame(1, new Uint8Array(1)).toFixed(0);' },
  { name: 'numeric wire length mistaken for buffer', code: 2339,
    source: 'websocketFrameBytes(126).length;' },
  { name: 'text written as a frame integer', code: 2345,
    source: "encodeWebSocketFrame(1, new Uint8Array(1)).writeUInt16BE('3', 0);" },
];
const fixturePath = path.join(root, 'scripts/type-contracts/websocket-frame-invalid.mjs');
const fixtureImports = [
  "import { encodeWebSocketFrame, websocketFrameBytes } from '../../src/networking/websocket-frame.mjs';",
];
const diagnostics = fixtureDiagnostics(parsed, fixturePath,
  [...fixtureImports, ...cases.map(item => item.source)].join('\n'));

test('Node negative fixtures produce only the expected contract failures', () => {
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

test('installed Node ambient types stay outside the browser boundary', () => {
  const browser = readConfig('tsconfig.check-js.json');
  const fixturePath = path.join(root, 'scripts/type-contracts/node-global-leak.mjs');
  const diagnostics = fixtureDiagnostics(browser, fixturePath, 'Buffer.alloc(1);\nprocess.cwd();');
  assert.equal(diagnostics.length, 2, describe(diagnostics).join('\n'));
  assert.ok(diagnostics.every(diagnostic => diagnostic.file?.fileName === fixturePath));
  assert.deepEqual(diagnostics.map(diagnostic => diagnostic.code), [2591, 2591]);
});
