import assert from 'node:assert/strict';
import path from 'node:path';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';

const keys = ['RTS_MATCH_MODE_ID', 'RTS_MATCH_MODE_VERSION', 'RTS_PREGAME', 'RTS_SOLO_PRACTICE'];
const inherited = Object.fromEntries(keys.map(key => [key, process.env[key]]));
keys.forEach(key => { delete process.env[key]; });
const fixture = await createFortifiedFixture({ supervisor: true,
  mapPath: 'maps/bellweather-millrace.json', timeoutMs: 30000 });
const identity = { matchModeId: 'bannerfall', matchModeVersion: 1 };
const records = [];
try {
  await fixture.start();
  const origin = `http://127.0.0.1:${fixture.port}`;
  async function create(options) {
    const response = await fetch(`${origin}/api/rooms`, { method: 'POST', body: JSON.stringify(options) });
    assert.equal(response.status, 201); return response.json();
  }
  const created = await create({ mode: 'pvp', pregame: true, ...identity });
  assert.equal(created.launchOptions.matchModeId, 'bannerfall');
  const host = await fixture.connect(0, null, created.roomId);
  const guest = await fixture.connect(1, null, created.roomId);
  assert.equal(host.welcome.map.id, 'bannerfall-arena');
  assert.equal(host.latest.lobby.armySize, 16);
  assert.equal(host.latest.lobby.phase, 'lobby');
  assert.equal(host.latest.scenarioClockStarted, false);
  const checkpointPath = path.join(fixture.directory, 'rooms', 'rooms', created.roomId, 'match-state.json');
  await fixture.checkpoint(snapshot => snapshot.state.pregame.phase === 'lobby', checkpointPath);
  for (const client of [host, guest]) {
    const revision = client.latest.lobby.revision;
    const after = client.messages.length;
    client.send({ type: 'setReady', revision, ready: true });
    await client.wait(message => message.type === 'lobby'
      && message.lobby.seats.some(seat => seat.id === client.welcome.player.id && seat.ready), 'seat ready', after);
  }
  const revision = host.latest.lobby.revision;
  const after = host.messages.length;
  host.send({ type: 'configureLobby', revision, armySize: 250 });
  const rejected = await host.wait(message => message.type === 'lobbyRejected', 'fixed opening rejection', after);
  assert.match(rejected.message, /opening army is fixed/);
  assert.equal(rejected.lobby.revision, revision);
  assert.ok(rejected.lobby.seats.filter(seat => seat.connected).every(seat => seat.ready));
  host.send({ type: 'launchMatch', revision });
  await host.state(state => state.lobby.phase === 'running' && state.scenarioClockStarted, 'two human launch');
  const metadata = await (await fetch(`${origin}/api/rooms/${created.roomId}`)).json();
  assert.equal(metadata.matchModeId, 'bannerfall');
  assert.equal(metadata.mapId, 'bannerfall-arena');
  records.push({ name: 'Real room API overrides inherited Millrace with Bannerfall arena, preserves fixed-size readiness, and launches two humans' });

  const practice = await create({ mode: 'pvp', practice: true, ...identity });
  const solo = await fixture.connect(0, null, practice.roomId);
  assert.equal(solo.welcome.map.id, 'bannerfall-arena');
  await solo.state(state => state.scenarioClockStarted, 'Practice room starts with one human');
  records.push({ name: 'Real Practice room API starts the same arena with one human and no AI' });
  const pve = await fetch(`${origin}/api/rooms`, { method: 'POST', body: JSON.stringify({ mode: 'pve', ...identity }) });
  assert.equal(pve.status, 400);
  assert.match(JSON.stringify(await pve.json()), /Bannerfall.*AI is not implemented/);
  records.push({ name: 'Real room API rejects unsupported Bannerfall AI with a truthful explanation' });
  console.log(JSON.stringify({ status: 'passed', records,
    limits: ['Room/protocol acceptance only; visible selector, browser rendering and identified staging play remain open.'] }));
} finally {
  await fixture.dispose();
  for (const key of keys) if (inherited[key] === undefined) delete process.env[key]; else process.env[key] = inherited[key];
}
