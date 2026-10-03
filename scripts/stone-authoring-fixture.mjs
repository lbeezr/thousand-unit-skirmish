import { readFile } from 'node:fs/promises';
import { seededMirroredResourceClusters } from '../src/resource-cluster-authoring.mjs';

// Offline proposal only: these stocks exercise integer division, not balance.
// Use the existing wood geometry path without admitting Stone to runtime rules.
export async function createStoneAuthoringFixture() {
  const baseMap = JSON.parse(await readFile(new URL('../maps/open-field.json', import.meta.url), 'utf8'));
  const layout = { seed: 93000, nodesPerPatch: 3, radius: 4, spawnClearance: 6,
    patches: [{ type: 'wood', x: -12.5, z: 10.5, stock: 101 }] };
  const candidateNodes = seededMirroredResourceClusters(baseMap, layout).map(node => ({
    ...node, id: `stone-candidate-${node.id}`, type: 'stone',
  }));
  return { status: 'proposal-not-playable', proposedResourceType: 'stone',
    stockMeaning: 'test sentinel, not an approved economic budget',
    layout: { seed: layout.seed, nodesPerPatch: layout.nodesPerPatch, radius: layout.radius,
      spawnClearance: layout.spawnClearance, stockPerSeat: 101 }, baseMap, candidateNodes };
}
