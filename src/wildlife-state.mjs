// Neutral stationary wildlife shares the existing food-node pool and routing.
// Authored maps contain identity/stock; lifecycle belongs to the room worker.
export const BELLWEATHER_SHEEP_SPECIES = 'bellweather-sheep';

export function validWildlifeNodeDefinition(node) {
  return node.wildlifeState === undefined
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
      wildlifeSpecies: node.wildlifeSpecies, wildlifeState: 'alive',
    }),
  };
}

export function validWildlifeNodeState(node, definition) {
  if (node.wildlifeSpecies !== definition.wildlifeSpecies) return false;
  if (definition.wildlifeSpecies === undefined) return node.wildlifeState === undefined;
  if (node.wildlifeState === 'alive') return node.stock === definition.stock;
  if (node.wildlifeState === 'carcass') return node.stock > 0;
  return node.wildlifeState === 'depleted' && node.stock === 0;
}

// Call only after an authorized gatherer arrives in interaction range.
// Activation neither consumes stock nor grants cargo/banked food.
export function activateWildlifeHarvest(node) {
  if (node.wildlifeSpecies === undefined || node.wildlifeState !== 'alive' || node.stock <= 0) return false;
  node.wildlifeState = 'carcass';
  return true;
}

export function markWildlifeDepleted(node) {
  if (node.wildlifeSpecies !== undefined && node.stock === 0) node.wildlifeState = 'depleted';
}
