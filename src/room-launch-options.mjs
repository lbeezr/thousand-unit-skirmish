import { randomBytes } from 'node:crypto';
import { matchModeDefinition, normalizeMatchMode, NORMAL_HUMAN_MATCH_MODE } from './match-modes.mjs';

export const FRESH_PVE_UNAVAILABLE_REASON = 'New Play vs AI matches are unavailable while 160 × 160 Skirmish AI acceptance is pending. Existing AI rooms can still be resumed.';

const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{32}$/;
const MAP_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const UINT32_MAX = 0xffff_ffff;
const WORKER_LAUNCH_ENV_KEYS = ['RTS_GAME_MODE', 'RTS_PVE_MAP_SEED', 'RTS_PVE_POLICY_SEED', 'RTS_PREGAME', 'RTS_SOLO_PRACTICE',
  'RTS_MATCH_MODE_ID', 'RTS_MATCH_MODE_VERSION'];

function hasMatchModeFields(value) {
  return value && typeof value === 'object'
    && (Object.hasOwn(value, 'matchModeId') || Object.hasOwn(value, 'matchModeVersion'));
}

function explicitMatchMode(value) {
  return hasMatchModeFields(value) ? normalizeMatchMode(value) : {};
}

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
    if (!['mode', 'mapSeed', 'policySeed', 'pregame', 'practice', 'matchModeId', 'matchModeVersion'].includes(key)) {
      throw new TypeError(`Unknown room launch option: ${key}.`);
    }
  }
  const mode = value.mode ?? 'pvp';
  if (mode !== 'pvp' && mode !== 'pve') {
    throw new TypeError('Room mode must be "pvp" or "pve".');
  }
  const matchMode = explicitMatchMode(value);
  if (mode === 'pve' && !matchModeDefinition(matchMode).pveSupported) {
    throw new TypeError('Skirmish does not support PvE until its base-elimination AI is accepted.');
  }
  const hasMapSeed = Object.hasOwn(value, 'mapSeed');
  const hasPolicySeed = Object.hasOwn(value, 'policySeed');
  if (Object.hasOwn(value, 'pregame') && (typeof value.pregame !== 'boolean' || mode !== 'pvp')) {
    throw new TypeError('Pregame must be a boolean for a PvP room.');
  }
  if (Object.hasOwn(value, 'practice') && (typeof value.practice !== 'boolean' || mode !== 'pvp')) {
    throw new TypeError('Practice must be a boolean for a PvP room.');
  }
  if (value.practice === true && value.pregame === true) {
    throw new TypeError('Practice starts with one player and cannot use the two-player pregame lobby.');
  }
  if (mode === 'pvp') {
    if (hasMapSeed || hasPolicySeed) {
      throw new TypeError('PvP rooms do not accept PvE seeds.');
    }
    return { mode, ...(value.pregame === true ? { pregame: true } : {}), ...(value.practice === true ? { practice: true } : {}), ...matchMode };
  }
  return {
    mode,
    ...matchMode,
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
    ...options,
    mapSeed: nextSeed(options.mapSeed),
    policySeed: nextSeed(options.policySeed),
  };
}

// Fresh admission is separate from saved launch/index normalization. Plain PvP
// rooms and one-human Practice retain authored access to internal Labs. Normal
// two-seat entry uses Skirmish; explicit Practice mode choices remain authoritative.
export function freshRoomLaunchOptions(value) {
  const options = normalizeRoomLaunchOptions(value);
  if (options.mode === 'pve') throw new TypeError(FRESH_PVE_UNAVAILABLE_REASON);
  return { ...options, ...(!hasMatchModeFields(options)
    ? options.pregame ? NORMAL_HUMAN_MATCH_MODE : normalizeMatchMode()
    : {}) };
}

export function buildRoomWorkerEnvironment(parentEnvironment, launchOptions, savedMetadata = null) {
  const options = normalizeRoomLaunchOptions(launchOptions);
  const environment = { ...parentEnvironment };
  for (const key of WORKER_LAUNCH_ENV_KEYS) delete environment[key];
  environment.RTS_GAME_MODE = options.mode;
  if (options.pregame) environment.RTS_PREGAME = '1';
  if (options.practice) environment.RTS_SOLO_PRACTICE = '1';
  if (hasMatchModeFields(options)) {
    environment.RTS_MATCH_MODE_ID = options.matchModeId;
    environment.RTS_MATCH_MODE_VERSION = String(options.matchModeVersion);
    if (options.mode === 'pvp') environment.RTS_MAP = `maps/${matchModeDefinition(options).defaultMapId}.json`;
  } else if (options.mode === 'pvp') {
    // Pre-migration rooms without checkpoint data retain their historical map.
    environment.RTS_MAP ||= 'maps/bellweather-millrace.json';
  }
  if (options.mode === 'pve') {
    if (options.mapSeed === undefined || options.policySeed === undefined) {
      throw new TypeError('PvE worker launch options require both seeds.');
    }
    environment.RTS_PVE_MAP_SEED = String(options.mapSeed);
    environment.RTS_PVE_POLICY_SEED = String(options.policySeed);
  }
  const metadata = normalizeRoomMetadata(savedMetadata);
  if (options.mode === 'pvp' && metadata) {
    environment.RTS_MAP = `maps/${metadata.mapId}.json`;
    if (hasMatchModeFields(metadata)) {
      environment.RTS_MATCH_MODE_ID = metadata.matchModeId;
      environment.RTS_MATCH_MODE_VERSION = String(metadata.matchModeVersion);
    }
  }
  return environment;
}

export function normalizeRoomMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const mapId = value.mapId;
  if (mapId === undefined || mapId === null) return null;
  if (typeof mapId !== 'string' || !MAP_ID_PATTERN.test(mapId)) return null;
  try { return { mapId, ...explicitMatchMode(value) }; }
  catch { return null; }
}

export function roomResponseMetadata(room) {
  const launchOptions = requireCompleteLaunchOptions(room.launchOptions);
  const roomMetadata = normalizeRoomMetadata(room);
  const matchMode = explicitMatchMode(hasMatchModeFields(roomMetadata) ? roomMetadata : launchOptions);
  return {
    launchOptions,
    ...matchMode,
    ...(roomMetadata ? { mapId: roomMetadata.mapId, roomMetadata: { ...roomMetadata, ...matchMode } } : {}),
  };
}

export function roomIndexDocument(rooms) {
  return {
    version: 3,
    rooms: rooms.map((room) => {
      const launchOptions = requireCompleteLaunchOptions(room.launchOptions);
      const roomMetadata = normalizeRoomMetadata(room);
      if ((room.mapId != null || hasMatchModeFields(room)) && !roomMetadata) {
        throw new TypeError('Invalid room metadata.');
      }
      return {
        id: room.id,
        createdAt: room.createdAt,
        lastActiveAt: room.lastActiveAt,
        launchOptions,
        ...(roomMetadata || {}),
      };
    }),
  };
}

export function normalizeRoomIndex(index) {
  if (!index || ![1, 2, 3].includes(index.version) || !Array.isArray(index.rooms)) return null;
  const seenIds = new Set();
  const rooms = [];
  for (const entry of index.rooms) {
    if (!entry || typeof entry !== 'object'
      || !ROOM_ID_PATTERN.test(entry.id || '')
      || !Number.isFinite(entry.createdAt)
      || !Number.isFinite(entry.lastActiveAt)
      || seenIds.has(entry.id)) return null;
    seenIds.add(entry.id);
    if (index.version < 3 && (hasMatchModeFields(entry) || hasMatchModeFields(entry.launchOptions)
      || hasMatchModeFields(entry.roomMetadata))) return null;
    let launchOptions;
    try {
      launchOptions = index.version === 1 ? { mode: 'pvp' } : requireCompleteLaunchOptions(entry.launchOptions);
    } catch {
      return null;
    }
    const roomMetadata = index.version >= 2 ? normalizeRoomMetadata(entry) : null;
    if (index.version >= 2 && (entry.mapId != null || hasMatchModeFields(entry)) && !roomMetadata) return null;
    rooms.push({
      id: entry.id,
      createdAt: entry.createdAt,
      lastActiveAt: entry.lastActiveAt,
      launchOptions,
      ...(roomMetadata || {}),
    });
  }
  return { version: 3, rooms };
}
