import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import { roomPresence } from '../src/room-presence.mjs';
import { browserRecoveryBindings } from './browser-recovery-fixture.mjs';

function presenceDiagnostics(source) {
  const root = new URL('../', import.meta.url);
  const configPath = fileURLToPath(new URL('tsconfig.check-js.json', root));
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, fileURLToPath(root));
  assert.deepEqual(parsed.errors, []);
  const fixturePath = fileURLToPath(new URL('scripts/type-contracts/room-presence-consumer.mjs', root));
  const host = ts.createCompilerHost(parsed.options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, languageVersion, ...args) => fileName === fixturePath
    ? ts.createSourceFile(fileName, source, languageVersion, true, ts.ScriptKind.JS)
    : getSourceFile(fileName, languageVersion, ...args);
  const program = ts.createProgram([fixturePath], parsed.options, host);
  return { fixturePath, diagnostics: ts.getPreEmitDiagnostics(program) };
}

test('the presence leaf and checked consumer compile under the existing strict browser options', () => {
  const { diagnostics } = presenceDiagnostics(`
import { roomPresence } from '../../src/room-presence.mjs';
for (const connected of [0, 1, 2]) {
  const ordinary = roomPresence({ connected });
  const practice = roomPresence({ connected, practice: true, resumePending: false });
  /** @type {string} */ const network = ordinary.network;
  /** @type {string} */ const match = practice.match;
  /** @type {boolean} */ const waiting = ordinary.waiting;
  /** @type {boolean} */ const full = practice.full;
}
`);
  assert.deepEqual(diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')), []);
});

test('checked presence consumers reject invalid input kinds and result misuse', () => {
  const cases = [
    { source: 'roomPresence({});', code: 2345 },
    { source: "roomPresence({ connected: '2' });", code: 2322 },
    { source: 'roomPresence({ connected: {} });', code: 2322 },
    { source: 'roomPresence({ connected: null });', code: 2322 },
    { source: "roomPresence({ connected: 1, practice: 'true' });", code: 2322 },
    { source: 'roomPresence({ connected: 1, resumePending: 1 });', code: 2322 },
    { source: 'roomPresence({ connected: 2 }).network.toFixed(0);', code: 2551 },
    { source: 'roomPresence({ connected: 2 }).match.toFixed(0);', code: 2551 },
    { source: 'roomPresence({ connected: 2 }).waiting.toUpperCase();', code: 2339 },
    { source: 'roomPresence({ connected: 2 }).full.toUpperCase();', code: 2339 },
  ];
  const { fixturePath, diagnostics } = presenceDiagnostics([
    "import { roomPresence } from '../../src/room-presence.mjs';",
    ...cases.map(item => item.source),
  ].join('\n'));
  assert.equal(diagnostics.length, cases.length);
  assert.ok(diagnostics.every(diagnostic => diagnostic.file?.fileName === fixturePath));
  for (const [index, item] of cases.entries()) {
    const onLine = diagnostics.filter(diagnostic => diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line === index + 1);
    assert.deepEqual(onLine.map(diagnostic => diagnostic.code), [item.code], item.source);
  }
});

test('unchecked legacy inputs retain comparison and flag behavior', () => {
  assert.deepEqual(roomPresence({ connected: '2', practice: 'true' }), {
    network: 'ROOM LIVE', match: '2 / 2 ONLINE', waiting: false, full: true,
  });
  assert.deepEqual(roomPresence({ connected: 0, practice: true, resumePending: 'pending' }), {
    network: 'SEAT ACTIVE ELSEWHERE', match: 'WAITING TO REJOIN', waiting: 'pending', full: false,
  });
  assert.deepEqual(roomPresence({ connected: 0, practice: false }), {
    network: 'WAITING FOR PLAYER 2', match: '0 / 2 ONLINE', waiting: true, full: false,
  });
});

test('solo Practice is live with one player while ordinary two-seat rooms still wait', () => {
  assert.deepEqual(roomPresence({ connected: 1, practice: true }), {
    network: 'PRACTICE LIVE', match: 'SOLO PRACTICE', waiting: false, full: false,
  });
  assert.equal(roomPresence({ connected: 1 }).network, 'WAITING FOR PLAYER 2');
  assert.equal(roomPresence({ connected: 1 }).waiting, true);
  assert.equal(roomPresence({ connected: 0, practice: true }).network, 'WAITING FOR A PLAYER');
  assert.equal(roomPresence({ connected: 0, practice: true }).waiting, true);
  assert.equal(roomPresence({ connected: 2, practice: true }).match, '2 / 2 ONLINE · PRACTICE');
  assert.equal(roomPresence({ connected: 2 }).network, 'ROOM LIVE');
  assert.equal(roomPresence({ connected: 1, practice: 'true' }).network, 'WAITING FOR PLAYER 2');
});

test('active-seat recovery keeps priority over Practice/live status', () => {
  for (const practice of [false, true]) for (const connected of [0, 1, 2]) {
    const value = roomPresence({ connected, practice, resumePending: true });
    assert.equal(value.network, 'SEAT ACTIVE ELSEWHERE'); assert.equal(value.match, 'WAITING TO REJOIN');
    assert.equal(value.waiting, true);
  }
});

test('the actual room presentation applies Practice and recovery labels without changing two-seat counts', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const dom = new JSDOM('<p id="players"></p><div><span id="network"></span><i id="dot"></i></div><p id="match"></p>');
  const doc = dom.window.document;
  const context = vm.createContext({ ...browserRecoveryBindings(), connectedPlayers: 0, waitingForResume: false, soloPracticeActive: true, roomPresence,
    ui: { playersOnline: doc.querySelector('#players'), networkStatus: doc.querySelector('#network'),
      connectionDot: doc.querySelector('#dot'), matchStatus: doc.querySelector('#match') } });
  vm.runInContext(source.slice(source.indexOf('function updateRoomUI('), source.indexOf('\nfunction setConnection(')), context);
  context.updateRoomUI(1);
  assert.equal(doc.querySelector('#network').textContent, 'PRACTICE LIVE');
  assert.equal(doc.querySelector('#match').textContent, 'SOLO PRACTICE');
  assert.equal(doc.querySelector('#players').textContent, '1 / 2 PLAYERS');
  assert.equal(doc.querySelector('#dot').classList.contains('waiting'), false);
  context.waitingForResume = true; context.updateRoomUI(1);
  assert.equal(doc.querySelector('#network').textContent, 'SEAT ACTIVE ELSEWHERE');
  context.waitingForResume = false; context.soloPracticeActive = false; context.updateRoomUI(1);
  assert.equal(doc.querySelector('#network').textContent, 'WAITING FOR PLAYER 2');
  assert.equal(doc.querySelector('#dot').classList.contains('waiting'), true);
  dom.window.close();
});
