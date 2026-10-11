import { UNIT_DEFINITIONS, BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS } from '../../gameplay-definitions.mjs';
import { constructionCostForProfile, economyResources } from '../../economy-profile.mjs';
import { formatResourceStock, formatResourceRequirement } from './resource-format.mjs';
import { setHudActionAvailability, isHudActionUnavailable } from '../../hud-layout.mjs';

const views = new WeakMap();
const tasks = { idle: 'Idle', moving: 'Moving', gathering: 'Gathering', returning: 'Returning cargo',
  building: 'Building', repairing: 'Repairing', attacking: 'Attacking', holding: 'Holding position',
  patrolling: 'Patrolling', following: 'Following' };
const targeting = { gather: 'Choose food, wood, stone, or a planted Farm.',
  repair: 'Choose a damaged friendly building. Repairs cost wood.', move: 'Choose a destination on the ground.' };
const buildOrder = ['house', 'farm', 'mill', 'storehouse', 'town-center', 'barracks', 'archery-range',
  'stable', 'workshop', 'watchtower', 'palisade-wall', 'palisade-gate', 'dock'];
const buildings = Object.values(BUILDING_DEFINITIONS).sort((a, b) =>
  (buildOrder.indexOf(a.id) < 0 ? Infinity : buildOrder.indexOf(a.id))
  - (buildOrder.indexOf(b.id) < 0 ? Infinity : buildOrder.indexOf(b.id)));

export function workerSelectionKey(workers) {
  return workers.map(unit => `${unit.id}:${unit.generation ?? 0}`).sort().join(',');
}

// Read the same registered prices and research gates as construction. The server
// still accepts/rejects every order; this view never changes a bank or task.
export function workerBuildChoices(state) {
  return buildings.map(definition => {
    const cost = constructionCostForProfile(definition.id, state.profileId);
    const missing = (definition.requires || []).filter(id => !state.research?.[TECHNOLOGY_DEFINITIONS[id].upgradeKey]);
    const shortfall = Object.entries(cost).filter(([resource, amount]) => amount > (state.resources?.[resource] ?? 0))
      .map(([resource, amount]) => `${formatResourceRequirement(amount - (state.resources?.[resource] ?? 0))} ${resource}`);
    const reason = !state.connected ? 'Reconnecting' : state.matchFinished ? 'Match finished'
      : !state.workers.length ? 'Select living Workers' : state.placementPending ? 'Waiting for construction request'
      : missing.length ? `Requires ${missing.map(id => TECHNOLOGY_DEFINITIONS[id].label).join(' + ')}`
      : shortfall.length ? `Need ${shortfall.join(' + ')}` : '';
    return { id: definition.id, label: definition.label, reason,
      cost: Object.entries(cost).filter(([, amount]) => amount > 0)
        .map(([resource, amount]) => `${formatResourceRequirement(amount)} ${resource}`).join(' · ') + (definition.id === 'palisade-wall' ? ' / segment' : ''),
      active: state.placementActive === definition.id };
  });
}

export function workerHudFacts(state) {
  const workers = state.workers;
  const counts = new Map(), cargo = new Map();
  const resources = economyResources(state.profileId);
  for (const worker of workers) {
    const task = tasks[worker.task] || 'Awaiting task';
    counts.set(task, (counts.get(task) || 0) + 1);
    if (worker.cargo > 0 && resources.includes(worker.cargoType)) cargo.set(worker.cargoType || 'cargo', (cargo.get(worker.cargoType || 'cargo') || 0) + worker.cargo);
  }
  const hp = workers.reduce((sum, unit) => sum + Math.max(0, unit.hp), 0);
  const maxHp = UNIT_DEFINITIONS.worker.combat.maxHp * workers.length;
  return {
    key: workerSelectionKey(workers), name: workers.length === 1 ? 'Worker' : `${workers.length} Workers`, hp, maxHp,
    task: [...counts].map(([task, count]) => workers.length === 1 ? task : `${count} ${task.toLowerCase()}`).join(' · '),
    cargo: cargo.size ? [...cargo].map(([resource, stock]) => `${formatResourceStock(stock)} ${resource}`).join(' · ') : 'Empty',
    hasCargo: cargo.size > 0,
  };
}

function setText(element, text) { if (element.textContent !== text) element.textContent = text; }

export function updateWorkerHud(root, state, onAction) {
  const bar = root.querySelector('.contextual-command-bar');
  const panel = root.querySelector('[data-worker-hud]');
  if (!panel || !bar) return;
  let view = views.get(root);
  if (!view) {
    view = { state, onAction, key: '', disclosure: null };
    views.set(root, view);
    // Stable controls: live snapshots update text/availability without replacing
    // a focused button, open disclosure, or pointer target.
    for (const definition of buildings) {
      const button = root.createElement('button');
      button.type = 'button'; button.dataset.workerBuild = definition.id;
      for (const part of ['name', 'cost', 'reason']) {
        const span = root.createElement(part === 'name' ? 'span' : 'small');
        span.dataset.buildPart = part; button.append(span);
      }
      panel.querySelector('[data-worker-build-list]').append(button);
    }
    bar.addEventListener('click', event => {
      const button = event.target.closest('[data-worker-action], [data-worker-build]');
      if (!button || !bar.contains(button) || button.closest('[hidden]')) return;
      if (isHudActionUnavailable(button)) return;
      const action = button.dataset.workerAction;
      if (['build', 'more'].includes(action)) {
        view.disclosure = view.disclosure === action ? null : action;
        view.onAction('dismiss-target');
        updateWorkerHud(root, view.state, view.onAction);
        if (view.disclosure) panel.querySelector(`[data-worker-disclosure="${view.disclosure}"] button`)?.focus();
        return;
      }
      if (!['details', 'formation'].includes(action)) view.disclosure = null;
      view.onAction(button.dataset.workerBuild ? 'construct' : action, button.dataset.workerBuild);
      updateWorkerHud(root, view.state, view.onAction);
    });
    bar.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !view.disclosure) return;
      const opener = panel.querySelector(`[data-worker-action="${view.disclosure}"]`);
      view.disclosure = null;
      updateWorkerHud(root, view.state, view.onAction);
      opener.focus(); event.preventDefault(); event.stopPropagation();
    });
  }
  view.state = state; view.onAction = onAction;
  const active = Boolean(state.active);
  panel.hidden = !active;
  root.querySelector('[data-worker-identity]').hidden = !active;
  bar.querySelector('.contextual-identity-text').hidden = active;
  bar.querySelector(':scope > .contextual-actions').hidden = active;
  bar.querySelector('[data-context-reason]').hidden = active;
  const facts = workerHudFacts(state);
  if (!active || facts.key !== view.key) view.disclosure = null;
  view.key = facts.key;
  if (!active) return;
  bar.dataset.workerTeam = String(state.team);
  setText(root.querySelector('[data-worker-name]'), facts.name);
  setText(root.querySelector('[data-worker-task]'), facts.task);
  setText(root.querySelector('[data-worker-cargo]'), `Carrying · ${facts.cargo}`);
  setText(root.querySelector('[data-worker-hp]'), `${Math.round(facts.hp)} / ${facts.maxHp} HP`);
  const health = root.querySelector('[data-worker-hp-fill]');
  health.style.width = `${Math.min(100, facts.hp / facts.maxHp * 100)}%`;
  health.dataset.critical = String(facts.hp / facts.maxHp <= .3);
  const fallback = root.querySelector('[data-worker-portrait-fallback]');
  fallback.hidden = !root.querySelector('[data-selection-portrait]').hidden;
  setText(fallback, state.workers.length === 1 ? 'W' : String(state.workers.length));
  const blocked = !state.connected ? 'Reconnecting — orders unavailable.' : state.matchFinished ? 'Match finished.'
    : state.placementPending ? 'Waiting for construction request.' : '';
  if (blocked) view.disclosure = null;
  for (const button of panel.querySelectorAll('[data-worker-action]')) {
    const action = button.dataset.workerAction;
    const reason = ['more', 'details', 'formation'].includes(action) ? '' : blocked
      || (action === 'return' && !facts.hasCargo ? 'No cargo to return.' : '')
      || (['gather', 'repair', 'move'].includes(action) && state.placementActive ? 'Finish or cancel construction placement first.' : '');
    setHudActionAvailability(button, Boolean(reason), true);
    button.title = reason || button.dataset.description || '';
    if (['gather', 'repair', 'move'].includes(action)) button.setAttribute('aria-pressed', String(state.targetMode === action));
    if (['build', 'more'].includes(action)) button.setAttribute('aria-expanded', String(view.disclosure === action));
  }
  panel.querySelector('[data-worker-disclosure="build"]').hidden = view.disclosure !== 'build';
  panel.querySelector('[data-worker-disclosure="more"]').hidden = view.disclosure !== 'more';
  for (const choice of workerBuildChoices(state)) {
    const button = panel.querySelector(`[data-worker-build="${choice.id}"]`);
    setText(button.querySelector('[data-build-part="name"]'), choice.label);
    setText(button.querySelector('[data-build-part="cost"]'), choice.cost);
    setText(button.querySelector('[data-build-part="reason"]'), choice.reason);
    setHudActionAvailability(button, Boolean(choice.reason), true);
    button.setAttribute('aria-pressed', String(choice.active));
    button.title = `${choice.label} · ${choice.cost}${choice.reason ? ` · ${choice.reason}` : ''}`;
  }
  const targetHint = state.targetMode === 'gather' && !economyResources(state.profileId).includes('stone')
    ? 'Choose food, wood, or a planted Farm.' : targeting[state.targetMode];
  const hint = blocked || (state.targetMode ? `${targetHint} Esc to cancel.`
    : state.placementActive ? 'Place on the battlefield · Right-click or Esc to cancel.'
    : state.orderMode === 'patrol' ? 'Choose ground to patrol there and back. Esc to cancel.'
    : state.orderMode === 'follow' ? 'Choose a friendly unit to follow. Esc to cancel.'
    : 'Right-click to gather, build, or move.');
  setText(panel.querySelector('[data-worker-hint]'), hint);
  setText(panel.querySelector('[data-worker-return-note]'), facts.hasCargo ? 'Deliver' : 'Empty');
}
