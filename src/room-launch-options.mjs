import { randomBytes } from 'node:crypto';

const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{32}$/;
const MAP_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const UINT32_MAX = 0xffff_ffff;
const WORKER_LAUNCH_ENV_KEYS = ['RTS_GAME_MODE', 'RTS_PVE_MAP_SEED', 'RTS_PVE_POLICY_SEED'];

function parseSeed(value, label) {
  const seed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > UINT32_MAX) {
    throw new TypeError(`${label} must be an unsigned 32-bit integer.`);
  }
  return seed;
}

function randomSeed() {
  return randomBytes(4).readUInt32BE(0);
}

function requireCompleteLaunchOptions(value) {
  const options = normalizeRoomLaunchOptions(value);
  if (options.mode === 'pve'
    && (options.mapSeed === undefined || options.policySeed === undefined)) {
    throw new TypeError('Persisted PvE room launch options require both seeds.');
  }
  return options;
}

export function normalizeRoomLaunchOptions(value) {
  if (value === undefined || value === null) return { mode: 'pvp' };
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Room launch options must be an object.');
  }
  for (const key of Object.keys(value)) {
    if (!['mode', 'mapSeed', 'policySeed'].includes(key)) {
      throw new TypeError(`Unknown room launch option: ${key}.`);
    }
  }
  const mode = value.mode ?? 'pvp';
  if (mode !== 'pvp' && mode !== 'pve') {
    throw new TypeError('Room mode must be "pvp" or "pve".');
  }
  const hasMapSeed = Object.hasOwn(value, 'mapSeed');
  const hasPolicySeed = Object.hasOwn(value, 'policySeed');
  if (mode === 'pvp') {
    if (hasMapSeed || hasPolicySeed) {
      throw new TypeError('PvP rooms do not accept PvE seeds.');
    }
    return { mode };
  }
  return {
    mode,
    ...(hasMapSeed ? { mapSeed: parseSeed(value.mapSeed, 'PvE map seed') } : {}),
    ...(hasPolicySeed ? { policySeed: parseSeed(value.policySeed, 'PvE policy seed') } : {}),
  };
}

export function completeRoomLaunchOptions(value, createSeed = randomSeed) {
  const options = normalizeRoomLaunchOptions(value);
  if (options.mode !== 'pve') return options;
  const nextSeed = (existing) => {
    if (existing !== undefined) return existing;
    const seed = createSeed();
    if (!Number.isSafeInteger(seed) || seed < 0 || seed > UINT32_MAX) {
      throw new TypeError('Seed generator must return an unsigned 32-bit integer.');
    }
    return seed;
  };
  return {
    mode: 'pve',
    mapSeed: nextSeed(options.mapSeed),
    policySeed: nextSeed(options.policySeed),
  };
}

export function buildRoomWorkerEnvironment(parentEnvironment, launchOptions) {
  const options = normalizeRoomLaunchOptions(launchOptions);
  const environment = { ...parentEnvironment };
  for (const key of WORKER_LAUNCH_ENV_KEYS) delete environment[key];
  environment.RTS_GAME_MODE = options.mode;
  if (options.mode === 'pve') {
    if (options.mapSeed === undefined || options.policySeed === undefined) {
      throw new TypeError('PvE worker launch options require both seeds.');
    }
    environment.RTS_PVE_MAP_SEED = String(options.mapSeed);
    environment.RTS_PVE_POLICY_SEED = String(options.policySeed);
  }
  return environment;
}

export function normalizeRoomMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const mapId = value.mapId;
  if (mapId === undefined || mapId === null) return null;
  if (typeof mapId !== 'string' || !MAP_ID_PATTERN.test(mapId)) return null;
  return { mapId };
}

export function roomResponseMetadata(room) {
  const launchOptions = requireCompleteLaunchOptions(room.launchOptions);
  const roomMetadata = normalizeRoomMetadata({ mapId: room.mapId });
  return {
    launchOptions,
    ...(roomMetadata ? { mapId: roomMetadata.mapId, roomMetadata } : {}),
  };
}

export function roomIndexDocument(rooms) {
  return {
    version: 2,
    rooms: rooms.map((room) => {
      const launchOptions = requireCompleteLaunchOptions(room.launchOptions);
      const roomMetadata = normalizeRoomMetadata({ mapId: room.mapId });
      return {
        id: room.id,
        createdAt: room.createdAt,
        lastActiveAt: room.lastActiveAt,
        launchOptions,
        ...(roomMetadata ? { mapId: roomMetadata.mapId } : {}),
      };
    }),
  };
}

export function normalizeRoomIndex(index) {
  if (!index || ![1, 2].includes(index.version) || !Array.isArray(index.rooms)) return null;
  const seenIds = new Set();
  const rooms = [];
  for (const entry of index.rooms) {
    if (!entry || typeof entry !== 'object'
      || !ROOM_ID_PATTERN.test(entry.id || '')
      || !Number.isFinite(entry.createdAt)
      || !Number.isFinite(entry.lastActiveAt)
      || seenIds.has(entry.id)) return null;
    seenIds.add(entry.id);
    let launchOptions;
    try {
      launchOptions = index.version === 1 ? { mode: 'pvp' } : requireCompleteLaunchOptions(entry.launchOptions);
    } catch {
      return null;
    }
    const roomMetadata = index.version === 2 ? normalizeRoomMetadata({ mapId: entry.mapId }) : null;
    if (index.version === 2 && entry.mapId != null && !roomMetadata) return null;
    rooms.push({
      id: entry.id,
      createdAt: entry.createdAt,
      lastActiveAt: entry.lastActiveAt,
      launchOptions,
      ...(roomMetadata ? { mapId: roomMetadata.mapId } : {}),
    });
  }
  return { version: 2, rooms };
}
