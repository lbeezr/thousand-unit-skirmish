import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { createNeutralWildlifeRenderer } from '../src/neutral-wildlife-renderer.mjs';

// Source-only authority proof: real ordinary-map publication, Workers, orders,
// paid construction and restarts. No saved stock, bank or position is patched.
// Ordinary browser selection/HUD binding and hosted appearance remain separate.
const map = JSON.parse(await readFile(new URL('../maps/open-field.json', import.meta.url)));
Object.assign(map, { id: 'sheep-herding-proof', name: 'SHEEP HERDING PROOF', summary: '160 × 160 · owned Sheep authority',
  width: 160, height: 160, terrainBase: 'meadow', fogOfWar: true, startingArmySize: 8,
  spawnPoints: [{ team: 0, x: -14.5, z: -5.5 }, { team: 1, x: 14.5, z: -5.5 }],
  startingResources: { food: 0, wood: 250 }, scenarioEvents: [],
  obstacles: [{ column: 79, row: 81, width: 1, height: 1, material: 'stone' }],
  resourceNodes: [
    { id: 'herd-sheep-0', type: 'food', x: -6.5, z: 4.5, stock: 4.25 },
    { id: 'herd-sheep-1', type: 'food', x: 6.5, z: 4.5, stock: 4.25 },
    { id: 'hidden-sheep', type: 'food', x: .5, z: -14.5, stock: 100 },
  ].map(node => ({ ...node, wildlifeSpecies: 'bellweather-sheep' })),
});
const fixture = await createFortifiedFixture({ mapPath: null, matchModeId: 'authored', timeoutMs: 45_000 });
const sourceHash = async () => createHash('sha256').update(await readFile(new URL('../server.mjs', import.meta.url))).digest('hex');
const serverSha256 = await sourceHash();
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
const renderer = createNeutralWildlifeRenderer({ THREE, scene, groundHeight: () => 0,
  loadArt: () => Promise.reject(new Error('explicit CPU fallback')) });
renderer.reset(map.resourceNodes, map);
let maxRenderedDisplacement = 0;
const EPSILON = 1e-6, SNAPSHOT_EPSILON = .002, HERD_SPEED = .6;
const ids = [0, 1].map(team => `herd-sheep-${team}`);
const goals = [{ x: -2.5, z: 4.5 }, { x: 2.5, z: 4.5 }];
const observerSites = [{ x: -1.5, z: 4.5 }, { x: 1.5, z: 4.5 }];
const nodeIn = (saved, id) => saved.state.resourceNodes.find(node => node.id === id);
const unitIn = (saved, id) => saved.state.units.find(unit => unit.id === id);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const frozen = node => ({ x: node.x, z: node.z, wildlifeTeam: node.wildlifeTeam,
  wildlifeHerd: structuredClone(node.wildlifeHerd), wildlifeGrazeAnchor: { ...node.wildlifeGrazeAnchor },
  wildlifeMotion: structuredClone(node.wildlifeMotion) });
let clients = [], workers, orderToken = 100, tickRate, phase = 'publish', maxObservedSpeed = 0;
const command = (team, value, pattern) => clients[team].command({ ...value, clientOrderToken: orderToken++ }, pattern);
const sheepOrder = (team, type, nodeId, value = {}, pattern = type === 'herd' ? /HERD ORDER/ : /SHEEP STOP ORDER/) =>
  command(team, { type, nodeId, resourceEpoch: clients[team].latest.forestEpoch, ...value }, pattern);

function conserved(saved) {
  assert.equal(saved.schemaVersion, 30);
  assert.deepEqual(saved.state.resourceNodes.map(node => node.id).sort(), map.resourceNodes.map(node => node.id).sort());
  for (const resource of ['food', 'wood']) {
    const initial = map.startingResources[resource] * 2
      + map.resourceNodes.filter(node => node.type === resource).reduce((sum, node) => sum + node.stock, 0);
    const stock = saved.state.resourceNodes.filter(node => node.type === resource).reduce((sum, node) => sum + node.stock, 0);
    const bank = (resource === 'food' ? saved.state.teamFood : saved.state.teamWood).reduce((sum, amount) => sum + amount, 0);
    const cargo = saved.state.units.filter(unit => unit.cargoType === resource).reduce((sum, unit) => sum + unit.cargo, 0);
    const paid = saved.state.buildings.reduce((sum, building) => sum + BUILDING_DEFINITIONS[building.type].cost[resource], 0);
    assert.ok(Math.abs(initial - stock - bank - cargo - paid) < EPSILON,
      `${resource} equals remaining stock, banks, cargo and paid construction`);
  }
  for (const node of saved.state.resourceNodes) {
    assert.ok([null, 0, 1].includes(node.wildlifeTeam));
    assert.ok(Number.isFinite(node.x) && Number.isFinite(node.z));
    assert.ok(Number.isFinite(node.wildlifeGrazeAnchor?.x) && Number.isFinite(node.wildlifeGrazeAnchor?.z));
  }
}
function untouched(saved) {
  conserved(saved);
  assert.deepEqual(saved.state.teamFood, [0, 0]);
  assert.ok(saved.state.units.every(unit => unit.cargo === 0));
  for (const authored of map.resourceNodes) {
    const node = nodeIn(saved, authored.id);
    assert.equal(node.stock, authored.stock); assert.equal(node.wildlifeState, 'alive');
  }
}
function publicRows(state) {
  renderer.reconcile(state.resourceNodes, () => true); renderer.update(camera);
  for (const definition of map.resourceNodes) {
    const row = state.resourceNodes.find(node => node.id === definition.id);
    const available = Boolean(row && row.stock > 0);
    assert.equal(renderer.isAvailable(definition.id), available, 'actual server disclosure drives client availability');
    if (available) {
      const group = scene.children.find(item => item.userData.wildlifeNodeId === definition.id);
      assert.deepEqual(group.position.toArray(), [row.x, 0, row.z], 'relocated authority poses are admitted by the production renderer');
      maxRenderedDisplacement = Math.max(maxRenderedDisplacement, distance(row, definition));
    }
  }
  assert.ok(!state.resourceNodes.some(node => node.id === 'hidden-sheep'), 'hidden Sheep remain absent without ownership sight');
  for (const node of state.resourceNodes.filter(node => node.wildlifeSpecies !== undefined)) {
    assert.ok([null, 0, 1].includes(node.wildlifeTeam));
    assert.ok(Number.isFinite(node.x) && Number.isFinite(node.z));
    assert.ok(Number.isFinite(node.wildlifeHeading) && node.wildlifeHeading >= 0 && node.wildlifeHeading < Math.PI * 2);
    if (node.wildlifeState === 'alive') assert.ok(['idle', 'grazing', 'wandering'].includes(node.wildlifeActivity));
    else assert.equal(Object.hasOwn(node, 'wildlifeActivity'), false, 'frozen carcasses/depleted rows carry no live activity');
    assert.equal(Object.hasOwn(node, 'team'), false);
    assert.equal(Object.hasOwn(node, 'wildlifeHerd'), false);
    assert.equal(Object.hasOwn(node, 'wildlifeGrazeAnchor'), false);
    assert.equal(Object.hasOwn(node, 'wildlifeMotion'), false);
  }
}
function boundedStep(before, after) {
  const seconds = (after.state.tickNumber - before.state.tickNumber) / tickRate;
  assert.ok(seconds >= 0);
  for (const id of ids) {
    const travel = distance(nodeIn(before, id), nodeIn(after, id));
    assert.ok(travel <= HERD_SPEED * seconds + EPSILON,
      'authoritative travel never exceeds the trial speed over saved simulation ticks');
    if (seconds > 0) maxObservedSpeed = Math.max(maxObservedSpeed, travel / seconds);
  }
}
async function move(team, worker, target) {
  await command(team, { type: 'move', ids: [worker], x: target.x, z: target.z }, /MOVE ORDER/);
  return fixture.checkpoint(saved => unitIn(saved, worker)?.hp > 0 && distance(unitIn(saved, worker), target) < .25);
}
async function build(site, pattern) {
  return command(0, { type: 'build', buildingType: 'house', ids: [workers[0][2]], x: site.x, z: site.z }, pattern);
}
async function recover() {
  const sessions = clients.map(client => client.welcome.player.sessionToken);
  await fixture.stop();
  const saved = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
  assert.equal(await sourceHash(), serverSha256, 'recovery runs the same server bytes as the original match');
  await fixture.start();
  clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
  for (const client of clients) {
    assert.equal(client.welcome.recoveredFromCheckpoint, true);
    assert.equal(client.welcome.matchId, saved.matchId);
    assert.ok(client.welcome.state.tick >= saved.state.tickNumber);
    publicRows(client.welcome.state);
  }
  return { saved, recovered: await fixture.checkpoint(value => value.sequence > saved.sequence) };
}

try {
  await fixture.start(); clients = [await fixture.connect(0), await fixture.connect(1)];
  tickRate = (await fixture.health()).tickRate; assert.equal(tickRate, 30);
  const staleResourceEpoch = clients[0].latest.forestEpoch;
  const after = clients.map(client => client.messages.length);
  clients[0].send({ type: 'publishMap', map, persist: true });
  const publication = await clients[0].wait(message => message.type === 'mapPublished' || message.type === 'mapRejected', 'ordinary herding map admitted', after[0]);
  assert.equal(publication.type, 'mapPublished', publication.message);
  await Promise.all(clients.map((client, team) => client.wait(message => message.type === 'mapChange' && message.map.id === map.id,
    'ordinary herding match started', after[team])));
  workers = clients.map((client, team) => client.latest.units.filter(row => row[1] === team && row[5] === 'worker').map(row => row[0]));
  const initial = await fixture.checkpoint(saved => saved.mapDefinition.id === map.id);
  untouched(initial);
  assert.notEqual(clients[0].latest.forestEpoch, staleResourceEpoch, 'map publication actually retires the prior resource epoch');
  assert.ok(initial.state.resourceNodes.every(node => node.wildlifeTeam === null && node.wildlifeHerd === null));
  for (const team of [0, 1]) {
    const home = map.resourceNodes[team];
    await move(team, workers[team][0], { x: home.x + (team ? 1 : -1), z: home.z });
    await move(team, workers[team][1], observerSites[team]);
  }
  const claimed = await fixture.checkpoint(saved => ids.every((id, team) => nodeIn(saved, id).wildlifeTeam === team));
  untouched(claimed);
  phase = 'admission rejection';
  for (const client of clients) {
    await client.state(state => ids.every(id => state.resourceNodes.some(node => node.id === id)), 'both visible owned/foreign sources revealed');
    publicRows(client.latest);
  }
  await build(map.resourceNodes[0], /RESOURCE NODE IN FOOTPRINT/);
  for (const team of [0, 1]) {
    await sheepOrder(1 - team, 'herd', ids[team], goals[team], /HERD REJECTED/);
    await sheepOrder(1 - team, 'stopWildlife', ids[team], {}, /SHEEP STOP REJECTED/);
    await sheepOrder(team, 'herd', 'hidden-sheep', goals[team], /HERD REJECTED/);
    await sheepOrder(team, 'stopWildlife', 'hidden-sheep', {}, /SHEEP STOP REJECTED/);
    await sheepOrder(team, 'herd', ids[team], { ...goals[team], resourceEpoch: staleResourceEpoch }, /HERD REJECTED/);
    await sheepOrder(team, 'stopWildlife', ids[team], { resourceEpoch: staleResourceEpoch }, /SHEEP STOP REJECTED/);
  }
  for (const target of [{ x: -22.5, z: 14.5 }, { x: 24, z: 4.5 }, { x: -.5, z: 1.5 },
    { x: null, z: 4.5 }, { x: '2.5', z: 4.5 }]) {
    await sheepOrder(0, 'herd', ids[0], target, /HERD REJECTED/);
  }
  const rejected = await fixture.checkpoint(saved => saved.sequence > claimed.sequence);
  untouched(rejected);
  assert.equal(rejected.state.buildings.length, 0);
  assert.deepEqual(rejected.state.teamWood, [250, 250]);
  assert.ok(ids.every(id => nodeIn(rejected, id).wildlifeHerd === null), 'rejected commands never create a route');

  phase = 'both-seat herding and Stop';
  for (const team of [0, 1]) await sheepOrder(team, 'herd', ids[team], goals[team]);
  const moving = await fixture.checkpoint(saved => ids.every((id, team) => {
    const node = nodeIn(saved, id);
    return node.wildlifeHerd && distance(node, map.resourceNodes[team]) > 1.2 && distance(node, goals[team]) > 1.5;
  }));
  untouched(moving); boundedStep(rejected, moving);
  for (const team of [0, 1]) {
    const row = await clients[team].state(state => state.resourceNodes.some(node => node.id === ids[team] && node.wildlifeActivity === 'wandering'), 'real herding position/activity disclosed');
    publicRows(row);
  }
  await sheepOrder(0, 'stopWildlife', ids[0], { resourceEpoch: staleResourceEpoch }, /SHEEP STOP REJECTED/);
  await sheepOrder(1, 'stopWildlife', ids[1]);
  const stopped = await fixture.checkpoint(saved => nodeIn(saved, ids[0]).wildlifeHerd && nodeIn(saved, ids[1]).wildlifeHerd === null);
  untouched(stopped); boundedStep(moving, stopped);
  const stopAnchor = { ...nodeIn(stopped, ids[1]).wildlifeGrazeAnchor };
  assert.ok(distance(stopAnchor, map.resourceNodes[1]) > 1, 'Stop anchors the actual moved pose, not the authored origin');
  assert.ok(distance(nodeIn(stopped, ids[1]), stopAnchor) <= .35 + EPSILON);
  phase = 'mid-route recovery';
  const midRoute = await recover();
  untouched(midRoute.saved); untouched(midRoute.recovered); boundedStep(midRoute.saved, midRoute.recovered);
  const before = nodeIn(midRoute.saved, ids[0]), resumed = nodeIn(midRoute.recovered, ids[0]);
  assert.ok(before.wildlifeHerd && resumed.wildlifeHerd, 'restart really occurs before arrival');
  for (const field of ['team', 'goalX', 'goalZ', 'goalCell', 'path']) {
    assert.deepEqual(resumed.wildlifeHerd[field], before.wildlifeHerd[field], `mid-route recovery retains ${field}`);
  }
  assert.ok(resumed.wildlifeHerd.pathIndex >= before.wildlifeHerd.pathIndex);
  assert.equal(resumed.stock, before.stock); assert.equal(resumed.wildlifeTeam, before.wildlifeTeam);
  assert.ok(distance(resumed.wildlifeGrazeAnchor, before.wildlifeGrazeAnchor)
    <= HERD_SPEED * (midRoute.recovered.state.tickNumber - midRoute.saved.state.tickNumber) / tickRate + EPSILON);
  assert.equal(nodeIn(midRoute.recovered, ids[1]).wildlifeHerd, null);
  assert.deepEqual(nodeIn(midRoute.recovered, ids[1]).wildlifeGrazeAnchor, stopAnchor);
  for (const client of clients) {
    const state = client.welcome.state, row = state.resourceNodes.find(node => node.id === ids[0]);
    if (row) assert.ok(distance(row, before) <= HERD_SPEED * (state.tick - midRoute.saved.state.tickNumber) / tickRate + SNAPSHOT_EPSILON,
      'welcome cannot teleport a moving Sheep on recovery');
  }
  phase = 'arrival and paid construction';
  await sheepOrder(1, 'herd', ids[1], goals[1]);
  const arrived = await fixture.checkpoint(saved => ids.every((id, team) => nodeIn(saved, id).wildlifeHerd === null
    && distance(nodeIn(saved, id), goals[team]) <= .35 + EPSILON));
  untouched(arrived); boundedStep(midRoute.recovered, arrived);
  assert.ok(ids.every((id, team) => distance(nodeIn(arrived, id), map.resourceNodes[team]) > 3.5), 'both seats travel across multiple cells');
  // Ownership itself supplies no sight. Hide an already owned alive Sheep so
  // rejection proves the source-visibility guard, independently of foreignness.
  phase = 'owned hidden-source rejection';
  await move(0, workers[0][0], { x: -12.5, z: -9.5 });
  const hiddenOwned = await move(0, workers[0][1], { x: -16.5, z: -9.5 });
  untouched(hiddenOwned);
  assert.equal(nodeIn(hiddenOwned, ids[0]).wildlifeTeam, 0);
  await clients[0].state(state => !state.resourceNodes.some(node => node.id === ids[0]), 'owned Sheep omitted after own sight departs');
  await sheepOrder(0, 'herd', ids[0], goals[0], /HERD REJECTED/);
  await sheepOrder(0, 'stopWildlife', ids[0], {}, /SHEEP STOP REJECTED/);
  const hiddenRejected = await fixture.checkpoint(saved => saved.sequence > hiddenOwned.sequence);
  untouched(hiddenRejected);
  assert.equal(nodeIn(hiddenRejected, ids[0]).wildlifeTeam, 0);
  assert.equal(nodeIn(hiddenRejected, ids[0]).wildlifeHerd, null);
  await move(0, workers[0][0], { x: -7.5, z: 4.5 });
  phase = 'arrival and paid construction';
  await move(0, workers[0][1], { x: -2.5, z: 8.5 });
  await build(nodeIn(arrived, ids[0]), /RESOURCE NODE IN FOOTPRINT/);
  await move(0, workers[0][0], { x: -3.5, z: 4.5 });
  await build(map.resourceNodes[0], /HOUSE PLACED/);
  const constructed = await fixture.checkpoint(saved => saved.state.buildings.some(building => building.type === 'house' && building.team === 0));
  untouched(constructed);
  assert.deepEqual(constructed.state.teamWood, [250 - BUILDING_DEFINITIONS.house.cost.wood, 250]);

  // Recapture during a second real route must cancel at the actual pose. Keep
  // owner units visible but outside claim range before the opponent arrives.
  phase = 'mid-route recapture';
  await move(0, workers[0][0], { x: -9.5, z: 4.5 });
  await move(1, workers[1][2], { x: .5, z: 4.5 });
  await sheepOrder(0, 'herd', ids[0], { x: -.5, z: 4.5 });
  await move(1, workers[1][2], { x: -1.5, z: 4.5 });
  const recaptured = await fixture.checkpoint(saved => nodeIn(saved, ids[0]).wildlifeTeam === 1 && nodeIn(saved, ids[0]).wildlifeHerd === null);
  untouched(recaptured);
  assert.ok(distance(nodeIn(recaptured, ids[0]), { x: -.5, z: 4.5 }) > .5, 'recapture interrupts before the ordered goal');
  assert.ok(distance(nodeIn(recaptured, ids[0]), nodeIn(recaptured, ids[0]).wildlifeGrazeAnchor) <= .35 + EPSILON);
  await sheepOrder(0, 'herd', ids[0], { x: -4.5, z: 4.5 }, /HERD REJECTED/);
  await sheepOrder(0, 'stopWildlife', ids[0], {}, /SHEEP STOP REJECTED/);
  phase = 'opposing Gather cancels herd';
  await sheepOrder(1, 'herd', ids[0], { x: -4.5, z: 4.5 });
  await command(0, { type: 'gather', ids: [workers[0][3]], nodeId: ids[0] }, /GATHER ORDER/);
  const gatherHeld = await fixture.checkpoint(saved => nodeIn(saved, ids[0]).wildlifeHerd === null
    && nodeIn(saved, ids[0]).wildlifeState === 'alive' && unitIn(saved, workers[0][3]).gatherPhase === 'to-node');
  untouched(gatherHeld);
  assert.equal(nodeIn(gatherHeld, ids[0]).wildlifeTeam, 1, 'accepted opposing Gather cancels herd without changing ownership or food');
  const carrying = await fixture.checkpoint(saved => nodeIn(saved, ids[0]).wildlifeState === 'carcass' && unitIn(saved, workers[0][3]).cargo >= .5);
  conserved(carrying);
  assert.equal(nodeIn(carrying, ids[0]).wildlifeTeam, 1);
  const carcass = frozen(nodeIn(carrying, ids[0]));
  await command(0, { type: 'stop', ids: [workers[0][3]] }, /STOP ORDER/);
  const interrupted = await fixture.checkpoint(saved => unitIn(saved, workers[0][3]).cargo > 0 && unitIn(saved, workers[0][3]).gatherPhase === '');
  conserved(interrupted);
  phase = 'partial stock and cargo recovery';
  const partial = await recover();
  conserved(partial.saved); conserved(partial.recovered);
  assert.deepEqual(frozen(nodeIn(partial.recovered, ids[0])), carcass);
  assert.equal(nodeIn(partial.recovered, ids[0]).stock, nodeIn(partial.saved, ids[0]).stock);
  assert.equal(unitIn(partial.recovered, workers[0][3]).cargo, unitIn(partial.saved, workers[0][3]).cargo);
  await move(0, workers[0][3], { x: -7.5, z: 7.5 });
  await move(1, workers[1][2], { x: 1.5, z: 8.5 });
  await build(nodeIn(partial.recovered, ids[0]), /RESOURCE NODE IN FOOTPRINT/);
  await sheepOrder(1, 'herd', ids[0], { x: -4.5, z: 4.5 }, /HERD REJECTED/);

  // Both seats can consume the same carcass; another owned live Sheep still
  // accepts the opposing Gather path. The whole original food pool is reused.
  // Stage real Workers outside claim/occupancy range before ordering Gather:
  // these intentionally small pools must not empty before a distant seat arrives.
  phase = 'stage shared harvest';
  await move(0, workers[0][0], { x: -9.5, z: 6.5 });
  await move(0, workers[0][0], { x: 3.5, z: 6.5 });
  await move(1, workers[1][0], { x: 3.5, z: 2.5 });
  await move(0, workers[0][3], { x: -2.5, z: 6.5 });
  const staged = await move(1, workers[1][2], { x: -.5, z: 6.5 });
  conserved(staged);
  assert.equal(nodeIn(staged, ids[0]).wildlifeTeam, 1);
  assert.equal(nodeIn(staged, ids[1]).wildlifeTeam, 1);
  const gatherers = [[workers[0][0], workers[0][3]], [workers[1][0], workers[1][2]]];
  phase = 'shared harvest and depleted cargo';
  for (const team of [0, 1]) {
    await command(team, { type: 'gather', ids: [gatherers[team][1]], nodeId: ids[0] }, /GATHER ORDER/);
    await command(team, { type: 'gather', ids: [gatherers[team][0]], nodeId: ids[1] }, /GATHER ORDER/);
  }
  const depleted = await fixture.checkpoint(saved => ids.every(id => nodeIn(saved, id).stock === 0)
    && gatherers.flat().every(id => unitIn(saved, id).cargo > 0));
  conserved(depleted);
  for (const id of ids) assert.equal(nodeIn(depleted, id).wildlifeState, 'depleted');
  assert.deepEqual(frozen(nodeIn(depleted, ids[0])), carcass);
  for (const team of [0, 1]) await command(team, { type: 'stop', ids: gatherers[team] }, /STOP ORDER/);
  const finalCargo = await fixture.checkpoint(saved => gatherers.flat().every(id => unitIn(saved, id).cargo > 0 && unitIn(saved, id).gatherPhase === ''));
  conserved(finalCargo);
  phase = 'depleted recovery';
  const exhausted = await recover();
  conserved(exhausted.saved); conserved(exhausted.recovered);
  for (const id of ids) {
    assert.equal(nodeIn(exhausted.recovered, id).stock, 0);
    assert.equal(nodeIn(exhausted.recovered, id).wildlifeState, 'depleted');
    assert.equal(nodeIn(exhausted.recovered, id).wildlifeHerd, null);
    assert.deepEqual(frozen(nodeIn(exhausted.recovered, id)), frozen(nodeIn(exhausted.saved, id)));
  }
  phase = 'Return cargo';
  for (const team of [0, 1]) {
    await sheepOrder(team, 'herd', ids[team], goals[team], /HERD REJECTED/);
    await command(team, { type: 'returnCargo', ids: gatherers[team] }, /RETURN CARGO ORDER/);
  }
  const delivered = await fixture.checkpoint(saved => gatherers.flat().every(id => unitIn(saved, id).cargo === 0));
  conserved(delivered);
  assert.ok(delivered.state.teamFood.every(food => food > 0));
  assert.ok(Math.abs(delivered.state.teamFood[0] + delivered.state.teamFood[1] - 8.5) < EPSILON);
  assert.equal(nodeIn(delivered, 'hidden-sheep').stock, 100);
  assert.equal(nodeIn(delivered, 'hidden-sheep').wildlifeState, 'alive');
  assert.deepEqual(frozen(nodeIn(delivered, ids[0])), carcass);
  const duplicate = structuredClone(delivered); duplicate.state.teamFood[0] += 1;
  assert.throws(() => conserved(duplicate), /food equals/);
  const lost = structuredClone(exhausted.saved); unitIn(lost, gatherers[0][0]).cargo = 0;
  assert.throws(() => conserved(lost), /food equals/);
  clients.forEach(client => publicRows(client.latest));
  assert.ok(maxRenderedDisplacement > 2, 'the live client represents travel beyond the authored graze radius');
  assert.equal(await sourceHash(), serverSha256, 'reported source hash identifies the actual server tested');
  console.log(JSON.stringify({ scenario: 'owned Sheep authoritative herding', map: map.id, schema: 29, speed: HERD_SPEED,
    bothSeatNaturalClaimAndMulticellHerd: true, foreignHiddenStaleBlockedInvalidRejected: true,
    stopAnchorsActualPose: true, midRoutePathPoseRecovery: true, recaptureCancelsAtActualPose: true,
    privateRoutesAndHiddenRowsAbsent: true, vacatedCellPaidConstruction: true, liveAndCarcassSitesProtected: true,
    retainedOwnershipWithoutSightAndHiddenOwnerOrdersRejected: true,
    opposingGatherImmediatelyCancelsHerd: true, partialAndDepletedCargoRecovery: true,
    sharedGatherAndFoodReturnConserved: true, lostCargoAndDuplicateCreditControls: true,
    maxObservedSpeed, maxRenderedDisplacement, relocatedCpuRendererAdmission: true,
    ticks: { moving: moving.state.tickNumber, stopped: stopped.state.tickNumber,
      midRouteSaved: midRoute.saved.state.tickNumber, midRouteRecovered: midRoute.recovered.state.tickNumber,
      arrived: arrived.state.tickNumber, ownedHidden: hiddenOwned.state.tickNumber,
      partialSaved: partial.saved.state.tickNumber, partialRecovered: partial.recovered.state.tickNumber,
      depletedSaved: exhausted.saved.state.tickNumber, depletedRecovered: exhausted.recovered.state.tickNumber,
      delivered: delivered.state.tickNumber },
    foodBanks: delivered.state.teamFood, woodBanks: delivered.state.teamWood,
    serverSha256,
    limits: ['authority/WebSocket and CPU renderer proof; ordinary selection, WebGL/native and hosted appearance are not asserted'] }));
} catch (error) {
  try {
    const last = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
    console.error(JSON.stringify({ phase, failedAtTick: last.state.tickNumber,
      sheep: last.state.resourceNodes, foodBanks: last.state.teamFood, woodBanks: last.state.teamWood,
      workers: last.state.units.filter(unit => workers?.flat().includes(unit.id)).map(unit => ({ id: unit.id, x: unit.x, z: unit.z,
        hp: unit.hp, cargo: unit.cargo, gatherNodeId: unit.gatherNodeId, gatherPhase: unit.gatherPhase })) }));
  } catch {}
  throw error;
} finally { renderer.dispose(); await fixture.dispose(); }
