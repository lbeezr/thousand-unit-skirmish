// Prove plain Food/Stone area continuation through an actual cold restart.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { foodStoneJobMap, auditWorkerId, resourceBank, typedDraw, resourceJobObservation } from './food-stone-job-fixture.mjs';
import { createGatherWorkIntent } from '../src/work-intent.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
function sourceIdentity() {
  const git = args => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  const files = git(['ls-files', 'server.mjs', 'src', 'scripts/food-stone*', 'scripts/food-job*', 'scripts/stone-job*',
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
    const initial = await room.checkpoint(next => next.mapDefinition.id === map.id);
    await Promise.all(clients.map((client, team) => client.command({ type: 'gather', ids: [auditWorkerId(team)],
      nodeId: `seat-${team}-first`, clientOrderToken: team + 1 }, /GATHER ORDER/)));
    let manualOverride = null;
    if (resource === 'food') {
      await room.checkpoint(next => [0, 1].every(team => next.state.units[auditWorkerId(team)].cargo > .5));
      await Promise.all(clients.map((client, team) => client.command({ type: 'stop', ids: [auditWorkerId(team)],
        clientOrderToken: 10 + team }, /STOP ORDER/)));
      const stopped = await room.checkpoint(next => [0, 1].every(team => {
        const worker = next.state.units[auditWorkerId(team)];
        return worker.workIntent === null && worker.gatherPhase === '' && worker.cargo > .5;
      }));
      for (const target of ['next', 'first']) {
        await Promise.all(clients.map((client, team) => client.command({ type: 'gather', ids: [auditWorkerId(team)],
          nodeId: `seat-${team}-${target}`, clientOrderToken: (target === 'next' ? 20 : 30) + team }, /GATHER ORDER/)));
        const reassigned = await room.checkpoint(next => [0, 1].every(team => next.state.units[auditWorkerId(team)].gatherNodeId === `seat-${team}-${target}`));
        for (const team of [0, 1]) {
          const worker = reassigned.state.units[auditWorkerId(team)];
          assert.deepEqual(worker.workIntent, createGatherWorkIntent(worker.generation,
            map.resourceNodes.find(node => node.id === `seat-${team}-${target}`), 'food'));
          assert.ok(worker.cargo >= stopped.state.units[auditWorkerId(team)].cargo, 'Stop and manual replacements retain real Food cargo');
        }
      }
      manualOverride = { stopClearedJob: true, replacementAnchorsVerified: ['next', 'first'],
        retainedFoodCargo: [0, 1].map(team => stopped.state.units[auditWorkerId(team)].cargo) };
    }
    await room.checkpoint(saved => [0, 1].every(team => {
      const worker = saved.state.units[auditWorkerId(team)];
      return worker.gatherNodeId === `seat-${team}-next` && worker.cargo > 6;
    }));
    await room.stop();
    const saved = JSON.parse(await readFile(room.checkpointPath, 'utf8'));
    await room.start(); clients = [await room.connect(0, tokens[0]), await room.connect(1, tokens[1])];
    for (const client of clients) assert.equal(client.welcome.recoveredFromCheckpoint, true);
    const restored = await room.checkpoint(next => next.sequence > saved.sequence
      && next.state.tickNumber >= saved.state.tickNumber);
    for (const team of [0, 1]) {
      const worker = restored.state.units[auditWorkerId(team)];
      assert.equal(worker.gatherNodeId, `seat-${team}-next`, 'cold recovery keeps the automatically reselected execution source');
      assert.equal(worker.cargoType, resource);
      assert.deepEqual(worker.workIntent, createGatherWorkIntent(worker.generation,
        map.resourceNodes.find(node => node.id === `seat-${team}-first`), resource));
      assert.deepEqual(worker.workIntent, saved.state.units[auditWorkerId(team)].workIntent);
    }
    const final = await room.checkpoint(next => [0, 1].every(team => {
      const worker = next.state.units[auditWorkerId(team)];
      return worker.cargo === 0 && worker.gatherPhase === ''
        && resourceBank(next.state, resource, team) >= (map.startingResources[resource] ?? 0) + 12;
    }));
    for (const type of ['food', 'wood', ...(resource === 'stone' ? ['stone'] : [])]) {
      const banked = [0, 1].reduce((sum, team) => sum + resourceBank(final.state, type, team)
        - (map.startingResources[type] ?? 0), 0);
      assert.ok(Math.abs(typedDraw(final.state, map, type) - banked) < 1e-4, 'finite typed conservation after empty cargo');
    }
    for (const team of [0, 1]) {
      assert.equal(final.state.resourceNodes.find(node => node.id === `seat-${team}-first`).stock, 0);
      assert.equal(resourceBank(final.state, resource, team), (map.startingResources[resource] ?? 0) + 12);
      assert.equal(final.state.resourceNodes.find(node => node.id === `seat-${team}-next`).stock, 0);
      for (const suffix of ['other', 'far']) assert.equal(final.state.resourceNodes.find(node => node.id === `seat-${team}-${suffix}`).stock, 6);
    }
    assert.deepEqual(final.state.units.filter(unit => ![0, 1].map(auditWorkerId).includes(unit.id)),
      initial.state.units.filter(unit => ![0, 1].map(auditWorkerId).includes(unit.id)), 'native continuation recruits no unselected actors');
    reports.push({ resource, dimensions: [map.width, map.height], finalTick: final.state.tickNumber,
      recovered: true, checkpointSequence: { saved: saved.sequence, restored: restored.sequence },
      recoveredWorkers: [0, 1].map(team => ({ team, gatherNodeId: restored.state.units[auditWorkerId(team)].gatherNodeId,
        cargo: restored.state.units[auditWorkerId(team)].cargo, workIntent: restored.state.units[auditWorkerId(team)].workIntent })),
      sourceDraw: typedDraw(final.state, map, resource), policyObserved: resource === 'stone' ? 'fixed-area-stone' : 'fixed-area-plain-food',
      unselectedActorsUnchanged: true, manualOverride,
      seats: [0, 1].map(team => resourceJobObservation(final.state, resource, team)) });
  } finally { await room.dispose(); }
}
assert.deepEqual(sourceIdentity(), frozen, 'audit source remains frozen');
const report = { ...frozen, nodeVersion: process.version, evidenceType: 'local-native-source-audit',
  deployedObservation: false, continuationResources: ['wood', 'stone', 'plain-neutral-land-food'], foodPolicyChanged: true, reports };
const output = process.argv.find(arg => arg.startsWith('--output='))?.slice(9);
if (output) await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report, null, 2));
