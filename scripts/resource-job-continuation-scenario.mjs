import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { woodJobMap, woodJobTarget, woodDraw } from './resource-job-fixture.mjs';

const entrypointPath = process.argv.find(arg => arg.startsWith('--entrypoint='))?.slice(13) || null;
const expected = process.argv.includes('--expect-stops') ? 'stops' : 'continues';
const root = entrypointPath ? path.dirname(entrypointPath) : fileURLToPath(new URL('..', import.meta.url));
function sourceIdentity() {
  const git = args => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  const files = git(['ls-files', 'server.mjs', 'src', 'maps', 'scripts/resource-job*', 'scripts/fortified-crossing-fixture.mjs']).split('\n').filter(Boolean);
  return { sourceRevision: git(['rev-parse', 'HEAD']), sourceDirty: !!git(['status', '--porcelain']),
    sourceFiles: files.map(file => ({ path: file, sha256: createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex') })) };
}
const frozenSource = sourceIdentity();
const reports = [];
for (const kind of ['forest', 'node']) {
  const room = await createFortifiedFixture({ mapPath: 'maps/stone-defense-field.json', entrypointPath, timeoutMs: 30_000 });
  try {
    await room.start(); let client = await room.connect(0); const peer = await room.connect(1);
    const tokens = [client.welcome.player.sessionToken, peer.welcome.player.sessionToken];
    const map = woodJobMap(kind);
    let after = client.messages.length;
    client.send({ type: 'publishMap', map, persist: true });
    const publication = await client.wait(m => ['mapRejected', 'mapPublished'].includes(m.type), 'regression map publication', after);
    assert.equal(publication.type, 'mapPublished', publication.message);
    await client.state(s => s.mapId === map.id);
    const target = woodJobTarget(kind);
    await client.command({ type: 'gather', ids: [0], ...target, clientOrderToken: 1 }, /GATHER ORDER/);
    const cut = await room.checkpoint(s => kind === 'forest'
      ? s.state.forestStocks.some(([cell, stock]) => cell === target.forestCell && stock === 0)
      : s.state.resourceNodes.find(n => n.id === target.nodeId).stock === 0);
    let recovered = false, recoveryTick = null, recoverySequence = null;
    if (expected === 'continues') {
      const originalAnchor = kind === 'forest' ? { x: -11.5, z: .5 } : { x: -11.5, z: 5.5 };
      assert.deepEqual(cut.state.units[0].workIntent.anchor, originalAnchor);
      await room.stop(); // Flush the actual untouched match before a fresh process.
      const saved = JSON.parse(await readFile(room.checkpointPath, 'utf8'));
      await room.start(); client = await room.connect(0, tokens[0]); await room.connect(1, tokens[1]);
      assert.equal(client.welcome.recoveredFromCheckpoint, true);
      const restored = await room.checkpoint(s => s.sequence > saved.sequence
        && s.state.tickNumber >= saved.state.tickNumber);
      assert.deepEqual(restored.state.units[0].workIntent, saved.state.units[0].workIntent);
      assert.deepEqual(restored.state.units[0].workIntent.anchor, originalAnchor);
      recovered = true; recoveryTick = restored.state.tickNumber;
      recoverySequence = { saved: saved.sequence, restored: restored.sequence };
    }
    const banked = await client.state(s => s.wood[0] >= 106, 'actual six wood delivery');
    const observedTick = banked.tick + 90;
    const current = await room.checkpoint(s => s.state.tickNumber >= observedTick
      && (expected === 'stops' || (s.state.units[0].cargo === 0 && s.state.units[0].gatherPhase === '')));
    const worker = current.state.units[0];
    const otherConsumed = kind === 'forest'
      ? current.state.forestStocks.some(([cell, stock]) => cell !== target.forestCell && stock < 6)
      : current.state.resourceNodes.find(n => n.id === 'next-tree').stock < 6;
    assert.equal(otherConsumed, expected === 'continues');
    if (expected === 'stops') assert.equal(worker.gatherPhase, '');
    if (kind === 'node') {
      assert.equal(current.state.resourceNodes.find(n => n.id === 'near-food').stock, 6);
      assert.equal(current.state.resourceNodes.find(n => n.id === 'far-tree').stock, 6);
    }
    const consumed = woodDraw(current.state, map);
    const cargo = current.state.units.reduce((sum, u) => sum + (u.cargoType === 'wood' ? u.cargo : 0), 0);
    assert.ok(Math.abs(consumed - (current.state.teamWood[0] - 100) - cargo) < 1e-4, 'finite wood conservation');
    if (expected === 'continues') {
      assert.equal(current.state.teamWood[0], kind === 'forest' ? 118 : 112);
      assert.equal(worker.workIntent, null, 'finite area ends without an automatic retry');
    }
    reports.push({ kind, expected, recovered, recoveryTick, recoverySequence, cutTick: cut.state.tickNumber, tick: current.state.tickNumber,
      wood: current.state.teamWood[0], cargo, consumed, otherConsumed,
      worker: { gatherForestCell: worker.gatherForestCell, gatherNodeId: worker.gatherNodeId, gatherPhase: worker.gatherPhase }, dimensions: [160, 160] });
  } finally { await room.dispose(); }
}
assert.deepEqual(sourceIdentity(), frozenSource, 'source remains frozen throughout native evidence');
const report = { ...frozenSource, nodeVersion: process.version, evidenceType: 'local-native-source-replay', deployedObservation: false, reports };
const output = process.argv.find(arg => arg.startsWith('--output='))?.slice(9);
if (output) await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report, null, 2));
