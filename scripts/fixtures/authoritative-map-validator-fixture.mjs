import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'acorn';

// Execute the actual host body with its actual imports and policy declarations.
// This adapter starts no server and substitutes no validation or limit policy.
const serverUrl = new URL('../../server.mjs', import.meta.url);
const source = await readFile(serverUrl, 'utf8');
const program = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
const functionSource = name => {
  const declaration = program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === name);
  assert.ok(declaration, `Production map validator function moved: ${name}`);
  return source.slice(declaration.start, declaration.end);
};
const declarationSource = name => {
  const declaration = program.body.find(node => node.type === 'VariableDeclaration'
    && node.declarations.some(item => item.id.type === 'Identifier' && item.id.name === name));
  assert.ok(declaration, `Production map validator policy moved: ${name}`);
  return source.slice(declaration.start, declaration.end);
};
const limitNames = ['MAX_UNITS', 'MAX_MAP_OBSTACLES', 'MAX_RESOURCE_NODES',
  'MAX_OBJECTIVE_FOOD_REWARD', 'MAX_MAP_SCENARIO_EVENTS', 'MAX_SCENARIO_EVENT_REPEATS',
  'MIN_SCENARIO_EVENT_REPEAT_SECONDS'];
const importNames = ['resolveEconomyProfileId', 'economyResources', 'validateMapAudioReference',
  'validateMapRegion', 'TERRAIN_MATERIALS', 'UNIT_DEFINITIONS', 'buildElevationGrid',
  'findUnreachableCaptureZone', 'findUnreachableResourceNode', 'validateElevationPatches',
  'findInvalidCapturePrerequisite', 'findInvalidScenarioEventChain', 'findInvalidResourceVariant',
  'validCompletionTrigger', 'validRegionEntryTrigger', 'validateScenarioRegions',
  'validWildlifeNodeDefinition', 'TECHNOLOGY_DEFINITIONS', 'createMapDefinitionValidator'];
const imports = {};
for (const declaration of program.body.filter(node => node.type === 'ImportDeclaration')) {
  const selected = declaration.specifiers.filter(item => importNames.includes(item.local.name));
  if (!selected.length) continue;
  const module = await import(new URL(declaration.source.value, serverUrl));
  for (const item of selected) {
    assert.equal(item.type, 'ImportSpecifier');
    imports[item.local.name] = module[item.imported.name];
  }
}
assert.deepEqual(Object.keys(imports).sort(), [...importNames].sort());

export function createAuthoritativeMapValidatorFixture({ observeResearchLookup } = {}) {
  const policy = new Function('TECHNOLOGY_DEFINITIONS', [
    ...limitNames.map(declarationSource), declarationSource('RESEARCH_RULES'),
    functionSource('researchRulesFor'),
    `return { limits: { ${limitNames.join(', ')} }, researchRulesFor };`,
  ].join('\n'))(imports.TECHNOLOGY_DEFINITIONS);
  const researchRulesFor = type => {
    observeResearchLookup?.(type);
    return policy.researchRulesFor(type);
  };
  const bindings = { ...imports, ...policy.limits, researchRulesFor };
  const validateMapDefinition = new Function(...Object.keys(bindings),
    `${declarationSource('authoritativeMapValidator')}\nreturn (${functionSource('validateMapDefinition')});`)(...Object.values(bindings));
  return { validateMapDefinition, limits: policy.limits, researchRulesFor: policy.researchRulesFor };
}
