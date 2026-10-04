import { createWildlifeHerdState, cancelWildlifeHerd } from './wildlife-herding.mjs';
import { createWildlifeMotion, freezeWildlifeMotion } from './wildlife-motion.mjs';
// Neutral wildlife shares the existing food-node pool and routing.
// Authored maps contain identity/stock; lifecycle belongs to the room worker.
export const BELLWEATHER_SHEEP_SPECIES = 'bellweather-sheep';
export const validWildlifeTeam = team => team === null || team === 0 || team === 1;

export function validWildlifeNodeDefinition(node) {
  return node.wildlifeState === undefined && node.wildlifeTeam === undefined
    && node.wildlifeHerd === undefined && node.wildlifeGrazeAnchor === undefined
    && node.wildlifeMotion === undefined && node.wildlifeActivity === undefined && node.wildlifeHeading === undefined
    && (node.wildlifeNoseYawDegrees === undefined
      || (node.wildlifeSpecies === BELLWEATHER_SHEEP_SPECIES
        && Number.isFinite(node.wildlifeNoseYawDegrees)
        && node.wildlifeNoseYawDegrees >= 0 && node.wildlifeNoseYawDegrees < 360))
    && (node.wildlifeSpecies === undefined
      || (node.wildlifeSpecies === BELLWEATHER_SHEEP_SPECIES && node.type === 'food'));
}

export function createResourceNodeState(node) {
  return {
    id: node.id, type: node.type, x: node.x, z: node.z, stock: node.stock,
    ...(node.resourceVariant === undefined ? {} : { resourceVariant: node.resourceVariant }),
    ...(node.wildlifeSpecies === undefined ? {} : {
      ...createWildlifeHerdState(node),
      wildlifeSpecies: node.wildlifeSpecies, wildlifeState: 'alive', wildlifeTeam: null, wildlifeMotion: createWildlifeMotion(node),
    }),
  };
}

export function validWildlifeNodeState(node, definition) {
  if (node.wildlifeSpecies !== definition.wildlifeSpecies) return false;
  if (definition.wildlifeSpecies === undefined) return node.wildlifeState === undefined && node.wildlifeMotion === undefined && node.wildlifeTeam === undefined
    && node.wildlifeHerd === undefined && node.wildlifeGrazeAnchor === undefined;
  if (node.wildlifeTeam !== undefined && !validWildlifeTeam(node.wildlifeTeam)) return false;
  if (node.wildlifeState === 'alive') return node.stock === definition.stock;
  if (node.wildlifeState === 'carcass') return node.stock > 0;
  return node.wildlifeState === 'depleted' && node.stock === 0;
}

// Call only after an authorized gatherer arrives in interaction range.
// Activation neither consumes stock nor grants cargo/banked food.
export function activateWildlifeHarvest(node) {
  if (node.wildlifeSpecies === undefined || node.wildlifeState !== 'alive' || node.stock <= 0) return false;
  cancelWildlifeHerd(node);
  node.wildlifeState = 'carcass';
  freezeWildlifeMotion(node);
  return true;
}

export function markWildlifeDepleted(node) {
  if (node.wildlifeSpecies !== undefined && node.stock === 0) {
    cancelWildlifeHerd(node);
    node.wildlifeState = 'depleted'; freezeWildlifeMotion(node);
  }
}
