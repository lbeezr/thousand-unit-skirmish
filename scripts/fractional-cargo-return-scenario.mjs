import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { economyResources } from '../src/economy-profile.mjs';

// Tiny authored stocks expose a carrying-state bug; no runtime economy/position injection.
// --reproduce-only asserts the original zero-wire/disabled-control behavior on an old build.
const reproduceOnly = process.argv.includes('--reproduce-only');
const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const fn = name => {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\nfunction ', start + 1);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end);
};
const issueStart = source.indexOf('function issueReturnCargo(');
const issueEnd = source.indexOf("for (const button of document.querySelectorAll('[data-return-cargo]'))", issueStart);
const map = JSON.parse(await readFile(new URL('../maps/open-field.json', import.meta.url)));
Object.assign(map, { id: 'fractional-sheep-cargo-proof', name: 'FRACTIONAL SHEEP CARGO',
  startingArmySize: 8, startingResources: { food: 0, wood: 0 }, scenarioEvents: [],
  resourceNodes: [0, 1].map(team => ({ id: `last-sheep-${team}`, type: 'food',
    x: team ? 12 : -12, z: 6, stock: 0.004, wildlifeSpecies: 'bellweather-sheep' })),
});
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 20_000 });
let token = 100;
const command = (client, value, pattern) => client.command({ ...value, clientOrderToken: token++ }, pattern);
const worker = (saved, id) => saved.state.units.find(unit => unit.id === id);
const node = (saved, id) => saved.state.resourceNodes.find(resource => resource.id === id);
function conserved(saved) {
  const stock = saved.state.resourceNodes.reduce((sum, resource) => sum + resource.stock, 0);
  const bank = saved.state.teamFood.reduce((sum, food) => sum + food, 0);
  const cargo = saved.state.units.filter(unit => unit.cargoType === 'food').reduce((sum, unit) => sum + unit.cargo, 0);
  assert.ok(Math.abs(stock + bank + cargo - 0.008) < 1e-12, 'all authored food remains in stock, cargo or banks');
}

function productionReturnControl(client, team, id, transmit = false) {
  const row = client.latest.units.find(unit => unit[0] === id);
  assert.equal(row[6], reproduceOnly ? 0 : 0.004);
  assert.equal(row[7], 'food');
  const payloads = [], toasts = [], noop = () => {};
  const context = vm.createContext({ localTeam: team, matchWinner: -1,
    units: [], teamUnits: [[], []], selected: new Set([id]), MAX_UNITS: 2000, MAX_PER_TEAM: 1000,
    WORKER_TASK_STATES: new Set(['idle', 'returning']), nextAttackFocusSlot: 0,
    attackFocusMesh: {}, unitHealthBackground: {}, unitHealthFill: {},
    setUnitInstanceCount: noop, setUnitTint: noop, updateUnitTransform: noop, updateUnitCargoCueColor: noop,
    TextEncoder, WebSocket: { OPEN: 1 }, mapDefinition: map, economyResources,
    socket: { readyState: 1, send(text) {
      const payload = JSON.parse(text); payloads.push(payload);
      if (transmit) client.send(payload);
    } },
    beginOrderStatus: () => token++, finishOrderStatus: noop, orderAudioGate: { sent: noop },
    audio: { play: noop, playEvent: noop }, showToast: message => toasts.push(message),
    setTapOrderArmed: noop, setAttackMoveMode: noop,
  });
  vm.runInContext([fn('appendUnitFromState'), fn('selectedIds'), fn('sendCommand'),
    fn('sendTrackedOrder'), source.slice(issueStart, issueEnd)].join('\n'), context);
  context.appendUnitFromState(row);
  context.issueReturnCargo();
  if (reproduceOnly) {
    assert.deepEqual(payloads, []); assert.deepEqual(toasts, ['SELECT YOUR CARRYING WORKERS']);
  } else {
    assert.equal(payloads.length, 1); assert.equal(payloads[0].type, 'returnCargo');
    assert.deepEqual(payloads[0].ids, [id]); assert.deepEqual(payloads[0].unitGenerations, [row[8]]);
    assert.deepEqual(toasts, []);
  }
  return payloads[0];
}

try {
  await fixture.start();
  let clients = [await fixture.connect(0), await fixture.connect(1)];
  const sessions = clients.map(client => client.welcome.player.sessionToken);
  clients[0].send({ type: 'publishMap', map, persist: true });
  await clients[0].wait(message => message.type === 'mapPublished' && message.mapId === map.id);
  await clients[1].wait(message => message.type === 'mapChange' && message.map.id === map.id);
  const ids = clients.map((client, team) => client.latest.units.find(row => row[1] === team && row[5] === 'worker')[0]);
  await Promise.all(clients.map(async (client, team) => {
    await command(client, { type: 'move', ids: [ids[team]], x: team ? 12 : -12, z: 6 }, /MOVE ORDER/);
    await client.state(state => state.resourceNodes.some(row => row.id === `last-sheep-${team}`), 'Sheep revealed normally');
    await command(client, { type: 'gather', ids: [ids[team]], nodeId: `last-sheep-${team}` }, /GATHER ORDER/);
    await client.state(state => state.resourceNodes.some(row => row.id === `last-sheep-${team}` && row.stock === 0), 'Sheep naturally exhausted');
    await command(client, { type: 'stop', ids: [ids[team]] }, /STOP ORDER/);
    await client.state(state => state.units.find(row => row[0] === ids[team])?.[9] === 'idle', 'Stop snapshot');
    productionReturnControl(client, team, ids[team]);
  }));
  const stopped = await fixture.checkpoint(saved => saved.mapDefinition.id === map.id
    && ids.every(id => worker(saved, id).cargo === 0.004 && worker(saved, id).gatherPhase === ''));
  conserved(stopped); assert.deepEqual(stopped.state.teamFood, [0, 0]);
  const lost = structuredClone(stopped); worker(lost, ids[0]).cargo = 0;
  assert.throws(() => conserved(lost), /all authored food/);
  await fixture.stop(); await fixture.start();
  clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint && client.welcome.matchId === stopped.matchId));
  clients.forEach((client, team) => productionReturnControl(client, team, ids[team]));
  if (reproduceOnly) {
    console.log(JSON.stringify({ scenario: 'original fractional Sheep cargo failure', bothSeats: true,
      authoritativeCargo: 0.004, snapshotCargo: 0, productionClientSentOrders: 0,
      disabledControlBeforeAndAfterRecovery: true }));
  } else {
    for (const team of [0, 1]) {
      await command(clients[team], { type: 'gather', ids: [ids[team]], nodeId: `last-sheep-${team}` }, /RESOURCE NODE EMPTY/);
      const after = clients[team].messages.length;
      const sent = productionReturnControl(clients[team], team, ids[team], true);
      await clients[team].wait(message => message.type === 'notice' && message.clientOrderToken === sent.clientOrderToken
        && /RETURN CARGO ORDER/.test(message.message), 'production client return accepted', after);
    }
    const delivered = await fixture.checkpoint(saved => saved.state.teamFood.every(food => food === 0.004)
      && ids.every(id => worker(saved, id).cargo === 0 && worker(saved, id).gatherPhase === ''));
    conserved(delivered);
    for (const team of [0, 1]) {
      assert.equal(node(delivered, `last-sheep-${team}`).stock, 0);
      assert.equal(node(delivered, `last-sheep-${team}`).wildlifeState, 'depleted');
      await command(clients[team], { type: 'returnCargo', ids: [ids[team]] }, /RETURN CARGO REJECTED/);
    }
    const duplicate = structuredClone(delivered); duplicate.state.teamFood[0] += 0.004;
    assert.throws(() => conserved(duplicate), /all authored food/);
    await fixture.stop(); await fixture.start();
    clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
    assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint));
    const stable = await fixture.checkpoint(saved => saved.sequence > delivered.sequence);
    conserved(stable); assert.deepEqual(stable.state.teamFood, [0.004, 0.004]);
    assert.ok(ids.every(id => worker(stable, id).cargo === 0));
    console.log(JSON.stringify({ scenario: 'fractional Sheep cargo through production Return cargo', bothSeats: true,
      positiveSnapshotCargo: 0.004, normalClientBeforeAndAfterRecovery: true,
      depletedGatherStillRejected: true, banks: stable.state.teamFood, depletedStock: 0,
      postDepositRestartCreditsOnce: true, lostCargoAndDuplicateCreditControls: true, nativeBrowserAppearance: false }));
  }
} finally { await fixture.dispose(); }
