import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as currentCore from '../src/server/voluntary-endings.mjs';
import ts from 'typescript';
import { freshVoluntaryEndings, voluntaryCapability, decideVoluntaryEnding, cancelVoluntaryOffer,
  savedVoluntaryEndings, validSavedVoluntaryEndings, migrateVoluntaryEndingCheckpoint } from '../src/server/voluntary-endings.mjs';
const context = team => ({ team, humanSeat: true, started: true, winner: -1, bothHumans: true });
const command = (state, action, more = {}) => ({ version: 1, generation: state.generation, revision: state.revision, action, ...more });
const validity = (state, more = {}) => validSavedVoluntaryEndings(savedVoluntaryEndings(state), {
  winner: state.result?.winner ?? -1, reason: state.result?.reason ?? null, triggerId: null, started: true, ...more });

for (const team of [0, 1]) {
  test(`seat ${team} can concede but cannot accept its own offer or fabricate consent`, () => {
    const state = freshVoluntaryEndings();
    const offer = command(state, 'offer');
    assert.equal(decideVoluntaryEnding(state, offer, context(team)).accepted, true);
    const before = structuredClone(state);
    for (const cmd of [offer, command(state, 'accept', { offerId: state.offer.id }),
      command(state, 'accept', { offerId: 99 }), command(state, 'unknown')]) {
      assert.equal(decideVoluntaryEnding(state, cmd, context(team)).accepted, false);
      assert.deepEqual(state, before);
    }
    assert.equal(decideVoluntaryEnding(state, command(state, 'accept', { offerId: state.offer.id }), context(1 - team)).accepted, true);
    assert.deepEqual(state.result, { winner: 2, reason: 'agreed-draw', agreedTeams: [0, 1] });
    assert.equal(validity(state), true);
    assert.equal(state.offer, null);
  });
  test(`seat ${team} resignation records the conceding seat even with an offline opponent`, () => {
    const state = freshVoluntaryEndings();
    assert.equal(decideVoluntaryEnding(state, command(state, 'resign'), { ...context(team), bothHumans: false }).accepted, true);
    assert.deepEqual(state.result, { winner: 1 - team, reason: 'resignation', resignedTeam: team });
    assert.equal(validity(state), true);
    assert.equal(validity(state, { winner: team }), false);
    assert.equal(validity(state, { pve: true }), false);
    const committed = structuredClone(state);
    assert.equal(decideVoluntaryEnding(state, command(state, 'resign'), context(1 - team)).accepted, false);
    assert.deepEqual(state, committed, 'a committed result cannot be overwritten even by a new revision');
  });
}
for (const change of [{ humanSeat: false }, { team: null }, { practice: true }, { pve: true }, { started: false }, { winner: 0 }, { winner: 2 }]) {
  test(`unsupported seat/state ${JSON.stringify(change)} cannot mutate a match`, () => {
    const state = freshVoluntaryEndings(), before = structuredClone(state);
    assert.equal(decideVoluntaryEnding(state, command(state, 'resign'), { ...context(0), ...change }).accepted, false);
    assert.deepEqual(state, before);
    assert.equal(voluntaryCapability(state, { ...context(0), ...change }).canResign, false);
  });
}
test('withdrawal, decline and disconnect cancel consent and invalidate previous offer identities', () => {
  const state = freshVoluntaryEndings();
  for (const action of ['withdraw', 'decline', 'disconnect']) {
    decideVoluntaryEnding(state, command(state, 'offer'), context(0));
    const accept = command(state, 'accept', { offerId: state.offer.id });
    const before = structuredClone(state);
    const wrong = action === 'withdraw' ? 1 : 0;
    if (action !== 'disconnect') {
      assert.equal(decideVoluntaryEnding(state, command(state, action, { offerId: state.offer.id }), context(wrong)).accepted, false);
      assert.deepEqual(state, before);
      assert.equal(decideVoluntaryEnding(state, command(state, action, { offerId: state.offer.id }), context(1 - wrong)).accepted, true);
    } else assert.equal(cancelVoluntaryOffer(state), true);
    assert.equal(decideVoluntaryEnding(state, accept, context(1)).accepted, false);
    assert.equal(state.result, null);
    assert.equal(state.offer, null);
  }
});
test('pending offer is not saved as consent and cold recovery retains monotonic revision', () => {
  const state = freshVoluntaryEndings();
  decideVoluntaryEnding(state, command(state, 'offer'), context(0));
  const saved = savedVoluntaryEndings(state);
  assert.deepEqual(saved, { version: 1, generation: 1, revision: 1, result: null });
  assert.equal(validity(state), true);
  const recovered = { ...saved, offer: null };
  assert.equal(decideVoluntaryEnding(recovered, command(recovered, 'accept', { offerId: 1 }), context(1)).accepted, false);
  decideVoluntaryEnding(recovered, command(recovered, 'offer'), context(0));
  assert.equal(recovered.offer.id, 2);
});
test('terminal proof rejects wrong mode/clock/seat/reason and invented agreement', () => {
  const state = freshVoluntaryEndings();
  decideVoluntaryEnding(state, command(state, 'offer'), context(0));
  decideVoluntaryEnding(state, command(state, 'accept', { offerId: state.offer.id }), context(1));
  for (const more of [{ reason: null }, { winner: 0 }, { started: false }, { practice: true }, { triggerId: 'objective' }]) assert.equal(validity(state, more), false);
  for (const teams of [[0], [1, 1], [0, 1, 1]]) {
    const saved = savedVoluntaryEndings(state); saved.result.agreedTeams = teams;
    assert.equal(validSavedVoluntaryEndings(saved, { winner: 2, reason: 'agreed-draw', triggerId: null, started: true }), false);
  }
});
test('legacy migration retains every previous rule/result and refuses claimed new endings', () => {
  const old = { schemaVersion: 29, state: { matchWinner: 1, matchWinnerReason: 'timed-control', matchElapsedSeconds: 900 } };
  const state = structuredClone(old.state);
  assert.equal(migrateVoluntaryEndingCheckpoint(old), true);
  assert.deepEqual(old, { schemaVersion: 30, state: { ...state, voluntaryEndings: { version: 0, generation: 1, revision: 0, result: null } } });
  assert.equal(migrateVoluntaryEndingCheckpoint(old), false);
  assert.equal(voluntaryCapability({ ...old.state.voluntaryEndings, offer: null }, context(0)).canResign, false);
  for (const bad of [{ schemaVersion: 28, state }, { schemaVersion: 31, state },
    { schemaVersion: 29, state: { ...state, voluntaryEndings: null } },
    { schemaVersion: 29, state: { ...state, matchWinnerReason: 'resignation' } }]) {
    const before = structuredClone(bad);
    assert.equal(migrateVoluntaryEndingCheckpoint(bad), false);
    assert.deepEqual(bad, before);
  }
});

// Core at main ca382bfafa5ec19add89c08f6286d46036ba0b99, before the contract slice.
// Keep this reference independent of the annotated production implementation.
const previousCoreSource = String.raw`
// Separate from every mode's automatic victory policy. No timers or AI consent.
export const VOLUNTARY_ENDING_VERSION = 1;
export const VOLUNTARY_REASONS = ['resignation', 'agreed-draw'];
export function freshVoluntaryEndings(version = VOLUNTARY_ENDING_VERSION, generation = 1) {
  return { version, generation, revision: 0, offer: null, result: null };
}

export function voluntaryCapability(state, { team, humanSeat, practice, pve, started, winner, bothHumans }) {
  let message = '';
  if (state.version !== 1) message = 'Unavailable in this recovered legacy match; reset to start a new match.';
  else if (!humanSeat || ![0, 1].includes(team)) message = 'Only a current player seat can decide a match.';
  else if (practice || pve) message = 'Voluntary endings are available in human PvP matches only.';
  else if (winner >= 0 || state.result) message = 'This match has already ended.';
  else if (!started) message = 'Start the match before using voluntary endings.';
  return { version: state.version, generation: state.generation, revision: state.revision,
    canResign: !message, canOfferDraw: !message && bothHumans,
    message: message || (bothHumans ? 'Resign concedes the match. A draw requires both players to agree.'
      : 'You may resign. Draw agreement requires both human players to be connected.'),
    offer: winner < 0 && bothHumans && state.offer ? { ...state.offer } : null };
}

// Optimistic revision makes every accepted decision single-use, including an
// offer repeated after withdrawal. Network identity and seat ownership are
// checked by the composition root before this synchronous transition.
export function decideVoluntaryEnding(state, command, context) {
  const capability = voluntaryCapability(state, context);
  const reject = message => ({ accepted: false, message });
  if (!capability.canResign) return reject(capability.message);
  if (command.version !== 1 || command.generation !== state.generation || command.revision !== state.revision) return reject('Match decision is stale; use the current match actions.');
  const team = context.team;
  let message;
  if (command.action === 'resign') {
    state.result = { winner: 1 - team, reason: 'resignation', resignedTeam: team };
    message = 'Resignation accepted.';
  } else {
    if (!context.bothHumans) return reject('Draw agreement requires both human players to be connected.');
    if (command.action === 'offer') {
      if (state.offer) return reject('A draw offer is already pending.');
      state.offer = { id: state.revision + 1, team };
      message = 'Draw offered; waiting for the other player to agree.';
    } else {
      if (!state.offer || command.offerId !== state.offer.id) return reject('That draw offer is no longer pending.');
      if (command.action === 'withdraw') {
        if (state.offer.team !== team) return reject('Only the proposing player can withdraw this offer.');
        message = 'Draw offer withdrawn.';
      } else if (['accept', 'decline'].includes(command.action)) {
        if (state.offer.team === team) return reject('The other player must answer your draw offer.');
        if (command.action === 'accept') state.result = { winner: 2, reason: 'agreed-draw', agreedTeams: [0, 1] };
        message = command.action === 'accept' ? 'Both players agreed to a draw.' : 'Draw offer declined.';
      } else return reject('Unknown match decision.');
      state.offer = null;
    }
  }
  state.revision++;
  if (state.result) state.offer = null;
  return { accepted: true, message, result: state.result };
}

export function cancelVoluntaryOffer(state) {
  if (!state.offer) return false;
  state.offer = null;
  state.revision++;
  return true;
}

// Pending offers intentionally are not durable consent. Version and revision
// persist; a cold restore cancels the offer and never replays a decision.
export function savedVoluntaryEndings(state) {
  return { version: state.version, generation: state.generation, revision: state.revision, result: state.result && structuredClone(state.result) };
}
`;

function decisionContractDiagnostics(source, transform = value => value) {
  const root = new URL('../', import.meta.url);
  const configPath = fileURLToPath(new URL('tsconfig.check-node.json', root));
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, fileURLToPath(root));
  assert.deepEqual(parsed.errors, []);
  const modulePath = fileURLToPath(new URL('src/server/voluntary-endings.mjs', root));
  const moduleSource = ts.createSourceFile(modulePath, readFileSync(modulePath, 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const names = ['freshVoluntaryEndings', 'voluntaryCapability', 'decideVoluntaryEnding',
    'cancelVoluntaryOffer', 'savedVoluntaryEndings'];
  const functions = moduleSource.statements.filter(statement =>
    ts.isFunctionDeclaration(statement) && names.includes(statement.name?.text));
  assert.deepEqual(functions.map(statement => statement.name.text), names);
  const constants = moduleSource.statements.filter(ts.isVariableStatement);
  assert.deepEqual(constants.flatMap(statement => statement.declarationList.declarations.map(declaration => declaration.name.getText(moduleSource))),
    ['VOLUNTARY_ENDING_VERSION', 'VOLUNTARY_REASONS']);
  // Check actual complete core declarations, with their JSDoc and constants.
  // Raw checkpoint validation/migration are unselected, as in the pregame boundary.
  // A new core dependency must be included here or fails as an unknown name.
  const boundary = [...constants, ...functions].map(statement => statement.getFullText(moduleSource)).join('\n');
  const fixturePath = fileURLToPath(new URL('scripts/type-contracts/voluntary-ending-consumer.mjs', root));
  const host = ts.createCompilerHost(parsed.options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, languageVersion, ...args) => {
    const contents = fileName === modulePath ? transform(boundary) : fileName === fixturePath ? source : null;
    return contents === null ? getSourceFile(fileName, languageVersion, ...args)
      : ts.createSourceFile(fileName, contents, languageVersion, true, ts.ScriptKind.JS);
  };
  return { fixturePath, diagnostics: ts.getPreEmitDiagnostics(ts.createProgram([fixturePath], parsed.options, host)) };
}

const checkedDecisionConsumer = `
import { freshVoluntaryEndings, voluntaryCapability, decideVoluntaryEnding, savedVoluntaryEndings } from '../../src/server/voluntary-endings.mjs';
const state = freshVoluntaryEndings();
const command = {version:1,generation:1,revision:0,action:'offer'};
const context = {team:0,humanSeat:true,started:true,winner:-1,bothHumans:true};
const decision = decideVoluntaryEnding(state,command,context);
if (decision.accepted && decision.result) { decision.result.winner.toFixed(0); decision.result.reason.toUpperCase(); }
voluntaryCapability(state,{...context,team:null});
decideVoluntaryEnding(state,{version:null,generation:'bad',revision:{},action:Symbol('bad'),offerId:false},context);
`;

test('actual decision core accepts guarded result reads, nullable spectators and unknown command fields', () => {
  assert.deepEqual(decisionContractDiagnostics(checkedDecisionConsumer).diagnostics, []);
});

test('actual host context, stale feedback and accepted-result read guard compile with the decision contract', () => {
  const source = ts.createSourceFile('server.mjs', readFileSync(new URL('../server.mjs', import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const find = name => source.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name);
  const context = find('voluntaryContext'), handler = find('handleMatchDecision');
  assert.ok(context && handler);
  const [feedback, stale, accepted] = handler.body.statements;
  assert.ok(ts.isVariableStatement(feedback) && ts.isIfStatement(stale) && ts.isIfStatement(accepted));
  const result = accepted.thenStatement.statements[0];
  assert.ok(ts.isIfStatement(result));
  // Only fixture bindings and feedback receive types; host declarations and
  // transition calls/result reads below are copied from actual source unchanged.
  const consumer = `
import {freshVoluntaryEndings,decideVoluntaryEnding} from '../../src/server/voluntary-endings.mjs';
/** @typedef {{team:number|null,closed:boolean,socket:{destroyed:boolean},session?:{peer:Player}|null}} Player */
/** @type {Set<Player>} */ const peers=new Set();
/** @param {number|null} team @returns {boolean} */ function currentHumanSeat(team){return false;}
const soloPractice=false,pveLaunchOptions=null,scenarioClockStarted=true,pregame={phase:'lobby'};
let matchWinner=-1;
/** @type {string|null} */ let matchWinnerReason=null;
/** @type {string|null} */ let matchWinnerTriggerId=null;
const matchId='match',SERVER_INSTANCE_ID='instance',voluntaryEndings=freshVoluntaryEndings();
/** @param {string} reason */ function cancelMovePlanningJobs(reason){}
/** @param {{type:'victory',team:number,reason:string,triggerId:null}} message */ function broadcast(message){}
/** @param {number|null} team @param {Player|null} player */
${context.getText(source)}
/** @param {import('../../src/server/voluntary-endings.mjs').EndingCommand & {matchId?:unknown,serverInstanceId?:unknown}} command @param {Player} player */
function consume(command,player){
/** @type {import('../../src/server/voluntary-endings.mjs').EndingDecision} */
${feedback.getText(source)}
${stale.getText(source)}
if(feedback.accepted){${result.getText(source)}}
}`;
  assert.deepEqual(decisionContractDiagnostics(consumer).diagnostics, []);
});

test('decision callers reject invalid state/flags and unguarded or malformed accepted results', () => {
  const cases = [
    {code:2322,source:"decideVoluntaryEnding({...state,revision:'0'},command,context);"},
    {code:2322,source:"decideVoluntaryEnding(state,command,{...context,bothHumans:'false'});"},
    {code:2339,source:'decision.result;'},
    {code:18047,source:'if(decision.accepted) decision.result.winner;'},
    {code:2339,source:'if(decision.accepted && decision.result) decision.result.winner.toUpperCase();'},
    {code:2339,source:'savedVoluntaryEndings(state).revision.toUpperCase();'},
    {code:2322,source:"/** @type {import('../../src/server/voluntary-endings.mjs').EndingDecision} */ const bad={accepted:'true',message:'bad',result:null};"},
    {code:2322,source:"/** @type {import('../../src/server/voluntary-endings.mjs').EndingDecision} */ const missing={accepted:true,message:'bad'};"},
  ];
  const source = checkedDecisionConsumer + cases.map(entry => entry.source).join('\n');
  const firstLine = checkedDecisionConsumer.split('\n').length - 1;
  const {fixturePath, diagnostics} = decisionContractDiagnostics(source);
  assert.equal(diagnostics.length, cases.length);
  assert.ok(diagnostics.every(diagnostic => diagnostic.file?.fileName === fixturePath));
  for (const [index, entry] of cases.entries()) {
    const onLine = diagnostics.filter(diagnostic => diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line === firstLine + index);
    assert.deepEqual(onLine.map(diagnostic => diagnostic.code), [entry.code], entry.source);
  }
});

test('comparison-list initializers reject seat and response-action drift without casting unknown inputs', () => {
  for (const [before, after] of [['*/ ([0, 1]);','*/ ([0, 2]);'],
    ["*/ (['accept', 'decline']);","*/ (['accept', 'reject']);"]]) {
    const {fixturePath, diagnostics} = decisionContractDiagnostics(checkedDecisionConsumer, source => {
      assert.equal(source.split(before).length - 1, 1);
      return source.replace(before, after);
    });
    assert.equal(diagnostics.length, 1);
    assert.notEqual(diagnostics[0].file.fileName, fixturePath);
    assert.equal(diagnostics[0].code, 2322);
  }
});

const previousCore = await import(`data:text/javascript;base64,${Buffer.from(previousCoreSource).toString('base64')}`);

function decisionOutcome(core, saved, context, command) {
  const state = structuredClone(saved);
  try { return {kind:'returned',value:core.decideVoluntaryEnding(state,command,context),state}; }
  catch (error) { return {kind:'threw',name:error.name,message:error.message,state}; }
}

test('decision/capability/save/cancel retain pre-contract behavior across malformed inputs', () => {
  const teams = [0,1,-0,-1,2,null,undefined,NaN,'0',false,{},Symbol('bad'),1n];
  const contexts = teams.flatMap(team => [true,false].map(bothHumans => ({...context(team),bothHumans})));
  for (const more of [{humanSeat:false},{started:false},{winner:0},{winner:2},{practice:true},{pve:true}]) {
    contexts.push({...context(0),...more});
  }
  const states = [previousCore.freshVoluntaryEndings(),previousCore.freshVoluntaryEndings(0),
    {...previousCore.freshVoluntaryEndings(),offer:{id:1,team:0}},
    {...previousCore.freshVoluntaryEndings(),offer:{id:1,team:1}},
    {...previousCore.freshVoluntaryEndings(),result:{winner:1,reason:'resignation',resignedTeam:0}},
    {...previousCore.freshVoluntaryEndings(),revision:'0'},
    {...previousCore.freshVoluntaryEndings(),generation:'1'}];
  const actions = ['resign','offer','accept','decline','withdraw','unknown',null,undefined,0,false,{},[],Symbol('unknown'),1n];
  let comparisons = 0;
  const equal = (actual, expected) => { comparisons++; assert.deepEqual(actual,expected); };
  for (const state of states) for (const ctx of contexts) for (const action of actions) for (const offerId of [undefined,1,99]) {
    const cmd = {version:1,generation:state.generation,revision:state.revision,action,offerId};
    equal(decisionOutcome(currentCore,state,ctx,cmd),decisionOutcome(previousCore,state,ctx,cmd));
  }
  for (const state of states) for (const ctx of contexts) for (const cmd of [null,undefined,false,0,'offer',[],{},
    {version:'1'},{version:1,generation:0,revision:0,action:'resign'}]) {
    equal(decisionOutcome(currentCore,state,ctx,cmd),decisionOutcome(previousCore,state,ctx,cmd));
  }
  for (const state of states) for (const ctx of contexts) equal(currentCore.voluntaryCapability(state,ctx),previousCore.voluntaryCapability(state,ctx));
  for (const state of states) {
    equal(currentCore.savedVoluntaryEndings(state),previousCore.savedVoluntaryEndings(state));
    const actual = structuredClone(state), expected = structuredClone(state);
    equal(currentCore.cancelVoluntaryOffer(actual),previousCore.cancelVoluntaryOffer(expected));
    equal(actual,expected);
  }
  assert.equal(comparisons,11669);
});

test('changing command and nullable team getters retain every pre-contract read and outcome', () => {
  let cases = 0;
  for (const actions of [['not-resign','not-offer','not-withdraw','unknown','decline','accept','accept'],
    ['resign'],['offer','offer'],['accept','accept','accept','accept'],['withdraw','decline','accept','decline'],
    ['unknown','accept','decline','resign'],[undefined,'accept','decline'],[Symbol('bad'),'accept']]) {
    for (const teams of [[0],[1],[null],[0,null],[0,undefined],[0,2],[0,1n]]) {
      function run(core) {
        const trace = []; let actionReads = 0, teamReads = 0;
        const state = core.freshVoluntaryEndings(); state.offer = {id:1,team:1};
        const cmd = {version:1,generation:1,revision:0,offerId:1,get action() {
          const index = actionReads++; trace.push(`action:${index}`); return actions[Math.min(index,actions.length-1)];
        }};
        const ctx = {...context(0),get team() {
          const index = teamReads++; trace.push(`team:${index}`); return teams[Math.min(index,teams.length-1)];
        }};
        let outcome;
        try { outcome = {kind:'returned',value:core.decideVoluntaryEnding(state,cmd,ctx)}; }
        catch (error) { outcome = {kind:'threw',name:error.name,message:error.message}; }
        return {outcome,state,trace,actionReads,teamReads};
      }
      assert.deepEqual(run(currentCore),run(previousCore)); cases++;
    }
  }
  assert.equal(cases,56);
});

test('accepted result keeps state identity and wire key order; rejection has no result', () => {
  const state = freshVoluntaryEndings();
  const accepted = decideVoluntaryEnding(state,command(state,'resign'),context(0));
  assert.equal(accepted.result,state.result);
  assert.deepEqual(Object.keys(accepted),['accepted','message','result']);
  assert.deepEqual(Object.keys(decideVoluntaryEnding(freshVoluntaryEndings(),{},{...context(0),team:null})),['accepted','message']);
});

// Characterization of the raw checkpoint validator, not additional type enrollment.
// These cases preserve today's boundary for a later deliberate contract decision.
const savedContext = { winner: -1, reason: null, triggerId: null, started: true };
const resignationContext = { ...savedContext, winner: 1, reason: 'resignation' };
const drawContext = { ...savedContext, winner: 2, reason: 'agreed-draw' };
const savedHeader = () => ({ version: 1, generation: 1, revision: 0, result: null });

test('actual checkpoint assertion consumes unknown JSON values without modifying them', () => {
  const source = ts.createSourceFile('server.mjs', readFileSync(new URL('../server.mjs', import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const find = name => source.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name);
  const assertion = find('assertSnapshot'), checkpoint = find('validateMatchCheckpoint');
  assert.ok(assertion && checkpoint);
  const calls = checkpoint.body.statements.filter(statement => ts.isExpressionStatement(statement)
    && ts.isCallExpression(statement.expression) && statement.expression.expression.getText(source) === 'assertSnapshot'
    && statement.expression.arguments[0]?.getText(source).startsWith('validSavedVoluntaryEndings('));
  assert.equal(calls.length, 1);
  // Evaluate the actual assertion and call unchanged, with fixture-owned state
  // and launch bindings. This does not claim whole-checkpoint/host validation.
  const consume = new Function('validSavedVoluntaryEndings', `${assertion.getText(source)}
    return (state, soloPractice = false, pveLaunchOptions = null) => { ${calls[0].getText(source)} };`)(validSavedVoluntaryEndings);
  const cases = [
    [savedHeader(), savedContext, true], [{ ...savedHeader(), version: 0 }, savedContext, true],
    [{ ...savedHeader(), revision: 1, result: { winner: 1, reason: 'resignation', resignedTeam: 0 } }, resignationContext, true],
    [{ ...savedHeader(), revision: 1, result: { winner: 2, reason: 'agreed-draw', agreedTeams: [0, 1] } }, drawContext, true],
    [null, savedContext, false], [false, savedContext, false], [0, savedContext, false], ['saved', savedContext, false],
    [[], savedContext, false], [{ ...savedHeader(), revision: '0' }, savedContext, false],
    [{ ...savedHeader(), generation: 0 }, savedContext, false], [{ ...savedHeader(), extra: true }, savedContext, false],
    [{ ...savedHeader(), result: {} }, savedContext, false],
  ];
  for (const [value, context, accepted] of cases) {
    /** @type {unknown} */ const input = JSON.parse(JSON.stringify(value));
    const before = structuredClone(input);
    const state = { voluntaryEndings: input, matchWinner: context.winner, matchWinnerReason: context.reason,
      matchWinnerTriggerId: context.triggerId, scenarioClockStarted: context.started };
    assert.equal(validSavedVoluntaryEndings(input, context), accepted);
    if (accepted) assert.doesNotThrow(() => consume(state));
    else assert.throws(() => consume(state), { name: 'Error', message: 'Invalid match checkpoint: invalid voluntary match ending' });
    assert.deepEqual(input, before);
  }
});

function withSavedPrototypeFields(prototype, run) {
  const fields = savedHeader();
  const before = Object.fromEntries(Object.keys(fields).map(key => [key, Object.getOwnPropertyDescriptor(prototype, key)]));
  try {
    for (const [key, value] of Object.entries(fields)) Object.defineProperty(prototype, key, { value, writable: true, configurable: true });
    const installed = Object.fromEntries(Object.keys(fields).map(key => [key, Object.getOwnPropertyDescriptor(prototype, key)]));
    run();
    for (const [key, descriptor] of Object.entries(installed)) assert.deepEqual(Object.getOwnPropertyDescriptor(prototype, key), descriptor);
  } finally {
    for (const [key, descriptor] of Object.entries(before)) {
      if (descriptor) Object.defineProperty(prototype, key, descriptor);
      else delete prototype[key];
    }
    for (const [key, descriptor] of Object.entries(before)) assert.deepEqual(Object.getOwnPropertyDescriptor(prototype, key), descriptor);
  }
}
for (const [name, prototype, value] of [['number', Number.prototype, 1], ['boolean', Boolean.prototype, true],
  ['BigInt', BigInt.prototype, 1n], ['Symbol', Symbol.prototype, Symbol('saved')]]) {
  test(`raw saved ${name} retains native inherited-property lookup`, () => {
    withSavedPrototypeFields(prototype, () => assert.equal(validSavedVoluntaryEndings(value, savedContext), true));
  });
}
test('primitive saved version getter exceptions propagate unchanged', () => {
  const before = Object.getOwnPropertyDescriptor(String.prototype, 'version');
  const error = new Error('primitive version getter');
  try {
    Object.defineProperty(String.prototype, 'version', { get() { throw error; }, configurable: true });
    assert.throws(() => validSavedVoluntaryEndings('saved', savedContext), caught => caught === error);
  } finally {
    if (before) Object.defineProperty(String.prototype, 'version', before);
    else delete String.prototype.version;
    assert.deepEqual(Object.getOwnPropertyDescriptor(String.prototype, 'version'), before);
  }
});

for (const [name, second, accepted] of [['negative', -1, false], ['text', '1', true], ['undefined', undefined, true],
  ['BigInt', 0n, true], ['Symbol', Symbol('revision'), null]]) {
  test(`saved revision reread preserves ${name} comparison behavior`, () => {
    const trace = []; let reads = 0;
    const saved = { ...savedHeader(), get revision() { trace.push(`revision:${reads}`); return reads++ === 0 ? 1 : second; } };
    const before = Object.getOwnPropertyDescriptors(saved);
    if (accepted === null) assert.throws(() => validSavedVoluntaryEndings(saved, savedContext),
      { name: 'TypeError', message: 'Cannot convert a Symbol value to a number' });
    else assert.equal(validSavedVoluntaryEndings(saved, savedContext), accepted);
    assert.deepEqual(trace, ['revision:0', 'revision:1']);
    assert.deepEqual(Object.getOwnPropertyDescriptors(saved), before);
  });
}
test('saved generation also compares its second getter value', () => {
  let reads = 0;
  const saved = { ...savedHeader(), get generation() { return reads++ === 0 ? 1 : 0; } };
  assert.equal(validSavedVoluntaryEndings(saved, savedContext), false);
  assert.equal(reads, 2);
});

test('native integer method lookup precedes each saved getter argument', () => {
  const before = Object.getOwnPropertyDescriptor(Number, 'isSafeInteger'), trace = [];
  let revisionReads = 0, generationReads = 0, accepted;
  const saved = { ...savedHeader(), get revision() { trace.push(`revision:${revisionReads++}`); return 1; },
    get generation() { trace.push(`generation:${generationReads++}`); return 1; } };
  try {
    Object.defineProperty(Number, 'isSafeInteger', { configurable: true, get() {
      trace.push('integer:lookup');
      return value => { trace.push(`integer:call:${value}`); return before.value(value); };
    } });
    accepted = validSavedVoluntaryEndings(saved, savedContext);
  } finally {
    Object.defineProperty(Number, 'isSafeInteger', before);
  }
  assert.equal(accepted, true);
  assert.deepEqual(trace, ['integer:lookup', 'revision:0', 'integer:call:1', 'revision:1',
    'integer:lookup', 'generation:0', 'integer:call:1', 'generation:1']);
  assert.deepEqual(Object.getOwnPropertyDescriptor(Number, 'isSafeInteger'), before);
});

test('saved validation reads native proxy properties without a has trap or input writes', () => {
  const trace = [], target = savedHeader(), before = structuredClone(target);
  const saved = new Proxy(target, {
    has() { throw new Error('no existence query'); },
    get(target, key, receiver) { trace.push(`get:${String(key)}`); return Reflect.get(target, key, receiver); },
    ownKeys(target) { trace.push('ownKeys'); return Reflect.ownKeys(target); },
    getOwnPropertyDescriptor(target, key) { trace.push(`descriptor:${String(key)}`); return Reflect.getOwnPropertyDescriptor(target, key); },
  });
  assert.equal(validSavedVoluntaryEndings(saved, savedContext), true);
  assert.deepEqual(trace, ['get:version', 'get:revision', 'get:revision', 'get:generation', 'get:generation', 'ownKeys',
    'descriptor:version', 'descriptor:generation', 'descriptor:revision', 'descriptor:result', 'get:result']);
  assert.deepEqual(target, before);
});

test('function, decorated array, inherited and null-prototype saved carriers remain accepted', () => {
  for (const saved of [Object.assign(function () {}, savedHeader()), Object.assign([], savedHeader()),
    Object.create(savedHeader()), Object.assign(Object.create(null), savedHeader())]) {
    const before = Object.getOwnPropertyDescriptors(saved), prototype = Object.getPrototypeOf(saved);
    assert.equal(validSavedVoluntaryEndings(saved, savedContext), true);
    assert.deepEqual(Object.getOwnPropertyDescriptors(saved), before);
    assert.equal(Object.getPrototypeOf(saved), prototype);
  }
});

test('terminal validator preserves all context, header and result read positions', () => {
  const trace = [], result = { winner: 1, reason: 'resignation', resignedTeam: 0 };
  const observe = (target, prefix) => new Proxy(target, {
    get(target, key, receiver) { trace.push(`${prefix}.${String(key)}`); return Reflect.get(target, key, receiver); },
    ownKeys(target) { trace.push(`${prefix}.keys`); return Reflect.ownKeys(target); },
    getOwnPropertyDescriptor(target, key) { trace.push(`${prefix}.descriptor.${String(key)}`); return Reflect.getOwnPropertyDescriptor(target, key); },
  });
  const target = { ...savedHeader(), revision: 1, result: observe(result, 'result') };
  const before = Object.getOwnPropertyDescriptors(target), resultBefore = Object.getOwnPropertyDescriptors(result),
    contextBefore = Object.getOwnPropertyDescriptors(resignationContext);
  assert.equal(validSavedVoluntaryEndings(observe(target, 'saved'), observe(resignationContext, 'context')), true);
  assert.deepEqual(trace, ['context.winner', 'context.reason', 'context.triggerId', 'context.started', 'context.practice', 'context.pve',
    'saved.version', 'saved.revision', 'saved.revision', 'saved.generation', 'saved.generation', 'saved.keys',
    'saved.descriptor.version', 'saved.descriptor.generation', 'saved.descriptor.revision', 'saved.descriptor.result',
    'saved.version', 'saved.revision', 'saved.result', 'result.reason', 'result.winner', 'result.resignedTeam', 'result.resignedTeam',
    'result.keys', 'result.descriptor.winner', 'result.descriptor.reason', 'result.descriptor.resignedTeam']);
  assert.deepEqual(Object.getOwnPropertyDescriptors(target), before);
  assert.deepEqual(Object.getOwnPropertyDescriptors(result), resultBefore);
  assert.deepEqual(Object.getOwnPropertyDescriptors(resignationContext), contextBefore);
});

test('terminal version rejection precedes result getter access', () => {
  let reads = 0;
  const saved = { ...savedHeader(), revision: 1, get version() { return reads++ === 0 ? 1 : 0; },
    get result() { throw new Error('result must remain unread'); } };
  assert.equal(validSavedVoluntaryEndings(saved, resignationContext), false);
  assert.equal(reads, 2);
});
for (const [name, second, accepted] of [['text', '0', true], ['BigInt', 0n, false]]) {
  test(`resignation actor reread retains native ${name} subtraction`, () => {
    let reads = 0;
    const result = { winner: 1, reason: 'resignation', get resignedTeam() { return reads++ === 0 ? 0 : second; } };
    const before = Object.getOwnPropertyDescriptors(result), saved = { ...savedHeader(), revision: 1, result };
    if (accepted) assert.equal(validSavedVoluntaryEndings(saved, resignationContext), true);
    else assert.throws(() => validSavedVoluntaryEndings(saved, resignationContext),
      { name: 'TypeError', message: 'Cannot mix BigInt and other types, use explicit conversions' });
    assert.equal(reads, 2);
    assert.deepEqual(Object.getOwnPropertyDescriptors(result), before);
  });
}

test('draw proof preserves toJSON invocation, native serialization errors and input descriptors', () => {
  const trace = [], teams = { get toJSON() { trace.push('get:toJSON'); return function (key) {
    assert.equal(this, teams); trace.push(`call:toJSON:${key}`); return [0, 1];
  }; } };
  const before = Object.getOwnPropertyDescriptors(teams);
  const saved = { ...savedHeader(), revision: 1, result: { winner: 2, reason: 'agreed-draw', agreedTeams: teams } };
  const savedBefore = Object.getOwnPropertyDescriptors(saved), resultBefore = Object.getOwnPropertyDescriptors(saved.result);
  assert.equal(validSavedVoluntaryEndings(saved, drawContext), true);
  assert.deepEqual(trace, ['get:toJSON', 'call:toJSON:']);
  assert.deepEqual(Object.getOwnPropertyDescriptors(teams), before);
  assert.deepEqual(Object.getOwnPropertyDescriptors(saved), savedBefore);
  assert.deepEqual(Object.getOwnPropertyDescriptors(saved.result), resultBefore);
  saved.result.agreedTeams = 1n;
  assert.throws(() => validSavedVoluntaryEndings(saved, drawContext), { name: 'TypeError', message: 'Do not know how to serialize a BigInt' });
  const error = new Error('draw serialization getter');
  saved.result.agreedTeams = { get toJSON() { throw error; } };
  assert.throws(() => validSavedVoluntaryEndings(saved, drawContext), caught => caught === error);
});

test('context faults precede falsy-input rejection; header faults precede terminal policy checks', () => {
  const contextError = new Error('context first');
  assert.throws(() => validSavedVoluntaryEndings(null, { get winner() { throw contextError; } }), caught => caught === contextError);
  assert.equal(validSavedVoluntaryEndings({ version: 2, get revision() { throw new Error('revision must remain unread'); } }, savedContext), false);
  const keysError = new Error('saved own keys');
  const saved = new Proxy({ ...savedHeader(), revision: 1 }, { ownKeys() { throw keysError; } });
  assert.throws(() => validSavedVoluntaryEndings(saved, { ...resignationContext, started: false }), caught => caught === keysError);
});
