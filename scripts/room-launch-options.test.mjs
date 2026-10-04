import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRoomWorkerEnvironment,
  completeRoomLaunchOptions,
  freshRoomLaunchOptions,
  FRESH_PVE_UNSUPPORTED_REASON,
  normalizeRoomIndex,
  normalizeRoomLaunchOptions,
  normalizeRoomMetadata,
  roomIndexDocument,
  roomResponseMetadata,
} from '../src/room-launch-options.mjs';
import { normalizeMatchMode } from '../src/match-modes.mjs';
import { PVE_MAP_IDS, readPveLaunchOptions, selectPveMapId } from '../src/pve-match.mjs';

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
    KEEP_ME: 'value', RTS_GAME_MODE: 'pvp', RTS_MAP: 'maps/bellweather-millrace.json',
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
const bannerfall = { matchModeId: 'bannerfall', matchModeVersion: 1 };

test('Bannerfall human and Practice launches carry only explicit mode identity and preserve ordinary defaults', () => {
  const inherited = { KEEP_ME: 'yes', RTS_GAME_MODE: 'pve', RTS_PVE_MAP_SEED: '3', RTS_PVE_POLICY_SEED: '4',
    RTS_MATCH_MODE_ID: 'skirmish', RTS_MATCH_MODE_VERSION: '99', RTS_SOLO_PRACTICE: '1', RTS_PREGAME: '1' };
  const before = { ...inherited };
  for (const [options, expected] of [
    [{ mode: 'pvp', pregame: true, ...bannerfall }, { KEEP_ME: 'yes', RTS_GAME_MODE: 'pvp', RTS_PREGAME: '1',
      RTS_MATCH_MODE_ID: 'bannerfall', RTS_MATCH_MODE_VERSION: '1', RTS_MAP: 'maps/bannerfall-arena.json' }],
    [{ mode: 'pvp', practice: true, ...bannerfall }, { KEEP_ME: 'yes', RTS_GAME_MODE: 'pvp', RTS_SOLO_PRACTICE: '1',
      RTS_MATCH_MODE_ID: 'bannerfall', RTS_MATCH_MODE_VERSION: '1', RTS_MAP: 'maps/bannerfall-arena.json' }],
    [{ mode: 'pvp', ...bannerfall }, { KEEP_ME: 'yes', RTS_GAME_MODE: 'pvp',
      RTS_MATCH_MODE_ID: 'bannerfall', RTS_MATCH_MODE_VERSION: '1', RTS_MAP: 'maps/bannerfall-arena.json' }],
  ]) {
    assert.deepEqual(normalizeRoomLaunchOptions(options), options);
    assert.deepEqual(completeRoomLaunchOptions(options), options);
    assert.deepEqual(buildRoomWorkerEnvironment(inherited, options), expected);
    const room = { id: roomId, createdAt: 1, lastActiveAt: 2, launchOptions: options,
      mapId: 'bannerfall-arena', ...bannerfall };
    const index = roomIndexDocument([room]);
    assert.deepEqual(normalizeRoomIndex(index), index);
    assert.deepEqual(roomResponseMetadata(room), { launchOptions: options, mapId: 'bannerfall-arena',
      ...bannerfall, roomMetadata: { mapId: 'bannerfall-arena', ...bannerfall } });
  }
  assert.deepEqual(inherited, before);
  assert.deepEqual(normalizeRoomLaunchOptions(), { mode: 'pvp' });
  assert.deepEqual(buildRoomWorkerEnvironment(inherited, {}), {
    KEEP_ME: 'yes', RTS_GAME_MODE: 'pvp', RTS_MAP: 'maps/bellweather-millrace.json',
  });
  assert.throws(() => normalizeRoomLaunchOptions({ pregame: true, practice: true, ...bannerfall }), /Practice starts/);
});

test('Bannerfall rejects AI before seed generation with its own capability explanation', () => {
  let generated = 0;
  for (const options of [{ mode: 'pve', ...bannerfall }, { mode: 'pve', mapSeed: 3, policySeed: 4, ...bannerfall }]) {
    assert.throws(() => completeRoomLaunchOptions(options, () => generated++), error =>
      /Bannerfall supports human matches and Practice; its AI is not implemented/.test(error.message)
        && !/Skirmish|base-elimination/.test(error.message));
    assert.throws(() => buildRoomWorkerEnvironment({}, options), /Bannerfall.*AI is not implemented/);
  }
  assert.equal(generated, 0);
  assert.throws(() => normalizeRoomLaunchOptions({ matchModeId: 'bannerfall' }), /requires both/);
  assert.throws(() => normalizeRoomLaunchOptions({ ...bannerfall, matchModeVersion: 2 }), /Unsupported matchModeVersion/);
});

test('Bannerfall room preset overrides an inherited map while ordinary rooms retain it', () => {
  const inherited = { RTS_MAP: 'maps/bellweather-millrace.json' };
  assert.equal(buildRoomWorkerEnvironment(inherited, { mode: 'pvp', ...bannerfall }).RTS_MAP,
    'maps/bannerfall-arena.json');
  assert.equal(buildRoomWorkerEnvironment(inherited, { mode: 'pvp' }).RTS_MAP,
    'maps/bellweather-millrace.json');
  assert.deepEqual(inherited, { RTS_MAP: 'maps/bellweather-millrace.json' });
});

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

test('complete launch normalization accepts explicit Tiny Skirmish and preserves historical identities', () => {
  for (const identity of [authored, objective, skirmish]) {
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
    KEEP_ME: 'yes', RTS_GAME_MODE: 'pvp', RTS_MAP: 'maps/bellweather-millrace.json',
  });
  assert.deepEqual(buildRoomWorkerEnvironment(inherited, { mode: 'pvp', practice: true, ...skirmish }), {
    KEEP_ME: 'yes', RTS_GAME_MODE: 'pvp', RTS_SOLO_PRACTICE: '1',
    RTS_MATCH_MODE_ID: 'skirmish', RTS_MATCH_MODE_VERSION: '1',
    RTS_MAP: 'maps/veyrholds-terraced-vale.json',
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
  assert.deepEqual(buildRoomWorkerEnvironment(inherited, options), {
    RTS_GAME_MODE: 'pvp', RTS_SOLO_PRACTICE: '1', RTS_MAP: 'maps/bellweather-millrace.json',
  });
  assert.equal(buildRoomWorkerEnvironment(inherited, { mode: 'pvp' }).RTS_SOLO_PRACTICE, undefined);
  assert.equal(buildRoomWorkerEnvironment(inherited, { mode: 'pvp', pregame: true }).RTS_SOLO_PRACTICE, undefined);
  assert.equal(buildRoomWorkerEnvironment(inherited, { mode: 'pve', mapSeed: 1, policySeed: 2 }).RTS_SOLO_PRACTICE, undefined);
  assert.deepEqual(inherited, { RTS_SOLO_PRACTICE: '1', RTS_PREGAME: '1' });
  const document = roomIndexDocument([{ id: roomId, createdAt: 1, lastActiveAt: 2, launchOptions: options }]);
  assert.deepEqual(normalizeRoomIndex(document), document);
  assert.deepEqual(roomResponseMetadata({ launchOptions: options }), { launchOptions: options });
});

test('fresh pregame selects Skirmish while Practice and plain authoring select explicit Authored', () => {
  for (const [options, identity] of [[{ pregame: true }, skirmish], [{ mode: 'pvp', pregame: true }, skirmish],
    [{ practice: true }, authored], [{ mode: 'pvp', practice: true }, authored]]) {
    const before = structuredClone(options);
    assert.deepEqual(freshRoomLaunchOptions(options), { mode: 'pvp', ...options, ...identity });
    assert.deepEqual(options, before);
  }
  for (const options of [undefined, null, {}, { mode: 'pvp' }, { pregame: false }, { practice: false }]) {
    assert.deepEqual(freshRoomLaunchOptions(options), { mode: 'pvp', ...authored });
  }
  for (const identity of [authored, objective, skirmish]) {
    for (const options of [{ mode: 'pvp', ...identity }, { mode: 'pvp', pregame: true, ...identity },
      { mode: 'pvp', practice: true, ...identity }]) {
      assert.deepEqual(freshRoomLaunchOptions(options), options, 'explicit selections are retained');
    }
  }
  for (const options of [{ matchModeId: 'skirmish' }, { matchModeVersion: 1 },
    { ...skirmish, matchModeVersion: 2 }, { practice: true, pregame: true }]) {
    assert.throws(() => freshRoomLaunchOptions(options));
  }
});

test('fresh PvE chooses explicit Tiny Skirmish and keeps supplied seeds without mutating options', () => {
  for (const options of [{ mode: 'pve' }, { mode: 'pve', ...skirmish },
    { mode: 'pve', mapSeed: 0, policySeed: 0xffffffff }]) {
    const before = structuredClone(options);
    assert.deepEqual(freshRoomLaunchOptions(options), { ...options, ...skirmish });
    assert.deepEqual(options, before);
    let next = 41;
    const completed = completeRoomLaunchOptions(freshRoomLaunchOptions(options), () => next++);
    assert.deepEqual(completed, { mode: 'pve', ...skirmish,
      mapSeed: options.mapSeed ?? 41, policySeed: options.policySeed ?? 42 });
  }
});

test('fresh unsupported AI identities reject before seed completion while saved AI stays usable', () => {
  let generated = 0;
  for (const options of [{ mode: 'pve', ...authored }, { mode: 'pve', ...objective }]) {
    const before = structuredClone(options);
    assert.throws(() => completeRoomLaunchOptions(freshRoomLaunchOptions(options), () => generated++),
      error => error instanceof TypeError && error.message === FRESH_PVE_UNSUPPORTED_REASON);
    assert.deepEqual(options, before);
  }
  for (const invalid of [{ mode: 'pve', matchModeId: 'skirmish' },
    { mode: 'pve', ...skirmish, matchModeVersion: 2 },
    { mode: 'pve', mapId: 'veyrholds-threefold-basin' }]) {
    assert.throws(() => completeRoomLaunchOptions(freshRoomLaunchOptions(invalid), () => generated++));
  }
  assert.equal(generated, 0);
  assert.match(FRESH_PVE_UNSUPPORTED_REASON, /160 × 160 Terraced Vale.*Skirmish@1/);
  assert.match(FRESH_PVE_UNSUPPORTED_REASON, /Existing AI rooms can still be resumed/);
  const saved = { mode: 'pve', mapSeed: 0, policySeed: 0xffffffff };
  assert.deepEqual(completeRoomLaunchOptions(saved, () => generated++), saved);
  assert.equal(generated, 0, 'restoration keeps existing seeds');
});

test('explicit Tiny Skirmish ignores inherited maps and every seed preserves its supported preset', () => {
  const inherited = Object.freeze({ RTS_MAP: 'maps/veyrholds-threefold-basin.json', KEEP_ME: 'yes' });
  for (const mapSeed of [0, 1, 2, 0xfffffffe, 0xffffffff]) {
    const options = completeRoomLaunchOptions(freshRoomLaunchOptions({ mode: 'pve', mapSeed, policySeed: 17 }));
    const environment = buildRoomWorkerEnvironment(inherited, options, { mapId: 'underbough-rootways', ...authored });
    assert.equal(environment.RTS_MAP, 'maps/veyrholds-terraced-vale.json');
    assert.deepEqual(readPveLaunchOptions(environment), {
      mode: 'pve', mapSeed, policySeed: 17, mapId: 'veyrholds-terraced-vale',
    });
    const room = { id: roomId, createdAt: 1, lastActiveAt: 2, launchOptions: options,
      mapId: 'veyrholds-terraced-vale', ...skirmish };
    assert.deepEqual(normalizeRoomIndex(roomIndexDocument([room])).rooms[0], room);
    assert.equal(environment.KEEP_ME, 'yes');
  }
  assert.equal(inherited.RTS_MAP, 'maps/veyrholds-threefold-basin.json');
  for (const fields of [{ RTS_MATCH_MODE_ID: 'skirmish' }, { RTS_MATCH_MODE_VERSION: '1' },
    { RTS_MATCH_MODE_ID: 'skirmish', RTS_MATCH_MODE_VERSION: '2' },
    { RTS_MATCH_MODE_ID: 'skirmish', RTS_MATCH_MODE_VERSION: '1.0' }]) {
    assert.throws(() => readPveLaunchOptions({ RTS_GAME_MODE: 'pve', RTS_PVE_MAP_SEED: '0',
      RTS_PVE_POLICY_SEED: '17', ...fields }), /requires both|Unsupported matchMode/);
  }
});

test('legacy omitted identities stay Authored through normalization and all accepted index versions', () => {
  for (const options of [undefined, { mode: 'pvp' }, { mode: 'pvp', pregame: true },
    { mode: 'pvp', practice: true }, { mode: 'pve', mapSeed: 17, policySeed: 23 }]) {
    const normalized = normalizeRoomLaunchOptions(options);
    assert.deepEqual(normalizeMatchMode(normalized), authored);
    assert.equal(Object.hasOwn(normalized, 'matchModeId'), false);
    assert.equal(Object.hasOwn(normalized, 'matchModeVersion'), false);
  }
  const entry = { id: roomId, createdAt: 10, lastActiveAt: 20 };
  for (const version of [1, 2, 3]) {
    const room = version === 1 ? entry : { ...entry, launchOptions: { mode: 'pvp', pregame: true } };
    const normalized = normalizeRoomIndex({ version, rooms: [room] });
    assert.deepEqual(normalizeMatchMode(normalized.rooms[0].launchOptions), authored);
    assert.deepEqual(normalized.rooms[0].launchOptions,
      version === 1 ? { mode: 'pvp' } : { mode: 'pvp', pregame: true });
    assert.equal(Object.hasOwn(normalized.rooms[0], 'matchModeId'), false);
    assert.equal(Object.hasOwn(normalized.rooms[0], 'matchModeVersion'), false);
  }
});

test('fresh mode identity overrides inherited maps; omitted legacy identity preserves its historical map', () => {
  const parent = Object.freeze({ KEEP_ME: 'yes', RTS_MAP: 'maps/underbough-rootways.json',
    RTS_MATCH_MODE_ID: 'skirmish', RTS_MATCH_MODE_VERSION: '88' });
  for (const legacy of [{ mode: 'pvp' }, { mode: 'pvp', pregame: true }, { mode: 'pvp', practice: true }]) {
    const environment = buildRoomWorkerEnvironment(parent, legacy);
    assert.equal(environment.RTS_MAP, parent.RTS_MAP);
    assert.equal(environment.RTS_MATCH_MODE_ID, undefined);
    assert.equal(environment.RTS_MATCH_MODE_VERSION, undefined);
  }
  for (const [options, map] of [
    [{ pregame: true }, 'veyrholds-terraced-vale'],
    [{ practice: true }, 'veyrholds-terraced-vale'],
    [{}, 'veyrholds-terraced-vale'],
    [{ pregame: true, ...objective }, 'woodland-expanse'],
  ]) {
    const fresh = freshRoomLaunchOptions(options);
    const environment = buildRoomWorkerEnvironment(parent, fresh);
    assert.equal(environment.RTS_MAP, `maps/${map}.json`);
    assert.equal(environment.RTS_MATCH_MODE_ID, fresh.matchModeId);
    assert.equal(environment.RTS_MATCH_MODE_VERSION, '1');
    assert.equal(environment.KEEP_ME, 'yes');
  }
  const legacyAi = buildRoomWorkerEnvironment(parent, { mode: 'pve', mapSeed: 3, policySeed: 5, ...objective });
  assert.equal(legacyAi.RTS_MAP, parent.RTS_MAP, 'PvE restoration keeps its seed-owned map selection');
  assert.equal(readPveLaunchOptions(legacyAi).mapId, 'underbough-rootways');
  assert.equal(parent.RTS_MAP, 'maps/underbough-rootways.json');
});

test('legacy PvE seeds keep the exact curated map pool independently of fresh admission', () => {
  assert.deepEqual(PVE_MAP_IDS, ['bellweather-millrace', 'underbough-rootways']);
  for (const [seed, mapId] of [[0, 'bellweather-millrace'], [1, 'underbough-rootways'],
    [2, 'bellweather-millrace'], [0xfffffffe, 'bellweather-millrace'], [0xffffffff, 'underbough-rootways']]) {
    assert.equal(selectPveMapId(seed), mapId);
    const options = completeRoomLaunchOptions({ mode: 'pve', mapSeed: seed, policySeed: 17 });
    const entry = { id: roomId, createdAt: 10, lastActiveAt: 20, launchOptions: options, mapId };
    const restored = normalizeRoomIndex({ version: 2, rooms: [entry] }).rooms[0];
    assert.deepEqual(restored, entry);
    assert.deepEqual(normalizeMatchMode(restored.launchOptions), authored);
    const environment = buildRoomWorkerEnvironment({}, restored.launchOptions);
    assert.deepEqual(readPveLaunchOptions(environment), { mode: 'pve', mapSeed: seed, policySeed: 17, mapId });
  }
});

test('explicit historical Authored and Objective Control retain the exact direct seeded map pool', () => {
  for (const identity of [authored, objective]) {
    for (const [mapSeed, mapId] of [[0, 'bellweather-millrace'], [1, 'underbough-rootways'],
      [0xfffffffe, 'bellweather-millrace'], [0xffffffff, 'underbough-rootways']]) {
      const launch = Object.freeze({ mode: 'pve', ...identity, mapSeed, policySeed: 17 });
      const environment = buildRoomWorkerEnvironment({ RTS_MAP: 'maps/veyrholds-terraced-vale.json' }, launch);
      assert.deepEqual(readPveLaunchOptions(environment), { mode: 'pve', mapSeed, policySeed: 17, mapId });
      assert.deepEqual(normalizeRoomLaunchOptions(launch), launch);
      assert.equal(environment.RTS_MAP, 'maps/veyrholds-terraced-vale.json', 'historical PvE seeds still own selection');
    }
  }
});

test('verified saved map and effective identity override fresh defaults without mutating launch options', () => {
  const parent = Object.freeze({ RTS_MAP: 'maps/veyrholds-terraced-vale.json', KEEP_ME: 'yes' });
  const launch = Object.freeze({ mode: 'pvp', pregame: true, ...authored });
  const metadata = Object.freeze({ mapId: 'underbough-rootways', ...skirmish });
  assert.deepEqual(buildRoomWorkerEnvironment(parent, launch, metadata), {
    RTS_MAP: 'maps/underbough-rootways.json', KEEP_ME: 'yes', RTS_GAME_MODE: 'pvp', RTS_PREGAME: '1',
    RTS_MATCH_MODE_ID: 'skirmish', RTS_MATCH_MODE_VERSION: '1',
  });
  assert.deepEqual(launch, { mode: 'pvp', pregame: true, ...authored });
  assert.deepEqual(metadata, { mapId: 'underbough-rootways', ...skirmish });
  assert.deepEqual(parent, { RTS_MAP: 'maps/veyrholds-terraced-vale.json', KEEP_ME: 'yes' });
  assert.deepEqual(buildRoomWorkerEnvironment(parent, { mode: 'pvp' }, { mapId: 'stonepass-crossing' }), {
    RTS_MAP: 'maps/stonepass-crossing.json', KEEP_ME: 'yes', RTS_GAME_MODE: 'pvp',
  }, 'historical omitted identity remains omitted and therefore Authored');
  const legacyAi = buildRoomWorkerEnvironment(parent, { mode: 'pve', mapSeed: 0, policySeed: 17 }, metadata);
  assert.equal(legacyAi.RTS_MAP, parent.RTS_MAP);
  assert.equal(legacyAi.RTS_MATCH_MODE_ID, undefined);
  assert.deepEqual(readPveLaunchOptions(legacyAi), {
    mode: 'pve', mapSeed: 0, policySeed: 17, mapId: 'bellweather-millrace',
  }, 'saved metadata cannot replace seed-owned PvE launch semantics');
  for (const invalid of [{ mapId: '../bad', ...skirmish },
    { mapId: 'underbough-rootways', matchModeId: 'skirmish' },
    { mapId: 'underbough-rootways', ...skirmish, matchModeVersion: 2 }]) {
    assert.deepEqual(buildRoomWorkerEnvironment(parent, launch, invalid), buildRoomWorkerEnvironment(parent, launch),
      'invalid metadata does not partially apply a map or identity');
  }
});
