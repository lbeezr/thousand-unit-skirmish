import test from 'node:test';
import assert from 'node:assert/strict';
import { createWildlifeHerdState, herdCell, planWildlifeHerd, startWildlifeHerd,
  cancelWildlifeHerd, stepWildlifeHerd, validWildlifeHerdState, migrateWildlifeHerdCheckpoint, SHEEP_HERD_SPEED } from '../src/wildlife-herding.mjs';

const map = { width: 8, height: 8 }, epsilon = 1e-9;
const point = node => ({ x: node.x, z: node.z });
function nodeFor(team = 0) {
  const position = { x: .5, z: .5 };
  return { id: 'sheep', type: 'food', stock: 130, wildlifeSpecies: 'bellweather-sheep',
    wildlifeState: 'alive', wildlifeTeam: team, ...position, ...createWildlifeHerdState(position),
    wildlifeMotion: { sequence: 12, targetX: .7, targetZ: .5, waitTicks: 42, activity: 'grazing', heading: 0 } };
}
const commandFor = () => ({ nodeId: 'sheep', x: 2.25, z: 1.25 });
function contextFor(team = 0) {
  const blocked = new Set(), hidden = new Set(), impassableEdges = new Set();
  const calls = [], suppliedPath = [37, 38, 46];
  const isWalkable = cell => Number.isInteger(cell) && cell >= 0 && cell < 64 && !blocked.has(cell);
  const canTraverse = (from, to) => isWalkable(from) && isWalkable(to)
    && (from === to || (Math.abs(from % 8 - to % 8)
      + Math.abs(Math.floor(from / 8) - Math.floor(to / 8)) === 1))
    && !impassableEdges.has(`${from}:${to}`);
  const context = { team, map, isWalkable, canTraverse,
    isVisible: (seat, cell) => seat === team && !hidden.has(cell),
    findPath: (from, to) => { calls.push({ from, to }); return suppliedPath; } };
  function canStep(from, to) {
    const count = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / .01));
    let previous = herdCell(from, map);
    for (let index = 1; index <= count; index++) {
      const cell = herdCell({ x: from.x + (to.x - from.x) * index / count,
        z: from.z + (to.z - from.z) * index / count }, map);
      if (!canTraverse(previous, cell)) return false;
      previous = cell;
    }
    return true;
  }
  return { context, blocked, hidden, impassableEdges, calls, suppliedPath, canStep };
}
function assertFrozen(node, expected) {
  assert.deepEqual(point(node), expected);
  assert.deepEqual(node.wildlifeGrazeAnchor, expected);
  assert.equal(node.wildlifeHerd, null);
  assert.equal(node.wildlifeMotion.targetX, node.x);
  assert.equal(node.wildlifeMotion.targetZ, node.z);
  assert.equal(node.wildlifeMotion.waitTicks, 0);
  assert.equal(node.wildlifeMotion.activity, 'idle');
}

for (const team of [0, 1]) test(`seat ${team}: admission is pure and retains the exact endpoint`, () => {
  const node = nodeFor(team), command = commandFor(), before = structuredClone(node);
  const fixture = contextFor(team), plan = planWildlifeHerd(node, command, fixture.context);
  assert.equal(plan.status, 'accepted');
  assert.deepEqual(node, before, 'planning does not mutate food, ownership or current motion');
  assert.deepEqual(fixture.calls, [{ from: 36, to: 46 }]);
  assert.equal(plan.herd.goalX, command.x); assert.equal(plan.herd.goalZ, command.z);
  assert.equal(plan.herd.team, team); assert.equal(plan.herd.pathIndex, 0);
  assert.notEqual(plan.herd.path, fixture.suppliedPath, 'route is independent of planner buffer');
  fixture.suppliedPath[0] = 1;
  assert.deepEqual(plan.herd.path, [37, 38, 46]);
});

const rejectedCommands = [
  ['foreign seat', node => { node.wildlifeTeam = 1; }],
  ['neutral Sheep', node => { node.wildlifeTeam = null; }],
  ['carcass', node => { node.wildlifeState = 'carcass'; }],
  ['depleted', node => { node.wildlifeState = 'depleted'; node.stock = 0; }],
  ['empty live node', node => { node.stock = 0; }],
  ['nonfinite stock', node => { node.stock = Infinity; }],
  ['ordinary food', node => { delete node.wildlifeSpecies; }],
  ['wood', node => { node.type = 'wood'; }],
  ['different ID', (_node, command) => { command.nodeId = 'other'; }],
  ['queued command', (_node, command) => { command.queue = true; }],
  ['nonfinite endpoint', (_node, command) => { command.x = Infinity; }],
  ['numeric string', (_node, command) => { command.x = '2.25'; }],
  ['right map edge', (_node, command) => { command.x = 4; }],
  ['past left map edge', (_node, command) => { command.x = -4.001; }],
  ['past upper map edge', (_node, command) => { command.z = 4; }],
  ['out-of-map source', node => { node.z = -4.001; }],
  ['hidden source', (_node, _command, fixture) => { fixture.hidden.add(36); }],
  ['hidden destination', (_node, _command, fixture) => { fixture.hidden.add(46); }],
  ['water/wall destination', (_node, _command, fixture) => { fixture.blocked.add(46); }],
  ['blocked source', (_node, _command, fixture) => { fixture.blocked.add(36); }],
  ['pending shared Gather', (_node, _command, fixture) => { fixture.context.gatherPending = true; }],
];
for (const [label, modify] of rejectedCommands) test(`${label}: reject before routing and preserve state`, () => {
  const node = nodeFor(), command = commandFor(), fixture = contextFor();
  modify(node, command, fixture);
  const before = structuredClone(node);
  assert.equal(startWildlifeHerd(node, command, fixture.context).status, 'rejected');
  assert.deepEqual(node, before); assert.equal(fixture.calls.length, 0, 'never snap or plan an unauthorized endpoint');
});

test('invalid routes reject row wrapping, diagonal/cell skips, cycles, wrong goals and impassable edges', () => {
  for (const path of [null, [], [37, 46], [39, 40, 46], [37, 38, 37, 38, 46], [37, 38], [37, 38, 99]]) {
    const node = nodeFor(), fixture = contextFor(); fixture.context.findPath = () => path;
    const before = structuredClone(node);
    assert.equal(startWildlifeHerd(node, commandFor(), fixture.context).status, 'rejected');
    assert.deepEqual(node, before);
  }
  const fixture = contextFor(); fixture.impassableEdges.add('37:38');
  assert.equal(startWildlifeHerd(nodeFor(), commandFor(), fixture.context).status, 'rejected', 'elevation edge');
});

for (const team of [0, 1]) test(`seat ${team}: bounded multi-cell travel, heading, exact arrival and local anchor`, () => {
  const node = nodeFor(team), fixture = contextFor(team), before = structuredClone(node);
  assert.equal(startWildlifeHerd(node, commandFor(), fixture.context).status, 'accepted');
  let status, ticks = 0, maxStep = 0;
  do {
    const previous = point(node);
    const segments = [];
    status = stepWildlifeHerd(node, { map, canStep: (from, to) => {
      segments.push({ from, to }); return fixture.canStep(from, to);
    } });
    const travelled = segments.reduce((distance, segment) => distance
      + Math.hypot(segment.to.x - segment.from.x, segment.to.z - segment.from.z), 0);
    maxStep = Math.max(maxStep, travelled);
    assert.ok(travelled <= SHEEP_HERD_SPEED / 30 + epsilon, 'speed budget includes turns and waypoint arrivals');
    assert.ok(Math.hypot(node.x - previous.x, node.z - previous.z) <= SHEEP_HERD_SPEED / 30 + epsilon);
    assert.equal(validWildlifeHerdState(node, fixture.context), true, 'every saved route-progress point is valid');
    if (status.status === 'moving') {
      assert.equal(node.wildlifeMotion.activity, 'wandering');
      assert.ok(node.wildlifeMotion.heading >= 0 && node.wildlifeMotion.heading < Math.PI * 2);
    }
    assert.equal(node.stock, before.stock); assert.equal(node.wildlifeTeam, team);
    assert.equal(node.id, before.id); assert.equal(node.wildlifeState, 'alive');
    assert.equal(node.wildlifeMotion.sequence, before.wildlifeMotion.sequence);
    assert.ok(++ticks < 300);
  } while (status.status === 'moving');
  assert.equal(status.status, 'arrived');
  assert.ok(maxStep > 0); assertFrozen(node, { x: 2.25, z: 1.25 });
  assert.notDeepEqual(node.wildlifeGrazeAnchor, point(before), 'grazing now belongs at the destination');
  assert.equal(Object.hasOwn(node, 'sight'), false); assert.equal(Object.hasOwn(node, 'population'), false);
});

test('same-cell commands travel to the exact requested point rather than instantly arriving', () => {
  const node = nodeFor(), fixture = contextFor(); fixture.context.findPath = () => [];
  assert.equal(startWildlifeHerd(node, { nodeId: node.id, x: .75, z: .5 }, fixture.context).status, 'accepted');
  assert.equal(stepWildlifeHerd(node, { map, canStep: fixture.canStep }).status, 'moving');
  assert.ok(Math.abs(node.x - .52) < epsilon);
  for (let index = 0; index < 20; index++) stepWildlifeHerd(node, { map, canStep: fixture.canStep });
  assertFrozen(node, { x: .75, z: .5 });
});

test('blocked swept segments and terrain changes stop without snapping or crossing the obstruction', () => {
  for (const occupancy of [false, true]) {
    const node = nodeFor(), fixture = contextFor(); startWildlifeHerd(node, commandFor(), fixture.context);
    for (let index = 0; index < 10; index++) stepWildlifeHerd(node, { map, canStep: fixture.canStep });
    const before = point(node);
    const result = stepWildlifeHerd(node, { map, canStep: occupancy ? () => false : (from, to) => {
      fixture.blocked.add(herdCell(to, map)); return fixture.canStep(from, to);
    } });
    assert.equal(result.status, 'blocked'); assertFrozen(node, before);
    assert.equal(node.stock, 130); assert.equal(node.wildlifeTeam, 0);
  }
});

test('waypoint arrival is swept-checked before assignment, including a short final remainder', () => {
  const node = nodeFor(), fixture = contextFor(); startWildlifeHerd(node, commandFor(), fixture.context);
  node.x = 1.499; node.z = .5;
  const before = point(node), segments = [];
  const result = stepWildlifeHerd(node, { map, canStep: (from, to) => {
    segments.push({ from, to }); return false;
  } });
  assert.equal(result.status, 'blocked'); assert.equal(segments.length, 1);
  assert.deepEqual(segments[0].to, { x: 1.5, z: .5 }); assertFrozen(node, before);
});

test('swept-step callback must explicitly allow movement', () => {
  const node = nodeFor(), fixture = contextFor(); startWildlifeHerd(node, commandFor(), fixture.context);
  const before = point(node);
  assert.equal(stepWildlifeHerd(node, { map, canStep: () => undefined }).status, 'blocked');
  assertFrozen(node, before);
});

for (const reason of ['Stop', 'shared Gather', 'recapture', 'carcass', 'depletion']) test(`${reason} cancels at current pose, keeping food/ownership independent`, () => {
  const node = nodeFor(), fixture = contextFor(); startWildlifeHerd(node, commandFor(), fixture.context);
  for (let index = 0; index < 63; index++) stepWildlifeHerd(node, { map, canStep: fixture.canStep });
  const before = point(node);
  let result;
  if (reason === 'Stop') result = { changed: cancelWildlifeHerd(node) };
  if (reason === 'shared Gather') result = stepWildlifeHerd(node, { map, canStep: fixture.canStep, gatherPending: true });
  if (reason === 'recapture') { node.wildlifeTeam = 1; result = stepWildlifeHerd(node, { map, canStep: fixture.canStep }); }
  if (reason === 'carcass') { node.wildlifeState = 'carcass'; node.stock = 42.5; result = stepWildlifeHerd(node, { map, canStep: fixture.canStep }); }
  if (reason === 'depletion') { node.wildlifeState = 'depleted'; node.stock = 0; result = stepWildlifeHerd(node, { map, canStep: fixture.canStep }); }
  assert.equal(result.changed, true); assertFrozen(node, before);
  const frozen = structuredClone(node);
  for (let index = 0; index < 20; index++) stepWildlifeHerd(node, { map, canStep: fixture.canStep });
  assert.deepEqual(node, frozen, 'no old owner/route resumes through subsequent herd ticks');
  assert.equal(validWildlifeHerdState(node, fixture.context), true);
  assert.equal(node.stock, reason === 'carcass' ? 42.5 : reason === 'depletion' ? 0 : 130);
  assert.equal(node.wildlifeTeam, reason === 'recapture' ? 1 : 0);
});

test('a JSON checkpoint mid-route recovers exact position, intent and future authoritative steps', () => {
  const node = nodeFor(), fixture = contextFor(); startWildlifeHerd(node, commandFor(), fixture.context);
  for (let index = 0; index < 71; index++) stepWildlifeHerd(node, { map, canStep: fixture.canStep });
  assert.ok(node.wildlifeHerd && node.wildlifeHerd.pathIndex > 0);
  const savedText = JSON.stringify(node), resumed = JSON.parse(savedText), uninterrupted = structuredClone(node);
  assert.equal(validWildlifeHerdState(resumed, fixture.context), true);
  for (let index = 0; index < 200; index++) {
    assert.deepEqual(stepWildlifeHerd(resumed, { map, canStep: fixture.canStep }),
      stepWildlifeHerd(uninterrupted, { map, canStep: fixture.canStep }));
    assert.deepEqual(resumed, uninterrupted);
  }
  assert.equal(JSON.stringify(node), savedText, 'recovered route array never aliases its checkpoint source');
  assertFrozen(resumed, { x: 2.25, z: 1.25 });
});

test('checkpoint validation rejects malformed owner, endpoint, anchor, lifecycle or route without repair', () => {
  const node = nodeFor(), fixture = contextFor(); startWildlifeHerd(node, commandFor(), fixture.context);
  for (let index = 0; index < 71; index++) stepWildlifeHerd(node, { map, canStep: fixture.canStep });
  const patches = [
    value => { value.wildlifeHerd.team = 1; }, value => { value.wildlifeHerd.team = null; },
    value => { value.wildlifeHerd.goalX = 4; }, value => { value.wildlifeHerd.goalX = NaN; },
    value => { value.wildlifeHerd.goalCell--; }, value => { value.wildlifeHerd.pathIndex = -.1; },
    value => { value.wildlifeHerd.pathIndex = value.wildlifeHerd.path.length; },
    value => { value.wildlifeHerd.path = [37, 46]; }, value => { value.wildlifeHerd.path = [37, 38, 37, 46]; },
    value => { value.wildlifeHerd.path = [37, 38, 64]; }, value => { value.wildlifeHerd.path = [37, 38]; },
    value => { value.wildlifeHerd.path = null; }, value => { value.wildlifeGrazeAnchor.x = -4.1; },
    value => { delete value.wildlifeGrazeAnchor; }, value => { value.x = 4; },
    value => { value.wildlifeState = 'carcass'; }, value => { value.stock = 0; },
  ];
  for (const patch of patches) {
    const corrupt = structuredClone(node); patch(corrupt); const before = structuredClone(corrupt);
    assert.equal(validWildlifeHerdState(corrupt, fixture.context), false); assert.deepEqual(corrupt, before);
  }
  fixture.blocked.add(46);
  assert.equal(validWildlifeHerdState(node, fixture.context), false, 'remaining goal cannot be invalid land');
});

test('a closed gate behind the consumed route does not invalidate checkpoint recovery', () => {
  const node = nodeFor(), fixture = contextFor(); startWildlifeHerd(node, commandFor(), fixture.context);
  for (let index = 0; index < 110; index++) stepWildlifeHerd(node, { map, canStep: fixture.canStep });
  assert.equal(node.wildlifeHerd.pathIndex, 2); fixture.blocked.add(37);
  assert.equal(validWildlifeHerdState(node, fixture.context), true, 'consumed route is structurally valid but may now be blocked');
});

test('active checkpoint keeps its previous graze anchor but requires current-position motion targets', () => {
  const node = nodeFor(), fixture = contextFor(); startWildlifeHerd(node, commandFor(), fixture.context);
  for (let index = 0; index < 100; index++) stepWildlifeHerd(node, { map, canStep: fixture.canStep });
  assert.ok(Math.hypot(node.x - node.wildlifeGrazeAnchor.x, node.z - node.wildlifeGrazeAnchor.z) > .35);
  assert.equal(validWildlifeHerdState(node, fixture.context), true);
  for (const patch of [{ targetX: node.x + .01 }, { targetZ: node.z + .01 }, { waitTicks: 1 }, { activity: 'grazing' }]) {
    const corrupt = structuredClone(node); Object.assign(corrupt.wildlifeMotion, patch);
    assert.equal(validWildlifeHerdState(corrupt, fixture.context), false);
  }
});

test('depleted checkpoint permits construction overlap; positive carcass and idle graze anchors remain guarded', () => {
  const node = nodeFor(), fixture = contextFor(); cancelWildlifeHerd(node);
  node.wildlifeState = 'depleted'; node.stock = 0; fixture.blocked.add(36);
  assert.equal(validWildlifeHerdState(node, fixture.context), true);
  node.wildlifeState = 'carcass'; node.stock = 1;
  assert.equal(validWildlifeHerdState(node, fixture.context), false);
  fixture.blocked.clear(); node.wildlifeState = 'alive'; node.stock = 130;
  node.wildlifeGrazeAnchor.x += .351;
  assert.equal(validWildlifeHerdState(node, fixture.context), false, 'idle pose stays within its persisted local meadow');
  node.x = .95; node.wildlifeGrazeAnchor = { x: 1.05, z: .5 };
  assert.equal(validWildlifeHerdState(node, fixture.context), false, 'idle motion stays in its anchor cell');
});

test('old live motion initializes its authored anchor without resetting stock or mid-leg progress', () => {
  const fixture = contextFor(), node = nodeFor(); delete node.wildlifeHerd; delete node.wildlifeGrazeAnchor;
  node.x = .8; node.wildlifeMotion.targetX = .2; node.wildlifeMotion.activity = 'wandering';
  const before = structuredClone(node);
  const naiveAnchor = createWildlifeHerdState(node).wildlifeGrazeAnchor;
  assert.ok(Math.hypot(node.wildlifeMotion.targetX - naiveAnchor.x,
    node.wildlifeMotion.targetZ - naiveAnchor.z) > .35, 'current-pose initialization would invalidate the existing leg');
  Object.assign(node, createWildlifeHerdState({ x: .5, z: .5 }));
  assert.equal(validWildlifeHerdState(node, fixture.context), true);
  assert.ok(Math.hypot(node.wildlifeMotion.targetX - node.wildlifeGrazeAnchor.x,
    node.wildlifeMotion.targetZ - node.wildlifeGrazeAnchor.z) <= .35);
  const { wildlifeHerd: _herd, wildlifeGrazeAnchor: _anchor, ...preserved } = node;
  assert.deepEqual(preserved, before, 'migration field initialization preserves position/stock/owner/full motion');
});


test('exact schema27 migration adds absent Herd fields without changing claims, motion or food', () => {
  const live = nodeFor(1); live.x = .7; live.wildlifeMotion.targetX = .3;
  const corpse = nodeFor(0); corpse.id = 'corpse'; corpse.x = .7; corpse.stock = 42.5; corpse.wildlifeState = 'carcass';
  cancelWildlifeHerd(corpse);
  for (const node of [live, corpse]) { delete node.wildlifeGrazeAnchor; delete node.wildlifeHerd; }
  const ordinary = {id:'ordinary',type:'food',stock:25,x:-1.5,z:-1.5};
  const original = {schemaVersion:27,mapDefinition:{resourceNodes:[
    {id:'sheep',x:.5,z:.5}, {id:'corpse',x:.5,z:.5}, ordinary]},
    state:{resourceNodes:[live,corpse,ordinary],teamFood:[150.125,151.25],units:[{cargoType:'food',cargo:1.625}]}};
  const migrated = structuredClone(original);
  assert.equal(migrateWildlifeHerdCheckpoint(migrated),true); assert.equal(migrated.schemaVersion,28);
  assert.deepEqual(migrated.state.resourceNodes[0].wildlifeGrazeAnchor,{x:.5,z:.5},'live motion retains original authored anchor');
  assert.deepEqual(migrated.state.resourceNodes[1].wildlifeGrazeAnchor,{x:.7,z:.5},'frozen state anchors its actual position');
  for (const node of migrated.state.resourceNodes.filter(node=>node.wildlifeSpecies)) {
    assert.equal(node.wildlifeHerd,null);delete node.wildlifeHerd;delete node.wildlifeGrazeAnchor;
  }
  migrated.schemaVersion=27;assert.deepEqual(migrated,original,'no owner/stock/cargo/bank/pose/target/wait repair');
  for (const field of ['wildlifeHerd','wildlifeGrazeAnchor']) {
    const invalid=structuredClone(original);invalid.state.resourceNodes[0][field]=null;
    const before=structuredClone(invalid);assert.equal(migrateWildlifeHerdCheckpoint(invalid),false);assert.deepEqual(invalid,before);
  }
  const wrong=structuredClone(original);wrong.schemaVersion=25;assert.equal(migrateWildlifeHerdCheckpoint(wrong),false);
});
