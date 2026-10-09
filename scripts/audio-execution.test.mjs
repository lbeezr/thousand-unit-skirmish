import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'acorn';
import { OrderAudioGate, workAudioEvents } from '../src/audio-policy.mjs';
import { bindingKeysForEvent, createProfileDecisionGate, resolveEventBinding } from '../src/audio-event-profile.mjs';
import { createGameAudio } from '../src/audio.mjs';
import { validateAudioPack } from '../src/audio-assets.mjs';
import { farmHarvestNode } from '../src/farm-harvest.mjs';
import { isShoreFish } from '../src/shore-fishing.mjs';
import { readDisclosedWildlife } from '../src/wildlife-client-state.mjs';
import { createUnitPresentationClientFixture, workerSnapshotRow } from './unit-presentation-client-fixture.mjs';
const worker = (id, task, team = 0, x = 1) => [id, team, x, 0, 100, 'worker', 0, null, 1, null, 0, null, null, null, task];
test('execution is aggregated, local and nearby, with old snapshots, stopped and dead workers silent', () => {
  const rows = Array.from({ length: 1000 }, (_, id) => worker(id, 'wood'));
  rows.push(worker(1001, 'food'), worker(1002, 'repair'), worker(1003, 'food', 1), worker(1004, 'repair', 0, 100));
  assert.deepEqual(workAudioEvents(rows, { localTeam: 0 }), ['food', 'repair', 'wood'].map((resource) => ({ cue: 'work', kind: 'worker', resource })));
  rows.push(worker(1005, 'stone'), worker(1006, 'stone'));
  assert.deepEqual(workAudioEvents(rows, { localTeam: 0 }), ['food', 'repair', 'stone', 'wood'].map((resource) => ({ cue: 'work', kind: 'worker', resource })));
  assert.deepEqual(workAudioEvents(rows, { localTeam: null }), []);
  const dead = worker(0, 'wood'); dead[4] = 0;
  assert.deepEqual(workAudioEvents([dead, worker(1, null), worker(2, 'wood').slice(0, 14)], { localTeam: 0 }), []);
});

for (const team of [0, 1]) {
  test(`seat ${team}: actual Main consumes all four owned nearby work resources without dropping Wood`, async () => {
    const f = await createUnitPresentationClientFixture({ localTeam: team });
    let clock = 10000;
    const audio = createGameAudio({ storage: null, workNow: () => clock,
      doc: { hidden: false, addEventListener() {}, removeEventListener() {} } });
    f.context.audio = audio;
    f.context.workAudioEvents = workAudioEvents;
    const resources = ['food', 'repair', 'stone', 'wood'];
    const rows = resources.map((resource, id) => workerSnapshotRow({ id, team, x: 1, audioExecution: resource }));
    try {
      f.apply(rows.map(row => row.map((value, index) => index === 14 ? null : value)), { initial: true });
      assert.deepEqual(audio.getInspector().decisions, [], 'idle receipt is silent');
      f.apply(rows);
      assert.deepEqual(audio.getInspector().decisions, resources.map(resource => ({
        cue: 'work', resource, key: null, outcome: 'synthesized fallback',
      })), 'all four events reach the unchanged fallback route; this is not a hearing claim');
      f.apply(rows);
      assert.equal(audio.getInspector().decisions.length, 4, 'repeated snapshots retain the aggregate cadence');
      clock += 1500;
      f.apply(rows.map(row => row.map((value, index) => index === 14 ? 'stone' : value)));
      assert.equal(audio.getInspector().decisions.length, 5, 'four Stone workers aggregate to one event');
      assert.equal(audio.getInspector().decisions.at(-1).resource, 'stone');
      clock += 1500;
      f.apply(rows.map(row => row.map((value, index) => index === 14 ? null : value)));
      assert.equal(audio.getInspector().decisions.length, 5, 'stopped work remains silent');
    } finally { audio.dispose(); f.dispose(); }
  });

  test(`seat ${team}: actual Main keeps enemy, distant, dead, legacy and stopped Stone execution silent`, async () => {
    for (const options of [{ team: 1 - team }, { x: 100 }, { hp: 0 }, { legacy: true }, { audioExecution: null }]) {
      const f = await createUnitPresentationClientFixture({ localTeam: team });
      const audio = createGameAudio({ storage: null, workNow: () => 10000,
        doc: { hidden: false, addEventListener() {}, removeEventListener() {} } });
      f.context.audio = audio;
      f.context.workAudioEvents = workAudioEvents;
      try {
        f.apply([workerSnapshotRow({ team })], { initial: true });
        let row = workerSnapshotRow({ team, audioExecution: 'stone', ...options });
        if (options.legacy) row = row.slice(0, 14);
        f.apply([row]);
        assert.deepEqual(audio.getInspector().decisions, [], JSON.stringify(options));
      } finally { audio.dispose(); f.dispose(); }
    }
  });
}

test('Stone work keeps exact, role, cue and unbound fallback resolution', () => {
  const event = { cue: 'work', kind: 'worker', resource: 'stone' };
  const keys = ['unit.worker.work.stone', 'unit.worker.work', 'cue.work'];
  assert.deepEqual(bindingKeysForEvent(event), keys);
  for (const key of keys) {
    assert.equal(resolveEventBinding({ bindings: { [key]: { bus: 'effects', variants: [{ sourceId: 'fixture' }] } } }, event).key, key);
  }
  assert.equal(resolveEventBinding({}, event), null);
});
test('spoken success only follows applied token, ignores planning and rejects exactly once', () => {
  const gate = new OrderAudioGate();
  gate.sent('one', { cue: 'patrol' });
  assert.equal(gate.observe('one', 'PLANNING PATROL · 12 UNITS'), null);
  assert.equal(gate.observe('other', 'PATROL ORDER · 12 UNITS'), null);
  assert.deepEqual(gate.observe('one', 'PATROL ORDER · 12 UNITS'), { cue: 'patrol' });
  assert.equal(gate.observe('one', 'PATROL ORDER · 12 UNITS'), null);
  gate.sent('two', { cue: 'follow' });
  assert.equal(gate.observe('two', 'FOLLOW REJECTED · BAD TARGET'), null);
  assert.equal(gate.observe('two', 'FOLLOW ORDER · 3 UNITS'), null);
  gate.sent('three', { cue: 'repair' }); gate.reset();
  assert.equal(gate.observe('three', 'REPAIR ORDER · 3 WORKERS'), null);
  for (let i = 0; i < 100; i++) gate.sent(i, { cue: 'move' });
  assert.equal(gate.pending.size, 32);
});

// Execute the committed producer and fog predicate, retaining the real Farm,
// wildlife disclosure and applied-token adapters. Socket/presentation are injected;
// these checks establish event metadata and routing, not browser playback/hearing.
const mainSource = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const mainFunctions = parse(mainSource, { ecmaVersion: 'latest', sourceType: 'module' }).body
  .filter(node => node.type === 'FunctionDeclaration');
const actualFunction = name => {
  const node = mainFunctions.find(node => node.id.name === name);
  assert.ok(node, `actual ${name} remains discoverable`);
  return mainSource.slice(node.start, node.end);
};
const gatherCommand = nodeId => ({ type: 'gather', ids: [0], nodeId });
function orderFixture({ team = 0, mutate = () => {}, send = true } = {}) {
  const map = { id: 'audio-context', width: 20, height: 20, fogOfWar: true, resourceNodes: [
    { id: 'berries', type: 'food', x: -2, z: 0, stock: 30 },
    { id: 'bank', type: 'food', resourceVariant: 'shore-fish', x: -1, z: 0, stock: 30 },
    { id: 'flock', type: 'food', wildlifeSpecies: 'bellweather-sheep', x: 0, z: 0, stock: 100 },
    { id: 'stone', type: 'stone', x: -3, z: 0, stock: 30 },
    { id: 'wood', type: 'wood', x: -4, z: 0, stock: 30 },
  ] };
  const data = { localTeam: team, mapDefinition: map,
    units: [{ id: 0, kind: 'worker', hp: 100, team }],
    latestBuildings: [{ id: 9, type: 'farm', team, complete: true, hp: 600, harvestStock: 200, x: 2, z: 0 }],
    latestFogCells: new Uint8Array(400).fill(2),
    snapshot: { mapId: map.id, forestEpoch: 0, resourceNodes: [{
      ...map.resourceNodes[2], x: 3, wildlifeState: 'carcass', wildlifeTeam: null, wildlifeHeading: 0,
    }] },
  };
  mutate(data);
  const pointVisible = Function('data', `
    const { mapDefinition, localTeam, latestFogCells } = data;
    const MAP_WIDTH = mapDefinition.width, MAP_HEIGHT = mapDefinition.height;
    const MAP_HALF_X = MAP_WIDTH / 2, MAP_HALF_Z = MAP_HEIGHT / 2;
    ${actualFunction('wildlifePointVisible')}
    return wildlifePointVisible;
  `)(data);
  const gate = new OrderAudioGate(), commands = [], cues = [], statuses = [];
  let nextToken = 1;
  const sendOrder = Function('data', `
    const { mapDefinition, localTeam, units, latestBuildings, latestWildlifeView,
      farmHarvestNode, isShoreFish, wildlifePointVisible, orderAudioGate,
      beginOrderStatus, sendCommand, audio, finishOrderStatus } = data;
    const browserStateRecovery = { recovering: false, status: () => 'LIVE' };
    ${actualFunction('sendTrackedOrder')}
    return sendTrackedOrder;
  `)({ ...data, latestWildlifeView: readDisclosedWildlife(map, data.snapshot, team, pointVisible),
    farmHarvestNode, isShoreFish, wildlifePointVisible: pointVisible, orderAudioGate: gate,
    beginOrderStatus: () => nextToken++, sendCommand: command => { commands.push(command); return send; },
    audio: { play: cue => cues.push(cue) }, finishOrderStatus: (...args) => statuses.push(args),
  });
  return { gate, commands, cues, statuses, sendOrder, data };
}

for (const team of [0, 1]) test(`seat ${team}: real disclosed food jobs survive the applied order, with no protocol metadata`, () => {
  for (const [nodeId, gatherJob] of [['farm:9', 'farm'], ['bank', 'fish'], ['flock', 'sheep-carcass']]) {
    const f = orderFixture({ team });
    const command = gatherCommand(nodeId), token = f.sendOrder(command, 'GATHER', 1, 'WORKER');
    assert.deepEqual(f.commands, [{ ...command, clientOrderToken: token }]);
    assert.deepEqual(f.cues, ['send'], 'send emits only the existing neutral tick');
    assert.equal(f.gate.observe(token + 1, 'GATHER ORDER · 1 WORKERS'), null);
    for (const message of ['PLANNING GATHER · 1 WORKERS', 'GATHER QUEUED · 1 WORKERS']) {
      assert.equal(f.gate.observe(token, message), null, 'pending/queued intent is not applied work');
    }
    assert.deepEqual(f.gate.observe(token, 'GATHER ORDER · 1 WORKERS'), {
      cue: 'gather', kind: 'worker', resource: 'food', gatherJob,
    });
    assert.equal(f.gate.observe(token, 'GATHER ORDER · 1 WORKERS'), null, 'no duplicate acknowledgement');
  }
});

test('missing, hidden, stale, live or depleted wildlife never implies sheep harvest or hunting', () => {
  for (const mutate of [
    data => { data.snapshot.resourceNodes = []; },
    data => { data.latestFogCells[10 * 20 + 13] = 1; }, // authored pose visible, actual pose hidden
    data => { data.snapshot.mapId = 'previous-map'; },
    data => { Object.assign(data.snapshot.resourceNodes[0], { wildlifeState: 'alive', wildlifeActivity: 'idle' }); },
    data => { Object.assign(data.snapshot.resourceNodes[0], { wildlifeState: 'depleted', stock: 0 }); },
    data => { data.mapDefinition.resourceNodes[2].wildlifeSpecies = 'unknown-animal'; },
  ]) {
    const f = orderFixture({ mutate }), token = f.sendOrder(gatherCommand('flock'), 'GATHER', 1);
    assert.deepEqual(f.gate.observe(token, 'GATHER ORDER · 1 WORKERS'), {
      cue: 'gather', kind: 'worker', resource: 'food', gatherJob: undefined,
    }, 'coarse food compatibility remains, without invented context');
  }
});

test('job context requires an eligible owned actor, actual Farm and visible fish, not a suggestive ID', () => {
  for (const [nodeId, mutate] of [
    ['farm:9', data => { data.latestBuildings[0].team = 1; }],
    ['farm:9', data => { data.latestBuildings[0].complete = false; }],
    ['farm:9', data => { data.latestBuildings[0].hp = 0; }],
    ['farm:9', data => { data.latestBuildings[0].harvestStock = 0; }],
    ['farm:404', () => {}],
    ['bank', data => { data.latestFogCells[10 * 20 + 9] = 0; }],
    ['bank', data => { data.mapDefinition.resourceNodes[1].resourceVariant = 'unknown-fish'; }],
    ['bank', data => { data.units[0].team = 1; }],
    ['bank', data => { data.units[0].hp = 0; }],
    ['bank', data => { data.units[0].kind = 'skiff'; }],
    ['bank', data => { data.localTeam = null; }],
    ['farm:404', data => { data.mapDefinition.resourceNodes.push({ id: 'farm:404', type: 'food', x: 1, z: 0 }); }],
  ]) {
    const f = orderFixture({ mutate }), token = f.sendOrder(gatherCommand(nodeId), 'GATHER', 1);
    assert.equal(f.gate.observe(token, 'GATHER ORDER · 1 WORKERS').gatherJob, undefined);
  }
});

test('ordinary food, wood/forest, Stone, unknown targets and other orders keep their existing route', () => {
  for (const [command, cue, resource] of [
    [gatherCommand('berries'), 'gather', 'food'], [gatherCommand('wood'), 'gather', 'wood'],
    [gatherCommand('stone'), 'gather', 'stone'], [gatherCommand('missing'), 'gather', undefined],
    [{ ...gatherCommand('bank'), forestCell: 0 }, 'gather', 'wood'],
    [{ type: 'move', ids: [0], nodeId: 'bank' }, 'move', undefined],
  ]) {
    const f = orderFixture(), token = f.sendOrder(command, 'ORDER', 1);
    assert.deepEqual(f.gate.observe(token, `${cue.toUpperCase()} ORDER · 1 WORKERS`), {
      cue, kind: 'worker', resource, gatherJob: undefined,
    });
  }
});

test('rejected, cancelled and unsent job orders never later acknowledge success', () => {
  for (const message of ['GATHER REJECTED · BAD TARGET', 'RESOURCE NODE EMPTY · BANK',
    'RESOURCE NODE UNREACHABLE · BANK', 'ORDER SUPERSEDED', 'ORDER CANCELLED', 'MATCH OVER']) {
    const f = orderFixture(), token = f.sendOrder(gatherCommand('bank'), 'GATHER', 1);
    assert.equal(f.gate.observe(token, message), null);
    assert.equal(f.gate.observe(token, 'GATHER ORDER · 1 WORKERS'), null);
  }
  const f = orderFixture({ send: false });
  assert.equal(f.sendOrder(gatherCommand('bank'), 'GATHER', 1), null);
  assert.equal(f.gate.pending.size, 0); assert.deepEqual(f.cues, []);
  assert.equal(f.statuses[0][2], 'failed');
});

test('known Worker jobs precede food; absent/unknown context and other roles/cues retain the legacy keys', () => {
  const generic = ['unit.worker.gather.food', 'unit.worker.gather', 'cue.gather'];
  for (const gatherJob of ['farm', 'fish', 'sheep-carcass']) {
    assert.deepEqual(bindingKeysForEvent({ cue: 'gather', kind: 'worker', resource: 'food', gatherJob }),
      [`unit.worker.gather.${gatherJob}`, ...generic]);
  }
  for (const gatherJob of [undefined, null, 'unknown', 'hunting', 'constructor']) {
    assert.deepEqual(bindingKeysForEvent({ cue: 'gather', kind: 'worker', resource: 'food', gatherJob }), generic);
  }
  for (const event of [{ cue: 'gather', kind: 'skiff', resource: 'food' },
    { cue: 'work', kind: 'worker', resource: 'food' }, { cue: 'gather', kind: 'worker', resource: 'wood' },
    { cue: 'gather', kind: 'worker' }]) {
    assert.deepEqual(bindingKeysForEvent({ ...event, gatherJob: 'fish' }), bindingKeysForEvent(event));
  }
});

const binding = sourceId => ({ bus: 'voice', variants: [{ sourceId }] });
test('civilization/common/exact-food/role/cue fallbacks and shared speech limits survive job specificity', () => {
  const profile = { bindings: { 'unit.worker.gather.farm': binding('common-farm'),
    'unit.worker.gather.food': binding('common-food'), 'unit.worker.gather': binding('common-role'),
    'cue.gather': binding('common-cue') }, civilizationBindings: { frontier: {
    'unit.worker.gather.fish': binding('frontier-fish'), 'unit.worker.gather.food': binding('frontier-food'),
  }, boughward: {} } };
  const event = { cue: 'gather', kind: 'worker', resource: 'food', gatherJob: 'fish' };
  assert.equal(resolveEventBinding(profile, event).binding.variants[0].sourceId, 'frontier-fish');
  assert.equal(resolveEventBinding(profile, { ...event, gatherJob: 'farm' }).binding.variants[0].sourceId, 'frontier-food',
    'existing civilization layer precedence is unchanged');
  for (const civilizationId of ['boughward', 'unknown']) {
    assert.equal(resolveEventBinding(profile, { ...event, civilizationId, gatherJob: 'farm' }).key, 'unit.worker.gather.farm');
    for (const key of ['unit.worker.gather.food', 'unit.worker.gather', 'cue.gather']) {
      assert.equal(resolveEventBinding({ bindings: { [key]: binding(key) } }, { ...event, civilizationId }).key, key);
    }
  }
  assert.equal(resolveEventBinding({}, event), null, 'unbound retains synthesis fallback');
  let now = 1000;
  const gate = createProfileDecisionGate({ now: () => now });
  assert.ok(gate.choose(profile, event));
  assert.equal(gate.choose(profile, { ...event, gatherJob: 'farm' }), null);
  assert.equal(gate.getReason(), 'speech cooldown', 'distinct jobs cannot flood voice');
  now += 1300; assert.ok(gate.choose(profile, { ...event, gatherJob: 'farm' }));
});

test('current shipped metadata keeps generic-food binding and absent packs retain synthesis for every job', async () => {
  const { pack } = JSON.parse(await readFile(new URL('../assets/audio/runtime/rts-feedback-test/v1/manifest.json', import.meta.url)));
  const futurePack = structuredClone(pack);
  for (const gatherJob of ['farm', 'fish', 'sheep-carcass']) {
    futurePack.profiles[0].bindings[`unit.worker.gather.${gatherJob}`]
      = structuredClone(pack.profiles[0].bindings['unit.worker.gather.food']);
  }
  const validated = validateAudioPack(futurePack);
  for (const gatherJob of ['farm', 'fish', 'sheep-carcass']) {
    const event = { cue: 'gather', kind: 'worker', resource: 'food', gatherJob };
    assert.equal(resolveEventBinding(validated.profiles[0], event).key, `unit.worker.gather.${gatherJob}`,
      'the existing schema admits specific keys with existing material, without changing shipped manifests');
    const audio = createGameAudio({ storage: null, doc: { hidden: false, addEventListener() {}, removeEventListener() {} } });
    try {
      await audio.setMapAudio({ packId: pack.id, profileId: pack.profiles[0].id },
        { async loadPack() { return { pack, sourceBlobs: {} }; } });
      audio.playEvent(event);
      assert.equal(audio.getInspector().decisions.at(-1).key, 'unit.worker.gather.food');
      await audio.setMapAudio(null);
      audio.playEvent(event);
      assert.equal(audio.getInspector().decisions.at(-1).outcome, 'synthesized fallback');
    } finally { audio.dispose(); }
  }
});

const fishingNotice = 'FISHING ORDER · 1 SKIFFS · FINITE FOOD TO OWNED DOCK';
const skiffFixture = (options = {}) => orderFixture({ ...options,
  mutate: data => { data.units[0].kind = 'skiff'; },
});
for (const team of [0, 1]) test(`seat ${team}: actual Skiff Gather caller acknowledges matching applied fishing exactly once`, () => {
  const f = skiffFixture({ team });
  const command = gatherCommand('bank'), token = f.sendOrder(command, 'FISH', 1, 'SKIFFS');
  const event = { cue: 'gather', kind: 'skiff', resource: 'food', gatherJob: undefined };
  assert.deepEqual(f.commands, [{ ...command, clientOrderToken: token }]);
  assert.deepEqual(f.cues, ['send']);
  assert.deepEqual(f.gate.pending.get(token), event);
  const pending = f.gate.pending.get(token);
  assert.equal(new OrderAudioGate().observe(token, fishingNotice), null, 'unissued tokens cannot acknowledge');
  assert.equal(f.gate.observe(token + 1, fishingNotice), null, 'other tokens cannot consume local intent');
  for (const message of ['PLANNING FISHING · 1 SKIFFS', 'FISHING QUEUED · 1 SKIFFS', 'FISHING ORDER']) {
    assert.equal(f.gate.observe(token, message), null);
    assert.deepEqual(f.gate.pending.get(token), event, 'planning/non-applied notices retain the pending event');
  }
  const applied = f.gate.observe(token, fishingNotice);
  assert.deepEqual(applied, event);
  assert.equal(applied, pending, 'consume the caller event without replacing its metadata');
  assert.equal(f.gate.pending.has(token), false);
  assert.equal(f.gate.observe(token, fishingNotice), null, 'duplicate notices stay silent');
  assert.deepEqual(bindingKeysForEvent(applied), ['unit.skiff.gather.food', 'unit.skiff.gather', 'cue.gather']);
  for (const key of bindingKeysForEvent(applied)) {
    const selected = binding(key);
    const resolved = resolveEventBinding({ bindings: { [key]: selected } }, applied);
    assert.equal(resolved.key, key);
    assert.equal(resolved.binding, selected, 'existing role/cue fallback remains, without Worker job context');
  }
  assert.equal(resolveEventBinding({}, applied), null, 'absent bindings retain synthesis fallback');
});

test('applied Skiff fishing without a bound pack retains synthesized Gather feedback', () => {
  const f = skiffFixture(), token = f.sendOrder(gatherCommand('bank'), 'FISH', 1, 'SKIFFS');
  const audio = createGameAudio({ storage: null, doc: { hidden: false, addEventListener() {}, removeEventListener() {} } });
  try {
    audio.playEvent(f.gate.observe(token, fishingNotice));
    assert.equal(audio.getInspector().decisions.at(-1).outcome, 'synthesized fallback');
  } finally { audio.dispose(); }
});

for (const team of [0, 1]) test(`seat ${team}: failed, cancelled, reset and unsent Skiff orders cannot acknowledge fishing`, () => {
  for (const message of ['FISHING FAILED · BAD TARGET', 'FISHING REJECTED · BAD TARGET',
    'FISHING UNAVAILABLE · NO DOCK', 'RESOURCE NODE UNREACHABLE · BANK', 'RESOURCE NODE EMPTY · BANK',
    'ORDER SUPERSEDED', 'ORDER CANCELLED', 'MATCH OVER']) {
    const f = skiffFixture({ team }), token = f.sendOrder(gatherCommand('bank'), 'FISH', 1, 'SKIFFS');
    assert.equal(f.gate.observe(token, message), null);
    assert.equal(f.gate.pending.has(token), false);
    assert.equal(f.gate.observe(token, fishingNotice), null);
  }
  const f = skiffFixture({ team }), token = f.sendOrder(gatherCommand('bank'), 'FISH', 1, 'SKIFFS');
  f.gate.reset();
  assert.equal(f.gate.observe(token, fishingNotice), null);
  const unsent = skiffFixture({ team, send: false });
  assert.equal(unsent.sendOrder(gatherCommand('bank'), 'FISH', 1, 'SKIFFS'), null);
  assert.equal(unsent.gate.observe(1, fishingNotice), null);
  assert.equal(unsent.gate.pending.size, 0);
  assert.deepEqual(unsent.cues, []);
  assert.equal(unsent.statuses[0][2], 'failed');
});

test('fishing notice cannot consume Worker Gather or a different Skiff command', () => {
  const workerOrder = orderFixture(), workerToken = workerOrder.sendOrder(gatherCommand('bank'), 'GATHER', 1);
  assert.equal(workerOrder.gate.observe(workerToken, fishingNotice), null);
  assert.deepEqual(workerOrder.gate.observe(workerToken, 'GATHER ORDER · 1 WORKERS'), {
    cue: 'gather', kind: 'worker', resource: 'food', gatherJob: 'fish',
  });
  const skiff = skiffFixture(), token = skiff.sendOrder({ type: 'move', ids: [0], x: 1, z: 1 }, 'MOVE', 1, 'SKIFFS');
  assert.equal(skiff.gate.observe(token, fishingNotice), null);
  assert.deepEqual(skiff.gate.observe(token, 'MOVE ORDER · 1 SKIFFS'), {
    cue: 'move', kind: 'skiff', resource: undefined, gatherJob: undefined,
  });
});
