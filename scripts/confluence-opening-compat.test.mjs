import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { CONFLUENCE_PRE_OPENING_MAP_HASH, isHistoricalConfluenceDefinition } from '../src/confluence-opening-compat.mjs';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('base64url');
const old = JSON.parse(gunzipSync(readFileSync(new URL('../docs/qa-evidence/confluence-grounds-2026-10-04/retained-economy.json.gz', import.meta.url)))).mapDefinition;
const map = JSON.parse(readFileSync(new URL('../maps/siltmouths-confluence-grounds.json', import.meta.url)));
const current = structuredClone(old);
for (const node of current.resourceNodes) if (/^s[01]-(berries|timber)$/.test(node.id)) node.z = map.resourceNodes.find(n => n.id === node.id).z;

test('canonical change contains only the four approved coordinates and reconstructs exact old normalized bytes', () => {
  assert.equal(hash(old), CONFLUENCE_PRE_OPENING_MAP_HASH);
  assert.equal(hash(current), 'aaJfD4u2B3Bga0xkgDjc7J98Y149wZl1Wc-hpzk6HNI');
  const priorRaw = structuredClone(map);
  for (const node of priorRaw.resourceNodes) if (/^s[01]-(berries|timber)$/.test(node.id)) node.z = node.type === 'food' ? 6.5 : -9.5;
  assert.equal(createHash('sha256').update(JSON.stringify(priorRaw, null, 2) + '\n').digest('hex'),
    '12a9b2a71763fde866a02211cc235b38a6574095fab0040ee8582f99bd20acdc');
  assert.equal(isHistoricalConfluenceDefinition(old, current, hash), true);
  assert.equal(isHistoricalConfluenceDefinition(current, current, hash), false);
  assert.equal(isHistoricalConfluenceDefinition(old, old, hash), false);
});

test('recognition is immutable and cannot refill or relocate a saved resource, cargo, order or building', () => {
  const snapshot = { mapDefinition: structuredClone(old), mapHash: hash(old),
    state: { resourceNodes: old.resourceNodes.map(n => ({ ...n, stock: n.id === 's0-berries' ? 0 : n.stock / 2 })),
      teamFood: [151.3, 200], teamWood: [170, 174], units: [{ cargo: 2.5, cargoType: 'wood',
        gatherNodeId: 's0-timber', gatherPhase: 'to-node', path: [12188, 12189], pathIndex: 1 }],
      buildings: [{ type: 'house', x: -51.5, z: -2.5, complete: true, footprint: [12189] }],
    } };
  const before = structuredClone(snapshot), shippedBefore = structuredClone(current);
  assert.equal(isHistoricalConfluenceDefinition(snapshot.mapDefinition, current, hash), true);
  assert.deepEqual(snapshot, before); assert.deepEqual(current, shippedBefore);
});

test('unknown old definitions and every extra catalog difference reject instead of relaxing shipped-map integrity', () => {
  for (const change of [
    d => { d.id = 'other'; }, d => { d.width++; }, d => { d.terrainSeed++; },
    d => { d.resourceNodes[0].stock++; }, d => { d.resourceNodes[0].type = 'wood'; },
    d => { d.resourceNodes[0].id = 'renamed'; }, d => { d.resourceNodes[0].x += .01; },
    d => { d.resourceNodes[0].z += .01; }, d => { d.resourceNodes[1].z -= .01; },
    d => { d.resourceNodes[2].stock--; }, d => { d.resourceNodes.pop(); },
    d => { d.resourceNodes.push({ ...d.resourceNodes[0] }); }, d => { d.startingResources.food++; },
    d => { d.obstacles.pop(); }, d => { d.elevationPatches[0].level = 0; },
  ]) {
    const shipped = structuredClone(current); change(shipped); const before = structuredClone(shipped);
    assert.equal(isHistoricalConfluenceDefinition(old, shipped, hash), false);
    assert.deepEqual(shipped, before);
    const saved = structuredClone(old); change(saved); const savedBefore = structuredClone(saved);
    assert.equal(isHistoricalConfluenceDefinition(saved, current, hash), false);
    assert.deepEqual(saved, savedBefore);
  }
  for (const value of [undefined, null, {}, [], { id: 'other' }]) {
    assert.equal(isHistoricalConfluenceDefinition(value, current, hash), false);
    assert.equal(isHistoricalConfluenceDefinition(old, value, hash), false);
  }
  assert.equal(isHistoricalConfluenceDefinition(old, current, () => 'forged'), false);
});
