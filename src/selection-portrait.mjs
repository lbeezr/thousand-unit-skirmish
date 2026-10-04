import { UNIT_DEFINITIONS, BUILDING_DEFINITIONS } from './gameplay-definitions.mjs';
import { buildingSpriteUrl } from './building-sprites.mjs';
import { formatResourceRequirement, formatResourceStock } from './client/hud/resource-format.mjs';

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

export const INFANTRY_PORTRAITS = Object.freeze({
  infantry: Object.freeze({
    entryId: 'unit.infantry', appearanceFamily: 'Human',
    asset: '/assets/ui/portraits/human-infantry-source.png',
    sourceWidth: 1774, cropX: 970, cropY: 0, cropSize: 310,
  }),
  'boughward-infantry': Object.freeze({
    entryId: 'unit.infantry', appearanceFamily: 'Boughward',
    asset: '/assets/ui/portraits/boughward-infantry-source.png',
    sourceWidth: 377, cropX: 0, cropY: 0, cropSize: 300,
  }),
});

export const ARCHER_PORTRAITS = Object.freeze({
  archer: Object.freeze({
    entryId: 'unit.archer', appearanceFamily: 'Human',
    asset: '/assets/ui/portraits/human-archer-source.png',
    sourceWidth: 1774, cropX: 970, cropY: 0, cropSize: 310,
  }),
  'boughward-archer': Object.freeze({
    entryId: 'unit.archer', appearanceFamily: 'Boughward',
    asset: '/assets/ui/portraits/boughward-archer-source.png',
    sourceWidth: 768, cropX: 250, cropY: 0, cropSize: 400,
  }),
});

const UNIT_PORTRAITS = Object.freeze({ ...WORKER_PORTRAITS, ...INFANTRY_PORTRAITS, ...ARCHER_PORTRAITS });

function unitPortrait(kind, appearanceRole) {
  const portrait = UNIT_PORTRAITS[appearanceRole];
  return portrait?.entryId === `unit.${kind}` ? portrait : null;
}

function updatePortraitFrame(frame, portrait) {
  const image = frame.querySelector('img');
  if (!frame.dataset.errorBound) {
    frame.dataset.errorBound = 'true';
    image.addEventListener('error', () => {
      frame.dataset.failedAsset = image.getAttribute('src');
      frame.hidden = true;
    });
  }
  if (image.getAttribute('src') !== portrait.asset) {
    delete frame.dataset.failedAsset;
    image.setAttribute('src', portrait.asset);
  }
  image.style.width = `${portrait.sourceWidth / portrait.cropSize * 100}%`;
  image.style.left = `${-portrait.cropX / portrait.cropSize * 100}%`;
  image.style.top = `${-portrait.cropY / portrait.cropSize * 100}%`;
  frame.hidden = frame.dataset.failedAsset === portrait.asset;
}

// Product identity is decorative; names, costs, reasons and handlers remain on
// the existing button. Stable nodes survive live availability/HP snapshots.
export function updateProductionPortrait(button, kind, appearanceRole, text) {
  if (!button) return;
  if (text !== undefined) {
    let label = button.querySelector('[data-production-label]');
    if (!label) {
      label = button.ownerDocument.createElement('span');
      label.dataset.productionLabel = '';
      button.append(label);
    }
    label.textContent = text;
  }
  const portrait = unitPortrait(kind, appearanceRole);
  let frame = button.querySelector('.unit-action-art');
  button.classList.toggle('unit-art-action', Boolean(portrait));
  if (!portrait) { if (frame) frame.hidden = true; return; }
  if (!frame) {
    frame = button.ownerDocument.createElement('span');
    frame.className = 'unit-action-art'; frame.setAttribute('aria-hidden', 'true');
    const image = button.ownerDocument.createElement('img');
    image.alt = ''; image.decoding = 'async'; image.loading = 'lazy'; frame.append(image);
    button.prepend(frame);
  }
  updatePortraitFrame(frame, portrait);
}

// Same shipped building identity and lifecycle frames as the battlefield.
export const BARRACKS_PORTRAIT = Object.freeze({
  entryId: 'building.barracks', sourceWidth: 640,
  cropX: 32, cropY: 64, cropSize: 576,
});

// Farm has no approved illustration or image-backed runtime model. Keep the
// existing Food symbol explicit rather than presenting another building's art.
const FARM_PORTRAIT = Object.freeze({
  entryId: 'building.farm', asset: '/assets/ui/icons/food.svg',
  sourceWidth: 24, cropX: 0, cropY: 0, cropSize: 24,
});

export function farmSelectionFacts(building, coarsePointer = false) {
  const rule = BUILDING_DEFINITIONS.farm;
  const assign = coarsePointer ? 'Select Workers, choose Gather / move, then tap this Farm'
    : 'Select Workers, then right-click this Farm';
  const complete = building.complete === true;
  const stock = Math.max(0, Number(building.harvestStock) || 0);
  return {
    description: `A planted food plot worked by your Workers. Each planting supplies ${rule.harvest.stock} food; Workers deliver it to a Mill, Storehouse or Town Center.`,
    stock: complete ? `Food plot · ${formatResourceStock(stock)} / ${rule.harvest.stock} food remaining${stock > 0 ? '.' : ' · Exhausted.'}`
      : 'Food plot under construction · no food available yet.',
    instruction: !complete ? `${assign} to finish construction.` : stock > 0
      ? `${assign} to harvest. Build another Farm to plant more.`
      : 'Clear exhausted Farm, then select Workers and build a new Farm. No regrowth.',
    artLabel: 'Food symbol · Farm illustration unavailable; the battlefield uses a temporary House model.',
  };
}

export function workerRoleFacts(unit, definition = UNIT_DEFINITIONS.worker, buildings = BUILDING_DEFINITIONS) {
  const { combat } = definition;
  const producers = Object.values(buildings).filter(building => building.products?.includes(definition.id));
  const cost = Object.entries(definition.cost).filter(([, amount]) => amount > 0)
    .map(([resource, amount]) => `${formatResourceRequirement(amount)} ${resource}`).join(' + ') || 'Free';
  const separateStructureDamage = combat.targetTags.includes('structure') && Number.isFinite(combat.structureDamage);
  const targets = separateStructureDamage ? combat.targetTags.filter(tag => tag !== 'structure') : combat.targetTags;
  return {
    health: `${Math.round(unit.hp)} / ${combat.maxHp} HP`,
    abilities: definition.capabilities.map(capability => {
      const label = capability.replaceAll('-', ' ');
      return label[0].toUpperCase() + label.slice(1);
    }).join(' · '),
    movement: `Base move: ${combat.moveSpeed} cells/s`,
    attack: `Base attack: ${combat.damage} ${combat.attackClass} vs ${targets.join(' / ')} · ${combat.period}s interval · ${combat.range} cells range${separateStructureDamage ? ` · ${combat.structureDamage} damage vs structures` : ''}`,
    training: `${producers.map(building => building.label).join(' / ') || 'No producer'} · ${cost} · ${definition.trainSeconds}s · ${definition.population} population`,
  };
}

export function updateSelectionPortrait(root, context, unit, appearanceRole) {
  const button = root.querySelector('[data-selection-portrait]');
  const health = root.querySelector('[data-worker-health]');
  const notes = root.querySelector('#selected-worker-notes');
  const selectedPortrait = ['workers', 'military'].includes(context.kind) && context.total === 1
    && unit?.hp > 0 ? unitPortrait(unit.kind, appearanceRole) : null;
  const building = context.kind === 'building' && ['barracks', 'farm'].includes(context.building?.type)
    && context.building.hp > 0 ? context.building : null;
  const portrait = building?.type === 'farm' ? FARM_PORTRAIT : building
    ? { ...BARRACKS_PORTRAIT, asset: buildingSpriteUrl(building).replace(/^\.\//, '/') } : selectedPortrait;
  const art = root.querySelector('[data-building-art]');
  const description = root.querySelector('[data-building-description]');
  const instruction = root.querySelector('[data-building-instruction]');
  const farmFacts = building?.type === 'farm' ? farmSelectionFacts(building,
    root.defaultView?.matchMedia('(pointer: coarse)').matches) : null;
  if (!farmFacts && art.contains(root.activeElement)) {
    const tab = root.querySelector('#dock-tab-selection');
    if (tab && !tab.disabled && !tab.closest('[hidden]')) tab.focus();
  }
  art.hidden = description.hidden = instruction.hidden = !farmFacts;
  if (farmFacts) {
    const artImage = art.querySelector('img');
    if (artImage.getAttribute('src') !== portrait.asset) artImage.setAttribute('src', portrait.asset);
    art.querySelector('[data-building-art-label]').textContent = farmFacts.artLabel;
    description.textContent = farmFacts.description;
    instruction.textContent = farmFacts.instruction;
  }
  // A selection snapshot can remove this entry while its disclosure/link owns focus.
  // Move focus before hiding it; ordinary live updates leave the stable nodes alone.
  if (!selectedPortrait) {
    if (notes.contains(root.activeElement)) {
      const tab = root.querySelector('#dock-tab-selection');
      if (tab && !tab.disabled && !tab.closest('[hidden]')) tab.focus();
    }
    notes.querySelector('details').open = false;
  }
  button.hidden = !portrait;
  health.hidden = notes.hidden = !selectedPortrait;
  if (!portrait) return;
  updatePortraitFrame(button.querySelector('.selection-portrait-art'), portrait);
  button.dataset.codexEntry = portrait.entryId;
  const label = building ? `${BUILDING_DEFINITIONS[building.type].label}${farmFacts ? ' · Food plot' : ''}`
    : `${UNIT_DEFINITIONS[unit.kind].label} · ${portrait.appearanceFamily}`;
  const action = building ? 'open structure details' : 'open role notes';
  button.setAttribute('aria-label', `${label} — ${action}`);
  button.title = `${label} — ${action}`;
  if (selectedPortrait) {
    const definition = UNIT_DEFINITIONS[unit.kind], facts = workerRoleFacts(unit, definition);
    health.textContent = `${definition.label} · ${facts.health}`;
    notes.setAttribute('aria-label', `${definition.label} role notes`);
    notes.querySelector('strong').textContent = label;
    for (const [field, text] of Object.entries(facts)) {
      notes.querySelector(`[data-worker-${field}]`).textContent = text;
    }
  }
}
