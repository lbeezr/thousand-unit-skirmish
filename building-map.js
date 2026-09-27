const BUILDING_ASSET_ROOT = './assets/buildings';
const states = [
  { key: 'foundation', label: 'Foundation', detail: '5% construction' },
  { key: 'frame', label: 'Frame', detail: '50% construction' },
  { key: 'complete', label: 'Complete', detail: 'Finished · intact' },
  { key: 'damaged', label: 'Damaged', detail: '60% health' },
  { key: 'critical', label: 'Critical', detail: '30% health' },
];
const teams = ['azure', 'ember'];

function element(tag, className, text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function imageStage(src, alt, label = '') {
  const figure = element('figure', 'team-frame');
  const stage = element('div', 'image-stage');
  const image = document.createElement('img');
  image.src = src;
  image.alt = alt;
  image.width = 640;
  image.height = 640;
  image.loading = 'lazy';
  image.decoding = 'async';
  stage.append(image);
  figure.append(stage);
  if (label) figure.append(element('figcaption', '', label));
  return figure;
}

function card(title, detail, badge, badgeClass, image) {
  const article = element('article', 'variant-card');
  const stage = element('div', 'image-stage');
  const img = document.createElement('img');
  img.src = image.src;
  img.alt = image.alt;
  img.width = 640;
  img.height = 640;
  img.loading = 'lazy';
  img.decoding = 'async';
  stage.append(img);
  const copy = element('div', 'card-copy');
  copy.append(element('h3', '', title));
  copy.append(element('p', '', detail));
  copy.append(element('span', `tag ${badgeClass}`, badge));
  article.append(stage, copy);
  return article;
}

function stateReviewCard(state) {
  const article = element('article', 'variant-card lifecycle-review-card');
  const stage = element('div', 'image-stage contact-sheet-stage');
  const image = document.createElement('img');
  image.src = state.contactSheet;
  image.alt = `${state.label} Town Center Meshy model shown from eight captured camera directions`;
  image.width = 2560;
  image.height = 1348;
  image.loading = 'lazy';
  image.decoding = 'async';
  stage.append(image);
  const copy = element('div', 'card-copy');
  copy.append(element('h3', '', state.label));
  copy.append(element('p', '', state.detail));
  copy.append(element('span', 'tag reference', 'MESHY MODEL · REVIEW ONLY'));

  const details = element('details', 'angle-details');
  details.append(element('summary', '', 'Show all eight individual views'));
  const grid = element('div', 'variant-grid angle-grid');
  for (let view = 0; view < 8; view += 1) {
    const index = String(view).padStart(2, '0');
    grid.append(card(
      `View ${String(view + 1).padStart(2, '0')}`,
      `${view * 45}° azimuth · 46° elevation`,
      'MESHY REFERENCE',
      'reference',
      {
        src: state.viewSource(index),
        alt: `${state.label} Town Center model at ${view * 45} degrees`,
      },
    ));
  }
  details.append(grid);
  article.append(stage, copy, details);
  return article;
}

function pairedStateCard(building, state) {
  const article = element('article', 'variant-card');
  const pair = element('div', 'team-pair');
  for (const team of teams) {
    pair.append(imageStage(
      `${BUILDING_ASSET_ROOT}/${building.folder}/runtime/${building.stem}-${state.key}-${team}.webp`,
      `${team} ${building.name.toLowerCase()} ${state.label.toLowerCase()} sprite`,
      team.toUpperCase(),
    ));
  }
  const copy = element('div', 'card-copy');
  copy.append(element('h3', '', state.label));
  copy.append(element('p', '', state.detail));
  copy.append(element('span', 'tag runtime', 'RUNTIME SPRITE'));
  article.append(pair, copy);
  return article;
}

function render() {
  const concepts = document.querySelector('#town-center-concepts');
  const conceptRoot = `${BUILDING_ASSET_ROOT}/town-center-state-concepts-v1/source`;
  for (const state of states) {
    const tag = state.key === 'complete' ? 'SOURCE BASELINE' : 'CONCEPT ONLY';
    concepts.append(card(
      state.label,
      state.detail,
      tag,
      'concept',
      {
        src: `${conceptRoot}/town-center-${state.key}.png`,
        alt: `Town Center ${state.label.toLowerCase()} source concept, transparent background`,
      },
    ));
  }

  const current = document.querySelector('#town-center-runtime');
  for (const team of teams) {
    current.append(card(
      `${team} · Complete`,
      'Single authored view · deployed game sprite',
      'RUNTIME SPRITE',
      'runtime',
      {
        src: `${BUILDING_ASSET_ROOT}/town-center-sprite-v1/runtime/town-center-complete-${team}.webp`,
        alt: `${team} Town Center complete runtime sprite`,
      },
    ));
  }

  const lifecycleRoot = `${BUILDING_ASSET_ROOT}/town-center-lifecycle-meshy-v1`;
  const pilotRoot = `${BUILDING_ASSET_ROOT}/town-center-meshy-review-v1`;
  const lifecycleModels = [
    {
      key: 'foundation', label: 'Foundation', detail: '5% construction · 100,459 triangles',
      contactSheet: `${lifecycleRoot}/previews/town-center-foundation-eight-view.webp`,
      viewSource: (index) => `${lifecycleRoot}/runtime/town-center-foundation-view-${index}.webp`,
    },
    {
      key: 'frame', label: 'Frame', detail: '50% construction · 100,207 triangles',
      contactSheet: `${lifecycleRoot}/previews/town-center-frame-eight-view.webp`,
      viewSource: (index) => `${lifecycleRoot}/runtime/town-center-frame-view-${index}.webp`,
    },
    {
      key: 'complete', label: 'Complete', detail: 'Finished · intact · 98,940 triangles',
      contactSheet: `${lifecycleRoot}/previews/town-center-complete-eight-view.webp`,
      viewSource: (index) => `${pilotRoot}/runtime/town-center-view-${index}.webp`,
    },
    {
      key: 'damaged', label: 'Damaged', detail: '60% health · 99,409 triangles',
      contactSheet: `${lifecycleRoot}/previews/town-center-damaged-eight-view.webp`,
      viewSource: (index) => `${lifecycleRoot}/runtime/town-center-damaged-view-${index}.webp`,
    },
    {
      key: 'critical', label: 'Critical', detail: '30% health · 101,278 triangles',
      contactSheet: `${lifecycleRoot}/previews/town-center-critical-eight-view.webp`,
      viewSource: (index) => `${lifecycleRoot}/runtime/town-center-critical-view-${index}.webp`,
    },
  ];
  const meshy = document.querySelector('#town-center-meshy');
  for (const state of lifecycleModels) meshy.append(stateReviewCard(state));

  const buildingPacks = [
    { target: 'barracks-states', folder: 'barracks-sprite-test-v1', stem: 'barracks', name: 'Barracks' },
    { target: 'archery-range-states', folder: 'archery-range-sprite-v1', stem: 'archery-range', name: 'Archery Range' },
  ];
  for (const building of buildingPacks) {
    const grid = document.getElementById(building.target);
    for (const state of states) grid.append(pairedStateCard(building, state));
  }
}

const filterButtons = [...document.querySelectorAll('[data-building-filter]')];
const buildingSections = [...document.querySelectorAll('[data-building]')];
const filterStatus = document.querySelector('#filter-status');

for (const button of filterButtons) {
  button.addEventListener('click', () => {
    const filter = button.dataset.buildingFilter;
    for (const section of buildingSections) {
      section.hidden = filter !== 'all' && section.dataset.building !== filter;
    }
    for (const candidate of filterButtons) {
      candidate.setAttribute('aria-pressed', String(candidate === button));
    }
    const label = button.textContent.trim();
    filterStatus.textContent = filter === 'all' ? 'Showing all building variants' : `Showing ${label} variants`;
  });
}

render();
