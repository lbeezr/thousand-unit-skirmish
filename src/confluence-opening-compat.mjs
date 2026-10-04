// Definition compatibility only. Call after complete checkpoint validation;
// never migrate, relocate, restock or otherwise mutate an ongoing saved world.
export const CONFLUENCE_PRE_OPENING_MAP_HASH = '3uGjdX_oWE2AtGuLaem-L7BWf1Or-KMiZtY6sVZLMTI';
const MAP_ID = 'siltmouths-confluence-grounds';

export function isHistoricalConfluenceDefinition(saved, shipped, hashMap) {
  if (saved?.id !== MAP_ID || shipped?.id !== MAP_ID || typeof hashMap !== 'function'
    || !Array.isArray(shipped.resourceNodes)
    || hashMap(saved) !== CONFLUENCE_PRE_OPENING_MAP_HASH) return false;
  const preceding = structuredClone(shipped);
  for (const team of [0, 1]) for (const [suffix, currentZ, previousZ] of [
    ['berries', 4.5, 6.5], ['timber', -3.5, -9.5],
  ]) {
    const nodes = preceding.resourceNodes.filter(node => node?.id === `s${team}-${suffix}`);
    if (nodes.length !== 1 || nodes[0].x !== (team ? 50.5 : -50.5)
      || nodes[0].z !== currentZ) return false;
    nodes[0].z = previousZ;
  }
  // Reconstructing the exact preceding hash proves every other field, node,
  // ID, type, stock, geometry and rule is unchanged in today's catalog pair.
  return hashMap(preceding) === CONFLUENCE_PRE_OPENING_MAP_HASH;
}
