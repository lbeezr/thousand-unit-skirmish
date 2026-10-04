import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { bootGameEntry } from '../src/game-entry.mjs';
import { createRoomLobby } from '../src/room-lobby-ui.mjs';
import { mapScenarioSummary } from '../src/objective-summary.mjs';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';

const keys = ['RTS_MATCH_MODE_ID', 'RTS_MATCH_MODE_VERSION', 'RTS_PREGAME', 'RTS_SOLO_PRACTICE'];
const inherited = Object.fromEntries(keys.map(key => [key, process.env[key]]));
keys.forEach(key => { delete process.env[key]; });
const fixture = await createFortifiedFixture({ supervisor: true,
  mapPath: 'maps/bellweather-millrace.json', timeoutMs: 30000 });
const identity = { matchModeId: 'bannerfall', matchModeVersion: 1 };
const records = [];
const views = [];
const lobbyViews = [];
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
  await host.wait(message => message.type === 'lobby' && message.lobby.seats.filter(seat => seat.connected).length === 2,
    'host sees guest admission');
  assert.equal(host.welcome.map.id, 'bannerfall-arena');
  assert.equal(host.latest.lobby.armySize, 16);
  assert.equal(host.latest.lobby.phase, 'lobby');
  assert.equal(host.latest.scenarioClockStarted, false);
  const checkpointPath = path.join(fixture.directory, 'rooms', 'rooms', created.roomId, 'match-state.json');
  await fixture.checkpoint(snapshot => snapshot.state.pregame.phase === 'lobby', checkpointPath);
  for (const client of [host, guest]) {
    const dom = new JSDOM('<dialog></dialog>', { url: origin }); views.push(dom);
    const root = dom.window.document.querySelector('dialog');
    root.showModal = () => { root.open = true; }; root.close = () => { root.open = false; };
    const ui = createRoomLobby({ root, send: command => { client.send(command); return true; }, copyInvite: () => {} });
    lobbyViews.push({ root, ui });
    ui.update(client.latest.lobby, client.welcome.player, true, client.welcome.map);
    assert.deepEqual([...root.querySelector('#lobby-army-size').options].map(option => option.value), ['16']);
    assert.equal(root.querySelector('#lobby-army-size').disabled, true);
    assert.match(root.querySelector('#lobby-match-mode-summary').textContent, /waves.*15 seconds.*6 enemy troop kills.*original Town Center/);
    const after = client.messages.length;
    root.querySelector('#lobby-ready').click(); root.querySelector('#lobby-ready').click();
    const accepted = await client.wait(message => message.type === 'lobby'
      && message.lobby.seats.some(seat => seat.id === client.welcome.player.id && seat.ready), 'seat ready through UI', after);
    ui.update(accepted.lobby, client.welcome.player, true, client.welcome.map);
  }
  await host.wait(message => message.type === 'lobby' && message.lobby.canLaunch, 'host sees both Ready acknowledgements');
  const revision = host.latest.lobby.revision;
  const after = host.messages.length;
  host.send({ type: 'configureLobby', revision, armySize: 250 });
  const rejected = await host.wait(message => message.type === 'lobbyRejected', 'fixed opening rejection', after);
  assert.match(rejected.message, /opening army is fixed/);
  assert.equal(rejected.lobby.revision, revision);
  assert.ok(rejected.lobby.seats.filter(seat => seat.connected).every(seat => seat.ready));
  lobbyViews[0].ui.update(rejected.lobby, host.welcome.player, true, host.welcome.map);
  lobbyViews[0].root.querySelector('#lobby-launch').click(); lobbyViews[0].root.querySelector('#lobby-launch').click();
  await host.state(state => state.lobby.phase === 'running' && state.scenarioClockStarted, 'two human launch');
  lobbyViews[0].ui.update(host.latest.lobby, host.welcome.player, true, host.welcome.map);
  assert.equal(lobbyViews[0].root.open, false);
  const metadata = await (await fetch(`${origin}/api/rooms/${created.roomId}`)).json();
  assert.equal(metadata.matchModeId, 'bannerfall');
  assert.equal(metadata.mapId, 'bannerfall-arena');
  records.push({ name: 'Real room API overrides inherited Millrace with Bannerfall arena, preserves fixed-size readiness, and launches two humans' });

  const menuDom = new JSDOM(await readFile(new URL('../index.html', import.meta.url), 'utf8'), { url: origin });
  views.push(menuDom); const navigations = [], posts = [];
  await bootGameEntry({ win: menuDom.window, navigate: url => navigations.push(new URL(url)),
    loadGame: () => { throw new Error('Root menu cannot load the game renderer'); },
    fetchImpl: async (url, options) => {
      if (options?.method === 'POST') posts.push(JSON.parse(options.body));
      return fetch(new URL(url, origin), options);
    } });
  const newGame = menuDom.window.document.querySelector('#menu-new-game');
  assert.equal(newGame.hidden, false); assert.equal(newGame.disabled, false);
  assert.match(newGame.querySelector('span').textContent, /Skirmish · Tiny · 160 × 160 · Veyrhold/);
  const preset = menuDom.window.document.querySelector('#practice-match-mode');
  assert.ok([...preset.options].some(option => option.value === 'bannerfall@1'));
  preset.value = 'bannerfall@1'; preset.dispatchEvent(new menuDom.window.Event('change'));
  assert.match(menuDom.window.document.querySelector('[data-map]').textContent, /160 × 160 · BANNERFALL ARENA/);
  assert.doesNotMatch(menuDom.window.document.querySelector('[data-rule]').textContent, /capture|authored victory/i);
  menuDom.window.document.querySelector('#menu-practice').click(); menuDom.window.document.querySelector('#menu-practice').click();
  for (let attempt = 0; attempt < 300 && !navigations.length; attempt++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(navigations.length, 1); assert.deepEqual(posts, [{ mode: 'pvp', practice: true, ...identity }]);
  const solo = await fixture.connect(0, null, navigations[0].searchParams.get('room'));
  assert.equal(solo.welcome.map.id, 'bannerfall-arena');
  assert.deepEqual([solo.welcome.map.width, solo.welcome.map.height], [160, 160]);
  assert.equal(solo.welcome.state.armySize, 16); assert.equal(solo.welcome.state.connected, 1);
  assert.match(mapScenarioSummary(solo.welcome.map), /original Town Center.*enemy stronghold.*Free waves.*kills unlock Riders/);
  assert.equal(solo.welcome.state.matchModeId, 'bannerfall');
  await solo.state(state => state.scenarioClockStarted, 'Practice room starts with one human');
  records.push({ name: 'Ordinary root Practice selects registry Bannerfall once, starts160×160 with16 units and one human, and explains its stronghold/wave/kill rules' });
  const pve = await fetch(`${origin}/api/rooms`, { method: 'POST', body: JSON.stringify({ mode: 'pve', ...identity }) });
  assert.equal(pve.status, 400);
  assert.match(JSON.stringify(await pve.json()), /Bannerfall.*AI is not implemented/);
  records.push({ name: 'Real room API rejects unsupported Bannerfall AI with a truthful explanation' });
  console.log(JSON.stringify({ status: 'passed', records,
    limits: ['Actual menu/lobby DOM and HTTP/WebSocket acceptance; browser pixels and identified staging play remain open.'] }));
} finally {
  views.forEach(dom => dom.window.close());
  await fixture.dispose();
  for (const key of keys) if (inherited[key] === undefined) delete process.env[key]; else process.env[key] = inherited[key];
}
