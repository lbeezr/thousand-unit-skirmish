import { UNIT_DEFINITIONS, BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS } from './gameplay-definitions.mjs';
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

export const SPEARMAN_PORTRAITS = Object.freeze({
  spearman: Object.freeze({
    entryId: 'unit.spearman', appearanceFamily: 'Human',
    asset: '/assets/ui/portraits/human-spearman-source.png',
    sourceWidth: 337, sourceHeight: 433, contain: true,
  }),
  'boughward-spearman': Object.freeze({
    entryId: 'unit.spearman', appearanceFamily: 'Boughward',
    asset: '/assets/ui/portraits/boughward-spearman-source.png',
    sourceWidth: 702, sourceHeight: 525, contain: true,
  }),
});

export const SCOUT_PORTRAITS = Object.freeze({
  'scout': Object.freeze({
    entryId: 'unit.scout', appearanceFamily: 'Human',
    asset: '/assets/ui/portraits/human-scout-source.png', sourceWidth: 429, sourceHeight: 491, contain: true,
  }),
  'boughward-scout': Object.freeze({
    entryId: 'unit.scout', appearanceFamily: 'Boughward',
    asset: '/assets/ui/portraits/boughward-scout-source.png', sourceWidth: 614, sourceHeight: 520, contain: true,
  }),
});

export const RIDER_PORTRAITS = Object.freeze({
  'rider': Object.freeze({
    entryId: 'unit.rider', appearanceFamily: 'Human',
    asset: '/assets/ui/portraits/human-rider-source.png', sourceWidth: 467, sourceHeight: 523, contain: true,
  }),
  'boughward-rider': Object.freeze({
    entryId: 'unit.rider', appearanceFamily: 'Boughward',
    asset: '/assets/ui/portraits/boughward-rider-source.png', sourceWidth: 552, sourceHeight: 618, contain: true,
  }),
});

export const SIEGE_ENGINE_PORTRAITS = Object.freeze({
  'siege-engine': Object.freeze({
    entryId: 'unit.siege-engine', appearanceFamily: 'Human',
    asset: '/assets/ui/portraits/human-siege-engine-source.png', sourceWidth: 768, sourceHeight: 512,
    cropX: 80, cropY: 28, cropWidth: 598, cropHeight: 442,
  }),
  'boughward-siege-engine': Object.freeze({
    entryId: 'unit.siege-engine', appearanceFamily: 'Boughward',
    asset: '/assets/ui/portraits/boughward-siege-engine-source.png', sourceWidth: 768, sourceHeight: 512,
    cropX: 51, cropY: 14, cropWidth: 683, cropHeight: 446,
  }),
});

const UNIT_PORTRAITS = Object.freeze({ ...WORKER_PORTRAITS, ...INFANTRY_PORTRAITS, ...ARCHER_PORTRAITS, ...SCOUT_PORTRAITS, ...RIDER_PORTRAITS, ...SIEGE_ENGINE_PORTRAITS, ...SPEARMAN_PORTRAITS });

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
  // Long equipment stays intact inside the same slot; other portraits retain
  // their inspected viewport. Clear each mode when stable nodes change roles.
  const rectangular = Number.isFinite(portrait.cropWidth) && Number.isFinite(portrait.cropHeight);
  const size = rectangular ? Math.max(portrait.cropWidth, portrait.cropHeight) : portrait.cropSize;
  const insetX = rectangular ? (size - portrait.cropWidth) / 2 : 0;
  const insetY = rectangular ? (size - portrait.cropHeight) / 2 : 0;
  image.style.width = portrait.contain ? '100%' : `${portrait.sourceWidth / size * 100}%`;
  image.style.height = portrait.contain ? '100%' : 'auto';
  image.style.objectFit = portrait.contain ? 'contain' : '';
  image.style.left = portrait.contain ? '0px' : `${(insetX - portrait.cropX) / size * 100}%`;
  image.style.top = portrait.contain ? '0px' : `${(insetY - portrait.cropY) / size * 100}%`;
  // Contain the equipment rectangle and omit foreign source-cell fragments.
  // Clear clipping on stable nodes when returning to every existing framing mode.
  image.style.clipPath = rectangular ? `inset(${portrait.cropY / portrait.sourceHeight * 100}% ${(portrait.sourceWidth - portrait.cropX - portrait.cropWidth) / portrait.sourceWidth * 100}% ${(portrait.sourceHeight - portrait.cropY - portrait.cropHeight) / portrait.sourceHeight * 100}% ${portrait.cropX / portrait.sourceWidth * 100}%)` : '';
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

// Fixed illustrative view of the admitted default Farm, with its actual state.
// Camera yaw/team standards remain battlefield cues, not inferred HUD facts.
export const FARM_PORTRAIT = Object.freeze({
  entryId: 'building.farm', sourceWidth: 1024,
  cropX: 260, cropY: 420, cropSize: 500,
});
export const FARM_PORTRAITS = Object.freeze(Object.fromEntries([
  ['foundation', 'Foundation · under construction'], ['frame', 'Frame · under construction'],
  ['complete', 'Planted food plot'], ['damaged', 'Planted food plot · damaged'],
  ['critical', 'Planted food plot · critically damaged'], ['exhausted', 'Exhausted food plot'],
  ['exhausted-damaged', 'Exhausted food plot · damaged'],
  ['exhausted-critical', 'Exhausted food plot · critically damaged'],
].map(([state, label]) => [state, Object.freeze({
  ...FARM_PORTRAIT, state, label: `Farm illustration · ${label}`,
  asset: `/assets/buildings/frontier-economy-models-v1/runtime/farm-${state}-view-01.png`,
})])));
const FARM_SYMBOL = Object.freeze({
  entryId: 'building.farm', asset: '/assets/ui/icons/food.svg',
  sourceWidth: 24, cropX: 0, cropY: 0, cropSize: 24,
});
const FARM_SYMBOL_LABEL = 'Food symbol · Farm artwork unavailable.';

export function farmSelectionPortrait(building) {
  if (building?.type !== 'farm') return null;
  let state;
  // The card requires authoritative completion; even 100% progress alone
  // cannot imply food is available from an unfinished plot.
  if (building.complete !== true) {
    if (!Number.isFinite(building.progress)) return null;
    state = building.progress <= 0.275 ? 'foundation' : 'frame';
  } else {
    if (!Number.isFinite(building.harvestStock) || building.harvestStock < 0) return null;
    if (!Number.isFinite(building.hp) || building.hp <= 0
      || !Number.isFinite(building.maxHp) || building.maxHp <= 0) return null;
    const ratio = building.hp / building.maxHp;
    state = ratio <= 0.3 ? 'critical' : ratio <= 0.6 ? 'damaged' : 'complete';
    if (building.harvestStock === 0) state = state === 'complete' ? 'exhausted' : `exhausted-${state}`;
  }
  return FARM_PORTRAITS[state];
}

function updateFarmPortraitFrame(frame, portrait, onFallback) {
  const image = frame.querySelector('img');
  if (!frame.dataset.farmErrorBound) {
    updatePortraitFrame(frame, portrait || FARM_SYMBOL);
    frame.dataset.farmErrorBound = 'true';
    // The ordinary frame listener hides failed art first. Restore the existing
    // symbol immediately; retaining the failed Farm URL prevents snapshot retries.
    image.addEventListener('error', () => {
      if (image.getAttribute('src') !== frame.dataset.farmAsset) return;
      frame.dataset.failedFarmAsset = frame.dataset.farmAsset;
      updatePortraitFrame(frame, FARM_SYMBOL);
      onFallback?.();
    });
  }
  frame.dataset.farmAsset = portrait?.asset || '';
  const shown = portrait && frame.dataset.failedFarmAsset !== portrait.asset ? portrait : FARM_SYMBOL;
  updatePortraitFrame(frame, shown);
  return shown === portrait;
}

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
    artLabel: farmSelectionPortrait(building)?.label || FARM_SYMBOL_LABEL,
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
    attack: `Base attack: ${combat.damage} ${combat.attackClass} vs ${targets.join(' / ')} · ${combat.period}s interval · ${combat.range} cells range${separateStructureDamage ? ` · ${combat.structureDamage} damage vs structures` : ''}${Object.entries(combat.tagMultipliers || {}).map(([tag, multiplier]) => ` · ${multiplier}× damage vs ${tag}`).join('')}`,
    training: `${producers.map(building => building.label).join(' / ') || 'No producer'} · ${cost} · ${definition.trainSeconds}s · ${definition.population} population${definition.requires?.length ? ` · Requires ${definition.requires.map(id => TECHNOLOGY_DEFINITIONS[id]?.label || id).join(' + ')}` : ''}`,
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
  const farmPortrait = building?.type === 'farm' ? farmSelectionPortrait(building) : null;
  const portrait = building?.type === 'farm' ? farmPortrait || FARM_SYMBOL : building
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
    let frame = art.querySelector('.farm-selection-art-frame');
    if (!frame) {
      frame = root.createElement('span'); frame.className = 'farm-selection-art-frame';
      frame.setAttribute('aria-hidden', 'true'); frame.append(art.querySelector('img')); art.prepend(frame);
    }
    const artLabel = art.querySelector('[data-building-art-label]');
    const illustrated = updateFarmPortraitFrame(frame, farmPortrait, () => { artLabel.textContent = FARM_SYMBOL_LABEL; });
    artLabel.textContent = illustrated ? farmFacts.artLabel : FARM_SYMBOL_LABEL;
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
  if (farmFacts) updateFarmPortraitFrame(button.querySelector('.selection-portrait-art'), farmPortrait);
  else updatePortraitFrame(button.querySelector('.selection-portrait-art'), portrait);
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
