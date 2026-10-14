import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { buildingHudFacts, updateBuildingHud } from '../src/client/hud/building-hud.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { isClientStaticAsset } from '../src/server/client-static-assets.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const state = (team = 0) => ({ team, connected: true, matchFinished: false, rallySupported: true, research: {},
  building: { id: 8, team, type: 'barracks', complete: true, hp: 900, maxHp: 1800,
    productionQueue: ['infantry', 'spearman', 'infantry'], trainingProgress: .35, trainingRemaining: 7.3, rallyCell: -1 } });

test('building facts preserve mixed queue order, head progress, ownership and research location', () => {
  const s = state(); let facts = buildingHudFacts(s);
  assert.deepEqual(facts.queue.map(item => item.kind), ['infantry', 'spearman', 'infantry']);
  assert.match(facts.production, /35%.*8s/); assert.equal(facts.stateLabel, 'Training');
  s.research.active = { type: 'attack-upgrade', buildingId: 9, progress: .4 };
  assert.match(buildingHudFacts(s).researchStatus, /40%.*another building/);
  s.research.active.buildingId = 8;
  assert.doesNotMatch(buildingHudFacts(s).researchStatus, /another building/);
  s.building.productionBlocked = true; assert.match(buildingHudFacts(s).production, /spawn space/);
  s.building.complete = false; s.building.progress = .99;
  assert.match(buildingHudFacts(s).stateLabel, /Under construction.*99%/);
  s.building.team = 1; assert.equal(buildingHudFacts(s), null);
  s.team = null; assert.equal(buildingHudFacts(s), null);
  s.team = 1; s.building.hp = 0; assert.equal(buildingHudFacts(s), null);
});

test('utility identity follows actual Farm, drop-off, gate, tower and population definitions', () => {
  const s = state();
  const facts = (type, patch = {}) => buildingHudFacts({ ...s, profileId: 'stone-defense-v1',
    building: { ...s.building, type, productionQueue: [], ...patch } });
  assert.match(facts('farm', { harvestStock: 0 }).stateLabel, /Exhausted/);
  assert.match(facts('farm', { harvestStock: 137 }).description, /137 food/);
  assert.match(facts('storehouse').description, /food.*wood.*stone/);
  assert.equal(facts('mill').description, 'Drop-off · food');
  assert.match(facts('palisade-gate', { gateOpen: true }).description, /both teams may pass/);
  assert.match(facts('watchtower').description, /7 cell range/);
  assert.match(facts('house').description, new RegExp(`${BUILDING_DEFINITIONS.house.populationCapacity} population`));
  assert.deepEqual(facts('dock').products, ['skiff']);
});

for (const team of [0, 1]) test(`seat ${team}: stable building dock, research Escape and reconnect authority`, t => {
  const dom = new JSDOM(html); t.after(() => dom.window.close());
  const d = dom.window.document, s = state(team), actions = [], sent = [];
  const bar = d.querySelector('.contextual-command-bar'); bar.hidden = false;
  const panel = d.querySelector('[data-building-hud]');
  const product = d.createElement('button'); product.dataset.product = 'infantry';
  product.addEventListener('click', () => sent.push('train'));
  panel.querySelector('[data-context-products]').append(product);
  const technology = d.createElement('button'); technology.dataset.technology = 'attack-upgrade';
  panel.querySelector('[data-context-research-options]').append(technology);
  const update = () => updateBuildingHud(d, s, action => actions.push(action));
  const action = name => panel.querySelector(`[data-building-action="${name}"]`);
  update(); assert.equal(panel.hidden, false); assert.equal(bar.querySelector(':scope > .contextual-actions').hidden, true);
  product.focus(); s.building.hp = 700; s.building.trainingProgress = .5; update();
  assert.equal(d.activeElement, product); assert.match(d.querySelector('[data-building-hp]').textContent, /700 \/ 1800/);
  assert.equal(panel.querySelectorAll('[data-building-queue-list] li').length, 3);
  action('research').click(); assert.equal(d.activeElement, technology);
  assert.equal(panel.querySelector('#building-research-panel').hidden, false);
  technology.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(d.activeElement, action('research')); assert.equal(panel.querySelector('#building-research-panel').hidden, true);
  action('rally').click(); assert.equal(actions.at(-1), 'rally');
  s.connected = false; update(); product.click(); action('rally').click();
  assert.deepEqual(sent, []); assert.deepEqual(actions, ['rally']);
  assert.match(panel.querySelector('[data-building-hint]').textContent, /Reconnecting/);
  s.connected = true; product.setAttribute('aria-disabled', 'false'); update(); product.click(); assert.deepEqual(sent, ['train']);
  action('research').click(); s.building.id = 9; update();
  assert.equal(panel.querySelector('#building-research-panel').hidden, true);
  s.building.type = 'dock'; s.rallySupported = false; update();
  assert.equal(action('rally').hidden, true); assert.equal(action('clear-rally').hidden, true);
  assert.equal(action('research').hidden, true);
  assert.match(panel.querySelector('[data-building-hint]').textContent, /Move boats after training/);
  s.building = null; update(); assert.equal(panel.hidden, true);
});

for (const team of [0, 1]) test(`seat ${team}: queue cancellation binds a paid slot, retains focus and refuses stale UI`, t => {
  const dom = new JSDOM(html); t.after(() => dom.window.close());
  const d = dom.window.document, s = state(team), actions = [];
  d.querySelector('.contextual-command-bar').hidden = false;
  const update = () => updateBuildingHud(d, s, (action, request) => actions.push({ action, request }));
  const buttons = () => [...d.querySelectorAll('[data-queue-index]')];
  update();
  const middle = buttons()[1]; middle.focus();
  assert.match(middle.getAttribute('aria-label'), /Cancel Spearman.*position 2.*full food and wood refund/);
  assert.match(buttons()[0].title, /refund remaining training only.*refunds nothing/);
  s.building.trainingProgress = .5; update();
  assert.equal(buttons()[1], middle); assert.equal(d.activeElement, middle);
  middle.click();
  assert.deepEqual(actions, [{ action: 'cancel-training', request: { buildingId: 8, queueIndex: 1,
    expectedQueue: ['infantry', 'spearman', 'infantry'] } }]);
  s.building.productionQueue = ['infantry', 'infantry']; update();
  assert.equal(d.activeElement, buttons()[1], 'focus moves to the next paid slot');
  middle.click(); assert.equal(actions.length, 1, 'detached controls cannot cancel a shifted queue');
  s.building.productionQueue = ['infantry'];
  buttons()[1].click(); assert.equal(actions.length, 1, 'activation rechecks an unrendered snapshot change');
  assert.equal(buttons().length, 1);
  for (const patch of [{ connected: false }, { matchFinished: true }]) {
    Object.assign(s, patch); update();
    assert.equal(buttons()[0].getAttribute('aria-disabled'), 'true'); buttons()[0].click();
    assert.equal(actions.length, 1); Object.assign(s, { connected: true, matchFinished: false });
  }
  update(); buttons()[0].click(); assert.equal(actions.length, 2);
  s.building.complete = false; update(); buttons()[0].click(); assert.equal(actions.length, 2);
  s.building.complete = true; s.building.team = 1 - team; update(); buttons()[0].click(); assert.equal(actions.length, 2);
  s.building.team = team; update(); buttons()[0].focus();
  s.building.productionQueue = []; update();
  assert.equal(buttons().length, 0); assert.equal(d.activeElement.closest('[data-queue-index]'), null);
});

test('every registered producer exposes its disclosed queue, including home, expansion and Dock', t => {
  const dom = new JSDOM(html); t.after(() => dom.window.close());
  const d = dom.window.document, s = state(), requests = [];
  d.querySelector('.contextual-command-bar').hidden = false;
  for (const [type, rule] of Object.entries(BUILDING_DEFINITIONS)) {
    if (!rule.products.length) continue;
    for (const home of type === 'town-center' ? [true, false] : [false]) {
      s.building = { ...s.building, id: s.building.id + 1, type, home, productionQueue: [...rule.products] };
      updateBuildingHud(d, s, (action, request) => requests.push({ action, request }));
      d.querySelector('[data-queue-index="0"]').click();
      assert.deepEqual(requests.at(-1), { action: 'cancel-training', request: {
        buildingId: s.building.id, queueIndex: 0, expectedQueue: [...rule.products] } });
    }
  }
});

test('shared dock and building files ship, with one stylesheet import each', () => {
  for (const file of ['selection-hud.css', 'building-hud.css', 'building-hud.mjs'])
    assert.equal(isClientStaticAsset(`src/client/hud/${file}`), true, file);
  for (const file of ['selection-hud.css', 'worker-hud.css', 'building-hud.css'])
    assert.equal(html.split(`href="./src/client/hud/${file}"`).length - 1, 1, file);
});
