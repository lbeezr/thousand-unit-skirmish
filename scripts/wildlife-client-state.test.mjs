import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readDisclosedWildlife, selectOwnedWildlife, reconcileWildlifeSelection,
  createWildlifeCommand, updateWildlifePositionMemory,
} from '../src/wildlife-client-state.mjs';

const species = 'bellweather-sheep';
function map() {
  return { id: 'sheep-field', width: 32, height: 24, fogOfWar: true,
    resourceNodes: [
      { id: 'azure-sheep', type: 'food', stock: 130, x: -8.5, z: -4.5, wildlifeSpecies: species },
      { id: 'ember-sheep', type: 'food', stock: 130, x: 8.5, z: -4.5, wildlifeSpecies: species },
      { id: 'berries', type: 'food', stock: 300, x: 0.5, z: 6.5 },
    ] };
}
function row(team = 0, patch = {}) {
  return { id: team === 0 ? 'azure-sheep' : 'ember-sheep', type: 'food', stock: 130,
    x: team === 0 ? -5.5 : 5.5, z: -4.5, wildlifeSpecies: species,
    wildlifeState: 'alive', wildlifeTeam: team, wildlifeHeading: Math.PI / 2,
    wildlifeActivity: 'wandering', ...patch };
}
function snapshot(rows = [row()], patch = {}) {
  return { mapId: 'sheep-field', forestEpoch: 7, resourceNodes: rows, ...patch };
}
const visible = () => true;
function read(definition, rows = [row()], team = 0, patch = {}, predicate = visible) {
  return readDisclosedWildlife(definition, snapshot(rows, patch), team, predicate);
}
const target = { x: -2.25, z: -3.875 };
const legalTarget = { isVisible: visible, isLegalEndpoint: visible };

test('both seats disclose actual multi-cell poses, select only their live Sheep and send exact Herd/Stop', () => {
  const definition = map();
  for (const team of [0, 1]) {
    const own = row(team), foreign = row(1 - team);
    const view = read(definition, [own, foreign], team);
    assert.equal(view.rows.size, 2);
    assert.equal(view.rows.get(own.id).x, own.x);
    assert.ok(Math.abs(own.x - definition.resourceNodes[team].x) > .35);
    assert.equal(selectOwnedWildlife(view, own.id), own.id);
    assert.equal(selectOwnedWildlife(view, foreign.id), null);
    assert.equal(selectOwnedWildlife(view, team), null);
    assert.deepEqual(createWildlifeCommand('herd', own.id, view, view, target, legalTarget),
      { type: 'herd', nodeId: own.id, resourceEpoch: 7, x: target.x, z: target.z });
    assert.deepEqual(createWildlifeCommand('stopWildlife', own.id, view, view),
      { type: 'stopWildlife', nodeId: own.id, resourceEpoch: 7 });
  }
});

test('parser rejects duplicate disclosed IDs, including a malformed competing row', () => {
  const definition = map();
  for (const duplicate of [row(), { id: 'azure-sheep' }, row(0, { stock: -1 })]) {
    assert.equal(read(definition, [row(), duplicate, row(1)]).rows.has('azure-sheep'), false);
    assert.equal(read(definition, [row(), duplicate, row(1)]).rows.has('ember-sheep'), true);
  }
});

test('authored duplicates, unknown species and ordinary food cannot become Sheep', () => {
  const definition = map();
  definition.resourceNodes.push({ ...definition.resourceNodes[0], wildlifeSpecies: undefined });
  assert.equal(read(definition).rows.size, 0);
  const clean = map();
  assert.equal(read(clean, [row(0, { id: 'berries' }), row(0, { id: 'unknown' }),
    row(0, { wildlifeSpecies: 'invented-sheep' })]).rows.size, 0);
  clean.resourceNodes[0].wildlifeTeam = 0;
  assert.equal(read(clean).rows.size, 0);
});

test('strict pose, lifecycle, food and public-field admission rejects forged rows', () => {
  const definition = map();
  const invalid = [
    { id: 3 }, { id: '' }, { type: 'wood' }, { wildlifeSpecies: undefined },
    { x: undefined }, { z: undefined }, { x: '-5.5' }, { x: NaN }, { z: Infinity },
    { x: 16 }, { x: -16.01 }, { z: 12 }, { z: -12.01 },
    { stock: undefined }, { stock: '130' }, { stock: NaN }, { stock: Infinity },
    { stock: -1 }, { stock: 131 }, { stock: 129 }, { stock: 0 },
    { wildlifeState: undefined }, { wildlifeState: 'dead' },
    { wildlifeTeam: undefined }, { wildlifeTeam: -1 }, { wildlifeTeam: 2 },
    { wildlifeTeam: '0' }, { wildlifeTeam: false },
    { wildlifeHeading: undefined }, { wildlifeHeading: '0' }, { wildlifeHeading: NaN },
    { wildlifeHeading: -0.1 }, { wildlifeHeading: Math.PI * 2 },
    { wildlifeActivity: undefined }, { wildlifeActivity: 'herding' },
    { resourceVariant: 'shore-fish' }, { wildlifeHerd: null },
    { wildlifeGrazeAnchor: { x: -8.5, z: -4.5 } }, { wildlifeMotion: {} },
    { path: [1, 2] }, { wildlifeNoseYawDegrees: 45 }, { unknownField: true },
  ];
  for (const patch of invalid) {
    assert.equal(read(definition, [row(0, patch)]).rows.size, 0, JSON.stringify(patch));
  }
  assert.equal(read(definition, [row(0, { x: -16, z: -12 })]).rows.size, 1);
  assert.equal(read(definition, [row(0, { wildlifeTeam: null })]).rows.size, 1);
});

test('positive carcasses and depleted rows validate but never become selected', () => {
  const definition = map();
  for (const [wildlifeState, stock] of [['carcass', 130], ['carcass', 0.004], ['depleted', 0]]) {
    const animal = row(0, { wildlifeState, stock });
    delete animal.wildlifeActivity;
    const view = read(definition, [animal]);
    assert.equal(view.rows.size, 1);
    assert.equal(selectOwnedWildlife(view, animal.id), null);
    assert.equal(createWildlifeCommand('stopWildlife', animal.id, view, view), null);
  }
  for (const [wildlifeState, stock] of [['carcass', 0], ['depleted', 1]]) {
    const animal = row(0, { wildlifeState, stock });
    delete animal.wildlifeActivity;
    assert.equal(read(definition, [animal]).rows.size, 0);
  }
  assert.equal(read(definition, [row(0, { wildlifeState: 'carcass', stock: 1 })]).rows.size, 0);
});

test('fog admission uses only actual disclosed pose and requires a strict visible result', () => {
  const definition = map();
  const seen = [];
  const view = read(definition, [row()], 0, {}, point => {
    seen.push({ x: point.x, z: point.z });
    return point.x === -5.5;
  });
  assert.equal(view.rows.size, 1);
  assert.deepEqual(seen, [{ x: -5.5, z: -4.5 }]);
  for (const predicate of [() => false, () => 1, () => 'visible']) {
    assert.equal(read(definition, [row()], 0, {}, predicate).rows.size, 0);
  }
  assert.equal(readDisclosedWildlife(definition, snapshot(), 0).rows.size, 0);
  definition.fogOfWar = false;
  assert.equal(readDisclosedWildlife(definition, snapshot(), 0).rows.size, 1);
  assert.equal(readDisclosedWildlife(definition, snapshot(), 0, () => false).rows.size, 0);
});

test('spectators may see disclosed Sheep but cannot select or create orders', () => {
  const definition = map();
  const view = readDisclosedWildlife(definition, snapshot(), null);
  assert.equal(view.rows.size, 1);
  assert.equal(selectOwnedWildlife(view, 'azure-sheep'), null);
  assert.equal(createWildlifeCommand('herd', 'azure-sheep', view, view, target, legalTarget), null);
});

test('invalid map, epoch and seat contexts fail closed', () => {
  const definition = map();
  for (const patch of [{ mapId: undefined }, { mapId: 'other-map' }, { forestEpoch: undefined },
    { forestEpoch: '7' }, { forestEpoch: -1 }, { forestEpoch: 7.1 }, { forestEpoch: Infinity }]) {
    assert.equal(read(definition, [row()], 0, patch), null);
  }
  for (const team of [undefined, -1, 2, '0', false]) {
    assert.equal(readDisclosedWildlife(definition, snapshot(), team, visible), null);
  }
  for (const patch of [{ width: 0 }, { height: -1 }, { width: 32.5 }, { id: '' }, { resourceNodes: null }]) {
    assert.equal(readDisclosedWildlife({ ...definition, ...patch }, snapshot(), 0, visible), null);
  }
  assert.equal(readDisclosedWildlife(definition, snapshot([], { resourceNodes: undefined }), 0, visible).rows.size, 0);
});

test('selection survives valid movement and clears on fog, omission, recapture, harvest or depletion', () => {
  const definition = map(), previous = read(definition);
  assert.equal(reconcileWildlifeSelection('azure-sheep', previous,
    read(definition, [row(0, { x: 3.75 })])), 'azure-sheep');
  const carcass = row(0, { wildlifeState: 'carcass', stock: 12 }); delete carcass.wildlifeActivity;
  const depleted = { ...carcass, wildlifeState: 'depleted', stock: 0 };
  for (const current of [read(definition, [], 0), read(definition, [row()], 0, {}, () => false),
    read(definition, [row(0, { wildlifeTeam: 1 })]), read(definition, [row(0, { wildlifeTeam: null })]),
    read(definition, [carcass]), read(definition, [depleted]), null]) {
    assert.equal(reconcileWildlifeSelection('azure-sheep', previous, current), null);
    assert.equal(createWildlifeCommand('stopWildlife', 'azure-sheep', previous, current), null);
  }
});

test('map reload, epoch and seat changes clear selection and reject stale commands despite reused ID', () => {
  const definition = map(), previous = read(definition);
  const otherMap = { ...map(), id: 'other-map' };
  const changed = [read(map()), read(definition, [row()], 0, { forestEpoch: 8 }),
    read(definition, [row(0, { wildlifeTeam: 1 })], 1),
    readDisclosedWildlife(otherMap, snapshot([row()], { mapId: 'other-map' }), 0, visible)];
  for (const current of changed) {
    assert.equal(selectOwnedWildlife(current, 'azure-sheep'), 'azure-sheep');
    assert.equal(reconcileWildlifeSelection('azure-sheep', previous, current), null);
    assert.equal(createWildlifeCommand('herd', 'azure-sheep', previous, current, target, legalTarget), null);
    assert.equal(createWildlifeCommand('stopWildlife', 'azure-sheep', previous, current), null);
  }
});

test('Herd endpoints are exact finite map-bounded currently visible legal land before callbacks', () => {
  const view = read(map());
  const callbacks = [];
  const rules = { isVisible: point => { callbacks.push(['visible', point]); return true; },
    isLegalEndpoint: point => { callbacks.push(['legal', point]); return true; } };
  for (const destination of [undefined, null, {}, { x: '-2', z: 0 }, { x: NaN, z: 0 },
    { x: 16, z: 0 }, { x: -16.01, z: 0 }, { x: 0, z: 12 }, { x: 0, z: -12.01 }]) {
    assert.equal(createWildlifeCommand('herd', 'azure-sheep', view, view, destination, rules), null);
  }
  assert.deepEqual(callbacks, []);
  assert.equal(createWildlifeCommand('herd', 'azure-sheep', view, view, target), null);
  assert.equal(createWildlifeCommand('herd', 'azure-sheep', view, view, target,
    { ...rules, isVisible: () => false }), null);
  assert.equal(createWildlifeCommand('herd', 'azure-sheep', view, view, target,
    { ...rules, isLegalEndpoint: () => false }), null);
  const command = createWildlifeCommand('herd', 'azure-sheep', view, view, target, rules);
  assert.equal(command.x, target.x); assert.equal(command.z, target.z);
  assert.deepEqual(callbacks.at(-2), ['visible', target]);
  assert.deepEqual(callbacks.at(-1), ['legal', target]);
  assert.deepEqual(createWildlifeCommand('herd', 'azure-sheep', view, view,
    { x: -16, z: -12 }, legalTarget), { type: 'herd', nodeId: 'azure-sheep', resourceEpoch: 7, x: -16, z: -12 });
});

test('order creation accepts only Herd/Stop and never mutates or copies unit/private fields', () => {
  const definition = map(), packet = snapshot([row()]), view = readDisclosedWildlife(definition, packet, 0, visible);
  const original = structuredClone(packet), armyIds = new Set([0, 12, 48]);
  for (const type of ['stop', 'gather', 'claim', 'attack', 'move', undefined]) {
    assert.equal(createWildlifeCommand(type, 'azure-sheep', view, view, target, legalTarget), null);
  }
  const command = createWildlifeCommand('herd', 'azure-sheep', view, view,
    { ...target, ids: [...armyIds], wildlifeHerd: {}, clientOrderToken: 123 }, legalTarget);
  assert.deepEqual(Object.keys(command).sort(), ['nodeId', 'resourceEpoch', 'type', 'x', 'z']);
  assert.deepEqual(packet, original);
  assert.deepEqual([...armyIds], [0, 12, 48]);
  packet.resourceNodes[0].x = 9;
  assert.equal(view.rows.get('azure-sheep').x, -5.5);
  assert.throws(() => { view.rows.get('azure-sheep').x = 9; }, TypeError);
});

test('construction memory retains last disclosed pose through fog without receiving hidden movement', () => {
  const definition = map(), previous = read(definition);
  const first = updateWildlifePositionMemory(null, previous);
  const hidden = read(definition, [row(0, { x: 4.5 })], 0, {}, () => false);
  const second = updateWildlifePositionMemory(first, hidden);
  assert.deepEqual(second.positions.get('azure-sheep'), { x: -5.5, z: -4.5 });
  assert.equal(hidden.rows.size, 0);
  assert.equal(selectOwnedWildlife(hidden, 'azure-sheep'), null);
  assert.equal(selectOwnedWildlife(second, 'azure-sheep'), null);
  assert.equal(createWildlifeCommand('stopWildlife', 'azure-sheep', previous, hidden), null);
  assert.equal(createWildlifeCommand('stopWildlife', 'azure-sheep', previous, second), null);
  const omitted = updateWildlifePositionMemory(second, read(definition, []));
  assert.deepEqual(omitted.positions.get('azure-sheep'), first.positions.get('azure-sheep'));
  const disclosed = updateWildlifePositionMemory(omitted, read(definition, [row(0, { x: 4.5 })]));
  assert.deepEqual(disclosed.positions.get('azure-sheep'), { x: 4.5, z: -4.5 });
  assert.deepEqual(first.positions.get('azure-sheep'), { x: -5.5, z: -4.5 });
});

test('memory clears across map/epoch/seat and releases visibly depleted food', () => {
  const definition = map(), first = updateWildlifePositionMemory(null, read(definition));
  for (const changed of [read(map(), []), read(definition, [], 0, { forestEpoch: 8 }), read(definition, [], 1)]) {
    assert.equal(updateWildlifePositionMemory(first, changed).positions.size, 0);
  }
  assert.equal(updateWildlifePositionMemory(first, null), null);
  const carcass = row(0, { wildlifeState: 'carcass', stock: 0.004 }); delete carcass.wildlifeActivity;
  const withCarcass = updateWildlifePositionMemory(first, read(definition, [carcass]));
  assert.equal(withCarcass.positions.size, 1);
  assert.equal(updateWildlifePositionMemory(withCarcass,
    read(definition, [{ ...carcass, wildlifeState: 'depleted', stock: 0 }])).positions.size, 0);
});
