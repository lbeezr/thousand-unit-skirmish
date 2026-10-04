import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { MILLRACE_SHEEP_IDS } from '../src/millrace-sheep.mjs';
import { stepWildlifeMotion } from '../src/wildlife-motion.mjs';

// Explicit historical Millrace authoritative regression, owned with motion.
// Real seats/orders/restarts; no map publication, stock or position injection.
// Rendering is checked by its owning scenario, not by this server-state proof.
const fixture = await createFortifiedFixture({ mapPath: 'maps/bellweather-millrace.json', timeoutMs: 35_000 });
const EPSILON = 1e-6, SNAPSHOT_EPSILON = 0.002;
const RADIUS = 0.35, SPEED = 0.18, OCCUPANCY_RADIUS = 0.45;
const activities = new Set(['idle', 'grazing', 'wandering']);
const openingIds = [0, 1].map(team => `s${team}-0-1`);
const nodeIn = (saved, id) => saved.state.resourceNodes.find(node => node.id === id);
const unitIn = (saved, id) => saved.state.units.find(unit => unit.id === id);
const position = node => ({ x: node.x, z: node.z });
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const frozenState = node => ({ ...position(node), motion: structuredClone(node.wildlifeMotion) });
let orderToken = 100, definitions, map, tickRate, initialFood;
const command = (client, value, pattern) => client.command({ ...value, clientOrderToken: orderToken++ }, pattern);

function cell(node) {
  return Math.floor(node.z + map.height / 2) * map.width + Math.floor(node.x + map.width / 2);
}
function bounded(node, tolerance = EPSILON) {
  const authored = definitions.get(node.id);
  assert.ok(authored, `known Sheep ID ${node.id}`);
  assert.equal(node.wildlifeSpecies, 'bellweather-sheep');
  assert.ok(Number.isFinite(node.x) && Number.isFinite(node.z), 'world position is finite');
  assert.ok(distance(node, authored) <= RADIUS + tolerance, `${node.id} remains within its authored radius`);
  assert.equal(cell(node), cell(authored), `${node.id} remains in its authored resource cell`);
  assert.equal(Object.hasOwn(node, 'team'), false, 'neutral Sheep have no team ownership field');
}
function conserved(saved) {
  const stock = saved.state.resourceNodes.filter(node => node.type === 'food').reduce((sum, node) => sum + node.stock, 0);
  const bank = saved.state.teamFood.reduce((sum, food) => sum + food, 0);
  const cargo = saved.state.units.filter(unit => unit.cargoType === 'food').reduce((sum, unit) => sum + unit.cargo, 0);
  assert.ok(Math.abs(stock + bank + cargo - initialFood) < EPSILON,
    'authored food plus starting banks equals remaining stock, both banks and carried food');
}
function checkSaved(saved, previous = null) {
  assert.equal(saved.mapDefinition.id, 'bellweather-millrace');
  assert.deepEqual(saved.state.resourceNodes.map(node => node.id).sort(), map.resourceNodes.map(node => node.id).sort());
  conserved(saved);
  for (const id of MILLRACE_SHEEP_IDS) {
    const node = nodeIn(saved, id), motion = node.wildlifeMotion;
    bounded(node);
    assert.ok(motion && Number.isInteger(motion.sequence) && motion.sequence >= 0 && motion.sequence <= 0xffffffff);
    assert.ok(Number.isInteger(motion.waitTicks) && motion.waitTicks >= 0);
    assert.ok(activities.has(motion.activity));
    assert.ok(Number.isFinite(motion.heading) && motion.heading >= 0 && motion.heading < Math.PI * 2);
    assert.ok(distance({ x: motion.targetX, z: motion.targetZ }, definitions.get(id)) <= RADIUS + EPSILON);
    if (previous) {
      const seconds = (saved.state.tickNumber - previous.state.tickNumber) / tickRate;
      assert.ok(seconds >= 0);
      assert.ok(distance(node, nodeIn(previous, id)) <= SPEED * seconds + EPSILON,
        `${id} respects the speed bound over saved simulation ticks`);
      const before = nodeIn(previous, id), priorMotion = before.wildlifeMotion;
      if (motion.activity === 'wandering' && priorMotion.activity === 'wandering'
        && motion.targetX === priorMotion.targetX && motion.targetZ === priorMotion.targetZ
        && distance(node, before) > EPSILON) {
        const dx = node.x - before.x, dz = node.z - before.z;
        assert.ok(Math.abs(dx * Math.cos(motion.heading) - dz * Math.sin(motion.heading)) < EPSILON
          && dx * Math.sin(motion.heading) + dz * Math.cos(motion.heading) > 0,
        'heading is zero along +Z and positive toward +X');
      }
    }
  }
}
function noHarvest(saved) {
  checkSaved(saved);
  assert.deepEqual(saved.state.teamFood, [map.startingResources.food, map.startingResources.food]);
  assert.ok(saved.state.units.every(unit => unit.cargo === 0), 'idle wandering grants no cargo');
  for (const authored of map.resourceNodes) assert.equal(nodeIn(saved, authored.id).stock, authored.stock);
  assert.ok(MILLRACE_SHEEP_IDS.every(id => nodeIn(saved, id).wildlifeState === 'alive'));
  for (const id of MILLRACE_SHEEP_IDS) {
    const authored = definitions.get(id);
    assert.ok(saved.state.units.filter(unit => unit.hp > 0).every(unit => distance(unit, authored) > RADIUS + OCCUPANCY_RADIUS),
      'recorded idle units leave the entire authored motion disk clear for recovery replay');
    assert.ok(saved.state.buildings.every(building => !building.footprint.includes(cell(authored))),
      'the authored cell has no building footprint');
  }
}
function checkSnapshot(state, visibleIds, previous = null) {
  const rows = state.resourceNodes.filter(node => node.wildlifeSpecies === 'bellweather-sheep');
  assert.deepEqual(rows.map(node => node.id).sort(), [...visibleIds].sort(), 'hidden Sheep rows stay absent from seat snapshots');
  for (const node of rows) {
    bounded(node, SNAPSHOT_EPSILON);
    assert.ok(activities.has(node.wildlifeActivity));
    assert.ok(Number.isFinite(node.wildlifeHeading) && node.wildlifeHeading >= 0 && node.wildlifeHeading < Math.PI * 2);
    assert.equal(Object.hasOwn(node, 'wildlifeMotion'), false, 'private checkpoint goals are not exposed');
    if (previous) {
      const before = previous.resourceNodes.find(row => row.id === node.id);
      const seconds = (state.tick - previous.tick) / tickRate;
      assert.ok(seconds >= 0);
      assert.ok(distance(node, before) <= SPEED * seconds + SNAPSHOT_EPSILON,
        'seat snapshots move at the authoritative bounded speed');
    }
  }
}
function replay(savedNode, fromTick, toTick) {
  const expected = structuredClone(savedNode);
  // Before any orders, the six authored meadow cells and surrounding units are
  // clear. Replay only elapsed authoritative ticks, never wall-clock duration.
  for (let tick = fromTick; tick < toTick; tick++) {
    stepWildlifeMotion(expected, definitions.get(expected.id), { canStep: () => true });
  }
  return expected;
}

try {
  await fixture.start();
  let clients = [await fixture.connect(0), await fixture.connect(1)];
  map = clients[0].welcome.map;
  assert.equal(map.id, 'bellweather-millrace', 'use the normal worker default');
  definitions = new Map(map.resourceNodes.map(node => [node.id, node]));
  tickRate = (await fixture.health()).tickRate;
  assert.equal(tickRate, 30);
  initialFood = map.resourceNodes.filter(node => node.type === 'food').reduce((sum, node) => sum + node.stock, 0)
    + map.startingResources.food * 2;
  assert.equal(initialFood, 3100);
  const sessions = clients.map(client => client.welcome.player.sessionToken);
  const matchId = clients[0].welcome.matchId;
  const workers = clients.map((client, team) => client.latest.units.find(row => row[1] === team && row[5] === 'worker')[0]);
  const visibleIds = clients.map((client, team) => {
    const ids = client.welcome.state.resourceNodes.filter(node => node.wildlifeSpecies === 'bellweather-sheep').map(node => node.id);
    assert.deepEqual(ids, [openingIds[team]], 'each seat naturally sees its opening Sheep');
    checkSnapshot(client.welcome.state, ids);
    return ids;
  });
  let saved = await fixture.checkpoint();
  const first = saved;
  noHarvest(first);
  const moved = [false, false], seenActivities = [new Set(), new Set()];
  const seenMessages = [0, 0], lastSnapshots = [null, null];
  function inspectMessages() {
    clients.forEach((client, team) => {
      const messages = client.messages.slice(seenMessages[team]);
      seenMessages[team] = client.messages.length;
      for (const message of messages) {
        const state = message.type === 'state' ? message : message.type === 'welcome' ? message.state : null;
        if (!state) continue;
        checkSnapshot(state, visibleIds[team], lastSnapshots[team]);
        const row = state.resourceNodes.find(node => node.id === openingIds[team]);
        seenActivities[team].add(row.wildlifeActivity);
        if (distance(row, definitions.get(row.id)) > 0.01) moved[team] = true;
        lastSnapshots[team] = state;
      }
    });
  }
  while (!moved.every(Boolean) || !seenActivities.every(seen => seen.has('wandering') && seen.size >= 2)) {
    assert.ok(saved.state.tickNumber - first.state.tickNumber < tickRate * 25, 'both opening Sheep naturally become active within the bounded observation');
    const next = await fixture.checkpoint(value => value.sequence > saved.sequence);
    checkSaved(next, saved); noHarvest(next); saved = next;
    inspectMessages();
  }
  // Stop while a real segment still has room to advance; preserve the actual
  // shutdown checkpoint rather than an earlier periodic write.
  saved = await fixture.checkpoint(value => value.sequence > saved.sequence && MILLRACE_SHEEP_IDS.some(id => {
    const node = nodeIn(value, id), motion = node.wildlifeMotion;
    return motion.activity === 'wandering' && distance(node, { x: motion.targetX, z: motion.targetZ }) > 0.1;
  }));
  noHarvest(saved); inspectMessages();
  await fixture.stop();
  const movingSaved = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
  noHarvest(movingSaved);
  assert.ok(MILLRACE_SHEEP_IDS.some(id => nodeIn(movingSaved, id).wildlifeMotion.activity === 'wandering'), 'restart begins mid-motion');
  await fixture.start();
  clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
  for (const [team, client] of clients.entries()) {
    assert.equal(client.welcome.recoveredFromCheckpoint, true);
    assert.equal(client.welcome.matchId, matchId);
    const state = client.welcome.state;
    assert.ok(state.tick >= movingSaved.state.tickNumber);
    checkSnapshot(state, visibleIds[team]);
    const expected = replay(nodeIn(movingSaved, openingIds[team]), movingSaved.state.tickNumber, state.tick);
    const row = state.resourceNodes.find(node => node.id === expected.id);
    assert.ok(distance(row, expected) < SNAPSHOT_EPSILON, 'welcome resumes saved world position after actual startup ticks');
    assert.equal(row.wildlifeActivity, expected.wildlifeMotion.activity);
    assert.ok(Math.abs(row.wildlifeHeading - expected.wildlifeMotion.heading) < SNAPSHOT_EPSILON);
  }
  const restored = await fixture.checkpoint(value => value.sequence > movingSaved.sequence);
  noHarvest(restored); checkSaved(restored, movingSaved);
  for (const id of MILLRACE_SHEEP_IDS) {
    const expected = replay(nodeIn(movingSaved, id), movingSaved.state.tickNumber, restored.state.tickNumber);
    const actual = nodeIn(restored, id);
    assert.deepEqual(actual.wildlifeMotion, expected.wildlifeMotion, 'goal, sequence, wait and heading recover at the saved tick');
    assert.ok(distance(actual, expected) < EPSILON, 'checkpoint position recovers and advances without teleporting');
  }
  // Accepted owned gatherers pin living Sheep while travelling. The first
  // actual arrival activates a carcass; Stop preserves its carried food.
  for (const team of [0, 1]) await command(clients[team], { type: 'gather', ids: [workers[team]], nodeId: openingIds[team] }, /GATHER ORDER/);
  const pending = await fixture.checkpoint(value => workers.every((id, team) => unitIn(value, id).gatherPhase === 'to-node'
    && nodeIn(value, openingIds[team]).wildlifeState === 'alive'));
  checkSaved(pending, restored);
  const held = await fixture.checkpoint(value => value.sequence > pending.sequence && openingIds.some(id => nodeIn(value, id).wildlifeState === 'alive'));
  checkSaved(held, pending);
  for (const id of openingIds) {
    assert.deepEqual(position(nodeIn(held, id)), position(nodeIn(pending, id)), 'pending gather keeps the Sheep in interaction reach');
  }
  const carrying = await fixture.checkpoint(value => workers.every((id, team) => unitIn(value, id).cargo >= 1
    && nodeIn(value, openingIds[team]).wildlifeState === 'carcass'));
  checkSaved(carrying, held);
  const carcasses = openingIds.map(id => frozenState(nodeIn(carrying, id)));
  for (const team of [0, 1]) await command(clients[team], { type: 'stop', ids: [workers[team]] }, /STOP ORDER/);
  const stopped = await fixture.checkpoint(value => workers.every(id => unitIn(value, id).cargo > 0 && unitIn(value, id).gatherPhase === ''));
  checkSaved(stopped, carrying);
  assert.ok(openingIds.every(id => nodeIn(stopped, id).stock < definitions.get(id).stock));
  for (const [team, id] of openingIds.entries()) assert.deepEqual(frozenState(nodeIn(stopped, id)), carcasses[team]);
  // Restart the naturally interrupted harvest before crediting its cargo.
  await fixture.stop();
  const cargoSaved = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
  checkSaved(cargoSaved, stopped);
  await fixture.start();
  clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint && client.welcome.matchId === matchId));
  const interrupted = await fixture.checkpoint(value => value.sequence > cargoSaved.sequence);
  checkSaved(interrupted, cargoSaved);
  for (const [team, id] of openingIds.entries()) {
    assert.equal(nodeIn(interrupted, id).wildlifeState, 'carcass', 'harvested Sheep never revive on recovery');
    assert.equal(nodeIn(interrupted, id).stock, nodeIn(cargoSaved, id).stock);
    assert.deepEqual(frozenState(nodeIn(interrupted, id)), carcasses[team]);
    assert.equal(unitIn(interrupted, workers[team]).cargo, unitIn(cargoSaved, workers[team]).cargo);
  }
  assert.deepEqual(interrupted.state.teamFood, cargoSaved.state.teamFood);
  for (const team of [0, 1]) await command(clients[team], { type: 'returnCargo', ids: [workers[team]] }, /RETURN CARGO ORDER/);
  const delivered = await fixture.checkpoint(value => workers.every(id => unitIn(value, id).cargo === 0 && unitIn(value, id).gatherPhase === ''));
  checkSaved(delivered, interrupted);
  for (const [team, id] of openingIds.entries()) {
    assert.ok(Math.abs(delivered.state.teamFood[team] - cargoSaved.state.teamFood[team] - unitIn(cargoSaved, workers[team]).cargo) < EPSILON);
    assert.equal(nodeIn(delivered, id).stock, nodeIn(cargoSaved, id).stock, 'Return cargo does not harvest more food');
    assert.equal(nodeIn(delivered, id).wildlifeState, 'carcass');
    assert.deepEqual(frozenState(nodeIn(delivered, id)), carcasses[team], 'carcasses remain motionless after workers leave');
  }
  assert.ok(MILLRACE_SHEEP_IDS.filter(id => !openingIds.includes(id)).every(id => nodeIn(delivered, id).wildlifeState === 'alive'
    && nodeIn(delivered, id).stock === definitions.get(id).stock), 'untouched live Sheep preserve their complete food stock');
  const duplicate = structuredClone(delivered); duplicate.state.teamFood[0] += 1;
  assert.throws(() => conserved(duplicate), /authored food plus starting banks/);
  const lost = structuredClone(cargoSaved); unitIn(lost, workers[0]).cargo = 0;
  assert.throws(() => conserved(lost), /authored food plus starting banks/);
  await fixture.stop(); await fixture.start();
  clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint && client.welcome.matchId === matchId));
  const stable = await fixture.checkpoint(value => value.sequence > delivered.sequence);
  checkSaved(stable, delivered);
  assert.deepEqual(stable.state.teamFood, delivered.state.teamFood, 'restart does not duplicate returned food');
  for (const [team, id] of openingIds.entries()) assert.deepEqual(frozenState(nodeIn(stable, id)), carcasses[team]);
  console.log(JSON.stringify({ scenario: 'historical Millrace bounded Sheep motion', map: map.id,
    radius: RADIUS, speed: SPEED, bothSeatVisiblePositionAndActivityVariation: true, hiddenRowsAbsent: true,
    idleFoodAndCargoUnchanged: true, midMotionPositionGoalSequenceWaitRecovery: true,
    pendingGatherPinsSheep: true, realGatherStopReturnCargo: true, interruptedCargoRecovery: true,
    frozenCarcassesNeverRevive: true, returnedFoodCreditsOnce: true,
    lostCargoAndDuplicateCreditControls: true, deliveredBanks: delivered.state.teamFood }));
} finally { await fixture.dispose(); }
