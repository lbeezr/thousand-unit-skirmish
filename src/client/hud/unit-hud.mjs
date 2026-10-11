import { UNIT_DEFINITIONS } from '../../gameplay-definitions.mjs';
import { stanceSelection } from '../../combat-stance-ui.mjs';
import { setHudActionAvailability, isHudActionUnavailable } from '../../hud-layout.mjs';
import { formatResourceStock } from './resource-format.mjs';

const views = new WeakMap();
const text = (node, value) => { if (node.textContent !== value) node.textContent = value; };

export function unitHudFacts(state) {
  if (!['military', 'mixed', 'boats'].includes(state.context.kind)) return null;
  const units = state.units.filter(unit => unit.hp > 0 && unit.team === state.team);
  if (!units.length) return null;
  const counts = new Map();
  for (const unit of units) counts.set(unit.kind, (counts.get(unit.kind) || 0) + 1);
  const boats = units.filter(unit => UNIT_DEFINITIONS[unit.kind]?.movementDomain === 'water');
  const carriers = units.filter(unit => ['worker', 'skiff'].includes(unit.kind));
  const carrying = carriers.filter(unit => unit.cargo > 0);
  const mixedWater = boats.length > 0 && boats.length !== units.length;
  const stance = stanceSelection({ units: Object.fromEntries(units.map(unit => [unit.id, unit])), ids: units.map(unit => unit.id),
    team: state.team, online: state.connected, winner: state.matchFinished ? state.team : -1 });
  const cargo = Object.entries(state.context.cargo).filter(([, amount]) => amount > 0)
    .map(([kind, amount]) => `${formatResourceStock(amount)} ${kind}`).join(' · ');
  const queued = units.reduce((sum, unit) => sum + (unit.queuedWaypointCount || 0), 0);
  const orders = new Map();
  for (const unit of units) if (unit.persistentOrder?.type)
    orders.set(unit.persistentOrder.type, (orders.get(unit.persistentOrder.type) || 0) + 1);
  return {
    name: units.length === 1 ? UNIT_DEFINITIONS[units[0].kind]?.label || 'Unit' : `${units.length} ${state.context.kind === 'boats' ? 'Skiffs' : 'units'}`,
    role: state.context.kind === 'boats' ? 'Water · Economy' : state.context.kind === 'mixed' ? 'Mixed selection' : 'Military',
    count: units.length, composition: [...counts].map(([kind, count]) => `${count} ${UNIT_DEFINITIONS[kind]?.label || kind}`).join(' · '),
    hp: units.reduce((sum, unit) => sum + unit.hp, 0),
    maxHp: units.reduce((sum, unit) => sum + (UNIT_DEFINITIONS[unit.kind]?.combat.maxHp || unit.hp), 0),
    boats: boats.length, carriers: carriers.length, carrying: carrying.length, mixedWater, cargo,
    orders: [...orders].map(([order, count]) => `${count} ${order}`).concat(queued ? [`${queued} queued waypoints`] : []).join(' · '),
    stance,
  };
}

export function updateUnitHud(root, state, onFormation) {
  const panel = root.querySelector('[data-unit-hud]');
  const identity = root.querySelector('[data-unit-identity]');
  if (!panel || !identity) return;
  let view = views.get(root);
  if (!view) {
    view = { state, onFormation };
    views.set(root, view);
    // Existing button handlers still send commands. Inspectable unavailable
    // choices must be inert before those handlers receive the event.
    panel.addEventListener('click', event => {
      if (!unitHudFacts(view.state)) return;
      const button = event.target.closest('button');
      if (button && (button.closest('[hidden]') || isHudActionUnavailable(button))) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }, true);
    panel.querySelector('[data-unit-formation]').addEventListener('change', event => {
      const facts = unitHudFacts(view.state);
      if (!facts || facts.boats || !view.state.connected || view.state.matchFinished) return;
      if (['box', 'line', 'column'].includes(event.target.value)) view.onFormation(event.target.value);
    });
  }
  view.state = state; view.onFormation = onFormation;
  const facts = unitHudFacts(state), active = Boolean(facts);
  identity.hidden = !active;
  panel.toggleAttribute('data-hud-panel', active);
  for (const node of panel.querySelectorAll('[data-unit-only]')) node.hidden = !active;
  if (!active) {
    // These controls also serve the compact Sheep surface. Remove only our
    // inspectable availability overrides when that existing consumer takes over.
    for (const button of panel.querySelectorAll('.unit-primary-actions button, [data-return-cargo]')) {
      button.removeAttribute('aria-disabled');
      if (button.dataset.unitReason && button.title === button.dataset.unitReason)
        button.title = button.dataset.orderDescription || '';
      delete button.dataset.unitReason;
    }
    return;
  }
  root.querySelector('.contextual-identity-text').hidden = true;
  // Match navigation has one stable header location; the entity owns this dock.
  for (const node of panel.querySelectorAll('[data-context-proxy="select-idle-workers"], [data-context-proxy="select-military"], [data-context-panel="economy"], [data-context-panel="selection"], [data-context-groups]')) node.hidden = true;
  const set = (selector, value) => text(root.querySelector(selector), value);
  set('[data-unit-name]', facts.name); set('[data-unit-role]', facts.role);
  set('[data-unit-composition]', facts.composition);
  set('[data-unit-cargo]', facts.carriers ? `Carrying · ${facts.cargo || 'Empty'}` : '');
  set('[data-unit-orders]', facts.orders);
  set('[data-unit-hp]', `${Math.round(facts.hp)} / ${facts.maxHp} HP`);
  const fill = root.querySelector('[data-unit-hp-fill]');
  fill.style.width = `${Math.min(100, facts.hp / facts.maxHp * 100)}%`;
  fill.dataset.critical = String(facts.hp / facts.maxHp <= .3);
  const fallback = root.querySelector('[data-unit-fallback]');
  fallback.hidden = !root.querySelector('[data-selection-portrait]').hidden;
  text(fallback, facts.count === 1 ? facts.name[0] : String(facts.count));
  const blocked = !state.connected ? 'Reconnecting — orders unavailable.' : state.matchFinished ? 'Match finished.' : '';
  const mixedReason = facts.mixedWater ? 'Select land units or Skiffs separately.' : '';
  for (const button of panel.querySelectorAll('.unit-primary-actions button')) {
    const persistent = button.dataset.persistentOrder;
    const attack = button.dataset.contextProxy === 'attack-move-toggle';
    const target = button.dataset.contextProxy === 'order-target-toggle';
    button.hidden = facts.boats === facts.count && Boolean(persistent || attack);
    const reason = blocked || ((persistent || attack || target) ? mixedReason : '')
      || (facts.boats === facts.count && (persistent || attack) ? 'Skiffs do not support this order.' : '')
      || (target && facts.boats > 16 ? 'Select up to 16 Skiffs for a route or fishing order.' : '');
    setHudActionAvailability(button, Boolean(reason), true);
    // Target's description changes when its existing consumer arms/cancels it.
    if (!Object.hasOwn(button.dataset, 'orderDescription') || (target && button.title !== button.dataset.unitReason))
      button.dataset.orderDescription = button.title;
    button.title = reason || button.dataset.orderDescription;
    button.dataset.unitReason = reason;
    if (persistent) button.setAttribute('aria-pressed', String(state.orderMode === persistent));
  }
  const returns = panel.querySelector('[data-return-cargo]');
  returns.hidden = !facts.carriers;
  const returnReason = blocked || mixedReason || (!facts.cargo ? 'No cargo to return.' : '')
    || (facts.boats && facts.carrying > 16 ? 'Select up to 16 carrying Skiffs.' : '');
  setHudActionAvailability(returns, Boolean(returnReason), true);
  const carrierLabel = `${facts.boats ? 'Skiff' : 'Worker'}${facts.carrying === 1 ? '' : 's'}`;
  returns.title = returnReason || `Deliver cargo carried by ${facts.carrying} selected ${carrierLabel}.`;
  text(returns.querySelector('span'), `Return cargo · ${facts.carrying} ${carrierLabel}`);
  const formation = panel.querySelector('[data-unit-formation]');
  formation.parentElement.hidden = Boolean(facts.boats);
  formation.value = state.formation; formation.disabled = Boolean(blocked);
  const stance = panel.querySelector('[data-stance-status]');
  text(stance, ['Stance', facts.stance.mixed ? 'Mixed' : '', `${facts.stance.selected.length} military`, facts.stance.reason].filter(Boolean).join(' · '));
  set('[data-unit-hint]', blocked || mixedReason || (state.targeting ? 'Choose a battlefield target · Esc to cancel.'
    : state.orderMode === 'patrol' ? 'Right-click ground to patrol there and back · Esc to cancel.'
    : state.orderMode === 'follow' ? 'Right-click a friendly land unit to follow · Esc to cancel.'
    : state.attackMove ? 'Attack move · right-click ground · M or Esc to cancel.'
    : facts.boats ? 'Target fish or water · Shift queues a route · up to 16 Skiffs.'
    : 'Right-click to move or attack · Shift queues a route.'));
}
