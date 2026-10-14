import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { identifySurroundSource, reachableEdgeGoals, SURROUND_FILES, SURROUND_MAP_ID,
  validateSurroundFrame } from './renderer-battlefield-surround-staging.mjs';
import { STAGING_ORIGIN } from './renderer-roster-audio-plan.mjs';

const revision = 'a'.repeat(40);
test('source receipt matches immutable public GitHub and fixed staging bytes for every setting file', async () => {
  const requests = [];
  const fetcher = async (url, options) => {
    requests.push(url); assert.equal(options.redirect, 'error'); assert.equal(options.credentials, 'omit');
    assert.ok(options.signal instanceof AbortSignal);
    const file = url.startsWith(STAGING_ORIGIN) ? url.slice(STAGING_ORIGIN.length + 1) : url.split(`${revision}/`)[1];
    assert.ok(SURROUND_FILES.includes(file)); return new Response(file);
  };
  const receipt = await identifySurroundSource(revision, fetcher);
  assert.equal(receipt.expectedRevision, revision); assert.equal(receipt.files.length, SURROUND_FILES.length);
  assert.equal(requests.length, SURROUND_FILES.length * 2);
  assert.ok(receipt.files.every(f => /^[a-f0-9]{64}$/.test(f.sha256) && f.bytes > 0));
  for (const file of SURROUND_FILES) {
    assert.ok(requests.includes(`${STAGING_ORIGIN}/${file}`));
    assert.ok(requests.includes(`https://raw.githubusercontent.com/lbeezr/thousand-unit-skirmish/${revision}/${file}`));
  }
});
test('source receipt rejects changed staging, unavailable files, oversized streams and malformed revisions', async () => {
  await assert.rejects(identifySurroundSource('main', () => assert.fail('must not fetch')));
  await assert.rejects(identifySurroundSource(revision, async url => new Response(url.startsWith(STAGING_ORIGIN) ? 'changed' : 'source')));
  await assert.rejects(identifySurroundSource(revision, async () => new Response('missing', { status: 404 })));
  await assert.rejects(identifySurroundSource(revision, async () => new Response(new Uint8Array(2000000))));
});
test('reachable edge goals respect cliff isolation, blocked cells and validated world coordinates', () => {
  const map = { id: SURROUND_MAP_ID, width: 160, height: 160, obstacles: [], elevationPatches: [
    { column: 4, row: 4, width: 152, height: 152, level: 2 },
  ] };
  assert.deepEqual(reachableEdgeGoals(map, { x: 0, z: 0 }), [], 'two-level cliff disconnects the edge');
  map.elevationPatches = [];
  map.obstacles = [{ column: 0, row: 0, width: 4, height: 160 }];
  const goals = reachableEdgeGoals(map, { x: 0, z: 0 });
  assert.equal(goals.length, 32);
  assert.ok(goals.every(g => g.x >= -75.5 && Math.min(80 - Math.abs(g.x), 80 - Math.abs(g.z)) <= 3.5));
  for (const point of [{ x: NaN, z: 0 }, { x: 80, z: 0 }, { x: -81, z: 100 }, { x: -79, z: 0 }]) {
    assert.throws(() => reachableEdgeGoals(map, point));
  }
});
test('real Terraced Vale offers deterministic reachable native destinations for both spawns without map writes', async () => {
  const map = JSON.parse(await readFile(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url)));
  const before = JSON.stringify(map);
  for (const spawn of map.spawnPoints) {
    const goals = reachableEdgeGoals(map, spawn);
    assert.ok(goals.length > 0); assert.deepEqual(goals, reachableEdgeGoals(map, spawn));
    assert.ok(goals.every(g => g.steps > 0));
  }
  assert.equal(JSON.stringify(map), before);
});
const view = () => ({ mapId: SURROUND_MAP_ID, team: 0, tick: 12, boot: 'ready', socketState: 1,
  recovering: false, viewport: { width: 1280, height: 720, dpr: 1 },
  graphics: { version: 'WebGL 2.0 (OpenGL ES 3.0 Chromium)', lost: false, error: 0 } });
const png = () => {
  const bytes = Buffer.alloc(10001); Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes);
  bytes.writeUInt32BE(1280, 16); bytes.writeUInt32BE(720, 20); return bytes;
};
test('frame acceptance requires live advancing real map, sandbox-qualified WebGL2 and exact viewport PNG dimensions', () => {
  validateSurroundFrame(view(), SURROUND_MAP_ID, png(), 11);
  for (const change of [{ mapId: 'authored-meadow' }, { team: null }, { tick: 11 }, { boot: 'failed' },
    { socketState: 3 }, { recovering: true }, { graphics: { version: 'WebGL 1.0', lost: false, error: 0 } },
    { graphics: { version: 'WebGL 2.0', lost: true, error: 0 } },
    { graphics: { version: 'WebGL 2.0', lost: false, error: 1282 } },
    { viewport: { width: 1280, height: 720, dpr: 2 } }]) {
    assert.throws(() => validateSurroundFrame({ ...view(), ...change }, SURROUND_MAP_ID, png(), 11));
  }
  const wrong = png(); wrong.writeUInt32BE(640, 16);
  assert.throws(() => validateSurroundFrame(view(), SURROUND_MAP_ID, wrong, 11));
});
