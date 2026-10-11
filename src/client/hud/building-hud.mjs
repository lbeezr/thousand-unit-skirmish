import { BUILDING_DEFINITIONS, UNIT_DEFINITIONS, TECHNOLOGY_DEFINITIONS } from '../../gameplay-definitions.mjs';
import { profileDropoffResources } from '../../economy-client.mjs';
import { formatResourceStock } from './resource-format.mjs';
import { setHudActionAvailability, isHudActionUnavailable } from '../../hud-layout.mjs';

const views = new WeakMap();
const text = (node, value) => { if (node.textContent !== value) node.textContent = value; };
const percent = value => Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100);

// Presentation consumes disclosed snapshots only. Existing production, research
// and lifecycle consumers continue to own availability and command dispatch.
export function buildingHudFacts(state) {
  const building = state.building;
  if (!building || building.team !== state.team || state.team === null || building.hp <= 0) return null;
  const rule = BUILDING_DEFINITIONS[building.type];
  if (!rule) return null;
  const queue = (building.productionQueue || []).map(kind => ({ kind, label: UNIT_DEFINITIONS[kind]?.label || 'Unit' }));
  const active = state.research?.active;
  const ownResearch = active?.buildingId === building.id ? active : null;
  const stateLabel = building.attackers > 0 ? 'Under attack'
    : !building.complete ? `Under construction · ${percent(building.progress)}%`
    : rule.harvest && building.harvestStock === 0 ? 'Exhausted'
    : building.productionBlocked ? 'Spawn area blocked'
    : queue.length ? 'Training' : ownResearch ? 'Researching' : 'Ready';
  const description = !building.complete ? 'Assign Workers to finish construction.'
    : rule.harvest ? `${formatResourceStock(building.harvestStock || 0)} food remaining`
    : rule.dropoff?.length ? `Drop-off · ${profileDropoffResources(building.type, state.profileId).join(' / ')}`
    : building.type === 'palisade-gate' ? building.gateOpen ? 'Open · both teams may pass' : 'Closed · blocks both teams'
    : building.type === 'palisade-wall' ? 'Blocks land movement'
    : rule.combat ? `Defense · ${rule.combat.range} cell range`
    : rule.products.length ? `${rule.products.length} training ${rule.products.length === 1 ? 'choice' : 'choices'}`
    : rule.populationCapacity ? `Adds ${rule.populationCapacity} population capacity` : 'Owned structure';
  return {
    key: `${building.id}:${building.type}`, name: `${rule.label}${building.home ? ' · Home' : ''}`,
    hp: Math.max(0, building.hp), maxHp: building.maxHp || rule.maxHp, stateLabel, description,
    queue, progress: percent(building.trainingProgress), products: rule.products,
    research: Object.values(TECHNOLOGY_DEFINITIONS).filter(item => item.building === building.type),
    researchStatus: active ? `${TECHNOLOGY_DEFINITIONS[active.type]?.label || 'Research'} · ${percent(active.progress)}%${Number.isFinite(active.remaining) ? ` · ${Math.ceil(active.remaining)}s` : ''}${ownResearch ? '' : ' · at another building'}` : 'Research improves your team. Requirements and costs are shown below.',
    production: building.productionBlocked ? 'Waiting for spawn space' : queue.length
      ? `${queue[0].label} · ${percent(building.trainingProgress)}%${Number.isFinite(building.trainingRemaining) ? ` · ${Math.ceil(building.trainingRemaining)}s` : ''}` : 'Queue empty',
  };
}

export function updateBuildingHud(root, state, onAction) {
  const panel = root.querySelector('[data-building-hud]');
  const bar = root.querySelector('.contextual-command-bar');
  if (!panel || !bar) return;
  let view = views.get(root);
  if (!view) {
    view = { state, onAction, key: null, researchOpen: false };
    views.set(root, view);
    panel.addEventListener('click', event => {
      if (!event.target.closest('[data-product], [data-technology], [data-action]')) return;
      if (!buildingHudFacts(view.state) || !view.state.connected || view.state.matchFinished) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }, true);
    panel.addEventListener('click', event => {
      const button = event.target.closest('[data-building-action]');
      if (!button || button.closest('[hidden]') || isHudActionUnavailable(button)) return;
      const action = button.dataset.buildingAction;
      if (action === 'research') {
        view.researchOpen = !view.researchOpen;
        updateBuildingHud(root, view.state, view.onAction);
        if (view.researchOpen) panel.querySelector('[data-context-research-options] button')?.focus();
      } else view.onAction(action);
    });
    panel.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !view.researchOpen || view.state.targeting) return;
      view.researchOpen = false;
      updateBuildingHud(root, view.state, view.onAction);
      panel.querySelector('[data-building-action="research"]').focus();
      event.preventDefault(); event.stopPropagation();
    });
  }
  view.state = state; view.onAction = onAction;
  const facts = buildingHudFacts(state);
  panel.hidden = root.querySelector('[data-building-identity]').hidden = !facts;
  if (view.key !== facts?.key) view.researchOpen = false;
  view.key = facts?.key;
  if (!facts) return;
  bar.querySelector('.contextual-identity-text').hidden = true;
  bar.querySelector(':scope > .contextual-actions').hidden = true;
  bar.querySelector('[data-context-reason]').hidden = true;
  bar.querySelector('[data-context-research]').hidden = true;
  const set = (selector, value) => text(root.querySelector(selector), value);
  set('[data-building-name]', facts.name);
  set('[data-building-role]', facts.products.length ? 'Production · Structure' : 'Settlement · Structure');
  set('[data-building-hp]', `${Math.round(facts.hp)} / ${facts.maxHp} HP`);
  set('[data-building-state]', facts.stateLabel);
  set('[data-building-description-short]', facts.description);
  const fill = root.querySelector('[data-building-hp-fill]');
  fill.style.width = `${Math.min(100, facts.hp / facts.maxHp * 100)}%`;
  fill.dataset.critical = String(facts.hp / facts.maxHp <= .3);
  root.querySelector('[data-building-fallback]').hidden = !root.querySelector('[data-selection-portrait]').hidden;
  set('[data-building-action-heading]', facts.products.length ? 'Training' : 'Structure');
  set('[data-building-research-count]', `· ${facts.research.length}`);
  const research = panel.querySelector('[data-building-action="research"]');
  research.hidden = !facts.research.length;
  research.setAttribute('aria-expanded', String(view.researchOpen));
  panel.querySelector('#building-research-panel').hidden = !view.researchOpen || research.hidden;
  set('[data-building-research-status]', facts.researchStatus);
  set('[data-building-active-research]', facts.researchStatus);
  panel.querySelector('[data-building-active-research]').hidden = !state.research?.active || !facts.research.length;
  const rally = panel.querySelector('[data-building-action="rally"]');
  const clear = panel.querySelector('[data-building-action="clear-rally"]');
  rally.hidden = !state.rallySupported;
  clear.hidden = !state.rallySupported || !(state.building.rallyCell >= 0);
  rally.setAttribute('aria-pressed', String(state.targeting));
  text(rally.lastChild, state.targeting ? 'Cancel target' : 'Set rally');
  const blocked = !state.connected ? 'Reconnecting — orders unavailable.' : state.matchFinished ? 'Match finished.' : '';
  for (const button of [rally, clear]) setHudActionAvailability(button, Boolean(blocked), true);
  if (blocked) for (const button of panel.querySelectorAll('[data-product], [data-technology], [data-action]')) {
    if (button.dataset.action && button.dataset.action !== 'replantFarm') button.disabled = true;
    else setHudActionAvailability(button, true, true);
  }
  set('[data-building-hint]', blocked || (state.targeting && state.rallySupported ? 'Choose ground for the rally point · Esc to cancel.'
    : state.rallySupported ? state.building.rallyCell >= 0 ? 'Rally set · new units move to the marked destination.' : 'Set a rally point for newly trained units.'
    : state.building.type === 'dock' ? 'Skiffs deliver food here. Move boats after training.' : 'Structure actions follow its current state.'));
  panel.querySelector('[data-building-queue]').hidden = !facts.products.length;
  set('[data-building-production]', facts.production);
  set('[data-building-queue-count]', `${facts.queue.length} queued`);
  const progress = panel.querySelector('[data-building-progress]');
  progress.value = facts.progress / 100; progress.hidden = !facts.queue.length;
  const list = panel.querySelector('[data-building-queue-list]');
  const signature = facts.queue.map(item => item.kind).join(',');
  if (list.dataset.signature !== signature) {
    list.dataset.signature = signature;
    list.replaceChildren(...facts.queue.map((item, index) => {
      const entry = root.createElement('li'); entry.textContent = `${index + 1}. ${item.label}`;
      return entry;
    }));
  }
}
