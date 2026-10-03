import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { minimapFixture } from './minimap-client-fixture.mjs';
import { createWaterUnitRuntime, waterUnitOccupiedCells } from '../src/water-unit-runtime.mjs';
import { createSkiffFishingContext } from '../src/skiff-fishing.mjs';
import { validSkiffWaypoints } from '../src/skiff-waypoints.mjs';

const map = { id: 'skiff-waypoint-proof', name: 'Skiff waypoint proof', width: 64, height: 64,
  terrainSeed: 19, fogOfWar: false, startingArmySize: 24, startingResources: { food: 1000, wood: 1000 },
  spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
  obstacles: [18, 43].map(column => ({ column, row: 42, width: 12, height: 16, material: 'water' })),
  resourceNodes: [0, 1].map(team => ({ id: `fish-${team}`, type: 'food', resourceVariant: 'shore-fish',
    x: team ? 17.5 : -7.5, z: 9.5, stock: 31 })), triggers: [], scenarioEvents: [] };
const water = createWaterUnitRuntime(map), fishing = createSkiffFishingContext(map, water);
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 70_000 });
const dom = [], sent = [[], []];
let clients, tokens, selected = [[], []], unselected, untouched, loads, order = 100;
const saved = async () => JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
const ownBoats = (snapshot, team) => snapshot.state.units.filter(unit => unit.kind === 'skiff' && unit.hp > 0 && unit.team === team);
const stock = (snapshot, team) => snapshot.state.resourceNodes.find(node => node.id === `fish-${team}`).stock;
const identity = unit => ({ id: unit.id, generation: unit.generation, team: unit.team, x: unit.x, z: unit.z,
  cargo: unit.cargo, cargoType: unit.cargoType, path: unit.path, pathIndex: unit.pathIndex, moveGoalCell: unit.moveGoalCell,
  queuedWaypoints: unit.queuedWaypoints, gatherPhase: unit.gatherPhase, gatherNodeId: unit.gatherNodeId, orderRevision: unit.orderRevision });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
async function command(team, value, expression) {
  const notice = await clients[team].command({ ...value, clientOrderToken: order++ }, value.type === 'build' ? expression : /.*/);
  assert.match(notice.message, expression); return notice;
}
function safe(snapshot) {
  const occupied = new Set(), nodes = new Map(map.resourceNodes.map(node => [node.id, node]));
  for (const unit of snapshot.state.units.filter(unit => unit.hp > 0 && unit.kind === 'skiff')) {
    assert.ok(water.validRoute(unit)); assert.ok(validSkiffWaypoints(water, unit)); assert.ok(fishing.validState(unit, nodes, snapshot.state.buildings));
    for (const cell of waterUnitOccupiedCells(water.graph, unit)) { assert.ok(!occupied.has(cell)); occupied.add(cell); }
  }
  for (const team of [0, 1]) {
    close(stock(snapshot, team) + ownBoats(snapshot, team).reduce((sum, unit) => sum + unit.cargo, 0) + snapshot.state.teamFood[team] - 1000, 31);
    if (untouched) assert.deepEqual(identity(snapshot.state.units[unselected[team]]), untouched[team]);
  }
}
async function reconnect() {
  await fixture.start(); clients = [await fixture.connect(0, tokens[0]), await fixture.connect(1, tokens[1])];
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint));
}
async function minimap(team, column, row, shiftKey = false, expression = /SKIFF WATER ROUTES/) {
  const f = dom[team], point = water.graph.pointAt(row * 64 + column), r = f.w.minimapMapRect(384, 384), after = clients[team].messages.length;
  f.event('pointerdown', { x: 100 + (r.left + (point.x + 32) * r.scale) / 2,
    y: 40 + (r.top + (point.z + 32) * r.scale) / 2, shiftKey });
  const token = f.w.orderToken;
  const notice = await clients[team].wait(message => message.type === 'notice' && message.clientOrderToken === token, 'minimap boat order', after);
  assert.match(notice.message, expression);
  assert.deepEqual({ ...f.w.cameraTarget }, { x: 7, z: 9 });
  return sent[team].at(-1);
}
try {
  await fixture.start(); clients = [await fixture.connect(0), await fixture.connect(1)]; tokens = clients.map(client => client.welcome.player.sessionToken);
  clients[0].send({ type: 'publishMap', map });
  await Promise.all(clients.map(client => client.wait(message => message.type === 'mapChange' && message.map.id === map.id)));
  const workers = clients.map((client, team) => client.latest.units.filter(row => row[1] === team && row[5] === 'worker').map(row => row[0]));
  for (const team of [0, 1]) await command(team, { type: 'build', buildingType: 'dock', ids: workers[team], x: team ? 12.5 : -12.5, z: 8.5 }, /DOCK PLACED/);
  const built = await fixture.checkpoint(snapshot => snapshot.state.buildings.length === 2 && snapshot.state.buildings.every(building => building.complete));
  for (const team of [0, 1]) for (let i = 0; i < 3; i++) await command(team, { type: 'trainUnit', kind: 'skiff',
    buildingId: built.state.buildings.find(building => building.team === team).id }, /QUEUED/);
  for (let index = 0; index < 2; index++) {
    const spawned = await fixture.checkpoint(snapshot => [0, 1].every(team => ownBoats(snapshot, team).length === index + 1));
    for (const team of [0, 1]) {
      const unit = ownBoats(spawned, team).find(unit => !selected[team].includes(unit.id)); selected[team].push(unit.id);
      const point = water.graph.pointAt(49 * 64 + (team ? 44 : 19) + index);
      await command(team, { type: 'move', ids: [unit.id], x: point.x, z: point.z }, /SKIFF WATER ROUTE/);
    }
    await fixture.checkpoint(snapshot => selected.flat().every(id => snapshot.state.units[id].path.length === 0));
  }
  const ready = await fixture.checkpoint(snapshot => [0, 1].every(team => ownBoats(snapshot, team).length === 3));
  unselected = [0, 1].map(team => ownBoats(ready, team).find(unit => !selected[team].includes(unit.id)).id);
  untouched = unselected.map(id => identity(ready.state.units[id])); safe(ready);
  for (const team of [0, 1]) await command(team, { type: 'gather', ids: selected[team], nodeId: `fish-${team}` }, /2 SKIFFS/);
  await fixture.checkpoint(snapshot => selected.flat().every(id => snapshot.state.units[id].cargo >= .1));
  for (const team of [0, 1]) {
    await command(team, { type: 'move', ids: selected[team], x: team ? 20.5 : -4.5, z: 22.5, queue: true }, /FINISH-OR-STOP-FISHING-FIRST/);
    await command(team, { type: 'stop', ids: selected[team] }, /STOP ORDER/);
  }
  const carrying = await fixture.checkpoint(snapshot => selected.flat().every(id => snapshot.state.units[id].gatherPhase === '')); safe(carrying);
  loads = selected.map(ids => ids.map(id => carrying.state.units[id].cargo));
  for (const team of [0, 1]) {
    const f = minimapFixture(team); dom.push(f); f.w.units = [];
    for (const unit of carrying.state.units) f.w.units[unit.id] = { id: unit.id, generation: unit.generation, hp: unit.hp, team: unit.team, kind: unit.kind };
    Object.assign(f.w, { mapDefinition: map, selected: new Set([...selected[team], unselected[1 - team]]), socket: { readyState: 1,
      send(payload) { sent[team].push(JSON.parse(payload)); clients[team].socket.send(payload); } } });
    const offset = team ? 25 : 0;
    await minimap(team, 23 + offset, 54);
    await minimap(team, 27 + offset, 54, true, /WAYPOINT QUEUED/);
    await minimap(team, 27 + offset, 47, true, /WAYPOINT QUEUED/);
    assert.ok(sent[team].every(command => JSON.stringify(command.ids) === JSON.stringify(selected[team])));
    assert.ok(sent[team].slice(1).every(command => command.queue === true && command.type === 'move'));
  }
  for (const team of [0, 1]) {
    await clients[team].wait(message => message.type === 'waypointQueueCounts'
      && selected[team].every(id => message.rows.some(row => row[0] === id && row[1] === 2)), 'owner water queue counts');
    assert.ok(clients[team].messages.filter(message => message.type === 'waypointQueueCounts')
      .every(message => message.rows.every(row => carrying.state.units[row[0]].team === team)));
  }
  await fixture.stop(); const queued = await saved(); safe(queued);
  assert.ok(selected.flat().every(id => queued.state.units[id].queuedWaypoints.length === 2));
  const tails = selected.map(ids => ids.map(id => queued.state.units[id].queuedWaypoints.at(-1).destination)); await reconnect();
  const arrived = await fixture.checkpoint(snapshot => selected.flat().every(id => snapshot.state.units[id].path.length === 0 && snapshot.state.units[id].queuedWaypoints.length === 0)); safe(arrived);
  for (const team of [0, 1]) for (let i = 0; i < 2; i++) {
    const unit = arrived.state.units[selected[team][i]], point = water.graph.pointAt(tails[team][i]);
    close(unit.x, point.x); close(unit.z, point.z); assert.equal(unit.cargo, loads[team][i]);
  }
  for (const team of [0, 1]) {
    const offset = team ? 25 : 0; await minimap(team, 24 + offset, 54); await minimap(team, 27 + offset, 51, true, /WAYPOINT QUEUED/);
    await command(team, { type: 'stop', ids: [selected[team][0]] }, /STOP ORDER/);
  }
  await fixture.stop(); const stopped = await saved(); safe(stopped);
  const remaining = selected.map(ids => stopped.state.units[ids[1]].queuedWaypoints.at(-1).destination);
  for (const ids of selected) { assert.equal(stopped.state.units[ids[0]].queuedWaypoints.length, 0); assert.equal(stopped.state.units[ids[0]].path.length, 0); }
  await reconnect();
  const otherArrived = await fixture.checkpoint(snapshot => selected.every(ids => snapshot.state.units[ids[1]].path.length === 0 && snapshot.state.units[ids[1]].queuedWaypoints.length === 0)); safe(otherArrived);
  for (const team of [0, 1]) {
    const unit = otherArrived.state.units[selected[team][1]], point = water.graph.pointAt(remaining[team]); close(unit.x, point.x); close(unit.z, point.z);
    dom[team].w.selected = new Set([selected[team][0]]);
    const offset = team ? 25 : 0; await minimap(team, 21 + offset, 55);
    for (let i = 0; i < 8; i++) await minimap(team, 25 + offset, 55, true, /WAYPOINT QUEUED/);
    await minimap(team, 26 + offset, 55, true, /QUEUE-LIMIT/);
  }
  const capped = await fixture.checkpoint(snapshot => selected.every(ids => snapshot.state.units[ids[0]].queuedWaypoints.length === 8)); safe(capped);
  for (const team of [0, 1]) await command(team, { type: 'stop', ids: [selected[team][0]] }, /STOP ORDER/);
  const stoppedCap = await fixture.checkpoint(snapshot => selected.every(ids => snapshot.state.units[ids[0]].queuedWaypoints.length === 0)); safe(stoppedCap);
  for (const team of [0, 1]) {
    await command(team, { type: 'returnCargo', ids: selected[team] }, /2 SKIFFS TO OWNED DOCK/);
    await command(team, { type: 'move', ids: selected[team], x: team ? 20.5 : -4.5, z: 22.5, queue: true }, /FINISH-OR-STOP-FISHING-FIRST/);
  }
  const banked = await fixture.checkpoint(snapshot => selected.flat().every(id => snapshot.state.units[id].cargo === 0 && snapshot.state.units[id].gatherPhase === '')); safe(banked);
  for (const team of [0, 1]) { close(banked.state.teamFood[team], 1000 + loads[team].reduce((sum, load) => sum + load, 0)); assert.equal(stock(banked, team), stock(carrying, team)); }
  await fixture.stop(); const final = await saved();
  for (const [reason, waypoint] of [['land', { destination: 0, attackMove: false }], ['combat', { destination: 55 * 64 + 25, attackMove: true }],
    ['disconnected', { destination: 55 * 64 + 50, attackMove: false }]]) {
    const invalid = structuredClone(final); invalid.state.units[selected[0][0]].queuedWaypoints = [waypoint];
    const serialized = JSON.stringify(invalid); await writeFile(fixture.checkpointPath, serialized); await fixture.start(); await fixture.stop();
    assert.notEqual((await saved()).matchId, invalid.matchId, reason);
    const rejected = await Promise.all((await readdir(fixture.directory)).filter(name => name.startsWith('match.json.rejected-')).map(name => readFile(path.join(fixture.directory, name), 'utf8')));
    assert.ok(rejected.includes(serialized), 'invalid water queue preserved exactly');
  }
  console.log(JSON.stringify({ scenario: 'Both-seat selected Skiff minimap waypoints', selectedBoatsPerSeat: 2, untouchedBoatsPerSeat: 1,
    realMinimapMoveAndShiftHandlers: true, perBoatFIFOAndRestart: true, exactSelectedStopClearsOnlyItsQueue: true,
    eightPendingWaypointsAndAtomicCap: true, fractionalFoodPreservedThenDeliveredOnce: true, invalidWaterQueuesPreserved: true,
    boundaries: 'water Move only; queue after fishing/Return remains separate; no passengers, weapons or new art' }));
} catch (error) {
  try { const snapshot = await saved(); console.error(JSON.stringify({ stage: 'water-waypoints', tick: snapshot.state.tickNumber,
    boats: snapshot.state.units.filter(unit => unit.kind === 'skiff').map(unit => ({ ...identity(unit), blocked: unit.waterMoveBlocked, retry: unit.repathTimer })) })); } catch {}
  throw error;
} finally { for (const f of dom) f.dom.window.close(); await fixture.dispose(); }
