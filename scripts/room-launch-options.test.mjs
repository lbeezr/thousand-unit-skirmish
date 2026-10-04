import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRoomWorkerEnvironment,
  completeRoomLaunchOptions,
  normalizeRoomIndex,
  normalizeRoomLaunchOptions,
  normalizeRoomMetadata,
  roomIndexDocument,
  roomResponseMetadata,
} from '../src/room-launch-options.mjs';

const roomId = 'a'.repeat(32);

test('room launch options default to PvP and validate PvE mode and uint32 seeds', () => {
  assert.deepEqual(normalizeRoomLaunchOptions(), { mode: 'pvp' });
  assert.deepEqual(normalizeRoomLaunchOptions({ mode: 'pve', mapSeed: '17', policySeed: 0 }), {
    mode: 'pve', mapSeed: 17, policySeed: 0,
  });
  let generatedSeed = 42;
  assert.deepEqual(completeRoomLaunchOptions({ mode: 'pve' }, () => generatedSeed++), {
    mode: 'pve', mapSeed: 42, policySeed: 43,
  });
  assert.throws(() => normalizeRoomLaunchOptions({ mode: 'coop' }), /pvp.*pve/);
  assert.throws(() => normalizeRoomLaunchOptions({ mode: 'pve', mapSeed: -1 }), /unsigned 32-bit/);
  assert.throws(() => normalizeRoomLaunchOptions({ mode: 'pve', policySeed: 0x1_0000_0000 }), /unsigned 32-bit/);
  assert.throws(() => normalizeRoomLaunchOptions({ mode: 'pvp', mapSeed: 4 }), /do not accept PvE seeds/);
  assert.throws(() => normalizeRoomLaunchOptions({ mode: 'pve', extra: true }), /Unknown room launch option/);
});

test('worker environment carries explicit launch mode and clears inherited PvE settings', () => {
  const inherited = {
    KEEP_ME: 'value', RTS_GAME_MODE: 'pve', RTS_PVE_MAP_SEED: '2', RTS_PVE_POLICY_SEED: '3',
  };
  assert.deepEqual(buildRoomWorkerEnvironment(inherited, { mode: 'pvp' }), {
    KEEP_ME: 'value', RTS_GAME_MODE: 'pvp',
  });
  assert.deepEqual(buildRoomWorkerEnvironment(inherited, {
    mode: 'pve', mapSeed: 2, policySeed: 3,
  }), {
    KEEP_ME: 'value', RTS_GAME_MODE: 'pve', RTS_PVE_MAP_SEED: '2', RTS_PVE_POLICY_SEED: '3',
  });
  assert.throws(() => buildRoomWorkerEnvironment(inherited, { mode: 'pve', mapSeed: 2 }), /both seeds/);
  assert.deepEqual(inherited.RTS_GAME_MODE, 'pve', 'parent environment is not mutated');
});

test('room index v3 persists complete options and migrates v1 rooms to PvP defaults', () => {
  const document = roomIndexDocument([{
    id: roomId, createdAt: 10, lastActiveAt: 20,
    launchOptions: { mode: 'pve', mapSeed: 17, policySeed: 23 }, mapId: 'woodland-expanse',
  }]);
  assert.equal(document.version, 3);
  assert.deepEqual(normalizeRoomIndex(document), document);
  assert.deepEqual(normalizeRoomIndex({
    version: 1, rooms: [{ id: roomId, createdAt: 10, lastActiveAt: 20 }],
  }), {
    version: 3,
    rooms: [{ id: roomId, createdAt: 10, lastActiveAt: 20, launchOptions: { mode: 'pvp' } }],
  });
  assert.equal(normalizeRoomIndex({ version: 2, rooms: [{ id: roomId, createdAt: 10, lastActiveAt: 20,
    launchOptions: { mode: 'pve', mapSeed: 17 } }] }), null, 'persisted PvE options require both seeds');
});

const authored = { matchModeId: 'authored', matchModeVersion: 1 };
const objective = { matchModeId: 'objective-control', matchModeVersion: 1 };
const skirmish = { matchModeId: 'skirmish', matchModeVersion: 1 };

test('explicit paired match modes preserve human launch settings and reject invalid identities', () => {
  for (const identity of [authored, objective, skirmish]) {
    for (const options of [{ mode: 'pvp', ...identity }, { mode: 'pvp', pregame: true, ...identity },
      { mode: 'pvp', practice: true, ...identity }]) {
      assert.deepEqual(normalizeRoomLaunchOptions(options), options);
      assert.deepEqual(completeRoomLaunchOptions(options), options);
    }
  }
  for (const invalid of [{ matchModeId: 'skirmish' }, { matchModeVersion: 1 },
    { matchModeId: 'unknown', matchModeVersion: 1 }, { ...skirmish, matchModeVersion: '1' },
    { ...skirmish, matchModeVersion: 2 }]) {
    assert.throws(() => normalizeRoomLaunchOptions(invalid), /Match mode requires both|Unsupported matchMode/);
  }
});

test('PvE rejects unsupported Skirmish before generating seeds and retains supported identities', () => {
  let generated = 0;
  assert.throws(() => completeRoomLaunchOptions({ mode: 'pve', ...skirmish }, () => generated++), /does not support PvE/);
  assert.equal(generated, 0);
  for (const identity of [authored, objective]) {
    let seed = 41;
    assert.deepEqual(completeRoomLaunchOptions({ mode: 'pve', ...identity }, () => seed++), {
      mode: 'pve', ...identity, mapSeed: 41, policySeed: 42,
    });
    assert.deepEqual(completeRoomLaunchOptions({ mode: 'pve', ...identity, mapSeed: 7, policySeed: 8 }), {
      mode: 'pve', ...identity, mapSeed: 7, policySeed: 8,
    });
  }
});

test('worker environment clears inherited mode identity and writes only explicit pairs', () => {
  const inherited = { KEEP_ME: 'yes', RTS_GAME_MODE: 'pve', RTS_MATCH_MODE_ID: 'skirmish',
    RTS_MATCH_MODE_VERSION: '88', RTS_SOLO_PRACTICE: '1', RTS_PREGAME: '1' };
  assert.deepEqual(buildRoomWorkerEnvironment(inherited, { mode: 'pvp' }), {
    KEEP_ME: 'yes', RTS_GAME_MODE: 'pvp',
  });
  assert.deepEqual(buildRoomWorkerEnvironment(inherited, { mode: 'pvp', practice: true, ...skirmish }), {
    KEEP_ME: 'yes', RTS_GAME_MODE: 'pvp', RTS_SOLO_PRACTICE: '1',
    RTS_MATCH_MODE_ID: 'skirmish', RTS_MATCH_MODE_VERSION: '1',
  });
  assert.deepEqual(buildRoomWorkerEnvironment(inherited, { mode: 'pve', mapSeed: 3, policySeed: 4, ...objective }), {
    KEEP_ME: 'yes', RTS_GAME_MODE: 'pve', RTS_PVE_MAP_SEED: '3', RTS_PVE_POLICY_SEED: '4',
    RTS_MATCH_MODE_ID: 'objective-control', RTS_MATCH_MODE_VERSION: '1',
  });
  assert.equal(inherited.RTS_MATCH_MODE_VERSION, '88');
});

test('worker metadata requires a valid map and complete known mode pair when explicit', () => {
  assert.deepEqual(normalizeRoomMetadata({ mapId: 'bellweather-millrace', ...skirmish }), {
    mapId: 'bellweather-millrace', ...skirmish,
  });
  for (const invalid of [{ ...skirmish }, { mapId: '../bad', ...skirmish },
    { mapId: 'bellweather-millrace', matchModeId: 'skirmish' },
    { mapId: 'bellweather-millrace', matchModeVersion: 1 },
    { mapId: 'bellweather-millrace', ...skirmish, matchModeVersion: 2 },
    { mapId: 'bellweather-millrace', matchModeId: 'unknown', matchModeVersion: 1 }]) {
    assert.equal(normalizeRoomMetadata(invalid), null);
  }
});

test('room API reports effective worker identity ahead of initial launch identity', () => {
  const launchOptions = Object.freeze({ mode: 'pvp', pregame: true, ...objective });
  assert.deepEqual(roomResponseMetadata({ launchOptions, mapId: 'bellweather-millrace', ...skirmish }), {
    launchOptions, mapId: 'bellweather-millrace', ...skirmish,
    roomMetadata: { mapId: 'bellweather-millrace', ...skirmish },
  });
  assert.deepEqual(roomResponseMetadata({ launchOptions }), { launchOptions, ...objective });
  assert.deepEqual(roomResponseMetadata({ launchOptions, mapId: 'bellweather-millrace' }), {
    launchOptions, mapId: 'bellweather-millrace', ...objective,
    roomMetadata: { mapId: 'bellweather-millrace', ...objective },
  });
  assert.deepEqual(launchOptions, { mode: 'pvp', pregame: true, ...objective });
});

test('index v3 independently round-trips initial and effective identity', () => {
  const room = { id: roomId, createdAt: 10, lastActiveAt: 20,
    launchOptions: { mode: 'pvp', pregame: true, ...objective },
    mapId: 'underbough-rootways', ...skirmish };
  const document = roomIndexDocument([room]);
  assert.deepEqual(document, { version: 3, rooms: [room] });
  assert.deepEqual(normalizeRoomIndex(document), document);
  for (const invalid of [{ ...room, matchModeVersion: 2 }, { ...room, mapId: null }]) {
    assert.equal(normalizeRoomIndex({ version: 3, rooms: [invalid] }), null);
    assert.throws(() => roomIndexDocument([invalid]), /Invalid room metadata/);
  }
  const partial = { ...room }; delete partial.matchModeVersion;
  assert.equal(normalizeRoomIndex({ version: 3, rooms: [partial] }), null);
});

test('legacy index versions migrate without inventing explicit mode fields', () => {
  const entry = { id: roomId, createdAt: 10, lastActiveAt: 20 };
  assert.deepEqual(normalizeRoomIndex({ version: 1, rooms: [entry] }), {
    version: 3, rooms: [{ ...entry, launchOptions: { mode: 'pvp' } }],
  });
  const legacyPve = { ...entry, launchOptions: { mode: 'pve', mapSeed: 4, policySeed: 8 },
    mapId: 'woodland-expanse' };
  assert.deepEqual(normalizeRoomIndex({ version: 2, rooms: [legacyPve] }), { version: 3, rooms: [legacyPve] });
  assert.deepEqual(normalizeRoomIndex({ version: 3, rooms: [legacyPve] }), { version: 3, rooms: [legacyPve] });
  for (const version of [1, 2]) {
    for (const invalid of [{ ...legacyPve, ...authored },
      { ...legacyPve, launchOptions: { ...legacyPve.launchOptions, ...objective } },
      { ...legacyPve, roomMetadata: { mapId: legacyPve.mapId, ...skirmish } }]) {
      assert.equal(normalizeRoomIndex({ version, rooms: [invalid] }), null);
    }
  }
  assert.equal(normalizeRoomIndex({ version: 4, rooms: [legacyPve] }), null);
});

test('worker room metadata only accepts a bounded map identifier', () => {
  assert.deepEqual(normalizeRoomMetadata({ mapId: 'woodland-expanse' }), { mapId: 'woodland-expanse' });
  assert.equal(normalizeRoomMetadata(null), null);
  assert.equal(normalizeRoomMetadata({ mapId: '../rooms' }), null);
  assert.equal(normalizeRoomMetadata({ mapId: 'x'.repeat(129) }), null);
  assert.deepEqual(roomResponseMetadata({
    launchOptions: { mode: 'pve', mapSeed: 17, policySeed: 23 }, mapId: 'woodland-expanse',
  }), {
    launchOptions: { mode: 'pve', mapSeed: 17, policySeed: 23 },
    mapId: 'woodland-expanse',
    roomMetadata: { mapId: 'woodland-expanse' },
  });
});

test('pregame opts in only PvP rooms and survives worker/index round trips', () => {
  const options = { mode: 'pvp', pregame: true };
  assert.deepEqual(completeRoomLaunchOptions(options), options);
  assert.deepEqual(normalizeRoomLaunchOptions({ pregame: false }), { mode: 'pvp' });
  assert.throws(() => normalizeRoomLaunchOptions({ mode: 'pve', pregame: true }));
  assert.throws(() => normalizeRoomLaunchOptions({ pregame: 'true' }));
  assert.equal(buildRoomWorkerEnvironment({ RTS_PREGAME: '1' }, { mode: 'pvp' }).RTS_PREGAME, undefined);
  assert.equal(buildRoomWorkerEnvironment({}, options).RTS_PREGAME, '1');
  const document = roomIndexDocument([{ id: roomId, createdAt: 1, lastActiveAt: 2, launchOptions: options }]);
  assert.deepEqual(normalizeRoomIndex(document), document);
});

test('practice is explicit, isolated from AI/pregame and survives room recovery', () => {
  const options = { mode: 'pvp', practice: true };
  assert.deepEqual(completeRoomLaunchOptions(options), options);
  assert.deepEqual(normalizeRoomLaunchOptions({ practice: false }), { mode: 'pvp' });
  for (const invalid of [{ mode: 'pve', practice: true }, { mode: 'pve', practice: false },
    { practice: 'true' }, { practice: true, pregame: true }]) {
    assert.throws(() => normalizeRoomLaunchOptions(invalid), /Practice|Practice starts/);
  }
  const inherited = { RTS_SOLO_PRACTICE: '1', RTS_PREGAME: '1' };
  assert.deepEqual(buildRoomWorkerEnvironment(inherited, options), { RTS_GAME_MODE: 'pvp', RTS_SOLO_PRACTICE: '1' });
  assert.equal(buildRoomWorkerEnvironment(inherited, { mode: 'pvp' }).RTS_SOLO_PRACTICE, undefined);
  assert.equal(buildRoomWorkerEnvironment(inherited, { mode: 'pvp', pregame: true }).RTS_SOLO_PRACTICE, undefined);
  assert.equal(buildRoomWorkerEnvironment(inherited, { mode: 'pve', mapSeed: 1, policySeed: 2 }).RTS_SOLO_PRACTICE, undefined);
  assert.deepEqual(inherited, { RTS_SOLO_PRACTICE: '1', RTS_PREGAME: '1' });
  const document = roomIndexDocument([{ id: roomId, createdAt: 1, lastActiveAt: 2, launchOptions: options }]);
  assert.deepEqual(normalizeRoomIndex(document), document);
  assert.deepEqual(roomResponseMetadata({ launchOptions: options }), { launchOptions: options });
});
