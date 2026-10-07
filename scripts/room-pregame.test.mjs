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

function payloadDiagnostics(source, { mutation, omitNormalizer = false } = {}) {
  const root = new URL('../', import.meta.url);
  const path = relative => fileURLToPath(new URL(relative, root));
  const config = ts.readConfigFile(path('tsconfig.check-js.json'), ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, fileURLToPath(root));
  assert.deepEqual(parsed.errors, []);
  const readAst = relative => ts.createSourceFile(path(relative), readFileSync(path(relative), 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const functions = (ast, names) => {
    const selected = ast.statements.filter(statement =>
      ts.isFunctionDeclaration(statement) && names.includes(statement.name?.text));
    assert.deepEqual(selected.map(statement => statement.name.text), names);
    return selected.map(statement => statement.getFullText(ast)).join('\n');
  };
  const variables = (ast, names) => {
    const declaredNames = statement => ts.isVariableStatement(statement)
      ? statement.declarationList.declarations.map(declaration => declaration.name.getText(ast)) : [];
    const selected = ast.statements.filter(statement => declaredNames(statement).some(name => names.includes(name)));
    assert.deepEqual(selected.flatMap(declaredNames), names);
    return selected.map(statement => statement.getFullText(ast)).join('\n');
  };
  const requiredImport = (ast, name, specifier) => {
    const selected = ast.statements.filter(statement => ts.isImportDeclaration(statement)
      && statement.moduleSpecifier.text === specifier
      && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)
      && statement.importClause.namedBindings.elements.some(element => element.name.text === name));
    assert.equal(selected.length, 1, `${name} production import`);
    return `import { ${name} } from '${specifier}';\n`;
  };
  const room = readAst('src/room-pregame.mjs');
  const classes = room.statements.filter(statement => ts.isClassDeclaration(statement)
    && statement.name?.text === 'RoomPregame');
  assert.equal(classes.length, 1);
  const declaration = classes[0];
  const methods = declaration.members.filter(member => ts.isMethodDeclaration(member)
    && member.name.getText(room) === 'payload');
  assert.equal(methods.length, 1);
  let method = methods[0].getFullText(room);
  if (mutation) {
    assert.equal(method.split(mutation.before).length, 2, 'mutate exactly one producer expression');
    method = method.replace(mutation.before, mutation.after);
  }
  const modes = readAst('src/match-modes.mjs');
  const banner = readAst('src/bannerfall-rules.mjs');
  // Keep actual declarations and their JSDoc. Only envelopes/imports are generated;
  // no producer, normalizer, registry or constant is replaced with a test stub.
  const roomSource = requiredImport(room, 'normalizeMatchMode', './match-modes.mjs')
    + functions(room, ['isPregameCheckpointRecord', 'isPregameCheckpointPhase',
      'isPregameCheckpointRevision', 'validatePregameCheckpoint'])
    + room.text.slice(declaration.getFullStart(), declaration.getStart())
    + `\nexport class RoomPregame {${method}\n}\n`;
  const normalizer = functions(modes, ['normalizeMatchMode']);
  const modeSource = requiredImport(modes, 'BANNERFALL_RULES', './bannerfall-rules.mjs')
    + variables(modes, ['NORMAL_MATCH_MAP_ID', 'definitions']) + (omitNormalizer ? '' : normalizer);
  const sources = new Map([
    [path('src/room-pregame.mjs'), roomSource],
    [path('src/match-modes.mjs'), modeSource],
    [path('src/bannerfall-rules.mjs'), variables(banner, ['BANNERFALL_RULES'])],
  ]);
  const fixturePath = path('scripts/type-contracts/pregame-payload-consumer.mjs');
  sources.set(fixturePath, source);
  const host = ts.createCompilerHost(parsed.options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, version, ...args) => sources.has(fileName)
    ? ts.createSourceFile(fileName, sources.get(fileName), version, true, ts.ScriptKind.JS)
    : getSourceFile(fileName, version, ...args);
  const program = ts.createProgram([fixturePath], parsed.options, host);
  const selectedFiles = program.getSourceFiles().filter(file => file.fileName.startsWith(path('src/')));
  assert.deepEqual(selectedFiles.map(file => file.fileName).sort(), [...sources.keys()]
    .filter(file => file.startsWith(path('src/'))).sort());
  // Every diagnostic is returned. A positive program must be entirely clean;
  // controls assert exact diagnostics rather than filtering unselected errors.
  return { fixturePath, modulePath: path('src/room-pregame.mjs'),
    modePath: path('src/match-modes.mjs'), diagnostics: ts.getPreEmitDiagnostics(program) };
}

const payloadConsumerPrefix = `import { RoomPregame } from '../../src/room-pregame.mjs';
/** @param {import('../../src/room-pregame.mjs').PregamePayloadSource & RoomPregame} room */
function consume(room) {
const checkpoint = room.checkpoint();
const payload = room.payload();
const seat = payload.seats[0];
`;
const payloadPositiveControls = [
  '/** @type {"lobby" | "running"} */ const checkpointPhase = checkpoint.phase;',
  '/** @type {number} */ const checkpointRevision = checkpoint.revision;',
  '/** @type {"lobby" | "running"} */ const payloadPhase = payload.phase;',
  '/** @type {number} */ const payloadRevision = payload.revision;',
  '/** @type {boolean} */ const launch = payload.canLaunch;',
  '/** @type {boolean} */ const ready = seat.ready;',
  '/** @type {"pvp"} */ const mode = payload.mode;',
];
const payloadConsumer = controls => `${payloadConsumerPrefix}${controls.join('\n')}\n}\n`;

test('actual payload/normalizer declarations compile with seven checked result controls', () => {
  const { diagnostics } = payloadDiagnostics(payloadConsumer(payloadPositiveControls));
  assert.deepEqual(diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')), []);
});

test('payload result controls reject fourteen unchecked kinds without inventing metadata guarantees', () => {
  const cases = [
    { source: 'checkpoint.phase = "launching";', code: 2322 },
    { source: 'checkpoint.revision = "0";', code: 2322 },
    { source: 'checkpoint.ready;', code: 2339 },
    { source: 'payload.phase = "launching";', code: 2322 },
    { source: 'payload.revision = "0";', code: 2322 },
    { source: 'payload.canLaunch = "yes";', code: 2322 },
    { source: 'seat.ready = "yes";', code: 2322 },
    { source: '/** @type {number} */ const map = payload.mapId;', code: 2322 },
    { source: '/** @type {string} */ const army = payload.armySize;', code: 2322 },
    { source: '/** @type {number} */ const id = seat.id;', code: 2322 },
    { source: '/** @type {string} */ const team = seat.team;', code: 2322 },
    { source: '/** @type {string} */ const connected = seat.connected;', code: 2322 },
    { source: '/** @type {number} */ const identity = payload.matchModeId;', code: 2322 },
    { source: '/** @type {string} */ const version = payload.matchModeVersion;', code: 2322 },
  ];
  const { fixturePath, diagnostics } = payloadDiagnostics(payloadConsumer(cases.map(item => item.source)));
  assert.equal(diagnostics.length, cases.length);
  assert.ok(diagnostics.every(diagnostic => diagnostic.file?.fileName === fixturePath));
  for (const [index, item] of cases.entries()) {
    const onLine = diagnostics.filter(diagnostic => diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line
      === payloadConsumerPrefix.split('\n').length - 1 + index);
    assert.deepEqual(onLine.map(diagnostic => diagnostic.code), [item.code], item.source);
  }
});

test('partial payload DTO admits open/missing/nonstandard metadata and preserves runtime passthrough', () => {
  const { diagnostics } = payloadDiagnostics(`
/** @type {import('../../src/room-pregame.mjs').PregamePayload} */
const metadata = { phase: 'lobby', revision: 0, mapId: 42, armySize: 'eight',
  matchModeId: null, matchModeVersion: false, mode: 'pvp', canLaunch: false,
  seats: [{ ready: false }, { id: 7, team: '0', connected: 'yes', extra: true, ready: true }] };
`);
  assert.deepEqual(diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')), []);
  const value = new RoomPregame(42, 'eight');
  value.syncSeats([{ id: 7, team: '0', connected: 'yes' }]);
  assert.deepEqual(value.payload(), { phase: 'lobby', revision: 1, mapId: 42, armySize: 'eight',
    matchModeId: 'authored', matchModeVersion: 1, mode: 'pvp', canLaunch: false,
    seats: [{ id: 7, team: '0', connected: 'yes', ready: false }] });
  value.seats = [{ extra: 'open metadata' }];
  assert.deepEqual(value.payload().seats, [{ extra: 'open metadata', ready: false }]);
});

test('checked actual payload body rejects four producer result regressions', () => {
  const mutations = [
    { before: "      mode: 'pvp', canLaunch:", after: "      mode: 'pve', canLaunch:", code: 2322 },
    { before: 'canLaunch: this.canLaunch(),', after: "canLaunch: 'yes',", code: 2322 },
    { before: 'ready: this.readyIds.has(seat.id)', after: "ready: 'yes'", code: 2322 },
    { before: 'seats: this.seats.map(seat => ({ ...seat, ready: this.readyIds.has(seat.id) })),',
      after: 'seats: { ready: true },', code: 2353 },
  ];
  for (const mutation of mutations) {
    const { modulePath, diagnostics } = payloadDiagnostics(payloadConsumer(payloadPositiveControls), { mutation });
    assert.equal(diagnostics.length, 1, mutation.before);
    assert.equal(diagnostics[0].file?.fileName, modulePath);
    assert.equal(diagnostics[0].code, mutation.code);
    const line = diagnostics[0].file.getLineAndCharacterOfPosition(diagnostics[0].start).line;
    assert.ok(diagnostics[0].file.text.split('\n')[line].includes(mutation.after.trim()), mutation.after);
  }
});

test('selected payload program fails when its actual normalizer dependency is missing', () => {
  const { modulePath, diagnostics } = payloadDiagnostics(payloadConsumer(payloadPositiveControls), { omitNormalizer: true });
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].file?.fileName, modulePath);
  assert.equal(diagnostics[0].code, 2305);
  assert.match(ts.flattenDiagnosticMessageText(diagnostics[0].messageText, '\n'), /normalizeMatchMode/);
});

test('actual host pregamePayload consumer preserves checked projection results with unknown host metadata', () => {
  const root = new URL('../', import.meta.url);
  const serverPath = fileURLToPath(new URL('server.mjs', root));
  const server = ts.createSourceFile(serverPath, readFileSync(serverPath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const declarations = server.statements.filter(statement => ts.isFunctionDeclaration(statement)
    && statement.name?.text === 'pregamePayload');
  assert.equal(declarations.length, 1);
  // Host binding slots describe dependencies, not stand-in implementations.
  // The actual host declaration retains its null guard, sync call and full spread.
  const { diagnostics } = payloadDiagnostics(`
import { RoomPregame } from '../../src/room-pregame.mjs';
/** @param {{
 * pregame: (import('../../src/room-pregame.mjs').PregamePayloadSource & RoomPregame) | null,
 * syncPregameSeats: () => void,
 * DEFAULT_FACTION_ID: unknown, mapCatalogPayload: () => unknown,
 * matchModeCatalog: (input: unknown) => unknown, matchModeDefinition: (input: unknown) => unknown,
 * authoredMapDefinition: unknown, matchMode: unknown
 * }} bindings */
function hostProjection(bindings) {
const {pregame, syncPregameSeats, DEFAULT_FACTION_ID, mapCatalogPayload,
matchModeCatalog, matchModeDefinition, authoredMapDefinition, matchMode} = bindings;
${declarations[0].getFullText(server)}
const payload = pregamePayload();
if (payload === null) return null;
/** @type {'pvp'} */ const mode = payload.mode;
/** @type {boolean} */ const canLaunch = payload.canLaunch;
/** @type {boolean} */ const ready = payload.seats[0].ready;
/** @type {unknown} */ const catalog = payload.maps;
return {mode, canLaunch, ready, catalog};
}
`);
  assert.deepEqual(diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')), []);
});

function seatSyncDiagnostics(source, mutation) {
  const root = new URL('../', import.meta.url);
  const path = relative => fileURLToPath(new URL(relative, root));
  const config = ts.readConfigFile(path('tsconfig.check-js.json'), ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, fileURLToPath(root));
  assert.deepEqual(parsed.errors, []);
  const modulePath = path('src/room-pregame.mjs');
  const room = ts.createSourceFile(modulePath, readFileSync(modulePath, 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const names = ['isPregameCheckpointRecord', 'isPregameCheckpointPhase',
    'isPregameCheckpointRevision', 'validatePregameCheckpoint'];
  const declarations = room.statements.filter(statement => ts.isFunctionDeclaration(statement)
    && names.includes(statement.name?.text));
  assert.deepEqual(declarations.map(statement => statement.name.text), names);
  const classes = room.statements.filter(statement => ts.isClassDeclaration(statement)
    && statement.name?.text === 'RoomPregame');
  assert.equal(classes.length, 1);
  const methods = classes[0].members.filter(member => ts.isMethodDeclaration(member)
    && member.name.getText(room) === 'syncSeats');
  assert.equal(methods.length, 1);
  let method = methods[0].getFullText(room);
  if (mutation) {
    assert.equal(method.split(mutation.before).length, 2);
    method = method.replace(mutation.before, mutation.after);
  }
  // Select actual JSDoc/declarations. The receiver callback remains explicitly
  // caller-owned; this does not enroll the constructor or other class methods.
  const moduleSource = declarations.map(statement => statement.getFullText(room)).join('\n')
    + room.text.slice(classes[0].getFullStart(), classes[0].getStart())
    + `\nexport class RoomPregame {${method}\n}\n`;
  const fixturePath = path('scripts/type-contracts/pregame-seat-sync-consumer.mjs');
  const host = ts.createCompilerHost(parsed.options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, version, ...args) => {
    const text = fileName === modulePath ? moduleSource : fileName === fixturePath ? source : null;
    return text === null ? getSourceFile(fileName, version, ...args)
      : ts.createSourceFile(fileName, text, version, true, ts.ScriptKind.JS);
  };
  const program = ts.createProgram([fixturePath], parsed.options, host);
  assert.deepEqual(program.getSourceFiles().filter(file => file.fileName.startsWith(path('src/')))
    .map(file => file.fileName), [modulePath]);
  return { fixturePath, modulePath, diagnostics: ts.getPreEmitDiagnostics(program) };
}

const seatSyncPrefix = `import { RoomPregame } from '../../src/room-pregame.mjs';
/** @param {import('../../src/room-pregame.mjs').PregameSeatSyncSource & RoomPregame} room */
function consume(room) {
`;

test('trusted seat projection accepts readonly caller data and unknown or nullable extra metadata', () => {
  const { diagnostics } = seatSyncDiagnostics(`${seatSyncPrefix}
/** @type {unknown} */ const metadata = null;
/** @type {0} */ const hostTeam = 0;
/** @type {1} */ const guestTeam = 1;
const seats = Object.freeze([Object.freeze({id: 'player-1', team: hostTeam,
  connected: true, metadata}), Object.freeze({id: 'player-2', team: guestTeam,
  connected: false, extra: undefined})]);
/** @type {boolean} */ const changed = room.syncSeats(seats);
room.syncSeats([]);
/** @type {string} */ const id = room.seats[0].id;
/** @type {0 | 1} */ const team = room.seats[0].team;
/** @type {boolean} */ const connected = room.seats[0].connected;
return {changed, id, team, connected};
}
`);
  assert.deepEqual(diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), []);
});

test('trusted seat projection rejects incorrect kinds, incomplete seats and result misuse', () => {
  const cases = [
    { source: "room.syncSeats([{id: 1, team: 0, connected: true}]);", code: 2322 },
    { source: "room.syncSeats([{id: 'p', team: '0', connected: true}]);", code: 2322 },
    { source: "room.syncSeats([{id: 'p', team: null, connected: true}]);", code: 2322 },
    { source: "room.syncSeats([{id: 'p', team: 2, connected: true}]);", code: 2322 },
    { source: "room.syncSeats([{id: 'p', team: 0, connected: 'true'}]);", code: 2322 },
    { source: "room.syncSeats([{id: 'p', team: 0}]);", code: 2322 },
    { source: 'room.syncSeats([]).toFixed(0);', code: 2339 },
    { source: "RoomPregame.prototype.syncSeats.call({seats: [], phase: 'lobby'}, []);", code: 2345 },
  ];
  const { fixturePath, diagnostics } = seatSyncDiagnostics(seatSyncPrefix
    + cases.map(item => item.source).join('\n') + '\n}');
  assert.equal(diagnostics.length, cases.length);
  assert.ok(diagnostics.every(d => d.file?.fileName === fixturePath));
  for (const [index, item] of cases.entries()) {
    assert.deepEqual(diagnostics.filter(d => d.file.getLineAndCharacterOfPosition(d.start).line === index + 3)
      .map(d => d.code), [item.code], item.source);
  }
});

test('seat projection checks its actual stored fields, sort callback and Boolean result', () => {
  for (const mutation of [
    { before: '({ id, team, connected }))', after: "({ id, team, connected: 'true' }))", code: 2322 },
    { before: 'a.team - b.team', after: 'a.team.toUpperCase() - b.team', code: 2339 },
    { before: 'return false;', after: "return 'unchanged';", code: 2322 },
  ]) {
    const { modulePath, diagnostics } = seatSyncDiagnostics(seatSyncPrefix + 'return room.syncSeats([]);\n}', mutation);
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].file?.fileName, modulePath);
    assert.equal(diagnostics[0].code, mutation.code);
  }
});

const seatHostSource = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const seatHostAst = ts.createSourceFile('server.mjs', seatHostSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const seatHostDeclarations = seatHostAst.statements.filter(statement => ts.isFunctionDeclaration(statement)
  && statement.name?.text === 'syncPregameSeats');
assert.equal(seatHostDeclarations.length, 1);
const seatHostDeclaration = seatHostDeclarations[0].getFullText(seatHostAst);
const seatHostPrefix = `import { RoomPregame } from '../../src/room-pregame.mjs';
/** @param {{
 * pregame: (import('../../src/room-pregame.mjs').PregameSeatSyncSource & RoomPregame) | null,
 * sessions: ReadonlyMap<string, Readonly<{id: string, team: 0 | 1,
 * peer: Readonly<{closed: unknown}> | null, expiresAt: number, metadata?: unknown}>>,
 * dirty: boolean
 * }} bindings */
function project(bindings) {
let {pregame, sessions, dirty} = bindings;
`;

test('actual host session projection supplies checked seats and Booleanizes nullable peer state', () => {
  const { diagnostics } = seatSyncDiagnostics(seatHostPrefix + seatHostDeclaration
    + '\nsyncPregameSeats(); return dirty;\n}');
  assert.deepEqual(diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), []);
  for (const [before, after] of [
    ['id: session.id', 'id: 42'], ['team: session.team', 'team: null'],
    ['Boolean(session.peer && !session.peer.closed)', 'session.peer && !session.peer.closed'],
  ]) {
    assert.equal(seatHostDeclaration.split(before).length, 2);
    const { fixturePath, diagnostics: negative } = seatSyncDiagnostics(seatHostPrefix
      + seatHostDeclaration.replace(before, after) + '\nsyncPregameSeats(); return dirty;\n}');
    assert.equal(negative.length, 1);
    assert.equal(negative[0].file?.fileName, fixturePath);
    assert.equal(negative[0].code, 2345);
  }
});

test('actual host seat sync retains active and reserved sessions, drops expired sessions and marks changes', () => {
  const project = new Function('bindings', `let {pregame, sessions, dirty} = bindings;
    ${seatHostDeclaration}
    syncPregameSeats(); return dirty;`);
  assert.equal(project({pregame: null, sessions: null, dirty: false}), false);
  const room = new RoomPregame('a', 8);
  const active = {id: 'host', team: 0, peer: {closed: null}, expiresAt: 0, metadata: null};
  const reserved = {id: 'guest', team: 1, peer: null, expiresAt: Date.now() + 60_000};
  const sessions = new Map([['guest', reserved], ['expired', {
    id: 'expired', team: 1, peer: null, expiresAt: 0,
  }], ['host', active]]);
  assert.equal(project({pregame: room, sessions, dirty: false}), true);
  assert.deepEqual(room.seats, [{id: 'host', team: 0, connected: true}, {id: 'guest', team: 1, connected: false}]);
  assert.equal(project({pregame: room, sessions, dirty: false}), false);
  assert.equal(project({pregame: room, sessions, dirty: true}), true);
  active.peer.closed = 'closed';
  assert.equal(project({pregame: room, sessions, dirty: false}), true);
  assert.equal(room.seats[0].connected, false);
  assert.equal(active.metadata, null);
});

test('seat sync preserves getter order, copies without input mutation and ignores extra metadata', () => {
  const calls = [];
  const seat = (id, team, connected) => Object.freeze({
    get id() { calls.push(`${id}:id`); return id; },
    get team() { calls.push(`${id}:team`); return team; },
    get connected() { calls.push(`${id}:connected`); return connected; },
    get metadata() { throw new Error('extra metadata is not projected'); },
  });
  const input = Object.freeze([seat('guest', 1, false), seat('host', 0, true)]);
  const room = lobby();
  assert.equal(room.syncSeats(input), true);
  assert.deepEqual(calls, ['guest:id', 'guest:team', 'guest:connected', 'host:id', 'host:team', 'host:connected']);
  assert.deepEqual(room.seats, [{id: 'host', team: 0, connected: true}, {id: 'guest', team: 1, connected: false}]);
  assert.notEqual(room.seats[0], input[1]);
  const mutable = [{id: 'host', team: 0, connected: true}];
  room.syncSeats(mutable);
  mutable[0].connected = false;
  assert.equal(room.seats[0].connected, true);
  // Unselected runtime callers retain existing acceptance; no admission guard
  // or metadata-kind guarantee is added to the class/payload by this annotation.
  assert.equal(room.syncSeats([{id: null, team: '1', connected: 'truthy', extra: null}]), true);
  assert.deepEqual(room.seats, [{id: null, team: '1', connected: 'truthy'}]);
});

test('seat sync preserves comparison, assignment and invalidation ordering on no-op and failure', () => {
  const calls = [];
  let stored = [];
  let phase = 'lobby';
  const failure = new Error('invalidate');
  const receiver = {
    get seats() { calls.push('read seats'); return stored; },
    set seats(value) { calls.push('write seats'); stored = value; },
    get phase() { calls.push('phase'); return phase; },
    get invalidate() { calls.push('invalidate'); return () => { calls.push('call'); throw failure; }; },
  };
  const sync = seats => RoomPregame.prototype.syncSeats.call(receiver, seats);
  assert.equal(sync([]), false);
  assert.deepEqual(calls, ['read seats']);
  calls.length = 0;
  assert.throws(() => sync([{id: 'p', team: 0, connected: true}]), error => error === failure);
  assert.deepEqual(calls, ['read seats', 'write seats', 'phase', 'invalidate', 'call']);
  assert.deepEqual(stored, [{id: 'p', team: 0, connected: true}], 'assignment precedes callback failure');
  calls.length = 0;
  const readFailure = new Error('id');
  assert.throws(() => sync([{get id() { throw readFailure; }}]), error => error === readFailure);
  assert.deepEqual(calls, []);
  phase = 'running';
  assert.equal(sync([]), true);
  assert.deepEqual(calls, ['read seats', 'write seats', 'phase']);
});
