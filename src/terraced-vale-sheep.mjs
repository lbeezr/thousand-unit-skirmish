import { createWildlifeHerdState } from './wildlife-herding.mjs';
import { createWildlifeMotion, freezeWildlifeMotion } from './wildlife-motion.mjs';
import { BELLWEATHER_SHEEP_SPECIES } from './wildlife-state.mjs';

// Retain the valley food and every authored food budget/position unchanged.
export const TERRACED_VALE_SHEEP_IDS = Object.freeze([0, 1].flatMap(team =>
  ['home', 'terrace'].map(place => `s${team}-${place}-food`)));
export const TERRACED_VALE_PRE_SHEEP_MAP_HASH = 'ImVzTpuwRCVYvUSkyoNbcCYPNbOKANQOgyyTlL6AwHk';
export const TERRACED_VALE_PRE_GROVE_MAP_HASH = 'xEcOHiBDv8y07ddWm72BRzibVp_4kkAyjDxvWxYW4yk';
const MAP_ID = 'veyrholds-terraced-vale';
const WILDLIFE_FIELDS = ['wildlifeSpecies', 'wildlifeState', 'wildlifeTeam',
  'wildlifeMotion', 'wildlifeHerd', 'wildlifeGrazeAnchor', 'wildlifeHeading', 'wildlifeActivity'];

// Exact preceding authored layout. Recovery must keep its legal building sites,
// moved Sheep, resource stock and worker orders; only new games adopt the grove.
export function priorTerracedValeGroves(shipped) {
  if (shipped?.id !== MAP_ID || !Array.isArray(shipped.resourceNodes)
    || shipped.resourceNodes.length !== 16) return null;
  const prior = structuredClone(shipped), satellites = new Set();
  for (const team of [0, 1]) for (const [suffix, x, z] of [
    ['', 51.5, -5.5], ['-1', 51.5, -7.5], ['-2', 49.5, -5.5],
  ]) {
    const id = `s${team}-home-wood${suffix}`;
    const matches = prior.resourceNodes.filter(node => node?.id === id), node = matches[0];
    if (matches.length !== 1 || node.type !== 'wood' || node.stock !== 325
      || node.x !== x * (team ? 1 : -1) || node.z !== z
      || Object.keys(node).sort().join(',') !== 'id,stock,type,x,z') return null;
    if (suffix) satellites.add(id);
    else node.stock = 975;
  }
  prior.resourceNodes = prior.resourceNodes.filter(node => !satellites.has(node.id));
  return prior;
}

export function isHistoricalTerracedValeDefinition(saved, shipped, hashMap) {
  if (saved?.id !== MAP_ID || typeof hashMap !== 'function'
    || hashMap(saved) !== TERRACED_VALE_PRE_GROVE_MAP_HASH) return false;
  const prior = priorTerracedValeGroves(shipped);
  return prior !== null && hashMap(prior) === TERRACED_VALE_PRE_GROVE_MAP_HASH;
}

export function seedTerracedValeSheep(nodes) {
  if (!Array.isArray(nodes)) throw new Error('Terraced Vale food markers must be an array.');
  for (const id of TERRACED_VALE_SHEEP_IDS) {
    const matches = nodes.filter(node => node?.id === id), node = matches[0];
    if (matches.length !== 1 || node.type !== 'food' || !Number.isFinite(node.stock) || node.stock <= 0
      || (node.wildlifeSpecies !== undefined && node.wildlifeSpecies !== BELLWEATHER_SHEEP_SPECIES)) {
      throw new Error(`Missing or invalid Terraced Vale Sheep food marker: ${id}`);
    }
  }
  return nodes.map(node => ({ ...node,
    ...(TERRACED_VALE_SHEEP_IDS.includes(node.id) ? { wildlifeSpecies: BELLWEATHER_SHEEP_SPECIES } : {}),
  }));
}

// Called only after complete checkpoint migration/validation. Admit exactly the
// pre-Sheep Tiny map with these four identity additions; never restock
// or repair an old ordinary food node, motion, order, cargo or bank.
export function migrateTerracedValeSheepCheckpoint(snapshot, shipped, hashMap) {
  if (![29, 30].includes(snapshot?.schemaVersion) || snapshot.mapDefinition?.id !== MAP_ID
    || shipped?.id !== MAP_ID || typeof hashMap !== 'function'
    || snapshot.mapHash !== TERRACED_VALE_PRE_SHEEP_MAP_HASH
    || hashMap(snapshot.mapDefinition) !== TERRACED_VALE_PRE_SHEEP_MAP_HASH
    || !Array.isArray(shipped.resourceNodes) || !Array.isArray(snapshot.state?.resourceNodes)) return false;
  const target = priorTerracedValeGroves(shipped) ?? shipped;
  const prior = structuredClone(target), savedNodes = snapshot.state.resourceNodes;
  const oldDefinitions = new Map(snapshot.mapDefinition.resourceNodes.map(node => [node.id, node]));
  if (savedNodes.length !== snapshot.mapDefinition.resourceNodes.length
    || new Set(savedNodes.map(node => node?.id)).size !== savedNodes.length
    || savedNodes.some(node => {
      const definition = oldDefinitions.get(node?.id);
      return !definition || node.type !== definition.type || node.x !== definition.x || node.z !== definition.z
        || !Number.isFinite(node.stock) || node.stock < 0 || node.stock > definition.stock
        || WILDLIFE_FIELDS.some(field => node[field] !== undefined);
    })) return false;
  const selected = new Map();
  for (const id of TERRACED_VALE_SHEEP_IDS) {
    const definitions = prior.resourceNodes.filter(node => node?.id === id);
    const states = savedNodes.filter(node => node?.id === id);
    const definition = definitions[0], node = states[0];
    if (definitions.length !== 1 || definition.type !== 'food'
      || definition.wildlifeSpecies !== BELLWEATHER_SHEEP_SPECIES
      || states.length !== 1 || node.type !== 'food'
      || WILDLIFE_FIELDS.some(field => node[field] !== undefined)
      || !Number.isFinite(node.stock) || node.stock < 0 || node.stock > definition.stock
      || node.x !== definition.x || node.z !== definition.z) return false;
    delete definition.wildlifeSpecies;
    selected.set(id, {
      ...node, ...createWildlifeHerdState(node), wildlifeSpecies: BELLWEATHER_SHEEP_SPECIES,
      wildlifeState: node.stock === 0 ? 'depleted' : node.stock === definition.stock ? 'alive' : 'carcass',
      wildlifeTeam: null, wildlifeMotion: createWildlifeMotion(definition),
    });
    if (selected.get(id).wildlifeState !== 'alive') freezeWildlifeMotion(selected.get(id));
  }
  if (hashMap(prior) !== TERRACED_VALE_PRE_SHEEP_MAP_HASH) return false;
  // All guards and private state construction finish before the first write.
  snapshot.mapDefinition = structuredClone(target);
  snapshot.mapHash = hashMap(target);
  snapshot.state.resourceNodes = savedNodes.map(node => selected.get(node.id) ?? node);
  return true;
}
