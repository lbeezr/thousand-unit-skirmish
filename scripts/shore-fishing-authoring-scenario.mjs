import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { shoreFishSitePositions } from '../src/shore-fishing-placement.mjs';
import { createWaterStudyFishBinding } from '../src/water-study-fish-binding.mjs';
import { selectWaterStudyFish } from '../src/water-study-state.mjs';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';

const map = JSON.parse(await readFile(new URL('../maps/shore-fishing.json', import.meta.url)));
const sites = shoreFishSitePositions(map);
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 100_000 });
let orderToken = 700;
const observedClients = [];
function observe(clients) { observedClients.push(...clients); return clients; }
function assertLiveFishCues() {
  const evidence = { packets: 0, activeBySeat: [0, 0], depleted: 0, fogSuppressed: 0,
    fishingWorkersBySeat: [0, 0] };
  for (const client of observedClients) {
    const binding = createWaterStudyFishBinding(map, { userData: {
      updateWaterStudyFish: snapshot => selectWaterStudyFish(map, snapshot),
    } });
    for (const message of client.messages) {
      const state = message.type === 'state' ? message : message.state;
      if (!state || state.mapId !== map.id) continue;
      evidence.packets++;
      for (const row of state.units) {
        if (row[16] === undefined || row[16] === null) continue;
        assert.equal(row[16], 'shore-fish');
        assert.equal(row[1], client.welcome.player.team, 'fog never discloses enemy work identity');
        assert.equal(row[5], 'worker'); assert.equal(row[9], 'gathering'); assert.equal(row[7], 'food');
        const target = sites[row[1]].water;
        const expectedHeading = Math.atan2(target.x - row[2], target.z - row[3]);
        const error = Math.atan2(Math.sin(row[15] - expectedHeading), Math.cos(row[15] - expectedHeading));
        assert.ok(Math.abs(error) < 0.02, 'actual worker heads toward water; wire positions round to .01');
        evidence.fishingWorkersBySeat[row[1]]++;
      }
      const schools = binding.update(state);
      const packed = state.visibility ? Buffer.from(state.visibility.data, 'base64') : null;
      const visible = cell => !map.fogOfWar || (packed && ((packed[cell >> 2] >> ((cell & 3) * 2)) & 3) === 2);
      for (const site of sites) {
        const live = state.resourceNodes.find(node => node.id === site.nodeId);
        if (live) assert.equal(live.x, undefined, 'wire stock has no second position authority');
        const bank = Math.floor(site.land.z + map.height / 2) * map.width + Math.floor(site.land.x + map.width / 2);
        const water = site.water.row * map.width + site.water.column;
        const expected = live?.stock > 0 && visible(bank) && visible(water);
        const school = schools.find(school => school.id === site.nodeId);
        assert.equal(Boolean(school), Boolean(expected), 'actual snapshot stock and BOTH current cells gate cues');
        if (school) {
          assert.deepEqual({ x: school.x, z: school.z }, { x: site.water.x, z: site.water.z });
          evidence.activeBySeat[client.welcome.player.team]++;
        } else if (live?.stock === 0) evidence.depleted++;
        else if (!visible(bank) || !visible(water)) evidence.fogSuppressed++;
      }
    }
  }
  assert.ok(evidence.activeBySeat.every(count => count > 0));
  assert.ok(evidence.fishingWorkersBySeat.every(count => count > 0), 'both seats emit distinct fishing work');
  assert.ok(evidence.depleted > 0 && evidence.fogSuppressed > 0);
  return evidence;
}
async function command(client, value, expression) {
  return client.command({ ...value, clientOrderToken: orderToken++ }, expression);
}
function assertConserved(snapshot) {
  const state = snapshot.state;
  const stock = state.resourceNodes.filter(node => node.type === 'food').reduce((sum, node) => sum + node.stock, 0);
  const cargo = state.units.filter(unit => unit.cargoType === 'food').reduce((sum, unit) => sum + unit.cargo, 0);
  assert.ok(Math.abs(stock + cargo + state.teamFood[0] + state.teamFood[1] - 120) < 0.000001);
  assert.deepEqual(state.teamWood, [0, 0]);
  assert.deepEqual(state.resourceNodes.filter(node => node.type === 'wood').map(node => node.stock), [175, 175]);
  assert.deepEqual(shoreFishSitePositions(snapshot.mapDefinition), sites, 'stable separate water visuals and land approach after recovery');
  for (const unit of state.units) {
    const column = Math.floor(unit.x + map.width / 2), row = Math.floor(unit.z + map.height / 2);
    assert.ok(!map.obstacles.some(rect => column >= rect.column && column < rect.column + rect.width
      && row >= rect.row && row < rect.row + rect.height), 'Workers stay on land');
  }
  for (const site of sites) {
    const node = state.resourceNodes.find(node => node.id === site.nodeId);
    assert.equal(node.resourceVariant, 'shore-fish');
    assert.deepEqual({ x: node.x, z: node.z }, site.land);
  }
}

try {
  await fixture.start();
  const handoff = await fetch(`http://127.0.0.1:${fixture.port}/src/shore-fishing-placement.mjs`);
  assert.equal(handoff.status, 200, 'renderer/brush position helper is available through the ordinary client allowlist');
  assert.match(await handoff.text(), /export function shoreFishSitePositions/);
  let clients = observe([await fixture.connect(0), await fixture.connect(1)]);
  const tokens = clients.map(client => client.welcome.player.sessionToken);
  assert.ok(clients[0].welcome.maps.some(entry => entry.id === map.id && /Lab.*SHORE FISHING/.test(entry.name)),
    'usable pilot is discoverable through the ordinary match map catalog');
  const after = clients.map(client => client.messages.length);
  clients[0].send({ type: 'selectMap', mapId: map.id });
  await Promise.all(clients.map((client, index) => client.wait(message => message.type === 'mapChange' && message.map.id === map.id,
    'host selects shipped shore fishing pilot', after[index])));
  assert.ok(clients.every(client => client.latest.armySize === 8));
  const initial = await fixture.checkpoint(snapshot => snapshot.mapDefinition.id === map.id);
  assertConserved(initial);
  for (const [team, client] of clients.entries()) {
    const ids = client.latest.units.filter(unit => unit[1] === team && unit[5] === 'worker').slice(0, 3).map(unit => unit[0]);
    const site = sites[team];
    if (!client.latest.resourceNodes.some(node => node.id === site.nodeId)) {
      await command(client, { type: 'move', ids, x: site.land.x, z: site.land.z - 3 }, /MOVE ORDER/);
      await client.state(state => state.resourceNodes.some(node => node.id === site.nodeId), 'reveal fish from land');
    }
    await command(client, { type: 'gather', ids, nodeId: site.nodeId }, /GATHER ORDER/);
  }
  const carrying = await fixture.checkpoint(snapshot => snapshot.state.units.some(unit => unit.cargo > 0));
  assertConserved(carrying);
  await fixture.stop();
  const saved = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
  assertConserved(saved);
  assert.ok(saved.state.units.some(unit => unit.cargo > 0));
  await fixture.start();
  clients = observe([await fixture.connect(0, tokens[0]), await fixture.connect(1, tokens[1])]);
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint && client.welcome.matchId === saved.matchId));
  const restored = await fixture.checkpoint(snapshot => snapshot.sequence > saved.sequence);
  assertConserved(restored);
  const delivered = await fixture.checkpoint(snapshot => snapshot.state.resourceNodes.filter(node => node.type === 'food').every(node => node.stock === 0)
    && snapshot.state.units.every(unit => unit.cargo === 0));
  assertConserved(delivered);
  for (const food of delivered.state.teamFood) assert.ok(Math.abs(food - 60) < 0.000001);
  await fixture.stop(); await fixture.start();
  clients = observe([await fixture.connect(0, tokens[0]), await fixture.connect(1, tokens[1])]);
  const emptyRecovery = await fixture.checkpoint(snapshot => snapshot.sequence > delivered.sequence);
  assertConserved(emptyRecovery);
  assert.ok(emptyRecovery.state.resourceNodes.filter(node => node.type === 'food').every(node => node.stock === 0));
  clients[0].send({ type: 'reset' });
  const rematch = await fixture.checkpoint(snapshot => snapshot.sequence > emptyRecovery.sequence
    && snapshot.state.teamFood.every(food => food === 0)
    && snapshot.state.resourceNodes.filter(node => node.type === 'food').every(node => node.stock === 60));
  assertConserved(rematch);
  console.log(JSON.stringify({ scenario: 'seeded shore fishing pilot', map: map.id,
    ordinaryCatalogSelection: true, bothSeatFood: delivered.state.teamFood,
    foodBudget: 120, untouchedWoodBudget: 350, landWorkersStayOffWater: true,
    distinctStableLandAndWaterPositions: true, cargoAndDepletionRecovery: true,
    rematchRestoresAuthoredStock: true, liveFishCueSnapshotEvidence: assertLiveFishCues(), visualRenderingOwner: 'water lane' }));
} finally { await fixture.dispose(); }
