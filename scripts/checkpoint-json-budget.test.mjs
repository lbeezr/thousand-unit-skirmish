import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { CheckpointJsonScan } from '../src/server/checkpoint-json-scan.mjs';
import { inspectCheckpointJson, preflightXlCheckpointState, preflightXlCheckpointCloneInputs,
  XL_CHECKPOINT_JSON_LIMITS as limits } from '../src/server/checkpoint-json-budget.mjs';
import { readMatchCheckpointFile } from '../src/server/checkpoint-file-reader.mjs';
import { createPveHeadlessFixture } from './pve-headless-fixture.mjs';
import './checkpoint-json-budget-audit.test.mjs';
import './checkpoint-file-recovery.test.mjs';

const records = { maxUnits: 2000, maxBuildings: 128, maxResourceNodes: 128 };
function scan(serialized, chunk = 13) {
  const inspector = new CheckpointJsonScan();
  for (let i = 0; i < serialized.length; i += chunk) inspector.push(serialized.slice(i, i + chunk));
  return inspector.finish();
}

test('byte accounting matches native compact JSON, including UTF-8 and escaped/unpaired surrogates', () => {
  for (const value of [null, [undefined, -0, 1e-25, Number.MAX_VALUE, true, false],
    { a: undefined, b: '\u0000\n\b\t\v\f\r"\\😀é中\ud800', child: [1, {}] },
    Object.assign(Object.create(null), { x: 1 })])
    assert.equal(inspectCheckpointJson(value).bytes, Buffer.byteLength(JSON.stringify(value)));
});

test('metadata inspection honors escaped keys, order, duplicates, nesting and every byte boundary', () => {
  const cases = [
    '{"state":{"mapDefinition":{"width":320,"height":320}},"mapDefinition":{"width":256,"height":256}}',
    '{"state":{"text":"\\\"mapDefinition\\\":{}😀"},"mapDefinition":{"width":320,"height":160}}',
    '{"mapDefinition":{"width":320,"height":320},"mapDefinition":{"width":256,"height":256}}',
    '{"mapDefinition":{"width":256,"height":256},"mapDefinition":{"width":320,"height":320}}',
    '{"mapDefinition":{"width":320,"width":256,"height":256}}',
    '{"m\\u0061pDefinition":{"w\\u0069dth":25.6e1,"height":0.256e3}}',
    '{"mapDefinition":{"width":256,"height":256},"mapDefinition":null}',
    '{"mapDefinition":{"width":256,"height":256},"mapDefinition":"invalid"}',
  ];
  for (const text of cases) {
    const d = JSON.parse(text).mapDefinition;
    const expected = !!d && d.width >= 16 && d.width <= 256 && d.height >= 16 && d.height <= 256;
    for (const chunk of [1, 2, 3, 7, 31, 32768]) assert.equal(scan(text, chunk).legacyCandidate, expected, text);
  }
});

test('all admitted integer dimensions classify correctly through scientific/long-zero numeric encodings', () => {
  for (let width = 16; width <= 320; width++) for (const literal of [String(width), `${width}e0`, `${width}000e-3`,
    `${width}.0000000000000000000000000000000000`, `${width}e${'0'.repeat(100)}`]) {
    const text = `{"mapDefinition":{"width":${literal},"height":256}}`;
    assert.equal(JSON.parse(text).mapDefinition.width, width);
    assert.equal(scan(text).legacyCandidate, width <= 256, literal);
  }
});

test('independent seeded JSON trees match JSON.parse effective dimensions across chunk boundaries', () => {
  let seed = 81005;
  const next = () => { seed = Math.imul(seed, 1664525) + 1013904223 >>> 0; return seed; };
  function tree(depth = 0) {
    const type = next() % (depth < 5 ? 6 : 4);
    if (type === 0) return null;
    if (type === 1) return next();
    if (type === 2) return ['😀', '"{}[],:\\', '\n\u0000', 'mapDefinition', 'width'][next() % 5];
    if (type === 3) return Boolean(next() % 2);
    if (type === 4) return Array.from({ length: next() % 5 }, () => tree(depth + 1));
    return Object.fromEntries(Array.from({ length: next() % 5 }, (_, i) => [`k${i}`, tree(depth + 1)]));
  }
  for (let i = 0; i < 2000; i++) {
    const width = [160, 192, 224, 256, 257, 320][next() % 6], height = [160, 256, 320][next() % 3];
    const data = tree(), map = { width, height }, text = i % 2
      ? JSON.stringify({ state: data, mapDefinition: map }) : JSON.stringify({ mapDefinition: map, state: data });
    const parsed = JSON.parse(text);
    assert.equal(scan(text, next() % 40 + 1).legacyCandidate,
      parsed.mapDefinition.width <= 256 && parsed.mapDefinition.height <= 256);
    assert.equal(inspectCheckpointJson(parsed).bytes, Buffer.byteLength(JSON.stringify(parsed)));
  }
});

test('depth/member/array/string/scalar guards reject before JSON parsing and preserve legacy classification', () => {
  const bodies = [
    ['depth', '['.repeat(20) + '0' + ']'.repeat(20)],
    ['member', JSON.stringify(Object.fromEntries(Array.from({ length: 129 }, (_, i) => [`k${i}`, 0])))],
    ['array', `[${'0,'.repeat(limits.arrayEntries)}0]`],
    ['string', JSON.stringify('a'.repeat(limits.stringUnits + 1))],
    ['scalar token', `1e${'0'.repeat(100)}`],
  ];
  for (const [reason, body] of bodies) for (const width of [256, 320]) {
    const text = `{"state":${body},"mapDefinition":{"width":${width},"height":256}}`, result = scan(text, 32768);
    assert.equal(result.legacyCandidate, width === 256);
    assert.match(result.violation, new RegExp(reason));
    if (width === 320 && reason !== 'scalar token') assert.throws(() => inspectCheckpointJson(JSON.parse(text)), /XL JSON budget/);
  }
});

test('live and full-state guards reject non-route volume before clone/validation while legacy is untouched', () => {
  const xl = { width: 320, height: 320 }, state = { units: [], buildings: [], resourceNodes: [], forestStocks: [] };
  const s = { mapDefinition: xl, state };
  assert.ok(preflightXlCheckpointState(s, records));
  assert.throws(() => preflightXlCheckpointState({ ...s, state: { ...state, buildings: Array(129) } }, records), /invalid buildings table/);
  const unit = { path: [], attackMoveResumePath: null, queuedWaypoints: [], workIntent: { extra: 'x'.repeat(limits.stringUnits + 1) } };
  assert.throws(() => preflightXlCheckpointCloneInputs(xl, { units: [unit], buildings: [], resourceNodes: new Map() }, records), /string quota/);
  assert.equal(preflightXlCheckpointCloneInputs({ width: 256, height: 256 }, { units: [unit] }, records), null);
  assert.equal(preflightXlCheckpointState({ mapDefinition: { width: 256, height: 256 }, state: { extra: unit } }, records), null);
  const cyclic = {}; cyclic.self = cyclic;
  for (const value of [cyclic, { value: Infinity }, { toJSON() { return {}; } }, Array(1), new Date()])
    assert.throws(() => inspectCheckpointJson(value), /XL JSON budget/);
});

test('compact byte quota is inclusive and rejects one extra byte without serialization', () => {
  const value = { fill: Array(128).fill('x'.repeat(limits.stringUnits)) };
  const overhead = Buffer.byteLength(JSON.stringify({ fill: Array(128).fill('') }));
  value.fill[127] = 'x'.repeat(limits.bytes - overhead - 127 * limits.stringUnits);
  assert.equal(inspectCheckpointJson(value).bytes, limits.bytes);
  value.fill[127] += 'x';
  assert.throws(() => inspectCheckpointJson(value), /compact byte quota/);
});

test('value and container quotas reject distributed collections even when each array fits', () => {
  function nested(entries, groups, empty) {
    const chunks = [], per = Math.floor(entries / groups);
    for (let i = 0; i < groups; i++) {
      const length = per + (i < entries % groups ? 1 : 0), element = empty ? '[]' : '0';
      chunks.push(`[${`${element},`.repeat(length - 1)}${element}]`);
    }
    return `{"mapDefinition":{"width":320,"height":320},"padding":[${chunks.join(',')}]}`;
  }
  for (const extra of [-1, 0, 1]) for (const [role, text] of [
    ['value', nested(limits.values - 5 - 64 + extra, 64, false)],
    ['container', nested(limits.containers - 3 - 3 + extra, 3, true)],
  ]) {
    const result = scan(text, 32768);
    if (extra > 0) {
      assert.match(result.violation, new RegExp(role));
      assert.throws(() => inspectCheckpointJson(JSON.parse(text)), new RegExp(role));
    } else {
      assert.equal(result.violation, null); assert.ok(inspectCheckpointJson(JSON.parse(text)));
    }
  }
});

test('real file reader bounds XL before parse; preserves byte-identical legacy files beyond the new32MiB cap', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'rts-json-budget-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'match.json');
  async function padded(width, extra = 1) {
    const prefix = `{"mapDefinition":{"width":${width},"height":256}}`;
    const handle = await open(file, 'w');
    try {
      await handle.write(prefix); const chunk = ' '.repeat(32768);
      let remaining = limits.bytes + extra - prefix.length;
      while (remaining > 0) { const n = Math.min(remaining, chunk.length); await handle.write(chunk.slice(0, n)); remaining -= n; }
    } finally { await handle.close(); }
    return limits.bytes + extra;
  }
  assert.equal((await readMatchCheckpointFile(await (async () => { await writeFile(file, '{"mapDefinition":{"width":320,"height":320}}'); return file; })())).length, 44);
  await padded(320, 0);
  assert.equal((await readMatchCheckpointFile(file)).length, limits.bytes);
  await padded(320);
  await assert.rejects(() => readMatchCheckpointFile(file), /file byte quota before parse/);
  const length = await padded(256), original = await readMatchCheckpointFile(file);
  assert.equal(original.length, length); assert.equal(JSON.parse(original).mapDefinition.width, 256);
  assert.equal(await readFile(file, 'utf8'), original);
  for (const body of ['{"mapDefinition":{"width":320,"height":320},"state":' + '['.repeat(20) + '0' + ']'.repeat(20) + '}',
    '{"mapDefinition":{"width":320,"height":320},"state":{"x":' + JSON.stringify('a'.repeat(limits.stringUnits + 1)) + '}}']) {
    await writeFile(file, body); await assert.rejects(() => readMatchCheckpointFile(file), /before parse/);
    assert.equal(await readFile(file, 'utf8'), body, 'reader leaves rejected bytes intact');
  }
});

test('actual restore runs the non-route state budget before map allocation and preserves admitted saves', async t => {
  const map = { id: 'checkpoint-state-budget-test', name: 'State budget test', width: 256, height: 256,
    terrainSeed: 17, fogOfWar: true, obstacles: [], resourceNodes: [],
    spawnPoints: [{ team: 0, x: -20.5, z: .5 }, { team: 1, x: 20.5, z: .5 }],
    startingArmySize: 24, startingResources: { food: 150, wood: 250 }, triggers: [], scenarioEvents: [] };
  const fixture = await createPveHeadlessFixture(map); t.after(() => fixture.dispose());
  const saved = fixture.replay.checkpoint(), invalid = structuredClone(saved);
  invalid.mapDefinition.width = 320; invalid.state.forestStocks = Array(102401);
  assert.throws(() => fixture.replay.restore(invalid), /invalid forestStocks table/);
  assert.deepEqual(fixture.replay.checkpoint(), saved);
  const legacy = structuredClone(saved); legacy.state.units[0].compatPadding = 'x'.repeat(limits.stringUnits + 1);
  fixture.replay.restore(legacy);
  assert.equal(fixture.replay.checkpoint().state.units[0].compatPadding, legacy.state.units[0].compatPadding);
});
