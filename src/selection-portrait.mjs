import { UNIT_DEFINITIONS, BUILDING_DEFINITIONS } from './gameplay-definitions.mjs';
import { buildingSpriteUrl } from './building-sprites.mjs';
import { formatResourceRequirement } from './client/hud/resource-format.mjs';

// Byte-identical approved illustrations; framing is a CSS viewport, not an atlas face crop.
export const WORKER_PORTRAITS = Object.freeze({
  human: Object.freeze({
    entryId: 'unit.worker', appearanceFamily: 'Human',
    asset: '/assets/ui/portraits/human-worker-source.png',
    sourceWidth: 1774, cropX: 970, cropY: 0, cropSize: 270,
  }),
  'boughward-worker': Object.freeze({
    entryId: 'unit.worker', appearanceFamily: 'Boughward',
    asset: '/assets/ui/portraits/boughward-worker-source.png',
    sourceWidth: 266, cropX: 20, cropY: 0, cropSize: 240,
  }),
});

// Same shipped building identity and lifecycle frames as the battlefield.
export const BARRACKS_PORTRAIT = Object.freeze({
  entryId: 'building.barracks', sourceWidth: 640,
  cropX: 32, cropY: 64, cropSize: 576,
});

export function workerRoleFacts(unit, definition = UNIT_DEFINITIONS.worker, buildings = BUILDING_DEFINITIONS) {
  const { combat } = definition;
  const producers = Object.values(buildings).filter(building => building.products?.includes(definition.id));
  const cost = Object.entries(definition.cost).filter(([, amount]) => amount > 0)
    .map(([resource, amount]) => `${formatResourceRequirement(amount)} ${resource}`).join(' + ') || 'Free';
  return {
    health: `${Math.round(unit.hp)} / ${combat.maxHp} HP`,
    abilities: definition.capabilities.map(capability => {
      const label = capability.replaceAll('-', ' ');
      return label[0].toUpperCase() + label.slice(1);
    }).join(' · '),
    movement: `Base move: ${combat.moveSpeed} cells/s`,
    attack: `Base attack: ${combat.damage} ${combat.attackClass} vs ${combat.targetTags.join(' / ')} · ${combat.period}s interval · ${combat.range} cells range`,
    training: `${producers.map(building => building.label).join(' / ') || 'No producer'} · ${cost} · ${definition.trainSeconds}s · ${definition.population} population`,
  };
}

export function updateSelectionPortrait(root, context, unit, appearanceRole) {
  const button = root.querySelector('[data-selection-portrait]');
  const health = root.querySelector('[data-worker-health]');
  const notes = root.querySelector('#selected-worker-notes');
  const workerPortrait = context.kind === 'workers' && context.total === 1
    && unit?.kind === 'worker' && unit.hp > 0 ? WORKER_PORTRAITS[appearanceRole] : null;
  const building = context.kind === 'building' && context.building?.type === 'barracks'
    && context.building.hp > 0 ? context.building : null;
  const portrait = building ? { ...BARRACKS_PORTRAIT, asset: buildingSpriteUrl(building).replace(/^\.\//, '/') } : workerPortrait;
  // A selection snapshot can remove this entry while its disclosure/link owns focus.
  // Move focus before hiding it; ordinary live updates leave the stable nodes alone.
  if (!workerPortrait) {
    if (notes.contains(root.activeElement)) {
      const tab = root.querySelector('#dock-tab-selection');
      if (tab && !tab.disabled && !tab.closest('[hidden]')) tab.focus();
    }
    notes.querySelector('details').open = false;
  }
  button.hidden = !portrait;
  health.hidden = notes.hidden = !workerPortrait;
  if (!portrait) return;
  const image = button.querySelector('img');
  if (image.getAttribute('src') !== portrait.asset) image.setAttribute('src', portrait.asset);
  image.style.width = `${portrait.sourceWidth / portrait.cropSize * 100}%`;
  image.style.left = `${-portrait.cropX / portrait.cropSize * 100}%`;
  image.style.top = `${-portrait.cropY / portrait.cropSize * 100}%`;
  button.dataset.codexEntry = portrait.entryId;
  const label = building ? BUILDING_DEFINITIONS.barracks.label : `${UNIT_DEFINITIONS.worker.label} · ${portrait.appearanceFamily}`;
  const action = building ? 'open structure details' : 'open role notes';
  button.setAttribute('aria-label', `${label} — ${action}`);
  button.title = `${label} — ${action}`;
  if (workerPortrait) {
    const facts = workerRoleFacts(unit);
    health.textContent = `${UNIT_DEFINITIONS.worker.label} · ${facts.health}`;
    notes.querySelector('strong').textContent = label;
    for (const [field, text] of Object.entries(facts)) {
      notes.querySelector(`[data-worker-${field}]`).textContent = text;
    }
  }
}
