import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeMatchMode, matchModeDefinition, assertMatchModeCompatibility,
  effectiveMapForMatchMode, matchModeCatalog, NORMAL_MATCH_MAP_ID,
  NORMAL_HUMAN_MATCH_MODE } from '../src/match-modes.mjs';

const authored = { matchModeId: 'authored', matchModeVersion: 1 };
const objective = { matchModeId: 'objective-control', matchModeVersion: 1 };
const skirmish = { matchModeId: 'skirmish', matchModeVersion: 1 };
const bannerfall = { matchModeId: 'bannerfall', matchModeVersion: 1 };
const arena = JSON.parse(readFileSync(new URL('../maps/bannerfall-arena.json', import.meta.url)));
const maps = ['bellweather-millrace', 'underbough-rootways'].map(id =>
  JSON.parse(readFileSync(new URL(`../maps/${id}.json`, import.meta.url))));

test('canonical metadata cannot opt another mode into Bannerfall UI rules', () => {
  const canonical = structuredClone(maps[0]); canonical.bannerfall = { version: 1 };
  for (const mode of [authored, objective, skirmish]) {
    const effective = effectiveMapForMatchMode(canonical, mode);
    assert.equal(Object.hasOwn(effective, 'bannerfall'), false);
    assert.equal(canonical.bannerfall.version, 1);
    if (mode !== skirmish) {
      assert.equal(effective.timedVictory.afterSeconds, 900);
      assert.ok(effective.triggers.some(trigger => trigger.victory === true));
    }
  }
});
function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

test('reviewed Small supports human Skirmish with its exact authored geometry and bonus rules', () => {
  const map = deepFreeze(JSON.parse(readFileSync(new URL('../maps/veyrholds-threefold-basin.json', import.meta.url))));
  assert.deepEqual([map.width, map.height], [192, 192]);
  assert.equal(assertMatchModeCompatibility(skirmish, map).id, 'skirmish');
  assert.equal(assertMatchModeCompatibility(skirmish, map, { practice: true }).id, 'skirmish');
  assert.throws(() => assertMatchModeCompatibility(skirmish, map, { mode: 'pve' }), /does not support PvE/);
  assert.equal(assertMatchModeCompatibility(skirmish, map).pveSupported, false);
  assert.equal(matchModeCatalog(map).find(mode => mode.id === 'skirmish').pveSupported, false);
  assert.deepEqual(matchModeCatalog(map, { mode: 'pve' }).map(mode => mode.id), ['authored']);
  assert.deepEqual(effectiveMapForMatchMode(map, skirmish), map);
  assert.ok(map.triggers.every(trigger => trigger.victory === false));
  assert.equal(Object.hasOwn(map, 'timedVictory'), false);
  assert.equal(matchModeDefinition(NORMAL_HUMAN_MATCH_MODE).defaultMapId, NORMAL_MATCH_MAP_ID);
});

test('reviewed Medium supports ordinary human Skirmish and retains exact224 geometry, economy and fog', () => {
  const map = deepFreeze(JSON.parse(readFileSync(new URL('../maps/veyrholds-riven-escarpment.json', import.meta.url))));
  assert.deepEqual([map.width, map.height, map.startingArmySize, map.fogOfWar], [224, 224, 24, true]);
  assert.deepEqual(map.startingResources, { food: 150, wood: 250 });
  for (const options of [{ mode: 'pvp' }, { mode: 'pvp', practice: true }]) {
    const descriptor = assertMatchModeCompatibility(skirmish, map, options);
    assert.equal(descriptor.id, 'skirmish');
    assert.equal(descriptor.selectable, true);
    assert.equal(descriptor.pveSupported, false);
  }
  assert.deepEqual(matchModeCatalog(map).map(mode => mode.id), ['authored', 'skirmish']);
  assert.throws(() => assertMatchModeCompatibility(skirmish, map, { mode: 'pve' }), /AI is accepted only on Terraced Vale/);
  assert.deepEqual(matchModeCatalog(map, { mode: 'pve' }).map(mode => mode.id), ['authored']);
  assert.deepEqual(effectiveMapForMatchMode(map, skirmish), map);
  assert.deepEqual(map.triggers, []);
  assert.deepEqual(map.scenarioEvents, []);
  assert.equal(Object.hasOwn(map, 'timedVictory'), false);
  assert.equal(matchModeDefinition(NORMAL_HUMAN_MATCH_MODE).defaultMapId, NORMAL_MATCH_MAP_ID);
  assert.deepEqual(matchModeDefinition(skirmish).pveMapIds, [NORMAL_MATCH_MAP_ID]);
});

test('reviewed Large supports ordinary human Skirmish and retains exact256 geometry, economy and fog', () => {
  const map = deepFreeze(JSON.parse(readFileSync(new URL('../maps/veyrholds-crownroads.json', import.meta.url))));
  assert.deepEqual([map.width, map.height, map.startingArmySize, map.fogOfWar], [256, 256, 24, true]);
  assert.deepEqual(map.startingResources, { food: 150, wood: 250 });
  for (const options of [{ mode: 'pvp' }, { mode: 'pvp', practice: true }]) {
    const descriptor = assertMatchModeCompatibility(skirmish, map, options);
    assert.equal(descriptor.id, 'skirmish');
    assert.equal(descriptor.selectable, true);
    assert.equal(descriptor.pveSupported, false);
  }
  assert.deepEqual(matchModeCatalog(map).map(mode => mode.id), ['authored', 'skirmish']);
  assert.throws(() => assertMatchModeCompatibility(skirmish, map, { mode: 'pve' }), /AI is accepted only on Terraced Vale/);
  assert.deepEqual(matchModeCatalog(map, { mode: 'pve' }).map(mode => mode.id), ['authored']);
  assert.deepEqual(effectiveMapForMatchMode(map, skirmish), map);
  assert.deepEqual(map.triggers, []);
  assert.deepEqual(map.scenarioEvents, []);
  assert.equal(Object.hasOwn(map, 'timedVictory'), false);
  assert.equal(matchModeDefinition(NORMAL_HUMAN_MATCH_MODE).defaultMapId, NORMAL_MATCH_MAP_ID);
  assert.deepEqual(matchModeDefinition(skirmish).pveMapIds, [NORMAL_MATCH_MAP_ID]);
});

test('legacy omission preserves authored identity independently of opponent setup', () => {
  for (const options of [undefined, {}, { mode: 'pvp' }, { mode: 'pve', practice: false }]) {
    assert.deepEqual(normalizeMatchMode(options), authored);
  }
  for (const mode of [authored, objective, skirmish]) {
    assert.deepEqual(normalizeMatchMode({ mode: 'pvp', ...mode }), mode);
  }
});

test('partial, unknown and malformed mode identities reject without coercion', () => {
  for (const value of [null, [], 'skirmish', 1]) assert.throws(() => normalizeMatchMode(value), /object/);
  for (const value of [{ matchModeId: 'skirmish' }, { matchModeVersion: 1 },
    { matchModeId: undefined }]) {
    assert.throws(() => normalizeMatchMode(value), /both matchModeId and matchModeVersion/);
  }
  for (const id of [undefined, null, '', 'unknown', 'Skirmish', ' skirmish']) {
    assert.throws(() => normalizeMatchMode({ matchModeId: id, matchModeVersion: 1 }), /Unsupported matchModeId/);
  }
  for (const version of [undefined, null, 0, 2, '1', 1.5, true]) {
    assert.throws(() => normalizeMatchMode({ matchModeId: 'skirmish', matchModeVersion: version }), /Unsupported matchModeVersion/);
  }
});

test('registry exposes the agreed policy and honest AI support as immutable descriptors', () => {
  assert.deepEqual(matchModeDefinition(), { id: 'authored', version: 1, label: 'Authored Rules',
    victoryPolicy: 'authored', aiStrategyId: 'capture-posts', pveSupported: true, selectable: false,
    defaultMapId: 'veyrholds-terraced-vale' });
  assert.deepEqual(matchModeDefinition(objective), { id: 'objective-control', version: 1, label: 'Objective Control',
    victoryPolicy: 'authored', aiStrategyId: 'capture-posts', pveSupported: true, selectable: true,
    defaultMapId: 'woodland-expanse' });
  assert.deepEqual(matchModeDefinition(skirmish), { id: 'skirmish', version: 1, label: 'Skirmish',
    victoryPolicy: 'recovery-elimination', aiStrategyId: 'base-elimination', pveSupported: true,
    pveMapIds: [NORMAL_MATCH_MAP_ID], selectable: true,
    defaultMapId: 'veyrholds-terraced-vale' });
  assert.throws(() => { matchModeDefinition(skirmish).pveSupported = false; }, TypeError);
  assert.throws(() => { matchModeDefinition(skirmish).pveMapIds.push('veyrholds-threefold-basin'); }, TypeError);
});

test('Bannerfall advertises its fixed human arena without changing implicit authored defaults', () => {
  assert.deepEqual(normalizeMatchMode(bannerfall), bannerfall);
  assert.deepEqual(matchModeDefinition(bannerfall), { id: 'bannerfall', version: 1, label: 'Bannerfall',
    victoryPolicy: 'designated-stronghold', aiStrategyId: 'unsupported', pveSupported: false,
    selectable: true, defaultMapId: 'bannerfall-arena', fixedArmySize: 16 });
  assert.throws(() => { matchModeDefinition(bannerfall).fixedArmySize = 250; }, TypeError);
  assert.deepEqual(normalizeMatchMode(), authored);
  assert.deepEqual(effectiveMapForMatchMode(arena), arena);
  assert.equal(Object.hasOwn(effectiveMapForMatchMode(arena), 'bannerfall'), false,
    'arena identity alone does not select Bannerfall');
  assert.deepEqual(matchModeCatalog(arena).map(mode => mode.id), ['authored', 'bannerfall']);
  assert.deepEqual(matchModeCatalog(arena, { mode: 'pvp', practice: true }).map(mode => mode.id), ['authored', 'bannerfall']);
  assert.deepEqual(matchModeCatalog(arena, { mode: 'pve' }).map(mode => mode.id), ['authored']);
});

test('Bannerfall rejects other maps and unsupported AI instead of substituting a selection', () => {
  for (const map of [...maps, { ...arena, id: 'another-arena' }]) {
    assert.throws(() => assertMatchModeCompatibility(bannerfall, map), /Bannerfall.*not compatible/);
    assert.throws(() => effectiveMapForMatchMode(map, bannerfall), /Bannerfall.*not compatible/);
    assert.equal(matchModeCatalog(map).some(mode => mode.id === 'bannerfall'), false);
  }
  assert.equal(assertMatchModeCompatibility(bannerfall, arena).id, 'bannerfall');
  assert.equal(assertMatchModeCompatibility(bannerfall, arena, { mode: 'pvp', practice: true }).id, 'bannerfall');
  assert.throws(() => assertMatchModeCompatibility(bannerfall, arena, { mode: 'pve' }),
    /Bannerfall supports human matches and Practice; its AI is not implemented/);
  assert.throws(() => assertMatchModeCompatibility(skirmish, arena), /not compatible/);
  assert.throws(() => assertMatchModeCompatibility(objective, arena), /not compatible/);
});

test('Bannerfall projection fixes the opening and removes economy/objectives without mutating canonical metadata', () => {
  const canonical = deepFreeze({ ...structuredClone(arena), startingArmySize: 250,
    startingResources: { food: 150, wood: 250 },
    resourceNodes: [{ id: 'supply', type: 'food', x: 0, z: 10, stock: 100 }],
    triggers: [{ id: 'post', name: 'Post', type: 'capture-zone',
      zone: { column: 20, row: 20, width: 4, height: 4 }, requiredUnits: 1, captureSeconds: 5, victory: true }],
    scenarioEvents: [{ id: 'relief', type: 'timed-supply', afterSeconds: 120, team: 'both', foodReward: 100 }],
    victoryHoldSeconds: 20, timedVictory: { afterSeconds: 900, objectiveId: 'post' } });
  const before = structuredClone(canonical);
  const effective = effectiveMapForMatchMode(canonical, bannerfall);
  assert.equal(effective.startingArmySize, 16);
  assert.deepEqual(effective.startingResources, { food: 0, wood: 0 });
  assert.deepEqual(effective.resourceNodes, []);
  assert.deepEqual(effective.triggers, []);
  assert.deepEqual(effective.scenarioEvents, []);
  assert.equal(Object.hasOwn(effective, 'victoryHoldSeconds'), false);
  assert.equal(Object.hasOwn(effective, 'timedVictory'), false);
  assert.deepEqual(effective.bannerfall, { version: 1, waveSeconds: 15, waveSize: 2, populationCap: 12,
    evolutionKills: 6, openingArmySize: 16, initialKind: 'infantry', evolvedKind: 'rider', mapId: 'bannerfall-arena' });
  for (const key of ['id', 'name', 'summary', 'width', 'height', 'terrainSeed', 'terrainBase', 'fogOfWar', 'spawnPoints', 'obstacles']) {
    assert.deepEqual(effective[key], canonical[key], key);
  }
  assert.deepEqual(canonical, before);
  effective.spawnPoints[0].x = 0;
  effective.bannerfall.waveSeconds = 1;
  assert.deepEqual(canonical, before);
  assert.equal(effectiveMapForMatchMode(canonical, bannerfall).bannerfall.waveSeconds, 15);
});

test('accepted Tiny supports human and AI Skirmish without changing authored economy or objectives', () => {
  assert.equal(NORMAL_MATCH_MAP_ID, 'veyrholds-terraced-vale');
  assert.deepEqual(NORMAL_HUMAN_MATCH_MODE, skirmish);
  assert.throws(() => { NORMAL_HUMAN_MATCH_MODE.matchModeId = 'authored'; }, TypeError);
  const map = deepFreeze(JSON.parse(readFileSync(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url))));
  assert.deepEqual([map.width, map.height], [160, 160]);
  assert.equal(assertMatchModeCompatibility(skirmish, map).id, 'skirmish');
  assert.equal(assertMatchModeCompatibility(skirmish, map, { mode: 'pvp', practice: true }).id, 'skirmish');
  assert.equal(assertMatchModeCompatibility(skirmish, map, { mode: 'pve' }).pveSupported, true);
  assert.throws(() => assertMatchModeCompatibility(objective, map), /not compatible/);
  assert.deepEqual(matchModeCatalog(map).map(mode => mode.id), ['authored', 'skirmish']);
  assert.deepEqual(matchModeCatalog(map, { mode: 'pvp', practice: true }).map(mode => mode.id), ['authored', 'skirmish']);
  assert.deepEqual(matchModeCatalog(map, { mode: 'pve' }).map(mode => mode.id), ['authored', 'skirmish']);
  const effective = effectiveMapForMatchMode(map, skirmish);
  assert.deepEqual(effective, map, 'Tiny already has bonus-only posts and no hold or deadline');
  assert.notEqual(effective, map);
  assert.notEqual(effective.triggers, map.triggers);
  assert.deepEqual(effective.triggers.map(trigger => [trigger.foodReward, trigger.woodReward, trigger.victory]),
    [[75, 50, false], [75, 50, false]]);
  assert.equal(Object.hasOwn(effective, 'timedVictory'), false);
  assert.equal(Object.hasOwn(effective, 'victoryHoldSeconds'), false);
});

for (const original of maps) {
  test(`${original.id}: authored and Objective Control preserve exact map content in independent clones`, () => {
    const map = deepFreeze(structuredClone(original));
    for (const mode of [undefined, authored, objective]) {
      const effective = effectiveMapForMatchMode(map, mode);
      assert.deepEqual(effective, original);
      assert.notEqual(effective, map);
      assert.notEqual(effective.triggers, map.triggers);
      effective.triggers[0].foodReward = 999;
      assert.equal(map.triggers[0].foodReward, 75);
    }
    assert.deepEqual(map, original);
  });

  test(`${original.id}: Skirmish removes every capture victory while preserving rewards and economy`, () => {
    const map = deepFreeze(structuredClone(original));
    const effective = effectiveMapForMatchMode(map, skirmish);
    assert.equal(effective.triggers.some(trigger => trigger.victory === true), false);
    assert.equal(Object.hasOwn(effective, 'victoryHoldSeconds'), false);
    assert.equal(Object.hasOwn(effective, 'timedVictory'), false);
    assert.deepEqual(effective.triggers.map(trigger =>
      [trigger.requiredUnits, trigger.captureSeconds, trigger.foodReward, trigger.woodReward]),
    original.id === 'bellweather-millrace'
      ? [[5, 9, 75, 50], [5, 9, 75, 50], [8, 12, 0, 0]]
      : [[5, 9, 75, 50], [5, 9, 75, 50], [4, 12, 75, 120]]);
    for (let index = 0; index < map.triggers.length; index++) {
      for (const key of Object.keys(map.triggers[index]).filter(key => key !== 'victory')) {
        assert.deepEqual(effective.triggers[index][key], map.triggers[index][key], `post ${index}: ${key}`);
      }
    }
    assert.deepEqual(effective.scenarioEvents, [{ id: 'relief', name: 'Traveling supplies',
      type: 'timed-supply', afterSeconds: 120, team: 'both', foodReward: 100, woodReward: 75 }]);
    assert.equal(effective.startingArmySize, 24);
    assert.deepEqual(effective.startingResources, { food: 150, wood: 250 });
    for (const key of Object.keys(map).filter(key =>
      !['triggers', 'victoryHoldSeconds', 'timedVictory'].includes(key))) {
      assert.deepEqual(effective[key], map[key], key);
    }
    assert.deepEqual(map, original);
    effective.triggers[0].zone.column = 0;
    effective.scenarioEvents[0].foodReward = 999;
    assert.deepEqual(map, original);
  });
}

test('legacy elimination-plus-deadline maps retain their hybrid rules', () => {
  const map = deepFreeze({ id: 'legacy-hybrid', startingResources: { food: 75, wood: 20 },
    triggers: [{ id: 'supply', victory: false, foodReward: 25 }],
    timedVictory: { objectiveId: 'supply', afterSeconds: 90 }, scenarioEvents: [] });
  assert.equal(assertMatchModeCompatibility(undefined, map, { mode: 'pve' }).id, 'authored');
  const effective = effectiveMapForMatchMode(map);
  assert.deepEqual(effective, map);
  assert.notEqual(effective.timedVictory, map.timedVictory);
  assert.throws(() => effectiveMapForMatchMode(map, objective), /not compatible/);
});

test('map compatibility does not silently change unsupported selections', () => {
  for (const map of maps) {
    for (const mode of [authored, objective, skirmish]) {
      assert.equal(assertMatchModeCompatibility(mode, map).id, mode.matchModeId);
      assert.equal(assertMatchModeCompatibility(mode, map, { mode: 'pvp', practice: true }).id, mode.matchModeId);
    }
  }
  const custom = { id: 'custom-objective', triggers: [{ id: 'win', victory: true }] };
  assert.equal(assertMatchModeCompatibility(objective, custom).id, 'objective-control');
  assert.throws(() => assertMatchModeCompatibility(skirmish, custom), /not compatible/);
  assert.throws(() => effectiveMapForMatchMode(custom, skirmish), /not compatible/);
  assert.throws(() => assertMatchModeCompatibility(objective, { id: 'land-only', triggers: [] }), /not compatible/);
  assert.equal(assertMatchModeCompatibility(authored, { id: 'land-only', triggers: [] }).id, 'authored');
});

test('historical Skirmish maps reject PvE while retaining human Practice and historical authored AI', () => {
  for (const map of maps) {
    assert.throws(() => assertMatchModeCompatibility(skirmish, map, { mode: 'pve' }), /does not support PvE/);
    assert.equal(matchModeCatalog(map).find(mode => mode.id === 'skirmish').pveSupported, false);
    assert.equal(assertMatchModeCompatibility(skirmish, map, { mode: 'pvp', practice: true }).id, 'skirmish');
    for (const mode of [authored, objective]) {
      assert.equal(assertMatchModeCompatibility(mode, map, { mode: 'pve' }).pveSupported, true);
    }
  }
});

test('invalid opponent/Practice context rejects rather than hiding catalog errors', () => {
  for (const options of [{ mode: 'coop' }, { practice: 'true' }, { mode: 'pve', practice: true }]) {
    assert.throws(() => assertMatchModeCompatibility(authored, maps[0], options));
    assert.throws(() => matchModeCatalog(maps[0], options));
  }
  for (const map of [null, [], 'bellweather-millrace']) {
    assert.throws(() => assertMatchModeCompatibility(authored, map), /validated map object/);
    assert.throws(() => matchModeCatalog(map), /validated map object/);
  }
});

test('catalog includes hidden authored and only compatible, supported selectable modes', () => {
  const ids = (map, options) => matchModeCatalog(map, options).map(mode => mode.id);
  for (const map of maps) {
    assert.deepEqual(ids(map), ['authored', 'objective-control', 'skirmish']);
    assert.deepEqual(ids(map, { mode: 'pvp', practice: true }), ['authored', 'objective-control', 'skirmish']);
    assert.deepEqual(ids(map, { mode: 'pve' }), ['authored', 'objective-control']);
    assert.equal(matchModeCatalog(map)[0].selectable, false);
  }
  assert.deepEqual(ids({ id: 'lab', triggers: [] }), ['authored']);
  assert.deepEqual(ids({ id: 'custom', triggers: [{ victory: true }] }), ['authored', 'objective-control']);
});
