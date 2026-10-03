import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { applyUnitStances, stanceSelection, STANCE_CHOICES, updateCombatStanceControls, bindCombatStanceControls } from '../src/combat-stance-ui.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function fixture(t, team = 0) {
  const dom = new JSDOM(html); t.after(() => dom.window.close());
  const root = dom.window.document, group = root.querySelector('[data-stance-controls]');
  root.querySelector('.contextual-command-bar').hidden = false;
  const units = [
    { id: 0, generation: 3, kind: 'infantry', team, hp: 100 },
    { id: 1, generation: 4, kind: 'archer', team, hp: 100 },
    { id: 2, generation: 5, kind: 'worker', team, hp: 100 },
    { id: 3, generation: 6, kind: 'infantry', team: 1 - team, hp: 100 },
    { id: 4, generation: 7, kind: 'skiff', team, hp: 120 },
  ];
  const context = { units, ids: [0], team, winner: -1, building: false, online: true }, sent = [];
  const unbind = bindCombatStanceControls(root, () => context, command => sent.push(command)); t.after(unbind);
  const update = rows => { applyUnitStances(units, rows, context.team, UNIT_DEFINITIONS); return updateCombatStanceControls(root, context); };
  return { dom, root, group, units, context, sent, update, unbind,
    button: id => group.querySelector(`[data-combat-stance="${id}"]`) };
}

for (const team of [0, 1]) test(`seat ${team}: normal authoritative stance is visible and sends generation-guarded military IDs only`, t => {
  const f = fixture(t, team); f.context.ids = [0, 1, 2, 3, 4];
  f.update([[0, 3, 'aggressive'], [1, 4, 'aggressive'], [2, 5, 'defensive'], [3, 6, 'noAttack'], [4, 7, 'standGround']]);
  assert.equal(f.group.hidden, false);
  assert.deepEqual(stanceSelection(f.context).selected.map(unit => unit.id), [0, 1]);
  assert.equal(f.button('aggressive').getAttribute('aria-pressed'), 'true');
  assert.equal(f.button('aggressive').querySelector('[data-stance-check]').hidden, false);
  const choice = f.button('defensive'); choice.focus(); choice.click();
  assert.deepEqual(f.sent, [{ type: 'setStance', ids: [0, 1], unitGenerations: [3, 4], stance: 'defensive' }]);
  assert.equal(f.root.activeElement, choice);
  assert.equal(choice.getAttribute('aria-pressed'), 'false', 'sending does not invent server confirmation');
  f.update([[0, 3, 'defensive'], [1, 4, 'defensive']]);
  assert.equal(f.root.activeElement, choice); assert.equal(choice.getAttribute('aria-pressed'), 'true');
  assert.equal(choice, f.button('defensive'), 'snapshot keeps the focused control node');
});

test('mixed stance has a written state and no misleading pressed choice', t => {
  const f = fixture(t); f.context.ids = [0, 1];
  f.update([[0, 3, 'aggressive'], [1, 4, 'noAttack']]);
  assert.equal(f.group.querySelector('[data-stance-status]').textContent, 'Stance · Mixed');
  for (const choice of STANCE_CHOICES) {
    const button = f.button(choice.id);
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    assert.equal(button.querySelector('[data-stance-check]').hidden, true);
    assert.match(button.title, /Military only/);
  }
  f.button('standGround').click(); assert.equal(f.sent[0].stance, 'standGround');
});

test('missing, malformed, stale-generation and removed snapshot entries never infer a default', t => {
  const f = fixture(t);
  for (const rows of [[[0, 3, 'noAttack']], undefined, [], [[0, 2, 'aggressive']], [[0, 3, 'unknown']], [null, ['0', 3, 'aggressive']], [[0, 3.5, 'defensive']]]) {
    f.update(rows);
    const eligible = rows?.[0]?.[2] === 'noAttack';
    assert.equal(f.group.hidden, !eligible);
    if (!eligible) { f.button('aggressive').click(); assert.equal(f.sent.length, 0); }
  }
  f.units[0].generation = 8; f.update([[0, 3, 'aggressive']]); assert.equal(f.group.hidden, true);
  f.update([[0, 8, 'defensive']]); assert.equal(f.button('defensive').getAttribute('aria-pressed'), 'true');
});

for (const state of ['worker', 'boat', 'enemy', 'dead', 'spectator', 'building', 'empty']) test(`${state} selection cannot expose or issue a military stance`, t => {
  const f = fixture(t);
  if (state === 'worker') f.context.ids = [2];
  if (state === 'boat') f.context.ids = [4];
  if (state === 'enemy') f.context.ids = [3];
  if (state === 'dead') f.units[0].hp = 0;
  if (state === 'spectator') f.context.team = null;
  if (state === 'building') f.context.building = true;
  if (state === 'empty') f.context.ids = [];
  f.update([[0, 3, 'aggressive'], [2, 5, 'defensive'], [3, 6, 'noAttack'], [4, 7, 'standGround']]);
  assert.equal(f.group.hidden, true); f.button('defensive').click(); assert.equal(f.sent.length, 0);
});

for (const [name, change, reason] of [
  ['disconnect', context => { context.online = false; }, 'Connection offline'],
  ['match end', context => { context.winner = 0; }, 'Match finished'],
]) test(`${name} keeps reasons inspectable and prevents stale activation`, t => {
  const f = fixture(t); f.update([[0, 3, 'defensive']]);
  const button = f.button('noAttack'); button.focus(); change(f.context);
  updateCombatStanceControls(f.root, f.context);
  assert.equal(button.disabled, false); assert.equal(button.getAttribute('aria-disabled'), 'true');
  assert.equal(f.root.activeElement, button); assert.match(button.title, new RegExp(reason));
  assert.match(f.group.querySelector('[data-stance-status]').textContent, new RegExp(reason));
  button.click(); assert.equal(f.sent.length, 0);
  f.context.online = true; f.context.winner = -1; f.update([[0, 3, 'defensive']]);
  button.click(); assert.equal(f.sent.length, 1);
});

test('activation revalidates current selection, death and network state even before a UI refresh', t => {
  const f = fixture(t); f.update([[0, 3, 'aggressive']]);
  f.context.ids = []; f.button('defensive').click();
  f.context.ids = [0]; f.units[0].hp = 0; f.button('defensive').click();
  f.units[0].hp = 100; f.context.online = false; f.button('defensive').click();
  assert.equal(f.sent.length, 0);
});

test('current Stand ground remains actionable to release Hold; disposal removes handlers', t => {
  const f = fixture(t); f.units[0].holdingPosition = true; f.update([[0, 3, 'standGround']]);
  f.button('standGround').click(); assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].stance, 'standGround');
  f.unbind(); f.button('defensive').click(); assert.equal(f.sent.length, 1);
});

test('written choices, group name and described state survive mixed/confirmed updates', t => {
  const f = fixture(t); assert.equal(f.group.getAttribute('aria-label'), 'Military stance');
  assert.deepEqual([...f.group.querySelectorAll('[data-combat-stance]')].map(button => button.dataset.combatStance),
    ['aggressive', 'defensive', 'standGround', 'noAttack']);
  for (const choice of STANCE_CHOICES) {
    const button = f.button(choice.id); assert.ok(button.textContent.includes(choice.label));
    assert.equal(button.getAttribute('aria-describedby'), 'military-stance-status');
    assert.equal(button.querySelector('[data-stance-check]').getAttribute('aria-hidden'), 'true');
  }
});
