import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

const peerFixturePath = path.join(root, 'scripts/type-contracts/peer-output-invalid.mjs');
const peerFixtureImports = [
  "import { Buffer } from 'node:buffer';",
  "import { createPeerOutput } from '../../src/server/transport/peer-output.mjs';",
  "import '../../scripts/type-contracts/peer-output-valid.mjs';",
  'const output = createPeerOutput(1024, () => {}, queuedBytes => Math.max(0, queuedBytes));',
  "/** @type {import('../../src/server/transport/peer-output.mjs').DrainPeer} */",
  'const peer = { closed: false, socket: { writableLength: 0, write: frame => true }, terminate() {},',
  'peakQueuedBytes: 0, backpressured: false, outboundJsonFrames: 0, outboundJsonWireBytes: 0,',
  'outboundJsonPayloadBytes: 0, outboundJsonUncompressedWireBytes: 0, outboundCompressedFrames: 0,',
  'outboundCompressedWireBytes: 0, outboundCompressedPayloadBytes: 0, pendingState: null,',
  'coalescedStateSnapshots: 0, pendingWaypointCounts: null,',
  'sendPreparedState(frame) { return output.sendPreparedState(peer, frame); } };',
];
const peerCases = [
  { name: 'text queue limit', code: 2345, source: "createPeerOutput('1024', () => {}, queuedBytes => {});" },
  { name: 'text queue metric callback', code: 2345,
    source: 'createPeerOutput(1024, () => {}, /** @param {string} queuedBytes */ queuedBytes => {});' },
  { name: 'text frame byte count', code: 2345, source: "output.canQueuePeerFrame(peer, '3');" },
  { name: 'text prepared frame', code: 2345, source: "output.sendPreparedPeerFrame(peer, 'frame');" },
  { name: 'floating-point prepared frame', code: 2345,
    source: 'output.sendPreparedPeerFrame(peer, new Float32Array(3));' },
  { name: 'compressed frame without payload metadata', code: 2345,
    source: 'output.sendPreparedPeerFrame(peer, Object.assign(Buffer.alloc(1), { rtsCompressed: true }));' },
  { name: 'text payload metadata', code: 2345,
    source: "output.sendPreparedPeerFrame(peer, Object.assign(Buffer.alloc(1), { rtsPayloadBytes: '3' }));" },
  { name: 'text socket write result', code: 2345, source: "output.recordPeerWrite(peer, 'false');" },
  { name: 'text socket queued-byte state', code: 2322,
    source: "/** @type {import('../../src/server/transport/peer-output.mjs').QueuePeer} */ const badQueue = { closed: false, socket: { writableLength: '3' }, terminate() {} };" },
  { name: 'text peak queue counter', code: 2322,
    source: "/** @type {import('../../src/server/transport/peer-output.mjs').WritePeer} */ const badCounter = { closed: false, socket: { writableLength: 0 }, terminate() {}, peakQueuedBytes: '0', backpressured: false };" },
  { name: 'write result mistaken for text', code: 2339,
    source: 'output.sendPreparedPeerFrame(peer, Buffer.alloc(1)).toUpperCase();' },
  // Drain already inferred void before enrollment; retain that result contract.
  { name: 'drain result mistaken for number', code: 2339, source: 'output.drainPeerOutput(peer).toFixed(0);' },
];
const peerDiagnostics = fixtureDiagnostics(parsed, peerFixturePath,
  [...peerFixtureImports, ...peerCases.map(item => item.source)].join('\n'));

test('peer-output negative fixtures produce only the expected contract failures', () => {
  assert.equal(peerDiagnostics.length, peerCases.length, describe(peerDiagnostics).join('\n'));
  assert.ok(peerDiagnostics.every(diagnostic => diagnostic.file?.fileName === peerFixturePath));
});
for (const [index, item] of peerCases.entries()) {
  test(`the checker rejects ${item.name}`, () => {
    const onLine = peerDiagnostics.filter(diagnostic => diagnostic.file?.fileName === peerFixturePath
      && diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line === index + peerFixtureImports.length);
    assert.deepEqual(onLine.map(diagnostic => diagnostic.code), [item.code], describe(onLine).join('\n'));
  });
}

test('the actual production peer-output factory, peer adapters and drain callback compile', () => {
  const source = readFileSync(path.join(root, 'server.mjs'), 'utf8');
  const tree = ts.createSourceFile('server.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const nodes = [];
  function visit(node) { nodes.push(node); ts.forEachChild(node, visit); }
  visit(tree);
  const factoryBindings = nodes.filter(node => ts.isVariableDeclaration(node)
    && node.initializer && ts.isCallExpression(node.initializer)
    && node.initializer.expression.getText(tree) === 'createPeerOutput');
  assert.equal(factoryBindings.length, 1);
  const createPeer = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'createPeer');
  assert.ok(createPeer);
  const peerObjects = nodes.filter(node => ts.isVariableDeclaration(node) && node.name.getText(tree) === 'peer'
    && node.initializer && ts.isObjectLiteralExpression(node.initializer)
    && node.pos >= createPeer.pos && node.end <= createPeer.end);
  assert.equal(peerObjects.length, 1);
  const fields = new Set(['socket', 'closed', 'backpressured', 'pendingState', 'pendingWaypointCounts',
    'coalescedStateSnapshots', 'peakQueuedBytes', 'outboundJsonFrames', 'outboundJsonWireBytes',
    'outboundJsonPayloadBytes', 'outboundJsonUncompressedWireBytes', 'outboundCompressedFrames',
    'outboundCompressedWireBytes', 'outboundCompressedPayloadBytes',
    'sendPreparedState', 'sendPreparedWaypointCounts', 'terminate']);
  const properties = peerObjects[0].initializer.properties.filter(node => fields.has(node.name?.getText(tree)));
  assert.equal(properties.length, fields.size);
  const drainCalls = nodes.filter(node => ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)
    && node.expression.expression.getText(tree) === 'socket.on'
    && node.expression.arguments[0]?.getText(tree) === "'drain'"
    && node.pos >= createPeer.pos && node.end <= createPeer.end);
  assert.equal(drainCalls.length, 1);

  // Compile the real adapters with Node's Socket and typed host release/constants.
  // prepareJsonFrame remains host-owned and covered by the runtime transport tests.
  const fixturePath = path.join(root, 'scripts/type-contracts/peer-output-production.mjs');
  const fixture = [
    "import { Socket } from 'node:net';",
    "import { createPeerOutput } from '../../src/server/transport/peer-output.mjs';",
    'const MAX_PEER_QUEUED_BYTES = 1024; let outboundQueueLimitDisconnects = 0, peakOutboundQueuedBytes = 0;',
    `const ${factoryBindings[0].getText(tree)};`,
    'const socket = new Socket();',
    "/** @param {import('../../src/server/transport/peer-output.mjs').DrainPeer} peer @param {boolean} graceful */",
    'function releasePeer(peer, graceful) {}',
    "/** @type {import('../../src/server/transport/peer-output.mjs').DrainPeer & {sendPreparedWaypointCounts: (frame: import('../../src/server/transport/peer-output.mjs').PreparedPeerFrame) => boolean}} */",
    `const peer = { ${properties.map(node => node.getText(tree)).join(',\n')} };`,
    drainCalls[0].getText(tree),
  ].join('\n');
  assert.deepEqual(describe(fixtureDiagnostics(parsed, fixturePath, fixture)), []);
});
