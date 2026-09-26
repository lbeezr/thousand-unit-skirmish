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
