import assert from 'node:assert/strict';
import test from 'node:test';
import { open, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { XL_CHECKPOINT_JSON_LIMITS as limits } from '../src/server/checkpoint-json-budget.mjs';

test('real paid Large256 cold recovery admits untouched state beyond XL byte cap; bad XL files are preserved', async t => {
  const room = await createFortifiedFixture({ mapPath: 'maps/veyrholds-crownroads.json', matchModeId: 'skirmish', timeoutMs: 20000 });
  t.after(() => room.dispose());
  await room.start();
  let clients = [await room.connect(0), await room.connect(1)];
  const openingWood = clients.map((c, team) => c.latest.wood[team]);
  const tokens = clients.map(c => c.welcome.player.sessionToken), sites = [];
  for (const [team, client] of clients.entries()) {
    const worker = client.latest.units.find(u => u[1] === team && u[5] === 'worker');
    const home = client.welcome.map.spawnPoints.find(p => p.team === team);
    await client.command({ type: 'build', ids: [worker[0]], buildingType: 'house',
      x: home.x + (team === 0 ? 8 : -8), z: home.z + 8 }, /HOUSE/);
    await client.state(s => s.buildings.some(b => b.team === team && b.type === 'house'), 'paid House visible');
    sites.push(client.latest.buildings.find(b => b.team === team && b.type === 'house').id);
  }
  await room.stop();
  const savedBytes = await readFile(room.checkpointPath, 'utf8'), saved = JSON.parse(savedBytes);
  assert.ok(saved.state.teamWood.every((wood, team) => wood < openingWood[team]), 'both foundations were actually paid');
  const handle = await open(room.checkpointPath, 'a');
  try {
    const chunk = ' '.repeat(32768); let remaining = limits.bytes + 1 - Buffer.byteLength(savedBytes);
    while (remaining > 0) { const n = Math.min(remaining, chunk.length); await handle.write(chunk.slice(0, n)); remaining -= n; }
  } finally { await handle.close(); }
  assert.deepEqual(JSON.parse(await readFile(room.checkpointPath, 'utf8')), saved, 'padding changes no persisted state');
  await room.start(); clients = [await room.connect(0, tokens[0]), await room.connect(1, tokens[1])];
  for (const [team, client] of clients.entries()) {
    assert.equal(client.welcome.recoveredFromCheckpoint, true);
    assert.equal(client.latest.matchId, saved.matchId);
    assert.equal(client.latest.wood[team], saved.state.teamWood[team]);
    assert.ok(client.latest.buildings.some(b => b.id === sites[team] && b.type === 'house'));
  }
  await room.stop();
  const resumed = JSON.parse(await readFile(room.checkpointPath, 'utf8'));
  assert.equal(resumed.schemaVersion, saved.schemaVersion); assert.equal(resumed.mapHash, saved.mapHash);
  assert.equal(resumed.matchId, saved.matchId);
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  for (const [label, mutate, message, serialize = JSON.stringify] of [
    ['string before parse', s => { s.extra = 'x'.repeat(limits.stringUnits + 1); }, /XL JSON budget exceeds string quota before parse/],
    ['route aggregate before restore', s => { for (let i = 0; i < 11; i++) s.state.units[i].path = Array(102400).fill(0); }, /XL route budget exceeds aggregate cell entries/],
    ['malformed route', s => { s.state.units[0].path = [null]; }, /XL route budget invalid cell index/],
    ['truncated JSON', () => {}, /(Expected|Unexpected).*JSON/, s => JSON.stringify(s).slice(0, -1)],
  ]) {
    const invalid = structuredClone(resumed); invalid.mapDefinition.width = invalid.mapDefinition.height = 320; mutate(invalid);
    const bytes = serialize(invalid), oldRejected = new Set(await readdir(room.directory));
    await writeFile(room.checkpointPath, bytes); await room.start();
    const fresh = await room.connect(0); assert.equal(fresh.welcome.recoveredFromCheckpoint, false, label);
    assert.notEqual(fresh.latest.matchId, saved.matchId, label); assert.match(room.logs, message, label);
    const rejected = (await readdir(room.directory)).find(f => f.startsWith('match.json.rejected-') && !oldRejected.has(f));
    assert.ok(rejected, label);
    assert.equal(digest(await readFile(path.join(room.directory, rejected))), digest(bytes), 'bad save preserved byte-for-byte');
    await room.stop();
  }
});
