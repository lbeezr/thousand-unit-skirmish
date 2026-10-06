import assert from 'node:assert/strict';
import test from 'node:test';
import { RoomPregame, validatePregameCheckpoint } from '../src/room-pregame.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

function checkpointDiagnostics(source) {
  const root = new URL('../', import.meta.url);
  const configPath = fileURLToPath(new URL('tsconfig.check-js.json', root));
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, fileURLToPath(root));
  assert.deepEqual(parsed.errors, []);
  const modulePath = fileURLToPath(new URL('src/room-pregame.mjs', root));
  const moduleSource = ts.createSourceFile(modulePath, readFileSync(modulePath, 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const names = ['isPregameCheckpointRecord', 'isPregameCheckpointPhase',
    'isPregameCheckpointRevision', 'validatePregameCheckpoint'];
  const declarations = moduleSource.statements.filter(statement =>
    ts.isFunctionDeclaration(statement) && names.includes(statement.name?.text));
  assert.deepEqual(declarations.map(statement => statement.name.text), names);
  // Compile the actual boundary declarations (including their JSDoc), without
  // enrolling the unrelated RoomPregame class and match-mode dependency graph.
  // A new boundary dependency must be included here or fails as an unknown name.
  const boundarySource = declarations.map(statement => statement.getFullText(moduleSource)).join('\n');
  const fixturePath = fileURLToPath(new URL('scripts/type-contracts/pregame-checkpoint-consumer.mjs', root));
  const host = ts.createCompilerHost(parsed.options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, languageVersion, ...args) => {
    const contents = fileName === modulePath ? boundarySource : fileName === fixturePath ? source : null;
    return contents === null ? getSourceFile(fileName, languageVersion, ...args)
      : ts.createSourceFile(fileName, contents, languageVersion, true, ts.ScriptKind.JS);
  };
  const program = ts.createProgram([fixturePath], parsed.options, host);
  return { fixturePath, diagnostics: ts.getPreEmitDiagnostics(program) };
}

test('checkpoint boundary declarations and checked restore consumer compile with existing strict options', () => {
  const { diagnostics } = checkpointDiagnostics(`
import { validatePregameCheckpoint } from '../../src/room-pregame.mjs';
/** @param {unknown} input */
function restore(input) {
  const saved = validatePregameCheckpoint(input);
  if (!saved) throw new TypeError('Pregame phase is required.');
  /** @type {'lobby' | 'running'} */ const phase = saved.phase;
  /** @type {number} */ const revision = saved.revision;
  return { phase, revision: Number(revision.toFixed(0)) };
}
/** @type {import('../../src/room-pregame.mjs').PregameCheckpoint} */
const checkpoint = { phase: 'running', revision: 1 };
restore(checkpoint);
restore({ phase: 'invalid', revision: 'unchecked boundary input' });
`);
  assert.deepEqual(diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')), []);
});

test('checked checkpoint consumers reject nullable and incorrectly typed results', () => {
  const cases = [
    { source: 'validatePregameCheckpoint(null).phase;', code: 2531 },
    { source: "const a = validatePregameCheckpoint({}); if (a) a.phase.toFixed(0);", code: 2551 },
    { source: 'const b = validatePregameCheckpoint({}); if (b) b.revision.toUpperCase();', code: 2339 },
    { source: "/** @type {import('../../src/room-pregame.mjs').PregameCheckpoint} */ const c = { phase: 'launching', revision: 0 };", code: 2322 },
    { source: "/** @type {import('../../src/room-pregame.mjs').PregameCheckpoint} */ const d = { phase: 'lobby', revision: '0' };", code: 2322 },
    { source: 'const e = validatePregameCheckpoint({}); if (e) e.ready;', code: 2339 },
  ];
  const { fixturePath, diagnostics } = checkpointDiagnostics([
    "import { validatePregameCheckpoint } from '../../src/room-pregame.mjs';",
    ...cases.map(item => item.source),
  ].join('\n'));
  assert.equal(diagnostics.length, cases.length);
  assert.ok(diagnostics.every(diagnostic => diagnostic.file?.fileName === fixturePath));
  for (const [index, item] of cases.entries()) {
    const onLine = diagnostics.filter(diagnostic =>
      diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line === index + 1);
    assert.deepEqual(onLine.map(diagnostic => diagnostic.code), [item.code], item.source);
  }
});

test('checkpoint validation preserves stable object and JSON acceptance and rejection', () => {
  assert.equal(validatePregameCheckpoint(null), null);
  for (const phase of ['lobby', 'running']) for (const revision of [0, -0, 1, Number.MAX_SAFE_INTEGER]) {
    const input = { phase, revision };
    const result = validatePregameCheckpoint(input);
    assert.deepEqual(result, input);
    assert.notEqual(result, input);
    assert.deepEqual(Object.keys(result), ['phase', 'revision']);
    const json = JSON.parse(JSON.stringify(input));
    assert.deepEqual(validatePregameCheckpoint(json), json);
    assert.deepEqual(new RoomPregame('a', 8, json).checkpoint(), json);
  }
  const inherited = Object.create({ phase: 'running', revision: 4 });
  Object.defineProperty(inherited, 'ignored', { value: true });
  inherited[Symbol('ignored')] = true;
  assert.deepEqual(validatePregameCheckpoint(inherited), { phase: 'running', revision: 4 });
  for (const input of [undefined, false, 0, 'lobby', Symbol('checkpoint'), 0n, [], {},
    { phase: 'launching', revision: 0 }, { revision: 0 }, { phase: 'lobby' },
    { phase: 'running', revision: 0, ready: true },
    ...[-1, 0.5, Infinity, -Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, '0', null, {}, 0n]
      .map(revision => ({ phase: 'lobby', revision }))]) {
    assert.throws(() => validatePregameCheckpoint(input), {
      name: 'TypeError', message: 'Invalid pregame checkpoint.',
    });
  }
  assert.throws(() => new RoomPregame('a', 8, null), {
    name: 'TypeError', message: 'Pregame phase is required.',
  });
});

test('changing checkpoint getters cannot replace validated fields during constructor restore', () => {
  for (const restore of [validatePregameCheckpoint, checkpoint => new RoomPregame('a', 8, checkpoint).checkpoint()]) {
    let phases = 0;
    let revisions = 0;
    const input = {
      get phase() { return ++phases === 1 ? 'lobby' : 'launching'; },
      get revision() { return ++revisions <= 2 ? 0 : 'invalid'; },
    };
    assert.deepEqual(restore(input), { phase: 'lobby', revision: 0 });
    assert.deepEqual({ phases, revisions }, { phases: 1, revisions: 1 });
  }
  let phaseReads = 0;
  let revisionReads = 0;
  assert.throws(() => validatePregameCheckpoint({
    get phase() { return ++phaseReads === 1 ? 'launching' : 'running'; },
    get revision() { revisionReads++; return 0; },
  }), { name: 'TypeError', message: 'Invalid pregame checkpoint.' });
  assert.deepEqual({ phaseReads, revisionReads }, { phaseReads: 1, revisionReads: 0 });
  assert.throws(() => validatePregameCheckpoint({
    phase: 'running', get revision() { return ++revisionReads === 1 ? 'invalid' : 0; },
  }), { name: 'TypeError', message: 'Invalid pregame checkpoint.' });
  assert.equal(revisionReads, 1);
});

test('checkpoint validation keeps key, phase and revision rejection order and propagates accessor errors', () => {
  const calls = [];
  const phaseFailure = new Error('phase getter');
  const revisionFailure = new Error('revision getter');
  const input = {
    get phase() { calls.push('phase'); throw phaseFailure; },
    get revision() { calls.push('revision'); throw revisionFailure; },
  };
  const extraKey = Object.create(null, Object.getOwnPropertyDescriptors(input));
  extraKey.extra = true;
  assert.throws(() => validatePregameCheckpoint(extraKey),
    { name: 'TypeError', message: 'Invalid pregame checkpoint.' });
  assert.deepEqual(calls, []);
  assert.throws(() => validatePregameCheckpoint(input), error => error === phaseFailure);
  assert.deepEqual(calls, ['phase']);
  calls.length = 0;
  assert.throws(() => validatePregameCheckpoint({ phase: 'launching', get revision() { calls.push('revision'); throw revisionFailure; } }),
    { name: 'TypeError', message: 'Invalid pregame checkpoint.' });
  assert.deepEqual(calls, []);
  assert.throws(() => validatePregameCheckpoint({ phase: 'running', get revision() { throw revisionFailure; } }),
    error => error === revisionFailure);
  const keysFailure = new Error('own keys');
  assert.throws(() => validatePregameCheckpoint(new Proxy(input, { ownKeys() { throw keysFailure; } })),
    error => error === keysFailure);
});

const host = { id: 'player-1', team: 0 };
const guest = { id: 'player-2', team: 1 };
const maps = new Map([['a', { id: 'a', startingArmySize: 8 }], ['b', { id: 'b', startingArmySize: 500 }]]);
function lobby() {
  const value = new RoomPregame('a', 8);
  value.syncSeats([{ ...host, connected: true }, { ...guest, connected: true }]);
  return value;
}
function readyBoth(value) {
  for (const player of [host, guest]) value.setReady(player, { revision: value.revision, ready: true });
}

const authored = { matchModeId: 'authored', matchModeVersion: 1 };
const skirmish = { matchModeId: 'skirmish', matchModeVersion: 1 };
const bannerfall = { matchModeId: 'bannerfall', matchModeVersion: 1 };
const arena = JSON.parse(readFileSync(new URL('../maps/bannerfall-arena.json', import.meta.url)));
const modeMaps = new Map([...maps, ['bellweather-millrace', {
  id: 'bellweather-millrace', startingArmySize: 24, triggers: [{ victory: true }],
}], ['underbough-rootways', {
  id: 'underbough-rootways', startingArmySize: 24, triggers: [{ victory: true }],
}], [arena.id, arena]]);

test('paired Bannerfall preset changes map/mode/army together and requires fresh readiness', () => {
  const value = lobby();
  readyBoth(value);
  const before = value.payload();
  assert.throws(() => value.configure(host, { revision: value.revision, ...bannerfall }, modeMaps), /not compatible/);
  assert.deepEqual(value.payload(), before, 'mode-only selection cannot silently replace the current map');
  assert.equal(value.configure(host, { revision: value.revision, mapId: arena.id, ...bannerfall }, modeMaps), true);
  assert.equal(value.mapId, 'bannerfall-arena');
  assert.equal(value.matchModeId, 'bannerfall');
  assert.equal(value.matchModeVersion, 1);
  assert.equal(value.armySize, 16);
  assert.equal(value.revision, before.revision + 1);
  assert.equal(value.canLaunch(), false);
  assert.ok(value.payload().seats.every(seat => !seat.ready));
  assert.throws(() => value.setReady(host, { revision: before.revision, ready: true }), /Lobby changed/);
  readyBoth(value);
  const selected = value.payload();
  assert.equal(value.configure(host, { revision: value.revision, mapId: arena.id, armySize: 16, ...bannerfall }, modeMaps), false);
  assert.deepEqual(value.payload(), selected, 'explicit fixed opening is a no-op and retains readiness');
  assert.equal(value.launch(host, value.revision), true);
});

test('Bannerfall rejects incompatible fixed-army tuples without changing revision or readiness', () => {
  const ordinary = lobby();
  readyBoth(ordinary);
  const ordinaryBefore = ordinary.payload();
  assert.throws(() => ordinary.configure(host, { revision: ordinary.revision, mapId: arena.id,
    armySize: 250, ...bannerfall }, modeMaps), /opening army is fixed/);
  assert.deepEqual(ordinary.payload(), ordinaryBefore, 'the map and mode do not change before army validation');
  const value = new RoomPregame(arena.id, 500, undefined, bannerfall);
  assert.equal(value.armySize, 16, 'a fresh Bannerfall lobby uses its fixed opening');
  value.syncSeats([{ ...host, connected: true }, { ...guest, connected: true }]);
  readyBoth(value);
  const before = value.payload();
  for (const armySize of [250, 500, 1000, 2000, 0, null, '16']) {
    assert.throws(() => value.configure(host, { revision: value.revision, armySize }, modeMaps), /opening army is fixed/);
    assert.deepEqual(value.payload(), before);
  }
  for (const [player, command] of [[guest, { mapId: arena.id }], [host, { mapId: 'bellweather-millrace' }],
    [host, { revision: value.revision - 1, ...bannerfall }], [host, { matchModeId: 'bannerfall' }]]) {
    assert.throws(() => value.configure(player, { revision: value.revision, ...command }, modeMaps));
    assert.deepEqual(value.payload(), before);
  }
  assert.equal(value.configure(host, { revision: value.revision, mapId: 'bellweather-millrace', ...skirmish }, modeMaps), true);
  assert.equal(value.armySize, 24, 'leaving Bannerfall restores the newly selected map opening');
  assert.equal(value.matchModeId, 'skirmish');
  assert.equal(value.canLaunch(), false);
});

test('mode changes validate the full tuple, invalidate ready and cannot occur during play', () => {
  const value = lobby();
  readyBoth(value);
  assert.deepEqual({ matchModeId: value.matchModeId, matchModeVersion: value.matchModeVersion }, authored);
  const before = value.payload();
  for (const command of [{ ...skirmish }, { matchModeId: 'skirmish' }, { matchModeVersion: 1 },
    { ...skirmish, matchModeVersion: '1' }, { ...skirmish, matchModeVersion: 2 },
    { matchModeId: 'unknown', matchModeVersion: 1 },
    { matchModeId: 'objective-control', matchModeVersion: 1 }]) {
    assert.throws(() => value.configure(host, { revision: value.revision, ...command }, modeMaps));
    assert.deepEqual(value.payload(), before, 'rejected tuple leaves readiness and settings intact');
  }
  assert.equal(value.configure(host, { revision: value.revision, ...authored }, modeMaps), false);
  assert.deepEqual(value.payload(), before, 'same mode is a no-op');
  assert.equal(value.configure(host, { revision: value.revision, mapId: 'bellweather-millrace', ...skirmish }, modeMaps), true);
  assert.equal(value.armySize, 24);
  assert.equal(value.matchModeId, 'skirmish');
  assert.ok(value.payload().seats.every(seat => !seat.ready));
  readyBoth(value);
  assert.equal(value.configure(host, { revision: value.revision, ...skirmish }, modeMaps), false);
  assert.equal(value.canLaunch(), true);
  const selected = value.payload();
  for (const [player, command] of [[guest, { ...authored }], [host, { mapId: 'a' }],
    [host, { revision: value.revision - 1, ...authored }]]) {
    assert.throws(() => value.configure(player, { revision: value.revision, ...command }, modeMaps));
    assert.deepEqual(value.payload(), selected);
  }
  value.launch(host, value.revision);
  assert.throws(() => value.configure(host, { revision: value.revision, ...authored }, modeMaps));
});

test('mode identity survives recovery and rematch while readiness does not', () => {
  const value = new RoomPregame('bellweather-millrace', 24, undefined, skirmish);
  value.syncSeats([{ ...host, connected: true }, { ...guest, connected: true }]);
  readyBoth(value);
  const restored = new RoomPregame(value.mapId, value.armySize, value.checkpoint(), value);
  restored.syncSeats(value.seats);
  assert.equal(restored.matchModeId, 'skirmish');
  assert.equal(restored.matchModeVersion, 1);
  assert.equal(restored.canLaunch(), false);
  restored.reset('underbough-rootways', 24);
  assert.equal(restored.matchModeId, 'skirmish');
  assert.equal(restored.phase, 'lobby');
  assert.ok(restored.payload().seats.every(seat => !seat.ready));
  readyBoth(restored);
  assert.equal(restored.configure(host, { revision: restored.revision, mapId: 'a', ...authored }, modeMaps), true);
  assert.equal(restored.matchModeId, 'authored', 'compatible map and mode can change together');
});

test('host settings reject invalid, unsupported and stale changes atomically', () => {
  const value = lobby();
  readyBoth(value);
  const before = value.payload();
  for (const [player, command] of [
    [guest, { mapId: 'b' }], [host, { mapId: 'absent' }], [host, { armySize: 8 }],
    [host, { armySize: '500' }], [host, { armySize: null }], [host, { mapId: null }],
    [host, { mapId: 'b', armySize: 0 }], [host, { mode: 'pve' }], [host, { civilization: 'boughward' }],
  ]) {
    assert.throws(() => value.configure(player, { revision: value.revision, ...command }, maps));
    assert.deepEqual(value.payload(), before);
  }
  assert.throws(() => value.configure(host, { revision: value.revision - 1, mapId: 'b' }, maps));
  assert.deepEqual(value.payload(), before);
  assert.equal(value.configure(host, { revision: value.revision, mapId: 'a' }, maps), false);
  assert.deepEqual(value.payload(), before, 'unchanged settings retain ready');
  assert.equal(value.configure(host, { revision: value.revision, mapId: 'b' }, maps), true);
  assert.equal(value.armySize, 500, 'map change uses the actual map opening');
  assert.equal(value.canLaunch(), false);
});

test('readiness binds to connected session identity and current settings', () => {
  const value = lobby();
  const revision = value.revision;
  value.setReady(host, { revision, ready: true });
  value.setReady(host, { revision, ready: true });
  assert.equal(value.canLaunch(), false);
  assert.throws(() => value.setReady({ id: host.id, team: null }, { revision, ready: true }));
  assert.throws(() => value.setReady(guest, { revision, ready: 'true' }));
  assert.throws(() => value.launch(host, revision));
  value.configure(host, { revision, armySize: 250 }, maps);
  assert.throws(() => value.setReady(guest, { revision, ready: true }));
  readyBoth(value);
  assert.throws(() => value.launch(guest, value.revision));
  assert.equal(value.launch(host, value.revision), true);
  assert.equal(value.launch(host, value.revision), false, 'duplicate launch never starts a second match');
  assert.throws(() => value.configure(host, { revision: value.revision, mapId: 'b' }, maps));
});

test('disconnect, rejoin and replacement invalidate ready without changing seats', () => {
  const value = lobby();
  readyBoth(value);
  const revision = value.revision;
  value.syncSeats([{ ...host, connected: false }, { ...guest, connected: true }]);
  assert.equal(value.canLaunch(), false);
  assert.throws(() => value.launch(host, value.revision));
  value.syncSeats([{ ...host, connected: true }, { ...guest, connected: true }]);
  assert.equal(value.payload().seats[0].id, host.id);
  assert.ok(value.payload().seats.every(seat => !seat.ready));
  assert.throws(() => value.launch(host, revision));
  value.syncSeats([{ id: 'player-3', team: 0, connected: true }, { ...guest, connected: true }]);
  assert.throws(() => value.setReady(host, { revision: value.revision, ready: true }));
  assert.equal(value.payload().seats[1].team, 1, 'guest is not silently promoted');
});

test('recovery preserves phase and clears readiness; reset requires a new launch', () => {
  const value = lobby();
  readyBoth(value);
  const restored = new RoomPregame('a', 8, value.checkpoint());
  restored.syncSeats(value.seats);
  assert.equal(restored.phase, 'lobby');
  assert.equal(restored.canLaunch(), false);
  value.launch(host, value.revision);
  const running = new RoomPregame('a', 8, value.checkpoint());
  running.syncSeats(value.seats);
  assert.equal(running.phase, 'running');
  running.reset('b', 500);
  assert.equal(running.phase, 'lobby');
  assert.equal(running.canLaunch(), false);
  assert.throws(() => running.launch(host, value.revision));
  for (const invalid of [undefined, {}, [], { phase: 'launching', revision: 0 },
    { phase: 'lobby', revision: -1 }, { phase: 'lobby', revision: 1.5 },
    { phase: 'running', revision: 1, ready: true }]) assert.throws(() => validatePregameCheckpoint(invalid));
});
