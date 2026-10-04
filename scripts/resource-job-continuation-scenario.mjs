import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';

const entrypointPath = process.argv.find(arg => arg.startsWith('--entrypoint='))?.slice(13) || null;
const expected = process.argv.includes('--expect-stops') ? 'stops' : 'continues';
const reports = [];
for (const kind of ['forest', 'node']) {
  const room = await createFortifiedFixture({ mapPath: 'maps/stone-defense-field.json', entrypointPath, timeoutMs: 30_000 });
  try {
    await room.start(); const client = await room.connect(0); await room.connect(1);
    const map = { id: `wood-job-${kind}`, name: 'Wood job regression', width: 160, height: 160,
      startingArmySize: 8, startingResources: { wood: 100, food: 100 }, fogOfWar: false,
      spawnPoints: [{ team: 0, x: -14, z: 0 }, { team: 1, x: 14, z: 0 }],
      obstacles: kind === 'forest' ? [{ column: 68, row: 79, width: 1, height: 3, material: 'forest' }] : [],
      resourceNodes: kind === 'node' ? [{ id: 'first-tree', type: 'wood', x: -11.5, z: 5.5, stock: 6 },
        { id: 'next-tree', type: 'wood', x: -10.5, z: 5.5, stock: 6 },
        { id: 'near-food', type: 'food', x: -10.5, z: 6.5, stock: 6 },
        { id: 'far-tree', type: 'wood', x: 0.5, z: 5.5, stock: 6 }] : [], triggers: [], scenarioEvents: [] };
    let after = client.messages.length;
    client.send({ type: 'publishMap', map, persist: true });
    const publication = await client.wait(m => ['mapRejected', 'mapPublished'].includes(m.type), 'regression map publication', after);
    assert.equal(publication.type, 'mapPublished', publication.message);
    await client.state(s => s.mapId === map.id);
    const target = kind === 'forest' ? { forestCell: 80 * 160 + 68 } : { nodeId: 'first-tree' };
    await client.command({ type: 'gather', ids: [0], ...target, clientOrderToken: 1 }, /GATHER ORDER/);
    const cut = await room.checkpoint(s => kind === 'forest'
      ? s.state.forestStocks.some(([cell, stock]) => cell === target.forestCell && stock === 0)
      : s.state.resourceNodes.find(n => n.id === target.nodeId).stock === 0);
    const banked = await client.state(s => s.wood[0] >= 106, 'actual six wood delivery');
    const observedTick = banked.tick + 90;
    const current = await room.checkpoint(s => s.state.tickNumber >= observedTick);
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
    const consumed = kind === 'forest' ? current.state.forestStocks.reduce((sum, [, stock]) => sum + 6 - stock, 0)
      : current.state.resourceNodes.filter(n => n.type === 'wood').reduce((sum, n) => sum + 6 - n.stock, 0);
    const cargo = current.state.units.reduce((sum, u) => sum + (u.cargoType === 'wood' ? u.cargo : 0), 0);
    assert.ok(Math.abs(consumed - (current.state.teamWood[0] - 100) - cargo) < 1e-4, 'finite wood conservation');
    reports.push({ kind, expected, cutTick: cut.state.tickNumber, tick: current.state.tickNumber,
      wood: current.state.teamWood[0], cargo, consumed, otherConsumed,
      worker: { gatherForestCell: worker.gatherForestCell, gatherNodeId: worker.gatherNodeId, gatherPhase: worker.gatherPhase }, dimensions: [160, 160] });
  } finally { await room.dispose(); }
}
const source = entrypointPath ? execFileSync('git', ['-C', entrypointPath.slice(0, entrypointPath.lastIndexOf('/')), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  : execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const report = { sourceRevision: source, nodeVersion: process.version, evidenceType: 'local-native-source-replay', deployedObservation: false, reports };
const output = process.argv.find(arg => arg.startsWith('--output='))?.slice(9);
if (output) await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report, null, 2));
