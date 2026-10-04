// Prove Stone area continuation and unchanged source-only Food through real recovery.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { foodStoneJobMap, auditWorkerId, resourceBank, typedDraw, resourceJobObservation } from './food-stone-job-fixture.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
function sourceIdentity() {
  const git = args => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  const files = git(['ls-files', 'server.mjs', 'src', 'scripts/food-stone*', 'scripts/stone-job*',
    'scripts/fortified-crossing-fixture.mjs', 'maps/stone-defense-field.json']).split('\n').filter(Boolean);
  return { sourceRevision: git(['rev-parse', 'HEAD']), sourceDirty: !!git(['status', '--porcelain']),
    inputs: files.map(file => ({ path: file, sha256: createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex') })) };
}
const frozen = sourceIdentity(), reports = [];
for (const resource of ['food', 'stone']) {
  const room = await createFortifiedFixture({ mapPath: 'maps/stone-defense-field.json', timeoutMs: 30_000 });
  try {
    await room.start(); let clients = [await room.connect(0), await room.connect(1)];
    const tokens = clients.map(client => client.welcome.player.sessionToken);
    const map = foodStoneJobMap(resource), after = clients[0].messages.length;
    clients[0].send({ type: 'publishMap', map, persist: true });
    const publication = await clients[0].wait(message => ['mapPublished', 'mapRejected'].includes(message.type), 'typed audit map', after);
    assert.equal(publication.type, 'mapPublished', publication.message);
    // An idle publication may emit only mapChange; don't await a future dirty
    // state frame after missing that event on either seat.
    await Promise.all(clients.map(client => client.wait(message => message.type === 'mapChange'
      && message.map.id === map.id, 'typed audit map change')));
    for (const client of clients) assert.equal(client.latest.mapId, map.id);
    await Promise.all(clients.map((client, team) => client.command({ type: 'gather', ids: [auditWorkerId(team)],
      nodeId: `seat-${team}-first`, clientOrderToken: team + 1 }, /GATHER ORDER/)));
    await room.checkpoint(saved => [0, 1].every(team => saved.state.units[auditWorkerId(team)].cargo > .5));
    await room.stop();
    const saved = JSON.parse(await readFile(room.checkpointPath, 'utf8'));
    await room.start(); clients = [await room.connect(0, tokens[0]), await room.connect(1, tokens[1])];
    for (const client of clients) assert.equal(client.welcome.recoveredFromCheckpoint, true);
    const restored = await room.checkpoint(next => next.sequence > saved.sequence
      && next.state.tickNumber >= saved.state.tickNumber);
    for (const team of [0, 1]) {
      const worker = restored.state.units[auditWorkerId(team)];
      assert.equal(worker.gatherNodeId, `seat-${team}-first`);
      assert.equal(worker.cargoType, resource);
      if (resource === 'food') assert.equal(worker.workIntent, null, 'Food remains source-only');
      else {
        assert.deepEqual(worker.workIntent, { version: 1, kind: 'gather', generation: worker.generation,
          resource: 'stone', anchor: { x: (team ? 1 : -1) * 11.5, z: 5.5 } });
        assert.deepEqual(worker.workIntent, saved.state.units[auditWorkerId(team)].workIntent);
      }
    }
    const final = await room.checkpoint(next => [0, 1].every(team => {
      const worker = next.state.units[auditWorkerId(team)];
      return worker.cargo === 0 && worker.gatherPhase === ''
        && resourceBank(next.state, resource, team) >= (map.startingResources[resource] ?? 0) + (resource === 'stone' ? 12 : 6);
    }));
    for (const type of ['food', 'wood', ...(resource === 'stone' ? ['stone'] : [])]) {
      const banked = [0, 1].reduce((sum, team) => sum + resourceBank(final.state, type, team)
        - (map.startingResources[type] ?? 0), 0);
      assert.ok(Math.abs(typedDraw(final.state, map, type) - banked) < 1e-4, 'finite typed conservation after empty cargo');
    }
    for (const team of [0, 1]) {
      assert.equal(final.state.resourceNodes.find(node => node.id === `seat-${team}-first`).stock, 0);
      assert.equal(resourceBank(final.state, resource, team), (map.startingResources[resource] ?? 0) + (resource === 'stone' ? 12 : 6));
      assert.equal(final.state.resourceNodes.find(node => node.id === `seat-${team}-next`).stock, resource === 'stone' ? 0 : 6);
      for (const suffix of ['other', 'far']) assert.equal(final.state.resourceNodes.find(node => node.id === `seat-${team}-${suffix}`).stock, 6);
    }
    reports.push({ resource, dimensions: [map.width, map.height], finalTick: final.state.tickNumber,
      recovered: true, checkpointSequence: { saved: saved.sequence, restored: restored.sequence },
      sourceDraw: typedDraw(final.state, map, resource), policyObserved: resource === 'stone' ? 'fixed-area-stone' : 'source-only',
      seats: [0, 1].map(team => resourceJobObservation(final.state, resource, team)) });
  } finally { await room.dispose(); }
}
assert.deepEqual(sourceIdentity(), frozen, 'audit source remains frozen');
const report = { ...frozen, nodeVersion: process.version, evidenceType: 'local-native-source-audit',
  deployedObservation: false, continuationResources: ['wood', 'stone'], foodPolicyChanged: false, reports };
const output = process.argv.find(arg => arg.startsWith('--output='))?.slice(9);
if (output) await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report, null, 2));
