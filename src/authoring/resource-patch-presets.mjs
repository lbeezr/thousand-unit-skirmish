// Editor recipes compile through the existing constrained placement helper.
// They supply shape/type only; authors retain the seed, anchor and total stock.
export const RESOURCE_PATCH_PRESETS = Object.freeze([
  Object.freeze({ id: 'wood-grove', label: 'Wood Grove',
    description: 'Nine finite Wood markers with a dense center and a thinner edge.',
    settings: Object.freeze({ type: 'wood', nodesPerPatch: 9, radius: 6, distribution: 'core-falloff' }),
  }),
  Object.freeze({ id: 'food-orchard', label: 'Food Orchard',
    description: 'Five finite Food markers spread evenly within four cells.',
    settings: Object.freeze({ type: 'food', nodesPerPatch: 5, radius: 4, distribution: 'uniform' }),
  }),
]);
