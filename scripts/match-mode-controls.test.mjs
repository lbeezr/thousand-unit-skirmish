import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createMatchModeControls, matchModePresentation } from '../src/match-mode-controls.mjs';
import { matchModeCatalog } from '../src/match-modes.mjs';

const millrace = JSON.parse(readFileSync(new URL('../maps/bellweather-millrace.json', import.meta.url)));
const lab = JSON.parse(readFileSync(new URL('../maps/stone-defense-field.json', import.meta.url)));
const skirmish = { matchModeId: 'skirmish', matchModeVersion: 1 };
const objective = { matchModeId: 'objective-control', matchModeVersion: 1 };
function fixture(overrides = {}, sendResult = true) {
  const dom = new JSDOM('<section></section>', { url: 'http://game.test/' });
  const root = dom.window.document.querySelector('section'), sent = [];
  const controls = createMatchModeControls({ root, onChange: value => { sent.push(value); return sendResult; } });
  const state = { identity: {}, catalog: matchModeCatalog(millrace), map: millrace, opponentMode: 'pvp', online: true, editable: true, ...overrides };
  controls.update(state);
  return { dom, root, sent, controls, state, select: root.querySelector('select'), status: root.querySelector('[role=status]') };
}

test('host chooses a complete identity once and waits for authoritative mode acceptance', () => {
  const f = fixture();
  assert.deepEqual([...f.select.options].map(option => option.textContent), ['Authored Rules', 'Objective Control', 'Skirmish']);
  f.select.value = 'skirmish@1'; f.select.dispatchEvent(new f.dom.window.Event('change'));
  assert.deepEqual(f.sent, [skirmish]);
  assert.equal(f.select.disabled, true); assert.equal(f.select.value, 'authored@1', 'the UI does not apply unacknowledged rules');
  f.select.dispatchEvent(new f.dom.window.Event('change')); assert.equal(f.sent.length, 1);
  f.controls.update({ ...f.state, identity: skirmish });
  assert.equal(f.select.value, 'skirmish@1');
  assert.match(f.root.querySelector('.match-mode-summary').textContent, /Capture posts grant bonuses/);
  assert.match(f.root.querySelector('.match-mode-summary').textContent, /deadline does not win/);
  assert.match(f.root.querySelector('details p').textContent, /Town Center alone is not defeat/);
  assert.deepEqual([...f.select.options].map(option => option.value), ['objective-control@1', 'skirmish@1'], 'hidden authored is displayed only while active');
  f.dom.window.close();
});

test('AI never offers Skirmish even if an inconsistent catalog includes it', () => {
  const f = fixture({ opponentMode: 'pve' });
  assert.deepEqual([...f.select.options].map(option => option.value), ['authored@1', 'objective-control@1']);
  f.select.value = 'skirmish@1'; f.select.dispatchEvent(new f.dom.window.Event('change'));
  assert.deepEqual(f.sent, []);
  f.controls.update({ ...f.state, identity: skirmish });
  assert.equal(f.select.disabled, true); assert.match(f.status.textContent, /unavailable for Play vs AI/);
  assert.deepEqual(f.sent, []);
  f.dom.window.close();
});

test('runtime-withheld choices cannot be advertised from the local registry alone', () => {
  const f = fixture({ catalog: matchModeCatalog(millrace).map(value => ({ ...value, selectable: false })) });
  assert.deepEqual([...f.select.options].map(option => option.value), ['authored@1']);
  assert.equal(f.select.disabled, true); assert.deepEqual(f.sent, []);
  f.dom.window.close();
});

test('Lab and legacy rules remain honest and readonly without a runtime catalog', () => {
  const f = fixture({ map: lab, catalog: matchModeCatalog(lab) });
  assert.deepEqual([...f.select.options].map(option => option.value), ['authored@1']);
  assert.equal(f.select.disabled, true);
  assert.equal(f.controls.supported, true, 'a readonly authored Lab is still a supported match');
  assert.match(f.root.querySelector('details p').textContent, /Elimination/);
  const legacy = matchModePresentation({ map: millrace });
  assert.equal(legacy.active.id, 'authored'); assert.equal(legacy.editable, false);
  assert.match(legacy.rule, /900|15:00|decisive|current owner/);
  f.dom.window.close();
});

test('Objective Control explains the real authored hold and deadline without changing the map', () => {
  const before = JSON.stringify(millrace);
  const view = matchModePresentation({ identity: objective, catalog: matchModeCatalog(millrace), map: millrace });
  assert.equal(view.active.label, 'Objective Control');
  assert.match(view.rule, /ownership resets the hold/); assert.match(view.rule, /current owner/);
  assert.equal(JSON.stringify(millrace), before);
});

test('guests, reconnecting players and unsupported versions cannot send mode choices', () => {
  for (const overrides of [{ editable: false }, { online: false }, { pending: true },
    { identity: { matchModeId: 'skirmish', matchModeVersion: 2 } }]) {
    const f = fixture(overrides); assert.equal(f.select.disabled, true);
    assert.equal(f.controls.supported, !overrides.identity);
    f.select.value = 'objective-control@1'; f.select.dispatchEvent(new f.dom.window.Event('change'));
    assert.deepEqual(f.sent, []); f.dom.window.close();
  }
});

test('unrelated projections preserve option nodes and focus; failed sends do not apply rules', () => {
  const f = fixture({}, false);
  f.select.focus(); const first = f.select.options[0];
  f.controls.update({ ...f.state });
  assert.equal(f.select.options[0], first); assert.equal(f.dom.window.document.activeElement, f.select);
  f.select.value = 'objective-control@1'; f.select.dispatchEvent(new f.dom.window.Event('change'));
  assert.deepEqual(f.sent, [objective]); assert.equal(f.select.value, 'authored@1');
  assert.equal(f.select.disabled, false); assert.match(f.status.textContent, /not sent/);
  f.dom.window.close();
});
