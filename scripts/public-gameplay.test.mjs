import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { request } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { stopChild } from './temporary-resources.mjs';
import { checkClientImports } from './browser/check-client-imports.mjs';
import { isAnonymousGameplayRequest } from '../src/server/public-gameplay.mjs';

const root = path.resolve(import.meta.dirname, '..');
const secret = 'test-release-password-please-change';
const authorization = `Basic ${Buffer.from(`players:${secret}`).toString('base64')}`;
const publicOrigin = 'https://public-fixture.up.railway.app';
const privatePaths = ['/health', '/health?tickSamples=1', '/admin', '/api/admin',
  '/api/rooms', '/server.mjs', '/room-supervisor.mjs', '/package.json', '/.env',
  '/src/server/build-identity.mjs', '/src/server/release-identity.json',
  '/src/server/public-gameplay.mjs', '/src/server/client-static-assets.mjs',
  '/release-manifest.json', '/environment-review.html', '/water-study.html',
  '/audio-studio.html', '/audio-zones.html', '/assets/ui/preview.html',
  '/assets/units/worker-sprite-v3/source-records.json',
  '/assets/wildlife/bellweather-sheep-static-v1/source/sheep-yaw-000.png',
  '/%68ealth', '/%2fhealth'];

function upgrade(base, pathname, origin = publicOrigin, auth) {
  return new Promise((resolve, reject) => {
    const headers = { origin, connection: 'Upgrade', upgrade: 'websocket',
      'sec-websocket-version': '13', 'sec-websocket-key': randomBytes(16).toString('base64') };
    if (auth) headers.authorization = auth;
    const req = request(new URL(pathname, base), { headers });
    req.setTimeout(5000, () => req.destroy(new Error('upgrade timeout')));
    req.on('upgrade', (_response, socket) => { socket.destroy(); resolve(101); });
    req.on('response', response => { response.resume(); response.on('end', () => resolve(response.statusCode)); });
    req.on('error', reject); req.end();
  });
}

test('anonymous admission default-denies private paths and unsupported methods', () => {
  for (const pathname of privatePaths) {
    assert.equal(isAnonymousGameplayRequest('GET', new URL(pathname, publicOrigin)), false, pathname);
  }
  for (const method of ['PUT', 'DELETE', 'OPTIONS', 'PATCH']) {
    assert.equal(isAnonymousGameplayRequest(method, new URL('/', publicOrigin)), false);
    assert.equal(isAnonymousGameplayRequest(method, new URL('/api/rooms', publicOrigin)), false);
  }
});

test('public mode retains Railway password validation before startup', async () => {
  const volume = await mkdtemp(path.join(os.tmpdir(), 'rts-public-startup-'));
  try {
    for (const password of ['', 'too-short']) {
      const result = spawnSync(process.execPath, ['room-supervisor.mjs'], { cwd: root,
        env: { ...process.env, RTS_PUBLIC_GAMEPLAY: '1', RAILWAY_ENVIRONMENT: 'staging',
          RAILWAY_PUBLIC_DOMAIN: 'public-fixture.up.railway.app', RAILWAY_VOLUME_MOUNT_PATH: volume,
          RTS_ACCESS_PASSWORD: password }, encoding: 'utf8', timeout: 5000 });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /RTS_ACCESS_PASSWORD to at least 16 characters/);
    }
  } finally { await rm(volume, { recursive: true, force: true }); }
});

test('enabled anonymous gameplay and disabled authentication contracts', async () => {
  for (const mode of [undefined, '0', 'true', '1']) {
    const volume = await mkdtemp(path.join(os.tmpdir(), 'rts-public-mode-'));
    const env = { ...process.env, RTS_ACCESS_USER: 'players', RTS_ACCESS_PASSWORD: secret,
      RTS_HOST: '127.0.0.1', PORT: '0', RTS_MAX_ROOMS: '1',
      RAILWAY_ENVIRONMENT: 'staging', RAILWAY_PUBLIC_DOMAIN: 'public-fixture.up.railway.app',
      RAILWAY_VOLUME_MOUNT_PATH: volume, RTS_PUBLIC_ORIGINS: '',
      RTS_ROOM_DATA_DIRECTORY: path.join(volume, 'room-data'),
      RTS_CUSTOM_MAP_DIRECTORY: path.join(volume, 'custom-maps') };
    if (mode === undefined) delete env.RTS_PUBLIC_GAMEPLAY;
    else env.RTS_PUBLIC_GAMEPLAY = mode;
    const child = spawn(process.execPath, ['room-supervisor.mjs'], { cwd: root, env,
      stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    const until = async predicate => {
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error(output);
        if (await predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 40));
      }
      throw new Error(`fixture timeout: ${output}`);
    };
    try {
      await until(() => /listening at http:\/\/127.0.0.1:\d+/.test(output));
      const base = output.match(/listening at (http:\/\/127.0.0.1:\d+)/)[1];
      await until(async () => (await fetch(`${base}/ready`)).ok);
      const enabled = mode === '1';
      for (const pathname of ['/', '/style.css', '/src/main.js', '/api/rooms/status', '/api/session']) {
        assert.equal((await fetch(base + pathname)).status, enabled ? 200 : 401, `${mode}: ${pathname}`);
      }
      for (const pathname of privatePaths) assert.equal((await fetch(base + pathname)).status, 401, pathname);
      assert.equal((await fetch(`${base}/health`, { headers: { authorization } })).status, 200);
      assert.equal((await fetch(`${base}/server.mjs`, { headers: { authorization } })).status, 404);
      assert.deepEqual(await (await fetch(`${base}/ready`)).json(), { ok: true });
      assert.equal(await upgrade(base, '/ws'), enabled ? 101 : 401);
      assert.equal(await upgrade(base, '/health'), 401);
      assert.equal(await upgrade(base, '/ws', 'https://evil.example'), enabled ? 403 : 401);
      assert.equal(await upgrade(base, '/ws?room=invalid'), enabled ? 400 : 401);
      assert.equal(await upgrade(base, `/ws?room=${'a'.repeat(32)}`), enabled ? 404 : 401);
      if (!enabled) {
        assert.equal((await fetch(`${base}/api/rooms`, { method: 'POST', body: '{}' })).status, 401);
        assert.equal(await upgrade(base, '/ws', publicOrigin, authorization), 101);
        continue;
      }
      const imports = await checkClientImports(base);
      assert.ok(imports.length > 20);
      assert.equal((await fetch(`${base}/api/rooms`, { method: 'POST', headers: { origin: 'https://evil.example' }, body: '{}' })).status, 403);
      assert.equal((await fetch(`${base}/api/rooms`, { method: 'POST', body: '{broken' })).status, 400);
      const response = await fetch(`${base}/api/rooms`, { method: 'POST', headers: { origin: publicOrigin },
        body: JSON.stringify({ mode: 'pvp', pregame: true }) });
      assert.equal(response.status, 201);
      const { roomId } = await response.json();
      assert.match(roomId, /^[A-Za-z0-9_-]{32}$/);
      assert.equal((await fetch(`${base}/api/rooms/${roomId}`)).status, 200);
      assert.deepEqual(await (await fetch(`${base}/api/session?room=${roomId}`, {
        headers: { 'x-rts-resume-token': 'invalid' } })).json(), { valid: false });
      assert.equal((await fetch(`${base}/api/rooms`, { method: 'POST', body: '{}' })).status, 429);
      const clients = [];
      try {
        const connect = async () => {
          const socket = new WebSocket(base.replace('http:', 'ws:') + `/ws?room=${roomId}`, ['rts-v1']);
          const client = { socket, messages: [], welcome: null, lobby: null };
          clients.push(client);
          socket.addEventListener('message', event => {
            const message = JSON.parse(event.data);
            client.messages.push(message);
            if (message.type === 'welcome') client.welcome = message;
            if (message.lobby || message.state?.lobby) client.lobby = message.lobby || message.state.lobby;
          });
          await until(() => client.welcome && client.lobby);
          client.exchange = async (command, predicate) => {
            const cursor = client.messages.length;
            socket.send(JSON.stringify(command));
            await until(() => client.messages.slice(cursor).some(predicate));
          };
          return client;
        };
        const host = await connect(), guest = await connect();
        assert.equal(host.welcome.player.team, 0);
        assert.equal(guest.welcome.player.team, 1);
        await guest.exchange({ type: 'launchMatch', revision: guest.lobby.revision }, message => message.type === 'lobbyRejected');
        for (const client of [host, guest]) {
          await client.exchange({ type: 'setReady', revision: client.lobby.revision, ready: true },
            message => message.type === 'lobby' && message.lobby.seats.some(seat => seat.id === client.welcome.player.id && seat.ready));
        }
        await until(() => host.lobby.seats.every(seat => seat.ready));
        await host.exchange({ type: 'launchMatch', revision: host.lobby.revision },
          message => message.type === 'lobby' && message.lobby.phase === 'running');
        await until(() => guest.lobby.phase === 'running');
        assert.deepEqual(await (await fetch(`${base}/api/session?room=${roomId}`, {
          headers: { 'x-rts-resume-token': host.welcome.player.sessionToken } })).json(), { valid: true });
      } finally {
        for (const client of clients) {
          if (client.socket.readyState !== WebSocket.CLOSED) {
            const closed = once(client.socket, 'close');
            client.socket.close();
            await closed;
          }
        }
      }
    } finally { await stopChild(child); await rm(volume, { recursive: true, force: true }); }
  }
});
