// Compatibility entry; new consumers use the canonical rules boundary.
/** @typedef {import('./rules/gameplay-action-rules.mjs').FoodWoodCost} FoodWoodCost */
/** @typedef {import('./rules/gameplay-action-rules.mjs').TechnologyRequirement} TechnologyRequirement */
export { missingTechnologyPrerequisites, technologyRequirementReason,
  foodWoodShortfallReason } from './rules/gameplay-action-rules.mjs';
