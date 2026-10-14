import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer, request as httpRequest } from 'node:http';
import { connect as connectTcp } from 'node:net';
import { mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configuredPublicOrigins, sameOriginRequest } from './src/server/transport/origin-policy.mjs';
import { practiceEntryCatalog } from './src/world/practice-entry-catalog.mjs';
import { NORMAL_MATCH_MAP_ID, NORMAL_HUMAN_MATCH_MODE } from './src/match-modes.mjs';
import { isAnonymousGameplayRequest } from './src/server/public-gameplay.mjs';
import { loadBuildIdentity } from './src/server/build-identity.mjs';
import { createRoomIndexStore } from './src/server/persistence/room-index-store.mjs';
import { createRoomArchiveStore } from './src/server/persistence/room-archive-store.mjs';
import { ORDINARY_MAP_MIN_SIDE, MAP_SIZE_TIERS } from './src/map-size-policy.mjs';
import {
  buildRoomWorkerEnvironment,
  completeRoomLaunchOptions,
  normalizeRoomMetadata,
  roomIndexDocument,
  roomResponseMetadata,
  freshRoomLaunchOptions,
} from './src/server/orchestration/room-launch-options.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BUILD_IDENTITY = await loadBuildIdentity(ROOT);
const WORKER_PATH = path.join(ROOT, 'server.mjs');
const HOST = process.env.RTS_HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);
const MAX_ROOMS = Number(process.env.RTS_MAX_ROOMS || 4);
const ROOM_IDLE_TTL_MS = Number(process.env.RTS_ROOM_IDLE_TTL_MS || 6 * 60 * 60 * 1000);
const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{32}$/;
const RAILWAY_DEPLOYMENT = Boolean(process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_ENVIRONMENT);
const PUBLIC_ORIGINS = configuredPublicOrigins();
const VOLUME_MOUNT_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH || null;
const PUBLIC_GAMEPLAY = process.env.RTS_PUBLIC_GAMEPLAY === '1';
const ACCESS_USER = process.env.RTS_ACCESS_USER || 'players';
const ACCESS_PASSWORD = process.env.RTS_ACCESS_PASSWORD || null;
const ACCESS_HASH = ACCESS_PASSWORD
  ? createHash('sha256').update(`${ACCESS_USER}:${ACCESS_PASSWORD}`).digest() : null;
const ROOM_DATA_DIRECTORY = path.resolve(ROOT, process.env.RTS_ROOM_DATA_DIRECTORY
  || (VOLUME_MOUNT_PATH ? path.join(VOLUME_MOUNT_PATH, 'room-data') : 'room-data'));
const ROOM_DIRECTORY = path.join(ROOM_DATA_DIRECTORY, 'rooms');
const ROOM_ARCHIVE_DIRECTORY = path.join(ROOM_DATA_DIRECTORY, 'archived-rooms');
const ROOM_INDEX_PATH = path.join(ROOM_DATA_DIRECTORY, 'rooms.json');
const DEFAULT_MATCH_STATE_PATH = path.join(ROOM_DATA_DIRECTORY, 'default-match-state.json');
const DEFAULT_MAP_DIRECTORY = path.resolve(ROOT, process.env.RTS_CUSTOM_MAP_DIRECTORY
  || (VOLUME_MOUNT_PATH ? path.join(VOLUME_MOUNT_PATH, 'custom-maps') : 'custom-maps'));
const WORKER_START_TIMEOUT_MS = 15_000;
const WORKER_STOP_TIMEOUT_MS = 7_000;
const MAX_ROOM_OPTIONS_BYTES = 4096;
const INDEX_SAVE_INTERVAL_MS = 20_000;
const ROOM_SWEEP_INTERVAL_MS = 60_000;
const practiceSetup = (async () => {
  const maps = path.join(ROOT, 'maps');
  const file = path.resolve(ROOT, `maps/${NORMAL_MATCH_MAP_ID}.json`);
  if (!file.startsWith(`${maps}${path.sep}`)) return null;
  // The existing default worker validates this same canonical startup file.
  try {
    const presets = await Promise.all((await readdir(maps)).filter(name => name.endsWith('.json'))
      .map(async name => JSON.parse(await readFile(path.join(maps, name), 'utf8'))));
    return practiceEntryCatalog(JSON.parse(await readFile(file, 'utf8')), presets);
  }
  catch { return null; }
})();

if (RAILWAY_DEPLOYMENT && !VOLUME_MOUNT_PATH) {
  throw new Error('Attach a Railway volume before starting the match service.');
}
if (VOLUME_MOUNT_PATH && !path.isAbsolute(VOLUME_MOUNT_PATH)) {
  throw new Error('RAILWAY_VOLUME_MOUNT_PATH must be an absolute path.');
}
if ((RAILWAY_DEPLOYMENT || PUBLIC_GAMEPLAY) && (!ACCESS_PASSWORD || ACCESS_PASSWORD.length < 16)) {
  throw new Error('Set RTS_ACCESS_PASSWORD to at least 16 characters before exposing the Railway service.');
}
if (RAILWAY_DEPLOYMENT && PUBLIC_ORIGINS.size === 0) {
  throw new Error('Set RAILWAY_PUBLIC_DOMAIN or RTS_PUBLIC_ORIGINS before exposing the match service.');
}
if (VOLUME_MOUNT_PATH) {
  const mount = path.resolve(VOLUME_MOUNT_PATH);
  const onVolume = (directory) => directory.startsWith(`${mount}${path.sep}`);
  if (!onVolume(ROOM_DATA_DIRECTORY) || !onVolume(DEFAULT_MAP_DIRECTORY)) {
    throw new Error('Room data and custom maps must both be stored on the attached volume.');
  }
}

if (!Number.isInteger(MAX_ROOMS) || MAX_ROOMS < 1 || MAX_ROOMS > 32) {
  throw new Error('RTS_MAX_ROOMS must be an integer between 1 and 32.');
}
if (!Number.isFinite(ROOM_IDLE_TTL_MS) || ROOM_IDLE_TTL_MS < 60_000 || ROOM_IDLE_TTL_MS > 30 * 24 * 60 * 60 * 1000) {
  throw new Error('RTS_ROOM_IDLE_TTL_MS must be between one minute and 30 days.');
}

const rooms = new Map();
const restoringRooms = new Set();
const roomArchiveStore = createRoomArchiveStore({ roomDirectory: ROOM_DIRECTORY, archiveDirectory: ROOM_ARCHIVE_DIRECTORY });
const workerProcesses = new Set();
const proxySockets = new Set();
let stopping = false;
let defaultWorker = null;
let defaultWorkerStarting = null;
const roomIndexStore = createRoomIndexStore({
  dataDirectory: ROOM_DATA_DIRECTORY,
  indexPath: ROOM_INDEX_PATH,
  captureDocument: () => roomIndexDocument([...rooms.values()]),
});

function makeRoom(id, values = {}) {
  const directory = path.join(ROOM_DIRECTORY, id);
  const roomMetadata = normalizeRoomMetadata(values);
  return {
    id,
    directory,
    customMapDirectory: path.join(directory, 'custom-maps'),
    matchStatePath: path.join(directory, 'match-state.json'),
    createdAt: Number.isFinite(values.createdAt) ? values.createdAt : Date.now(),
    lastActiveAt: Number.isFinite(values.lastActiveAt) ? values.lastActiveAt : Date.now(),
    launchOptions: completeRoomLaunchOptions(values.launchOptions),
    mapId: roomMetadata?.mapId ?? null,
    ...(roomMetadata?.matchModeId ? {
      matchModeId: roomMetadata.matchModeId, matchModeVersion: roomMetadata.matchModeVersion,
    } : {}),
    lastIndexWriteAt: 0,
    activeConnections: 0,
    pendingConnections: 0,
    worker: null,
    starting: null,
    archiving: null,
  };
}

function persistRoomIndex() {
  return roomIndexStore.persist();
}

async function loadRooms() {
  await mkdir(ROOM_DIRECTORY, { recursive: true });
  const { savedRooms, validIndex, indexState } = await roomIndexStore.read();
  const now = Date.now();
  const retained = new Set();
  if (validIndex) {
    savedRooms.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    for (const entry of savedRooms) {
      const directory = path.join(ROOM_DIRECTORY, entry.id);
      try {
        if (!(await stat(directory)).isDirectory()) continue;
      } catch { continue; }
      if (now - entry.lastActiveAt >= ROOM_IDLE_TTL_MS) {
        try {
          await roomArchiveStore.archive(entry, 'idle-expiry');
          continue;
        } catch (error) {
          console.error('Could not archive expired room; retaining its data and capacity:', error);
        }
      }
      rooms.set(entry.id, makeRoom(entry.id, entry));
      retained.add(entry.id);
    }
  } else {
    if (indexState === 'invalid') {
      console.warn('Room index is malformed or unsupported; preserving room directories and rebuilding the index.');
    }
  }

  let recoveredCount = 0;
  for (const entry of await readdir(ROOM_DIRECTORY, { withFileTypes: true })) {
    if (!entry.isDirectory() || !ROOM_ID_PATTERN.test(entry.name) || retained.has(entry.name)) continue;
    try {
      if (!(await stat(path.join(ROOM_DIRECTORY, entry.name))).isDirectory()) continue;
    } catch { continue; }
    // Keep directories omitted by an old index. Without trustworthy activity
    // timestamps, restarting their idle window is safer than deleting player data.
    const restored = await roomArchiveStore.recover(entry.name).catch(() => null);
    rooms.set(entry.name, makeRoom(entry.name, { ...(restored || { createdAt: now }), lastActiveAt: now }));
    retained.add(entry.name);
    recoveredCount++;
  }
  if (recoveredCount > 0) {
    console.warn(`Recovered ${recoveredCount} room director${recoveredCount === 1 ? 'y' : 'ies'} missing from the index.`);
  }

  if (rooms.size > MAX_ROOMS) {
    console.warn(`Recovered ${rooms.size} saved rooms above the current limit of ${MAX_ROOMS}; new room creation is disabled until capacity is available.`);
  }
  await persistRoomIndex();
}

function roomExpired(room, now = Date.now()) {
  return !room.archiving && !room.starting && room.activeConnections === 0 && room.pendingConnections === 0
    && now - room.lastActiveAt >= ROOM_IDLE_TTL_MS;
}

function touchRoom(room) {
  if (!stopping) room.lastActiveAt = Date.now();
}

function capacityError() {
  const error = new Error('Room capacity reached. Resume or join an existing room, or retry after idle rooms expire. Returning to Main Menu preserves a room; ask the server operator to archive an unused room if needed.');
  error.statusCode = 429;
  return error;
}

function sameOrigin(request) {
  return sameOriginRequest(request, {
    allowedOrigins: PUBLIC_ORIGINS,
    httpsTerminatedAtEdge: RAILWAY_DEPLOYMENT,
  });
}

function hasAccess(request) {
  if (!ACCESS_HASH) return true;
  const header = request.headers.authorization;
  if (typeof header !== 'string' || header.length > 1024 || !/^Basic [A-Za-z0-9+/]+={0,2}$/.test(header)) return false;
  const supplied = createHash('sha256').update(Buffer.from(header.slice(6), 'base64')).digest();
  return timingSafeEqual(supplied, ACCESS_HASH);
}

function requireAccess(response) {
  response.writeHead(401, {
    'www-authenticate': 'Basic realm="Thousand Unit Skirmish", charset="UTF-8"',
    'cache-control': 'no-store',
    'content-type': 'text/plain; charset=utf-8',
  });
  response.end('Authentication required.');
}

function sendJson(response, status, value) {
  const body = Buffer.from(JSON.stringify(value));
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(body);
}

async function readRoomLaunchOptions(request) {
  const chunks = [];
  let byteLength = 0;
  let tooLarge = false;
  for await (const chunk of request) {
    byteLength += chunk.length;
    if (byteLength > MAX_ROOM_OPTIONS_BYTES) {
      tooLarge = true;
      continue;
    }
    chunks.push(chunk);
  }
  if (tooLarge) {
    const error = new Error('Room launch options are too large.');
    error.statusCode = 413;
    throw error;
  }
  const body = Buffer.concat(chunks).toString('utf8').trim();
  if (!body) return freshRoomLaunchOptions();
  let value;
  try { value = JSON.parse(body); }
  catch {
    const error = new Error('Room launch options must be valid JSON.');
    error.statusCode = 400;
    throw error;
  }
  try { return freshRoomLaunchOptions(value); }
  catch (cause) {
    const error = new Error(String(cause.message || cause));
    error.statusCode = 400;
    throw error;
  }
}

async function createRoom(launchOptions = { mode: 'pvp' }) {
  // Reclaim due slots now, rather than refusing until the next minute's sweep.
  await archiveExpiredRooms();
  if (rooms.size + restoringRooms.size >= MAX_ROOMS) throw capacityError();
  let id;
  do { id = randomBytes(24).toString('base64url'); } while (rooms.has(id));
  const room = makeRoom(id, { launchOptions: completeRoomLaunchOptions(launchOptions) });
  rooms.set(id, room);
  try {
    await mkdir(room.customMapDirectory, { recursive: true });
    await persistRoomIndex();
    return room;
  } catch (error) {
    rooms.delete(id);
    await rm(room.directory, { recursive: true, force: true });
    throw error;
  }
}

function logWorkerOutput(label, stream, isError = false) {
  let pending = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() || '';
    for (const line of lines) {
      if (!line) continue;
      (isError ? console.error : console.log)(`[${label}] ${line}`);
    }
  });
  stream.on('end', () => {
    if (pending) (isError ? console.error : console.log)(`[${label}] ${pending}`);
  });
}

function startWorker(customMapDirectory, matchStatePath, label, launchOptions = { mode: 'pvp', ...NORMAL_HUMAN_MATCH_MODE }, onRoomMetadata, savedMetadata = null) {
  return new Promise((resolve, reject) => {
    const { RTS_ACCESS_PASSWORD: _accessPassword, ...parentEnvironment } = process.env;
    const workerEnvironment = buildRoomWorkerEnvironment(parentEnvironment, launchOptions, savedMetadata);
    const child = spawn(process.execPath, [WORKER_PATH], {
      cwd: ROOT,
      env: {
        ...workerEnvironment,
        PORT: '0',
        RTS_HOST: '127.0.0.1',
        RTS_CUSTOM_MAP_DIRECTORY: customMapDirectory,
        RTS_MATCH_STATE_PATH: matchStatePath,
        RTS_MANAGED_WORKER: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    workerProcesses.add(child);
    console.log(`[${label}] worker pid=${child.pid}`);
    logWorkerOutput(label, child.stdout);
    logWorkerOutput(label, child.stderr, true);

    let settled = false;
    let worker = null;
    const timeout = setTimeout(() => fail(new Error(`${label} did not become ready in time.`)), WORKER_START_TIMEOUT_MS);
    const fail = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.kill('SIGTERM');
      reject(error);
    };
    child.on('message', (message) => {
      if (worker && message?.type === 'roomMetadata') {
        const roomMetadata = normalizeRoomMetadata(message.roomMetadata);
        if (roomMetadata) {
          worker.roomMetadata = roomMetadata;
          onRoomMetadata?.(roomMetadata, worker);
        }
        return;
      }
      if (settled || message?.type !== 'ready') return;
      const port = message.port;
      if (!Number.isInteger(port) || port < 1 || port > 65535) return;
      settled = true;
      clearTimeout(timeout);
      const roomMetadata = normalizeRoomMetadata(message.roomMetadata);
      worker = { child, port, ...(roomMetadata ? { roomMetadata } : {}) };
      resolve(worker);
    });
    child.once('error', fail);
    child.once('exit', (code, signal) => {
      workerProcesses.delete(child);
      if (!settled) fail(new Error(`${label} exited before startup (code ${code ?? 'null'}, signal ${signal ?? 'none'}).`));
    });
  });
}

function updateRoomMetadata(room, roomMetadata) {
  if (!roomMetadata || (room.mapId === roomMetadata.mapId && room.matchModeId === roomMetadata.matchModeId
    && room.matchModeVersion === roomMetadata.matchModeVersion)) return;
  room.mapId = roomMetadata.mapId;
  delete room.matchModeId;
  delete room.matchModeVersion;
  if (roomMetadata.matchModeId) {
    room.matchModeId = roomMetadata.matchModeId;
    room.matchModeVersion = roomMetadata.matchModeVersion;
  }
  void persistRoomIndex().catch((error) => console.error('Could not save room index:', error));
}

async function ensureRoomWorker(room) {
  if (room.worker?.child.exitCode === null) return room.worker;
  if (room.starting) return room.starting;
  room.starting = (async () => {
    await mkdir(room.customMapDirectory, { recursive: true });
    // Index metadata is a historical startup fallback when a checkpoint is absent.
    // Custom-map geometry still requires its checkpoint; never invent a shipped file.
    const savedMetadata = room.mapId && await stat(path.join(ROOT, 'maps', `${room.mapId}.json`))
      .then(value => value.isFile()).catch(() => false) ? normalizeRoomMetadata(room) : null;
    const worker = await startWorker(
      room.customMapDirectory, room.matchStatePath, `room ${room.id.slice(0, 8)}`, room.launchOptions,
      (roomMetadata, worker) => {
        if (room.worker === worker) updateRoomMetadata(room, roomMetadata);
      },
      savedMetadata,
    );
    room.worker = worker;
    updateRoomMetadata(room, worker.roomMetadata);
    worker.child.once('exit', () => {
      if (room.worker !== worker) return;
      room.worker = null;
      // Worker shutdown/crash and metadata/session probes are not player activity.
      void persistRoomIndex().catch((error) => console.error('Could not save room index:', error));
    });
    return worker;
  })();
  try { return await room.starting; }
  finally { room.starting = null; }
}

async function ensureDefaultWorker() {
  if (defaultWorker?.child.exitCode === null) return defaultWorker;
  if (stopping) throw new Error('Room service is shutting down.');
  if (defaultWorkerStarting) return defaultWorkerStarting;
  defaultWorkerStarting = (async () => {
    await mkdir(DEFAULT_MAP_DIRECTORY, { recursive: true });
    const worker = await startWorker(
      DEFAULT_MAP_DIRECTORY, DEFAULT_MATCH_STATE_PATH, 'default room',
      process.env.RTS_MAP ? { mode: 'pvp' } : { mode: 'pvp', ...NORMAL_HUMAN_MATCH_MODE },
    );
    defaultWorker = worker;
    worker.child.once('exit', (code, signal) => {
      if (defaultWorker !== worker) return;
      defaultWorker = null;
      if (!stopping) {
        console.error(`[default room] worker exited (code ${code ?? 'null'}, signal ${signal ?? 'none'}); it will restart on demand.`);
      }
    });
    return worker;
  })();
  try { return await defaultWorkerStarting; }
  finally { defaultWorkerStarting = null; }
}

function proxyHttp(request, response, worker) {
  const headers = { ...request.headers, host: `127.0.0.1:${worker.port}` };
  delete headers.connection;
  delete headers.authorization;
  delete headers['x-forwarded-host'];
  delete headers['x-forwarded-proto'];
  const upstream = httpRequest({
    hostname: '127.0.0.1', port: worker.port, path: request.url,
    method: request.method, headers,
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.statusMessage, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });
  upstream.on('error', () => {
    if (response.headersSent) response.destroy();
    else sendJson(response, 502, { error: 'Match server is unavailable.' });
  });
  request.pipe(upstream);
}

function readWorkerHealth(worker) {
  return new Promise((resolve) => {
    if (!worker || worker.child.exitCode !== null) { resolve(null); return; }
    let settled = false;
    const finish = (health) => {
      if (settled) return;
      settled = true;
      resolve(health);
    };
    const upstream = httpRequest({
      hostname: '127.0.0.1', port: worker.port, path: '/health', method: 'GET',
      headers: { host: `127.0.0.1:${worker.port}`, connection: 'close' },
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try {
          const health = JSON.parse(body);
          finish(response.statusCode === 200 && health?.ok === true ? health : null);
        } catch { finish(null); }
      });
    });
    upstream.setTimeout(1500, () => upstream.destroy());
    upstream.on('error', () => finish(null));
    upstream.end();
  });
}

function rejectUpgrade(socket, status, phrase) {
  const body = Buffer.from(`${phrase}\n`);
  const challenge = status === 401 ? 'WWW-Authenticate: Basic realm="Thousand Unit Skirmish", charset="UTF-8"\r\n' : '';
  socket.end(`HTTP/1.1 ${status} ${phrase}\r\n${challenge}Connection: close\r\nContent-Length: ${body.length}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`);
}

function proxyUpgrade(request, socket, head, worker, room = null) {
  const upstream = connectTcp(worker.port, '127.0.0.1');
  proxySockets.add(socket);
  let reserved = Boolean(room);
  if (room) room.pendingConnections++;
  const releaseReservation = () => {
    if (!reserved) return;
    reserved = false;
    room.pendingConnections--;
  };
  let counted = false;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    releaseReservation();
    proxySockets.delete(socket);
    if (counted && room) {
      room.activeConnections = Math.max(0, room.activeConnections - 1);
      touchRoom(room);
      void persistRoomIndex().catch((error) => console.error('Could not save room index:', error));
    }
  };
  const rejectUnavailable = () => {
    if (!socket.destroyed) rejectUpgrade(socket, 503, 'Service Unavailable');
    finish();
  };
  const connectTimeout = setTimeout(() => {
    rejectUnavailable();
    upstream.destroy();
  }, 5000);
  upstream.once('connect', () => {
    clearTimeout(connectTimeout);
    if (socket.destroyed) { upstream.destroy(); finish(); return; }
    const headers = [];
    for (let index = 0; index < request.rawHeaders.length; index += 2) {
      const name = request.rawHeaders[index];
      const lower = name.toLowerCase();
      if (['authorization', 'x-forwarded-host', 'x-forwarded-proto', 'x-forwarded-for', 'forwarded'].includes(lower)) continue;
      headers.push(`${name}: ${request.rawHeaders[index + 1]}`);
    }
    upstream.write(`${request.method} ${request.url} HTTP/${request.httpVersion}\r\n${headers.join('\r\n')}\r\n\r\n`);
    if (head?.length) upstream.write(head);
    socket.pipe(upstream);
    upstream.pipe(socket);
    socket.on('data', () => { if (room) touchRoom(room); });
    upstream.on('data', () => { if (room) touchRoom(room); });
    if (room) {
      room.activeConnections++;
      touchRoom(room);
      counted = true;
    }
    releaseReservation();
  });
  socket.on('close', () => { clearTimeout(connectTimeout); upstream.destroy(); finish(); });
  socket.on('error', () => { clearTimeout(connectTimeout); upstream.destroy(); finish(); });
  upstream.on('close', () => { clearTimeout(connectTimeout); if (!socket.destroyed) socket.destroy(); finish(); });
  upstream.on('error', () => {
    clearTimeout(connectTimeout);
    if (!counted) rejectUnavailable();
    else { socket.destroy(); finish(); }
  });
}

async function handleRequest(request, response) {
  if (stopping) { sendJson(response, 503, { error: 'Room service is restarting.' }); return; }
  let url;
  try { url = new URL(request.url || '/', `http://${request.headers.host || `${HOST}:${PORT}`}`); }
  catch { sendJson(response, 400, { error: 'Bad request.' }); return; }

  if (url.pathname === '/ready' || url.pathname === '/health') {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendJson(response, 405, { error: 'Method not allowed.' });
      return;
    }
    if (url.pathname === '/health' && !hasAccess(request)) { requireAccess(response); return; }
    let worker = null;
    try { worker = await ensureDefaultWorker(); } catch {}
    const matchHealth = await readWorkerHealth(worker);
    const ok = Boolean(matchHealth);
    if (url.pathname === '/ready') {
      sendJson(response, ok ? 200 : 503, { ok });
      return;
    }
    sendJson(response, ok ? 200 : 503, {
      ...(matchHealth || {}),
      ok,
      buildIdentity: BUILD_IDENTITY,
      roomCount: rooms.size,
      roomLimit: MAX_ROOMS,
      liveRoomProcesses: [...rooms.values()].filter((room) => room.worker?.child.exitCode === null).length,
      connectedInvitePeers: [...rooms.values()].reduce((total, room) => total + room.activeConnections, 0),
      roomIdleTtlMs: ROOM_IDLE_TTL_MS,
    });
    return;
  }

  if (!hasAccess(request) && !(PUBLIC_GAMEPLAY && isAnonymousGameplayRequest(request.method, url))) {
    requireAccess(response); return;
  }

  if (url.pathname === '/api/admin/rooms' && request.method === 'GET') {
    // This route remains behind operator authentication in public-gameplay mode.
    sendJson(response, 200, { roomLimit: MAX_ROOMS, roomIdleTtlMs: ROOM_IDLE_TTL_MS,
      rooms: [...rooms.values()].map(room => ({
        ...roomIndexDocument([room]).rooms[0], state: room.archiving ? 'archiving' : 'retained',
        activeConnections: room.activeConnections, pendingConnections: room.pendingConnections,
        workerRunning: Boolean(room.worker), expiresAt: room.lastActiveAt + ROOM_IDLE_TTL_MS,
      })), archives: await roomArchiveStore.list() });
    return;
  }

  const managementMatch = url.pathname.match(/^\/api\/admin\/rooms\/([A-Za-z0-9_-]{32})\/(archive|restore)$/);
  if (managementMatch && request.method === 'POST') {
    request.resume();
    if (!sameOrigin(request)) { sendJson(response, 403, { error: 'Cross-origin room management is not allowed.' }); return; }
    const [, id, action] = managementMatch;
    try {
      if (action === 'archive') {
        const room = rooms.get(id);
        if (!room) { sendJson(response, 404, { error: 'Room not found.' }); return; }
        if (!await archiveRoom(room, 'operator')) {
          sendJson(response, 409, { error: 'Room is connected, joining, or already being archived. Leave all clients before archiving.' }); return;
        }
      } else {
        await restoreRoom(id);
      }
      sendJson(response, 200, { ok: true, roomId: id, state: action === 'archive' ? 'archived' : 'retained' });
    } catch (error) {
      sendJson(response, error.statusCode || (error.code === 'ENOENT' ? 404 : 503), { error: String(error.message || error) });
    }
    return;
  }

  if (url.pathname === '/api/rooms/status' && request.method === 'GET') {
    sendJson(response, 200, { enabled: true, roomCount: rooms.size, roomLimit: MAX_ROOMS, roomIdleTtlMs: ROOM_IDLE_TTL_MS, practiceSetup: await practiceSetup,
      ordinarySetup: { minimumSide: ORDINARY_MAP_MIN_SIDE, defaultMapId: NORMAL_MATCH_MAP_ID,
        ...NORMAL_HUMAN_MATCH_MODE, mapSizeTiers: MAP_SIZE_TIERS,
        pve: { available: true, mapId: NORMAL_MATCH_MAP_ID,
          supportedMapIds: [NORMAL_MATCH_MAP_ID], ...NORMAL_HUMAN_MATCH_MODE } } });
    return;
  }

  if (url.pathname === '/api/session' && request.method === 'GET' && url.searchParams.has('room')) {
    const id = url.searchParams.get('room');
    const room = ROOM_ID_PATTERN.test(id || '') ? rooms.get(id) : null;
    if (!room || room.archiving || roomExpired(room)) { sendJson(response, 404, { valid: false }); return; }
    room.pendingConnections++;
    response.once('close', () => { room.pendingConnections--; });
    try {
      const worker = await ensureRoomWorker(room);
      proxyHttp(request, response, worker);
    } catch { sendJson(response, 503, { valid: false }); }
    return;
  }

  if (url.pathname === '/api/rooms' && request.method === 'POST') {
    if (!sameOrigin(request)) {
      request.resume();
      sendJson(response, 403, { error: 'Cross-origin room creation is not allowed.' });
      return;
    }
    try {
      const launchOptions = await readRoomLaunchOptions(request);
      const room = await createRoom(launchOptions);
      sendJson(response, 201, { roomId: room.id, ...roomResponseMetadata(room) });
    } catch (error) {
      sendJson(response, Number.isInteger(error.statusCode) ? error.statusCode : 500, { error: String(error.message || error) });
    }
    return;
  }

  const roomMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)$/);
  if (roomMatch && request.method === 'GET') {
    const id = roomMatch[1];
    const room = ROOM_ID_PATTERN.test(id) ? rooms.get(id) : null;
    if (!room || room.archiving) { sendJson(response, 404, { error: 'Room not found or archived. Ask the server operator about restoring an archived invite.' }); return; }
    if (roomExpired(room)) {
      await archiveRoom(room, 'idle-expiry');
      sendJson(response, 404, { error: 'Room expired.' });
      return;
    }
    sendJson(response, 200, { ok: true, roomId: room.id, ...roomResponseMetadata(room) });
    return;
  }

  try {
    const worker = await ensureDefaultWorker();
    proxyHttp(request, response, worker);
  } catch {
    sendJson(response, 503, { error: 'Default match server is unavailable.' });
  }
}

async function handleUpgrade(request, socket, head) {
  if (stopping) { rejectUpgrade(socket, 503, 'Service Unavailable'); return; }
  const authenticated = hasAccess(request);
  if (!authenticated && !PUBLIC_GAMEPLAY) { rejectUpgrade(socket, 401, 'Unauthorized'); return; }
  let url;
  try { url = new URL(request.url || '/', `http://${request.headers.host || `${HOST}:${PORT}`}`); }
  catch { rejectUpgrade(socket, 400, 'Bad Request'); return; }
  if (!authenticated && !(request.method === 'GET' && url.pathname === '/ws')) {
    rejectUpgrade(socket, 401, 'Unauthorized'); return;
  }
  if (url.pathname !== '/ws') { rejectUpgrade(socket, 404, 'Not Found'); return; }
  if (!sameOrigin(request)) { rejectUpgrade(socket, 403, 'Forbidden'); return; }

  const roomId = url.searchParams.get('room');
  if (roomId === null) {
    try {
      const worker = await ensureDefaultWorker();
      if (socket.destroyed || stopping) return;
      proxyUpgrade(request, socket, head, worker);
    } catch (error) {
      console.error('Could not start the default match:', error);
      rejectUpgrade(socket, 503, 'Service Unavailable');
    }
    return;
  }
  if (!ROOM_ID_PATTERN.test(roomId)) { rejectUpgrade(socket, 400, 'Bad Request'); return; }
  const room = rooms.get(roomId);
  if (!room || room.archiving) { rejectUpgrade(socket, 404, 'Not Found'); return; }
  if (roomExpired(room)) {
    try { await archiveRoom(room, 'idle-expiry'); }
    catch (error) { console.error(`Could not expire room ${roomId.slice(0, 8)}:`, error); }
    rejectUpgrade(socket, 404, 'Not Found');
    return;
  }
  // Reserve the room before asynchronous startup: expiry must not remove its
  // checkpoint/maps while an admitted reconnect is waiting for a worker.
  room.pendingConnections++;
  touchRoom(room);
  try {
    const worker = await ensureRoomWorker(room);
    if (socket.destroyed || stopping) return;
    proxyUpgrade(request, socket, head, worker, room);
  } catch (error) {
    console.error(`Could not start room ${roomId.slice(0, 8)}:`, error);
    rejectUpgrade(socket, 503, 'Service Unavailable');
  } finally {
    room.pendingConnections--;
    touchRoom(room);
  }
}

async function archiveRoom(room, reason) {
  if (rooms.get(room.id) !== room || room.archiving || room.starting || room.activeConnections > 0 || room.pendingConnections > 0) return false;
  // Set before the first await: joins and competing archive requests cannot race
  // worker shutdown, checkpoint flush or the atomic move out of the active set.
  room.archiving = (async () => {
    await stopWorker(room.worker);
    room.worker = null;
    await roomArchiveStore.archive(room, reason);
    rooms.delete(room.id);
    await persistRoomIndex();
    return true;
  })();
  try { return await room.archiving; }
  finally { room.archiving = null; }
}

async function archiveExpiredRooms() {
  for (const room of rooms.values()) {
    if (!roomExpired(room)) continue;
    try { await archiveRoom(room, 'idle-expiry'); }
    catch (error) { console.error('Could not archive expired room; preserving data:', error); }
  }
}

async function restoreRoom(id) {
  if (rooms.has(id) || restoringRooms.has(id)) {
    const error = new Error('Room is already retained or being restored.');
    error.statusCode = 409;
    throw error;
  }
  await archiveExpiredRooms();
  // Recheck after asynchronous expiry, then reserve capacity before disk I/O.
  if (rooms.has(id) || restoringRooms.has(id)) {
    const error = new Error('Room is already retained or being restored.');
    error.statusCode = 409;
    throw error;
  }
  if (rooms.size + restoringRooms.size >= MAX_ROOMS) throw capacityError();
  restoringRooms.add(id);
  try {
    const entry = await roomArchiveStore.restore(id);
    rooms.set(id, makeRoom(id, entry));
    await persistRoomIndex();
  } finally { restoringRooms.delete(id); }
}

async function stopWorker(worker) {
  const child = worker?.child;
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit').catch(() => {});
  child.kill('SIGTERM');
  let timeout;
  try {
    await Promise.race([exited, new Promise((resolve) => {
      timeout = setTimeout(resolve, WORKER_STOP_TIMEOUT_MS);
    })]);
  } finally { clearTimeout(timeout); }
  if (child.exitCode === null && child.signalCode === null) {
    const killed = once(child, 'exit').catch(() => {});
    child.kill('SIGKILL');
    await killed;
  }
}

const SHIPPED_MAP_DIRECTORY = path.join(ROOT, 'maps');
if (ROOM_DATA_DIRECTORY === SHIPPED_MAP_DIRECTORY
  || ROOM_DATA_DIRECTORY.startsWith(`${SHIPPED_MAP_DIRECTORY}${path.sep}`)
  || ROOM_DATA_DIRECTORY === DEFAULT_MAP_DIRECTORY
  || ROOM_DATA_DIRECTORY.startsWith(`${DEFAULT_MAP_DIRECTORY}${path.sep}`)) {
  throw new Error('RTS_ROOM_DATA_DIRECTORY must remain separate from map directories.');
}
await mkdir(ROOM_DATA_DIRECTORY, { recursive: true });
await loadRooms();
await mkdir(DEFAULT_MAP_DIRECTORY, { recursive: true });
const server = createServer((request, response) => {
  void handleRequest(request, response).catch(error => {
    console.error('Room request failed:', error);
    if (!response.headersSent) sendJson(response, 503, { error: 'Room storage is unavailable. Existing data has been preserved; retry or contact the server operator.' });
    else response.destroy();
  });
});
server.on('upgrade', (request, socket, head) => { void handleUpgrade(request, socket, head); });
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(PORT, HOST, () => {
    const address = server.address();
    console.log(`RTS room supervisor listening at http://${HOST}:${address.port} · ${rooms.size} invite rooms`);
    resolve();
  });
});
await ensureDefaultWorker();

const indexTimer = setInterval(() => {
  void persistRoomIndex().catch((error) => console.error('Could not save room index:', error));
}, INDEX_SAVE_INTERVAL_MS);
indexTimer.unref();

const roomSweepTimer = setInterval(() => {
  void archiveExpiredRooms();
}, ROOM_SWEEP_INTERVAL_MS);
roomSweepTimer.unref();

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  clearInterval(indexTimer);
  clearInterval(roomSweepTimer);
  console.log(`RTS room supervisor draining after ${signal}.`);
  server.close();
  await persistRoomIndex().catch((error) => console.error('Could not save room index:', error));
  await Promise.all([...workerProcesses].map((child) => stopWorker({ child })));
  for (const socket of proxySockets) socket.destroy();
  await Promise.allSettled([...rooms.values()].map(room => room.archiving).filter(Boolean));
  await persistRoomIndex().catch((error) => console.error('Could not save room index:', error));
  server.closeAllConnections?.();
  console.log('RTS room supervisor shutdown complete.');
}

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT', () => { void shutdown('SIGINT'); });
