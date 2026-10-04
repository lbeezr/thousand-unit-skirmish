import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { MILLRACE_SHEEP_IDS } from '../src/millrace-sheep.mjs';

// Real default-map Move claims and recovery, followed by a compact authored
// match for contested/shared access. Never edit a saved position, stock or bank.
const fixture = await createFortifiedFixture({ mapPath: null, timeoutMs: 35_000 });
const EPSILON = 1e-6, CLAIM_RADIUS = 1.4;
const openingIds = [0, 1].map(team => `s${team}-0-1`);
const nodeIn = (saved, id) => saved.state.resourceNodes.find(node => node.id === id);
const unitIn = (saved, id) => saved.state.units.find(unit => unit.id === id);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const frozen = node => ({ x: node.x, z: node.z, wildlifeTeam: node.wildlifeTeam,
  wildlifeMotion: structuredClone(node.wildlifeMotion) });
let orderToken = 100;
const command = (client, value, pattern) => client.command({ ...value, clientOrderToken: orderToken++ }, pattern);

function conserved(saved, total) {
  assert.equal(saved.schemaVersion, 28);
  const stock = saved.state.resourceNodes.filter(node => node.type === 'food').reduce((sum, node) => sum + node.stock, 0);
  const bank = saved.state.teamFood.reduce((sum, food) => sum + food, 0);
  const cargo = saved.state.units.filter(unit => unit.cargoType === 'food').reduce((sum, unit) => sum + unit.cargo, 0);
  assert.ok(Math.abs(stock + bank + cargo - total) < EPSILON,
    'one authored food pool equals remaining stock plus both banks and carried food');
  for (const node of saved.state.resourceNodes.filter(node => node.wildlifeSpecies !== undefined)) {
    assert.ok(node.wildlifeTeam === null || node.wildlifeTeam === 0 || node.wildlifeTeam === 1);
    assert.equal(Object.hasOwn(node, 'team'), false, 'claim label does not turn Sheep into team units');
  }
}
function unharvested(saved, map) {
  conserved(saved, map.resourceNodes.filter(node => node.type === 'food').reduce((sum, node) => sum + node.stock, 0)
    + (map.startingResources?.food ?? 150) * 2);
  assert.deepEqual(saved.state.teamFood, [map.startingResources?.food ?? 150, map.startingResources?.food ?? 150]);
  assert.deepEqual(saved.state.teamWood, [map.startingResources?.wood ?? 250, map.startingResources?.wood ?? 250]);
  assert.ok(saved.state.units.every(unit => unit.cargo === 0), 'claims and Move orders grant no cargo');
  for (const authored of map.resourceNodes) assert.equal(nodeIn(saved, authored.id).stock, authored.stock);
  assert.ok(saved.state.resourceNodes.filter(node => node.wildlifeSpecies !== undefined).every(node => node.wildlifeState === 'alive'));
}
function snapshotClaims(client, hiddenIds = []) {
  for (const node of client.latest.resourceNodes.filter(node => node.wildlifeSpecies !== undefined)) {
    assert.ok(node.wildlifeTeam === null || node.wildlifeTeam === 0 || node.wildlifeTeam === 1);
    assert.equal(Object.hasOwn(node, 'team'), false);
  }
  assert.ok(hiddenIds.every(id => !client.latest.resourceNodes.some(node => node.id === id)),
    'remote hidden Sheep and their ownership are omitted from seat snapshots');
}
async function moveTo(client, id, target) {
  await command(client, { type: 'move', ids: [id], x: target.x, z: target.z }, /MOVE ORDER/);
  return fixture.checkpoint(saved => unitIn(saved, id)?.hp > 0 && distance(unitIn(saved, id), target) < .25);
}
async function restart(clients) {
  const sessions = clients.map(client => client.welcome.player.sessionToken);
  await fixture.stop();
  const saved = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
  await fixture.start();
  const resumed = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
  assert.ok(resumed.every(client => client.welcome.recoveredFromCheckpoint && client.welcome.matchId === saved.matchId));
  const recovered = await fixture.checkpoint(value => value.sequence > saved.sequence);
  return { clients: resumed, saved, recovered };
}

try {
  await fixture.start();
  let clients = [await fixture.connect(0), await fixture.connect(1)];
  const defaultMap = clients[0].welcome.map;
  assert.equal(defaultMap.id, 'bellweather-millrace', 'the normal default entry has naturally claimable Sheep');
  const defaultWorkers = clients.map((client, team) => client.latest.units.find(row => row[1] === team && row[5] === 'worker')[0]);
  const initial = await fixture.checkpoint();
  unharvested(initial, defaultMap);
  assert.ok(MILLRACE_SHEEP_IDS.every(id => nodeIn(initial, id).wildlifeTeam === null));
  for (const team of [0, 1]) {
    const row = clients[team].latest.resourceNodes.find(node => node.id === openingIds[team]);
    assert.equal(row.wildlifeTeam, null);
    snapshotClaims(clients[team], MILLRACE_SHEEP_IDS.filter(id => id.startsWith(`s${1 - team}-`)));
  }
  for (const team of [0, 1]) {
    const authored = defaultMap.resourceNodes.find(node => node.id === openingIds[team]);
    await moveTo(clients[team], defaultWorkers[team], authored);
  }
  const defaultClaimed = await fixture.checkpoint(saved => openingIds.every((id, team) => nodeIn(saved, id).wildlifeTeam === team));
  unharvested(defaultClaimed, defaultMap);
  assert.deepEqual(defaultClaimed.state.units.map(unit => [unit.id, unit.team, unit.kind]), initial.state.units.map(unit => [unit.id, unit.team, unit.kind]),
    'claims add no unit, population or faction membership');
  for (const team of [0, 1]) {
    assert.ok(distance(unitIn(defaultClaimed, defaultWorkers[team]), nodeIn(defaultClaimed, openingIds[team])) <= CLAIM_RADIUS);
    await clients[team].state(state => state.resourceNodes.some(node => node.id === openingIds[team] && node.wildlifeTeam === team),
      'default own Move automatically discloses a claimed Sheep');
    snapshotClaims(clients[team], MILLRACE_SHEEP_IDS.filter(id => id.startsWith(`s${1 - team}-`)));
  }
  const defaultRestart = await restart(clients);
  clients = defaultRestart.clients;
  unharvested(defaultRestart.saved, defaultMap); unharvested(defaultRestart.recovered, defaultMap);
  for (const id of MILLRACE_SHEEP_IDS) assert.equal(nodeIn(defaultRestart.recovered, id).wildlifeTeam, nodeIn(defaultRestart.saved, id).wildlifeTeam);
  for (const team of [0, 1]) {
    assert.equal(clients[team].welcome.state.resourceNodes.find(node => node.id === openingIds[team]).wildlifeTeam, team);
    snapshotClaims(clients[team], MILLRACE_SHEEP_IDS.filter(id => id.startsWith(`s${1 - team}-`)));
  }

  // Author an ordinary fogged meadow match through the real map API, with the
  // minimum eight-Worker opening and one shared food node.
  const compact = JSON.parse(await readFile(new URL('../maps/open-field.json', import.meta.url)));
  Object.assign(compact, { id: 'sheep-claims-proof', name: 'SHEEP CLAIMS PROOF', summary: '32 × 24 · automatic proximity claims', width: 32, height: 24,
    terrainBase: 'meadow', fogOfWar: true, startingArmySize: 8,
    spawnPoints: [{ team: 0, x: -10.5, z: -4.5 }, { team: 1, x: 10.5, z: -4.5 }],
    startingResources: { food: 0, wood: 0 }, scenarioEvents: [],
    resourceNodes: [{ id: 'shared-sheep', type: 'food', x: .5, z: 4.5, stock: 4.25, wildlifeSpecies: 'bellweather-sheep' }],
  });
  const after = clients.map(client => client.messages.length);
  clients[0].send({ type: 'publishMap', map: compact, persist: true });
  const publication = await clients[0].wait(message => message.type === 'mapPublished' || message.type === 'mapRejected', 'compact claims map admitted', after[0]);
  assert.equal(publication.type, 'mapPublished', publication.message);
  await Promise.all(clients.map((client, team) => client.wait(message => message.type === 'mapChange' && message.map.id === compact.id,
    'ordinary compact match started', after[team])));
  const workers = clients.map((client, team) => client.latest.units.find(row => row[1] === team && row[5] === 'worker')[0]);
  const sharedId = compact.resourceNodes[0].id;
  const shared = saved => nodeIn(saved, sharedId);
  const left = { x: -.5, z: 4.5 }, right = { x: 1.5, z: 4.5 };
  const away = [{ x: -4.5, z: 4.5 }, { x: 4.5, z: 4.5 }];
  const compactInitial = await fixture.checkpoint(saved => saved.mapDefinition.id === compact.id);
  unharvested(compactInitial, compact);
  assert.equal(shared(compactInitial).wildlifeTeam, null);
  clients.forEach(client => snapshotClaims(client, [sharedId]));
  await moveTo(clients[0], workers[0], left);
  const claimed = await fixture.checkpoint(saved => shared(saved).wildlifeTeam === 0);
  unharvested(claimed, compact);
  await moveTo(clients[1], workers[1], right);
  const contested = await fixture.checkpoint(saved => workers.every(id => distance(unitIn(saved, id), shared(saved)) <= CLAIM_RADIUS));
  assert.equal(shared(contested).wildlifeTeam, 0);
  const retained = await fixture.checkpoint(saved => saved.state.tickNumber >= contested.state.tickNumber + 60);
  unharvested(retained, compact);
  assert.equal(shared(retained).wildlifeTeam, 0, 'eligible owner presence retains a contested live Sheep');
  assert.ok(workers.every(id => distance(unitIn(retained, id), shared(retained)) <= CLAIM_RADIUS));
  for (const client of clients) {
    const visible = await client.state(state => state.resourceNodes.some(node => node.id === sharedId && node.wildlifeTeam === 0), 'both seats see retained owner');
    assert.equal(visible.resourceNodes.find(node => node.id === sharedId).wildlifeState, 'alive');
  }
  await moveTo(clients[0], workers[0], away[0]);
  const recaptured = await fixture.checkpoint(saved => shared(saved).wildlifeTeam === 1);
  unharvested(recaptured, compact);
  assert.ok(distance(unitIn(recaptured, workers[0]), shared(recaptured)) > CLAIM_RADIUS);
  assert.ok(distance(unitIn(recaptured, workers[1]), shared(recaptured)) <= CLAIM_RADIUS);
  await Promise.all(clients.map((client, team) => moveTo(client, workers[team], compact.spawnPoints[team])));
  const emptyPasture = await fixture.checkpoint(saved => workers.every(id => distance(unitIn(saved, id), shared(saved)) > CLAIM_RADIUS));
  const persistent = await fixture.checkpoint(saved => saved.state.tickNumber >= emptyPasture.state.tickNumber + 30);
  unharvested(persistent, compact);
  assert.equal(shared(persistent).wildlifeTeam, 1, 'last owner persists while nobody eligible remains nearby');
  for (const client of clients) {
    await client.state(state => !state.resourceNodes.some(node => node.id === sharedId), 'retained ownership grants no sight after departure');
    snapshotClaims(client, [sharedId]);
  }
  await moveTo(clients[0], workers[0], left);
  const reclaimed = await fixture.checkpoint(saved => shared(saved).wildlifeTeam === 0);
  unharvested(reclaimed, compact);
  await moveTo(clients[1], workers[1], right);

  // The enemy Worker may activate an owned living Sheep while its owner is
  // still present: the claim is a label, not a new Gather permission.
  await command(clients[1], { type: 'gather', ids: [workers[1]], nodeId: sharedId }, /GATHER ORDER/);
  const enemyCarrying = await fixture.checkpoint(saved => shared(saved).wildlifeState === 'carcass' && unitIn(saved, workers[1]).cargo >= .25);
  conserved(enemyCarrying, 4.25);
  assert.equal(shared(enemyCarrying).wildlifeTeam, 0, 'opponent Gather preserves the existing owner on activation');
  for (const client of clients) {
    const state = await client.state(value => value.resourceNodes.some(node => node.id === sharedId && node.wildlifeState === 'carcass'),
      'visible carcass ownership disclosed');
    assert.equal(state.resourceNodes.find(node => node.id === sharedId).wildlifeTeam, 0);
  }
  const corpse = frozen(shared(enemyCarrying));
  await command(clients[1], { type: 'stop', ids: [workers[1]] }, /STOP ORDER/);
  const interrupted = await fixture.checkpoint(saved => unitIn(saved, workers[1]).cargo > 0 && unitIn(saved, workers[1]).gatherPhase === '');
  conserved(interrupted, 4.25);
  assert.deepEqual(frozen(shared(interrupted)), corpse);
  await Promise.all(clients.map((client, team) => moveTo(client, workers[team], away[team])));
  await moveTo(clients[1], workers[1], right);
  const opponentAlone = await fixture.checkpoint(saved => distance(unitIn(saved, workers[0]), shared(saved)) > CLAIM_RADIUS
    && distance(unitIn(saved, workers[1]), shared(saved)) <= CLAIM_RADIUS);
  conserved(opponentAlone, 4.25);
  assert.deepEqual(frozen(shared(opponentAlone)), corpse, 'carcass claims and motion remain frozen despite an opposing arrival');
  assert.equal(shared(opponentAlone).stock, shared(interrupted).stock, 'Move and Stop preserve partial food stock');
  for (const team of [0, 1]) await command(clients[team], { type: 'gather', ids: [workers[team]], nodeId: sharedId }, /GATHER ORDER/);
  const depleted = await fixture.checkpoint(saved => shared(saved).stock === 0 && workers.every(id => unitIn(saved, id).cargo > 0));
  conserved(depleted, 4.25);
  assert.equal(shared(depleted).wildlifeState, 'depleted');
  assert.deepEqual(frozen(shared(depleted)), corpse);
  for (const client of clients) {
    const state = await client.state(value => value.resourceNodes.some(node => node.id === sharedId && node.wildlifeState === 'depleted'),
      'visible depleted ownership disclosed');
    assert.equal(state.resourceNodes.find(node => node.id === sharedId).wildlifeTeam, 0);
  }
  for (const team of [0, 1]) await command(clients[team], { type: 'stop', ids: [workers[team]] }, /STOP ORDER/);
  const stopped = await fixture.checkpoint(saved => workers.every(id => unitIn(saved, id).cargo > 0 && unitIn(saved, id).gatherPhase === ''));
  conserved(stopped, 4.25);
  const depletedRestart = await restart(clients);
  clients = depletedRestart.clients;
  conserved(depletedRestart.saved, 4.25); conserved(depletedRestart.recovered, 4.25);
  assert.deepEqual(frozen(shared(depletedRestart.recovered)), corpse);
  assert.equal(shared(depletedRestart.recovered).wildlifeState, 'depleted');
  for (const id of workers) assert.equal(unitIn(depletedRestart.recovered, id).cargo, unitIn(depletedRestart.saved, id).cargo);
  await moveTo(clients[1], workers[1], { x: .5, z: 4.5 });
  const depletedArrival = await fixture.checkpoint(saved => distance(unitIn(saved, workers[1]), shared(saved)) <= CLAIM_RADIUS);
  conserved(depletedArrival, 4.25);
  assert.deepEqual(frozen(shared(depletedArrival)), corpse, 'depleted Sheep cannot be recaptured or revived');
  for (const team of [0, 1]) {
    await command(clients[team], { type: 'gather', ids: [workers[team]], nodeId: sharedId }, /RESOURCE NODE EMPTY/);
    await command(clients[team], { type: 'returnCargo', ids: [workers[team]] }, /RETURN CARGO ORDER/);
  }
  const delivered = await fixture.checkpoint(saved => workers.every(id => unitIn(saved, id).cargo === 0));
  conserved(delivered, 4.25);
  assert.ok(delivered.state.teamFood.every(food => food > 0), 'both seats deposit their shared carcass food');
  assert.deepEqual(frozen(shared(delivered)), corpse);
  assert.equal(shared(delivered).stock, 0);
  const duplicate = structuredClone(delivered); duplicate.state.teamFood[0] += 1;
  assert.throws(() => conserved(duplicate, 4.25), /one authored food pool/);
  const lost = structuredClone(depletedRestart.saved); unitIn(lost, workers[0]).cargo = 0;
  assert.throws(() => conserved(lost, 4.25), /one authored food pool/);
  console.log(JSON.stringify({ scenario: 'automatic Sheep proximity claims', defaultMap: defaultMap.id,
    radius: CLAIM_RADIUS, schema: delivered.schemaVersion, bothSeatRealDefaultMoveClaims: true, hiddenOwnershipRowsAbsent: true,
    defaultClaimRecoveryAndEconomyUnchanged: true, contestedOwnerPresenceRetains: true,
    opposingRecaptureAfterOwnerLeaves: true, lastOwnerPersistsWithoutNearbyUnits: true, claimedOwnershipGrantsNoSight: true,
    opposingGatherActivatesOwnedAliveSheep: true, bothSeatSharedCarcassHarvest: true,
    carcassAndDepletedOwnershipFrozen: true, depletedClaimAndCargoRecovery: true,
    lostCargoAndDuplicateCreditControls: true, deliveredBanks: delivered.state.teamFood }));
} finally { await fixture.dispose(); }
