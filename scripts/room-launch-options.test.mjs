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

test('room index v2 persists complete options and migrates v1 rooms to PvP defaults', () => {
  const document = roomIndexDocument([{
    id: roomId, createdAt: 10, lastActiveAt: 20,
    launchOptions: { mode: 'pve', mapSeed: 17, policySeed: 23 }, mapId: 'woodland-expanse',
  }]);
  assert.equal(document.version, 2);
  assert.deepEqual(normalizeRoomIndex(document), document);
  assert.deepEqual(normalizeRoomIndex({
    version: 1, rooms: [{ id: roomId, createdAt: 10, lastActiveAt: 20 }],
  }), {
    version: 2,
    rooms: [{ id: roomId, createdAt: 10, lastActiveAt: 20, launchOptions: { mode: 'pvp' } }],
  });
  assert.equal(normalizeRoomIndex({ version: 2, rooms: [{ id: roomId, createdAt: 10, lastActiveAt: 20,
    launchOptions: { mode: 'pve', mapSeed: 17 } }] }), null, 'persisted PvE options require both seeds');
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
