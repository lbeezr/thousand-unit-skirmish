import { BELLWEATHER_SHEEP_SPECIES } from './wildlife-state.mjs';

// Existing mirrored opening markers: retain the dirt-track anchor as ordinary food.
export const MILLRACE_SHEEP_IDS = Object.freeze([0, 1].flatMap(team =>
  [1, 3, 4].map(index => `s${team}-0-${index}`)));
export const MILLRACE_PRE_SHEEP_MAP_HASH = 'XF4DowoHH8lN_HYtFhrOy7E6TkXdMo3TQck2QFTHNt8';

export function seedMillraceSheep(nodes) {
  for (const id of MILLRACE_SHEEP_IDS) {
    const matches = nodes.filter(node => node.id === id);
    if (matches.length !== 1 || matches[0].type !== 'food' || !(matches[0].stock > 0)) {
      throw new Error(`Missing or invalid Millrace opening food marker: ${id}`);
    }
  }
  return nodes.map(node => ({ ...node,
    ...(MILLRACE_SHEEP_IDS.includes(node.id) ? { wildlifeSpecies: BELLWEATHER_SHEEP_SPECIES } : {}),
  }));
}

// Called only after full legacy checkpoint validation. Accept this exact shipped
// map revision, with identity as the sole authored change; never replenish stock.
export function migrateMillraceSheepCheckpoint(snapshot, shipped, hashMap) {
  if (snapshot?.mapDefinition?.id !== 'bellweather-millrace' || shipped?.id !== 'bellweather-millrace'
    || snapshot.mapHash !== MILLRACE_PRE_SHEEP_MAP_HASH
    || hashMap(snapshot.mapDefinition) !== MILLRACE_PRE_SHEEP_MAP_HASH
    || !Array.isArray(shipped.resourceNodes) || !Array.isArray(snapshot.state?.resourceNodes)) return false;
  const prior = structuredClone(shipped);
  const states = [];
  for (const id of MILLRACE_SHEEP_IDS) {
    const authored = prior.resourceNodes.filter(node => node.id === id);
    const saved = snapshot.state.resourceNodes.filter(node => node?.id === id);
    if (authored.length !== 1 || authored[0].wildlifeSpecies !== BELLWEATHER_SHEEP_SPECIES
      || saved.length !== 1 || saved[0].type !== 'food'
      || saved[0].wildlifeSpecies !== undefined || saved[0].wildlifeState !== undefined
      || !Number.isFinite(saved[0].stock) || saved[0].stock < 0 || saved[0].stock > authored[0].stock) return false;
    delete authored[0].wildlifeSpecies;
    states.push({ id, wildlifeSpecies: BELLWEATHER_SHEEP_SPECIES,
      wildlifeState: saved[0].stock === 0 ? 'depleted' : saved[0].stock === authored[0].stock ? 'alive' : 'carcass' });
  }
  if (hashMap(prior) !== MILLRACE_PRE_SHEEP_MAP_HASH) return false;
  snapshot.mapDefinition = structuredClone(shipped);
  snapshot.mapHash = hashMap(shipped);
  snapshot.state.resourceNodes = snapshot.state.resourceNodes.map(node => ({ ...node,
    ...states.find(state => state.id === node.id),
  }));
  return true;
}
