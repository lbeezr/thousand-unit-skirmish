import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createMatchModeControls, matchModePresentation, fixedMatchArmySize } from '../src/match-mode-controls.mjs';
import { matchModeCatalog } from '../src/match-modes.mjs';

const millrace = JSON.parse(readFileSync(new URL('../maps/bellweather-millrace.json', import.meta.url)));
const lab = JSON.parse(readFileSync(new URL('../maps/stone-defense-field.json', import.meta.url)));
const skirmish = { matchModeId: 'skirmish', matchModeVersion: 1 };
const objective = { matchModeId: 'objective-control', matchModeVersion: 1 };

test('actual running host controls retain fixed Bannerfall size after identity and player updates, and ordinary host authority returns', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const hook = source.match(/function updateMatchArmySizeControls\(\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(hook);
  const dom = new JSDOM('<div class="size-options"><button data-count="250"></button><button data-count="1000"></button></div>');
  const buttons = [...dom.window.document.querySelectorAll('button')];
  const context = vm.createContext({ document: dom.window.document, fixedMatchArmySize,
    activeMatchMode: { matchModeId: 'bannerfall', matchModeVersion: 1 }, isHost: true, lobbyPhase: null,
    updateLobbyHostControls() { if (context.lobbyPhase === 'lobby') buttons.forEach(button => { button.disabled = true; }); } });
  vm.runInContext(hook, context); context.updateMatchArmySizeControls();
  assert.ok(buttons.every(button => button.disabled && /16 total units/.test(button.title)));
  context.activeMatchMode = { matchModeId: 'authored', matchModeVersion: 1 }; context.updateMatchArmySizeControls();
  assert.ok(buttons.every(button => !button.disabled));
  context.isHost = false; context.updateMatchArmySizeControls(); assert.ok(buttons.every(button => button.disabled));
  context.isHost = true; context.lobbyPhase = 'lobby'; context.updateMatchArmySizeControls();
  assert.ok(buttons.every(button => button.disabled), 'pregame army controls remain in the authoritative lobby');
  dom.window.close();
});
function disabledControlBlur(doc) {
  // JSDOM keeps disabled controls focused; model the native browser's BODY focus.
  doc.body.tabIndex = -1;
  doc.body.focus();
}
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
  f.controls.update({ ...f.state, pending: false });
  assert.equal(f.select.disabled, true, 'unrelated state cannot settle an in-flight request');
  assert.match(f.status.textContent, /Waiting for server/);
  f.select.dispatchEvent(new f.dom.window.Event('change')); assert.equal(f.sent.length, 1);
  f.controls.update({ ...f.state, identity: skirmish });
  assert.equal(f.select.value, 'skirmish@1');
  assert.match(f.root.querySelector('.match-mode-summary').textContent, /Capture posts grant bonuses/);
  assert.match(f.root.querySelector('.match-mode-summary').textContent, /deadline does not win/);
  assert.match(f.root.querySelector('details p').textContent, /Town Center alone is not defeat/);
  assert.deepEqual([...f.select.options].map(option => option.value), ['objective-control@1', 'skirmish@1'], 'hidden authored is displayed only while active');
  f.dom.window.close();
});

test('acknowledgement and explicit rejection recover focus after native disabled-control blur', () => {
  for (const accepted of [true, false]) {
    const f = fixture();
    f.select.focus(); f.select.value = 'skirmish@1';
    f.select.dispatchEvent(new f.dom.window.Event('change'));
    disabledControlBlur(f.dom.window.document);
    assert.equal(f.dom.window.document.activeElement, f.dom.window.document.body);
    f.controls.update({ ...f.state });
    assert.equal(f.select.disabled, true);
    assert.equal(f.dom.window.document.activeElement, f.dom.window.document.body);
    if (accepted) f.controls.update({ ...f.state, identity: skirmish });
    else f.controls.reject('Lobby changed. Review the settings.');
    assert.equal(f.select.disabled, false);
    assert.equal(f.dom.window.document.activeElement, f.select);
    assert.equal(f.select.value, accepted ? 'skirmish@1' : 'authored@1');
    assert.equal(f.status.textContent, accepted ? '' : 'Lobby changed. Review the settings.');
    f.dom.window.close();
  }
});

test('settling requests respects another control and closed or hidden panels', () => {
  for (const context of ['another-control', 'closed-dialog', 'hidden-panel', 'removed-panel']) {
    const f = fixture(), doc = f.dom.window.document;
    const dialog = doc.createElement('dialog'); dialog.open = true; doc.body.append(dialog); dialog.append(f.root);
    f.select.focus(); f.select.value = 'skirmish@1';
    f.select.dispatchEvent(new f.dom.window.Event('change')); disabledControlBlur(doc);
    const other = doc.createElement('button'); doc.body.append(other);
    if (context === 'another-control') other.focus();
    if (context === 'closed-dialog') dialog.open = false;
    if (context === 'hidden-panel') f.root.hidden = true;
    if (context === 'removed-panel') f.root.remove();
    f.controls.update({ ...f.state, identity: skirmish });
    assert.equal(doc.activeElement, context === 'another-control' ? other : doc.body);
    f.dom.window.close();
  }
});

test('disconnect and lost host authority cancel pending intent without retrying', () => {
  for (const lostContext of [{ online: false }, { editable: false }]) {
    const f = fixture();
    f.select.focus(); f.select.value = 'skirmish@1';
    f.select.dispatchEvent(new f.dom.window.Event('change')); disabledControlBlur(f.dom.window.document);
    f.controls.update({ ...f.state, ...lostContext });
    assert.equal(f.select.disabled, true);
    f.controls.update(f.state);
    assert.equal(f.select.disabled, false);
    assert.equal(f.dom.window.document.activeElement, f.dom.window.document.body);
    assert.deepEqual(f.sent, [skirmish], 'reconnection never resends a prior choice');
    f.dom.window.close();
  }
});

test('AI accepts only the verified Tiny Skirmish map even with an inconsistent supplied catalog', () => {
  const tiny = JSON.parse(readFileSync(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url)));
  const supported = fixture({ opponentMode: 'pve', map: tiny, identity: skirmish,
    catalog: matchModeCatalog(tiny, { mode: 'pve' }) });
  assert.equal(supported.controls.supported, true);
  assert.equal(supported.status.textContent, '');
  assert.deepEqual([...supported.select.options].map(option => option.value), ['skirmish@1']);
  supported.dom.window.close();
  for (const map of [millrace,
    JSON.parse(readFileSync(new URL('../maps/veyrholds-threefold-basin.json', import.meta.url)))]) {
    const f = fixture({ opponentMode: 'pve', map,
      catalog: matchModeCatalog(map).map(value => ({ ...value, pveSupported: true })) });
    assert.ok(![...f.select.options].some(option => option.value === 'skirmish@1'));
    f.select.value = 'skirmish@1'; f.select.dispatchEvent(new f.dom.window.Event('change'));
    assert.deepEqual(f.sent, []);
    f.controls.update({ ...f.state, identity: skirmish });
    assert.equal(f.select.disabled, true); assert.equal(f.controls.supported, false);
    assert.match(f.status.textContent, /unavailable for these settings/);
    assert.deepEqual(f.sent, []);
    f.dom.window.close();
  }
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
