import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { unitHudFacts, updateUnitHud } from '../src/client/hud/unit-hud.mjs';
import { selectionContext } from '../src/selection-context.mjs';
import { updateCombatStanceControls, bindCombatStanceControls } from '../src/combat-stance-ui.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { isClientStaticAsset } from '../src/server/client-static-assets.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const unit = (id, kind, team = 0, extra = {}) => ({ id, kind, team, hp: UNIT_DEFINITIONS[kind].combat.maxHp, generation: 1, ...extra });
function state(units, team = 0) {
  const indexed = Object.fromEntries(units.map(unit => [unit.id, unit]));
  return { units, team, context: selectionContext(indexed, units.map(unit => unit.id), team),
    connected: true, matchFinished: false, formation: 'box', targeting: false, attackMove: false, orderMode: null };
}

test('mixed facts disclose composition, typed cargo, health and confirmed military subset', () => {
  const s = state([unit(3, 'infantry', 0, { combatStance: 'aggressive', queuedWaypointCount: 2 }),
    unit(9, 'archer', 0, { combatStance: 'defensive' }), unit(5, 'worker', 0, { hp: 31, cargoType: 'wood', cargo: 7.8 })]);
  const facts = unitHudFacts(s);
  assert.equal(facts.name, '3 units'); assert.equal(facts.role, 'Mixed selection');
  assert.equal(facts.cargo, '7 wood'); assert.equal(facts.carrying, 1);
  assert.equal(facts.hp, UNIT_DEFINITIONS.infantry.combat.maxHp + UNIT_DEFINITIONS.archer.combat.maxHp + 31);
  assert.equal(facts.stance.mixed, true); assert.deepEqual(facts.stance.selected.map(unit => unit.id), [3, 9]);
  assert.equal(facts.orders, '2 queued waypoints');
  s.units[0].combatStance = null; s.units[1].combatStance = null;
  assert.equal(unitHudFacts(s).stance.selected.length, 0, 'missing confirmation never fabricates a stance');
});

for (const team of [0, 1]) test(`seat ${team}: mixed land/water actions remain inspectable, truthful and inert`, t => {
  const dom = new JSDOM(html); t.after(() => dom.window.close());
  const d = dom.window.document, panel = d.querySelector('[data-unit-hud]');
  d.querySelector('.contextual-command-bar').hidden = false;
  const s = state([unit(0, 'infantry', team, { combatStance: 'defensive' }), unit(1, 'skiff', team, { cargo: 5, cargoType: 'food' })], team);
  const sent = [], formations = [], source = () => ({ units: s.units, ids: s.units.map(u => u.id), team, online: s.connected, winner: s.matchFinished ? team : -1 });
  bindCombatStanceControls(d, source, command => sent.push(command));
  for (const b of panel.querySelectorAll('.unit-primary-actions button, [data-return-cargo]')) {
    b.hidden = false; b.addEventListener('click', () => sent.push(b.dataset.stationaryOrder || 'target'));
  }
  const update = () => { updateCombatStanceControls(d, source()); updateUnitHud(d, s, value => formations.push(value)); };
  update();
  const target = panel.querySelector('[data-context-proxy="order-target-toggle"]'); target.focus(); target.click();
  assert.equal(d.activeElement, target); assert.equal(target.getAttribute('aria-disabled'), 'true');
  assert.match(target.title, /separately/); assert.equal(sent.length, 0);
  panel.querySelector('[data-return-cargo]').click(); assert.equal(sent.length, 0);
  panel.querySelector('[data-combat-stance="standGround"]').click();
  assert.deepEqual(sent.at(-1).ids, [0]); assert.equal(sent.at(-1).stance, 'standGround');
  assert.equal(s.units[0].combatStance, 'defensive', 'stance waits for server confirmation');
  panel.querySelector('[data-stationary-order="stop"]').click(); assert.equal(sent.at(-1), 'stop');
  const select = panel.querySelector('[data-unit-formation]'); assert.equal(select.parentElement.hidden, true);
  s.units = [s.units[0], unit(1, 'worker', team, { cargo: 4, cargoType: 'wood' })];
  s.context = selectionContext(s.units, [0, 1], team); update();
  assert.equal(select.parentElement.hidden, false); select.value = 'line'; select.dispatchEvent(new dom.window.Event('change'));
  assert.deepEqual(formations, ['line']); assert.match(panel.querySelector('[data-return-cargo]').textContent, /1 Worker$/);
  s.connected = false; update(); const count = sent.length;
  target.click(); panel.querySelector('[data-stationary-order="stop"]').click(); assert.equal(sent.length, count);
  s.connected = true; update(); assert.equal(target.getAttribute('aria-disabled'), 'false'); assert.doesNotMatch(target.title, /Reconnecting/);
  s.matchFinished = true; update(); assert.equal(target.getAttribute('aria-disabled'), 'true');
});

test('pure Skiffs hide land tactics and disclose the existing route limit', t => {
  const dom = new JSDOM(html); t.after(() => dom.window.close());
  const d = dom.window.document, s = state(Array.from({ length: 17 }, (_, id) => unit(id, 'skiff')));
  updateUnitHud(d, s, () => {});
  const panel = d.querySelector('[data-unit-hud]');
  for (const selector of ['[data-persistent-order="patrol"]', '[data-persistent-order="follow"]', '[data-context-proxy="attack-move-toggle"]'])
    assert.equal(panel.querySelector(selector).hidden, true);
  assert.equal(panel.querySelector('[data-stationary-order="holdPosition"]').hidden, false);
  assert.match(panel.querySelector('[data-context-proxy="order-target-toggle"]').title, /up to 16/);
  assert.equal(d.querySelectorAll('[data-unit-hint]').length, 1);
});

test('global navigation is in the header and the unit skin is publicly admitted', () => {
  const d = new JSDOM(html).window.document;
  assert.ok(d.querySelector('.topbar .hud-quick-access #dock-toggle'));
  assert.ok(d.querySelector('#dock-command #formation-select'), 'Worker detail path retains its existing formation control');
  for (const file of ['unit-hud.mjs', 'unit-hud.css']) assert.equal(isClientStaticAsset(`src/client/hud/${file}`), true);
  d.defaultView.close();
});
