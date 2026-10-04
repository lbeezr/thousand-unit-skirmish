/** @typedef {{food: number, wood: number}} FoodWoodCost */
/** @typedef {{upgradeKey: string, label: string}} TechnologyRequirement */

/**
 * Shared by registered unit production and research against validated definitions.
 * Completion uses each technology's upgrade key, while IDs keep declaration order.
 * Broken registry references remain programmer faults; callers validate admission.
 * @param {readonly string[] | null | undefined} requires
 * @param {Readonly<Record<string, boolean>> | null | undefined} upgrades
 * @param {Readonly<Record<string, TechnologyRequirement>>} technologies
 * @returns {string[]}
 */
export function missingTechnologyPrerequisites(requires, upgrades, technologies) {
  return (requires || []).filter(id => !upgrades?.[technologies[id].upgradeKey]);
}

/**
 * Format an already nonempty missing-prerequisite list at its caller's rejection
 * step, preserving label order and the action-specific rejection precedence.
 * @param {readonly string[]} missing
 * @param {Readonly<Record<string, TechnologyRequirement>>} technologies
 * @returns {string}
 */
export function technologyRequirementReason(missing, technologies) {
  return `REQUIRES ${missing.map(id => technologies[id].label).join(' + ')}`;
}

/**
 * Existing two-resource action availability only; no debit, reservation or refund.
 * Both balances and costs come from validated gameplay state/definitions. Keep
 * the existing tolerance and fractional price text without display rounding.
 * @param {Readonly<FoodWoodCost>} balance
 * @param {Readonly<FoodWoodCost>} cost
 * @returns {string} The existing shortfall reason, or an empty string.
 */
export function foodWoodShortfallReason(balance, cost) {
  return balance.food + 1e-9 < cost.food || balance.wood + 1e-9 < cost.wood
    ? `NEED ${cost.food} FOOD + ${cost.wood} WOOD` : '';
}
