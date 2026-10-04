import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { canTraverseUnitStep } from '../src/unit-movement.mjs';
import { legacyNoseHeadingFromBody, bodyHeadingFromLegacyNose } from '../src/wildlife-heading.mjs';

// Production server bodies, fixed authoritative ticks and real public orders.
// Live pose/stock/ownership/cargo are never injected. Only explicit compatibility
// and malformed-checkpoint cases edit a copy supplied to normal validation.
process.env.RTS_MAP = 'maps/open-field.json';
process.env.RTS_GAME_MODE = 'pvp';
process.env.RTS_PREGAME = '0';
delete process.env.RTS_MATCH_STATE_PATH;
const base = JSON.parse(readFileSync(new URL('../maps/open-field.json', import.meta.url), 'utf8'));
const EPSILON = 1e-8, ids = ['herd-sheep-0', 'herd-sheep-1'];
const goals = [{ x: -5.5, z: -4.5 }, { x: 5.5, z: -4.5 }];
const point = value => ({ x: value.x, z: value.z });
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const row = (saved, id) => saved.state.resourceNodes.find(node => node.id === id);
function mapFor(stock = 130) {
  return { ...structuredClone(base), id: 'sheep-herding-replay', name: 'SHEEP HERDING REPLAY',
    width: 32, height: 24, startingArmySize: 8, terrainBase: 'meadow', fogOfWar: true,
    spawnPoints: [{ team: 0, x: -10.5, z: -4.5 }, { team: 1, x: 10.5, z: -4.5 }],
    startingResources: { food: 150, wood: 250 }, scenarioEvents: [], triggers: [],
    obstacles: [{ column: 9, row: 8, width: 1, height: 1, material: 'water' },
      { column: 9, row: 6, width: 1, height: 1, material: 'stone' }],
    resourceNodes: ids.map((id, team) => ({ id, type: 'food', wildlifeSpecies: 'bellweather-sheep',
      stock, x: team ? 8.5 : -8.5, z: -4.5 })),
  };
}
async function fixtureFor(t, stock) {
  const map = mapFor(stock), fixture = await createPathingReplayFixture(map);
  t.after(() => fixture.dispose());
  const r = fixture.replay;
  for (let index = 0; index < 4; index++) r.step();
  assert.equal(r.checkpoint().schemaVersion, 29);
  assert.ok(ids.every((id, team) => r.resources.get(id).wildlifeTeam === team), 'living nearby Workers naturally claim both Sheep');
  return { r, map, sourceSha256: fixture.sourceSha256 };
}
const workers = (r, team) => r.units.filter(unit => unit.team === team && unit.kind === 'worker');
function unitOrder(r, team, type, selected, extra = {}) {
  const notices = r.order(team, { type, ids: selected.map(unit => unit.id), unitGenerations: selected.map(unit => unit.generation), ...extra });
  r.drain();
  return notices;
}
function herdOrder(r, team, type, nodeId = ids[team], extra = {}) {
  return r.order(team, { type, nodeId, resourceEpoch: r.checkpoint().state.forestEpoch, ...extra });
}
function notice(notices, pattern) {
  assert.ok(notices.some(value => pattern.test(value.message)), JSON.stringify(notices));
}
function until(r, predicate, description, limit = 1500) {
  for (let index = 0; index < limit; index++) {
    if (predicate()) return;
    r.step();
  }
  assert.ok(predicate(), `${description} after ${limit} real simulation ticks`);
}
function conserved(r, map) {
  const saved = r.checkpoint(), stock = saved.state.resourceNodes.reduce((sum, node) => sum + node.stock, 0);
  const bank = saved.state.teamFood.reduce((sum, value) => sum + value, 0);
  const cargo = saved.state.units.filter(unit => unit.cargoType === 'food').reduce((sum, unit) => sum + unit.cargo, 0);
  assert.ok(Math.abs(stock + bank + cargo - (300 + map.resourceNodes.reduce((sum, node) => sum + node.stock, 0))) < EPSILON);
}
function poseAndEconomy(r) {
  const saved = r.checkpoint();
  return { resourceNodes: saved.state.resourceNodes, units: saved.state.units,
    teamFood: saved.state.teamFood, teamWood: saved.state.teamWood, teamStone: saved.state.teamStone };
}
function visibleAt(snapshot, cell) {
  if (!snapshot.visibility) return true;
  const bytes = Buffer.from(snapshot.visibility.data, 'base64');
  return ((bytes[cell >> 2] >> ((cell & 3) * 2)) & 3) === 2;
}
function startBoth(r) {
  for (const team of [0, 1]) notice(herdOrder(r, team, 'herd', ids[team], goals[team]), /^HERD ORDER/);
}

test('both seats issue natural multi-cell Herd/Stop without consuming food or disclosing private intent', async t => {
  const { r, map, sourceSha256 } = await fixtureFor(t);
  t.diagnostic(`production server SHA256 ${sourceSha256}`);
  const initial = r.checkpoint(); startBoth(r);
  for (let tick = 0; tick < 110; tick++) {
    const previous = ids.map(id => point(r.resources.get(id)));
    r.step();
    for (const team of [0, 1]) {
      const node = r.resources.get(ids[team]);
      assert.ok(distance(node, previous[team]) <= .6 / 30 + EPSILON);
      assert.ok(canTraverseUnitStep(r.cell(previous[team].x, previous[team].z), r.cell(node.x, node.z),
        map.width, r.levels, r.isWalkable), 'every actual cell crossing is legal land');
      assert.equal(node.stock, 130); assert.equal(node.wildlifeTeam, team);
    }
  }
  for (const team of [0, 1]) {
    const node = r.resources.get(ids[team]);
    assert.ok(distance(node, map.resourceNodes[team]) > 2, 'cross multiple authored cells');
    const disclosed = r.snapshot(team).resourceNodes.find(value => value.id === node.id);
    assert.ok(disclosed); assert.deepEqual(point(disclosed), point(node));
    for (const field of ['wildlifeHerd', 'wildlifeGrazeAnchor', 'wildlifeMotion']) assert.equal(Object.hasOwn(disclosed, field), false);
    const before = point(node);
    notice(herdOrder(r, team, 'stopWildlife'), /^SHEEP STOP ORDER/);
    assert.equal(node.wildlifeHerd, null); assert.deepEqual(node.wildlifeGrazeAnchor, before);
    assert.deepEqual(point(node), before);
  }
  conserved(r, map);
  assert.deepEqual(r.food, initial.state.teamFood);
  assert.ok(r.units.every(unit => unit.cargo === 0));
});

test('mid-route checkpoint deeply copies herd/anchor/path and resumes identical authoritative continuation', async t => {
  const { r, map } = await fixtureFor(t); startBoth(r);
  for (let index = 0; index < 71; index++) r.step();
  const saved = r.checkpoint(), savedText = JSON.stringify(saved), savedState = structuredClone(saved.state);
  for (const id of ids) {
    const live = r.resources.get(id), captured = row(saved, id);
    assert.ok(live.wildlifeHerd && live.wildlifeHerd.pathIndex > 0);
    assert.notStrictEqual(captured.wildlifeHerd, live.wildlifeHerd);
    assert.notStrictEqual(captured.wildlifeHerd.path, live.wildlifeHerd.path);
    assert.notStrictEqual(captured.wildlifeGrazeAnchor, live.wildlifeGrazeAnchor);
    assert.notStrictEqual(captured.wildlifeMotion, live.wildlifeMotion);
  }
  const future = [];
  for (let index = 0; index < 110; index++) { r.step(); future.push(poseAndEconomy(r)); }
  assert.deepEqual(saved.state, savedState, 'deferred serialization cannot observe later live progress/arrival/anchor changes');
  r.restore(JSON.parse(savedText));
  assert.deepEqual(r.checkpoint().state.resourceNodes, savedState.resourceNodes);
  for (let index = 0; index < future.length; index++) { r.step(); assert.deepEqual(poseAndEconomy(r), future[index]); }
  conserved(r, map);
});

test('stale, foreign, hidden and illegal Herd/Stop orders preserve active intent, pose and economy', async t => {
  const { r, map } = await fixtureFor(t); startBoth(r);
  for (let index = 0; index < 21; index++) r.step();
  const epoch = r.checkpoint().state.forestEpoch;
  const hidden = { x: .5, z: 9.5 }, wet = { x: -6.5, z: -3.5 };
  assert.equal(visibleAt(r.snapshot(0), r.cell(hidden.x, hidden.z)), false);
  assert.equal(visibleAt(r.snapshot(0), r.cell(wet.x, wet.z)), true);
  assert.equal(r.isWalkable(r.cell(wet.x, wet.z)), false);
  const trials = [
    [0, { type: 'herd', nodeId: ids[0], ...goals[0], resourceEpoch: epoch - 1 }],
    [0, { type: 'stopWildlife', nodeId: ids[0], resourceEpoch: epoch - 1 }],
    [0, { type: 'herd', nodeId: ids[0], ...goals[0], resourceEpoch: undefined }],
    [1, { type: 'herd', nodeId: ids[0], ...goals[0] }],
    [1, { type: 'stopWildlife', nodeId: ids[0] }],
    [null, { type: 'herd', nodeId: ids[0], ...goals[0] }],
    [0, { type: 'herd', nodeId: ids[0], ...hidden }],
    [0, { type: 'herd', nodeId: ids[0], ...wet }],
    [0, { type: 'herd', nodeId: ids[0], x: -6.5, z: -5.5 }],
    [0, { type: 'herd', nodeId: ids[0], x: 16, z: -4.5 }],
    [0, { type: 'herd', nodeId: ids[0], x: -16.001, z: -4.5 }],
    [0, { type: 'herd', nodeId: ids[0], x: '-5.5', z: -4.5 }],
    [0, { type: 'herd', nodeId: ids[0], x: null, z: -4.5 }],
    [0, { type: 'herd', nodeId: 'unknown-sheep', ...goals[0] }],
  ];
  for (const [team, command] of trials) {
    const before = poseAndEconomy(r);
    notice(r.order(team, { resourceEpoch: epoch, ...command }), /REJECTED/);
    assert.deepEqual(poseAndEconomy(r), before, JSON.stringify(command));
  }
  r.prepare(map);
  for (let index = 0; index < 4; index++) r.step();
  assert.ok(r.checkpoint().state.forestEpoch > epoch, 'real reset advances the resource lifetime');
  assert.equal(r.resources.get(ids[0]).wildlifeTeam, 0, 'same stable ID is naturally claimed in the new lifetime');
  const resetState = poseAndEconomy(r);
  notice(r.order(0, { type: 'herd', nodeId: ids[0], ...goals[0], resourceEpoch: epoch }), /RESOURCE STATE CHANGED/);
  assert.deepEqual(poseAndEconomy(r), resetState);
});

test('an owned Sheep leaving real sight exposes no row or remote Herd/Stop authority', async t => {
  const { r, map } = await fixtureFor(t), observer = workers(r, 0)[0];
  notice(unitOrder(r, 0, 'move', [observer], { x: -1.5, z: 7.5 }), /^MOVE ORDER/);
  until(r, () => !observer.movePlanningPending && observer.pathIndex === observer.path.length, 'observer reveals a distant destination');
  const goal = { x: -1.5, z: 4.5 };
  assert.equal(visibleAt(r.snapshot(0), r.cell(goal.x, goal.z)), true);
  notice(herdOrder(r, 0, 'herd', ids[0], goal), /^HERD ORDER/);
  until(r, () => r.resources.get(ids[0]).wildlifeHerd === null
    && distance(r.resources.get(ids[0]), goal) < .35, 'real herd arrives away from home sight');
  notice(unitOrder(r, 0, 'move', [observer], map.spawnPoints[0]), /^MOVE ORDER/);
  until(r, () => !observer.movePlanningPending && observer.pathIndex === observer.path.length, 'observer leaves the herd');
  until(r, () => !r.snapshot(0).resourceNodes.some(node => node.id === ids[0]), 'moving resource row disappears at actual-cell fog');
  assert.equal(r.resources.get(ids[0]).wildlifeTeam, 0, 'ownership grants no sight');
  const before = poseAndEconomy(r);
  notice(herdOrder(r, 0, 'herd', ids[0], goals[0]), /VISIBLE ENDPOINTS REQUIRED/);
  notice(herdOrder(r, 0, 'stopWildlife'), /^SHEEP STOP REJECTED/);
  assert.deepEqual(poseAndEconomy(r), before); conserved(r, map);
});

for (const owner of [0, 1]) test(`seat ${owner}: an opposing visible Worker's shared Gather cancels Herd immediately`, async t => {
  const { r, map } = await fixtureFor(t), enemy = workers(r, 1 - owner)[0];
  const site = { x: owner ? 5.5 : -5.5, z: -1.5 };
  notice(unitOrder(r, 1 - owner, 'move', [enemy], site), /^MOVE ORDER/); r.drain();
  until(r, () => enemy.pathIndex === enemy.path.length && !enemy.movePlanningPending, 'enemy observes source');
  const node = r.resources.get(ids[owner]);
  assert.equal(node.wildlifeTeam, owner);
  assert.ok(r.snapshot(1 - owner).resourceNodes.some(value => value.id === node.id));
  notice(herdOrder(r, owner, 'herd', node.id, goals[owner]), /^HERD ORDER/);
  const before = poseAndEconomy(r), location = point(node);
  notice(unitOrder(r, 1 - owner, 'gather', [enemy], { nodeId: node.id }), /^GATHER ORDER/);
  assert.equal(node.wildlifeHerd, null); assert.deepEqual(node.wildlifeGrazeAnchor, location);
  assert.deepEqual(point(node), location); assert.equal(node.wildlifeTeam, owner);
  assert.equal(node.stock, before.resourceNodes.find(value => value.id === node.id).stock);
  assert.equal(enemy.gatherNodeId, node.id); assert.equal(enemy.gatherPhase, 'to-node');
  assert.deepEqual(r.food, before.teamFood); assert.equal(enemy.cargo, 0);
  notice(herdOrder(r, owner, 'herd', node.id, goals[owner]), /GATHER IN PROGRESS/);
  conserved(r, map);
});

for (const schemaVersion of [26, 27]) test(`exact schema${schemaVersion} migration preserves real claims, live motion, partial corpse stock, cargo and banks`, async t => {
  const { r, map } = await fixtureFor(t), worker = workers(r, 0)[0];
  notice(unitOrder(r, 0, 'gather', [worker], { nodeId: ids[0] }), /^GATHER ORDER/);
  until(r, () => worker.cargo > .25 && r.resources.get(ids[0]).wildlifeState === 'carcass', 'real partial harvest');
  notice(unitOrder(r, 0, 'stop', [worker]), /^STOP ORDER/);
  until(r, () => r.resources.get(ids[1]).wildlifeMotion.activity === 'wandering', 'live saved grazing leg');
  const legacy = r.checkpoint(); legacy.schemaVersion = schemaVersion;
  if (schemaVersion === 26) { delete legacy.matchModeId; delete legacy.matchModeVersion; }
  for (const node of legacy.state.resourceNodes) { delete node.wildlifeHerd; delete node.wildlifeGrazeAnchor;
    node.wildlifeMotion.heading = legacyNoseHeadingFromBody(node.wildlifeMotion.heading); }
  const before = structuredClone(legacy), migrated = structuredClone(legacy);
  r.validate(migrated); assert.equal(migrated.schemaVersion, 29);
  assert.equal(migrated.matchModeId, 'authored'); assert.equal(migrated.matchModeVersion, 1);
  for (const field of ['units', 'teamFood', 'teamWood', 'teamStone', 'unitGenerationCounters']) {
    assert.deepEqual(migrated.state[field], before.state[field], `migration retains ${field}`);
  }
  for (const node of migrated.state.resourceNodes) {
    const { wildlifeHerd, wildlifeGrazeAnchor, ...preserved } = node;
    assert.equal(wildlifeHerd, null);
    const old = structuredClone(row(before, node.id));
    old.wildlifeMotion.heading = bodyHeadingFromLegacyNose(old.wildlifeMotion.heading);
    assert.deepEqual(preserved, old, 'only the prescribed body-heading conversion changes saved pose/motion; no stock or claim repair');
    const authored = map.resourceNodes.find(value => value.id === node.id);
    assert.deepEqual(wildlifeGrazeAnchor, point(node.wildlifeState === 'alive' ? authored : node));
  }
  r.restore(migrated);
  assert.deepEqual(r.checkpoint().state.resourceNodes, migrated.state.resourceNodes);
  assert.equal(r.units[worker.id].cargo, before.state.units[worker.id].cargo);
  assert.deepEqual(r.food, before.state.teamFood); conserved(r, map);
});

test('current schema rejects malformed Herd/anchor and a structurally valid route through authored water', async t => {
  const { r } = await fixtureFor(t); startBoth(r);
  for (let index = 0; index < 71; index++) r.step();
  const saved = r.checkpoint(); r.validate(structuredClone(saved));
  const patches = [
    node => { node.wildlifeHerd.team = 1; },
    node => { node.wildlifeHerd.pathIndex = -1; },
    node => { node.wildlifeHerd.goalCell++; },
    node => { node.wildlifeGrazeAnchor.x = 16; },
    node => { delete node.wildlifeGrazeAnchor; },
    node => { node.wildlifeMotion.targetX += .01; },
    node => { node.wildlifeHerd.path = [[-7.5, -4.5], [-6.5, -4.5], [-6.5, -3.5], [-5.5, -3.5], [-5.5, -4.5]]
      .map(([x, z]) => r.cell(x, z)); },
  ];
  for (const patch of patches) {
    const corrupt = structuredClone(saved); patch(row(corrupt, ids[0]));
    const unchanged = structuredClone(corrupt);
    assert.throws(() => r.validate(corrupt), /invalid resource node state/i);
    assert.deepEqual(corrupt, unchanged, 'current schema never repairs malformed authority fields');
  }
  assert.deepEqual(r.checkpoint().state.resourceNodes, saved.state.resourceNodes, 'validation never mutates the running room');
});

test('real open-gate crossing validates/restores mid-cell; occupied close rejects and depleted close succeeds', async t => {
  const { r, map } = await fixtureFor(t, 4.25), builder = workers(r, 0)[0];
  notice(unitOrder(r, 0, 'build', [builder], { buildingType: 'palisade-gate', x: -6.5, z: -4.5 }), /PALISADE GATE PLACED/);
  r.drain(); until(r, () => r.buildings[0]?.complete, 'paid gate completion');
  const gate = r.buildings[0];
  notice(r.order(0, { type: 'setGateOpen', buildingId: gate.id, open: true }), /^GATE OPEN/);
  notice(unitOrder(r, 0, 'move', [builder], { x: -9.5, z: -.5 }), /^MOVE ORDER/);
  r.drain(); until(r, () => builder.pathIndex === builder.path.length && !builder.movePlanningPending, 'builder clears gate route');
  notice(herdOrder(r, 0, 'herd', ids[0], goals[0]), /^HERD ORDER/);
  const node = r.resources.get(ids[0]);
  until(r, () => node.wildlifeHerd && gate.footprint.includes(r.cell(node.x, node.z)), 'Sheep enters open gate');
  assert.ok(distance(node, gate) > .1, 'save is inside the gate cell before its center waypoint');
  const revision = r.navigationRevision;
  notice(r.order(0, { type: 'setGateOpen', buildingId: gate.id, open: false }), /^GATE REJECTED/);
  assert.equal(gate.gateOpen, true); assert.equal(r.navigationRevision, revision);
  const saved = r.checkpoint(); r.validate(structuredClone(saved));
  for (const patch of [value => { value.gateOpen = false; }, value => { value.complete = false; value.progress = .5; }]) {
    const invalid = structuredClone(saved); patch(invalid.state.buildings[0]);
    assert.throws(() => r.validate(invalid), /invalid match checkpoint/i,
      'the overlap exception belongs only to a completed open gate');
  }
  const before = point(node), intent = structuredClone(node.wildlifeHerd);
  for (let index = 0; index < 3; index++) r.step();
  r.restore(structuredClone(saved));
  const restored = r.resources.get(ids[0]), restoredGate = r.buildings[0];
  assert.deepEqual(point(restored), before); assert.deepEqual(restored.wildlifeHerd, intent);
  assert.equal(restoredGate.gateOpen, true);
  notice(herdOrder(r, 0, 'stopWildlife'), /^SHEEP STOP ORDER/);
  const gatherer = workers(r, 0)[1];
  notice(unitOrder(r, 0, 'gather', [gatherer], { nodeId: ids[0] }), /^GATHER ORDER/);
  until(r, () => restored.stock === 0, 'finite food depletes inside open gate');
  assert.equal(restored.wildlifeState, 'depleted');
  notice(unitOrder(r, 0, 'move', workers(r, 0), { x: -10.5, z: 2.5 }), /^MOVE ORDER/);
  r.drain(); until(r, () => workers(r, 0).every(unit => !unit.movePlanningPending && unit.pathIndex === unit.path.length), 'Workers clear occupied gate');
  assert.ok(!r.units.some(unit => unit.hp > 0 && restoredGate.footprint.includes(r.cell(unit.x, unit.z))));
  notice(r.order(0, { type: 'setGateOpen', buildingId: restoredGate.id, open: false }), /^GATE CLOSED/);
  assert.equal(restoredGate.gateOpen, false);
  r.validate(r.checkpoint()); conserved(r, map);
});
