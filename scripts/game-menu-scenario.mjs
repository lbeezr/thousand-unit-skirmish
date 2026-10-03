import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { request } from 'node:http';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { bootGameEntry } from '../src/game-entry.mjs';
import { LAST_ROOM_STORAGE_KEY, SESSION_STORAGE_PREFIX } from '../src/game-entry-session.mjs';
import { stopChild } from './temporary-resources.mjs';
import { checkClientImports } from './check-client-imports.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = await mkdtemp(path.join(os.tmpdir(), 'rts-game-menu-'));
const listener = createServer().listen(0, '127.0.0.1');
await once(listener, 'listening');
const port = listener.address().port;
await new Promise(resolve => listener.close(resolve));
const base = `http://127.0.0.1:${port}`;
const authorization = `Basic ${Buffer.from('menu-test:local-test-password-for-entry').toString('base64')}`;
const clients = [];
let child, output = '';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, label) {
  for (let at = Date.now() + 15000; Date.now() < at; await delay(25)) if (await predicate()) return;
  throw new Error(`Timed out: ${label}\n${output}`);
}
const api = (url, options = {}) => fetch(new URL(url, base), {
  ...options, headers: { authorization, ...options.headers }, signal: AbortSignal.timeout(5000),
});
function frame(value) {
  const payload = Buffer.from(JSON.stringify(value)), mask = randomBytes(4);
  assert.ok(payload.length < 126);
  for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
  return Buffer.concat([Buffer.from([0x81, 0x80 | payload.length]), mask, payload]);
}
// A real HTTP upgrade and native TCP frames permit the same Basic Auth as the browser.
async function connect(room, token, resumeOnly = false) {
  const url = new URL('/ws', base);
  if (room !== 'default') url.searchParams.set('room', room);
  if (resumeOnly) url.searchParams.set('resumeOnly', '1');
  const client = { socket: null, messages: [], welcome: null, lobby: null };
  let buffer = Buffer.alloc(0);
  function consume(chunk) {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const opcode = buffer[0] & 15;
      let length = buffer[1] & 127, offset = 2;
      if (length === 126) { if (buffer.length < 4) return; length = buffer.readUInt16BE(2); offset = 4; }
      if (length === 127) { if (buffer.length < 10) return; length = Number(buffer.readBigUInt64BE(2)); offset = 10; }
      if (buffer.length < offset + length) return;
      const payload = buffer.subarray(offset, offset + length); buffer = buffer.subarray(offset + length);
      if (opcode !== 1) continue;
      const message = JSON.parse(payload.toString()); client.messages.push(message);
      if (message.type === 'welcome') client.welcome = message;
      if (message.lobby || message.state?.lobby) client.lobby = message.lobby || message.state.lobby;
    }
  }
  const status = await new Promise((resolve, reject) => {
    const req = request(url, { headers: { authorization, origin: base, connection: 'Upgrade', upgrade: 'websocket',
      'sec-websocket-version': '13', 'sec-websocket-key': randomBytes(16).toString('base64'),
      'sec-websocket-protocol': `rts-v1${token ? `, rts-resume.${token}` : ''}` } });
    req.setTimeout(5000, () => req.destroy(new Error('upgrade timeout')));
    req.on('response', response => { response.resume(); resolve(response.statusCode); });
    req.on('upgrade', (response, socket, head) => {
      client.socket = socket; clients.push(client); socket.on('data', consume); socket.on('error', () => {});
      if (head.length) consume(head); resolve(response.statusCode);
    });
    req.on('error', reject); req.end();
  });
  if (status !== 101) return { status };
  await until(() => client.welcome, 'welcome');
  client.send = value => client.socket.write(frame(value));
  client.close = () => client.socket.destroy();
  return client;
}
async function menu(stored = {}, fetchImpl = api) {
  const html = await (await api('/')).text();
  const dom = new JSDOM(html, { url: base }), navigations = [];
  for (const [key, value] of Object.entries(stored)) dom.window.sessionStorage.setItem(key, value);
  for (const dialog of dom.window.document.querySelectorAll('dialog')) {
    dialog.showModal = () => { dialog.open = true; }; dialog.close = () => { dialog.open = false; };
  }
  await bootGameEntry({ win: dom.window, fetchImpl, navigate: url => navigations.push(new URL(url)),
    loadGame: async () => { throw new Error('Menu must not load the renderer'); } });
  return { dom, navigations, click: id => dom.window.document.getElementById(id).click() };
}
async function peek(room, token) {
  const response = await api(`/api/session${room === 'default' ? '' : `?room=${room}`}`, { headers: { 'x-rts-resume-token': token } });
  assert.match(response.headers.get('cache-control'), /no-store/);
  return { status: response.status, value: await response.json() };
}

async function startSupervisor() {
  child = spawn(process.execPath, ['room-supervisor.mjs'], { cwd: root,
    env: { ...process.env, PORT: String(port), RTS_HOST: '127.0.0.1', RTS_ROOM_DATA_DIRECTORY: data,
      RTS_CUSTOM_MAP_DIRECTORY: path.join(data, 'default-maps'), RTS_MAX_ROOMS: '5',
      RTS_ACCESS_USER: 'menu-test', RTS_ACCESS_PASSWORD: 'local-test-password-for-entry' }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
  await until(async () => { try { return (await api('/ready')).ok; } catch { return false; } }, 'ready');
}

try {
  await startSupervisor();
  assert.equal((await fetch(`${base}/`)).status, 401);
  assert.equal((await fetch(`${base}/api/session`)).status, 401, 'resume inspection keeps existing authentication');
  const oldHost = await connect('default'), oldGuest = await connect('default');
  const oldMatch = oldHost.welcome.matchId;
  const profile = await menu();
  assert.equal((await (await api('/health')).json()).connected, 2, 'root menu adds no default peers');
  assert.equal(profile.navigations.length, 0);
  const defaultToken = oldHost.welcome.player.sessionToken;
  const resume = await menu({ [`${SESSION_STORAGE_PREFIX}default`]: defaultToken });
  assert.equal(resume.dom.window.document.getElementById('menu-resume').hidden, false);
  assert.equal((await peek('default', defaultToken)).value.valid, true);
  assert.equal((await peek('default', 'X'.repeat(43))).value.valid, false);
  let interruptAuthentication = false;
  const interruptedResume = await menu({ [`${SESSION_STORAGE_PREFIX}default`]: defaultToken }, (url, options = {}) =>
    api(url, { ...options, headers: { ...options.headers, ...(interruptAuthentication ? { authorization: 'Basic invalid-local-test' } : {}) } }));
  interruptAuthentication = true;
  interruptedResume.click('menu-resume');
  await until(() => /sign in/.test(interruptedResume.dom.window.document.getElementById('game-menu-status').textContent), 'Resume sign-in guidance');
  assert.equal(interruptedResume.navigations.length, 0);
  assert.equal(interruptedResume.dom.window.document.getElementById('menu-resume').hidden, false);
  assert.equal(interruptedResume.dom.window.sessionStorage.getItem(`${SESSION_STORAGE_PREFIX}default`), defaultToken);
  assert.equal((await (await api('/health')).json()).connected, 2, 'interrupted authentication cannot allocate a peer');
  interruptAuthentication = false; interruptedResume.click('menu-resume');
  await until(() => interruptedResume.navigations.length, 'same saved Resume after sign-in');
  assert.equal(interruptedResume.navigations[0].searchParams.get('resume'), '1');
  assert.equal(interruptedResume.navigations[0].searchParams.has('room'), false);
  assert.equal((await connect('default', 'X'.repeat(43), true)).status, 409);
  const activeResume = await connect('default', defaultToken, true);
  assert.equal(activeResume.welcome.player.resumePending, true);
  assert.equal(activeResume.welcome.player.team, null);
  assert.equal(activeResume.welcome.matchId, oldMatch);
  let finishCreation, createdWhileAway, deliveredCreation = false;
  const delayedMenu = await menu({}, async (url, options = {}) => {
    const response = await api(url, options);
    if (options.method === 'POST') {
      createdWhileAway = (await response.clone().json()).roomId;
      await new Promise(resolve => { finishCreation = resolve; });
      const readJson = response.json.bind(response);
      response.json = async () => { const value = await readJson(); deliveredCreation = true; return value; };
    }
    return response;
  });
  const peersBeforeExit = (await (await api('/health')).json()).connectedInvitePeers;
  delayedMenu.click('menu-practice');
  await until(() => finishCreation, 'pending real Practice creation response');
  delayedMenu.dom.window.dispatchEvent(new delayedMenu.dom.window.PageTransitionEvent('pagehide', { persisted: true }));
  finishCreation();
  await until(() => deliveredCreation, 'completed creation after menu exit');
  assert.equal(delayedMenu.navigations.length, 0, 'late real HTTP creation cannot navigate a departed menu');
  assert.equal((await (await api('/health')).json()).connectedInvitePeers, peersBeforeExit);
  assert.deepEqual((await (await api(`/api/rooms/${createdWhileAway}`)).json()).launchOptions, { mode: 'pvp', practice: true },
    'an already accepted room creation remains governed by ordinary room expiry');
  delayedMenu.dom.window.close();
  profile.click('menu-create-room'); profile.click('menu-create-room');
  await until(() => profile.navigations.length, 'create PvP');
  const pvpRoom = profile.navigations[0].searchParams.get('room');
  const host = await connect(pvpRoom), guest = await connect(pvpRoom);
  assert.deepEqual([host.welcome.player.team, guest.welcome.player.team], [0, 1]);
  assert.notEqual(host.welcome.matchId, oldMatch);
  await until(() => host.lobby.seats.length === 2, 'two lobby seats');
  const revision = host.lobby.revision;
  host.send({ type: 'setReady', revision, ready: true }); guest.send({ type: 'setReady', revision, ready: true });
  await until(() => host.lobby.canLaunch, 'both ready');
  const inviteToken = host.welcome.player.sessionToken;
  assert.equal((await peek(pvpRoom, inviteToken)).value.valid, true);
  assert.equal((await peek(pvpRoom, guest.welcome.player.sessionToken)).value.valid, true);
  assert.equal(host.lobby.revision, revision); assert.equal(host.lobby.canLaunch, true, 'inspection never invalidates readiness');
  const inviteResume = await menu({ [LAST_ROOM_STORAGE_KEY]: pvpRoom, [`${SESSION_STORAGE_PREFIX}${pvpRoom}`]: inviteToken });
  inviteResume.click('menu-resume');
  await until(() => inviteResume.navigations.length, 'explicit invite resume');
  assert.equal(inviteResume.navigations[0].searchParams.get('resume'), '1');
  assert.equal(inviteResume.navigations[0].searchParams.get('room'), pvpRoom);
  host.send({ type: 'launchMatch', revision });
  await until(() => host.lobby.phase === 'running' && guest.lobby.phase === 'running', 'launch');
  const aiMenu = await menu(); aiMenu.click('menu-new-game');
  await until(() => aiMenu.navigations.length, 'new AI game');
  const ai = await connect(aiMenu.navigations[0].searchParams.get('room'));
  assert.equal(ai.welcome.player.team, 0); assert.notEqual(ai.welcome.matchId, oldMatch);
  assert.notEqual(ai.welcome.matchId, host.welcome.matchId);
  ai.send({ type: 'selectMap', mapId: 'frontier-materials' });
  await until(() => ai.messages.some(row => /AI MATCH MAP IS FIXED.*PRACTICE/.test(row.message || '')), 'actionable AI map protection');
  assert.equal(ai.welcome.state.practice, undefined);
  ai.send({ type: 'selectArmySize', count: 250 });
  await until(() => ai.messages.some(row => /AI MATCH ARMY IS FIXED.*PRACTICE/.test(row.message || '')), 'actionable AI army protection');
  const studioMenu = await menu(); studioMenu.click('menu-studio');
  await until(() => studioMenu.navigations.length, 'new studio');
  assert.equal(studioMenu.navigations[0].searchParams.get('studio'), '1');
  const studio = await connect(studioMenu.navigations[0].searchParams.get('room'));
  assert.equal(studio.welcome.player.isHost, true); assert.equal(studio.welcome.state.lobby, undefined);
  const practiceMenu = await menu(); practiceMenu.click('menu-practice'); practiceMenu.click('menu-practice');
  await until(() => practiceMenu.navigations.length, 'one fresh practice room');
  assert.equal(practiceMenu.navigations.length, 1);
  const practiceId = practiceMenu.navigations[0].searchParams.get('room');
  assert.equal(practiceMenu.navigations[0].searchParams.has('studio'), false);
  const practice = await connect(practiceId);
  assert.equal(practice.welcome.state.practice, true);
  assert.equal(practice.welcome.state.lobby, undefined);
  assert.equal(practice.welcome.state.connected, 1, 'practice needs no second human or AI seat');
  assert.notEqual(practice.welcome.matchId, oldMatch);
  const practiceOptions = (await (await api(`/api/rooms/${practiceId}`)).json()).launchOptions;
  assert.deepEqual(practiceOptions, { mode: 'pvp', practice: true });
  const practiceCheckpoint = path.join(data, 'rooms', practiceId, 'match-state.json');
  async function savedPractice(predicate) {
    let saved;
    await until(async () => {
      try { saved = JSON.parse(await readFile(practiceCheckpoint)); return predicate(saved); }
      catch { return false; }
    }, 'solo practice progress');
    return saved;
  }
  const labMaps = practice.welcome.maps.filter(map => map.name.startsWith('Lab · '));
  assert.ok(labMaps.some(map => map.id === 'stone-defense-field'), 'current mineral lab is selectable');
  for (const map of labMaps) {
    const cursor = practice.messages.length;
    practice.send({ type: 'selectMap', mapId: map.id });
    await until(() => practice.messages.slice(cursor).some(row => row.type === 'mapChange' && row.map.id === map.id), `select ${map.id}`);
    const change = practice.messages.slice(cursor).find(row => row.type === 'mapChange' && row.map.id === map.id);
    assert.equal(change.state.practice, true); assert.equal(change.state.connected, 1);
    assert.equal(change.state.armySize, change.map.startingArmySize ?? 1000);
    await savedPractice(saved => saved.mapDefinition.id === map.id && saved.state.scenarioClockStarted && saved.state.matchElapsedSeconds > 0);
  }
  const beforeReset = await savedPractice(saved => saved.state.matchElapsedSeconds > 0);
  practice.send({ type: 'reset' });
  await until(() => practice.messages.some(row => row.type === 'notice' && row.message === 'BATTLEFIELD RESET'), 'practice rematch');
  await savedPractice(saved => saved.sequence > beforeReset.sequence && saved.state.scenarioClockStarted && saved.state.matchElapsedSeconds > 0);
  await until(async () => { try { return JSON.parse(await readFile(path.join(data, 'default-match-state.json'))).matchId === oldMatch; } catch { return false; } }, 'old checkpoint retained');
  assert.equal((await (await api('/health')).json()).matchId, oldMatch);
  const imports = await checkClientImports(base, { authorization, entrypoints: ['/src/game-entry.mjs'] });
  assert.ok(imports.some(entry => entry.path === '/src/main.js'), 'lazy game client is packaged and admitted');
  const practiceIdentity = practice.welcome.player, practiceMatch = practice.welcome.matchId;
  const storedIndex = JSON.parse(await readFile(path.join(data, 'rooms.json')));
  assert.deepEqual(storedIndex.rooms.find(room => room.id === practiceId).launchOptions, practiceOptions);
  for (const client of clients) client.socket.destroy();
  await stopChild(child); await startSupervisor();
  const recoveredPractice = await connect(practiceId, practiceIdentity.sessionToken, true);
  assert.equal(recoveredPractice.welcome.player.id, practiceIdentity.id);
  assert.equal(recoveredPractice.welcome.player.resumed, true);
  assert.equal(recoveredPractice.welcome.matchId, practiceMatch);
  assert.equal(recoveredPractice.welcome.state.practice, true);
  assert.equal(recoveredPractice.welcome.state.connected, 1);
  const recoveredMap = labMaps.at(-1).id;
  assert.equal(recoveredPractice.welcome.map.id, recoveredMap);
  recoveredPractice.send({ type: 'selectMap', mapId: 'frontier-materials' });
  await until(() => recoveredPractice.messages.some(row => row.type === 'mapChange' && row.map.id === 'frontier-materials'), 'unlocked map after recovery');
  recoveredPractice.send({ type: 'gather', ids: [0], nodeId: 'azure-berries' });
  await savedPractice(saved => saved.mapDefinition.id === 'frontier-materials' && saved.state.teamFood[0] > 0);
  console.log(JSON.stringify({ passed: ['authenticated menu without automatic default admission', 'read-only active/stale session inspection',
    'interrupted authentication retains saved Resume without admission', 'strict Resume cannot allocate a new seat', 'departed menu ignores completed real Practice creation', 'fresh PvP lobby and both-seat launch', 'explicit saved-room Resume',
    'fresh AI and Map Studio rooms', 'one-player practice across all current lab maps and rematch',
    'practice checkpoint/seat recovery and real Worker food deposit', 'actionable seeded AI map and army protection', 'old default identity/checkpoint retained', 'entry and lazy client import delivery'],
    modules: imports.length, practiceLabMaps: labMaps.map(map => map.id) }));
} finally {
  for (const client of clients) client.socket.destroy();
  await stopChild(child); await rm(data, { recursive: true, force: true });
}
