import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { workerBuildChoices, workerHudFacts, updateWorkerHud } from '../src/client/hud/worker-hud.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { isClientStaticAsset } from '../src/server/client-static-assets.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const worker = { id: 8, generation: 2, hp: 64, kind: 'worker', task: 'gathering', cargo: 3.125, cargoType: 'stone' };
const state = () => ({ active: true, workers: [{ ...worker }], team: 0, connected: true, matchFinished: false,
  resources: { food: 100, wood: 200, stone: 49.9 }, profileId: 'stone-defense-v1', research: {},
  placementPending: false, placementActive: null, targetMode: null });

test('Worker facts use current tasks, typed cargo, total health, and generation identity', () => {
  const one = workerHudFacts(state());
  assert.equal(one.name, 'Worker'); assert.equal(one.task, 'Gathering'); assert.equal(one.cargo, '3 stone');
  assert.equal(one.hp, 64); assert.equal(one.maxHp, UNIT_DEFINITIONS.worker.combat.maxHp);
  const many = workerHudFacts({ profileId: 'stone-defense-v1', workers: [worker, { ...worker, id: 9, generation: 7, hp: 20, task: 'returning', cargo: 7, cargoType: 'wood' }] });
  assert.equal(many.name, '2 Workers'); assert.equal(many.task, '1 gathering · 1 returning cargo');
  assert.equal(many.cargo, '3 stone · 7 wood'); assert.equal(many.hp, 84); assert.equal(many.key, '8:2,9:7');
});

test('construction explains actual fractional shortages, Stone profile, research and connection gates', () => {
  const s = state(), choice = id => workerBuildChoices(s).find(row => row.id === id);
  assert.match(choice('watchtower').reason, /Need 1 stone/);
  assert.match(choice('watchtower').cost, /50 stone/);
  s.profileId = 'food-wood-v1'; assert.doesNotMatch(choice('watchtower').cost, /stone/);
  assert.equal(choice('watchtower').reason, '');
  assert.match(choice('workshop').reason, /Requires MILITARY TIER II/);
  s.research.militaryTier2 = true; assert.match(choice('workshop').reason, /Need 50 wood/);
  s.resources.wood = 250; assert.equal(choice('workshop').reason, '');
  s.placementPending = true; assert.match(choice('workshop').reason, /Waiting/);
  s.connected = false; assert.equal(choice('workshop').reason, 'Reconnecting');
});

test('Worker controls stay stable through live updates; unavailable actions are inspectable and inert', t => {
  const dom = new JSDOM(html); t.after(() => dom.window.close());
  const d = dom.window.document, s = state(), actions = [];
  d.querySelector('.contextual-command-bar').hidden = false;
  const update = () => updateWorkerHud(d, s, (...args) => actions.push(args));
  update(); const action = name => d.querySelector(`[data-worker-action="${name}"]`);
  assert.equal(d.querySelector('.contextual-actions').hidden, true);
  const gather = action('gather'); gather.focus();
  s.workers[0].cargo = 5; s.workers[0].hp = 50; update();
  assert.equal(d.activeElement, gather); assert.equal(action('gather'), gather);
  assert.equal(d.querySelector('[data-worker-hp]').textContent, `50 / ${UNIT_DEFINITIONS.worker.combat.maxHp} HP`);
  gather.click(); assert.equal(actions.at(-1)[0], 'gather');
  s.workers[0].cargo = 0; update();
  const count = actions.length; action('return').focus(); action('return').click();
  assert.equal(d.activeElement, action('return')); assert.equal(actions.length, count);
  assert.equal(action('return').title, 'No cargo to return.');
  action('build').click();
  const workshop = d.querySelector('[data-worker-build="workshop"]'); workshop.focus(); workshop.click();
  assert.equal(d.activeElement, workshop); assert.equal(actions.at(-1)[0], 'dismiss-target');
  s.research.militaryTier2 = true; s.resources.wood = 300; update();
  assert.equal(d.activeElement, workshop); assert.equal(workshop.getAttribute('aria-disabled'), 'false');
  workshop.click(); assert.deepEqual(actions.at(-1), ['construct', 'workshop']);
  s.connected = false; update(); gather.click();
  assert.deepEqual(actions.at(-1), ['construct', 'workshop']);
  assert.match(d.querySelector('[data-worker-hint]').textContent, /Reconnecting/);
});

test('local disclosures close on a changed generation or incompatible selection and Escape keeps selection intact', t => {
  const dom = new JSDOM(html); t.after(() => dom.window.close());
  const d = dom.window.document, s = state();
  d.querySelector('.contextual-command-bar').hidden = false;
  const update = () => updateWorkerHud(d, s, () => {});
  const build = d.querySelector('[data-worker-action="build"]'), palette = d.querySelector('#worker-build-palette');
  update(); build.click(); assert.equal(palette.hidden, false);
  d.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(palette.hidden, true); assert.equal(d.activeElement, build);
  build.click(); s.workers[0].generation++; update(); assert.equal(palette.hidden, true);
  build.click(); s.active = false; update();
  assert.equal(d.querySelector('[data-worker-hud]').hidden, true);
  assert.equal(d.querySelector('.contextual-actions').hidden, false);
  s.active = true; update(); assert.equal(palette.hidden, true);
});

test('Worker assets have exact public admission; study source and font provenance stay private', () => {
  for (const file of ['src/client/hud/worker-hud.mjs', 'src/client/hud/worker-hud.css',
    'assets/ui/fonts/dm-sans.ttf', 'assets/ui/fonts/barlow-condensed-medium.ttf',
    'assets/ui/fonts/dm-sans-OFL.txt', 'assets/ui/fonts/barlow-condensed-OFL.txt']) assert.equal(isClientStaticAsset(file), true, file);
  for (const file of ['src/studies/hud-component-specimen/runtime.mjs', 'assets/ui/fonts/provenance.json',
    'assets/ui/fonts/arbitrary.ttf']) assert.equal(isClientStaticAsset(file), false, file);
});
