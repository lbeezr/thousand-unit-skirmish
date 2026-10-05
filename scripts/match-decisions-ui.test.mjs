import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import vm from 'node:vm';
import { createMatchDecisions } from '../src/client/hud/match-decisions.mjs';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const state = (more = {}) => ({ serverInstanceId: 'server-a', matchId: 'match-a', winner: -1,
  voluntaryEndings: { version: 1, generation: 1, revision: 0, canResign: true, canOfferDraw: true, message: 'Both players must agree.', offer: null }, ...more });
function fixture() {
  const dom = new JSDOM(html), sent = [];
  const document = dom.window.document;
  const view = createMatchDecisions(document, request => { sent.push(request); return true; });
  const click = action => document.querySelector(`[data-match-decision="${action}"]`).click();
  const confirm = () => document.querySelector('#match-decision-confirm').click();
  return { document, dom, sent, view, click, confirm };
}
for (const action of ['resign', 'offer', 'accept']) for (const team of [0, 1]) {
  test(`${action} requires explicit confirmation in seat ${team}; cancel keeps the match running`, t => {
    const f = fixture(); t.after(() => f.dom.window.close());
    const initial = state();
    if (action === 'accept') initial.voluntaryEndings.offer = { id: 1, team: 1 - team };
    f.view.update(initial, team);
    f.click(action); assert.equal(f.sent.length, 0);
    assert.equal(f.document.activeElement.id, 'match-decision-confirm');
    assert.equal(f.document.querySelector('#match-decision-confirmation').hidden, false);
    f.document.querySelector('#match-decision-cancel').click(); f.confirm(); assert.equal(f.sent.length, 0);
    f.click(action); f.confirm(); f.confirm();
    assert.equal(f.sent.length, 1);
    assert.deepEqual(f.sent[0], { type: 'matchDecision', version: 1, generation: 1, revision: 0,
      serverInstanceId: 'server-a', matchId: 'match-a', action, ...(action === 'accept' ? { offerId: 1 } : {}) });
    assert.equal(f.document.querySelector('[data-match-decision="resign"]').disabled, true);
    assert.match(f.document.querySelector('#match-decisions-status').textContent, /Waiting for server/);
  });
}
test('disconnect, rematch, server restart and changed offer invalidate an open confirmation', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  for (const change of ['disconnect', 'rematch', 'restart', 'offer']) {
    f.view.update(state(), 0); f.click('resign');
    if (change === 'disconnect') f.view.disconnect();
    else if (change === 'rematch') f.view.update(state({ matchId: 'match-b' }), 0);
    else if (change === 'restart') f.view.update(state({ serverInstanceId: 'server-b' }), 0);
    else { const next = state(); next.voluntaryEndings.revision = 1; f.view.update(next, 0); }
    f.confirm(); assert.equal(f.sent.length, 0);
    assert.equal(f.document.querySelector('#match-decision-confirmation').hidden, true);
  }
});
test('pending/rejected feedback is identity-correlated, reconnect never sends or agrees', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  f.view.update(state(), 0); f.click('offer'); f.confirm();
  f.view.feedback({ ...state({ matchId: 'old' }), requestGeneration: 1, requestRevision: 0, message: 'STALE' });
  assert.doesNotMatch(f.document.querySelector('#match-decisions-status').textContent, /STALE/);
  f.view.feedback({ ...state(), requestGeneration: 1, requestRevision: 0, message: 'Draw unavailable.' });
  assert.equal(f.document.querySelector('#match-decisions-status').textContent, 'Draw unavailable.');
  f.view.disconnect(); f.view.update(state(), 0);
  assert.equal(f.sent.length, 1);
  assert.equal(f.document.querySelector('[data-match-decision="resign"]').disabled, false);
});
test('proposer can withdraw; other seat can decline; spectators/unsupported states show explanation', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  const pending = state(); pending.voluntaryEndings.offer = { id: 7, team: 0 };
  f.view.update(pending, 0); f.click('accept'); assert.equal(f.sent.length, 0);
  f.click('withdraw'); assert.equal(f.sent[0].action, 'withdraw'); assert.equal(f.sent[0].offerId, 7);
  f.view.disconnect(); f.view.update(pending, 1); f.click('decline'); assert.equal(f.sent[1].action, 'decline');
  for (const message of ['Only a current player seat can decide a match.', 'Voluntary endings are available in human PvP matches only.', 'Unavailable in this recovered legacy match; reset to start a new match.']) {
    const unsupported = state(); Object.assign(unsupported.voluntaryEndings, { canResign: false, canOfferDraw: false, message });
    f.view.update(unsupported, null); f.click('resign'); f.confirm();
    assert.equal(f.sent.length, 2);
    assert.equal(f.document.querySelector('#match-decisions-status').textContent, message);
  }
});

test('real main capture Escape closes and cancels resignation/draw confirmation before reopening', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  const el = id => f.document.querySelector(id);
  const scope = vm.createContext({ window: f.dom.window, document: f.document, appShell: {},
    matchMenu: el('#match-menu'), matchMenuToggle: el('#match-menu-toggle'),
    helpPanel: el('#help-panel'), helpToggle: el('#help-toggle'), hudScrim: el('#hud-scrim'),
    scenarioBriefPanel: el('#scenario-brief-panel'), commandDock: el('#command-deck'),
    matchDecisions: f.view, clearHeldCameraKeys() {}, closeScenarioBrief() {}, closeDockDetails() {} });
  vm.runInContext(main.slice(main.indexOf('function closeHudPanels('), main.indexOf('\nfunction closeScenarioBrief(')), scope);
  const start = main.indexOf("window.addEventListener('keydown', (event) => {\n  if (document.fullscreenElement");
  assert.ok(start >= 0);
  vm.runInContext(main.slice(start, main.indexOf('\nconst AUDIO_CAPTIONS', start)), scope);
  for (const action of ['resign', 'accept']) {
    const initial = state(); if (action === 'accept') initial.voluntaryEndings.offer = { id: 1, team: 1 };
    f.view.update(initial, 0);
    for (const id of ['#help-panel', '#scenario-brief-panel', '#command-deck']) el(id).hidden = true;
    el('#match-menu').hidden = false;
    f.click(action);
    el('#match-decision-confirm').dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(el('#match-menu').hidden, true);
    assert.equal(f.document.activeElement.id, 'match-menu-toggle');
    el('#match-menu').hidden = false;
    assert.equal(el('#match-decision-confirmation').hidden, true);
    f.confirm(); assert.equal(f.sent.length, 0);
  }
});

test('spectator observing a public draw offer sees unavailable authority, with no reply actions', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  const watching = state(); Object.assign(watching.voluntaryEndings, {
    canResign: false, canOfferDraw: false, message: 'Only a current player seat can decide a match.', offer: { id: 1, team: 0 } });
  f.view.update(watching, null);
  assert.equal(f.document.querySelector('#match-decisions-status').textContent, watching.voluntaryEndings.message);
  for (const action of ['accept', 'decline', 'withdraw']) {
    assert.equal(f.document.querySelector(`[data-match-decision="${action}"]`).hidden, true);
    f.click(action);
  }
  f.confirm(); assert.equal(f.sent.length, 0);
});

test('same-identity rematch invalidates confirmation and old-generation feedback at revision zero', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  f.view.update(state(), 0); f.click('resign');
  const reset = state(); reset.voluntaryEndings.generation = 2;
  f.view.update(reset, 0); f.confirm(); assert.equal(f.sent.length, 0);
  f.click('offer'); f.confirm(); assert.equal(f.sent.length, 1);
  f.view.feedback({ ...state(), requestGeneration: 1, requestRevision: 0, message: 'OLD ACCEPTANCE' });
  assert.doesNotMatch(f.document.querySelector('#match-decisions-status').textContent, /OLD ACCEPTANCE/);
  assert.equal(f.document.querySelector('[data-match-decision="resign"]').disabled, true);
  f.view.feedback({ ...reset, requestGeneration: 2, requestRevision: 0, message: 'Current request rejected.' });
  assert.equal(f.document.querySelector('#match-decisions-status').textContent, 'Current request rejected.');
});
